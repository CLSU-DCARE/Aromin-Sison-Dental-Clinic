// =====================================================================
// ADMIN DASHBOARD: page-specific logic
// Shared utilities (Modal, toast, sidebar, fullscreen, logout, Popover,
// notifications) live in ../shared/js/dashboard-core.js and are loaded
// before this file. Dashboard state starts empty and loads from the API.
//
// Interactive controls wired here:
//   - sidebar nav (switchView)          - filter chips per table
//   - topbar search (patients, live)    - appointment Week/Day/List
//   - mobile search popover             - report period chips
//   - notifications popover             - user chip / account menu
//   - patient table: view / edit / add / delete (state modals)
// =====================================================================

// =====================================================================
// Helpers & shared cell builders — now provided by ASDC.HtmlHelpers
// (escapeHtml, nameCell, statusTag, statCard, eyeIcon, pencilIcon,
// trashIcon are global via dashboard-core.js).
// PDF export — now provided by ASDC.ReportExporter
// (exportTablePDF, getLogoDataUrl are global via dashboard-core.js).
// =====================================================================

const views = {
  dashboard: { title: 'Dashboard', crumb: 'Overview' },
  patients: { title: 'Patient Management', crumb: 'Patients' },
  records: { title: 'Records & Protocols', crumb: 'Patients' },
  appointments: { title: 'Appointment Scheduling', crumb: 'Scheduling' },
  braces: { title: 'Braces Contracts', crumb: 'Scheduling' },
  payments: { title: 'Payment Approvals', crumb: 'Operations' },
  promotions: { title: 'Promotions', crumb: 'Marketing' },
  reports: { title: 'Attendance Reports', crumb: 'Operations' },
  inventory: { title: 'Inventory', crumb: 'Operations' },
  notifications: { title: 'Notifications', crumb: 'Operations' }
};

