import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { upstreamRoutes, validBody } from './helpers.js';
import { startServer, post, chatBody } from './helpers-server.js';

describe('AI time budget', () => {
  const hang = (_url, init) =>
    new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));

  it('returns the built-in answer within the budget when every model hangs', async () => {
    const ctx = await startServer({ aiBudgetMs: 700, routes: { ...upstreamRoutes, 'llm.test': hang } });
    try {
      const started = Date.now();
      const body = await (await post(ctx.url, '/api/chat', chatBody())).json();
      const elapsed = Date.now() - started;
      assert.equal(body.source, 'rules');
      assert.ok(elapsed < 1900, `took ${elapsed} ms; two full 1000 ms attempts would exceed this`);
      assert.equal(ctx.calls.filter((c) => c.includes('llm.test')).length, 1, 'no time left for the second model');
    } finally {
      ctx.server.close();
    }
  });

  it('applies the same budget to plans', async () => {
    const ctx = await startServer({ aiBudgetMs: 700, routes: { ...upstreamRoutes, 'llm.test': hang } });
    try {
      const started = Date.now();
      const body = await (await post(ctx.url, '/api/plan', validBody)).json();
      assert.equal(body.source, 'rules');
      assert.ok(Date.now() - started < 1900);
    } finally {
      ctx.server.close();
    }
  });
});
