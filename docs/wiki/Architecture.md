# Architecture

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop | Tauri 2 (Rust) | Native window, file system, shell, security |
| Frontend | Svelte 5, TypeScript | UI components, reactive state |
| Editor | Monaco Editor | Code editing (same engine as VS Code) |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| AI | OpenRouter API | Model routing, SSE streaming |
| Web Scraping | CrawlRocket API | Headless browser scraping |
| Browser | BrowserOS MCP | Full browser automation (optional) |
| Analytics | Aptabase | Privacy-friendly usage tracking |

## Project Structure

```
darce/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # App entry, plugin registration
│   │   ├── security.rs     # Path validation, dangerous command detection
│   │   └── commands/
│   │       ├── fs.rs       # File operations (read, write, delete, list)
│   │       ├── shell.rs    # Shell commands, background processes
│   │       ├── search.rs   # File search (grep) and glob
│   │       ├── ai.rs       # AI API calls (used by teaching panel)
│   │       └── db.rs       # SQLite migrations
│   ├── capabilities/
│   │   └── default.json    # Security permissions (HTTP scope, shell, fs)
│   └── tauri.conf.json     # App config, version, window settings
│
├── src/                    # Svelte frontend
│   ├── App.svelte          # Root component, keyboard shortcuts
│   ├── app.css             # Global styles, animations
│   └── lib/
│       ├── components/
│       │   ├── layout/
│       │   │   ├── ChatPanel.svelte   # Chat UI, streaming, tool cards
│       │   │   ├── LearnPanel.svelte  # Teaching panel (Understand/Learn)
│       │   │   ├── MainArea.svelte    # Editor area
│       │   │   ├── Sidebar.svelte     # File tree
│       │   │   ├── MenuBar.svelte     # File/Edit/View/Help menus
│       │   │   └── TopBar.svelte      # Tab bar
│       │   ├── filetree/
│       │   │   └── FileNode.svelte    # Single file/folder in tree
│       │   └── ui/
│       │       ├── Shimmer.svelte     # Text + block shimmer animations
│       │       ├── Modal.svelte       # Modal dialog
│       │       └── Button.svelte      # Button component
│       ├── providers/
│       │   ├── agent.ts        # Agent loop — tool execution, parallel batching
│       │   ├── auto-provider.ts # Smart model rotation engine
│       │   ├── models.ts       # Model registry, latency tracking, health
│       │   ├── router.ts       # Routes to auto-provider or direct OpenRouter
│       │   ├── tools.ts        # 16 tool definitions for the AI
│       │   ├── context.ts      # Lean context builder + .darce file loading
│       │   └── teacher.ts      # Teaching content generator
│       ├── stores/
│       │   ├── settings.svelte.ts   # App settings (provider, keys, gear)
│       │   ├── files.svelte.ts      # Open files, tabs, editor state
│       │   ├── project.svelte.ts    # Project path, file tree
│       │   ├── chat.svelte.ts       # Chat messages, streaming state
│       │   ├── terminal.svelte.ts   # Terminal output lines
│       │   ├── processes.svelte.ts  # Background process manager
│       │   └── updater.svelte.ts    # Auto-update checker
│       └── types/
│           └── index.ts     # TypeScript types
│
├── docs/wiki/              # Wiki content (copy to GitHub wiki)
├── .github/workflows/
│   └── release.yml         # CI/CD — builds for all platforms on tag
├── SECURITY.md             # Security policy
├── CONTRIBUTING.md         # Contribution guide
└── README.md               # Project overview
```

## Data Flow

```
User types message
  → ChatPanel builds context (file tree, open file, terminal, .darce files)
  → Agent loop starts
    → Auto-provider picks model (Kimi K2.5 first)
    → SSE stream to OpenRouter
    → Tokens buffered via requestAnimationFrame
    → Tool calls parsed and executed in parallel batches
    → Results sent back to model
    → Loop continues until model stops calling tools
  → Teaching panel analyzes code (Codestral, separate request)
  → Concepts stagger-reveal with animations
```

## Security Model

- **Tauri sandbox** — webview has limited access, all sensitive ops go through Rust commands
- **Path validation** — all file operations validate paths against project root
- **HTTP scope** — only allowed domains can be fetched (configured in capabilities)
- **No elevation** — commands run with user permissions only
- **Local-first** — no Darce servers, all data stays on your machine
