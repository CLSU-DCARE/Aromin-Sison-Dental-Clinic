// =====================================================================
// PATIENT DASHBOARD: page-specific logic
// Shared utilities (Modal, toast, sidebar, fullscreen, logout) live in
// ../shared/js/dashboard-core.js and are loaded before this file.
// Sample data lives in ../shared/js/mock-data/patient.js and is rendered
// here; swap `PatientMock.<section>` for a fetch() response later.
// =====================================================================

const views = {
  dashboard: { title: 'My Dashboard', crumb: 'Overview' },
  profile: { title: 'My Profile', crumb: 'Account' },
  schedule: { title: 'My Appointment Schedule', crumb: 'Appointments' },
  book: { title: 'Book an Appointment', crumb: 'Appointments' },
  history: { title: 'Appointment History', crumb: 'Appointments' },
  treatment: { title: 'Treatment History', crumb: 'Treatment' },
  braces: { title: 'Braces Treatment Progress', crumb: 'Treatment' },
  contract: { title: 'My Braces Contract', crumb: 'Treatment' },
  announcements: { title: 'Announcements & Promotions', crumb: 'Clinic' }
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
  // one (durations match viewOut/viewIn in patient.css).
  const current = document.querySelector('.view.active');
  const swap = () => {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active', 'view-leave'));
    target.classList.add('active');
    window.scrollTo({top:0, behavior:'smooth'});
    closeSidebar();
    if (view === 'contract'){ renderContract(PatientMock.contract); renderPayments(); } // refresh approval statuses live
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

// ---------- Book appointment: pick a slot, then confirm ----------
const confirmBookingBtn = document.getElementById('confirmBookingBtn');
const bookingNote = document.getElementById('bookingNote');

function showBookingNote(message, kind, hide){
  if (!bookingNote) return;
  if (hide){ bookingNote.hidden = true; return; }
  bookingNote.textContent = message;
  bookingNote.classList.toggle('ok', kind === 'ok');
  bookingNote.classList.toggle('err', kind === 'err');
  bookingNote.hidden = false;
}
function updateConfirmState(){
  if (confirmBookingBtn) confirmBookingBtn.disabled = !document.querySelector('.slot.selected');
}
document.querySelectorAll('.slot:not(.unavailable)').forEach(slot => {
  slot.addEventListener('click', () => {
    document.querySelectorAll('.slot').forEach(s => {
      const selected = s === slot;
      s.classList.toggle('selected', selected);
      if (s.hasAttribute('aria-pressed')) s.setAttribute('aria-pressed', selected ? 'true': 'false');
    });
    document.getElementById('selectedSlot').textContent = slot.dataset.slot;
    showBookingNote('', '', true);
    updateConfirmState();
  });
});
updateConfirmState();

const bookDate = document.getElementById('bookDate');
if (bookDate){
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  bookDate.min = today.toISOString().split('T')[0];
}
// Keep the booking summary in sync with the chosen service + dentist.
(function(){
  const svc = document.getElementById('bookService');
  const dentist = document.getElementById('bookDentist');
  const summaryService = document.getElementById('summaryService');
  const summaryDentist = document.getElementById('summaryDentist');
  const sync = () => {
    if (summaryService && svc) summaryService.textContent = svc.value;
    if (summaryDentist && dentist){
      summaryDentist.textContent = dentist.value === 'No preference'
        ? 'Clinic assignment'
        : dentist.value;
    }
  };
  if (svc) svc.addEventListener('change', sync);
  if (dentist) dentist.addEventListener('change', sync);
})();
if (confirmBookingBtn){
  confirmBookingBtn.addEventListener('click', () => {
    const date = document.getElementById('bookDate');
    const slot = document.querySelector('.slot.selected');
    if (!slot){
      showBookingNote('Please select an available time slot.', 'err');
      document.querySelector('.slot:not(.unavailable)').focus();
      return;
    }
    if (!date || !date.value){
      showBookingNote('Please choose a preferred date.', 'err');
      if (date) date.focus();
      return;
    }
    showBookingNote('', '', true);
    confirmBookingBtn.classList.add('is-loading');
    // TODO(backend): replace with a real request to POST /api/patient/appointments
    setTimeout(() => {
      confirmBookingBtn.classList.remove('is-loading');

      const svc = document.getElementById('bookService').value;
      const dentist = document.getElementById('bookDentist').value;
      const when = new Date(date.value + 'T00:00:00');
      const time = slot.dataset.slot;
      const dentistName = dentist === 'No preference' ? PatientMock.profile.primaryDentist : dentist;

      // Actually add the mock appointment so the UI reflects the booking.
      PatientMock.schedule.unshift({
        date: fmtDate(when), time, svc, dentist: dentistName, status: 'Pending', tag: 'amber'
      });
      PatientMock.dashboard.upcoming.unshift({
        d: String(when.getDate()).padStart(2, '0'),
        m: when.toLocaleDateString('en-US', { month: 'short' }),
        svc, meta: time + ' · ' + dentistName, status: 'Pending', tag: 'amber'
      });
      PatientStore.save();
      renderSchedule(PatientMock.schedule);
      renderUpcoming(PatientMock.dashboard.upcoming);
      renderDashboardStats(PatientMock.dashboard.stats);

      // The chosen slot is now taken: disable it so it can't be double-booked.
      slot.classList.add('unavailable');
      slot.disabled = true;
      slot.classList.remove('selected');
      slot.setAttribute('aria-pressed', 'false');
      document.getElementById('selectedSlot').textContent = 'Not yet selected';
      updateConfirmState();

      // Reset the form for the next booking.
      const svcSel = document.getElementById('bookService');
      const dentistSel = document.getElementById('bookDentist');
      if (svcSel) svcSel.selectedIndex = 0;
      if (dentistSel) dentistSel.selectedIndex = 0;
      if (date) date.value = '';
      const summaryService = document.getElementById('summaryService');
      const summaryDentist = document.getElementById('summaryDentist');
      if (summaryService) summaryService.textContent = 'Braces Adjustment';
      if (summaryDentist) summaryDentist.textContent = PatientMock.profile.primaryDentist;

      showBookingNote('Booking request sent! Our team will confirm shortly.', 'ok');
      announce('Booking request sent. Check your schedule to track it.');
    }, 900);
  });
}

// ---------- Notifications ----------
initNotifications({
  triggerId: 'notifBtn',
  panelId: 'notifPanel',
  listId: 'notifList',
  badgeId: 'notifBadge',
  markAllId: 'notifMarkAll',
  emptyId: 'notifEmpty',
  notifications: PatientMock.notifications,
  storageKey: 'asdc.notif.patient',
  onSelect: n => showToast('Opening: ' + n.title + ' (mock)')
});

// ---------- Account menu (user chip) ----------
const userChip = document.getElementById('userChip');
const userMenu = document.getElementById('userMenu');
if (userChip && userMenu){
  userChip.addEventListener('click', () => Popover.toggle(userChip, userMenu));
  const menuProfile = document.getElementById('menuProfile');
  if (menuProfile){
    menuProfile.addEventListener('click', () => {
      Popover.close(userMenu);
      switchView('profile');
    });
  }
  const signOut = document.getElementById('menuSignOut');
  if (signOut){
    signOut.addEventListener('click', () => {
      Popover.close(userMenu);
      openLogoutConfirm(userChip);
    });
  }
}

// ---------- Search: filter schedule + appointment history ----------
const searchBtn = document.getElementById('searchBtn');
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClear');
const searchResults = document.getElementById('searchResults');

function appointmentSources(){
  return [
    ...PatientMock.schedule.map(r => ({
      src: 'schedule',
      title: r.date + ' · ' + r.time,
      sub: r.svc + ' · ' + r.dentist,
      status: r.status,
      tag: r.tag
    })),
    ...PatientMock.history.map(r => ({
      src: 'history',
      title: r.date,
      sub: r.svc + ' · ' + r.dentist,
      status: r.status,
      tag: r.tag
    }))
  ];
}

function renderSearchResults(query){
  if (!searchResults) return;
  const q = query.trim().toLowerCase();
  if (!q){
    searchResults.innerHTML = '<p class="search-hint">Search your appointments by service, date, or dentist.</p>';
    return;
  }
  const matches = appointmentSources().filter(r =>
    [r.title, r.sub, r.status].some(v => v.toLowerCase().includes(q))
  );
  if (!matches.length){
    searchResults.innerHTML = `<p class="search-empty">No appointments match “${escapeHtml(query.trim())}”.</p>`;
    return;
  }
  searchResults.innerHTML = matches.map(r =>
    `<button type="button" class="search-result" data-src="${r.src}">
      <span class="mini-avatar">${r.src === 'schedule' ? 'UP' : 'HI'}</span>
      <span class="name-block"><span class="full">${escapeHtml(r.title)}</span><span class="sub">${escapeHtml(r.sub)}</span></span>
      ${statusTag(r)}
    </button>`
  ).join('');
  searchResults.querySelectorAll('.search-result').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.src);
      Popover.close(searchPanel);
      if (searchInput) searchInput.value = '';
      if (searchClearBtn) searchClearBtn.hidden = true;
    });
  });
}

