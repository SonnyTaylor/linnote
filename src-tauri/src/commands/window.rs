use tauri::{AppHandle, WebviewWindow};
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub async fn set_zoom(app: AppHandle, window: WebviewWindow, level: f64) -> Result<(), String> {
    let clamped = level.clamp(0.25, 5.0);
    window
        .eval(&format!(
            "document.documentElement.style.zoom = '{}'",
            clamped
        ))
        .map_err(|e| e.to_string())?;

    // Persist zoom level
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("zoom_level", serde_json::json!(clamped));
    Ok(())
}

#[tauri::command]
pub async fn get_zoom(app: AppHandle) -> Result<f64, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store
        .get("zoom_level")
        .and_then(|v| v.as_f64())
        .unwrap_or(1.0))
}
