use tauri::{AppHandle, Emitter}; 
use std::fs::File;
use std::io::{Read, Write};
use md5::Context; 

// COMMAND 1: Calculate Hash (Heap Safe 🛡️)
#[tauri::command]
async fn calculate_hash(path: String) -> Result<String, String> {
    println!("🦀 Hashing: {}", path);
    let mut file = File::open(&path).map_err(|e| e.to_string())?;
    let mut context = Context::new();
    
    // FIX: Use vec! to allocate on Heap instead of Stack
    let mut buffer = vec![0; 1024 * 1024]; 

    loop {
        let bytes = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes == 0 { break; }
        context.consume(&buffer[..bytes]);
    }
    Ok(format!("{:x}", context.compute()))
}

// COMMAND 2: The Transfer Engine (Verified & Heap Safe 🛡️)
#[tauri::command]
async fn copy_file(app: AppHandle, source: String, dest: String) -> Result<String, String> {
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

    // 2. Initialize Source Hasher
    let mut src_context = Context::new();

    // 3. The Pipelined Loop (Read -> Hash -> Write)
    // FIX: Use vec! to allocate 1MB on the Heap
    let mut buffer = vec![0; 1024 * 1024]; 
    let mut transferred: u64 = 0;

    loop {
        let bytes_read = src_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 { break; }

        // A. Hash the chunk
        src_context.consume(&buffer[..bytes_read]);

        // B. Write the chunk
        dst_file.write_all(&buffer[..bytes_read]).map_err(|e| e.to_string())?;
        
        transferred += bytes_read as u64;

        // C. Report Progress
        app.emit("transfer-progress", ProgressPayload {
            filename: filename.clone(),
            total: total_size,
            transferred,
        }).map_err(|e| e.to_string())?;
    }

    // 4. Calculate Final Source Hash
    let src_hash = format!("{:x}", src_context.compute());
    println!("🦀 Source Hash Calculated: {}", src_hash);

    // 5. Verification: Read Destination Back
    let dst_hash = calculate_hash(dest).await?;

    // 6. Compare
    if src_hash == dst_hash {
        println!("✅ Verified Match: {}", filename);
        Ok(src_hash)
    } else {
        println!("❌ HASH MISMATCH: {} vs {}", src_hash, dst_hash);
        Err(format!("Verification Failed for {}", filename))
    }
}

// DATA STRUCTURE
#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    filename: String,
    total: u64,
    transferred: u64,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            calculate_hash,
            copy_file 
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}