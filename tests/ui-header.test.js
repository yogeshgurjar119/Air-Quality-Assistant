import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import { eventually, loadDom } from './helpers-dom.js';

let startSourceStatus;
before(async () => {
  loadDom();
  ({ startSourceStatus } = await import('../public/header.js'));
});

const realFetch = globalThis.fetch;
const source = (name, ok = true) => ({
  id: name,
  name,
  provides: `${name} data`,
  homepage: `https://example.org/${name}`,
  ok,
  latencyMs: ok ? 120 : null,
});

describe('header data-source status', () => {
  let stop;
  const elements = () => ({
    summary: document.getElementById('sources-summary'),
    list: document.getElementById('sources-list'),
  });
  const serve = (body, status = 200) => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };

  beforeEach(() => {
    loadDom();
  });

  afterEach(() => {
    stop?.(); // clear the refresh timer so the test process can exit
    globalThis.fetch = realFetch;
  });

  it('shows every source as live with its latency and a safe external link', async () => {
    serve({ sources: [source('Open-Meteo Air'), source('Wikidata')] });
    const { summary, list } = elements();
    stop = startSourceStatus({ summary, list });
    await eventually(() => summary.dataset.state === 'ok');

    assert.equal(summary.textContent, '2 of 2 free data sources live');
    const links = [...list.querySelectorAll('a.source.live')];
    assert.equal(links.length, 2);
    assert.equal(links[0].getAttribute('href'), 'https://example.org/Open-Meteo Air');
    assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer');
    assert.equal(links[0].getAttribute('target'), '_blank');
    assert.match(links[0].textContent, /Live · 120 ms/);
    assert.match(links[0].querySelector('.visually-hidden').textContent, /Opens in a new tab/);
  });

  it('flags unavailable sources and reports a partial state', async () => {
    serve({ sources: [source('Open-Meteo Air'), source('Wikidata', false)] });
    const { summary, list } = elements();
    stop = startSourceStatus({ summary, list });
    await eventually(() => summary.dataset.state === 'partial');

    assert.equal(summary.textContent, '1 of 2 free data sources live');
    assert.match(list.querySelector('a.source.down').textContent, /Unavailable/);
  });

  it('degrades to a clear message when the status request fails', async () => {
    serve({ error: 'nope' }, 500);
    const { summary } = elements();
    stop = startSourceStatus({ summary, list: elements().list });
    await eventually(() => summary.dataset.state === 'down');
    assert.equal(summary.textContent, 'Data status unavailable');
  });
});
