import type { Gear } from "$lib/types";

export type Provider = "openrouter" | "anthropic" | "claude-cli" | "ollama";

class SettingsStore {
  provider: Provider = $state("openrouter");
  apiKey = $state("");
  anthropicKey = $state("");
  ollamaUrl = $state("http://localhost:11434");
  defaultModel = $state("anthropic/claude-sonnet-4-6");
  gear: Gear = $state("ship");
  lastProjectPath = $state("");
  claudeCliAvailable = $state(false);

  hasApiKey = $derived(
    this.provider === "openrouter" ? this.apiKey.length > 0
    : this.provider === "anthropic" ? this.anthropicKey.length > 0
    : this.provider === "claude-cli" ? this.claudeCliAvailable
    : this.provider === "ollama" ? true
    : false
  );
  initialized = $state(false);
  showOnboarding = $derived(this.initialized && !this.hasApiKey);

  async init() {
    try {
      const saved = localStorage.getItem("darce_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.provider) this.provider = parsed.provider;
        if (parsed.apiKey) this.apiKey = parsed.apiKey;
        if (parsed.anthropicKey) this.anthropicKey = parsed.anthropicKey;
        if (parsed.ollamaUrl) this.ollamaUrl = parsed.ollamaUrl;
        if (parsed.defaultModel) this.defaultModel = parsed.defaultModel;
        if (parsed.gear) this.gear = parsed.gear;
        if (parsed.lastProjectPath) this.lastProjectPath = parsed.lastProjectPath;
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    this.initialized = true;
    // Check if Claude CLI is available
    this.checkClaudeCli();
  }

  async checkClaudeCli() {
    try {
      const { tauriInvoke } = await import("$lib/utils/ipc");
      const result = await tauriInvoke<{ stdout: string; stderr: string; exit_code: number }>(
        "run_shell_command", { cwd: ".", command: "claude --version" }
      );
      this.claudeCliAvailable = result.exit_code === 0;
      if (this.claudeCliAvailable) {
        console.log("[Darce] Claude Code CLI detected:", result.stdout.trim());
      }
    } catch {
      this.claudeCliAvailable = false;
    }
  }

  private save() {
    try {
      localStorage.setItem("darce_settings", JSON.stringify({
        provider: this.provider,
        apiKey: this.apiKey,
        anthropicKey: this.anthropicKey,
        ollamaUrl: this.ollamaUrl,
        defaultModel: this.defaultModel,
        gear: this.gear,
        lastProjectPath: this.lastProjectPath,
      }));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }

  setProvider(p: Provider) { this.provider = p; this.save(); }
  setApiKey(key: string) { this.apiKey = key; this.save(); }
  setAnthropicKey(key: string) { this.anthropicKey = key; this.save(); }
  setOllamaUrl(url: string) { this.ollamaUrl = url; this.save(); }
  setModel(model: string) { this.defaultModel = model; this.save(); }
  setGear(gear: Gear) { this.gear = gear; this.save(); }
  setLastProject(path: string) { this.lastProjectPath = path; this.save(); }

  /** Get the active API key based on current provider */
  get activeKey(): string {
    if (this.provider === "openrouter") return this.apiKey;
    if (this.provider === "anthropic") return this.anthropicKey;
    return "";
  }

  cycleGear() {
    const gears: Gear[] = ["ship", "understand", "learn"];
    const idx = gears.indexOf(this.gear);
    this.setGear(gears[(idx + 1) % gears.length]);
  }
}

export const settings = new SettingsStore();
