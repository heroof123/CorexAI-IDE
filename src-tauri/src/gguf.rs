// GGUF System - Complete implementation in one file
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{LlamaModel, AddBos};
use std::path::Path;
use std::sync::{Arc, Mutex};
use log::{info, error, warn};
use tauri::State;
use serde_json::json;
use base64::{Engine as _, engine::general_purpose}; // 🆕 Base64 decoding
use rand::Rng; // 🆕 Random number generation for sampling

use std::collections::HashMap;

// State structure
pub struct LoadedModel {
    pub model: LlamaModel,
    pub model_path: String,
    pub n_ctx: u32,
    pub n_gpu_layers: u32,
}

pub struct GgufState {
    pub backend: Option<Arc<LlamaBackend>>,
    pub models: HashMap<String, Arc<LoadedModel>>, // Model path -> Model info
    pub backend_initialized: bool,
}

impl Default for GgufState {
    fn default() -> Self {
        Self {
            backend: None,
            models: HashMap::new(),
            backend_initialized: false,
        }
    }
}

// Commands
#[tauri::command]
pub async fn load_gguf_model(
    state: State<'_, Arc<Mutex<GgufState>>>,
    model_path: String,
    n_ctx: u32,
    n_gpu_layers: u32,
) -> Result<String, String> {
    info!("🔵 GGUF model loading: {}", model_path);
    info!("📊 Context: {}, GPU Layers: {}", n_ctx, n_gpu_layers);
    
    // Split GGUF dosyalari icin ilk parcaya yonlendir
    // Ornek: model-00003-of-00004.gguf -> model-00001-of-00004.gguf
    let model_path = resolve_split_gguf_path(&model_path);
    info!("📂 Resolved model path: {}", model_path);
    
    if !Path::new(&model_path).exists() {
        error!("❌ Model file not found: {}", model_path);
        return Err(format!("Model dosyası bulunamadı: {}", model_path));
    }
    
    // Model dosyası boyutunu kontrol et
    let metadata = std::fs::metadata(&model_path)
        .map_err(|e| format!("Model dosyası okunamadı: {}", e))?;
    let file_size_mb = metadata.len() / (1024 * 1024);
    info!("📦 Model dosyası boyutu: {} MB", file_size_mb);
    
    if file_size_mb < 10 {
        // Split GGUF parcalari kucuk olabilir, kontrol et
        let is_split = regex::Regex::new(r"-\d{5}-of-\d{5}\.gguf$")
            .map(|re| re.is_match(&model_path))
            .unwrap_or(false);
        if !is_split {
            error!("❌ Model dosyası çok küçük ({}MB), bozuk olabilir", file_size_mb);
            return Err(format!("Model dosyası çok küçük ({}MB), muhtemelen bozuk veya eksik indirilmiş. Lütfen modeli yeniden indirin.", file_size_mb));
        }
    }

    // Initialize backend only once
    let backend = {
        let mut guard = state.lock().unwrap();
        if !guard.backend_initialized {
            info!("🔄 Initializing backend (first time)...");
            let backend = Arc::new(LlamaBackend::init()
                .map_err(|e| {
                    error!("❌ Backend init failed: {:?}", e);
                    format!("Backend init failed: {:?}", e)
                })?);
            
            guard.backend = Some(backend.clone());
            guard.backend_initialized = true;
            backend
        } else {
            guard.backend.as_ref().unwrap().clone()
        }
    };

    // GPU layers parametresini ayarla
    // CUDA veya Vulkan yoksa otomatik olarak 0'a düşür
    let has_gpu = cfg!(feature = "cuda") || cfg!(feature = "vulkan");
    let backend_name = if cfg!(feature = "cuda") {
        "CUDA"
    } else if cfg!(feature = "vulkan") {
        "Vulkan"
    } else {
        "CPU"
    };
    
    let safe_gpu_layers = if has_gpu {
        info!("🎮 {} enabled - GPU Layers: {}", backend_name, n_gpu_layers);
        n_gpu_layers
    } else {
        info!("⚠️ No GPU backend - Forcing CPU-only (GPU layers = 0)");
        0
    };
    
    let model_params = LlamaModelParams::default()
        .with_n_gpu_layers(safe_gpu_layers);

    info!("🔄 Loading model to GPU... (this may take a while)");
    info!("📋 Model params: n_gpu_layers={}", n_gpu_layers);

    // 🆕 2025 Güncelleme: GPU/boyut kısıtlamaları kaldırıldı
    // Tüm GGUF modelleri yüklenmeye çalışılır
    // Bellek yetersiz ise CPU'ya otomatik fallback yapılır
    
    let mut final_gpu_layers = n_gpu_layers;
    let model = match LlamaModel::load_from_file(&backend, &model_path, &model_params) {
        Ok(m) => m,
        Err(e) => {
            error!("❌ GPU yükleme başarısız: {:?}", e);
            
            // GPU hatası durumunda CPU fallback yap (FIX-33)
            warn!("⚠️ GPU yükleme hatası algılandı, CPU fallback deneniyor...");
            
            final_gpu_layers = 0; // CPU'ya geç
            let cpu_model_params = LlamaModelParams::default()
                .with_n_gpu_layers(0); // CPU-only
                
            match LlamaModel::load_from_file(&backend, &model_path, &cpu_model_params) {
                Ok(m) => {
                    info!("✅ Model CPU'da başarıyla yüklendi");
                    m
                },
                Err(cpu_err) => {
                    // CPU yükleme de başarısız - tüm hatayı ver
                    error!("❌ CPU yükleme de başarısız: {:?}", cpu_err);
                    return Err(format!(
                        "Model yüklenemedi:\n\
                        - GPU hatası: {:?}\n\
                        - CPU hatası: {:?}\n\n\
                        Lütfen:\n\
                        1. Model dosyasının geçerli olduğundan emin olun\n\
                        2. Modeli yeniden indirmeyi deneyin\n\
                        3. Context length'i azaltmayı deneyin",
                        e, cpu_err
                    ));
                }
            }
        }
    };

    info!("✅ Model loaded successfully!");
    info!("📦 Model: {}", model_path);
    info!("🎮 GPU Layers: {}", final_gpu_layers);
    info!("📝 Context: {}", n_ctx);
    
    // GPU kullanımını kontrol et
    if final_gpu_layers > 0 {
        info!("✅ GPU offload aktif - Model GPU'da çalışmalı");
    } else {
        info!("⚠️ GPU offload kapalı - Model CPU'da çalışacak");
    }

    // Save model to state pool
    let mut guard = state.lock().unwrap();
    guard.models.insert(model_path.clone(), Arc::new(LoadedModel {
        model,
        model_path: model_path.clone(),
        n_ctx,
        n_gpu_layers: final_gpu_layers,
    }));
    
    info!("✅ Model saved to pool! Total models: {}", guard.models.len());

    Ok(format!("✅ Model başarıyla yüklendi: {}", model_path))
}

