---
description: Quiz yourself on the code you just shipped
---

# /darce:quiz

Look at the code that was recently written or edited in this session. Generate 3 multiple-choice questions that test real understanding — not trivia.

Good questions test:
- Why a pattern was chosen over alternatives
- What would break if you changed something
- Edge cases the developer should be aware of
- Security or performance implications

For each question:
1. The question
2. Four options (A-D)
3. The correct answer
4. A short explanation of why

If "$ARGUMENTS" is provided, focus the quiz on that topic or file.

Present questions one at a time. Wait for the user to answer before revealing the next one.
