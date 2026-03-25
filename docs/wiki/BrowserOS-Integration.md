# BrowserOS Integration

[BrowserOS](https://github.com/browseros-ai/BrowserOS) is an open-source browser with a built-in AI agent. Darce connects to it for full browser automation — clicking, filling forms, testing UIs.

## Setup

1. Download BrowserOS from [GitHub Releases](https://github.com/browseros-ai/BrowserOS/releases)
2. Install and open BrowserOS
3. In BrowserOS: open `chrome://browseros/mcp` → toggle MCP server **ON**
4. In Darce: **Preferences → Browser → Toggle ON**
5. Green dot appears when connected

## What You Can Do

With BrowserOS enabled, the agent gets additional capabilities beyond basic web scraping:

- **Click elements** — `browser_click` with CSS selectors
- **Fill forms** — `browser_fill` to type into inputs
- **Extract content** — `browser_extract` for structured page data
- **Full JS rendering** — BrowserOS runs a real Chromium browser, so SPAs and dynamic pages work fully

## How It Works

BrowserOS exposes an MCP (Model Context Protocol) server. Darce connects to it via HTTP at `http://127.0.0.1:9000/mcp`. The protocol includes:

1. **Initialize** — Darce identifies itself and gets a session
2. **Tool calls** — Each browser action is an MCP tool call
3. **Results** — BrowserOS returns structured content (text, screenshots)

All communication is local — nothing leaves your machine.

## Without BrowserOS

`browse_web` still works without BrowserOS:
1. If CrawlRocket is configured → headless browser scrape via API
2. If no CrawlRocket → direct HTTP fetch (no JavaScript rendering)

BrowserOS adds interactive capabilities (click, fill) that the other methods don't have.

## Port Configuration

Default port: **9000**

If you changed the MCP server port in BrowserOS, update it in Darce: **Preferences → Browser → port field**.
