use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, EventTarget};

// Voice capture state
static CAPTURING: AtomicBool = AtomicBool::new(false);

struct AudioBuffer {
    samples: Vec<f32>,
    sample_rate: u32,
}

struct WhisperConfig {
    api_key: Option<String>,
    use_local: bool,
    model_path: Option<String>,
    provider: String,       // "openai" or "groq"
    model: String,          // e.g. "whisper-1", "whisper-large-v3-turbo"
    groq_api_key: Option<String>,
}

struct DeviceConfig {
    selected_device: Option<String>,
}

lazy_static::lazy_static! {
    static ref AUDIO_BUFFER: Arc<Mutex<AudioBuffer>> = Arc::new(Mutex::new(AudioBuffer {
        samples: Vec::new(),
        sample_rate: 16000,
    }));
    static ref WHISPER_CONFIG: Arc<Mutex<WhisperConfig>> = Arc::new(Mutex::new(WhisperConfig {
        api_key: None,
        use_local: false,
        model_path: None,
        provider: "openai".to_string(),
        model: "whisper-1".to_string(),
        groq_api_key: None,
    }));
    static ref DEVICE_CONFIG: Arc<Mutex<DeviceConfig>> = Arc::new(Mutex::new(DeviceConfig {
        selected_device: None,
    }));
}

// Stream handle stored separately because cpal::Stream is not Send+Sync
// We use thread_local for the stream, but control it via atomic flag
use std::cell::RefCell;
thread_local! {
    static STREAM_HANDLE: RefCell<Option<cpal::Stream>> = RefCell::new(None);
}

pub fn init() -> Result<(), Box<dyn std::error::Error>> {
    // Check for available audio input
    let host = cpal::default_host();
    match host.default_input_device() {
        Some(device) => {
            println!("Audio input device: {}", device.name().unwrap_or_default());
        }
        None => {
            println!("Warning: No audio input device found");
        }
    }
    println!("Voice system initialized");
    Ok(())
}

/// Configure transcription settings
pub fn configure_whisper(
    api_key: Option<String>,
    use_local: bool,
    model_path: Option<String>,
    provider: Option<String>,
    model: Option<String>,
    groq_api_key: Option<String>,
) {
    let mut config = WHISPER_CONFIG.lock();
    config.api_key = api_key;
    config.use_local = use_local;
    config.model_path = model_path;
    if let Some(p) = provider {
        config.provider = p;
    }
    if let Some(m) = model {
        config.model = m;
    }
    config.groq_api_key = groq_api_key;
}

/// List available audio input devices
pub fn list_input_devices() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let host = cpal::default_host();
    let devices: Vec<String> = host
        .input_devices()?
        .filter_map(|d| d.name().ok())
        .collect();
    Ok(devices)
}

/// Get the currently selected device name (or default)
pub fn get_selected_device() -> Option<String> {
    let config = DEVICE_CONFIG.lock();
    config.selected_device.clone()
}

/// Set the audio input device by name
pub fn set_input_device(device_name: Option<String>) {
    let mut config = DEVICE_CONFIG.lock();
    config.selected_device = device_name;
}

/// Get a device by name, or the default input device
fn get_input_device() -> Result<cpal::Device, Box<dyn std::error::Error>> {
    let host = cpal::default_host();
    let config = DEVICE_CONFIG.lock();

    if let Some(ref name) = config.selected_device {
        // Try to find the device by name
        for device in host.input_devices()? {
            if device.name().ok().as_ref() == Some(name) {
                return Ok(device);
            }
        }
        // Fall through to default if not found
        eprintln!("Selected device '{}' not found, using default", name);
    }

    host.default_input_device()
        .ok_or_else(|| "No input device available".into())
}

