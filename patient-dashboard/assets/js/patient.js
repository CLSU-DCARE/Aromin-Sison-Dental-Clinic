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

    if (view === 'contract') {
      renderContract(
        PatientMock.contract
      );

      renderPayments();
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

// ---------- Book appointment ----------
const confirmBookingBtn =
  document.getElementById(
    'confirmBookingBtn'
  );

const bookingNote =
  document.getElementById(
    'bookingNote'
  );

function showBookingNote(
  message,
  kind,
  hide
) {
  if (!bookingNote) {
    return;
  }

  if (hide) {
    bookingNote.hidden = true;
    return;
  }

  bookingNote.textContent = message;

  bookingNote.classList.toggle(
    'ok',
    kind === 'ok'
  );

  bookingNote.classList.toggle(
    'err',
    kind === 'err'
  );

  bookingNote.hidden = false;
}

function updateConfirmState() {
  if (confirmBookingBtn) {
    confirmBookingBtn.disabled =
      !document.querySelector(
        '.slot.selected'
      );
  }
}

document
  .querySelectorAll(
    '.slot:not(.unavailable)'
  )
  .forEach(slot => {
    slot.addEventListener(
      'click',
      () => {
        document
          .querySelectorAll('.slot')
          .forEach(item => {
            const selected =
              item === slot;

            item.classList.toggle(
              'selected',
              selected
            );

            if (
              item.hasAttribute(
                'aria-pressed'
              )
            ) {
              item.setAttribute(
                'aria-pressed',
                selected
                  ? 'true'
                  : 'false'
              );
            }
          });

        document.getElementById(
          'selectedSlot'
        ).textContent =
          slot.dataset.slot;

        showBookingNote(
          '',
          '',
          true
        );

        updateConfirmState();
      }
    );
  });

updateConfirmState();

const bookDate =
  document.getElementById(
    'bookDate'
  );

if (bookDate) {
  const today = new Date();

  today.setMinutes(
    today.getMinutes() -
    today.getTimezoneOffset()
  );

  bookDate.min =
    today
      .toISOString()
      .split('T')[0];
}

(function synchronizeBookingSummary() {
  const service =
    document.getElementById(
      'bookService'
    );

  const dentist =
    document.getElementById(
      'bookDentist'
    );

  const summaryService =
    document.getElementById(
      'summaryService'
    );

  const summaryDentist =
    document.getElementById(
      'summaryDentist'
    );

  const synchronize = () => {
    if (
      summaryService &&
      service
    ) {
      summaryService.textContent =
        service.value;
    }

    if (
      summaryDentist &&
      dentist
    ) {
      summaryDentist.textContent =
        dentist.value ===
        'No preference'
          ? 'Clinic assignment'
          : dentist.value;
    }
  };

  if (service) {
    service.addEventListener(
      'change',
      synchronize
    );
  }

  if (dentist) {
    dentist.addEventListener(
      'change',
      synchronize
    );
  }
})();

if (confirmBookingBtn) {
  confirmBookingBtn.addEventListener(
    'click',
    async () => {
      const date =
        document.getElementById(
          'bookDate'
        );

      const slot =
        document.querySelector(
          '.slot.selected'
        );

      if (!slot) {
        showBookingNote(
          'Please select an available time slot.',
          'err'
        );

        const firstSlot =
          document.querySelector(
            '.slot:not(.unavailable)'
          );

        if (firstSlot) {
          firstSlot.focus();
        }

        return;
      }

      if (!date || !date.value) {
        showBookingNote(
          'Please choose a preferred date.',
          'err'
        );

        if (date) {
          date.focus();
        }

        return;
      }

      showBookingNote(
        '',
        '',
        true
      );

      confirmBookingBtn.classList.add(
        'is-loading'
      );

      try {
        const service =
          document.getElementById(
            'bookService'
          ).value;

        const dentist =
          document.getElementById(
            'bookDentist'
          ).value;

        const time =
          slot.dataset.slot;

        await patientAppointmentRequest(
          'POST',
          {
            service_type: service,
            preferred_dentist: dentist,
            scheduled_date:
              date.value,
            scheduled_time: time
          }
        );

        await loadPatientAppointments();
        await loadPatientBraces();

        slot.classList.add(
          'unavailable'
        );

        slot.disabled = true;

        slot.classList.remove(
          'selected'
        );

        slot.setAttribute(
          'aria-pressed',
          'false'
        );

        document.getElementById(
          'selectedSlot'
        ).textContent =
          'Not yet selected';

        updateConfirmState();

        const serviceSelect =
          document.getElementById(
            'bookService'
          );

        const dentistSelect =
          document.getElementById(
            'bookDentist'
          );

        if (serviceSelect) {
          serviceSelect.selectedIndex = 0;
        }

        if (dentistSelect) {
          dentistSelect.selectedIndex = 0;
        }

        if (date) {
          date.value = '';
        }

        const summaryService =
          document.getElementById(
            'summaryService'
          );

        const summaryDentist =
          document.getElementById(
            'summaryDentist'
          );

        if (summaryService) {
          summaryService.textContent =
            'Braces Adjustment';
        }

        if (summaryDentist) {
          summaryDentist.textContent =
            PatientMock.profile
              .primaryDentist;
        }

        showBookingNote(
          'Booking request sent! Our team will confirm shortly.',
          'ok'
        );

        announce(
          'Booking request sent. Check your schedule to track it.'
        );
      } catch (error) {
        showBookingNote(
          error.message,
          'err'
        );
      } finally {
        confirmBookingBtn.classList.remove(
          'is-loading'
        );
      }
    }
  );
}

// ---------- Notifications ----------
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

// ---------- Edit Profile ----------
const profileModal =
  new Modal('profileModal');

const profileNote =
  document.getElementById(
    'profileNote'
  );

if (profileModal.modal) {
  profileModal.registerClose(
    document.getElementById(
      'profileModalClose'
    )
  );

  profileModal.registerClose(
    document.getElementById(
      'profileCancelBtn'
    )
  );
}

function showProfileNote(
  message,
  isError
) {
  profileNote.textContent = message;

  profileNote.classList.toggle(
    'err',
    !!isError
  );

  profileNote.classList.toggle(
    'ok',
    !isError
  );

  profileNote.hidden = false;
}

function openEditProfile() {
  const information =
    PatientMock.profile.info;

  const getValue = label => {
    const field =
      information.find(
        item => item.label === label
      );

    return field
      ? field.value
      : '';
  };

  document.getElementById(
    'epName'
  ).value =
    PatientMock.user.name;

  document.getElementById(
    'epContact'
  ).value =
    getValue('Contact Number');

  document.getElementById(
    'epEmail'
  ).value =
    getValue('Email Address');

  profileNote.hidden = true;
  profileModal.open();
}

const profileSaveBtn =
  document.getElementById(
    'profileSaveBtn'
  );

if (profileSaveBtn) {
  document.getElementById(
    'editProfileBtn'
  ).addEventListener(
    'click',
    openEditProfile
  );

  profileSaveBtn.addEventListener(
    'click',
    () => {
      const name =
        document.getElementById(
          'epName'
        ).value.trim();

      const contact =
        document.getElementById(
          'epContact'
        ).value.trim();

      if (!name || !contact) {
        showProfileNote(
          'Name and contact number are required.',
          true
        );

        return;
      }

      profileSaveBtn.classList.add(
        'is-loading'
      );

      setTimeout(() => {
        profileSaveBtn.classList.remove(
          'is-loading'
        );

        const information =
          PatientMock.profile.info;

        const setValue = (
          label,
          value
        ) => {
          const field =
            information.find(
              item =>
                item.label ===
                label
            );

          if (field) {
            field.value = value;
          }
        };

        PatientMock.user.name =
          name;

        PatientMock.user.initials =
          name
            .trim()
            .split(/\s+/)
            .map(word => word[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

        setValue(
          'Full Name',
          name
        );

        setValue(
          'Contact Number',
          contact
        );

        setValue(
          'Email Address',
          document
            .getElementById(
              'epEmail'
            )
            .value
            .trim()
        );

        PatientStore.save();

        renderUser(
          PatientMock.user
        );

        renderProfile(
          PatientMock.profile
        );

        profileModal.close();

        showToast(
          'Profile updated'
        );
      }, 500);
    }
  );

  profileModal.modal.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter' &&
        event.target.matches('input')
      ) {
        event.preventDefault();
        profileSaveBtn.click();
      }
    }
  );
}

