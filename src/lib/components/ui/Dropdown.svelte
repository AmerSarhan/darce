<script lang="ts">
  let { value, options, onchange, class: className = "" }: {
    value: string; options: { value: string; label: string }[];
    onchange: (value: string) => void; class?: string;
  } = $props();

  let open = $state(false);
  let buttonEl: HTMLButtonElement;

  const selectedLabel = $derived(options.find(o => o.value === value)?.label || value);

  function toggle() { open = !open; }
  function select(val: string) { open = false; onchange(val); }
  function handleClickOutside(e: MouseEvent) {
    if (open && buttonEl && !buttonEl.parentElement?.contains(e.target as Node)) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative {className}">
  <button bind:this={buttonEl} onclick={toggle}
    class="w-full flex items-center justify-between gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded-lg px-2.5 py-1.5
      hover:border-zinc-600 focus:border-accent focus:outline-none transition-colors cursor-pointer">
    <span class="truncate">{selectedLabel}</span>
    <svg class="w-3 h-3 text-zinc-500 flex-shrink-0 transition-transform {open ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if open}
    <div class="absolute top-full left-0 right-0 mt-0.5 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden max-h-60 overflow-y-auto">
      {#each options as opt}
        <button onclick={() => select(opt.value)}
          class="w-full text-left px-2.5 py-1.5 text-xs transition-colors truncate
            {opt.value === value ? 'bg-accent/15 text-accent' : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100'}">
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