function switchView(view){
  const target = document.getElementById('view-' + view);
  if (!target || target.classList.contains('active')) return;

  document.querySelectorAll('.nav-item').forEach(el => {
    const active = el.dataset.view === view;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });

  const meta = views[view] || { title: view, crumb: '' };
  document.getElementById('viewTitle').textContent = meta.title;
  const crumbEl = document.getElementById('viewCrumb');
  if (crumbEl) crumbEl.textContent = meta.crumb;

  // Crossfade: let the current view slide out first, then swap in the new
  // one (durations match viewOut/viewIn in admin.css).
  const current = document.querySelector('.view.active');
  const swap = () => {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active', 'view-leave'));
    target.classList.add('active');
    window.scrollTo({top:0, behavior:'smooth'});
    closeSidebar();
    announce('Showing ' + meta.title);
  };
  if (current && current !== target){
    current.classList.add('view-leave');
    setTimeout(swap, 180);
  } else {
    swap();
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ---------- Filter chips: shared wiring for every segmented control ----------
function wireChips(group, onChange){
  if (!group) return;
  group.addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    group.querySelectorAll('.filter-chip').forEach(c => {
      const active = c === chip;
      c.classList.toggle('active', active);
      c.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    onChange(chip.textContent.trim());
  });
}

function setChipGroup(group, label){
  if (!group) return;
  group.querySelectorAll('.filter-chip').forEach(c => {
    const active = c.textContent.trim() === label;
    c.classList.toggle('active', active);
    c.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

// ---------- Patient table (delegated to PatientTableManager) ----------
const patientMgr = new PatientTableManager({ state: AdminState, onSwitchView: switchView });
patientMgr.init();

// =====================================================================
// RECORDS TABLE: category filter + view details (delegated to RecordTableManager)
// =====================================================================
const recordMgr = new RecordTableManager({ state: AdminState });
recordMgr.init();

// =====================================================================
// BRACES CONTRACTS TABLE: status filter
// =====================================================================
let bracesFilter = 'Current'; // SCOPE: default to current/delinquent contracts only
let bracesList = [];          // last filtered rows shown (used by Export)

async function applyBraces(snapshot = null){
  if (!snapshot && window.staffSnapshot) snapshot = window.staffSnapshot;
  if (!snapshot && window.staffLiveSync) return window.staffLiveSync.refetch();
  const tbody = document.getElementById('bracesBody');
  if (!tbody) return;

  let raw;
  try {
    const data = snapshot || await apiFetch('../backend/api/contracts/contracts.php');
    if (!Array.isArray(data.contracts)) throw new Error('not_implemented');
    raw = data.contracts;
  } catch (error) {
    if (!bracesRaw.length) tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Unable to load contracts. Please try again.</td></tr>';
    return;
  }
  bracesRaw = raw;

  const all = raw.map(c => ({
    id: c.id, initials: c.initials, name: c.name,
    plan: c.plan, monthly: ContractFormat.peso(c.monthly),
    paid: ContractFormat.peso(c.paid), balance: ContractFormat.peso(c.balance),
    status: c.status, tag: c.tag
  }));

  const list = bracesFilter ? all.filter(c => c.status === bracesFilter) : all;
  bracesList = list;
  if (!list.length){
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No contracts match this filter.</td></tr>`;
    return;
  }
  renderBraces(list);
}

const bracesGroup = document.querySelector('[aria-label="Filter contracts"]');
wireChips(bracesGroup, label => {
  bracesFilter = label === 'All' ? null : label;
  applyBraces();
});
setChipGroup(bracesGroup, 'Current');

// =====================================================================
// INVENTORY TABLE: category / stock-level filter (delegated to InventoryTableManager)
// =====================================================================
const inventoryMgr = new InventoryTableManager({ state: AdminState });
inventoryMgr.init();

// =====================================================================
// APPOINTMENTS: Week / Day / List view modes
// =====================================================================
const appointmentScheduler = new AppointmentScheduler({
  apiBase: '../backend/api/appointments',
  onLoaded: state => {
    if (state.error) {
      return;
    }
    const week = ASDC.ScheduleView.week(state.start, state.appointments);
    renderWeekGrid('dashWeekGrid', week);
    document.getElementById('dashWeekLabel').textContent = week.label;
    renderQueue(ASDC.ScheduleView.queue(state.appointments));
  }
});
const appointmentActions  = new AppointmentActions({ scheduler: appointmentScheduler });
appointmentScheduler.init();
appointmentActions.init();
const apptGroup = document.querySelector('[aria-label="Filter schedule"]');
wireChips(apptGroup, label => appointmentScheduler.setMode(label));

// =====================================================================
// REPORTS: period chips update the panel heading (state period switch)
// =====================================================================
const reportGroup = document.querySelector('[aria-label="Report period"]');
wireChips(reportGroup, label => {
  const heading = document.getElementById('reportHeading');
  if (heading) heading.textContent = 'Attendance: ' + label;
});

// =====================================================================
// NOTIFICATIONS + ACCOUNT MENU
// =====================================================================
const inbox = initNotifications({ triggerId: 'notifBtn', panelId: 'notifPanel', listId: 'notifList', badgeId: 'notifBadge', markAllId: 'notifMarkAll', emptyId: 'notifEmpty', notifications: [] });
const inboxEmpty = document.getElementById('notifEmpty');
if (inboxEmpty) inboxEmpty.textContent = 'Loading notifications…';

const userChip = document.getElementById('userChip');
const userMenu = document.getElementById('userMenu');
if (userChip && userMenu){
  userChip.addEventListener('click', () => Popover.toggle(userChip, userMenu));
  const signOut = document.getElementById('menuSignOut');
  if (signOut){
    signOut.addEventListener('click', () => {
      Popover.close(userMenu);
      openLogoutConfirm(userChip);
    });
  }
}

// =====================================================================
// PATIENT MODALS: delegated to PatientTableManager
// =====================================================================

// =====================================================================
// RECORDS: add new treatment record (delegated to RecordTableManager)
// =====================================================================

// =====================================================================
// BRACES CONTRACTS: create and update through the server
// =====================================================================
const contractFormModal = new Modal('contractFormModal');
let editingContract = null;
let bracesRaw = []; // Last loaded contracts, used by the edit form.
const peso = n => '₱' + Number(n).toLocaleString('en-US');
// small helpers used by the contract form (same rules PatientTableManager uses)
const initialsOf = name => name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const tagFor = status => {
  if (status === 'Current') return 'amber';
  if (status === 'Overdue') return 'red';
  return 'green';
};

if (contractFormModal.modal){
  contractFormModal.registerClose(document.getElementById('contractFormClose'));
  contractFormModal.registerClose(document.getElementById('contractFormCancel'));

  const cfPatient = document.getElementById('cfPatient');
  const cfDentist = document.getElementById('cfDentist');

  const fillPatients = async () => {
    try {
      const data = await apiFetch('../backend/api/patients/list.php');
      if (!Array.isArray(data.patients) || !data.patients.length) throw new Error('empty');
      cfPatient.innerHTML = data.patients.map(p =>
        `<option value="${p.patient_id}">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)} (#P-${p.patient_id})</option>`
      ).join('');
    } catch (e) {
      cfPatient.innerHTML = '';
      showToast('Unable to load patients.', 'error');
    }
  };

  const fillDentists = async () => {
    try {
      const data = await apiFetch('../backend/api/contracts/dentists.php');
      if (!Array.isArray(data.dentists) || !data.dentists.length) throw new Error('empty');
      // Real mode needs the numeric user_id (what the backend expects for
      // dentist_id) — the display name alone isn't enough to save it.
      cfDentist.innerHTML = data.dentists.map(d => `<option value="${d.user_id}">${escapeHtml(d.full_name)}</option>`).join('');
    } catch (e) { cfDentist.innerHTML = ''; showToast('Unable to load dentists.', 'error'); }
  };

  fillPatients();
  fillDentists();

  const contractNote = document.getElementById('contractFormNote');
  const contractSaveBtn = document.getElementById('contractFormSave');

  async function openContractForm(contract){
    await Promise.all([fillPatients(), fillDentists()]);
    editingContract = contract || null;
    document.getElementById('contractFormTitle').textContent = contract
      ? 'Edit Contract — ' + contract.name
      : 'New Braces Contract';
    contractSaveBtn.querySelector('.btn-label').textContent = contract ? 'Save Changes' : 'Create Contract';
    // Editing doesn't reassign which patient the contract belongs to, so
    // lock the picker instead of trying to re-select a value that may not
    // even be in the (possibly real, possibly state) options list.
    cfPatient.disabled = !!contract;
    if (!contract) cfPatient.value = (cfPatient.options[0] || {}).value;
    document.getElementById('cfMonths').value = contract ? contract.months : '';
    document.getElementById('cfMonthly').value = contract ? contract.monthly : '';
    document.getElementById('cfDentist').value = contract
      ? (contract.dentist_id ?? '')
      : (cfDentist.options[0] || {}).value;
    document.getElementById('cfStatus').value = contract ? contract.status : 'Current';
    contractNote.hidden = true;
    contractFormModal.open();
  }

  document.getElementById('addContractBtn').addEventListener('click', () => openContractForm(null));

  document.getElementById('bracesBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action="edit-contract"]');
    if (!btn) return;
    const contract = bracesRaw.find(c => c.id === btn.dataset.contractId);
    if (contract) openContractForm(contract);
  });

  contractSaveBtn.addEventListener('click', async () => {
    const months = Number(document.getElementById('cfMonths').value);
    const monthly = Number(document.getElementById('cfMonthly').value);
    if (!months || months < 1){
      contractNote.textContent = 'Enter the contract duration in months.';
      contractNote.classList.add('err'); contractNote.classList.remove('ok');
      contractNote.hidden = false;
      return;
    }
    if (!monthly || monthly < 1){
      contractNote.textContent = 'Enter a monthly payment amount.';
      contractNote.classList.add('err'); contractNote.classList.remove('ok');
      contractNote.hidden = false;
      return;
    }
    const dentist = document.getElementById('cfDentist').value;
    const status = { Current: 'active', Overdue: 'defaulted', Completed: 'completed' }[document.getElementById('cfStatus').value];
    contractSaveBtn.classList.add('loading');
    contractSaveBtn.disabled = true;

    try {
      if (!editingContract && !cfPatient.value) throw new Error('Select a patient.');
      await apiFetch('../backend/api/contracts/contracts.php', {
        method: editingContract ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingContract ? { contract_id: Number(editingContract.contract_id || editingContract.id.replace('#B-', '')) } : { patient_id: Number(cfPatient.value) }),
          dentist_id: dentist ? Number(dentist) : null,
          total_amount: months * monthly, monthly_payment: monthly, duration_months: months, status
        })
      });
      contractFormModal.close();
      await applyBraces();
      await patientMgr.load();
      showToast(editingContract ? 'Contract updated' : 'Contract created');
    } catch (error) {
      contractNote.textContent = error.message;
      contractNote.classList.add('err'); contractNote.classList.remove('ok');
      contractNote.hidden = false;
    } finally {
      contractSaveBtn.classList.remove('loading');
      contractSaveBtn.disabled = false;
    }
  });
}

