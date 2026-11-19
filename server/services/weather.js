import { WEATHER_URL } from '../data/endpoints.js';
import { fetchJson } from './http.js';

/** Current weather that affects how pollution behaves (calm, humid air traps pollutants). */
export const fetchWeather = async ({ latitude, longitude }, options) => {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
    timezone: 'auto',
  });
  const current = (await fetchJson(`${WEATHER_URL}?${params}`, options))?.current;
  if (!current) return null;
  return {
    temperatureC: current.temperature_2m ?? null,
    humidityPct: current.relative_humidity_2m ?? null,
    windKmh: current.wind_speed_10m ?? null,
  };
};
