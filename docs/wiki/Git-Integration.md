# Git Integration

Darce's AI agent has built-in git tools — no need to switch to a terminal for basic git operations.

## Tools

### git_status
Shows current branch, modified files, staged changes, and untracked files.

```
"What files have I changed?"
"Show me the git status"
```

### git_diff
Shows the diff of current changes. Can be scoped to a specific file.

```
"Show me what changed in App.jsx"
"What's the diff?"
```

### git_diff
Stages all changes and creates a commit with a descriptive message.

```
"Commit these changes"
"Commit with message: fix header button styling"
```

## How It Works

The git tools run standard git commands in your project directory:

- `git_status` → `git status --short --branch`
- `git_diff` → `git diff` (or `git diff -- <file>`)
- `git_commit` → `git add -A && git commit -m "<message>"`

The agent sees the output and can make decisions based on it — like checking the diff before committing, or noting which files were modified.

## Tips

- Ask the agent to "commit after each change" and it will save progress automatically
- The agent can read git status to understand what's been modified before making further changes
- Diff output is capped at 4000 characters to keep responses fast
