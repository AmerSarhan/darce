<script lang="ts">
  import type { FileEntry } from "$lib/types";
  import FileNode from "./FileNode.svelte";

  let { entry, depth = 0, onfileclick, recentlyModified = new Set<string>() }: {
    entry: FileEntry;
    depth?: number;
    onfileclick: (entry: FileEntry) => void;
    recentlyModified?: Set<string>;
  } = $props();

  // Load saved expand state, default open for depth < 2
  let expanded = $state((() => loadExpandState(entry.path, depth < 2))());

  function loadExpandState(path: string, fallback: boolean): boolean {
    try {
      const saved = localStorage.getItem("darce_tree_state");
      if (saved) {
        const map = JSON.parse(saved);
        if (path in map) return map[path];
      }
    } catch {}
    return fallback;
  }

  function saveExpandState(path: string, open: boolean) {
    try {
      const saved = localStorage.getItem("darce_tree_state");
      const map = saved ? JSON.parse(saved) : {};
      map[path] = open;
      localStorage.setItem("darce_tree_state", JSON.stringify(map));
    } catch {}
  }

  function handleClick() {
    if (entry.is_dir) {
      expanded = !expanded;
      saveExpandState(entry.path, expanded);
    } else {
      onfileclick(entry);
    }
  }

  function fileColor(name: string): string {
    const ext = name.split(".").pop() || "";
    const colors: Record<string, string> = {
      jsx: "text-blue-400", tsx: "text-blue-400",
      js: "text-yellow-400", ts: "text-blue-300",
      css: "text-pink-400", html: "text-orange-400",
      json: "text-yellow-300", md: "text-zinc-400",
      rs: "text-orange-300", py: "text-green-400",
      svg: "text-amber-400", png: "text-emerald-400",
      jpg: "text-emerald-400", gif: "text-emerald-400",
      toml: "text-orange-300", yaml: "text-purple-400",
      yml: "text-purple-400", sh: "text-green-300",
      sql: "text-cyan-400", env: "text-yellow-500",
    };
    return colors[ext] || "text-zinc-500";
  }
</script>

<button onclick={handleClick}
  class="w-full flex items-center gap-1.5 py-[2px] text-[12px] hover:bg-zinc-800/50 rounded-[3px] text-left group"
  class:file-modified={recentlyModified.has(entry.path)}
  style="padding-left: {depth * 14 + 6}px">
  {#if entry.is_dir}
    <span class="text-zinc-600 w-3 text-center text-[8px] transition-transform duration-75 inline-block {expanded ? 'rotate-90' : ''}">&rsaquo;</span>
    <span class="text-zinc-400 group-hover:text-zinc-300">{entry.name}</span>
  {:else}
    <span class="w-3 text-center text-[6px] {fileColor(entry.name)}">&#9679;</span>
    <span class="text-zinc-400 group-hover:text-zinc-200">{entry.name}</span>
  {/if}
</button>

{#if entry.is_dir && expanded && entry.children}
  {#each entry.children as child (child.path)}
    <FileNode entry={child} depth={depth + 1} {onfileclick} {recentlyModified} />
  {/each}
{/if}

<style>
  :global(.file-modified) {
    animation: file-flash 3s ease-out;
  }
  @keyframes file-flash {
    0% { background-color: rgba(251, 191, 36, 0.15); }
    100% { background-color: transparent; }
  }
</style>
