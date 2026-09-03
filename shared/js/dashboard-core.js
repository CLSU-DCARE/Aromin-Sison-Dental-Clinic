/* =====================================================================
   Aromin-Sison Dental Clinic: shared dashboard core
   Single source of truth for utilities used by ALL dashboards
   (dentist, receptionist, and patient). Load this BEFORE the
   page-specific dashboard script (dentist.js / admin.js / patient.js).

   Exposes (all global, matching the legacy behavior they replace):
     class Modal           - reusable dialog (focus trap, Esc, backdrop)
     showToast(msg, kind)  - app toast via #appToast (optional action button)
     initToastTriggers()   - wires the [data-toast] click delegation
     initFullscreenToggle() - wires #fullscreenToggle
     initSidebar(key)      - sidebar collapse (desktop) / drawer (mobile)
     openSidebar/closeSidebar/applyCollapsed - sidebar state helpers
     initLogout(url)       - wires the #logoutModal confirm-logout flow
     openLogoutConfirm(el) - opens the logout modal programmatically
     Popover               - anchored dropdown panels (notifications, user
                             menu, search): closes on outside click / Esc,
                             keeps itself inside the viewport, becomes a
                             bottom sheet on phones
     initNotifications(opts) - wires a notification trigger + panel with
                             unread/read states and "mark all as read"
   ===================================================================== */

// ---------- Authenticated dashboard session ----------
// Direct dashboard navigation is checked against the server session. The
// selected login tab and browser storage are never treated as identity.
(function guardDashboardSession(){
  const isPatientDashboard = location.pathname.includes('/patient-dashboard/');
  const isDentistDashboard = location.pathname.includes('/dentist-dashboard/');
  const isReceptionistDashboard = location.pathname.includes('/admin-system/');
  const isAnyDashboard = isPatientDashboard || isDentistDashboard || isReceptionistDashboard;
  if (!isAnyDashboard) return;

  // Avoid briefly displaying protected dashboard content while the session
  // check is in flight.
  document.documentElement.style.visibility = 'hidden';

  const loginUrl = '../auth/login.html';
  const destinationFor = role => {
    const map = {
      patient: '../patient-dashboard/dashboard.html',
      dentist: '../dentist-dashboard/dashboard.html',
      receptionist: '../admin-system/dashboard.html'
    };
    return map[role] || null;
  };

  fetch('../backend/api/auth/me.php', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
  })
    .then(async response => {
      let payload = {};
      try { payload = await response.json(); } catch (e) {}
      if (!response.ok || !payload.user) throw new Error('unauthenticated');
      return payload.user;
    })
    .then(user => {
      const destination = destinationFor(user.role);
      const correctDashboard =
        (isPatientDashboard && user.role === 'patient') ||
        (isDentistDashboard && user.role === 'dentist') ||
        (isReceptionistDashboard && user.role === 'receptionist');

      if (!destination){
        location.replace(loginUrl);
        return;
      }
      if (!correctDashboard){
        location.replace(destination);
        return;
      }

      window.ASDCAuthUser = user;
      const initials = String(user.full_name || '')
        .trim().split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
      const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
      const set = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
      };

      ['sideFootAvatar', 'chipAvatar', 'menuAvatar', 'profileAvatar'].forEach(id => set(id, initials));
      ['sideFootName', 'menuName', 'profileName'].forEach(id => set(id, user.full_name));
      ['sideFootRole', 'menuRole'].forEach(id => set(id, roleLabel));
      if (!isPatientDashboard) set('greetingSubtext', user.full_name + ' · ' + roleLabel);
      else set('welcomeTitle', 'Welcome, ' + user.full_name + '!');

      const chip = document.getElementById('userChip');
      if (chip) chip.title = user.full_name + ': ' + roleLabel;
      document.documentElement.style.visibility = '';
    })
    .catch(() => location.replace(loginUrl + '?error=session'));
})();