if (searchBtn && searchPanel){
  searchBtn.addEventListener('click', () => {
    Popover.toggle(searchBtn, searchPanel, {
      onOpen: () => {
        if (searchClearBtn) searchClearBtn.hidden = !searchInput.value;
        renderSearchResults(searchInput.value);
      }
    });
  });
  searchInput.addEventListener('input', () => {
    if (searchClearBtn) searchClearBtn.hidden = !searchInput.value;
    renderSearchResults(searchInput.value);
  });
  if (searchClearBtn){
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.hidden = true;
      renderSearchResults('');
      searchInput.focus();
    });
  }
}

// ---------- Edit Profile (mock save) ----------
const profileModal = new Modal('profileModal');
const profileNote = document.getElementById('profileNote');

if (profileModal.modal){
  profileModal.registerClose(document.getElementById('profileModalClose'));
  profileModal.registerClose(document.getElementById('profileCancelBtn'));
}

function showProfileNote(message, isError){
  profileNote.textContent = message;
  profileNote.classList.toggle('err', !!isError);
  profileNote.classList.toggle('ok', !isError);
  profileNote.hidden = false;
}

function openEditProfile(){
  const info = PatientMock.profile.info;
  const get = label => { const f = info.find(x => x.label === label); return f ? f.value : ''; };
  document.getElementById('epName').value = PatientMock.user.name;
  document.getElementById('epContact').value = get('Contact Number');
  document.getElementById('epEmail').value = get('Email Address');
  profileNote.hidden = true;
  profileModal.open();
}

