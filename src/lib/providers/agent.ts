/**
 * Agent v2 — agentic loop with parallel tool execution, all tool handlers,
 * server auto-detection, and resilience nudges.
 */
import { tauriInvoke } from "$lib/utils/ipc";
import { files } from "$lib/stores/files.svelte";
import { terminal } from "$lib/stores/terminal.svelte";
import { project } from "$lib/stores/project.svelte";
import { processes } from "$lib/stores/processes.svelte";
import { open } from "@tauri-apps/plugin-shell";
import { AGENT_TOOLS } from "./tools";
import { sendCompletion } from "./router";
import { settings } from "$lib/stores/settings.svelte";
import type { FileEntry } from "$lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AgentMessage {
  role: string;
  content?: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface AgentCallbacks {
  onToken: (token: string) => void;
  onToolStreaming: (index: number, name: string, argsChunk: string, totalArgs: string) => void;
  onToolStart: (name: string, args: Record<string, unknown>, parallel: boolean) => void;
  onToolEnd: (name: string, result: string, parallel: boolean) => void;
  onIteration?: (iteration: number, phase: "thinking" | "acting" | "continuing") => void;
  onModelSwitch?: (from: string, to: string) => void;
  onModelUsed?: (model: string) => void;
  onDone: (finalText: string, modelUsed?: string) => void;
  onError: (error: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_ITERATIONS = 10;
const NUDGE_TOOL_ONLY = 2;
const FORCE_TEXT_ONLY = 4;
const MAX_EMPTY_RESPONSES = 1;

/** Commands matching these patterns are long-running servers, not short tasks. */
const SERVER_PATTERNS = /\b(dev|start|serve|watch)\b/i;

/* ------------------------------------------------------------------ */
/*  Parallel batching                                                  */
/* ------------------------------------------------------------------ */

/**
 * Group tool calls into batches that can run in parallel within each batch,
 * while preserving ordering constraints between batches.
 *
 * Rules:
 *  - read_file / search_files are always independent of each other => batch together
 *  - create_file / edit_file on DIFFERENT paths are independent => batch together
 *  - run_command, run_server, stop_process, restart_process, open_url => sequential (one per batch)
 */
function groupToolCalls(toolCalls: ToolCall[]): ToolCall[][] {
  const batches: ToolCall[][] = [];
  const reads: ToolCall[] = [];
  const writesByPath = new Map<string, ToolCall[]>();
  const sequential: ToolCall[] = [];

  for (const tc of toolCalls) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }
    const name = tc.function.name;

    if (name === "read_file" || name === "search_files" || name === "list_files" || name === "glob_files" || name === "git_status" || name === "git_diff") {
      reads.push(tc);
    } else if (name === "create_file" || name === "edit_file" || name === "delete_file") {
      const path = (args.path as string) || "__unknown__";
      if (!writesByPath.has(path)) writesByPath.set(path, []);
      writesByPath.get(path)!.push(tc);
    } else {
      // run_command, run_server, stop_process, restart_process, open_url
      sequential.push(tc);
    }
  }

  // Batch 1: all reads + searches (parallel)
  if (reads.length > 0) {
    batches.push(reads);
  }

  // Batch 2: file writes — parallel if on different paths, sequential for same path
  // Group writes by path; different paths can run in parallel
  if (writesByPath.size > 0) {
    // Find max depth of writes across paths
    const pathGroups = [...writesByPath.values()];
    const maxLen = Math.max(...pathGroups.map((g) => g.length));
    for (let i = 0; i < maxLen; i++) {
      const batch: ToolCall[] = [];
      for (const group of pathGroups) {
        if (i < group.length) batch.push(group[i]);
      }
      if (batch.length > 0) batches.push(batch);
    }
  }

  // Batch 3+: commands — one per batch (sequential)
  for (const tc of sequential) {
    batches.push([tc]);
  }

  return batches;
}

/* ------------------------------------------------------------------ */
/*  Main agent loop                                                    */
/* ------------------------------------------------------------------ */

