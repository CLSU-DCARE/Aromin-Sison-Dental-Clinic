/**
 * InventoryTableManager – Inventory filter and add item form.
 *
 * Replaces lines 375-400 and 921-971 of admin.js.
 *
 * Usage:
 *   const invMgr = new InventoryTableManager({ mock: AdminMock });
 *   invMgr.init();
 */
/* global Modal, showToast, escapeHtml, nameCell, statusTag, wireChips */
window.InventoryTableManager = class InventoryTableManager {
  constructor ({ mock } = {}) {
    this.mock         = mock;
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
    let list = this.mock.inventory;
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
        <td>${i.category}</td>
        <td>${i.stock}</td>
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
    const modal = new Modal('inventoryFormModal');
    if (!modal.modal) return;
    modal.registerClose(document.getElementById('inventoryFormClose'));
    modal.registerClose(document.getElementById('inventoryFormCancel'));

    const noteEl  = document.getElementById('inventoryFormNote');
    const saveBtn = document.getElementById('inventoryFormSave');

    document.getElementById('addInventoryBtn')?.addEventListener('click', () => {
      document.getElementById('ivName').value     = '';
      document.getElementById('ivStock').value    = '';
      document.getElementById('ivCategory').value = 'Consumable';
      noteEl.hidden = true;
      modal.open();
    });

    saveBtn?.addEventListener('click', () => {
      const name  = document.getElementById('ivName').value.trim();
      const stock = Number(document.getElementById('ivStock').value);
      if (!name) {
        noteEl.textContent = 'Item name is required.';
        noteEl.classList.add('err'); noteEl.classList.remove('ok'); noteEl.hidden = false;
        return;
      }
      if (!Number.isFinite(stock) || stock < 0) {
        noteEl.textContent = 'Enter a valid stock quantity.';
        noteEl.classList.add('err'); noteEl.classList.remove('ok'); noteEl.hidden = false;
        return;
      }
      const status = stock <= 5 ? 'Reorder' : (stock <= 10 ? 'Low' : 'OK');
      const tag    = status === 'Reorder' ? 'red' : (status === 'Low' ? 'amber' : 'green');
      this.mock.inventory.unshift({
        initials: name.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        item: name,
        category: document.getElementById('ivCategory').value,
        stock: String(stock),
        width: String(Math.min(Math.max(stock * 5, 8), 100)),
        fill: tag === 'red' ? 'var(--red)' : (tag === 'amber' ? 'var(--amber)' : 'var(--green)'),
        status, tag
      });
      modal.close();
      this.apply();
      showToast('Inventory item added');
    });
  }
};