#[tauri::command]
pub async fn chat_with_gguf_model(
    state: State<'_, Arc<Mutex<GgufState>>>,
    model_path: String, // 🆕 Model path required
    prompt: String,
    max_tokens: u32,
    temperature: f32,
) -> Result<String, String> {
    info!("🔵 Starting inference...");
    info!("📝 Prompt length: {} chars", prompt.len());
    info!("⚙️ Max tokens: {}, Temperature: {}", max_tokens, temperature);

    // 🆕 Get model and backend from pool with minimum lock time
    let (loaded_model, backend) = {
        let guard = match state.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        
        let model = guard.models.get(&model_path)
            .cloned() // Arc cloing is cheap
            .ok_or_else(|| format!("Model havuzda bulunamadı: {}", model_path))?;
            
        let backend = guard.backend.as_ref()
            .cloned()
            .ok_or_else(|| "Backend not initialized".to_string())?;
            
        (model, backend)
    };

    let model = &loaded_model.model;
    let n_ctx = loaded_model.n_ctx;

    info!("📦 Using model from pool: {}", model_path);

    // Create context with proper KV cache size (FIX-31)
    let kv_cache_size = (n_ctx + max_tokens).max(4096);
    
    // 🔥 FIXED: n_batch context'in tek seferde işleyebileceği max token sayısıdır.
    // LlamaBatch boyutu n_batch'den büyük olamaz.
    let n_batch = 8192; // Max batch size increase
    
    info!("📊 Context Params: n_ctx={}, n_batch={}", kv_cache_size, n_batch);
    
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(std::num::NonZeroU32::new(kv_cache_size as u32))
        .with_n_batch(n_batch as u32);

    let mut context = model.new_context(&backend, ctx_params)
        .map_err(|e| {
            error!("❌ Context creation failed: {:?}", e);
            format!("Context creation failed: {:?}", e)
        })?;

    info!("✅ Context created with KV cache size: {}", kv_cache_size);

    // Tokenize prompt with BOS token
    info!("🔤 Tokenizing prompt with BOS token...");
    let tokens = model.str_to_token(&prompt, AddBos::Always)
        .map_err(|e| {
            error!("❌ Tokenization failed: {:?}", e);
            format!("Tokenization failed: {:?}", e)
        })?;

    info!("✅ Tokenized: {} tokens", tokens.len());
    
    // Log first few tokens for debugging
    if tokens.len() > 0 {
        info!("🔍 First 10 tokens: {:?}", &tokens[..tokens.len().min(10)]);
    }
    
    // Check if prompt is too long
    if tokens.len() > n_ctx as usize {
        error!("❌ Prompt too long: {} tokens (max: {})", tokens.len(), n_ctx);
        return Err(format!("Prompt too long: {} tokens (max: {})", tokens.len(), n_ctx));
    }

    // Create batch - MUST be at least as large as the number of prompt tokens
    // But not more than n_batch of the context (FIX for abort crash)
    let max_batch_size = 8192;
    let batch_size = tokens.len().min(max_batch_size);
    
    info!("📦 Creating batch: prompt_tokens={}, batch_size={}, n_ctx={}", tokens.len(), batch_size, n_ctx);
    
    // Create batch outside if/else so it's available later
    let mut batch = LlamaBatch::new(batch_size, 1);
    
    // Process prompt in chunks if necessary
    if tokens.len() > max_batch_size {
        info!("⚠️ Prompt too long for single batch, processing in chunks...");
        
        let mut processed = 0;
        
        while processed < tokens.len() {
            batch.clear();
            let chunk_size = (tokens.len() - processed).min(max_batch_size);
            
            for i in 0..chunk_size {
                let token_idx = processed + i;
                batch.add(
                    tokens[token_idx], 
                    token_idx as i32, 
                    &[0], 
                    token_idx == tokens.len() - 1
                ).map_err(|e| format!("Batch add failed: {:?}", e))?;
            }
            
            context.decode(&mut batch)
                .map_err(|e| {
                    error!("❌ Decode failed at chunk {}: {:?}", processed / max_batch_size, e);
                    format!("Decode failed: {:?}", e)
                })?;
            
            processed += chunk_size;
            info!("📊 Processed {}/{} tokens", processed, tokens.len());
        }
        
        info!("✅ All prompt chunks processed!");
    } else {
        // Single batch processing (normal case)
        for (i, token) in tokens.iter().enumerate() {
            batch.add(*token, i as i32, &[0], i == tokens.len() - 1)
                .map_err(|e| format!("Batch add failed: {:?}", e))?;
        }

        // Initial decode (process prompt)
        context.decode(&mut batch)
            .map_err(|e| {
                error!("❌ Decode failed: {:?}", e);
                format!("Decode failed: {:?}", e)
            })?;
        
        info!("✅ Prompt processed!");
    }

    // Token generation
    let mut response_tokens = Vec::new();
    
    // 🔥 FIXED: n_cur her zaman tüm prompt tokenlarının sayısı olmalı (chunking olsa bile)
    let mut n_cur = tokens.len() as i32;
    
    info!("🎲 Starting token generation from position {}", n_cur);

    for i in 0..max_tokens {
        // Get candidates
        let candidates = context.candidates();
        
        // 🆕 Repetition Penalty ve Temperature Sampling
        let candidates_vec: Vec<_> = candidates.into_iter().collect();
        
        // 🔄 Repetition Penalty Uygulama
        let repeat_penalty = 1.15_f32;
        let penalty_last_n = 64; 
        
        let mut recent_tokens = Vec::new();
        let total_recent = tokens.len() + response_tokens.len();
        let start_idx = if total_recent > penalty_last_n { total_recent - penalty_last_n } else { 0 };
        
        if tokens.len() > start_idx {
            recent_tokens.extend_from_slice(&tokens[start_idx..]);
            recent_tokens.extend_from_slice(&response_tokens);
        } else {
            let resp_start = start_idx - tokens.len();
            recent_tokens.extend_from_slice(&response_tokens[resp_start..]);
        }
        
        let adjusted_logits: Vec<(llama_cpp_2::token::LlamaToken, f32)> = candidates_vec.iter()
            .map(|c| {
                let id = c.id();
                let mut logit = c.logit();
                
                if recent_tokens.contains(&id) {
                    if logit <= 0.0 {
                        logit *= repeat_penalty;
                    } else {
                        logit /= repeat_penalty;
                    }
                }
                
                (id, logit)
            })
            .collect();
        
        // Temperature-based sampling
        let new_token_id = if temperature > 0.0 && temperature != 1.0 {
            // Apply temperature scaling to logits
            let scaled_logits: Vec<_> = adjusted_logits.iter()
                .map(|(id, logit)| (*id, logit / temperature))
                .collect();
            
            // Convert to probabilities using softmax
            let max_logit = scaled_logits.iter()
                .map(|(_, logit)| logit)
                .fold(f32::NEG_INFINITY, |a, &b| a.max(b));
            
            let exp_sum: f32 = scaled_logits.iter()
                .map(|(_, logit)| (logit - max_logit).exp())
                .sum();
            
            let probs: Vec<_> = scaled_logits.iter()
                .map(|(id, logit)| (*id, (logit - max_logit).exp() / exp_sum))
                .collect();
            
            // Sample from distribution
            let mut rng = rand::thread_rng();
            let random_val: f32 = rng.gen();
            let mut cumulative = 0.0;
            
            let mut selected_id = probs[0].0;
            for (id, prob) in probs.iter() {
                cumulative += prob;
                if random_val <= cumulative {
                    selected_id = *id;
                    break;
                }
            }
            selected_id
        } else {
            // No temperature, just pick highest probability
            adjusted_logits.into_iter()
                .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(id, _)| id)
                .unwrap_or(candidates_vec[0].id())
        };

        // Check for EOS (End of Sequence)
        if model.is_eog_token(new_token_id) {
            info!("✅ EOS token found at position {}, stopping", i);
            break;
        }

        response_tokens.push(new_token_id);
        
        // Log first few tokens to debug
        if i < 5 {
            info!("🔤 Token {}: id={:?}", i, new_token_id);
        }

        // Log every 50 tokens
        if i % 50 == 0 && i > 0 {
            info!("📊 Generated {}/{} tokens", i, max_tokens);
        }

        // Create new batch
        batch.clear();
        batch.add(new_token_id, n_cur, &[0], true)
            .map_err(|e| format!("Batch add failed: {:?}", e))?;

        // Decode
        context.decode(&mut batch)
            .map_err(|e| format!("Decode failed at token {}: {:?}", i, e))?;

        n_cur += 1;
    }

    let total_tokens = response_tokens.len();
    info!("✅ Token generation completed: {} tokens", total_tokens);
    
    // 🆕 Token'ları tek tek decode et ve birleştir
    info!("🔤 Decoding tokens...");
    let mut response = String::new();
    let mut decode_errors = 0;
    
    let mut decoder = encoding_rs::UTF_8.new_decoder();
    for (idx, token_id) in response_tokens.iter().enumerate() {
        // Use modern token_to_piece with 4 arguments as required by llama-cpp-2 v0.1.133
        match model.token_to_piece(*token_id, &mut decoder, false, None) {
            Ok(token_str) => {
                response.push_str(&token_str);
            },
            Err(e) => {
                decode_errors += 1;
                if decode_errors <= 10 {
                    info!("⏭️ Token {}: decode failed: {:?}", idx, e);
                }
            }
        }
    }
    
    info!("✅ Decoded: {} characters from {} tokens ({} decode errors)", response.len(), total_tokens, decode_errors);
    
    // Clean up response (remove special tokens if any)
    let cleaned_response = response
        .replace("<|im_start|>", "")
        .replace("<|im_end|>", "")
        .replace("<|endoftext|>", "")
        .replace("<|system|>", "")
        .replace("<|user|>", "")
        .replace("<|assistant|>", "")
        .trim()
        .to_string();
    
    info!("📤 Final response length: {} characters", cleaned_response.len());
    if cleaned_response.len() > 0 {
        let preview_len = cleaned_response.len().min(200);
        info!("📤 Response preview: {}", &cleaned_response[..preview_len]);
    }

    Ok(cleaned_response)
}

