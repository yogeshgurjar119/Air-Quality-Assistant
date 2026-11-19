import { el } from './dom.js';
import { LAST_STEP, STEPS, clampStep, summarizeProfile, validateStep } from './wizard-model.js';

export const POPULAR_CITIES = ['Delhi', 'Mumbai', 'Lahore', 'Beijing', 'London', 'Los Angeles'];

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

/**
 * Drives the step-by-step questionnaire inside `root`: step navigation, per-step validation,
 * the stepper and review summary, and the popular-city shortcuts.
 *
 * @param {object} options
 * @param {HTMLElement} options.root Container holding the stepper and the form.
 * @param {(profile: object) => void} options.onComplete Called with the profile when the last step is submitted.
 * @param {(city: string) => void} [options.onCity] Called whenever the user commits to a city.
 */
export const createWizard = ({ root, onComplete, onCity = () => {} }) => {
  const $ = (selector) => root.querySelector(selector);
  const form = $('#plan-form');
  const cityInput = $('#city');
  const cityError = $('#city-error');
  const heading = $('#wizard-heading');
  const stepper = $('#stepper');
  const backButton = $('#back');
  const nextButton = $('#next');
  const review = $('#review');
  let currentStep = 0;

  const showCityError = (message) => {
    cityError.textContent = message ?? '';
    cityError.hidden = !message;
    cityInput.setAttribute('aria-invalid', String(Boolean(message)));
  };

  const stepState = (index) => {
    if (index < currentStep) return 'done';
    return index === currentStep ? 'current' : '';
  };

  const renderStepper = () => {
    stepper.replaceChildren(
      ...STEPS.map((step, index) => {
        const item = el('li', { text: step.label, className: stepState(index) });
        if (index === currentStep) item.setAttribute('aria-current', 'step');
        return item;
      }),
    );
  };

  const renderReview = () => {
    review.replaceChildren(
      ...summarizeProfile(readProfile(form)).map(([label, value]) =>
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = readProfile(form);
    const problem = validateStep(currentStep, profile);
    if (problem) {
      showCityError(problem);
      cityInput.focus();
      return;
    }
    showCityError(null);
    onCity(profile.city);
    if (currentStep < LAST_STEP) goToStep(currentStep + 1);
    else onComplete(profile);
  });

  backButton.addEventListener('click', () => goToStep(currentStep - 1));

  POPULAR_CITIES.forEach((city) => {
    const button = el('button', { className: 'chip', text: city, attrs: { type: 'button' } });
    button.addEventListener('click', () => {
      cityInput.value = city;
      onCity(city);
      showCityError(null);
      goToStep(1);
    });
    $('#city-chips').append(el('li', {}, [button]));
  });

  goToStep(0, { focus: false });

  return {
    goToStep,
    /** Returns to the first step, keeping the answers already entered. */
    reset: () => goToStep(0),
    /** Disables the submit button while a plan is being generated. */
    setBusy: (busy) => {
      nextButton.disabled = busy;
    },
    get step() {
      return currentStep;
    },
  };
};