// =====================================================================
// REUSABLE MODAL COMPONENT (mirrors the pattern used in the auth module)
// =====================================================================
class Modal {
  constructor(modalId){
    const existing = Modal._registry.get(modalId);
    if (existing) return existing;

    this.modal = document.getElementById(modalId);
    if (!this.modal) return;

    this.lastTrigger = null;
    this._onKeydown = this._onKeydown.bind(this);
    this._onBackdrop = this._onBackdrop.bind(this);
    this.modal.addEventListener('click', this._onBackdrop);

    Modal._registry.set(modalId, this);
  }

  registerTrigger(el){
    if (!el || !this.modal) return;
    el.addEventListener('click', () => this.open(el));
  }
  registerClose(el){
    if (!el || !this.modal) return;
    el.addEventListener('click', () => this.close());
  }

  open(trigger){
    if (this.modal.hidden === false) return;
    this.lastTrigger = trigger || document.activeElement;
    this.modal.hidden = false;
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', this._onKeydown);
    const focusable = this._focusable();
    if (focusable.length) focusable[0].focus();
  }

  close(){
    if (this.modal.hidden) return;
    this.modal.hidden = true;
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', this._onKeydown);
    if (this.lastTrigger) this.lastTrigger.focus();
    this.lastTrigger = null;
  }

  _focusable(){
    return Array.from(
      this.modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.disabled && el.offsetParent !== null);
  }

  _onKeydown(e){
    if (e.key === 'Escape'){
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key === 'Tab'){
      const items = this._focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first){
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      }
    }
  }

  _onBackdrop(e){
    if (e.target === this.modal) this.close();
  }

  static anyOpen(){
    return Array.from(Modal._registry.values()).some(m => m.modal && !m.modal.hidden);
  }
}
Modal._registry = new Map();

// ---------- Toast: lightweight feedback for mock action buttons ----------
// Optional third arg `action` = { label, onClick } renders a button inside
// the toast (e.g. "Undo"). The pill holds its frame until the action is
// used or the timeout expires, whichever comes first.
function showToast(message, kind = 'success', action = null){
  const toast = document.getElementById('appToast');
  if (!toast) return;
  toast.textContent = '';
  toast.classList.remove('success', 'error', 'has-action');
  toast.classList.add(kind === 'error' ? 'error': 'success');
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);
  if (action && action.label && typeof action.onClick === 'function'){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      clearTimeout(showToast._timer);
      toast.classList.remove('show');
      action.onClick();
    });
    toast.appendChild(btn);
    toast.classList.add('has-action');
  }
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
  announce(message);
}

// ---------- Screen-reader announcement (invisible live region) ----------
// Announces transient feedback (toasts, view switches, search results)
// without stealing focus. Creates one shared region on first use.
function announce(message){
  if (!message) return;
  let live = document.getElementById('srLiveRegion');
  if (!live){
    live = document.createElement('div');
    live.id = 'srLiveRegion';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    live.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
    document.body.appendChild(live);
  }
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = message; });
}

// Any element with data-toast shows that message on click: shared across
// both dashboards, including rows rendered later from mock data.
function initToastTriggers(){
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-toast]');
    if (trigger) showToast(trigger.dataset.toast, trigger.dataset.toastKind);
  });
}

// ---------- Fullscreen Toggle ----------
function initFullscreenToggle(){
  const fsToggle = document.getElementById('fullscreenToggle');
  if (!fsToggle) return;
  fsToggle.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      fsToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"/></svg>`;
    } else {
      fsToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
    }
  });
}

// ---------- Sidebar: collapse on desktop, drawer on tablet/mobile ----------
// Shared state; each dashboard passes its own localStorage key so admin and
// patient remember their own collapsed state independently.
const sidebarState = {
  key: 'asdc.sidebar.collapsed',
  el: null, backdrop: null, toggle: null, closeBtn: null, desktopMQ: null,
  isCollapsed: false
};

