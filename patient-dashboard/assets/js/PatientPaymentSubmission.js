/**
 * PatientPaymentSubmission - Payment receipt upload and submission logic.
 *
 * Submits requests to the authenticated backend.
 *
 * Usage:
 *   const payment = new PatientPaymentSubmission({ state: PatientState });
 *   payment.init();
 *   payment.render();
 */
/* global showToast, escapeHtml, apiFetch */
window.PatientPaymentSubmission = class PatientPaymentSubmission {
  constructor ({ state, paymentMethod = 'gcash', onSubmitted = null } = {}) {
    this.state          = state;
    this.paymentMethod = paymentMethod;
    this.onSubmitted = onSubmitted;
    this._receiptData  = null; // base64 preview thumbnail
    this._receiptFile   = null; // original file for upload
  }

  init () {
    this._initReceiptInput();
    this._initSubmit();
  }

  /* ------------------------------------------------------------------
   *  Render submission history
   * ----------------------------------------------------------------*/

  async render () {
    let submissions;
    try {
      const data = await apiFetch('../backend/api/patients/payments.php');
      if (!Array.isArray(data.submissions)) throw new Error('not_implemented');
      submissions = data.submissions;
    } catch (error) {
      showToast('Unable to load payment submissions. Please try again.', 'error');
      return;
    }

    this.renderSubmissions(submissions);
  }

  renderSubmissions(submissions) {
    const list  = document.getElementById('paySubs');
    const empty = document.getElementById('paySubsEmpty');
    const tag   = document.getElementById('payPendingTag');
    if (!list) return;

    if (!submissions.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      if (tag) tag.textContent = '0 pending';
      return;
    }

    if (empty) empty.hidden = true;

    const pendingCount = submissions.filter(s => s.status === 'pending').length;
    if (tag) {
      tag.textContent = pendingCount + ' pending';
      tag.className = 'tag tag-' + (pendingCount > 0 ? 'amber' : 'green');
    }

    list.innerHTML = submissions.map(sub => {
      const cls = sub.status === 'approved' ? 'green' : sub.status === 'rejected' ? 'red' : 'amber';
      const txt = sub.status === 'approved' ? 'Approved' : sub.status === 'rejected' ? 'Rejected' : 'Pending Confirmation';
      return `<div class="pay-sub"><span class="ps-amt">${escapeHtml(sub.amount)}</span><span class="ps-meta"><b>Submitted ${escapeHtml(sub.submittedAt)}</b> - ${escapeHtml(sub.method)}${sub.orNumber ? ' - OR ' + escapeHtml(sub.orNumber) : ''}</span><span class="tag tag-${cls}">${txt}</span></div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------
   *  Private
   * ----------------------------------------------------------------*/

  _initReceiptInput () {
    const input = document.getElementById('payReceipt');
    const drop  = document.getElementById('payDrop');
    const txt   = document.getElementById('payDropTxt');
    const preview      = document.getElementById('payPreview');
    const previewImg   = document.getElementById('payPreviewImg');
    const previewFallback = document.getElementById('payPreviewFallback');
    const previewName = document.getElementById('payPreviewName');
    const removeBtn    = document.getElementById('payRemoveReceipt');
    if (!input) return;

    drop?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const result = await this._readImage(file);
        this._receiptData = result.dataUrl;
        this._receiptFile = file;
        drop?.classList.add('has-file');
        if (txt) txt.textContent = 'Receipt ready: ' + result.name;
        this._showPreview({ preview, previewImg, previewFallback, previewName }, result);
        showToast('Receipt attached - submit when ready.');
      } catch (error) {
        showToast(error.message, 'error');
        input.value = '';
      }
    });

    removeBtn?.addEventListener('click', () => {
      this._receiptData = null;
      this._receiptFile = null;
      input.value = '';
      drop?.classList.remove('has-file');
      if (txt) txt.textContent = 'Click to submit proof of payment';
      this._resetPreview({ preview, previewImg, previewFallback, previewName });
    });
  }

  _initSubmit () {
    const submitBtn = document.getElementById('submitPaymentBtn');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async () => {
      const amountEl = document.getElementById('payAmount');
      const noteEl   = document.getElementById('payNote');
      const amount   = amountEl ? amountEl.value : '';
      const note     = noteEl ? noteEl.value : '';

      if (!this._receiptData) { showToast('Please upload your payment receipt first.', 'error'); return; }
      if (!amount || !amount.trim()) { showToast('Please enter the amount you paid.', 'error'); return; }

      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        if (!this._receiptFile) throw new Error('Please attach your receipt again.');
        const form = new FormData();
        form.append('amount', amount.trim());
        form.append('method', document.getElementById('payMethod')?.value || this.paymentMethod);
        form.append('note', (note || '').trim());
        form.append('receipt', this._receiptFile);
        await apiFetch('../backend/api/patients/payments.php', { method: 'POST', body: form });
      } catch (error) {
        showToast(error.message, 'error');
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        return;
      }

      // Reset form
      this._receiptData = null;
      this._receiptFile = null;
      const input = document.getElementById('payReceipt');
      if (input) input.value = '';
      document.getElementById('payDrop')?.classList.remove('has-file');
      const txt = document.getElementById('payDropTxt');
      if (txt) txt.textContent = 'Click to submit proof of payment';
      this._resetPreview({
        preview: document.getElementById('payPreview'),
        previewImg: document.getElementById('payPreviewImg'),
        previewFallback: document.getElementById('payPreviewFallback'),
        previewName: document.getElementById('payPreviewName'),
      });
      if (noteEl) noteEl.value = '';

      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;

      if (this.onSubmitted) await this.onSubmitted();
      else await this.render();
      showToast('Payment submitted - awaiting confirmation.');
    });
  }

  _showPreview (els, result) {
    const { preview, previewImg, previewFallback, previewName } = els;
    if (previewName) previewName.textContent = result.name || 'Receipt attached';
    if (previewFallback) {
      previewFallback.hidden = false;
      previewFallback.textContent = 'Loading preview';
    }
    if (previewImg) {
      previewImg.hidden = true;
      previewImg.onload = () => {
        previewImg.hidden = false;
        if (previewFallback) previewFallback.hidden = true;
      };
      previewImg.onerror = () => {
        previewImg.hidden = true;
        if (previewFallback) {
          previewFallback.hidden = false;
          previewFallback.textContent = 'Preview unavailable';
        }
      };
      previewImg.src = result.dataUrl;
    }
    if (preview) preview.hidden = false;
  }

  _resetPreview (els) {
    const { preview, previewImg, previewFallback, previewName } = els;
    if (preview) preview.hidden = true;
    if (previewName) previewName.textContent = 'Receipt attached';
    if (previewFallback) {
      previewFallback.hidden = false;
      previewFallback.textContent = 'Preview ready';
    }
    if (previewImg) {
      previewImg.hidden = true;
      previewImg.onload = null;
      previewImg.onerror = null;
      previewImg.removeAttribute('src');
    }
  }

  _readImage (file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('Please upload an image file.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Could not read the image.'));
        image.onload = () => {
          const max = 900;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width  = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.82), name: file.name });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
};
