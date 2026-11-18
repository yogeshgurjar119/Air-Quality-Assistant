/** Minimal DOM builders. Text is always set via textContent, never innerHTML (XSS-safe). */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Creates an element. `attrs` are set as attributes; `text` as textContent. */
export const el = (tag, { className, text, attrs = {} } = {}, children = []) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  node.append(...children);
  return node;
};

export const svg = (tag, attrs = {}, children = []) => {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  node.append(...children);
  return node;
};

/** Sets the AQI colour token used by CSS (`--aqi-color`) for a band level. */
export const setAqiColor = (node, level) => node.style.setProperty('--aqi-color', `var(--aqi-${level})`);
