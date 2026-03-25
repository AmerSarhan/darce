# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in Darce, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email **amer.sarhan@gmail.com** with:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

You will receive a response within 48 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Security Model

Darce is a desktop application that runs locally on your machine. Here's how we handle security:

**API Keys**
- Stored in browser localStorage (local to your machine)
- Never sent to any server except the intended API provider (OpenRouter, CrawlRocket)
- Never logged or transmitted to Darce servers

**Shell Commands**
- The AI agent can execute shell commands in your project directory
- Dangerous commands (rm -rf, format, etc.) are flagged before execution
- Commands run with your user permissions — Darce does not escalate privileges

**File Access**
- Darce can only read/write files within your opened project folder
- Path traversal is validated on the Rust backend
- No access to files outside the project root

**Network**
- All API calls go directly to the provider (OpenRouter, CrawlRocket, BrowserOS)
- No telemetry server — analytics go to Aptabase (privacy-friendly, no personal data)
- No data collection, no accounts, no tracking cookies

**Dependencies**
- Tauri 2 (Rust) — sandboxed webview, no full Node.js runtime
- All dependencies audited via `npm audit` and `cargo audit`

## Scope

The following are in scope for security reports:

- Path traversal in file operations
- Command injection via the agent
- API key leakage
- Unauthorized network requests
- Privilege escalation
- XSS in the webview

The following are out of scope:

- Vulnerabilities in OpenRouter, CrawlRocket, or BrowserOS (report to them directly)
- Issues requiring physical access to the machine
- Social engineering
