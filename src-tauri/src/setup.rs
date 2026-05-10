use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

use crate::config;
use crate::tray;

/// Combined injection script for the OneNote webview.
/// Individual scripts are embedded at compile time and concatenated.
const INJECT_JS: &str = include_str!("../../src/scripts/inject.js");

pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();

    // Create system tray
    tray::create_tray(&handle)?;

    // Load persisted settings
    let start_url = get_start_url(&handle);
    let zoom_level = get_zoom_level(&handle);
    let start_minimized = get_bool_setting(&handle, "start_minimized", false);

    // Build the main window programmatically so we can attach
    // initialization_script and on_navigation handlers
    let url = WebviewUrl::External(start_url.parse().unwrap_or_else(|_| {
        config::DEFAULT_URL.parse().unwrap()
    }));

    let mut builder = WebviewWindowBuilder::new(app, "main", url)
        .title("LinNote")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .user_agent(config::APP_USER_AGENT)
        .zoom_hotkeys_enabled(true)
        .initialization_script(INJECT_JS)
        .on_navigation(|url| {
            let allowed = config::is_allowed_domain(&url);
            let host = url.host_str().unwrap_or("(no host)");
            if allowed {
                eprintln!("[Linnote] Nav allowed: {} -> {}", host, url);
            } else {
                eprintln!("[Linnote] Nav BLOCKED: {} -> {}", host, url);
            }
            allowed
        });

    // Only set visible if not starting minimized
    if start_minimized {
        builder = builder.visible(false);
    }

    let main_window = builder.build()?;

    // Linux: allow third-party cookies so Microsoft silent auth (iframe-based
    // token refresh) doesn't get stuck in an infinite "We couldn't sign you in" loop.
    #[cfg(target_os = "linux")]
    {
        use webkit2gtk::{
            CookieAcceptPolicy, CookieManagerExt, WebContextExt, WebViewExt,
            WebsiteDataManagerExt,
        };
        let _ = main_window.with_webview(|webview| {
            let wv = webview.inner();
            if let Some(context) = wv.web_context() {
                if let Some(data_manager) = context.website_data_manager() {
                    if let Some(cookie_manager) = data_manager.cookie_manager() {
                        cookie_manager.set_accept_policy(CookieAcceptPolicy::Always);
                        eprintln!("[Linnote] Linux: cookie accept policy set to Always");
                    }
                }
            }
        });
    }

    // Restore zoom level if not default
    if (zoom_level - 1.0).abs() > f64::EPSILON {
        let zoom = zoom_level;
        let win = main_window.clone();
        tauri::async_runtime::spawn_blocking(move || {
            // Small delay to let the page start loading
            std::thread::sleep(std::time::Duration::from_millis(500));
            let _ = win.eval(&format!(
                "document.documentElement.style.zoom = '{}'",
                zoom
            ));
        });
    }

    // Handle close-to-tray behavior
    let handle_clone = handle.clone();
    main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let close_to_tray = get_bool_setting(&handle_clone, "close_to_tray", true);
            if close_to_tray {
                // Hide instead of closing
                api.prevent_close();
                if let Some(win) = handle_clone.get_webview_window("main") {
                    let _ = win.hide();
                }
            }
            // If close_to_tray is false, let the default close behavior happen
        }
    });

    // Register global keyboard shortcuts
    register_shortcuts(&handle)?;

    Ok(())
}

fn get_start_url(app: &AppHandle) -> String {
    if let Ok(store) = app.store("settings.json") {
        if let Some(url) = store.get("start_url") {
            if let Some(s) = url.as_str() {
                if !s.is_empty() {
                    return s.to_string();
                }
            }
        }
    }
    config::DEFAULT_URL.to_string()
}

fn get_zoom_level(app: &AppHandle) -> f64 {
    if let Ok(store) = app.store("settings.json") {
        if let Some(val) = store.get("zoom_level") {
            return val.as_f64().unwrap_or(1.0);
        }
    }
    1.0
}

fn get_bool_setting(app: &AppHandle, key: &str, default: bool) -> bool {
    if let Ok(store) = app.store("settings.json") {
        if let Some(val) = store.get(key) {
            return val.as_bool().unwrap_or(default);
        }
    }
    default
}

fn register_shortcuts(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    let handle = app.clone();

    app.global_shortcut().on_shortcut("ctrl+q", move |_app, _shortcut, _event| {
        handle.exit(0);
    })?;

    let handle = app.clone();
    app.global_shortcut().on_shortcut("ctrl+h", move |_app, _shortcut, _event| {
        if let Some(window) = handle.get_webview_window("main") {
            let _ = window.hide();
        }
    })?;

    Ok(())
}
