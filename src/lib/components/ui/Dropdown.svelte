<script lang="ts">
  let { value, options, onchange, class: className = "" }: {
    value: string; options: { value: string; label: string }[];
    onchange: (value: string) => void; class?: string;
  } = $props();
</script>

<select {value} onchange={(e) => onchange((e.target as HTMLSelectElement).value)}
  class="bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded-lg px-2.5 py-1.5
    hover:border-zinc-600 focus:border-accent focus:outline-none transition-colors cursor-pointer {className}">
  {#each options as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
