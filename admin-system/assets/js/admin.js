// =====================================================================
// ADMIN DASHBOARD: page-specific logic
// Shared utilities (Modal, toast, sidebar, fullscreen, logout, Popover,
// notifications) live in ../shared/js/dashboard-core.js and are loaded
// before this file. Sample data lives in ../shared/js/mock-data/admin.js
// and is rendered here; swap `AdminMock.<section>` for a fetch() response
// later.
//
// Interactive controls wired here:
//   - sidebar nav (switchView)          - filter chips per table
//   - topbar search (patients, live)    - appointment Week/Day/List
//   - mobile search popover             - report period chips
//   - notifications popover             - user chip / account menu
//   - patient table: view / edit / add / delete (mock modals)
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
const patientMgr = new PatientTableManager({ mock: AdminMock, onSwitchView: switchView });
patientMgr.init();

// =====================================================================
// RECORDS TABLE: category filter + view details (delegated to RecordTableManager)
// =====================================================================
const recordMgr = new RecordTableManager({ mock: AdminMock });
recordMgr.init();

// =====================================================================
// BRACES CONTRACTS TABLE: status filter
// =====================================================================
let bracesFilter = 'Current'; // SCOPE: default to current/delinquent contracts only
let bracesList = [];          // last filtered rows shown (used by Export)

