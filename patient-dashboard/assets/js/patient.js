// =====================================================================
const PATIENT_APPOINTMENTS_ENDPOINT =
  '../backend/api/patients/appointments.php';
const PATIENT_BRACES_ENDPOINT =
  '../backend/api/patients/braces.php';

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
      payload.error ||
      'Unable to load braces information.'
    );
  }

  return payload;
}

// PATIENT DASHBOARD: page-specific logic
// Shared utilities (Modal, toast, sidebar, fullscreen, logout) live in
// ../shared/js/dashboard-core.js and are loaded before this file.
// Sample data lives in ../shared/js/mock-data/patient.js and is rendered
// here; swap `PatientMock.<section>` for a fetch() response later.
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
      // since this page loaded, instead of only refreshing on a full reload.
      applyContractStoreToPatientMock();
    }

    if (view === 'contract') {
      renderContract(
        PatientMock.contract
      );

      renderPayments();
    }

    if (view === 'braces') {
      renderBracesProgress(PatientMock.braces);
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
  mock: PatientMock,
  appointmentsEndpoint: PATIENT_APPOINTMENTS_ENDPOINT,
  onBooked: () => loadPatientAppointments().then(() => loadPatientBraces())
});
appointmentBooking.init();

// ---------- Notifications ----------
// Merge in real, persisted notifications (payment approved/rejected,
// dentist progress updates) pushed by other dashboards via PatientNotify,
// ahead of the bundled sample ones, so they're what the patient sees first.
if (typeof PatientNotify !== 'undefined') {
  const live = PatientNotify.all(PatientMock.user.pid);
  if (live.length) PatientMock.notifications = live.concat(PatientMock.notifications);
}

initNotifications({
  triggerId: 'notifBtn',
  panelId: 'notifPanel',
  listId: 'notifList',
  badgeId: 'notifBadge',
  markAllId: 'notifMarkAll',
  emptyId: 'notifEmpty',
  notifications:
    PatientMock.notifications,
  storageKey:
    'asdc.notif.patient',
  onSelect: notification => {
    showToast(
      'Opening: ' +
      notification.title +
      ' (mock)'
    );
  }
});

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
    ...PatientMock.schedule.map(
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

    ...PatientMock.history.map(
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

// ---------- Local profile persistence ----------
// (Declared here, before PatientProfileEditor is constructed below, since
// it's referenced immediately — it used to live near the bottom of this
// file, which threw "Cannot access 'PatientStore' before initialization"
// and halted the entire script before anything else could run.)
const PatientStore = {
  key: 'asdc.patient.mock',

  load() {
    try {
      const raw =
        localStorage.getItem(
          this.key
        );

      if (!raw) {
        return;
      }

      const saved =
        JSON.parse(raw);

      if (!saved) {
        return;
      }

      if (saved.user) {
        Object.assign(
          PatientMock.user,
          saved.user
        );
      }

      if (saved.profile) {
        Object.assign(
          PatientMock.profile,
          saved.profile
        );
      }
    } catch (error) {
      // Ignore corrupt storage.
    }
  },

  save() {
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify({
          user: PatientMock.user,
          profile: PatientMock.profile
        })
      );
    } catch (error) {
      // Ignore storage errors.
    }
  }
};

// ---------- Edit Profile (delegated to PatientProfileEditor) ----------
const profileEditor = new PatientProfileEditor({ mock: PatientMock, store: PatientStore });
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
    PatientMock.dashboard.upcoming
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
          ? String(upcomingCount)
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
  mock: PatientMock,
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
const paymentSubmission = new PatientPaymentSubmission({ mock: PatientMock });
paymentSubmission.init();
const PaymentStore = { all: () => paymentSubmission.storeAll(), save: (l) => paymentSubmission.storeSave(l), byPatient: (p) => paymentSubmission.storeByPatient(p) };
const renderPayments = () => paymentSubmission.render();

// ---------- Contract (delegated to PatientContractView) ----------
const contractView = new PatientContractView({ mock: PatientMock, paymentStore: PaymentStore });
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
      'No announcements right now. Check back soon for clinic updates.'
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

// ---------- Local profile persistence: PatientStore is declared earlier
// in this file (right before PatientProfileEditor uses it) ----------

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
    PatientMock.dashboard.stats
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

/** Pulls this patient's live contract/braces-progress record from the
 *  shared ContractStore (the same store Admin's contract table and the
 *  Dentist's "Update Progress" action write to) and maps it into the
 *  shapes PatientContractView/PatientBracesProgress already expect.
 *  Returns true if a matching contract was found and applied, false if
 *  this patient has none yet (caller should keep whatever it already has).
 */
