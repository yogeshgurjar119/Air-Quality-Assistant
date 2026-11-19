import { el, setAqiColor } from './dom.js';
import {
  barHeight,
  barWidth,
  densityTier,
  formatHour,
  formatNumber,
  formatPopulation,
  rankSentence,
  summarizeForecast,
  whoNote,
} from './format.js';
import { animateGauge, renderGauge } from './gauge.js';

const section = (labelledBy, children) =>
  el('section', { className: 'card', attrs: { 'aria-labelledby': labelledBy } }, children);

// ── Readings ────────────────────────────────────────────────────────────────────────────────
const tile = (name, value, unit, note) =>
  el('li', { className: 'tile' }, [
    el('span', { className: 'k', text: name }),
    el('span', { className: 'v', text: String(value) }, unit ? [el('span', { className: 'u', text: unit })] : []),
    note ? el('span', { className: note.startsWith('Within') ? 'who ok' : 'who high', text: note }) : null,
  ]);

/** Pollutant and weather readings; weather tiles are omitted when that data is unavailable. */
const readingsOf = ({ air, weather }) =>
  [
    ['PM2.5', air.pm25, 'µg/m³', 'pm25'],
    ['PM10', air.pm10, 'µg/m³', 'pm10'],
    ['Nitrogen dioxide', air.no2, 'µg/m³', 'no2'],
    ['Ozone', air.ozone, 'µg/m³'],
    ['Temperature', weather?.temperatureC, '°C'],
    ['Humidity', weather?.humidityPct, '%'],
    ['Wind', weather?.windKmh, 'km/h'],
  ].filter(([, value]) => value !== null && value !== undefined);

const renderTiles = (data) => {
  const list = el('ul', { className: 'tiles', attrs: { 'aria-label': 'Pollutant and weather readings' } });
  readingsOf(data).forEach(([name, value, unit, guidelineKey], index) => {
    const item = tile(name, value, unit, guidelineKey ? whoNote(guidelineKey, value) : null);
    item.style.setProperty('--i', index);
    list.append(item);
  });
  return list;
};

// ── World comparison ────────────────────────────────────────────────────────────────────────
const comparisonRow = (city) => {
  const bar = el('span', { className: 'compare-fill' });
  bar.style.setProperty('--w', barWidth(city.aqi));
  setAqiColor(bar, city.level);
  const row = el('li', { className: city.isYou ? 'compare-row you' : 'compare-row' }, [
    el('span', { className: 'compare-name', text: city.isYou ? `${city.name} (you)` : city.name }),
    el('span', { className: 'compare-country', text: city.country ?? '' }),
    el('span', { className: 'compare-track', attrs: { 'aria-hidden': 'true' } }, [bar]),
    el('span', { className: 'compare-aqi', text: String(city.aqi) }),
  ]);
  if (city.isYou) row.setAttribute('aria-current', 'true');
  return row;
};

const countryAverageLine = ({ countryAverage, countryCityCount, country }) =>
  countryAverage === null
    ? null
    : el('p', {
        className: 'hint',
        text: `Average AQI across ${countryCityCount} major cities in ${country}: ${countryAverage}`,
      });

const renderComparison = ({ comparison, location }) => {
  if (!comparison) return null;
  const list = el(
    'ol',
    {
      className: 'compare-list',
      attrs: { tabindex: '0', 'aria-label': 'Cities ranked by current AQI, most polluted first' },
    },
    comparison.cities.map(comparisonRow),
  );
  return section('compare-title', [
    el('h3', { text: `${location.name} vs the world`, attrs: { id: 'compare-title' } }),
    el('p', { className: 'forecast-summary', text: rankSentence(comparison) }),
    countryAverageLine(comparison),
    list,
  ]);
};

// ── 24-hour outlook ─────────────────────────────────────────────────────────────────────────
const forecastBar = (hour, index, best) => {
  const bar = el('div', { className: hour.time === best?.time ? 'bar best' : 'bar' });
  bar.style.setProperty('--h', barHeight(hour.aqi));
  bar.style.setProperty('--i', index);
  setAqiColor(bar, hour.level);
  return bar;
};

const forecastAxis = ({ hours }) =>
  hours.length === 0
    ? null
    : el('div', { className: 'forecast-axis', attrs: { 'aria-hidden': 'true' } }, [
        el('span', { text: formatHour(hours[0].time) }),
        el('span', { text: formatHour(hours.at(-1).time) }),
      ]);

const renderForecast = ({ forecast }) => {
  const bars = el(
    'div',
    { className: 'forecast-bars', attrs: { role: 'img', 'aria-label': summarizeForecast(forecast) } },
    forecast.hours.map((hour, index) => forecastBar(hour, index, forecast.best)),
  );
  return section('forecast-title', [
    el('h3', { text: 'Next 24 hours', attrs: { id: 'forecast-title' } }),
    el('p', { className: 'forecast-summary', text: summarizeForecast(forecast) }),
    bars,
    forecastAxis(forecast),
  ]);
};

// ── Population ──────────────────────────────────────────────────────────────────────────────
const stat = (value, caption) =>
  el('div', {}, [el('div', { className: 'big', text: value }), el('div', { className: 'hint', text: caption })]);

const renderDensity = ({ air, density, location }) => {
  if (!density) return null;
  const stats = [stat(formatPopulation(density.population), `residents breathing ${air.label.toLowerCase()} air`)];
  if (density.perKm2) {
    const caption = `${densityTier(density.perKm2)} — more people share the same air`;
    stats.push(stat(`${formatNumber(density.perKm2)}/km²`, caption));
  }
  return section('density-title', [
    el('h3', { text: `People in ${location.name}`, attrs: { id: 'density-title' } }),
    el('div', { className: 'density' }, stats),
  ]);
};

// ── Dashboard ───────────────────────────────────────────────────────────────────────────────
const renderHero = ({ location, air }) => {
  const place = [location.name, location.region, location.country].filter(Boolean).join(', ');
  const level = el('span', { className: 'air-level', text: air.label });
  setAqiColor(level, air.level);
  return el('section', { className: 'card air-hero', attrs: { 'aria-labelledby': 'air-title' } }, [
    renderGauge(air),
    el('div', {}, [
      el('h2', { className: 'air-title', text: place, attrs: { id: 'air-title' } }),
      level,
      el('p', { className: 'air-meta', text: `Live reading · updated ${formatHour(air.observedAt ?? '')} local time` }),
    ]),
  ]);
};

/** Renders the live air dashboard: gauge, readings, 24 h outlook, population and world comparison. */
export const renderAir = (container, data) => {
  const sections = [
    renderHero(data),
    renderTiles(data),
    renderForecast(data.air),
    renderDensity(data),
    renderComparison(data),
  ];
  container.replaceChildren(...sections.filter(Boolean));
  animateGauge(container.querySelector('.gauge'), data.air.aqi);
};
