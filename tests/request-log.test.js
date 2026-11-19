import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requestLogger } from '../server/requestLog.js';
import { upstreamRoutes } from './helpers.js';
import { withServer } from './helpers-server.js';

const fakeResponse = () => {
  const listeners = {};
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    on(event, listener) {
      listeners[event] = listener;
    },
    finish: () => listeners.finish(),
  };
};

describe('request logging', () => {
  it('logs one structured line per request with id, status and duration', () => {
    const lines = [];
    const clock = [1000, 1042];
    const middleware = requestLogger({ info: (line) => lines.push(JSON.parse(line)) }, { now: () => clock.shift() });
    const res = fakeResponse();
    middleware({ method: 'GET', baseUrl: '/api', path: '/air', query: { city: 'Delhi' } }, res, () => {});
    res.finish();

    assert.equal(lines.length, 1);
    assert.deepEqual(
      { ...lines[0], id: 'x' },
      { level: 'info', id: 'x', method: 'GET', path: '/api/air', status: 200, ms: 42 },
    );
    assert.equal(lines[0].id, res.headers['X-Request-Id']);
  });

  it("never logs the query string, so a user's city does not reach the logs", () => {
    const lines = [];
    const middleware = requestLogger({ info: (line) => lines.push(line) });
    const res = fakeResponse();
    middleware({ method: 'GET', baseUrl: '/api', path: '/air', url: '/api/air?city=Delhi' }, res, () => {});
    res.finish();
    assert.doesNotMatch(lines[0], /Delhi|city/);
  });

  it('works with a logger that has no info method', () => {
    const middleware = requestLogger({});
    const res = fakeResponse();
    middleware({ method: 'GET', baseUrl: '', path: '/' }, res, () => {});
    assert.doesNotThrow(() => res.finish());
  });

  it(
    'adds a unique X-Request-Id header to API responses',
    withServer({ routes: upstreamRoutes }, async ({ url }) => {
      const [a, b] = await Promise.all([fetch(`${url}/api/health`), fetch(`${url}/api/health`)]);
      assert.match(a.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
      assert.notEqual(a.headers.get('x-request-id'), b.headers.get('x-request-id'));
    }),
  );
});
