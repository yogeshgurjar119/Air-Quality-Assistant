import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createNvidiaClient } from './services/nvidia.js';
import { createPlanner } from './services/planner.js';
import { createSourceMonitor } from './services/sources.js';

/**
 * Wires config → LLM client → planner → Express app from environment variables.
 * Shared by the local server and the Vercel/Netlify serverless entry points.
 */
export const createDefaultApp = (env = process.env, { staticDir } = {}) => {
  const config = loadConfig(env);
  const llm = createNvidiaClient({ ...config.nvidia, timeoutMs: config.requestTimeoutMs, budgetMs: config.aiBudgetMs });
  const planner = createPlanner({ llm, timeoutMs: config.requestTimeoutMs });
  const sourceMonitor = createSourceMonitor({ timeoutMs: config.requestTimeoutMs });
  return { app: createApp({ config, planner, sourceMonitor, staticDir }), config, llm };
};
