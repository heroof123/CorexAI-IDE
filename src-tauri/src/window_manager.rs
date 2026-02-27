use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub async fn open_new_window(
    app: AppHandle,
    path: Option<String>,
    label: Option<String>,
) -> Result<(), String> {
    // Generate unique label if not provided
    let label = label.unwrap_or_else(|| {
        let start = SystemTime::now();
        let since_the_epoch = start
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards");
        format!("win-{}", since_the_epoch.as_millis())
    });

    // Default to index.html if path not provided
    let url_str = path.unwrap_or_else(|| "index.html".to_string());
    let url = WebviewUrl::App(url_str.into());

    println!("🪟 Opening new window: {} ({})", label, url.to_string());

    // Create the window
    // Note: In Tauri v2, we use WebviewWindowBuilder
    let builder = WebviewWindowBuilder::new(&app, &label, url)
        .title("Corex AI")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .focused(true)
        .decorations(false) // Corex style custom titlebar
        .transparent(true);

    match builder.build() {
        Ok(_) => {
            println!("✅ Window created successfully: {}", label);
            Ok(())
        },
        Err(e) => {
            println!("❌ Failed to create window: {}", e);
            Err(format!("Failed to create window: {}", e))
        }
    }
}