export async function runAgent(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  systemPrompt: string,
  callbacks: AgentCallbacks,
) {
  let iterations = 0;
  let lastTextContent = "";
  let lastModelUsed: string | undefined;
  let consecutiveToolOnlyIterations = 0;
  let consecutiveEmptyResponses = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`[Darce] Iteration ${iterations}`);
    callbacks.onIteration?.(iterations, iterations === 1 ? "thinking" : "continuing");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      // Accumulate tool call args for streaming UI
      const streamingArgs = new Map<number, string>();

      // After FORCE_TEXT_ONLY consecutive tool-only iterations, don't send tools
      const suppressTools = consecutiveToolOnlyIterations >= FORCE_TEXT_ONLY;
      if (suppressTools) {
        console.log(`[Darce] Forcing text-only response (${consecutiveToolOnlyIterations} tool-only iterations)`);
      }

      const result = await sendCompletion(
        messages,
        systemPrompt,
        suppressTools ? [] : AGENT_TOOLS,
        {
          onToken(token) {
            callbacks.onToken(token);
          },
          onToolCallDelta(index, id, name, argsChunk) {
            if (argsChunk) {
              const prev = streamingArgs.get(index) || "";
              streamingArgs.set(index, prev + argsChunk);
            }
            if (name || argsChunk) {
              callbacks.onToolStreaming(index, name || "", argsChunk || "", streamingArgs.get(index) || "");
            }
          },
        },
        controller.signal,
      );

      clearTimeout(timeout);

      // Track model used
      const prevModel = lastModelUsed;
      if (result.modelUsed) {
        lastModelUsed = result.modelUsed;
        callbacks.onModelUsed?.(result.modelUsed);
      }
      if (prevModel && lastModelUsed && prevModel !== lastModelUsed && callbacks.onModelSwitch) {
        callbacks.onModelSwitch(prevModel, lastModelUsed);
      }

      console.log(
        `[Darce] Done. Content: ${result.content.length} chars, Tools: ${result.toolCalls.length}, ` +
        `Finish: ${result.finishReason}${lastModelUsed ? `, Model: ${lastModelUsed}` : ""}`,
      );

      // Handle empty responses
      if (!result.content && result.toolCalls.length === 0) {
        consecutiveEmptyResponses++;
        if (consecutiveEmptyResponses >= MAX_EMPTY_RESPONSES) {
          console.log(`[Darce] ${consecutiveEmptyResponses} empty responses — injecting nudge`);
          messages.push({
            role: "user",
            content: "[System: Your last response was empty. Please respond to the user's request. If you need to use tools, call them now. Otherwise, provide your text answer.]",
          });
          consecutiveEmptyResponses = 0;
          continue;
        }
        // Single empty response — try once more
        continue;
      }
      consecutiveEmptyResponses = 0;

      if (result.content) {
        lastTextContent += (lastTextContent ? "\n\n" : "") + result.content;
        consecutiveToolOnlyIterations = 0;
      }

      // No tool calls — we're done
      if (result.toolCalls.length === 0) {
        messages.push({ role: "assistant", content: result.content || null });
        callbacks.onDone(lastTextContent, lastModelUsed);
        return;
      }

      // Track tool-only iterations (tools called but no text produced)
      if (!result.content && result.toolCalls.length > 0) {
        consecutiveToolOnlyIterations++;
      }

      // Build assistant message with tool calls
      const tcArray: ToolCall[] = result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.args },
      }));

      messages.push({
        role: "assistant",
        content: result.content || null,
        tool_calls: tcArray,
      });

      // Execute tool calls in parallel batches
      callbacks.onIteration?.(iterations, "acting");
      const batches = groupToolCalls(tcArray);
      for (const batch of batches) {
        const isParallel = batch.length > 1;
        const results = await Promise.all(
          batch.map(async (tc) => {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }

            callbacks.onToolStart(tc.function.name, args, isParallel);
            const toolResult = await executeTool(tc.function.name, args);
            callbacks.onToolEnd(tc.function.name, toolResult, isParallel);

            return { id: tc.id, result: toolResult };
          }),
        );

        for (const r of results) {
          messages.push({
            role: "tool",
            tool_call_id: r.id,
            content: r.result,
          });
        }
      }

      // If the model keeps calling tools without producing text, nudge it
      if (consecutiveToolOnlyIterations >= NUDGE_TOOL_ONLY && consecutiveToolOnlyIterations < FORCE_TEXT_ONLY) {
        console.log(`[Darce] ${consecutiveToolOnlyIterations} tool-only iterations — nudging model to respond`);
        messages.push({
          role: "user",
          content: "[System: You have gathered enough context. Now respond to the user's request with your answer. Do not call any more tools — write your response text now.]",
        });
        consecutiveToolOnlyIterations = 0;
      }

      // Continue loop for next iteration

    } catch (e) {
      console.error("[Darce] Agent error:", e);
      callbacks.onError(String(e));
      return;
    }
  }

  callbacks.onDone(lastTextContent, lastModelUsed);
}

