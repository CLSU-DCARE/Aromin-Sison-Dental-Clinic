/**
 * ReportExporter: Aromin-Sison Dental Clinic System.
 * Client-side A4 PDF download for clinic reports.
 * Loads the clinic logo once and caches it as a data URL.
 */
(function () {
  'use strict';

  let _logoDataUrl = null;

  class ReportExporter {
    static getLogoDataUrl() {
      if (_logoDataUrl !== null) return Promise.resolve(_logoDataUrl);
      return fetch('../shared/images/asdc logo.png')
        .then((r) => {
          if (!r.ok) throw new Error('logo unavailable');
          return r.blob();
        })
        .then(
          (blob) =>
            new Promise((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => {
                _logoDataUrl = fr.result;
                resolve(_logoDataUrl);
              };
              fr.onerror = reject;
              fr.readAsDataURL(blob);
            })
        )
        .catch(() => {
          _logoDataUrl = '';
          return _logoDataUrl;
        });
    }

    static async exportPDF({ title, columns, rows }) {
      const escHtml = window.ASDC.HtmlHelpers.escapeHtml;
      const toast = window.ASDC._toast;

      if (!rows || !rows.length) {
        if (toast) toast.show('Nothing to export in the current view.', 'error');
        return;
      }

      const esc = escHtml;
      const thead = columns.map((c) => `<th>${esc(c.label)}</th>`).join('');
      const tbody = rows
        .map(
          (row) =>
            `<tr>${columns
              .map((c) => `<td>${esc(c.value(row))}</td>`)
              .join('')}</tr>`
        )
        .join('');
      const date = new Date().toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
      });
      const logo = await ReportExporter.getLogoDataUrl();
      const logoHtml = logo
        ? `<img class="report-logo" src="${logo}" alt="Aromin-Sison Dental Clinic">`
        : '';

      const jsPDF = window.jspdf && window.jspdf.jsPDF;
      if (jsPDF) {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const left = 14;
        const right = pageWidth - 14;
        const generated = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        pdf.setTextColor(27, 27, 25);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(15);
        pdf.text(String(title), 58, 25);
        if (logo) pdf.addImage(logo, 'PNG', left, 13, 39, 18);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 95);
        pdf.text('AROMIN-SISON DENTAL CLINIC', right, 20, { align: 'right' });
        pdf.text(generated.toUpperCase(), right, 26, { align: 'right' });
        pdf.setDrawColor(90, 90, 86);
        pdf.setLineWidth(0.35);
        pdf.line(left, 38, right, 38);
        const widths = [62, 54, 48, 30];
        const headers = columns.map(c => String(c.label).toUpperCase());
        let y = 48;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(65, 65, 60);
        let x = left;
        headers.forEach((header, index) => { pdf.text(header, x + 2, y); x += widths[index] || 40; });
        pdf.setDrawColor(205, 205, 200);
        pdf.line(left, y + 4, right, y + 4);
        y += 11;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(35, 35, 32);
        rows.forEach(row => {
          const values = columns.map(c => String(c.value(row) ?? ''));
          x = left;
          values.forEach((value, index) => { pdf.text(value.slice(0, 34), x + 2, y); x += widths[index] || 40; });
          pdf.setDrawColor(225, 225, 220);
          pdf.line(left, y + 4, right, y + 4);
          y += 9;
        });
        pdf.setFontSize(7);
        pdf.setTextColor(90, 90, 86);
        pdf.text('Aromin-Sison Dental Clinic', left, 285);
        pdf.text('1 / 1', right, 285, { align: 'right' });
        const filename = String(title || 'clinic-report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clinic-report';
        pdf.save(`${filename}.pdf`);
        if (toast) toast.show('PDF downloaded.');
        return;
      }

      const documentHtml =
        `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(
          title
        )}</title>` +
          `<style>
        *{box-sizing:border-box;}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B1B19;margin:0;padding:32px;}
        .report-head{display:flex;align-items:center;gap:18px;border-bottom:2px solid #9C8B3E;padding-bottom:14px;margin-bottom:22px;}
        .report-logo{width:150px;height:auto;object-fit:contain;flex-shrink:0;}
        .report-head h1{margin:0;font-family:'Fraunces',serif;font-size:20px;font-weight:600;line-height:1.2;}
        .report-meta{margin-left:auto;font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.08em;text-align:right;line-height:1.6;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #e5e5e0;}
        th{font-weight:600;background:#f8f7f2;color:#4a4a42;font-size:11px;text-transform:uppercase;letter-spacing:.04em;}
        tr:nth-child(even){background:#fafaf6;}
        @page{size:A4 portrait;margin:1.5cm;}
        @media print{body{padding:0;}}
        </style></head><body>` +
          `<div class="report-head">${logoHtml}<div><h1>${esc(
            title
          )}</h1></div><div class="report-meta">Aromin-Sison Dental Clinic<br>${esc(
            date
          )}</div></div>` +
          `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>` +
          `</body></html>`;
      const blob = new Blob([documentHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = String(title || 'clinic-report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clinic-report';
      link.href = url;
      link.download = `${filename}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (toast) toast.show('Report downloaded.');
    }
  }

  window.ASDC.ReportExporter = ReportExporter;
})();
