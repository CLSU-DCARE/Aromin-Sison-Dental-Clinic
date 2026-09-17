/** Shared staff polling uses the same retry/visibility controller as the patient portal. */
window.ASDC.startPortalSync = function ({ start = () => '', apply }) {
  const label = document.createElement('p');
  label.id = 'portalSyncStatus'; label.className = 'sync-status'; label.setAttribute('role', 'status');
  label.textContent = 'Loading clinic records…'; document.body.appendChild(label);
  const sync = new PatientLiveSync({
    validate: data => data && Array.isArray(data.week?.appointments) && Array.isArray(data.week?.requests) &&
      ['pending','patients','contracts','records','notifications','metrics','payments','inventory','promotions'].every(key => Array.isArray(data[key])) &&
      data.reports && typeof data.reports === 'object',
    fetchSnapshot: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try { return await apiFetch('../backend/api/appointments/dashboard.php' + (start() ? '?start=' + encodeURIComponent(start()) : ''), { cache: 'no-store', signal: controller.signal }); }
      finally { clearTimeout(timer); }
    },
    applySnapshot: apply,
    onStatus: status => {
      label.textContent = { live: 'Updates automatically', reconnecting: 'Showing last update. Reconnecting…', unavailable: 'Unable to load clinic records. Retrying…', 'signed-out': 'Session ended. Please sign in.' }[status];
      if (status === 'signed-out') window.location.replace('../auth/login.html?error=session');
    }
  });
  sync.refetch = async () => { if (sync.pending) await sync.pending; return sync.refresh(); };
  window.addEventListener('asdc:mutation', sync.refetch);
  window.addEventListener('asdc:authenticated', () => sync.start());
  window.addEventListener('pagehide', () => sync.stop());
  window.addEventListener('pageshow', e => { if (e.persisted) sync.start(); });
  if (window.ASDCAuthUser) sync.start();
  return sync;
};