// =====================================================================
// Promotions management is unavailable until a server endpoint is provided.
const addPromoBtn = document.getElementById('addPromoBtn');
if (addPromoBtn) { addPromoBtn.disabled = true; addPromoBtn.title = 'Promotions management is unavailable.'; }

// INVENTORY: add item (delegated to InventoryTableManager)
// =====================================================================

// ---------- Appointment actions initialized above via AppointmentActions class ----------

// =====================================================================
// Export the records currently returned by the server.
const exportPatientsBtn = document.getElementById('exportPatientsBtn');
if (exportPatientsBtn){
  exportPatientsBtn.addEventListener('click', () => {
    exportTablePDF({
      title: 'Patient List',
      columns: [
        { label: 'Patient', value: p => p.name + ' (' + p.id + ')' },
        { label: 'Contact', value: p => p.contact },
        { label: 'Last Visit', value: p => p.lastVisit },
        { label: 'Contract Balance', value: p => p.balance },
        { label: 'Status', value: p => p.status }
      ],
      rows: patientMgr.getFilteredList()
    });
  });
}

const exportBracesBtn = document.getElementById('exportBracesBtn');
if (exportBracesBtn){
  exportBracesBtn.addEventListener('click', () => {
    exportTablePDF({
      title: 'Payment Report',
      columns: [
        { label: 'Patient', value: c => c.name + ' (' + c.id + ')' },
        { label: 'Plan', value: c => c.plan },
        { label: 'Monthly', value: c => c.monthly },
        { label: 'Paid', value: c => c.paid },
        { label: 'Balance', value: c => c.balance },
        { label: 'Status', value: c => c.status }
      ],
      rows: bracesList
    });
  });
}

