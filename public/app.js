import { startAirFx } from './airfx.js';
import { fetchAir, fetchHealth, fetchPlan } from './api.js';
import { createChat } from './chat.js';
import { startSourceStatus } from './header.js';
import { renderAir, renderPlan, renderPlanError, renderPlanLoading } from './render.js';
import { createResultsView } from './results.js';
import { createWizard } from './wizard.js';

/** Composition root: wires the modules to the page. Behaviour lives in the modules, not here. */
const $ = (id) => document.getElementById(id);

const chat = createChat({
  panel: $('chat-panel'),
  launcher: $('chat-launcher'),
  openers: [...document.querySelectorAll('[data-open-chat]')],
  closeButton: $('chat-close'),
  cityInput: $('chat-city'),
  log: $('chat-log'),
  chips: $('chat-chips'),
  form: $('chat-form'),
  input: $('chat-input'),
  send: $('chat-send'),
  note: $('chat-note'),
});

const fx = startAirFx($('airfx'));

const wizard = createWizard({
  root: $('wizard-view'),
  onCity: chat.suggestCity,
  onComplete: (profile) => results.generate(profile),
});

const results = createResultsView({
  elements: {
    wizardView: $('wizard-view'),
    resultsView: $('results-view'),
    status: $('status'),
    dashboard: $('dashboard'),
    plan: $('plan'),
  },
  api: { fetchAir, fetchPlan },
  render: { renderAir, renderPlan, renderPlanError, renderPlanLoading },
  onAir: (air) => fx.setLevel(air.air.level),
  onBusyChange: wizard.setBusy,
});

$('edit').addEventListener('click', () => {
  results.close();
  wizard.reset();
});

startSourceStatus({ summary: $('sources-summary'), list: $('sources-list') });
fetchHealth()
  .then(({ ai }) => chat.setAiOnline(ai))
  .catch(() => chat.setAiOnline(false));
