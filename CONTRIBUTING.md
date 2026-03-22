# Contributing to Darce

Thanks for your interest in contributing to Darce.

## Getting Started

```bash
git clone https://github.com/AmerSarhan/darce.git
cd darce
npm install
npm run tauri dev
```

### Prerequisites

- Node.js 18+
- Rust toolchain (rustup.rs)
- Visual Studio Build Tools (Windows) or Xcode CLI tools (macOS)

## What to Work On

Check the [issues](https://github.com/AmerSarhan/darce/issues) page. Issues labeled `good first issue` are a good starting point.

### High-Impact Areas

- **Provider support** — Anthropic Direct, Ollama, Claude CLI integration
- **Git integration** — status, commit, diff viewer
- **Live preview** — embedded browser for web projects
- **Learn mode** — better concept detection, progress tracking
- **Editor** — LSP support, better autocomplete
- **Performance** — faster startup, lower memory usage

## Development

### Project Structure

```
src/                    # Svelte frontend
  lib/
    components/         # UI components
    providers/          # AI provider integrations
    stores/             # State management
    types/              # TypeScript types
    utils/              # Utilities
src-tauri/              # Rust backend
  src/
    commands/           # IPC command handlers
    security.rs         # Path validation
```

### Key Files

- `src/lib/providers/agent.ts` — The agentic loop
- `src/lib/providers/router.ts` — Multi-provider routing
- `src/lib/providers/tools.ts` — Tool definitions
- `src/lib/components/layout/ChatPanel.svelte` — Chat UI
- `src-tauri/src/commands/` — Rust backend commands

## Pull Requests

1. Fork the repo
2. Create a branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test locally with `npm run tauri dev`
5. Submit a PR

Keep PRs focused. One feature or fix per PR.

## Code Style

- TypeScript with strict mode
- Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Tailwind CSS for styling
- Rust for backend commands

## Reporting Issues

Include:
- What you expected
- What happened
- Steps to reproduce
- OS and version