#[tauri::command]
pub async fn unload_gguf_model(
    state: State<'_, Arc<Mutex<GgufState>>>,
) -> Result<String, String> {
    info!("🔵 Unloading GGUF model - Starting cleanup...");
    
    let mut state_guard = state.lock().unwrap();
    
    state_guard.models.clear();
    state_guard.backend = None;
    state_guard.backend_initialized = false;
    
    // Clear state
    // Clear state done above
    
    // Force garbage collection hint (Rust will handle it)
    drop(state_guard);
    
    info!("✅ GGUF model fully unloaded - GPU memory should be freed");
    Ok("✅ Model unloaded - GPU memory freed".to_string())
}

#[tauri::command]
pub async fn get_gguf_model_status(
    state: State<'_, Arc<Mutex<GgufState>>>,
) -> Result<serde_json::Value, String> {
    let state_guard = state.lock().unwrap();
    let loaded_models: Vec<String> = state_guard.models.keys().cloned().collect();
    
    Ok(json!({
        "loaded": !loaded_models.is_empty(),
        "loaded_models": loaded_models
    }))
}

// 🆕 GPU Memory bilgisi al
#[tauri::command]
pub async fn get_gpu_memory_info(
    state: State<'_, Arc<Mutex<GgufState>>>,
) -> Result<serde_json::Value, String> {
    let state_guard = state.lock().unwrap();
    
    // Note: This returns generic GPU info if any model is loaded
    if state_guard.models.is_empty() {
        return Ok(json!({
            "available": false,
            "total_vram_gb": 0.0,
            "used_vram_gb": 0.0,
            "free_vram_gb": 0.0,
            "usage_percent": 0.0,
            "model_size_gb": 0.0,
            "kv_cache_size_gb": 0.0
        }));
    }
    
    // Use the first model for estimation or sum them up
    // For now, let's just use representative values
    let representative_model = state_guard.models.values().next().unwrap();
    let n_ctx = representative_model.n_ctx;
    let n_gpu_layers = representative_model.n_gpu_layers;
    
    // 🔥 Dinamik sistem VRAM bilgisi al
    // Eğer GPU yüklü değilse sistem RAM'ı kullan
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Eğer GPU varsa (CUDA/Vulkan), varsayılan olarak daha düşük bir değer al
    // Gerçek VRAM bilgisi almak için platform-specific kod gerekli
    let total_vram_gb = if cfg!(feature = "cuda") || cfg!(feature = "vulkan") {
        // GPU var - ancak gerçek VRAM alamıyoruz, bu nedenle bir tahmin yap
        // NVIDIA için nvidia-smi, AMD için rocm-smi, Intel için level-zero kullanılabilir
        // Şimdilik 12GB varsayılan (değiştirilebilir)
        let detected_vram = detect_gpu_vram();
        detected_vram
    } else {
        // GPU yok - sistem RAM'ını kullan (CPU mode)
        let total_memory_bytes = sys.total_memory();
        let total_memory_gb = total_memory_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        total_memory_gb * 0.7 // CPU mode için %70'ini kullan
    };
    
    let _free_vram_gb = if cfg!(feature = "cuda") || cfg!(feature = "vulkan") {
        total_vram_gb // GPU serbest bellek - tahmin yap
    } else {
        let available_memory_bytes = sys.available_memory();
        let available_memory_gb = available_memory_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        available_memory_gb * 0.7
    };
    
    // 🔥 Düzeltilmiş hesaplamalar
    // Model size: Q4 quantization için ~0.5-0.6 GB per billion parameters
    // 7B model Q4 = ~4.2 GB
    let estimated_model_size = 4.2; // GB
    
    // KV Cache hesaplama (daha doğru):
    // KV cache = 2 (K + V) * n_layers * n_ctx * hidden_size * bytes_per_element / 1e9
    // Qwen 7B: 28 layers, 4096 hidden_size, fp16 = 2 bytes
    let n_layers = n_gpu_layers.min(28) as f64; // Maksimum 28 layer
    let hidden_size = 4096.0;
    let bytes_per_element = 2.0; // fp16
    
    let kv_cache_gb = (2.0 * n_layers * n_ctx as f64 * hidden_size * bytes_per_element) / 1_000_000_000.0;
    
    let used_vram = estimated_model_size + kv_cache_gb;
    let safe_used_vram = used_vram.min(total_vram_gb);
    let safe_free_vram = (total_vram_gb - safe_used_vram).max(0.0); // Negatif olmasın
    let usage_percent = ((safe_used_vram / total_vram_gb) * 100.0).min(100.0); // Max %100
    
    info!("📊 GPU Memory: {:.1} GB / {:.1} GB ({:.1}%)", safe_used_vram, total_vram_gb, usage_percent);
    info!("   Model: {:.1} GB, KV Cache: {:.1} GB", estimated_model_size, kv_cache_gb);
    
    Ok(json!({
        "available": true,
        "total_vram_gb": total_vram_gb,
        "used_vram_gb": safe_used_vram,
        "free_vram_gb": safe_free_vram,
        "usage_percent": usage_percent,
        "model_size_gb": estimated_model_size,
        "kv_cache_size_gb": kv_cache_gb
    }))
}

