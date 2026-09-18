// =====================================================================
const PATIENT_APPOINTMENTS_ENDPOINT =
  '../backend/api/patients/appointments.php';
const PATIENT_BRACES_ENDPOINT =
  '../backend/api/patients/braces.php';
let appointmentsLoaded = false;

const PatientDashboardVisibility = {
  braces: false,
  contract: false,
  billing: true,
  balance: false
};

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
  billing: {
    title: 'Payment & Billing',
    crumb: 'Billing'
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

    if (view === 'contract' || view === 'braces' || view === 'billing') {
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
  onBooked: refreshAfterPatientAction
});
appointmentBooking.init();

// ---------- Notifications ----------
const inbox = initNotifications({ triggerId: 'notifBtn', panelId: 'notifPanel', listId: 'notifList', badgeId: 'notifBadge', markAllId: 'notifMarkAll', emptyId: 'notifEmpty', notifications: [] });
const inboxEmpty = document.getElementById('notifEmpty');
if (inboxEmpty) inboxEmpty.textContent = 'Loading notifications…';

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

      const target = {
        'Upcoming Appointment': 'schedule',
        'Completed Visits': 'history',
        'Treatment Records': 'treatment',
        'Braces Treatment Progress': 'braces',
        'Outstanding Balance': 'billing'
      }[stat.label] || 'dashboard';

      return (
        `<div class="stat-card stat-card-link" role="button" tabindex="0" data-stat-target="${target}" aria-label="Open ${escapeHtml(stat.label)}">` +
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
        `<button type="button" class="promo-mini promo-mini-btn" data-promo-id="${Number(row.id)}" aria-label="View promotion details for ${escapeHtml(row.title)}">` +
        `${row.image_path ? `<img class="promo-mini-img" src="../backend/${escapeHtml(row.image_path)}" alt="">` : ''}` +
        `<div class="promo-mini-copy">` +
        `<div class="t">` +
        `${escapeHtml(row.title)}` +
        `</div>` +
        `<div class="s">` +
        `${escapeHtml(row.sub)}` +
        `</div>` +
        `</div>` +
        `</button>`
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
        `<button class="btn btn-outline btn-sm" data-cancel-appointment="${Number(row.appointment_id)}">Cancel</button>` +
        `</td>` +
        `</tr>`
      );
    }).join('');
}

// ---------- Reschedule appointment (delegated to PatientRescheduleModal) ----------
const rescheduleModal = new PatientRescheduleModal({
  state: PatientState,
  appointmentsEndpoint: PATIENT_APPOINTMENTS_ENDPOINT,
  onRescheduled: refreshAfterPatientAction
});
rescheduleModal.init();
document.getElementById('scheduleBody')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-cancel-appointment]');
  if (!button || button.disabled) return;
  const confirmed = await ASDC.confirmAction({
    title: 'Cancel Appointment',
    message: 'Cancel this appointment?',
    confirmLabel: 'Cancel Appointment',
    tone: 'danger'
  });
  if (!confirmed) return;
  button.disabled = true;
  try {
    await apiFetch(PATIENT_APPOINTMENTS_ENDPOINT, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', appointment_id: Number(button.dataset.cancelAppointment) }) });
    await refreshAfterPatientAction(); showToast('Appointment cancelled.');
  } catch (error) { showToast(error.message, 'error'); }
  finally { button.disabled = false; }
});

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
        `<p>${escapeHtml(treatment.diagnosis || '')}</p><p>${escapeHtml(treatment.notes || '')}</p>` +
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
const paymentSubmission = new PatientPaymentSubmission({ state: PatientState, onSubmitted: refreshAfterPatientAction });
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
      'No current announcements.'
    );

    return;
  }

  grid.innerHTML =
    cards.map(card => {
      return (
        `<div class="promo-card promo-card-btn" role="button" tabindex="0" data-promo-id="${Number(card.id)}" aria-label="View promotion details for ${escapeHtml(card.title)}">` +
        `${card.image_path ? `<img class="promo-img-real" src="../backend/${escapeHtml(card.image_path)}" alt="${escapeHtml(card.title)}">` : ''}` +
        `<div class="promo-body">` +
        `<h4>${escapeHtml(card.title)}</h4>` +
        `<p>${escapeHtml(card.desc)}</p>` +
        `<div class="promo-foot">` +
        `<span class="tag tag-green">${escapeHtml(card.status || 'Live')}</span>` +
        `<div class="promo-actions"><span>${escapeHtml(card.start_date || '')} - ${escapeHtml(card.end_date || '')}</span></div>` +
        `</div>` +
        `<span class="promo-view">View details</span>` +
        `</div>` +
        `</div>`
      );
    }).join('');
}

