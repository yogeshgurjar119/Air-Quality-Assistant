# Security

## Reporting a vulnerability

Please open a private security advisory on the GitHub repository (Security → Report a vulnerability)
rather than a public issue. Include steps to reproduce; expect a first reply within a few days.

## What the app does to stay safe

- Strict validation of every input (city names, profile answers, chat messages) before any use.
- Prompt-injection screen over all user turns; client-supplied "assistant" turns are discarded.
- 4 KB request-body limit and per-client rate limits (tighter for the AI routes).
- Single-source Content-Security-Policy, Permissions-Policy and Helmet headers on every host.
- API responses are `Cache-Control: no-store`; error responses never echo user input.
- The API key lives only in server-side environment variables and is never sent to the browser.
- Chat text and the chosen city are sent to the third-party AI provider to produce answers;
  nothing is stored by this app.
