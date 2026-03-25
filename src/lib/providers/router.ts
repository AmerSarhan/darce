/**
 * Provider Router — routes chat completions to the right path.
 * - auto / auto-fast → sendAuto() with smart model rotation
 * - manual → direct OpenRouter call with selected model
 *
 * Prompt caching:
 * - Most providers (Kimi, OpenAI, DeepSeek, Gemini, Groq) cache automatically
 * - Anthropic requires explicit cache_control — we add it for Claude models
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { settings } from "$lib/stores/settings.svelte";
import { sendAuto } from "./auto-provider";
import { terminal } from "$lib/stores/terminal.svelte";
import type { AgentMessage } from "./agent";

export interface ProviderResponse {
  content: string;
  toolCalls: { id: string; name: string; args: string }[];
  finishReason: string;
  modelUsed?: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCallDelta: (index: number, id: string | null, name: string | null, argsChunk: string | null) => void;
}

/**
 * Send a streaming chat completion.
 * Auto modes use smart model rotation; manual mode uses direct OpenRouter.
 */
export async function sendCompletion(
  messages: AgentMessage[],
  systemPrompt: string,
  tools: any[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  const provider = settings.provider;

  // Auto modes → smart model rotation with fallback
  if (provider === "auto" || provider === "auto-fast") {
    const result = await sendAuto(
      messages,
      systemPrompt,
      tools,
      {
        ...callbacks,
        onModelSwitch(from, to, reason) {
          console.log(`[Darce] Switching ${from} → ${to}: ${reason}`);
          terminal.addLine(`Switching to ${to.split("/").pop()}...`, "system");
        },
      },
      signal,
      settings.apiKey,
      provider,
    );
    return result;
  }

  // Manual mode → direct OpenRouter call
  const model = settings.defaultManualModel;
  const body = buildRequestBody(model, systemPrompt, messages, tools);

  const response = await tauriFetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://darce.dev",
      "X-OpenRouter-Title": "Darce",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text().catch(() => "");
    if (status === 401) throw new Error("Invalid API key.");
    if (status === 429) throw new Error("Rate limited. Wait and retry.");
    throw new Error(`API error (${status}): ${text.slice(0, 200)}`);
  }

  return parseSSEStream(response, callbacks);
}

/**
 * Build the request body with prompt caching support.
 * - Anthropic models: add cache_control at top level for automatic caching
 * - All other providers: caching is automatic, no config needed
 */
export function buildRequestBody(
  model: string,
  systemPrompt: string,
  messages: AgentMessage[],
  tools: any[],
): Record<string, unknown> {
  const isAnthropic = model.includes("anthropic/") || model.includes("claude");

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: true,
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  // Anthropic prompt caching — automatic mode (cache breakpoint on last cacheable block)
  if (isAnthropic) {
    body.cache_control = { type: "ephemeral" };
  }

  return body;
}

async function parseSSEStream(response: Response, callbacks: StreamCallbacks): Promise<ProviderResponse> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let toolCalls = new Map<number, { id: string; name: string; args: string }>();
  let finishReason = "";
  let modelUsed: string | undefined;

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

        if (!modelUsed && parsed.model) {
          modelUsed = parsed.model;
        }

        const choice = parsed.choices?.[0];
        if (!choice) continue;

        if (choice.finish_reason) finishReason = choice.finish_reason;

        const delta = choice.delta;
        if (delta?.content) {
          content += delta.content;
          callbacks.onToken(delta.content);
        }

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
      } catch { /* skip malformed SSE chunks */ }
    }
  }

  return {
    content,
    toolCalls: Array.from(toolCalls.values()),
    finishReason,
    modelUsed,
  };
}