function formatPromoRange(card) {
  if (card.start_date && card.end_date) return card.start_date + ' to ' + card.end_date;
  if (card.start_date) return 'Starts ' + card.start_date;
  if (card.end_date) return 'Until ' + card.end_date;
  return 'Clinic promotion';
}

const promoDetailModal = new Modal('promoDetailModal');
if (promoDetailModal.modal) {
  promoDetailModal.registerClose(document.getElementById('promoDetailClose'));
  promoDetailModal.registerClose(document.getElementById('promoDetailCancel'));
}

function openPromotionDetail(id, trigger) {
  const promo = PatientState.promoCards.find(card => Number(card.id) === Number(id));
  if (!promo || !promoDetailModal.modal) return;
  const img = document.getElementById('promoDetailImg');
  const media = document.getElementById('promoDetailMedia');
  document.getElementById('promoDetailTitle').textContent = promo.title;
  document.getElementById('promoDetailText').textContent = promo.desc;
  document.getElementById('promoDetailDates').textContent = formatPromoRange(promo);
  if (promo.image_path) {
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
  const card = event.target.closest('[data-promo-id]');
  if (card) openPromotionDetail(card.dataset.promoId, card);
});

document.getElementById('promoGrid')?.addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key)) return;
  const card = event.target.closest('[data-promo-id]');
  if (!card) return;
  event.preventDefault();
  openPromotionDetail(card.dataset.promoId, card);
});

document.getElementById('announceMiniList')?.addEventListener('click', event => {
  const item = event.target.closest('[data-promo-id]');
  if (item) openPromotionDetail(item.dataset.promoId, item);
});

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

  setPatientViewVisibility(
    'billing',
    true
  );
}

async function refreshAfterPatientAction() {
  if (patientLiveSync.pending) await patientLiveSync.pending;
  return patientLiveSync.refresh();
}
function loadPatientAppointments() { return refreshAfterPatientAction(); }
function loadPatientBraces() { return refreshAfterPatientAction(); }

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


renderPromoCards(
  PatientState.promoCards
);

applyPatientFeatureVisibility();

