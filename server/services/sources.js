import { AIR_QUALITY_URL, GEOCODING_URL, SPARQL_URL, WEATHER_URL } from '../data/endpoints.js';
import { createAsyncCache } from './cache.js';
import { fetchJson } from './http.js';

const STATUS_TTL_MS = 5 * 60_000;
/** A status with failures is re-checked sooner, so a brief blip isn't shown for the full TTL. */
const RECHECK_AFTER_FAILURE_MS = 30_000;
const PROBE_TIMEOUT_MS = 5_000;

const query = (base, params) => `${base}?${new URLSearchParams(params)}`;

/** The free, key-less public data sources AirWise depends on, each with a tiny health probe. */
const SOURCES = Object.freeze([
  {
    id: 'air',
    name: 'Open-Meteo Air Quality',
    provides: 'AQI and pollutants',
    homepage: 'https://open-meteo.com/en/docs/air-quality-api',
    probe: () => query(AIR_QUALITY_URL, { latitude: '28.61', longitude: '77.21', current: 'us_aqi' }),
  },
  {
    id: 'weather',
    name: 'Open-Meteo Weather',
    provides: 'Temperature, humidity, wind',
    homepage: 'https://open-meteo.com/en/docs',
    probe: () => query(WEATHER_URL, { latitude: '28.61', longitude: '77.21', current: 'temperature_2m' }),
  },
  {
    id: 'geocoding',
    name: 'Open-Meteo Geocoding',
    provides: 'City search',
    homepage: 'https://open-meteo.com/en/docs/geocoding-api',
    probe: () => query(GEOCODING_URL, { name: 'Delhi', count: '1', format: 'json' }),
  },
  {
    id: 'density',
    name: 'Wikidata',
    provides: 'Population and density',
    homepage: 'https://www.wikidata.org/',
    probe: () => query(SPARQL_URL, { query: 'ASK {}', format: 'json' }),
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'AirWise/1.0' },
  },
]);

/**
 * Checks the free data sources with tiny requests. Results are cached for five minutes, so the
 * header status costs at most four small upstream calls per five minutes however many users visit.
 */
export const createSourceMonitor = ({ timeoutMs, fetchImpl, clock = Date.now, now }) => {
  const cache = createAsyncCache({ ttlMs: STATUS_TTL_MS, maxEntries: 1, now });
  const options = { fetchImpl, timeoutMs: Math.min(timeoutMs, PROBE_TIMEOUT_MS) };

  const check = async ({ probe, headers, ...source }) => {
    const started = clock();
    try {
      await fetchJson(probe(), { ...options, headers });
      return { ...source, ok: true, latencyMs: clock() - started };
    } catch {
      return { ...source, ok: false, latencyMs: null };
    }
  };

  let degradedSince = null;

  return {
    getStatus: async () => {
      if (degradedSince !== null && clock() - degradedSince >= RECHECK_AFTER_FAILURE_MS) {
        cache.delete('status');
        degradedSince = null;
      }
      const status = await cache.get('status', async () => ({
        checkedAt: new Date(clock()).toISOString(),
        sources: await Promise.all(SOURCES.map(check)),
      }));
      if (degradedSince === null && status.sources.some((source) => !source.ok)) degradedSince = clock();
      return status;
    },
  };
};
