<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { settings, type Provider } from "$lib/stores/settings.svelte";

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();

  let provider = $state<Provider>("openrouter");
  let apiKey = $state("");
  let anthropicKey = $state("");
  let ollamaUrl = $state("http://localhost:11434");
  let model = $state("");

  $effect(() => {
    if (open) {
      provider = settings.provider;
      apiKey = settings.apiKey;
      anthropicKey = settings.anthropicKey;
      ollamaUrl = settings.ollamaUrl;
      model = settings.defaultModel;
    }
  });

  function save() {
    settings.setProvider(provider);
    if (apiKey !== settings.apiKey) settings.setApiKey(apiKey);
    if (anthropicKey !== settings.anthropicKey) settings.setAnthropicKey(anthropicKey);
    if (ollamaUrl !== settings.ollamaUrl) settings.setOllamaUrl(ollamaUrl);
    if (model !== settings.defaultModel) settings.setModel(model);
    onclose();
  }

  function clearData() {
    if (confirm("Clear all saved data?")) {
      localStorage.clear();
      window.location.reload();
    }
  }

  const providers: { value: Provider; label: string; desc: string }[] = [
    { value: "openrouter", label: "OpenRouter", desc: "200+ models, one API key" },
    { value: "anthropic", label: "Anthropic Direct", desc: "Claude models directly" },
    { value: "claude-cli", label: "Claude Code CLI", desc: "Use your Claude subscription" },
    { value: "ollama", label: "Ollama (Local)", desc: "Run models locally, no API key" },
  ];

  const modelsByProvider: Record<Provider, { value: string; label: string }[]> = {
    openrouter: [
      { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
      { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "meta-llama/llama-4-scout", label: "Llama 4 Scout" },
      { value: "moonshotai/kimi-k2.5", label: "Kimi K2.5" },
      { value: "x-ai/grok-4.20-multi-agent-beta", label: "Grok 4 (2M)" },
    ],
    anthropic: [
      { value: "claude-sonnet-4-6-20250514", label: "Claude Sonnet 4.6" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
    "claude-cli": [
      { value: "claude-cli", label: "Claude (via CLI)" },
    ],
    ollama: [
      { value: "llama3.2", label: "Llama 3.2" },
      { value: "codellama", label: "Code Llama" },
      { value: "mistral", label: "Mistral" },
      { value: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
    ],
  };
</script>

<Modal {open} {onclose} title="Preferences">
  <div class="space-y-4">
    <!-- Provider Selection -->
    <div>
      <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1.5">Provider</p>
      <div class="grid grid-cols-2 gap-1.5">
        {#each providers as p}
          {#if p.value === "openrouter"}
            <button onclick={() => { provider = p.value; model = modelsByProvider[p.value][0]?.value || ""; }}
              class="text-left px-2.5 py-2 rounded-md border transition-all text-[11px]
                {provider === p.value
                  ? 'border-accent/40 bg-accent/5 text-zinc-200'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}">
              <p class="font-medium">{p.label}</p>
              <p class="text-[9px] {provider === p.value ? 'text-zinc-400' : 'text-zinc-600'} mt-0.5">{p.desc}</p>
            </button>
          {:else}
            <div class="relative text-left px-2.5 py-2 rounded-md border border-zinc-800 text-[11px] opacity-35">
              <p class="font-medium text-zinc-500">{p.label}</p>
              <p class="text-[9px] text-zinc-600 mt-0.5">{p.desc}</p>
              <span class="absolute top-1 right-1 text-[7px] text-zinc-600 bg-zinc-800 px-1 py-0.5 rounded uppercase tracking-wider">Soon</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Provider-specific config -->
    {#if provider === "openrouter"}
      <div>
        <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">API Key</p>
        <input type="password" bind:value={apiKey} placeholder="sk-or-v1-..."
          class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none" />
        <p class="text-[10px] text-zinc-600 mt-1">
          <a href="https://openrouter.ai/keys" target="_blank" class="text-accent/70 hover:text-accent">Get a key</a>
        </p>
      </div>
    {:else if provider === "anthropic"}
      <div>
        <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Anthropic API Key</p>
        <input type="password" bind:value={anthropicKey} placeholder="sk-ant-..."
          class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none" />
        <p class="text-[10px] text-zinc-600 mt-1">
          <a href="https://console.anthropic.com/keys" target="_blank" class="text-accent/70 hover:text-accent">Get a key</a>
        </p>
      </div>
    {:else if provider === "claude-cli"}
      <div class="px-3 py-2 rounded-md border {settings.claudeCliAvailable ? 'border-emerald-900/40 bg-emerald-950/20' : 'border-red-900/40 bg-red-950/20'}">
        {#if settings.claudeCliAvailable}
          <p class="text-[11px] text-emerald-400 font-medium">Claude Code CLI detected</p>
          <p class="text-[10px] text-zinc-500 mt-0.5">Uses your existing Claude subscription. No API key needed.</p>
        {:else}
          <p class="text-[11px] text-red-400 font-medium">Claude Code CLI not found</p>
          <p class="text-[10px] text-zinc-500 mt-0.5">Install it: <code class="text-zinc-400 bg-zinc-800 px-1 rounded">npm i -g @anthropic-ai/claude-code</code></p>
        {/if}
      </div>
    {:else if provider === "ollama"}
      <div>
        <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Ollama URL</p>
        <input bind:value={ollamaUrl} placeholder="http://localhost:11434"
          class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none" />
        <p class="text-[10px] text-zinc-600 mt-1">Make sure Ollama is running locally</p>
      </div>
    {/if}

    <!-- Model Selection -->
    <div>
      <p class="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Model</p>
      <select bind:value={model}
        class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-[12px] text-zinc-100 focus:border-accent/40 focus:outline-none">
        {#each modelsByProvider[provider] || [] as m}
          <option value={m.value}>{m.label}</option>
        {/each}
      </select>
    </div>

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
