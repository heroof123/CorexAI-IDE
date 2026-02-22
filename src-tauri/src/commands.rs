use std::fs;
use std::path::Path;
use std::process::Command;
use std::env;

use reqwest::Client;
use serde_json::json;
use log::{info, error};
use tauri::{AppHandle, Manager, Emitter};

// --------------------
// SYSTEM UTILITIES
// --------------------
#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .map_err(|e| format!("Failed to get home directory: {}", e))
}

// --------------------
// WINDOW CONTROLS
// --------------------
#[tauri::command]
pub async fn minimize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn maximize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().map_err(|e| e.to_string())? {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn close_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// --------------------
// PROJE DOSYA TARAMA
// --------------------
#[tauri::command]
pub fn scan_project(path: String) -> Result<Vec<String>, String> {
    let mut files: Vec<String> = Vec::new();
    scan_dir(Path::new(&path), &mut files);
    Ok(files)
}

fn scan_dir(dir: &Path, files: &mut Vec<String>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_dir(&path, files);
            } else if let Some(ext) = path.extension() {
                if ext == "rs" || ext == "ts" || ext == "tsx" || ext == "js" || ext == "jsx" || ext == "py" || ext == "json" {
                    if let Some(p) = path.to_str() {
                        files.push(p.to_string());
                    }
                }
            }
        }
    }
}
#[tauri::command]
pub async fn get_all_files(path: String) -> Result<Vec<String>, String> {
    use walkdir::WalkDir;
    
    let ignored = vec!["node_modules", ".git", "dist", "build", "target", ".next", "venv", ".venv"];
    let mut files = Vec::new();
    
    for entry in WalkDir::new(&path)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_str().unwrap_or("");
            !ignored.contains(&name)
        })
        .filter_map(|e| e.ok()) 
    {
        if entry.file_type().is_file() {
            if let Some(p) = entry.path().to_str() {
                files.push(p.to_string());
            }
        }
    }
    
    Ok(files)
}

#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    use std::io::{BufReader, Read};
    use std::fs::File;

    let file = File::open(&path).map_err(|e| format!("Dosya açılamadı: {}", e))?;
    let mut reader = BufReader::with_capacity(64 * 1024, file);
    let mut content = String::new();
    
    reader.read_to_string(&mut content).map_err(|e| format!("Dosya okunamadı: {}", e))?;
    
    Ok(content)
}
// --------------------
// DOSYA OKUMA
// --------------------
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    use std::io::{BufReader, Read};
    use std::fs::File;

    info!("📖 Dosya okunuyor: {}", path);
    
    let file = File::open(&path).map_err(|e| {
        error!("❌ Dosya açma hatası: {}", e);
        e.to_string()
    })?;
    
    let mut reader = BufReader::with_capacity(64 * 1024, file);
    let mut content = String::new();
    
    reader.read_to_string(&mut content).map_err(|e| {
        error!("❌ Dosya okuma hatası: {}", e);
        e.to_string()
    })?;
    
    Ok(content)
}

// --------------------
// DOSYA YAZMA
// --------------------
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    info!("💾 Dosya yazılıyor: {}", path);
    fs::write(&path, content).map_err(|e| {
        error!("❌ Dosya yazma hatası: {}", e);
        e.to_string()
    })
}

// --------------------
// YENİ DOSYA OLUŞTURMA
// --------------------
#[tauri::command]
pub fn create_file(path: String, content: String) -> Result<(), String> {
    info!("📝 Yeni dosya oluşturuluyor: {}", path);
    
    // Klasörü oluştur (eğer yoksa)
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    fs::write(&path, content).map_err(|e| {
        error!("❌ Dosya oluşturma hatası: {}", e);
        e.to_string()
    })
}

// --------------------
// AI CHAT - Multi Model Support
// --------------------
#[tauri::command]
pub async fn chat_with_ai(message: String) -> Result<String, String> {
    chat_with_specific_ai(message, "main".to_string()).await
}

