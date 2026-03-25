<script lang="ts">
  import MenuBar from "$lib/components/layout/MenuBar.svelte";
  import TopBar from "$lib/components/layout/TopBar.svelte";
  import Sidebar from "$lib/components/layout/Sidebar.svelte";
  import MainArea from "$lib/components/layout/MainArea.svelte";
  import ChatPanel from "$lib/components/layout/ChatPanel.svelte";
  import PanelResizer from "$lib/components/layout/PanelResizer.svelte";
  import { onMount } from "svelte";
  import Onboarding from "$lib/components/Onboarding.svelte";
  import SettingsModal from "$lib/components/Settings.svelte";
  import BetaSignup from "$lib/components/BetaSignup.svelte";
  import UpdateModal from "$lib/components/UpdateModal.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { updater } from "$lib/stores/updater.svelte";

  let showSettings = $state(false);
  import { files } from "$lib/stores/files.svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { project } from "$lib/stores/project.svelte";
  import { chat } from "$lib/stores/chat.svelte";
  import { tauriInvoke } from "$lib/utils/ipc";
  import type { FileEntry } from "$lib/types";

  function track(event: string, props?: Record<string, string>) {
    import("@aptabase/tauri").then(m => m.trackEvent(event, props)).catch(() => {});
  }

  onMount(async () => {
    await settings.init();
    updater.init();
    track("app_launched", { gear: settings.gear, provider: settings.provider });
    // Reopen last project
    if (settings.lastProjectPath) {
      try {
        const path = settings.lastProjectPath;
        const name = path.replace(/\\/g, "/").split("/").pop() || path;
        project.setProject(path, name);
        chat.loadForProject(path);
        const entries = await tauriInvoke<FileEntry[]>("list_directory", { projectRoot: path, dirPath: null });
        project.setFiles(entries);
      } catch { /* project might not exist anymore */ }
    }
  });

  let sidebarWidth = $state(220);
  let chatWidth = $state(320);

  function resizeSidebar(delta: number) {
    sidebarWidth = Math.max(160, Math.min(400, sidebarWidth + delta));
  }

  function resizeChat(delta: number) {
    chatWidth = Math.max(240, Math.min(500, chatWidth - delta));
  }

  async function handleKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "1") { e.preventDefault(); settings.setGear("ship"); }
    if (mod && e.key === "2") { e.preventDefault(); settings.setGear("understand"); }
    if (mod && e.key === "3") { e.preventDefault(); settings.setGear("learn"); }
    if (mod && e.key === "o") {
      e.preventDefault();
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        const name = selected.replace(/\\/g, "/").split("/").pop() || selected;
        project.setProject(selected, name);
        chat.loadForProject(selected);
        const entries = await tauriInvoke<FileEntry[]>("list_directory", { projectRoot: selected, dirPath: null });
        project.setFiles(entries);
      }
    }
    if (mod && e.key === "s") {
      e.preventDefault();
      // Save active file to disk
      const active = files.activeFile;
      if (active && project.path) {
        try {
          await tauriInvoke("write_file", { projectRoot: project.path, filePath: active.path, content: active.content });
          files.markSaved(files.activeIndex);
        } catch (err) { console.error("Save failed:", err); }
      }
    }
    if (mod && e.key === "n") {
      e.preventDefault();
      if (project.path) chat.clear(project.path);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="h-screen flex flex-col bg-zinc-900 text-zinc-100">
  <MenuBar onopensettings={() => showSettings = true} />
  <TopBar />
  <div class="flex-1 flex overflow-hidden">
    <div style="width: {sidebarWidth}px" class="flex-shrink-0">
      <Sidebar />
    </div>
    <PanelResizer direction="horizontal" onresize={resizeSidebar} />
    <div class="flex-1 min-w-0">
      <MainArea />
    </div>
    <PanelResizer direction="horizontal" onresize={resizeChat} />
    <div style="width: {chatWidth}px" class="flex-shrink-0">
      <ChatPanel />
    </div>
  </div>
</div>

<BetaSignup />
<Onboarding />
<SettingsModal open={showSettings} onclose={() => showSettings = false} />
<UpdateModal />
