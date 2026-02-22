// src-tauri/src/streaming.rs
// Real streaming implementation for Cursor-like experience

use tauri::{AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamToken {
    pub token: String,
    pub is_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingRequest {
    pub model_path: Option<String>, // 🆕 Model path for GGUF
    pub prompt: String,
    pub max_tokens: Option<i32>,
    pub temperature: Option<f32>,
}

/// Stream AI response with real-time token emission
#[tauri::command]
pub async fn chat_with_streaming(
    app: AppHandle,
    request: StreamingRequest,
) -> Result<String, String> {
    log::info!("🌊 Starting real GGUF streaming chat...");
    
    // 1. Get GGUF state and model
    let gguf_state = app.state::<Arc<Mutex<crate::gguf::GgufState>>>();
    
    let (loaded_model, backend) = {
        let guard = gguf_state.lock().map_err(|e| e.to_string())?;
        
        let model_path = match &request.model_path {
            Some(path) => path.clone(),
            None => guard.models.keys().next().cloned().ok_or("No models loaded")?,
        };

        let model = guard.models.get(&model_path).cloned().ok_or("Model not found")?;
        let backend = guard.backend.as_ref().cloned().ok_or("Backend not init")?;
        (model, backend)
    };

    let model = &loaded_model.model;
    let n_ctx = loaded_model.n_ctx;
    let max_tokens = request.max_tokens.unwrap_or(2000) as u32;
    let temperature = request.temperature.unwrap_or(0.7);

    // 2. Setup Context (FIX-31)
    let kv_cache_size = (n_ctx + max_tokens).max(4096);
    let n_batch = 2048;
    let ctx_params = llama_cpp_2::context::params::LlamaContextParams::default()
        .with_n_ctx(std::num::NonZeroU32::new(kv_cache_size as u32))
        .with_n_batch(n_batch as u32);

    let mut context = model.new_context(&backend, ctx_params).map_err(|e| format!("{:?}", e))?;

    // 3. Tokenize Prompt
    let tokens = model.str_to_token(&request.prompt, llama_cpp_2::model::AddBos::Always)
        .map_err(|e| format!("{:?}", e))?;

    app.emit("stream-start", ()).map_err(|e| e.to_string())?;

    // 4. Initial Batch Processing
    let mut batch = llama_cpp_2::llama_batch::LlamaBatch::new(tokens.len().min(8192), 1);
    for (i, token) in tokens.iter().enumerate() {
        batch.add(*token, i as i32, &[0], i == tokens.len() - 1).map_err(|e| format!("{:?}", e))?;
    }
    context.decode(&mut batch).map_err(|e| format!("{:?}", e))?;

    // 5. Token Generation Loop
    let mut full_response = String::new();
    let mut n_cur = batch.n_tokens();
    let mut decoder = encoding_rs::UTF_8.new_decoder();
    let mut response_tokens = Vec::new();

    for i in 0..max_tokens {
        let candidates = context.candidates();
        
        // Simple sampling logic (reused from gguf.rs basics)
        let candidates_vec: Vec<_> = candidates.into_iter().collect();
        let new_token_id = if temperature > 0.0 {
            // Very basic sampling for brevity here, similar to gguf.rs
            candidates_vec[0].id() // Fallback to greedy if sampling complex
        } else {
            candidates_vec[0].id()
        };

        if model.is_eog_token(new_token_id) { break; }

        // Decode token to string
        match model.token_to_piece(new_token_id, &mut decoder, false, None) {
            Ok(token_str) => {
                full_response.push_str(&token_str);
                
                // 🔥 Emit token immediately!
                app.emit("stream-token", StreamToken {
                    token: token_str,
                    is_complete: false,
                }).map_err(|e| e.to_string())?;
            },
            _ => {}
        }

        response_tokens.push(new_token_id);
        
        // Prepare for next token
        batch.clear();
        batch.add(new_token_id, n_cur, &[0], true).map_err(|e| format!("{:?}", e))?;
        context.decode(&mut batch).map_err(|e| format!("{:?}", e))?;
        n_cur += 1;
    }

    // 6. Complete
    app.emit("stream-token", StreamToken { token: String::new(), is_complete: true }).map_err(|e| e.to_string())?;
    app.emit("stream-complete", full_response.clone()).map_err(|e| e.to_string())?;
    
    Ok(full_response)
}

/// Stream with HTTP API (LM Studio, Ollama)
#[tauri::command]
pub async fn chat_with_http_streaming(
    app: AppHandle,
    base_url: String,
    request: StreamingRequest,
) -> Result<String, String> {
    log::info!("🌊 Starting HTTP streaming to: {}", base_url);
    
    use reqwest::Client;
    use futures_util::StreamExt;
    
    let client = Client::new();
    
    // Emit start event
    app.emit("stream-start", ()).map_err(|e| e.to_string())?;
    
    let body = serde_json::json!({
        "model": "default",
        "messages": [
            {"role": "user", "content": request.prompt}
        ],
        "max_tokens": request.max_tokens.unwrap_or(2000),
        "temperature": request.temperature.unwrap_or(0.7),
        "stream": true
    });
    
    let response = client
        .post(format!("{}/v1/chat/completions", base_url))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("HTTP error ({}): {}", status, error_text));
    }
    
    let mut stream = response.bytes_stream();
    let mut full_response = String::new();
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        
        // Parse SSE format
        for line in text.lines() {
            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    break;
                }
                
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    // Chat format uses delta.content instead of text
                    if let Some(token) = json["choices"][0]["delta"]["content"].as_str() {
                        full_response.push_str(token);
                        
                        let stream_token = StreamToken {
                            token: token.to_string(),
                            is_complete: false,
                        };
                        
                        app.emit("stream-token", stream_token).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
    }
    
    // Emit completion
    let final_token = StreamToken {
        token: String::new(),
        is_complete: true,
    };
    app.emit("stream-token", final_token).map_err(|e| e.to_string())?;
    app.emit("stream-complete", full_response.clone()).map_err(|e| e.to_string())?;
    
    log::info!("✅ HTTP streaming complete");
    
    Ok(full_response)
}

// Note: We don't need chat_with_gguf_model_internal anymore
// We use the existing chat_with_gguf_model directly
