use tauri::WebviewWindow;

use crate::config;

#[tauri::command]
pub async fn go_back(window: WebviewWindow) -> Result<(), String> {
    window
        .eval("window.history.back()")
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn go_forward(window: WebviewWindow) -> Result<(), String> {
    window
        .eval("window.history.forward()")
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn navigate_to(window: WebviewWindow, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;

    if !config::is_allowed_domain(&parsed) {
        return Err(format!("URL not in allowed domains: {}", url));
    }

    window
        .eval(&format!("window.location.href = '{}'", url))
        .map_err(|e| e.to_string())
}
