# Darce — Claude Code Plugin

**The AI coder that makes you smarter, not lazier.**

Everyone's vibecoding — shipping code they can't explain. Darce teaches you what the AI just built, right inside Claude Code.

## Install

```bash
claude /plugin install --from https://github.com/AmerSarhan/darce
```

Or test locally:

```bash
claude --plugin-dir ./claude-code-plugin
```

## Commands

| Command | What it does |
|---------|-------------|
| `/darce:teach` | Break down recent code changes — patterns, decisions, tradeoffs |
| `/darce:quiz` | Quiz yourself on the code you just shipped |
| `/darce:explain <file or concept>` | Deep dive into a file or concept using your actual codebase |

## How it works

After the AI writes or edits code, you'll see a nudge to run `/darce:teach`. It analyzes what changed and gives you:

- **Concept cards** — what patterns were used and why
- **Tradeoff analysis** — what alternatives existed
- **Quiz questions** — test if you actually understood it

## Three Gears

| Mode | How to use |
|------|-----------|
| **Ship** | Just code. Ignore the nudges. |
| **Understand** | Run `/darce:teach` after changes to see explanations. |
| **Learn** | Run `/darce:quiz` to test yourself. |

## Full Desktop App

Want the complete experience with Monaco editor, spaced repetition, and 200+ models?

[Download Darce](https://darce.dev) — open source, MIT licensed.

## License

MIT
