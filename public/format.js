/** Pure formatting helpers (no DOM) so they can be unit-tested in Node. */

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const grouped = new Intl.NumberFormat('en');

const COMPACT_FROM = 100_000;
const CLOCK_START = 11;
const CLOCK_END = 16;
/** Residents per km² where the density label changes. */
const DENSITY_LIMITS = Object.freeze({ low: 1_500, moderate: 5_000, dense: 15_000 });
/** The gauge scale tops out at this US AQI. */
const GAUGE_MAX_AQI = 300;
const MIN_BAR_PERCENT = 3;

/** Formats a population, abbreviating large values (e.g. 1.4M). */
export const formatPopulation = (value) => (value >= COMPACT_FROM ? compact.format(value) : grouped.format(value));
/** Formats a number with locale digit grouping. */
export const formatNumber = (value) => grouped.format(value);

/** "2026-11-18T14:00" → "14:00" */
export const formatHour = (isoLocal) => String(isoLocal).slice(CLOCK_START, CLOCK_END);

/** Descriptive tier for residents per km². */
export const densityTier = (perKm2) => {
  if (perKm2 < DENSITY_LIMITS.low) return 'Low density';
  if (perKm2 < DENSITY_LIMITS.moderate) return 'Moderate density';
  if (perKm2 < DENSITY_LIMITS.dense) return 'Dense';
  return 'Very dense';
};

/** Share of the gauge arc to fill (0–1); the scale tops out at GAUGE_MAX_AQI. */
export const gaugeFraction = (aqi) => Math.min(Math.max(aqi, 0), GAUGE_MAX_AQI) / GAUGE_MAX_AQI;

/** Bar height as a CSS percentage string, never below a visible minimum. */
export const barHeight = (aqi) => `${Math.max(gaugeFraction(aqi) * 100, MIN_BAR_PERCENT).toFixed(1)}%`;

/** One-sentence accessible summary of the 24 h outlook, naming the cleanest and worst hours. */
export const summarizeForecast = ({ hours, best }) => {
  if (!best || hours.length === 0) return 'No forecast available.';
  const worst = hours.reduce((max, h) => (h.aqi > max.aqi ? h : max), hours[0]);
  return `Cleanest around ${formatHour(best.time)} (AQI ${best.aqi}); worst around ${formatHour(worst.time)} (AQI ${worst.aqi}).`;
};

/** WHO 2021 24-hour air-quality guideline values in µg/m³ (ozone is an 8-hour peak value, so it is omitted). */
export const WHO_24H_GUIDELINE = Object.freeze({ pm25: 15, pm10: 45, no2: 25 });

/** Short comparison against the WHO guideline, e.g. "3.4× WHO limit" or "Within WHO guideline". */
export const whoNote = (pollutant, value) => {
  const limit = WHO_24H_GUIDELINE[pollutant];
  if (!limit || typeof value !== 'number') return null;
  const multiple = value / limit;
  return multiple <= 1 ? 'Within WHO guideline' : `${multiple.toFixed(1)}× WHO limit`;
};

/** Width (0–100%) for a comparison bar on the 0–300 AQI scale, with a visible minimum. */
export const barWidth = (aqi) => `${Math.max(gaugeFraction(aqi) * 100, 2).toFixed(1)}%`;

/** Headline for the world comparison, e.g. "#4 most polluted of 25 major cities". */
export const rankSentence = ({ rank, total }) => {
  if (rank === 1) return `The most polluted of ${total} major cities right now`;
  if (rank === total) return `The cleanest of ${total} major cities right now`;
  return `#${rank} most polluted of ${total} major cities`;
};

const sourceState = (live, total) => {
  if (live === total) return 'ok';
  return live === 0 ? 'down' : 'partial';
};

/** Summarises the data-source health list for the header, e.g. "3 of 4 free data sources live". */
export const summarizeSources = (sources) => {
  const total = sources.length;
  const live = sources.filter((source) => source.ok).length;
  return { live, total, state: sourceState(live, total), label: `${live} of ${total} free data sources live` };
};
