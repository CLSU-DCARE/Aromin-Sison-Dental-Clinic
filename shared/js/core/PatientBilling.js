/* Patient billing directory and the individual patient's financial history. */
(function () {
  'use strict';
  const section = document.getElementById('view-payments');
  if (!section) return;
  const chart = document.body.classList.contains('patient-chart-page');
  const patientId = chart ? Number(new URLSearchParams(location.search).get('patient_id')) : null;
  if (chart && (!Number.isInteger(patientId) || patientId < 1)) return;
  if (chart) section.dataset.patientId = String(patientId);
  const esc = value => ASDC.HtmlHelpers.escapeHtml(String(value ?? ''));
  const peso = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
  const date = value => value ? ASDC.HtmlHelpers.formatDate(value) : 'Not recorded';
  const status = value => `<span class="chart-status">${esc(value === 'approved' ? 'Recorded' : value)}</span>`;
  let loading = null;
  let patients = [];
  const message = document.getElementById('patientBillingMessage');
  function renderDirectory() {
    const query = document.getElementById('billingPatientSearch').value.trim().toLowerCase();
    const filtered = patients.filter(item => `${item.patient} #P-${item.patient_id}`.toLowerCase().includes(query));
    document.getElementById('patientBillingBody').innerHTML = filtered.map(item => `<tr>
      <td><strong>${esc(item.patient)}</strong><br><small>#P-${Number(item.patient_id)}</small></td>
      <td>${peso(item.paid_amount)}</td><td>${peso(item.balance_amount)}</td><td>${peso(item.pending_amount)}</td>
      <td><a class="btn btn-outline btn-sm patient-view-btn" href="${chart ? '' : '../admin-system/'}patient-chart.html?patient_id=${Number(item.patient_id)}#billing">View Billing</a></td>
    </tr>`).join('') || '<tr><td colspan="5">No patients match this search.</td></tr>';
  }
  function renderPatient(data) {
    const accounts = data.accounts || [];
    const payments = data.payments || [];
    const total = key => accounts.reduce((sum, item) => sum + (key === 'balance_amount' && item.status === 'cancelled' ? 0 : Number(item[key] || 0)), 0);
    document.getElementById('patientBillingTotals').innerHTML = [
      ['Recorded payments', total('paid_amount')], ['Outstanding balance', total('balance_amount')], ['Pending payments', total('pending_amount')]
    ].map(([label, value]) => `<div class="chart-stat"><span>${peso(value)}</span><small>${label}</small></div>`).join('');
    document.getElementById('patientBillingAccounts').innerHTML = accounts.map(item => `<tr>
      <td>${esc(item.service)}<br><small>${esc(item.id)}</small></td><td>${peso(item.total_amount)}</td>
      <td>${peso(item.paid_amount)}</td><td>${peso(item.balance_amount)}</td><td>${peso(item.pending_amount)}</td><td>${status(item.status)}</td>
    </tr>`).join('') || '<tr><td colspan="6">No billing accounts for this patient yet.</td></tr>';
    document.getElementById('patientPaymentHistory').innerHTML = payments.map(item => `<tr>
      <td>${esc(date(item.paymentDate))}</td><td>${esc(item.service || item.category)}</td><td>${esc(item.amount)}</td>
      <td>${esc(item.method)}</td><td>${status(item.status)}</td><td>${esc(item.orNumber || '—')}${item.note ? `<br><small>${esc(item.note)}</small>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6">No payments have been recorded for this patient.</td></tr>';
    window.patientBilling = data;
  }
  function load() {
    if (loading) return loading;
    const refresh = document.getElementById('refreshPatientBilling');
    if (refresh) refresh.disabled = true;
    message.textContent = 'Loading billing information…';
    loading = (async () => {
      try {
        const url = '../backend/api/payments/payments.php?view=' + (chart ? 'patient&patient_id=' + patientId : 'patients');
        const data = await apiFetch(url, { cache: 'no-store' });
        if (chart) renderPatient(data);
        else { patients = data.patients || []; renderDirectory(); }
        message.textContent = chart ? 'Pending payments have not yet reduced the outstanding balance.' : 'Select a patient to view their accounts, payment history, and outstanding balances.';
        if (chart && location.hash === '#billing') section.scrollIntoView({ block: 'start' });
      } catch (error) {
        message.textContent = error.message || 'Unable to load billing information.';
      } finally {
        loading = null;
        if (refresh) refresh.disabled = false;
      }
    })();
    return loading;
  }
  document.getElementById('refreshPatientBilling')?.addEventListener('click', load);
  document.getElementById('billingPatientSearch')?.addEventListener('input', renderDirectory);
  window.addEventListener('staff-payment-recorded', () => {
    load();
    if (chart && window.frameElement?.id === 'patientChartFrame') {
      window.parent.postMessage({ type: 'asdc:patient-billing-updated' }, location.origin);
    }
  });
  if (chart) {
    window.addEventListener('asdc:authenticated', load);
    if (window.ASDCAuthUser) load();
  } else {
    const observer = new MutationObserver(() => { if (section.classList.contains('active')) load(); });
    observer.observe(section, { attributes: true, attributeFilter: ['class'] });
    if (section.classList.contains('active') && window.ASDCAuthUser) load();
    window.addEventListener('asdc:authenticated', () => { if (section.classList.contains('active')) load(); });
  }
})();
