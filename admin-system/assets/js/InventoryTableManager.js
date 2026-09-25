/**
 * InventoryTableManager - Inventory filter and clinic supply form.
 */
/* global Modal, showToast, escapeHtml, nameCell, statusTag, statCard, wireChips, apiFetch, ASDC */
window.InventoryTableManager = class InventoryTableManager {
  constructor ({ state } = {}) {
    this.state = state;
    this.filter = 'All';
    this.inventoryList = [];
    this.modal = null;
    this.usageModal = null;
    this.editingItem = null;
    this.editingRule = null;
    this.usageRules = [];
  }

  init () {
    this._bindFilterChips();
    this._bindFormModal();
    this._bindUsageRules();
    this._loadUsageRules();
    this.apply();
  }

  getFilteredList () { return this.inventoryList; }

  normalize (item) {
    const qty = Number(item.qty ?? item.stock_quantity ?? 0);
    const reorder = Math.max(0, Number(item.reorder_level ?? 0));
    const unit = String(item.unit || '').trim();
    const status = qty <= 0 ? 'Out of stock' : (reorder > 0 && qty <= reorder ? 'Low' : 'Available');
    const tag = qty <= 0 ? 'red' : (status === 'Low' ? 'amber' : 'green');
    const width = Math.max(5, Math.min(100, reorder > 0 ? Math.round((qty / Math.max(reorder * 2, 1)) * 100) : 100));
    const fill = tag === 'red' ? 'var(--red)' : (tag === 'amber' ? 'var(--gold)' : 'var(--green)');
    return {
      ...item,
      id: Number(item.id ?? item.item_id),
      item: item.item || item.item_name || '',
      qty,
      unit,
      reorder_level: reorder,
      initials: '',
      stock: unit ? `${qty} ${unit}` : String(qty),
      width,
      fill,
      status,
      tag
    };
  }

  apply () {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;
    this.state.inventory = (this.state.inventory || []).map(i => this.normalize(i));
    this._renderStats(this.state.inventory);

    let list = this.state.inventory;
    if (this.filter === 'Low stock') list = list.filter(i => i.status === 'Low' || i.status === 'Out of stock' || i.status === 'Reorder');
    else if (this.filter === 'Consumables') list = list.filter(i => i.category === 'Consumable');
    else if (this.filter === 'Equipment') list = list.filter(i => i.category === 'Equipment');

    this.inventoryList = list;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No inventory items match this filter.</td></tr>';
      return;
    }
    this._renderTable(list);
  }

  _renderStats (items) {
    const target = document.getElementById('inventoryStats');
    if (!target) return;
    const low = items.filter(i => i.status === 'Low' || i.status === 'Out of stock').length;
    const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    target.innerHTML = [
      statCard({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 16-9 5-9-5"/><path d="m21 12-9 5-9-5"/><path d="M3 8l9-5 9 5-9 5-9-5Z"/></svg>',
        iconBg: 'rgba(177,158,69,0.16)',
        iconColor: 'var(--gold-dark)',
        num: items.length,
        label: 'Clinic Supplies',
        trend: 'Tracked Items',
        trendClass: 'trend-up'
      }),
      statCard({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
        iconBg: low ? 'rgba(180,84,63,0.12)' : 'rgba(92,122,92,0.12)',
        iconColor: low ? 'var(--red-text)' : 'var(--green-text)',
        num: low,
        label: 'Needs Reorder',
        trend: low ? 'Review Stock' : 'Stock Healthy',
        trendClass: low ? 'trend-down' : 'trend-up'
      }),
      statCard({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V8"/><path d="M20 20V8"/><path d="M2 20h20"/><path d="M6 8V4h12v4"/><path d="M4 8h16"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>',
        iconBg: 'rgba(92,122,92,0.12)',
        iconColor: 'var(--green-text)',
        num: totalQty,
        label: 'Units On Hand',
        trend: 'Current Stock',
        trendClass: 'trend-up'
      })
    ].join('');
  }

  _renderTable (items) {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;
    tbody.innerHTML = items.map(i =>
      `<tr>
        <td>${this._stockNameCell(i.item)}</td>
        <td>${escapeHtml(i.category || '')}</td>
        <td>${escapeHtml(i.qty)}</td>
        <td>${escapeHtml(i.unit || 'None')}</td>
        <td>${escapeHtml(this._formatDate(i.last_restocked))}</td>
        <td>${statusTag(i)}</td>
        <td>
          <div class="inventory-actions">
            <button type="button" class="btn btn-outline btn-sm" data-action="edit-inventory" data-id="${i.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-inventory" data-id="${i.id}">Delete</button>
          </div>
        </td>
      </tr>`
    ).join('');
  }

  _stockNameCell (name) {
    return `<div class="cell-name">
      <div class="mini-avatar inventory-stock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          <path d="m3.3 7 8.7 5 8.7-5"/>
          <path d="M12 22V12"/>
        </svg>
      </div>
      <div class="name-block"><div class="full">${escapeHtml(name)}</div></div>
    </div>`;
  }

  _formatDate (value) {
    if (!value) return 'Not recorded';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  _bindFilterChips () {
    const group = document.querySelector('[aria-label="Filter inventory"]');
    wireChips(group, label => { this.filter = label; this.apply(); });
  }

  _bindFormModal () {
    const modalEl = document.getElementById('inventoryFormModal');
    if (!modalEl) return;
    this.modal = new Modal('inventoryFormModal');

    document.getElementById('addInventoryBtn')?.addEventListener('click', () => this._openForm());
    document.getElementById('inventoryFormClose')?.addEventListener('click', () => this.modal.close());
    document.getElementById('inventoryFormCancel')?.addEventListener('click', () => this.modal.close());
    document.getElementById('inventoryFormSave')?.addEventListener('click', () => this._save());

    document.getElementById('inventoryBody')?.addEventListener('click', async event => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      const item = this.state.inventory.find(i => String(i.id) === String(btn.dataset.id));
      if (!item) return;
      if (btn.dataset.action === 'edit-inventory') {
        this._openForm(item);
      } else if (btn.dataset.action === 'delete-inventory') {
        await this._delete(item);
      }
    });
  }

  _fields () {
    return {
      title: document.getElementById('inventoryFormTitle'),
      name: document.getElementById('ivName'),
      category: document.getElementById('ivCategory'),
      stock: document.getElementById('ivStock'),
      unit: document.getElementById('ivUnit'),
      reorder: document.getElementById('ivReorder'),
      restocked: document.getElementById('ivRestocked'),
      note: document.getElementById('inventoryFormNote'),
      save: document.getElementById('inventoryFormSave')
    };
  }

  _openForm (item = null) {
    const f = this._fields();
    this.editingItem = item ? this.normalize(item) : null;
    f.title.textContent = this.editingItem ? 'Edit Inventory Item' : 'Add Inventory Item';
    f.name.value = this.editingItem?.item || '';
    f.category.value = this.editingItem?.category || 'Consumable';
    f.stock.value = this.editingItem ? this.editingItem.qty : '';
    f.unit.value = this.editingItem?.unit || '';
    f.reorder.value = this.editingItem ? this.editingItem.reorder_level : '10';
    f.restocked.value = this.editingItem?.last_restocked || '';
    f.note.hidden = true;
    f.note.textContent = '';
    f.note.className = 'form-note';
    f.save.querySelector('.btn-label').textContent = this.editingItem ? 'Save Changes' : 'Add Item';
    this.modal.open(document.getElementById('addInventoryBtn'));
    f.name.focus();
  }

  async _save () {
    const f = this._fields();
    const payload = {
      item: f.name.value.trim(),
      category: f.category.value,
      qty: Number(f.stock.value),
      unit: f.unit.value.trim(),
      reorder_level: Number(f.reorder.value || 0),
      last_restocked: f.restocked.value
    };
    if (this.editingItem) payload.id = this.editingItem.id;

    f.save.disabled = true;
    f.note.hidden = true;
    try {
      const data = await apiFetch('../backend/api/inventory/items.php', {
        method: this.editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      this._replaceInventory(data.inventory);
      this.modal.close();
      showToast(this.editingItem ? 'Inventory item updated.' : 'Inventory item added.');
    } catch (error) {
      f.note.textContent = error.message || 'Unable to save inventory item.';
      f.note.className = 'form-note err';
      f.note.hidden = false;
    } finally {
      f.save.disabled = false;
    }
  }

  async _delete (item) {
    const confirmed = await ASDC.confirmAction({
      title: 'Delete inventory item',
      message: `Remove ${item.item} from clinic supplies?`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      const data = await apiFetch('../backend/api/inventory/items.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });
      this._replaceInventory(data.inventory);
      showToast('Inventory item deleted.');
    } catch (error) {
      showToast(error.message || 'Unable to delete inventory item.');
    }
  }

  _replaceInventory (items) {
    this.state.inventory = (items || []).map(i => this.normalize(i));
    this.apply();
  }

  async _loadUsageRules () {
    try { const data = await apiFetch('../backend/api/inventory/usage-rules.php'); this.usageRules = data.rules || []; this._renderUsageRules(); } catch (_) { this._renderUsageRules(); }
  }

  _renderUsageRules () {
    const body = document.getElementById('usageRulesBody');
    if (!body) return;
    body.innerHTML = this.usageRules.length ? this.usageRules.map(rule => `<tr><td>${escapeHtml(rule.service_name)}</td><td>${escapeHtml(rule.item_name)}</td><td>${escapeHtml(rule.quantity_required)} ${escapeHtml(rule.unit || '')}</td><td><button class="btn btn-outline btn-sm" data-rule="${rule.rule_id}">Edit</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty-cell">Add a rule to deduct supplies automatically when a treatment is completed.</td></tr>';
  }

  _bindUsageRules () {
    if (!document.getElementById('usageRuleModal')) return;
    this.usageModal = new Modal('usageRuleModal');
    document.getElementById('addUsageRuleBtn')?.addEventListener('click', () => this._openUsageRule());
    ['usageRuleClose', 'usageRuleCancel'].forEach(id => document.getElementById(id)?.addEventListener('click', () => this.usageModal.close()));
    document.getElementById('usageRuleSave')?.addEventListener('click', () => this._saveUsageRule());
    document.getElementById('usageRulesBody')?.addEventListener('click', event => { const button = event.target.closest('[data-rule]'); if (button) this._openUsageRule(this.usageRules.find(rule => String(rule.rule_id) === button.dataset.rule)); });
  }

  _openUsageRule (rule = null) {
    const items = (this.state.inventory || []).map(item => this.normalize(item));
    if (!items.length) { showToast('Add an inventory supply before creating a usage rule.', 'error'); return; }
    this.editingRule = rule || null;
    document.getElementById('usageRuleTitle').textContent = rule ? 'Edit Automatic Usage Rule' : 'Add Automatic Usage Rule';
    document.getElementById('usageService').value = rule?.service_name || '';
    document.getElementById('usageItem').innerHTML = items.map(item => `<option value="${item.id}" ${Number(rule?.item_id) === item.id ? 'selected' : ''}>${escapeHtml(item.item)}</option>`).join('');
    document.getElementById('usageQuantity').value = rule?.quantity_required || 1;
    document.getElementById('usageRuleNote').hidden = true;
    this.usageModal.open(document.getElementById('addUsageRuleBtn'));
  }

  async _saveUsageRule () {
    const note = document.getElementById('usageRuleNote');
    const payload = { service_name: document.getElementById('usageService').value.trim(), item_id: Number(document.getElementById('usageItem').value), quantity_required: Number(document.getElementById('usageQuantity').value) };
    if (this.editingRule) payload.rule_id = this.editingRule.rule_id;
    try {
      const data = await apiFetch('../backend/api/inventory/usage-rules.php', { method: this.editingRule ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      this.usageRules = data.rules || []; this._renderUsageRules(); this.usageModal.close(); showToast('Automatic usage rule saved.');
    } catch (error) { note.textContent = error.message || 'Unable to save usage rule.'; note.hidden = false; }
  }
};
