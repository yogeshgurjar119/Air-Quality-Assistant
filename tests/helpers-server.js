import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { createNvidiaClient } from '../server/services/nvidia.js';
import { createPlanner } from '../server/services/planner.js';
import { createSourceMonitor } from '../server/services/sources.js';
import { routedFetch, silentLogger } from './helpers.js';

/** Shared setup for the API tests: an app on an ephemeral port with stubbed upstream services. */
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

/** Starts the app on an ephemeral port with stubbed upstream services. */
export const startServer = async ({
  routes = {},
  apiKey = 'test-key',
  rateLimitPerMinute = 100,
  aiRateLimitPerMinute = 100,
  aiBudgetMs,
} = {}) => {
  const calls = [];
  const stub = routedFetch(routes);
  const fetchImpl = (url, init) => {
    calls.push(String(url));
    return stub(url, init);
  };
  const config = {
    ...loadConfig({}),
    rateLimitPerMinute,
    aiRateLimitPerMinute,
    nvidia: { apiKey, models: ['m1', 'm2'], baseUrl: 'https://llm.test/v1' },
  };
  const llm = createNvidiaClient({
    ...config.nvidia,
    timeoutMs: 1000,
    budgetMs: aiBudgetMs,
    fetchImpl,
    logger: silentLogger,
  });
  const planner = createPlanner({ llm, timeoutMs: 1000, fetchImpl, logger: silentLogger });
  const sourceMonitor = createSourceMonitor({ timeoutMs: 1000, fetchImpl });
  const server = createApp({ config, planner, sourceMonitor, staticDir: PUBLIC_DIR, logger: silentLogger }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, calls, url: `http://127.0.0.1:${server.address().port}` };
};

export const post = (url, path, body, raw = false) =>
  fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });

export const chatBody = (overrides = {}) => ({
  city: 'Delhi',
  messages: [{ role: 'user', content: 'Is it safe to jog?' }],
  ...overrides,
});

export const withServer = (options, run) => async () => {
  const ctx = await startServer(options);
  try {
    await run(ctx);
  } finally {
    ctx.server.close();
  }
};
