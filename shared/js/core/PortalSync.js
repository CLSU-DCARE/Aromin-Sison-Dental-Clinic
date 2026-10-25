/** Shared staff polling refreshes clinic records across devices. */
window.ASDC.startPortalSync = function ({ start = () => '', apply }) {
  const label = document.createElement('p');
  label.id = 'portalSyncStatus'; label.className = 'sync-status'; label.setAttribute('role', 'status');
  label.textContent = 'Loading clinic records…'; document.body.appendChild(label);
  const sync = new ClinicLiveSync({
    validate: data => data && Array.isArray(data.week?.appointments) && Array.isArray(data.week?.requests) &&
      ['pending','patients','contracts','records','notifications','metrics','payments','inventory'].every(key => Array.isArray(data[key])) &&
      data.reports && typeof data.reports === 'object' &&
      ['this_week','last_week','this_month'].every(key => data.reports[key] && Array.isArray(data.reports[key].rows) && Array.isArray(data.reports[key].bars)),
    fetchSnapshot: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try { return await apiFetch('../backend/api/appointments/dashboard.php' + (start() ? '?start=' + encodeURIComponent(start()) : ''), { cache: 'no-store', signal: controller.signal, passive: true }); } // passive: background refresh must not keep an idle session alive
      finally { clearTimeout(timer); }
    },
    applySnapshot: (data, updated, changedKeys) => apply(data, changedKeys),
    onStatus: status => {
      label.textContent = { live: 'Updates automatically', reconnecting: 'Showing last update. Reconnecting…', unavailable: 'Unable to load clinic records. Retrying…', 'signed-out': 'Session ended. Please sign in.' }[status];
      if (status === 'signed-out') window.location.replace('../auth/login.html');
    }
  });
  let requestedRefresh = null;
  let refreshing = false;
  let refreshAgain = false;
  sync.refetch = () => {
    if (requestedRefresh) {
      if (refreshing) refreshAgain = true;
      return requestedRefresh;
    }
    // A write during polling needs one fresh snapshot after the old request.
    // Multiple listeners and save handlers share that single follow-up.
    const pending = sync.pending;
    requestedRefresh = Promise.resolve(pending).then(async () => {
      do {
        refreshAgain = false;
        refreshing = true;
        await sync.refresh();
        refreshing = false;
      } while (refreshAgain && sync.running);
    }).finally(() => { requestedRefresh = null; refreshing = false; });
    return requestedRefresh;
  };
  window.addEventListener('asdc:mutation', sync.refetch);
  window.addEventListener('asdc:authenticated', () => sync.start());
  window.addEventListener('pagehide', () => sync.stop());
  window.addEventListener('pageshow', e => { if (e.persisted) sync.start(); });
  if (window.ASDCAuthUser) sync.start();
  return sync;
};