async function applyBraces(){
  const tbody = document.getElementById('bracesBody');
  if (!tbody) return;

  let raw;
  try {
    const data = await apiFetch('../backend/api/contracts/contracts.php');
    if (!Array.isArray(data.contracts)) throw new Error('not_implemented');
    raw = data.contracts;
    bracesAreReal = true;
  } catch (error) {
    // Backend not reachable/implemented yet — fall back to the shared
    // local mock so the table still shows something realistic.
    raw = ContractStore.all();
    bracesAreReal = false;
  }
  bracesRaw = raw;

  const all = raw.map(c => ({
    id: c.id, initials: c.initials, name: c.name,
    plan: c.plan, monthly: ContractStore.peso(c.monthly),
    paid: ContractStore.peso(c.paid), balance: ContractStore.peso(c.balance),
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
const inventoryMgr = new InventoryTableManager({ mock: AdminMock });
inventoryMgr.init();

// =====================================================================
// APPOINTMENTS: Week / Day / List view modes
// =====================================================================
function renderApptMode(mode){
  const grid = document.getElementById('apptWeekGrid');
  const listView = document.getElementById('apptListView');
  const tag = document.getElementById('apptModeTag');
  const week = AdminMock.dashboard.week;

  if (mode === 'Day'){
    if (grid) grid.hidden = false;
    if (listView) listView.hidden = true;
    const header = ['', 'Mon 10'].map((d, i) => `<div class="cell${i ? ' head' : ''}">${d}</div>`).join('');
    const body = week.rows.map(row =>
      `<div class="cell time">${row.time}</div>` +
      (row.appts[0]
        ? `<div class="cell"><div class="appt-block">${row.appts[0].name} <span class="t">${row.appts[0].t}</span></div></div>`
        : '<div class="cell"></div>')
    ).join('');
    grid.innerHTML = header + body;
    if (tag) tag.textContent = 'Mon 10 · Day view';
    return;
  }

  if (mode === 'List'){
    if (grid) grid.hidden = true;
    if (listView) listView.hidden = false;
    const tbody = document.getElementById('apptListBody');
    if (tbody){
      const rows = [];
      week.rows.forEach(r => {
        r.appts.forEach((a, di) => {
          if (!a) return;
          const parts = String(a.t).split('·');
          rows.push({ day: week.days[di], time: r.time, name: a.name, svc: (parts[1] || '').trim() });
        });
      });
      tbody.innerHTML = rows.map(r =>
        `<tr><td>${r.day}</td><td>${r.time}</td><td>${r.name}</td><td>${r.svc}</td></tr>`
      ).join('');
    }
    if (tag) tag.textContent = 'Aug 10 – 15, 2026 · List view';
    return;
  }

  // Week (default)
  if (grid) grid.hidden = false;
  if (listView) listView.hidden = true;
  renderWeekGrid('apptWeekGrid', week);
  if (tag) tag.textContent = 'Aug 10 – 15, 2026';
}

const appointmentScheduler = new AppointmentScheduler({ apiBase: '../backend/api/appointments' });
const appointmentActions  = new AppointmentActions({ scheduler: appointmentScheduler });
appointmentScheduler.init();
appointmentActions.init();
const apptGroup = document.querySelector('[aria-label="Filter schedule"]');
wireChips(apptGroup, label => appointmentScheduler.setMode(label));

// =====================================================================
// REPORTS: period chips update the panel heading (mock period switch)
// =====================================================================
const reportGroup = document.querySelector('[aria-label="Report period"]');
wireChips(reportGroup, label => {
  const heading = document.getElementById('reportHeading');
  if (heading) heading.textContent = 'Attendance: ' + label;
});

// =====================================================================
// NOTIFICATIONS + ACCOUNT MENU
// =====================================================================
// Prepend a live "payment awaiting approval" notification whenever the
// shared submissions store has pending receipts, so staff never miss them.
const adminNotifList = (function(){
  let pending = [];
  try {
    const raw = localStorage.getItem('asdc.payments');
    const list = raw ? JSON.parse(raw) : [];
    pending = Array.isArray(list) ? list.filter(s => s.status === 'pending') : [];
  } catch (e){}
  if (!pending.length) return AdminMock.notifications;
  const names = [...new Set(pending.map(s => s.patient))];
  const count = pending.length;
  return [{
    id: 'pay-pending',
    kind: 'pay',
    title: count + (count === 1 ? ' payment' : ' payments') + ' awaiting approval',
    desc: 'New receipt' + (count === 1 ? '' : 's') + ' from ' + names.join(', ') + ' ready to review.',
    time: 'Just now',
    unread: true
  }].concat(AdminMock.notifications);
})();

initNotifications({
  triggerId: 'notifBtn',
  panelId: 'notifPanel',
  listId: 'notifList',
  badgeId: 'notifBadge',
  markAllId: 'notifMarkAll',
  emptyId: 'notifEmpty',
  notifications: adminNotifList,
  storageKey: 'asdc.notif.receptionist',
  onSelect: n => {
    if (n.id === 'pay-pending'){ switchView('payments'); Popover.close(document.getElementById('notifPanel')); }
    else showToast('Opening: ' + n.title + ' (mock)');
  }
});

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
// BRACES CONTRACTS: add + edit status (real backend, mock fallback)
// =====================================================================
const contractFormModal = new Modal('contractFormModal');
let editingContract = null;
let bracesRaw = [];       // raw contract objects (real or ContractStore-shaped), for Edit lookups
let bracesAreReal = false; // whether the last successful fetch was real backend data
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
  let patientsAreReal = false;

  const fillPatients = async () => {
    try {
      const data = await apiFetch('../backend/api/patients/list.php');
      if (!Array.isArray(data.patients) || !data.patients.length) throw new Error('empty');
      patientsAreReal = true;
      cfPatient.innerHTML = data.patients.map(p =>
        `<option value="${p.patient_id}">${p.first_name} ${p.last_name} (#P-${p.patient_id})</option>`
      ).join('');
    } catch (e) {
      patientsAreReal = false;
      cfPatient.innerHTML = AdminMock.patients
        .map(p => `<option value="${p.name}">${p.name} (${p.id})</option>`).join('');
    }
  };

  // Only tried when patients turned out to be real — a real dentist
  // picker only makes sense alongside real patient_id-based contracts;
  // in mock mode the two hardcoded <option>s already in the HTML stay.
  const fillDentists = async () => {
    if (!patientsAreReal) return;
    try {
      const data = await apiFetch('../backend/api/contracts/dentists.php');
      if (!Array.isArray(data.dentists) || !data.dentists.length) throw new Error('empty');
      // Real mode needs the numeric user_id (what the backend expects for
      // dentist_id) — the display name alone isn't enough to save it.
      cfDentist.innerHTML = data.dentists.map(d => `<option value="${d.user_id}">${d.full_name}</option>`).join('');
    } catch (e) { /* keep the hardcoded fallback options already in the HTML */ }
  };

  fillPatients().then(fillDentists);

  const contractNote = document.getElementById('contractFormNote');
  const contractSaveBtn = document.getElementById('contractFormSave');

  function openContractForm(contract){
    editingContract = contract || null;
    document.getElementById('contractFormTitle').textContent = contract
      ? 'Edit Contract — ' + contract.name
      : 'New Braces Contract';
    contractSaveBtn.querySelector('.btn-label').textContent = contract ? 'Save Changes' : 'Create Contract';
    // Editing doesn't reassign which patient the contract belongs to, so
    // lock the picker instead of trying to re-select a value that may not
    // even be in the (possibly real, possibly mock) options list.
    cfPatient.disabled = !!contract;
    if (!contract) cfPatient.value = (cfPatient.options[0] || {}).value;
    document.getElementById('cfMonths').value = contract ? contract.months : '';
    document.getElementById('cfMonthly').value = contract ? contract.monthly : '';
    document.getElementById('cfDentist').value = contract
      ? (patientsAreReal ? (contract.dentist_id ?? '') : (contract.dentist || 'Dr. Kathrine Sison'))
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
    const dentist = document.getElementById('cfDentist').value; // mock mode: dentist's name; real mode: numeric user_id
    const status = document.getElementById('cfStatus').value;
    contractSaveBtn.classList.add('loading');
    contractSaveBtn.disabled = true;

    try {
      if (editingContract) {
        const contractId = Number((editingContract.contract_id) || editingContract.id.replace('#B-', ''));
        if (bracesAreReal) {
          await apiFetch('../backend/api/contracts/contracts.php', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contract_id: contractId, dentist_id: dentist ? Number(dentist) : null,
              total_amount: months * monthly,
              monthly_payment: monthly, duration_months: months, status
            })
          });
        } else {
          const patient = AdminMock.patients.find(p => p.name === editingContract.name);
          const saved = ContractStore.upsert({
            id: editingContract.id, pid: editingContract.pid,
            initials: editingContract.initials, name: editingContract.name,
            dentist, months, monthly,
            plan: months + '-month · ' + peso(monthly) + '/mo',
            total: months * monthly, paid: editingContract.paid,
            balance: Math.max(0, months * monthly - editingContract.paid),
            monthsPaid: editingContract.monthsPaid, status, tag: tagFor(status),
            payments: editingContract.payments, progress: editingContract.progress
          });
          if (patient) { patient.balance = peso(saved.balance); patient.status = status; patient.tag = tagFor(status); }
        }
      } else {
        if (patientsAreReal) {
          await apiFetch('../backend/api/contracts/contracts.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patient_id: Number(cfPatient.value), dentist_id: dentist ? Number(dentist) : null,
              total_amount: months * monthly,
              monthly_payment: monthly, duration_months: months, status
            })
          });
        } else {
          const patient = AdminMock.patients.find(p => p.name === cfPatient.value);
          const saved = ContractStore.upsert({
            id: null, pid: patient ? patient.id : null,
            initials: patient ? patient.initials : initialsOf(cfPatient.value),
            name: cfPatient.value, dentist, months, monthly,
            plan: months + '-month · ' + peso(monthly) + '/mo',
            total: months * monthly, paid: 0, balance: months * monthly,
            monthsPaid: 0, status, tag: tagFor(status), payments: []
          });
          if (patient) { patient.balance = peso(saved.balance); patient.status = status; patient.tag = tagFor(status); }
        }
      }
      contractFormModal.close();
      await applyBraces();
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
// PROMOTIONS: add + edit (functional mock)
// =====================================================================
const promoFormModal = new Modal('promoFormModal');
let editingPromo = null;

