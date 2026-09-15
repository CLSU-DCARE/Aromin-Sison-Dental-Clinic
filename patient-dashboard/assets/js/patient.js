// =====================================================================
const PATIENT_APPOINTMENTS_ENDPOINT =
  '../backend/api/patients/appointments.php';
const PATIENT_BRACES_ENDPOINT =
  '../backend/api/patients/braces.php';
let appointmentsLoaded = false;

const PatientDashboardVisibility = {
  braces: false,
  contract: false,
  balance: false
};

async function patientAppointmentRequest(
  method = 'GET',
  body = null
) {
  const options = {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json'
    }
  };

  if (body !== null) {
    options.headers['Content-Type'] =
      'application/json';

    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    PATIENT_APPOINTMENTS_ENDPOINT,
    options
  );

  let payload = {};

  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      (payload.error && (payload.error.message || payload.error)) ||
      'Unable to process the appointment request.'
    );
  }

  return payload.data || payload;
}

async function patientBracesRequest() {
  const response = await fetch(
    PATIENT_BRACES_ENDPOINT,
    {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json'
      }
    }
  );

  let payload = {};

  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      (payload.error && (payload.error.message || payload.error)) ||
      'Unable to load braces information.'
    );
  }

  return payload;
}

// PATIENT DASHBOARD: page-specific logic
// Shared utilities (Modal, toast, sidebar, fullscreen, logout) live in
// ../shared/js/dashboard-core.js and are loaded before this file.
// Dashboard records are loaded from authenticated APIs.
// =====================================================================

const views = {
  dashboard: {
    title: 'My Dashboard',
    crumb: 'Overview'
  },
  profile: {
    title: 'My Profile',
    crumb: 'Account'
  },
  schedule: {
    title: 'My Appointment Schedule',
    crumb: 'Appointments'
  },
  book: {
    title: 'Book an Appointment',
    crumb: 'Appointments'
  },
  history: {
    title: 'Appointment History',
    crumb: 'Appointments'
  },
  treatment: {
    title: 'Treatment History',
    crumb: 'Treatment'
  },
  braces: {
    title: 'Braces Treatment Progress',
    crumb: 'Treatment'
  },
  contract: {
    title: 'My Braces Contract',
    crumb: 'Treatment'
  },
  announcements: {
    title: 'Announcements & Promotions',
    crumb: 'Clinic'
  }
};

function switchView(view) {
  const target = document.getElementById(
    'view-' + view
  );

  if (
    !target ||
    target.classList.contains('active')
  ) {
    return;
  }

  document
    .querySelectorAll('.nav-item')
    .forEach(element => {
      const active =
        element.dataset.view === view;

      element.classList.toggle(
        'active',
        active
      );

      if (active) {
        element.setAttribute(
          'aria-current',
          'page'
        );
      } else {
        element.removeAttribute(
          'aria-current'
        );
      }
    });

  const meta = views[view] || {
    title: view,
    crumb: ''
  };

  document.getElementById(
    'viewTitle'
  ).textContent = meta.title;

  const crumbElement =
    document.getElementById('viewCrumb');

  if (crumbElement) {
    crumbElement.textContent = meta.crumb;
  }

  const current =
    document.querySelector('.view.active');

  const swap = () => {
    document
      .querySelectorAll('.view')
      .forEach(element => {
        element.classList.remove(
          'active',
          'view-leave'
        );
      });

    target.classList.add('active');

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    closeSidebar();

    if (view === 'contract' || view === 'braces') {
      // Pick up any changes made on another dashboard (e.g. the
      // receptionist approved a payment, or the dentist updated progress)
      // since this page loaded, instead of only refreshing on a full
      // reload. Goes through the real endpoint first (same as the initial
      // page load) — loadPatientBraces() already re-renders both the
      // contract and braces-progress views once it resolves, so nothing
      // else needs to happen here.
      loadPatientBraces();
    }

    announce('Showing ' + meta.title);
  };

  if (current && current !== target) {
    current.classList.add('view-leave');
    setTimeout(swap, 180);
  } else {
    swap();
  }
}

document
  .querySelectorAll('.nav-item')
  .forEach(button => {
    button.addEventListener(
      'click',
      () => switchView(
        button.dataset.view
      )
    );
  });

