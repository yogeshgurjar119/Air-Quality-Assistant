import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildForecast, fetchBatchAqi } from '../server/services/airQuality.js';
import { buildComparison } from '../server/services/comparison.js';
import { fetchDensity, parseDensity } from '../server/services/density.js';
import { createSourceMonitor } from '../server/services/sources.js';
import { fetchWeather } from '../server/services/weather.js';
import { jsonResponse } from './helpers.js';

describe('buildForecast', () => {
  const hourly = {
    time: ['2026-01-01T08:00', '2026-01-01T09:00', '2026-01-01T10:00', '2026-01-01T11:00'],
    us_aqi: [50, 60, 180, 90],
  };

  it('starts at the current hour and finds the cleanest hour', () => {
    const { hours, best } = buildForecast(hourly, '2026-01-01T09:30');
    assert.equal(hours[0].time, '2026-01-01T09:00');
    assert.equal(hours.length, 3);
    assert.deepEqual(best, { time: '2026-01-01T09:00', aqi: 60, level: 'moderate' });
  });

  it('skips non-numeric values and handles missing data', () => {
    assert.equal(buildForecast({ time: ['2026-01-01T09:00'], us_aqi: [null] }, '2026-01-01T09:00').best, null);
    assert.deepEqual(buildForecast(undefined, undefined), { hours: [], best: null });
  });
});

describe('density and weather', () => {
  const row = (pop, area) => ({ results: { bindings: [{ pop: { value: pop }, area: { value: area } }] } });

  it('computes density from population and m² area', () => {
    assert.deepEqual(parseDensity(row('26495000', '1484000000')), {
      population: 26_495_000,
      areaKm2: 1484,
      perKm2: 17_854,
    });
  });

  it('returns null for missing or implausible data', () => {
    for (const bad of [
      null,
      {},
      row('0', '100'),
      row('100', '0'),
      row('abc', '1000000'),
      { results: { bindings: [] } },
    ]) {
      assert.equal(parseDensity(bad), null);
    }
  });

  it('skips the lookup without a GeoNames id and sends a safe numeric query otherwise', async () => {
    assert.equal(await fetchDensity(null, {}), null);
    let requested;
    const fetchImpl = async (url) => {
      requested = decodeURIComponent(String(url));
      return jsonResponse(row('1000', '1000000'));
    };
    assert.equal((await fetchDensity(123, { fetchImpl, timeoutMs: 500 })).perKm2, 1000);
    assert.match(requested, /P1566\+"123"/);
  });

  it('maps weather fields and tolerates an empty response', async () => {
    const ok = async () =>
      jsonResponse({ current: { temperature_2m: 20, relative_humidity_2m: 40, wind_speed_10m: 5 } });
    const empty = async () => jsonResponse({});
    const place = { latitude: 1, longitude: 2 };
    assert.deepEqual(await fetchWeather(place, { fetchImpl: ok, timeoutMs: 500 }), {
      temperatureC: 20,
      humidityPct: 40,
      windKmh: 5,
    });
    assert.equal(await fetchWeather(place, { fetchImpl: empty, timeoutMs: 500 }), null);
  });
});

describe('fetchBatchAqi', () => {
  it('maps readings by position and drops cities without a valid value', async () => {
    const cities = [
      { name: 'A', latitude: 1, longitude: 2 },
      { name: 'B', latitude: 3, longitude: 4 },
      { name: 'C', latitude: 5, longitude: 6 },
    ];
    const fetchImpl = async () =>
      jsonResponse([{ current: { us_aqi: 40.4 } }, { current: {} }, { current: { us_aqi: 160 } }]);
    const result = await fetchBatchAqi(cities, { fetchImpl, timeoutMs: 500 });
    assert.deepEqual(
      result.map((c) => [c.name, c.aqi, c.level]),
      [
        ['A', 40, 'good'],
        ['C', 160, 'unhealthy'],
      ],
    );
  });

  it('accepts a single-object response', async () => {
    const fetchImpl = async () => jsonResponse({ current: { us_aqi: 10 } });
    assert.equal(
      (await fetchBatchAqi([{ name: 'A', latitude: 1, longitude: 2 }], { fetchImpl, timeoutMs: 500 })).length,
      1,
    );
  });
});

describe('buildComparison', () => {
  const location = { name: 'Delhi', country: 'India', countryCode: 'IN', latitude: 28.6, longitude: 77.2 };
  const air = { aqi: 100, level: 'moderate' };
  const world = [
    { name: 'Delhi', country: 'India', code: 'IN', latitude: 28.61, longitude: 77.21, aqi: 90, level: 'moderate' },
    { name: 'Mumbai', country: 'India', code: 'IN', latitude: 19.08, longitude: 72.88, aqi: 50, level: 'good' },
    {
      name: 'London',
      country: 'United Kingdom',
      code: 'GB',
      latitude: 51.5,
      longitude: -0.1,
      aqi: 150,
      level: 'sensitive',
    },
  ];

  it('returns null without world data', () => {
    assert.equal(buildComparison({ location, air }, null), null);
    assert.equal(buildComparison({ location, air }, []), null);
  });

  it('replaces the matching city, ranks most polluted first, and averages the country', () => {
    const result = buildComparison({ location, air }, world);
    assert.deepEqual(
      result.cities.map((c) => c.name),
      ['London', 'Delhi', 'Mumbai'],
    );
    assert.equal(result.cities[1].aqi, 100, 'user reading wins over the world batch value');
    assert.equal(result.rank, 2);
    assert.equal(result.countryAverage, 75);
    assert.equal(result.countryCityCount, 2);
  });

  it('omits the country average when no other major city shares the country', () => {
    const result = buildComparison(
      { location: { ...location, name: 'Leh', countryCode: 'XX', latitude: 34, longitude: 77 }, air },
      world,
    );
    assert.equal(result.countryAverage, null);
    assert.equal(result.total, 4);
  });
});

describe('createSourceMonitor', () => {
  it('re-checks a degraded status after 30 s, but keeps a healthy one for the full TTL', async () => {
    let clock = 0;
    let weatherFails = true;
    let probes = 0;
    const fetchImpl = async (url) => {
      probes += 1;
      return String(url).includes('api.open-meteo.com/v1/forecast') && weatherFails
        ? jsonResponse({}, 503)
        : jsonResponse({});
    };
    const monitor = createSourceMonitor({ timeoutMs: 500, fetchImpl, clock: () => clock, now: () => clock });

    const first = await monitor.getStatus();
    assert.equal(first.sources.filter((s) => !s.ok).length, 1, 'only the weather probe failed');
    assert.equal(probes, 4);

    clock = 10_000;
    await monitor.getStatus();
    assert.equal(probes, 4, 'cached within 30 s');

    weatherFails = false;
    clock = 31_000;
    const recovered = await monitor.getStatus();
    assert.equal(probes, 8, 're-probed after 30 s');
    assert.ok(recovered.sources.every((s) => s.ok));

    clock = 200_000;
    await monitor.getStatus();
    assert.equal(probes, 8, 'a fully healthy status is cached for the whole 5 minutes');
  });
});
