/**
 * Smart Model Registry — fetches models from OpenRouter, tracks latency,
 * monitors model health, and provides curated lists for auto/auto-fast modes.
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  top_provider?: { max_completion_tokens?: number };
}

export interface LatencyRecord {
  modelId: string;
  timeToFirstToken: number;
  totalTime: number;
  timestamp: number;
}

export interface ModelHealth {
  available: boolean;
  lastError: number;
  errorCount: number;
  cooldownUntil: number;
}

// ---------------------------------------------------------------------------
// Curated model lists
// ---------------------------------------------------------------------------

/** Quality-first models for "auto" mode. */
const QUALITY_MODELS = [
  "moonshotai/kimi-k2.5",
  "anthropic/claude-sonnet-4-6",
  "google/gemini-2.5-flash",
  "openai/gpt-4.1-mini",
  "meta-llama/llama-4-scout",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.5-flash-lite-preview-06-17:free",
  "meta-llama/llama-4-maverick:free",
];

/** Speed-first models for "auto-fast" mode. */
const FAST_MODELS = [
  "google/gemini-2.5-flash-lite-preview-06-17:free",
  "meta-llama/llama-4-maverick:free",
  "google/gemini-2.5-flash",
  "openai/gpt-4.1-mini",
  "moonshotai/kimi-k2.5",
  "deepseek/deepseek-chat-v3-0324:free",
];

/** Prompt cost threshold (per token) for "cheap" models — $0.50 / 1M tokens. */
const CHEAP_THRESHOLD = 0.5 / 1_000_000;

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

let cachedModels: OpenRouterModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const healthMap = new Map<string, ModelHealth>();

// ---------------------------------------------------------------------------
// Step 1: fetchModels
// ---------------------------------------------------------------------------

/**
 * Fetch available models from OpenRouter.
 * Results are cached in memory for 30 minutes.
 */
export async function fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (cachedModels && now - cacheTimestamp < CACHE_TTL) {
    return cachedModels;
  }

  const response = await tauriFetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://darce.dev",
      "X-OpenRouter-Title": "Darce",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to fetch models (${response.status}): ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  const rawModels: any[] = json.data ?? json;

  const filtered: OpenRouterModel[] = rawModels
    .filter((m: any) => {
      // Must have positive context length
      if (!m.context_length || m.context_length <= 0) return false;

      // Exclude non-text modalities (image generation, audio, etc.)
      const arch = m.architecture;
      if (arch) {
        const modality: string = arch.modality ?? "";
        // Keep anything that outputs text (e.g. "text->text", "text+image->text")
        if (modality && !modality.includes("text")) return false;
      }

      return true;
    })
    .map((m: any) => ({
      id: m.id,
      name: m.name ?? m.id,
      context_length: m.context_length,
      pricing: {
        prompt: m.pricing?.prompt ?? "0",
        completion: m.pricing?.completion ?? "0",
      },
      top_provider: m.top_provider
        ? { max_completion_tokens: m.top_provider.max_completion_tokens }
        : undefined,
    }));

  cachedModels = filtered;
  cacheTimestamp = now;
  return filtered;
}

/** Force-clear the model cache (e.g. when switching API keys). */
export function clearModelCache(): void {
  cachedModels = null;
  cacheTimestamp = 0;
}

// ---------------------------------------------------------------------------
// Step 2: getAutoModels  (quality priority)
// ---------------------------------------------------------------------------

/**
 * Returns models for "auto" mode — curated quality models first,
 * then additional free/cheap models appended.
 */
