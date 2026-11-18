/** Shared fixtures for tests. */

export const validBody = Object.freeze({
  city: 'Delhi',
  commute: 'car',
  cooking: 'lpg_gas',
  home: 'apartment',
  purifier: 'none',
  vulnerable: ['children'],
});

export const sampleLocation = Object.freeze({ name: 'Delhi', region: 'Delhi', country: 'India', latitude: 28.6, longitude: 77.2 });

export const sampleAir = (aqi = 180, level = 'unhealthy', label = 'Unhealthy') => ({
  aqi,
  level,
  label,
  pm25: 95.2,
  pm10: 140,
  no2: 40,
  ozone: 60,
  observedAt: '2026-01-01T10:00',
  forecast: { hours: [{ time: '2026-01-01T10:00', aqi, level }], best: { time: '2026-01-01T10:00', aqi, level } },
});

export const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fetch stub that routes by URL substring to canned responses; handlers receive (url, init). */
export const routedFetch = (routes) => async (url, init) => {
  const key = Object.keys(routes).find((fragment) => String(url).includes(fragment));
  if (!key) throw new Error(`Unexpected URL ${url}`);
  return routes[key](url, init);
};

export const silentLogger = { warn() {}, error() {}, log() {} };

/** Upstream stubs matching the real provider URLs. */
export const geocodeOk = () =>
  jsonResponse({
    results: [{ id: 1273294, name: 'Delhi', admin1: 'Delhi', country: 'India', country_code: 'IN', latitude: 28.6, longitude: 77.2, population: 11_000_000 }],
  });

/** Batch requests (comma-separated coordinates) get one reading per city: AQI = 20 + 8 × index. */
const isBatch = (url) => String(url).includes('latitude=') && /latitude=[^&]*%2C/.test(String(url));

export const airOk = (url) => {
  if (isBatch(url)) {
    const count = decodeURIComponent(String(url).match(/latitude=([^&]*)/)[1]).split(',').length;
    return jsonResponse(Array.from({ length: count }, (_, i) => ({ current: { us_aqi: 20 + i * 8 } })));
  }
  return jsonResponse({
    current: { us_aqi: 180, pm2_5: 95.24, pm10: 140, nitrogen_dioxide: 40, ozone: 60, time: '2026-01-01T10:00' },
    hourly: {
      time: ['2026-01-01T09:00', '2026-01-01T10:00', '2026-01-01T11:00', '2026-01-01T12:00'],
      us_aqi: [170, 180, 90, 120],
    },
  });
};

/** Like airOk, but the world-comparison batch request fails. */
export const airOkWithoutBatch = (url) => (isBatch(url) ? jsonResponse({}, 503) : airOk(url));

export const weatherOk = () => jsonResponse({ current: { temperature_2m: 22.5, relative_humidity_2m: 55, wind_speed_10m: 3.1 } });

export const densityOk = () =>
  jsonResponse({ results: { bindings: [{ pop: { value: '26495000' }, area: { value: '1484000000' } }] } });

export const upstreamRoutes = {
  'geocoding-api': geocodeOk,
  'air-quality-api': airOk,
  'api.open-meteo.com/v1/forecast': weatherOk,
  'query.wikidata': densityOk,
};

export const llmPlan = {
  summary: 'AI summary.',
  routines: [{ title: 'R', action: 'a', impact: 'i' }],
  indoor: [{ title: 'I', action: 'a', impact: 'i' }],
  alternatives: [{ title: 'A', action: 'a', impact: 'i' }],
};

/** LLM stub: answers chat requests with text and plan requests with fenced JSON. */
export const llmOk = (_url, init) => {
  const { messages } = JSON.parse(init.body);
  const isChat = messages[0].content.includes('chat helper');
  const content = isChat ? 'Keep windows closed today.' : `\`\`\`json\n${JSON.stringify(llmPlan)}\n\`\`\``;
  return jsonResponse({ choices: [{ message: { content } }] });
};
