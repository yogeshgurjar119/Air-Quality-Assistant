import { MINUTE_MS } from '../constants.js';
import { MAJOR_CITIES } from '../data/majorCities.js';
import { fetchAirQuality, fetchBatchAqi, geocodeCity } from './airQuality.js';
import { createAsyncCache } from './cache.js';
import { buildComparison } from './comparison.js';
import { fetchDensity } from './density.js';
import { fetchWeather } from './weather.js';

const CONTEXT_TTL_MS = 10 * MINUTE_MS;
const WORLD_TTL_MINUTES = 30;
const WORLD_TTL_MS = WORLD_TTL_MINUTES * MINUTE_MS;

/** Runs an optional enrichment; its failure must never break the core air-quality response. */
const optional = async (work, logger) => {
  try {
    return await work();
  } catch (error) {
    logger.warn(`Optional data source failed: ${error.message}`);
    return null;
  }
};

const resolveDensity = (location, fetched) =>
  fetched ?? (location.population ? { population: location.population, areaKm2: null, perKm2: null } : null);

/**
 * Gathers everything we know about a city (location, air, weather, density, world comparison)
 * with parallel upstream calls and short caches, so repeat views and the AI planner share one fetch.
 * The world ranking is fetched once for ALL users and cached longer.
 */
export const createContextService = ({ timeoutMs, fetchImpl, logger = console, now }) => {
  const cache = createAsyncCache({ ttlMs: CONTEXT_TTL_MS, now });
  const worldCache = createAsyncCache({ ttlMs: WORLD_TTL_MS, maxEntries: 1, now });
  const options = { timeoutMs, fetchImpl };

  const load = async (city) => {
    const location = await geocodeCity(city, options);
    const [air, weather, density, world] = await Promise.all([
      fetchAirQuality(location, options),
      optional(() => fetchWeather(location, options), logger),
      optional(() => fetchDensity(location.geonamesId, options), logger),
      optional(() => worldCache.get('world', () => fetchBatchAqi(MAJOR_CITIES, options)), logger),
    ]);
    return {
      location,
      air,
      weather,
      density: resolveDensity(location, density),
      comparison: buildComparison({ location, air }, world),
    };
  };

  return { getContext: (city) => cache.get(city.toLowerCase(), () => load(city)) };
};
