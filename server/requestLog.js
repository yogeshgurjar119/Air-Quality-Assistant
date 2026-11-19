import { randomUUID } from 'node:crypto';

/**
 * Express middleware that tags every request with an id (`X-Request-Id`) and logs one structured
 * JSON line when it finishes: id, method, path, status and duration.
 *
 * Privacy: the query string, body and client address are never logged, because they can contain a
 * user's city and chat text.
 */
export const requestLogger = (logger, { now = () => performance.now() } = {}) => {
  const log = typeof logger?.info === 'function' ? logger.info.bind(logger) : () => {};
  return (req, res, next) => {
    const id = randomUUID();
    const startedAt = now();
    res.setHeader('X-Request-Id', id);
    res.on('finish', () => {
      log(
        JSON.stringify({
          level: 'info',
          id,
          method: req.method,
          path: req.baseUrl + req.path,
          status: res.statusCode,
          ms: Math.round(now() - startedAt),
        }),
      );
    });
    next();
  };
};