function applyCollapsed(){
  document.body.classList.toggle('sidebar-collapsed', sidebarState.isCollapsed);
  if (sidebarState.toggle) sidebarState.toggle.setAttribute('aria-expanded', String(!sidebarState.isCollapsed));
  try { localStorage.setItem(sidebarState.key, sidebarState.isCollapsed ? '1': '0'); } catch (e) {}
}

function openSidebar(){
  if (!sidebarState.el) return;
  sidebarState.el.classList.add('open');
  if (sidebarState.backdrop) sidebarState.backdrop.classList.add('open');
  document.body.classList.add('sidebar-open');
  if (sidebarState.toggle) sidebarState.toggle.setAttribute('aria-expanded', 'true');
  if (!sidebarState.desktopMQ.matches && sidebarState.closeBtn) sidebarState.closeBtn.focus();
}

function closeSidebar(){
  if (!sidebarState.el) return;
  const wasOpen = sidebarState.el.classList.contains('open');
  sidebarState.el.classList.remove('open');
  if (sidebarState.backdrop) sidebarState.backdrop.classList.remove('open');
  document.body.classList.remove('sidebar-open');
  if (sidebarState.toggle) sidebarState.toggle.setAttribute('aria-expanded', 'false');
  if (wasOpen && !sidebarState.desktopMQ.matches && sidebarState.toggle) sidebarState.toggle.focus();
}

function initSidebar(collapseKey){
  sidebarState.key = collapseKey;
  sidebarState.el = document.getElementById('sidebar');
  if (!sidebarState.el) return;
  sidebarState.backdrop = document.getElementById('sidebarBackdrop');
  sidebarState.toggle = document.getElementById('sidebarToggle');
  sidebarState.closeBtn = document.getElementById('sidebarClose');
  sidebarState.desktopMQ = window.matchMedia('(min-width: 961px)');

  try { sidebarState.isCollapsed = localStorage.getItem(sidebarState.key) === '1'; } catch (e) {}

  if (sidebarState.toggle){
    sidebarState.toggle.addEventListener('click', () => {
      if (sidebarState.desktopMQ.matches){
        sidebarState.isCollapsed = !sidebarState.isCollapsed;
        applyCollapsed();
      } else if (sidebarState.el.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }
  if (sidebarState.closeBtn) sidebarState.closeBtn.addEventListener('click', closeSidebar);
  if (sidebarState.backdrop) sidebarState.backdrop.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });
  sidebarState.desktopMQ.addEventListener('change', () => closeSidebar());
  applyCollapsed();
}

// ---------- Destroy session and navigate ----------
// Posts to the server-side logout endpoint synchronously so the session is
// guaranteed destroyed before the redirect fires. Uses location.replace
// (not location.href) so the dashboard is removed from browser history.
function destroySessionAndRedirect(url){
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '../backend/api/auth/logout.php', false); // false = synchronous
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send();
  } catch (e) { /* best-effort: redirect even if server unreachable */ }
  window.location.replace(url);
}

// ---------- Confirm Logout ----------
// Wires the #logoutModal flow; redirectUrl is always the login page.
function initLogout(redirectUrl){
  const logoutModal = new Modal('logoutModal');
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutCancelBtn = document.getElementById('logoutCancelBtn');
  const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
  const logoutModalClose = document.getElementById('logoutModalClose');

  if (logoutBtn) logoutModal.registerTrigger(logoutBtn);
  if (logoutCancelBtn) logoutModal.registerClose(logoutCancelBtn);
  if (logoutModalClose) logoutModal.registerClose(logoutModalClose);
  if (logoutConfirmBtn){
    logoutConfirmBtn.addEventListener('click', () => {
      destroySessionAndRedirect(redirectUrl);
    });
  }
  window.__logoutModal = logoutModal;
}

// Open the logout confirm dialog from anywhere (e.g. the user menu).
function openLogoutConfirm(trigger){
  if (window.__logoutModal) window.__logoutModal.open(trigger || document.activeElement);
}

