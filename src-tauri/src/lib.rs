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

// --- METADATA STRUCTS (New for Phase 8) ---
#[derive(serde::Serialize)]
struct VideoMetadata {
    width: u32,
    height: u32,
    duration: f64,
    codec: String,
    fps: String,
}

// Internal structs for parsing FFprobe JSON
#[derive(serde::Deserialize)]
struct FfprobeOutput {
    streams: Vec<FfprobeStream>,
}

#[derive(serde::Deserialize)]
struct FfprobeStream {
    width: Option<u32>,
    height: Option<u32>,
    codec_name: Option<String>,
    r_frame_rate: Option<String>,
    duration: Option<String>,
}

// --- COMMANDS ---

// --- NEW COMMAND: CLEANUP ---
#[tauri::command]
fn clean_video_cache() -> Result<(), String> {
    // 1. Target the specific temp folder
    let temp_dir = std::env::temp_dir().join("lastlook_cache");

    // 2. Check if it exists
    if temp_dir.exists() {
        println!("🧹 Cleaning Cache at: {:?}", temp_dir);
        
        // 3. Nuke it (safely)
        fs::remove_dir_all(&temp_dir).map_err(|e| e.to_string())?;
        
        // 4. Recreate it immediately so it's ready for new files
        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

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
) -> Result<String, String> { // <--- CHANGE 1: Return String
    
    // RESET ABORT FLAG AT START
    state.abort_flag.store(false, Ordering::Relaxed);

    let source_path = Path::new(&source);
    let dest_path = Path::new(&dest);
    let filename = source_path.file_name().unwrap().to_string_lossy().to_string();

    // 1. CHECK SOURCE SIZE & METADATA
    let src_file = fs::File::open(source_path).map_err(|e| e.to_string())?;
    let src_metadata = src_file.metadata().map_err(|e| e.to_string())?;
    let total_size = src_metadata.len();
    
    // --- NEW: CAPTURE SOURCE TIMESTAMP ---
    let src_mod_time = src_metadata.modified().map_err(|e| e.to_string())?;
    // -------------------------------------

    // 2. OPEN FILES (We need a mutable reader for the loop)
    // We already opened src_file above, but we need to read it. 
    // Since we didn't read from it yet, we can try to use it if it's mutable, 
    // or simply re-open/clone. For safety and clarity with the metadata borrow above:
    let mut reader = fs::File::open(source_path).map_err(|e| e.to_string())?;
    
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
        // --- START CRITICAL FIX: NUKE PARTIAL FILE ---
        if state.abort_flag.load(Ordering::Relaxed) {
             // 1. Close the file handle explicitly to release the OS lock (Required for Windows)
             drop(dst_file);
             
             // 2. Now safe to delete the partial data
             if let Err(e) = fs::remove_file(dest_path) {
                 println!("⚠️ Failed to clean up partial file: {}", e);
             } else {
                 println!("🗑️ Cleaned up partial file: {:?}", dest_path);
             }
             
             return Err("CANCELLED".to_string());
        }
        // --- END CRITICAL FIX ---

        let bytes_read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        
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

    // --- NEW: APPLY TIMESTAMP FIX ---
    // Force the destination file to match the source's modification time.
    // This allows "Smart Resume" to verify files based on date later.
    if let Err(e) = dst_file.set_modified(src_mod_time) {
        println!("⚠️ Warning: Could not set modification time: {}", e);
    }
    // --------------------------------

    // 4. VERIFICATION PHASE
    // Notify UI we are switching phases
    app.emit("transfer-verifying", serde_json::json!({ "filename": filename })).unwrap();

    let dest_hash = format!("{:x}", dest_hasher.finish());

    // Calculate Source Hash
    let source_hash = calculate_hash(source.clone()).await?;

    if source_hash != dest_hash {
        return Err(format!("Mismatch! Src: {} vs Dest: {}", source_hash, dest_hash));
    }

    Ok(dest_hash) // <--- CHANGE 2: Return the Hash
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
                // PRINT FFMPEG LOGS TO TERMINAL (Debugging)
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

// --- METADATA EXTRACTOR (New) ---
#[tauri::command]
async fn get_video_metadata(app: AppHandle, path: String) -> Result<VideoMetadata, String> {
    
    // Command: ffprobe -v error -select_streams v:0 -show_entries stream=... -of json [input]
    let sidecar_command = app.shell().sidecar("ffprobe").map_err(|e| e.to_string())?
        .args([
            "-v", "error",
            "-select_streams", "v:0", // Video stream only
            "-show_entries", "stream=width,height,duration,r_frame_rate,codec_name",
            "-of", "json", // Return JSON
            &path
        ]);

    let (mut rx, _) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    let mut output_json = String::new();

    // Collect all stdout lines into one JSON string
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stdout(line) = event {
            output_json.push_str(&String::from_utf8_lossy(&line));
        }
    }

    // Parse the JSON output
    let parsed: FfprobeOutput = serde_json::from_str(&output_json)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    if let Some(stream) = parsed.streams.first() {
        // Calculate nice FPS (e.g., "30000/1001" -> "29.97")
        let fps_str = stream.r_frame_rate.clone().unwrap_or_default();
        let fps_calc = if let Some((num, den)) = fps_str.split_once('/') {
            let n: f64 = num.parse().unwrap_or(0.0);
            let d: f64 = den.parse().unwrap_or(1.0);
            if d > 0.0 { format!("{:.2}", n / d) } else { fps_str }
        } else {
            fps_str
        };

        let duration_secs: f64 = stream.duration.clone().unwrap_or_default().parse().unwrap_or(0.0);

        Ok(VideoMetadata {
            width: stream.width.unwrap_or(0),
            height: stream.height.unwrap_or(0),
            duration: duration_secs,
            codec: stream.codec_name.clone().unwrap_or("unknown".to_string()),
            fps: fps_calc,
        })
    } else {
        Err("No video stream found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())     // <--- REGISTERED OS PLUGIN
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
            generate_thumbnail,
            get_video_metadata,
            clean_video_cache // <--- REGISTERED NEW COMMAND
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}