// ---------- Book appointment (delegated to PatientAppointmentBooking) ----------
const appointmentBooking = new PatientAppointmentBooking({
  state: PatientState,
  appointmentsEndpoint: PATIENT_APPOINTMENTS_ENDPOINT,
  onBooked: () => loadPatientAppointments().then(() => loadPatientBraces())
});
appointmentBooking.init();

// ---------- Notifications ----------
initNotifications({ triggerId: 'notifBtn', panelId: 'notifPanel', listId: 'notifList', badgeId: 'notifBadge', markAllId: 'notifMarkAll', emptyId: 'notifEmpty', notifications: [], storageKey: 'asdc.notif.patient' });
const inboxEmpty = document.getElementById('notifEmpty');
if (inboxEmpty) inboxEmpty.textContent = 'Notifications are unavailable.';

// ---------- Account menu ----------
const userChip =
  document.getElementById(
    'userChip'
  );

const userMenu =
  document.getElementById(
    'userMenu'
  );

if (userChip && userMenu) {
  userChip.addEventListener(
    'click',
    () => {
      Popover.toggle(
        userChip,
        userMenu
      );
    }
  );

  const menuProfile =
    document.getElementById(
      'menuProfile'
    );

  if (menuProfile) {
    menuProfile.addEventListener(
      'click',
      () => {
        Popover.close(userMenu);
        switchView('profile');
      }
    );
  }

  const signOut =
    document.getElementById(
      'menuSignOut'
    );

  if (signOut) {
    signOut.addEventListener(
      'click',
      () => {
        Popover.close(userMenu);
        openLogoutConfirm(
          userChip
        );
      }
    );
  }
}

// ---------- Search ----------
const searchBtn =
  document.getElementById(
    'searchBtn'
  );

const searchPanel =
  document.getElementById(
    'searchPanel'
  );

const searchInput =
  document.getElementById(
    'searchInput'
  );

const searchClearBtn =
  document.getElementById(
    'searchClear'
  );

const searchResults =
  document.getElementById(
    'searchResults'
  );

function appointmentSources() {
  return [
    ...PatientState.schedule.map(
      row => ({
        src: 'schedule',
        title:
          row.date +
          ' · ' +
          row.time,
        sub:
          row.svc +
          ' · ' +
          row.dentist,
        status: row.status,
        tag: row.tag
      })
    ),

    ...PatientState.history.map(
      row => ({
        src: 'history',
        title: row.date,
        sub:
          row.svc +
          ' · ' +
          row.dentist,
        status: row.status,
        tag: row.tag
      })
    )
  ];
}

function renderSearchResults(query) {
  if (!searchResults) {
    return;
  }

  const normalizedQuery =
    query
      .trim()
      .toLowerCase();

  if (!normalizedQuery) {
    searchResults.innerHTML =
      '<p class="search-hint">' +
      'Search your appointments by service, date, or dentist.' +
      '</p>';

    return;
  }

  const matches =
    appointmentSources().filter(
      row => {
        return [
          row.title,
          row.sub,
          row.status
        ].some(value => {
          return value
            .toLowerCase()
            .includes(
              normalizedQuery
            );
        });
      }
    );

  if (!matches.length) {
    searchResults.innerHTML =
      `<p class="search-empty">` +
      `No appointments match “${escapeHtml(
        query.trim()
      )}”.` +
      `</p>`;

    return;
  }

  searchResults.innerHTML =
    matches.map(row => {
      return (
        `<button type="button" ` +
        `class="search-result" ` +
        `data-src="${row.src}">` +
        `<span class="mini-avatar">` +
        `${
          row.src === 'schedule'
            ? 'UP'
            : 'HI'
        }` +
        `</span>` +
        `<span class="name-block">` +
        `<span class="full">` +
        `${escapeHtml(row.title)}` +
        `</span>` +
        `<span class="sub">` +
        `${escapeHtml(row.sub)}` +
        `</span>` +
        `</span>` +
        `${statusTag(row)}` +
        `</button>`
      );
    }).join('');

  searchResults
    .querySelectorAll(
      '.search-result'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          switchView(
            button.dataset.src
          );

          Popover.close(
            searchPanel
          );

          if (searchInput) {
            searchInput.value = '';
          }

          if (searchClearBtn) {
            searchClearBtn.hidden = true;
          }
        }
      );
    });
}

