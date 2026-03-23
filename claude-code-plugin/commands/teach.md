---
description: Break down recent code changes — explain patterns, decisions, and tradeoffs
---

Look at the code that was just written or changed in this session. Break it down for the developer.

If "$ARGUMENTS" is provided, focus on that topic or file.

You MUST format your response EXACTLY like this template:

---

### darce:teach

> **{filename}** — {one sentence summary of what changed}

**Concepts**

| # | Concept | Tag | Difficulty |
|---|---------|-----|------------|
| 1 | {name} | `{tag}` | {level} |
| 2 | {name} | `{tag}` | {level} |
| 3 | {name} | `{tag}` | {level} |

**1. {Concept Name}**
{2-3 sentence explanation — what it is, why it was used here, common mistake to avoid}

**2. {Concept Name}**
{2-3 sentence explanation}

**3. {Concept Name}**
{2-3 sentence explanation}

**Why this approach?**
{1-2 sentences on what alternatives existed and why this was chosen}

**Quick check:** {One question about the code}
A) {option}  B) {option}  C) {option}  D) {option}

> Answer: **{letter}** — {one sentence explanation}

---

Rules:
- 3-5 concepts per file, no more
- Tags: `react` `css` `js` `ts` `node` `rust` `pattern` `security` `perf` `html` `api`
- Difficulty: beginner / intermediate / advanced
- No filler, no "let's dive in", no "great question". Just teach.
- Keep explanations grounded in the actual code, not textbook definitions
