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
// Helpers & shared cell builders (declared first so every handler below
// can rely on them at any time, including on initial render).
// =====================================================================
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const nameCell = (initials, name, sub) =>
  `<div class="cell-name"><div class="mini-avatar">${initials}</div><div class="name-block">` +
  `<div class="full">${escapeHtml(name)}</div>${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}</div></div>`;

const statusTag = status => `<span class="tag tag-${status.tag}">${status.status}</span>`;

const statCard = s =>
  `<div class="stat-card">
    <div class="stat-top">
      <div class="stat-icon" style="background:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
      <span class="stat-trend ${s.trendClass}">${s.trend}</span>
    </div>
    <div class="stat-num">${s.num}</div>
    <div class="stat-label">${s.label}</div>
  </div>`;

const eyeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const pencilIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
const trashIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

// =====================================================================
// PDF REPORT EXPORT (client-side, via the browser print dialog)
// Opens a clean print window with the clinic logo + header + a table of
// the currently filtered rows, then invokes print() so the admin can
// save as PDF. No server, no libraries. `columns` = [{ label, value(row) }]
// where value() returns PLAIN TEXT (escaped into the document).
// NOTE: 'noopener' is intentionally NOT used: it would make window.open
// return null and drop the reference needed for document.write/print.
// =====================================================================
let _logoDataUrl = null;
// Loads the clinic logo once and caches it as a data URL so the print
// window (about:blank) can embed it without a relative-path lookup.
function getLogoDataUrl(){
  if (_logoDataUrl !== null) return Promise.resolve(_logoDataUrl);
  return fetch('../shared/images/asdc logo.png')
    .then(r => {
      if (!r.ok) throw new Error('logo unavailable');
      return r.blob();
    })
    .then(blob => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => { _logoDataUrl = fr.result; resolve(_logoDataUrl); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    }))
    .catch(() => { _logoDataUrl = ''; return _logoDataUrl; });
}

