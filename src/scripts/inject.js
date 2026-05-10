/**
 * Linnote — Master injection script
 * Injected into the OneNote webview via initialization_script().
 * Runs on every top-level navigation; domain guard ensures it only activates on OneNote pages.
 */
(function () {
  "use strict";

  // Domain guard: only inject OneNote-specific features on OneNote/Office domains
  const host = window.location.hostname;
  const isOneNote =
    host.includes("onenote.com") ||
    host.includes("onenote.officeapps.live.com") ||
    host.includes("office.com") ||
    host.includes("office.net");

  if (!isOneNote) return;

  // ============================================================
  // 1. Notification passthrough — route web notifications to native
  // ============================================================
  (function setupNotifications() {
    const OriginalNotification = window.Notification;

    window.Notification = function (title, options = {}) {
      // Forward to Tauri native notification system
      if (window.__TAURI_INTERNALS__) {
        try {
          window.__TAURI_INTERNALS__.invoke("plugin:notification|notify", {
            title: title,
            body: options.body || "",
          });
        } catch (e) {
          console.warn("[Linnote] Failed to send native notification:", e);
        }
      }

      // Also create the original web notification for OneNote's internal tracking
      try {
        return new OriginalNotification(title, options);
      } catch (e) {
        return {};
      }
    };

    // Preserve static properties
    window.Notification.permission = "granted";
    window.Notification.requestPermission = async () => "granted";
    window.Notification.maxActions = OriginalNotification.maxActions || 0;
  })();

  // ============================================================
  // 2. Theme detection — watch for system and OneNote theme changes
  // ============================================================
  (function setupThemeDetection() {
    function emitTheme(theme) {
      if (window.__TAURI_INTERNALS__) {
        try {
          window.__TAURI_INTERNALS__.invoke("plugin:event|emit", {
            event: "theme-changed",
            payload: theme,
          });
        } catch (e) {
          // Silently fail — theme is non-critical
        }
      }
    }

    // Watch system preference
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", (e) => {
      emitTheme(e.matches ? "dark" : "light");
    });

    // Emit initial theme
    emitTheme(mq.matches ? "dark" : "light");

    // Watch for OneNote-specific theme class changes on the document root
    const observer = new MutationObserver(() => {
      const isDark =
        document.documentElement.classList.contains("dark") ||
        document.body?.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark";
      emitTheme(isDark ? "dark" : "light");
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
    }

    // Also observe body once available
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        if (document.body) {
          observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"],
          });
        }
      });
    }
  })();

  // ============================================================
  // 3. External link interception — safety net for target="_blank"
  // ============================================================
  (function setupLinkInterception() {
    document.addEventListener(
      "click",
      (e) => {
        const link = e.target.closest("a[href]");
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:"))
          return;

        try {
          const url = new URL(href, window.location.origin);
          const linkHost = url.hostname;

          // Check if this is an external link
          const isAllowed =
            linkHost.includes("onenote.com") ||
            linkHost.includes("microsoft.com") ||
            linkHost.includes("microsoftonline.com") ||
            linkHost.includes("live.com") ||
            linkHost.includes("office.com") ||
            linkHost.includes("office.net") ||
            linkHost.includes("sharepoint.com") ||
            linkHost.includes("onedrive.com");

          if (!isAllowed && link.target === "_blank") {
            e.preventDefault();
            e.stopPropagation();
            // Open in system browser via Tauri
            if (window.__TAURI_INTERNALS__) {
              window.__TAURI_INTERNALS__.invoke("plugin:opener|open_url", {
                url: url.href,
              });
            }
          }
        } catch (err) {
          // Invalid URL, let it pass through
        }
      },
      true
    );
  })();

  // ============================================================
  // 4. Keyboard shortcut overrides
  // ============================================================
  (function setupKeyboardOverrides() {
    document.addEventListener("keydown", (e) => {
      // Ctrl+F → trigger OneNote's search (Ctrl+E)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        // Simulate Ctrl+E which OneNote uses for search
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "e",
            code: "KeyE",
            ctrlKey: true,
            bubbles: true,
          })
        );
      }
    });
  })();

  console.log("[Linnote] Injection loaded successfully");
})();
