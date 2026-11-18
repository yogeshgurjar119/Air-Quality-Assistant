import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { HttpError } from './errors.js';
import { parseChat } from './services/chat.js';
import { parseCity, parseProfile } from './services/profile.js';

/**
 * Identifies the caller for rate limiting. Serverless adapters (Netlify) have no socket address,
 * so `req.ip` can be undefined; fall back to the platform's forwarded-for header.
 */
const clientKey = (req) => req.ip ?? req.headers['x-forwarded-for']?.split(',')[0].trim() ?? 'anonymous';

/**
 * Builds the Express app. Dependencies are injected so tests can run without network access.
 * `staticDir` is only passed by the local server: Vercel and Netlify serve `public/` from their CDN,
 * and this module must stay CommonJS-bundle-safe (no ES-module-only meta properties) because Netlify bundles functions to CommonJS.
 */
export const createApp = ({ config, planner, sourceMonitor, staticDir, logger = console }) => {
  const app = express();
  app.disable('x-powered-by');
  // Behind Vercel/Netlify the real client IP is in X-Forwarded-For (needed for per-IP rate limits).
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '4kb' }));

  // Browser features this app never needs stay switched off.
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
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

  const api = express.Router();
  api.use(limiter(config.rateLimitPerMinute));

  api.get('/health', (_req, res) => res.json({ status: 'ok', ai: config.nvidia.apiKey !== '' }));

  /** Wraps an async handler so rejections reach the error middleware. */
  const route = (handler) => (req, res, next) => handler(req, res).catch(next);

  api.get('/sources', route(async (_req, res) => {
    res.json(await sourceMonitor.getStatus());
  }));

  api.get('/air', route(async (req, res) => {
    res.json(await planner.getAir(parseCity(req.query.city)));
  }));

  api.post('/plan', aiLimiter, route(async (req, res) => {
    res.json(await planner.createPlan(parseProfile(req.body)));
  }));

  api.post('/chat', aiLimiter, route(async (req, res) => {
    const { city, messages } = parseChat(req.body);
    res.json(await planner.chat(city, messages));
  }));

  app.use('/api', api);
  // Always revalidate (ETag → cheap 304s) so deploys and edits are never served stale.
  if (staticDir) app.use(express.static(staticDir, { maxAge: 0, etag: true }));

  // Unknown API routes and malformed bodies get clean JSON errors.
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));
  app.use((error, _req, res, _next) => {
    const isClientError = error instanceof HttpError || error.type === 'entity.parse.failed';
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request is too large.' });
    }
    if (!isClientError) logger.error(error);
    const status = error instanceof HttpError ? error.status : isClientError ? 400 : 500;
    const message = error instanceof HttpError ? error.message : isClientError ? 'Invalid JSON.' : 'Something went wrong.';
    res.status(status).json({ error: message });
  });

  return app;
};
