/**
 * Provider Router — sends chat completions to the right API based on settings.
 * Supports: OpenRouter, Anthropic Direct, Claude CLI, Ollama
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { tauriInvoke } from "$lib/utils/ipc";
import { settings } from "$lib/stores/settings.svelte";
import type { AgentMessage } from "./agent";

interface ProviderResponse {
  content: string;
  toolCalls: { id: string; name: string; args: string }[];
  finishReason: string;
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCallDelta: (index: number, id: string | null, name: string | null, argsChunk: string | null) => void;
}

/**
 * Send a streaming chat completion to the active provider.
 * Returns parsed content + tool calls after stream completes.
 */
export async function sendCompletion(
  messages: AgentMessage[],
  systemPrompt: string,
  tools: any[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  const provider = settings.provider;

  if (provider === "claude-cli") {
    return sendClaudeCli(messages, systemPrompt, callbacks);
  }

  if (provider === "ollama") {
    return sendOllama(messages, systemPrompt, tools, callbacks, signal);
  }

  // OpenRouter and Anthropic Direct both use OpenAI-compatible format
  const { url, headers } = getProviderConfig();

  const body: any = {
    model: settings.defaultModel,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: true,
  };

  // Only add tools for providers that support them
  if (provider !== "anthropic" || tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await tauriFetch(url, {
    method: "POST",
    signal,
    headers: { ...headers, "Content-Type": "application/json" },
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

function getProviderConfig(): { url: string; headers: Record<string, string> } {
  const provider = settings.provider;

  if (provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "x-api-key": settings.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
    };
  }

  // Default: OpenRouter
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "HTTP-Referer": "https://darce.dev",
      "X-OpenRouter-Title": "Darce",
    },
  };
}

async function parseSSEStream(response: Response, callbacks: StreamCallbacks): Promise<ProviderResponse> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let toolCalls = new Map<number, { id: string; name: string; args: string }>();
  let finishReason = "";

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
      } catch { /* skip */ }
    }
  }

  return {
    content,
    toolCalls: Array.from(toolCalls.values()),
    finishReason,
  };
}

/**
 * Claude CLI provider — spawns `claude` subprocess
 */
async function sendClaudeCli(
  messages: AgentMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
): Promise<ProviderResponse> {
  // Extract the actual user request — strip context prefix
  const lastUserMsg = messages.filter(m => m.role === "user").at(-1);
  let prompt = lastUserMsg?.content || "";

  // The context prefix is added before the user message, strip it
  // Format is: "[Date: ...]\nProject: ...\n\nActual user message"
  const userMsgIdx = prompt.lastIndexOf("\n\n");
  if (userMsgIdx > 0) {
    prompt = prompt.slice(userMsgIdx + 2);
  }

  const { project } = await import("$lib/stores/project.svelte");
  const cwd = project.path || ".";

  // Escape for shell — write prompt to a temp approach via stdin instead
  const escapedPrompt = prompt.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").slice(0, 4000);

  const result = await tauriInvoke<{ stdout: string; stderr: string; exit_code: number }>(
    "run_shell_command",
    {
      cwd,
      command: `claude --print --dangerously-skip-permissions "${escapedPrompt}"`,
    },
  );

  const content = result.stdout || result.stderr || "";

  // Simulate streaming — emit tokens word by word for a live feel
  const words = content.split(/(\s+)/);
  for (let i = 0; i < words.length; i++) {
    callbacks.onToken(words[i]);
    // Emit in bursts — small delay every few words
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 8));
  }

  return { content, toolCalls: [], finishReason: "stop" };
}

/**
 * Ollama provider — calls local Ollama API
 */
async function sendOllama(
  messages: AgentMessage[],
  systemPrompt: string,
  tools: any[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  const url = `${settings.ollamaUrl}/api/chat`;

  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({
      role: m.role === "tool" ? "assistant" : m.role,
      content: m.content || "",
    })),
  ];

  const response = await tauriFetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.defaultModel,
      messages: ollamaMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama error (${response.status}): ${text.slice(0, 200)}`);
  }

  // Ollama streams newline-delimited JSON (not SSE)
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          content += parsed.message.content;
          callbacks.onToken(parsed.message.content);
        }
        if (parsed.done) break;
      } catch { /* skip */ }
    }
  }

  return { content, toolCalls: [], finishReason: "stop" };
}
