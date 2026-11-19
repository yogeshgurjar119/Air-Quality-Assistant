import { HTTP } from '../constants.js';
import { AIR_QUALITY_URL, GEOCODING_URL } from '../data/endpoints.js';
import { HttpError } from '../errors.js';
import { categorizeAqi } from './aqi.js';
import { fetchJson } from './http.js';

const CURRENT_FIELDS = ['us_aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone'];
const FORECAST_HOURS = 24;
/** ISO timestamps look like 2025-01-31T14:00: the first 13 chars identify the hour. */
const ISO_HOUR_END = 13;
const DECIMALS_FACTOR = 10;

const round = (value) => (typeof value === 'number' ? Math.round(value * DECIMALS_FACTOR) / DECIMALS_FACTOR : null);

/** Maps a geocoding result to the place fields the app uses (missing optional fields become null). */
const toPlace = (match) => ({
  geonamesId: match.id ?? null,
  name: match.name,
  region: match.admin1 ?? null,
  country: match.country ?? null,
  countryCode: match.country_code ?? null,
  latitude: match.latitude,
  longitude: match.longitude,
  population: typeof match.population === 'number' ? match.population : null,
});

/** Resolves a free-text city to a place using Open-Meteo geocoding (free, no API key). */
export const geocodeCity = async (city, options) => {
  const url = `${GEOCODING_URL}?${new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' })}`;
  const match = (await fetchJson(url, options))?.results?.[0];
  if (!match) {
    throw new HttpError(HTTP.NOT_FOUND, `We couldn't find "${city}". Try a nearby larger city.`);
  }
  return toPlace(match);
};

/**
 * Builds the next-24-hour AQI outlook starting at the current hour, plus the cleanest hour.
 * Exported for unit testing.
 */
export const buildForecast = (hourly, currentTime) => {
  const times = hourly?.time ?? [];
  const values = hourly?.us_aqi ?? [];
  const currentHour = typeof currentTime === 'string' ? currentTime.slice(0, ISO_HOUR_END) : '';
  const start = Math.max(
    0,
    times.findIndex((t) => t.slice(0, ISO_HOUR_END) >= currentHour),
  );

  const hours = times
    .slice(start, start + FORECAST_HOURS)
    .map((time, i) => ({ time, aqi: values[start + i] }))
    .filter(({ aqi }) => typeof aqi === 'number')
    .map(({ time, aqi }) => ({ time, aqi: Math.round(aqi), level: categorizeAqi(aqi).level }));

  const best = hours.reduce((min, hour) => (min === null || hour.aqi < min.aqi ? hour : min), null);
  return { hours, best };
};

/**
 * Current US AQI for many cities in ONE request (Open-Meteo accepts comma-separated coordinates).
 * Cities without a valid reading are dropped rather than failing the whole batch.
 */
export const fetchBatchAqi = async (cities, options) => {
  const params = new URLSearchParams({
    latitude: cities.map((city) => city.latitude).join(','),
    longitude: cities.map((city) => city.longitude).join(','),
    current: 'us_aqi',
    timezone: 'auto',
  });
  const data = await fetchJson(`${AIR_QUALITY_URL}?${params}`, options);
  const results = Array.isArray(data) ? data : [data];
  return cities.flatMap((city, index) => {
    const category = categorizeAqi(results[index]?.current?.us_aqi);
    return category ? [{ ...city, aqi: Math.round(results[index].current.us_aqi), level: category.level }] : [];
  });
};

/** Fetches current pollutant levels, the US AQI and a 24-hour AQI outlook for a coordinate pair. */
export const fetchAirQuality = async ({ latitude, longitude }, options) => {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: CURRENT_FIELDS.join(','),
    hourly: 'us_aqi',
    forecast_days: '2',
    timezone: 'auto',
  });
  const data = await fetchJson(`${AIR_QUALITY_URL}?${params}`, options);
  const current = data?.current;
  const category = categorizeAqi(current?.us_aqi);
  if (!category) {
    throw new HttpError(HTTP.BAD_GATEWAY, 'Air-quality data is unavailable for this location right now.');
  }
  return {
    aqi: Math.round(current.us_aqi),
    ...category,
    pm25: round(current.pm2_5),
    pm10: round(current.pm10),
    no2: round(current.nitrogen_dioxide),
    ozone: round(current.ozone),
    observedAt: current.time ?? null,
    forecast: buildForecast(data.hourly, current.time),
  };
};
