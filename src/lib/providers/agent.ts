/**
 * Agentic loop — sends messages, handles tool calls, executes them, loops.
 * Uses the provider router for multi-provider support.
 */
import { tauriInvoke } from "$lib/utils/ipc";
import { files } from "$lib/stores/files.svelte";
import { terminal } from "$lib/stores/terminal.svelte";
import { project } from "$lib/stores/project.svelte";
import { AGENT_TOOLS } from "./tools";
import { sendCompletion } from "./router";
import type { FileEntry } from "$lib/types";

export interface AgentMessage {
  role: string;
  content?: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

interface AgentCallbacks {
  onToken: (token: string) => void;
  onToolStreaming: (index: number, name: string, argsChunk: string, totalArgs: string) => void;
  onToolStart: (name: string, args: Record<string, unknown>) => void;
  onToolEnd: (name: string, result: string) => void;
  onDone: (finalText: string) => void;
  onError: (error: string) => void;
}

const MAX_ITERATIONS = 15;

export async function runAgent(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  systemPrompt: string,
  callbacks: AgentCallbacks,
) {
  let iterations = 0;
  let lastTextContent = "";

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`[Darce] Iteration ${iterations}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const result = await sendCompletion(
        messages,
        systemPrompt,
        AGENT_TOOLS,
        {
          onToken(token) {
            callbacks.onToken(token);
          },
          onToolCallDelta(index, id, name, argsChunk) {
            // Track streaming tool calls for live UI
            if (name || argsChunk) {
              callbacks.onToolStreaming(index, name || "", argsChunk || "", "");
            }
          },
        },
        controller.signal,
      );

      clearTimeout(timeout);

      console.log(`[Darce] Done. Content: ${result.content.length} chars, Tools: ${result.toolCalls.length}, Finish: ${result.finishReason}`);

      if (result.content) {
        lastTextContent = result.content;
      }

      // No tool calls — we're done
      if (result.toolCalls.length === 0) {
        messages.push({ role: "assistant", content: result.content || null });
        callbacks.onDone(lastTextContent);
        return;
      }

      // Build assistant message with tool calls
      const tcArray = result.toolCalls.map(tc => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.args },
      }));

      messages.push({
        role: "assistant",
        content: result.content || null,
        tool_calls: tcArray,
      });

      // Execute each tool call
      for (const tc of tcArray) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }

        callbacks.onToolStart(tc.function.name, args);
        const toolResult = await executeTool(tc.function.name, args);
        callbacks.onToolEnd(tc.function.name, toolResult);

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult,
        });
      }

      // Continue loop for next iteration

    } catch (e) {
      console.error("[Darce] Agent error:", e);
      callbacks.onError(String(e));
      return;
    }
  }

  callbacks.onDone(lastTextContent);
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const projectRoot = project.path;
  if (!projectRoot && name !== "list_files") {
    return "Error: No project folder open.";
  }

  try {
    switch (name) {
      case "create_file": {
        const path = args.path as string;
        const content = args.content as string;
        if (!path || content === undefined) return "Error: Missing path or content.";
        terminal.addLine(`Writing ${path}...`, "system");
        await tauriInvoke("write_file", { projectRoot, filePath: path, content });
        files.open(path, content);
        terminal.addLine(`Created ${path} (${content.split("\n").length} lines)`, "system");
        refreshTree();
        return `File created: ${path}`;
      }

      case "read_file": {
        const path = args.path as string;
        if (!path) return "Error: Missing path.";
        terminal.addLine(`Reading ${path}...`, "system");
        const content = await tauriInvoke<string>("read_file", { projectRoot, filePath: path });
        return content.slice(0, 10000);
      }

      case "list_files": {
        terminal.addLine("Listing files...", "system");
        const entries = await tauriInvoke<FileEntry[]>("list_directory", {
          projectRoot: projectRoot || ".", dirPath: null,
        });
        return formatTree(entries);
      }

      case "run_command": {
        const command = args.command as string;
        if (!command) return "Error: Missing command.";
        terminal.addLine(`$ ${command}`, "system");
        terminal.setRunning(true);
        try {
          const result = await tauriInvoke<{ stdout: string; stderr: string; exit_code: number }>(
            "run_shell_command", { cwd: projectRoot, command }
          );
          if (result.stdout) {
            for (const l of result.stdout.split("\n").filter(Boolean).slice(0, 50))
              terminal.addLine(l, "stdout");
          }
          if (result.stderr) {
            for (const l of result.stderr.split("\n").filter(Boolean).slice(0, 20))
              terminal.addLine(l, "stderr");
          }
          terminal.setRunning(false);
          terminal.addLine(`Exit: ${result.exit_code}`, result.exit_code === 0 ? "system" : "stderr");
          refreshTree();
          const out = (result.stdout + "\n" + result.stderr).trim();
          return out.slice(0, 5000) || `Exit code ${result.exit_code}`;
        } catch (e) {
          terminal.setRunning(false);
          return `Command failed: ${e}`;
        }
      }

      case "delete_file": {
        const path = args.path as string;
        if (!path) return "Error: Missing path.";
        terminal.addLine(`Deleting ${path}...`, "system");
        await tauriInvoke("delete_file", { projectRoot, filePath: path });
        terminal.addLine(`Deleted ${path}`, "system");
        refreshTree();
        return `Deleted: ${path}`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e) {
    terminal.addLine(`Error: ${e}`, "stderr");
    return `Error: ${e}`;
  }
}

function formatTree(entries: FileEntry[], indent = ""): string {
  let r = "";
  for (const e of entries) {
    r += `${indent}${e.is_dir ? e.name + "/" : e.name}\n`;
    if (e.children) r += formatTree(e.children, indent + "  ");
  }
  return r || "(empty)";
}

async function refreshTree() {
  if (!project.path) return;
  try {
    const entries = await tauriInvoke<FileEntry[]>("list_directory", { projectRoot: project.path, dirPath: null });
    project.setFiles(entries);
  } catch { /* ignore */ }
}
