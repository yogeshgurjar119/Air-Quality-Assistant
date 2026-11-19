import { HTTP } from '../constants.js';
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
    throw new HttpError(HTTP.BAD_REQUEST, 'Please send a message.');
  }
  const recent = body.messages.slice(-MAX_MESSAGES);
  if (recent.at(-1)?.role !== 'user') {
    throw new HttpError(HTTP.BAD_REQUEST, 'The last message must come from the user.');
  }
  const messages = recent.flatMap((message) => {
    if (!ROLES.includes(message?.role)) throw new HttpError(HTTP.BAD_REQUEST, 'Each message needs a valid role.');
    // Assistant turns are client-controlled (they could be forged) and are never forwarded to the model,
    // so they are dropped here without validating their content. Long AI replies sent back as history
    // therefore can't cause a "message too long" error on the user's next question.
    if (message.role === 'assistant') return [];
    const content = typeof message.content === 'string' ? sanitizeText(message.content) : '';
    if (content.length === 0 || content.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(HTTP.BAD_REQUEST, `Messages must be 1–${MAX_MESSAGE_LENGTH} characters.`);
    }
    return [{ role: 'user', content }];
  });
  return { city, messages };
};
