/**
 * PatientContractView - Render contract summary, payment history, and contract download.
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
    document.getElementById('downloadContractBtn')?.addEventListener('click', () => this.downloadContract());
  }

  render (contract) {
    const downloadButton = document.getElementById('downloadContractBtn');
    if (downloadButton) downloadButton.hidden = !contract.active;

    // Summary boxes
    const summary = document.getElementById('contractSummary');
    if (summary) {
      const contractOnly = contract.summary.filter(box => !/amount|balance/i.test(box.l || ''));
      summary.hidden = contractOnly.length === 0;
      summary.innerHTML = contractOnly.map(box =>
        this._summaryBox(box)
      ).join('');
    }
    const billingSummary = document.getElementById('billingSummary');
    if (billingSummary) {
      const billingOnly = contract.summary.filter(box =>
        !/payment term/i.test(box.l || '')
      );
      billingSummary.innerHTML = billingOnly.map(box =>
        this._summaryBox(box)
      ).join('');
    }
    this._syncPaymentAmountHint(contract);

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
      `<tr><td>${escapeHtml(window.formatDate ? window.formatDate(p.date) : p.date)}</td><td>${escapeHtml(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.or)}</td></tr>`
    ).join('');
  }

  async downloadContract () {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) {
      showToast('PDF generator is still loading. Please try again.', 'error');
      return;
    }

    const user     = this.state.user || {};
    const contract = this.state.contract || { summary: [], progress: {}, payments: [] };
    const logo = await this._getLogo();
    const filename = 'braces-contract-' + String(user.pid || 'patient').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.pdf';
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    this._drawContractPdf(pdf, { user, contract, logo });
    pdf.save(filename);
    showToast('PDF contract downloaded.');
  }

  _drawContractPdf (pdf, { user, contract, logo }) {
    const left = 10;
    const right = 287;
    const pageBottom = 196;
    const bodySize = 14;
    let y = 16;
    const genDate = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    const clean = value => String(value ?? '').replace(/â‚±/g, '\u20b1');
    const drawText = (text, x, textY, options = {}) => {
      const normalized = clean(text);
      if (!normalized.includes('\u20b1')) {
        pdf.text(normalized, x, textY, options);
        return;
      }

      let cursorX = x;
      normalized.split('\u20b1').forEach((part, index) => {
        if (index > 0) {
          pdf.text('P', cursorX, textY, options);
          pdf.line(cursorX - 0.2, textY - 2.8, cursorX + 3.2, textY - 2.8);
          pdf.line(cursorX - 0.2, textY - 1.7, cursorX + 3.2, textY - 1.7);
          cursorX += 3.8;
        }
        if (part) {
          pdf.text(part, cursorX, textY, options);
          cursorX += pdf.getTextWidth(part);
        }
      });
    };
    const addWrapped = (text, x, lineY, maxWidth, size = bodySize, style = 'normal') => {
      pdf.setFont('helvetica', style);
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(clean(text), maxWidth);
      pdf.text(lines, x, lineY);
      return lineY + (lines.length * (size * 0.45)) + 2;
    };
    const ensureSpace = amount => {
      if (y + amount <= pageBottom) return;
      pdf.addPage();
      y = 18;
    };

    pdf.setTextColor(27, 27, 25);
    if (logo) pdf.addImage(logo, 'PNG', left, 9, 31, 18);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Braces Contract', logo ? 43 : left, 22);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(95, 95, 88);
    pdf.text('AROMIN-SISON DENTAL CLINIC', right, 17, { align: 'right' });
    pdf.text(('GENERATED ' + genDate).toUpperCase(), right, 23, { align: 'right' });
    pdf.setDrawColor(156, 139, 62);
    pdf.setLineWidth(0.45);
    pdf.line(left, 34, right, 34);
    y = 44;

    pdf.setTextColor(27, 27, 25);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(bodySize);
    pdf.text('Contract Holder:', left, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text(user.name || '', left + 28, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(' - ' + (user.pid || ''), left + 28 + pdf.getTextWidth(user.name || ''), y);

    const summary = contract.summary || [];
    if (summary.length) {
      const cards = summary.slice(0, 5);
      const gap = 3;
      const cardY = 52;
      const cardH = 22;
      const cardW = (right - left - (gap * (cards.length - 1))) / cards.length;
      cards.forEach((box, index) => {
        const x = left + (index * (cardW + gap));
        pdf.setDrawColor(218, 218, 214);
        pdf.setLineWidth(0.25);
        pdf.roundedRect(x, cardY, cardW, cardH, 2, 2);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(bodySize);
        drawText(box.v || '', x + 3, cardY + 10);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(70, 78, 82);
        pdf.text(String(box.l || '').toUpperCase(), x + 3, cardY + 17);
      });
    }

    const progress = contract.progress || {};
    y = 88;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(bodySize);
    pdf.text('Contract Progress', left, y);
    y += 9;
    pdf.setDrawColor(239, 234, 224);
    pdf.setLineWidth(2.8);
    pdf.line(left, y + 2, right, y + 2);
    const pct = Math.max(0, Math.min(100, parseFloat(String(progress.width || '0').replace('%', '')) || 0));
    pdf.setDrawColor(156, 139, 62);
    pdf.line(left, y + 2, left + ((right - left) * pct / 100), y + 2);
    y += 9;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(75, 75, 70);
    drawText(progress.left || '', left, y);
    pdf.text(clean(progress.right || ''), right, y, { align: 'right' });
    y += 17;

    const payments = contract.payments || [];
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(bodySize);
    pdf.text('Payment History', left, y);
    y += 9;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setFillColor(241, 237, 227);
    pdf.rect(left, y - 6, right - left, 10, 'F');
    pdf.setTextColor(60, 68, 72);
    pdf.text('DATE', left + 2, y);
    pdf.text('AMOUNT', 83, y);
    pdf.text('METHOD', 141, y);
    pdf.text('OR NUMBER', 195, y);
    y += 11;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(bodySize);
    pdf.setTextColor(0, 0, 0);
    payments.forEach(payment => {
      ensureSpace(10);
      pdf.text(clean(window.formatDate ? window.formatDate(payment.date) : payment.date), left + 2, y);
      drawText(payment.amount, 83, y);
      pdf.text(clean(payment.method), 141, y);
      pdf.text(clean(payment.or), 195, y);
      pdf.setDrawColor(225, 225, 220);
      pdf.line(left, y + 3, right, y + 3);
      y += 11;
    });
    if (!payments.length) {
      y = addWrapped('No payments recorded yet.', left + 2, y, right - left, bodySize);
    }

    y += 8;
    ensureSpace(18);
    y = addWrapped('This document is a summary of the orthodontic payment contract between the patient and Aromin-Sison Dental Clinic.', left, y, right - left, 8);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(95, 95, 88);
    pdf.setDrawColor(225, 225, 220);
    pdf.line(left, pageBottom - 9, right, pageBottom - 9);
    pdf.text(('Aromin-Sison Dental Clinic - Generated for ' + (user.name || '')).toUpperCase(), left, pageBottom);
  }

  async _contractHtml () {
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
      `<tr><td>${escapeHtml(window.formatDate ? window.formatDate(p.date) : p.date)}</td><td>${escapeHtml(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.or)}</td></tr>`
    ).join('');

    return (
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Braces Contract</title>` +
      `<style>*{box-sizing:border-box;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B1B19;margin:0;padding:32px;}.report-head{display:flex;align-items:center;gap:18px;border-bottom:2px solid #9C8B3E;padding-bottom:14px;margin-bottom:22px;}.report-logo{width:150px;height:auto;object-fit:contain;flex-shrink:0;}.report-head h1{margin:0;font-size:22px;font-weight:600;line-height:1.2;}.report-meta{margin-left:auto;font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.08em;text-align:right;line-height:1.6;}.patient-line{font-size:13px;color:#5c5c55;margin:-6px 0 20px;}.patient-line b{color:#1B1B19;font-weight:600;}.stats{display:flex;gap:14px;margin-bottom:26px;}.stat{flex:1;border:1px solid rgba(27,27,25,.15);border-radius:10px;padding:14px 16px;}.stat-v{font-size:19px;font-weight:600;}.stat-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b6b65;margin-top:3px;}h2{font-size:15px;font-weight:600;margin:26px 0 10px;}table{width:100%;border-collapse:collapse;font-size:13px;}th{background:#F1EDE3;text-align:left;padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.18);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#5c5c55;}td{padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.1);}.bar{height:8px;border-radius:99px;background:#EFEAE0;overflow:hidden;margin-top:8px;}.bar>div{height:100%;border-radius:99px;background:#9C8B3E;}.bar-meta{display:flex;justify-content:space-between;font-size:11px;color:#6b6b65;margin-top:6px;}.terms{font-size:11px;color:#6b6b65;line-height:1.7;margin-top:26px;}.foot{margin-top:28px;padding-top:14px;border-top:1px solid rgba(27,27,25,.12);font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.06em;}@media print{body{padding:0;}}</style>` +
      `</head><body>` +
      `<div class="report-head">${logoHtml}<h1>Braces Contract</h1><div class="report-meta">Aromin-Sison Dental Clinic<br>Generated ${escapeHtml(genDate)}</div></div>` +
      `<div class="patient-line">Contract Holder: <b>${escapeHtml(user.name || '')}</b> - ${escapeHtml(user.pid || '')}</div>` +
      `<div class="stats">${summaryBoxes}</div>` +
      `<h2>Contract Progress</h2><div class="bar"><div style="width:${escapeHtml(progress.width || '0%')};"></div></div><div class="bar-meta"><span>${escapeHtml(progress.left || '')}</span><span>${escapeHtml(progress.right || '')}</span></div>` +
      `<h2>Payment History</h2><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>OR Number</th></tr></thead><tbody>${payments}</tbody></table>` +
      `<div class="terms">This document is a summary of the orthodontic payment contract between the patient and Aromin-Sison Dental Clinic.</div>` +
      `<div class="foot">Aromin-Sison Dental Clinic - Generated for ${escapeHtml(user.name || '')}</div>` +
      `</body></html>`
    );
  }

  _setValue (id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  _summaryBox (box) {
    return `<div class="box"><div class="v">${escapeHtml(box.v)}</div><div class="l">${escapeHtml(box.l)}</div>` +
      (box.s ? `<div class="s">${escapeHtml(box.s)}</div>` : '') +
      `</div>`;
  }

  _syncPaymentAmountHint (contract) {
    const input = document.getElementById('payAmount');
    if (!input || !contract.active) return;
    const raw = Number(contract.nextPaymentAmountRaw || 0);
    if (raw > 0) {
      input.placeholder = `Suggested monthly payment: ${contract.nextPaymentAmount}`;
    } else {
      input.placeholder = 'No remaining balance';
    }
  }

  async _getLogo () {
    return getLogoDataUrl();
  }
};