const profileSaveBtn = document.getElementById('profileSaveBtn');
if (profileSaveBtn){
  document.getElementById('editProfileBtn').addEventListener('click', openEditProfile);
  profileSaveBtn.addEventListener('click', () => {
    const name = document.getElementById('epName').value.trim();
    const contact = document.getElementById('epContact').value.trim();
    if (!name || !contact){
      showProfileNote('Name and contact number are required.', true);
      return;
    }
    profileSaveBtn.classList.add('is-loading');
    // TODO(backend): PATCH /api/patient/profile then re-render from response
    setTimeout(() => {
      profileSaveBtn.classList.remove('is-loading');
      const info = PatientMock.profile.info;
      const set = (label, value) => { const f = info.find(x => x.label === label); if (f) f.value = value; };
      PatientMock.user.name = name;
      PatientMock.user.initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      set('Full Name', name);
      set('Contact Number', contact);
      set('Email Address', document.getElementById('epEmail').value.trim());
      PatientStore.save();
      renderUser(PatientMock.user);
      renderProfile(PatientMock.profile);
      profileModal.close();
      showToast('Profile updated');
    }, 500);
  });
  profileModal.modal.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input')){
      e.preventDefault();
      profileSaveBtn.click();
    }
  });
}

// ---------- Shared dashboard core (from ../shared/js/dashboard-core.js) ----------
initToastTriggers();
initFullscreenToggle();
initSidebar('asdc.patient.sidebar.collapsed');
initLogout('../auth/login.html?role=patient');

// =====================================================================
// MOCK DATA RENDERING
// Each render*() function draws one dataset from PatientMock into a
// container in dashboard.html. When the backend is ready, replace the
// `PatientMock.<section>` argument with the fetch() response value.
// =====================================================================

const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const statusTag = status => `<span class="tag tag-${status.tag}">${status.status}</span>`;

// Friendly placeholder for empty lists/tables (see .empty-state in patient.css).
const EMPTY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const emptyState = (text, actionHtml = '') =>
  `<div class="empty-state">
    <div class="es-ic" aria-hidden="true">${EMPTY_ICON}</div>
    <div>${text}</div>
    ${actionHtml ? `<div class="es-action">${actionHtml}</div>` : ''}
  </div>`;