/// GPU VRAM bilgisini algıla (platform-specific) (FIX-27)
fn detect_gpu_vram() -> f64 {
    // 🎮 NVIDIA GPU - nvidia-smi ile kontrol et
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .args(&["--query-gpu=memory.total", "--format=csv,noheader,nounits"])
        .output()
    {
        if output.status.success() {
            if let Ok(output_str) = String::from_utf8(output.stdout) {
                if let Ok(vram_mb) = output_str.trim().parse::<f64>() {
                    let vram_gb = vram_mb / 1024.0;
                    info!("🎮 NVIDIA GPU VRAM algılandı: {:.1} GB", vram_gb);
                    return vram_gb;
                }
            }
        }
    }

    // 🍎 Apple Silicon - Mac'lerde genelde unified memory var
    #[cfg(target_os = "macos")]
    {
        use sysinfo::{System, SystemExt};
        let mut sys = System::new_all();
        sys.refresh_all();
        let total_ram_gb = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
        info!("🍎 Apple Silicon: Unified Memory {:.1} GB kullanılıyor", total_ram_gb * 0.75);
        return total_ram_gb * 0.75; // Genelde %75'i GPU'ya ayrılabilir
    }

    // 🖥️ Fallback: Sistem RAM'inin %50'sini kullan (VRAM yoksa)
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();
    let total_ram_gb = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let fallback_ram = (total_ram_gb * 0.5).max(4.0);
    info!("⚠️ GPU bulunamadı. Sistem RAM'i yedek olarak kullanılıyor: {:.1} GB", fallback_ram);
    fallback_ram
}