#[tauri::command]
pub async fn chat_with_specific_ai(message: String, model_type: String) -> Result<String, String> {
    // Default to 1234 if not specified, but this function is legacy. 
    // Use chat_with_dynamic_ai for modern usage.
    let (port, model_name) = match model_type.as_str() {
        "main" => (1234, "qwen2.5-coder-7b-instruct"),
        "chat" => (1234, "qwen2.5-3b-instruct"),
        "llama" => (1234, "meta-llama-3.1-8b-instruct"),
        "planner" => (1234, "qwen2.5-coder-7b-instruct"),
        "coder" => (1234, "qwen2.5-coder-7b-instruct"),
        "tester" => (1234, "qwen2.5-3b-instruct"),
        _ => (1234, "qwen2.5-coder-7b-instruct"),
    };

    info!("🔵 {}:{} modeline istek gönderiliyor...", model_type, port);
    info!("📤 Mesaj: {}", message);

    let client = Client::new();
    let endpoint = format!("http://127.0.0.1:{}/v1/chat/completions", port);

    let body = json!({
        "model": model_name,
        "messages": [
            {
                "role": "user",
                "content": message
            }
        ],
        "temperature": match model_type.as_str() {
            "planner" => 0.3,  // Daha deterministik planlar
            "coder" => 0.1,    // Daha tutarlı kod
            "tester" => 0.4,   // Hızlı model için biraz daha yaratıcı
            "chat" => 0.7,     // Sohbet için yaratıcı
            _ => 0.5,          // Ana model için dengeli
        },
        "max_tokens": match model_type.as_str() {
            "planner" => 1500,
            "coder" => 4000,
            "tester" => 1000,
            "chat" => 2000,
            _ => -1,
        },
        "stream": false
    });

    info!("📡 Endpoint: {}", endpoint);

    let res = client
        .post(&endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            error!("❌ İstek hatası ({}:{}): {}", model_type, port, e);
            format!("İstek hatası ({}): {}", model_type, e)
        })?;

    info!("✅ Yanıt alındı ({}), durum: {}", model_type, res.status());

    let response_text = res.text().await.map_err(|e| {
        error!("❌ Response okuma hatası ({}): {}", model_type, e);
        e.to_string()
    })?;

    info!("📥 Raw Response ({}): {}", model_type, response_text);

    let json: serde_json::Value = serde_json::from_str(&response_text).map_err(|e| {
        error!("❌ JSON parse hatası ({}): {}", model_type, e);
        e.to_string()
    })?;

    let ai_response = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    info!("📥 AI Yanıtı ({}): {}", model_type, ai_response);

    Ok(ai_response)
}

// --------------------
// DYNAMIC AI CHAT - Configurable Provider
// --------------------
#[derive(serde::Deserialize)]
pub struct ProviderConfig {
    pub base_url: String,
    #[allow(dead_code)]
    pub host: Option<String>,
    #[allow(dead_code)]
    pub port: Option<u16>,
    pub api_key: Option<String>,
    pub model_name: String,
    pub temperature: f32,
    pub max_tokens: i32,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[tauri::command]
pub async fn chat_with_dynamic_ai(
    message: String, 
    conversation_history: Vec<ChatMessage>,
    provider_config: ProviderConfig
) -> Result<String, String> {
    info!("🔵 Dinamik AI çağrısı: {} -> {}", provider_config.model_name, provider_config.base_url);
    info!("📤 Mesaj: {}", message);
    info!("📚 History: {} mesaj", conversation_history.len());

    let client = Client::new();
    let endpoint = format!("{}/chat/completions", provider_config.base_url);

    // Headers oluştur
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Content-Type", "application/json".parse().unwrap());
    
    if let Some(api_key) = &provider_config.api_key {
        if !api_key.is_empty() {
            let auth_header = format!("Bearer {}", api_key);
            headers.insert("Authorization", auth_header.parse().unwrap());
        }
    }

    // 🔥 Conversation history kullan (eğer varsa), yoksa sadece user message
    let messages: Vec<serde_json::Value> = if !conversation_history.is_empty() {
        conversation_history.iter().map(|msg| {
            json!({
                "role": msg.role,
                "content": msg.content
            })
        }).collect()
    } else {
        vec![json!({
            "role": "user",
            "content": message
        })]
    };

    let body = json!({
        "model": provider_config.model_name,
        "messages": messages,
        "temperature": provider_config.temperature,
        "max_tokens": if provider_config.max_tokens > 0 { 
            serde_json::Value::Number(serde_json::Number::from(provider_config.max_tokens)) 
        } else { 
            serde_json::Value::Null 
        },
        "stream": false
    });

    info!("📡 Endpoint: {}", endpoint);
    info!("🔧 Model: {}, Temp: {}, MaxTokens: {}, Messages: {}", 
          provider_config.model_name, 
          provider_config.temperature, 
          provider_config.max_tokens,
          messages.len());

    let res = client
        .post(&endpoint)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            error!("❌ Dinamik AI istek hatası: {}", e);
            format!("Bağlantı hatası: {}", e)
        })?;

    info!("✅ Yanıt alındı, durum: {}", res.status());

    if !res.status().is_success() {
        let status_code = res.status();
        let error_text = res.text().await.unwrap_or_default();
        error!("❌ API hatası: {}", error_text);
        return Err(format!("API hatası ({}): {}", status_code, error_text));
    }

    let response_text = res.text().await.map_err(|e| {
        error!("❌ Response okuma hatası: {}", e);
        e.to_string()
    })?;

    info!("📥 Raw Response: {}", response_text);

    let json: serde_json::Value = serde_json::from_str(&response_text).map_err(|e| {
        error!("❌ JSON parse hatası: {}", e);
        format!("JSON parse hatası: {}", e)
    })?;

    // OpenAI format response
    if let Some(choices) = json["choices"].as_array() {
        if let Some(first_choice) = choices.first() {
            if let Some(content) = first_choice["message"]["content"].as_str() {
                info!("📥 AI Yanıtı: {}", content);
                return Ok(content.to_string());
            }
        }
    }

    // Anthropic format response
    if let Some(content) = json["content"].as_array() {
        if let Some(first_content) = content.first() {
            if let Some(text) = first_content["text"].as_str() {
                info!("📥 AI Yanıtı (Anthropic): {}", text);
                return Ok(text.to_string());
            }
        }
    }

    // Fallback - try to find any text content
    if let Some(text) = json["text"].as_str() {
        info!("📥 AI Yanıtı (Fallback): {}", text);
        return Ok(text.to_string());
    }

    error!("❌ AI yanıtı parse edilemedi: {}", response_text);
    Err("AI yanıtı formatı tanınmıyor".to_string())
}

