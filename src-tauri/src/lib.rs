use tauri::{AppHandle, Emitter, State}; // Removed 'Manager'
use std::fs::{self, File};
use std::io::{Read, Write};
use xxhash_rust::xxh3::Xxh3;
use std::time::Instant;
use std::sync::atomic::{AtomicBool, Ordering};
// Removed 'use std::sync::Arc;'

// 1. STATE: The Global "Abort" Button
struct TransferState {
    should_abort: AtomicBool,
}

// COMMAND 1: Cancel Signal
#[tauri::command]
fn cancel_transfer(state: State<'_, TransferState>) {
    println!("🛑 ABORT SIGNAL RECEIVED");
    state.should_abort.store(true, Ordering::Relaxed);
}

// COMMAND 2: Calculate Hash (Helper)
#[tauri::command]
async fn calculate_hash(path: String) -> Result<String, String> {
    let mut file = File::open(&path).map_err(|e| e.to_string())?;
    let mut hasher = Xxh3::new();
    let mut buffer = vec![0; 64 * 1024 * 1024]; 

    loop {
        let bytes = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes == 0 { break; }
        hasher.update(&buffer[..bytes]);
    }
    Ok(format!("{:x}", hasher.digest()))
}

// COMMAND 3: The Transfer Engine (Now Interruptible 🛑)
#[tauri::command]
async fn copy_file(
    app: AppHandle, 
    state: State<'_, TransferState>, 
    source: String, 
    dest: String
) -> Result<String, String> {
    
    // --- THE FIX: RESET THE BRAKE AT THE START ---
    // Always assume we are starting fresh unless told otherwise mid-transfer.
    state.should_abort.store(false, Ordering::Relaxed);

    let filename = std::path::Path::new(&source)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut src_file = File::open(&source).map_err(|e| format!("Open failed: {}", e))?;
    let total_size = src_file.metadata().map_err(|e| e.to_string())?.len();
    
    // Create Destination File
    let mut dst_file = File::create(&dest).map_err(|e| format!("Create failed: {}", e))?;
    
    // --- PHASE 1: COPY & HASH ---
    println!("🚀 STARTING TRANSFER: {}", filename);
    let start_transfer = Instant::now();

    let mut src_hasher = Xxh3::new();
    let mut buffer = vec![0; 64 * 1024 * 1024]; 
    let mut transferred: u64 = 0;

    loop {
        // 🛑 EMERGENCY BRAKE CHECK
        if state.should_abort.load(Ordering::Relaxed) {
            println!("🛑 CUTTING POWER: Deleting partial file...");
            drop(dst_file); // Close file handle
            let _ = fs::remove_file(&dest); // Delete garbage
            return Err("CANCELLED".to_string());
        }

        let bytes_read = src_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 { break; }

        src_hasher.update(&buffer[..bytes_read]);
        dst_file.write_all(&buffer[..bytes_read]).map_err(|e| e.to_string())?;
        
        transferred += bytes_read as u64;

        // C. Report Progress
        app.emit("transfer-progress", ProgressPayload {
            filename: filename.clone(),
            total: total_size,
            transferred,
        }).map_err(|e| e.to_string())?;
    }

    let duration_transfer = start_transfer.elapsed();
    let src_hash = format!("{:x}", src_hasher.digest());
    
    // Calculate Speed
    let mb_per_sec_transfer = (total_size as f64 / 1_048_576.0) / duration_transfer.as_secs_f64();
    println!("✅ COPY DONE: {:.2}s ({:.2} MB/s)", duration_transfer.as_secs_f64(), mb_per_sec_transfer);

    // NEW: Emit "Verifying" state to UI so the Dot turns Yellow immediately
    app.emit("transfer-verifying", VerifyingPayload {
        filename: filename.clone(),
    }).map_err(|e| e.to_string())?;

    // --- PHASE 2: VERIFICATION ---
    println!("🛡️ STARTING VERIFICATION...");
    let start_verify = Instant::now();

    if state.should_abort.load(Ordering::Relaxed) {
        return Err("CANCELLED".to_string());
    }

    let dst_hash = calculate_hash(dest).await?;

    let duration_verify = start_verify.elapsed();
    let mb_per_sec_verify = (total_size as f64 / 1_048_576.0) / duration_verify.as_secs_f64();
    println!("✅ VERIFY DONE: {:.2}s ({:.2} MB/s)", duration_verify.as_secs_f64(), mb_per_sec_verify);

    // --- REPORT ---
    if src_hash == dst_hash {
        Ok(src_hash)
    } else {
        Err(format!("Verification Failed for {}", filename))
    }
}

// DATA STRUCTURES
#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    filename: String,
    total: u64,
    transferred: u64,
}

#[derive(Clone, serde::Serialize)]
struct VerifyingPayload {
    filename: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(TransferState { should_abort: AtomicBool::new(false) })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            calculate_hash,
            copy_file,
            cancel_transfer 
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}