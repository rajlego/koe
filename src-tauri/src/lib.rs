mod voice;

#[tauri::command]
fn start_voice_capture(app: tauri::AppHandle) -> Result<(), String> {
    voice::start_capture(app).map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_voice_capture() -> Result<(), String> {
    voice::stop_capture().map_err(|e| e.to_string())
}

#[tauri::command]
fn speak_text(text: String) -> Result<(), String> {
    // Use macOS 'say' command for TTS
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("say")
            .arg(&text)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn stop_speaking() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("killall")
            .arg("say")
            .spawn()
            .ok();
    }
    Ok(())
}

#[tauri::command]
fn configure_whisper(api_key: Option<String>, use_local: bool, model_path: Option<String>) {
    voice::configure_whisper(api_key, use_local, model_path);
}

#[tauri::command]
fn list_audio_devices() -> Result<Vec<String>, String> {
    voice::list_input_devices().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_selected_audio_device() -> Option<String> {
    voice::get_selected_device()
}

#[tauri::command]
fn set_audio_device(device_name: Option<String>) {
    voice::set_input_device(device_name);
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_voice_capture,
            stop_voice_capture,
            speak_text,
            stop_speaking,
            configure_whisper,
            list_audio_devices,
            get_selected_audio_device,
            set_audio_device,
            open_external_url,
        ])
        .setup(|_app| {
            // Initialize voice capture system
            voice::init()?;

            // Log that we're ready
            println!("Koe initialized");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