// --------------------
// TERMINAL AÇMA
// --------------------
#[tauri::command]
pub fn open_terminal(path: Option<String>) -> Result<(), String> {
    info!("🖥️ Terminal açılıyor...");
    
    #[cfg(target_os = "windows")]
    {
        // Windows'ta PowerShell aç
        let mut cmd = Command::new("powershell.exe");
        
        if let Some(p) = path {
            // Belirtilen dizine git
            cmd.args(&["-NoExit", "-Command", &format!("cd '{}'", p)]);
        } else {
            // Mevcut dizinde aç
            cmd.arg("-NoExit");
        }
        
        cmd.spawn().map_err(|e| {
            error!("❌ Terminal açma hatası: {}", e);
            format!("Terminal açılamadı: {}", e)
        })?;
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS'ta Terminal.app aç
        let mut cmd = Command::new("open");
        cmd.arg("-a").arg("Terminal");
        
        if let Some(p) = path {
            cmd.arg(p);
        }
        
        cmd.spawn().map_err(|e| {
            error!("❌ Terminal açma hatası: {}", e);
            format!("Terminal açılamadı: {}", e)
        })?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux'ta default terminal aç
        let terminal = std::env::var("TERMINAL")
            .unwrap_or_else(|_| "x-terminal-emulator".to_string());
        
        let mut cmd = Command::new(terminal);
        
        if let Some(p) = path {
            cmd.arg("--working-directory").arg(p);
        }
        
        cmd.spawn().map_err(|e| {
            error!("❌ Terminal açma hatası: {}", e);
            format!("Terminal açılamadı: {}", e)
        })?;
    }
    
    info!("✅ Terminal açıldı");
    Ok(())
}

// --------------------
// TERMINAL KOMUT ÇALIŞTIRMA
// --------------------
const ALLOWED_COMMAND_LIST: &[&str] = &[
    "ls", "dir", "pwd", "echo", "cat", "head", "tail",
    "grep", "find", "npm", "cargo", "python", "git",
    "node", "tsc", "eslint", "prettier", "mkdir", "cp", "mv", "rm"
];