pub fn start_capture(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if CAPTURING.load(Ordering::SeqCst) {
        return Ok(());
    }

    let device = get_input_device()?;
    let device_name = device.name().unwrap_or_else(|_| "Unknown".to_string());
    println!("Using audio device: {}", device_name);

    // Get supported config - prefer mono at any sample rate
    let supported_config = device
        .supported_input_configs()?
        .filter(|c| c.channels() == 1)
        .max_by_key(|c| c.max_sample_rate().0)
        .or_else(|| {
            // Fall back to any config if no mono available
            device.supported_input_configs().ok()?.next()
        })
        .ok_or("No supported audio configuration found")?;

    // Use a reasonable sample rate within the supported range
    let min_rate = supported_config.min_sample_rate().0;
    let max_rate = supported_config.max_sample_rate().0;

    // Prefer 16kHz (Whisper native), then 44.1kHz, then 48kHz, then max available
    let target_rate = if min_rate <= 16000 && 16000 <= max_rate {
        16000
    } else if min_rate <= 44100 && 44100 <= max_rate {
        44100
    } else if min_rate <= 48000 && 48000 <= max_rate {
        48000
    } else {
        max_rate
    };

    let config: cpal::StreamConfig = supported_config
        .with_sample_rate(cpal::SampleRate(target_rate))
        .into();

    let actual_channels = config.channels;
    let actual_sample_rate = config.sample_rate.0;
    println!("Audio config: {}Hz, {} channel(s)", actual_sample_rate, actual_channels);

    // Update buffer sample rate
    {
        let mut buffer = AUDIO_BUFFER.lock();
        buffer.sample_rate = actual_sample_rate;
        buffer.samples.clear();
    }

    let app_handle = app.clone();
    let err_app = app.clone();
    let channels = actual_channels;

    // Build input stream
    let stream = device.build_input_stream(
        &config,
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            if !CAPTURING.load(Ordering::SeqCst) {
                return;
            }

            let mut buffer = AUDIO_BUFFER.lock();

            // Convert to mono if stereo
            if channels == 2 {
                for chunk in data.chunks(2) {
                    if chunk.len() == 2 {
                        buffer.samples.push((chunk[0] + chunk[1]) / 2.0);
                    }
                }
            } else if channels == 1 {
                buffer.samples.extend_from_slice(data);
            } else {
                // Multi-channel: take first channel only
                for chunk in data.chunks(channels as usize) {
                    if !chunk.is_empty() {
                        buffer.samples.push(chunk[0]);
                    }
                }
            }

            // Simple VAD: check if we have enough audio and energy
            // Process every ~1 second of audio (reduced from 2s for lower latency)
            let samples_per_chunk = buffer.sample_rate as usize * 1;
            if buffer.samples.len() >= samples_per_chunk {
                // Calculate RMS energy
                let rms: f32 = (buffer.samples.iter().map(|s| s * s).sum::<f32>()
                    / buffer.samples.len() as f32)
                    .sqrt();

                // If there's significant audio energy, emit for transcription
                if rms > 0.01 {
                    // Clone samples for processing
                    let audio_data = buffer.samples.clone();
                    let sample_rate = buffer.sample_rate;
                    let app = app_handle.clone();

                    // Process using Tauri's async runtime (required for events to reach frontend)
                    tauri::async_runtime::spawn_blocking(move || {
                        match transcribe_audio(&audio_data, sample_rate) {
                            Ok(Some(transcript)) if !transcript.trim().is_empty() => {
                                println!("Transcript: {}", transcript);
                                if let Err(e) = app.emit_to(
                                    EventTarget::Any,
                                    "voice:transcript",
                                    serde_json::json!({
                                        "text": transcript,
                                        "isFinal": true
                                    }),
                                ) {
                                    eprintln!("Failed to emit transcript: {}", e);
                                }
                            }
                            Ok(Some(_)) | Ok(None) => {
                                // Empty or no transcript - ignore
                            }
                            Err(e) => {
                                eprintln!("Transcription error: {}", e);
                                let _ = app.emit_to(EventTarget::Any, "voice:error", e.to_string());
                            }
                        }
                    });
                }

                // Clear buffer after processing
                buffer.samples.clear();
            }
        },
        move |err| {
            eprintln!("Audio stream error: {}", err);
            err_app.emit_to(EventTarget::Any, "voice:error", err.to_string()).ok();
        },
        None,
    )?;

    stream.play()?;

    // Store stream handle in thread local
    STREAM_HANDLE.with(|handle| {
        *handle.borrow_mut() = Some(stream);
    });

    CAPTURING.store(true, Ordering::SeqCst);
    app.emit_to(EventTarget::Any, "voice:state", "listening").ok();

    println!("Voice capture started");
    Ok(())
}

