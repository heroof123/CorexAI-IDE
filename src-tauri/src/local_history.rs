use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: u64,
    pub path: String,
    pub content: String,
}

fn get_history_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let history_dir = app_dir.join("local_history");
    
    if !history_dir.exists() {
        fs::create_dir_all(&history_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(history_dir)
}

fn get_file_history_dir(app_handle: &AppHandle, file_path: &str) -> Result<PathBuf, String> {
    let history_dir = get_history_dir(app_handle)?;
    // Use hash of the file path as the directory name
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    let hash = hasher.finish();
    
    let file_dir = history_dir.join(format!("{:x}", hash));
    
    if !file_dir.exists() {
        fs::create_dir_all(&file_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(file_dir)
}

#[tauri::command]
pub async fn save_local_history(path: String, content: String, app_handle: AppHandle) -> Result<String, String> {
    let file_dir = get_file_history_dir(&app_handle, &path)?;
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
        
    let id = format!("{}", timestamp);
    let entry = HistoryEntry {
        id: id.clone(),
        timestamp,
        path: path.clone(),
        content: content.clone(),
    };
    
    let entry_path = file_dir.join(format!("{}.json", id));
    let entry_json = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
    
    fs::write(&entry_path, entry_json).map_err(|e| e.to_string())?;
    
    Ok(id)
}

#[tauri::command]
pub async fn get_local_history(path: String, app_handle: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let file_dir = get_file_history_dir(&app_handle, &path)?;
    let mut entries = Vec::new();
    
    if let Ok(dir_entries) = fs::read_dir(file_dir) {
        for entry in dir_entries.flatten() {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(history_entry) = serde_json::from_str::<HistoryEntry>(&content) {
                    entries.push(history_entry);
                }
            }
        }
    }
    
    // Sort descending by timestamp
    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    Ok(entries)
}

#[tauri::command]
pub async fn restore_local_history(path: String, entry_id: String, app_handle: AppHandle) -> Result<String, String> {
    let file_dir = get_file_history_dir(&app_handle, &path)?;
    let entry_path = file_dir.join(format!("{}.json", entry_id));
    
    let content = fs::read_to_string(&entry_path).map_err(|e| e.to_string())?;
    let entry: HistoryEntry = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    
    // write to actual file path
    fs::write(&path, &entry.content).map_err(|e| e.to_string())?;
    
    Ok(entry.content)
}
