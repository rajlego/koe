use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

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

/// Configure the Whisper API key for transcription
pub fn configure_whisper(api_key: Option<String>, use_local: bool, model_path: Option<String>) {
    let mut config = WHISPER_CONFIG.lock();
    config.api_key = api_key;
    config.use_local = use_local;
    config.model_path = model_path;
}

pub fn start_capture(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if CAPTURING.load(Ordering::SeqCst) {
        return Ok(());
    }

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device available")?;

    // Configure for 16kHz mono (what Whisper expects)
    let config = cpal::StreamConfig {
        channels: 1,
        sample_rate: cpal::SampleRate(16000),
        buffer_size: cpal::BufferSize::Default,
    };

    // Update buffer sample rate
    {
        let mut buffer = AUDIO_BUFFER.lock();
        buffer.sample_rate = 16000;
        buffer.samples.clear();
    }

    let app_handle = app.clone();
    let err_app = app.clone();

    // Build input stream
    let stream = device.build_input_stream(
        &config,
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            if !CAPTURING.load(Ordering::SeqCst) {
                return;
            }

            let mut buffer = AUDIO_BUFFER.lock();
            buffer.samples.extend_from_slice(data);

            // Simple VAD: check if we have enough audio and energy
            // Process every ~2 seconds of audio
            let samples_per_chunk = buffer.sample_rate as usize * 2;
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

                    // Process in background thread
                    std::thread::spawn(move || {
                        match transcribe_audio(&audio_data, sample_rate) {
                            Ok(Some(transcript)) if !transcript.trim().is_empty() => {
                                app.emit(
                                    "voice:transcript",
                                    serde_json::json!({
                                        "text": transcript,
                                        "isFinal": true
                                    }),
                                )
                                .ok();
                            }
                            Ok(_) => {} // No transcript or empty
                            Err(e) => {
                                eprintln!("Transcription error: {}", e);
                                app.emit("voice:error", e.to_string()).ok();
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
            err_app.emit("voice:error", err.to_string()).ok();
        },
        None,
    )?;

    stream.play()?;

    // Store stream handle in thread local
    STREAM_HANDLE.with(|handle| {
        *handle.borrow_mut() = Some(stream);
    });

    CAPTURING.store(true, Ordering::SeqCst);
    app.emit("voice:state", "listening").ok();

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

/// Transcribe audio using available method (API or local)
fn transcribe_audio(samples: &[f32], sample_rate: u32) -> Result<Option<String>, String> {
    let config = WHISPER_CONFIG.lock();

    // Try local whisper first if configured
    #[cfg(feature = "whisper-local")]
    if config.use_local {
        if let Some(ref model_path) = config.model_path {
            return transcribe_local(samples, sample_rate, model_path);
        }
    }

    // Fall back to OpenAI Whisper API
    if let Some(ref api_key) = config.api_key {
        return transcribe_openai(samples, sample_rate, api_key);
    }

    // No transcription method available - return placeholder
    let duration_secs = samples.len() as f32 / sample_rate as f32;
    if duration_secs > 0.5 {
        Ok(Some(format!(
            "[Audio: {:.1}s - configure OPENAI_API_KEY for transcription]",
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
        configure_whisper(Some("test-key".to_string()), false, None);
        let config = WHISPER_CONFIG.lock();
        assert_eq!(config.api_key, Some("test-key".to_string()));
        assert!(!config.use_local);
    }
}
