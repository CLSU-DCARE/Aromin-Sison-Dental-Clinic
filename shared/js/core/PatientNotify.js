/**
 * PatientNotify – tiny persisted notification inbox, keyed per patient.
 *
 * Lets Admin/Dentist actions (approving a payment, updating braces
 * progress) show up as a real notification on the Patient dashboard,
 * instead of the patient only finding out by noticing a number changed.
 * Stored under localStorage key 'asdc.notifications.<pid>'.
 */
window.PatientNotify = (() => {
  const keyFor = pid => 'asdc.notifications.' + pid;

  function all(pid) {
    try {
      const raw = localStorage.getItem(keyFor(pid));
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  /** Adds a notification for this patient. `kind` matches the icon set the
   *  Patient dashboard already uses ('appt' | 'pay' | 'contract'). */
  function push(pid, { kind, title, desc }) {
    if (!pid) return;
    try {
      const list = all(pid);
      list.unshift({
        id: 'n-' + Date.now(),
        kind, title, desc,
        time: 'Just now',
        unread: true
      });
      localStorage.setItem(keyFor(pid), JSON.stringify(list.slice(0, 30)));
    } catch (e) { /* storage unavailable — notification just won't persist */ }
  }

  return { all, push };
})();