const exportInventoryBtn = document.getElementById('exportInventoryBtn');
if (exportInventoryBtn){
  exportInventoryBtn.addEventListener('click', () => {
    exportTablePDF({
      title: 'Inventory Report',
      columns: [
        { label: 'Item', value: i => i.item },
        { label: 'Category', value: i => i.category },
        { label: 'Stock', value: i => i.stock },
        { label: 'Status', value: i => i.status }
      ],
      rows: inventoryMgr.getFilteredList()
    });
  });
}

const archiveRecordsBtn = document.getElementById('archiveRecordsBtn');
if (archiveRecordsBtn) { archiveRecordsBtn.disabled = true; archiveRecordsBtn.title = 'Record archiving is unavailable.'; }

// =====================================================================
// SHARED DASHBOARD CORE (from ../shared/js/dashboard-core.js)
// =====================================================================
initToastTriggers();
initFullscreenToggle();
initSidebar('asdc.receptionist.sidebar.collapsed');
initLogout('../auth/login.html');

// =====================================================================
// DATA RENDERING
// =====================================================================

function renderUser(user){
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('sideFootAvatar', user.initials);
  set('sideFootName', user.name);
  set('sideFootRole', 'Receptionist');
  set('chipAvatar', user.initials);
  set('menuAvatar', user.initials);
  set('menuName', user.name);
  set('menuRole', 'Receptionist');
  set('greetingText', user.greeting);
  set('greetingSubtext', user.name + ' · Receptionist');
}

function renderDashboardStats(stats){
  const grid = document.getElementById('dashStats');
  if (!grid) return;
  const targets = ['appointments', 'patients', 'payments', 'braces'];
  grid.innerHTML = stats.map((stat, index) => {
    const target = targets[index] || 'dashboard';
    return statCard(stat).replace(
      'class="stat-card"',
      `class="stat-card stat-card-link" role="button" tabindex="0" data-stat-target="${target}" aria-label="Open ${escapeHtml(stat.label)}"`
    );
  }).join('');
}

document.getElementById('dashStats')?.addEventListener('click', event => {
  const card = event.target.closest('[data-stat-target]');
  if (card) switchView(card.dataset.statTarget);
});

document.getElementById('dashStats')?.addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key)) return;
  const card = event.target.closest('[data-stat-target]');
  if (!card) return;
  event.preventDefault();
  switchView(card.dataset.statTarget);
});

function renderWeekGrid(containerId, week){
  const grid = document.getElementById(containerId);
  if (!grid) return;
  const header = ['', ...week.days].map(d =>
    `<div class="cell${d ? ' head': ''}">${d}</div>`).join('');
  const body = week.rows.map(row =>
    `<div class="cell time">${row.time}</div>` + row.appts.map(a =>
      a ? `<div class="cell"><div class="appt-block">${a.name} <span class="t">${a.t}</span></div></div>`
        : '<div class="cell"></div>'
    ).join('')
  ).join('');
  grid.innerHTML = header + body;
}