pub fn stop_capture() -> Result<(), Box<dyn std::error::Error>> {
    CAPTURING.store(false, Ordering::SeqCst);

    // Drop the stream (from thread local)
    STREAM_HANDLE.with(|handle| {
        *handle.borrow_mut() = None;
    });

    // Clear buffer
    {
        let mut buffer = AUDIO_BUFFER.lock();
        buffer.samples.clear();
    }

    println!("Voice capture stopped");
    Ok(())
}

/// Resample audio to target sample rate using linear interpolation
fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate {
        return samples.to_vec();
    }

    let ratio = from_rate as f64 / to_rate as f64;
    let new_len = (samples.len() as f64 / ratio) as usize;
    let mut resampled = Vec::with_capacity(new_len);

    for i in 0..new_len {
        let src_idx = i as f64 * ratio;
        let idx_floor = src_idx.floor() as usize;
        let idx_ceil = (idx_floor + 1).min(samples.len() - 1);
        let frac = src_idx - idx_floor as f64;

        let sample = samples[idx_floor] as f64 * (1.0 - frac) + samples[idx_ceil] as f64 * frac;
        resampled.push(sample as f32);
    }

    resampled
}

/// Transcribe audio using available method (API or local)
fn transcribe_audio(samples: &[f32], sample_rate: u32) -> Result<Option<String>, String> {
    // Resample to 16kHz if needed (Whisper expects 16kHz)
    let (samples_16k, rate_16k) = if sample_rate != 16000 {
        println!("Resampling from {}Hz to 16000Hz ({} samples -> ~{} samples)",
            sample_rate, samples.len(), samples.len() * 16000 / sample_rate as usize);
        (resample(samples, sample_rate, 16000), 16000)
    } else {
        (samples.to_vec(), sample_rate)
    };

    let config = WHISPER_CONFIG.lock();

    // Try local whisper first if configured
    #[cfg(feature = "whisper-local")]
    if config.use_local {
        if let Some(ref model_path) = config.model_path {
            return transcribe_local(&samples_16k, rate_16k, model_path);
        }
    }

    // Route to configured provider
    match config.provider.as_str() {
        "groq" => {
            if let Some(ref api_key) = config.groq_api_key {
                return transcribe_groq(&samples_16k, rate_16k, api_key, &config.model);
            }
            // Fall through to OpenAI if no Groq key
            if let Some(ref api_key) = config.api_key {
                return transcribe_openai(&samples_16k, rate_16k, api_key);
            }
        }
        _ => {
            // "openai" or default
            if let Some(ref api_key) = config.api_key {
                return transcribe_openai(&samples_16k, rate_16k, api_key);
            }
        }
    }

    // No transcription method available - return placeholder
    let duration_secs = samples_16k.len() as f32 / rate_16k as f32;
    if duration_secs > 0.5 {
        Ok(Some(format!(
            "[Audio: {:.1}s - configure API key in Settings for transcription]",
            duration_secs
        )))
    } else {
        Ok(None)
    }
}

/// Transcribe using OpenAI Whisper API
fn transcribe_openai(samples: &[f32], sample_rate: u32, api_key: &str) -> Result<Option<String>, String> {
    // Write samples to WAV in memory
    let wav_data = samples_to_wav(samples, sample_rate)?;

    // Call OpenAI Whisper API
    let client = reqwest::blocking::Client::new();

    let part = reqwest::blocking::multipart::Part::bytes(wav_data)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let form = reqwest::blocking::multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-1")
        .text("language", "en");

    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().unwrap_or_default();
        return Err(format!("API error {}: {}", status, text));
    }

    let result: serde_json::Value = response.json().map_err(|e| e.to_string())?;

    Ok(result["text"].as_str().map(|s| s.to_string()))
}

