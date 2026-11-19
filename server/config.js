/** Centralised, validated runtime configuration (read once from the environment). */

const toInt = (value, { min, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min ? parsed : fallback;
};

const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const DEFAULT_FALLBACK_MODELS = 'nvidia/nemotron-3.5-bolt-e4b,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

/** Primary model first, then comma-separated fallbacks; blanks and duplicates removed. */
const buildModelChain = (env) => {
  const primary = (env.NVIDIA_MODEL ?? DEFAULT_MODEL).trim();
  const fallbacks = (env.NVIDIA_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS).split(',');
  return [...new Set([primary, ...fallbacks.map((name) => name.trim())].filter(Boolean))];
};

/** Serverless hosts (Vercel sets VERCEL, Netlify sets NETLIFY) sit behind exactly one proxy. */
const defaultTrustProxy = (env) => (env.VERCEL || env.NETLIFY ? 1 : 0);

/** Reads and validates settings from environment variables, with safe defaults. */
export const loadConfig = (env = process.env) => ({
  port: toInt(env.PORT, { min: 1, fallback: 3000 }),
  trustProxy: toInt(env.TRUST_PROXY, { min: 0, fallback: defaultTrustProxy(env) }),
  rateLimitPerMinute: toInt(env.RATE_LIMIT_PER_MINUTE, { min: 1, fallback: 30 }),
  aiRateLimitPerMinute: toInt(env.AI_RATE_LIMIT_PER_MINUTE, { min: 1, fallback: 12 }),
  requestTimeoutMs: toInt(env.REQUEST_TIMEOUT_MS, { min: 1, fallback: 30_000 }),
  /** Total time the AI model chain may use per request (all models together). */
  aiBudgetMs: toInt(env.AI_TOTAL_TIMEOUT_MS, { min: 1, fallback: 20_000 }),
  nvidia: {
    apiKey: (env.NVIDIA_API_KEY ?? '').trim(),
    models: buildModelChain(env),
    // Reasoning-capable models burn tokens (and seconds) "thinking"; we want direct answers.
    disableThinking: (env.NVIDIA_DISABLE_THINKING ?? 'true').trim().toLowerCase() !== 'false',
    baseUrl: (env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1').trim().replace(/\/+$/, ''),
  },
});
