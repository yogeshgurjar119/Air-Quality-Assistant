# AirWise

AirWise is a GenAI assistant that turns **live air-quality data** for a user's city into **low-emission daily routines, indoor air-quality hacks and sustainable alternatives** tailored to their household, explains the **direct impact** of every suggestion, and answers follow-up questions in a **chat assistant**.

- **Vertical:** Environment & public health (urban air pollution, family/community level)
- **Stack:** Node.js 22 + Express, vanilla HTML/CSS/ES modules (no build step), ESLint, `node:test`
- **Size:** ~0.2 MB of source (limit: 10 MB). 5 runtime dependencies.
- **Deploys to:** Vercel or Netlify in minutes (config included), or any Node host.

## Features

- **Live dashboard:** US AQI gauge, PM2.5 / PM10 / NO₂ / ozone, temperature, humidity and wind.
- **WHO guideline check:** each pollutant is compared with the WHO 24-hour guideline ("3.4× WHO limit").
- **City vs the world:** your city ranked against 25 major cities (with countries) and a country average, from one batched request.
- **24-hour outlook** with the cleanest and worst hours highlighted (plan outdoor time smartly).
- **Population & density** of the city (people exposed, residents per km²).
- **Personalised plan** (AI): daily routines, indoor air hacks, sustainable alternatives. Every item has a "Why it matters" impact line.
- **Chat assistant on every page:** a floating "Ask AirWise" button (and a header link) opens a chat panel anywhere, even before the questionnaire. It has its own city field, is grounded in live data, stays on topic and declines unrelated or hostile requests.
- **Live data-source status in the header:** shows which free public APIs (Open-Meteo air, weather and geocoding, Wikidata) are reachable right now, with latency and links to each source. Cached server-side for 5 minutes.
- **Never leaves you without an answer:** primary AI model → backup models → built-in rule-based plan and chat answers built from live data.
- **Step-by-step wizard** (place → daily life → home → review) with large tap-friendly option cards.
- **Top free resources** panel linking trusted tools (WHO, WAQI, OpenAQ, US EPA, CPCB).
- **Air-reactive motion:** a background of wind-blown particles and haze that gets denser and warmer as air quality worsens; the gauge sweeps open and cards rise in. All motion is off for `prefers-reduced-motion`.
- Responsive (phone → desktop), light/dark, keyboard- and screen-reader-friendly.

## Quick start

```bash
npm install
cp .env.example .env     # then paste your AI API key into .env
npm start                # http://localhost:3000
npm run check            # lint + 102 tests (no network or key needed)
npm run test:coverage    # ~99.8% line coverage of server-side code (see note below)
```

| Variable | Default | Purpose |
|---|---|---|
| `NVIDIA_API_KEY` | _(empty)_ | AI API key. Empty = built-in guidance only (plan and chat still work) |
| `NVIDIA_MODEL` | see `.env.example` | Chat model to use |
| `NVIDIA_BASE_URL` | see `.env.example` | OpenAI-compatible endpoint |
| `NVIDIA_DISABLE_THINKING` | `true` | Skip model "reasoning" for fast, direct answers |
| `AI_RATE_LIMIT_PER_MINUTE` | `12` | Tighter per-IP limit for `/api/plan` and `/api/chat` |
| `NVIDIA_FALLBACK_MODELS` | see `.env.example` | Comma-separated backup models, tried in order if the primary fails |
| `PORT` | `3000` | HTTP port (local only) |
| `RATE_LIMIT_PER_MINUTE` | `30` | Per-IP limit on `/api/*` |
| `REQUEST_TIMEOUT_MS` | `30000` | Timeout for ONE upstream call (one model attempt, one data request) |
| `AI_TOTAL_TIMEOUT_MS` | `20000` | Total time all AI models together may use per request; when it runs out the built-in answer is returned instead |

## Free public data sources (no API keys)

