<script lang="ts">
  import Shimmer from "$lib/components/ui/Shimmer.svelte";
  import { chat } from "$lib/stores/chat.svelte";
  import { project } from "$lib/stores/project.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { processes } from "$lib/stores/processes.svelte";
  import { buildProjectContext, loadDarceFiles } from "$lib/providers/context";
  import { runAgent, type AgentMessage } from "$lib/providers/agent";

  let messagesEnd: HTMLDivElement;
  let input = $state("");
  let statusText = $state("");
  let abortController: AbortController | null = null;

  function stopGeneration() {
    tokenBuffer = "";
    if (tokenRafId) { cancelAnimationFrame(tokenRafId); tokenRafId = null; }
    abortController?.abort();
    abortController = null;
    stopElapsedTimer();
    if (chat.isStreaming) {
      if (chat.streamingContent) {
        chat.finishStreaming(settings.defaultModel, project.path || "no-project");
      } else {
        chat.setError("Stopped.");
      }
    }
    statusText = "";
    liveActions = [];
  }
  let liveActions = $state<{ id: number; idx: number; type: string; name: string; path?: string; lines?: number; command?: string; code?: string; edits?: { old_text: string; new_text: string }[]; result?: string; done: boolean; collapsed?: boolean; startedAt?: number }[]>([]);
  let actionCounter = 0;

  // RAF-buffered token rendering — prevents layout thrash
  let tokenBuffer = "";
  let tokenRafId: number | null = null;

  function flushTokenBuffer() {
    tokenRafId = null;
    if (tokenBuffer) {
      chat.appendToken(tokenBuffer);
      tokenBuffer = "";
    }
  }
  let currentModel = $state("");
  let streamingToolNames = $state<Map<number, string>>(new Map());
  let streamingToolLines = $state<Map<number, number>>(new Map());
  let streamingToolCode = $state<Map<number, string>>(new Map());
  let currentIteration = $state(0);
  let agentPhase = $state<"thinking" | "acting" | "continuing" | "idle">("idle");
  let agentStartTime = $state(0);
  let elapsedSeconds = $state(0);
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;

  function startElapsedTimer() {
    agentStartTime = Date.now();
    elapsedSeconds = 0;
    elapsedTimer = setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - agentStartTime) / 1000);
    }, 1000);
  }

  function stopElapsedTimer() {
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
    elapsedSeconds = 0;
    currentIteration = 0;
    agentPhase = "idle";
  }

  // Scroll — throttled to avoid DOM thrashing
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  function scrollToBottom() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      messagesEnd?.scrollIntoView({ behavior: "instant" });
      scrollTimer = null;
    }, 50);
  }
  $effect(() => {
    if (chat.messages.length || chat.isStreaming || liveActions.length) {
      scrollToBottom();
    }
  });

  // System prompt — this is the brain of the agent
  const CORE_PROMPT = `You are Darce, an expert AI coding agent.

BE FAST. Every tool call is a network round-trip. Minimize iterations:
- Read the file tree in context FIRST — it's already provided. Don't call list_files if you can see the tree.
- If you can see the file you need in the tree, read_file it directly. Don't search.
- search_files ONLY when you don't know which file to edit.
- After 1 read, ACT. Don't read 3 files to find one thing.
- Call multiple tools in ONE response when they're independent (parallel execution).

RULES:
- NEVER ask questions. Find answers yourself with tools.
- NEVER write plans/bullets. Just act. User sees actions live.
- Use edit_file for changes, create_file for new files only.
- If a dev server is running, restart it after changes.
- Write complete code. No TODOs. No placeholders.
- Keep text to 1-2 sentences between tool calls.
- Use save_memory to remember project patterns across conversations.`;

  const GEAR_PROMPTS: Record<string, string> = {
    ship: CORE_PROMPT + "\n\nMODE: Ship. Maximum speed. Minimal explanation. Build and move on.",
    understand: CORE_PROMPT + "\n\nMODE: Understand. After each action, briefly explain the pattern used, the decision made, and what alternatives exist. Keep it concise and insightful. Explain WHILE acting, not in separate messages.",
    learn: CORE_PROMPT + "\n\nMODE: Learn. Before writing code, ask what approach the user would take. After building, explain the key concepts and ask one question to test understanding. Explain while acting, not in separate messages.",
  };

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || chat.isStreaming || !settings.hasApiKey) return;
    input = "";
    liveActions = [];
    statusText = "Thinking...";
    currentModel = "";
    abortController = new AbortController();

    const projectId = project.path || "no-project";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const context = `[Date: ${dateStr}, ${timeStr}]\n` + buildProjectContext();

    chat.addUserMessage(trimmed, projectId);
    chat.startStreaming();
    startElapsedTimer();

    // Load .darce project files (instructions + memory) and build dynamic prompt
    let systemPrompt = GEAR_PROMPTS[settings.gear] || GEAR_PROMPTS.ship;
    if (project.path) {
      const darce = await loadDarceFiles(project.path);
      if (darce.instructions) {
        systemPrompt += "\n\nPROJECT INSTRUCTIONS (from .darce/instructions.md — follow these):\n" + darce.instructions;
      }
      if (darce.memory) {
        systemPrompt += "\n\nPROJECT MEMORY (from .darce/memory.md — context from previous conversations):\n" + darce.memory;
      }
    }

    const agentMessages: AgentMessage[] = [];
    const recent = chat.messages.slice(-6, -1);
    for (const m of recent) agentMessages.push({ role: m.role, content: m.content });
    agentMessages.push({ role: "user", content: context + "\n\n" + trimmed });

    await runAgent(
      settings.activeKey, settings.defaultModel, agentMessages,
      systemPrompt,
      {
        onToken(token) {
          // Don't clear statusText to "" — that creates dead UI.
          // Instead set a subtle indicator that we're streaming.
          if (statusText && statusText !== "Streaming...") {
            statusText = "Streaming...";
          }
          // Buffer tokens, flush once per animation frame
          tokenBuffer += token;
          if (!tokenRafId) {
            tokenRafId = requestAnimationFrame(flushTokenBuffer);
          }
        },
        onToolStreaming(index, name, _chunk, totalArgs) {
          // Track tool name as it streams in (name only arrives on first chunk)
          if (name) {
            console.log(`[Darce UI] Tool streaming started: index=${index} name=${name}`);
            if (!streamingToolNames.has(index)) {
              streamingToolNames = new Map(streamingToolNames).set(index, name);
            }
          }

          // Use the stored name — `name` param is empty after first chunk
          const toolName = streamingToolNames.get(index) || name;
          if (totalArgs.length % 200 === 0) console.log(`[Darce UI] Tool ${toolName} args: ${totalArgs.length} chars`);

          if (toolName === "create_file") {
            try {
              const pathMatch = totalArgs.match(/"path"\s*:\s*"([^"]+)"/);
              const contentSoFar = totalArgs.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
              if (contentSoFar) {
                const decoded = contentSoFar[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');
                const lines = decoded.split("\n").length;
                streamingToolLines = new Map(streamingToolLines).set(index, lines);
                streamingToolCode = new Map(streamingToolCode).set(index, decoded);
              }
              if (pathMatch) {
                const existingAction = liveActions.find(a => a.idx === index && !a.done);
                if (!existingAction) {
                  const id = ++actionCounter;
                  liveActions = [...liveActions, { id, idx: index, type: "tool", name: "create_file", path: pathMatch[1], lines: 0, code: "", done: false, collapsed: false, startedAt: Date.now() }];
                  statusText = `Writing ${pathMatch[1]}...`;
                } else {
                  liveActions = liveActions.map(a =>
                    a.idx === index && !a.done ? { ...a, lines: streamingToolLines.get(index) || 0, code: streamingToolCode.get(index) || "" } : a
                  );
                }
              }
            } catch { /* partial JSON, skip */ }
          } else if (toolName === "run_command" && !liveActions.find(a => a.idx === index)) {
            try {
              const cmdMatch = totalArgs.match(/"command"\s*:\s*"([^"]+)"/);
              if (cmdMatch) {
                const id = ++actionCounter;
                liveActions = [...liveActions, { id, idx: index, type: "tool", name: "run_command", command: cmdMatch[1], done: false, startedAt: Date.now() }];
                statusText = `Will run: ${cmdMatch[1]}`;
              }
            } catch { /* skip */ }
          } else if (toolName === "read_file" && !liveActions.find(a => a.idx === index)) {
            try {
              const pathMatch = totalArgs.match(/"path"\s*:\s*"([^"]+)"/);
              if (pathMatch) {
                const id = ++actionCounter;
                liveActions = [...liveActions, { id, idx: index, type: "tool", name: "read_file", path: pathMatch[1], done: false, startedAt: Date.now() }];
                statusText = `Reading ${pathMatch[1]}...`;
              }
            } catch { /* skip */ }
          } else if (toolName === "edit_file") {
            try {
              const pathMatch = totalArgs.match(/"path"\s*:\s*"([^"]+)"/);
              const existing = liveActions.find(a => a.idx === index);
              if (pathMatch && !existing) {
                const id = ++actionCounter;
                liveActions = [...liveActions, { id, idx: index, type: "tool", name: "edit_file", path: pathMatch[1], done: false, collapsed: false, edits: [], startedAt: Date.now() }];
                statusText = `Editing ${pathMatch[1]}...`;
              }
              // Try to parse edits array to show preview
              if (existing || pathMatch) {
                try {
                  // Extract edits — try partial JSON parse
                  const editsMatch = totalArgs.match(/"edits"\s*:\s*\[([\s\S]*)/);
                  if (editsMatch) {
                    const editCount = (editsMatch[1].match(/"old_text"/g) || []).length;
                    const action = liveActions.find(a => a.idx === index);
                    if (action && editCount > 0) {
                      statusText = `Editing ${action.path} (${editCount} change${editCount > 1 ? 's' : ''})...`;
                    }
                  }
                } catch {}
              }
            } catch {}
          } else if (toolName === "search_files" && !liveActions.find(a => a.idx === index)) {
            try {
              const patMatch = totalArgs.match(/"pattern"\s*:\s*"([^"]+)"/);
              if (patMatch) {
                const id = ++actionCounter;
                liveActions = [...liveActions, { id, idx: index, type: "tool", name: "search_files", command: patMatch[1], done: false, startedAt: Date.now() }];
                statusText = `Searching "${patMatch[1]}"...`;
              }
            } catch {}
          } else if ((toolName === "browse_web" || toolName === "browser_click" || toolName === "browser_fill" || toolName === "browser_extract") && !liveActions.find(a => a.idx === index)) {
            try {
              let label = "";
              if (toolName === "browse_web") {
                const urlMatch = totalArgs.match(/"url"\s*:\s*"([^"]+)"/);
                label = urlMatch ? urlMatch[1] : "browsing...";
              } else if (toolName === "browser_click") {
                const selMatch = totalArgs.match(/"selector"\s*:\s*"([^"]+)"/);
                label = selMatch ? `click ${selMatch[1]}` : "clicking...";
              } else if (toolName === "browser_fill") {
                const selMatch = totalArgs.match(/"selector"\s*:\s*"([^"]+)"/);
                label = selMatch ? `fill ${selMatch[1]}` : "filling...";
              } else {
                label = "extracting...";
              }
              const id = ++actionCounter;
              liveActions = [...liveActions, { id, idx: index, type: "tool", name: toolName, command: label, done: false, startedAt: Date.now() }];
              statusText = toolName === "browse_web" ? `Browsing ${label}...` : `${label}...`;
            } catch {}
          }
        },
        onToolStart(name, args) {
          console.log(`[Darce UI] onToolStart: ${name}`, args);
          // Tool is fully parsed and about to execute — mark existing or create new
          const existing = liveActions.find(a => a.name === name && !a.done);
          if (!existing) {
            const id = ++actionCounter;
            const action: typeof liveActions[0] = { id, idx: -1, type: "tool", name, done: false, startedAt: Date.now() };
            if (name === "create_file") {
              action.path = args.path as string;
              const content = (args.content as string) || "";
              action.lines = content.split("\n").length;
              action.code = content;
              action.collapsed = false;
            } else if (name === "read_file") { action.path = args.path as string; }
            else if (name === "run_command") { action.command = args.command as string; }
            else if (name === "delete_file") { action.path = args.path as string; }
            else if (name === "edit_file") {
              action.path = args.path as string;
              action.edits = (args.edits as { old_text: string; new_text: string }[]) || [];
              action.collapsed = false;
            }
            else if (name === "search_files") { action.command = args.pattern as string; }
            else if (name === "run_server") { action.command = args.command as string; }
            else if (name === "stop_process") { action.command = args.id as string; }
            else if (name === "restart_process") { action.command = args.id as string; }
            else if (name === "open_url") { action.command = args.url as string; }
            else if (name === "save_memory") { action.command = "memory"; }
            else if (name === "glob_files") { action.command = args.pattern as string; }
            else if (name === "git_status") { action.command = "git status"; }
            else if (name === "git_diff") { action.command = args.path ? `diff ${args.path}` : "git diff"; }
            else if (name === "git_commit") { action.command = args.message as string; }
            else if (name === "web_search") { action.command = args.query as string; }
            else if (name === "browse_web") { action.command = args.url as string; }
            else if (name === "browser_click") { action.command = `click ${args.selector}`; }
            else if (name === "browser_fill") { action.command = `fill ${args.selector}`; }
            else if (name === "browser_extract") { action.command = "extract page"; }
            liveActions = [...liveActions, action];
          } else {
            // Update the streaming-created action with full parsed args
            if (name === "create_file") {
              const content = (args.content as string) || "";
              liveActions = liveActions.map(a =>
                a === existing ? { ...a, path: args.path as string, lines: content.split("\n").length, code: content } : a
              );
            } else if (name === "edit_file") {
              const edits = (args.edits as { old_text: string; new_text: string }[]) || [];
              liveActions = liveActions.map(a =>
                a === existing ? { ...a, path: args.path as string, edits } : a
              );
            } else {
              // For all other tools, update command/path from full args
              const cmd = (args.url || args.query || args.command || args.path || args.selector || args.id || "") as string;
              if (cmd) {
                liveActions = liveActions.map(a =>
                  a === existing ? { ...a, command: cmd, path: (args.path as string) || a.path } : a
                );
              }
            }
          }
          statusText = name === "create_file" ? `Writing ${args.path}...`
            : name === "edit_file" ? `Editing ${args.path}...`
            : name === "run_command" ? `Running ${args.command}...`
            : name === "run_server" ? `Starting ${args.command}...`
            : name === "read_file" ? `Reading ${args.path}...`
            : name === "search_files" ? `Searching "${args.pattern}"...`
            : name === "list_files" ? "Scanning..."
            : name === "stop_process" ? "Stopping process..."
            : name === "restart_process" ? "Restarting process..."
            : name === "open_url" ? `Opening ${args.url}...`
            : name === "save_memory" ? "Saving memory..."
            : name === "glob_files" ? `Finding ${args.pattern}...`
            : name === "git_status" ? "Checking git..."
            : name === "git_diff" ? "Checking diff..."
            : name === "git_commit" ? "Committing..."
            : name === "web_search" ? `Searching "${args.query}"...`
            : name === "browse_web" ? `Browsing ${args.url}...`
            : name === "browser_click" ? `Clicking ${args.selector}...`
            : name === "browser_fill" ? `Filling ${args.selector}...`
            : name === "browser_extract" ? "Extracting page content..."
            : `${name}...`;
        },
        onToolEnd(name, result) {
          console.log(`[Darce UI] onToolEnd: ${name}`, result.slice(0, 100));
          liveActions = liveActions.map((a) =>
            a.name === name && !a.done ? { ...a, done: true, result: result.slice(0, 500) } : a
          );
          // Always show something — never go blank
          const pendingTools = liveActions.filter(a => !a.done).length;
          if (pendingTools > 0) {
            statusText = `Running ${pendingTools} more...`;
          } else {
            statusText = "Continuing...";
          }
          streamingToolNames = new Map();
          streamingToolLines = new Map();
          streamingToolCode = new Map();
        },
        onModelUsed(model) {
          currentModel = model.split("/").pop() || model;
        },
        onIteration(iteration, phase) {
          currentIteration = iteration;
          agentPhase = phase;
          if (phase === "continuing") {
            // Contextual status based on what tools were just used
            const lastDone = liveActions.filter(a => a.done);
            const lastTool = lastDone[lastDone.length - 1]?.name;
            if (lastTool === "read_file" || lastTool === "search_files") {
              statusText = "Analyzing results...";
            } else if (lastTool === "edit_file" || lastTool === "create_file") {
              statusText = "Reviewing changes...";
            } else if (lastTool === "run_command") {
              statusText = "Checking output...";
            } else if (lastTool === "list_files") {
              statusText = "Planning approach...";
            } else {
              statusText = "Working...";
            }
          } else if (phase === "acting") {
            statusText = "Executing...";
          } else if (phase === "thinking") {
            statusText = "Thinking...";
          }
        },
        onDone(finalText, modelUsed) {
          if (tokenBuffer) { chat.appendToken(tokenBuffer); tokenBuffer = ""; }
          if (tokenRafId) { cancelAnimationFrame(tokenRafId); tokenRafId = null; }
          statusText = "";
          stopElapsedTimer();
          let displayContent = finalText;
          if (liveActions.length > 0) {
            const actionLines = liveActions.map((a) => {
              if (a.name === "create_file") return `  Created[${a.lines || 0}] ${a.path}`;
              if (a.name === "edit_file") return `  Edited ${a.path}`;
              if (a.name === "run_command") return `  $ ${a.command}`;
              if (a.name === "run_server") return `  Started ${a.command}`;
              if (a.name === "delete_file") return `  Deleted ${a.path}`;
              if (a.name === "read_file") return `  Read ${a.path}`;
              if (a.name === "search_files") return `  Searched "${a.command}"`;
              if (a.name === "list_files") return `  Scanned project`;
              if (a.name === "stop_process") return `  Stopped ${a.command}`;
              if (a.name === "restart_process") return `  Restarted ${a.command}`;
              if (a.name === "open_url") return `  Opened ${a.command}`;
              if (a.name === "save_memory") return `  Saved memory`;
              if (a.name === "glob_files") return `  Found files: ${a.command}`;
              if (a.name === "git_status") return `  Git status`;
              if (a.name === "git_diff") return `  Git diff`;
              if (a.name === "git_commit") return `  Committed: ${a.command}`;
              if (a.name === "web_search") return `  Searched "${a.command}"`;
              if (a.name === "browse_web") return `  Browsed ${a.command}`;
              if (a.name === "browser_click") return `  ${a.command}`;
              if (a.name === "browser_fill") return `  ${a.command}`;
              if (a.name === "browser_extract") return `  Extracted page content`;
              return `  ${a.name}`;
            });
            displayContent = (displayContent ? displayContent + "\n\n" : "") + "Actions:\n" + actionLines.join("\n");
          }
          chat.streamingContent = displayContent;
          chat.finishStreaming(modelUsed || settings.defaultModel, projectId);
          liveActions = [];
          streamingToolNames = new Map();
          streamingToolLines = new Map();
          streamingToolCode = new Map();
        },
        onError(error) {
          if (tokenBuffer) { chat.appendToken(tokenBuffer); tokenBuffer = ""; }
          if (tokenRafId) { cancelAnimationFrame(tokenRafId); tokenRafId = null; }
          statusText = "";
          stopElapsedTimer();
          if (chat.streamingContent) chat.finishStreaming(settings.defaultModel, projectId);
          chat.setError(error);
          liveActions = [];
          streamingToolNames = new Map();
          streamingToolLines = new Map();
          streamingToolCode = new Map();
        },
      },
    );
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // Update process elapsed times
  let processTickCounter = $state(0);
  let processTick: ReturnType<typeof setInterval> | null = null;
  $effect(() => {
    if (processes.running > 0 && !processTick) {
      processTick = setInterval(() => { processTickCounter++; }, 1000);
    } else if (processes.running === 0 && processTick) {
      clearInterval(processTick);
      processTick = null;
    }
  });

  function formatDuration(startedAt?: number): string {
    if (!startedAt) return "";
    const ms = Date.now() - startedAt;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  function procElapsed(startedAt: number): string {
    // Reference processTickCounter to create reactive dependency
    void processTickCounter;
    return `${Math.floor((Date.now() - startedAt) / 1000)}s`;
  }

  // Simple markdown renderer (tables, bold, code, headers)
  function renderMarkdown(text: string): string {
    let html = text
      // Escape HTML
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-zinc-800/50 rounded-md p-2.5 my-1.5 text-[11px] font-mono text-zinc-300 overflow-x-auto"><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-zinc-800/60 px-1 py-0.5 rounded text-[11px] text-zinc-300">$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
      // Headers
      .replace(/^### (.+)$/gm, '<div class="text-xs font-semibold text-zinc-200 mt-2 mb-1">$1</div>')
      .replace(/^## (.+)$/gm, '<div class="text-sm font-semibold text-zinc-200 mt-2 mb-1">$1</div>')
      // Bullet lists
      .replace(/^- (.+)$/gm, '<div class="flex gap-1.5 ml-1"><span class="text-zinc-600">·</span><span>$1</span></div>')
      // Numbered lists
      .replace(/^(\d+)\. (.+)$/gm, '<div class="flex gap-1.5 ml-1"><span class="text-zinc-500">$1.</span><span>$2</span></div>');

    // Tables
    const tableRegex = /\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g;
    html = html.replace(tableRegex, (_, header, body) => {
      const heads = header.split("|").map((h: string) => h.trim()).filter(Boolean);
      const rows = body.trim().split("\n").map((r: string) =>
        r.split("|").map((c: string) => c.trim()).filter(Boolean)
      );
      return `<table class="w-full text-[11px] my-1.5 border-collapse">
        <thead><tr>${heads.map((h: string) => `<th class="text-left text-zinc-400 font-medium py-1 px-2 border-b border-zinc-800">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r: string[]) => `<tr>${r.map((c: string) => `<td class="py-1 px-2 border-b border-zinc-800/50 text-zinc-300">${c}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
    });

    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  // Display helpers
  type MsgPart =
    | { type: "text"; text: string }
    | { type: "file_created"; path: string; lines: number }
    | { type: "file_edited"; path: string }
    | { type: "file_read"; path: string }
    | { type: "command"; command: string }
    | { type: "file_deleted"; path: string };

  function parseParts(content: string): MsgPart[] {
    const parts: MsgPart[] = [];
    const actIdx = content.indexOf("Actions:\n");
    const text = actIdx >= 0 ? content.slice(0, actIdx).trim() : content;
    const actions = actIdx >= 0 ? content.slice(actIdx + 9) : "";
    if (text) parts.push({ type: "text", text });
    for (const line of actions.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const cr = t.match(/^Created\[(\d+)\]\s+(.+)/);
      if (cr) { parts.push({ type: "file_created", path: cr[2], lines: parseInt(cr[1]) }); continue; }
      if (t.startsWith("Edited ")) { parts.push({ type: "file_edited", path: t.slice(7) }); continue; }
      if (t.startsWith("$ ")) { parts.push({ type: "command", command: t.slice(2) }); continue; }
      if (t.startsWith("Started ")) { parts.push({ type: "command", command: t.slice(8) }); continue; }
      if (t.startsWith("Deleted ")) { parts.push({ type: "file_deleted", path: t.slice(8) }); continue; }
      if (t.startsWith("Read ")) { parts.push({ type: "file_read", path: t.slice(5) }); continue; }
      if (t.startsWith("Searched ")) { parts.push({ type: "text", text: t }); continue; }
      if (t.startsWith("Scanned")) continue;
      if (t.startsWith("Stopped ")) { parts.push({ type: "text", text: t }); continue; }
      if (t.startsWith("Restarted ")) { parts.push({ type: "text", text: t }); continue; }
      if (t.startsWith("Opened ")) { parts.push({ type: "text", text: t }); continue; }
      parts.push({ type: "text", text: t });
    }
    if (parts.length === 0) parts.push({ type: "text", text: content });
    return parts;
  }
</script>

<aside class="h-full bg-zinc-900/95 border-l border-zinc-800/80 flex flex-col overflow-hidden">
  <div class="px-3 py-1.5 border-b border-zinc-800/60 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Chat</span>
      {#if chat.isStreaming}
        <div class="flex items-center gap-1.5">
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-glow"></div>
          <span class="text-[10px] text-emerald-400/80">{statusText || "Working"}</span>
          {#if elapsedSeconds > 0}
            <span class="text-[9px] text-zinc-600 font-mono tabular-nums">{elapsedSeconds}s</span>
          {/if}
          {#if currentModel}
            <span class="text-[9px] text-zinc-600 font-mono">{currentModel}</span>
          {/if}
          {#if liveActions.length > 0}
            <span class="text-[9px] text-zinc-600">{liveActions.filter(a => a.done).length}/{liveActions.length}</span>
          {/if}
        </div>
      {/if}
    </div>
    <div class="flex items-center gap-1">
      {#if chat.messages.length > 0 && !chat.isStreaming}
        <button onclick={() => { if (project.path) chat.clear(project.path); }}
          class="text-[10px] text-zinc-600 hover:text-zinc-300 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors"
          title="New chat">New</button>
      {/if}
    </div>
  </div>

  <div class="flex-1 p-3 space-y-3 overflow-auto chat-scroll">
    {#if chat.messages.length === 0 && !chat.isStreaming}
      <div class="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <p class="text-[12px] text-zinc-500">What do you want to build?</p>
        <div class="space-y-1.5 w-full max-w-[220px]">
          {#each [
            "Build a landing page",
            "Create a REST API",
            "Fix a bug in my code",
            "Add dark mode to this project",
          ] as suggestion}
            <button onclick={() => { input = suggestion; }}
              class="w-full text-left text-[11px] text-zinc-600 hover:text-zinc-300 px-2.5 py-1.5 rounded border border-zinc-800/40 hover:border-zinc-700/50 hover:bg-zinc-800/30 transition-all">
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#each chat.messages as msg (msg.id)}
      <div class="chat-message-item flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-1" style="animation-duration: 80ms;">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider {msg.role === 'user' ? 'text-accent' : 'text-emerald-400'}">
            {msg.role === "user" ? "You" : "Darce"}
          </span>
          {#if msg.role === "assistant" && msg.model && settings.provider !== "manual"}
            <span class="text-[9px] text-zinc-600 font-mono">{msg.model.split("/").pop()}</span>
          {/if}
        </div>
        {#each parseParts(msg.content) as part}
          {#if part.type === "text"}
            <div class="text-[13px] text-zinc-300 leading-relaxed chat-text">{@html renderMarkdown(part.text)}</div>
          {:else if part.type === "file_created"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-950/20 border border-emerald-900/30 rounded-md text-xs animate-in fade-in" style="animation-duration: 80ms;">
              <span class="text-emerald-400 font-mono text-[11px] font-semibold">+{part.lines}</span>
              <span class="text-zinc-400 font-mono text-[11px]">{part.path}</span>
            </div>
          {:else if part.type === "file_edited"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-amber-950/20 border border-amber-900/30 rounded-md text-xs animate-in fade-in" style="animation-duration: 80ms;">
              <span class="text-amber-400 text-[11px]">edit</span>
              <span class="text-zinc-400 font-mono text-[11px]">{part.path}</span>
            </div>
          {:else if part.type === "file_read"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800/40 border border-zinc-700/30 rounded-md text-xs animate-in fade-in" style="animation-duration: 80ms;">
              <span class="text-zinc-500 text-[11px]">read</span>
              <span class="text-zinc-400 font-mono text-[11px]">{part.path}</span>
            </div>
          {:else if part.type === "command"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-blue-950/20 border border-blue-900/30 rounded-md text-xs font-mono animate-in fade-in" style="animation-duration: 80ms;">
              <span class="text-blue-400 text-[11px]">$</span>
              <span class="text-zinc-400 text-[11px]">{part.command}</span>
            </div>
          {:else if part.type === "file_deleted"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-red-950/20 border border-red-900/30 rounded-md text-xs animate-in fade-in" style="animation-duration: 80ms;">
              <span class="text-red-400 font-mono text-[11px]">-</span>
              <span class="text-zinc-400 font-mono text-[11px]">{part.path}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/each}

    <!-- Live streaming -->
    {#if chat.isStreaming}
      <div class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Darce</span>

        <!-- Streaming text -->
        {#if chat.streamingContent}
          <div class="text-[13px] text-zinc-300 leading-relaxed chat-text">
            {@html renderMarkdown(chat.streamingContent)}{#if agentPhase !== "acting"}<span class="cursor-blink"></span>{/if}
          </div>
        {/if}

        <!-- Live tool actions -->
        {#each liveActions as action (action.id)}
          {#if action.name === "create_file"}
            <div class="rounded-md overflow-hidden animate-in fade-in slide-in-from-bottom-1 {action.done ? 'border border-emerald-900/30' : 'border border-emerald-900/20'}" style="animation-duration: 80ms;">
              <!-- File header -->
              <button onclick={() => { liveActions = liveActions.map(a => a.id === action.id ? { ...a, collapsed: !a.collapsed } : a); }}
                class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-emerald-950/30 transition-colors {action.done ? 'bg-emerald-950/20' : 'bg-emerald-950/10'}">
                <svg class="w-3 h-3 text-zinc-500 flex-shrink-0 transition-transform {action.collapsed ? '' : 'rotate-90'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
                <span class="text-emerald-400 font-mono text-[11px] font-semibold tabular-nums">+{action.lines || 0}</span>
                <span class="text-zinc-400 font-mono text-[11px] truncate">{action.path || "..."}</span>
                {#if !action.done}
                  <div class="shimmer w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto"></div>
                {/if}
                {#if action.done && action.startedAt}
                  <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
                {/if}
              </button>
              <!-- Live code preview -->
              {#if !action.collapsed && action.code}
                <div class="max-h-48 overflow-auto bg-zinc-950/60">
                  <pre class="p-2 text-[10px] leading-relaxed font-mono text-zinc-400 whitespace-pre-wrap break-all"><code>{action.code}</code>{#if !action.done}<span class="cursor-blink"></span>{/if}</pre>
                </div>
              {/if}
            </div>
          {:else if action.name === "run_command"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-mono animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-blue-950/20 border border-blue-900/30' : 'bg-blue-950/10 border border-blue-900/20'}" style="animation-duration: 80ms;">
              {#if action.done}
                <span class="text-blue-400 text-[11px]">$</span>
              {:else}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {/if}
              <span class="text-zinc-400 text-[11px] truncate">{action.command}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "read_file"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-zinc-800/40 border border-zinc-700/30' : 'bg-zinc-800/20 border border-zinc-700/20'}" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {:else}
                <span class="text-zinc-500 text-[11px]">read</span>
              {/if}
              <span class="text-zinc-400 font-mono text-[11px]">{action.path}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "list_files"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800/20 border border-zinc-700/20 rounded-md text-xs animate-in fade-in" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {/if}
              <span class="text-zinc-500 text-[11px]">Scanning project files</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "edit_file"}
            <div class="rounded-md overflow-hidden animate-in fade-in slide-in-from-bottom-1 {action.done ? 'border border-amber-900/30' : 'border border-amber-900/20'}" style="animation-duration: 80ms;">
              <!-- Edit header -->
              <button onclick={() => { liveActions = liveActions.map(a => a.id === action.id ? { ...a, collapsed: !a.collapsed } : a); }}
                class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-amber-950/30 transition-colors {action.done ? 'bg-amber-950/20' : 'bg-amber-950/10'}">
                {#if action.edits && action.edits.length > 0}
                  <svg class="w-3 h-3 text-zinc-500 flex-shrink-0 transition-transform {action.collapsed ? '' : 'rotate-90'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
                {/if}
                {#if !action.done}
                  <div class="shimmer w-1.5 h-1.5 rounded-full flex-shrink-0"></div>
                {:else}
                  <span class="text-amber-400 text-[11px] font-semibold">{action.edits ? action.edits.length : '?'}</span>
                {/if}
                <span class="text-amber-400 text-[11px]">edit</span>
                <span class="text-zinc-400 font-mono text-[11px] truncate">{action.path}</span>
                {#if action.done && action.result}
                  <span class="text-zinc-600 text-[10px] ml-auto">{action.result.split('\n')[0]} {formatDuration(action.startedAt)}</span>
                {/if}
              </button>
              <!-- Edit diff preview -->
              {#if !action.collapsed && action.edits && action.edits.length > 0}
                <div class="max-h-64 overflow-auto bg-zinc-950/60">
                  {#each action.edits as edit, i}
                    <div class="border-t border-amber-900/10 {i > 0 ? '' : ''}">
                      {#if edit.old_text}
                        <pre class="px-2 py-1 text-[10px] leading-relaxed font-mono text-red-400/70 bg-red-950/10 whitespace-pre-wrap break-all">- {edit.old_text.slice(0, 200)}{edit.old_text.length > 200 ? '...' : ''}</pre>
                      {/if}
                      {#if edit.new_text}
                        <pre class="px-2 py-1 text-[10px] leading-relaxed font-mono text-emerald-400/70 bg-emerald-950/10 whitespace-pre-wrap break-all">+ {edit.new_text.slice(0, 200)}{edit.new_text.length > 200 ? '...' : ''}</pre>
                      {:else}
                        <pre class="px-2 py-1 text-[10px] font-mono text-zinc-600 bg-zinc-950/20">(deleted)</pre>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {:else if action.name === "search_files"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-purple-950/20 border border-purple-900/30' : 'bg-purple-950/10 border border-purple-900/20'}" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {:else}
                <span class="text-purple-400 text-[11px]">search</span>
              {/if}
              <span class="text-zinc-400 font-mono text-[11px]">"{action.command}"</span>
              {#if action.done && action.result}
                <span class="text-zinc-600 text-[10px] ml-auto">{action.result.split('\n')[0].slice(0, 40)}</span>
              {/if}
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "run_server"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-mono animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-emerald-950/20 border border-emerald-900/30' : 'bg-emerald-950/10 border border-emerald-900/20'}" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-glow flex-shrink-0"></div>
              {:else}
                <span class="text-emerald-400 text-[11px]">●</span>
              {/if}
              <span class="text-zinc-400 text-[11px] truncate">{action.command}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "stop_process"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 bg-red-950/20 border border-red-900/30" style="animation-duration: 80ms;">
              <span class="text-red-400 text-[11px]">stop</span>
              <span class="text-zinc-400 font-mono text-[11px]">{action.command}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "restart_process"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-mono animate-in fade-in slide-in-from-bottom-1 bg-blue-950/20 border border-blue-900/30" style="animation-duration: 80ms;">
              <span class="text-blue-400 text-[11px]">restart</span>
              <span class="text-zinc-400 text-[11px]">{action.command}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "open_url"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 bg-zinc-800/40 border border-zinc-700/30" style="animation-duration: 80ms;">
              <span class="text-zinc-400 text-[11px]">open</span>
              <span class="text-zinc-400 font-mono text-[11px] truncate">{action.command}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "delete_file"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-red-950/20 border border-red-900/30' : 'bg-red-950/10 border border-red-900/20'}" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {:else}
                <span class="text-red-400 font-mono text-[11px]">-</span>
              {/if}
              <span class="text-zinc-400 font-mono text-[11px]">{action.path}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "save_memory"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-cyan-950/20 border border-cyan-900/30' : 'bg-cyan-950/10 border border-cyan-900/20'}" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {:else}
                <span class="text-cyan-400 text-[11px]">saved</span>
              {/if}
              <span class="text-zinc-400 text-[11px]">.darce/memory.md</span>
            </div>
          {:else if action.name === "glob_files"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-cyan-950/20 border border-cyan-900/30' : 'bg-cyan-950/10 border border-cyan-900/20'}" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {:else}
                <span class="text-cyan-400 text-[11px]">glob</span>
              {/if}
              <span class="text-zinc-400 font-mono text-[11px]">{action.command}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "git_status" || action.name === "git_diff" || action.name === "git_commit"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-mono animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-orange-950/20 border border-orange-900/30' : 'bg-orange-950/10 border border-orange-900/20'}" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {:else}
                <span class="text-orange-400 text-[11px]">{action.name === "git_commit" ? "commit" : action.name === "git_diff" ? "diff" : "git"}</span>
              {/if}
              <span class="text-zinc-400 text-[11px] truncate">{action.command}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {:else if action.name === "web_search" || action.name === "browse_web" || action.name === "browser_click" || action.name === "browser_fill" || action.name === "browser_extract"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-indigo-950/20 border border-indigo-900/30' : 'bg-indigo-950/10 border border-indigo-900/20'}" style="animation-duration: 80ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {:else}
                <span class="text-indigo-400 text-[11px]">{action.name === "web_search" ? "search" : action.name === "browse_web" ? "●" : action.name === "browser_click" ? "click" : action.name === "browser_fill" ? "fill" : "extract"}</span>
              {/if}
              <span class="text-zinc-400 font-mono text-[11px] truncate">{action.command}</span>
              {#if action.done && action.startedAt}
                <span class="text-zinc-700 text-[9px] font-mono ml-auto">{formatDuration(action.startedAt)}</span>
              {/if}
            </div>
          {/if}
        {/each}

        <!-- Status line — always visible during streaming for live feedback -->
        {#if statusText}
          <div class="flex items-center gap-2 py-1">
            <div class="shimmer w-1.5 h-1.5 rounded-full flex-shrink-0"></div>
            <span class="text-[11px] text-zinc-500">{statusText}</span>
            {#if elapsedSeconds >= 3}
              <span class="text-[9px] text-zinc-700 font-mono tabular-nums ml-auto">{elapsedSeconds}s</span>
            {/if}
          </div>
        {:else if !chat.streamingContent && liveActions.length === 0}
          <!-- Initial shimmer — only on very first wait -->
          <div class="space-y-1.5 mt-1">
            <Shimmer height="h-3" width="w-full" />
            <Shimmer height="h-3" width="w-3/4" />
          </div>
        {:else if liveActions.length > 0 && liveActions.every(a => a.done) && !chat.streamingContent}
          <!-- All tools done, waiting for next response -->
          <div class="flex items-center gap-2 py-1">
            <div class="flex gap-0.5">
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-500/60 bounce-dot bounce-dot-1"></div>
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-500/60 bounce-dot bounce-dot-2"></div>
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-500/60 bounce-dot bounce-dot-3"></div>
            </div>
            <span class="text-[11px] text-zinc-600">
              {currentIteration > 1 ? "Continuing..." : "Processing..."}
            </span>
          </div>
        {/if}
      </div>
    {/if}

    {#if chat.error}
      <div class="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-md p-2.5">{chat.error}</div>
    {/if}

    <div bind:this={messagesEnd}></div>
  </div>

  <!-- Running processes bar -->
  {#if processes.running > 0}
    <div class="px-2.5 py-1.5 border-t border-zinc-800/40 flex items-center gap-2 flex-wrap">
      {#each [...processes.processes.values()].filter(p => p.status === "running") as proc (proc.id)}
        <div class="flex items-center gap-1.5 bg-zinc-800/50 border border-zinc-700/30 rounded-full px-2 py-0.5 text-[10px] animate-in fade-in" style="animation-duration: 100ms;">
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-glow flex-shrink-0"></div>
          <span class="text-zinc-400 font-mono truncate max-w-[120px]">{proc.command}</span>
          <span class="text-zinc-600 font-mono tabular-nums">{procElapsed(proc.startedAt)}</span>
          <button onclick={() => processes.stop(proc.id)}
            class="text-zinc-600 hover:text-red-400 transition-colors ml-0.5" title="Stop process">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="p-2.5 border-t border-zinc-800/60">
    <div class="relative">
      <textarea bind:value={input} onkeydown={handleKeydown}
        disabled={chat.isStreaming || !settings.hasApiKey}
        placeholder={settings.hasApiKey ? (project.isOpen ? "Ask Darce... (@ to tag a file)" : "Open a folder first") : "Add API key"}
        class="chat-input w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-3 py-2 pr-16 text-[13px] text-zinc-100
          placeholder:text-zinc-600 focus:border-accent/40 focus:bg-zinc-800/70 focus:outline-none
          resize-none disabled:opacity-30"
        style="min-height: 40px; max-height: 120px;"></textarea>
      <div class="absolute bottom-2 right-2 flex items-center gap-1.5">
        {#if chat.isStreaming}
          <button onclick={stopGeneration}
            class="text-[10px] text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 px-2 py-0.5 rounded transition-colors">
            Stop
          </button>
        {:else if input.trim()}
          <span class="text-[9px] text-zinc-600">Enter</span>
        {/if}
      </div>
    </div>
  </div>
</aside>