function renderUser(user){
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('sideFootAvatar', user.initials);
  set('sideFootName', user.name);
  set('sideFootRole', user.pid);
  set('chipAvatar', user.initials);
  set('menuAvatar', user.initials);
  set('menuName', user.name);
  set('menuRole', user.pid);
  set('welcomeTitle', user.greeting);
  set('welcomeText', user.nextVisit);
  set('profileAvatar', user.initials);
  set('profileName', user.name);
  set('profilePid', user.pid);
}

function renderDashboardStats(stats){
  const grid = document.getElementById('dashStats');
  if (!grid) return;
  const upcomingCount = PatientMock.dashboard.upcoming.filter(u => u.status !== 'Completed').length;
  grid.innerHTML = stats.map(s => {
    // Live number: the "Upcoming Appointment" card reflects real bookings.
    const num = s.label === 'Upcoming Appointment' ? String(upcomingCount) : s.num;
    return `<div class="stat-card">
      <div class="stat-top"><div class="stat-icon" style="background:${s.iconBg};color:${s.iconColor};">${s.icon}</div></div>
      <div class="stat-num">${num}</div>
      <div class="stat-label">${s.label}</div>
    </div>`;
  }).join('');
}

function renderUpcoming(rows){
  const list = document.getElementById('upcomingList');
  if (!list) return;
  if (!rows.length){
    list.innerHTML = emptyState('No upcoming appointments yet.', '<button type="button" class="btn btn-gold btn-sm" onclick="switchView(\'book\')">Book a visit</button>');
    return;
  }
  list.innerHTML = rows.map(r =>
    `<div class="appt-row">
      <div class="appt-date"><div class="d">${r.d}</div><div class="m">${r.m}</div></div>
      <div class="appt-info"><div class="svc">${escapeHtml(r.svc)}</div><div class="meta">${r.meta}</div></div>
      ${statusTag(r)}
    </div>`
  ).join('');
}

function renderAnnouncementMinis(rows){
  const list = document.getElementById('announceMiniList');
  if (!list) return;
  if (!rows.length){
    list.innerHTML = emptyState('No announcements right now.');
    return;
  }
  list.innerHTML = rows.map(r =>
    `<div class="promo-mini"><div class="t">${escapeHtml(r.title)}</div><div class="s">${escapeHtml(r.sub)}</div></div>`
  ).join('');
}

function renderProfile(profile){
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('profileMemberSince', profile.memberSince);
  set('profileDentist', profile.primaryDentist);

  const grid = document.getElementById('profileFields');
  if (!grid) return;
  grid.innerHTML = profile.info.map(f =>
    `<div class="field"${f.wide ? ' style="grid-column:1/-1;"': ''}><label>${f.label}</label><div class="val">${escapeHtml(f.value)}</div></div>`
  ).join('');
}

function renderSchedule(rows){
  const tbody = document.getElementById('scheduleBody');
  if (!tbody) return;
  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="6">${emptyState('No upcoming appointments. When you book one, it will show up here.')}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r, i) =>
    `<tr><td>${r.date}</td><td>${r.time}</td><td>${escapeHtml(r.svc)}</td><td>${escapeHtml(r.dentist)}</td><td>${statusTag(r)}</td>` +
    `<td><button class="btn btn-outline btn-sm" data-action="resched" data-index="${i}">Reschedule</button></td></tr>`
  ).join('');
}

// ---------- Reschedule appointment (mock, persisted) ----------
const reschedModal = new Modal('reschedModal');
let reschedIndex = null;
let rsDate = null;
let rsTime = null;
let rsNote = null;