// 🆕 GGUF Metadata Okuyucu
// 🆕 GGUF Metadata Okuyucu - Gerçek Binary Okuma Entegrasyonu
#[tauri::command]
pub async fn read_gguf_metadata(path: String) -> Result<serde_json::Value, String> {
    use std::io::Read;
    use std::fs::File;

    info!("📖 Gerçek GGUF metadata okuma başlatıldı: {}", path);

    let mut file = File::open(&path).map_err(|e| format!("Dosya açılamadı: {}", e))?;

    // GGUF magic: 0x47 0x47 0x55 0x46 ("GGUF")
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic).map_err(|e| format!("Magic bytes okunamadı: {}", e))?;

    if &magic != b"GGUF" {
        return Err("Geçersiz GGUF dosyası (magic bytes yanlış)".to_string());
    }

    // Version (uint32 LE)
    let mut version_bytes = [0u8; 4];
    file.read_exact(&mut version_bytes).map_err(|e| e.to_string())?;
    let version = u32::from_le_bytes(version_bytes);

    // tensor_count (uint64 LE)
    let mut tc_bytes = [0u8; 8];
    file.read_exact(&mut tc_bytes).map_err(|e| e.to_string())?;
    let tensor_count = u64::from_le_bytes(tc_bytes);

    // metadata_kv_count (uint64 LE)
    let mut kvc_bytes = [0u8; 8];
    file.read_exact(&mut kvc_bytes).map_err(|e| e.to_string())?;
    let kv_count = u64::from_le_bytes(kvc_bytes);

    let mut metadata = serde_json::Map::new();
    metadata.insert("gguf_version".to_string(), version.into());
    metadata.insert("tensor_count".to_string(), tensor_count.into());
    metadata.insert("kv_count".to_string(), kv_count.into());

    // KV çiftlerini oku (ilk 200 tanesi - güvenlik için)
    for _ in 0..kv_count.min(200) {
        let key = match read_gguf_string(&mut file) {
            Ok(k) => k,
            Err(_) => break,
        };

        let mut vtype_bytes = [0u8; 4];
        if file.read_exact(&mut vtype_bytes).is_err() { break; }
        let vtype = u32::from_le_bytes(vtype_bytes);

        let value = match read_gguf_value(&mut file, vtype) {
            Ok(v) => v,
            Err(_) => serde_json::Value::Null,
        };
        
        metadata.insert(key, value);
    }

    // Dosya boyutunu ekle
    let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    metadata.insert("file_size_gb".to_string(), (file_size as f64 / 1_073_741_824.0).into());

    info!("✅ GGUF metadata başarıyla okundu");
    Ok(serde_json::Value::Object(metadata))
}

