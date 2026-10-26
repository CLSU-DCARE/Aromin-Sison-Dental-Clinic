/* Patient billing directory and the individual patient's financial history. */
(function () {
  'use strict';
  const section = document.getElementById('view-payments');
  if (!section) return;
  const chart = document.body.classList.contains('patient-chart-page');
  if (chart && (location.hash !== '#billing' || new URLSearchParams(location.search).get('archived') === '1')) return;
  const patientId = chart ? Number(new URLSearchParams(location.search).get('patient_id')) : null;
  if (chart && (!Number.isInteger(patientId) || patientId < 1)) return;
  if (chart) section.dataset.patientId = String(patientId);
  const esc = value => ASDC.HtmlHelpers.escapeHtml(String(value ?? ''));
  const peso = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
  const date = value => value ? ASDC.HtmlHelpers.formatDate(value) : 'Not recorded';
  const status = value => {
    const color = { approved: 'green', paid: 'green', completed: 'green', pending: 'amber', rejected: 'red', cancelled: 'red', active: 'blue' }[value] || 'gray';
    return `<span class="tag tag-${color} billing-status">${esc(value === 'approved' ? 'Recorded' : value)}</span>`;
  };
  let loading = null;
  let patients = [];
  let filter = 'all';
  const message = document.getElementById('patientBillingMessage');
  function renderDirectory() {
    const query = document.getElementById('billingPatientSearch').value.trim().toLowerCase();
    const filtered = patients.filter(item => {
      const match = `${item.patient} #P-${item.patient_id}`.toLowerCase().includes(query);
      return match && (filter === 'all' || (filter === 'balance' && Number(item.balance_amount) > 0) || (filter === 'settled' && Number(item.accounts) > 0 && Number(item.balance_amount) <= 0));
    });
    document.getElementById('patientBillingBody').innerHTML = filtered.map(item => `<tr>
      <td><div class="billing-patient"><span class="billing-avatar" aria-hidden="true">${esc(String(item.patient).trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase())}</span><div><strong>${esc(item.patient)}</strong><small>#P-${Number(item.patient_id)} <span aria-hidden="true">·</span> ${Number(item.accounts || 0)} billing ${Number(item.accounts) === 1 ? 'account' : 'accounts'}</small></div></div></td>
      <td class="billing-money">${peso(item.paid_amount)}</td><td class="billing-money ${Number(item.balance_amount) > 0 ? 'billing-outstanding' : 'billing-muted'}">${peso(item.balance_amount)}</td>
      <td class="billing-row-action"><a class="btn btn-outline btn-sm patient-view-btn" href="/patient-chart?patient_id=${Number(item.patient_id)}#billing">View Billing <span aria-hidden="true">↗</span></a></td>
    </tr>`).join('') || '<tr><td colspan="4" class="billing-empty">No patients found. Try another name or filter.</td></tr>';
    message.textContent = `Showing ${filtered.length} of ${patients.length} patients`;
  }
  function renderPatient(data) {
    const accounts = data.accounts || [];
    const payments = data.payments || [];
    const total = key => accounts.reduce((sum, item) => sum + (key === 'balance_amount' && item.status === 'cancelled' ? 0 : Number(item[key] || 0)), 0);
    document.getElementById('patientBillingTotals').innerHTML = [
      ['Recorded payments', total('paid_amount'), 'green'], ['Outstanding balance', total('balance_amount'), 'gold']
    ].map(([label, value, tone]) => `<div class="billing-stat billing-stat-${tone}"><span class="billing-stat-label">${label}</span><strong>${peso(value)}</strong><small>For this patient</small></div>`).join('');
    document.getElementById('patientBillingAccounts').innerHTML = accounts.map(item => `<tr>
      <td>${esc(item.service)}<br><small>${esc(item.id)}</small></td><td>${peso(item.total_amount)}</td>
      <td>${peso(item.paid_amount)}</td><td>${peso(item.balance_amount)}</td><td>${status(item.status)}</td>
    </tr>`).join('') || '<tr><td colspan="5">No billing accounts for this patient yet.</td></tr>';
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
        if (chart) message.textContent = 'Treatment balances and payment history for this patient.';
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
  document.querySelectorAll('[data-billing-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.billingFilter;
    document.querySelectorAll('[data-billing-filter]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    renderDirectory();
  }));
  window.addEventListener('staff-payment-recorded', () => {
    load();
    if (chart && window.frameElement?.id === 'patientChartFrame') {
      window.parent.postMessage({ type: 'asdc:patient-billing-updated' }, location.origin);
    }
  });
  if (chart) {
    window.ASDC.exportPatientBilling = async () => {
      const data = await apiFetch('../backend/api/payments/payments.php?view=patient&patient_id=' + patientId, { cache: 'no-store' });
      renderPatient(data);
      await window.ASDC.downloadBillingLayoutPDF(data.patient);
    };
    const download = document.getElementById('downloadPatientBilling');
    download?.addEventListener('click', async () => {
      download.disabled = true;
      try { await window.ASDC.exportPatientBilling(); message.textContent = 'Billing PDF downloaded.'; }
      catch (error) { message.textContent = error.message || 'Unable to download billing.'; }
      finally { download.disabled = false; }
    });
    window.addEventListener('asdc:authenticated', load);
    if (window.ASDCAuthUser) load();
  } else {
    const observer = new MutationObserver(() => { if (section.classList.contains('active')) load(); });
    observer.observe(section, { attributes: true, attributeFilter: ['class'] });
    if (section.classList.contains('active') && window.ASDCAuthUser) load();
    window.addEventListener('asdc:authenticated', () => { if (section.classList.contains('active')) load(); });
  }
})();
