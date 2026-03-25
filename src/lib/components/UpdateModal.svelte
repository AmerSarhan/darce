<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { updater } from "$lib/stores/updater.svelte";

  function openDownload() {
    const url = updater.getDownloadUrl();
    if (url) window.open(url, "_blank");
  }

  function formatSize(bytes: number): string {
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  // Simple markdown to HTML for changelog
  function renderChangelog(md: string): string {
    return md
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, '<div class="text-xs font-semibold text-zinc-200 mt-2 mb-1">$1</div>')
      .replace(/^## (.+)$/gm, '<div class="text-sm font-semibold text-zinc-100 mt-3 mb-1">$1</div>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-zinc-100">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1 py-0.5 rounded text-[11px]">$1</code>')
      .replace(/^- (.+)$/gm, '<div class="flex gap-1.5 ml-1"><span class="text-zinc-600">·</span><span>$1</span></div>')
      .replace(/\n/g, "<br>");
  }
</script>

<!-- Update Available Modal -->
<Modal open={updater.showUpdateModal} onclose={() => updater.dismissUpdate()} title="Update Available">
  {#if updater.latestRelease}
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-[13px] text-zinc-100 font-medium">{updater.latestRelease.name}</p>
          <p class="text-[10px] text-zinc-500 mt-0.5">
            Released {formatDate(updater.latestRelease.publishedAt)}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-zinc-600 font-mono">v{updater.currentVersion}</span>
          <span class="text-[10px] text-zinc-500">→</span>
          <span class="text-[10px] text-emerald-400 font-mono">v{updater.latestRelease.version}</span>
        </div>
      </div>

      {#if updater.latestRelease.body}
        <div class="max-h-48 overflow-auto rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-[12px] text-zinc-400 leading-relaxed">
          {@html renderChangelog(updater.latestRelease.body)}
        </div>
      {/if}

      <div class="flex items-center justify-between pt-1">
        <button onclick={() => updater.dismissUpdate()}
          class="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Remind me later
        </button>
        <Button variant="primary" onclick={openDownload}>
          Download Update
        </Button>
      </div>
    </div>
  {/if}
</Modal>

<!-- What's New Modal -->
<Modal open={updater.showWhatsNew} onclose={() => updater.dismissWhatsNew()} title="What's New">
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-zinc-500 font-mono">v{updater.currentVersion}</span>
    </div>

    {#if updater.currentChangelog}
      <div class="text-[12px] text-zinc-400 leading-relaxed space-y-1">
        {@html renderChangelog(updater.currentChangelog)}
      </div>
    {:else}
      <p class="text-[12px] text-zinc-500">No changelog for this version.</p>
    {/if}

    <div class="flex justify-end pt-1">
      <Button variant="primary" onclick={() => updater.dismissWhatsNew()}>
        Got it
      </Button>
    </div>
  </div>
</Modal>