export async function getAutoModels(apiKey: string): Promise<OpenRouterModel[]> {
  const all = await fetchModels(apiKey);
  const modelMap = new Map(all.map((m) => [m.id, m]));

  // Start with curated quality models (preserve order)
  const result: OpenRouterModel[] = [];
  const seen = new Set<string>();

  for (const id of QUALITY_MODELS) {
    const m = modelMap.get(id);
    if (m && isAvailable(id)) {
      result.push(m);
      seen.add(id);
    }
  }

  // Append extra free/cheap models not already included
  for (const m of all) {
    if (seen.has(m.id)) continue;
    const promptCost = parseFloat(m.pricing.prompt) || 0;
    if (promptCost <= CHEAP_THRESHOLD) {
      if (isAvailable(m.id)) {
        result.push(m);
        seen.add(m.id);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 3: getAutoFastModels  (speed priority)
// ---------------------------------------------------------------------------

/**
 * Returns models for "auto-fast" mode — curated fast models first,
 * reordered by latency stats when available.
 */
export async function getAutoFastModels(apiKey: string): Promise<OpenRouterModel[]> {
  const all = await fetchModels(apiKey);
  const modelMap = new Map(all.map((m) => [m.id, m]));
  const stats = getLatencyStats();

  // Build initial list from curated fast models
  const curated: OpenRouterModel[] = [];
  const seen = new Set<string>();

  for (const id of FAST_MODELS) {
    const m = modelMap.get(id);
    if (m && isAvailable(id)) {
      curated.push(m);
      seen.add(id);
    }
  }

  // Sort curated list by latency: models with measured TTFT get promoted
  curated.sort((a, b) => {
    const sa = stats.get(a.id);
    const sb = stats.get(b.id);

    // If both have stats, compare by avgTtft
    if (sa && sb) return sa.avgTtft - sb.avgTtft;

    // Models with stats go first (known quantity > unknown)
    if (sa && !sb) return -1;
    if (!sa && sb) return 1;

    // No stats for either — keep curated order (stable sort)
    return 0;
  });

  // Append extra cheap/free models not already included
  for (const m of all) {
    if (seen.has(m.id)) continue;
    const promptCost = parseFloat(m.pricing.prompt) || 0;
    if (promptCost <= CHEAP_THRESHOLD && isAvailable(m.id)) {
      curated.push(m);
      seen.add(m.id);
    }
  }

  return curated;
}

// ---------------------------------------------------------------------------
// Step 4: Latency tracker
// ---------------------------------------------------------------------------

const LATENCY_KEY = "darce_latency_stats";
const MAX_RECORDS_PER_MODEL = 10;

/** Per-model rolling window of latency records. */
let latencyRecords = new Map<string, LatencyRecord[]>();

/** Load persisted latency data from localStorage. */
function loadLatencyRecords(): void {
  try {
    const raw = localStorage.getItem(LATENCY_KEY);
    if (!raw) return;
    const parsed: Record<string, LatencyRecord[]> = JSON.parse(raw);
    latencyRecords = new Map(Object.entries(parsed));
  } catch {
    // Corrupt data — start fresh
    latencyRecords = new Map();
  }
}

/** Persist latency data to localStorage. */
function saveLatencyRecords(): void {
  try {
    const obj: Record<string, LatencyRecord[]> = {};
    for (const [k, v] of latencyRecords) {
      obj[k] = v;
    }
    localStorage.setItem(LATENCY_KEY, JSON.stringify(obj));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Record a latency measurement for a model.
 * Keeps a rolling window of the last 10 calls.
 */
export function recordLatency(modelId: string, ttft: number, totalTime: number): void {
  let records = latencyRecords.get(modelId);
  if (!records) {
    records = [];
    latencyRecords.set(modelId, records);
  }

  records.push({
    modelId,
    timeToFirstToken: ttft,
    totalTime,
    timestamp: Date.now(),
  });

  // Keep only the last N records
  if (records.length > MAX_RECORDS_PER_MODEL) {
    records.splice(0, records.length - MAX_RECORDS_PER_MODEL);
  }

  saveLatencyRecords();
}

/**
 * Get aggregated latency stats for all tracked models.
 */
export function getLatencyStats(): Map<string, { avgTtft: number; avgTotal: number; count: number }> {
  const result = new Map<string, { avgTtft: number; avgTotal: number; count: number }>();

  for (const [modelId, records] of latencyRecords) {
    if (records.length === 0) continue;
    const count = records.length;
    const avgTtft = records.reduce((s, r) => s + r.timeToFirstToken, 0) / count;
    const avgTotal = records.reduce((s, r) => s + r.totalTime, 0) / count;
    result.set(modelId, { avgTtft, avgTotal, count });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 5: Model health tracking
// ---------------------------------------------------------------------------

const COOLDOWN_30S = 30 * 1000;
const COOLDOWN_2MIN = 2 * 60 * 1000;
const COOLDOWN_10MIN = 10 * 60 * 1000;

function getHealth(modelId: string): ModelHealth {
  let h = healthMap.get(modelId);
  if (!h) {
    h = { available: true, lastError: 0, errorCount: 0, cooldownUntil: 0 };
    healthMap.set(modelId, h);
  }
  return h;
}

function getCooldownDuration(errorCount: number): number {
  if (errorCount <= 1) return COOLDOWN_30S;
  if (errorCount === 2) return COOLDOWN_2MIN;
  return COOLDOWN_10MIN;
}

/** Mark a successful response from a model — resets error state. */
export function markSuccess(modelId: string): void {
  const h = getHealth(modelId);
  h.available = true;
  h.errorCount = 0;
  h.cooldownUntil = 0;
}

/** Mark an error from a model — applies escalating cooldown. */
export function markError(modelId: string): void {
  const h = getHealth(modelId);
  const now = Date.now();
  h.lastError = now;
  h.errorCount += 1;
  h.cooldownUntil = now + getCooldownDuration(h.errorCount);
  h.available = false;
}

/** Check if a model is currently available (not in cooldown). */
export function isAvailable(modelId: string): boolean {
  const h = healthMap.get(modelId);
  if (!h) return true; // Unknown models are assumed available
  if (h.cooldownUntil <= Date.now()) {
    // Cooldown expired — model is available again
    h.available = true;
    return true;
  }
  return h.available;
}

/** Get the current health record for a model (read-only snapshot). */
export function getModelHealth(modelId: string): ModelHealth {
  return { ...getHealth(modelId) };
}

/** Reset all health tracking (e.g. for testing or fresh start). */
export function resetAllHealth(): void {
  healthMap.clear();
}

// ---------------------------------------------------------------------------
// Init: load persisted latency data on module load
// ---------------------------------------------------------------------------

loadLatencyRecords();