#[tauri::command]
pub fn execute_terminal_command(command: String, path: String) -> Result<serde_json::Value, String> {
    info!("🔧 Komut çalıştırılıyor: {} (dizin: {})", command, path);
    
    // Command validation
    let first_word = command.split_whitespace().next().unwrap_or("");
    let base_cmd = std::path::Path::new(first_word)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(first_word);

    if !ALLOWED_COMMAND_LIST.contains(&base_cmd) {
        return Err(format!(
            "Güvenlik: '{}' komutu izin listesinde yok. İzinli komutlar: {}",
            base_cmd,
            ALLOWED_COMMAND_LIST.join(", ")
        ));
    }

    // Sanitize dangerous characters
    let dangerous = [";", "&&", "||", "|", "`", "$(", ">", ">>", "<"];
    for d in &dangerous {
        if command.contains(d) {
            return Err(format!("Güvenlik: '{}' karakteri yasak", d));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd");
        cmd.arg("/C");
        cmd.arg(&command);
        
        if !path.is_empty() {
            cmd.current_dir(&path);
        }
        
        let output = cmd.output().map_err(|e| {
            error!("❌ Komut çalıştırma hatası: {}", e);
            format!("Komut çalıştırılamadı: {}", e)
        })?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        Ok(serde_json::json!({
            "success": output.status.success(),
            "stdout": stdout,
            "stderr": stderr
        }))
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sh")
            .arg("-c")
            .arg(&command)
            .current_dir(if path.is_empty() { "." } else { &path })
            .output()
            .map_err(|e| {
                error!("❌ Komut çalıştırma hatası: {}", e);
                format!("Komut çalıştırılamadı: {}", e)
            })?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        Ok(serde_json::json!({
            "success": output.status.success(),
            "stdout": stdout,
            "stderr": stderr
        }))
    }
}

// --------------------
// BGE EMBEDDING API
// --------------------
#[tauri::command]
pub async fn create_embedding_bge(text: String, endpoint: Option<String>) -> Result<Vec<f32>, String> {
    info!("🧩 BGE Embedding oluşturuluyor...");
    
    let client = Client::new();
    let final_endpoint = endpoint.unwrap_or_else(|| "http://127.0.0.1:1234/v1/embeddings".to_string());
    info!("📡 Embedding endpoint: {}", final_endpoint);

    let body = json!({
        "model": "text-embedding-bge-base-en-v1.5",
        "input": text,
        "encoding_format": "float"
    });

    let res = client
        .post(&final_endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            log::warn!("⚠️ BGE Embedding bağlantısı başarısız (Yerel model kapalı olabilir): {}", e);
            format!("BGE Embedding bağlantısı kapalı: {}", e)
        })?;

    let response_text = res.text().await.map_err(|e| {
        log::warn!("⚠️ BGE Response okuma hatası: {}", e);
        e.to_string()
    })?;

    let json: serde_json::Value = serde_json::from_str(&response_text).map_err(|e| {
        log::warn!("⚠️ BGE JSON parse hatası: {}", e);
        e.to_string()
    })?;

    let embedding = json["data"][0]["embedding"]
        .as_array()
        .ok_or("BGE embedding array bulunamadı")?
        .iter()
        .map(|v| v.as_f64().unwrap_or(0.0) as f32)
        .collect::<Vec<f32>>();

    info!("✅ BGE Embedding oluşturuldu: {} boyut", embedding.len());

    Ok(embedding)
}
// --------------------
// FILE MANAGEMENT
// --------------------
#[tauri::command]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn move_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to move file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn copy_file(source: String, destination: String) -> Result<(), String> {
    fs::copy(&source, &destination).map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_file_metadata(path: String) -> Result<serde_json::Value, String> {
    let metadata = fs::metadata(&path).map_err(|e| format!("Failed to get metadata: {}", e))?;
    
    Ok(json!({
        "size": metadata.len(),
        "is_dir": metadata.is_dir(),
        "is_file": metadata.is_file(),
        "modified": metadata.modified()
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())
            .unwrap_or(0),
        "readonly": metadata.permissions().readonly()
    }))
}

// 🆕 Dosya boyutunu al (basitleştirilmiş versiyon)
#[tauri::command]
pub async fn get_file_size(path: String) -> Result<serde_json::Value, String> {
    let metadata = fs::metadata(&path).map_err(|e| format!("Failed to get file size: {}", e))?;
    
    Ok(json!({
        "size": metadata.len()
    }))
}

