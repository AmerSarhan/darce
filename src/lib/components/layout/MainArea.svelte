<script lang="ts">
  import Shimmer from "$lib/components/ui/Shimmer.svelte";
  import MonacoEditor from "$lib/components/editor/MonacoEditor.svelte";
  import LearnPanel from "$lib/components/layout/LearnPanel.svelte";
  import { files } from "$lib/stores/files.svelte";
  import { project } from "$lib/stores/project.svelte";
  import { terminal } from "$lib/stores/terminal.svelte";
  import { open } from "@tauri-apps/plugin-shell";

  let editorReady = $state(false);
  let terminalEl: HTMLDivElement;

  $effect(() => {
    const timer = setTimeout(() => (editorReady = true), 200);
    return () => clearTimeout(timer);
  });

  // Auto-scroll terminal
  $effect(() => {
    if (terminal.lines.length) {
      requestAnimationFrame(() => {
        terminalEl?.scrollTo({ top: terminalEl.scrollHeight, behavior: "smooth" });
      });
    }
  });

  async function openInBrowser() {
    if (!files.activeFile || !project.path) return;
    const fullPath = project.path.replace(/\//g, "\\") + "\\" + files.activeFile.path.replace(/\//g, "\\");
    try {
      await open(fullPath);
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  }

  function isHtmlFile(name: string): boolean {
    return /\.(html|htm)$/i.test(name);
  }
</script>

<div class="h-full flex flex-col bg-zinc-950">
  <!-- Tab bar -->
  <div class="h-9 flex items-center bg-zinc-900 border-b border-zinc-800 px-1 gap-0.5 overflow-x-auto">
    {#if files.openFiles.length === 0}
      <span class="text-xs text-zinc-500 px-3">No files open</span>
    {/if}
    {#each files.openFiles as file, i}
      <div class="group flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all duration-150 flex-shrink-0 cursor-pointer
          {i === files.activeIndex ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}">
        <button onclick={() => files.setActive(i)} class="hover:text-zinc-100 transition-colors">{file.name}</button>
        {#if file.isDirty}
          <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
        {/if}
        <button onclick={() => files.close(i)}
          class="ml-1 opacity-0 group-hover:opacity-100 hover:text-zinc-100 transition-opacity text-[10px]"
          aria-label="Close tab">&times;</button>
      </div>
    {/each}

    <!-- Open in browser button for HTML files -->
    {#if files.activeFile && isHtmlFile(files.activeFile.name)}
      <button onclick={openInBrowser}
        class="ml-auto px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors flex-shrink-0">
        Open in Browser
      </button>
    {/if}
  </div>

  <!-- Editor area -->
  <div class="flex-1 relative min-h-0">
    {#if files.activeFile}
      {#if editorReady}
        {#key files.activeFile.path}
          <MonacoEditor
            content={files.activeFile.content}
            language={files.activeFile.language}
            onchange={(v) => files.updateContent(files.activeIndex, v)}
            highlights={files.highlightLines.filter(h => h.path === files.activeFile?.path)}
          />
        {/key}
      {:else}
        <div class="p-4 space-y-2">
          <Shimmer height="h-4" width="w-full" />
          <Shimmer height="h-4" width="w-3/4" />
          <Shimmer height="h-4" width="w-5/6" />
          <Shimmer height="h-4" width="w-2/3" />
        </div>
      {/if}
    {:else}
      <div class="h-full flex items-center justify-center">
        <div class="text-center space-y-4 max-w-xs">
          <div class="space-y-1">
            <p class="text-lg font-semibold" style="color: oklch(0.72 0.11 75);">darce</p>
            <p class="text-[11px] text-zinc-600">the ai coder that makes you smarter</p>
          </div>
          <div class="space-y-1.5 text-[11px] text-zinc-500 text-left mx-auto" style="max-width: 200px;">
            <div class="flex items-center gap-2">
              <span class="text-zinc-600 font-mono text-[10px] w-14 text-right">Ctrl+O</span>
              <span>Open folder</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-zinc-600 font-mono text-[10px] w-14 text-right">Ctrl+S</span>
              <span>Save file</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-zinc-600 font-mono text-[10px] w-14 text-right">Ctrl+N</span>
              <span>New chat</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-zinc-600 font-mono text-[10px] w-14 text-right">1 / 2 / 3</span>
              <span>Ship / Understand / Learn</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Learn/Understand Panel -->
  <LearnPanel />

  <!-- Terminal -->
  <div class="h-36 flex-shrink-0 border-t border-zinc-800 bg-zinc-950 flex flex-col">
    <div class="px-3 py-1.5 flex items-center gap-2 border-b border-zinc-800">
      <span class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Terminal</span>
      {#if terminal.isRunning}
        <div class="flex items-center gap-1.5">
          <div class="shimmer w-1.5 h-1.5 rounded-full"></div>
          <span class="text-[10px] text-emerald-500">Running</span>
        </div>
      {/if}
      {#if terminal.lines.length > 0}
        <button onclick={() => terminal.clear()} class="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Clear</button>
      {/if}
    </div>
    <div bind:this={terminalEl} class="flex-1 p-2 overflow-auto font-mono text-xs scroll-smooth">
      {#if terminal.lines.length === 0}
        <p class="text-zinc-600">$ ready</p>
      {/if}
      {#each terminal.lines as line (line.id)}
        <p class="leading-5 {line.stream === 'stderr' ? 'text-red-400' : line.stream === 'system' ? 'text-zinc-500 italic' : 'text-zinc-300'}">{line.text}</p>
      {/each}
    </div>
  </div>
</div>
