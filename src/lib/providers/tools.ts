/**
 * Tool definitions for the AI agent.
 * Better descriptions = smarter tool usage.
 */

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_file",
      description:
        "Create a NEW file or fully replace an existing file's entire content. Always provide the COMPLETE file content — the whole file is written in one shot. Use this for new source files, configs, HTML, CSS, etc. Parent directories are created automatically. Do NOT use this to make small edits to an existing file — use edit_file instead.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative path from project root using forward slashes. Examples: 'src/App.tsx', 'index.html', 'package.json', 'styles/main.css'.",
          },
          content: {
            type: "string",
            description:
              "The complete file content to write. Must be production-ready — no TODO placeholders, no missing imports, no truncated sections.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_file",
      description:
        "Make surgical search-and-replace edits to an existing file. Each edit finds old_text and replaces it with new_text. Preferred over create_file when modifying an existing file — only the changed sections need to be specified. Multiple independent edits can be batched in a single call. IMPORTANT: old_text must be an exact, verbatim copy of the text currently in the file — read the file first if unsure.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from project root of the file to edit.",
          },
          edits: {
            type: "array",
            description:
              "Ordered list of search/replace operations to apply sequentially.",
            items: {
              type: "object",
              properties: {
                old_text: {
                  type: "string",
                  description:
                    "The exact text to find in the file. Must match character-for-character, including whitespace and indentation. Use read_file first to confirm the exact text.",
                },
                new_text: {
                  type: "string",
                  description:
                    "The replacement text. Use an empty string to delete old_text without inserting anything.",
                },
              },
              required: ["old_text", "new_text"],
            },
          },
        },
        required: ["path", "edits"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description:
        "Read the contents of a file. Always read a file BEFORE editing it so you have the exact current content. Also useful for inspecting config files (package.json, tsconfig.json, vite.config.ts) to understand the project setup. For large files, use start_line and end_line to read only the relevant portion.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from project root.",
          },
          start_line: {
            type: "number",
            description:
              "1-based line number to start reading from. Omit to read from the beginning.",
          },
          end_line: {
            type: "number",
            description:
              "1-based line number to stop reading at (inclusive). Omit to read to the end of the file.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_file",
      description:
        "Permanently delete a file or an entire directory (recursively). Use sparingly — prefer editing over deleting and recreating. Useful when removing obsolete files, cleaning up scaffolding, or removing a directory that needs to be replaced entirely.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative path of the file or directory to delete from the project root.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description:
        "List the project's file and directory tree. Use this to understand project structure before making changes — see which files exist, how they are organized, and where to place new files. Call without a path to see the full project tree, or pass a subdirectory to focus on a specific area.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Subdirectory to list relative to the project root. Omit or use '.' for the full project tree.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_files",
      description:
        "Search for a text pattern across files in the project. Use this to find where a function, component, variable, or import is defined or used before editing it. Supports plain-text and regex patterns. Narrow the scope with path (subdirectory) or file_pattern (glob). Always search BEFORE editing so you locate the right file and the exact text.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description:
              "Text or regex pattern to search for. Examples: 'useState', 'export default App', 'TODO', 'className=\"hero\"'.",
          },
          path: {
            type: "string",
            description:
              "Subdirectory to restrict the search to. Omit to search the entire project.",
          },
          file_pattern: {
            type: "string",
            description:
              "Glob pattern to filter which files are searched. Examples: '*.tsx', '*.css', '*.json'. Omit to search all files.",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_command",
      description:
        "Execute a quick shell command in the project directory and wait for it to finish. Use for: installing dependencies (npm install), building (npm run build), linting, git operations, scaffolding (npx create-vite), and any other short-lived task. Commands time out after 60 seconds — do NOT use this for dev servers or long-running watchers; use run_server instead.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The shell command to execute. Examples: 'npm install', 'npm run build', 'npx create-vite . --template react-ts', 'git init', 'npm run lint'.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_server",
      description:
        "Start a long-running background process such as a dev server, watcher, or preview server. Returns immediately with a process ID — the process keeps running in the background and its output streams to the terminal. Use for: 'npm run dev', 'npm start', 'npx serve', file watchers, etc. After starting, use open_url to show the app in the browser. Use stop_process or restart_process to manage the process later.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The command to run as a background process. Examples: 'npm run dev', 'npm start', 'npx serve dist'.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "stop_process",
      description:
        "Stop a background process that was started with run_server. Use this when you need to shut down a dev server or watcher that is no longer needed.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "The process ID returned by run_server when the process was started.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "restart_process",
      description:
        "Stop and re-run a background process that was started with run_server. Use this after editing source files while a dev server is running, so the server picks up the latest changes. Equivalent to calling stop_process then run_server with the same command.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "The process ID returned by run_server when the process was originally started.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "open_url",
      description:
        "Open a URL in the user's default browser. Use this after starting a dev server with run_server to let the user see the running app. Also useful for opening documentation, a deployed preview, or any other URL relevant to the task.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "The full URL to open. Examples: 'http://localhost:5173', 'https://example.com'.",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_memory",
      description:
        "Save important information about this project that should persist across conversations. Use this to remember project patterns, user preferences, key decisions, tech stack details, or anything that would be useful to know next time. Writes to .darce/memory.md in the project root.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description:
              "The memory content to save. Use markdown format. This REPLACES the entire memory file, so include any existing memories you want to keep plus the new ones.",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "browse_web",
      description:
        "Scrape a URL and get its full page content (title, headings, body text, links). Uses a headless browser so JavaScript-rendered pages work. Use this to read documentation, check dev server output, verify deployed pages, or research anything online.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to navigate to. Examples: 'http://localhost:5173', 'https://docs.example.com'.",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "browser_click",
      description:
        "Click an element on the current page in BrowserOS. Use a CSS selector or descriptive text to identify the element. Use after browse_web to interact with the page.",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector or descriptive text of the element to click. Examples: '#submit-btn', 'button:has-text(\"Sign In\")', '.nav-link'.",
          },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "browser_fill",
      description:
        "Fill an input field on the current page in BrowserOS. Use a CSS selector to identify the input and provide the value to type.",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector of the input element. Examples: '#email', 'input[name=\"username\"]', '.search-input'.",
          },
          value: {
            type: "string",
            description: "The text to type into the input field.",
          },
        },
        required: ["selector", "value"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "browser_extract",
      description:
        "Extract structured text content from the current page in BrowserOS. Returns the visible text content of the page or a specific section.",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "Optional CSS selector to scope extraction to a specific element. Omit to get the full page content.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search Google and get scraped content from the top results. Use this to find information, research solutions, look up documentation, or find examples online. Returns structured data from each result page.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query. Examples: 'react useEffect cleanup', 'tailwind css grid layout', 'express middleware error handling'.",
          },
          limit: {
            type: "number",
            description: "Max results to return, 1-5. Default: 3.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "glob_files",
      description:
        "Find files by name pattern. Use glob syntax: '*.tsx' finds all TSX files, 'src/**/*.ts' finds TypeScript files under src/, 'package.json' finds exact file. MUCH faster than search_files for finding files by name. Use this FIRST to locate files before reading or editing them.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Glob pattern. Examples: '*.tsx', 'src/**/*.css', 'package.json', '*Header*', '*.config.*'.",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "git_status",
      description:
        "Show the current git status — modified files, staged changes, untracked files, current branch. Use to understand what has changed before committing or to see the project's git state.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "git_diff",
      description:
        "Show the git diff of current changes. Use to review what was modified before committing. Can diff a specific file or all changes.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Optional file path to diff. Omit for all changes.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "git_commit",
      description:
        "Stage all changes and create a git commit. Use after making changes to save progress. The agent should commit meaningful chunks of work with clear messages.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The commit message. Be concise and descriptive. Examples: 'Add dark mode toggle', 'Fix header button styling'.",
          },
        },
        required: ["message"],
      },
    },
  },
];