if (searchBtn && searchPanel) {
  searchBtn.addEventListener(
    'click',
    () => {
      Popover.toggle(
        searchBtn,
        searchPanel,
        {
          onOpen: () => {
            if (searchClearBtn) {
              searchClearBtn.hidden =
                !searchInput.value;
            }

            renderSearchResults(
              searchInput.value
            );
          }
        }
      );
    }
  );

  searchInput.addEventListener(
    'input',
    () => {
      if (searchClearBtn) {
        searchClearBtn.hidden =
          !searchInput.value;
      }

      renderSearchResults(
        searchInput.value
      );
    }
  );

  if (searchClearBtn) {
    searchClearBtn.addEventListener(
      'click',
      () => {
        searchInput.value = '';
        searchClearBtn.hidden = true;

        renderSearchResults('');

        searchInput.focus();
      }
    );
  }
}

// ---------- Edit Profile (delegated to PatientProfileEditor) ----------
const profileEditor = new PatientProfileEditor({ state: PatientState });
profileEditor.init();

// ---------- Shared dashboard core ----------
initToastTriggers();
initFullscreenToggle();

initSidebar(
  'asdc.patient.sidebar.collapsed'
);

initLogout(
  '../auth/login.html'
);

// ---------- Rendering ----------
// escapeHtml, statusTag, emptyState, EMPTY_ICON now provided by ASDC.HtmlHelpers
// (global via dashboard-core.js).

function renderUser(user) {
  const setValue = (
    id,
    value
  ) => {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  };

  setValue(
    'sideFootAvatar',
    user.initials
  );

  setValue(
    'sideFootName',
    user.name
  );

  setValue(
    'sideFootRole',
    user.pid
  );

  setValue(
    'chipAvatar',
    user.initials
  );

  setValue(
    'menuAvatar',
    user.initials
  );

  setValue(
    'menuName',
    user.name
  );

  setValue(
    'menuRole',
    user.pid
  );

  setValue(
    'welcomeTitle',
    user.greeting
  );

  setValue(
    'welcomeText',
    user.nextVisit
  );

  setValue(
    'profileAvatar',
    user.initials
  );

  setValue(
    'profileName',
    user.name
  );

  setValue(
    'profilePid',
    user.pid
  );
}

function renderDashboardStats(stats) {
  const grid =
    document.getElementById(
      'dashStats'
    );

  if (!grid) {
    return;
  }

  const upcomingCount =
    PatientState.dashboard.upcoming
      .filter(item => {
        return item.status !==
          'Completed';
      })
      .length;

  const visibleStats =
    stats.filter(stat => {
      if (
        stat.label ===
        'Braces Treatment Progress'
      ) {
        return PatientDashboardVisibility.braces;
      }

      if (
        stat.label ===
        'Outstanding Balance'
      ) {
        return PatientDashboardVisibility.balance;
      }

      if (
        stat.label ===
        'Completed Visits'
      ) {
        return !PatientDashboardVisibility.braces;
      }

      if (
        stat.label ===
        'Treatment Records'
      ) {
        return !PatientDashboardVisibility.balance;
      }

      return true;
    });

  grid.innerHTML =
    visibleStats.map(stat => {
      const number =
        stat.label ===
        'Upcoming Appointment'
          ? (appointmentsLoaded ? String(upcomingCount) : '—')
          : stat.num;

      return (
        `<div class="stat-card">` +
        `<div class="stat-top">` +
        `<div class="stat-icon" ` +
        `style="background:${stat.iconBg};` +
        `color:${stat.iconColor};">` +
        `${stat.icon}` +
        `</div>` +
        `</div>` +
        `<div class="stat-num">` +
        `${number}` +
        `</div>` +
        `<div class="stat-label">` +
        `${stat.label}` +
        `</div>` +
        `</div>`
      );
    }).join('');
}

