<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { settings, type Provider } from "$lib/stores/settings.svelte";

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();

  let provider = $state<Provider>("auto");
  let apiKey = $state("");
  let manualModel = $state("anthropic/claude-sonnet-4-6");
  let crawlRocketKey = $state("");
  let browserosEnabled = $state(false);
  let browserosPort = $state(9000);
  let browserosStatus = $state<"checking" | "connected" | "disconnected">("disconnected");

  async function checkBrowserOS() {
    browserosStatus = "checking";
    try {
      const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
      const res = await tauriFetch(`http://127.0.0.1:${browserosPort}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      });
      browserosStatus = res.ok ? "connected" : "disconnected";
      if (res.ok && !browserosEnabled) {
        browserosEnabled = true; // auto-enable when detected
      }
    } catch {
      browserosStatus = "disconnected";
    }
  }

  $effect(() => {
    if (open) {
      provider = settings.provider;
      apiKey = settings.apiKey;
      manualModel = settings.defaultManualModel;
      crawlRocketKey = settings.crawlRocketKey;
      browserosEnabled = settings.browserosEnabled;
      browserosPort = settings.browserosPort;
      checkBrowserOS();
    }
  });

  const modes: { value: Provider; label: string; desc: string }[] = [
    { value: "auto", label: "Auto", desc: "Smart rotation \u2014 best models first, auto-fallback on errors." },
    { value: "auto-fast", label: "Auto Fast", desc: "Optimized for speed \u2014 tries fastest models first, tracks latency." },
    { value: "manual", label: "Manual", desc: "Choose a specific model." },
  ];

  const manualModels = [
    { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "meta-llama/llama-4-scout", label: "Llama 4 Scout" },
    { value: "moonshotai/kimi-k2.5", label: "Kimi K2.5" },
    { value: "x-ai/grok-4.20-multi-agent-beta", label: "Grok 4 (2M)" },
  ];

  function save() {
    settings.setProvider(provider);
    if (apiKey !== settings.apiKey) settings.setApiKey(apiKey);
    if (manualModel !== settings.defaultManualModel) settings.setManualModel(manualModel);
    settings.setCrawlRocketKey(crawlRocketKey);
    settings.setBrowseros(browserosEnabled, browserosPort);
    onclose();
  }

  function clearData() {
    if (confirm("Clear all saved data?")) {
      localStorage.clear();
      window.location.reload();
    }
  }
</script>

<Modal {open} {onclose} title="Preferences">
  <div class="space-y-4">
    <!-- Mode Selector -->
    <div>
      <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1.5">Mode</p>
      <div class="grid grid-cols-3 gap-1.5">
        {#each modes as m}
          <button onclick={() => { provider = m.value; }}
            class="text-left px-2.5 py-2 rounded-md border transition-all text-[11px]
              {provider === m.value
                ? 'border-accent/40 bg-accent/5 text-zinc-200'
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}">
            <p class="font-medium">{m.label}</p>
            <p class="text-[9px] {provider === m.value ? 'text-zinc-400' : 'text-zinc-600'} mt-0.5">{m.desc}</p>
          </button>
        {/each}
      </div>
    </div>

    <!-- API Key (always shown) -->
    <div>
      <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">API Key</p>
      <input type="password" bind:value={apiKey} placeholder="sk-or-v1-..."
        class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none" />
      <p class="text-[10px] text-zinc-600 mt-1">
        <a href="https://openrouter.ai/keys" target="_blank" class="text-accent/70 hover:text-accent">Get a key</a>
      </p>
    </div>

    <!-- Web Browsing (CrawlRocket) -->
    <div>
      <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Web Browsing <span class="normal-case text-zinc-600">(browse + search)</span></p>
      <input type="password" bind:value={crawlRocketKey} placeholder="sk_pro_..."
        class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none" />
      <p class="text-[10px] text-zinc-600 mt-1">
        <a href="https://www.crawlrocket.com" target="_blank" class="text-accent/70 hover:text-accent">Get a free key</a> — lets the agent browse any page and search Google
      </p>
    </div>

    <!-- BrowserOS — browser automation -->
    <div class="px-3 py-2 rounded-md border {browserosEnabled ? 'border-indigo-900/40 bg-indigo-950/10' : 'border-zinc-800 bg-zinc-800/20'}">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <p class="text-[11px] {browserosEnabled ? 'text-indigo-300' : 'text-zinc-400'} font-medium">Browser</p>
          {#if browserosEnabled && browserosStatus === "connected"}
            <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
          {/if}
        </div>
        <button onclick={() => { browserosEnabled = !browserosEnabled; }}
          title="Toggle BrowserOS"
          class="w-8 h-4 rounded-full transition-colors relative {browserosEnabled ? 'bg-indigo-600' : 'bg-zinc-700'}">
          <div class="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all {browserosEnabled ? 'left-4.5' : 'left-0.5'}"></div>
        </button>
      </div>
      <p class="text-[10px] text-zinc-600 mt-1">Let the agent browse pages, test your app, and interact with UIs.</p>
      {#if browserosEnabled}
        <div class="mt-2 flex items-center gap-2">
          <a href="https://github.com/browseros-ai/BrowserOS/releases" target="_blank"
            class="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">Download BrowserOS</a>
          <span class="text-[10px] text-zinc-700">·</span>
          <span class="text-[10px] text-zinc-600 font-mono">port {browserosPort}</span>
        </div>
      {/if}
    </div>

    <!-- Manual Model Selection -->
    {#if provider === "manual"}
      <div>
        <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Model</p>
        <select bind:value={manualModel}
          class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-[12px] text-zinc-100 focus:border-accent/40 focus:outline-none">
          {#each manualModels as m}
            <option value={m.value}>{m.label}</option>
          {/each}
        </select>
      </div>
    {/if}

    <!-- Info -->
    <div class="text-[10px] text-zinc-600 space-y-0.5 pt-2 border-t border-zinc-800/60">
      <p class="text-zinc-500">Darce v0.1.0 Beta</p>
      <p>The AI coder that makes you smarter.</p>
      <div class="flex gap-3 mt-1">
        <a href="https://darce.dev" target="_blank" class="text-accent/70 hover:text-accent">Website</a>
        <a href="https://github.com/AmerSarhan/darce" target="_blank" class="hover:text-zinc-400">GitHub</a>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between">
      <button onclick={clearData} class="text-[10px] text-red-500/70 hover:text-red-400 transition-colors">
        Reset All
      </button>
      <div class="flex gap-2">
        <Button variant="ghost" onclick={onclose}>Cancel</Button>
        <Button variant="primary" onclick={save}>Save</Button>
      </div>
    </div>
  </div>
</Modal>