function applyContractStoreToPatientMock() {
  if (typeof ContractStore === 'undefined') return false;
  const contract = ContractStore.ensureForPatient(PatientMock.user.pid, PatientMock.user.name);
  if (!contract) return false;

  const peso = n => '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const RING_CIRCUMFERENCE = 377; // matches the SVG ring's r used elsewhere in this view

  const monthsPct = contract.months
    ? Math.round((contract.monthsPaid || 0) / contract.months * 100)
    : 0;

  PatientMock.contract = {
    active: true,
    summary: [
      { v: peso(contract.total).replace(/\.00$/, ''), l: 'Total Contract Value' },
      { v: peso(contract.paid).replace(/\.00$/, ''), l: 'Total Paid' },
      { v: peso(contract.balance).replace(/\.00$/, ''), l: 'Remaining Balance' }
    ],
    progress: {
      width: monthsPct + '%',
      left: (contract.monthsPaid || 0) + ' of ' + contract.months + ' months paid',
      right: monthsPct + '% Paid'
    },
    payments: (contract.payments || []).map(p => ({
      date: p.date, amount: peso(p.amount), method: p.method, or: p.or
    }))
  };

  const progress = contract.progress || {};
  const pct = progress.pct || 0;
  PatientMock.braces = {
    active: true,
    pct: pct + '%',
    monthLabel: progress.monthLabel || '',
    ringOffset: String(Math.round(RING_CIRCUMFERENCE * (1 - pct / 100))),
    heading: progress.heading || 'Your treatment is progressing well',
    description: progress.description || '',
    stages: progress.stages || [],
    next: progress.next || ''
  };

  setDashboardStat('Braces Treatment Progress', pct + '%');
  setDashboardStat('Outstanding Balance', peso(contract.balance));

  return true;
}

async function loadPatientBraces() {
  try {
    const payload =
      await patientBracesRequest();

    // A working endpoint always returns these boolean flags. If they're
    // missing, the endpoint isn't actually implemented yet (e.g. a dev
    // server just serving the raw .php file as text) — fall back to the
    // bundled sample data instead of showing a blank dashboard.
    if (typeof payload.has_braces_treatment !== 'boolean') {
      throw new Error('not_implemented');
    }

    PatientDashboardVisibility.braces =
      payload.has_braces_treatment === true;

    PatientDashboardVisibility.contract =
      payload.has_contract === true;

    PatientDashboardVisibility.balance =
      payload.has_outstanding_balance === true;

    PatientMock.braces =
      payload.braces || PatientMock.braces;

    PatientMock.contract =
      payload.contract || PatientMock.contract;

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
      PatientMock.dashboard.stats
    );

    renderBracesProgress(PatientMock.braces);

    renderContract(
      PatientMock.contract
    );

    renderPayments();
  } catch (error) {
    // Backend not reachable/implemented yet. Prefer this patient's real,
    // live contract from ContractStore (kept in sync with Admin/Dentist);
    // only fall back to the bundled sample data if they have no contract
    // on file at all there yet, so the dashboard still shows something.
    applyContractStoreToPatientMock();

    PatientDashboardVisibility.braces = PatientMock.braces.active === true;
    PatientDashboardVisibility.contract = PatientMock.contract.active === true;
    PatientDashboardVisibility.balance = PatientMock.contract.active === true;

    applyPatientFeatureVisibility();

    renderDashboardStats(
      PatientMock.dashboard.stats
    );

    renderBracesProgress(PatientMock.braces);
    renderContract(PatientMock.contract);
    renderPayments();
  }
}

async function loadPatientAppointments() {
  try {
    const payload =
      await patientAppointmentRequest();

    // A working endpoint always returns these three arrays (even empty
    // ones for a patient with no history yet). If none of them are
    // present, the endpoint isn't actually implemented yet — fall back
    // to sample data instead of leaving every list empty.
    if (
      !Array.isArray(payload.schedule) &&
      !Array.isArray(payload.upcoming) &&
      !Array.isArray(payload.history)
    ) {
      throw new Error('not_implemented');
    }

    PatientMock.schedule =
      Array.isArray(
        payload.schedule
      )
        ? payload.schedule
        : [];

    PatientMock.dashboard.upcoming =
      Array.isArray(
        payload.upcoming
      )
        ? payload.upcoming
        : [];

    PatientMock.history =
      Array.isArray(
        payload.history
      )
        ? payload.history
        : [];

    const first =
      PatientMock.schedule[0];

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
      PatientMock.dashboard.stats
    );

    renderUpcoming(
      PatientMock.dashboard.upcoming
    );

    renderSchedule(
      PatientMock.schedule
    );

    renderHistory(
      PatientMock.history
    );
  } catch (error) {
    // Backend not reachable/implemented yet — PatientMock already has
    // realistic sample schedule/history data, so just render that
    // instead of clearing everything to empty.
    const welcomeText =
      document.getElementById('welcomeText');
    const first = PatientMock.schedule[0];
    if (welcomeText) {
      welcomeText.textContent =
        first
          ? `Your next visit is on ${first.date} at ${first.time} for ${first.svc}.`
          : 'You have no upcoming appointments.';
    }

    renderDashboardStats(
      PatientMock.dashboard.stats
    );

    renderUpcoming(
      PatientMock.dashboard.upcoming
    );

    renderSchedule(
      PatientMock.schedule
    );

    renderHistory(
      PatientMock.history
    );
  }
}

// ---------- Initial rendering ----------
PatientStore.load();

renderUser(
  PatientMock.user
);

renderDashboardStats(
  PatientMock.dashboard.stats
);

renderUpcoming(
  PatientMock.dashboard.upcoming
);

renderAnnouncementMinis(
  PatientMock.dashboard.announcements
);

renderProfile(
  PatientMock.profile
);

renderSchedule(
  PatientMock.schedule
);

renderHistory(
  PatientMock.history
);

renderTreatments(
  PatientMock.treatments
);

renderBracesProgress(
  PatientMock.braces
);

renderContract(
  PatientMock.contract
);

renderPayments();

renderPromoCards(
  PatientMock.promoCards
);

applyPatientFeatureVisibility();

loadPatientAppointments();
loadPatientBraces();
