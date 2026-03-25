# Model Selection

Darce supports 200+ models via OpenRouter. Here's how model selection works.

## Auto Mode (Recommended)

The smart rotation engine tries models in this order:

1. **Kimi K2.5** — Default. Fast, great at coding and tool use.
2. **Claude Sonnet 4.6** — Premium quality, excellent reasoning.
3. **Gemini 2.5 Flash** — Fast and capable.
4. **GPT-4.1 Mini** — Reliable, good at structured output.
5. **Llama 4 Scout** — Open source, solid coding.
6. **DeepSeek Chat v3** — Strong at code generation.
7. **Gemini 2.5 Flash Lite** — Lightweight fallback.
8. **Llama 4 Maverick** — Last resort fallback.

If a model fails (rate limit, timeout, empty response), the engine silently switches to the next one. You see the model name in the chat header so you always know which model responded.

## Auto Fast Mode

Same models but reordered by measured latency. The engine tracks time-to-first-token for each model and promotes faster ones over time.

## Manual Mode

Pick any model from the dropdown. No fallback — if it fails, you see the error.

## Health Tracking

The engine tracks errors per model with escalating cooldowns:

| Errors | Cooldown |
|--------|----------|
| 1 | 30 seconds |
| 2 | 2 minutes |
| 3+ | 10 minutes |

Cooldowns reset on the next successful response.

## Teaching Model

The Learn/Understand panel uses a separate model optimized for speed:

1. **Codestral** (~1.5s) — Mistral's coding model, very fast
2. **Morph v3 Fast** (~1.6s) — Fallback
3. **Llama 4 Scout** (~1.9s) — Last resort

This keeps the teaching panel snappy while the main agent uses the best available model.

## Prompt Caching

- **Kimi, OpenAI, DeepSeek, Gemini, Groq** — Automatic caching by the provider
- **Anthropic (Claude)** — Darce adds explicit `cache_control` headers
- Caching reduces cost and latency for follow-up messages in the same conversation
