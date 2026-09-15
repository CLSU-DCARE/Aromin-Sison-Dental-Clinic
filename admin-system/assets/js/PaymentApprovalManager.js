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
    this._filter   = 'Pending';
    this._receiptModal = new Modal('receiptModal');
    this._receiptCurrent = null;
    this._items = []; // Last server response, used by _findById.

    this.LABEL = { pending: 'Pending Confirmation', approved: 'Approved', rejected: 'Rejected' };
    this.TAG   = { pending: 'amber', approved: 'green', rejected: 'red' };
  }

  init () {
    this._bindReceiptModal();
    this._bindActions();
    this._bindFilter();
    this.render();
  }

  _findById (id) {
    return this._items.find(s => String(s.id) === String(id));
  }

  /* ------------------------------------------------------------------
   *  Render
   * ----------------------------------------------------------------*/

  async render () {
    const tbody  = document.getElementById('adminPaymentsBody');
    const empty  = document.getElementById('payAdminEmpty');
    const countTag = document.getElementById('payQueueCount');
    if (!tbody) return;

    let items;
    try {
      const data = await apiFetch('../backend/api/payments/payments.php');
      if (!Array.isArray(data.payments)) throw new Error('not_implemented');
      items = data.payments;
    } catch (error) {
      items = [];
      showToast('Unable to load payment approvals. Please try again.', 'error');
    }
    this._items = items;

    const list = items
      .filter(s => this._filter === 'All' || s.status === this._filter.toLowerCase())
      .slice().reverse();

    if (countTag) {
      const pending = items.filter(s => s.status === 'pending').length;
      countTag.hidden = pending === 0;
      countTag.textContent = pending + ' awaiting confirmation';
    }

    if (!list.length) {
      tbody.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    tbody.innerHTML = list.map(s => {
      const initials = String(s.patient || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const actions = s.status === 'pending'
        ? `<button class="btn btn-sm btn-approve" data-pay-action="approve" data-pay-id="${escapeHtml(s.id)}">Approve</button>` +
          `<button class="btn btn-sm btn-reject" data-pay-action="reject" data-pay-id="${escapeHtml(s.id)}">Reject</button>`
        : '';
      return `<tr>
        <td>${nameCell(initials, s.patient, s.pid)}</td>
        <td>${escapeHtml(s.amount)}</td>
        <td>${escapeHtml(s.method)}</td>
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

  _openReceipt (s) {
    this._receiptCurrent = s;
    document.getElementById('rcPatient').textContent   = s.patient + ' · ' + s.pid;
    document.getElementById('rcAmount').textContent    = s.amount;
    document.getElementById('rcMethod').textContent    = s.method;
    document.getElementById('rcSubmitted').textContent = s.submittedAt;

    const noteField = document.getElementById('rcNoteField');
    const noteEl    = document.getElementById('rcNote');
    if (noteField && noteEl) { noteField.hidden = !s.note; noteEl.textContent = s.note || ''; }

    document.getElementById('receiptImg').src = s.receipt_url || '';
    const pending = s.status === 'pending';
    document.getElementById('approvePaymentBtn').hidden = !pending;
    document.getElementById('rejectPaymentBtn').hidden  = !pending;
    this._receiptModal.open(document.getElementById('receiptClose'));
  }

  async _review (s, action) {
    try {
      await apiFetch('../backend/api/payments/payments.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: s.id, action })
      });
      if (this._receiptModal.modal) this._receiptModal.close();
      showToast('Payment ' + (action === 'approve' ? 'approved' : 'rejected') + ' for ' + s.patient);
      await this.render();
      if (typeof applyBraces === 'function') await applyBraces();
      if (typeof patientMgr !== 'undefined') await patientMgr.load();
    } catch (error) { showToast(error.message, 'error'); }
  }

  _approve (s) { return this._review(s, 'approve'); }
  _reject (s) { return this._review(s, 'reject'); }

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
      else if (action === 'approve') this._approve(sub);
      else if (action === 'reject')  this._reject(sub);
    });
  }

  _bindFilter () {
    const group = document.querySelector('#view-payments .toolbar-left');
    if (!group) return;
    wireChips(group, label => { this._filter = label; this.render(); });
    setChipGroup(group, 'Pending');
  }
};
