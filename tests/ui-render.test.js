import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { loadDom, sampleAirResponse, samplePlan } from './helpers-dom.js';

let render;
let dom;
before(async () => {
  loadDom();
  dom = await import('../public/dom.js');
  render = await import('../public/render.js');
});

const draw = (data) => {
  const container = document.createElement('div');
  render.renderAir(container, data);
  return container;
};

describe('dom helpers', () => {
  it('builds elements with class, text and attributes, and skips falsy children', () => {
    const node = dom.el('p', { className: 'x', text: 'hi', attrs: { role: 'note' } }, [
      null,
      dom.el('b', { text: 'b' }),
      false,
    ]);
    assert.equal(node.className, 'x');
    assert.equal(node.getAttribute('role'), 'note');
    assert.equal(node.children.length, 1);
  });

  it('creates namespaced SVG elements', () => {
    const node = dom.svg('svg', { viewBox: '0 0 1 1' }, [dom.svg('path', { d: 'M0 0' })]);
    assert.equal(node.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(node.firstChild.tagName, 'path');
  });
});

describe('renderAir', () => {
  it('renders the gauge, readings with WHO notes, forecast bars and the ranked comparison', () => {
    const view = draw(sampleAirResponse());
    assert.equal(view.querySelector('.gauge').getAttribute('aria-label'), 'US AQI 166, Unhealthy');
    assert.equal(view.querySelectorAll('.tile').length, 7);
    const notes = [...view.querySelectorAll('.who')].map((n) => n.textContent);
    assert.deepEqual(notes, ['4.7× WHO limit', '1.6× WHO limit', '1.1× WHO limit']);
    assert.equal(view.querySelectorAll('.bar').length, 24);
    assert.equal(view.querySelectorAll('.bar.best').length, 1);
    assert.equal(view.querySelectorAll('.compare-row').length, 3);
    const you = view.querySelector('.compare-row.you');
    assert.equal(you.getAttribute('aria-current'), 'true');
    assert.match(you.textContent, /Delhi \(you\)/);
    assert.match(view.textContent, /#2 most polluted of 3 major cities/);
    assert.match(view.textContent, /Average AQI across 2 major cities in India: 183/);
  });

  it('shows "within WHO guideline" in green for low readings', () => {
    const data = sampleAirResponse();
    data.air.pm25 = 10;
    const note = draw(data).querySelector('.who.ok');
    assert.equal(note.textContent, 'Within WHO guideline');
  });

  it('never interprets API text as HTML (XSS-safe)', () => {
    const data = sampleAirResponse({
      location: { name: '<img src=x onerror=alert(1)>', region: null, country: 'India' },
    });
    const view = draw(data);
    assert.equal(view.querySelector('img'), null);
    assert.ok(view.textContent.includes('<img src=x onerror=alert(1)>'));
  });

  it('omits optional sections when their data is missing', () => {
    const view = draw(sampleAirResponse({ weather: null, density: null, comparison: null }));
    assert.equal(view.querySelectorAll('.tile').length, 4, 'weather tiles are hidden');
    assert.equal(view.querySelector('.density'), null);
    assert.equal(view.querySelector('.compare-list'), null);
  });

  it('omits the country average and density-per-km² when unavailable', () => {
    const data = sampleAirResponse();
    data.comparison.countryAverage = null;
    data.density = { population: 52_000, areaKm2: null, perKm2: null };
    const view = draw(data);
    assert.doesNotMatch(view.textContent, /Average AQI across/);
    assert.match(view.textContent, /52,000/);
    assert.doesNotMatch(view.textContent, /\/km²/);
  });

  it('copes with an empty forecast', () => {
    const data = sampleAirResponse();
    data.air.forecast = { hours: [], best: null };
    const view = draw(data);
    assert.equal(view.querySelectorAll('.bar').length, 0);
    assert.match(view.textContent, /No forecast available/);
  });
});

describe('plan rendering', () => {
  const mount = () => document.createElement('div');

  it('renders the summary, three sections and the impact of every item', () => {
    const container = mount();
    render.renderPlan(container, samplePlan());
    assert.match(container.textContent, /Delhi air is unhealthy today/);
    assert.match(container.textContent, /Personalised by AI/);
    assert.equal(container.querySelectorAll('.plan-col').length, 3);
    assert.match(container.querySelector('.impact').textContent, /Why it matters: Less PM2\.5\./);
  });

  it('labels rule-based plans honestly', () => {
    const container = mount();
    render.renderPlan(container, samplePlan('rules'));
    assert.match(container.textContent, /Rule-based guidance \(AI unavailable\)/);
  });

  it('shows a loading skeleton and an accessible error', () => {
    const container = mount();
    render.renderPlanLoading(container);
    assert.ok(container.querySelector('.skeleton'));
    render.renderPlanError(container, 'Boom');
    assert.equal(container.querySelector('[role="alert"]').textContent, 'Boom');
  });
});
