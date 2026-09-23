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
// Helpers & shared cell builders - now provided by ASDC.HtmlHelpers
// (escapeHtml, nameCell, statusTag, statCard, eyeIcon, pencilIcon,
// trashIcon are global via dashboard-core.js).
// PDF export - now provided by ASDC.ReportExporter
// (exportTablePDF, getLogoDataUrl are global via dashboard-core.js).
// =====================================================================

const views = {
  dashboard: { title: 'Dashboard', crumb: 'Overview' },
  patients: { title: 'Patient Management', crumb: 'Patients' },
  records: { title: 'Records & Protocols', crumb: 'Patients' },
  archived: { title: 'Archived Patients', crumb: 'Patients' },
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
    if (view === 'archived') loadArchivedPatients();
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

let archivedPatients = [];
let archivedCurrent = null;

async function loadArchivedPatients(){
  const tbody = document.getElementById('archivedPatientsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Loading archived patients...</td></tr>';
  try {
    const data = await apiFetch('../backend/api/patients/archived.php', { cache: 'no-store' });
    archivedPatients = Array.isArray(data.patients) ? data.patients : [];
    renderArchivedPatients();
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Unable to load archived patients.</td></tr>';
    showToast(error.message, 'error');
  }
}

function archivedName(patient){
  return [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim() || ('#P-' + patient.patient_id);
}

function renderArchivedPatients(){
  const tbody = document.getElementById('archivedPatientsBody');
  if (!tbody) return;
  if (!archivedPatients.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No archived patients.</td></tr>';
    return;
  }
  tbody.innerHTML = archivedPatients.map(patient => {
    const name = archivedName(patient);
    const retained = [
      Number(patient.appointment_count || 0) + ' appt',
      Number(patient.record_count || 0) + ' record',
      Number(patient.contract_count || 0) + ' contract',
      Number(patient.payment_count || 0) + ' payment',
      Number(patient.notification_count || 0) + ' notice'
    ].join(' · ');
    return `<tr>
      <td>${nameCell('', name, '#P-' + Number(patient.patient_id))}</td>
      <td>${escapeHtml(patient.archived_at || '')}</td>
      <td>${escapeHtml(retained)}</td>
      <td>${escapeHtml(patient.archived_by_name || 'System')}</td>
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" data-archive-view="${Number(patient.patient_id)}">View</button>
        <button class="btn btn-gold btn-sm" data-archive-restore="${Number(patient.patient_id)}">Restore</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderArchivedDetails(data){
  const panel = document.getElementById('archivedDetailPanel');
  const title = document.getElementById('archivedDetailTitle');
  const body = document.getElementById('archivedDetailBody');
  const restore = document.getElementById('archivedRestoreBtn');
  if (!panel || !title || !body || !data.patient) return;
  archivedCurrent = data.patient;
  const name = archivedName(data.patient);
  title.textContent = name + ' · #P-' + data.patient.patient_id;
  if (restore) restore.dataset.patientId = data.patient.patient_id;
  const groups = [
    ['Appointments', data.appointments, item => `${item.scheduled_date} ${String(item.scheduled_time).slice(0,5)} · ${item.service_type} · ${item.status}`],
    ['Treatment Records', data.records, item => `${item.date_recorded} · ${item.treatment_given || item.treatment_protocol || item.diagnosis || 'Clinical record'}`],
    ['Braces Contracts', data.contracts, item => `#B-${item.contract_id} · ${item.status} · ${ContractFormat.peso(item.balance_amount || 0)} balance`],
    ['Payments', data.payments, item => `${ContractFormat.peso(item.amount_paid || 0)} · ${item.status} · ${item.payment_date || item.created_at || ''}`],
    ['Notifications', data.notifications, item => `${item.title} · ${item.created_at || ''}`]
  ];
  body.innerHTML = `<div class="detail-grid">
    <div class="row"><span>Archived</span><span>${escapeHtml(data.patient.archived_at || '')}</span></div>
    <div class="row"><span>Archived By</span><span>${escapeHtml(data.patient.archived_by_name || 'System')}</span></div>
    <div class="row"><span>Retention</span><span>${escapeHtml(data.patient.retention_note || '')}</span></div>
  </div>` + groups.map(([label, rows, format]) => {
    rows = Array.isArray(rows) ? rows : [];
    return `<h4>${escapeHtml(label)} (${rows.length})</h4>` +
      (rows.length ? `<ul class="archive-detail-list">${rows.map(row => `<li>${escapeHtml(format(row))}</li>`).join('')}</ul>` : '<p class="empty-cell">None retained in this category.</p>');
  }).join('');
  panel.hidden = false;
}

async function openArchivedDetails(patientId){
  try {
    const data = await apiFetch('../backend/api/patients/archived.php?patient_id=' + encodeURIComponent(patientId), { cache: 'no-store' });
    renderArchivedDetails(data);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function restoreArchivedPatient(patientId){
  const patient = archivedPatients.find(p => Number(p.patient_id) === Number(patientId)) || archivedCurrent;
  const confirmed = await ASDC.confirmAction({
    title: 'Restore Patient',
    message: 'Restore ' + archivedName(patient || { patient_id: patientId }) + ' to active patient lists?',
    confirmLabel: 'Restore',
    tone: 'gold'
  });
  if (!confirmed) return;
  try {
    await apiFetch('../backend/api/patients/archived.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', patient_id: Number(patientId) })
    });
    document.getElementById('archivedDetailPanel').hidden = true;
    archivedCurrent = null;
    await loadArchivedPatients();
    if (window.staffLiveSync) await window.staffLiveSync.refetch();
    showToast('Patient restored.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

document.getElementById('refreshArchivedBtn')?.addEventListener('click', loadArchivedPatients);
document.getElementById('archivedPatientsBody')?.addEventListener('click', event => {
  const view = event.target.closest('[data-archive-view]');
  const restore = event.target.closest('[data-archive-restore]');
  if (view) openArchivedDetails(view.dataset.archiveView);
  if (restore) restoreArchivedPatient(restore.dataset.archiveRestore);
});
document.getElementById('archivedRestoreBtn')?.addEventListener('click', event => {
  const patientId = event.currentTarget.dataset.patientId;
  if (patientId) restoreArchivedPatient(patientId);
});

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
    dueDate: c.dueDate || 'Not set', dueStatus: c.dueStatus || 'upcoming',
    status: c.status, tag: c.tag
  }));

  const list = bracesFilter ? all.filter(c => c.status === bracesFilter) : all;
  bracesList = list;
  if (!list.length){
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">No contracts match this filter.</td></tr>`;
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
let reportPeriod = 'this_week';
wireChips(reportGroup, label => {
  reportPeriod = { 'This week': 'this_week', 'Last week': 'last_week', 'This month': 'this_month' }[label] || 'this_week';
  renderReports(AdminState.reports);
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
      // dentist_id) - the display name alone isn't enough to save it.
      cfDentist.innerHTML = data.dentists.map(d => `<option value="${d.dentist_id}">${escapeHtml(d.full_name)}</option>`).join('');
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
      ? 'Edit Contract - ' + contract.name
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
// PROMOTIONS: create live/scheduled clinic announcements
const promoFormModal = new Modal('promoFormModal');
const promoDetailModal = new Modal('promoDetailModal');
const promoDeleteModal = new Modal('promoDeleteModal');
let deletingPromotion = null;
if (promoFormModal.modal){
  const addPromoBtn = document.getElementById('addPromoBtn');
  const promoNote = document.getElementById('promoFormNote');
  const promoSaveBtn = document.getElementById('promoFormSave');
  const promoTitle = document.getElementById('pf2Title');
  const promoDesc = document.getElementById('pf2Desc');
  const promoImage = document.getElementById('pf2Image');
  const promoStart = document.getElementById('pf2Start');
  const promoEnd = document.getElementById('pf2End');
  const promoStatus = document.getElementById('pf2Status');

  promoFormModal.registerClose(document.getElementById('promoFormClose'));
  promoFormModal.registerClose(document.getElementById('promoFormCancel'));

  addPromoBtn?.addEventListener('click', () => {
    promoTitle.value = '';
    promoDesc.value = '';
    promoImage.value = '';
    promoStart.value = '';
    promoEnd.value = '';
    promoStatus.value = 'Live';
    promoNote.hidden = true;
    promoSaveBtn.classList.remove('loading');
    promoSaveBtn.disabled = false;
    promoFormModal.open(addPromoBtn);
  });

  promoSaveBtn?.addEventListener('click', async () => {
    const title = promoTitle.value.trim();
    const description = promoDesc.value.trim();
    const status = promoStatus.value.toLowerCase();
    const startDate = promoStart.value;
    const endDate = promoEnd.value;
    if (!title || !description){
      promoNote.textContent = 'Enter a title and description.';
      promoNote.classList.add('err'); promoNote.classList.remove('ok');
      promoNote.hidden = false;
      return;
    }
    if (startDate && endDate && endDate < startDate){
      promoNote.textContent = 'End date must be after the start date.';
      promoNote.classList.add('err'); promoNote.classList.remove('ok');
      promoNote.hidden = false;
      return;
    }

    promoSaveBtn.classList.add('loading');
    promoSaveBtn.disabled = true;
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('status', status);
      if (startDate) formData.append('start_date', startDate);
      if (endDate) formData.append('end_date', endDate);
      if (promoImage.files[0]) formData.append('image', promoImage.files[0]);
      await apiFetch('../backend/api/promotions/promotions.php', {
        method: 'POST',
        body: formData
      });
      promoFormModal.close();
      showToast('Promotion saved');
      if (window.staffLiveSync) await window.staffLiveSync.refetch();
    } catch (error) {
      promoNote.textContent = error.message;
      promoNote.classList.add('err'); promoNote.classList.remove('ok');
      promoNote.hidden = false;
    } finally {
      promoSaveBtn.classList.remove('loading');
      promoSaveBtn.disabled = false;
    }
  });
}

if (promoDetailModal.modal){
  promoDetailModal.registerClose(document.getElementById('promoDetailClose'));
  promoDetailModal.registerClose(document.getElementById('promoDetailCancel'));
}

if (promoDeleteModal.modal){
  promoDeleteModal.registerClose(document.getElementById('promoDeleteClose'));
  promoDeleteModal.registerClose(document.getElementById('promoDeleteCancel'));
  document.getElementById('promoDeleteConfirm')?.addEventListener('click', async () => {
    if (!deletingPromotion) return;
    const button = document.getElementById('promoDeleteConfirm');
    button.disabled = true;
    button.classList.add('loading');
    try {
      await apiFetch('../backend/api/promotions/promotions.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promo_id: Number(deletingPromotion.id) })
      });
      promoDeleteModal.close();
      deletingPromotion = null;
      showToast('Promotion deleted');
      if (window.staffLiveSync) await window.staffLiveSync.refetch();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
    }
  });
}

function formatPromoRange(promo){
  if (promo.start_date && promo.end_date) return promo.start_date + ' to ' + promo.end_date;
  if (promo.start_date) return 'Starts ' + promo.start_date;
  if (promo.end_date) return 'Until ' + promo.end_date;
  return 'No date range set';
}

function openPromotionDetail(id, trigger){
  const promo = AdminState.promotions.find(item => String(item.id) === String(id));
  if (!promo || !promoDetailModal.modal) return;
  const img = document.getElementById('promoDetailImg');
  const media = document.getElementById('promoDetailMedia');
  document.getElementById('promoDetailTitle').textContent = promo.title;
  document.getElementById('promoDetailText').textContent = promo.desc || '';
  document.getElementById('promoDetailDates').textContent = formatPromoRange(promo);
  if (promo.image_path){
    img.src = '../backend/' + promo.image_path;
    img.alt = promo.title;
    img.hidden = false;
    media.hidden = false;
  } else {
    img.removeAttribute('src');
    img.alt = '';
    img.hidden = true;
    media.hidden = true;
  }
  promoDetailModal.open(trigger);
}

document.getElementById('promoGrid')?.addEventListener('click', event => {
  const deleteBtn = event.target.closest('[data-action="delete-promo"]');
  if (deleteBtn) {
    event.stopPropagation();
    deletingPromotion = AdminState.promotions.find(item => String(item.id) === String(deleteBtn.dataset.promoId));
    if (!deletingPromotion || !promoDeleteModal.modal) return;
    document.getElementById('promoDeleteName').textContent = deletingPromotion.title;
    promoDeleteModal.open(deleteBtn);
    return;
  }
  const card = event.target.closest('[data-promo-id]');
  if (card) openPromotionDetail(card.dataset.promoId, card);
});

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
        { label: 'Due', value: c => c.dueDate },
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
  const currentUser = {
    name: user.name,
    full_name: user.name,
    initials: user.initials,
    profile_image_url: window.ASDCAuthUser?.profile_image_url
  };
  ['sideFootAvatar', 'chipAvatar', 'menuAvatar'].forEach(id => {
    ASDC.HtmlHelpers.setAvatarElement(document.getElementById(id), currentUser);
  });
  set('sideFootName', user.name);
  set('sideFootRole', 'Receptionist');
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
      a ? `<div class="cell"><div class="appt-block${a.status === 'completed' ? ' appt-completed' : ''}">${a.name} <span class="t">${a.t}</span>${a.status === 'completed' ? '<span class="appt-status">Completed</span>' : ''}</div></div>`
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
      <td>${dueTag(c)}</td>
      <td>${statusTag(c)}</td>
      <td><button class="btn btn-outline btn-sm" data-action="edit-contract" data-contract-id="${c.id}">Edit</button></td>
    </tr>`
  ).join('');
}

function dueTag(item){
  const tag = {
    overdue: 'red',
    'due-today': 'amber',
    paid: 'green',
    upcoming: 'blue'
  }[item.dueStatus] || 'blue';
  return `<span class="tag tag-${tag}">${escapeHtml(item.dueDate || 'Not set')}</span>`;
}

function renderPromotions(promotions){
  const grid = document.getElementById('promoGrid');
  if (!grid) return;
  if (!promotions.length){
    grid.innerHTML = '<p class="empty-cell">No promotions on file.</p>';
    return;
  }
  grid.innerHTML = promotions.map((p, i) =>
    `<div class="promo-card promo-card-btn" role="button" tabindex="0" data-promo-id="${Number(p.id)}" aria-label="View promotion details for ${escapeHtml(p.title)}">
      ${p.image_path ? `<img class="promo-img-real" src="../backend/${escapeHtml(p.image_path)}" alt="${escapeHtml(p.title)}">` : ''}
      <div class="promo-body">
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.desc)}</p>
        <div class="promo-foot">
          <span class="tag tag-${p.tag}">${p.status}</span>
          <div class="promo-actions">
            <span>${escapeHtml(p.start_date || '')} – ${escapeHtml(p.end_date || '')}</span>
          </div>
        </div>
        <span class="promo-view">View details</span>
        <button type="button" class="promo-delete-btn" data-action="delete-promo" data-promo-id="${Number(p.id)}">Delete</button>
      </div>
    </div>`
  ).join('');
}

document.getElementById('promoGrid')?.addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key)) return;
  if (event.target.closest('[data-action="delete-promo"]')) return;
  const card = event.target.closest('[data-promo-id]');
  if (!card) return;
  event.preventDefault();
  openPromotionDetail(card.dataset.promoId, card);
});

function renderReports(reports){
  const grid = document.getElementById('reportStats');
  if (!grid) return;
  const report = reports?.[reportPeriod] || reports?.this_week || { label: 'This Week', attended: 0, missed: 0, upcoming: 0, total: 0, attendance_rate: 0, missed_rate: 0, bars: [], rows: [] };
  const label = report.label || 'This Week';
  const stats = [
    {
      iconBg: 'rgba(92,122,92,0.12)',
      iconColor: 'var(--green)',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 11 11 14 16 9"/><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
      num: String(report.attended || 0),
      label: 'Attended',
      trend: '',
      trendClass: ''
    },
    {
      iconBg: 'rgba(180,84,63,0.12)',
      iconColor: 'var(--red)',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 12.4-6.7"/><path d="m17 17 4 4"/><path d="m21 17-4 4"/></svg>',
      num: String(report.missed || 0),
      label: 'Did not attend',
      trend: '',
      trendClass: ''
    },
    {
      iconBg: 'rgba(156,139,62,0.14)',
      iconColor: 'var(--gold)',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m7 14 3-3 4 4 5-7"/></svg>',
      num: (report.attendance_rate || 0) + '%',
      label: 'Attendance rate',
      trend: '',
      trendClass: ''
    }
  ];
  grid.innerHTML = stats.map(statCard).join('');

  const heading = document.getElementById('reportHeading');
  if (heading) heading.textContent = 'Attendance: ' + label;
  const rateTag = document.getElementById('reportRateTag');
  if (rateTag) rateTag.textContent = (report.missed_rate || 0) + '% did not attend';
  const donut = document.getElementById('attendanceDonut');
  if (donut) donut.style.setProperty('--attended', (report.attendance_rate || 0) + '%');
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
  set('attendedCount', report.attended || 0);
  set('missedCount', report.missed || 0);
  set('upcomingCount', report.upcoming || 0);
  set('reportRecordCount', (report.rows || []).length + ' records');

  const bars = document.getElementById('reportBars');
  if (bars){
    bars.innerHTML = (report.bars || []).map(b => {
      const total = Number(b.attended || 0) + Number(b.missed || 0);
      const height = total ? Math.max(12, Math.round((Number(b.attended || 0) / total) * 100)) : 4;
      return `<div class="bar-col"><div class="bar attendance-bar" style="height:${height}%"><span>${Number(b.attended || 0)}/${total}</span></div><span class="bar-label">${escapeHtml(b.day)}</span></div>`;
    }
    ).join('');
  }

  const tbody = document.getElementById('attendanceReportBody');
  if (!tbody) return;
  const rows = report.rows || [];
  if (!rows.length){
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No attendance records for this period.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(row =>
    `<tr>
      <td>${escapeHtml(row.patient)}</td>
      <td>${escapeHtml(row.service)}</td>
      <td>${escapeHtml(row.date)} ${escapeHtml(row.time)}</td>
      <td>${escapeHtml(row.dentist || 'Unassigned')}</td>
      <td>${statusTag({ status: row.status, tag: row.tag })}</td>
    </tr>`
  ).join('');
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
// NOTE: the appointments page's own week grid loads itself - see
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
    AdminState.reports = data.reports || AdminState.reports;
    renderReports(AdminState.reports);
    AdminState.dashboard.stats.forEach((stat, index) => { stat.num = index === 2 ? ContractFormat.peso(data.metrics[index]) : String(data.metrics[index]); });
    renderDashboardStats(AdminState.dashboard.stats);
    AdminState.promotions = data.promotions.map(p => ({ ...p, tag: p.status === 'live' ? 'green' : 'amber' }));
    renderPromotions(AdminState.promotions);
    AdminState.inventory = data.inventory.map(i => inventoryMgr.normalize(i));
    inventoryMgr.apply();
    if (document.getElementById('view-archived')?.classList.contains('active')) loadArchivedPatients();
  }
});
