import { HttpError } from '../errors.js';
import { fetchJson } from './http.js';
import { extractJson, normalizePlan } from './planSchema.js';

const MAX_REPLY_LENGTH = 1200;
/** A model that just failed is skipped for this long, so a retired model doesn't slow every request. */
const FAILURE_COOLDOWN_MS = 60_000;
/** An attempt with less time than this left is pointless; fall back instead. */
const MIN_ATTEMPT_MS = 500;

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
  const failedUntil = new Map();

  const complete = async (model, messages, { maxTokens, temperature }, attemptTimeoutMs) => {
    try {
      const data = await fetchJson(`${baseUrl}/chat/completions`, {
        fetchImpl,
        timeoutMs: attemptTimeoutMs,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          top_p: 0.9,
          max_tokens: maxTokens,
          ...(disableThinking && { chat_template_kwargs: { enable_thinking: false } }),
        }),
      });
      const content = data?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    } catch (error) {
      failedUntil.set(model, now() + FAILURE_COOLDOWN_MS);
      throw error;
    }
  };

  /**
   * Runs `attempt(model, attemptTimeoutMs)` down the chain until one succeeds, never exceeding the
   * total budget; rethrows the last error (or a budget error) so callers can use the fallback.
   */
  const withFallback = async (attempt) => {
    if (!apiKey) throw new HttpError(503, 'The AI assistant is not configured.');
    const deadline = now() + budgetMs;
    const healthy = models.filter((model) => (failedUntil.get(model) ?? 0) <= now());
    let lastError;
    for (const model of healthy.length > 0 ? healthy : models) {
      const remaining = deadline - now();
      if (remaining < MIN_ATTEMPT_MS) {
        lastError ??= new HttpError(504, 'The AI time budget was exhausted.');
        break;
      }
      try {
        return await attempt(model, Math.min(timeoutMs, remaining));
      } catch (error) {
        logger.warn(`Model ${model} failed: ${error.message}`);
        lastError = error;
      }
    }
    throw lastError;
  };

  return {
    isConfigured: Boolean(apiKey),

    generatePlan: (messages) =>
      withFallback(async (model, attemptTimeoutMs) =>
        normalizePlan(extractJson(await complete(model, messages, { maxTokens: 1000, temperature: 0.4 }, attemptTimeoutMs))),
      ),

    chat: (messages) =>
      withFallback(async (model, attemptTimeoutMs) => {
        const reply = (await complete(model, messages, { maxTokens: 450, temperature: 0.5 }, attemptTimeoutMs)).trim();
        if (!reply) throw new HttpError(502, 'The AI returned an empty answer.');
        return reply.slice(0, MAX_REPLY_LENGTH);
      }),
  };
};
