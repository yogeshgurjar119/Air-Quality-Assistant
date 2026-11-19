import { HTTP } from '../constants.js';
import { HttpError } from '../errors.js';

/**
 * Fetches JSON with a hard timeout. Upstream failures are mapped to a generic 502
 * so internal details (URLs, keys, provider messages) never leak to clients.
 */
export const fetchJson = async (url, { fetchImpl = fetch, timeoutMs, ...init } = {}) => {
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new HttpError(HTTP.BAD_GATEWAY, 'An upstream service is unreachable. Please try again.');
  }
  if (!response.ok) {
    throw new HttpError(HTTP.BAD_GATEWAY, 'An upstream service returned an error. Please try again.');
  }
  try {
    return await response.json();
  } catch {
    throw new HttpError(HTTP.BAD_GATEWAY, 'An upstream service returned an unreadable response.');
  }
};
