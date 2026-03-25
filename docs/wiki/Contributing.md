# Contributing

Contributions are welcome! Darce is MIT licensed and open to everyone.

## Setup

```bash
git clone https://github.com/AmerSarhan/darce.git
cd darce
npm install
npm run tauri dev
```

Prerequisites:
- Node.js 18+
- Rust (via rustup)
- C++ build tools (Windows: Visual C++ Build Tools, macOS: `xcode-select --install`)

## Structure

- **Frontend changes** → `src/` (Svelte 5 + TypeScript)
- **Backend changes** → `src-tauri/src/` (Rust)
- **Tool changes** → `src/lib/providers/tools.ts` (definitions) + `src/lib/providers/agent.ts` (execution)
- **UI changes** → `src/lib/components/` (Svelte components)
- **Styles** → `src/app.css` (Tailwind + custom animations)

## Guidelines

- Keep it simple. Darce is intentionally minimal.
- Test your changes with `npm run build` before submitting.
- One feature per PR. Small PRs get reviewed faster.
- Follow existing code style — no linter config needed, just match what's there.
- If adding a new tool, add it to both `tools.ts` (definition) and `agent.ts` (execution).

## Good First Issues

Look for issues labeled `good first issue` on the [issues page](https://github.com/AmerSarhan/darce/issues).

Ideas for contributions:
- New tool integrations
- UI/UX improvements
- Teaching content quality improvements
- Performance optimizations
- Documentation
- Bug fixes