fn read_gguf_string(file: &mut std::fs::File) -> Result<String, String> {
    use std::io::Read;
    let mut len_bytes = [0u8; 8];
    file.read_exact(&mut len_bytes).map_err(|e| e.to_string())?;
    let len = u64::from_le_bytes(len_bytes) as usize;
    if len > 4096 { return Err("String çok uzun".to_string()); }
    let mut buf = vec![0u8; len];
    file.read_exact(&mut buf).map_err(|e| e.to_string())?;
    String::from_utf8(buf).map_err(|e| e.to_string())
}

fn read_gguf_value(file: &mut std::fs::File, vtype: u32) -> Result<serde_json::Value, String> {
    use std::io::Read;
    match vtype {
        0 => { // UINT8
            let mut b = [0u8; 1]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(b[0].into())
        }
        4 => { // UINT32
            let mut b = [0u8; 4]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(u32::from_le_bytes(b).into())
        }
        5 => { // INT32
            let mut b = [0u8; 4]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(i32::from_le_bytes(b).into())
        }
        6 => { // FLOAT32
            let mut b = [0u8; 4]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(f32::from_le_bytes(b).into())
        }
        7 => { // BOOL
            let mut b = [0u8; 1]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok((b[0] != 0).into())
        }
        8 => { // STRING
            Ok(read_gguf_string(file)?.into())
        }
        10 => { // UINT64
            let mut b = [0u8; 8]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(u64::from_le_bytes(b).into())
        }
        9 => { // ARRAY
            let mut type_bytes = [0u8; 4]; 
            file.read_exact(&mut type_bytes).map_err(|e| e.to_string())?;
            let _subtype = u32::from_le_bytes(type_bytes);
            let mut len_bytes = [0u8; 8];
            file.read_exact(&mut len_bytes).map_err(|e| e.to_string())?;
            let _len = u64::from_le_bytes(len_bytes);
            // Dizileri şimdilik pas geçiyoruz (header okumak yetiyor)
            Ok(serde_json::Value::String("[Array]".to_string()))
        }
        _ => Ok(serde_json::Value::Null),
    }
}


