import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { fetchAir, fetchHealth, fetchPlan, fetchSources, REQUEST_TIMEOUT_MS, sendChat } from '../public/api.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('API client', () => {
  it('encodes the city in the query string and returns the JSON body', async () => {
    let requested;
    globalThis.fetch = async (url) => {
      requested = String(url);
      return reply({ ok: true });
    };
    assert.deepEqual(await fetchAir('São Paulo & co'), { ok: true });
    assert.equal(requested, '/api/air?city=S%C3%A3o+Paulo+%26+co');
  });

  it('posts JSON for plan and chat requests and uses the right endpoints for reads', async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push([String(url), init.method ?? 'GET', init.body]);
      return reply({});
    };
    await fetchPlan({ city: 'Delhi' });
    await sendChat('Delhi', [{ role: 'user', content: 'hi' }]);
    await fetchHealth();
    await fetchSources();
    assert.deepEqual(calls, [
      ['/api/plan', 'POST', '{"city":"Delhi"}'],
      ['/api/chat', 'POST', '{"city":"Delhi","messages":[{"role":"user","content":"hi"}]}'],
      ['/api/health', 'GET', undefined],
      ['/api/sources', 'GET', undefined],
    ]);
  });

  it('sends a timeout signal with every request', async () => {
    let signal;
    globalThis.fetch = async (_url, init) => {
      signal = init.signal;
      return reply({});
    };
    await fetchHealth();
    assert.ok(signal instanceof AbortSignal);
    assert.ok(
      REQUEST_TIMEOUT_MS > 30_000,
      'longer than the server-side AI budget so its fallback answer arrives first',
    );
  });

  it("surfaces the server's user-safe error message", async () => {
    globalThis.fetch = async () => reply({ error: 'Please enter a valid city name.' }, 400);
    await assert.rejects(fetchAir('<x>'), { message: 'Please enter a valid city name.' });
  });

  it('falls back to a generic message for unreadable error responses', async () => {
    globalThis.fetch = async () => new Response('<html>Bad Gateway</html>', { status: 502 });
    await assert.rejects(fetchAir('Delhi'), { message: 'Something went wrong. Please try again.' });
  });

  it('turns network failures and timeouts into friendly messages', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await assert.rejects(fetchAir('Delhi'), { message: /Network problem/ });

    globalThis.fetch = async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    };
    await assert.rejects(fetchAir('Delhi'), { message: /taking longer than expected/ });
  });
});
