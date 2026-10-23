/* Export the actual patient and billing cards, preserving the dashboard layout. */
(function () {
  'use strict';
  let canvasLoading = null;
  function loadCanvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (canvasLoading) return canvasLoading;
    canvasLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => { script.remove(); canvasLoading = null; reject(new Error('PDF renderer could not load. Please try again.')); }, 15000);
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => { clearTimeout(timer); resolve(window.html2canvas); };
      script.onerror = () => { clearTimeout(timer); script.remove(); canvasLoading = null; reject(new Error('PDF renderer could not load. Please try again.')); };
      document.head.appendChild(script);
    });
    return canvasLoading;
  }
  async function downloadLayoutPDF(patient, billingOnly) {
    if (!window.jspdf?.jsPDF) throw new Error('PDF download is unavailable. Please reload and try again.');
    const capture = await loadCanvas();
    if (document.fonts?.ready) await document.fonts.ready;
    const profile = document.querySelector('.chart-profile');
    const sections = billingOnly
      ? [document.getElementById('view-payments')]
      : [document.getElementById('chartAppointmentHistory')];
    if (!profile || sections.some(section => !section)) throw new Error('Patient record is not ready. Please try again.');
    const root = document.createElement('div');
    root.className = 'chart-shell billing-pdf-layout';
    root.style.cssText = 'position:absolute;left:-12000px;top:0;width:1000px;max-width:none;margin:0;padding:24px;box-sizing:border-box;background:#FAFAF7;';
    const brand = document.createElement('div');
    brand.className = 'billing-export-brand';
    brand.textContent = 'AROMIN-SISON DENTAL CLINIC';
    root.appendChild(brand);
    root.appendChild(profile.cloneNode(true));
    sections.forEach(section => root.appendChild(section.cloneNode(true)));
    root.querySelectorAll('button, .chart-search, #patientBillingMessage').forEach(element => element.remove());
    // Billing downloads and clinical downloads contain only their own sections.
    document.body.appendChild(root);
    const protectedBlocks = [];
    let logicalHeight = 1;
    try {
      const canvas = await capture(root, {
        scale: 2, backgroundColor: '#FAFAF7', logging: false,
        useCORS: true, windowWidth: 1200, scrollX: 0, scrollY: 0,
        onclone: (doc, copy) => {
          copy.style.position = 'relative'; copy.style.left = '0'; copy.style.top = '0';
          const bounds = copy.getBoundingClientRect();
          logicalHeight = bounds.height;
          copy.querySelectorAll('.chart-profile, .billing-stat, .chart-entry, tr, .page-head, .chart-section-heading, h3').forEach(element => {
            const rect = element.getBoundingClientRect();
            protectedBlocks.push({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top });
          });
        }
      });
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10, contentWidth = pageWidth - margin * 2;
      const mmPerPixel = contentWidth / canvas.width;
      const maxSlice = Math.floor((pageHeight - margin * 2 - 8) / mmPerPixel);
      const ratio = canvas.height / logicalHeight;
      let offset = 0, page = 0;
      while (offset < canvas.height) {
        let end = Math.min(offset + maxSlice, canvas.height);
        // Move a boundary above a row/card instead of cutting it in half.
        let adjusted = true;
        while (adjusted) {
          adjusted = false;
          for (const block of protectedBlocks) {
            const top = Math.floor(block.top * ratio), bottom = Math.ceil(block.bottom * ratio);
            if (top > offset && top < end && bottom > end && bottom - top <= maxSlice) {
              end = top; adjusted = true;
            }
          }
        }
        if (end <= offset) end = Math.min(offset + maxSlice, canvas.height);
        const slice = document.createElement('canvas');
        slice.width = canvas.width; slice.height = end - offset;
        slice.getContext('2d').drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (page++) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, slice.height * mmPerPixel);
        offset = end;
      }
      const generated = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      for (let index = 1; index <= page; index++) {
        pdf.setPage(index); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(107, 112, 107);
        pdf.text(generated + ' (Asia/Manila)', margin, pageHeight - 8);
        pdf.text(`${index} / ${page}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }
      const name = `${patient.first_name || ''} ${patient.last_name || ''}`.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'patient';
      pdf.save(`${billingOnly ? 'patient-billing' : 'patient-chart'}-P${patient.patient_id}-${name}.pdf`);
    } finally {
      root.remove();
    }
  }
  window.ASDC.downloadBillingLayoutPDF = patient => downloadLayoutPDF(patient, true);
  window.ASDC.downloadPatientChartLayoutPDF = patient => downloadLayoutPDF(patient, false);
})();
