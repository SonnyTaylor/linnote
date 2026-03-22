/**
 * Linnote — Settings dialog logic
 */
(async function () {
  "use strict";

  const { invoke } = window.__TAURI_INTERNALS__;

  // Helper to get/set settings via Tauri commands
  async function getSetting(key) {
    return invoke("get_setting", { key });
  }

  async function setSetting(key, value) {
    return invoke("set_setting", { key, value });
  }

  // Elements
  const closeToTray = document.getElementById("close_to_tray");
  const startMinimized = document.getElementById("start_minimized");
  const theme = document.getElementById("theme");
  const zoomDisplay = document.getElementById("zoom_display");
  const zoomDown = document.getElementById("zoom_down");
  const zoomUp = document.getElementById("zoom_up");
  const startUrl = document.getElementById("start_url");
  const saveBtn = document.getElementById("save");
  const versionEl = document.getElementById("version");

  let currentZoom = 1.0;

  // Load current settings
  async function loadSettings() {
    const [closeTray, startMin, themeVal, zoom, url] = await Promise.all([
      getSetting("close_to_tray"),
      getSetting("start_minimized"),
      getSetting("theme"),
      getSetting("zoom_level"),
      getSetting("start_url"),
    ]);

    closeToTray.checked = closeTray !== false && closeTray !== null; // default true
    startMinimized.checked = startMin === true;
    theme.value = themeVal || "system";
    currentZoom = typeof zoom === "number" ? zoom : 1.0;
    updateZoomDisplay();
    startUrl.value = url || "";
  }

  function updateZoomDisplay() {
    zoomDisplay.textContent = Math.round(currentZoom * 100) + "%";
  }

  zoomDown.addEventListener("click", () => {
    currentZoom = Math.max(0.25, currentZoom - 0.1);
    updateZoomDisplay();
  });

  zoomUp.addEventListener("click", () => {
    currentZoom = Math.min(5.0, currentZoom + 0.1);
    updateZoomDisplay();
  });

  // Save settings
  saveBtn.addEventListener("click", async () => {
    await Promise.all([
      setSetting("close_to_tray", closeToTray.checked),
      setSetting("start_minimized", startMinimized.checked),
      setSetting("theme", theme.value),
      setSetting("zoom_level", currentZoom),
      setSetting("start_url", startUrl.value),
    ]);

    // Apply zoom to main window immediately
    await invoke("set_zoom", { level: currentZoom });

    // Close the settings window
    const { getCurrentWindow } = window.__TAURI_INTERNALS__;
    if (getCurrentWindow) {
      getCurrentWindow().close();
    }
  });

  // Show version
  versionEl.textContent = "v0.1.0";

  // Init
  await loadSettings();
})();
