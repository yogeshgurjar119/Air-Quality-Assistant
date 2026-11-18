/** US EPA AQI bands: https://www.airnow.gov/aqi/aqi-basics/ */
const BANDS = Object.freeze([
  { max: 50, level: 'good', label: 'Good' },
  { max: 100, level: 'moderate', label: 'Moderate' },
  { max: 150, level: 'sensitive', label: 'Unhealthy for sensitive groups' },
  { max: 200, level: 'unhealthy', label: 'Unhealthy' },
  { max: 300, level: 'very_unhealthy', label: 'Very unhealthy' },
  { max: Infinity, level: 'hazardous', label: 'Hazardous' },
]);

/** Maps a numeric US AQI to its health band. Returns null for missing/invalid input. */
export const categorizeAqi = (aqi) => {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi) || aqi < 0) return null;
  const { level, label } = BANDS.find((band) => aqi <= band.max);
  return { level, label };
};

/** Severity rank used for comparisons (0 = good … 5 = hazardous). */
export const severity = (level) => BANDS.findIndex((band) => band.level === level);
