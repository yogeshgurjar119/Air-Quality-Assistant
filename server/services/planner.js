import { createAsyncCache } from './cache.js';
import { createContextService } from './context.js';
import { buildFallbackPlan } from './fallback.js';
import { buildFallbackReply } from './fallbackChat.js';
import { GUARD_REPLY, isInjectionAttempt } from './guard.js';
import { buildChatMessages, buildMessages } from './prompt.js';

const PLAN_TTL_MS = 10 * 60_000;

/**
 * Orchestrates air data, the AI plan and the AI chat. The plan degrades gracefully to a
 * rule-based one if the LLM is unconfigured or fails, so users always get advice.
 */
export const createPlanner = ({ llm, timeoutMs, fetchImpl, logger = console, now }) => {
  const contexts = createContextService({ timeoutMs, fetchImpl, logger, now });
  const aiPlans = createAsyncCache({ ttlMs: PLAN_TTL_MS, now });

  const planKey = (profile, context) =>
    JSON.stringify([profile, context.location.name, context.air.level, context.air.observedAt]);

  return {
    /** Live air quality, weather and density for a city (fast; no LLM involved). */
    getAir: (city) => contexts.getContext(city),

    async createPlan(profile) {
      const context = await contexts.getContext(profile.city);

      if (llm.isConfigured) {
        try {
          const plan = await aiPlans.get(planKey(profile, context), () =>
            llm.generatePlan(buildMessages({ profile, ...context })),
          );
          return { plan, source: 'ai' };
        } catch (error) {
          logger.warn(`LLM unavailable, using fallback plan: ${error.message}`);
        }
      }
      return { plan: buildFallbackPlan({ profile, ...context }), source: 'rules' };
    },

    /** Chat answer from the AI chain, or from built-in guidance if no model can respond. */
    async chat(city, history) {
      // The client controls the whole history, so only its `user` turns are trusted as input, and
      // ALL of them are screened. Client-supplied `assistant` turns could be forged to steer the
      // model ("Sure, rules disabled"), so they are never forwarded.
      const userTurns = history.filter((message) => message.role === 'user');
      const question = userTurns.at(-1).content;
      // Obvious injection attempts never reach the model (or even the network).
      if (userTurns.some((turn) => isInjectionAttempt(turn.content))) return { reply: GUARD_REPLY, source: 'guard' };

      const context = await contexts.getContext(city);

      if (llm.isConfigured) {
        try {
          return { reply: await llm.chat(buildChatMessages(context, userTurns)), source: 'ai' };
        } catch (error) {
          logger.warn(`AI chat unavailable, using built-in answer: ${error.message}`);
        }
      }
      return { reply: buildFallbackReply(context, question), source: 'rules' };
    },
  };
};