function renderUpcoming(rows) {
  const list =
    document.getElementById(
      'upcomingList'
    );

  if (!list) {
    return;
  }

  if (!rows.length) {
    list.innerHTML = emptyState(
      'No upcoming appointments yet.',
      '<button type="button" ' +
      'class="btn btn-gold btn-sm" ' +
      'onclick="switchView(\'book\')">' +
      'Book a visit' +
      '</button>'
    );

    return;
  }

  list.innerHTML =
    rows.map(row => {
      return (
        `<div class="appt-row">` +
        `<div class="appt-date">` +
        `<div class="d">` +
        `${row.d}` +
        `</div>` +
        `<div class="m">` +
        `${row.m}` +
        `</div>` +
        `</div>` +
        `<div class="appt-info">` +
        `<div class="svc">` +
        `${escapeHtml(row.svc)}` +
        `</div>` +
        `<div class="meta">` +
        `${row.meta}` +
        `</div>` +
        `</div>` +
        `${statusTag(row)}` +
        `</div>`
      );
    }).join('');
}

function renderAnnouncementMinis(rows) {
  const list =
    document.getElementById(
      'announceMiniList'
    );

  if (!list) {
    return;
  }

  if (!rows.length) {
    list.innerHTML = emptyState(
      'No announcements right now.'
    );

    return;
  }

  list.innerHTML =
    rows.map(row => {
      return (
        `<div class="promo-mini">` +
        `<div class="t">` +
        `${escapeHtml(row.title)}` +
        `</div>` +
        `<div class="s">` +
        `${escapeHtml(row.sub)}` +
        `</div>` +
        `</div>`
      );
    }).join('');
}

function renderProfile(profile) {
  const setValue = (
    id,
    value
  ) => {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  };

  setValue(
    'profileMemberSince',
    profile.memberSince
  );

  setValue(
    'profileDentist',
    profile.primaryDentist
  );

  const grid =
    document.getElementById(
      'profileFields'
    );

  if (!grid) {
    return;
  }

  grid.innerHTML =
    profile.info.map(field => {
      return (
        `<div class="field"` +
        `${
          field.wide
            ? ' style="grid-column:1/-1;"'
            : ''
        }>` +
        `<label>${field.label}</label>` +
        `<div class="val">` +
        `${escapeHtml(field.value)}` +
        `</div>` +
        `</div>`
      );
    }).join('');
}

function renderSchedule(rows) {
  const tableBody =
    document.getElementById(
      'scheduleBody'
    );

  if (!tableBody) {
    return;
  }

  if (!rows.length) {
    tableBody.innerHTML =
      `<tr><td colspan="6">` +
      `${emptyState(
        'No upcoming appointments. When you book one, it will show up here.'
      )}` +
      `</td></tr>`;

    return;
  }

  tableBody.innerHTML =
    rows.map((row, index) => {
      return (
        `<tr>` +
        `<td>${row.date}</td>` +
        `<td>${row.time}</td>` +
        `<td>${escapeHtml(row.svc)}</td>` +
        `<td>${escapeHtml(row.dentist)}</td>` +
        `<td>${statusTag(row)}</td>` +
        `<td>` +
        `<button class="btn btn-outline btn-sm" ` +
        `data-action="resched" ` +
        `data-index="${index}">` +
        `Reschedule` +
        `</button>` +
        `</td>` +
        `</tr>`
      );
    }).join('');
}

// ---------- Reschedule appointment (delegated to PatientRescheduleModal) ----------
const rescheduleModal = new PatientRescheduleModal({
  state: PatientState,
  appointmentsEndpoint: PATIENT_APPOINTMENTS_ENDPOINT,
  onRescheduled: () => loadPatientAppointments().then(() => loadPatientBraces())
});
rescheduleModal.init();

function renderHistory(rows) {
  const tableBody =
    document.getElementById(
      'historyBody'
    );

  if (!tableBody) {
    return;
  }

  if (!rows.length) {
    tableBody.innerHTML =
      `<tr><td colspan="4">` +
      `${emptyState(
        'No appointment history yet.'
      )}` +
      `</td></tr>`;

    return;
  }

  tableBody.innerHTML =
    rows.map(row => {
      return (
        `<tr>` +
        `<td>${row.date}</td>` +
        `<td>${escapeHtml(row.svc)}</td>` +
        `<td>${escapeHtml(row.dentist)}</td>` +
        `<td>${statusTag(row)}</td>` +
        `</tr>`
      );
    }).join('');
}

