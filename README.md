<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Linnote" width="80" />
</p>

<h1 align="center">Linnote</h1>

<p align="center">
  A lightweight, native desktop client for Microsoft OneNote on Linux.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#building-from-source">Build</a> •
  <a href="#configuration">Config</a> •
  <a href="#keyboard-shortcuts">Shortcuts</a>
</p>

---

## Why?

Microsoft doesn't ship a OneNote client for Linux. Your options are a browser tab buried among dozens of others, or abandoned Electron wrappers weighing 200MB+. Linnote wraps OneNote Web in a proper desktop app — system tray, keyboard shortcuts, native notifications — at a fraction of the size, powered by [Tauri v2](https://v2.tauri.app).

## Features

- **Full OneNote Web** — notebooks, sections, pages, real-time sync, everything
- **Personal & school/org accounts** — works with Microsoft, Entra ID, and federated SSO (ADFS, SAML) for education tenants
- **System tray** — minimize to tray, quick show/hide, background running
- **Native notifications** — OneNote web notifications forwarded to your desktop notification daemon
- **Keyboard shortcuts** — Ctrl+Q quit, Ctrl+H hide to tray, zoom controls, back/forward navigation
- **Window state persistence** — remembers your window size and position across restarts
- **Session persistence** — stay logged in between launches
- **External link handling** — non-Microsoft links open in your default browser
- **Dark mode detection** — follows system and OneNote theme preferences
- **Protocol handler** — registers `onenote://` URI scheme
- **Single instance** — second launch focuses the existing window
- **Configurable close behavior** — choose between minimize-to-tray or quit on close
- **Lightweight** — ~10MB bundled, minimal memory footprint

## Installation

### Pre-built packages (Linux)

Download the latest release for your distribution:

| Format | For |
|--------|-----|
| `.AppImage` | Any Linux distro |
| `.deb` | Debian, Ubuntu, Pop!_OS, etc. |
| `.rpm` | Fedora, openSUSE, RHEL, etc. |

> Releases are built via GitHub Actions — check the [Releases](../../releases) page.

### From source

See [Building from source](#building-from-source) below.

## Building from source

### Prerequisites

**Linux:**
```bash
# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg
```

**All platforms:**
- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (v18+)

### Build & run

```bash
# Install JS dependencies
npm install

# Development (hot reload)
npm run tauri dev

# Production build
npm run tauri build
```

Bundled packages will be in `src-tauri/target/release/bundle/`.

## Configuration

Settings are accessible from the **system tray → Settings**, or stored in:

| Platform | Path |
|----------|------|
| Linux | `~/.local/share/com.linnote.app/settings.json` |
| Windows | `%APPDATA%/com.linnote.app/settings.json` |

### Available settings

| Setting | Default | Description |
|---------|---------|-------------|
| `close_to_tray` | `true` | Hide to tray instead of quitting on close |
| `start_minimized` | `false` | Launch hidden in the system tray |
| `theme` | `"system"` | `"system"`, `"light"`, or `"dark"` |
| `zoom_level` | `1.0` | Page zoom (0.25 – 5.0) |
| `start_url` | — | Custom OneNote URL to load on startup |

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Q` | Quit |
| `Ctrl+H` | Hide to tray |
| `Ctrl++` / `Ctrl+-` | Zoom in / out |
| `Ctrl+0` | Reset zoom |
| `Ctrl+F` | Search (maps to OneNote's search) |

## Architecture

```
src-tauri/src/
├── lib.rs          # Entry point — plugin & command registration
├── setup.rs        # Window creation, injection, tray, shortcuts
├── tray.rs         # System tray menu and events
├── config.rs       # Allowed domains, URL validation
└── commands/       # Tauri IPC commands
    ├── navigation  #   back, forward, navigate
    ├── window      #   zoom get/set
    └── settings    #   generic key-value store
```

The main webview loads `onenote.com` directly (not in an iframe). A [JavaScript injection script](src/scripts/inject.js) handles notification passthrough, theme detection, external link interception, and keyboard overrides. Navigation is restricted to Microsoft domains + federated SSO endpoints to keep things secure.

## School & organization accounts

Linnote supports Microsoft Entra ID (formerly Azure AD) and federated identity providers used by schools and organizations. The auth flow — including ADFS, SAML, and custom SSO portals — is handled transparently in the webview. SharePoint-hosted notebooks (e.g. `yourschool.sharepoint.com`) work out of the box.

## License

[MIT](LICENSE)
