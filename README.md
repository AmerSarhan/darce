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

**AI Agent v2**
- 16 tools — create, edit, read, delete, search, glob, git, browse, and more
- Smart model rotation with automatic fallback (Auto / Auto Fast / Manual)
- Parallel tool execution — independent operations run simultaneously
- Resilience engine — silent recovery from rate limits, empty responses, timeouts
- Background process manager — start, stop, restart dev servers
- Project memory — `.darce/instructions.md` and `.darce/memory.md` persist context across sessions
- Web browsing — scrape pages with CrawlRocket API, search Google, or use BrowserOS for full automation
- Git integration — status, diff, commit from the agent
- Lean context injection — minimal tokens per request for faster responses

**Editor**
- Monaco (same engine as VS Code) with syntax highlighting, autocomplete, IntelliSense
- Inline diff highlights — see exactly what the AI changed (green = added, amber = modified)
- File tree with modification flash — files glow when created or edited
- Multi-tab, context menus, Ctrl+S saves to disk

**Live Streaming UX**
- RAF-buffered token rendering — smooth 60fps text streaming, no jank
- Tool action cards with live diffs — see edit_file changes as red/green inline
- Elapsed timer + action counter in header
- Contextual status — "Analyzing results...", "Reviewing changes...", never blank
- Process control bar — see running servers, stop with one click
- GPU-accelerated animations — transform-only, 80ms tool cards, spring easing

**Teaching**
- AI-powered code analysis after every action
- Concept cards with adjustable depth (Brief / Standard / Deep / ELI5)
- Interactive quizzes in Learn mode

**Platform**
- 200+ models via OpenRouter — Kimi K2.5 (default), Claude, GPT, Gemini, Llama, Grok, and more
- Smart model rotation — tries best models first, falls back on errors, tracks latency
- Prompt caching — automatic for most providers, explicit for Anthropic
- ~8MB installer. Native desktop. Built with Tauri 2 + Rust.
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

## Agent Tools

Darce's AI agent has 16 tools — the same capabilities as professional coding agents:

| Tool | Description |
|------|-------------|
| `create_file` | Create new files with complete content |
| `edit_file` | Surgical search/replace edits with inline diff preview |
| `read_file` | Read files with optional line range |
| `delete_file` | Delete files or directories |
| `list_files` | List project file tree |
| `glob_files` | Find files by pattern (`*.tsx`, `src/**/*.ts`) |
| `search_files` | Grep across the project with regex |
| `run_command` | Execute shell commands (auto-detects servers) |
| `run_server` | Start background processes (dev servers, watchers) |
| `stop_process` | Stop a running background process |
| `restart_process` | Restart a background process |
| `browse_web` | Scrape any URL (CrawlRocket API or HTTP fallback) |
| `web_search` | Search Google and get scraped results |
| `git_status` | Show git status, branch, modified files |
| `git_diff` | Show git diff of changes |
| `git_commit` | Stage and commit changes |
| `save_memory` | Persist project knowledge across sessions |
| `open_url` | Open URL in default browser |

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust) |
| Frontend | Svelte 5, TypeScript |
| Editor | Monaco Editor |
| Styling | Tailwind CSS v4 |
| AI | OpenRouter (smart model rotation, SSE streaming) |
| Web Scraping | CrawlRocket API (optional) |
| Browser Automation | BrowserOS MCP (optional) |

---

## What Makes Darce Different

Most AI coding tools optimize for speed. Darce optimizes for understanding.

**Teaching is built in, not bolted on.** Every file the AI writes gets broken down into concepts, patterns, and decisions — automatically.

**Full agent, not just autocomplete.** 16 tools, parallel execution, background processes, web browsing, git integration. Darce builds complete projects, not just code snippets.

**Model agnostic.** 200+ models through one API key. Smart rotation picks the best model and falls back on errors. No vendor lock-in.

**Lightweight.** ~8MB native app. Tauri + Rust. Not Electron.

**Open source.** MIT. Fork it, extend it, own it.

---

## Partners

<a href="https://crawlrocket.com"><img src="https://www.crawlrocket.com/_next/image?url=%2Flogo.png&w=32&q=75&dpl=dpl_HGFkQ5RBZam4VtMJWzvjqk7wrQHM" alt="CrawlRocket" width="20" align="top" /></a> **[CrawlRocket](https://crawlrocket.com)** — Web scraping API powering Darce's browse and search tools. Headless browser scraping, Google search, structured data extraction.

---

## Roadmap

- [x] Smart model rotation (Auto / Auto Fast / Manual)
- [x] Parallel tool execution
- [x] Background process manager
- [x] Git integration (status, diff, commit)
- [x] Web browsing (CrawlRocket + BrowserOS)
- [x] Project memory (.darce files)
- [x] Inline diff highlights in editor
- [ ] Anthropic Direct API support
- [ ] Ollama local model support
- [ ] Live browser preview
- [ ] VS Code extension (Learn mode standalone)
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
