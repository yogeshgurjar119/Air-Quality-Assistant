import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/**
 * Loads the real `public/index.html` into jsdom and exposes the browser globals the UI modules use.
 * Each test file runs in its own process, so setting globals here is safe. Import the UI modules
 * with a dynamic `import()` AFTER calling this.
 */
export const loadDom = ({ reducedMotion = true } = {}) => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/' });
  const { window } = dom;
  window.matchMedia = () => ({ matches: reducedMotion, addEventListener() {} });
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = () => {};
  Object.assign(globalThis, {
    window,
    document: window.document,
    FormData: window.FormData,
    Event: window.Event,
    KeyboardEvent: window.KeyboardEvent,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  });
  return dom;
};

/** Polls until `predicate` is truthy (or fails the test after `timeoutMs`). */
export const eventually = async (predicate, { timeoutMs = 1500 } = {}) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Condition was not met in time');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

/** A promise whose resolution the test controls (for ordering and stale-response tests). */
export const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const hours = Array.from({ length: 24 }, (_, i) => ({
  time: `2026-11-18T${String(i).padStart(2, '0')}:00`,
  aqi: 150 + i,
  level: 'unhealthy',
}));

export const sampleAirResponse = (overrides = {}) => ({
  location: { name: 'Delhi', region: 'Delhi', country: 'India' },
  air: {
    aqi: 166,
    level: 'unhealthy',
    label: 'Unhealthy',
    pm25: 71.2,
    pm10: 73.1,
    no2: 27,
    ozone: 107,
    observedAt: '2026-11-18T10:30',
    forecast: { hours, best: hours[0] },
  },
  weather: { temperatureC: 22, humidityPct: 50, windKmh: 3 },
  density: { population: 11_000_000, areaKm2: 1484, perKm2: 7412 },
  comparison: {
    cities: [
      { name: 'Kolkata', country: 'India', code: 'IN', aqi: 200, level: 'unhealthy', isYou: false },
      { name: 'Delhi', country: 'India', code: 'IN', aqi: 166, level: 'unhealthy', isYou: true },
      { name: 'London', country: 'United Kingdom', code: 'GB', aqi: 40, level: 'good', isYou: false },
    ],
    rank: 2,
    total: 3,
    country: 'India',
    countryAverage: 183,
    countryCityCount: 2,
  },
  ...overrides,
});

export const samplePlan = (source = 'ai') => ({
  source,
  plan: {
    summary: 'Delhi air is unhealthy today.',
    routines: [{ title: 'Walk early', action: 'Go before 8.', impact: 'Less PM2.5.' }],
    indoor: [{ title: 'Seal gaps', action: 'Use strips.', impact: 'Keeps particles out.' }],
    alternatives: [{ title: 'Take transit', action: 'Use the metro.', impact: 'Cuts emissions.' }],
  },
});