function applyPatientSnapshot(data, changed) {
  const { appointments, braces, profile } = data;
  PatientState.schedule = appointments.schedule;
  PatientState.history = appointments.history;
  PatientState.dashboard.upcoming = appointments.upcoming;
  PatientState.braces = braces.braces;
  PatientState.contract = braces.contract;
  PatientState.treatments = data.treatments;
  appointmentsLoaded = true;
  PatientDashboardVisibility.braces = braces.has_braces_treatment === true;
  PatientDashboardVisibility.contract = braces.has_contract === true;
  PatientDashboardVisibility.billing = true;
  PatientDashboardVisibility.balance = braces.has_outstanding_balance === true;
  setDashboardStat('Braces Treatment Progress', braces.braces_progress);
  setDashboardStat('Outstanding Balance', braces.outstanding_balance);
  setDashboardStat('Completed Visits', braces.completed_visits);
  setDashboardStat('Treatment Records', braces.treatment_records);
  PatientState.user.pid = '#P-' + profile.patient_id;
  PatientState.user.name = profile.first_name + ' ' + profile.last_name;
  PatientState.user.initials = PatientState.user.name.split(/\s+/).map(s => s[0]).slice(0,2).join('').toUpperCase();
  renderUser(PatientState.user);
  inbox.setItems(data.notifications || []);
  const dentistSelect = document.getElementById('bookDentist');
  const dentistVersion = JSON.stringify(data.dentists || []);
  if (dentistSelect && dentistSelect.dataset.version !== dentistVersion) {
    const selected = dentistSelect.value;
    dentistSelect.innerHTML = '<option>No preference</option>' + (data.dentists || []).map(d => `<option>${escapeHtml(d.full_name)}</option>`).join('');
    if ([...dentistSelect.options].some(o => o.value === selected)) dentistSelect.value = selected;
    dentistSelect.dataset.version = dentistVersion;
  }
  PatientState.promoCards = (data.announcements || []).map(a => ({ ...a, title: a.title, tag: 'green', status: a.status === 'scheduled' ? 'Scheduled' : 'Live', eyebrow: 'Clinic announcement', meta: a.start_date || '' }));
  PatientState.dashboard.announcements = PatientState.promoCards.map(a => ({ ...a, sub: a.desc }));
  renderPromoCards(PatientState.promoCards); renderAnnouncementMinis(PatientState.dashboard.announcements);
  const dentist = (braces.contract.summary || []).find(item => item.l === 'Treating Dentist');
  PatientState.profile = {
    memberSince: profile.registered_at ? new Date(profile.registered_at.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—',
    primaryDentist: dentist ? dentist.v : '—',
    info: [
      { label: 'Full Name', value: PatientState.user.name },
      { label: 'Patient ID', value: PatientState.user.pid },
      { label: 'Contact Number', value: profile.contact_number || '—' },
      { label: 'Email Address', value: profile.email || '—' }
    ]
  };
  renderProfile(PatientState.profile);
  document.getElementById('profilePid').textContent = PatientState.user.pid;
  const first = appointments.schedule[0];
  document.getElementById('welcomeText').textContent = first
    ? 'Your next visit is on ' + first.date + ' at ' + first.time + ' for ' + first.svc + '.'
    : 'You have no upcoming appointments.';
  applyPatientFeatureVisibility();
  renderDashboardStats(PatientState.dashboard.stats);
  renderUpcoming(appointments.upcoming);
  renderSchedule(appointments.schedule);
  renderHistory(appointments.history);
  renderTreatments(data.treatments);
  renderBracesProgress(braces.braces);
  renderContract(braces.contract);
  paymentSubmission.renderSubmissions(data.submissions);
  const active = document.querySelector('.view.active');
  if ((active?.id === 'view-braces' && !PatientDashboardVisibility.braces) ||
      (active?.id === 'view-contract' && !PatientDashboardVisibility.contract)) switchView('dashboard');
}

const patientLiveSync = new PatientLiveSync({
  fetchSnapshot: async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      return await apiFetch('../backend/api/patients/dashboard.php', { cache: 'no-store', signal: controller.signal });
    } finally { clearTimeout(timer); }
  },
  applySnapshot: applyPatientSnapshot,
  onStatus: status => {
    const label = document.getElementById('patientSyncStatus');
    if (label) label.textContent = {
      live: 'Updates automatically',
      reconnecting: 'Connection interrupted — showing last update. Retrying…',
      unavailable: 'Unable to load clinic records. Retrying…',
      'signed-out': 'Your session has ended. Please sign in again.'
    }[status];
    if (status === 'signed-out') window.location.replace('../auth/login.html?error=session');
  }
});
window.addEventListener('asdc:authenticated', () => patientLiveSync.start());
window.addEventListener('asdc:mutation', refreshAfterPatientAction);
window.addEventListener('pagehide', () => patientLiveSync.stop());
window.addEventListener('pageshow', event => { if (event.persisted) patientLiveSync.start(); });
if (window.ASDCAuthUser) patientLiveSync.start();
