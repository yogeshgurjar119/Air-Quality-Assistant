import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import { deferred, loadDom, sampleAirResponse, samplePlan } from './helpers-dom.js';

let createResultsView;
before(async () => {
  loadDom();
  ({ createResultsView } = await import('../public/results.js'));
});

const profile = { city: 'Delhi' };
const byId = (id) => document.getElementById(id);

describe('createResultsView', () => {
  let events;
  let busy;
  let view;
  let api;

  const build = () => {
    events = [];
    busy = [];
    view = createResultsView({
      elements: {
        wizardView: byId('wizard-view'),
        resultsView: byId('results-view'),
        status: byId('status'),
        dashboard: byId('dashboard'),
        plan: byId('plan'),
      },
      api: {
        fetchAir: (city) => api.air(city),
        fetchPlan: (p) => api.plan(p),
      },
      render: {
        renderAir: (_container, air) => events.push(['air', air.location.name]),
        renderPlan: (_container, result) => events.push(['plan', result.plan.summary]),
        renderPlanError: (_container, message) => events.push(['planError', message]),
        renderPlanLoading: () => events.push(['loading']),
      },
      onAir: (air) => events.push(['onAir', air.air.level]),
      onBusyChange: (value) => busy.push(value),
    });
  };

  beforeEach(() => {
    byId('wizard-view').hidden = false;
    byId('results-view').hidden = true;
    api = {
      air: async () => sampleAirResponse(),
      plan: async () => samplePlan(),
    };
    build();
  });

  it('shows the results screen, renders air data first and then the plan', async () => {
    await view.generate(profile);
    assert.deepEqual(events, [
      ['air', 'Delhi'],
      ['onAir', 'unhealthy'],
      ['loading'],
      ['plan', 'Delhi air is unhealthy today.'],
    ]);
    assert.equal(byId('wizard-view').hidden, true);
    assert.equal(byId('results-view').hidden, false);
    assert.equal(byId('status').hidden, true);
    assert.equal(byId('dashboard').hidden, false);
    assert.equal(byId('plan').hidden, false);
    assert.ok(document.body.classList.contains('is-results'));
    assert.deepEqual(busy, [true, false]);
    assert.equal(byId('results-view').getAttribute('aria-busy'), 'false');
  });

  it('shows the air error and no plan when the air request fails', async () => {
    api.air = async () => {
      throw new Error("We couldn't find that city.");
    };
    await view.generate(profile);
    assert.equal(byId('status').textContent, "We couldn't find that city.");
    assert.equal(byId('status').className, 'status error');
    assert.equal(byId('dashboard').hidden, true);
    assert.equal(byId('plan').hidden, true);
    assert.deepEqual(events, []);
    assert.deepEqual(busy, [true, false]);
  });

  it('keeps the dashboard and reports a plan failure separately', async () => {
    api.plan = async () => {
      throw new Error('AI is busy.');
    };
    await view.generate(profile);
    assert.deepEqual(events.at(-1), ['planError', 'AI is busy.']);
    assert.equal(byId('dashboard').hidden, false);
  });

  it('ignores a stale response when a newer request has started', async () => {
    const slow = deferred();
    api.air = (city) => (city === 'Slow' ? slow.promise : Promise.resolve(sampleAirResponse()));
    const first = view.generate({ city: 'Slow' });
    await view.generate({ city: 'Fast' });
    events.length = 0;

    slow.resolve(sampleAirResponse({ location: { name: 'Slow', region: null, country: 'X' } }));
    await first;
    assert.deepEqual(events, [], 'the stale response is dropped');
    assert.deepEqual(busy, [true, true, false], 'only the latest request clears the busy state');
  });

  it('close() returns to the questionnaire and discards in-flight responses', async () => {
    const slow = deferred();
    api.air = () => slow.promise;
    const pending = view.generate(profile);
    view.close();
    assert.equal(byId('wizard-view').hidden, false);
    assert.equal(byId('results-view').hidden, true);
    assert.equal(document.body.classList.contains('is-results'), false);

    slow.resolve(sampleAirResponse());
    await pending;
    assert.deepEqual(events, [], 'nothing is rendered after closing');
  });
});