function renderTreatments(rows) {
  const list =
    document.getElementById(
      'timelineList'
    );

  if (!list) {
    return;
  }

  if (!rows.length) {
    list.innerHTML = emptyState(
      'No treatment records on file yet.'
    );

    return;
  }

  list.innerHTML =
    rows.map(treatment => {
      return (
        `<div class="timeline-item">` +
        `<div class="tl-dot` +
        `${treatment.muted ? ' muted' : ''}">` +
        `</div>` +
        `<div>` +
        `<div class="tl-title">` +
        `${escapeHtml(treatment.title)}` +
        `</div>` +
        `<div class="tl-meta">` +
        `${escapeHtml(treatment.meta)}` +
        `</div>` +
        `</div>` +
        `</div>`
      );
    }).join('');
}

// ---------- Braces progress (delegated to PatientBracesProgress) ----------
const bracesProgressView = new PatientBracesProgress();
const renderBracesProgress = (braces) => bracesProgressView.render(braces);

// ---------- Payment submissions (delegated to PatientPaymentSubmission) ----------
const paymentSubmission = new PatientPaymentSubmission({ state: PatientState });
paymentSubmission.init();
const renderPayments = () => paymentSubmission.render();

// ---------- Contract (delegated to PatientContractView) ----------
const contractView = new PatientContractView({ state: PatientState });
contractView.init();
const renderContract = (contract) => contractView.render(contract);

function renderPromoCards(cards) {
  const grid =
    document.getElementById(
      'promoGrid'
    );

  if (!grid) {
    return;
  }

  if (!cards.length) {
    grid.innerHTML = emptyState(
      'Announcements are unavailable.'
    );

    return;
  }

  grid.innerHTML =
    cards.map(card => {
      return (
        `<div class="promo-card">` +
        `<div class="promo-img">` +
        `<span>Promo Image</span>` +
        `</div>` +
        `<div class="promo-body">` +
        `<h4>${escapeHtml(card.title)}</h4>` +
        `<p>${escapeHtml(card.desc)}</p>` +
        `</div>` +
        `</div>`
      );
    }).join('');
}

const fmtDate = date => {
  return date.toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
  );
};

function setDashboardStat(
  label,
  value
) {
  const stat =
    PatientState.dashboard.stats
      .find(item => {
        return item.label === label;
      });

  if (stat) {
    stat.num = String(value);
  }
}

function setPatientViewVisibility(
  view,
  visible
) {
  document
    .querySelectorAll(
      `[data-view="${view}"]`
    )
    .forEach(button => {
      button.hidden = !visible;
      button.style.display =
        visible ? '' : 'none';
    });
}

function applyPatientFeatureVisibility() {
  setPatientViewVisibility(
    'braces',
    PatientDashboardVisibility.braces
  );

  setPatientViewVisibility(
    'contract',
    PatientDashboardVisibility.contract
  );
}

async function loadPatientBraces() {
  try {
    const payload =
      await patientBracesRequest();

    // Reject malformed responses.
    if (typeof payload.has_braces_treatment !== 'boolean') {
      throw new Error('not_implemented');
    }

    PatientDashboardVisibility.braces =
      payload.has_braces_treatment === true;

    PatientDashboardVisibility.contract =
      payload.has_contract === true;

    PatientDashboardVisibility.balance =
      payload.has_outstanding_balance === true;

    PatientState.braces =
      payload.braces || PatientState.braces;

    PatientState.contract =
      payload.contract || PatientState.contract;

    setDashboardStat(
      'Braces Treatment Progress',
      payload.braces_progress || '0%'
    );

    setDashboardStat(
      'Outstanding Balance',
      payload.outstanding_balance || '₱0.00'
    );

    setDashboardStat(
      'Completed Visits',
      payload.completed_visits || 0
    );

    setDashboardStat(
      'Treatment Records',
      payload.treatment_records || 0
    );

    applyPatientFeatureVisibility();

    renderDashboardStats(
      PatientState.dashboard.stats
    );

    renderBracesProgress(PatientState.braces);

    renderContract(
      PatientState.contract
    );

    renderPayments();
  } catch (error) {
    PatientState.braces.active = false;
    PatientState.contract.active = false;
    PatientDashboardVisibility.braces = false;
    PatientDashboardVisibility.contract = false;
    PatientDashboardVisibility.balance = false;
    applyPatientFeatureVisibility();
    showToast('Unable to load braces information. Please try again.', 'error');
  }
}

