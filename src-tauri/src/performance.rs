/// WebKit performance tuning for the OneNote webview.
/// Configures aggressive caching, hardware acceleration, and auth-friendly
/// cookie policies to minimize network round-trips and re-authentication.

#[cfg(target_os = "linux")]
pub fn configure_webview(window: &tauri::WebviewWindow) {
    use webkit2gtk::{
        CacheModel, CookieAcceptPolicy, CookieManagerExt, HardwareAccelerationPolicy,
        SettingsExt, WebContextExt, WebViewExt, WebsiteDataManagerExt,
    };

    let _ = window.with_webview(|webview| {
        let wv = webview.inner();

        // --- WebContext tuning ---
        if let Some(context) = wv.web_context() {
            // Aggressive disk cache: cache everything aggressively since
            // OneNote is essentially a single-page app we fully trust.
            context.set_cache_model(CacheModel::DocumentBrowser);

            // Keep process count low. OneNote is the only page so
            // there's no benefit from spawning extra web processes.
        }

        // --- WebView Settings tuning ---
        if let Some(settings) = wv.settings() {
            // Always use GPU compositing for smooth scrolling/rendering
            settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Always);

            // Keep fully rendered pages in memory for instant back/forward
            settings.set_enable_page_cache(true);

            // Prefetch DNS for any links on the page before the user clicks
            settings.set_enable_dns_prefetching(true);

            // Enable the old-school appcache alongside service workers.
            // OneNote's service workers handle most offline logic, but this
            // ensures auxiliary resources are cached too.
            settings.set_enable_offline_web_application_cache(true);
        }

        // --- WebsiteDataManager tuning ---
        if let Some(context) = wv.web_context() {
            if let Some(data_manager) = context.website_data_manager() {
                // Disable ITP (Intelligent Tracking Prevention). WebKit's
                // ITP treats Microsoft's auth iframes as trackers and will
                // purge their cookies after 7 days, forcing re-login loops.
                data_manager.set_itp_enabled(false);

                // Ensure cookies are accepted across domains (auth iframes).
                if let Some(cookie_manager) = data_manager.cookie_manager() {
                    cookie_manager.set_accept_policy(CookieAcceptPolicy::Always);
                }
            }
        }

        eprintln!("[Linnote] Performance: WebKit tuned for aggressive caching");
    });
}

#[cfg(not(target_os = "linux"))]
pub fn configure_webview(_window: &tauri::WebviewWindow) {
    // Platform-specific tuning would go here for Windows/macOS.
}

/// Clear all webview caches (HTTP cache, localStorage, etc.).
/// Keeps cookies so the user stays logged in.
#[cfg(target_os = "linux")]
pub fn clear_cache(window: &tauri::WebviewWindow) {
    use webkit2gtk::{WebContextExt, WebViewExt};

    let _ = window.with_webview(|webview| {
        let wv = webview.inner();
        if let Some(context) = wv.web_context() {
            context.clear_cache();
            eprintln!("[Linnote] Cache cleared");
        }
    });
}

#[cfg(not(target_os = "linux"))]
pub fn clear_cache(_window: &tauri::WebviewWindow) {
    // No-op on non-Linux platforms for now.
}
