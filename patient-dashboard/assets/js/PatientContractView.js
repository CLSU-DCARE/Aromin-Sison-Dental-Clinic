/**
 * PatientContractView – Render contract summary, payment history, and PDF download.
 *
 * Replaces renderContract() and downloadContractPDF() from patient.js.
 *
 * Usage:
 *   const contractView = new PatientContractView({ state: PatientState });
 *   contractView.init();
 *   contractView.render(PatientState.contract);
 */
/* global escapeHtml, showToast, PaymentStore */
window.PatientContractView = class PatientContractView {
  constructor ({ state } = {}) {
    this.state         = state;
    this._logoDataUrl = null;
  }

  init () {
    document.getElementById('downloadContractBtn')?.addEventListener('click', () => this.downloadPDF());
  }

  render (contract) {
    // Summary boxes
    const summary = document.getElementById('contractSummary');
    if (summary) {
      const contractOnly = contract.summary.filter(box => !/amount|balance/i.test(box.l || ''));
      summary.innerHTML = contractOnly.map(box =>
        `<div class="box"><div class="v">${box.v}</div><div class="l">${box.l}</div></div>`
      ).join('');
    }
    const billingSummary = document.getElementById('billingSummary');
    if (billingSummary) {
      billingSummary.innerHTML = contract.summary.map(box =>
        `<div class="box"><div class="v">${box.v}</div><div class="l">${box.l}</div></div>`
      ).join('');
    }

    // Progress bar
    const fill = document.getElementById('contractFill');
    if (fill) fill.style.width = contract.progress.width;
    this._setValue('contractLeft', contract.progress.left);
    this._setValue('contractRight', contract.progress.right);

    // Payment table
    const tbody = document.getElementById('billingPaymentsBody');
    if (!tbody) return;

    const existing = contract.payments
      // Payment History is the settled ledger; anything still pending or
      // rejected already has its own status badge in "My Payment
      // Submissions" above, so don't duplicate it here.
      .filter(p => !p.status || p.status === 'approved')
      .map(p => ({ date: p.date, amount: p.amount, method: p.method, or: p.or }));

    const all = existing;

    tbody.innerHTML = all.map(p =>
      `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.or)}</td></tr>`
    ).join('');
  }

  async downloadPDF () {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Pop-up blocked: allow pop-ups to download the contract.', 'error');
      return;
    }

    const user     = this.state.user || {};
    const contract = this.state.contract || { summary: [], progress: {}, payments: [] };
    const genDate  = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    const logo     = await this._getLogo();

    const logoHtml = logo
      ? `<img class="report-logo" src="${logo}" alt="Aromin-Sison Dental Clinic">`
      : '';

    const summaryBoxes = (contract.summary || []).map(box =>
      `<div class="stat"><div class="stat-v">${escapeHtml(box.v)}</div><div class="stat-l">${escapeHtml(box.l)}</div></div>`
    ).join('');

    const progress = contract.progress || {};
    const payments = (contract.payments || []).map(p =>
      `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.or)}</td></tr>`
    ).join('');

    printWindow.document.write(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Braces Contract</title>` +
      `<style>*{box-sizing:border-box;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B1B19;margin:0;padding:32px;}.report-head{display:flex;align-items:center;gap:18px;border-bottom:2px solid #9C8B3E;padding-bottom:14px;margin-bottom:22px;}.report-logo{width:150px;height:auto;object-fit:contain;flex-shrink:0;}.report-head h1{margin:0;font-size:22px;font-weight:600;line-height:1.2;}.report-meta{margin-left:auto;font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.08em;text-align:right;line-height:1.6;}.patient-line{font-size:13px;color:#5c5c55;margin:-6px 0 20px;}.patient-line b{color:#1B1B19;font-weight:600;}.stats{display:flex;gap:14px;margin-bottom:26px;}.stat{flex:1;border:1px solid rgba(27,27,25,.15);border-radius:10px;padding:14px 16px;}.stat-v{font-size:19px;font-weight:600;}.stat-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b6b65;margin-top:3px;}h2{font-size:15px;font-weight:600;margin:26px 0 10px;}table{width:100%;border-collapse:collapse;font-size:13px;}th{background:#F1EDE3;text-align:left;padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.18);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#5c5c55;}td{padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.1);}.bar{height:8px;border-radius:99px;background:#EFEAE0;overflow:hidden;margin-top:8px;}.bar>div{height:100%;border-radius:99px;background:#9C8B3E;}.bar-meta{display:flex;justify-content:space-between;font-size:11px;color:#6b6b65;margin-top:6px;}.terms{font-size:11px;color:#6b6b65;line-height:1.7;margin-top:26px;}.foot{margin-top:28px;padding-top:14px;border-top:1px solid rgba(27,27,25,.12);font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.06em;}@media print{body{padding:0;}}</style>` +
      `</head><body>` +
      `<div class="report-head">${logoHtml}<h1>Braces Contract</h1><div class="report-meta">Aromin-Sison Dental Clinic<br>Generated ${escapeHtml(genDate)}</div></div>` +
      `<div class="patient-line">Contract Holder: <b>${escapeHtml(user.name || '')}</b> · ${escapeHtml(user.pid || '')}</div>` +
      `<div class="stats">${summaryBoxes}</div>` +
      `<h2>Contract Progress</h2><div class="bar"><div style="width:${escapeHtml(progress.width || '0%')};"></div></div><div class="bar-meta"><span>${escapeHtml(progress.left || '')}</span><span>${escapeHtml(progress.right || '')}</span></div>` +
      `<h2>Payment History</h2><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>OR Number</th></tr></thead><tbody>${payments}</tbody></table>` +
      `<div class="terms">This document is a summary of the orthodontic payment contract between the patient and Aromin-Sison Dental Clinic.</div>` +
      `<div class="foot">Aromin-Sison Dental Clinic · Generated for ${escapeHtml(user.name || '')}</div>` +
      `</body></html>`
    );

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
    showToast('Contract ready — choose "Save as PDF" in the print dialog');
  }

  _setValue (id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async _getLogo () {
    return getLogoDataUrl();
  }
};
