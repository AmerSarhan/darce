<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

  async function validateApiKey(key: string): Promise<boolean> {
    try {
      const res = await tauriFetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${key}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  let apiKey = $state("");
  let isValidating = $state(false);
  let error = $state("");

  async function handleSubmit() {
    if (!apiKey.trim()) return;
    isValidating = true;
    error = "";
    try {
      const valid = await validateApiKey(apiKey.trim());
      if (valid) {
        settings.setProvider("auto");
        settings.setApiKey(apiKey.trim());
      } else {
        error = "Invalid key. Check openrouter.ai/keys.";
      }
    } catch {
      error = "Connection failed. Check your internet.";
    } finally {
      isValidating = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }
</script>

<Modal open={settings.showOnboarding} title="Welcome to Darce">
  <div>
    <p class="text-[12px] text-zinc-400 mb-3">
      Paste your OpenRouter API key to get started. One key, 200+ models.
    </p>

    <!-- svelte-ignore a11y_autofocus -->
    <input type="password" bind:value={apiKey} onkeydown={handleKeydown}
      placeholder="sk-or-v1-..."
      class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[12px] text-zinc-100
        placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none mb-2" autofocus />

    {#if error}
      <p class="text-[11px] text-red-400 mb-2">{error}</p>
    {/if}

    <p class="text-[10px] text-zinc-600 mb-3">
      Don't have one?
      <a href="https://openrouter.ai/keys" target="_blank" class="text-accent/70 hover:text-accent ml-1">Get one here</a>
    </p>

    <div class="flex justify-end">
      <Button variant="primary" onclick={handleSubmit} disabled={isValidating || !apiKey.trim()}>
        {isValidating ? "Checking..." : "Connect"}
      </Button>
    </div>
  </div>
</Modal>
