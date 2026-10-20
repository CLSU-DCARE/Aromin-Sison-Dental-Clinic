/**
 * PaymentApprovalManager – Admin payment approval workflow.
 *
 * Submits requests to the authenticated backend.
 *
 * Usage:
 *   const payMgr = new PaymentApprovalManager();
 *   payMgr.init();
 */
/* global Modal, showToast, escapeHtml, nameCell, apiFetch, applyBraces, patientMgr */
window.PaymentApprovalManager = class PaymentApprovalManager {
  constructor () {
    this._filter   = 'All';
    this._receiptModal = new Modal('receiptModal');
    this._receiptCurrent = null;
    this._receiptObjectUrl = null;
    this._items = []; // Last server response, used by _findById.

    this.LABEL = { pending: 'Pending Confirmation', approved: 'Approved', rejected: 'Rejected' };
    this.TAG   = { pending: 'amber', approved: 'green', rejected: 'red' };
  }

  init () {
    this._bindReceiptModal();
    this._bindActions();
    this._bindFilter();
  }

  _findById (id) {
    return this._items.find(s => String(s.id) === String(id));
  }

  /* ------------------------------------------------------------------
   *  Render
   * ----------------------------------------------------------------*/

  async render (snapshot = null) {
    if (!snapshot && window.staffSnapshot) snapshot = window.staffSnapshot;
    if (!snapshot && window.staffLiveSync) return window.staffLiveSync.refetch();
    const tbody  = document.getElementById('adminPaymentsBody');
    const empty  = document.getElementById('payAdminEmpty');
    if (!tbody) return;

    let items;
    try {
      const data = snapshot || await apiFetch('../backend/api/payments/payments.php');
      if (!Array.isArray(data.payments)) throw new Error('not_implemented');
      items = data.payments;
    } catch (error) {
      showToast('Unable to load payment approvals. Please try again.', 'error');
      return;
    }
    this._items = items;

    const list = items
      .filter(s => {
        if (this._filter === 'All') return true;
        if (this._filter === 'Overdue') return s.dueStatus === 'overdue';
        if (this._filter === 'Completed') return s.status === 'approved';
        return s.status === this._filter.toLowerCase();
      });


    if (!list.length) {
      tbody.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    tbody.innerHTML = list.map(s => {
      const initials = String(s.patient || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const actions = '';
      return `<tr>
        <td>${nameCell(initials, s.patient, s.pid)}</td>
        <td>${escapeHtml(s.amount)}</td>
        <td>${escapeHtml(s.method)}</td>
        <td>${this._dueTag(s)}</td>
        <td>${escapeHtml(s.submittedAt)}</td>
        <td><button class="btn btn-outline btn-sm" data-pay-action="view" data-pay-id="${escapeHtml(s.id)}">View</button></td>
        <td><span class="tag tag-${this.TAG[s.status]}">${this.LABEL[s.status]}</span></td>
        <td><div class="pay-actions">${actions}</div></td>
      </tr>`;
    }).join('');
  }

  /* ------------------------------------------------------------------
   *  Private – receipt modal
   * ----------------------------------------------------------------*/

  _bindReceiptModal () {
    if (!this._receiptModal.modal) return;
    this._receiptModal.registerClose(document.getElementById('receiptClose'));
    this._receiptModal.registerClose(document.getElementById('receiptCancelBtn'));

    document.getElementById('approvePaymentBtn')?.addEventListener('click', () => {
      if (this._receiptCurrent) this._approve(this._receiptCurrent);
    });
    document.getElementById('rejectPaymentBtn')?.addEventListener('click', () => {
      if (this._receiptCurrent) this._reject(this._receiptCurrent);
    });
  }

  async _openReceipt (s) {
    this._receiptCurrent = s;
    document.getElementById('rcPatient').textContent   = s.patient + ' · ' + s.pid;
    document.getElementById('rcAmount').textContent    = s.amount;
    document.getElementById('rcMethod').textContent    = s.method;
    const dueEl = document.getElementById('rcDueDate');
    if (dueEl) dueEl.innerHTML = this._dueTag(s);
    document.getElementById('rcSubmitted').textContent = s.submittedAt;

    const noteField = document.getElementById('rcNoteField');
    const noteEl    = document.getElementById('rcNote');
    if (noteField && noteEl) { noteField.hidden = !s.note; noteEl.textContent = s.note || ''; }

    const receiptPreview = document.getElementById('receiptImg');
    const receiptStatus = document.getElementById('receiptImgStatus');
    const receiptPath = s.id ? `../backend/api/payments/receipt.php?payment_id=${encodeURIComponent(s.id)}` : (s.receipt_url || '');
    const receiptUrl = receiptPath && window.ASDC?.ApiClient?.url
      ? window.ASDC.ApiClient.url(receiptPath)
      : receiptPath;
    if (receiptPreview) {
      this._clearReceiptObjectUrl();
      receiptPreview.hidden = true;
      receiptPreview.style.backgroundImage = '';
      receiptPreview.setAttribute('aria-label', '');
      if (receiptStatus) {
        receiptStatus.textContent = receiptUrl ? 'Loading receipt...' : 'No receipt image is attached to this payment.';
        receiptStatus.hidden = false;
      }
      if (receiptUrl) await this._loadReceiptImage(receiptUrl, receiptPreview, receiptStatus);
    }
    this._receiptModal.open(document.getElementById('receiptClose'));
  }

  _clearReceiptObjectUrl () {
    if (!this._receiptObjectUrl) return;
    URL.revokeObjectURL(this._receiptObjectUrl);
    this._receiptObjectUrl = null;
  }

  async _loadReceiptImage (receiptUrl, receiptPreview, receiptStatus) {
    try {
      const response = await fetch(receiptUrl, {
        credentials: window.ASDC?.API_BASE_URL ? 'include' : 'same-origin',
        headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Receipt request failed.');
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) throw new Error('Receipt response was not an image.');
      const blob = await response.blob();
      this._receiptObjectUrl = URL.createObjectURL(blob);
      receiptPreview.style.backgroundImage = `url("${this._receiptObjectUrl}")`;
      receiptPreview.setAttribute('aria-label', 'Payment receipt');
      receiptPreview.hidden = false;
      if (receiptStatus) receiptStatus.hidden = true;
    } catch (error) {
      receiptPreview.hidden = true;
      receiptPreview.style.backgroundImage = '';
      receiptPreview.setAttribute('aria-label', '');
      if (receiptStatus) {
        receiptStatus.textContent = 'Receipt image could not be loaded. Please check that the uploaded file still exists.';
        receiptStatus.hidden = false;
      }
    }
  }

  _dueTag (s) {
    const tag = {
      overdue: 'red',
      'due-today': 'amber',
      paid: 'green',
      upcoming: 'blue'
    }[s.dueStatus] || 'blue';
    return `<span class="tag tag-${tag}">${escapeHtml(s.dueDate || 'Not set')}</span>`;
  }

  /* ------------------------------------------------------------------
   *  Private – event bindings
   * ----------------------------------------------------------------*/

  _bindActions () {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-pay-action]');
      if (!btn) return;
      const sub = this._findById(btn.dataset.payId);
      if (!sub) return;
      const action = btn.dataset.payAction;
      if (action === 'view')    this._openReceipt(sub);
    });
  }

  _bindFilter () {
    const group = document.querySelector('#view-payments .toolbar-left');
    if (!group) return;
    wireChips(group, label => { this._filter = label; this.render(); });
    setChipGroup(group, 'All');
  }
};
