# Darce

**The AI coding agent that makes you smarter, not lazier.**

Darce is an open-source desktop code editor with an AI agent that builds software for you — and teaches you what it's doing while it works. Think of it as a senior engineer who writes your code and explains every decision.

*Darce (دَرْس) means "a lesson" in Arabic.*

**Open source. Local-first. Any model. Your keys.**

---

## The Problem

AI coding tools made us faster but dumber. We accept diffs without reading them. We ship code we can't explain. We lost the ability to actually learn from writing software.

Darce fixes this.

## How It Works

Darce has three modes. Switch between them anytime.

**Ship** — The AI builds fast. No interruptions. You ship.

**Understand** — The AI builds and explains every decision it makes. What pattern it used. Why it chose it. What the alternatives were.

**Learn** — The AI asks you first. What approach would you take? Then it builds, explains, and quizzes you. Spaced repetition built into your workflow.

## Features

- Full AI coding agent — creates files, runs commands, installs dependencies, builds projects
- Monaco editor with syntax highlighting, autocomplete, and IntelliSense
- Works with 200+ models via OpenRouter — Claude, GPT, Gemini, Llama, Mistral, Grok, and more
- AI-powered code analysis that teaches you the patterns in your code
- Interactive quizzes that test your understanding (Learn mode)
- Integrated terminal with live output
- File tree with search, context menus, and persistent state
- Chat history saved per project
- ~15MB installed — native desktop app, not Electron

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) toolchain
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows) or Xcode CLI tools (macOS)
- An [OpenRouter API key](https://openrouter.ai/keys)

### Install

```bash
git clone https://github.com/AmerSarhan/darce.git
cd darce
npm install
```

### Run

```bash
npm run tauri dev
```

On first launch, paste your OpenRouter API key. Open a folder. Start building.

### Build

```bash
npm run tauri build
```

Produces a native installer for your platform.

## Architecture

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust) |
| Frontend | Svelte 5, TypeScript |
| Editor | Monaco Editor |
| Styling | Tailwind CSS v4 |
| AI | OpenRouter API (tool calling) |
| Storage | localStorage, SQLite |

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open folder | `Ctrl+O` |
| Save file | `Ctrl+S` |
| New chat | `Ctrl+N` |
| Ship mode | `Ctrl+1` |
| Understand mode | `Ctrl+2` |
| Learn mode | `Ctrl+3` |

## Supported Models

Darce works with any model available on OpenRouter. Some popular choices:

- Claude Sonnet 4.6 / Claude Haiku 4.5
- GPT-4.1 Mini
- Gemini 2.5 Flash
- Llama 4 Scout
- Kimi K2.5
- Grok 4

More providers coming soon: Anthropic Direct, Claude Code CLI integration, and local models via Ollama.

## What Makes Darce Different

Most AI coding tools optimize for speed. Darce optimizes for understanding.

- **Teaching is built in, not bolted on.** Every file the AI writes can be broken down into concepts, patterns, and decisions — automatically.
- **Model agnostic.** 200+ models through OpenRouter. Use whatever works best for your task. Bring your own key.
- **Lightweight.** ~15MB native app built with Tauri and Rust. No Electron. No bloat.
- **Open source.** MIT licensed. Fork it, extend it, own it.

## Roadmap

- [ ] Anthropic Direct API support
- [ ] Claude Code CLI integration (use your Claude subscription)
- [ ] Ollama local model support
- [ ] Git integration (status, commit, diff)
- [ ] Live browser preview
- [ ] VS Code extension (Learn mode as a standalone extension)
- [ ] Concept progress tracking across sessions
- [ ] Community concept library

## Contributing

Contributions welcome. Open an issue first for large changes.

```bash
git clone https://github.com/AmerSarhan/darce.git
cd darce
npm install
npm run tauri dev
```

## License

MIT

## Links

- [Website](https://darce.dev)
- [GitHub](https://github.com/AmerSarhan/darce)
- [OpenRouter](https://openrouter.ai) — Get an API key
