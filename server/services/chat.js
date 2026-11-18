import { HttpError } from '../errors.js';
import { sanitizeText } from './guard.js';
import { parseCity, requireObject } from './profile.js';

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 500;
const ROLES = ['user', 'assistant'];

/** Validates an untrusted chat request: a city plus a short, alternating-role history ending with the user. */
export const parseChat = (input) => {
  const body = requireObject(input);
  const city = parseCity(body.city);

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new HttpError(400, 'Please send a message.');
  }
  const messages = body.messages.slice(-MAX_MESSAGES).map((message) => {
    const content = typeof message?.content === 'string' ? sanitizeText(message.content) : '';
    if (!ROLES.includes(message?.role) || content.length === 0 || content.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(400, `Messages must be 1–${MAX_MESSAGE_LENGTH} characters.`);
    }
    return { role: message.role, content };
  });
  if (messages.at(-1).role !== 'user') {
    throw new HttpError(400, 'The last message must come from the user.');
  }
  return { city, messages };
};