if (reschedModal.modal){
  reschedModal.registerClose(document.getElementById('reschedModalClose'));
  reschedModal.registerClose(document.getElementById('rsCancelBtn'));
  const rsSaveBtn = document.getElementById('rsSaveBtn');
  rsNote = document.getElementById('rsNote');
  rsDate = document.getElementById('rsDate');
  rsTime = document.getElementById('rsTime');
  if (rsDate){
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    rsDate.min = today.toISOString().split('T')[0];
  }
  rsSaveBtn.addEventListener('click', () => {
    if (reschedIndex === null) return;
    const appt = PatientMock.schedule[reschedIndex];
    if (!appt) return;
    if (!rsDate.value){
      rsNote.textContent = 'Please choose a new date.';
      rsNote.classList.add('err'); rsNote.classList.remove('ok');
      rsNote.hidden = false;
      rsDate.focus();
      return;
    }
    rsSaveBtn.classList.add('is-loading');
    setTimeout(() => {
      rsSaveBtn.classList.remove('is-loading');
      const newWhen = new Date(rsDate.value + 'T00:00:00');
      appt.date = fmtDate(newWhen);
      appt.time = rsTime.value;
      // A rescheduled visit goes back to pending until the clinic confirms.
      appt.status = 'Pending';
      appt.tag = 'amber';
      PatientStore.save();
      renderSchedule(PatientMock.schedule);
      reschedModal.close();
      showToast('Appointment rescheduled');
    }, 400);
  });
}

document.getElementById('scheduleBody').addEventListener('click', e => {
  const btn = e.target.closest('[data-action="resched"]');
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  const appt = PatientMock.schedule[idx];
  if (!appt) return;
  reschedIndex = idx;
  rsDate.value = '';
  rsTime.value = appt.time;
  rsNote.hidden = true;
  reschedModal.open(btn);
});

function renderHistory(rows){
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;
  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="4">${emptyState('No appointment history yet.')}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r =>
    `<tr><td>${r.date}</td><td>${escapeHtml(r.svc)}</td><td>${escapeHtml(r.dentist)}</td><td>${statusTag(r)}</td></tr>`
  ).join('');
}

function renderTreatments(rows){
  const list = document.getElementById('timelineList');
  if (!list) return;
  if (!rows.length){
    list.innerHTML = emptyState('No treatment records on file yet.');
    return;
  }
  list.innerHTML = rows.map(t =>
    `<div class="timeline-item">
      <div class="tl-dot${t.muted ? ' muted': ''}"></div>
      <div><div class="tl-title">${escapeHtml(t.title)}</div><div class="tl-meta">${escapeHtml(t.meta)}</div></div>
    </div>`
  ).join('');
}

function renderBracesProgress(braces){
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('ringPct', braces.pct);
  set('ringSub', braces.monthLabel);
  set('bracesNext', braces.next);
  const offset = document.getElementById('ringOffset');
  if (offset) offset.setAttribute('stroke-dashoffset', braces.ringOffset);

  const list = document.getElementById('stageList');
  if (!list) return;
  list.innerHTML = braces.stages.map(s => {
    const check = s.kind === 'done'
      ? '<div class="stage-check done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></div>'
      : `<div class="stage-check ${s.kind}">${s.num}</div>`;
    return `<div class="stage">${check}<div><div class="stage-name">${escapeHtml(s.name)}</div><div class="stage-date">${escapeHtml(s.date)}</div></div></div>`;
  }).join('');
}

function renderContract(contract){
  const summary = document.getElementById('contractSummary');
  if (summary){
    summary.innerHTML = contract.summary.map(b =>
      `<div class="box"><div class="v">${b.v}</div><div class="l">${b.l}</div></div>`
    ).join('');
  }
  const fill = document.getElementById('contractFill');
  if (fill) fill.style.width = contract.progress.width;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('contractLeft', contract.progress.left);
  set('contractRight', contract.progress.right);

  const tbody = document.getElementById('paymentsBody');
  if (!tbody) return;
  // Payment history = contract's recorded payments + any admin-approved
  // online submissions (they carry an OR number assigned on approval).
  const approved = PaymentStore.all()
    .filter(s => s.status === 'approved')
    .map(s => ({ date: s.reviewedAt, amount: s.amount, method: 'Online (QR)', or: s.orNumber }));
  const all = approved.concat(contract.payments.map(p => ({ date: p.date, amount: p.amount, method: p.method, or: p.or })));
  tbody.innerHTML = all.map(p =>
    `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.or)}</td></tr>`
  ).join('');
}

// =====================================================================
// PAYMENT SUBMISSIONS (QR bank payment -> upload receipt -> admin confirms)
// Submissions live in SHARED localStorage (asdc.payments) so the same list
// shows in the admin dashboard, where staff approve/reject each one. When
// the backend lands, replace these calls with POST /api/payments/...
// =====================================================================
const CLINIC_PAYMENT_METHOD = 'Online (QR)';

