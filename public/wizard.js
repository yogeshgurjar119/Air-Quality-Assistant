import { el } from './dom.js';
import { LAST_STEP, STEPS, clampStep, summarizeProfile, validateStep } from './wizard-model.js';

/** Quick-pick cities shown under the city field. */
export const POPULAR_CITIES = ['Delhi', 'Mumbai', 'Lahore', 'Beijing', 'London', 'Los Angeles'];
const noop = () => {};

/** Reads the questionnaire form into the profile object the API expects. */
export const readProfile = (form) => {
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

const stepState = (index, currentStep) => {
  if (index < currentStep) return 'done';
  return index === currentStep ? 'current' : '';
};

const renderStepper = (stepper, currentStep) => {
  stepper.replaceChildren(
    ...STEPS.map((step, index) => {
      const item = el('li', { text: step.label, className: stepState(index, currentStep) });
      if (index === currentStep) item.setAttribute('aria-current', 'step');
      return item;
    }),
  );
};

const renderReview = (review, profile) => {
  review.replaceChildren(
    ...summarizeProfile(profile).map(([label, value]) =>
      el('div', {}, [el('dt', { text: label }), el('dd', { text: value })]),
    ),
  );
};

/** The questionnaire's DOM elements, looked up once. */
const findWizardElements = (root) => {
  const $ = (selector) => root.querySelector(selector);
  return {
    form: $('#plan-form'),
    heading: $('#wizard-heading'),
    stepper: $('#stepper'),
    review: $('#review'),
    backButton: $('#back'),
    nextButton: $('#next'),
    cityInput: $('#city'),
    cityError: $('#city-error'),
    cityChips: $('#city-chips'),
  };
};

/** Shows one step: its panel, heading, buttons, stepper and (on the last step) the review summary. */
const showStep = ({ form, heading, backButton, nextButton, stepper, review }, step) => {
  form.querySelectorAll('.step').forEach((panel) => {
    panel.hidden = Number(panel.dataset.step) !== step;
  });
  heading.textContent = STEPS[step].title;
  backButton.hidden = step === 0;
  nextButton.textContent = step === LAST_STEP ? 'Show my plan' : 'Next';
  if (step === LAST_STEP) renderReview(review, readProfile(form));
  renderStepper(stepper, step);
};

/** The city input with its accessible error message. */
const createCityField = (input, errorMessage) => ({
  input,
  showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  },
  clearError() {
    errorMessage.textContent = '';
    errorMessage.hidden = true;
    input.setAttribute('aria-invalid', 'false');
  },
});

const addPopularCities = (list, onPick) => {
  POPULAR_CITIES.forEach((city) => {
    const button = el('button', { className: 'chip', text: city, attrs: { type: 'button' } });
    button.addEventListener('click', () => onPick(city));
    list.append(el('li', {}, [button]));
  });
};

/**
 * Drives the step-by-step questionnaire inside `root`: step navigation, per-step validation,
 * the stepper and review summary, and the popular-city shortcuts.
 *
 * @param {object} options
 * @param {HTMLElement} options.root Container holding the stepper and the form.
 * @param {(profile: object) => void} options.onComplete Called with the profile when the last step is submitted.
 * @param {(city: string) => void} [options.onCity] Called whenever the user commits to a city.
 */
export const createWizard = ({ root, onComplete, onCity = noop }) => {
  const ui = findWizardElements(root);
  const city = createCityField(ui.cityInput, ui.cityError);
  let currentStep = 0;

  const goToStep = (index, { focus = true } = {}) => {
    currentStep = clampStep(index);
    showStep(ui, currentStep);
    if (focus) ui.heading.focus();
  };

  const submitStep = (event) => {
    event.preventDefault();
    const profile = readProfile(ui.form);
    const problem = validateStep(currentStep, profile);
    if (problem) return city.showError(problem);
    city.clearError();
    onCity(profile.city);
    return currentStep < LAST_STEP ? goToStep(currentStep + 1) : onComplete(profile);
  };

  ui.form.addEventListener('submit', submitStep);
  ui.backButton.addEventListener('click', () => goToStep(currentStep - 1));
  addPopularCities(ui.cityChips, (name) => {
    city.input.value = name;
    onCity(name);
    city.clearError();
    goToStep(1);
  });
  goToStep(0, { focus: false });

  return {
    goToStep,
    /** Returns to the first step, keeping the answers already entered. */
    reset: () => goToStep(0),
    /** Disables the submit button while a plan is being generated. */
    setBusy: (busy) => {
      ui.nextButton.disabled = busy;
    },
    get step() {
      return currentStep;
    },
  };
};
