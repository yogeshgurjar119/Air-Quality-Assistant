import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { airOk, airOkWithoutBatch, geocodeOk, jsonResponse, llmOk, upstreamRoutes } from './helpers.js';
import { startServer, withServer } from './helpers-server.js';

describe('GET /api/air', () => {
  let ctx;
  before(async () => {
    ctx = await startServer({ routes: { ...upstreamRoutes, 'llm.test': llmOk } });
  });
  after(() => ctx.server.close());

  it('returns location, air with 24h outlook, weather and density', async () => {
    const res = await fetch(`${ctx.url}/api/air?city=Delhi`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.location.name, 'Delhi');
    assert.equal(body.air.aqi, 180);
    assert.equal(body.air.level, 'unhealthy');
    assert.equal(body.air.pm25, 95.2);
    assert.equal(body.air.forecast.best.aqi, 90);
    assert.deepEqual(body.weather, { temperatureC: 22.5, humidityPct: 55, windKmh: 3.1 });
    assert.equal(body.density.perKm2, 17854);
  });

  it('ranks the city against major world cities and adds a country average', async () => {
    const { comparison } = await (await fetch(`${ctx.url}/api/air?city=Delhi`)).json();
    assert.equal(comparison.total, 25);
    assert.equal(comparison.rank, 6, 'five cities are at or above AQI 180 (one ties and sorts first)');
    assert.equal(comparison.cities.filter((c) => c.isYou).length, 1, 'the user city is never duplicated');
    assert.equal(comparison.cities[0].aqi >= comparison.cities.at(-1).aqi, true, 'sorted most polluted first');
    assert.equal(comparison.country, 'India');
    assert.equal(comparison.countryCityCount, 4);
    assert.equal(comparison.countryAverage, 72);
  });

  it('serves repeat requests from cache without calling upstreams again', async () => {
    await fetch(`${ctx.url}/api/air?city=delhi`);
    const before = ctx.calls.length;
    await fetch(`${ctx.url}/api/air?city=DELHI`);
    assert.equal(ctx.calls.length, before);
  });

  it('rejects missing or invalid cities', async () => {
    assert.equal((await fetch(`${ctx.url}/api/air`)).status, 400);
    assert.equal((await fetch(`${ctx.url}/api/air?city=${encodeURIComponent('<script>')}`)).status, 400);
  });
});

describe('GET /api/air degraded', () => {
  it(
    'still succeeds, without comparison, when the world batch fails',
    withServer({ routes: { ...upstreamRoutes, 'air-quality-api': airOkWithoutBatch } }, async ({ url }) => {
      const body = await (await fetch(`${url}/api/air?city=Delhi`)).json();
      assert.equal(body.comparison, null);
      assert.equal(body.air.aqi, 180);
    }),
  );

  it(
    'still succeeds when weather and density providers fail',
    withServer({ routes: { 'geocoding-api': geocodeOk, 'air-quality-api': airOk } }, async ({ url }) => {
      const body = await (await fetch(`${url}/api/air?city=Delhi`)).json();
      assert.equal(body.weather, null);
      assert.deepEqual(body.density, { population: 11_000_000, areaKm2: null, perKm2: null });
    }),
  );

  it(
    'returns 404 for unknown cities',
    withServer({ routes: { 'geocoding-api': () => jsonResponse({}) } }, async ({ url }) => {
      assert.equal((await fetch(`${url}/api/air?city=Nowhereville`)).status, 404);
    }),
  );

  it(
    'returns 502 without leaking upstream details',
    withServer(
      { routes: { 'geocoding-api': geocodeOk, 'air-quality-api': () => jsonResponse({}, 503) } },
      async ({ url }) => {
        const res = await fetch(`${url}/api/air?city=Delhi`);
        const text = await res.text();
        assert.equal(res.status, 502);
        assert.ok(!text.includes('open-meteo'));
      },
    ),
  );

  it(
    'returns 502 when air data has no AQI',
    withServer(
      { routes: { 'geocoding-api': geocodeOk, 'air-quality-api': () => jsonResponse({ current: {} }) } },
      async ({ url }) => assert.equal((await fetch(`${url}/api/air?city=Delhi`)).status, 502),
    ),
  );
});

describe('GET /api/sources', () => {
  it(
    'reports each free data source as live with its latency',
    withServer({ routes: upstreamRoutes }, async ({ url, calls }) => {
      const body = await (await fetch(`${url}/api/sources`)).json();
      assert.deepEqual(
        body.sources.map((s) => s.id),
        ['air', 'weather', 'geocoding', 'density'],
      );
      assert.ok(body.sources.every((s) => s.ok && typeof s.latencyMs === 'number'));
      assert.ok(body.sources.every((s) => s.name && s.provides && s.homepage.startsWith('https://')));
      assert.ok(!Number.isNaN(Date.parse(body.checkedAt)));
      assert.equal(calls.length, 4, 'one tiny probe per source');
    }),
  );

  it(
    'marks failing sources as unavailable without failing the endpoint',
    withServer(
      {
        routes: {
          ...upstreamRoutes,
          'query.wikidata': () => jsonResponse({}, 503),
          'api.open-meteo.com/v1/forecast': () => {
            throw new Error('offline');
          },
        },
      },
      async ({ url }) => {
        const res = await fetch(`${url}/api/sources`);
        const byId = Object.fromEntries((await res.json()).sources.map((s) => [s.id, s]));
        assert.equal(res.status, 200);
        assert.equal(byId.air.ok, true);
        assert.deepEqual([byId.weather.ok, byId.density.ok], [false, false]);
        assert.equal(byId.weather.latencyMs, null);
      },
    ),
  );

  it(
    'caches the status so repeat visitors cost no upstream calls',
    withServer({ routes: upstreamRoutes }, async ({ url, calls }) => {
      await fetch(`${url}/api/sources`);
      const before = calls.length;
      await Promise.all([fetch(`${url}/api/sources`), fetch(`${url}/api/sources`)]);
      assert.equal(calls.length, before);
    }),
  );
});
