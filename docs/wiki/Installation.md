# Installation

## Download

Get the latest release from [GitHub Releases](https://github.com/AmerSarhan/darce/releases/latest).

| Platform | File | Notes |
|----------|------|-------|
| Windows | `.msi` or `.exe` | You may see a SmartScreen warning — click "More info" → "Run anyway" |
| macOS (Apple Silicon) | `.dmg` | Drag to Applications |
| macOS (Intel) | `.dmg` | Drag to Applications |
| Linux | `.deb` or `.AppImage` | `.deb` for Ubuntu/Debian, `.AppImage` for others |

## Windows SmartScreen Warning

Darce is a new app and isn't code-signed yet. Windows SmartScreen will show a warning on first install:

1. Click **"More info"**
2. Click **"Run anyway"**

This is safe — Darce is open source and you can audit the code on [GitHub](https://github.com/AmerSarhan/darce).

## Build from Source

Prerequisites:
- [Node.js 18+](https://nodejs.org/)
- [Rust](https://rustup.rs/)
- C++ build tools ([Windows](https://visualstudio.microsoft.com/visual-cpp-build-tools/) / macOS: `xcode-select --install`)

```bash
git clone https://github.com/AmerSarhan/darce.git
cd darce
npm install
npm run tauri dev
```
