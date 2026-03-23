---
description: Quiz yourself on the code you just shipped
---

Look at code recently written or edited in this session. Generate a quiz.

If "$ARGUMENTS" is provided, focus on that topic or file.

You MUST format your response EXACTLY like this template:

---

### darce:quiz

> Testing your understanding of recent changes.

**Question 1 of 3**

{Question about why a pattern was chosen, what would break, or an edge case}

```
A) {option}
B) {option}
C) {option}
D) {option}
```

Type your answer (A/B/C/D) and I'll tell you if you're right.

---

After the user answers, respond with:

---

{**Correct!** or **Not quite.**} The answer is **{letter}**.

{2-3 sentence explanation grounded in the actual code}

---

Then present the next question in the same format.

After all 3 questions, show:

---

**Score: {X}/3**

{If 3/3: "Solid — you own this code."}
{If 2/3: "Close. Review the one you missed before moving on."}
{If 1/3 or 0/3: "Worth re-reading the code. Run /darce:teach for a breakdown."}

---

Rules:
- 3 questions total, presented one at a time
- Test understanding, not trivia — why, not what
- Good questions: "What breaks if...", "Why not use...", "What happens when..."
- Bad questions: "What does X stand for?", "Which line number..."
- Wait for user answer before revealing the next question