async function loadPatientAppointments() {
  try {
    const payload =
      await patientAppointmentRequest();

    // Reject malformed responses.
    if (
      !Array.isArray(payload.schedule) &&
      !Array.isArray(payload.upcoming) &&
      !Array.isArray(payload.history)
    ) {
      throw new Error('not_implemented');
    }

    PatientState.schedule =
      Array.isArray(
        payload.schedule
      )
        ? payload.schedule
        : [];

    PatientState.dashboard.upcoming =
      Array.isArray(
        payload.upcoming
      )
        ? payload.upcoming
        : [];

    PatientState.history =
      Array.isArray(
        payload.history
      )
        ? payload.history
        : [];

    appointmentsLoaded = true;

    const first =
      PatientState.schedule[0];

    const welcomeText =
      document.getElementById(
        'welcomeText'
      );

    if (welcomeText) {
      welcomeText.textContent =
        first
          ? `Your next visit is on ${first.date} at ${first.time} for ${first.svc}.`
          : 'You have no upcoming appointments.';
    }

    renderDashboardStats(
      PatientState.dashboard.stats
    );

    renderUpcoming(
      PatientState.dashboard.upcoming
    );

    renderSchedule(
      PatientState.schedule
    );

    renderHistory(
      PatientState.history
    );
  } catch (error) {
    appointmentsLoaded = false;
    PatientState.schedule = [];
    PatientState.dashboard.upcoming = [];
    PatientState.history = [];
    renderUpcoming([]);
    renderSchedule([]);
    renderHistory([]);
    renderDashboardStats(PatientState.dashboard.stats);
    const welcomeText = document.getElementById('welcomeText');
    if (welcomeText) welcomeText.textContent = 'Unable to load appointments. Please try again.';
    showToast('Unable to load appointments. Please try again.', 'error');
  }
}

// ---------- Initial rendering ----------


renderUser(
  PatientState.user
);

renderDashboardStats(
  PatientState.dashboard.stats
);

renderUpcoming(
  PatientState.dashboard.upcoming
);

renderAnnouncementMinis(
  PatientState.dashboard.announcements
);

renderProfile(
  PatientState.profile
);

renderSchedule(
  PatientState.schedule
);

renderHistory(
  PatientState.history
);

renderTreatments(
  PatientState.treatments
);

renderBracesProgress(
  PatientState.braces
);

renderContract(
  PatientState.contract
);

renderPayments();

renderPromoCards(
  PatientState.promoCards
);

applyPatientFeatureVisibility();

loadPatientAppointments();
loadPatientBraces();

async function loadPatientProfile(user) {
  PatientState.user.name = user.full_name;
  PatientState.user.initials = user.full_name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('');
  try {
    const data = await apiFetch('../backend/api/patients/list.php');
    const profile = data.patients && data.patients[0];
    if (!profile) throw new Error('Patient profile unavailable.');
    PatientState.user.pid = '#P-' + profile.patient_id;
    PatientState.profile = {
      memberSince: profile.registered_at ? new Date(profile.registered_at.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—',
      primaryDentist: '—',
      info: [
        { label: 'Full Name', value: profile.first_name + ' ' + profile.last_name },
        { label: 'Patient ID', value: PatientState.user.pid },
        { label: 'Contact Number', value: profile.contact_number || '—' },
        { label: 'Email Address', value: profile.email || user.email }
      ]
    };
    renderProfile(PatientState.profile);
    document.getElementById('profilePid').textContent = PatientState.user.pid;
  } catch (error) { showToast('Unable to load your profile. Please try again.', 'error'); }
}
window.addEventListener('asdc:authenticated', event => loadPatientProfile(event.detail));
if (window.ASDCAuthUser) loadPatientProfile(window.ASDCAuthUser);
