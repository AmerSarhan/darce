# Agent Tools

Darce's AI agent has 16 tools for building software:

## File Operations

| Tool | Description |
|------|-------------|
| `create_file` | Create a new file with complete content. Parent directories created automatically. |
| `edit_file` | Surgical search/replace edits. Multiple edits per call. Shows inline diff preview. |
| `read_file` | Read file contents with optional line range (`start_line`, `end_line`). |
| `delete_file` | Delete a file or directory. |
| `list_files` | List the project file tree. |
| `glob_files` | Find files by pattern. Examples: `*.tsx`, `src/**/*.css`, `*Header*`. |

## Search

| Tool | Description |
|------|-------------|
| `search_files` | Grep across the project. Supports regex. Scope by directory or file pattern. |

## Commands & Processes

| Tool | Description |
|------|-------------|
| `run_command` | Execute a shell command. Auto-detects servers and upgrades to background process. |
| `run_server` | Start a long-running background process (dev server, watcher). |
| `stop_process` | Stop a background process. |
| `restart_process` | Restart a background process (e.g. after editing source files). |

## Web

| Tool | Description |
|------|-------------|
| `browse_web` | Scrape a URL. Uses CrawlRocket (headless browser) with HTTP fallback. |
| `web_search` | Search Google and get scraped results from top pages. |
| `open_url` | Open a URL in the default browser. |

## Git

| Tool | Description |
|------|-------------|
| `git_status` | Show current branch, modified files, staged changes. |
| `git_diff` | Show diff of current changes. Can scope to a specific file. |
| `git_commit` | Stage all changes and commit with a message. |

## Memory

| Tool | Description |
|------|-------------|
| `save_memory` | Save project knowledge to `.darce/memory.md`. Persists across conversations. |
