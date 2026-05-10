use tauri::WebviewWindow;

use crate::performance;

#[tauri::command]
pub async fn clear_cache(window: WebviewWindow) -> Result<(), String> {
    performance::clear_cache(&window);
    Ok(())
}