function renderQueue(queue){
  const tbody = document.getElementById('dashQueueBody');
  if (!tbody) return;
  if (!queue.length){
    tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">No patients in the queue right now.</td></tr>';
    return;
  }
  tbody.innerHTML = queue.map(q =>
    `<tr><td>${nameCell(q.initials, q.name, q.sub)}</td><td>${q.time}</td><td>${statusTag(q)}</td></tr>`
  ).join('');
}

function renderBraces(contracts){
  const tbody = document.getElementById('bracesBody');
  if (!tbody) return;
  tbody.innerHTML = contracts.map(c =>
    `<tr>
      <td>${nameCell(c.initials, c.name, c.id)}</td>
      <td>${c.plan}</td>
      <td>${c.monthly}</td>
      <td>${c.paid}</td>
      <td>${c.balance}</td>
      <td>${statusTag(c)}</td>
      <td><button class="btn btn-outline btn-sm" data-action="edit-contract" data-contract-id="${c.id}">Edit</button></td>
    </tr>`
  ).join('');
}

function renderPromotions(promotions){
  const grid = document.getElementById('promoGrid');
  if (!grid) return;
  if (!promotions.length){
    grid.innerHTML = '<p class="empty-cell">No promotions on file.</p>';
    return;
  }
  grid.innerHTML = promotions.map((p, i) =>
    `<div class="promo-card">
      <div class="promo-body">
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.desc)}</p>
        <div class="promo-foot">
          <span class="tag tag-${p.tag}">${p.status}</span>
          <div class="promo-actions">
            <span>${escapeHtml(p.start_date || '')} – ${escapeHtml(p.end_date || '')}</span>
          </div>
        </div>
      </div>
    </div>`
  ).join('');
}

function renderReports(reports){
  const grid = document.getElementById('reportStats');
  if (!grid) return;
  grid.innerHTML = '<p class="empty-cell">Attendance reports are unavailable.</p>';

  const bars = document.getElementById('reportBars');
  if (bars){
    bars.innerHTML = reports.bars.map(b =>
      `<div class="bar-col"><div class="bar" style="height:${b.pct}%"></div><span class="bar-label">${b.day}</span></div>`
    ).join('');
  }
}

function renderInventory(items){
  inventoryMgr.apply();
}

function renderPayments(){
  paymentMgr.render();
}

// =====================================================================
// PAYMENT APPROVALS (delegated to PaymentApprovalManager)
// =====================================================================
const paymentMgr = new PaymentApprovalManager();

// =====================================================================
// NOTIFICATIONS: log table + send modal
// Now delegated to ASDC.NotificationManager class.
// =====================================================================
const notificationManager = new ASDC.NotificationManager();

// ---------- Render everything on load ----------
renderUser(AdminState.user);
renderDashboardStats(AdminState.dashboard.stats);
renderWeekGrid('dashWeekGrid', AdminState.dashboard.week);
// NOTE: the appointments page's own week grid loads itself — see
// appointmentScheduler.init() a few lines above, which already calls
// loadWeek(). The old loadAppointmentWeek() global function was removed
// when this was refactored into the AppointmentScheduler class, but this
// leftover call was not removed, and it crashed the whole script (so
// every render call after it, like renderQueue/applyBraces/etc., never ran).
renderQueue(AdminState.dashboard.queue);
renderPromotions(AdminState.promotions);
renderReports(AdminState.reports);
notificationManager.init();
paymentMgr.init();

window.staffLiveSync = ASDC.startPortalSync({
  start: () => appointmentScheduler.state.start,
  apply: data => {
    window.staffSnapshot = data;
    appointmentScheduler.applySnapshot(data);
    patientMgr.load(data);
    AdminState.records = data.records; recordMgr.apply();
    applyBraces(data); paymentMgr.render(data);
    inbox.setItems(data.notifications);
    notificationManager.renderLog(data);
    AdminState.dashboard.stats.forEach((stat, index) => { stat.num = index === 2 ? ContractFormat.peso(data.metrics[index]) : String(data.metrics[index]); });
    renderDashboardStats(AdminState.dashboard.stats);
    AdminState.promotions = data.promotions.map(p => ({ ...p, tag: p.status === 'live' ? 'green' : 'amber' }));
    renderPromotions(AdminState.promotions);
    AdminState.inventory = data.inventory.map(i => ({ ...i, initials: '', stock: i.qty + ' ' + (i.unit || ''),
      width: Math.min(100, i.qty / Math.max(1, i.reorder_level) * 50), fill: 'var(--green)',
      status: i.qty <= i.reorder_level ? 'Low' : 'Available', tag: i.qty <= i.reorder_level ? 'red' : 'green' }));
    inventoryMgr.apply();
  }
});
