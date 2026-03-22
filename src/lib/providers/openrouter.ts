/**
 * OpenRouter API client using Tauri's HTTP plugin (bypasses CORS).
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export interface ChatMsg {
  role: string;
  content: string;
}

export async function* streamChat(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  systemPrompt: string,
): AsyncGenerator<string, void, unknown> {
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
  };

  const response = await tauriFetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://darce.dev",
      "X-Title": "Darce",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    if (status === 401) throw new Error("Invalid API key. Check your OpenRouter key.");
    if (status === 429) throw new Error("Rate limit exceeded. Wait a moment or switch models.");
    if (status === 404) throw new Error("Model not found. It may have been deprecated.");
    throw new Error(`API error (${status}): ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n")) {
      const idx = buffer.indexOf("\n");
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);

      if (!line || !line.startsWith("data:")) continue;

      const data = line.slice(5).trim();
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;

        const reason = parsed.choices?.[0]?.finish_reason;
        if (reason === "stop" || reason === "end_turn") return;
      } catch {
        // skip malformed JSON
      }
    }
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await tauriFetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
