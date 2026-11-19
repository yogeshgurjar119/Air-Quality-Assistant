import { HTTP, MINUTE_MS } from '../constants.js';
import { HttpError } from '../errors.js';
import { fetchJson } from './http.js';
import { extractJson, normalizePlan } from './planSchema.js';

const MAX_REPLY_LENGTH = 1200;
/** A model that just failed is skipped for this long, so a retired model doesn't slow every request. */
const FAILURE_COOLDOWN_MS = MINUTE_MS;
/** An attempt with less time than this left is pointless; fall back instead. */
const MIN_ATTEMPT_MS = 500;

const PLAN_OPTIONS = Object.freeze({ maxTokens: 1000, temperature: 0.4 });
const CHAT_OPTIONS = Object.freeze({ maxTokens: 450, temperature: 0.5 });

const buildRequestBody = ({ model, messages, temperature, maxTokens, disableThinking }) => ({
  model,
  messages,
  temperature,
  top_p: 0.9,
  max_tokens: maxTokens,
  ...(disableThinking && { chat_template_kwargs: { enable_thinking: false } }),
});

/** Remembers which models failed recently so they are skipped for a while. */
const createFailureTracker = (now) => {
  const failedUntil = new Map();
  return {
    markFailed: (model) => failedUntil.set(model, now() + FAILURE_COOLDOWN_MS),
    /** Models not cooling down; if every model is cooling down, all of them (better than none). */
    usable: (models) => {
      const healthy = models.filter((model) => (failedUntil.get(model) ?? 0) <= now());
      return healthy.length > 0 ? healthy : models;
    },
  };
};

/**
 * Runs `attempt(model, attemptTimeoutMs)` down the model list until one succeeds, never exceeding
 * the total budget. Rethrows the last error (or a budget error) so the caller can fall back.
 */
const runChain = ({ models, attempt, timeoutMs, deadline, now, logger }) => {
  const tryNext = async ([model, ...rest], lastError) => {
    const remaining = deadline - now();
    if (model === undefined || remaining < MIN_ATTEMPT_MS) {
      throw lastError ?? new HttpError(HTTP.GATEWAY_TIMEOUT, 'The AI time budget was exhausted.');
    }
    try {
      return await attempt(model, Math.min(timeoutMs, remaining));
    } catch (error) {
      logger.warn(`Model ${model} failed: ${error.message}`);
      return tryNext(rest, error);
    }
  };
  return tryNext(models);
};

/** One chat-completion request; returns the model's text ('' when the response has none). */
const requestCompletion = async ({ apiKey, baseUrl, fetchImpl, disableThinking }, request, attemptTimeoutMs) => {
  const data = await fetchJson(`${baseUrl}/chat/completions`, {
    fetchImpl,
    timeoutMs: attemptTimeoutMs,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildRequestBody({ ...request, disableThinking })),
  });
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
};

/**
 * Creates a client for an OpenAI-compatible chat endpoint (NVIDIA-hosted) with an ordered
 * chain of models: if one fails, the next is tried. The API key never leaves the server.
 *
 * `timeoutMs` bounds ONE attempt; `budgetMs` bounds the WHOLE chain for a request, so the
 * rule-based fallback can still answer before a serverless host's function limit expires.
 */
export const createNvidiaClient = ({
  apiKey,
  models,
  baseUrl,
  timeoutMs,
  budgetMs = Infinity,
  fetchImpl,
  disableThinking = false,
  logger = console,
  now = Date.now,
}) => {
  const failures = createFailureTracker(now);

  const complete = async (model, messages, options, attemptTimeoutMs) => {
    try {
      const request = { model, messages, ...options };
      return await requestCompletion({ apiKey, baseUrl, fetchImpl, disableThinking }, request, attemptTimeoutMs);
    } catch (error) {
      failures.markFailed(model);
      throw error;
    }
  };

  // Always returns a promise (never throws synchronously), so callers can rely on rejection handling.
  const withFallback = (attempt) =>
    apiKey
      ? runChain({ models: failures.usable(models), attempt, timeoutMs, deadline: now() + budgetMs, now, logger })
      : Promise.reject(new HttpError(HTTP.SERVICE_UNAVAILABLE, 'The AI assistant is not configured.'));

  return {
    isConfigured: Boolean(apiKey),

    generatePlan: (messages) =>
      withFallback(async (model, attemptTimeoutMs) =>
        normalizePlan(extractJson(await complete(model, messages, PLAN_OPTIONS, attemptTimeoutMs))),
      ),

    chat: (messages) =>
      withFallback(async (model, attemptTimeoutMs) => {
        const reply = (await complete(model, messages, CHAT_OPTIONS, attemptTimeoutMs)).trim();
        if (!reply) throw new HttpError(HTTP.BAD_GATEWAY, 'The AI returned an empty answer.');
        return reply.slice(0, MAX_REPLY_LENGTH);
      }),
  };
};