| Data | Provider | Used for |
|---|---|---|
| Geocoding | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | City → coordinates, GeoNames id |
| Air quality + 24 h forecast | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) (Copernicus CAMS) | AQI, PM2.5, PM10, NO₂, O₃, hourly outlook |
| Weather | [Open-Meteo Forecast](https://open-meteo.com/en/docs) | Temperature, humidity, wind (calm, humid air traps pollution) |
| World comparison | Open-Meteo Air Quality (one batched call, 25 cities, cached 30 min) | City-vs-world ranking and country average |
| Population & area | [Wikidata SPARQL](https://query.wikidata.org/) (via GeoNames id) | Population density |

The header calls `GET /api/sources`, which probes each of these with a tiny request (cached for 5 minutes, so at most 4 small upstream calls per 5 minutes however many people visit). Weather and density are optional enrichments: if either provider fails, the app still responds with air quality and the plan. (World Bank and REST Countries were evaluated but rejected — the former blocks automated clients, the latter's v3.1 API is deprecated.)

## Deploy

**Vercel** — import the repo, or run `npx vercel`. `vercel.json` serves `public/` statically and routes `/api/*` to `api/index.js`. In *Project → Settings → Environment Variables* add `NVIDIA_API_KEY` (and optionally `NVIDIA_MODEL`).

**Netlify** — import the repo, or run `npx netlify deploy --prod`. `netlify.toml` publishes `public/` and routes `/api/*` to the `netlify/functions/api.js` function. Add `NVIDIA_API_KEY` under *Site configuration → Environment variables*. On the free plan (10 s function limit) also set `REQUEST_TIMEOUT_MS=4000` and `AI_TOTAL_TIMEOUT_MS=6000`: the AI chain is then stopped after 6 s in total and the built-in answer is returned, well before Netlify cuts the function off.

Both configs also send security headers (CSP etc.) for static files, matching what Express sends for API responses. No build step is needed.

## How it works

```
Browser ─► GET  /api/air?city=…   geocode ─► (air + weather + density in parallel, cached 10 min)
        ─► POST /api/plan         validate ─► cached context ─► LLM plan ─► validate/trim JSON
                                              └─ on any LLM failure → rule-based plan (same shape)
        ─► POST /api/chat         validate ─► cached context ─► LLM reply (grounded, on-topic only)
```

The dashboard renders as soon as `/api/air` returns (fast, no LLM); the AI plan streams in after it under a skeleton loader.

### Approach and logic

1. **Grounding, not guessing.** The model receives real pollutant readings, weather, the cleanest forecast hour and city density, and is told never to invent readings or precise statistics.
2. **Impact-first output.** Every suggestion must have `title`, `action` and `impact`; the UI shows impact as **"Why it matters"**.
3. **Three lenses:** daily routines (commute, timing, exercise), indoor air hacks (ventilation, cooking, DIY filtration), sustainable alternatives (modal shift, induction cooking, no waste burning).
4. **Personalisation:** city, commute mode, cooking fuel, home type, existing air cleaning, and sensitive household members. Vulnerable members and poor AQI raise protective advice.
5. **Resilience (three layers).** (1) The primary model; (2) if it errors, times out or returns unusable output, backup models are tried in order, and a failing model is skipped for 60 s so a retired model never slows requests; (3) if every model fails, deterministic rule-based plan and chat answers are built from the live data. LLM output is always untrusted: parsed, schema-validated, length-capped, rendered via `textContent`. The chat labels built-in answers so users know.
6. **Speed.** Parallel upstream calls, in-flight request de-duplication, 10-minute caches for city data and AI plans, gzip, short AI outputs, and air data shown before the AI plan finishes.

### Project layout

```
server/
  index.js, bootstrap.js   local entry / shared wiring (also used by serverless entries)
  app.js                   Express app: helmet CSP, gzip, rate limit, routes, error handler
  config.js                validated env config
  services/
    profile.js, chat.js    input validation (allow-lists, length limits)
    airQuality.js          geocoding, live readings, 24 h outlook
    weather.js, density.js optional enrichments
    context.js, cache.js   parallel fetch + TTL/in-flight cache
    prompt.js              plan and chat prompts
    nvidia.js              LLM client (key stays server-side)
    planSchema.js          JSON extraction + validation of LLM output
    fallback.js, planner.js  offline planner + orchestration
api/index.js               Vercel entry      netlify/functions/api.js   Netlify entry
public/                    index.html, styles.css, app.js, api.js, render.js, chat.js, format.js, dom.js
tests/                     unit, API, frontend-logic and deploy-entry tests
```

Dependencies are injected (`fetchImpl`, `llm`, `planner`, `logger`, clock), so every layer is testable offline.

## Handling unrelated or hostile input

Everything a user can type is untrusted. Layers, outermost first:

| Layer | What it does |
|---|---|
| **Transport** | 4 KB body limit; only `application/json` objects parsed (arrays, primitives, form bodies and wrong content types get 400); gzip; per-IP rate limits, with a tighter budget on the AI endpoints |
| **Schema validation** | Enums are allow-listed; `city` must be 2–80 chars from a strict letter/digit/punctuation set **with at least one letter**. Quotes-and-operators payloads (`' OR 1=1 --`, `<script>`, `../../etc`, `${…}`, `{"$gt":""}`), zero-width and bidi-override characters, repeated or object-valued query params all get a 400 |
| **Unrelated text** | A well-formed but unrelated "city" (e.g. "how do I bake bread") goes only to the geocoder, returns a friendly 404, and **never reaches the AI model** |
| **Chat sanitising** | Messages are Unicode-normalised, control/invisible characters stripped, whitespace collapsed, length/role/history capped. Only `user` turns are used: client-supplied `assistant` turns could be forged, so they are discarded |
| **Injection screen** | **Every** user turn in the history is checked, not just the latest. Instruction-override and secret-extraction phrases ("ignore previous instructions", "reveal your system prompt", "developer mode", fake `<system>` tags) are answered with a fixed refusal **before any model call** (free, instant) |
| **Model guardrails** | System prompt restricts the assistant to air-quality topics, treats the profile as data, and tells it to ignore rule changes; off-topic requests are politely declined |
| **Output** | Model output is length-capped and rendered with `textContent` only, so it can never inject markup; the plan JSON is schema-validated and trimmed |
| **Errors & headers** | Upstream details and user input are never echoed in errors; strict CSP (no inline script/style), `nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera, mic, geolocation off), HSTS on the hosts |

These cases are covered by automated tests (`tests/api.test.js` → "hostile and unrelated input", `tests/units.test.js` → "guard").

## Evaluation focus areas

| Area | What was done |
|---|---|
| **Code quality** | ESLint (flat config) enforced via `npm run check`; small single-purpose modules; dependency injection; shared validation; no dead code; JSDoc on non-obvious functions |
| **Security** | API key server-side only, git-ignored; defence in depth for unrelated/hostile input (see above): allow-list validation, sanitising, pre-model injection screen, topic-restricted prompts, textContent-only rendering; 4 KB body limit; general + stricter AI per-IP rate limits (work behind Vercel/Netlify proxies); Permissions-Policy; `helmet` CSP with no inline script/style; XSS-safe rendering; sanitised upstream errors; timeouts everywhere; `npm audit`: 0 vulnerabilities |
| **Efficiency** | No build step or framework; parallel + cached + de-duplicated upstream calls; gzip; capped LLM tokens; ~0.2 MB source |
| **Testing** | tests (backend, API and pure UI logic), ~99.8% line coverage of `server/`, `api/`, `netlify/` and the pure UI modules (`format.js`, `wizard-model.js`); the DOM modules in `public/` (rendering, chat panel, header, animation) are verified manually and by browser checks but have **no automated tests yet**: AQI bands, hostile input (SQL/XSS/path/template/prototype-pollution payloads, invisible characters, prompt injection), validation, LLM parsing, every fallback-plan combination, forecast/density maths, cache semantics, all API routes (success, cache, dedupe, offline, model-chain failover and cooldown, built-in chat answers, LLM error/garbage/empty, 404/413/429/502/503), headers, key non-exposure, frontend formatting, Netlify/Vercel entry points |
| **Accessibility** | Landmarks, skip link, visible labels, `fieldset/legend`, `role="log"` chat, `aria-live`/`aria-busy`, `role="alert"` errors, text alternatives for gauge and chart (cleanest/worst hour spelled out), AQI never colour-only, 44 px targets, focus rings, light/dark, `prefers-reduced-motion` disables all animation incl. the particle canvas (which is `aria-hidden`) |
| **Problem alignment** | The brief asks for low-emission routines, indoor hacks and sustainable alternatives, tailored to location and lifestyle, with the direct impact explained. AirWise uses live local data (city AQI, pollutants, weather, density), a 4-step lifestyle questionnaire (commute, cooking fuel, home, purifier, sensitive members), three plan sections each with a "Why it matters" line, WHO-guideline and world-comparison context that make the stakes concrete, and a grounded chat assistant. It works for families with or without AI. |

## Assumptions

- Open-Meteo CAMS data is modelled, not ground-station data; local accuracy varies.
- The first geocoding match for the typed city is the intended one (add a region/country to disambiguate).
- US EPA AQI bands are used as a common reference; local standards may differ.
- City population/density come from Wikidata and may be missing or dated for some places (the UI simply hides what's unavailable).
- Quantitative claims are intentionally qualitative; the model is told not to fabricate statistics.
- Advice is general guidance, **not medical advice**; the footer says so.
- No user data is stored: no accounts, analytics or persistence. Chat history lives only in the browser tab.
- Caches and rate limits are per instance (in memory); on serverless hosts each warm instance has its own.

## Author

Made by **Yogesh Gurjar** — [LinkedIn](https://www.linkedin.com/in/yogesh-gurjar-ba4a191b2/)

## License

[Mozilla Public License 2.0](LICENSE)