// ---------- View Public Site (destroys session first) ----------
function wirePublicSiteLinks(){
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href*="public-website"]');
    if (!link) return;
    e.preventDefault();
    destroySessionAndRedirect(link.getAttribute('href'));
  });
}

// =====================================================================
// POPOVER: anchored dropdown panels (notifications, account menu, search)
// Shared by both dashboards. Behavior:
//   - anchored to its trigger, flipped up if it would overflow the bottom
//   - clamped horizontally so it never leaves the viewport
//   - closes on outside click, Escape, or opening another popover
//   - becomes a bottom sheet on phones (<= 640px) via .popover.sheet
// =====================================================================
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function placePopover(panel, trigger){
  if (window.matchMedia('(max-width: 640px)').matches){
    panel.classList.add('sheet');
    panel.style.left = '';
    panel.style.top = '';
    return;
  }
  panel.classList.remove('sheet');
  const rect = trigger.getBoundingClientRect();
  const gap = 10;
  const width = panel.offsetWidth || 320;
  let left = rect.right - width;
  left = Math.max(gap, Math.min(left, window.innerWidth - width - gap));
  let top = rect.bottom + gap;
  if (top + panel.offsetHeight > window.innerHeight - gap){
    top = Math.max(gap, rect.top - panel.offsetHeight - gap);
  }
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
}

