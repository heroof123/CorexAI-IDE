// src-tauri/src/lib.rs

// This is the library entry point for Tauri 2.x
// The main.rs file will call run() from here

pub mod collab;
pub mod commands;
pub mod docker;
pub mod gguf;
pub mod git_commands;
pub mod mcp;
pub mod oauth;
pub mod oauth_backend;
pub mod process_monitor;
pub mod rag_pipeline;
pub mod remote;
pub mod streaming;
pub mod tree_sitter_parser;
pub mod vector_db;
pub mod window_manager;

pub mod main_module {
    pub use crate::commands::*;
    pub use crate::oauth::*;
    pub use crate::oauth_backend::*;
}
