import { HTTP, MINUTE_MS } from './constants.js';
import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { HttpError } from './errors.js';
import { requestLogger } from './requestLog.js';
import { CSP_DIRECTIVES, PERMISSIONS_POLICY } from './securityHeaders.js';
import { parseChat } from './services/chat.js';
import { parseCity, parseProfile } from './services/profile.js';

const RATE_LIMIT_WINDOW_MS = MINUTE_MS;
const MAX_BODY_SIZE = '4kb';

/**
 * Identifies the caller for rate limiting. Serverless adapters (Netlify) have no socket address, so
 * `req.ip` can be undefined. Prefer the platform's own client-IP header, which clients cannot set,
 * and only then fall back to the forwarded-for header.
 */
export const clientKey = (req) =>
  req.ip ??
  req.headers['x-nf-client-connection-ip'] ??
  req.headers['x-forwarded-for']?.split(',')[0].trim() ??
  'anonymous';

/** Maps any error to the status and user-safe message sent to the client; `unexpected` errors are logged. */
export const describeError = (error) => {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  if (error.type === 'entity.too.large') return { status: HTTP.PAYLOAD_TOO_LARGE, message: 'Request is too large.' };
  if (error.type === 'entity.parse.failed') return { status: HTTP.BAD_REQUEST, message: 'Invalid JSON.' };
  return { status: 500, message: 'Something went wrong.', unexpected: true };
};

const createLimiter = (limit) =>
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    validate: { ip: false },
    message: { error: 'Too many requests. Please wait a minute and try again.' },
  });

/** Wraps an async handler so rejections reach the error middleware. */
const route = (handler) => (req, res, next) => handler(req, res).catch(next);

/** Security headers, compression and body parsing shared by every route. */
const applyCommonMiddleware = (app, logger) => {
  app.use(requestLogger(logger));
  app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES } }));
  app.use(compression());
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });
};

/** The JSON API: read-only data routes and the (tighter-limited) AI routes. */
const createApiRouter = ({ config, planner, sourceMonitor }) => {
  // AI endpoints cost money and time, so they get a tighter budget than read-only ones.
  const aiLimiter = createLimiter(config.aiRateLimitPerMinute);
  const api = express.Router();
  api.use(createLimiter(config.rateLimitPerMinute));
  // Responses are personalised and live, so no browser or shared cache may keep them.
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  api.get('/health', (_req, res) => res.json({ status: 'ok', ai: config.nvidia.apiKey !== '' }));
  api.get(
    '/sources',
    route(async (_req, res) => res.json(await sourceMonitor.getStatus())),
  );
  api.get(
    '/air',
    route(async (req, res) => res.json(await planner.getAir(parseCity(req.query.city)))),
  );
  api.post(
    '/plan',
    aiLimiter,
    route(async (req, res) => res.json(await planner.createPlan(parseProfile(req.body)))),
  );
  api.post(
    '/chat',
    aiLimiter,
    route(async (req, res) => {
      const { city, messages } = parseChat(req.body);
      res.json(await planner.chat(city, messages));
    }),
  );
  return api;
};

/** Unknown API routes and malformed requests get clean JSON errors. */
const applyErrorHandling = (app, logger) => {
  app.use('/api', (_req, _res, next) => next(new HttpError(HTTP.NOT_FOUND, 'Not found.')));
  app.use((error, _req, res, _next) => {
    const { status, message, unexpected } = describeError(error);
    if (unexpected) logger.error(error);
    res.status(status).json({ error: message });
  });
};

/**
 * Builds the Express app. Dependencies are injected so tests can run without network access.
 * `staticDir` is only passed by the local server: Vercel and Netlify serve `public/` from their CDN,
 * and this module must stay CommonJS-bundle-safe (no ES-module-only meta properties) because
 * Netlify bundles functions to CommonJS.
 */
export const createApp = ({ config, planner, sourceMonitor, staticDir, logger = console }) => {
  const app = express();
  app.disable('x-powered-by');
  // Behind Vercel/Netlify the real client IP is in X-Forwarded-For (needed for per-IP rate limits).
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  applyCommonMiddleware(app, logger);
  app.use('/api', createApiRouter({ config, planner, sourceMonitor }));
  // Always revalidate (ETag → cheap 304s) so deploys and edits are never served stale.
  if (staticDir) app.use(express.static(staticDir, { maxAge: 0, etag: true }));
  applyErrorHandling(app, logger);
  return app;
};