if (promoFormModal.modal){
  promoFormModal.registerClose(document.getElementById('promoFormClose'));
  promoFormModal.registerClose(document.getElementById('promoFormCancel'));
  const promoNote = document.getElementById('promoFormNote');
  const promoSaveBtn = document.getElementById('promoFormSave');

  function openPromoForm(promo){
    editingPromo = promo || null;
    document.getElementById('promoFormTitle').textContent = promo ? 'Edit Promotion' : 'New Promotion';
    promoSaveBtn.querySelector('.btn-label').textContent = promo ? 'Save Changes' : 'Save Promotion';
    document.getElementById('pf2Title').value = promo ? promo.title : '';
    document.getElementById('pf2Desc').value = promo ? promo.desc : '';
    document.getElementById('pf2Status').value = promo ? promo.status : 'Scheduled';
    promoNote.hidden = true;
    promoFormModal.open();
  }

  document.getElementById('addPromoBtn').addEventListener('click', () => openPromoForm(null));

  document.getElementById('promoGrid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action="edit-promo"]');
    if (!btn) return;
    const promo = AdminMock.promotions[Number(btn.dataset.index)];
    if (promo) openPromoForm(promo);
  });

  promoSaveBtn.addEventListener('click', () => {
    const title = document.getElementById('pf2Title').value.trim();
    const desc = document.getElementById('pf2Desc').value.trim();
    if (!title || !desc){
      promoNote.textContent = 'Title and description are required.';
      promoNote.classList.add('err'); promoNote.classList.remove('ok');
      promoNote.hidden = false;
      return;
    }
    const status = document.getElementById('pf2Status').value;
    const tag = status === 'Live' ? 'green' : (status === 'Scheduled' ? 'amber' : 'red');
    if (editingPromo){
      Object.assign(editingPromo, { title, desc, status, tag });
    } else {
      AdminMock.promotions.unshift({ title, desc, status, tag });
    }
    promoFormModal.close();
    renderPromotions(AdminMock.promotions);
    showToast(editingPromo ? 'Promotion updated' : 'Promotion created');
  });

  // ---- Delete promotion ----
  const promoDeleteModal = new Modal('promoDeleteModal');
  let deletingPromoIndex = null;

  if (promoDeleteModal.modal){
    promoDeleteModal.registerClose(document.getElementById('promoDeleteClose'));
    promoDeleteModal.registerClose(document.getElementById('promoDeleteCancel'));

    document.getElementById('promoGrid').addEventListener('click', e => {
      const btn = e.target.closest('[data-action="delete-promo"]');
      if (!btn) return;
      deletingPromoIndex = Number(btn.dataset.index);
      const promo = AdminMock.promotions[deletingPromoIndex];
      if (!promo) return;
      document.getElementById('promoDeleteName').textContent = promo.title;
      promoDeleteModal.open();
    });

    document.getElementById('promoDeleteConfirm').addEventListener('click', () => {
      if (deletingPromoIndex === null) return;
      AdminMock.promotions.splice(deletingPromoIndex, 1);
      deletingPromoIndex = null;
      promoDeleteModal.close();
      renderPromotions(AdminMock.promotions);
      showToast('Promotion deleted');
    });
  }
}

