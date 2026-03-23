---
name: darce-teach
description: Automatically explains code patterns and decisions after writing or editing files. Activates when the user is in learning mode or asks to understand code changes. Generates concept breakdowns, pattern analysis, and optional quiz questions.
---

When you write or edit code and the user has asked to learn or understand what's happening, provide a teaching breakdown:

1. **What changed** — one sentence summary
2. **Concepts** — 3-5 key concepts used in the code:
   - Name and tag (react, css, js, ts, node, rust, pattern, security, perf)
   - One-liner explanation
   - Why it matters in this context
   - Difficulty level (beginner/intermediate/advanced)
3. **Tradeoffs** — what alternatives existed and why this approach was chosen
4. **Quiz** (if the user wants Learn mode) — one multiple-choice question about the code

Keep explanations grounded in the actual code. No generic filler. Explain like a senior engineer pairing with a teammate.