// ---------- Shared dashboard core ----------
initToastTriggers();
initFullscreenToggle();

initSidebar(
  'asdc.patient.sidebar.collapsed'
);

initLogout(
  '../auth/login.html?role=patient'
);

// ---------- Rendering ----------
const escapeHtml = value => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const statusTag = status => {
  return (
    `<span class="tag ` +
    `tag-${status.tag}">` +
    `${status.status}` +
    `</span>`
  );
};

const EMPTY_ICON =
  '<svg viewBox="0 0 24 24" ' +
  'fill="none" ' +
  'stroke="currentColor" ' +
  'stroke-width="2">' +
  '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
  '<path d="M16 2v4M8 2v4M3 10h18"/>' +
  '</svg>';

const emptyState = (
  text,
  actionHtml = ''
) => {
  return (
    `<div class="empty-state">` +
    `<div class="es-ic" ` +
    `aria-hidden="true">` +
    `${EMPTY_ICON}` +
    `</div>` +
    `<div>${text}</div>` +
    `${
      actionHtml
        ? `<div class="es-action">` +
          `${actionHtml}` +
          `</div>`
        : ''
    }` +
    `</div>`
  );
};

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

// ---------- Reschedule appointment ----------
const reschedModal =
  new Modal('reschedModal');

let reschedIndex = null;
let rsDate = null;
let rsTime = null;
let rsNote = null;

