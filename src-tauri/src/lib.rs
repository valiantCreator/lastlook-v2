//use tauri::Emitter; // Keeping for future progress bars
use std::fs::File;
use std::io::Read;

// COMMAND: Calculate MD5 Hash
#[tauri::command]
async fn calculate_hash(path: String) -> Result<String, String> {
    println!("🦀 Hashing started for: {}", path);

    // 1. Open the file
    let mut file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;

    // 2. Prepare the Hasher (Using 'Context' for the md5 crate)
    let mut context = md5::Context::new();
    
    // 3. Create a 1MB Buffer (Stream it)
    let mut buffer = [0; 1024 * 1024]; 

    // 4. Read loop
    loop {
        let bytes_read = file.read(&mut buffer).map_err(|e| format!("Read error: {}", e))?;
        if bytes_read == 0 {
            break; // EOF
        }
        // In this crate, we 'consume' bytes instead of 'update'
        context.consume(&buffer[..bytes_read]);
    }

    // 5. Finalize
    let result = context.compute();
    let hash_string = format!("{:x}", result);
    
    println!("🦀 Hash complete: {}", hash_string);
    Ok(hash_string)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            calculate_hash 
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}