const PaymentStore = {
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
  },
  byPatient(pid){
    return this.all().filter(s => s.pid === pid);
  }
};

// Reads an uploaded image, downscales it (max ~900px) and returns a JPEG
// data URL so receipt previews stay small enough for localStorage.
function readReceiptImage(file){
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)){
      reject(new Error('Please upload an image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read the image.'));
      img.onload = () => {
        const MAX = 900;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.82), name: file.name });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPayments(){
  const subs = PaymentStore.byPatient(PatientMock.user.pid).slice().reverse();
  const list = document.getElementById('paySubs');
  const empty = document.getElementById('paySubsEmpty');
  const pendingTag = document.getElementById('payPendingTag');
  if (!list) return;
  if (!subs.length){
    if (list) list.innerHTML = '';
    if (empty) empty.hidden = false;
    if (pendingTag){ pendingTag.textContent = '0 pending'; }
    return;
  }
  if (empty) empty.hidden = true;
  const pendingCount = subs.filter(s => s.status === 'pending').length;
  if (pendingTag){
    pendingTag.textContent = pendingCount + ' pending';
    pendingTag.className = 'tag tag-' + (pendingCount > 0 ? 'amber' : 'green');
  }
  list.innerHTML = subs.map(s => {
    const meta =
      `<span class="ps-amt">${escapeHtml(s.amount)}</span>` +
      `<span class="ps-meta"><b>Submitted ${escapeHtml(s.submittedAt)}</b> · ${escapeHtml(s.method)}` +
      (s.orNumber ? ` · OR ${escapeHtml(s.orNumber)}` : '') +
      `</span>` +
      `<span class="tag tag-${s.status === 'approved' ? 'green' : s.status === 'rejected' ? 'red' : 'amber'}">` +
      (s.status === 'approved' ? 'Approved' : s.status === 'rejected' ? 'Rejected' : 'Pending Confirmation') +
      `</span>`;
    return `<div class="pay-sub">${meta}</div>`;
  }).join('');
}

// ---------- Make a Payment: upload + submit ----------
const payReceiptInput = document.getElementById('payReceipt');
const payDrop = document.getElementById('payDrop');
const payDropTxt = document.getElementById('payDropTxt');
const payPreview = document.getElementById('payPreview');
const payPreviewImg = document.getElementById('payPreviewImg');
const payRemoveBtn = document.getElementById('payRemoveReceipt');
const submitPayBtn = document.getElementById('submitPaymentBtn');
let payReceiptData = null;

if (payReceiptInput){
  // The drop zone is a label wrapping a hidden input; make it reachable and
  // activatable by keyboard (Enter/Space) like a real button.
  if (payDrop){
    payDrop.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        payReceiptInput.click();
      }
    });
  }
  payReceiptInput.addEventListener('change', async () => {
    const file = payReceiptInput.files && payReceiptInput.files[0];
    if (!file) return;
    try {
      const { dataUrl, name } = await readReceiptImage(file);
      payReceiptData = dataUrl;
      if (payDrop) payDrop.classList.add('has-file');
      if (payDropTxt) payDropTxt.textContent = 'Receipt ready: ' + name;
      if (payPreview) payPreview.hidden = false;
      if (payPreviewImg) payPreviewImg.src = dataUrl;
      showToast('Receipt attached — submit when ready.');
    } catch (err){
      showToast(err.message, 'error');
      payReceiptInput.value = '';
    }
  });
  if (payRemoveBtn){
    payRemoveBtn.addEventListener('click', () => {
      payReceiptData = null;
      payReceiptInput.value = '';
      if (payDrop) payDrop.classList.remove('has-file');
      if (payDropTxt) payDropTxt.textContent = 'Click to upload a screenshot of your payment';
      if (payPreview) payPreview.hidden = true;
      if (payPreviewImg) payPreviewImg.src = '';
    });
  }
}