if (reschedModal.modal) {
  reschedModal.registerClose(
    document.getElementById(
      'reschedModalClose'
    )
  );

  reschedModal.registerClose(
    document.getElementById(
      'rsCancelBtn'
    )
  );

  const rsSaveBtn =
    document.getElementById(
      'rsSaveBtn'
    );

  rsNote =
    document.getElementById(
      'rsNote'
    );

  rsDate =
    document.getElementById(
      'rsDate'
    );

  rsTime =
    document.getElementById(
      'rsTime'
    );

  if (rsDate) {
    const today = new Date();

    today.setMinutes(
      today.getMinutes() -
      today.getTimezoneOffset()
    );

    rsDate.min =
      today
        .toISOString()
        .split('T')[0];
  }

  rsSaveBtn.addEventListener(
    'click',
    async () => {
      if (reschedIndex === null) {
        return;
      }

      const appointment =
        PatientMock.schedule[
          reschedIndex
        ];

      if (!appointment) {
        return;
      }

      if (!rsDate.value) {
        rsNote.textContent =
          'Please choose a new date.';

        rsNote.classList.add('err');
        rsNote.classList.remove('ok');
        rsNote.hidden = false;
        rsDate.focus();

        return;
      }

      rsSaveBtn.classList.add(
        'is-loading'
      );

      rsNote.hidden = true;

      try {
        await patientAppointmentRequest(
          'PATCH',
          {
            appointment_id:
              appointment.appointment_id,
            scheduled_date:
              rsDate.value,
            scheduled_time:
              rsTime.value
          }
        );

        await loadPatientAppointments();
        await loadPatientBraces();

        reschedModal.close();

        showToast(
          'Appointment rescheduled'
        );
      } catch (error) {
        rsNote.textContent =
          error.message;

        rsNote.classList.add('err');
        rsNote.classList.remove('ok');
        rsNote.hidden = false;
      } finally {
        rsSaveBtn.classList.remove(
          'is-loading'
        );
      }
    }
  );
}

