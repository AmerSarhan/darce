<script lang="ts">
  import Shimmer from "$lib/components/ui/Shimmer.svelte";
  import { chat } from "$lib/stores/chat.svelte";
  import { project } from "$lib/stores/project.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { buildProjectContext } from "$lib/providers/context";
  import { runAgent, type AgentMessage } from "$lib/providers/agent";

  let messagesEnd: HTMLDivElement;
  let input = $state("");
  let statusText = $state("");
  let abortController: AbortController | null = null;

  function stopGeneration() {
    abortController?.abort();
    abortController = null;
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
  let liveActions = $state<{ id: number; idx: number; type: string; name: string; path?: string; lines?: number; command?: string; done: boolean }[]>([]);
  let actionCounter = 0;
  let streamingToolNames = $state<Map<number, string>>(new Map());
  let streamingToolLines = $state<Map<number, number>>(new Map());

  // Scroll
  $effect(() => {
    if (chat.messages.length || chat.isStreaming || liveActions.length) {
      requestAnimationFrame(() => messagesEnd?.scrollIntoView({ behavior: "smooth" }));
    }
  });

  // System prompt — this is the brain of the agent
  const CORE_PROMPT = `You are Darce, an expert AI coding agent. You don't just write code — you build complete, working software.

WORKFLOW:
1. First, UNDERSTAND what the user wants. If unclear, ask ONE clarifying question.
2. If a project exists, READ relevant files first to understand the codebase before making changes.
3. Plan your approach briefly, then execute.
4. Create/edit files with COMPLETE, production-quality code. Never use placeholders like "// TODO" or "// add code here".
5. Run necessary commands (npm install, etc).
6. Verify by listing files or reading what you wrote if needed.

CODE QUALITY:
- Write clean, modern code. Use current best practices.
- Proper error handling. Proper types if TypeScript.
- Good file organization — separate concerns, reasonable file sizes.
- Include all imports. Include all CSS. No missing pieces.
- When creating a project from scratch, include: package.json, config files, ALL source files, styles.

COMMUNICATION:
- Be direct. No filler phrases like "Sure!" or "Great question!" or "Let me help you with that."
- State what you're doing, do it, state what you did. That's it.
- When showing what changed, be specific about file names and what was modified.

IMPORTANT:
- After creating files, the user can see them in their editor immediately.
- The terminal shows command output in real-time.
- You have full access to the project filesystem and terminal.
- Always use the tools — don't just describe what to do, actually DO it.`;

  const GEAR_PROMPTS: Record<string, string> = {
    ship: CORE_PROMPT + "\n\nMODE: Ship. Be fast. Minimal text. Maximum action. Build and move on.",
    understand: CORE_PROMPT + "\n\nMODE: Understand. After each action, briefly explain WHY you made that choice — what pattern you used, what problem it solves. Keep explanations concise but insightful.",
    learn: CORE_PROMPT + "\n\nMODE: Learn. Before writing code, ask the user what approach THEY would take. After building, explain the key concepts and ask one question to check understanding. Make the user think, don't just hand them answers.",
  };

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || chat.isStreaming || !settings.hasApiKey) return;
    input = "";
    liveActions = [];
    statusText = "Thinking...";
    abortController = new AbortController();

    const projectId = project.path || "no-project";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const context = `[Date: ${dateStr}, ${timeStr}]\n` + buildProjectContext();

    chat.addUserMessage(trimmed, projectId);
    chat.startStreaming();

    const agentMessages: AgentMessage[] = [];
    const recent = chat.messages.slice(-10, -1);
    for (const m of recent) agentMessages.push({ role: m.role, content: m.content });
    agentMessages.push({ role: "user", content: context + "\n\n" + trimmed });

    await runAgent(
      settings.activeKey, settings.defaultModel, agentMessages,
      GEAR_PROMPTS[settings.gear] || GEAR_PROMPTS.ship,
      {
        onToken(token) {
          statusText = "";
          chat.appendToken(token);
        },
        onToolStreaming(index, name, _chunk, totalArgs) {
          // Track tool name as it streams in
          if (name && !streamingToolNames.has(index)) {
            streamingToolNames = new Map(streamingToolNames).set(index, name);
          }

          // Count lines in the content being written
          if (name === "create_file") {
            try {
              // Try to extract path and count lines from partial JSON
              const pathMatch = totalArgs.match(/"path"\s*:\s*"([^"]+)"/);
              const contentSoFar = totalArgs.match(/"content"\s*:\s*"([\s\S]*?)(?:"|$)/);
              if (contentSoFar) {
                const lines = (contentSoFar[1].match(/\\n/g) || []).length + 1;
                streamingToolLines = new Map(streamingToolLines).set(index, lines);
              }
              // Show the path being written
              if (pathMatch) {
                const existingAction = liveActions.find(a => a.idx === index && !a.done);
                if (!existingAction) {
                  const id = ++actionCounter;
                  liveActions = [...liveActions, { id, idx: index, type: "tool", name: "create_file", path: pathMatch[1], lines: 0, done: false }];
                  statusText = `Writing ${pathMatch[1]}...`;
                } else {
                  // Update lines count reactively
                  liveActions = liveActions.map(a =>
                    a.idx === index && !a.done ? { ...a, lines: streamingToolLines.get(index) || 0 } : a
                  );
                }
              }
            } catch { /* partial JSON, skip */ }
          } else if (name === "run_command" && !liveActions.find(a => a.idx === index)) {
            try {
              const cmdMatch = totalArgs.match(/"command"\s*:\s*"([^"]+)"/);
              if (cmdMatch) {
                const id = ++actionCounter;
                liveActions = [...liveActions, { id, idx: index, type: "tool", name: "run_command", command: cmdMatch[1], done: false }];
                statusText = `Will run: ${cmdMatch[1]}`;
              }
            } catch { /* skip */ }
          } else if (name === "read_file" && !liveActions.find(a => a.idx === index)) {
            try {
              const pathMatch = totalArgs.match(/"path"\s*:\s*"([^"]+)"/);
              if (pathMatch) {
                const id = ++actionCounter;
                liveActions = [...liveActions, { id, idx: index, type: "tool", name: "read_file", path: pathMatch[1], done: false }];
                statusText = `Reading ${pathMatch[1]}...`;
              }
            } catch { /* skip */ }
          }
        },
        onToolStart(name, args) {
          // Tool is fully parsed and about to execute — mark existing or create new
          const existing = liveActions.find(a => a.name === name && !a.done);
          if (!existing) {
            const id = ++actionCounter;
            const action: typeof liveActions[0] = { id, idx: -1, type: "tool", name, done: false };
            if (name === "create_file") {
              action.path = args.path as string;
              action.lines = ((args.content as string) || "").split("\n").length;
            } else if (name === "read_file") { action.path = args.path as string; }
            else if (name === "run_command") { action.command = args.command as string; }
            else if (name === "delete_file") { action.path = args.path as string; }
            liveActions = [...liveActions, action];
          } else {
            // Update with final values
            if (name === "create_file") {
              liveActions = liveActions.map(a =>
                a === existing ? { ...a, path: args.path as string, lines: ((args.content as string) || "").split("\n").length } : a
              );
            }
          }
          statusText = name === "create_file" ? `Writing ${args.path}...`
            : name === "run_command" ? `Running ${args.command}...`
            : name === "read_file" ? `Reading ${args.path}...`
            : name === "list_files" ? "Scanning..."
            : `${name}...`;
        },
        onToolEnd(name, _result) {
          liveActions = liveActions.map((a) =>
            a.name === name && !a.done ? { ...a, done: true } : a
          );
          statusText = "Thinking...";
          // Clear streaming state for next round
          streamingToolNames = new Map();
          streamingToolLines = new Map();
        },
        onDone(finalText) {
          statusText = "";
          let displayContent = finalText;
          if (liveActions.length > 0) {
            const actionLines = liveActions.map((a) => {
              if (a.name === "create_file") return `  Created[${a.lines || 0}] ${a.path}`;
              if (a.name === "run_command") return `  $ ${a.command}`;
              if (a.name === "delete_file") return `  Deleted ${a.path}`;
              if (a.name === "read_file") return `  Read ${a.path}`;
              if (a.name === "list_files") return `  Scanned project`;
              return `  ${a.name}`;
            });
            displayContent = (displayContent ? displayContent + "\n\n" : "") + "Actions:\n" + actionLines.join("\n");
          }
          chat.streamingContent = displayContent;
          chat.finishStreaming(settings.defaultModel, projectId);
          liveActions = [];
          streamingToolNames = new Map();
          streamingToolLines = new Map();
        },
        onError(error) {
          statusText = "";
          if (chat.streamingContent) chat.finishStreaming(settings.defaultModel, projectId);
          chat.setError(error);
          liveActions = [];
          streamingToolNames = new Map();
          streamingToolLines = new Map();
        },
      },
    );
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
      if (t.startsWith("$ ")) { parts.push({ type: "command", command: t.slice(2) }); continue; }
      if (t.startsWith("Deleted ")) { parts.push({ type: "file_deleted", path: t.slice(8) }); continue; }
      if (t.startsWith("Read ")) { parts.push({ type: "file_read", path: t.slice(5) }); continue; }
      if (t.startsWith("Scanned")) continue;
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

  <div class="flex-1 p-3 space-y-3 overflow-auto">
    {#if chat.messages.length === 0 && !chat.isStreaming}
      <div class="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <p class="text-[12px] text-zinc-500">What do you want to build?</p>
        <div class="space-y-1.5 w-full max-w-[220px]">
          {#each [
            "Create a React app with Vite",
            "Build a REST API with Express",
            "Make a landing page",
            "Fix the styles in this project",
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
      <div class="flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-1" style="animation-duration: 150ms;">
        <span class="text-[10px] font-semibold uppercase tracking-wider {msg.role === 'user' ? 'text-accent' : 'text-emerald-400'}">
          {msg.role === "user" ? "You" : "Darce"}
        </span>
        {#each parseParts(msg.content) as part}
          {#if part.type === "text"}
            <div class="text-[13px] text-zinc-300 leading-relaxed chat-text">{@html renderMarkdown(part.text)}</div>
          {:else if part.type === "file_created"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-950/20 border border-emerald-900/30 rounded-md text-xs animate-in fade-in" style="animation-duration: 150ms;">
              <span class="text-emerald-400 font-mono text-[11px] font-semibold">+{part.lines}</span>
              <span class="text-zinc-400 font-mono text-[11px]">{part.path}</span>
            </div>
          {:else if part.type === "file_read"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800/40 border border-zinc-700/30 rounded-md text-xs animate-in fade-in" style="animation-duration: 150ms;">
              <span class="text-zinc-500 text-[11px]">read</span>
              <span class="text-zinc-400 font-mono text-[11px]">{part.path}</span>
            </div>
          {:else if part.type === "command"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-blue-950/20 border border-blue-900/30 rounded-md text-xs font-mono animate-in fade-in" style="animation-duration: 150ms;">
              <span class="text-blue-400 text-[11px]">$</span>
              <span class="text-zinc-400 text-[11px]">{part.command}</span>
            </div>
          {:else if part.type === "file_deleted"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-red-950/20 border border-red-900/30 rounded-md text-xs animate-in fade-in" style="animation-duration: 150ms;">
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
            {@html renderMarkdown(chat.streamingContent)}<span class="cursor-blink"></span>
          </div>
        {/if}

        <!-- Live tool actions -->
        {#each liveActions as action (action.id)}
          {#if action.name === "create_file"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-emerald-950/20 border border-emerald-900/30' : 'bg-emerald-950/10 border border-emerald-900/20'}" style="animation-duration: 150ms;">
              <span class="text-emerald-400 font-mono text-[11px] font-semibold min-w-6 text-right tabular-nums">+{action.lines || 0}</span>
              <span class="text-zinc-400 font-mono text-[11px]">{action.path || "..."}</span>
              {#if !action.done}
                <div class="shimmer w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto"></div>
              {/if}
            </div>
          {:else if action.name === "run_command"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-mono animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-blue-950/20 border border-blue-900/30' : 'bg-blue-950/10 border border-blue-900/20'}" style="animation-duration: 150ms;">
              {#if action.done}
                <span class="text-blue-400 text-[11px]">$</span>
              {:else}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {/if}
              <span class="text-zinc-400 text-[11px] truncate">{action.command}</span>
            </div>
          {:else if action.name === "read_file"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-bottom-1 {action.done ? 'bg-zinc-800/40 border border-zinc-700/30' : 'bg-zinc-800/20 border border-zinc-700/20'}" style="animation-duration: 150ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {:else}
                <span class="text-zinc-500 text-[11px]">read</span>
              {/if}
              <span class="text-zinc-400 font-mono text-[11px]">{action.path}</span>
            </div>
          {:else if action.name === "list_files"}
            <div class="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800/20 border border-zinc-700/20 rounded-md text-xs animate-in fade-in" style="animation-duration: 150ms;">
              {#if !action.done}
                <div class="shimmer w-2 h-2 rounded-full flex-shrink-0"></div>
              {/if}
              <span class="text-zinc-500 text-[11px]">Scanning project files</span>
            </div>
          {/if}
        {/each}

        <!-- Status line -->
        {#if statusText}
          <div class="flex items-center gap-2 py-1">
            <div class="shimmer w-1.5 h-1.5 rounded-full flex-shrink-0"></div>
            <span class="text-[11px] text-zinc-500">{statusText}</span>
          </div>
        {/if}

        <!-- Initial shimmer if nothing yet -->
        {#if !chat.streamingContent && liveActions.length === 0 && !statusText}
          <div class="space-y-1.5 mt-1">
            <Shimmer height="h-3" width="w-full" />
            <Shimmer height="h-3" width="w-3/4" />
          </div>
        {/if}
      </div>
    {/if}

    {#if chat.error}
      <div class="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-md p-2.5">{chat.error}</div>
    {/if}

    <div bind:this={messagesEnd}></div>
  </div>

  <div class="p-2.5 border-t border-zinc-800/60">
    <div class="relative">
      <textarea bind:value={input} onkeydown={handleKeydown}
        disabled={chat.isStreaming || !settings.hasApiKey}
        placeholder={settings.hasApiKey ? (project.isOpen ? "Ask Darce... (@ to tag a file)" : "Open a folder first") : "Add API key"}
        rows="2"
        class="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-3 py-2 pr-16 text-[13px] text-zinc-100
          placeholder:text-zinc-600 focus:border-accent/40 focus:bg-zinc-800/70 focus:outline-none
          resize-none disabled:opacity-30"></textarea>
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
