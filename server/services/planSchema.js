import { HttpError } from '../errors.js';

export const SECTION_KEYS = Object.freeze(['routines', 'indoor', 'alternatives']);

const MAX_ITEMS_PER_SECTION = 5;
const MAX_LENGTHS = Object.freeze({ summary: 400, title: 80, action: 300, impact: 300 });

const clean = (value, max) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const normalizeItem = (item) => {
  const title = clean(item?.title, MAX_LENGTHS.title);
  const action = clean(item?.action, MAX_LENGTHS.action);
  const impact = clean(item?.impact, MAX_LENGTHS.impact);
  return title && action && impact ? { title, action, impact } : null;
};

/** Extracts the first JSON object from model output, tolerating code fences or chatter. */
export const extractJson = (text) => {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

/**
 * Validates and trims an untrusted plan object (from the LLM) into the exact shape the UI
 * renders. Anything malformed is dropped rather than trusted.
 */
export const normalizePlan = (raw) => {
  const summary = clean(raw?.summary, MAX_LENGTHS.summary);
  const plan = { summary };
  for (const key of SECTION_KEYS) {
    const items = Array.isArray(raw?.[key]) ? raw[key] : [];
    plan[key] = items.map(normalizeItem).filter(Boolean).slice(0, MAX_ITEMS_PER_SECTION);
  }
  const isUsable = summary && SECTION_KEYS.every((key) => plan[key].length > 0);
  if (!isUsable) {
    throw new HttpError(502, 'The AI returned an incomplete plan.');
  }
  return plan;
};