async function exportTablePDF({ title, columns, rows }){
  if (!rows || !rows.length){
    showToast('Nothing to export in the current view.', 'error');
    return;
  }
  const win = window.open('', '_blank');
  if (!win){
    showToast('Pop-up blocked: allow pop-ups to export the report.', 'error');
    return;
  }
  const esc = escapeHtml;
  const thead = columns.map(c => `<th>${esc(c.label)}</th>`).join('');
  const tbody = rows.map(row =>
    `<tr>${columns.map(c => `<td>${esc(c.value(row))}</td>`).join('')}</tr>`
  ).join('');
  const date = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const logo = await getLogoDataUrl();
  const logoHtml = logo
    ? `<img class="report-logo" src="${logo}" alt="Aromin-Sison Dental Clinic">`
    : '';
  win.document.write(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>` +
    `<style>
      *{box-sizing:border-box;}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B1B19;margin:0;padding:32px;}
      .report-head{display:flex;align-items:center;gap:18px;border-bottom:2px solid #9C8B3E;padding-bottom:14px;margin-bottom:22px;}
      .report-logo{width:150px;height:auto;object-fit:contain;flex-shrink:0;}
      .report-head h1{margin:0;font-family:'Fraunces',serif;font-size:20px;font-weight:600;line-height:1.2;}
      .report-meta{margin-left:auto;font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.08em;text-align:right;line-height:1.6;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      th{background:#F1EDE3;text-align:left;padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.18);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#5c5c55;}
      td{padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.1);}
      tr:last-child td{border-bottom:none;}
      .foot{margin-top:26px;font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.06em;}
      @media print{body{padding:0;}}
    </style></head><body>` +
    `<div class="report-head">${logoHtml}<h1>${esc(title)}</h1>` +
    `<div class="report-meta">Aromin-Sison Dental Clinic<br>Generated ${esc(date)}</div></div>` +
    `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>` +
    `<div class="foot">Aromin-Sison Dental Clinic · ${rows.length} record${rows.length === 1 ? '' : 's'}</div>` +
    `</body></html>`
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  showToast(title + ' ready — choose "Save as PDF" in the print dialog');
}

const views = {
  dashboard: { title: 'Dashboard', crumb: 'Overview' },
  patients: { title: 'Patient Management', crumb: 'Patients' },
  records: { title: 'Records & Protocols', crumb: 'Patients' },
  appointments: { title: 'Appointment Scheduling', crumb: 'Scheduling' },
  braces: { title: 'Braces Contracts', crumb: 'Scheduling' },
  payments: { title: 'Payment Approvals', crumb: 'Operations' },
  promotions: { title: 'Promotions', crumb: 'Marketing' },
  reports: { title: 'Attendance Reports', crumb: 'Operations' },
  inventory: { title: 'Inventory', crumb: 'Operations' }
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

// =====================================================================
// PATIENT TABLE: search + status filter + mock CRUD
// =====================================================================
let patientQuery = '';
let patientStatus = 'All';
let patientsList = []; // last filtered rows shown (used by Export)

function applyPatients(){
  const tbody = document.getElementById('patientsBody');
  if (!tbody) return;
  const q = patientQuery.trim().toLowerCase();
  const list = AdminMock.patients.filter(p => {
    // SCOPE: system only focuses on patients with a current braces
    // contract (mock rows carry `contract`; backend must JOIN
    // braces_contracts and filter to status IN ('active','defaulted')).
    const okContract = !!p.contract;
    const okStatus = patientStatus === 'All' || p.status === patientStatus;
    const okQuery = !q || [p.name, p.id, p.contact].some(v => String(v).toLowerCase().includes(q));
    return okContract && okStatus && okQuery;
  });
  patientsList = list;
  if (!list.length){
    const extra = patientStatus !== 'All' ? ' for “' + patientStatus + '”' : '';
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No patients match${q ? ' “' + escapeHtml(q) + '”' : extra}. Try a different search or filter.</td></tr>`;
    return;
  }
  renderPatients(list);
}

function renderPatients(patients){
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

// ---- topbar search (desktop) ----
const patientSearch = document.getElementById('patientSearch');
const searchClear = document.getElementById('searchClear');

function setQuery(value, { syncMobile = true } = {}){
  patientQuery = value;
  if (searchClear) searchClear.hidden = !value;
  if (syncMobile){
    const mobileInput = document.getElementById('mobileSearchInput');
    if (mobileInput) mobileInput.value = value;
  }
  applyPatients();
}

if (patientSearch){
  patientSearch.addEventListener('input', () => {
    setQuery(patientSearch.value, { syncMobile: false });
    if (patientQuery.trim() && !document.getElementById('view-patients').classList.contains('active')){
      switchView('patients');
    }
  });
}
if (searchClear){
  searchClear.addEventListener('click', () => {
    if (patientSearch) patientSearch.value = '';
    setQuery('', { syncMobile: false });
    if (patientSearch) patientSearch.focus();
  });
}

// ---- mobile / tablet search popover ----
const mobileSearchBtn = document.getElementById('searchBtn');
const mobileSearchPanel = document.getElementById('mobileSearchPanel');
const mobileSearchInput = document.getElementById('mobileSearchInput');
const mobileSearchClear = document.getElementById('mobileSearchClear');
const mobileSearchResults = document.getElementById('mobileSearchResults');

function renderMobileResults(query){
  if (!mobileSearchResults) return;
  const q = query.trim().toLowerCase();
  if (!q){
    mobileSearchResults.innerHTML = '<p class="search-hint">Start typing to search patients by name, ID, or contact.</p>';
    return;
  }
  const matches = AdminMock.patients.filter(p =>
    p.contract && [p.name, p.id, p.contact].some(v => String(v).toLowerCase().includes(q))
  );
  if (!matches.length){
    mobileSearchResults.innerHTML = `<p class="search-empty">No patients match “${escapeHtml(query.trim())}”.</p>`;
    return;
  }
  mobileSearchResults.innerHTML = matches.map(p =>
    `<button type="button" class="search-result" data-id="${p.id}">
      <span class="mini-avatar">${p.initials}</span>
      <span class="name-block"><span class="full">${escapeHtml(p.name)}</span><span class="sub">${p.id}</span></span>
      ${statusTag(p)}
    </button>`
  ).join('');
  mobileSearchResults.querySelectorAll('.search-result').forEach(btn => {
    btn.addEventListener('click', () => {
      setQuery(mobileSearchInput.value, { syncMobile: false });
      if (patientSearch) patientSearch.value = patientQuery;
      applyPatients();
      switchView('patients');
      Popover.close(mobileSearchPanel);
    });
  });
}

if (mobileSearchBtn && mobileSearchPanel){
  mobileSearchBtn.addEventListener('click', () => {
    Popover.toggle(mobileSearchBtn, mobileSearchPanel, {
      onOpen: () => {
        mobileSearchInput.value = patientQuery;
        if (mobileSearchClear) mobileSearchClear.hidden = !patientQuery;
        renderMobileResults(patientQuery);
      }
    });
  });
  mobileSearchInput.addEventListener('input', () => {
    if (mobileSearchClear) mobileSearchClear.hidden = !mobileSearchInput.value;
    renderMobileResults(mobileSearchInput.value);
  });
  if (mobileSearchClear){
    mobileSearchClear.addEventListener('click', () => {
      mobileSearchInput.value = '';
      mobileSearchClear.hidden = true;
      renderMobileResults('');
      mobileSearchInput.focus();
    });
  }
}

// ---- status filter chips + row actions (view / edit / delete) ----
const patientsGroup = document.querySelector('[aria-label="Filter patients"]');
wireChips(patientsGroup, label => {
  patientStatus = label;
  applyPatients();
});

document.getElementById('patientsBody').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const patient = AdminMock.patients.find(p => p.id === btn.dataset.id);
  if (!patient) return;
  if (btn.dataset.action === 'view') openPatientDetail(patient);
  else if (btn.dataset.action === 'edit') openPatientForm(patient);
  else if (btn.dataset.action === 'delete') openDeleteConfirm(patient);
});

