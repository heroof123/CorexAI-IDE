// src-tauri/src/main.rs

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Use modules from lib
use corex_lib::{
    collab, commands, docker, gguf, git_commands, mcp, oauth, oauth_backend, 
    remote, streaming, window_manager
};
use corex_lib::process_monitor::{ProcessMonitor, MonitorState};
use corex_lib::gguf::GgufState;
use corex_lib::collab::CollabState;
use corex_lib::mcp::McpState;

use tauri::Manager;
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
    // Collaboration state oluştur
    let collab_state = CollabState::default();
    // Process monitor state oluştur
    let monitor_state = MonitorState(Arc::new(Mutex::new(None)));

    tauri::Builder::default()
        .manage(gguf_state.clone())
        .manage(mcp_state)
        .manage(collab_state)
        .manage(monitor_state.clone())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(move |app| {
            // Initialize VectorDB synchronously on startup, or spawn an async task
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // HOTFIX: db_path'i src-tauri'nin dışına alıyoruz ki `tauri dev` watcher'ı her data yazımında backend'i baştan derlemesin.
                let db_path = "../.corex_vector_data";
                match corex_lib::vector_db::VectorDB::init(db_path).await {
                    Ok(db) => {
                        app_handle.manage(db);
                        log::info!("✅ VectorDB initialized successfully at {}", db_path);
                    }
                    Err(e) => {
                        log::error!("❌ Failed to initialize VectorDB: {}", e);
                    }
                }
            });

            // Initialize ProcessMonitor
            let mut monitor = monitor_state.0.lock().unwrap();
            *monitor = Some(ProcessMonitor::new(app.handle().clone()));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_project,
            commands::read_file,
            commands::write_file,
            commands::create_file,
            commands::chat_with_ai,
            commands::chat_with_specific_ai,
            commands::chat_with_dynamic_ai,
            commands::create_embedding_bge,
            commands::test_project,
            commands::open_terminal,
            commands::execute_terminal_command,
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window,
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
            git_commands::generate_semantic_commit_message,
            git_commands::git_create_branch,
            git_commands::git_smart_commit,
            commands::execute_command,
            commands::test_provider_connection,
            gguf::load_gguf_model,
            gguf::chat_with_gguf_model,
            gguf::chat_with_gguf_vision,
            gguf::unload_gguf_model,
            gguf::get_gguf_model_status,
            gguf::get_gpu_memory_info,
            gguf::read_gguf_metadata,
            gguf::check_cuda_support,
            commands::download_gguf_model,
            commands::get_all_files,
            commands::read_file_content,
            oauth::oauth_authenticate,
            oauth_backend::exchange_oauth_token,
            oauth_backend::refresh_oauth_token,
            streaming::chat_with_streaming,
            streaming::chat_with_http_streaming,
            // Vector DB commands
            commands::init_vector_db,
            commands::vector_search,
            commands::semantic_search,
            commands::index_file_vector,
            commands::vector_index_file,
            commands::index_manual_vector,
            commands::delete_file_index,
            // RAG Pipeline commands
            commands::analyze_query_intent,
            commands::build_rag_context,
            // Tree-sitter Parser commands
            commands::parse_file_ast,
            commands::clear_ast_cache,
            commands::invalidate_file_cache,
            // MCP commands
            mcp::start_mcp_server,
            mcp::stop_mcp_server,
            mcp::send_mcp_request,
            mcp::list_mcp_servers,
            // Window management
            window_manager::open_new_window,
            // Plugin System Beta
            commands::list_plugins,
            // Collaboration commands
            collab::create_collab_session,
            collab::start_collab_server,
            // Remote Development commands
            remote::remote_ssh_connect,
            remote::remote_ssh_list_dir,
            remote::remote_ssh_read_file,
            // Docker integration commands
            docker::docker_list_containers,
            docker::docker_list_images,
            docker::docker_container_action,
            docker::docker_remove_image,
            docker::docker_compose_action,
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
