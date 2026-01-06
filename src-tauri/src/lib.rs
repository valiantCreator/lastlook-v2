use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::hash::Hasher; // <--- FIX: Required to call .finish() on the hasher
use std::io::{Read, Write}; // <--- FIX: Required for buffer reading/writing
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use xxhash_rust::xxh3;

// --- GLOBAL ABORT HANDLE ---
struct TransferState {
    abort_flag: Arc<AtomicBool>,
}

// --- COMMANDS ---

#[tauri::command]
fn cancel_transfer(state: tauri::State<TransferState>) {
    state.abort_flag.store(true, Ordering::Relaxed);
}

#[tauri::command]
async fn calculate_hash(path: String) -> Result<String, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("File not found".into());
    }

    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    // Buffer size: 64KB (standard for hashing)
    let mut reader = std::io::BufReader::with_capacity(64 * 1024, file);
    
    let mut hasher = xxh3::Xxh3Builder::new().build();
    
    // FIX: Replaced std::io::copy with manual read loop
    // because Xxh3 does not implement std::io::Write directly
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 { break; }
        hasher.write(&buffer[..count]); // .write is alias for .update in Hasher trait
    }

    Ok(format!("{:x}", hasher.finish()))
}

#[tauri::command]
async fn copy_file(
    app: AppHandle, 
    state: tauri::State<'_, TransferState>, 
    source: String, 
    dest: String
) -> Result<(), String> {
    
    // RESET ABORT FLAG AT START
    state.abort_flag.store(false, Ordering::Relaxed);

    let source_path = Path::new(&source);
    let dest_path = Path::new(&dest);
    let filename = source_path.file_name().unwrap().to_string_lossy().to_string();

    // 1. CHECK SOURCE SIZE
    let total_size = fs::metadata(source_path).map_err(|e| e.to_string())?.len();

    // 2. OPEN FILES
    let mut src_file = fs::File::open(source_path).map_err(|e| e.to_string())?;
    
    // Ensure dest directory exists
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let mut dst_file = fs::File::create(dest_path).map_err(|e| e.to_string())?;

    // 3. TRANSFER + HASH (PIPELINED)
    // 64MB Buffer for High Performance IO
    const BUFFER_SIZE: usize = 64 * 1024 * 1024; 
    let mut buffer = vec![0u8; BUFFER_SIZE];
    
    let mut transferred: u64 = 0;
    
    // We verify the DESTINATION as we write it
    let mut dest_hasher = xxh3::Xxh3Builder::new().build();

    loop {
        // Check Abort
        if state.abort_flag.load(Ordering::Relaxed) {
             // Cleanup partial file
             let _ = fs::remove_file(dest_path);
             return Err("CANCELLED".to_string());
        }

        let bytes_read = src_file.read(&mut buffer).map_err(|e| e.to_string())?;
        
        if bytes_read == 0 { break; } // EOF

        // Write to Disk
        dst_file.write_all(&buffer[..bytes_read]).map_err(|e| e.to_string())?;
        
        // Feed Hasher
        dest_hasher.write(&buffer[..bytes_read]);

        transferred += bytes_read as u64;

        // Emit Progress
        app.emit("transfer-progress", serde_json::json!({
            "filename": filename,
            "transferred": transferred,
            "total": total_size
        })).unwrap();
    }

    // 4. VERIFICATION PHASE
    // Notify UI we are switching phases
    app.emit("transfer-verifying", serde_json::json!({ "filename": filename })).unwrap();

    let dest_hash = format!("{:x}", dest_hasher.finish());

    // Calculate Source Hash (Requires re-reading source)
    let source_hash = calculate_hash(source.clone()).await?;

    if source_hash != dest_hash {
        return Err(format!("Mismatch! Src: {} vs Dest: {}", source_hash, dest_hash));
    }

    Ok(())
}

// --- THUMBNAIL GENERATOR ---
#[tauri::command]
async fn generate_thumbnail(app: AppHandle, path: String) -> Result<String, String> {
    let input_path = Path::new(&path);
    if !input_path.exists() {
        return Err("File not found".into());
    }

    // 1. Create a unique filename for the thumb (hash of the path)
    let path_hash = xxh3::xxh3_64(path.as_bytes());
    let thumb_filename = format!("thumb_{:x}.jpg", path_hash);
    
    // 2. Resolve System Temp Directory
    let temp_dir = app.path().temp_dir().map_err(|e| e.to_string())?;
    let output_path = temp_dir.join("lastlook_cache").join(thumb_filename);

    // Create cache dir if missing
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let output_str = output_path.to_string_lossy().to_string();

    // 3. Return early if cached
    if output_path.exists() {
        return Ok(output_str);
    }

    // 4. Run FFmpeg Sidecar
    // Command: ffmpeg -y -i [input] -ss 00:00:01 -vframes 1 [output]
    let sidecar_command = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?
        .args([
            "-y",             // Overwrite
            "-i", &path,      // Input
            "-ss", "00:00:01",// Seek 1 sec
            "-vframes", "1",  // 1 Frame
            &output_str       // Output
        ]);

    let (mut rx, _) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    // Wait for command to finish
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                // PRINT FFMPEG LOGS TO TERMINAL
                println!("FFMPEG LOG: {}", String::from_utf8_lossy(&line)); 
            }
            CommandEvent::Terminated(payload) => {
                 if payload.code.unwrap_or(1) == 0 {
                     return Ok(output_str);
                 } else {
                     return Err(format!("FFmpeg exited with code: {:?}", payload.code));
                 }
            }
            _ => {}
        }
    }

    Err("Unknown FFmpeg error".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(TransferState {
            abort_flag: Arc::new(AtomicBool::new(false)),
        })
        .invoke_handler(tauri::generate_handler![
            copy_file, 
            calculate_hash, 
            cancel_transfer,
            generate_thumbnail
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}