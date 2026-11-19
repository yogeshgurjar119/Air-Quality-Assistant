/** Thin client for the backend API. Errors carry the server's user-safe message. */

/** Longer than the server's AI time budget, so the server's own fallback answer arrives first. */
export const REQUEST_TIMEOUT_MS = 35_000;

const NETWORK_MESSAGE = 'Network problem. Please check your connection and try again.';
const TIMEOUT_MESSAGE = 'This is taking longer than expected. Please try again.';

const request = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(path, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(error?.name === 'TimeoutError' ? TIMEOUT_MESSAGE : NETWORK_MESSAGE);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
  return body;
};

const postJson = (path, payload) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

/** Loads live air quality and context for a city. */
export const fetchAir = (city) => request(`/api/air?${new URLSearchParams({ city })}`);
/** Asks the server for a personalised plan for a profile. */
export const fetchPlan = (profile) => postJson('/api/plan', profile);
/** Sends the conversation to the assistant and returns its reply. */
export const sendChat = (city, messages) => postJson('/api/chat', { city, messages });
/** Checks that the server is up and whether AI is configured. */
export const fetchHealth = () => request('/api/health');
/** Loads the live status of each data source. */
export const fetchSources = () => request('/api/sources');
