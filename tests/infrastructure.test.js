import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAsyncCache } from '../server/services/cache.js';
import { loadConfig } from '../server/config.js';

describe('createAsyncCache', () => {
  it('memoises, expires and evicts failures', async () => {
    let clock = 0;
    const cache = createAsyncCache({ ttlMs: 100, maxEntries: 2, now: () => clock });
    let loads = 0;
    const load = async () => ++loads;

    assert.equal(await cache.get('a', load), 1);
    assert.equal(await cache.get('a', load), 1);
    clock = 101;
    assert.equal(await cache.get('a', load), 2);

    await assert.rejects(
      cache.get('bad', async () => {
        throw new Error('boom');
      }),
    );
    assert.equal(await cache.get('bad', async () => 'recovered'), 'recovered');
  });

  it('bounds its size', async () => {
    const cache = createAsyncCache({ ttlMs: 1000, maxEntries: 2 });
    for (const key of ['a', 'b', 'c']) await cache.get(key, async () => key);
    assert.equal(cache.size, 2);
  });
});

describe('loadConfig', () => {
  it('applies defaults and falls back on invalid numbers', () => {
    const config = loadConfig({ PORT: 'abc', NVIDIA_BASE_URL: 'https://x.test/v1///' });
    assert.equal(config.port, 3000);
    assert.equal(config.trustProxy, 0);
    assert.equal(config.nvidia.baseUrl, 'https://x.test/v1');
    assert.equal(config.nvidia.apiKey, '');
  });

  it('builds the model chain: primary, then fallbacks, de-duplicated', () => {
    const defaults = loadConfig({}).nvidia.models;
    assert.equal(defaults.length, 3);
    assert.equal(new Set(defaults).size, 3);
    assert.deepEqual(loadConfig({ NVIDIA_MODEL: 'x', NVIDIA_FALLBACK_MODELS: ' y , x ,, z ' }).nvidia.models, [
      'x',
      'y',
      'z',
    ]);
    assert.deepEqual(loadConfig({ NVIDIA_MODEL: 'x', NVIDIA_FALLBACK_MODELS: '' }).nvidia.models, ['x']);
  });

  it('reads the total AI budget with a safe default', () => {
    assert.equal(loadConfig({}).aiBudgetMs, 20_000);
    assert.equal(loadConfig({ AI_TOTAL_TIMEOUT_MS: '6000' }).aiBudgetMs, 6000);
    assert.equal(loadConfig({ AI_TOTAL_TIMEOUT_MS: 'abc' }).aiBudgetMs, 20_000);
  });

  it('trusts one proxy on Vercel/Netlify unless overridden', () => {
    assert.equal(loadConfig({ VERCEL: '1' }).trustProxy, 1);
    assert.equal(loadConfig({ NETLIFY: 'true' }).trustProxy, 1);
    assert.equal(loadConfig({ VERCEL: '1', TRUST_PROXY: '0' }).trustProxy, 0);
  });
});