// =====================================================================
// RECORDS TABLE: category filter + view details
// =====================================================================
let recordFilter = null; // null = All
let recordsList = [];    // last filtered rows shown (used by Archive)
const selectedRecords = new Set(); // record objects the admin ticked for archiving

function applyRecords(){
  const tbody = document.getElementById('recordsBody');
  if (!tbody) return;
  // SCOPE: only records belonging to patients with a current braces
  // contract appear here (same filter as the patients table).
  const contractNames = new Set(AdminMock.patients.filter(p => p.contract).map(p => p.name));
  const list = (recordFilter ? AdminMock.records.filter(r => r.category === recordFilter) : AdminMock.records)
    .filter(r => contractNames.has(r.name));
  recordsList = list;
  if (!list.length){
    tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">No records in this category yet.</td></tr>`;
    syncSelectAll();
    return;
  }
  renderRecords(list);
}

function syncSelectAll(){
  const selectAll = document.getElementById('selectAllRecords');
  if (!selectAll) return;
  const visible = recordsList.filter(r => selectedRecords.has(r)).length;
  selectAll.checked = recordsList.length > 0 && visible === recordsList.length;
  selectAll.indeterminate = visible > 0 && visible < recordsList.length;
}

function renderRecords(records){
  const tbody = document.getElementById('recordsBody');
  if (!tbody) return;
  tbody.innerHTML = records.map((r, i) =>
    `<tr>
      <td class="check-cell"><input type="checkbox" class="row-check" data-index="${i}" ${selectedRecords.has(r) ? 'checked' : ''} aria-label="Select record: ${r.procedure}"></td>
      <td>${nameCell(r.initials, r.name)}</td>
      <td>${r.procedure}</td>
      <td>${r.date}</td>
      <td>${r.dentist}</td>
      <td>${statusTag(r)}</td>
      <td><div class="row-actions"><button class="icon-btn" data-action="view" data-index="${i}" aria-label="View record: ${r.procedure}">${eyeIcon}</button></div></td>
    </tr>`
  ).join('');
  syncSelectAll();
}

const recordsGroup = document.querySelector('[aria-label="Filter records"]');
wireChips(recordsGroup, label => {
  recordFilter = label === 'All' ? null : (label === 'Treatments' ? 'Treatment' : (label === 'Protocols' ? 'Protocol' : label));
  applyRecords();
});

// Row checkboxes + select-all: build the archive selection set.
document.getElementById('recordsBody').addEventListener('change', e => {
  const cb = e.target.closest('.row-check');
  if (!cb) return;
  const record = recordsList[Number(cb.dataset.index)];
  if (!record) return;
  if (cb.checked) selectedRecords.add(record);
  else selectedRecords.delete(record);
  syncSelectAll();
});

const selectAllRecords = document.getElementById('selectAllRecords');
if (selectAllRecords){
  selectAllRecords.addEventListener('change', () => {
    if (selectAllRecords.checked){
      recordsList.forEach(r => selectedRecords.add(r));
    } else {
      recordsList.forEach(r => selectedRecords.delete(r));
    }
    applyRecords();
  });
}

document.getElementById('recordsBody').addEventListener('click', e => {
  const btn = e.target.closest('[data-action="view"]');
  if (!btn) return;
  const record = recordsList[Number(btn.dataset.index)];
  if (!record) return;
  openDetail('Record Details', [
    ['Patient', record.name],
    ['Procedure', record.procedure],
    ['Date', record.date],
    ['Dentist', record.dentist],
    ['Status', `<span class="tag tag-${record.tag}">${record.status}</span>`]
  ], false);
});

// =====================================================================
// BRACES CONTRACTS TABLE: status filter
// =====================================================================
let bracesFilter = 'Current'; // SCOPE: default to current/delinquent contracts only
let bracesList = [];          // last filtered rows shown (used by Export)

