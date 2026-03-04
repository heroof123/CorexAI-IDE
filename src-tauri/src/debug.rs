use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DebugConfig {
    pub name: String,
    pub request: String,
    pub type_: String,
    pub additional_props: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Breakpoint {
    pub id: String,
    pub path: String,
    pub line: u32,
    pub condition: Option<String>,
    pub verified: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Variable {
    pub name: String,
    pub value: String,
    pub type_: String,
    pub variables_reference: u32,
}

#[tauri::command]
pub async fn start_debug_session(_config: DebugConfig) -> Result<String, String> {
    // Şimdilik mock oturum ID'si döndürüyoruz
    Ok("session_12345".to_string())
}

#[tauri::command]
pub async fn set_breakpoint(path: String, line: u32, condition: Option<String>) -> Result<Breakpoint, String> {
    Ok(Breakpoint {
        id: format!("bp_{}_{}", path, line),
        path,
        line,
        condition,
        verified: true,
    })
}

#[tauri::command]
pub async fn remove_breakpoint(_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn debug_continue(_session_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn debug_step_over(_session_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn debug_step_into(_session_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn debug_step_out(_session_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn get_variables(_session_id: String, _frame_id: u32) -> Result<Vec<Variable>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn evaluate_expression(_session_id: String, expression: String) -> Result<String, String> {
    Ok(format!("Evaluated: {}", expression))
}
