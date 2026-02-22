// src-tauri/src/main.rs

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod collab; // 🆕 WebSocket collaboration
mod commands;
mod gguf;
mod mcp;
mod oauth;
mod oauth_backend;
mod rag_pipeline;
mod streaming;
mod tree_sitter_parser;

mod vector_db; // 🆕 MCP (Model Context Protocol)
mod window_manager; // 🆕 Low-level window management

use commands::{
    // RAG Pipeline commands
    analyze_query_intent,
    build_rag_context,
    chat_with_ai,
    chat_with_dynamic_ai,
    chat_with_specific_ai,
    clear_ast_cache,
    close_window,
    create_embedding_bge,
    create_file,
    delete_file_index,
    download_gguf_model,
    execute_terminal_command,
    get_all_files,
    git_log_project,
    index_file_vector,
    index_manual_vector,
    // Vector DB commands
    init_vector_db,
    invalidate_file_cache,
    list_plugins,
    maximize_window,
    minimize_window,
    open_terminal,
    // Tree-sitter Parser commands
    parse_file_ast,
    read_file,
    read_file_content,
    scan_project,
    test_project,
    vector_search,
    write_file,
};

use gguf::{
    chat_with_gguf_model,
    chat_with_gguf_vision, // 🆕 Vision AI
    check_cuda_support,
    get_gguf_model_status,
    get_gpu_memory_info,
    load_gguf_model,
    read_gguf_metadata,
    unload_gguf_model,
    GgufState,
};

use mcp::{list_mcp_servers, send_mcp_request, start_mcp_server, stop_mcp_server, McpState};

use oauth::oauth_authenticate;
use oauth_backend::{exchange_oauth_token, refresh_oauth_token};
use streaming::{chat_with_http_streaming, chat_with_streaming};

use std::sync::{Arc, Mutex};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    // 🎯 CUDA Kernel Cache - Prevent recompilation
    #[cfg(feature = "cuda")]
    {
        std::env::set_var("CUDA_CACHE_DISABLE", "0"); // Enable cache
        std::env::set_var("CUDA_CACHE_MAXSIZE", "4294967296"); // 4GB cache
        std::env::set_var("CUDA_FORCE_PTX_JIT", "0"); // Disable JIT compilation
        log::info!("🎮 CUDA cache enabled - kernels will be cached");
    }

    // GGUF state oluştur
    let gguf_state = Arc::new(Mutex::new(GgufState::default()));
    // MCP state oluştur
    let mcp_state = McpState::default();

    tauri::Builder::default()
        .manage(gguf_state.clone())
        .manage(mcp_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            scan_project,
            read_file,
            write_file,
            create_file,
            chat_with_ai,
            chat_with_specific_ai,
            chat_with_dynamic_ai,
            create_embedding_bge,
            test_project,
            open_terminal,
            execute_terminal_command,
            minimize_window,
            maximize_window,
            close_window,
            commands::get_home_dir,
            commands::create_directory,
            commands::delete_file,
            commands::rename_file,
            commands::move_file,
            commands::copy_file,
            commands::get_file_metadata,
            commands::get_file_size,
            commands::git_status,
            commands::git_add,
            commands::git_commit,
            commands::git_push,
            commands::git_pull,
            commands::git_log_file,
            commands::git_log_project,
            commands::git_blame,
            commands::execute_command,
            commands::test_provider_connection, // FIX-41 backend test
            load_gguf_model,
            chat_with_gguf_model,
            chat_with_gguf_vision,
            unload_gguf_model,
            get_gguf_model_status,
            get_gpu_memory_info,
            read_gguf_metadata,
            check_cuda_support,
            download_gguf_model,
            get_all_files,
            read_file_content,
            oauth_authenticate,
            exchange_oauth_token,
            refresh_oauth_token,
            chat_with_streaming,
            chat_with_http_streaming,
            // Vector DB commands
            init_vector_db,
            vector_search,
            index_file_vector,
            index_manual_vector,
            delete_file_index,
            // RAG Pipeline commands
            analyze_query_intent,
            build_rag_context,
            // Tree-sitter Parser commands
            parse_file_ast,
            clear_ast_cache,
            invalidate_file_cache,
            // MCP commands
            start_mcp_server,
            stop_mcp_server,
            send_mcp_request,
            list_mcp_servers,
            // Window management
            window_manager::open_new_window,
            // Plugin System Beta
            list_plugins,
        ])
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Uygulama kapanırken cleanup yap
                log::info!("🔴 Window closing - cleaning up GGUF model...");

                if let Ok(mut state) = gguf_state.lock() {
                    if !state.models.is_empty() {
                        log::info!("🧹 Unloading GGUF models from pool...");
                        state.models.clear();
                        state.backend = None;
                        state.backend_initialized = false;
                        log::info!("✅ All GGUF models unloaded");
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Binary için main fonksiyonu
fn main() {
    run();
}
