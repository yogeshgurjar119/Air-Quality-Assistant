import { el, setAqiColor, svg } from './dom.js';
import {
  barHeight,
  barWidth,
  densityTier,
  formatHour,
  formatNumber,
  formatPopulation,
  gaugeFraction,
  rankSentence,
  summarizeForecast,
  whoNote,
} from './format.js';

const SECTIONS = [
  { key: 'routines', title: 'Low-emission daily routine' },
  { key: 'indoor', title: 'Indoor air hacks' },
  { key: 'alternatives', title: 'Sustainable alternatives' },
];

const ARC_RADIUS = 80;
const ARC_LENGTH = Math.PI * ARC_RADIUS;
const ARC_PATH = `M 20 100 A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 180 100`;

const renderGauge = (air) => {
  const arc = (className, extra = {}) =>
    svg('path', {
      d: ARC_PATH,
      fill: 'none',
      'stroke-width': 14,
      'stroke-linecap': 'round',
      class: className,
      ...extra,
    });
  const label = (className, y, text) => {
    const node = svg('text', { x: 100, y, class: className });
    node.textContent = text;
    return node;
  };
  const gauge = svg(
    'svg',
    { viewBox: '0 0 200 120', class: 'gauge', role: 'img', 'aria-label': `US AQI ${air.aqi}, ${air.label}` },
    [
      arc('track'),
      arc('fill', {
        'stroke-dasharray': `${(ARC_LENGTH * gaugeFraction(air.aqi)).toFixed(1)} ${ARC_LENGTH.toFixed(1)}`,
      }),
      label('num', 92, String(air.aqi)),
      label('cap', 112, 'US AQI'),
    ],
  );
  setAqiColor(gauge, air.level);
  return gauge;
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Sweeps the gauge arc open and counts the AQI up from zero (skipped for reduced-motion users). */
const animateGauge = (gauge, aqi) => {
  if (!gauge || prefersReducedMotion()) return;
  const fill = gauge.querySelector('.fill');
  const number = gauge.querySelector('.num');
  const finalDash = fill.getAttribute('stroke-dasharray');
  fill.style.setProperty('stroke-dasharray', `0 ${ARC_LENGTH.toFixed(1)}`);
  requestAnimationFrame(() => requestAnimationFrame(() => fill.style.setProperty('stroke-dasharray', finalDash)));

  const started = performance.now();
  const duration = 900;
  const tick = (now) => {
    const progress = Math.min((now - started) / duration, 1);
    number.textContent = String(Math.round(aqi * (1 - (1 - progress) ** 3)));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const tile = (name, value, unit, note) =>
  el('li', { className: 'tile' }, [
    el('span', { className: 'k', text: name }),
    el('span', { className: 'v', text: String(value) }, unit ? [el('span', { className: 'u', text: unit })] : []),
    note ? el('span', { className: note.startsWith('Within') ? 'who ok' : 'who high', text: note }) : null,
  ]);

const renderTiles = ({ air, weather }) => {
  const items = [
    ['PM2.5', air.pm25, 'µg/m³', 'pm25'],
    ['PM10', air.pm10, 'µg/m³', 'pm10'],
    ['Nitrogen dioxide', air.no2, 'µg/m³', 'no2'],
    ['Ozone', air.ozone, 'µg/m³'],
    ['Temperature', weather?.temperatureC, '°C'],
    ['Humidity', weather?.humidityPct, '%'],
    ['Wind', weather?.windKmh, 'km/h'],
  ].filter(([, value]) => value !== null && value !== undefined);
  const list = el('ul', { className: 'tiles', attrs: { 'aria-label': 'Pollutant and weather readings' } });
  items.forEach(([name, value, unit, key], index) => {
    const item = tile(name, value, unit, key ? whoNote(key, value) : null);
    item.style.setProperty('--i', index);
    list.append(item);
  });
  return list;
};

const renderComparison = ({ comparison, location }) => {
  if (!comparison) return null;
  const list = el('ol', {
    className: 'compare-list',
    attrs: { tabindex: '0', 'aria-label': 'Cities ranked by current AQI, most polluted first' },
  });
  comparison.cities.forEach((city) => {
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
    list.append(row);
  });

  const countryLine =
    comparison.countryAverage === null
      ? null
      : el('p', {
          className: 'hint',
          text: `Average AQI across ${comparison.countryCityCount} major cities in ${comparison.country}: ${comparison.countryAverage}`,
        });
  return el('section', { className: 'card', attrs: { 'aria-labelledby': 'compare-title' } }, [
    el('h3', { text: `${location.name} vs the world`, attrs: { id: 'compare-title' } }),
    el('p', { className: 'forecast-summary', text: rankSentence(comparison) }),
    countryLine,
    list,
  ]);
};

const renderForecast = ({ forecast }) => {
  const bars = el('div', {
    className: 'forecast-bars',
    attrs: { role: 'img', 'aria-label': summarizeForecast(forecast) },
  });
  forecast.hours.forEach((hour, index) => {
    const bar = el('div', { className: hour.time === forecast.best?.time ? 'bar best' : 'bar' });
    bar.style.setProperty('--h', barHeight(hour.aqi));
    bar.style.setProperty('--i', index);
    setAqiColor(bar, hour.level);
    bars.append(bar);
  });
  const first = forecast.hours[0];
  const last = forecast.hours.at(-1);
  return el('section', { className: 'card', attrs: { 'aria-labelledby': 'forecast-title' } }, [
    el('h3', { text: 'Next 24 hours', attrs: { id: 'forecast-title' } }),
    el('p', { className: 'forecast-summary', text: summarizeForecast(forecast) }),
    bars,
    first && last
      ? el('div', { className: 'forecast-axis', attrs: { 'aria-hidden': 'true' } }, [
          el('span', { text: formatHour(first.time) }),
          el('span', { text: formatHour(last.time) }),
        ])
      : null,
  ]);
};

const renderDensity = ({ air, density, location }) => {
  if (!density) return null;
  const stat = (value, caption) =>
    el('div', {}, [el('div', { className: 'big', text: value }), el('div', { className: 'hint', text: caption })]);
  const stats = [stat(formatPopulation(density.population), `residents breathing ${air.label.toLowerCase()} air`)];
  if (density.perKm2) {
    stats.push(
      stat(`${formatNumber(density.perKm2)}/km²`, `${densityTier(density.perKm2)} — more people share the same air`),
    );
  }
  return el('section', { className: 'card', attrs: { 'aria-labelledby': 'density-title' } }, [
    el('h3', { text: `People in ${location.name}`, attrs: { id: 'density-title' } }),
    el('div', { className: 'density' }, stats),
  ]);
};

/** Renders the live air dashboard: gauge, readings, 24 h outlook and population density. */
export const renderAir = (container, data) => {
  const { location, air } = data;
  const place = [location.name, location.region, location.country].filter(Boolean).join(', ');
  const level = el('span', { className: 'air-level', text: air.label });
  setAqiColor(level, air.level);

  const hero = el('section', { className: 'card air-hero', attrs: { 'aria-labelledby': 'air-title' } }, [
    renderGauge(air),
    el('div', {}, [
      el('h2', { className: 'air-title', text: place, attrs: { id: 'air-title' } }),
      level,
      el('p', { className: 'air-meta', text: `Live reading · updated ${formatHour(air.observedAt ?? '')} local time` }),
    ]),
  ]);
  container.replaceChildren(
    ...[hero, renderTiles(data), renderForecast(air), renderDensity(data), renderComparison(data)].filter(Boolean),
  );
  animateGauge(container.querySelector('.gauge'), air.aqi);
};

const renderItem = (item) =>
  el('li', { className: 'plan-item' }, [
    el('h4', { text: item.title }),
    el('p', { text: item.action }),
    el('p', { className: 'impact' }, [
      el('strong', { text: 'Why it matters: ' }),
      document.createTextNode(item.impact),
    ]),
  ]);

/** Shows placeholder lines while the AI plan is generated. */
export const renderPlanLoading = (container) => {
  const lines = [
    el('div', { className: 'line' }),
    el('div', { className: 'line short' }),
    el('div', { className: 'line' }),
  ];
  container.replaceChildren(
    el('section', { className: 'card skeleton', attrs: { 'aria-label': 'Loading your plan' } }, [
      el('p', { className: 'hint', text: 'Preparing your personalised plan…' }),
      ...lines,
    ]),
  );
};

export const renderPlanError = (container, message) =>
  container.replaceChildren(el('div', { className: 'status error', text: message, attrs: { role: 'alert' } }));

/** Renders the summary and the three plan sections. */
export const renderPlan = (container, { plan, source }) => {
  const columns = SECTIONS.map(({ key, title }) => {
    const list = el('ul', { className: 'plan-list' });
    plan[key].forEach((item) => list.append(renderItem(item)));
    return el('section', { className: 'plan-col', attrs: { 'aria-label': title } }, [el('h3', { text: title }), list]);
  });
  const sourceText = source === 'ai' ? 'Personalised by AI' : 'Rule-based guidance (AI unavailable)';
  container.replaceChildren(
    el('section', { className: 'card' }, [
      el('h2', { text: "Today's plan" }),
      el('p', { className: 'summary', text: plan.summary }),
      el('p', { className: 'source', text: sourceText }),
    ]),
    el(
      'div',
      { className: 'plan-grid' },
      columns.map((col) => el('div', { className: 'card' }, [col])),
    ),
  );
};
