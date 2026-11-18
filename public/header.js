import { fetchSources } from './api.js';
import { el } from './dom.js';
import { summarizeSources } from './format.js';

const REFRESH_MS = 5 * 60_000;

const chip = (source) =>
  el('li', {}, [
    el('a', { className: source.ok ? 'source live' : 'source down', attrs: { href: source.homepage, target: '_blank', rel: 'noopener noreferrer' } }, [
      el('span', { className: 'dot', attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'source-name', text: source.name }),
      el('span', { className: 'source-state', text: source.ok ? `Live · ${source.latencyMs} ms` : 'Unavailable' }),
      el('span', { className: 'visually-hidden', text: `${source.provides}. Opens in a new tab.` }),
    ]),
  ]);

/**
 * Shows which free public data sources are currently reachable. The summary pill is always visible;
 * the per-source list reveals on wider screens. Refreshes every five minutes while the tab is visible.
 */
export const startSourceStatus = ({ summary, list }) => {
  const render = ({ sources }) => {
    const { label, state } = summarizeSources(sources);
    summary.textContent = label;
    summary.dataset.state = state;
    list.replaceChildren(...sources.map(chip));
  };
  const refresh = () =>
    fetchSources()
      .then(render)
      .catch(() => {
        summary.textContent = 'Data status unavailable';
        summary.dataset.state = 'down';
      });

  refresh();
  setInterval(() => {
    if (!document.hidden) refresh();
  }, REFRESH_MS);
};
