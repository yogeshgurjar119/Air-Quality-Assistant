import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createNvidiaClient } from '../server/services/nvidia.js';
import { jsonResponse } from './helpers.js';

describe('createNvidiaClient', () => {
  const capture = () => {
    const sent = {};
    const fetchImpl = async (url, init) => {
      Object.assign(sent, { url, headers: init.headers, body: JSON.parse(init.body) });
      return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
    };
    return { sent, fetchImpl };
  };
  const base = { apiKey: 'k', models: ['m'], baseUrl: 'https://llm.test/v1', timeoutMs: 500, logger: { warn() {} } };

  it('disables model thinking only when asked and authenticates with the key', async () => {
    const on = capture();
    await createNvidiaClient({ ...base, fetchImpl: on.fetchImpl, disableThinking: true }).chat([]);
    assert.deepEqual(on.sent.body.chat_template_kwargs, { enable_thinking: false });
    assert.equal(on.sent.headers.Authorization, 'Bearer k');

    const off = capture();
    await createNvidiaClient({ ...base, fetchImpl: off.fetchImpl }).chat([]);
    assert.equal('chat_template_kwargs' in off.sent.body, false);
  });

  it('refuses to call the model without a key', async () => {
    await assert.rejects(createNvidiaClient({ ...base, apiKey: '' }).chat([]), { status: 503 });
  });

  describe('model chain', () => {
    const modelsCalled = [];
    const chainClient = (failing, clock) => {
      const fetchImpl = async (_url, init) => {
        const { model } = JSON.parse(init.body);
        modelsCalled.push(model);
        return failing.includes(model)
          ? jsonResponse({}, 500)
          : jsonResponse({ choices: [{ message: { content: `from ${model}` } }] });
      };
      return createNvidiaClient({ ...base, models: ['a', 'b', 'c'], fetchImpl, now: clock });
    };

    it('tries models in order and returns the first success', async () => {
      modelsCalled.length = 0;
      assert.equal(await chainClient(['a']).chat([]), 'from b');
      assert.deepEqual(modelsCalled, ['a', 'b']);
    });

    it('throws the last error when every model fails', async () => {
      await assert.rejects(chainClient(['a', 'b', 'c']).chat([]), { status: 502 });
    });

    it('benches a failed model for a minute, then retries it', async () => {
      let clock = 0;
      const client = chainClient(['a'], () => clock);
      modelsCalled.length = 0;
      await client.chat([]);
      await client.chat([]);
      assert.deepEqual(modelsCalled, ['a', 'b', 'b'], 'a is skipped while cooling down');
      clock = 61_000;
      modelsCalled.length = 0;
      await client.chat([]);
      assert.deepEqual(modelsCalled, ['a', 'b'], 'a is retried after the cooldown');
    });

    it('stops trying models once the total budget is spent', async () => {
      let clock = 0;
      const called = [];
      const fetchImpl = async (_url, init) => {
        called.push(JSON.parse(init.body).model);
        clock += 600; // each failing attempt "takes" 600 ms
        return jsonResponse({}, 500);
      };
      const client = createNvidiaClient({
        ...base,
        models: ['a', 'b', 'c'],
        fetchImpl,
        budgetMs: 1000,
        now: () => clock,
      });
      await assert.rejects(client.chat([]), { status: 502 });
      assert.deepEqual(called, ['a'], 'only 400 ms remained for b, below the 500 ms minimum');
    });

    it('fails fast with a 504 when the budget is already too small', async () => {
      const client = createNvidiaClient({
        ...base,
        models: ['a'],
        fetchImpl: async () => assert.fail('must not call'),
        budgetMs: 100,
      });
      await assert.rejects(client.chat([]), { status: 504 });
    });

    it('still tries every model when all are cooling down', async () => {
      const client = chainClient(['a', 'b', 'c'], () => 0);
      await assert.rejects(client.chat([]));
      modelsCalled.length = 0;
      await assert.rejects(client.chat([]));
      assert.deepEqual(modelsCalled, ['a', 'b', 'c']);
    });
  });
});
