/**
 * Tiny in-memory TTL cache that memoises async work. Concurrent callers for the same key
 * share one in-flight promise, and failed promises are evicted so errors are never cached.
 */
export const createAsyncCache = ({ ttlMs, maxEntries = 500, now = Date.now }) => {
  const entries = new Map();

  const evictOldest = () => {
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
  };

  return {
    get(key, load) {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.promise;

      entries.delete(key);
      evictOldest();
      const promise = Promise.resolve().then(load);
      entries.set(key, { promise, expiresAt: now() + ttlMs });
      promise.catch(() => {
        if (entries.get(key)?.promise === promise) entries.delete(key);
      });
      return promise;
    },
    get size() {
      return entries.size;
    },
  };
};