function applyBraces(){
  const tbody = document.getElementById('bracesBody');
  if (!tbody) return;
  const list = bracesFilter ? AdminMock.braces.filter(c => c.status === bracesFilter) : AdminMock.braces;
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
// INVENTORY TABLE: category / stock-level filter
// =====================================================================
let invFilter = 'All';
let inventoryList = []; // last filtered rows shown (used by Export)

function applyInventory(){
  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;
  let list = AdminMock.inventory;
  if (invFilter === 'Low stock') list = list.filter(i => i.status === 'Low' || i.status === 'Reorder');
  else if (invFilter === 'Consumables') list = list.filter(i => i.category === 'Consumable');
  else if (invFilter === 'Equipment') list = list.filter(i => i.category === 'Equipment');
  inventoryList = list;
  if (!list.length){
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No inventory items match this filter.</td></tr>`;
    return;
  }
  renderInventory(list);
}

const inventoryGroup = document.querySelector('[aria-label="Filter inventory"]');
wireChips(inventoryGroup, label => {
  invFilter = label;
  applyInventory();
});

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

const apptGroup = document.querySelector('[aria-label="Filter schedule"]');
wireChips(apptGroup, label => renderApptMode(label));

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
  storageKey: 'asdc.notif.admin',
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
// PATIENT MODALS: view details / add / edit / delete (mock CRUD)
// =====================================================================
const detailModal = new Modal('detailModal');
const detailCancelBtn = document.getElementById('detailCancelBtn');
const detailCloseBtn = document.getElementById('detailClose');
const detailEditBtn = document.getElementById('detailEditBtn');
let detailCurrent = null;

if (detailModal.modal){
  detailModal.registerClose(detailCancelBtn);
  detailModal.registerClose(detailCloseBtn);
  detailEditBtn.addEventListener('click', () => {
    if (detailCurrent) openPatientForm(detailCurrent);
  });
}

function openDetail(title, rows, editable){
  if (!detailModal.modal) return;
  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailRows').innerHTML = rows.map(([label, value]) =>
    `<div class="row"><span>${label}</span><span>${value}</span></div>`
  ).join('');
  detailEditBtn.hidden = !editable;
  detailModal.open();
}

function openPatientDetail(p){
  detailCurrent = p;
  openDetail('Patient Details', [
    ['Patient ID', p.id],
    ['Contract', p.contract || '—'],
    ['Contact', p.contact],
    ['Last Visit', p.lastVisit],
    ['Balance', p.balance],
    ['Status', `<span class="tag tag-${p.tag}">${p.status}</span>`]
  ], true);
}

// ---- Add / Edit patient form ----
const patientFormModal = new Modal('patientFormModal');
const patientFormCloseBtn = document.getElementById('patientFormClose');
const patientFormCancelBtn = document.getElementById('patientFormCancel');
const patientFormSaveBtn = document.getElementById('patientFormSave');
const patientFormNote = document.getElementById('patientFormNote');
let editingPatient = null;

if (patientFormModal.modal){
  patientFormModal.registerClose(patientFormCloseBtn);
  patientFormModal.registerClose(patientFormCancelBtn);
}

function showFormNote(message, isError){
  patientFormNote.textContent = message;
  patientFormNote.classList.toggle('err', !!isError);
  patientFormNote.classList.toggle('ok', !isError);
  patientFormNote.hidden = false;
}

function openPatientForm(patient){
  editingPatient = patient || null;
  document.getElementById('patientFormTitle').textContent = patient ? 'Edit Patient' : 'Add Patient';
  patientFormSaveBtn.querySelector('.btn-label').textContent = patient ? 'Save Changes' : 'Add Patient';
  document.getElementById('pfName').value = patient ? patient.name : '';
  document.getElementById('pfContact').value = patient ? patient.contact : '';
  document.getElementById('pfLastVisit').value = patient ? patient.lastVisit : '';
  document.getElementById('pfBalance').value = patient ? patient.balance : '';
  document.getElementById('pfStatus').value = patient ? patient.status : 'Current';
  patientFormNote.hidden = true;
  patientFormModal.open();
}

function initialsOf(name){
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function tagFor(status){
  if (status === 'Current') return 'amber';
  if (status === 'Overdue') return 'red';
  return 'green';
}

if (patientFormModal.modal){
  document.getElementById('addPatientBtn').addEventListener('click', () => openPatientForm(null));
  patientFormSaveBtn.addEventListener('click', () => {
    const name = document.getElementById('pfName').value.trim();
    const contact = document.getElementById('pfContact').value.trim();
    if (!name || !contact){
      showFormNote('Name and contact number are required.', true);
      return;
    }
    patientFormSaveBtn.classList.add('is-loading');
    // TODO(backend): POST /backend/api/patients then re-render from response
    setTimeout(() => {
      patientFormSaveBtn.classList.remove('is-loading');
      if (editingPatient){
        Object.assign(editingPatient, {
          name,
          contact,
          lastVisit: document.getElementById('pfLastVisit').value.trim() || editingPatient.lastVisit,
          balance: document.getElementById('pfBalance').value.trim() || editingPatient.balance,
          status: document.getElementById('pfStatus').value,
          initials: initialsOf(name),
          tag: tagFor(document.getElementById('pfStatus').value)
        });
      } else {
        AdminMock.patients.unshift({
          initials: initialsOf(name),
          name,
          id: '#P-10' + (1070 + AdminMock.patients.length),
          contact,
          lastVisit: document.getElementById('pfLastVisit').value.trim() || '—',
          balance: document.getElementById('pfBalance').value.trim() || '₱0.00',
          status: document.getElementById('pfStatus').value,
          tag: tagFor(document.getElementById('pfStatus').value),
          // New patients get a braces contract ref so the braces-only lists pick them up.
          contract: '#B-' + (350 + AdminMock.patients.length)
        });
        patientStatus = 'All';
        setChipGroup(patientsGroup, 'All');
      }
      patientFormModal.close();
      applyPatients();
      showToast(editingPatient ? 'Patient updated' : 'Patient added');
    }, 500);
  });
  // Enter in a field submits the form
  patientFormModal.modal.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input')){
      e.preventDefault();
      patientFormSaveBtn.click();
    }
  });
}

// ---- Delete patient confirm ----
const deleteModal = new Modal('deleteModal');
const deleteCloseBtn = document.getElementById('deleteClose');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
let deletingPatient = null;

if (deleteModal.modal){
  deleteModal.registerClose(deleteCloseBtn);
  deleteModal.registerClose(deleteCancelBtn);
  deleteConfirmBtn.addEventListener('click', () => {
    if (!deletingPatient) return;
    const removed = deletingPatient;
    AdminMock.patients = AdminMock.patients.filter(p => p !== removed);
    deleteModal.close();
    deletingPatient = null;
    applyPatients();
    showToast(removed.name + ' deleted (mock)');
  });
}

function openDeleteConfirm(patient){
  deletingPatient = patient;
  document.getElementById('deleteText').textContent =
    `Delete ${patient.name} (${patient.id})? This action can't be undone.`;
  deleteModal.open();
}

// =====================================================================
// RECORDS: add new treatment record (functional mock)
// =====================================================================
const recordFormModal = new Modal('recordFormModal');
let editingRecord = null;

if (recordFormModal.modal){
  recordFormModal.registerClose(document.getElementById('recordFormClose'));
  recordFormModal.registerClose(document.getElementById('recordFormCancel'));

  const patientList = document.getElementById('patientList');
  if (patientList){
    patientList.innerHTML = AdminMock.patients.map(p => `<option value="${p.name}">`).join('');
  }
  const recordNote = document.getElementById('recordFormNote');
  const recordSaveBtn = document.getElementById('recordFormSave');

  document.getElementById('addRecordBtn').addEventListener('click', () => {
    editingRecord = null;
    document.getElementById('recordFormTitle').textContent = 'Add Treatment Record';
    recordSaveBtn.querySelector('.btn-label').textContent = 'Add Record';
    document.getElementById('rfPatient').value = '';
    document.getElementById('rfProcedure').value = '';
    document.getElementById('rfDate').value = '';
    recordNote.hidden = true;
    recordFormModal.open();
  });

  recordSaveBtn.addEventListener('click', () => {
    const name = document.getElementById('rfPatient').value.trim();
    const procedure = document.getElementById('rfProcedure').value.trim();
    const date = document.getElementById('rfDate').value;
    if (!name || !procedure){
      recordNote.textContent = 'Patient name and procedure are required.';
      recordNote.classList.add('err'); recordNote.classList.remove('ok');
      recordNote.hidden = false;
      return;
    }
    if (!date){
      recordNote.textContent = 'Please choose a date.';
      recordNote.classList.add('err'); recordNote.classList.remove('ok');
      recordNote.hidden = false;
      return;
    }
    const category = document.getElementById('rfCategory').value;
    const status = document.getElementById('rfStatus').value;
    const row = {
      initials: initialsOf(name),
      name,
      procedure,
      date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dentist: document.getElementById('rfDentist').value,
      status,
      tag: status === 'In progress' ? 'amber' : 'green',
      category
    };
    if (editingRecord){
      Object.assign(editingRecord, row);
    } else {
      AdminMock.records.unshift(row);
    }
    recordFormModal.close();
    applyRecords();
    showToast(editingRecord ? 'Record updated' : 'Record added');
  });
}

// =====================================================================
// BRACES CONTRACTS: add + edit status (functional mock)
// =====================================================================
const contractFormModal = new Modal('contractFormModal');
let editingContract = null;
const peso = n => '₱' + Number(n).toLocaleString('en-US');

if (contractFormModal.modal){
  contractFormModal.registerClose(document.getElementById('contractFormClose'));
  contractFormModal.registerClose(document.getElementById('contractFormCancel'));

  const cfPatient = document.getElementById('cfPatient');
  const fillPatients = () => {
    cfPatient.innerHTML = AdminMock.patients
      .map(p => `<option value="${p.name}">${p.name} (${p.id})</option>`).join('');
  };
  fillPatients();
  const contractNote = document.getElementById('contractFormNote');
  const contractSaveBtn = document.getElementById('contractFormSave');

  function openContractForm(contract){
    editingContract = contract || null;
    document.getElementById('contractFormTitle').textContent = contract ? 'Edit Contract' : 'New Braces Contract';
    contractSaveBtn.querySelector('.btn-label').textContent = contract ? 'Save Changes' : 'Create Contract';
    cfPatient.value = contract ? contract.name : (cfPatient.options[0] || {}).value;
    if (contract){
      const m = /(\d+)-month/.exec(contract.plan);
      document.getElementById('cfMonths').value = m ? m[1] : 24;
      document.getElementById('cfMonthly').value = Number(String(contract.monthly).replace(/[₱,]/g, '')) || 2000;
    } else {
      document.getElementById('cfMonths').value = '';
      document.getElementById('cfMonthly').value = '';
    }
    document.getElementById('cfStatus').value = contract ? contract.status : 'Current';
    contractNote.hidden = true;
    contractFormModal.open();
  }

  document.getElementById('addContractBtn').addEventListener('click', () => openContractForm(null));

  document.getElementById('bracesBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action="edit-contract"]');
    if (!btn) return;
    const contract = AdminMock.braces[Number(btn.dataset.index)];
    if (contract) openContractForm(contract);
  });

  contractSaveBtn.addEventListener('click', () => {
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
    const patient = AdminMock.patients.find(p => p.name === cfPatient.value);
    const status = document.getElementById('cfStatus').value;
    const total = months * monthly;
    const data = {
      initials: patient ? patient.initials : initialsOf(cfPatient.value),
      name: cfPatient.value,
      id: '#B-' + (150 + AdminMock.braces.length),
      plan: months + '-month · ' + peso(monthly) + '/mo',
      monthly: peso(monthly),
      paid: editingContract ? editingContract.paid : '₱0',
      balance: peso(total - (editingContract ? Number(String(editingContract.paid).replace(/[₱,]/g, '')) : 0)),
      status,
      tag: tagFor(status)
    };
    if (editingContract){
      Object.assign(editingContract, data);
    } else {
      AdminMock.braces.unshift(data);
    }
    contractFormModal.close();
    applyBraces();
    showToast(editingContract ? 'Contract updated' : 'Contract created');
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
}

// =====================================================================
// INVENTORY: add item (functional mock)
// =====================================================================
const inventoryFormModal = new Modal('inventoryFormModal');

if (inventoryFormModal.modal){
  inventoryFormModal.registerClose(document.getElementById('inventoryFormClose'));
  inventoryFormModal.registerClose(document.getElementById('inventoryFormCancel'));
  const invNote = document.getElementById('inventoryFormNote');
  const invSaveBtn = document.getElementById('inventoryFormSave');

  document.getElementById('addInventoryBtn').addEventListener('click', () => {
    document.getElementById('ivName').value = '';
    document.getElementById('ivStock').value = '';
    document.getElementById('ivCategory').value = 'Consumable';
    invNote.hidden = true;
    inventoryFormModal.open();
  });

  invSaveBtn.addEventListener('click', () => {
    const name = document.getElementById('ivName').value.trim();
    const stock = Number(document.getElementById('ivStock').value);
    if (!name){
      invNote.textContent = 'Item name is required.';
      invNote.classList.add('err'); invNote.classList.remove('ok');
      invNote.hidden = false;
      return;
    }
    if (!Number.isFinite(stock) || stock < 0){
      invNote.textContent = 'Enter a valid stock quantity.';
      invNote.classList.add('err'); invNote.classList.remove('ok');
      invNote.hidden = false;
      return;
    }
    const status = stock <= 5 ? 'Reorder' : (stock <= 10 ? 'Low' : 'OK');
    const tag = status === 'Reorder' ? 'red' : (status === 'Low' ? 'amber' : 'green');
    AdminMock.inventory.unshift({
      initials: name.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
      item: name,
      category: document.getElementById('ivCategory').value,
      stock: String(stock),
      width: String(Math.min(Math.max(stock * 5, 8), 100)),
      fill: tag === 'red' ? 'var(--red)' : (tag === 'amber' ? 'var(--amber)' : 'var(--green)'),
      status,
      tag
    });
    inventoryFormModal.close();
    applyInventory();
    showToast('Inventory item added');
  });
}

// =====================================================================
// APPOINTMENTS: book a slot on the week grid (functional mock)
// =====================================================================
const apptFormModal = new Modal('apptFormModal');

if (apptFormModal.modal){
  apptFormModal.registerClose(document.getElementById('apptFormClose'));
  apptFormModal.registerClose(document.getElementById('apptFormCancel'));
  const apptNote = document.getElementById('apptFormNote');
  const apptSaveBtn = document.getElementById('apptFormSave');
  const afPatient = document.getElementById('afPatient');
  const afDay = document.getElementById('afDay');
  const afTime = document.getElementById('afTime');

  const fillApptForm = () => {
    afPatient.innerHTML = AdminMock.patients
      .map(p => `<option value="${p.name}">${p.name} (${p.id})</option>`).join('');
    afDay.innerHTML = AdminMock.dashboard.week.days.map(d => `<option>${d}</option>`).join('');
    afTime.innerHTML = AdminMock.dashboard.week.rows.map(r => `<option>${r.time}</option>`).join('');
  };
  fillApptForm();
  const svcShort = {
    'Braces Adjustment': 'Braces adj.',
    'Braces Installation': 'Braces install',
    'Cleaning & Check-up': 'Cleaning',
    'Consultation': 'Consult'
  };

  document.getElementById('addApptBtn').addEventListener('click', () => {
    apptNote.hidden = true;
    apptFormModal.open();
  });

  apptSaveBtn.addEventListener('click', () => {
    const patient = AdminMock.patients.find(p => p.name === afPatient.value);
    if (!patient){
      apptNote.textContent = 'Choose a patient first.';
      apptNote.classList.add('err'); apptNote.classList.remove('ok');
      apptNote.hidden = false;
      return;
    }
    const week = AdminMock.dashboard.week;
    const dayIdx = week.days.indexOf(afDay.value);
    const row = week.rows.find(r => r.time === afTime.value);
    if (dayIdx < 0 || !row){
      apptNote.textContent = 'Pick a valid day and time.';
      apptNote.classList.add('err'); apptNote.classList.remove('ok');
      apptNote.hidden = false;
      return;
    }
    if (row.appts[dayIdx]){
      apptNote.textContent = 'That slot is already booked. Pick another.';
      apptNote.classList.add('err'); apptNote.classList.remove('ok');
      apptNote.hidden = false;
      return;
    }
    const svc = document.getElementById('afService').value;
    const short = name => name.trim().split(/\s+/).map(w => w[0] + '.').join(' ');
    row.appts[dayIdx] = { name: short(patient.name), t: afTime.value + ' · ' + (svcShort[svc] || svc) };
    AdminMock.dashboard.queue.unshift({
      initials: patient.initials,
      name: patient.name,
      sub: svc,
      time: afTime.value,
      status: 'Waiting',
      tag: 'amber'
    });
    apptFormModal.close();
    renderApptMode('Week');
    renderWeekGrid('dashWeekGrid', week);
    renderQueue(AdminMock.dashboard.queue);
    showToast('Appointment booked');
  });
}

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
      rows: patientsList
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
      rows: inventoryList
    });
  });
}

