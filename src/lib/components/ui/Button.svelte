<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    onclick, variant = "default", size = "md", disabled = false,
    class: className = "", children,
  }: {
    onclick?: (e: MouseEvent) => void; variant?: "default" | "primary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg"; disabled?: boolean; class?: string; children: Snippet;
  } = $props();

  const variants: Record<string, string> = {
    default: "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700",
    primary: "bg-accent hover:bg-accent/90 text-zinc-900 font-semibold",
    ghost: "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100",
    danger: "bg-red-600 hover:bg-red-500 text-white",
  };
  const sizes: Record<string, string> = {
    sm: "px-2 py-1 text-xs", md: "px-3 py-1.5 text-sm", lg: "px-4 py-2 text-base",
  };
</script>

<button {onclick} {disabled}
  class="inline-flex items-center justify-center rounded-lg transition-all duration-150
    {variants[variant]} {sizes[size]} {className}
    disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]">
  {@render children()}
</button>