const scheduleBody =
  document.getElementById(
    'scheduleBody'
  );

if (scheduleBody) {
  scheduleBody.addEventListener(
    'click',
    event => {
      const button =
        event.target.closest(
          '[data-action="resched"]'
        );

      if (!button) {
        return;
      }

      const index =
        Number(
          button.dataset.index
        );

      const appointment =
        PatientMock.schedule[index];

      if (!appointment) {
        return;
      }

      reschedIndex = index;
      rsDate.value = '';
      rsTime.value =
        appointment.time;
      rsNote.hidden = true;

      reschedModal.open(button);
    }
  );
}

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

function renderBracesProgress(braces) {
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
    'ringPct',
    braces.pct
  );

  setValue(
    'ringSub',
    braces.monthLabel
  );

  setValue(
    'bracesNext',
    braces.next
  );

  setValue(
    'bracesHeading',
    braces.heading
  );

  setValue(
    'bracesDescription',
    braces.description
  );

  const offset =
    document.getElementById(
      'ringOffset'
    );

  if (offset) {
    offset.setAttribute(
      'stroke-dashoffset',
      braces.ringOffset
    );
  }

  const list =
    document.getElementById(
      'stageList'
    );

  if (!list) {
    return;
  }

  list.innerHTML =
    braces.stages.map(stage => {
      const check =
        stage.kind === 'done'
          ? '<div class="stage-check done">' +
            '<svg viewBox="0 0 24 24" ' +
            'fill="none" ' +
            'stroke="currentColor" ' +
            'stroke-width="3">' +
            '<path d="M20 6 9 17l-5-5"/>' +
            '</svg>' +
            '</div>'
          : `<div class="stage-check ${stage.kind}">` +
            `${stage.num}` +
            `</div>`;

      return (
        `<div class="stage">` +
        `${check}` +
        `<div>` +
        `<div class="stage-name">` +
        `${escapeHtml(stage.name)}` +
        `</div>` +
        `<div class="stage-date">` +
        `${escapeHtml(stage.date)}` +
        `</div>` +
        `</div>` +
        `</div>`
      );
    }).join('');
}

function renderContract(contract) {
  const summary =
    document.getElementById(
      'contractSummary'
    );

  if (summary) {
    summary.innerHTML =
      contract.summary.map(box => {
        return (
          `<div class="box">` +
          `<div class="v">` +
          `${box.v}` +
          `</div>` +
          `<div class="l">` +
          `${box.l}` +
          `</div>` +
          `</div>`
        );
      }).join('');
  }

  const fill =
    document.getElementById(
      'contractFill'
    );

  if (fill) {
    fill.style.width =
      contract.progress.width;
  }

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
    'contractLeft',
    contract.progress.left
  );

  setValue(
    'contractRight',
    contract.progress.right
  );

  const tableBody =
    document.getElementById(
      'paymentsBody'
    );

  if (!tableBody) {
    return;
  }

  const approved =
    PaymentStore.all()
      .filter(submission => {
        return submission.status ===
          'approved';
      })
      .map(submission => ({
        date: submission.reviewedAt,
        amount: submission.amount,
        method: 'Online (QR)',
        or: submission.orNumber
      }));

  const existingPayments =
    contract.payments.map(payment => ({
      date: payment.date,
      amount: payment.amount,
      method: payment.method,
      or: payment.or
    }));

  const all =
    approved.concat(
      existingPayments
    );

  tableBody.innerHTML =
    all.map(payment => {
      return (
        `<tr>` +
        `<td>${escapeHtml(payment.date)}</td>` +
        `<td>${escapeHtml(payment.amount)}</td>` +
        `<td>${escapeHtml(payment.method)}</td>` +
        `<td>${escapeHtml(payment.or)}</td>` +
        `</tr>`
      );
    }).join('');
}

// ---------- Payment submissions ----------
const CLINIC_PAYMENT_METHOD =
  'Online (QR)';

