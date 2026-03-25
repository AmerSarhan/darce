# Settings

Open settings with **File → Preferences** or from the menu bar.

## Mode

Three provider modes control how the agent picks models:

| Mode | Description |
|------|-------------|
| **Auto** | Smart rotation — tries the best models first, automatically falls back on errors. Tracks latency and health per model. |
| **Auto Fast** | Optimized for speed — prioritizes models with the lowest response time. |
| **Manual** | Choose a specific model from the dropdown. No fallback. |

## API Key

Your OpenRouter API key. Required for all modes. Get one at [openrouter.ai/keys](https://openrouter.ai/keys).

## Web Browsing

Paste your [CrawlRocket](https://crawlrocket.com) API key to enable web browsing and Google search. The agent can then scrape any URL and search the web.

## Browser (BrowserOS)

Toggle ON to enable full browser automation via [BrowserOS](https://github.com/browseros-ai/BrowserOS). Requires BrowserOS running locally with its MCP server enabled.

Default port: 9000

## Model Selection (Manual mode only)

When in Manual mode, choose from:

- Kimi K2.5
- Claude Sonnet 4.6
- Claude Haiku 4.5
- GPT-4.1 Mini
- Gemini 2.5 Flash
- Llama 4 Scout
- Grok 4

## Gear

Switch between Ship / Understand / Learn mode. Also accessible via `Ctrl+1/2/3`.

## Reset All

Clears all saved data (API keys, settings, chat history) and reloads the app.
