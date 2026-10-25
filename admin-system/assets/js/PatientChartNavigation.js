/* Keep the authenticated dashboard and its patient list alive while reading a chart. */
(function () {
  'use strict';
  const app = document.querySelector('.app');
  if (!app) return;
  let frame = null;
  let trigger = null;
  const originalTitle = document.title;

  function closeChart() {
    if (!frame) return;
    frame.remove();
    frame = null;
    app.inert = false;
    document.body.classList.remove('patient-chart-open');
    document.title = originalTitle;
    trigger?.focus({ preventScroll: true });
    trigger = null;
  }

  function openChart(path) {
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.id = 'patientChartFrame';
    frame.title = 'Patient Chart';
    frame.src = path;
    app.inert = true;
    document.body.classList.add('patient-chart-open');
    document.body.appendChild(frame);
    frame.addEventListener('load', () => frame?.focus());
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a.patient-view-btn');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/\/admin-system\/patient-chart\.html$/.test(url.pathname)) return;
    event.preventDefault();
    trigger = link;
    const path = url.pathname + url.search + url.hash;
    history.pushState({ patientChartPath: path }, '', path);
    openChart(path);
  });

  window.addEventListener('popstate', event => {
    const path = event.state?.patientChartPath;
    if (typeof path === 'string' && /^\/(?:[^?#]*\/)?admin-system\/patient-chart\.html\?patient_id=\d+(?:&archived=1)?(?:#billing)?$/.test(path)) openChart(path);
    else closeChart();
  });

  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if (event.data?.type === 'asdc:patient-billing-updated') {
      window.dispatchEvent(new CustomEvent('staff-payment-recorded'));
      window.staffLiveSync?.refetch().catch(() => {});
      return;
    }
    if (event.data?.type === 'asdc:patient-chart-back') {
      // Restore the existing list immediately, without another dashboard request.
      closeChart();
      history.back();
    }
  });
})();
