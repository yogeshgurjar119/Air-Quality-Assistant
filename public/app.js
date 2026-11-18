import { fetchAir, fetchHealth, fetchPlan } from './api.js';
import { startAirFx } from './airfx.js';
import { createChat } from './chat.js';
import { startSourceStatus } from './header.js';
import { el } from './dom.js';
import { renderAir, renderPlan, renderPlanError, renderPlanLoading } from './render.js';
import { LAST_STEP, STEPS, clampStep, summarizeProfile, validateStep } from './wizard-model.js';

const $ = (id) => document.getElementById(id);
const form = $('plan-form');
const cityInput = $('city');
const cityError = $('city-error');
const heading = $('wizard-heading');
const stepper = $('stepper');
const backButton = $('back');
const nextButton = $('next');
const wizardView = $('wizard-view');
const resultsView = $('results-view');
const status = $('status');
const dashboard = $('dashboard');
const plan = $('plan');
const POPULAR_CITIES = ['Delhi', 'Mumbai', 'Lahore', 'Beijing', 'London', 'Los Angeles'];

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

let currentStep = 0;
let latestRequest = 0;

const readProfile = () => {
  const data = new FormData(form);
  return {
    city: String(data.get('city') ?? '').trim(),
    commute: data.get('commute'),
    cooking: data.get('cooking'),
    home: data.get('home'),
    purifier: data.get('purifier'),
    vulnerable: data.getAll('vulnerable'),
  };
};

const showCityError = (message) => {
  cityError.textContent = message ?? '';
  cityError.hidden = !message;
  cityInput.setAttribute('aria-invalid', String(Boolean(message)));
};

const renderStepper = () => {
  stepper.replaceChildren(
    ...STEPS.map((step, index) => {
      const item = el('li', { text: step.label, className: index < currentStep ? 'done' : index === currentStep ? 'current' : '' });
      if (index === currentStep) item.setAttribute('aria-current', 'step');
      return item;
    }),
  );
};

const renderReview = () => {
  $('review').replaceChildren(
    ...summarizeProfile(readProfile()).map(([label, value]) =>
      el('div', {}, [el('dt', { text: label }), el('dd', { text: value })]),
    ),
  );
};

const goToStep = (index, { focus = true } = {}) => {
  currentStep = clampStep(index);
  form.querySelectorAll('.step').forEach((panel) => {
    panel.hidden = Number(panel.dataset.step) !== currentStep;
  });
  heading.textContent = STEPS[currentStep].title;
  backButton.hidden = currentStep === 0;
  nextButton.textContent = currentStep === LAST_STEP ? 'Show my plan' : 'Next';
  if (currentStep === LAST_STEP) renderReview();
  renderStepper();
  if (focus) heading.focus();
};

const setBusy = (busy) => {
  nextButton.disabled = busy;
  resultsView.setAttribute('aria-busy', String(busy));
};

const showStatus = (message, { isError = false } = {}) => {
  status.textContent = message;
  status.className = isError ? 'status error' : 'status';
  status.hidden = false;
};

const showResultsView = (visible) => {
  wizardView.hidden = visible;
  resultsView.hidden = !visible;
  document.body.classList.toggle('is-results', visible);
  window.scrollTo({ top: 0 });
};

const generate = async (profile) => {
  const requestId = ++latestRequest;
  const isCurrent = () => requestId === latestRequest;
  setBusy(true);
  showResultsView(true);
  dashboard.hidden = true;
  plan.hidden = true;
  showStatus('Checking live air quality…');

  // Air data is fast, so it renders first; the slower AI plan fills in after it.
  const planRequest = fetchPlan(profile);
  planRequest.catch(() => {}); // handled below; avoids an unhandled rejection if air fails first

  try {
    const air = await fetchAir(profile.city);
    if (!isCurrent()) return;
    renderAir(dashboard, air);
    fx.setLevel(air.air.level);
    dashboard.hidden = false;
    status.hidden = true;
    chat.suggestCity(profile.city);

    renderPlanLoading(plan);
    plan.hidden = false;
    try {
      const result = await planRequest;
      if (isCurrent()) renderPlan(plan, result);
    } catch (error) {
      if (isCurrent()) renderPlanError(plan, error.message);
    }
  } catch (error) {
    if (isCurrent()) showStatus(error.message, { isError: true });
  } finally {
    if (isCurrent()) setBusy(false);
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const profile = readProfile();
  const problem = validateStep(currentStep, profile);
  if (problem) {
    showCityError(problem);
    cityInput.focus();
    return;
  }
  showCityError(null);
  chat.suggestCity(profile.city);
  if (currentStep < LAST_STEP) goToStep(currentStep + 1);
  else generate(profile);
});

backButton.addEventListener('click', () => goToStep(currentStep - 1));
$('edit').addEventListener('click', () => {
  latestRequest += 1; // ignore any in-flight response
  setBusy(false);
  showResultsView(false);
  goToStep(0);
});

POPULAR_CITIES.forEach((city) => {
  const button = el('button', { className: 'chip', text: city, attrs: { type: 'button' } });
  button.addEventListener('click', () => {
    cityInput.value = city;
    chat.suggestCity(city);
    showCityError(null);
    goToStep(1);
  });
  $('city-chips').append(el('li', {}, [button]));
});

goToStep(0, { focus: false });
startSourceStatus({ summary: $('sources-summary'), list: $('sources-list') });
fetchHealth()
  .then(({ ai }) => chat.setAiOnline(ai))
  .catch(() => chat.setAiOnline(false));
