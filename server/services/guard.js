/**
 * Input hygiene and prompt-injection screening for free-text chat messages.
 * Defence in depth: this runs BEFORE any model call (saving cost and blocking obvious attacks),
 * and the model itself is separately instructed to stay on topic and ignore rule changes.
 */

/** Control characters, zero-width and bidi-override characters used to hide or reorder text. */
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/gu;

/** Phrases typical of attempts to override instructions or extract hidden configuration. */
const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(previous|prior|above|earlier|all|your|the)\b.{0,30}\b(instruction|instructions|rule|rules|prompt|prompts|guidelines|polic(y|ies))\b/i,
  /\b(reveal|show|print|repeat|display|leak|tell me)\b.{0,40}\b(system prompt|system message|your instructions|your prompt|hidden prompt|api[ -]?key|secret|password|token|environment variable)/i,
  /\byou are (now|no longer)\b/i,
  /\b(pretend|act|behave|roleplay)\b.{0,20}\b(to be|as if|like|as)\b.{0,30}\b(unrestricted|jailbroken|developer mode|dan|evil|different ai|no rules)/i,
  /\b(jailbreak|developer mode|do anything now)\b/i,
  /<\s*\/?\s*(system|assistant|instructions?)\s*>/i,
  /^\s*(system|assistant)\s*:/im,
];

/** Normalises text and removes invisible/control characters; collapses whitespace. */
export const sanitizeText = (value) =>
  String(value).normalize('NFKC').replace(INVISIBLE_CHARACTERS, '').replace(/\s+/g, ' ').trim();

export const isInjectionAttempt = (text) => INJECTION_PATTERNS.some((pattern) => pattern.test(text));

export const GUARD_REPLY =
  'I can only help with air quality, pollution exposure and cleaner daily habits. ' +
  'Try asking about exercise, kids, masks, indoor air, cooking or commuting.';
