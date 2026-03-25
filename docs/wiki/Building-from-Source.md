# Building from Source

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Rust | latest stable | [rustup.rs](https://rustup.rs) |
| C++ build tools | — | Windows: [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), macOS: `xcode-select --install`, Linux: `sudo apt install build-essential` |

### Linux additional dependencies

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## Development

```bash
git clone https://github.com/AmerSarhan/darce.git
cd darce
npm install
npm run tauri dev
```

This starts:
- Vite dev server (frontend hot reload)
- Tauri app (Rust backend + webview)

Frontend changes hot reload instantly. Rust changes require a recompile (~5-10s).

## Production Build

```bash
npm run tauri build
```

Output:
- **Windows:** `src-tauri/target/release/bundle/msi/` and `nsis/`
- **macOS:** `src-tauri/target/release/bundle/dmg/`
- **Linux:** `src-tauri/target/release/bundle/deb/` and `appimage/`

## Release Process

Releases are automated via GitHub Actions:

1. Update version in `package.json` and `src-tauri/tauri.conf.json`
2. Commit and push
3. Create a git tag: `git tag v0.x.x && git push origin v0.x.x`
4. GitHub Actions builds for Windows, macOS (ARM + Intel), and Linux
5. Installers are uploaded to the GitHub Release automatically
