/**
 * Auto Provider — smart model rotation engine.
 *
 * Tries the best available models in order and falls back on errors
 * (rate limits, timeouts, empty responses). Tracks latency and
 * availability so subsequent calls prefer healthy models.
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
  getAutoModels,
  getAutoFastModels,
  recordLatency,
  markSuccess,
  markError,
  isAvailable,
  type OpenRouterModel,
} from "./models";
import type { AgentMessage } from "./agent";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AutoCallbacks {
  onToken: (token: string) => void;
  onToolCallDelta: (
    index: number,
    id: string | null,
    name: string | null,
    argsChunk: string | null,
  ) => void;
  onModelSwitch: (from: string, to: string, reason: string) => void;
}

export interface AutoResult {
  content: string;
  toolCalls: { id: string; name: string; args: string }[];
  finishReason: string;
  modelUsed: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_EMPTY_PER_MODEL = 2;
/** Rough estimate: ~4 characters per token. */
const CHARS_PER_TOKEN = 4;

/* ------------------------------------------------------------------ */
/*  Context fitting                                                    */
/* ------------------------------------------------------------------ */

/**
 * Trim messages so they fit within `contextLength` tokens.
 * Keeps the system prompt (always sent separately) and the most recent
 * messages that fit. Uses a simple heuristic of ~4 chars per token.
 */
function fitToContext(
  messages: AgentMessage[],
  systemPrompt: string,
  contextLength: number,
): AgentMessage[] {
  const maxChars = contextLength * CHARS_PER_TOKEN;
  const systemChars = systemPrompt.length;
  let budget = maxChars - systemChars;
  if (budget <= 0) budget = maxChars * 0.5; // degenerate case — allow some room

  // Walk backwards through messages, accumulating those that fit.
  const kept: AgentMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const size = estimateMessageSize(msg);
    if (budget - size < 0 && kept.length > 0) break;
    budget -= size;
    kept.unshift(msg);
  }

  return kept;
}

function estimateMessageSize(msg: AgentMessage): number {
  let size = 0;
  if (msg.content) size += typeof msg.content === "string" ? msg.content.length : 0;
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      size += tc.function.name.length + tc.function.arguments.length;
    }
  }
  return size;
}

/* ------------------------------------------------------------------ */
/*  Tool description injection (fallback for models without tool API)  */
/* ------------------------------------------------------------------ */

function injectToolsIntoPrompt(systemPrompt: string, tools: any[]): string {
  if (tools.length === 0) return systemPrompt;

  let toolText = "\n\n## Available Tools\n";
  toolText += "You can call tools by responding with a JSON object in the following format:\n";
  toolText += '```json\n{"tool_calls": [{"name": "tool_name", "arguments": {...}}]}\n```\n\n';

  for (const tool of tools) {
    const fn = tool.function || tool;
    toolText += `### ${fn.name}\n`;
    toolText += `${fn.description || ""}\n`;
    if (fn.parameters) {
      toolText += `Parameters: ${JSON.stringify(fn.parameters, null, 2)}\n`;
    }
    toolText += "\n";
  }

  return systemPrompt + toolText;
}

/* ------------------------------------------------------------------ */
/*  SSE stream parser                                                  */
/* ------------------------------------------------------------------ */

async function parseSSEStreamWithTiming(
  response: Response,
  callbacks: AutoCallbacks,
  startTime: number,
): Promise<{ result: AutoResult; ttft: number; totalTime: number }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls = new Map<number, { id: string; name: string; args: string }>();
  let finishReason = "";
  let modelUsed = "";
  let ttft = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);

      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data:")) continue;

      const data = line.slice(5).trim();
      if (data === "[DONE]") break;

      try {
        const parsed = JSON.parse(data);

        // Extract model from the first chunk if available
        if (!modelUsed && parsed.model) {
          modelUsed = parsed.model;
        }

        const choice = parsed.choices?.[0];
        if (!choice) continue;

        if (choice.finish_reason) finishReason = choice.finish_reason;

        const delta = choice.delta;

        // Content tokens
        if (delta?.content) {
          if (ttft < 0) ttft = Date.now() - startTime;
          content += delta.content;
          callbacks.onToken(delta.content);
        }

        // Tool call deltas
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const tcIdx = tc.index ?? 0;
            if (!toolCalls.has(tcIdx)) {
              toolCalls.set(tcIdx, { id: "", name: "", args: "" });
            }
            const existing = toolCalls.get(tcIdx)!;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;

            callbacks.onToolCallDelta(
              tcIdx,
              tc.id || null,
              tc.function?.name || null,
              tc.function?.arguments || null,
            );
          }
        }
      } catch {
        /* skip malformed SSE chunks */
      }
    }
  }

  const totalTime = Date.now() - startTime;
  if (ttft < 0) ttft = totalTime; // no content tokens received

  return {
    result: {
      content,
      toolCalls: Array.from(toolCalls.values()),
      finishReason,
      modelUsed,
    },
    ttft,
    totalTime,
  };
}

