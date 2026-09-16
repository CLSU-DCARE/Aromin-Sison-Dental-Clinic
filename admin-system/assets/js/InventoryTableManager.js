/**
 * InventoryTableManager – Inventory filter and add item form.
 *
 * Replaces lines 375-400 and 921-971 of admin.js.
 *
 * Usage:
 *   const invMgr = new InventoryTableManager({ state: AdminState });
 *   invMgr.init();
 */
/* global Modal, showToast, escapeHtml, nameCell, statusTag, wireChips */
window.InventoryTableManager = class InventoryTableManager {
  constructor ({ state } = {}) {
    this.state         = state;
    this.filter       = 'All';
    this.inventoryList = [];
  }

  init () {
    this._bindFilterChips();
    this._bindFormModal();
    this.apply();
  }

  getFilteredList () { return this.inventoryList; }

  /* ------------------------------------------------------------------
   *  Apply filter + render
   * ----------------------------------------------------------------*/

  apply () {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;
    let list = this.state.inventory;
    if (this.filter === 'Low stock')     list = list.filter(i => i.status === 'Low' || i.status === 'Reorder');
    else if (this.filter === 'Consumables') list = list.filter(i => i.category === 'Consumable');
    else if (this.filter === 'Equipment')   list = list.filter(i => i.category === 'Equipment');
    this.inventoryList = list;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No inventory items match this filter.</td></tr>';
      return;
    }
    this._renderTable(list);
  }

  _renderTable (items) {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;
    tbody.innerHTML = items.map(i =>
      `<tr>
        <td>${nameCell(i.initials, i.item)}</td>
        <td>${escapeHtml(i.category || '')}</td>
        <td>${escapeHtml(i.stock)}</td>
        <td><span class="stock-bar"><span class="stock-fill" style="width:${i.width}%;background:${i.fill};"></span></span></td>
        <td>${statusTag(i)}</td>
      </tr>`
    ).join('');
  }

  /* ------------------------------------------------------------------
   *  Private – filter chips
   * ----------------------------------------------------------------*/

  _bindFilterChips () {
    const group = document.querySelector('[aria-label="Filter inventory"]');
    wireChips(group, label => { this.filter = label; this.apply(); });
  }

  /* ------------------------------------------------------------------
   *  Private – add item form
   * ----------------------------------------------------------------*/

  _bindFormModal () {
    const button = document.getElementById('addInventoryBtn');
    if (button) { button.disabled = true; button.title = 'Inventory management is unavailable.'; }
  }
};
