# Project Memory (.darce files)

Darce can remember things about your project across conversations using `.darce/` files in your project root.

## How It Works

Two files, both optional:

### `.darce/instructions.md`
**You write this.** Project-level instructions the agent always follows. Think of it as a system prompt for your project.

Example:
```markdown
# Project Instructions

- This is a React 19 project with TypeScript
- Use Tailwind CSS for styling, no CSS modules
- Always use arrow functions, never function declarations
- API calls go through src/lib/api.ts
- Run `npm run lint` after making changes
```

The agent reads this on every message and follows these rules.

### `.darce/memory.md`
**The agent writes this.** It saves important context it discovers while working — tech stack, patterns, decisions, gotchas.

Example:
```markdown
# Project Memory

- Uses Vite with React plugin
- Auth is handled by Clerk (middleware in src/middleware.ts)
- Database is Prisma with PostgreSQL
- The user prefers minimal comments in code
- Footer component is in src/components/layout/Footer.jsx
```

The agent reads this at the start of every conversation so it doesn't re-discover things it already learned.

## Setup

No setup needed. The agent creates `.darce/memory.md` automatically when it has something worth remembering. You can create `.darce/instructions.md` manually anytime.

## Tips

- Add `.darce/` to your `.gitignore` if you don't want to commit project memory
- Or commit it to share instructions with your team
- The agent's `save_memory` tool replaces the entire file — it includes old memories plus new ones
- You can edit `.darce/memory.md` manually to correct or remove entries