/* ------------------------------------------------------------------ */
/*  Single model attempt                                               */
/* ------------------------------------------------------------------ */

async function tryModel(
  model: OpenRouterModel,
  messages: AgentMessage[],
  systemPrompt: string,
  tools: any[],
  callbacks: AutoCallbacks,
  signal: AbortSignal | undefined,
  apiKey: string,
  withTools: boolean,
): Promise<
  | { ok: true; result: AutoResult; ttft: number; totalTime: number }
  | { ok: false; reason: "rate_limited" | "auth" | "empty" | "timeout" | "tools_unsupported" | "error"; detail: string }
> {
  const modelId = model.id;
  const contextLength = model.context_length ?? 128_000;

  // Fit messages to the model's context window
  const fitted = fitToContext(messages, systemPrompt, contextLength);

  // Build request body
  const body: any = {
    model: modelId,
    messages: [{ role: "system", content: withTools ? systemPrompt : systemPrompt }, ...fitted],
    stream: true,
  };

  if (withTools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  } else if (!withTools && tools.length > 0) {
    // Inject tool descriptions into system prompt as text
    body.messages[0].content = injectToolsIntoPrompt(systemPrompt, tools);
  }

  // Prompt caching — Anthropic needs explicit cache_control, others cache automatically
  if (modelId.includes("anthropic/") || modelId.includes("claude")) {
    body.cache_control = { type: "ephemeral" };
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "HTTP-Referer": "https://darce.dev",
    "X-OpenRouter-Title": "Darce",
    "Content-Type": "application/json",
  };

  const startTime = Date.now();

  let response: Response;
  try {
    response = await tauriFetch(OPENROUTER_URL, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    if (e.name === "AbortError" || String(e).includes("abort")) {
      return { ok: false, reason: "timeout", detail: "Request aborted" };
    }
    return { ok: false, reason: "error", detail: String(e) };
  }

  if (!response.ok) {
    const status = response.status;
    const text = await response.text().catch(() => "");

    if (status === 401) {
      return { ok: false, reason: "auth", detail: "Invalid API key." };
    }
    if (status === 429) {
      return { ok: false, reason: "rate_limited", detail: text };
    }
    if (status === 404 && text.includes("tool")) {
      return { ok: false, reason: "tools_unsupported", detail: text };
    }
    return { ok: false, reason: "error", detail: `API error (${status}): ${text.slice(0, 200)}` };
  }

  try {
    const { result, ttft, totalTime } = await parseSSEStreamWithTiming(
      response,
      callbacks,
      startTime,
    );

    // Override modelUsed to the requested model if the API didn't report one
    if (!result.modelUsed) result.modelUsed = modelId;

    return { ok: true, result, ttft, totalTime };
  } catch (e: any) {
    if (e.name === "AbortError" || String(e).includes("abort")) {
      return { ok: false, reason: "timeout", detail: "Stream aborted" };
    }
    return { ok: false, reason: "error", detail: String(e) };
  }
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export async function sendAuto(
  messages: AgentMessage[],
  systemPrompt: string,
  tools: any[],
  callbacks: AutoCallbacks,
  signal: AbortSignal | undefined,
  apiKey: string,
  mode: "auto" | "auto-fast",
): Promise<AutoResult> {
  // 1. Build model candidates FAST — use curated list, skip API call
  //    The OpenRouter models API returns 200+ models and adds 1-3s latency.
  //    We know the good models already — just use them directly.
  const { settings } = await import("$lib/stores/settings.svelte");
  const preferred = settings.defaultModel;

  const CURATED: OpenRouterModel[] = (mode === "auto-fast"
    ? [
        "google/gemini-2.5-flash-lite-preview-06-17:free",
        "meta-llama/llama-4-maverick:free",
        "google/gemini-2.5-flash",
        "openai/gpt-4.1-mini",
        "moonshotai/kimi-k2.5",
        "deepseek/deepseek-chat-v3-0324:free",
      ]
    : [
        "moonshotai/kimi-k2.5",
        "anthropic/claude-sonnet-4-6",
        "google/gemini-2.5-flash",
        "openai/gpt-4.1-mini",
        "meta-llama/llama-4-scout",
        "deepseek/deepseek-chat-v3-0324:free",
        "google/gemini-2.5-flash-lite-preview-06-17:free",
        "meta-llama/llama-4-maverick:free",
      ]
  ).map(id => ({
    id,
    name: id.split("/").pop() || id,
    context_length: 128000,
    pricing: { prompt: "0", completion: "0" },
  }));

  // Inject preferred model at top if not already there
  if (preferred && !CURATED.find(m => m.id === preferred)) {
    CURATED.unshift({
      id: preferred,
      name: preferred.split("/").pop() || preferred,
      context_length: 128000,
      pricing: { prompt: "0", completion: "0" },
    });
  } else if (preferred) {
    const idx = CURATED.findIndex(m => m.id === preferred);
    if (idx > 0) {
      const [m] = CURATED.splice(idx, 1);
      CURATED.unshift(m);
    }
  }

  // 2. Filter to available (not in cooldown)
  const models = CURATED.filter(m => isAvailable(m.id));

  if (models.length === 0) {
    throw new Error("All models busy. Try again in a moment.");
  }

  // Lazy background fetch for model metadata (don't block)
  getAutoModels(apiKey).catch(() => {});

  // 3. Try each model in order
  let lastError = "";

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const nextModel = models[i + 1];
    let emptyCount = 0;
    let useTools = true;

    // Allow retries on the same model for empties / tool-unsupported
    while (true) {
      const attempt = await tryModel(
        model,
        messages,
        systemPrompt,
        tools,
        callbacks,
        signal,
        apiKey,
        useTools,
      );

      if (attempt.ok) {
        const { result, ttft, totalTime } = attempt;

        // Check for empty response
        if (!result.content && result.toolCalls.length === 0) {
          emptyCount++;
          if (emptyCount >= MAX_EMPTY_PER_MODEL) {
            markError(model.id);
            if (nextModel) {
              callbacks.onModelSwitch(model.id, nextModel.id, "empty responses");
            }
            lastError = `Empty response from ${model.id}`;
            break; // move to next model
          }
          // Retry the same model once more
          continue;
        }

        // Success
        markSuccess(model.id);
        recordLatency(model.id, ttft, totalTime);
        return result;
      }

      // Handle failure reasons
      const { reason, detail } = attempt;

      switch (reason) {
        case "auth":
          // Bad API key — no point trying other models
          throw new Error("Invalid API key.");

        case "rate_limited":
          markError(model.id);
          if (nextModel) {
            callbacks.onModelSwitch(model.id, nextModel.id, "rate limited");
          }
          lastError = detail;
          break; // next model

        case "tools_unsupported":
          if (useTools) {
            // Retry the same model without native tool calling
            useTools = false;
            continue;
          }
          // Already tried without tools — give up on this model
          markError(model.id);
          if (nextModel) {
            callbacks.onModelSwitch(model.id, nextModel.id, "tools unsupported");
          }
          lastError = detail;
          break; // next model

        case "timeout":
          markError(model.id);
          if (nextModel) {
            callbacks.onModelSwitch(model.id, nextModel.id, "timeout");
          }
          lastError = detail;
          break; // next model

        case "error":
        default:
          markError(model.id);
          if (nextModel) {
            callbacks.onModelSwitch(model.id, nextModel.id, "error");
          }
          lastError = detail;
          break; // next model
      }

      // Break out of the while loop to move to the next model
      break;
    }
  }

  // 5. All models exhausted
  throw new Error("All models busy. Click retry.");
}