/// Transcribe using Groq Whisper API (faster inference)
fn transcribe_groq(samples: &[f32], sample_rate: u32, api_key: &str, model: &str) -> Result<Option<String>, String> {
    let wav_data = samples_to_wav(samples, sample_rate)?;

    let client = reqwest::blocking::Client::new();

    let part = reqwest::blocking::multipart::Part::bytes(wav_data)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    // Groq uses the same API format as OpenAI
    let groq_model = if model.is_empty() || model == "whisper-1" {
        "whisper-large-v3-turbo" // Default Groq model (fastest)
    } else {
        model
    };

    let form = reqwest::blocking::multipart::Form::new()
        .part("file", part)
        .text("model", groq_model.to_string())
        .text("language", "en");

    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .map_err(|e| format!("Groq request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().unwrap_or_default();
        return Err(format!("Groq API error {}: {}", status, text));
    }

    let result: serde_json::Value = response.json().map_err(|e| e.to_string())?;

    Ok(result["text"].as_str().map(|s| s.to_string()))
}

/// Transcribe using local whisper.cpp (when feature enabled)
#[cfg(feature = "whisper-local")]
fn transcribe_local(samples: &[f32], sample_rate: u32, model_path: &str) -> Result<Option<String>, String> {
    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    // Load whisper context
    let ctx = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
        .map_err(|e| format!("Failed to load whisper model: {}", e))?;

    // Create whisper state
    let mut state = ctx.create_state().map_err(|e| e.to_string())?;

    // Configure parameters
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    // Run transcription
    state
        .full(params, samples)
        .map_err(|e| format!("Transcription failed: {}", e))?;

    // Get results
    let num_segments = state.full_n_segments().map_err(|e| e.to_string())?;
    if num_segments == 0 {
        return Ok(None);
    }

    let mut text = String::new();
    for i in 0..num_segments {
        if let Ok(segment) = state.full_get_segment_text(i) {
            text.push_str(&segment);
            text.push(' ');
        }
    }

    Ok(Some(text.trim().to_string()))
}

/// Convert f32 samples to WAV bytes
fn samples_to_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec).map_err(|e| e.to_string())?;

        for sample in samples {
            // Convert f32 [-1.0, 1.0] to i16
            let sample_i16 = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer.write_sample(sample_i16).map_err(|e| e.to_string())?;
        }

        writer.finalize().map_err(|e| e.to_string())?;
    }

    Ok(cursor.into_inner())
}

#[derive(Clone, serde::Serialize)]
pub struct TranscriptEvent {
    pub text: String,
    pub is_final: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_samples_to_wav() {
        let samples = vec![0.0, 0.5, -0.5, 1.0, -1.0];
        let wav = samples_to_wav(&samples, 16000);
        assert!(wav.is_ok());
        let wav_data = wav.unwrap();
        // WAV header is 44 bytes, then 2 bytes per sample (16-bit)
        assert_eq!(wav_data.len(), 44 + samples.len() * 2);
    }

    #[test]
    fn test_samples_to_wav_empty() {
        let samples: Vec<f32> = vec![];
        let wav = samples_to_wav(&samples, 16000);
        assert!(wav.is_ok());
    }

    #[test]
    fn test_configure_whisper() {
        configure_whisper(Some("test-key".to_string()), false, None, None, None, None);
        let config = WHISPER_CONFIG.lock();
        assert_eq!(config.api_key, Some("test-key".to_string()));
        assert!(!config.use_local);
    }

    #[test]
    fn test_configure_whisper_groq() {
        configure_whisper(None, false, None, Some("groq".to_string()), Some("whisper-large-v3-turbo".to_string()), Some("groq-key".to_string()));
        let config = WHISPER_CONFIG.lock();
        assert_eq!(config.provider, "groq");
        assert_eq!(config.model, "whisper-large-v3-turbo");
        assert_eq!(config.groq_api_key, Some("groq-key".to_string()));
    }

    /// Integration test: sends a short audio clip to Groq Whisper API.
    /// Run with: cargo test test_groq_api_live -- --ignored
    /// Requires GROQ_API_KEY env var.
    #[test]
    #[ignore]
    fn test_groq_api_live() {
        let api_key = std::env::var("GROQ_API_KEY")
            .expect("Set GROQ_API_KEY env var to run this test");

        // Generate 1 second of 440Hz sine wave at 16kHz
        let sample_rate = 16000u32;
        let duration_samples = sample_rate as usize;
        let samples: Vec<f32> = (0..duration_samples)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sample_rate as f32).sin() * 0.5)
            .collect();

        let result = transcribe_groq(&samples, sample_rate, &api_key, "whisper-large-v3-turbo");

        match result {
            Ok(transcript) => {
                println!("Groq response: {:?}", transcript);
                // Success — API returned something (transcript may be None for a tone)
            }
            Err(e) => {
                panic!("Groq API call failed: {}", e);
            }
        }
    }
}
