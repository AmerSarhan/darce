/**
 * Update Checker — polls GitHub releases for new versions.
 * Shows update prompt + What's New changelog.
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const GITHUB_REPO = "AmerSarhan/darce";
const CURRENT_VERSION = "0.1.0";
const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

export interface ReleaseInfo {
  version: string;
  name: string;
  body: string; // markdown changelog
  url: string; // GitHub release page
  publishedAt: string;
  assets: { name: string; url: string; size: number }[];
}

class UpdaterStore {
  currentVersion = CURRENT_VERSION;
  latestRelease = $state<ReleaseInfo | null>(null);
  hasUpdate = $state(false);
  showUpdateModal = $state(false);
  showWhatsNew = $state(false);
  checking = $state(false);
  lastCheck = $state(0);
  error = $state<string | null>(null);
  /** Brief status message after a manual check */
  checkStatus = $state<string | null>(null);

  /** What's New for the CURRENT version — shown once after first launch of this version */
  currentChangelog = $state<string | null>(null);

  async init() {
    // Check if user already dismissed What's New for this version
    const dismissed = localStorage.getItem("darce_whats_new_dismissed");
    const seenVersion = localStorage.getItem("darce_whats_new_version");

    // Show What's New if version changed since last seen
    if (seenVersion !== CURRENT_VERSION) {
      this.showWhatsNew = true;
      this.currentChangelog = WHATS_NEW[CURRENT_VERSION] || null;
    }

    // Check for updates
    await this.check();

    // Schedule periodic checks
    setInterval(() => this.check(), CHECK_INTERVAL);
  }

  async check(manual = false) {
    if (this.checking) return;
    this.checking = true;
    this.error = null;
    this.checkStatus = null;

    try {
      const res = await tauriFetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Darce/" + CURRENT_VERSION,
          },
        },
      );

      if (!res.ok) {
        // 404 = no releases yet
        if (res.status === 404) {
          if (manual) this.checkStatus = "You're on the latest version.";
          this.checking = false;
          return;
        }
        throw new Error(`GitHub API ${res.status}`);
      }

      const data = await res.json() as {
        tag_name: string;
        name: string;
        body: string;
        html_url: string;
        published_at: string;
        assets: { name: string; browser_download_url: string; size: number }[];
      };

      const version = data.tag_name.replace(/^v/, "");
      this.latestRelease = {
        version,
        name: data.name || `v${version}`,
        body: data.body || "",
        url: data.html_url,
        publishedAt: data.published_at,
        assets: data.assets.map((a) => ({
          name: a.name,
          url: a.browser_download_url,
          size: a.size,
        })),
      };

      this.hasUpdate = isNewer(version, CURRENT_VERSION);
      if (this.hasUpdate) {
        // Auto-show update modal if it's a new release they haven't dismissed
        const dismissed = localStorage.getItem("darce_update_dismissed");
        if (dismissed !== version) {
          this.showUpdateModal = true;
        }
        if (manual) this.checkStatus = `Update available: v${version}`;
      } else {
        if (manual) this.checkStatus = "You're on the latest version.";
      }

      this.lastCheck = Date.now();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      if (manual) this.checkStatus = "Couldn't check for updates. Try again later.";
      console.warn("[Updater] Check failed:", this.error);
    } finally {
      this.checking = false;
    }
  }

  dismissUpdate() {
    this.showUpdateModal = false;
    if (this.latestRelease) {
      localStorage.setItem("darce_update_dismissed", this.latestRelease.version);
    }
  }

  dismissWhatsNew() {
    this.showWhatsNew = false;
    localStorage.setItem("darce_whats_new_version", CURRENT_VERSION);
  }

  /** Re-open What's New (from menu) */
  openWhatsNew() {
    this.showWhatsNew = true;
  }

  /** Get the right download URL for the current platform */
  getDownloadUrl(): string | null {
    if (!this.latestRelease) return null;

    const assets = this.latestRelease.assets;
    // Detect platform from user agent
    const ua = navigator.userAgent.toLowerCase();
    let pattern: RegExp;

    if (ua.includes("win")) {
      pattern = /\.(exe|msi)$/i;
    } else if (ua.includes("mac") || ua.includes("darwin")) {
      pattern = /\.dmg$/i;
    } else {
      pattern = /\.(AppImage|deb)$/i;
    }

    const match = assets.find((a) => pattern.test(a.name));
    return match?.url || this.latestRelease.url;
  }
}

/** Compare semver strings — returns true if a > b */
function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

/**
 * What's New entries keyed by version.
 * Update this when releasing new versions.
 */
const WHATS_NEW: Record<string, string> = {
  "0.1.0": `### Welcome to Darce!

- **AI Coding Agent** — writes, reads, and runs code for you
- **Auto Free Mode** — uses the best free AI models, no API key needed
- **Smart Model Switching** — auto-retries on errors, rotates between models
- **Learn Mode** — teaches you concepts while building
- **Monaco Editor** — VS Code editing experience
- **Full Terminal** — see command output in real-time`,
};

export const updater = new UpdaterStore();
