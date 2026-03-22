<script lang="ts">
  import type { Snippet } from "svelte";

  let { open = false, onclose, title, children }: {
    open: boolean; onclose?: () => void; title?: string; children: Snippet;
  } = $props();
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
    <button class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onclick={onclose} aria-label="Close"></button>
    <div class="relative z-10 w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 animate-in zoom-in-95 fade-in">
      {#if title}
        <h2 class="text-lg font-semibold text-zinc-100 mb-4">{title}</h2>
      {/if}
      {@render children()}
    </div>
  </div>
{/if}