if (submitPayBtn){
  submitPayBtn.addEventListener('click', () => {
    const amount = (document.getElementById('payAmount') || {}).value;
    const note = (document.getElementById('payNote') || {}).value;
    if (!payReceiptData){
      showToast('Please upload your payment receipt first.', 'error');
      return;
    }
    if (!amount || !amount.trim()){
      showToast('Please enter the amount you paid.', 'error');
      return;
    }
    const submission = {
      id: 'pay-' + Date.now(),
      pid: PatientMock.user.pid,
      patient: PatientMock.user.name,
      amount: amount.trim(),
      method: CLINIC_PAYMENT_METHOD,
      note: (note || '').trim(),
      receiptDataUrl: payReceiptData,
      status: 'pending',
      submittedAt: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),
      reviewedAt: null,
      orNumber: null
    };
    const all = PaymentStore.all();
    all.push(submission);
    PaymentStore.save(all);

    payReceiptData = null;
    payReceiptInput.value = '';
    if (payDrop) payDrop.classList.remove('has-file');
    if (payDropTxt) payDropTxt.textContent = 'Click to upload a screenshot of your payment';
    if (payPreview) payPreview.hidden = true;
    if (payPreviewImg) payPreviewImg.src = '';
    if (document.getElementById('payNote')) document.getElementById('payNote').value = '';

    renderPayments();
    showToast('Payment submitted — awaiting admin confirmation.');
  });
}


// ---------- Download Contract as PDF (print dialog) ----------
let _patientLogoDataUrl = null;
function getPatientLogoDataUrl(){
  if (_patientLogoDataUrl !== null) return Promise.resolve(_patientLogoDataUrl);
  return fetch('../shared/images/asdc logo.png')
    .then(r => { if (!r.ok) throw new Error('logo unavailable'); return r.blob(); })
    .then(blob => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => { _patientLogoDataUrl = fr.result; resolve(_patientLogoDataUrl); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    }))
    .catch(() => { _patientLogoDataUrl = ''; return _patientLogoDataUrl; });
}

