use log::error;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct DebugLog {
    pub level: String,
    pub message: String,
    pub timestamp: u64,
    pub file: Option<String>,
    pub line: Option<u32>,
}

pub struct ProcessMonitor {
    app_handle: AppHandle,
}

impl ProcessMonitor {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Broadcast a filtered log to the frontend
    pub fn emit_log(&self, log: DebugLog) {
        // Emit event to frontend
        if let Err(e) = self.app_handle.emit("debug-log-event", log) {
            error!("Failed to emit debug log event: {}", e);
        }
    }

    /// A simple heuristic to detect errors in strings (e.g., terminal output)
    pub fn monitor_output(&self, output: &str) {
        let output_lower = output.to_lowercase();

        // Only broadcast if it looks like an error/warning
        if output_lower.contains("error:")
            || output_lower.contains("failed")
            || output_lower.contains("exception")
        {
            let log = DebugLog {
                level: "error".to_string(),
                message: output.to_string(),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                file: None, // Hard to detect without regex parsing
                line: None,
            };
            self.emit_log(log);
        }
    }
}

// Global state for ProcessMonitor if needed
#[derive(Clone)]
pub struct MonitorState(pub Arc<Mutex<Option<ProcessMonitor>>>);
