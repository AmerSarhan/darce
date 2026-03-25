<script lang="ts">
  import Shimmer from "$lib/components/ui/Shimmer.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import FileNode from "$lib/components/filetree/FileNode.svelte";
  import { project } from "$lib/stores/project.svelte";
  import { files } from "$lib/stores/files.svelte";
  import { chat } from "$lib/stores/chat.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { tauriInvoke } from "$lib/utils/ipc";
  import { open } from "@tauri-apps/plugin-dialog";
  import type { FileEntry } from "$lib/types";

  // Context menu state
  let contextMenu = $state<{ x: number; y: number; entry?: FileEntry } | null>(null);
  let showNewInput = $state<"file" | "folder" | null>(null);
  let newItemName = $state("");
  let newItemParent = $state("");

  async function openFolder() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        const path = selected;
        const name = path.replace(/\\/g, "/").split("/").pop() || path;
        project.setProject(path, name);
        chat.loadForProject(path);
        settings.setLastProject(path);
        await refreshTree(path);
      }
    } catch (e) { console.error("Open folder failed:", e); }
  }

  async function refreshTree(root?: string) {
    const r = root || project.path;
    if (!r) return;
    try {
      const entries = await tauriInvoke<FileEntry[]>("list_directory", { projectRoot: r, dirPath: null });
      project.setFiles(entries);
    } catch (e) {
      console.error("List directory failed:", e);
      project.setFiles([]);
    }
  }

  async function handleFileClick(entry: FileEntry) {
    if (entry.is_dir || !project.path) return;
    try {
      const content = await tauriInvoke<string>("read_file", { projectRoot: project.path, filePath: entry.path });
      files.open(entry.path, content);
    } catch (e) { console.error("Read file failed:", e); }
  }

  function handleContextMenu(e: MouseEvent, entry?: FileEntry) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, entry };
  }

  function closeContextMenu() { contextMenu = null; }

  function startNewFile(parentPath: string) {
    showNewInput = "file";
    newItemParent = parentPath;
    newItemName = "";
    closeContextMenu();
  }

  function startNewFolder(parentPath: string) {
    showNewInput = "folder";
    newItemParent = parentPath;
    newItemName = "";
    closeContextMenu();
  }

  async function createNewItem() {
    if (!newItemName.trim() || !project.path) return;
    const fullPath = newItemParent ? `${newItemParent}/${newItemName}` : newItemName;

    try {
      if (showNewInput === "folder") {
        await tauriInvoke("write_file", {
          projectRoot: project.path,
          filePath: `${fullPath}/.gitkeep`,
          content: "",
        });
      } else {
        await tauriInvoke("write_file", {
          projectRoot: project.path,
          filePath: fullPath,
          content: "",
        });
        files.open(fullPath, "");
      }
      await refreshTree();
    } catch (e) { console.error("Create failed:", e); }

    showNewInput = null;
    newItemName = "";
  }

  async function deleteEntry(entry: FileEntry) {
    if (!project.path) return;
    closeContextMenu();
    try {
      await tauriInvoke("delete_file", { projectRoot: project.path, filePath: entry.path });
      await refreshTree();
    } catch (e) { console.error("Delete failed:", e); }
  }

  function handleNewItemKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") createNewItem();
    if (e.key === "Escape") { showNewInput = null; newItemName = ""; }
  }

  // Close context menu on click anywhere
  function handleWindowClick() { if (contextMenu) contextMenu = null; }
</script>

<svelte:window onclick={handleWindowClick} />

<aside class="h-full bg-zinc-900 border-r border-zinc-800/60 flex flex-col overflow-hidden">
  <div class="px-3 py-2 border-b border-zinc-800/60 flex items-center justify-between">
    {#if project.isOpen}
      <p class="text-[10px] font-medium text-zinc-400 uppercase tracking-wider truncate">{project.name}</p>
    {:else}
      <p class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Files</p>
    {/if}
    <div class="flex items-center gap-0.5">
      {#if project.isOpen}
        <button onclick={() => startNewFile("")} class="text-[11px] text-zinc-600 hover:text-zinc-300 px-1 rounded hover:bg-zinc-800 transition-colors" title="New file">+</button>
        <button onclick={() => refreshTree()} class="text-[11px] text-zinc-600 hover:text-zinc-300 px-1 rounded hover:bg-zinc-800 transition-colors" title="Refresh">↻</button>
      {/if}
      <Button variant="ghost" size="sm" onclick={openFolder}>Open</Button>
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="flex-1 p-1 overflow-auto" oncontextmenu={(e) => { if (project.isOpen) handleContextMenu(e); }}>
    {#if project.isLoading}
      <div class="space-y-2 p-2">
        <Shimmer height="h-3.5" width="w-3/4" />
        <Shimmer height="h-3.5" width="w-1/2" />
        <Shimmer height="h-3.5" width="w-5/8" />
        <Shimmer height="h-3.5" width="w-2/3" />
      </div>
    {:else if !project.isOpen}
      <div class="flex flex-col items-center justify-center h-full gap-3">
        <p class="text-xs text-zinc-500">Open a folder to start</p>
        <Button variant="default" size="sm" onclick={openFolder}>Open Folder</Button>
      </div>
    {:else}
      <!-- New item input -->
      {#if showNewInput && !newItemParent}
        <div class="px-2 py-1">
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:value={newItemName} onkeydown={handleNewItemKeydown}
            placeholder={showNewInput === "folder" ? "folder name" : "filename.ext"}
            class="w-full bg-zinc-800 border border-accent/40 rounded px-2 py-0.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            autofocus />
        </div>
      {/if}

      {#if project.files.length === 0}
        <p class="text-xs text-zinc-500 p-2">Empty folder</p>
      {:else}
        {#each project.files as entry (entry.path)}
          <FileNode {entry} onfileclick={handleFileClick} recentlyModified={project.recentlyModified} />
        {/each}
      {/if}
    {/if}
  </div>
</aside>

<!-- Context menu -->
{#if contextMenu}
  <div class="fixed z-50 animate-in fade-in" style="left: {contextMenu.x}px; top: {contextMenu.y}px; animation-duration: 60ms;">
    <div class="w-44 bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl py-1 text-[11px]">
      <button onclick={() => startNewFile(contextMenu?.entry?.is_dir ? contextMenu.entry.path : "")}
        class="w-full text-left px-3 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
        New File
      </button>
      <button onclick={() => startNewFolder(contextMenu?.entry?.is_dir ? contextMenu.entry.path : "")}
        class="w-full text-left px-3 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
        New Folder
      </button>
      {#if contextMenu.entry}
        <div class="h-px bg-zinc-800 my-1"></div>
        <button onclick={() => { if (contextMenu?.entry) deleteEntry(contextMenu.entry); }}
          class="w-full text-left px-3 py-1 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors">
          Delete
        </button>
      {/if}
    </div>
  </div>
{/if}
