/** HTTP status codes used by the API, named so call sites explain themselves. */
export const HTTP = Object.freeze({
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
});

/** One minute in milliseconds; all cache and rate-limit windows are multiples of it. */
export const MINUTE_MS = 60_000;
