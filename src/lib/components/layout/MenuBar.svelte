<script lang="ts">
  import { project } from "$lib/stores/project.svelte";
  import { files } from "$lib/stores/files.svelte";
  import { chat } from "$lib/stores/chat.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { terminal } from "$lib/stores/terminal.svelte";
  import { updater } from "$lib/stores/updater.svelte";
  import { tauriInvoke } from "$lib/utils/ipc";
  import { open } from "@tauri-apps/plugin-dialog";
  import type { FileEntry } from "$lib/types";

  let { onopensettings }: { onopensettings: () => void } = $props();

  let activeMenu = $state<string | null>(null);

  function toggleMenu(name: string) { activeMenu = activeMenu === name ? null : name; }
  function closeMenu() { activeMenu = null; }

  async function openFolder() {
    closeMenu();
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        const name = selected.replace(/\\/g, "/").split("/").pop() || selected;
        project.setProject(selected, name);
        chat.loadForProject(selected);
        settings.setLastProject(selected);
        const entries = await tauriInvoke<FileEntry[]>("list_directory", { projectRoot: selected, dirPath: null });
        project.setFiles(entries);
      }
    } catch (e) { console.error("Open folder:", e); }
  }

  async function saveFile() {
    closeMenu();
    const active = files.activeFile;
    if (active && project.path) {
      await tauriInvoke("write_file", { projectRoot: project.path, filePath: active.path, content: active.content });
      files.openFiles[files.activeIndex].isDirty = false;
      files.openFiles = [...files.openFiles];
    }
  }

  function newChat() { closeMenu(); if (project.path) chat.clear(project.path); }
  function closeFile() { closeMenu(); if (files.activeFile) files.close(files.activeIndex); }
  function closeAllFiles() { closeMenu(); while (files.openFiles.length) files.close(0); }
  function clearTerminal() { closeMenu(); terminal.clear(); }
  function openSettings() { closeMenu(); onopensettings(); }
  function cycleGear() { closeMenu(); settings.cycleGear(); }

  function handleWindowClick(e: MouseEvent) {
    if (activeMenu && !(e.target as HTMLElement)?.closest(".menu-bar")) activeMenu = null;
  }
</script>

<svelte:window onclick={handleWindowClick} />