async function downloadContractPDF(){
  const win = window.open('', '_blank');
  if (!win){
    showToast('Pop-up blocked: allow pop-ups to download the contract.', 'error');
    return;
  }
  const esc = escapeHtml;
  const user = PatientMock.user || {};
  const profile = PatientMock.profile || {};
  const contract = PatientMock.contract || { summary: [], progress: {}, payments: [] };
  const date = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const logo = await getPatientLogoDataUrl();
  const logoHtml = logo
    ? `<img class="report-logo" src="${logo}" alt="Aromin-Sison Dental Clinic">`
    : '';
  const summaryBoxes = (contract.summary || []).map(b =>
    `<div class="stat"><div class="stat-v">${esc(b.v)}</div><div class="stat-l">${esc(b.l)}</div></div>`
  ).join('');
  const progress = contract.progress || {};
  const payments = (contract.payments || []).map(p =>
    `<tr><td>${esc(p.date)}</td><td>${esc(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.or)}</td></tr>`
  ).join('');

  win.document.write(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Braces Contract</title>` +
    `<style>
      *{box-sizing:border-box;}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B1B19;margin:0;padding:32px;}
      .report-head{display:flex;align-items:center;gap:18px;border-bottom:2px solid #9C8B3E;padding-bottom:14px;margin-bottom:22px;}
      .report-logo{width:150px;height:auto;object-fit:contain;flex-shrink:0;}
      .report-head h1{margin:0;font-family:'Fraunces',serif;font-size:22px;font-weight:600;line-height:1.2;}
      .report-meta{margin-left:auto;font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.08em;text-align:right;line-height:1.6;}
      .patient-line{font-size:13px;color:#5c5c55;margin:-6px 0 20px;}
      .patient-line b{color:#1B1B19;font-weight:600;}
      .stats{display:flex;gap:14px;margin-bottom:26px;}
      .stat{flex:1;border:1px solid rgba(27,27,25,.15);border-radius:10px;padding:14px 16px;}
      .stat-v{font-size:19px;font-weight:600;font-family:'Fraunces',serif;}
      .stat-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b6b65;margin-top:3px;}
      h2{font-family:'Fraunces',serif;font-size:15px;font-weight:600;margin:26px 0 10px;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      th{background:#F1EDE3;text-align:left;padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.18);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#5c5c55;}
      td{padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.1);}
      .progress{margin-bottom:4px;}
      .bar{height:8px;border-radius:99px;background:#EFEAE0;overflow:hidden;margin-top:8px;}
      .bar > div{height:100%;border-radius:99px;background:#9C8B3E;}
      .bar-meta{display:flex;justify-content:space-between;font-size:11px;color:#6b6b65;margin-top:6px;}
      .foot{margin-top:28px;padding-top:14px;border-top:1px solid rgba(27,27,25,.12);font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.06em;}
      .terms{font-size:11px;color:#6b6b65;line-height:1.7;margin-top:26px;}
      @media print{body{padding:0;}}
    </style></head><body>` +
    `<div class="report-head">${logoHtml}<h1>Braces Contract</h1>` +
    `<div class="report-meta">Aromin-Sison Dental Clinic<br>Generated ${esc(date)}</div></div>` +
    `<div class="patient-line">Contract Holder: <b>${esc(user.name || '')}</b> · ${esc(user.pid || '')}</div>` +
    `<div class="stats">${summaryBoxes}</div>` +
    `<h2>Contract Progress</h2>` +
    `<div class="progress">` +
    `<div class="bar"><div style="width:${esc(progress.width || '0%')};"></div></div>` +
    `<div class="bar-meta"><span>${esc(progress.left || '')}</span><span>${esc(progress.right || '')}</span></div>` +
    `</div>` +
    `<h2>Payment History</h2>` +
    `<table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>OR Number</th></tr></thead>` +
    `<tbody>${payments}</tbody></table>` +
    `<div class="terms">This document is a summary of the orthodontic payment contract between the patient and Aromin-Sison Dental Clinic. Terms, schedules, and remaining balances are subject to the signed agreement on file at the clinic.</div>` +
    `<div class="foot">Aromin-Sison Dental Clinic · Generated for ${esc(user.name || '')}</div>` +
    `</body></html>`
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  showToast('Contract ready — choose "Save as PDF" in the print dialog');
}

const downloadContractBtn = document.getElementById('downloadContractBtn');
if (downloadContractBtn) downloadContractBtn.addEventListener('click', downloadContractPDF);

function renderPromoCards(cards){
  const grid = document.getElementById('promoGrid');
  if (!grid) return;
  if (!cards.length){
    grid.innerHTML = emptyState('No announcements right now. Check back soon for clinic updates.');
    return;
  }
  grid.innerHTML = cards.map(c =>
    `<div class="promo-card">
      <div class="promo-img"><span>Promo Image</span></div>
      <div class="promo-body"><h4>${escapeHtml(c.title)}</h4><p>${escapeHtml(c.desc)}</p></div>
    </div>`
  ).join('');
}

// =====================================================================
// MOCK DATA PERSISTENCE
// PatientMock is hydrated from localStorage on load and written back on
// every mutation (profile edit, booking, reschedule), so changes survive
// logout/login and refresh. When the backend lands, replace these calls
// with the real patient API endpoints.
// =====================================================================
const PatientStore = {
  key: 'asdc.patient.mock',
  load(){
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved) return;
      if (saved.user) Object.assign(PatientMock.user, saved.user);
      if (saved.profile) Object.assign(PatientMock.profile, saved.profile);
      if (Array.isArray(saved.schedule)) PatientMock.schedule = saved.schedule;
      if (Array.isArray(saved.upcoming)) PatientMock.dashboard.upcoming = saved.upcoming;
      if (Array.isArray(saved.history)) PatientMock.history = saved.history;
    } catch (e){ /* ignore corrupt storage */ }
  },
  save(){
    try {
      localStorage.setItem(this.key, JSON.stringify({
        user: PatientMock.user,
        profile: PatientMock.profile,
        schedule: PatientMock.schedule,
        history: PatientMock.history,
        upcoming: PatientMock.dashboard.upcoming
      }));
    } catch (e){}
  }
};

const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ---------- Render everything on load ----------
PatientStore.load();
renderUser(PatientMock.user);
renderDashboardStats(PatientMock.dashboard.stats);
renderUpcoming(PatientMock.dashboard.upcoming);          // TODO(backend): GET /api/patient/appointments
renderAnnouncementMinis(PatientMock.dashboard.announcements);
renderProfile(PatientMock.profile);
renderSchedule(PatientMock.schedule);
renderHistory(PatientMock.history);
renderTreatments(PatientMock.treatments);
renderBracesProgress(PatientMock.braces);
renderContract(PatientMock.contract);
renderPayments();
renderPromoCards(PatientMock.promoCards);