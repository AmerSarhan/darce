---
description: Explain a specific file or concept in depth
---

The user wants to understand "$ARGUMENTS".

If it's a file path, read the file. If it's a concept, find real examples in the codebase.

You MUST format your response EXACTLY like this template:

---

### darce:explain — `{file or concept}`

> **TL;DR:** {one sentence — what this is and why it exists}

**What it does**
{3-5 sentences. Role in the project, what triggers it, what it produces.}

**How it works**

```
{simple ASCII flow showing data/control flow, 3-5 lines max}
e.g.:
  User clicks save -> handleSave() -> validates -> writes to disk -> updates UI state
```

**Key patterns**

| Pattern | Why it's used here |
|---------|-------------------|
| {name} | {one sentence} |
| {name} | {one sentence} |

**Watch out for**
- {Gotcha 1 — something that could trip you up}
- {Gotcha 2}

**Related files:** `{path}`, `{path}`

---

Rules:
- Ground everything in the actual code, not generic definitions
- The ASCII flow diagram is mandatory — it makes the structure scannable
- If explaining a concept, point to specific files and line numbers in this project
- No filler. No "let's explore". Just explain.