// 🆕 Vision AI Support - Chat with images
#[tauri::command]
pub async fn chat_with_gguf_vision(
    state: State<'_, Arc<Mutex<GgufState>>>,
    model_path: String, // 🆕 Model path required
    prompt: String,
    images: Vec<String>, // Base64 encoded images
    max_tokens: u32,
    temperature: f32,
) -> Result<String, String> {
    info!("📷 Starting vision inference...");
    
    // 🆕 Get model and backend from pool with minimum lock time
    let (_loaded_model, _backend) = {
        let guard = match state.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        
        let model = guard.models.get(&model_path)
            .cloned()
            .ok_or_else(|| format!("Vision model pool'da bulunamadı: {}", model_path))?;
            
        let backend = guard.backend.as_ref()
            .cloned()
            .ok_or_else(|| "Backend not initialized".to_string())?;
            
        (model, backend)
    };
    
    // Decode base64 images (validation only for now)
    let mut decoded_images = Vec::new();
    for (idx, img_data) in images.iter().enumerate() {
        // Remove data:image/...;base64, prefix if present
        let base64_data = if img_data.contains("base64,") {
            img_data.split("base64,").nth(1).unwrap_or(img_data)
        } else {
            img_data
        };
        
        match general_purpose::STANDARD.decode(base64_data) {
            Ok(bytes) => {
                decoded_images.push(bytes);
            }
            Err(e) => {
                error!("❌ Failed to decode image {}: {:?}", idx, e);
                return Err(format!("Failed to decode image {}: {:?}", idx, e));
            }
        }
    }
    
    info!("✅ All images decoded successfully");
    
    // TODO: Full vision implementation
    // 1. Load mmproj file (vision encoder)
    // 2. Convert images to embeddings using mmproj
    // 3. Combine text prompt + image embeddings
    // 4. Pass to model for inference
    
    // For now, fall back to text-only chat with a note about images
    info!("⚠️ Vision support not fully implemented yet");
    info!("📝 Falling back to text-only mode with image count note");
    
    let vision_prompt = format!(
        "[System: User sent {} image(s) but vision processing is not yet implemented. Please acknowledge the images and respond based on the text prompt.]\n\n{}",
        images.len(),
        prompt
    );
    
    // Use the existing text chat function
    chat_with_gguf_model(state, model_path, vision_prompt, max_tokens, temperature).await
}

