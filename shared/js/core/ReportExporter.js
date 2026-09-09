/**
 * ReportExporter: Aromin-Sison Dental Clinic System.
 * Client-side PDF export via browser print dialog.
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

      const win = window.open('', '_blank');
      if (!win) {
        if (toast)
          toast.show(
            'Pop-up blocked: allow pop-ups to export the report.',
            'error'
          );
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

      win.document.write(
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
        @media print{body{padding:0;}@page{margin:1.5cm;}}
        </style></head><body>` +
          `<div class="report-head">${logoHtml}<div><h1>${esc(
            title
          )}</h1></div><div class="report-meta">Aromin-Sison Dental Clinic<br>${esc(
            date
          )}</div></div>` +
          `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>` +
          `</body></html>`
      );
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  }

  window.ASDC.ReportExporter = ReportExporter;
})();
