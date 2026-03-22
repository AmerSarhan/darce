<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { settings, type Provider } from "$lib/stores/settings.svelte";
  import { validateApiKey } from "$lib/providers/openrouter";

  let step = $state<"provider" | "key">("provider");
  let selectedProvider = $state<Provider>("openrouter");
  let apiKey = $state("");
  let isValidating = $state(false);
  let error = $state("");

  function selectProvider(p: Provider) {
    selectedProvider = p;
    if (p === "claude-cli" && settings.claudeCliAvailable) {
      settings.setProvider("claude-cli");
      settings.setModel("claude-cli");
      settings.setApiKey("claude-cli"); // dummy to pass hasApiKey check
    } else if (p === "ollama") {
      settings.setProvider("ollama");
      settings.setModel("llama3.2");
      settings.setApiKey("ollama"); // dummy
    } else {
      step = "key";
    }
  }

  async function handleSubmit() {
    if (!apiKey.trim()) return;
    isValidating = true;
    error = "";
    try {
      if (selectedProvider === "openrouter") {
        const valid = await validateApiKey(apiKey.trim());
        if (valid) {
          settings.setProvider("openrouter");
          settings.setApiKey(apiKey.trim());
        } else {
          error = "Invalid key. Check openrouter.ai/keys.";
        }
      } else if (selectedProvider === "anthropic") {
        // Just save it — we'll validate on first use
        settings.setProvider("anthropic");
        settings.setAnthropicKey(apiKey.trim());
        settings.setApiKey(apiKey.trim()); // also set as main key for hasApiKey
        settings.setModel("claude-sonnet-4-6-20250514");
      }
    } catch {
      error = "Connection failed. Check your internet.";
    } finally { isValidating = false; }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape" && step === "key") { step = "provider"; error = ""; }
  }
</script>

<Modal open={settings.showOnboarding} title="Welcome to Darce">
  {#if step === "provider"}
    <p class="text-[12px] text-zinc-400 mb-3">Choose how you want to connect.</p>
    <div class="space-y-1.5">
      <button onclick={() => selectProvider("openrouter")}
        class="w-full text-left px-3 py-2.5 rounded-md border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30 transition-all group">
        <p class="text-[12px] text-zinc-200 font-medium group-hover:text-zinc-100">OpenRouter</p>
        <p class="text-[10px] text-zinc-500 mt-0.5">200+ models. Claude, GPT, Gemini, Llama, and more. One API key.</p>
      </button>
      <div class="relative opacity-40 pointer-events-none">
        <button class="w-full text-left px-3 py-2.5 rounded-md border border-zinc-800">
          <p class="text-[12px] text-zinc-400 font-medium">Anthropic Direct</p>
          <p class="text-[10px] text-zinc-600 mt-0.5">Use your Anthropic API key for Claude models directly.</p>
        </button>
        <span class="absolute top-2 right-2 text-[8px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Coming soon</span>
      </div>
      <div class="relative opacity-40 pointer-events-none">
        <button class="w-full text-left px-3 py-2.5 rounded-md border border-zinc-800">
          <p class="text-[12px] text-zinc-400 font-medium">Claude Code CLI</p>
          <p class="text-[10px] text-zinc-600 mt-0.5">Use your existing Claude Max/Pro subscription.</p>
        </button>
        <span class="absolute top-2 right-2 text-[8px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Coming soon</span>
      </div>
      <div class="relative opacity-40 pointer-events-none">
        <button class="w-full text-left px-3 py-2.5 rounded-md border border-zinc-800">
          <p class="text-[12px] text-zinc-400 font-medium">Ollama (Local)</p>
          <p class="text-[10px] text-zinc-600 mt-0.5">Run open-source models locally. Free, private.</p>
        </button>
        <span class="absolute top-2 right-2 text-[8px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Coming soon</span>
      </div>
    </div>
  {:else}
    <div>
      <button onclick={() => { step = "provider"; error = ""; }}
        class="text-[10px] text-zinc-600 hover:text-zinc-400 mb-2 transition-colors">&larr; Back</button>

      <p class="text-[12px] text-zinc-400 mb-3">
        {selectedProvider === "openrouter"
          ? "Paste your OpenRouter API key."
          : "Paste your Anthropic API key."}
      </p>

      <!-- svelte-ignore a11y_autofocus -->
      <input type="password" bind:value={apiKey} onkeydown={handleKeydown}
        placeholder={selectedProvider === "openrouter" ? "sk-or-v1-..." : "sk-ant-..."}
        class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[12px] text-zinc-100
          placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none mb-2" autofocus />

      {#if error}
        <p class="text-[11px] text-red-400 mb-2">{error}</p>
      {/if}

      <p class="text-[10px] text-zinc-600 mb-3">
        {selectedProvider === "openrouter"
          ? "Don't have one?"
          : "Need a key?"}
        <a href={selectedProvider === "openrouter" ? "https://openrouter.ai/keys" : "https://console.anthropic.com/keys"}
          target="_blank" class="text-accent/70 hover:text-accent ml-1">Get one here</a>
      </p>

      <div class="flex justify-end">
        <Button variant="primary" onclick={handleSubmit} disabled={isValidating || !apiKey.trim()}>
          {isValidating ? "Checking..." : "Connect"}
        </Button>
      </div>
    </div>
  {/if}
</Modal>
