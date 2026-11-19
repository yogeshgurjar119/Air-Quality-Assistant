const noop = () => {};

/** The one-line status message above the results (loading, or an error). */
const createStatusLine = (status) => ({
  show(message, { isError = false } = {}) {
    status.textContent = message;
    status.className = isError ? 'status error' : 'status';
    status.hidden = false;
  },
  hide() {
    status.hidden = true;
  },
});

/** Switches between the questionnaire and the results screen. */
const createScreenSwitch =
  ({ wizardView, resultsView }) =>
  (showResults) => {
    const doc = resultsView.ownerDocument;
    wizardView.hidden = showResults;
    resultsView.hidden = !showResults;
    doc.body.classList.toggle('is-results', showResults);
    doc.defaultView.scrollTo({ top: 0 });
  };

/** The two result sections: the live dashboard, and the AI plan that fills in after it. */
const createSections = ({ dashboard, plan, statusLine, render, onAir }) => ({
  hideAll() {
    dashboard.hidden = true;
    plan.hidden = true;
  },
  showAir(air) {
    render.renderAir(dashboard, air);
    dashboard.hidden = false;
    statusLine.hide();
    onAir(air);
  },
  async showPlan(planRequest, isCurrent) {
    render.renderPlanLoading(plan);
    plan.hidden = false;
    try {
      const result = await planRequest;
      if (isCurrent()) render.renderPlan(plan, result);
    } catch (error) {
      if (isCurrent()) render.renderPlanError(plan, error.message);
    }
  },
});

/**
 * Orchestrates the results screen: fetches live air data and the AI plan in parallel, shows the
 * air data first (it is fast) and the plan once it arrives, and ignores responses from stale requests.
 *
 * @param {object} options
 * @param {{wizardView: HTMLElement, resultsView: HTMLElement, status: HTMLElement,
 *          dashboard: HTMLElement, plan: HTMLElement}} options.elements
 * @param {{fetchAir: Function, fetchPlan: Function}} options.api
 * @param {{renderAir: Function, renderPlan: Function, renderPlanError: Function, renderPlanLoading: Function}} options.render
 * @param {(air: object) => void} [options.onAir] Called when live air data has been rendered.
 * @param {(busy: boolean) => void} [options.onBusyChange] Called when generation starts and ends.
 */
export const createResultsView = ({ elements, api, render, onAir = noop, onBusyChange = noop }) => {
  const { resultsView, status, dashboard, plan } = elements;
  const statusLine = createStatusLine(status);
  const showScreen = createScreenSwitch(elements);
  const sections = createSections({ dashboard, plan, statusLine, render, onAir });
  let latestRequest = 0;

  const setBusy = (busy) => {
    resultsView.setAttribute('aria-busy', String(busy));
    onBusyChange(busy);
  };

  /** Generates the dashboard and plan for a validated profile. */
  const generate = async (profile) => {
    latestRequest += 1;
    const requestId = latestRequest;
    const isCurrent = () => requestId === latestRequest;

    setBusy(true);
    showScreen(true);
    sections.hideAll();
    statusLine.show('Checking live air quality…');
    // Start the slower AI plan right away; the air data renders first, the plan fills in after it.
    const planRequest = api.fetchPlan(profile);
    planRequest.catch(noop); // handled in showPlan; avoids an unhandled rejection if the air request fails first

    try {
      const air = await api.fetchAir(profile.city);
      if (!isCurrent()) return;
      sections.showAir(air);
      await sections.showPlan(planRequest, isCurrent);
    } catch (error) {
      if (isCurrent()) statusLine.show(error.message, { isError: true });
    } finally {
      if (isCurrent()) setBusy(false);
    }
  };

  /** Leaves the results screen and discards any in-flight response. */
  const close = () => {
    latestRequest += 1;
    setBusy(false);
    showScreen(false);
  };

  return { generate, close };
};