<nav class="menu-bar h-7 flex items-center bg-zinc-900 border-b border-zinc-800/40 text-[11px] select-none">
  <div class="relative">
    <button onclick={() => toggleMenu("file")}
      class="px-3 h-7 hover:bg-zinc-800 transition-colors {activeMenu === 'file' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500'}">
      File
    </button>
    {#if activeMenu === "file"}
      <div class="absolute top-7 left-0 w-52 bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl py-1 z-50 animate-in fade-in" style="animation-duration: 60ms;">
        <button onclick={openFolder} class="menu-item">Open Folder<span class="shortcut">Ctrl+O</span></button>
        <div class="h-px bg-zinc-800/60 my-0.5"></div>
        <button onclick={saveFile} class="menu-item" disabled={!files.activeFile}>Save<span class="shortcut">Ctrl+S</span></button>
        <button onclick={closeFile} class="menu-item" disabled={!files.activeFile}>Close File</button>
        <button onclick={closeAllFiles} class="menu-item" disabled={files.openFiles.length === 0}>Close All</button>
        <div class="h-px bg-zinc-800/60 my-0.5"></div>
        <button onclick={openSettings} class="menu-item">Preferences</button>
      </div>
    {/if}
  </div>

  <div class="relative">
    <button onclick={() => toggleMenu("edit")}
      class="px-3 h-7 hover:bg-zinc-800 transition-colors {activeMenu === 'edit' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500'}">
      Edit
    </button>
    {#if activeMenu === "edit"}
      <div class="absolute top-7 left-0 w-52 bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl py-1 z-50 animate-in fade-in" style="animation-duration: 60ms;">
        <button onclick={newChat} class="menu-item">New Chat<span class="shortcut">Ctrl+N</span></button>
        <button onclick={clearTerminal} class="menu-item">Clear Terminal</button>
      </div>
    {/if}
  </div>

  <div class="relative">
    <button onclick={() => toggleMenu("view")}
      class="px-3 h-7 hover:bg-zinc-800 transition-colors {activeMenu === 'view' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500'}">
      View
    </button>
    {#if activeMenu === "view"}
      <div class="absolute top-7 left-0 w-52 bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl py-1 z-50 animate-in fade-in" style="animation-duration: 60ms;">
        <button onclick={cycleGear} class="menu-item">
          Cycle Mode<span class="shortcut">{settings.gear}</span>
        </button>
        <button onclick={() => { closeMenu(); settings.setGear("ship"); }} class="menu-item">
          Ship Mode<span class="shortcut">Ctrl+1</span>
        </button>
        <button onclick={() => { closeMenu(); settings.setGear("understand"); }} class="menu-item">
          Understand Mode<span class="shortcut">Ctrl+2</span>
        </button>
        <button onclick={() => { closeMenu(); settings.setGear("learn"); }} class="menu-item">
          Learn Mode<span class="shortcut">Ctrl+3</span>
        </button>
      </div>
    {/if}
  </div>

  <div class="relative">
    <button onclick={() => toggleMenu("help")}
      class="px-3 h-7 hover:bg-zinc-800 transition-colors {activeMenu === 'help' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500'}">
      Help
    </button>
    {#if activeMenu === "help"}
      <div class="absolute top-7 left-0 w-56 bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl py-1 z-50 animate-in fade-in" style="animation-duration: 60ms;">
        <button onclick={() => { closeMenu(); updater.openWhatsNew(); }} class="menu-item">What's New</button>
        <button onclick={() => { updater.check(true); }} class="menu-item">
          {#if updater.checking}
            Checking...
          {:else}
            Check for Updates
          {/if}
          {#if updater.hasUpdate}
            <span class="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {/if}
        </button>
        {#if updater.checkStatus}
          <div class="px-3 py-1.5 text-[10px] {updater.hasUpdate ? 'text-emerald-400' : 'text-zinc-500'}">
            {updater.checkStatus}
          </div>
        {/if}
        <div class="h-px bg-zinc-800/60 my-0.5"></div>
        <div class="px-3 py-2 text-[10px] text-zinc-500 space-y-1.5">
          <p class="text-zinc-300 font-medium text-[11px]">Darce v{updater.currentVersion} Beta</p>
          <p>The AI coder that makes you smarter.</p>
          <div class="h-px bg-zinc-800/60 my-1"></div>
          <div class="space-y-0.5">
            <p><span class="text-zinc-600 font-mono w-16 inline-block">Ctrl+O</span> Open folder</p>
            <p><span class="text-zinc-600 font-mono w-16 inline-block">Ctrl+S</span> Save file</p>
            <p><span class="text-zinc-600 font-mono w-16 inline-block">Ctrl+N</span> New chat</p>
            <p><span class="text-zinc-600 font-mono w-16 inline-block">Ctrl+1</span> Ship mode</p>
            <p><span class="text-zinc-600 font-mono w-16 inline-block">Ctrl+2</span> Understand</p>
            <p><span class="text-zinc-600 font-mono w-16 inline-block">Ctrl+3</span> Learn mode</p>
          </div>
          <div class="h-px bg-zinc-800/60 my-1"></div>
          <a href="https://darce.dev" target="_blank" class="text-accent/70 hover:text-accent block">darce.dev</a>
          <a href="https://github.com/AmerSarhan/darce" target="_blank" class="text-zinc-500 hover:text-zinc-300 block">GitHub</a>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex-1"></div>
  {#if project.isOpen}
    <span class="text-[10px] text-zinc-600 pr-3 font-mono">{project.name}</span>
  {/if}
</nav>

<style>
  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 3px 12px;
    text-align: left;
    font-size: 11px;
    color: #a1a1aa;
    transition: all 50ms;
  }
  .menu-item:hover:not(:disabled) { background: #27272a; color: #e4e4e7; }
  .menu-item:disabled { opacity: 0.25; cursor: default; }
  .shortcut { margin-left: auto; font-size: 10px; color: #52525b; font-family: monospace; }
</style>