const PaymentStore = {
  key: 'asdc.payments',

  all() {
    try {
      const raw =
        localStorage.getItem(
          this.key
        );

      const list =
        raw
          ? JSON.parse(raw)
          : [];

      return Array.isArray(list)
        ? list
        : [];
    } catch (error) {
      return [];
    }
  },

  save(list) {
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify(list)
      );
    } catch (error) {
      // Ignore storage errors.
    }
  },

  byPatient(patientId) {
    return this.all().filter(
      submission => {
        return submission.pid ===
          patientId;
      }
    );
  }
};

function readReceiptImage(file) {
  return new Promise(
    (resolve, reject) => {
      if (
        !file ||
        !/^image\//.test(file.type)
      ) {
        reject(
          new Error(
            'Please upload an image file.'
          )
        );

        return;
      }

      const reader =
        new FileReader();

      reader.onerror = () => {
        reject(
          new Error(
            'Could not read the file.'
          )
        );
      };

      reader.onload = () => {
        const image = new Image();

        image.onerror = () => {
          reject(
            new Error(
              'Could not read the image.'
            )
          );
        };

        image.onload = () => {
          const maximum = 900;

          const scale = Math.min(
            1,
            maximum /
            Math.max(
              image.width,
              image.height
            )
          );

          const canvas =
            document.createElement(
              'canvas'
            );

          canvas.width = Math.max(
            1,
            Math.round(
              image.width * scale
            )
          );

          canvas.height = Math.max(
            1,
            Math.round(
              image.height * scale
            )
          );

          canvas
            .getContext('2d')
            .drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );

          resolve({
            dataUrl:
              canvas.toDataURL(
                'image/jpeg',
                0.82
              ),
            name: file.name
          });
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    }
  );
}

function renderPayments() {
  const submissions =
    PaymentStore
      .byPatient(
        PatientMock.user.pid
      )
      .slice()
      .reverse();

  const list =
    document.getElementById(
      'paySubs'
    );

  const empty =
    document.getElementById(
      'paySubsEmpty'
    );

  const pendingTag =
    document.getElementById(
      'payPendingTag'
    );

  if (!list) {
    return;
  }

  if (!submissions.length) {
    list.innerHTML = '';

    if (empty) {
      empty.hidden = false;
    }

    if (pendingTag) {
      pendingTag.textContent =
        '0 pending';
    }

    return;
  }

  if (empty) {
    empty.hidden = true;
  }

  const pendingCount =
    submissions.filter(
      submission => {
        return submission.status ===
          'pending';
      }
    ).length;

  if (pendingTag) {
    pendingTag.textContent =
      pendingCount + ' pending';

    pendingTag.className =
      'tag tag-' +
      (
        pendingCount > 0
          ? 'amber'
          : 'green'
      );
  }

  list.innerHTML =
    submissions.map(
      submission => {
        const statusClass =
          submission.status ===
          'approved'
            ? 'green'
            : submission.status ===
              'rejected'
              ? 'red'
              : 'amber';

        const statusText =
          submission.status ===
          'approved'
            ? 'Approved'
            : submission.status ===
              'rejected'
              ? 'Rejected'
              : 'Pending Confirmation';

        return (
          `<div class="pay-sub">` +
          `<span class="ps-amt">` +
          `${escapeHtml(
            submission.amount
          )}` +
          `</span>` +
          `<span class="ps-meta">` +
          `<b>Submitted ` +
          `${escapeHtml(
            submission.submittedAt
          )}` +
          `</b> · ` +
          `${escapeHtml(
            submission.method
          )}` +
          `${
            submission.orNumber
              ? ' · OR ' +
                escapeHtml(
                  submission.orNumber
                )
              : ''
          }` +
          `</span>` +
          `<span class="tag ` +
          `tag-${statusClass}">` +
          `${statusText}` +
          `</span>` +
          `</div>`
        );
      }
    ).join('');
}

// ---------- Make a payment ----------
const payReceiptInput =
  document.getElementById(
    'payReceipt'
  );

const payDrop =
  document.getElementById(
    'payDrop'
  );

const payDropText =
  document.getElementById(
    'payDropTxt'
  );

const payPreview =
  document.getElementById(
    'payPreview'
  );

const payPreviewImage =
  document.getElementById(
    'payPreviewImg'
  );

const payRemoveButton =
  document.getElementById(
    'payRemoveReceipt'
  );

const submitPaymentButton =
  document.getElementById(
    'submitPaymentBtn'
  );

let payReceiptData = null;

if (payReceiptInput) {
  if (payDrop) {
    payDrop.addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {
          event.preventDefault();
          payReceiptInput.click();
        }
      }
    );
  }

  payReceiptInput.addEventListener(
    'change',
    async () => {
      const file =
        payReceiptInput.files &&
        payReceiptInput.files[0];

      if (!file) {
        return;
      }

      try {
        const result =
          await readReceiptImage(
            file
          );

        payReceiptData =
          result.dataUrl;

        if (payDrop) {
          payDrop.classList.add(
            'has-file'
          );
        }

        if (payDropText) {
          payDropText.textContent =
            'Receipt ready: ' +
            result.name;
        }

        if (payPreview) {
          payPreview.hidden = false;
        }

        if (payPreviewImage) {
          payPreviewImage.src =
            result.dataUrl;
        }

        showToast(
          'Receipt attached — submit when ready.'
        );
      } catch (error) {
        showToast(
          error.message,
          'error'
        );

        payReceiptInput.value = '';
      }
    }
  );

  if (payRemoveButton) {
    payRemoveButton.addEventListener(
      'click',
      () => {
        payReceiptData = null;
        payReceiptInput.value = '';

        if (payDrop) {
          payDrop.classList.remove(
            'has-file'
          );
        }

        if (payDropText) {
          payDropText.textContent =
            'Click to upload a screenshot of your payment';
        }

        if (payPreview) {
          payPreview.hidden = true;
        }

        if (payPreviewImage) {
          payPreviewImage.src = '';
        }
      }
    );
  }
}

