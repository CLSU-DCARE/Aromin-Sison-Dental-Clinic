/* =====================================================================
   Aromin-Sison Dental Clinic: Dentist Dashboard
   Streamlined view for dental practitioners: patients, treatment records,
   and appointments. Uses the same shared core and mock data as the
   receptionist dashboard.
   ===================================================================== */

// ---------- View switching ----------
const viewButtons = document.querySelectorAll('.nav-item[data-view]');
const viewSections = document.querySelectorAll('.view');
const viewTitle = document.getElementById('viewTitle');

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  patients: 'Patients',
  records: 'Treatment Records',
  appointments: 'Appointments'
};

function switchView(viewKey){
  viewButtons.forEach(b => {
    const active = b.dataset.view === viewKey;
    b.classList.toggle('active', active);
    b.setAttribute('aria-current', active ? 'page' : 'false');
  });
  viewSections.forEach(s => {
    const show = s.dataset.view === viewKey;
    s.hidden = !show;
  });
  if (viewTitle) viewTitle.textContent = VIEW_TITLES[viewKey] || viewKey;
}

viewButtons.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

// ---------- Chip filters ----------
function wireChips(container, onChange){
  if (!container) return;
  container.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    onChange(chip.dataset.filter);
  });
}
function setChipGroup(container, label){
  if (!container) return;
  container.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === label));
}

// ---------- Helpers ----------
function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function nameCell(initials, name, sub){
  return `<div class="name-cell"><div class="avatar-xs">${initials}</div><div><div class="name">${escapeHtml(name)}</div>${sub ? '<div class="sub">'+escapeHtml(sub)+'</div>' : ''}</div></div>`;
}
function statusTag(item){
  return `<span class="tag tag-${item.tag}">${item.status}</span>`;
}
function statCard(stat){
  return `<div class="stat-card"><div class="stat-top"><div class="stat-icon" style="background:${stat.iconBg};color:${stat.iconColor};">${stat.icon}</div></div><div class="stat-num">${stat.num}</div><div class="stat-label">${stat.label}</div></div>`;
}

// =====================================================================
// SHARED DASHBOARD CORE (from ../shared/js/dashboard-core.js)
// =====================================================================
initToastTriggers();
initFullscreenToggle();
initSidebar('asdc.dentist.sidebar.collapsed');
initLogout('../auth/login.html');

// User menu popover
const userChip = document.getElementById('userChip');
const userMenu = document.getElementById('userMenu');
if (userChip && userMenu){
  userChip.addEventListener('click', () => Popover.toggle(userChip, userMenu));
  userMenu.querySelector('[data-action="logout"]')?.addEventListener('click', () => openLogoutConfirm());
}

// =====================================================================
// MOCK DATA RENDERING
// =====================================================================

function renderUser(user){
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('sideFootAvatar', user.initials);
  set('sideFootName', user.name);
  set('sideFootRole', 'Dentist');
  set('chipAvatar', user.initials);
  set('menuAvatar', user.initials);
  set('menuName', user.name);
  set('menuRole', 'Dentist');
  set('greetingText', user.greeting);
  set('greetingSubtext', user.name + ' · Dentist');
}

function renderDashboardStats(stats){
  const grid = document.getElementById('dashStats');
  if (!grid) return;
  grid.innerHTML = stats.map(statCard).join('');
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

function renderPatients(patients){
  const tbody = document.getElementById('patientsBody');
  if (!tbody) return;
  if (!patients.length){
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No patients to display.</td></tr>';
    return;
  }
  tbody.innerHTML = patients.map(p =>
    `<tr><td>${nameCell(p.initials, p.name, p.id)}</td><td>${escapeHtml(p.plan)}</td><td>${escapeHtml(p.monthly)}</td><td>${escapeHtml(p.paid)}</td><td>${escapeHtml(p.balance)}</td><td>${statusTag(p)}</td></tr>`
  ).join('');
}

function renderRecords(records){
  const tbody = document.getElementById('recordsBody');
  if (!tbody) return;
  if (!records.length){
    tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No treatment records found.</td></tr>';
    return;
  }
  tbody.innerHTML = records.map(r =>
    `<tr><td>${escapeHtml(r.patient)}</td><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.details)}</td><td>${escapeHtml(r.date)}</td></tr>`
  ).join('');
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

// ---------- Records filter ----------
let recordsFilter = 'All';
function applyRecords(){
  const records = AdminMock.records || [];
  const filtered = recordsFilter === 'All' ? records : records.filter(r => r.category === recordsFilter);
  renderRecords(filtered);
}

(function wireRecordsFilter(){
  const group = document.querySelector('#view-records .toolbar-left');
  if (!group) return;
  wireChips(group, label => { recordsFilter = label; applyRecords(); });
})();

// ---------- Patients filter ----------
let patientsFilter = 'All';
function applyPatients(){
  const patients = AdminMock.patients || [];
  const filtered = patientsFilter === 'All' ? patients : patients.filter(p => p.status === patientsFilter);
  renderPatients(filtered);
}

(function wirePatientsFilter(){
  const group = document.querySelector('#view-patients .toolbar-left');
  if (!group) return;
  wireChips(group, label => { patientsFilter = label; applyPatients(); });
})();

// ---------- Appointment loading ----------
async function loadAppointmentWeek(){
  try {
    const res = await fetch('../backend/api/appointments/week.php');
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    if (data.success && data.week) renderWeekGrid('apptWeekGrid', data.week);
    else renderWeekGrid('apptWeekGrid', AdminMock.dashboard.week);
  } catch(e){
    renderWeekGrid('apptWeekGrid', AdminMock.dashboard.week);
  }
}

// ---------- Render everything on load ----------
renderUser(AdminMock.user);
renderDashboardStats(AdminMock.dashboard.stats);
renderQueue(AdminMock.dashboard.queue);
applyPatients();
applyRecords();
loadAppointmentWeek();