// --------------------
// GIT COMMANDS
// --------------------
#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<serde_json::Value, String> {
    let output = Command::new("git")
        .args(&["status", "--porcelain"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git status: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Git command failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    let status_output = String::from_utf8_lossy(&output.stdout);
    let mut staged = Vec::new();
    let mut modified = Vec::new();
    let mut untracked = Vec::new();
    
    for line in status_output.lines() {
        if line.len() >= 3 {
            let status_code = &line[0..2];
            let file_path = &line[3..];
            
            match status_code {
                "A " | "M " | "D " => staged.push(file_path),
                " M" | " D" => modified.push(file_path),
                "??" => untracked.push(file_path),
                _ => {}
            }
        }
    }
    
    Ok(json!({
        "staged": staged,
        "modified": modified,
        "untracked": untracked
    }))
}

#[tauri::command]
pub async fn git_add(repo_path: String, file_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["add", &file_path])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git add: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Git add failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["commit", "-m", &message])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git commit: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Git commit failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn git_push(repo_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["push"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git push: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Git push failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn git_pull(repo_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["pull"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git pull: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Git pull failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    Ok(())
}

// --------------------
// PROJECT TESTING
// --------------------
#[tauri::command]
pub async fn test_project(path: String) -> Result<serde_json::Value, String> {
    info!("🧪 Proje test ediliyor: {}", path);
    
    // Proje tipini belirle
    let project_path = Path::new(&path);
    let mut test_command = None;
    let mut build_command = None;
    
    // package.json var mı? (Node.js/React/TypeScript)
    if project_path.join("package.json").exists() {
        // package.json'u oku ve script'leri kontrol et
        if let Ok(package_content) = fs::read_to_string(project_path.join("package.json")) {
            if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(&package_content) {
                if let Some(scripts) = package_json["scripts"].as_object() {
                    // Test script'i var mı?
                    if scripts.contains_key("test") {
                        test_command = Some(("npm", vec!["run", "test"]));
                    }
                    // Build script'i var mı?
                    if scripts.contains_key("build") {
                        build_command = Some(("npm", vec!["run", "build"]));
                    }
                    // TypeScript check
                    if scripts.contains_key("type-check") {
                        test_command = Some(("npm", vec!["run", "type-check"]));
                    }
                }
            }
        }
        
        // Eğer hiç script yoksa, temel kontroller yap
        if test_command.is_none() && build_command.is_none() {
            // TypeScript var mı?
            if project_path.join("tsconfig.json").exists() {
                build_command = Some(("npx", vec!["tsc", "--noEmit"])); // Sadece type check
            }
        }
    }
    
    // Cargo.toml var mı? (Rust)
    else if project_path.join("Cargo.toml").exists() {
        test_command = Some(("cargo", vec!["test"]));
        build_command = Some(("cargo", vec!["check"]));
    }
    
    // requirements.txt var mı? (Python)
    else if project_path.join("requirements.txt").exists() || project_path.join("setup.py").exists() {
        // Python syntax check
        build_command = Some(("python", vec!["-m", "py_compile", "."]));
    }
    
    let mut all_output = String::new();
    let mut all_errors = String::new();
    let mut overall_success = true;
    
    // Build/Type check çalıştır
    if let Some((cmd, ref args)) = build_command {
        info!("🔨 Build komutu çalıştırılıyor: {} {:?}", cmd, args);
        
        let output = Command::new(cmd)
            .args(args)
            .current_dir(&path)
            .output()
            .map_err(|e| format!("Build komutu çalıştırılamadı: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        all_output.push_str(&format!("=== BUILD OUTPUT ===\n{}\n", stdout));
        if !stderr.is_empty() {
            all_errors.push_str(&format!("=== BUILD ERRORS ===\n{}\n", stderr));
        }
        
        if !output.status.success() {
            overall_success = false;
            info!("❌ Build başarısız");
        } else {
            info!("✅ Build başarılı");
        }
    }
    
    // Test çalıştır (eğer varsa)
    if let Some((cmd, ref args)) = test_command {
        info!("🧪 Test komutu çalıştırılıyor: {} {:?}", cmd, args);
        
        let output = Command::new(cmd)
            .args(args)
            .current_dir(&path)
            .output()
            .map_err(|e| format!("Test komutu çalıştırılamadı: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        all_output.push_str(&format!("=== TEST OUTPUT ===\n{}\n", stdout));
        if !stderr.is_empty() {
            all_errors.push_str(&format!("=== TEST ERRORS ===\n{}\n", stderr));
        }
        
        if !output.status.success() {
            overall_success = false;
            info!("❌ Testler başarısız");
        } else {
            info!("✅ Testler başarılı");
        }
    }
    
    // Eğer hiçbir komut bulunamadıysa, basit dosya kontrolü yap
    if build_command.is_none() && test_command.is_none() {
        all_output.push_str("=== BASIC FILE CHECK ===\n");
        
        // Temel dosyaları kontrol et
        let mut file_count = 0;
        if let Ok(entries) = fs::read_dir(&path) {
            for entry in entries.flatten() {
                if entry.path().is_file() {
                    file_count += 1;
                }
            }
        }
        
        all_output.push_str(&format!("Proje dizininde {} dosya bulundu.\n", file_count));
        
        if file_count == 0 {
            overall_success = false;
            all_errors.push_str("Proje dizini boş görünüyor.\n");
        }
    }
    
    info!("🏁 Test tamamlandı: {}", if overall_success { "BAŞARILI" } else { "BAŞARISIZ" });
    
    Ok(json!({
        "success": overall_success,
        "stdout": all_output,
        "stderr": all_errors
    }))
}

// --------------------
// SYSTEM COMMANDS
// --------------------
#[tauri::command]
pub async fn execute_command(command: String, args: Vec<String>, cwd: Option<String>) -> Result<serde_json::Value, String> {
    // Validate base command
    let base_cmd = std::path::Path::new(&command)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&command);

    if !ALLOWED_COMMAND_LIST.contains(&base_cmd) {
        return Err(format!("Güvenlik: '{}' komutu izin listesinde değil", base_cmd));
    }

    // Sanitize args
    let dangerous = [";", "&&", "||", "|", "`", "$("];
    for arg in &args {
        for d in &dangerous {
            if arg.contains(d) {
                return Err(format!("Güvenlik: argümanda yasaklı karakter: {}", d));
            }
        }
    }

    let mut cmd = Command::new(&command);
    cmd.args(&args);
    
    if let Some(working_dir) = cwd {
        cmd.current_dir(working_dir);
    }
    
    let output = cmd.output().map_err(|e| format!("Failed to execute command: {}", e))?;
    
    Ok(json!({
        "success": output.status.success(),
        "stdout": String::from_utf8_lossy(&output.stdout),
        "stderr": String::from_utf8_lossy(&output.stderr),
        "exit_code": output.status.code()
    }))
}
// GGUF MODEL DOWNLOAD
// --------------------

#[tauri::command]
pub async fn download_gguf_model(
    url: String,
    destination: String,
    app: AppHandle
) -> Result<String, String> {
    info!("🔵 GGUF model indiriliyor: {}", url);
    info!("📁 Hedef: {}", destination);

    let client = Client::new();
    
    // İndirme başlat
    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("İndirme başlatılamadı: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP hatası: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    info!("📊 Toplam boyut: {} bytes", total_size);

    // Dosyayı oluştur
    let dest_path = Path::new(&destination);
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Klasör oluşturulamadı: {}", e))?;
    }

    let mut file = fs::File::create(&destination)
        .map_err(|e| format!("Dosya oluşturulamadı: {}", e))?;

    // Stream ile indir
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut last_progress_update: u64 = 0;

    use futures_util::StreamExt;
    use std::io::Write;

    info!("📥 İndirme başladı, toplam: {} bytes", total_size);

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("İndirme hatası: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Yazma hatası: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        // Progress event gönder (her 1MB'de bir veya %1 değişimde)
        let progress = if total_size > 0 {
            downloaded as f64 / total_size as f64 * 100.0
        } else {
            0.0
        };

        // Her 1MB'de bir veya ilk chunk'ta progress gönder
        if downloaded - last_progress_update >= 1024 * 1024 || last_progress_update == 0 {
            last_progress_update = downloaded;
            
            let progress_data = json!({
                "url": url.clone(),
                "downloaded": downloaded,
                "total": total_size,
                "progress": progress
            });

            info!("📊 Progress: {:.1}% ({} / {} bytes)", progress, downloaded, total_size);

            // Frontend'e progress gönder
            match app.emit("download-progress", progress_data) {
                Ok(_) => {},
                Err(e) => error!("❌ Event emit hatası: {}", e)
            }
        }
    }

    // Son progress'i gönder (100%)
    let _ = app.emit("download-progress", json!({
        "url": url.clone(),
        "downloaded": total_size,
        "total": total_size,
        "progress": 100.0
    }));

    info!("✅ İndirme tamamlandı: {}", destination);
    Ok(destination)
}


// --------------------
// VECTOR DATABASE COMMANDS (AI-Native IDE Evolution)
// --------------------

use crate::vector_db::{VectorDB, CodeChunk};
use std::sync::Arc;
use tokio::sync::Mutex;

// Global VectorDB instance
lazy_static::lazy_static! {
    static ref VECTOR_DB: Arc<Mutex<Option<VectorDB>>> = Arc::new(Mutex::new(None));
}

/// Initialize vector database
#[tauri::command]
pub async fn init_vector_db(db_path: String) -> Result<(), String> {
    info!("🔵 Vector DB başlatılıyor: {}", db_path);
    
    let db = VectorDB::init(&db_path)
        .await
        .map_err(|e| format!("Vector DB başlatılamadı: {}", e))?;
    
    let mut global_db: tokio::sync::MutexGuard<Option<VectorDB>> = VECTOR_DB.lock().await;
    *global_db = Some(db);
    
    info!("✅ Vector DB başlatıldı");
    Ok(())
}

/// Search vector database for similar code chunks
#[tauri::command]
pub async fn vector_search(query: String, top_k: u32, endpoint: Option<String>) -> Result<Vec<CodeChunk>, String> {
    info!("🔍 Vector search: {} (top_k: {})", query, top_k);
    
    // Create embedding for query
    let query_embedding = create_embedding_bge(query, endpoint).await?;
    
    // Get VectorDB instance
    let global_db: tokio::sync::MutexGuard<Option<VectorDB>> = VECTOR_DB.lock().await;
    let db = global_db.as_ref()
        .ok_or("Vector DB başlatılmamış. Önce init_vector_db çağırın.")?;
    
    // Search
    let results = db.query(query_embedding, top_k as usize)
        .await
        .map_err(|e| format!("Vector search hatası: {}", e))?;
    
    info!("✅ {} sonuç bulundu", results.len());
    Ok(results)
}

/// Index a file in the vector database
#[tauri::command]
pub async fn index_file_vector(file_path: String, endpoint: Option<String>) -> Result<(), String> {
    info!("📇 Dosya indeksleniyor: {}", file_path);
    
    // Read file content
    let content = read_file(file_path.clone())?;
    
    // Create embedding
    let embedding = create_embedding_bge(content.clone(), endpoint).await?;
    
    // Create chunk
    let chunk = CodeChunk {
        id: format!("{}:0:0", file_path),
        file_path: file_path.clone(),
        content,
        embedding,
        symbol_name: None,
        chunk_type: "File".to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    // Get VectorDB instance
    let global_db: tokio::sync::MutexGuard<Option<VectorDB>> = VECTOR_DB.lock().await;
    let db = global_db.as_ref()
        .ok_or("Vector DB başlatılmamış. Önce init_vector_db çağırın.")?;
    
    // Upsert to vector DB
    db.upsert(vec![chunk])
        .await
        .map_err(|e| format!("Vector DB upsert hatası: {}", e))?;
    
    info!("✅ Dosya indekslendi: {}", file_path);
    Ok(())
}

/// Index manual content (like git commits) in the vector database
#[tauri::command]
pub async fn index_manual_vector(
    id: String,
    file_path: String,
    content: String,
    chunk_type: String,
    symbol_name: Option<String>,
    endpoint: Option<String>
) -> Result<(), String> {
    info!("📇 Manuel veri indeksleniyor: {} ({})", id, chunk_type);
    
    // Create embedding
    let embedding = create_embedding_bge(content.clone(), endpoint).await?;
    
    // Create chunk
    let chunk = CodeChunk {
        id,
        file_path,
        content,
        embedding,
        symbol_name,
        chunk_type,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    // Get VectorDB instance
    let global_db = VECTOR_DB.lock().await;
    let db = global_db.as_ref()
        .ok_or("Vector DB başlatılmamış.")?;
    
    // Upsert
    db.upsert(vec![chunk])
        .await
        .map_err(|e| format!("Vector DB upsert hatası: {}", e))?;
    
    Ok(())
}

/// Delete file index from vector database
#[tauri::command]
pub async fn delete_file_index(file_path: String) -> Result<(), String> {
    info!("🗑️ Dosya indeksi siliniyor: {}", file_path);
    
    // Get VectorDB instance
    let global_db: tokio::sync::MutexGuard<Option<VectorDB>> = VECTOR_DB.lock().await;
    let db = global_db.as_ref()
        .ok_or("Vector DB başlatılmamış. Önce init_vector_db çağırın.")?;
    
    // Delete file
    db.delete_file(&file_path)
        .await
        .map_err(|e| format!("Vector DB delete hatası: {}", e))?;
    
    info!("✅ Dosya indeksi silindi: {}", file_path);
    Ok(())
}


// --------------------
// RAG PIPELINE COMMANDS (AI-Native IDE Evolution)
// --------------------

use crate::rag_pipeline::{RAGPipeline, QueryIntent, ContextSource};

/// Analyze query intent
#[tauri::command]
pub async fn analyze_query_intent(query: String) -> Result<QueryIntent, String> {
    info!("🔍 Query intent analizi: {}", query);
    
    let pipeline = RAGPipeline::new(170_000); // Claude 3.5 context limit
    let intent = pipeline.analyze_intent(&query);
    
    info!("✅ Intent: {:?}", intent);
    Ok(intent)
}

/// Build context from multiple sources
#[tauri::command]
pub async fn build_rag_context(
    query: String,
    max_tokens: Option<usize>,
) -> Result<serde_json::Value, String> {
    info!("🔨 RAG context oluşturuluyor: {}", query);
    
    let pipeline = RAGPipeline::new(max_tokens.unwrap_or(170_000));
    
    // Analyze intent
    let intent = pipeline.analyze_intent(&query);
    
    // Build context with database and embedding
    let global_db = VECTOR_DB.lock().await;
    let db = global_db.as_ref().ok_or("VectorDB not initialized")?;
    let query_embedding = create_embedding_bge(query.clone(), None).await?;
    
    let result: Result<(String, Vec<ContextSource>), Box<dyn std::error::Error>> = pipeline.build_context(intent.clone(), &query, db, query_embedding).await;
    let (context, sources) = result.map_err(|e| format!("Context build hatası: {}", e))?;
    
    info!("✅ Context oluşturuldu: {} tokens", RAGPipeline::estimate_tokens(&context));
    
    Ok(json!({
        "context": context,
        "sources": sources,
        "intent": intent,
        "token_count": RAGPipeline::estimate_tokens(&context)
    }))
}

// --------------------
// TREE-SITTER PARSER COMMANDS (AI-Native IDE Evolution)
// --------------------

use crate::tree_sitter_parser::{TreeSitterParser, FileAnalysis};
use tokio::sync::Mutex as TokioMutex;
use once_cell::sync::Lazy;

// Global TreeSitterParser instance
static TREE_SITTER_PARSER: Lazy<TokioMutex<TreeSitterParser>> = Lazy::new(|| {
    TokioMutex::new(TreeSitterParser::new())
});

/// Parse file and extract symbols using tree-sitter
#[tauri::command]
pub async fn parse_file_ast(file_path: String) -> Result<FileAnalysis, String> {
    info!("🌳 Dosya parse ediliyor: {}", file_path);
    
    // Read file content
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Dosya okunamadı: {}", e))?;
    
    // Get parser instance
    let mut parser: tokio::sync::MutexGuard<TreeSitterParser> = TREE_SITTER_PARSER.lock().await;
    
    // Parse file
    let analysis = parser.parse_file(&file_path, &content)
        .map_err(|e| format!("Parse hatası: {}", e))?;
    
    info!("✅ Parse tamamlandı: {} sembol bulundu", analysis.symbols.len());
    Ok(analysis)
}

/// Clear tree-sitter AST cache
#[tauri::command]
pub async fn clear_ast_cache() -> Result<(), String> {
    info!("🧹 AST cache temizleniyor");
    
    let mut parser: tokio::sync::MutexGuard<TreeSitterParser> = TREE_SITTER_PARSER.lock().await;
    parser.clear_cache();
    
    info!("✅ AST cache temizlendi");
    Ok(())
}

/// Invalidate cache for specific file
#[tauri::command]
pub async fn invalidate_file_cache(file_path: String) -> Result<(), String> {
    info!("🗑️ Dosya cache'i geçersiz kılınıyor: {}", file_path);
    
    let mut parser: tokio::sync::MutexGuard<TreeSitterParser> = TREE_SITTER_PARSER.lock().await;
    parser.invalidate_file(&file_path);
    
    info!("✅ Dosya cache'i geçersiz kılındı");
    Ok(())
}


// --------------------
// 🆕 TASK 10: GIT TIMELINE INTELLIGENCE
// --------------------

/// 🆕 TASK 10.1: Get git log for a specific file
#[tauri::command]
pub async fn git_log_file(path: String, limit: Option<u32>) -> Result<String, String> {
    info!("📜 Git log for file: {}", path);
    
    let limit_arg = limit.unwrap_or(10).to_string();
    
    let output = Command::new("git")
        .args(&["log", &format!("-{}", limit_arg), "--", &path])
        .output()
        .map_err(|e| format!("Failed to execute git log: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Graceful degradation - return empty string instead of error
        if stderr.contains("not a git repository") {
            info!("⚠️ Not a git repository, returning empty log");
            return Ok(String::new());
        }
        return Err(format!("Git log failed: {}", stderr));
    }
    
    let log_output = String::from_utf8_lossy(&output.stdout).to_string();
    info!("✅ Git log retrieved: {} bytes", log_output.len());
    
    Ok(log_output)
}

/// 🆕 TASK 10.3: Get git log for the entire project
#[tauri::command]
pub async fn git_log_project(limit: Option<u32>) -> Result<String, String> {
    info!("📜 Git log for project");
    
    let limit_arg = limit.unwrap_or(50).to_string();
    
    let output = Command::new("git")
        .args(&["log", &format!("-{}", limit_arg)])
        .output()
        .map_err(|e| format!("Failed to execute git log: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not a git repository") {
            info!("⚠️ Not a git repository, returning empty log");
            return Ok(String::new());
        }
        return Err(format!("Git log failed: {}", stderr));
    }
    
    let log_output = String::from_utf8_lossy(&output.stdout).to_string();
    info!("✅ Project git log retrieved: {} bytes", log_output.len());
    
    Ok(log_output)
}

/// 🆕 TASK 10.2: Get git blame for a file (line range)
#[tauri::command]
pub async fn git_blame(
    path: String, 
    start_line: u32, 
    end_line: u32
) -> Result<String, String> {
    info!("🔍 Git blame for {}:{}-{}", path, start_line, end_line);
    
    let line_range = format!("{},{}", start_line, end_line);
    
    let output = Command::new("git")
        .args(&["blame", "-L", &line_range, &path])
        .output()
        .map_err(|e| format!("Failed to execute git blame: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Graceful degradation
        if stderr.contains("not a git repository") {
            info!("⚠️ Not a git repository, returning empty blame");
            return Ok(String::new());
        }
        return Err(format!("Git blame failed: {}", stderr));
    }
    
    let blame_output = String::from_utf8_lossy(&output.stdout).to_string();
    info!("✅ Git blame retrieved: {} bytes", blame_output.len());
    
    Ok(blame_output)
}

/// 🆕 FIX-41: Test AI Provider Connection securely from backend
#[tauri::command]
pub async fn test_provider_connection(base_url: String, api_key: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client.get(format!("{}/models", base_url));
    if !api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    match request.send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false)
    }
}

/// 🆕 PLUGIN SYSTEM (BETA): List installed plugins
#[tauri::command]
pub async fn list_plugins(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let plugins_dir = app_dir.join("plugins");

    // Ensure directory exists
    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;
    }

    let mut plugin_paths = Vec::new();
    if let Ok(entries) = fs::read_dir(plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("plugin.json").exists() {
                if let Some(path_str) = path.to_str() {
                    plugin_paths.push(path_str.to_string());
                }
            }
        }
    }

    Ok(plugin_paths)
}

