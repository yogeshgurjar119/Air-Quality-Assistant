import { setAqiColor, svg } from './dom.js';
import { gaugeFraction } from './format.js';

const ARC_RADIUS = 80;
const ARC_LENGTH = Math.PI * ARC_RADIUS;
const ARC_PATH = `M 20 100 A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 180 100`;
const COUNT_UP_MS = 900;

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

const dashFor = (fraction) => `${(ARC_LENGTH * fraction).toFixed(1)} ${ARC_LENGTH.toFixed(1)}`;

/** A semicircular US AQI gauge with an accessible text alternative. */
export const renderGauge = (air) => {
  const gauge = svg(
    'svg',
    { viewBox: '0 0 200 120', class: 'gauge', role: 'img', 'aria-label': `US AQI ${air.aqi}, ${air.label}` },
    [
      arc('track'),
      arc('fill', { 'stroke-dasharray': dashFor(gaugeFraction(air.aqi)) }),
      label('num', 92, String(air.aqi)),
      label('cap', 112, 'US AQI'),
    ],
  );
  setAqiColor(gauge, air.level);
  return gauge;
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts the number up from zero with an ease-out curve. */
const countUp = (node, target) => {
  const started = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - started) / COUNT_UP_MS, 1);
    node.textContent = String(Math.round(target * (1 - (1 - progress) ** 3)));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/** Sweeps the gauge arc open and counts the AQI up (skipped for reduced-motion users). */
export const animateGauge = (gauge, aqi) => {
  if (!gauge || prefersReducedMotion()) return;
  const fill = gauge.querySelector('.fill');
  const finalDash = fill.getAttribute('stroke-dasharray');
  fill.style.setProperty('stroke-dasharray', `0 ${ARC_LENGTH.toFixed(1)}`);
  // Two frames: the browser must paint the collapsed arc once before the CSS transition can run.
  requestAnimationFrame(() => requestAnimationFrame(() => fill.style.setProperty('stroke-dasharray', finalDash)));
  countUp(gauge.querySelector('.num'), aqi);
};