// =====================================================================
// INVENTORY: add item (delegated to InventoryTableManager)
// =====================================================================

// ---------- Appointment actions initialized above via AppointmentActions class ----------

// =====================================================================
// EXPORT (PDF) + ARCHIVE: real mock actions replacing the old data-toast
// placeholders. Export prints the currently filtered rows; Archive moves
// the visible records out of the active list (in-memory, with Undo).
// TODO(backend): swap the in-memory mutation for the real API call.
// =====================================================================
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
if (archiveRecordsBtn){
  archiveRecordsBtn.addEventListener('click', () => {
    const selected = recordMgr.getSelectedRecords();
    if (!selected.size){
      showToast('Select at least one record to archive.', 'error');
      return;
    }
    const batch = Array.from(selected);
    AdminMock.records = AdminMock.records.filter(r => !selected.has(r));
    recordMgr.clearSelection();
    showToast(batch.length + ' record' + (batch.length === 1 ? '' : 's') + ' archived', 'success', {
      label: 'Undo',
      onClick: () => {
        AdminMock.records = AdminMock.records.concat(batch);
        recordMgr.clearSelection();
        showToast(batch.length + ' record' + (batch.length === 1 ? '' : 's') + ' restored');
      }
    });
  });
}

// =====================================================================
// SHARED DASHBOARD CORE (from ../shared/js/dashboard-core.js)
// =====================================================================
initToastTriggers();
initFullscreenToggle();
initSidebar('asdc.receptionist.sidebar.collapsed');
initLogout('../auth/login.html');

// =====================================================================
// MOCK DATA RENDERING
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
  grid.innerHTML = stats.map(statCard).join('');
}

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
    grid.innerHTML = '<p class="empty-cell">No promotions yet. Create one to feature it on the public site.</p>';
    return;
  }
  grid.innerHTML = promotions.map((p, i) =>
    `<div class="promo-card">
      <div class="promo-img"><span>Campaign Artwork</span></div>
      <div class="promo-body">
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.desc)}</p>
        <div class="promo-foot">
          <span class="tag tag-${p.tag}">${p.status}</span>
          <div class="promo-actions">
            <button class="btn btn-outline btn-sm" data-action="edit-promo" data-index="${i}">Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete-promo" data-index="${i}">Delete</button>
          </div>
        </div>
      </div>
    </div>`
  ).join('');
}

function renderReports(reports){
  const grid = document.getElementById('reportStats');
  if (!grid) return;
  grid.innerHTML = reports.stats.map(statCard).join('');

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
renderUser(AdminMock.user);
renderDashboardStats(AdminMock.dashboard.stats);
renderWeekGrid('dashWeekGrid', AdminMock.dashboard.week);
// NOTE: the appointments page's own week grid loads itself — see
// appointmentScheduler.init() a few lines above, which already calls
// loadWeek(). The old loadAppointmentWeek() global function was removed
// when this was refactored into the AppointmentScheduler class, but this
// leftover call was not removed, and it crashed the whole script (so
// every render call after it, like renderQueue/applyBraces/etc., never ran).
renderQueue(AdminMock.dashboard.queue);
applyBraces();
renderPromotions(AdminMock.promotions);
renderReports(AdminMock.reports);
notificationManager.init();
paymentMgr.init();
