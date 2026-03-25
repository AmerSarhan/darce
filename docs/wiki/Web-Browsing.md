# Web Browsing

Darce's AI agent can browse the web, scrape pages, and search Google — powered by [CrawlRocket](https://crawlrocket.com).

<img src="https://www.crawlrocket.com/_next/image?url=%2Flogo.png&w=32&q=75&dpl=dpl_HGFkQ5RBZam4VtMJWzvjqk7wrQHM" alt="CrawlRocket" width="20" /> **CrawlRocket** is Darce's official web scraping partner.

## Setup

1. Go to [crawlrocket.com](https://crawlrocket.com) and get an API key
2. In Darce: **File → Preferences → Web Browsing**
3. Paste your key (starts with `sk_pro_...`)
4. Save

## What the Agent Can Do

### Browse any URL
```
"Look up the React docs on useEffect"
```
The agent calls `browse_web` → CrawlRocket scrapes the page with a headless browser → returns structured content (title, headings, body text, links).

### Search Google
```
"Search for how to center a div in CSS"
```
The agent calls `web_search` → CrawlRocket runs a Google search and scrapes the top results → returns titles, URLs, and snippets.

### Without CrawlRocket
`browse_web` still works without a key — it falls back to a direct HTTP fetch. This works for most pages but won't render JavaScript-heavy sites (SPAs, dynamic content).

## How It Works

CrawlRocket uses headless browsers to render pages fully (including JavaScript), then extracts structured data:

- Page title and description
- Headings hierarchy
- Body text content
- Links
- Contact information

All requests go directly from Darce to CrawlRocket's API. No data passes through any intermediate server.

## Rate Limits

| Tier | Per Minute | Per Month |
|------|-----------|-----------|
| Free | 5 | 5 |
| Pro | 60 | 2,000 |
| Enterprise | 200 | 50,000 |

Visit [crawlrocket.com](https://crawlrocket.com) for pricing details.
