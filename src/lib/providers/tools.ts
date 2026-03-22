/**
 * Tool definitions for the AI agent.
 * Better descriptions = smarter tool usage.
 */

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_file",
      description: "Create a new file or completely replace an existing file. Always include the FULL file content — the entire file will be written. Use this for creating new source files, config files, HTML, CSS, etc. Parent directories are created automatically.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from project root, using forward slashes. Examples: 'src/App.tsx', 'index.html', 'package.json', 'styles/main.css'",
          },
          content: {
            type: "string",
            description: "The complete file content. Must be production-ready — no TODO comments, no placeholder text, no missing imports.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the contents of a file. Use this BEFORE editing a file to understand the current code. Also useful for reading config files (package.json, tsconfig.json) to understand the project setup.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from project root.",
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
      description: "List files and directories in the project. Use this to understand project structure before making changes. Call without a path to see the full project tree.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Subdirectory to list. Omit or use '.' for project root.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_command",
      description: "Execute a shell command in the project directory. Use for: npm/yarn/pnpm install, running build tools, starting dev servers, git commands, creating projects with CLI tools (npx create-vite, etc). Commands run in the project root directory. Long-running commands (like dev servers) will be waited for — prefer 'npm run build' over 'npm run dev' unless the user asks to start a server.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute. Examples: 'npm install', 'npm run build', 'npx create-vite . --template react-ts', 'git init'",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_file",
      description: "Delete a file or directory from the project. Use sparingly — prefer editing over deleting and recreating.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path of the file or directory to delete.",
          },
        },
        required: ["path"],
      },
    },
  },
];
