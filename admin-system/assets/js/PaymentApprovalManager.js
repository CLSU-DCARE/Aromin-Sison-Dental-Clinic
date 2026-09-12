/**
 * PaymentApprovalManager – Admin payment approval workflow.
 *
 * Tries the real backend (backend/api/payments/payments.php) first; falls
 * back to the local localStorage-backed mock only when that endpoint isn't
 * reachable/implemented, so this keeps working during local frontend-only
 * development and automatically "goes live" once the backend is deployed.
 *
 * Usage:
 *   const payMgr = new PaymentApprovalManager();
 *   payMgr.init();
 */
/* global Modal, showToast, escapeHtml, nameCell, apiFetch, ContractStore, PatientNotify, applyBraces, patientMgr */
window.PaymentApprovalManager = class PaymentApprovalManager {
  constructor ({ storageKey = 'asdc.payments' } = {}) {
    this._storeKey = storageKey;
    this._filter   = 'Pending';
    this._receiptModal = new Modal('receiptModal');
    this._receiptCurrent = null;
    this._items = [];    // last-rendered list (real or mock), used by _findById
    this._isReal = false; // whether _items came from the real backend

    this.LABEL = { pending: 'Pending Confirmation', approved: 'Approved', rejected: 'Rejected' };
    this.TAG   = { pending: 'amber', approved: 'green', rejected: 'red' };
  }

  init () {
    this._bindReceiptModal();
    this._bindActions();
    this._bindFilter();
    this.render();
  }

  /* ------------------------------------------------------------------
   *  Local mock store (fallback only)
   * ----------------------------------------------------------------*/

  _all () {
    try {
      const raw = localStorage.getItem(this._storeKey);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  _save (list) {
    try { localStorage.setItem(this._storeKey, JSON.stringify(list)); } catch (e) { /* empty */ }
  }

  _findById (id) {
    return this._items.find(s => String(s.id) === String(id));
  }

  _commit (updated) {
    const list = this._all();
    const i = list.findIndex(s => s.id === updated.id);
    if (i >= 0) list[i] = updated;
    this._save(list);
    this.render();
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
      this._isReal = true;
    } catch (error) {
      items = this._all();
      this._isReal = false;
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

    // Real submissions carry receipt_url (a server file path); the local
    // mock instead has a full base64 receiptDataUrl — support both.
    document.getElementById('receiptImg').src = s.receipt_url || s.receiptDataUrl || '';
    const pending = s.status === 'pending';
    document.getElementById('approvePaymentBtn').hidden = !pending;
    document.getElementById('rejectPaymentBtn').hidden  = !pending;
    this._receiptModal.open(document.getElementById('receiptClose'));
  }

  async _approve (s) {
    if (this._isReal) {
      try {
        await apiFetch('../backend/api/payments/payments.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: s.id, action: 'approve' })
        });
        if (this._receiptModal.modal) this._receiptModal.close();
        showToast('Payment of ' + s.amount + ' approved for ' + s.patient);
        await this.render();
        return;
      } catch (error) {
        showToast(error.message, 'error');
        return;
      }
    }

    // Mock fallback: apply the same effects locally.
    const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    const seq = String(100 + this._all().filter(x => x.status === 'approved').length);
    const orNumber = 'OR-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + seq;
    this._commit(Object.assign({}, s, {
      status: 'approved',
      reviewedAt: now,
      orNumber
    }));

    // Reflect the approved payment on the patient's actual braces contract
    // (balance/paid/history) instead of only flipping this row's status —
    // this is what makes the patient's own Contract view show the update.
    if (typeof ContractStore !== 'undefined' && s.pid) {
      const amountNum = ContractStore.parsePeso(s.amount);
      const updated = ContractStore.recordPayment(s.pid, {
        amount: amountNum,
        method: s.method,
        or: orNumber,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
      if (updated && typeof PatientNotify !== 'undefined') {
        PatientNotify.push(s.pid, {
          kind: 'pay',
          title: 'Payment approved',
          desc: 'Your payment of ' + s.amount + ' was approved (' + orNumber + ').'
        });
      }
      if (typeof applyBraces === 'function') applyBraces();
      if (typeof patientMgr !== 'undefined' && patientMgr.render) patientMgr.render();
    }

    if (this._receiptModal.modal) this._receiptModal.close();
    showToast('Payment of ' + s.amount + ' approved for ' + s.patient);
  }

  async _reject (s) {
    if (this._isReal) {
      try {
        await apiFetch('../backend/api/payments/payments.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: s.id, action: 'reject' })
        });
        if (this._receiptModal.modal) this._receiptModal.close();
        showToast('Payment of ' + s.amount + ' rejected for ' + s.patient, 'error');
        await this.render();
        return;
      } catch (error) {
        showToast(error.message, 'error');
        return;
      }
    }

    const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    this._commit(Object.assign({}, s, { status: 'rejected', reviewedAt: now, orNumber: null }));
    if (typeof PatientNotify !== 'undefined' && s.pid) {
      PatientNotify.push(s.pid, {
        kind: 'pay',
        title: 'Payment rejected',
        desc: 'Your payment submission of ' + s.amount + ' was rejected. Please check your receipt and resubmit.'
      });
    }
    if (this._receiptModal.modal) this._receiptModal.close();
    showToast('Payment of ' + s.amount + ' rejected for ' + s.patient, 'error');
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
