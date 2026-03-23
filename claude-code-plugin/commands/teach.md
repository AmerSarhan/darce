---
description: Break down recent code changes — explain patterns, decisions, and tradeoffs
---

# /darce:teach

Look at the code that was just written or changed in this session. Break it down like a senior engineer explaining to a teammate.

For each file touched, produce:

1. **Summary** — one sentence on what changed and why
2. **Concepts** (3-5) — each with:
   - Name and category tag (react, css, js, ts, node, rust, pattern, security, perf)
   - One-liner: what it is
   - Explanation: why it matters here, when you'd use it, common mistakes
   - Difficulty: beginner / intermediate / advanced
3. **Quiz** (1 question) — multiple choice about the code that was just written, with explanation of the correct answer

If the user passes arguments like "$ARGUMENTS", focus the teaching on that topic or file.

Format the output clearly with markdown. Keep it practical — no textbook fluff. Explain what a working developer actually needs to know.