if (submitPaymentButton) {
  submitPaymentButton.addEventListener(
    'click',
    () => {
      const amountElement =
        document.getElementById(
          'payAmount'
        );

      const noteElement =
        document.getElementById(
          'payNote'
        );

      const amount =
        amountElement
          ? amountElement.value
          : '';

      const note =
        noteElement
          ? noteElement.value
          : '';

      if (!payReceiptData) {
        showToast(
          'Please upload your payment receipt first.',
          'error'
        );

        return;
      }

      if (
        !amount ||
        !amount.trim()
      ) {
        showToast(
          'Please enter the amount you paid.',
          'error'
        );

        return;
      }

      const submission = {
        id: 'pay-' + Date.now(),
        pid:
          PatientMock.user.pid,
        patient:
          PatientMock.user.name,
        amount: amount.trim(),
        method:
          CLINIC_PAYMENT_METHOD,
        note: (note || '').trim(),
        receiptDataUrl:
          payReceiptData,
        status: 'pending',
        submittedAt:
          new Date().toLocaleString(
            'en-US',
            {
              dateStyle: 'long',
              timeStyle: 'short'
            }
          ),
        reviewedAt: null,
        orNumber: null
      };

      const all =
        PaymentStore.all();

      all.push(submission);

      PaymentStore.save(all);

      payReceiptData = null;
      payReceiptInput.value = '';

      if (payDrop) {
        payDrop.classList.remove(
          'has-file'
        );
      }

      if (payDropText) {
        payDropText.textContent =
          'Click to upload a screenshot of your payment';
      }

      if (payPreview) {
        payPreview.hidden = true;
      }

      if (payPreviewImage) {
        payPreviewImage.src = '';
      }

      if (noteElement) {
        noteElement.value = '';
      }

      renderPayments();

      showToast(
        'Payment submitted — awaiting admin confirmation.'
      );
    }
  );
}

