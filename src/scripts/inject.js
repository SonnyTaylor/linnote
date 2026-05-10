/**
 * Linnote — Master injection script
 * Injected into the OneNote webview via initialization_script().
 * Runs on every top-level navigation; domain guard ensures it only activates on OneNote pages.
 */
(function () {
  "use strict";

  // ============================================================
  // 0. Custom title bar (Linux frameless window chrome)
  // ============================================================
  (function setupCustomTitleBar() {
    const invoke = window.__TAURI_INTERNALS__?.invoke;
    if (!invoke) return;

    const host = window.location.hostname.toLowerCase();
    const isMs = [
      "microsoft",
      "live.com",
      "onenote",
      "office",
      "sharepoint",
      "onedrive",
      "outlook",
      "windows.net",
      "msauth",
      "msftauth",
      "aadcdn",
    ].some((d) => host.includes(d));
    if (!isMs) return;

    const BAR_HEIGHT = 30;

    function inject() {
      if (document.getElementById("linnote-titlebar")) return;
      if (!document.body) {
        setTimeout(inject, 50);
        return;
      }

      const style = document.createElement("style");
      style.textContent = `
        #linnote-titlebar {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: ${BAR_HEIGHT}px;
          background: #1e1e2e;
          color: #cdd6f4;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px 0 14px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 12px;
          user-select: none;
          -webkit-user-select: none;
          border-bottom: 1px solid #313244;
          box-sizing: border-box;
        }
        #linnote-titlebar .tb-drag {
          flex: 1;
          display: flex;
          align-items: center;
          height: 100%;
          padding-left: 6px;
        }
        #linnote-titlebar .tb-title {
          font-weight: 600;
          color: #cba6f7;
          letter-spacing: 0.4px;
        }
        #linnote-titlebar .tb-controls {
          display: flex;
          gap: 2px;
          margin-right: -4px;
        }
        #linnote-titlebar .tb-btn {
          width: 34px;
          height: 22px;
          border: none;
          background: transparent;
          color: #a6adc8;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.12s, color 0.12s;
          line-height: 1;
          padding: 0;
        }
        #linnote-titlebar .tb-btn:hover {
          background: #313244;
          color: #cdd6f4;
        }
        #linnote-titlebar .tb-btn.close:hover {
          background: #f38ba8;
          color: #1e1e2e;
        }
      `;
      document.head.appendChild(style);

      const bar = document.createElement("div");
      bar.id = "linnote-titlebar";
      bar.setAttribute("data-tauri-drag-region", "");

      const drag = document.createElement("div");
      drag.className = "tb-drag";
      drag.innerHTML = '<span class="tb-title">◆ LinNote</span>';
      bar.appendChild(drag);

      const controls = document.createElement("div");
      controls.className = "tb-controls";

      const mkBtn = (cls, label, title, cmd) => {
        const b = document.createElement("button");
        b.className = "tb-btn" + (cls ? " " + cls : "");
        b.innerHTML = label;
        b.title = title;
        b.onclick = (e) => {
          e.stopPropagation();
          invoke(cmd);
        };
        return b;
      };

      controls.appendChild(mkBtn("", "−", "Minimize", "window_minimize"));
      controls.appendChild(mkBtn("", "□", "Maximize", "window_toggle_maximize"));
      controls.appendChild(mkBtn("close", "×", "Close", "window_close"));
      bar.appendChild(controls);

      document.body.appendChild(bar);

      bar.addEventListener("dblclick", (e) => {
        if (e.target.closest(".tb-controls")) return;
        invoke("window_toggle_maximize");
      });

      const existing =
        parseInt(window.getComputedStyle(document.body).paddingTop, 10) || 0;
      document.body.style.paddingTop = existing + BAR_HEIGHT + "px";

      console.log("[Linnote] Custom title bar active");
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", inject);
    } else {
      inject();
    }
  })();

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
