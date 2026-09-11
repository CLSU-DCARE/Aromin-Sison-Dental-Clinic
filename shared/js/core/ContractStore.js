/**
 * ContractStore – the single source of truth for braces contracts.
 *
 * Before this, the Admin dashboard's braces-contract table, the Dentist
 * dashboard's patient list, and the Patient dashboard's "My Contract" /
 * "Braces Progress" views each had their OWN hardcoded copy of the same
 * numbers. Editing a contract on Admin never touched what the patient saw,
 * a dentist had no way to update treatment progress at all, and an
 * approved payment never changed anyone's balance. This store fixes that:
 * everyone reads and writes the same persisted records.
 *
 *   Receptionist (Admin) creates/edits a contract  ──┐
 *   Receptionist approves a payment ─────────────────┼──> ContractStore (localStorage)
 *   Dentist updates treatment progress ──────────────┘         │
 *                                                               v
 *                                            Patient's Contract + Braces
 *                                            Progress views read the same record
 *
 * Persisted under localStorage key 'asdc.contracts'. Falls back to the
 * bundled AdminMock/PatientMock sample data (already in the codebase) to
 * seed the store the very first time it's used, so nothing looks empty on
 * a fresh browser — after that, the store is the live copy.
 */
window.ContractStore = (() => {
  const KEY = 'asdc.contracts';

  const peso = n => '₱' + Number(n || 0).toLocaleString('en-US');
  const parsePeso = v => Number(String(v || 0).replace(/[₱,]/g, '')) || 0;

  function _read() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : null;
      return Array.isArray(list) ? list : null;
    } catch (e) { return null; }
  }

  function _write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
  }

  /** Seeds the store the first time it's used. Self-contained (doesn't
   *  depend on AdminMock being loaded — the Patient dashboard doesn't load
   *  admin's mock-data file, so seeding can't rely on reading it there),
   *  but mirrors the same sample values AdminMock.braces has always shown,
   *  so Admin's table looks unchanged on first run either way. */
  function _seed() {
    const seeded = [
      {
        id: '#B-221', pid: '#P-1057', name: 'Juan Reyes', initials: 'JR',
        dentist: 'Dr. Kathrine Sison',
        months: 24, monthly: 2000, plan: '24-month · ₱2,000/mo',
        total: 48000, paid: 22000, balance: 26000, monthsPaid: 15,
        status: 'Current', tag: 'amber',
        payments: [
          { date: 'Aug 1, 2026', amount: 2000, method: 'Over the counter', or: 'OR-20260801-045' },
          { date: 'Jul 1, 2026', amount: 2000, method: 'Over the counter', or: 'OR-20260701-038' },
          { date: 'Jun 1, 2026', amount: 2000, method: 'Online (QR)', or: 'OR-20260601-031' }
        ],
        progress: {
          pct: 62,
          monthLabel: 'Month 15 of 24',
          heading: 'Your treatment is progressing well',
          description: 'You are in month 15 of a 24-month treatment plan. Keep up with your monthly adjustments!',
          next: 'Next adjustment: Aug 18, 2026 at 9:00 AM',
          stages: [
            { kind: 'done', name: 'Consultation & Records', date: 'Mar 3, 2024' },
            { kind: 'done', name: 'Braces Placement', date: 'Mar 10, 2024' },
            { kind: 'active', num: '3', name: 'Adjustment Phase', date: 'Ongoing · Monthly' },
            { kind: 'upcoming', num: '4', name: 'Retainer Fitting', date: 'Expected Feb 2027' }
          ]
        }
      },
      {
        id: '#B-187', pid: '#P-1044', name: 'Alyssa Ramos', initials: 'AR',
        dentist: 'Dr. Kathrine Sison',
        months: 18, monthly: 3000, plan: '18-month · ₱3,000/mo',
        total: 54000, paid: 12000, balance: 42000, monthsPaid: 4,
        status: 'Overdue', tag: 'red',
        payments: [
          { date: 'Jun 1, 2026', amount: 3000, method: 'Over the counter', or: 'OR-20260601-022' }
        ],
        progress: {
          pct: 22,
          monthLabel: 'Month 4 of 18',
          heading: 'Treatment in progress',
          description: 'Your dentist will update your treatment stage and progress here after each visit.',
          next: 'Your dentist will confirm your next adjustment date at your next visit.',
          stages: [
            { kind: 'done', name: 'Consultation & Records', date: 'On file' },
            { kind: 'active', num: '2', name: 'Braces Placement', date: 'Ongoing' },
            { kind: 'upcoming', num: '3', name: 'Adjustment Phase', date: 'Upcoming' },
            { kind: 'upcoming', num: '4', name: 'Retainer Fitting', date: 'Upcoming' }
          ]
        }
      },
      {
        id: '#B-154', pid: null, name: 'Bea Cruz', initials: 'BC',
        dentist: 'Dr. Kathrine Sison',
        months: 20, monthly: 2500, plan: '20-month · ₱2,500/mo',
        total: 50000, paid: 50000, balance: 0, monthsPaid: 20,
        status: 'Completed', tag: 'green',
        payments: [],
        progress: {
          pct: 100,
          monthLabel: 'Month 20 of 20',
          heading: 'Treatment complete',
          description: 'This treatment plan has been completed.',
          next: 'No further adjustments scheduled.',
          stages: [
            { kind: 'done', name: 'Consultation & Records', date: 'Complete' },
            { kind: 'done', name: 'Braces Placement', date: 'Complete' },
            { kind: 'done', name: 'Adjustment Phase', date: 'Complete' },
            { kind: 'done', name: 'Retainer Fitting', date: 'Complete' }
          ]
        }
      }
    ];
    _write(seeded);
    return seeded;
  }

  function all() {
    return _read() || _seed();
  }

  function byId(id) {
    return all().find(c => c.id === id) || null;
  }

  function byPid(pid) {
    if (!pid) return null;
    return all().find(c => c.pid === pid) || null;
  }

  /** Create (no id) or update (matching id) a contract record. Returns the
   *  saved record (with its id filled in if it was newly created). */
  function upsert(record) {
    const list = all();
    if (record.id) {
      const i = list.findIndex(c => c.id === record.id);
      if (i >= 0) { list[i] = Object.assign({}, list[i], record); _write(list); return list[i]; }
    }
    const newRecord = Object.assign({ id: '#B-' + (150 + list.length) }, record);
    list.unshift(newRecord);
    _write(list);
    return newRecord;
  }

  /** Applies an approved/received payment to the matching patient's
   *  contract: adds to paid, subtracts from balance, logs it in payment
   *  history, and clears an "Overdue" status back to "Current". Also keeps
   *  AdminMock.patients' own balance/status column in sync, since that
   *  table shows the same number independently. Returns the updated
   *  contract, or null if this patient has no contract on file. */
  function recordPayment(pid, { amount, method, or, date }) {
    const list = all();
    const i = list.findIndex(c => c.pid === pid);
    if (i < 0) return null;
    const c = list[i];
    c.paid = (c.paid || 0) + Number(amount || 0);
    c.balance = Math.max(0, (c.balance || 0) - Number(amount || 0));
    // Incremented rather than recomputed from paid/monthly: the seeded
    // sample data's "months paid" narrative doesn't always divide evenly
    // (e.g. some months may have been paid before this system existed),
    // so recomputing from the ratio could make the number jump backwards
    // the first time a real payment is approved. Incrementing avoids that.
    c.monthsPaid = Math.min(c.months || 0, (c.monthsPaid || 0) + 1);
    c.payments = c.payments || [];
    c.payments.unshift({ date, amount: Number(amount || 0), method, or });
    if (c.balance <= 0) { c.status = 'Completed'; c.tag = 'green'; }
    else if (c.status === 'Overdue') { c.status = 'Current'; c.tag = 'amber'; }
    list[i] = c;
    _write(list);

    // Keep the Patients table's balance/status column consistent with the
    // contract it's derived from, instead of two numbers drifting apart.
    try {
      if (typeof AdminMock !== 'undefined' && Array.isArray(AdminMock.patients)) {
        const p = AdminMock.patients.find(p => p.id === pid);
        if (p) { p.balance = peso(c.balance); p.status = c.status; p.tag = c.tag; }
      }
    } catch (e) { /* AdminMock not loaded on this page — fine */ }

    return c;
  }

  /** Dentist-side update: treatment stage/percentage/notes. Everything is
   *  optional — only the fields passed in are changed. */
  function updateProgress(pid, patch) {
    const list = all();
    const i = list.findIndex(c => c.pid === pid);
    if (i < 0) return null;
    const c = list[i];
    c.progress = Object.assign({}, c.progress, patch);
    list[i] = c;
    _write(list);
    return c;
  }

  return { all, byId, byPid, upsert, recordPayment, updateProgress, peso, parsePeso };
})();
