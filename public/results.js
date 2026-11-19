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
export const createResultsView = ({ elements, api, render, onAir = () => {}, onBusyChange = () => {} }) => {
  const { wizardView, resultsView, status, dashboard, plan } = elements;
  const doc = resultsView.ownerDocument;
  let latestRequest = 0;

  const setBusy = (busy) => {
    resultsView.setAttribute('aria-busy', String(busy));
    onBusyChange(busy);
  };

  const showStatus = (message, { isError = false } = {}) => {
    status.textContent = message;
    status.className = isError ? 'status error' : 'status';
    status.hidden = false;
  };

  const showResults = (visible) => {
    wizardView.hidden = visible;
    resultsView.hidden = !visible;
    doc.body.classList.toggle('is-results', visible);
    doc.defaultView.scrollTo({ top: 0 });
  };

  /** Generates the dashboard and plan for a validated profile. */
  const generate = async (profile) => {
    latestRequest += 1;
    const requestId = latestRequest;
    const isCurrent = () => requestId === latestRequest;

    setBusy(true);
    showResults(true);
    dashboard.hidden = true;
    plan.hidden = true;
    showStatus('Checking live air quality…');

    // Start the slower AI plan right away; the air data renders first, the plan fills in after it.
    const planRequest = api.fetchPlan(profile);
    planRequest.catch(() => {}); // handled below; avoids an unhandled rejection if the air request fails first

    try {
      const air = await api.fetchAir(profile.city);
      if (!isCurrent()) return;
      render.renderAir(dashboard, air);
      dashboard.hidden = false;
      status.hidden = true;
      onAir(air);

      render.renderPlanLoading(plan);
      plan.hidden = false;
      try {
        const result = await planRequest;
        if (isCurrent()) render.renderPlan(plan, result);
      } catch (error) {
        if (isCurrent()) render.renderPlanError(plan, error.message);
      }
    } catch (error) {
      if (isCurrent()) showStatus(error.message, { isError: true });
    } finally {
      if (isCurrent()) setBusy(false);
    }
  };

  /** Leaves the results screen and discards any in-flight response. */
  const close = () => {
    latestRequest += 1;
    setBusy(false);
    showResults(false);
  };

  return { generate, close };
};
