use tauri::{AppHandle, Emitter}; // AppHandle lets us talk to the UI
use std::fs::File;
use std::io::{Read, Write};
use md5::Context; // For the hash command

// 1. DATA STRUCTURE: The Message we send to React
#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    filename: String,
    total: u64,
    transferred: u64,
}

// COMMAND 1: Calculate Hash (Existing)
#[tauri::command]
async fn calculate_hash(path: String) -> Result<String, String> {
    println!("🦀 Hashing: {}", path);
    let mut file = File::open(&path).map_err(|e| e.to_string())?;
    let mut context = Context::new();
    let mut buffer = [0; 1024 * 1024]; 

    // 4. Read loop
    loop {
        let bytes = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes == 0 { break; }
        context.consume(&buffer[..bytes]);
    }
    Ok(format!("{:x}", context.compute()))
}

// COMMAND 2: The Transfer Engine (New)
#[tauri::command]
async fn copy_file(app: AppHandle, source: String, dest: String) -> Result<(), String> {
    // 1. Setup
    // Extract just the filename for the UI event
    let filename = std::path::Path::new(&source)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut src_file = File::open(&source).map_err(|e| format!("Open failed: {}", e))?;
    let total_size = src_file.metadata().map_err(|e| e.to_string())?.len();
    
    // Create Destination File
    let mut dst_file = File::create(&dest).map_err(|e| format!("Create failed: {}", e))?;

    // 2. The Copy Loop
    let mut buffer = [0; 1024 * 1024]; // 1MB Chunk
    let mut transferred: u64 = 0;

    loop {
        let bytes_read = src_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 { break; } // Done

        dst_file.write_all(&buffer[..bytes_read]).map_err(|e| e.to_string())?;
        
        transferred += bytes_read as u64;

        // 3. Report Progress
        // We emit an event named "transfer-progress"
        app.emit("transfer-progress", ProgressPayload {
            filename: filename.clone(),
            total: total_size,
            transferred,
        }).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            calculate_hash,
            copy_file // <--- Register the new command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}