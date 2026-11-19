import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { jsonResponse, llmOk, upstreamRoutes, validBody } from './helpers.js';
import { post, withServer } from './helpers-server.js';

describe('POST /api/plan', () => {
  it(
    'returns an AI plan',
    withServer({ routes: { ...upstreamRoutes, 'llm.test': llmOk } }, async ({ url }) => {
      const res = await post(url, '/api/plan', validBody);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.source, 'ai');
      assert.equal(body.plan.summary, 'AI summary.');
    }),
  );

  it(
    'caches identical AI plans',
    withServer({ routes: { ...upstreamRoutes, 'llm.test': llmOk } }, async ({ url, calls }) => {
      await post(url, '/api/plan', validBody);
      const llmCalls = () => calls.filter((c) => c.includes('llm.test')).length;
      const before = llmCalls();
      await post(url, '/api/plan', validBody);
      assert.equal(llmCalls(), before);
    }),
  );

  it(
    'dedupes concurrent identical requests into one upstream fetch',
    withServer({ routes: { ...upstreamRoutes, 'llm.test': llmOk } }, async ({ url, calls }) => {
      await Promise.all([
        post(url, '/api/plan', validBody),
        post(url, '/api/plan', validBody),
        fetch(`${url}/api/air?city=Delhi`),
      ]);
      assert.equal(calls.filter((c) => c.includes('geocoding-api')).length, 1);
      assert.equal(calls.filter((c) => c.includes('llm.test')).length, 1);
    }),
  );

  it(
    'uses the backup model when the primary returns an unusable plan',
    withServer(
      {
        routes: {
          ...upstreamRoutes,
          'llm.test': (url, init) =>
            JSON.parse(init.body).model === 'm1'
              ? jsonResponse({ choices: [{ message: { content: 'not json' } }] })
              : llmOk(url, init),
        },
      },
      async ({ url }) => assert.equal((await (await post(url, '/api/plan', validBody)).json()).source, 'ai'),
    ),
  );

  it(
    'falls back to rules when the LLM errors',
    withServer({ routes: { ...upstreamRoutes, 'llm.test': () => jsonResponse({}, 500) } }, async ({ url }) => {
      const body = await (await post(url, '/api/plan', validBody)).json();
      assert.equal(body.source, 'rules');
      assert.ok(body.plan.routines.length > 0);
    }),
  );

  it(
    'falls back to rules when the LLM returns garbage',
    withServer(
      {
        routes: {
          ...upstreamRoutes,
          'llm.test': () => jsonResponse({ choices: [{ message: { content: 'sorry, no JSON' } }] }),
        },
      },
      async ({ url }) => assert.equal((await (await post(url, '/api/plan', validBody)).json()).source, 'rules'),
    ),
  );

  it(
    'runs in offline mode with no API key',
    withServer({ apiKey: '', routes: upstreamRoutes }, async ({ url }) => {
      assert.equal((await (await post(url, '/api/plan', validBody)).json()).source, 'rules');
    }),
  );

  it(
    'rejects invalid input',
    withServer({ routes: upstreamRoutes }, async ({ url }) => {
      assert.equal((await post(url, '/api/plan', { ...validBody, commute: 'x' })).status, 400);
      assert.equal((await post(url, '/api/plan', '{bad', true)).status, 400);
      assert.equal((await post(url, '/api/plan', { ...validBody, city: 'a'.repeat(5000) })).status, 413);
    }),
  );
});
