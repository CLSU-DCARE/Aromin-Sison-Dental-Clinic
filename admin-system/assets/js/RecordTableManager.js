/**
 * RecordTableManager – Records table filter, checkbox selection, view details, and add form.
 *
 * Replaces lines 258-348 and 685-750 of admin.js.
 *
 * Usage:
 *   const recordMgr = new RecordTableManager({ state: AdminState });
 *   recordMgr.init();
 */
/* global Modal, showToast, escapeHtml, nameCell, statusTag, eyeIcon, wireChips */
window.RecordTableManager = class RecordTableManager {
  constructor ({ state } = {}) {
    this.state            = state;
    this.filter          = null;
    this.recordsList     = [];
    this.selectedRecords = new Set();
    this._formModal      = null;
  }

  init () {
    this._bindFilterChips();
    this._bindSelectAll();
    this._bindCheckboxes();
    this._bindViewAction();
    this._bindFormModal();
    this.apply();
  }

  getFilteredList () { return this.recordsList; }

  getSelectedRecords () { return this.selectedRecords; }

  clearSelection () { this.selectedRecords.clear(); this.apply(); }

  /* ------------------------------------------------------------------
   *  Apply filter + render
   * ----------------------------------------------------------------*/

  apply () {
    const tbody = document.getElementById('recordsBody');
    if (!tbody) return;
    const contractNames = new Set(this.state.patients.filter(p => p.contract).map(p => p.name));
    const list = (this.filter ? this.state.records.filter(r => r.category === this.filter) : this.state.records)
      .filter(r => contractNames.has(r.name));
    this.recordsList = list;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Treatment records are unavailable.</td></tr>';
      this._syncSelectAll();
      return;
    }
    this._renderTable(list);
  }

  _renderTable (records) {
    const tbody = document.getElementById('recordsBody');
    if (!tbody) return;
    tbody.innerHTML = records.map((r, i) =>
      `<tr>
        <td class="check-cell"><input type="checkbox" class="row-check" data-index="${i}" ${this.selectedRecords.has(r) ? 'checked' : ''} aria-label="Select record: ${r.procedure}"></td>
        <td>${nameCell(r.initials, r.name)}</td>
        <td>${r.procedure}</td>
        <td>${r.date}</td>
        <td>${r.dentist}</td>
        <td>${statusTag(r)}</td>
        <td><div class="row-actions"><button class="icon-btn" data-action="view" data-index="${i}" aria-label="View record: ${r.procedure}">${eyeIcon}</button></div></td>
      </tr>`
    ).join('');
    this._syncSelectAll();
  }

  _syncSelectAll () {
    const selectAll = document.getElementById('selectAllRecords');
    if (!selectAll) return;
    const visible = this.recordsList.filter(r => this.selectedRecords.has(r)).length;
    selectAll.checked = this.recordsList.length > 0 && visible === this.recordsList.length;
    selectAll.indeterminate = visible > 0 && visible < this.recordsList.length;
  }

  /* ------------------------------------------------------------------
   *  Private – filter chips
   * ----------------------------------------------------------------*/

  _bindFilterChips () {
    const group = document.querySelector('[aria-label="Filter records"]');
    wireChips(group, label => {
      this.filter = label === 'All' ? null : (label === 'Treatments' ? 'Treatment' : (label === 'Protocols' ? 'Protocol' : label));
      this.apply();
    });
  }

  /* ------------------------------------------------------------------
   *  Private – checkboxes + select-all
   * ----------------------------------------------------------------*/

  _bindCheckboxes () {
    document.getElementById('recordsBody')?.addEventListener('change', e => {
      const cb = e.target.closest('.row-check');
      if (!cb) return;
      const record = this.recordsList[Number(cb.dataset.index)];
      if (!record) return;
      if (cb.checked) this.selectedRecords.add(record);
      else this.selectedRecords.delete(record);
      this._syncSelectAll();
    });
  }

  _bindSelectAll () {
    document.getElementById('selectAllRecords')?.addEventListener('change', e => {
      if (e.target.checked) {
        this.recordsList.forEach(r => this.selectedRecords.add(r));
      } else {
        this.recordsList.forEach(r => this.selectedRecords.delete(r));
      }
      this.apply();
    });
  }

  /* ------------------------------------------------------------------
   *  Private – view record detail
   * ----------------------------------------------------------------*/

  _bindViewAction () {
    document.getElementById('recordsBody')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="view"]');
      if (!btn) return;
      const record = this.recordsList[Number(btn.dataset.index)];
      if (!record) return;
      this._openDetail('Record Details', [
        ['Patient', record.name], ['Procedure', record.procedure], ['Date', record.date],
        ['Dentist', record.dentist], ['Status', `<span class="tag tag-${record.tag}">${record.status}</span>`]
      ]);
    });
  }

  _openDetail (title, rows) {
    const modal = new Modal('detailModal');
    if (!modal.modal) return;
    modal.registerClose(document.getElementById('detailCancelBtn'));
    modal.registerClose(document.getElementById('detailClose'));
    document.getElementById('detailTitle').textContent = title;
    document.getElementById('detailRows').innerHTML = rows.map(([label, value]) =>
      `<div class="row"><span>${label}</span><span>${value}</span></div>`
    ).join('');
    document.getElementById('detailEditBtn').hidden = true;
    modal.open();
  }

  /* ------------------------------------------------------------------
   *  Private – add record form
   * ----------------------------------------------------------------*/

  _bindFormModal () {
    const button = document.getElementById('addRecordBtn');
    if (button) { button.disabled = true; button.title = 'Treatment records management is unavailable.'; }
  }
};