/* ------------------------------------------------------------------ */
/*  Tool execution                                                     */
/* ------------------------------------------------------------------ */

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const projectRoot = project.path;
  if (!projectRoot && name !== "list_files" && name !== "open_url") {
    return "Error: No project folder open.";
  }

  try {
    switch (name) {
      /* ---- create_file ---- */
      case "create_file": {
        const path = args.path as string;
        const content = args.content as string;
        if (!path || content === undefined) return "Error: Missing path or content.";
        await tauriInvoke("write_file", { projectRoot, filePath: path, content });
        files.open(path, content);
        refreshTree();
        project.markModified(path);
        // Highlight all lines as "added" for new files
        const lineCount = content.split("\n").length;
        if (lineCount > 0) {
          files.addHighlight(path, Array.from({ length: lineCount }, (_, i) => i + 1), "added");
        }
        return `File created: ${path}`;
      }

      /* ---- edit_file ---- */
      case "edit_file": {
        const path = args.path as string;
        const edits = args.edits as { old_text: string; new_text: string }[];
        if (!path) return "Error: Missing path.";
        if (!edits || !Array.isArray(edits) || edits.length === 0) return "Error: Missing or empty edits array.";

        // Read the current file content
        let content = await tauriInvoke<string>("read_file", { projectRoot, filePath: path });

        // Track changed line ranges for editor highlighting
        const changedLines: number[] = [];

        // Apply each edit sequentially
        for (let i = 0; i < edits.length; i++) {
          const edit = edits[i];
          if (!edit.old_text && edit.old_text !== "") {
            return `Error: Edit ${i + 1} is missing old_text.`;
          }
          const idx = content.indexOf(edit.old_text);
          if (idx === -1) {
            // Provide helpful context for debugging
            const snippet = edit.old_text.slice(0, 80).replace(/\n/g, "\\n");
            return `Error: Edit ${i + 1} — old_text not found in ${path}: "${snippet}..."`;
          }

          // Calculate which lines are affected by this edit
          const lineStart = content.slice(0, idx).split("\n").length;
          const newTextLineCount = edit.new_text.split("\n").length;
          for (let ln = 0; ln < newTextLineCount; ln++) {
            changedLines.push(lineStart + ln);
          }

          content = content.slice(0, idx) + edit.new_text + content.slice(idx + edit.old_text.length);
        }

        // Write the modified content back
        await tauriInvoke("write_file", { projectRoot, filePath: path, content });
        files.open(path, content);
        refreshTree();
        project.markModified(path);
        // Highlight changed lines in the editor
        if (changedLines.length > 0) {
          files.addHighlight(path, [...new Set(changedLines)], "modified");
        }
        return `File edited: ${path} (${edits.length} edit${edits.length > 1 ? "s" : ""} applied)`;
      }

      /* ---- read_file ---- */
      case "read_file": {
        const path = args.path as string;
        if (!path) return "Error: Missing path.";
        const content = await tauriInvoke<string>("read_file", { projectRoot, filePath: path });
        const allLines = content.split("\n");
        const startLine = (args.start_line as number) || 1;
        const endLine = (args.end_line as number) || allLines.length;

        // Clamp to valid range (1-based, inclusive)
        const start = Math.max(1, startLine);
        const end = Math.min(allLines.length, endLine);
        const sliced = allLines.slice(start - 1, end);

        // Prepend line numbers
        const numbered = sliced.map((line, i) => `${start + i}| ${line}`);
        const result = numbered.join("\n");

        // Cap output size to avoid blowing up context
        if (result.length > 10_000) {
          return result.slice(0, 10_000) + `\n... (truncated at 10000 chars, file has ${allLines.length} lines)`;
        }
        return result;
      }

      /* ---- delete_file ---- */
      case "delete_file": {
        const path = args.path as string;
        if (!path) return "Error: Missing path.";
        await tauriInvoke("delete_file", { projectRoot, filePath: path });
        refreshTree();
        project.markModified(path);
        return `Deleted: ${path}`;
      }

      /* ---- list_files ---- */
      case "list_files": {
        const dirPath = (args.path as string) || null;
        const entries = await tauriInvoke<FileEntry[]>("list_directory", {
          projectRoot: projectRoot || ".",
          dirPath,
        });
        return formatTree(entries);
      }

      /* ---- search_files ---- */
      case "search_files": {
        const pattern = args.pattern as string;
        if (!pattern) return "Error: Missing search pattern.";
        const searchPath = (args.path as string) || undefined;
        const filePattern = (args.file_pattern as string) || undefined;

        const results = await tauriInvoke<{ file: string; line_number: number; line_text: string }[]>(
          "search_files",
          {
            projectRoot,
            pattern,
            path: searchPath ?? null,
            filePattern: filePattern ?? null,
          },
        );

        if (results.length === 0) return `No matches found for "${pattern}".`;

        // Group results by file for readable output
        const byFile = new Map<string, { line_number: number; line_text: string }[]>();
        for (const r of results) {
          if (!byFile.has(r.file)) byFile.set(r.file, []);
          byFile.get(r.file)!.push({ line_number: r.line_number, line_text: r.line_text });
        }

        let output = `Found ${results.length} match${results.length > 1 ? "es" : ""} in ${byFile.size} file${byFile.size > 1 ? "s" : ""}:\n\n`;
        for (const [file, matches] of byFile) {
          output += `${file}\n`;
          for (const m of matches.slice(0, 20)) {
            output += `  ${m.line_number}: ${m.line_text}\n`;
          }
          if (matches.length > 20) {
            output += `  ... and ${matches.length - 20} more matches\n`;
          }
          output += "\n";
        }

        // Cap total output
        return output.length > 8000 ? output.slice(0, 4000) + "\n... (truncated)" : output;
      }

      /* ---- run_command ---- */
      case "run_command": {
        const command = args.command as string;
        if (!command) return "Error: Missing command.";

        // Auto-detect server commands and redirect to run_server behavior
        if (SERVER_PATTERNS.test(command)) {
          console.log(`[Darce] Auto-detected server command: "${command}" — upgrading to run_server`);
          return executeRunServer(command, projectRoot!);
        }

        terminal.addLine(`$ ${command}`, "system");
        terminal.setRunning(true);
        try {
          const result = await tauriInvoke<{ stdout: string; stderr: string; exit_code: number }>(
            "run_shell_command",
            { cwd: projectRoot, command },
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

      /* ---- run_server ---- */
      case "run_server": {
        const command = args.command as string;
        if (!command) return "Error: Missing command.";
        return executeRunServer(command, projectRoot!);
      }

      /* ---- stop_process ---- */
      case "stop_process": {
        const id = args.id as string;
        if (!id) return "Error: Missing process id.";
        const proc = processes.processes.get(id);
        if (!proc) return `Error: No process found with id "${id}".`;
        await processes.stop(id);
        terminal.addLine(`Stopped process ${id} (${proc.command})`, "system");
        return `Process ${id} stopped.`;
      }

      /* ---- restart_process ---- */
      case "restart_process": {
        const id = args.id as string;
        if (!id) return "Error: Missing process id.";
        const proc = processes.processes.get(id);
        if (!proc) return `Error: No process found with id "${id}".`;
        await processes.restart(id);
        terminal.addLine(`Restarted: ${proc.command}`, "system");
        return `Process restarted. Command: ${proc.command}`;
      }

      /* ---- open_url ---- */
      case "open_url": {
        const url = args.url as string;
        if (!url) return "Error: Missing url.";
        await open(url);
        return `Opened: ${url}`;
      }

      /* ---- save_memory ---- */
      case "save_memory": {
        const content = args.content as string;
        if (!content) return "Error: Missing content.";
        await tauriInvoke("write_file", { projectRoot, filePath: ".darce/memory.md", content });
        return "Memory saved to .darce/memory.md";
      }

      /* ---- glob_files ---- */
      case "glob_files": {
        const pattern = args.pattern as string;
        if (!pattern) return "Error: Missing pattern.";
        try {
          const results = await tauriInvoke<string[]>("glob_files", { projectRoot, pattern });
          if (results.length === 0) return `No files matching "${pattern}".`;
          return results.join("\n");
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      /* ---- git_status ---- */
      case "git_status": {
        terminal.addLine("$ git status", "system");
        try {
          const result = await tauriInvoke<{ stdout: string; stderr: string; exit_code: number }>(
            "run_shell_command", { cwd: projectRoot, command: "git status --short --branch" }
          );
          const output = (result.stdout + "\n" + result.stderr).trim();
          terminal.addLine(output.split("\n")[0], "stdout");
          return output || "Working tree clean.";
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      /* ---- git_diff ---- */
      case "git_diff": {
        const path = args.path as string;
        const cmd = path ? `git diff -- "${path}"` : "git diff";
        terminal.addLine(`$ ${cmd}`, "system");
        try {
          const result = await tauriInvoke<{ stdout: string; stderr: string; exit_code: number }>(
            "run_shell_command", { cwd: projectRoot, command: cmd }
          );
          const diff = result.stdout.trim();
          if (!diff) return "No changes.";
          return diff.slice(0, 4000);
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      /* ---- git_commit ---- */
      case "git_commit": {
        const message = args.message as string;
        if (!message) return "Error: Missing commit message.";
        terminal.addLine(`$ git add -A && git commit -m "${message}"`, "system");
        try {
          // Stage all
          await tauriInvoke<{ stdout: string; stderr: string; exit_code: number }>(
            "run_shell_command", { cwd: projectRoot, command: "git add -A" }
          );
          // Commit
          const result = await tauriInvoke<{ stdout: string; stderr: string; exit_code: number }>(
            "run_shell_command", { cwd: projectRoot, command: `git commit -m "${message.replace(/"/g, '\\"')}"` }
          );
          const output = (result.stdout + "\n" + result.stderr).trim();
          terminal.addLine(output.split("\n")[0], "stdout");
          return output.slice(0, 2000) || "Committed.";
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      /* ---- browse_web ---- */
      case "browse_web": {
        const url = args.url as string;
        if (!url) return "Error: Missing url.";
        terminal.addLine(`Browsing: ${url}`, "system");

        // Priority 1: CrawlRocket API (headless browser, works on any page)
        if (settings.crawlRocketKey) {
          const result = await crawlRocketScrape(url);
          if (result) {
            terminal.addLine(`Scraped: ${url}`, "system");
            return result;
          }
        }

        // Priority 2: BrowserOS MCP (full browser with interaction)
        if (settings.browserosEnabled) {
          const nav = await callBrowserOS("navigate_page", { url });
          if (!nav.startsWith("Error:")) {
            await new Promise(r => setTimeout(r, 1500));
            const snapshot = await callBrowserOS("take_snapshot", {});
            terminal.addLine(`Browsed: ${url}`, "system");
            return snapshot;
          }
        }

        // Priority 3: Direct HTTP fetch (basic, no JS)
        try {
          const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
          const res = await tauriFetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "text/html,application/json,text/plain" },
          });
          if (!res.ok) return `Error: HTTP ${res.status} fetching ${url}`;
          const text = await res.text();
          const cleaned = text
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
            .replace(/\s+/g, " ").trim();
          terminal.addLine(`Fetched: ${url} (${cleaned.length} chars)`, "system");
          return smartExcerpt(cleaned) || "Page loaded but no readable text found.";
        } catch (e) {
          return `Error fetching ${url}: ${e}`;
        }
      }

      /* ---- web_search ---- */
      case "web_search": {
        const query = args.query as string;
        if (!query) return "Error: Missing query.";
        if (!settings.crawlRocketKey) return "Error: Web search requires a CrawlRocket API key. Add one in Settings.";
        terminal.addLine(`Searching: ${query}`, "system");
        const limit = Math.min((args.limit as number) || 3, 5);
        const result = await crawlRocketSearch(query, limit);
        terminal.addLine(`Search done: ${query}`, "system");
        return result;
      }

      /* ---- browser_click ---- */
      case "browser_click": {
        if (!settings.browserosEnabled) return "Error: browser_click requires BrowserOS. Enable it in Settings and install BrowserOS from https://github.com/browseros-ai/BrowserOS/releases";
        const selector = args.selector as string;
        if (!selector) return "Error: Missing selector.";
        const result = await callBrowserOS("click", { selector });
        terminal.addLine(`Clicked: ${selector}`, "system");
        return result;
      }

      /* ---- browser_fill ---- */
      case "browser_fill": {
        if (!settings.browserosEnabled) return "Error: browser_fill requires BrowserOS. Enable it in Settings and install BrowserOS from https://github.com/browseros-ai/BrowserOS/releases";
        const selector = args.selector as string;
        const value = args.value as string;
        if (!selector || !value) return "Error: Missing selector or value.";
        const result = await callBrowserOS("fill", { selector, value });
        terminal.addLine(`Filled: ${selector}`, "system");
        return result;
      }

      /* ---- browser_extract ---- */
      case "browser_extract": {
        if (!settings.browserosEnabled) return "Error: browser_extract requires BrowserOS. Enable it in Settings and install BrowserOS from https://github.com/browseros-ai/BrowserOS/releases";
        const selector = (args.selector as string) || undefined;
        const result = await callBrowserOS("get_page_content", selector ? { selector } : {});
        return result;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e) {
    terminal.addLine(`Error: ${e}`, "stderr");
    return `Error: ${e}`;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Shared logic for starting a background server process.
 * Used by both `run_server` and the auto-detected server path in `run_command`.
 */
/**
 * CrawlRocket API — headless browser scraping as a service.
 * Async: submit job → poll for result.
 */
async function crawlRocketRequest(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  const res = await tauriFetch(`https://api.crawlrocket.com${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.crawlRocketKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CrawlRocket ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function crawlRocketPoll(jobId: string, maxWait = 30000): Promise<any> {
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await tauriFetch(`https://api.crawlrocket.com/api/jobs/${jobId}`, {
      headers: { "Authorization": `Bearer ${settings.crawlRocketKey}` },
    });
    const data = await res.json();
    if (data.status === "completed") return data.result;
    if (data.status === "failed") throw new Error(data.error || "Job failed");
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Timeout waiting for CrawlRocket job");
}

async function crawlRocketScrape(url: string): Promise<string | null> {
  try {
    const job = await crawlRocketRequest("/api/scrape", { url });
    const result = await crawlRocketPoll(job.job_id);
    // Format the structured result into readable text
    const parts: string[] = [];
    if (result.title) parts.push(`# ${result.title}`);
    if (result.description || result.meta?.description) parts.push(result.description || result.meta?.description);
    if (result.headings?.length) {
      const headings = result.headings.slice(0, 15).map((h: any) => typeof h === "string" ? h : h.text);
      parts.push("Sections: " + headings.join(" | "));
    }
    if (result.body_text || result.text || result.content) {
      parts.push(smartExcerpt(result.body_text || result.text || result.content, 1500));
    }
    if (result.links?.length) {
      const topLinks = result.links.slice(0, 5).map((l: any) => typeof l === "string" ? l : `${l.text}: ${l.href}`);
      parts.push("Links: " + topLinks.join(" | "));
    }
    return parts.join("\n\n") || null;
  } catch (e) {
    console.error("[Darce] CrawlRocket scrape failed:", e);
    return null; // Fall through to next provider
  }
}

async function crawlRocketSearch(query: string, limit: number): Promise<string> {
  try {
    const job = await crawlRocketRequest("/api/search", { query, limit });
    const result = await crawlRocketPoll(job.job_id);
    if (Array.isArray(result)) {
      return result.map((r: any, i: number) => {
        const parts = [`${i + 1}. ${r.title || r.url}`];
        if (r.url) parts.push(`   ${r.url}`);
        if (r.snippet || r.description || r.body_text) parts.push(`   ${(r.snippet || r.description || r.body_text).slice(0, 120)}`);
        return parts.join("\n");
      }).join("\n\n").slice(0, 4000);
    }
    return JSON.stringify(result).slice(0, 4000);
  } catch (e) {
    return `Error searching: ${e}`;
  }
}

async function executeRunServer(command: string, cwd: string): Promise<string> {
  terminal.addLine(`$ ${command} &`, "system");
  try {
    const id = await processes.start(command, cwd);
    terminal.addLine(`Server started (pid tracked as ${id})`, "system");
    return JSON.stringify({ id, status: "running", command });
  } catch (e) {
    terminal.addLine(`Failed to start server: ${e}`, "stderr");
    return `Error starting server: ${e}`;
  }
}

/**
 * BrowserOS MCP client with proper initialization handshake.
 * MCP protocol requires: initialize → initialized → then tool calls.
 */
let mcpSessionId: string | null = null;
let mcpInitialized = false;

async function mcpRequest(method: string, params: Record<string, unknown>): Promise<any> {
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  const url = `http://127.0.0.1:${settings.browserosPort}/mcp`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (mcpSessionId) headers["Mcp-Session-Id"] = mcpSessionId;

  const response = await tauriFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  // Capture session ID from response
  const sid = response.headers.get("mcp-session-id");
  if (sid) mcpSessionId = sid;

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`MCP ${response.status}: ${text.slice(0, 200)}`);
  }

  const text = await response.text();
  // Response might be SSE or JSON — handle both
  if (text.startsWith("event:") || text.startsWith("data:")) {
    // Parse SSE — find the last data line with a JSON-RPC result
    const lines = text.split("\n");
    for (const line of lines.reverse()) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") {
          try { return JSON.parse(data); } catch { /* continue */ }
        }
      }
    }
    return null;
  }
  return JSON.parse(text);
}

async function ensureMcpInit(): Promise<boolean> {
  if (mcpInitialized) return true;
  try {
    const initResult = await mcpRequest("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "Darce", version: "0.1.0" },
    });
    if (initResult?.result) {
      // Send initialized notification (no response expected, but send anyway)
      try { await mcpRequest("notifications/initialized", {}); } catch { /* ok */ }
      mcpInitialized = true;
      console.log("[Darce] BrowserOS MCP initialized", initResult.result);
      return true;
    }
    return false;
  } catch (e) {
    console.error("[Darce] BrowserOS MCP init failed:", e);
    mcpInitialized = false;
    mcpSessionId = null;
    return false;
  }
}

async function callBrowserOS(toolName: string, args: Record<string, unknown>): Promise<string> {
  if (!settings.browserosEnabled) {
    return "Error: BrowserOS is not enabled. Enable it in Settings.";
  }

  try {
    // Initialize MCP session if needed
    if (!await ensureMcpInit()) {
      return "Error: Cannot connect to BrowserOS MCP. Make sure BrowserOS is running and MCP server is enabled.";
    }

    const result = await mcpRequest("tools/call", { name: toolName, arguments: args });

    if (result?.error) {
      return `Error: ${result.error.message || JSON.stringify(result.error)}`;
    }

    // MCP tool results come in result.result.content array
    const content = result?.result?.content;
    if (Array.isArray(content)) {
      return content
        .map((c: any) => {
          if (c.type === "text") return c.text;
          if (c.type === "image") return `[Image: ${c.mimeType}]`;
          return JSON.stringify(c);
        })
        .join("\n")
        .slice(0, 4000);
    }

    return JSON.stringify(result?.result).slice(0, 4000);
  } catch (e) {
    const msg = String(e);
    // Reset session on connection errors so we re-init next time
    mcpInitialized = false;
    mcpSessionId = null;
    if (msg.includes("fetch") || msg.includes("connect") || msg.includes("ECONNREFUSED") || msg.includes("Failed")) {
      return "Error: Cannot connect to BrowserOS at port " + settings.browserosPort + ". Make sure BrowserOS is running.";
    }
    return `Error: ${msg}`;
  }
}

/**
 * Smart excerpt — sample a page instead of dumping everything.
 * Returns: title + headings + top/mid/bottom snippets.
 * ~1500 chars total — enough for the model, fast to process.
 */
function smartExcerpt(text: string, maxLen = 2000): string {
  if (text.length <= maxLen) return text;

  const lines = text.split("\n").filter(l => l.trim().length > 5);
  if (lines.length === 0) return text.slice(0, maxLen);

  const parts: string[] = [];

  // Top section (first ~500 chars worth of lines)
  let topChars = 0;
  for (const line of lines) {
    if (topChars > 500) break;
    parts.push(line);
    topChars += line.length;
  }

  // Middle section
  const midStart = Math.floor(lines.length * 0.4);
  let midChars = 0;
  parts.push("\n[...]\n");
  for (let i = midStart; i < lines.length && midChars < 400; i++) {
    parts.push(lines[i]);
    midChars += lines[i].length;
  }

  // Bottom section
  const botStart = Math.max(lines.length - 8, Math.floor(lines.length * 0.8));
  if (botStart > midStart + 10) {
    let botChars = 0;
    parts.push("\n[...]\n");
    for (let i = botStart; i < lines.length && botChars < 300; i++) {
      parts.push(lines[i]);
      botChars += lines[i].length;
    }
  }

  const result = parts.join("\n");
  return result.slice(0, maxLen);
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
