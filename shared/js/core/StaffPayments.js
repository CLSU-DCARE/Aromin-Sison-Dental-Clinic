/* Shared collection form for receptionist and dentist dashboards. */
(function () {
  'use strict';
  const section = document.getElementById('view-payments');
  if (!section) return;
  const panel = document.createElement('div');
  panel.className = 'panel staff-payment-entry';
  panel.innerHTML = `
    <h3>Record patient payment</h3>
    <p>Choose an existing treatment bill or braces contract. Payments are recorded immediately and reduce the balance.</p>
    <form id="staffPaymentForm">
      <div class="staff-payment-grid">
        <label class="staff-payment-account">Patient / billing account
          <select name="account_id" required aria-describedby="staffPaymentBalance"><option value="">Loading billing accounts...</option></select>
        </label>
        <label>Amount (PHP)<input name="amount" type="number" min="0.01" max="99999999.99" step="0.01" required inputmode="decimal"></label>
        <label>Payment method<select name="payment_method" required>
          <option value="cash">Cash</option><option value="card">Card</option><option value="gcash">GCash</option>
          <option value="bank_transfer">Bank transfer</option><option value="other">Other</option>
        </select></label>
        <label>Payment date<input name="payment_date" type="date" required></label>
        <label class="staff-payment-account">Notes / transaction reference (optional)<input name="note" maxlength="255" placeholder="Reference number or collection notes"></label>
      </div>
      <p id="staffPaymentBalance">Select a billing account to see the balance.</p>
      <div class="staff-payment-actions"><button class="btn btn-primary" type="submit" disabled>Record payment</button>
        <button class="btn btn-outline" type="button" id="staffPaymentRefresh">Refresh accounts</button></div>
      <p id="staffPaymentStatus" role="status" aria-live="polite"></p>
    </form>`;
  section.querySelector('.page-head').after(panel);
  const form = panel.querySelector('form');
  const account = form.elements.account_id;
  const amount = form.elements.amount;
  const date = form.elements.payment_date;
  const submit = form.querySelector('[type="submit"]');
  const refresh = document.getElementById('staffPaymentRefresh');
  const status = document.getElementById('staffPaymentStatus');
  const balance = document.getElementById('staffPaymentBalance');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  date.value = today;
  date.max = today;
  let accounts = [];
  let saving = false;
  const peso = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
  function updateBalance() {
    const bill = accounts.find(item => item.id === account.value);
    submit.disabled = saving || !bill || Number(bill.available_amount) <= 0;
    amount.max = bill ? bill.available_amount : '99999999.99';
    balance.textContent = bill
      ? `Total: ${peso(bill.total_amount)} · Balance: ${peso(bill.balance_amount)} · Pending: ${peso(bill.pending_amount)} · Available for payment: ${peso(bill.available_amount)}`
      : 'Select a billing account to see the balance.';
  }
  async function loadAccounts() {
    const selected = account.value;
    refresh.disabled = true;
    submit.disabled = true;
    account.disabled = true;
    try {
      const data = await apiFetch('../backend/api/payments/payments.php?view=accounts', { cache: 'no-store' });
      accounts = data.accounts || [];
      account.replaceChildren(new Option(accounts.length ? 'Select patient and billing account' : 'No outstanding billing accounts', ''));
      accounts.forEach(bill => account.add(new Option(`${bill.patient} (#P-${bill.patient_id}) · ${bill.service} [${bill.id}] · ${peso(bill.balance_amount)}`, bill.id)));
      if (accounts.some(bill => bill.id === selected)) account.value = selected;
      account.disabled = false;
      updateBalance();
    } catch (error) {
      accounts = [];
      account.replaceChildren(new Option('Unable to load accounts. Use Refresh accounts.', ''));
      status.textContent = error.message;
    } finally {
      refresh.disabled = false;
    }
  }
  account.addEventListener('change', updateBalance);
  refresh.addEventListener('click', () => { status.textContent = ''; loadAccounts(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    saving = true;
    submit.disabled = true;
    refresh.disabled = true;
    status.textContent = 'Recording payment...';
    // Disable edits while preserving the values used for this collection.
    const body = Object.fromEntries(new FormData(form));
    const fields = [...form.querySelectorAll('input, select')];
    fields.forEach(field => { field.disabled = true; });
    try {
      const data = await apiFetch('../backend/api/payments/payments.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, action: 'record' })
      });
      amount.value = '';
      form.elements.note.value = '';
      status.textContent = `Payment recorded. Reference: ${data.payment.orNumber}. Remaining balance: ${peso(data.payment.balance_amount)}.`;
      window.dispatchEvent(new CustomEvent('staff-payment-recorded'));
      if (window.staffLiveSync) window.staffLiveSync.refetch().catch(() => {});
    } catch (error) {
      status.textContent = error.message + ' Check payment history before retrying if the connection was interrupted.';
    } finally {
      saving = false;
      fields.forEach(field => { field.disabled = false; });
      await loadAccounts();
    }
  });
  // Load only when the billing view is opened; refresh when returning to it.
  const observer = new MutationObserver(() => {
    if (section.classList.contains('active') && !saving) loadAccounts();
  });
  observer.observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) loadAccounts();
})();
