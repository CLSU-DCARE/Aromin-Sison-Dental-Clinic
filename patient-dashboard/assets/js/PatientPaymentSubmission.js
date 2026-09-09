/**
 * PatientPaymentSubmission – Payment receipt upload and submission logic.
 *
 * Encapsulates PaymentStore, receipt image reading, payment form, and submission history.
 * Replaces lines 1848-2366 of patient.js.
 *
 * Usage:
 *   const payment = new PatientPaymentSubmission({ mock: PatientMock });
 *   payment.init();
 *   payment.render();
 */
/* global showToast, escapeHtml */
window.PatientPaymentSubmission = class PatientPaymentSubmission {
  constructor ({ mock, paymentMethod = 'Online (QR)', storageKey = 'asdc.payments' } = {}) {
    this.mock          = mock;
    this.paymentMethod = paymentMethod;
    this._receiptData  = null;
    this._store        = { key: storageKey };
  }

  init () {
    this._initReceiptInput();
    this._initSubmit();
  }

  /* ------------------------------------------------------------------
   *  PaymentStore (localStorage)
   * ----------------------------------------------------------------*/

  storeAll () {
    try {
      const raw = localStorage.getItem(this._store.key);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  storeSave (list) {
    try { localStorage.setItem(this._store.key, JSON.stringify(list)); } catch (e) { /* empty */ }
  }

  storeByPatient (patientId) {
    return this.storeAll().filter(s => s.pid === patientId);
  }

  /* ------------------------------------------------------------------
   *  Render submission history
   * ----------------------------------------------------------------*/

  render () {
    const submissions = this.storeByPatient(this.mock.user.pid).slice().reverse();
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
      return `<div class="pay-sub"><span class="ps-amt">${escapeHtml(sub.amount)}</span><span class="ps-meta"><b>Submitted ${escapeHtml(sub.submittedAt)}</b> · ${escapeHtml(sub.method)}${sub.orNumber ? ' · OR ' + escapeHtml(sub.orNumber) : ''}</span><span class="tag tag-${cls}">${txt}</span></div>`;
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
        drop?.classList.add('has-file');
        if (txt) txt.textContent = 'Receipt ready: ' + result.name;
        if (preview) preview.hidden = false;
        if (previewImg) previewImg.src = result.dataUrl;
        showToast('Receipt attached — submit when ready.');
      } catch (error) {
        showToast(error.message, 'error');
        input.value = '';
      }
    });

    removeBtn?.addEventListener('click', () => {
      this._receiptData = null;
      input.value = '';
      drop?.classList.remove('has-file');
      if (txt) txt.textContent = 'Click to upload a screenshot of your payment';
      if (preview) preview.hidden = true;
      if (previewImg) previewImg.src = '';
    });
  }

  _initSubmit () {
    const submitBtn = document.getElementById('submitPaymentBtn');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', () => {
      const amountEl = document.getElementById('payAmount');
      const noteEl   = document.getElementById('payNote');
      const amount   = amountEl ? amountEl.value : '';
      const note     = noteEl ? noteEl.value : '';

      if (!this._receiptData) { showToast('Please upload your payment receipt first.', 'error'); return; }
      if (!amount || !amount.trim()) { showToast('Please enter the amount you paid.', 'error'); return; }

      const submission = {
        id: 'pay-' + Date.now(),
        pid: this.mock.user.pid,
        patient: this.mock.user.name,
        amount: amount.trim(),
        method: this.paymentMethod,
        note: (note || '').trim(),
        receiptDataUrl: this._receiptData,
        status: 'pending',
        submittedAt: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),
        reviewedAt: null,
        orNumber: null
      };

      const all = this.storeAll();
      all.push(submission);
      this.storeSave(all);

      // Reset form
      this._receiptData = null;
      const input = document.getElementById('payReceipt');
      if (input) input.value = '';
      document.getElementById('payDrop')?.classList.remove('has-file');
      const txt = document.getElementById('payDropTxt');
      if (txt) txt.textContent = 'Click to upload a screenshot of your payment';
      document.getElementById('payPreview').hidden = true;
      document.getElementById('payPreviewImg').src = '';
      if (noteEl) noteEl.value = '';

      this.render();
      showToast('Payment submitted — awaiting confirmation.');
    });
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