const archiveRecordsBtn = document.getElementById('archiveRecordsBtn');
if (archiveRecordsBtn){
  archiveRecordsBtn.addEventListener('click', () => {
    if (!selectedRecords.size){
      showToast('Select at least one record to archive.', 'error');
      return;
    }
    const batch = Array.from(selectedRecords);
    AdminMock.records = AdminMock.records.filter(r => !selectedRecords.has(r));
    selectedRecords.clear();
    applyRecords();
    showToast(batch.length + ' record' + (batch.length === 1 ? '' : 's') + ' archived', 'success', {
      label: 'Undo',
      onClick: () => {
        AdminMock.records = AdminMock.records.concat(batch);
        selectedRecords.clear();
        applyRecords();
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
initSidebar('asdc.admin.sidebar.collapsed');
initLogout('../auth/login.html?role=staff');

// =====================================================================
// MOCK DATA RENDERING
// Each render*() function draws one dataset from AdminMock into a
// container in dashboard.html. When the backend is ready, replace the
// `AdminMock.<section>` argument with the fetch() response value.
// =====================================================================

function renderUser(user){
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('sideFootAvatar', user.initials);
  set('sideFootName', user.name);
  set('sideFootRole', user.role);
  set('chipAvatar', user.initials);
  set('menuAvatar', user.initials);
  set('menuName', user.name);
  set('menuRole', user.role);
  set('greetingText', user.greeting);
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
  tbody.innerHTML = contracts.map((c, i) =>
    `<tr>
      <td>${nameCell(c.initials, c.name, c.id)}</td>
      <td>${c.plan}</td>
      <td>${c.monthly}</td>
      <td>${c.paid}</td>
      <td>${c.balance}</td>
      <td>${statusTag(c)}</td>
      <td><button class="btn btn-outline btn-sm" data-action="edit-contract" data-index="${i}">Edit</button></td>
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
          <button class="btn btn-outline btn-sm" data-action="edit-promo" data-index="${i}">Edit</button>
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

// =====================================================================
// PAYMENT APPROVALS (patient -> QR bank transfer -> receipt upload)
// Reads the SHARED submissions store (asdc.payments) that the patient
// portal writes to. Staff view receipts, then Approve or Reject. When
// the backend lands, replace these with the real payment API endpoints.
// =====================================================================
const AdminPayStore = {
  key: 'asdc.payments',
  all(){
    try {
      const raw = localStorage.getItem(this.key);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e){ return []; }
  },
  save(list){
    try { localStorage.setItem(this.key, JSON.stringify(list)); } catch (e){}
  }
};

let payFilter = 'Pending';
const PAY_LABEL = { pending: 'Pending Confirmation', approved: 'Approved', rejected: 'Rejected' };
const PAY_TAG = { pending: 'amber', approved: 'green', rejected: 'red' };

function renderPayments(){
  const tbody = document.getElementById('adminPaymentsBody');
  const empty = document.getElementById('payAdminEmpty');
  const countTag = document.getElementById('payQueueCount');
  if (!tbody) return;
  const list = AdminPayStore.all()
    .filter(s => payFilter === 'All' || s.status === payFilter.toLowerCase())
    .slice().reverse();
  if (countTag){
    const pending = AdminPayStore.all().filter(s => s.status === 'pending').length;
    countTag.hidden = pending === 0;
    countTag.textContent = pending + ' awaiting confirmation';
  }
  if (!list.length){
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  tbody.innerHTML = list.map((s, i) => {
    const initials = String(s.patient || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const actions = s.status === 'pending'
      ? '<button class="btn btn-sm btn-approve" data-pay-action="approve" data-pay-id="' + escapeHtml(s.id) + '">Approve</button>' +
        '<button class="btn btn-sm btn-reject" data-pay-action="reject" data-pay-id="' + escapeHtml(s.id) + '">Reject</button>'
      : '';
    return `<tr>
      <td>${nameCell(initials, s.patient, s.pid)}</td>
      <td>${escapeHtml(s.amount)}</td>
      <td>${escapeHtml(s.method)}</td>
      <td>${escapeHtml(s.submittedAt)}</td>
      <td><button class="btn btn-outline btn-sm" data-pay-action="view" data-pay-id="${escapeHtml(s.id)}">View</button></td>
      <td><span class="tag tag-${PAY_TAG[s.status]}">${PAY_LABEL[s.status]}</span></td>
      <td><div class="pay-actions">${actions}</div></td>
    </tr>`;
  }).join('');
}

function payById(id){
  return AdminPayStore.all().find(s => s.id === id);
}

function commitPayment(updated){
  const list = AdminPayStore.all();
  const i = list.findIndex(s => s.id === updated.id);
  if (i >= 0) list[i] = updated;
  AdminPayStore.save(list);
  renderPayments();
}

// ---------- Receipt review modal ----------
const receiptModal = new Modal('receiptModal');
let receiptCurrent = null;
if (receiptModal.modal){
  receiptModal.registerClose(document.getElementById('receiptClose'));
  receiptModal.registerClose(document.getElementById('receiptCancelBtn'));
  const openReceipt = s => {
    receiptCurrent = s;
    document.getElementById('rcPatient').textContent = s.patient + ' · ' + s.pid;
    document.getElementById('rcAmount').textContent = s.amount;
    document.getElementById('rcMethod').textContent = s.method;
    document.getElementById('rcSubmitted').textContent = s.submittedAt;
    const noteField = document.getElementById('rcNoteField');
    const noteEl = document.getElementById('rcNote');
    if (noteField && noteEl){
      noteField.hidden = !s.note;
      noteEl.textContent = s.note || '';
    }
    document.getElementById('receiptImg').src = s.receiptDataUrl || '';
    const pending = s.status === 'pending';
    document.getElementById('approvePaymentBtn').hidden = !pending;
    document.getElementById('rejectPaymentBtn').hidden = !pending;
    receiptModal.open(document.getElementById('receiptClose'));
  };
  document.getElementById('approvePaymentBtn').addEventListener('click', () => {
    if (receiptCurrent) approvePayment(receiptCurrent);
  });
  document.getElementById('rejectPaymentBtn').addEventListener('click', () => {
    if (receiptCurrent) rejectPayment(receiptCurrent);
  });
}

function approvePayment(s){
  const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const seq = String(100 + AdminPayStore.all().filter(x => x.status === 'approved').length);
  commitPayment(Object.assign({}, s, {
    status: 'approved',
    reviewedAt: now,
    orNumber: 'OR-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + seq
  }));
  if (receiptModal.modal) receiptModal.close();
  showToast('Payment of ' + s.amount + ' approved for ' + s.patient);
}

function rejectPayment(s){
  const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  commitPayment(Object.assign({}, s, { status: 'rejected', reviewedAt: now, orNumber: null }));
  if (receiptModal.modal) receiptModal.close();
  showToast('Payment of ' + s.amount + ' rejected for ' + s.patient, 'error');
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-pay-action]');
  if (!btn) return;
  const sub = payById(btn.dataset.payId);
  if (!sub) return;
  const action = btn.dataset.payAction;
  if (action === 'view') openReceipt(sub);
  else if (action === 'approve') approvePayment(sub);
  else if (action === 'reject') rejectPayment(sub);
});

(function wirePayFilter(){
  const group = document.querySelector('#view-payments .toolbar-left');
  if (!group) return;
  wireChips(group, label => { payFilter = label; renderPayments(); });
  setChipGroup(group, 'Pending');
})();

// ---------- Render everything on load ----------
renderUser(AdminMock.user);
renderDashboardStats(AdminMock.dashboard.stats);
renderWeekGrid('dashWeekGrid', AdminMock.dashboard.week);
renderApptMode('Week');
renderQueue(AdminMock.dashboard.queue);
applyPatients();                            // TODO(backend): GET /backend/api/patients/list.php
applyRecords();
applyBraces();
renderPromotions(AdminMock.promotions);
renderReports(AdminMock.reports);
applyInventory();
renderPayments();
