import { el } from './dom.js';

const SECTIONS = [
  { key: 'routines', title: 'Low-emission daily routine' },
  { key: 'indoor', title: 'Indoor air hacks' },
  { key: 'alternatives', title: 'Sustainable alternatives' },
];

const SOURCE_LABELS = {
  ai: 'Personalised by AI',
  rules: 'Rule-based guidance (AI unavailable)',
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

const renderColumn = ({ key, title }, plan) =>
  el('section', { className: 'plan-col', attrs: { 'aria-label': title } }, [
    el('h3', { text: title }),
    el('ul', { className: 'plan-list' }, plan[key].map(renderItem)),
  ]);

/** Shows placeholder lines while the AI plan is generated. */
export const renderPlanLoading = (container) => {
  container.replaceChildren(
    el('section', { className: 'card skeleton', attrs: { 'aria-label': 'Loading your plan' } }, [
      el('p', { className: 'hint', text: 'Preparing your personalised plan…' }),
      el('div', { className: 'line' }),
      el('div', { className: 'line short' }),
      el('div', { className: 'line' }),
    ]),
  );
};

/** Shows an accessible error message in place of the plan. */
export const renderPlanError = (container, message) =>
  container.replaceChildren(el('div', { className: 'status error', text: message, attrs: { role: 'alert' } }));

/** Renders the summary and the three plan sections. */
export const renderPlan = (container, { plan, source }) => {
  const columns = SECTIONS.map((section) => el('div', { className: 'card' }, [renderColumn(section, plan)]));
  container.replaceChildren(
    el('section', { className: 'card' }, [
      el('h2', { text: "Today's plan" }),
      el('p', { className: 'summary', text: plan.summary }),
      el('p', { className: 'plan-source', text: SOURCE_LABELS[source] ?? SOURCE_LABELS.rules }),
    ]),
    el('div', { className: 'plan-grid' }, columns),
  );
};
