# CrawlRocket Setup

<img src="https://www.crawlrocket.com/_next/image?url=%2Flogo.png&w=32&q=75&dpl=dpl_HGFkQ5RBZam4VtMJWzvjqk7wrQHM" alt="CrawlRocket" width="24" /> [CrawlRocket](https://crawlrocket.com) is Darce's official web scraping partner — powering the `browse_web` and `web_search` tools.

## Quick Setup

1. Go to [crawlrocket.com](https://crawlrocket.com)
2. Create an account and get an API key (starts with `sk_pro_...`)
3. In Darce: **File → Preferences → Web Browsing**
4. Paste the key → Save

That's it. The agent can now browse any page and search Google.

## API Endpoints Used

Darce uses two CrawlRocket endpoints:

| Endpoint | Tool | What It Does |
|----------|------|-------------|
| `POST /api/scrape` | `browse_web` | Scrapes a URL with a headless browser |
| `POST /api/search` | `web_search` | Runs a Google search and scrapes top results |

Both are async — Darce submits a job and polls for results. Typical response time: 3-8 seconds.

## What Gets Returned

CrawlRocket extracts structured data from pages:

- **Title** and meta description
- **Headings** hierarchy
- **Body text** (cleaned, readable)
- **Links** on the page
- **Contact info** (emails, phones if found)

Darce uses a smart excerpt to send only the most relevant parts to the AI model — keeping responses fast.

## Pricing

| Tier | Per Minute | Per Month | Price |
|------|-----------|-----------|-------|
| Free | 5 | 5 | $0 |
| Pro | 60 | 2,000 | $29/mo |
| Enterprise | 200 | 50,000 | $199/mo |

Results are cached for 1 hour — duplicate requests don't count against your quota.

## Without CrawlRocket

`browse_web` falls back to a direct HTTP fetch if no CrawlRocket key is set. This works for static pages but won't render JavaScript. `web_search` requires CrawlRocket — there's no fallback for Google search.
