import type { Gear } from "$lib/types";

export type Provider = "auto" | "auto-fast" | "manual";

class SettingsStore {
  provider: Provider = $state("auto");
  apiKey = $state("");
  defaultModel = $state("moonshotai/kimi-k2.5");
  defaultManualModel = $state("moonshotai/kimi-k2.5");
  gear: Gear = $state("ship");
  lastProjectPath = $state("");
  browserosEnabled = $state(false);
  browserosPort = $state(9000);
  crawlRocketKey = $state("");

  hasApiKey = $derived(this.apiKey.length > 0);
  initialized = $state(false);
  showOnboarding = $derived(this.initialized && !this.hasApiKey);

  async init() {
    try {
      const saved = localStorage.getItem("darce_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old provider types to new ones
        const validProviders: Provider[] = ["auto", "auto-fast", "manual"];
        if (parsed.provider && validProviders.includes(parsed.provider)) {
          this.provider = parsed.provider;
        }
        if (parsed.apiKey) this.apiKey = parsed.apiKey;
        if (parsed.defaultModel) this.defaultModel = parsed.defaultModel;
        if (parsed.defaultManualModel) this.defaultManualModel = parsed.defaultManualModel;
        if (parsed.gear) this.gear = parsed.gear;
        if (parsed.lastProjectPath) this.lastProjectPath = parsed.lastProjectPath;
        if (parsed.browserosEnabled !== undefined) this.browserosEnabled = parsed.browserosEnabled;
        if (parsed.browserosPort !== undefined) this.browserosPort = parsed.browserosPort;
        if (parsed.crawlRocketKey) this.crawlRocketKey = parsed.crawlRocketKey;

        // Migrate: old invalid provider types → auto
        if (!validProviders.includes(this.provider)) {
          this.provider = "auto";
        }
        // Migrate: old BrowserOS port default
        if (this.browserosPort === 9239) {
          this.browserosPort = 9000;
        }
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    this.initialized = true;
    this.save(); // persist any migrations
  }

  private save() {
    try {
      localStorage.setItem("darce_settings", JSON.stringify({
        provider: this.provider,
        apiKey: this.apiKey,
        defaultModel: this.defaultModel,
        defaultManualModel: this.defaultManualModel,
        gear: this.gear,
        lastProjectPath: this.lastProjectPath,
        browserosEnabled: this.browserosEnabled,
        browserosPort: this.browserosPort,
        crawlRocketKey: this.crawlRocketKey,
      }));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }

  setProvider(p: Provider) { this.provider = p; this.save(); }
  setApiKey(key: string) { this.apiKey = key; this.save(); }
  setModel(model: string) { this.defaultModel = model; this.save(); }
  setManualModel(model: string) { this.defaultManualModel = model; this.save(); }
  setGear(gear: Gear) { this.gear = gear; this.save(); }
  setLastProject(path: string) { this.lastProjectPath = path; this.save(); }
  setCrawlRocketKey(key: string) { this.crawlRocketKey = key; this.save(); }
  setBrowseros(enabled: boolean, port?: number) {
    this.browserosEnabled = enabled;
    if (port !== undefined) this.browserosPort = port;
    this.save();
  }

  get activeKey(): string {
    return this.apiKey;
  }

  cycleGear() {
    const gears: Gear[] = ["ship", "understand", "learn"];
    const idx = gears.indexOf(this.gear);
    this.setGear(gears[(idx + 1) % gears.length]);
  }
}

export const settings = new SettingsStore();
