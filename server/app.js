import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { HttpError } from './errors.js';
import { CSP_DIRECTIVES, PERMISSIONS_POLICY } from './securityHeaders.js';
import { parseChat } from './services/chat.js';
import { parseCity, parseProfile } from './services/profile.js';

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
  if (error.type === 'entity.too.large') return { status: 413, message: 'Request is too large.' };
  if (error.type === 'entity.parse.failed') return { status: 400, message: 'Invalid JSON.' };
  return { status: 500, message: 'Something went wrong.', unexpected: true };
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

  app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES } }));
  app.use(compression());
  app.use(express.json({ limit: '4kb' }));
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });

  const limiter = (limit) =>
    rateLimit({
      windowMs: 60_000,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: clientKey,
      validate: { ip: false },
      message: { error: 'Too many requests. Please wait a minute and try again.' },
    });
  // AI endpoints cost money and time, so they get a tighter budget than read-only ones.
  const aiLimiter = limiter(config.aiRateLimitPerMinute);

  /** Wraps an async handler so rejections reach the error middleware. */
  const route = (handler) => (req, res, next) => handler(req, res).catch(next);

  const api = express.Router();
  api.use(limiter(config.rateLimitPerMinute));
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

  app.use('/api', api);
  // Always revalidate (ETag → cheap 304s) so deploys and edits are never served stale.
  if (staticDir) app.use(express.static(staticDir, { maxAge: 0, etag: true }));

  // Unknown API routes and malformed bodies get clean JSON errors.
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));
  app.use((error, _req, res, _next) => {
    const { status, message, unexpected } = describeError(error);
    if (unexpected) logger.error(error);
    res.status(status).json({ error: message });
  });

  return app;
};