// ---------- Download contract ----------
let patientLogoDataUrl = null;

function getPatientLogoDataUrl() {
  if (
    patientLogoDataUrl !== null
  ) {
    return Promise.resolve(
      patientLogoDataUrl
    );
  }

  return fetch(
    '../shared/images/asdc logo.png'
  )
    .then(response => {
      if (!response.ok) {
        throw new Error(
          'logo unavailable'
        );
      }

      return response.blob();
    })
    .then(blob => {
      return new Promise(
        (resolve, reject) => {
          const reader =
            new FileReader();

          reader.onload = () => {
            patientLogoDataUrl =
              reader.result;

            resolve(
              patientLogoDataUrl
            );
          };

          reader.onerror = reject;

          reader.readAsDataURL(
            blob
          );
        }
      );
    })
    .catch(() => {
      patientLogoDataUrl = '';
      return patientLogoDataUrl;
    });
}

async function downloadContractPDF() {
  const printWindow =
    window.open('', '_blank');

  if (!printWindow) {
    showToast(
      'Pop-up blocked: allow pop-ups to download the contract.',
      'error'
    );

    return;
  }

  const user =
    PatientMock.user || {};

  const contract =
    PatientMock.contract || {
      summary: [],
      progress: {},
      payments: []
    };

  const generatedDate =
    new Date().toLocaleString(
      'en-US',
      {
        dateStyle: 'long',
        timeStyle: 'short'
      }
    );

  const logo =
    await getPatientLogoDataUrl();

  const logoHtml =
    logo
      ? `<img class="report-logo" ` +
        `src="${logo}" ` +
        `alt="Aromin-Sison Dental Clinic">`
      : '';

  const summaryBoxes =
    (contract.summary || [])
      .map(box => {
        return (
          `<div class="stat">` +
          `<div class="stat-v">` +
          `${escapeHtml(box.v)}` +
          `</div>` +
          `<div class="stat-l">` +
          `${escapeHtml(box.l)}` +
          `</div>` +
          `</div>`
        );
      })
      .join('');

  const progress =
    contract.progress || {};

  const payments =
    (contract.payments || [])
      .map(payment => {
        return (
          `<tr>` +
          `<td>${escapeHtml(payment.date)}</td>` +
          `<td>${escapeHtml(payment.amount)}</td>` +
          `<td>${escapeHtml(payment.method)}</td>` +
          `<td>${escapeHtml(payment.or)}</td>` +
          `</tr>`
        );
      })
      .join('');

  printWindow.document.write(
    `<!DOCTYPE html>` +
    `<html lang="en">` +
    `<head>` +
    `<meta charset="UTF-8">` +
    `<title>Braces Contract</title>` +
    `<style>` +
    `*{box-sizing:border-box;}` +
    `body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B1B19;margin:0;padding:32px;}` +
    `.report-head{display:flex;align-items:center;gap:18px;border-bottom:2px solid #9C8B3E;padding-bottom:14px;margin-bottom:22px;}` +
    `.report-logo{width:150px;height:auto;object-fit:contain;flex-shrink:0;}` +
    `.report-head h1{margin:0;font-size:22px;font-weight:600;line-height:1.2;}` +
    `.report-meta{margin-left:auto;font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.08em;text-align:right;line-height:1.6;}` +
    `.patient-line{font-size:13px;color:#5c5c55;margin:-6px 0 20px;}` +
    `.patient-line b{color:#1B1B19;font-weight:600;}` +
    `.stats{display:flex;gap:14px;margin-bottom:26px;}` +
    `.stat{flex:1;border:1px solid rgba(27,27,25,.15);border-radius:10px;padding:14px 16px;}` +
    `.stat-v{font-size:19px;font-weight:600;}` +
    `.stat-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b6b65;margin-top:3px;}` +
    `h2{font-size:15px;font-weight:600;margin:26px 0 10px;}` +
    `table{width:100%;border-collapse:collapse;font-size:13px;}` +
    `th{background:#F1EDE3;text-align:left;padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.18);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#5c5c55;}` +
    `td{padding:9px 12px;border-bottom:1px solid rgba(27,27,25,.1);}` +
    `.bar{height:8px;border-radius:99px;background:#EFEAE0;overflow:hidden;margin-top:8px;}` +
    `.bar>div{height:100%;border-radius:99px;background:#9C8B3E;}` +
    `.bar-meta{display:flex;justify-content:space-between;font-size:11px;color:#6b6b65;margin-top:6px;}` +
    `.terms{font-size:11px;color:#6b6b65;line-height:1.7;margin-top:26px;}` +
    `.foot{margin-top:28px;padding-top:14px;border-top:1px solid rgba(27,27,25,.12);font-size:10.5px;color:#6b6b65;text-transform:uppercase;letter-spacing:.06em;}` +
    `@media print{body{padding:0;}}` +
    `</style>` +
    `</head>` +
    `<body>` +
    `<div class="report-head">` +
    `${logoHtml}` +
    `<h1>Braces Contract</h1>` +
    `<div class="report-meta">` +
    `Aromin-Sison Dental Clinic<br>` +
    `Generated ${escapeHtml(generatedDate)}` +
    `</div>` +
    `</div>` +
    `<div class="patient-line">` +
    `Contract Holder: ` +
    `<b>${escapeHtml(user.name || '')}</b>` +
    ` · ${escapeHtml(user.pid || '')}` +
    `</div>` +
    `<div class="stats">${summaryBoxes}</div>` +
    `<h2>Contract Progress</h2>` +
    `<div class="bar">` +
    `<div style="width:${escapeHtml(
      progress.width || '0%'
    )};"></div>` +
    `</div>` +
    `<div class="bar-meta">` +
    `<span>${escapeHtml(progress.left || '')}</span>` +
    `<span>${escapeHtml(progress.right || '')}</span>` +
    `</div>` +
    `<h2>Payment History</h2>` +
    `<table>` +
    `<thead>` +
    `<tr>` +
    `<th>Date</th>` +
    `<th>Amount</th>` +
    `<th>Method</th>` +
    `<th>OR Number</th>` +
    `</tr>` +
    `</thead>` +
    `<tbody>${payments}</tbody>` +
    `</table>` +
    `<div class="terms">` +
    `This document is a summary of the orthodontic payment contract between the patient and Aromin-Sison Dental Clinic.` +
    `</div>` +
    `<div class="foot">` +
    `Aromin-Sison Dental Clinic · Generated for ${escapeHtml(user.name || '')}` +
    `</div>` +
    `</body>` +
    `</html>`
  );

  printWindow.document.close();
  printWindow.focus();

  setTimeout(
    () => printWindow.print(),
    400
  );

  showToast(
    'Contract ready — choose "Save as PDF" in the print dialog'
  );
}

const downloadContractButton =
  document.getElementById(
    'downloadContractBtn'
  );

if (downloadContractButton) {
  downloadContractButton.addEventListener(
    'click',
    downloadContractPDF
  );
}

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

// ---------- Local profile persistence ----------
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

async function loadPatientBraces() {
  try {
    const payload =
      await patientBracesRequest();

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

    renderBracesProgress(
      PatientMock.braces
    );

    renderContract(
      PatientMock.contract
    );

    renderPayments();
  } catch (error) {
    PatientDashboardVisibility.braces = false;
    PatientDashboardVisibility.contract = false;
    PatientDashboardVisibility.balance = false;

    applyPatientFeatureVisibility();

    renderDashboardStats(
      PatientMock.dashboard.stats
    );

    showToast(error.message);
  }
}

async function loadPatientAppointments() {
  try {
    const payload =
      await patientAppointmentRequest();

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
    PatientMock.dashboard.upcoming = [];
    PatientMock.schedule = [];
    PatientMock.history = [];

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

    showToast(error.message);
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
