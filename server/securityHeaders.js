/**
 * Single source of truth for the browser security policy. Express applies it to API responses,
 * and `tests/headers.test.js` asserts that `vercel.json` and `netlify.toml` (which serve the static
 * files directly from their CDNs) carry exactly the same values.
 */
export const CSP_DIRECTIVES = Object.freeze({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
});

/** Browser features this app never needs stay switched off. */
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

const toKebabCase = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The `Content-Security-Policy` header value for {@link CSP_DIRECTIVES}. */
export const cspHeaderValue = () =>
  Object.entries(CSP_DIRECTIVES)
    .map(([name, sources]) => `${toKebabCase(name)} ${sources.join(' ')}`)
    .join('; ');
