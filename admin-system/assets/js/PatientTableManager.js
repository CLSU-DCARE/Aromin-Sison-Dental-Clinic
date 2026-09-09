/**
 * PatientTableManager – Patient search, filter, and mock CRUD.
 *
 * Encapsulates patient search, status filter, mobile search popover,
 * and view/edit/delete/add modals.
 * Replaces lines 100-683 of admin.js (patient table + modals).
 *
 * Usage:
 *   const patientMgr = new PatientTableManager({ mock: AdminMock });
 *   patientMgr.init();
 */
/* global Modal, showToast, escapeHtml, nameCell, statusTag, eyeIcon, pencilIcon, trashIcon, wireChips, setChipGroup, Popover */
window.PatientTableManager = class PatientTableManager {
  constructor ({ mock, onSwitchView = null } = {}) {
    this.mock        = mock;
    this.onSwitchView = onSwitchView;
    this.query       = '';
    this.status      = 'All';
    this.patientsList = [];

    this._editingPatient = null;
    this._deletingPatient = null;
    this._detailCurrent  = null;
  }

  init () {
    this._bindSearch();
    this._bindMobileSearch();
    this._bindFilterChips();
    this._bindRowActions();
    this._bindDetailModal();
    this._bindFormModal();
    this._bindDeleteModal();
    this.apply();
  }

  /* ------------------------------------------------------------------
   *  Public – get filtered list (used by export)
   * ----------------------------------------------------------------*/

  getFilteredList () { return this.patientsList; }

  /* ------------------------------------------------------------------
   *  Private – search
   * ----------------------------------------------------------------*/

  _bindSearch () {
    const search = document.getElementById('patientSearch');
    const clear  = document.getElementById('searchClear');
    if (search) {
      search.addEventListener('input', () => {
        this._setQuery(search.value, { syncMobile: false });
        if (this.query.trim() && !document.getElementById('view-patients')?.classList.contains('active')) {
          this.onSwitchView?.('patients');
        }
      });
    }
    if (clear) {
      clear.addEventListener('click', () => {
        if (search) search.value = '';
        this._setQuery('', { syncMobile: false });
        search?.focus();
      });
    }
  }

  _setQuery (value, { syncMobile = true } = {}) {
    this.query = value;
    const clear = document.getElementById('searchClear');
    if (clear) clear.hidden = !value;
    if (syncMobile) {
      const mobileInput = document.getElementById('mobileSearchInput');
      if (mobileInput) mobileInput.value = value;
    }
    this.apply();
  }

  _bindMobileSearch () {
    const btn     = document.getElementById('searchBtn');
    const panel   = document.getElementById('mobileSearchPanel');
    const input   = document.getElementById('mobileSearchInput');
    const clear   = document.getElementById('mobileSearchClear');
    const results = document.getElementById('mobileSearchResults');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      Popover.toggle(btn, panel, {
        onOpen: () => {
          input.value = this.query;
          if (clear) clear.hidden = !this.query;
          this._renderMobileResults(results, input.value);
        }
      });
    });

    input?.addEventListener('input', () => {
      if (clear) clear.hidden = !input.value;
      this._renderMobileResults(results, input.value);
    });

    clear?.addEventListener('click', () => {
      input.value = '';
      clear.hidden = true;
      this._renderMobileResults(results, '');
      input.focus();
    });
  }

  _renderMobileResults (container, query) {
    if (!container) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      container.innerHTML = '<p class="search-hint">Start typing to search patients by name, ID, or contact.</p>';
      return;
    }
    const matches = this.mock.patients.filter(p =>
      p.contract && [p.name, p.id, p.contact].some(v => String(v).toLowerCase().includes(q))
    );
    if (!matches.length) {
      container.innerHTML = `<p class="search-empty">No patients match "${escapeHtml(query.trim())}".</p>`;
      return;
    }
    container.innerHTML = matches.map(p =>
      `<button type="button" class="search-result" data-id="${p.id}">
        <span class="mini-avatar">${p.initials}</span>
        <span class="name-block"><span class="full">${escapeHtml(p.name)}</span><span class="sub">${p.id}</span></span>
        ${statusTag(p)}
      </button>`
    ).join('');
    container.querySelectorAll('.search-result').forEach(btn => {
      btn.addEventListener('click', () => {
        this._setQuery(document.getElementById('mobileSearchInput')?.value || '', { syncMobile: false });
        const search = document.getElementById('patientSearch');
        if (search) search.value = this.query;
        this.apply();
        this.onSwitchView?.('patients');
        Popover.close(panel);
      });
    });
  }

  /* ------------------------------------------------------------------
   *  Private – filter chips
   * ----------------------------------------------------------------*/

  _bindFilterChips () {
    const group = document.querySelector('[aria-label="Filter patients"]');
    wireChips(group, label => { this.status = label; this.apply(); });
  }

  /* ------------------------------------------------------------------
   *  Private – apply filter + render
   * ----------------------------------------------------------------*/

  apply () {
    const tbody = document.getElementById('patientsBody');
    if (!tbody) return;
    const q = this.query.trim().toLowerCase();
    const list = this.mock.patients.filter(p => {
      const okContract = !!p.contract;
      const okStatus   = this.status === 'All' || p.status === this.status;
      const okQuery    = !q || [p.name, p.id, p.contact].some(v => String(v).toLowerCase().includes(q));
      return okContract && okStatus && okQuery;
    });
    this.patientsList = list;
    if (!list.length) {
      const extra = this.status !== 'All' ? ` for "${this.status}"` : '';
      tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No patients match${q ? ` "${escapeHtml(q)}"` : extra}. Try a different search or filter.</td></tr>`;
      return;
    }
    this._renderTable(list);
  }

  _renderTable (patients) {
    const tbody = document.getElementById('patientsBody');
    if (!tbody) return;
    tbody.innerHTML = patients.map(p =>
      `<tr>
        <td>${nameCell(p.initials, p.name, p.id)}</td>
        <td>${p.contact}</td>
        <td>${p.lastVisit}</td>
        <td>${p.balance}</td>
        <td>${statusTag(p)}</td>
        <td><div class="row-actions">
          <button class="icon-btn" data-action="view" data-id="${p.id}" aria-label="View ${p.name}">${eyeIcon}</button>
          <button class="icon-btn" data-action="edit" data-id="${p.id}" aria-label="Edit ${p.name}">${pencilIcon}</button>
          <button class="icon-btn" data-action="delete" data-id="${p.id}" aria-label="Delete ${p.name}">${trashIcon}</button>
        </div></td>
      </tr>`
    ).join('');
  }

  _bindRowActions () {
    document.getElementById('patientsBody')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const patient = this.mock.patients.find(p => p.id === btn.dataset.id);
      if (!patient) return;
      if (btn.dataset.action === 'view')   this._openDetail(patient);
      else if (btn.dataset.action === 'edit') this._openForm(patient);
      else if (btn.dataset.action === 'delete') this._openDelete(patient);
    });
  }

  /* ------------------------------------------------------------------
   *  Private – detail modal
   * ----------------------------------------------------------------*/

  _bindDetailModal () {
    this._detailModal = new Modal('detailModal');
    if (!this._detailModal.modal) return;
    this._detailModal.registerClose(document.getElementById('detailCancelBtn'));
    this._detailModal.registerClose(document.getElementById('detailClose'));
    document.getElementById('detailEditBtn')?.addEventListener('click', () => {
      if (this._detailCurrent) this._openForm(this._detailCurrent);
    });
  }

  _openDetail (p) {
    this._detailCurrent = p;
    if (!this._detailModal.modal) return;
    document.getElementById('detailTitle').textContent = 'Patient Details';
    document.getElementById('detailRows').innerHTML = [
      ['Patient ID', p.id], ['Contract', p.contract || '—'], ['Contact', p.contact],
      ['Last Visit', p.lastVisit], ['Balance', p.balance],
      ['Status', `<span class="tag tag-${p.tag}">${p.status}</span>`]
    ].map(([label, value]) => `<div class="row"><span>${label}</span><span>${value}</span></div>`).join('');
    document.getElementById('detailEditBtn').hidden = false;
    this._detailModal.open();
  }

  /* ------------------------------------------------------------------
   *  Private – add/edit form modal
   * ----------------------------------------------------------------*/

  _bindFormModal () {
    this._formModal = new Modal('patientFormModal');
    if (!this._formModal.modal) return;
    this._formModal.registerClose(document.getElementById('patientFormClose'));
    this._formModal.registerClose(document.getElementById('patientFormCancel'));

    document.getElementById('addPatientBtn')?.addEventListener('click', () => this._openForm(null));

    const saveBtn = document.getElementById('patientFormSave');
    saveBtn?.addEventListener('click', () => {
      const name    = document.getElementById('pfName').value.trim();
      const contact = document.getElementById('pfContact').value.trim();
      if (!name || !contact) {
        this._showFormNote('Name and contact number are required.', true);
        return;
      }
      saveBtn.classList.add('is-loading');
      setTimeout(() => {
        saveBtn.classList.remove('is-loading');
        if (this._editingPatient) {
          Object.assign(this._editingPatient, {
            name, contact,
            lastVisit: document.getElementById('pfLastVisit').value.trim() || this._editingPatient.lastVisit,
            balance: document.getElementById('pfBalance').value.trim() || this._editingPatient.balance,
            status: document.getElementById('pfStatus').value,
            initials: this._initialsOf(name),
            tag: this._tagFor(document.getElementById('pfStatus').value)
          });
        } else {
          this.mock.patients.unshift({
            initials: this._initialsOf(name), name,
            id: '#P-10' + (1070 + this.mock.patients.length),
            contact,
            lastVisit: document.getElementById('pfLastVisit').value.trim() || '—',
            balance: document.getElementById('pfBalance').value.trim() || '₱0.00',
            status: document.getElementById('pfStatus').value,
            tag: this._tagFor(document.getElementById('pfStatus').value),
            contract: '#B-' + (350 + this.mock.patients.length)
          });
          this.status = 'All';
          const group = document.querySelector('[aria-label="Filter patients"]');
          setChipGroup(group, 'All');
        }
        this._formModal.close();
        this.apply();
        showToast(this._editingPatient ? 'Patient updated' : 'Patient added');
      }, 500);
    });

    this._formModal.modal.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); saveBtn?.click(); }
    });
  }

  _openForm (patient) {
    this._editingPatient = patient || null;
    document.getElementById('patientFormTitle').textContent = patient ? 'Edit Patient' : 'Add Patient';
    document.getElementById('patientFormSave').querySelector('.btn-label').textContent = patient ? 'Save Changes' : 'Add Patient';
    document.getElementById('pfName').value     = patient ? patient.name : '';
    document.getElementById('pfContact').value  = patient ? patient.contact : '';
    document.getElementById('pfLastVisit').value = patient ? patient.lastVisit : '';
    document.getElementById('pfBalance').value   = patient ? patient.balance : '';
    document.getElementById('pfStatus').value    = patient ? patient.status : 'Current';
    document.getElementById('patientFormNote').hidden = true;
    this._formModal.open();
  }

  _showFormNote (msg, isError) {
    const el = document.getElementById('patientFormNote');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
    el.classList.toggle('ok', !isError);
    el.hidden = false;
  }

  /* ------------------------------------------------------------------
   *  Private – delete confirm modal
   * ----------------------------------------------------------------*/

  _bindDeleteModal () {
    this._deleteModal = new Modal('deleteModal');
    if (!this._deleteModal.modal) return;
    this._deleteModal.registerClose(document.getElementById('deleteClose'));
    this._deleteModal.registerClose(document.getElementById('deleteCancelBtn'));
    document.getElementById('deleteConfirmBtn')?.addEventListener('click', () => {
      if (!this._deletingPatient) return;
      const removed = this._deletingPatient;
      this.mock.patients = this.mock.patients.filter(p => p !== removed);
      this._deleteModal.close();
      this._deletingPatient = null;
      this.apply();
      showToast(removed.name + ' deleted (mock)');
    });
  }

  _openDelete (patient) {
    this._deletingPatient = patient;
    document.getElementById('deleteText').textContent = `Delete ${patient.name} (${patient.id})? This action can't be undone.`;
    this._deleteModal.open();
  }

  /* ------------------------------------------------------------------
   *  Private – helpers
   * ----------------------------------------------------------------*/

  _initialsOf (name) {
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  _tagFor (status) {
    if (status === 'Current') return 'amber';
    if (status === 'Overdue') return 'red';
    return 'green';
  }
};
