<p align="center">
  <img src="https://darce.dev/logo-nav.png" alt="Darce" width="48" height="48" />
</p>

<h1 align="center">Darce</h1>

<p align="center">
  <strong>The AI coding agent that makes you smarter, not lazier.</strong>
</p>

<p align="center">
  <em>Darce (دَرْس) means "a lesson" in Arabic.</em>
</p>

<p align="center">
  <a href="https://darce.dev">Website</a> · <a href="https://github.com/AmerSarhan/darce/releases">Download</a> · <a href="#quick-start">Quick Start</a> · <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/AmerSarhan/darce?color=yellow" alt="License" />
  <img src="https://img.shields.io/github/v/release/AmerSarhan/darce?include_prereleases&label=version&color=yellow" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-yellow" alt="Platform" />
</p>

---

## The Problem

AI coding tools made us faster but dumber. We accept diffs without reading them. We ship code we can't explain. We stopped learning.

Darce is a desktop code editor with a full AI agent that builds software — and teaches you what it's doing while it works. Think of it as a senior engineer who writes your code and explains every decision.

**Open source. Local-first. Any model. Your keys.**

---

## Three Gears

You pick the depth. Switch anytime.

| | Mode | What Happens |
|---|---|---|
| **1** | **Ship** | The AI builds fast. No interruptions. You ship. |
| **2** | **Understand** | The AI builds and explains every decision. What pattern. Why. What else it considered. |
| **3** | **Learn** | The AI asks you first. Then builds, explains, and quizzes you. Spaced repetition in your workflow. |

---

## Features

**AI Agent**
- Creates files, runs terminal commands, reads your codebase, installs dependencies
- Agentic loop with tool calling — plans, executes, verifies
- Full project context in every request (file tree, open files, terminal output)

**Editor**
- Monaco (same engine as VS Code) with syntax highlighting, autocomplete, IntelliSense
- Multi-tab, file tree with search, context menus
- Ctrl+S saves to disk. All keyboard shortcuts you'd expect.

**Teaching**
- AI-powered code analysis after every action
- Concept cards with adjustable depth (Brief / Standard / Deep / ELI5)
- Interactive quizzes in Learn mode
- Understands patterns across React, CSS, TypeScript, Node.js, and more

**Platform**
- 200+ models via OpenRouter — Claude, GPT, Gemini, Llama, Grok, Kimi, and more
- ~8MB installer. Native desktop. Built with Tauri + Rust.
- Chat history saved per project. Settings persist. Last project reopens on launch.
- Bring your own API key. No account required. No data collection.

---

## Quick Start

### Download

[Download Darce](https://github.com/AmerSarhan/darce/releases/latest) — pick the installer for your platform:

| Platform | Format |
|----------|--------|
| **Windows** | `.msi` or `.exe` |
| **macOS** | `.dmg` |
| **Linux** | `.deb` or `.AppImage` |

### Build From Source

**Prerequisites:** [Node.js 18+](https://nodejs.org/), [Rust](https://rustup.rs/), C++ build tools ([Windows](https://visualstudio.microsoft.com/visual-cpp-build-tools/) / macOS: `xcode-select --install`)

```bash
git clone https://github.com/AmerSarhan/darce.git
cd darce
npm install
npm run tauri dev
```

On first launch: paste your [OpenRouter API key](https://openrouter.ai/keys). Open a folder. Start building.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust) |
| Frontend | Svelte 5, TypeScript |
| Editor | Monaco Editor |
| Styling | Tailwind CSS v4 |
| AI | OpenRouter (tool calling, SSE streaming) |

---

## What Makes Darce Different

Most AI coding tools optimize for speed. Darce optimizes for understanding.

**Teaching is built in, not bolted on.** Every file the AI writes gets broken down into concepts, patterns, and decisions — automatically.

**Model agnostic.** 200+ models through one API key. Switch mid-conversation. No vendor lock-in.

**Lightweight.** ~8MB native app. Tauri + Rust. Not Electron.

**Open source.** MIT. Fork it, extend it, own it.

---

## Roadmap

- [ ] Anthropic Direct API support
- [ ] Claude Code CLI integration (use your Claude Max/Pro subscription)
- [ ] Ollama local model support
- [ ] Git integration (status, commit, diff)
- [ ] Live browser preview
- [ ] VS Code extension (Learn mode as a standalone extension)
- [ ] Concept progress tracking across sessions
- [ ] Community concept library

See [open issues](https://github.com/AmerSarhan/darce/issues) for what's being worked on.

---

## Contributing

Contributions welcome. Check [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions. Issues labeled `good first issue` are a good starting point.

```bash
git clone https://github.com/AmerSarhan/darce.git
cd darce && npm install && npm run tauri dev
```

---

## License

[MIT](LICENSE)

<p align="center">
  <a href="https://darce.dev">darce.dev</a>
</p>