// Check if CUDA is available
#[tauri::command]
pub fn check_cuda_support() -> Result<serde_json::Value, String> {
    let cuda_available = cfg!(feature = "cuda");
    let vulkan_available = cfg!(feature = "vulkan");
    
    let backend = if cuda_available {
        "CUDA"
    } else if vulkan_available {
        "Vulkan"
    } else {
        "CPU"
    };
    
    info!("🔍 GPU Backend Check:");
    info!("  - Current Backend: {}", backend);
    info!("  - CUDA Available: {}", cuda_available);
    info!("  - Vulkan Available: {}", vulkan_available);
    
    Ok(json!({
        "backend": backend,
        "cuda_available": cuda_available,
        "vulkan_available": vulkan_available,
        "recommended_gpu_layers": if cuda_available || vulkan_available { 28 } else { 0 },
        "cuda_download_url": "https://developer.nvidia.com/cuda-downloads",
        "message": match backend {
            "CUDA" => "CUDA enabled. Maximum performance on NVIDIA GPUs.",
            "Vulkan" => "Vulkan enabled. Works on all GPUs (NVIDIA, AMD, Intel).",
            _ => "CPU-only mode. For GPU support, enable CUDA or Vulkan."
        }
    }))
}

/// Split GGUF dosyalarini tespit edip ilk parcaya yonlendirir.
/// Ornek: "model-00003-of-00004.gguf" -> "model-00001-of-00004.gguf"
/// Tek parca dosyalarda ayni yolu dondurur.
fn resolve_split_gguf_path(path: &str) -> String {
    let re = regex::Regex::new(r"(-\d{5})-of-(\d{5})\.gguf$").ok();
    if let Some(re) = re {
        if let Some(caps) = re.captures(path) {
            let total = caps[2].to_string();
            let first_part = format!("-00001-of-{}.gguf", total);
            let resolved = re.replace(path, first_part.as_str()).to_string();
            if resolved != path {
                info!("🔀 Split GGUF detected: redirecting to first shard");
                info!("   Original: {}", path);
                info!("   Resolved: {}", resolved);
                
                let total_num: u32 = total.parse().unwrap_or(1);
                for i in 1..=total_num {
                    let part_path = re.replace(path, format!("-{:05}-of-{}.gguf", i, total).as_str()).to_string();
                    if !Path::new(&part_path).exists() {
                        warn!("⚠️ Missing split part: {}", part_path);
                    }
                }
            }
            return resolved;
        }
    }
    path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_split_gguf_path() {
        assert_eq!(resolve_split_gguf_path("test.gguf"), "test.gguf");
        assert_eq!(resolve_split_gguf_path("model-00001-of-00005.gguf"), "model-00001-of-00005.gguf");
        assert_eq!(resolve_split_gguf_path("model-00003-of-00005.gguf"), "model-00001-of-00005.gguf");
    }
}


