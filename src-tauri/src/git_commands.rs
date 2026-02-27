use std::process::Command;
use log::info;

#[tauri::command]
pub async fn generate_semantic_commit_message(repo_path: String) -> Result<String, String> {
    info!("🤖 Generating semantic commit message for: {}", repo_path);
    
    // 1. Get staged diff
    let output = Command::new("git")
        .args(&["diff", "--cached"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Git diff failed: {}", e))?;
    
    let diff = String::from_utf8_lossy(&output.stdout).to_string();
    
    if diff.trim().is_empty() {
        return Err("No staged changes found to commit.".to_string());
    }

    // 2. We'll return the diff to the frontend and let the frontend call chat_with_dynamic_ai 
    // to generate the message. This keeps the prompt logic in the frontend.
    // Or we could do it here if we had access to the AI service.
    // For now, let's keep it simple and just provide the diff.
    Ok(diff)
}

#[tauri::command]
pub async fn git_create_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    info!("🌿 Creating branch: {} in {}", branch_name, repo_path);
    
    let output = Command::new("git")
        .args(&["checkout", "-b", &branch_name])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Git command failed: {}", e))?;
    
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    
    Ok(())
}

#[tauri::command]
pub async fn git_smart_commit(repo_path: String, message: String) -> Result<(), String> {
    info!("💾 Smart committing with message: {}", message);
    
    let output = Command::new("git")
        .args(&["commit", "-m", &message])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Git commit failed: {}", e))?;
    
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    
    Ok(())
}