const Popover = {
  _open: new Map(), // panel -> trigger

  toggle(trigger, panel, opts = {}){
    if (this._open.has(panel)) return this.close(panel);
    this.closeAll();
    if (typeof opts.onOpen === 'function') opts.onOpen();
    placePopover(panel, trigger);
    panel.classList.add('open');
    this._open.set(panel, trigger);
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    const first = panel.querySelector('button, input, [href], select, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
    else { panel.tabIndex = -1; panel.focus(); }
  },

  close(panel){
    if (!this._open.has(panel)) return;
    const trigger = this._open.get(panel);
    this._open.delete(panel);
    panel.classList.remove('open');
    if (trigger){ trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }
  },

  closeAll(){
    this._open.forEach((trigger, panel) => {
      panel.classList.remove('open');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
    this._open.clear();
  }
};

document.addEventListener('click', e => {
  if (!Popover._open.size) return;
  Popover._open.forEach((trigger, panel) => {
    if (panel.contains(e.target) || (trigger && trigger.contains(e.target))) return;
    Popover.close(panel);
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && Popover._open.size) Popover.closeAll();
});
window.addEventListener('resize', () => {
  Popover._open.forEach((trigger, panel) => placePopover(panel, trigger));
});

// =====================================================================
// NOTIFICATIONS: shared mock notification panel
// Markup contract (both dashboards):
//   <button id="...trigger" aria-haspopup="true" aria-expanded="false">
//     ...<span class="badge-count" id="...badge" hidden></span>
//   </button>
//   <div class="popover" id="...panel" role="dialog" aria-label="Notifications">
//     <div class="notif-head"><h3>Notifications</h3>
//       <button class="btn-link" id="...markAll">Mark all as read</button></div>
//     <div class="notif-list" id="...list"></div>
//     <p class="notif-empty" id="...empty" hidden>You're all caught up.</p>
//   </div>
//
// Read state persistence: pass opts.storageKey (e.g. 'asdc.notif.admin')
// to keep which notifications were read in localStorage. Once read, a
// notification stays read across logout/login and page refreshes. When
// the backend lands, replace the NotifStore.load/save calls with
// fetch()/PUT against the real notifications API.
// =====================================================================
const NOTIF_ICONS = {
  appt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  pay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>',
  contract: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  promo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
};

// Tiny persistence layer: swaps out for a real notifications API later.
const NotifStore = {
  readIds(key){
    if (!key) return new Set();
    try {
      const raw = localStorage.getItem(key);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e){ return new Set(); }
  },
  saveIds(key, ids){
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(Array.from(ids))); } catch (e) {}
  }
};

function initNotifications(opts){
  const { triggerId, panelId, listId, badgeId, markAllId, emptyId, notifications, onSelect, storageKey } = opts;
  const trigger = document.getElementById(triggerId);
  const panel = document.getElementById(panelId);
  if (!trigger || !panel) return;
  const list = document.getElementById(listId);
  const badge = document.getElementById(badgeId);
  const markAll = document.getElementById(markAllId);
  const empty = document.getElementById(emptyId);

  // Read state is loaded once from storage and merged over the mock
  // defaults, so a notification that was read keeps its state no matter
  // how many times the dashboard is loaded.
  const readIds = NotifStore.readIds(storageKey);
  const items = notifications.map(n => Object.assign({}, n, { unread: n.unread && !readIds.has(n.id) }));
  const persist = () => {
    readIds.clear();
    items.forEach(n => { if (!n.unread) readIds.add(n.id); });
    NotifStore.saveIds(storageKey, readIds);
  };

  const render = () => {
    const unread = items.filter(n => n.unread).length;
    if (badge){ badge.textContent = String(unread); badge.hidden = unread === 0; }
    if (!list) return;
    list.innerHTML = '';
    if (!items.length){ if (empty) empty.hidden = false; return; }
    if (empty) empty.hidden = true;
    items.forEach(n => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'notif-item ' + (n.unread ? 'unread' : 'read');
      btn.setAttribute('aria-label', (n.unread ? 'Unread: ' : '') + n.title);
      btn.innerHTML =
        '<span class="notif-ic">' + (NOTIF_ICONS[n.kind] || NOTIF_ICONS.info) + '</span>' +
        '<span class="notif-body">' +
          '<span class="notif-title">' + escHtml(n.title) + '</span>' +
          '<span class="notif-desc">' + escHtml(n.desc || '') + '</span>' +
          '<span class="notif-time">' + escHtml(n.time) + '</span>' +
        '</span>' +
        '<span class="notif-dot" aria-hidden="true"></span>';
      btn.addEventListener('click', () => {
        if (n.unread){ n.unread = false; persist(); render(); }
        if (typeof onSelect === 'function') onSelect(n);
      });
      list.appendChild(btn);
    });
  };

  if (markAll) markAll.addEventListener('click', () => {
    items.forEach(n => { n.unread = false; });
    persist();
    render();
    showToast('All notifications marked as read');
  });

  trigger.addEventListener('click', () => Popover.toggle(trigger, panel, { onOpen: render }));
  render();
}

// =====================================================================
// BFCACHE / BACK-FORWARD PROTECTION
// When the browser restores a page from the back-forward cache (bfcache),
// JavaScript state is frozen but the session may have been destroyed.
// The pageshow event fires with persisted=true for bfcache restores;
// re-validate the session and redirect to login if it is gone.
// =====================================================================
window.addEventListener('pageshow', e => {
  if (!e.persisted) return;
  // Page was restored from bfcache — verify session is still alive.
  fetch('../backend/api/auth/me.php', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
  })
    .then(r => { if (!r.ok) throw new Error('unauthenticated'); return r.json(); })
    .then(payload => {
      if (!payload.user) throw new Error('unauthenticated');
    })
    .catch(() => { window.location.replace('../auth/login.html?error=session'); });
});

// =====================================================================
// VISIBILITY-CHANGE SESSION CHECK
// When the user returns to this tab after it was backgrounded, re-validate
// the session. This catches session expiry that happened while the user
// was on another tab or the OS had suspended the page.
// =====================================================================
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  fetch('../backend/api/auth/me.php', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
  })
    .then(r => { if (!r.ok) throw new Error('unauthenticated'); return r.json(); })
    .then(payload => {
      if (!payload.user) throw new Error('unauthenticated');
    })
    .catch(() => { window.location.replace('../auth/login.html?error=session'); });
});

// =====================================================================
// WIRE PUBLIC SITE LINKS (destroy session before navigating)
// =====================================================================
wirePublicSiteLinks();
