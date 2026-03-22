<script lang="ts">
  import { onMount } from "svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { tauriInvoke } from "$lib/utils/ipc";
  import Dropdown from "$lib/components/ui/Dropdown.svelte";

  const gearOptions = [
    { value: "ship", label: "Ship" },
    { value: "understand", label: "Understand" },
    { value: "learn", label: "Learn" },
  ];

  const models = [
    { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "meta-llama/llama-4-scout", label: "Llama 4 Scout" },
    { value: "moonshotai/kimi-k2.5", label: "Kimi K2.5" },
    { value: "x-ai/grok-4.20-multi-agent-beta", label: "Grok 4 (2M)" },
  ];

  const gearColors: Record<string, string> = {
    ship: "bg-zinc-800 text-zinc-400",
    understand: "bg-blue-950/40 text-blue-400 border-blue-900/30",
    learn: "bg-emerald-950/40 text-emerald-400 border-emerald-900/30",
  };

  // Provider labels kept for future use

  // OpenRouter usage
  let credits = $state<string | null>(null);

  async function fetchUsage() {
    if (settings.provider !== "openrouter" || !settings.apiKey) return;
    try {
      const result = await tauriInvoke<string>("simple_chat_raw", {
        url: "https://openrouter.ai/api/v1/auth/key",
        apiKey: settings.apiKey,
      });
      const data = JSON.parse(result);
      const limit = data.data?.limit;
      const usage = data.data?.usage;
      if (typeof usage === "number") {
        credits = limit ? `$${(limit - usage).toFixed(2)} left` : `$${usage.toFixed(2)} used`;
      }
    } catch { /* silent */ }
  }

  onMount(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 60000);
    return () => clearInterval(interval);
  });
</script>

<header class="h-8 flex items-center justify-between px-3 bg-zinc-900/90 border-b border-zinc-800/40 select-none">
  <div class="flex items-center gap-2">
    <span class="text-[12px] font-semibold tracking-tight" style="color: oklch(0.72 0.11 75);">darce</span>
    <span class="text-[8px] px-1 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 uppercase tracking-widest font-medium">beta</span>
    <span class="text-[10px] px-1.5 py-0.5 rounded border {gearColors[settings.gear]}">{settings.gear}</span>
  </div>

  <div class="flex items-center gap-1.5">
    {#if credits}
      <span class="text-[9px] text-zinc-600 font-mono">{credits}</span>
    {/if}

    {#if settings.hasApiKey}
      <Dropdown value={settings.defaultModel} options={models}
        onchange={(v) => settings.setModel(v)} />
    {/if}
    <Dropdown value={settings.gear} options={gearOptions}
      onchange={(v) => settings.setGear(v as any)} class="w-24" />
  </div>
</header>
