/* Aromin-Sison Dental Clinic: Auth module.
   Login uses the PHP session API. Forgot-password remains a deferred mock
   until the reset-token and mail workflow is implemented. */

// ---------- Query-param overrides (for design/QA + deep links) ----------
// ?role=patient | staff -> skip straight to that login form.
// ?state=loading remains available for the deferred forgot-password mock.
const FORCE_STATE = new URLSearchParams(location.search).get('state');

// Copy shown in the left brand panel. Keyed by "step": role-select screen,
// each patient sub-tab, and staff: so the panel always reflects exactly
// what the person is looking at.
const ASIDE_CONTENT = {
  role: {
    eyebrow: 'Sign In',
    title: 'Kumusta!<br>Saan ka <em>papunta</em>?',
    quote: '&ldquo;The Lord is righteous in all his ways and faithful in all he does.&rdquo; &mdash; Psalm 145:17'
  },
  patient: {
    eyebrow: 'Chapter Six: Welcome Back',
    title: 'Kumusta,<br>ngiti <em>ka</em> muli.',
    quote: '&ldquo;The Lord is righteous in all his ways and faithful in all he does.&rdquo; &mdash; Psalm 145:17'
  },
  staff: {
    eyebrow: 'Staff & Clinician Access',
    title: 'The desk<br>behind the <em>smile</em>.',
    quote: 'Everything the front desk and clinical team need to run the day: patients, schedules, and records, in one place.'
  },
  recover: {
    eyebrow: 'Account Recovery',
    title: 'Kumusta,<br>let&rsquo;s get you <em>back in</em>.',
    quote: '&ldquo;The Lord is righteous in all his ways and faithful in all he does.&rdquo; &mdash; Psalm 145:17'
  }
};

function setAside(key, animate = true){
  const content = ASIDE_CONTENT[key];
  if (!content) return;
  const eyebrow = document.getElementById('asideEyebrow');
  const title = document.getElementById('asideTitle');
  const quote = document.getElementById('asideQuote');
  const swap = () => {
    if (eyebrow) eyebrow.textContent = content.eyebrow;
    if (title) title.innerHTML = content.title;
    if (quote) quote.innerHTML = content.quote;
  };
  if (animate && title){
    title.style.opacity = 0; quote.style.opacity = 0;
    setTimeout(() => { swap(); title.style.opacity = 1; quote.style.opacity = 1; }, 140);
  } else swap();
}

// ---------- Generic sliding tab indicator (reused by role tabs + login/register tabs) ----------
function moveIndicator(indicator, tab){
  if (!indicator || !tab) return;
  indicator.style.left = tab.offsetLeft + 'px';
  indicator.style.width = tab.offsetWidth + 'px';
}

// ---------- Step transition: role-select <-> login/register form ----------
function switchStep(fromEl, toEl, after){
  if (!fromEl || !toEl){ if (after) after(); return; }
  fromEl.classList.add('step-leave');
  setTimeout(() => {
    fromEl.hidden = true;
    fromEl.classList.remove('step-leave');
    toEl.hidden = false;
    toEl.classList.add('step-enter');
    requestAnimationFrame(() => toEl.classList.remove('step-enter'));
    if (after) after();
  }, 180);
}

function focusHeading(id){
  const el = document.getElementById(id);
  if (el) requestAnimationFrame(() => el.focus());
}

function updateRoleParam(role){
  const url = new URL(location.href);
  if (role) url.searchParams.set('role', role);
  else url.searchParams.delete('role');
  history.replaceState(null, '', url);
}

// ---------- Unified role-select + form flow ----------
function initRoleFlow(){
  const stepRole = document.getElementById('step-role');
  const stepForm = document.getElementById('step-form');
  if (!stepRole || !stepForm) return; // not on the unified page

  const roleTabs = document.querySelectorAll('.role-tab');
  const roleIndicator = document.querySelector('.role-tab-indicator');
  const sectionPatient = document.getElementById('section-patient');
  const sectionStaff = document.getElementById('section-staff');

  function showRoleSection(role, {animate = true} = {}){
    roleTabs.forEach(t => {
      const active = t.dataset.role === role;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true': 'false');
      if (active) moveIndicator(roleIndicator, t);
    });
    if (sectionPatient) sectionPatient.hidden = role !== 'patient';
    if (sectionStaff) sectionStaff.hidden = role !== 'staff';
    setAside(role, animate);
    hideAlert();
    focusHeading(role === 'patient' ? 'patientFormHeading': 'staffFormHeading');
  }

  function goToForm(role, {animate = true} = {}){
    updateRoleParam(role);
    if (animate) switchStep(stepRole, stepForm, () => showRoleSection(role, {animate: true}));
    else { stepRole.hidden = true; stepForm.hidden = false; showRoleSection(role, {animate: false}); }
  }

  function goToRoleSelect(){
    updateRoleParam(null);
    switchStep(stepForm, stepRole, () => {
      hideAlert();
      focusHeading('roleHeading');
    });
  }

  document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', () => goToForm(card.dataset.role));
  });
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => showRoleSection(tab.dataset.role));
  });
  // WAI-ARIA tabs pattern: Left/Right arrows move between tabs and
  // activate the one you land on.
  const roleTabList = Array.from(roleTabs);
  roleTabList.forEach((tab, i) => {
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = roleTabList[(i + (e.key === 'ArrowRight' ? 1: roleTabList.length - 1)) % roleTabList.length];
      next.focus();
      next.click();
    });
  });
  const backBtn = document.getElementById('backToRoleBtn');
  if (backBtn) backBtn.addEventListener('click', goToRoleSelect);

  window.addEventListener('resize', () => {
    const active = document.querySelector('.role-tab.active');
    if (active) moveIndicator(roleIndicator, active);
  });

  // Escape returns to role-select from the form step (only when no modal is open)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (Modal.anyOpen() || stepForm.hidden) return;
    goToRoleSelect();
  });

  // Deep link: ?role=patient or ?role=staff skips the role-select screen
  const requestedRole = new URLSearchParams(location.search).get('role');
  if (requestedRole === 'patient' || requestedRole === 'staff'){
    goToForm(requestedRole, {animate: false});
  } else {
    setAside('role', false);
  }
}

// ---------- Password show/hide ----------
function initPasswordToggles(){
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    const input = btn.parentElement.querySelector('input');
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text': 'password';
      btn.setAttribute('aria-label', show ? 'Hide password': 'Show password');
      btn.setAttribute('aria-pressed', show ? 'true': 'false');
      btn.innerHTML = show ? eyeOffIcon(): eyeIcon();
    });
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = eyeIcon();
  });
}
function eyeIcon(){
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
}
function eyeOffIcon(){
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.7 21.7 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}

// ---------- Alert banner (role-level: wrong credentials, network error, etc.) ----------
function showAlert(message){
  const alertBox = document.getElementById('authAlert');
  const alertText = document.getElementById('authAlertText');
  if (!alertBox) return;
  if (alertText) alertText.textContent = message;
  alertBox.hidden = false;
}
function hideAlert(){
  const alertBox = document.getElementById('authAlert');
  if (alertBox) alertBox.hidden = true;
}

// ---------- Field-level error ----------
// The error message is linked to its input (aria-describedby) and the
// input is marked aria-invalid, so screen readers announce both the
// failure and where it happened.
function setFieldError(inputEl, message){
  const group = inputEl.closest('.form-group');
  if (!group) return;
  group.classList.add('has-error');
  const err = group.querySelector('.field-error');
  if (err){
    err.textContent = message;
    err.id = err.id || (inputEl.id + '-error');
    inputEl.setAttribute('aria-invalid', 'true');
    inputEl.setAttribute('aria-describedby', err.id);
  }
}
function clearFieldError(inputEl){
  const group = inputEl.closest('.form-group');
  if (group) group.classList.remove('has-error');
  inputEl.removeAttribute('aria-invalid');
  inputEl.removeAttribute('aria-describedby');
}

// ---------- Loading state on a submit button ----------
function setLoading(btn, on){
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle('is-loading', on);
}

// =====================================================================
// VALIDATION LAYER
// Polished, inline, real-time field validation: replaces the browser's
// native validation bubbles with branded messaging. This is presentation
// only; the backend must re-validate everything server-side later.
// =====================================================================
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateField(input){
  const value = input.value.trim();

  if (input.hasAttribute('required') && !value){
    setFieldError(input, 'Please fill out this field.');
    return false;
  }
  if (input.type === 'email' && value && !EMAIL_RE.test(value)){
    setFieldError(input, 'Please enter a valid email address.');
    return false;
  }
  if (input.id === 'registerPassword' && value && value.length < 8){
    setFieldError(input, 'Password must be at least 8 characters.');
    return false;
  }
  if (input.id === 'registerConfirm'){
    const pw = document.getElementById('registerPassword');
    if (value && pw && value !== pw.value){
      setFieldError(input, "Passwords don't match.");
      return false;
    }
  }
  if (input.type === 'checkbox' && input.hasAttribute('required') && !input.checked){
    setFieldError(input, 'You need to agree before continuing.');
    return false;
  }

  clearFieldError(input);
  return true;
}

// Validates every relevant field in a form; returns true only if all pass.
// Focuses the first invalid field so keyboard/screen-reader users land
// exactly where they need to.
function validateForm(form){
  const fields = form.querySelectorAll('input[required], input[type="email"], #registerPassword, #registerConfirm');
  let firstInvalid = null;
  let allValid = true;
  fields.forEach(field => {
    const ok = validateField(field);
    if (!ok){
      allValid = false;
      if (!firstInvalid) firstInvalid = field;
    }
  });
  if (firstInvalid) firstInvalid.focus();
  return allValid;
}

// Live feedback: clear/re-check a field as the person types or leaves it.
function initLiveValidation(){
  document.querySelectorAll('.auth-panel input, #panel-admin-login input').forEach(input => {
    input.addEventListener('blur', () => { if (input.value.trim()) validateField(input); });
    input.addEventListener('input', () => {
      const group = input.closest('.form-group');
      if (group && group.classList.contains('has-error')) validateField(input);
    });
  });
}

// ---------- Real session login ----------
const AUTH_ENDPOINTS = {
  login: '../backend/api/auth/login.php',
  me: '../backend/api/auth/me.php',
  logout: '../backend/api/auth/logout.php'
};

const ROLE_DESTINATIONS = {
  admin: '../admin-system/dashboard.html',
  staff: '../admin-system/dashboard.html',
  dentist: '../admin-system/dashboard.html',
  patient: '../patient-dashboard/dashboard.html'
};

async function readJsonResponse(response){
  try { return await response.json(); }
  catch (e){ return {}; }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000){
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function loginErrorMessage(response, payload){
  if (response.status === 401) return 'Invalid email or password. Please try again.';
  if (response.status === 429) return payload.error || 'Too many login attempts. Please wait and try again.';
  if (response.status >= 500) return 'The clinic server is unavailable right now. Please try again shortly.';
  return payload.error || 'Unable to sign in. Please check your details and try again.';
}

function initLoginForm(form){
  if (!form) return;
  const btn = form.querySelector('.btn-block');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    if (!validateForm(form)) return;

    hideAlert();
    setLoading(btn, true);

    const data = new FormData(form);
    const credentials = {
      email: String(data.get('email') || '').trim(),
      password: String(data.get('password') || '')
    };

    try {
      const loginResponse = await fetchWithTimeout(AUTH_ENDPOINTS.login, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const loginPayload = await readJsonResponse(loginResponse);
      if (!loginResponse.ok){
        showAlert(loginErrorMessage(loginResponse, loginPayload));
        return;
      }

      const meResponse = await fetchWithTimeout(AUTH_ENDPOINTS.me, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });
      const mePayload = await readJsonResponse(meResponse);
      const user = mePayload.user;
      const destination = user && ROLE_DESTINATIONS[user.role];
      if (!meResponse.ok || !destination){
        await fetch(AUTH_ENDPOINTS.logout, { method: 'POST', credentials: 'same-origin' }).catch(() => {});
        showAlert('Your account session could not be verified. Please sign in again.');
        return;
      }

      window.location.assign(destination);
    } catch (error){
      showAlert(error && error.name === 'AbortError'
        ? 'The clinic server took too long to respond. Please try again.'
        : 'Unable to reach the clinic server. Check your connection and try again.');
    } finally {
      setLoading(btn, false);
    }
  });
}

// =====================================================================
// REUSABLE MODAL COMPONENT
// One class, used by every dialog on every auth page. Guards against
// being wired up twice on the same element, traps focus while open, and
// closes via ×, OK/close buttons, Escape, or backdrop click: all paths
// converge on the same close() so state can never get out of sync.
// =====================================================================
class Modal {
  constructor(modalId){
    const existing = Modal._registry.get(modalId);
    if (existing) return existing; // never wire the same modal twice

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
    if (this.modal.hidden === false) return; // already open
    this.lastTrigger = trigger || document.activeElement;
    this.modal.hidden = false;
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', this._onKeydown);
    const focusable = this._focusable();
    if (focusable.length) focusable[0].focus();
  }

  close(){
    if (this.modal.hidden) return; // already closed
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

// One-line helper: get-or-create a Modal, wire up any number of triggers
// and close-buttons in one call. Safe to call more than once: subsequent
// calls just add more triggers to the same underlying instance.
function setupModal(modalId, triggerIds = [], closeIds = []){
  const modal = new Modal(modalId);
  triggerIds.forEach(id => modal.registerTrigger(document.getElementById(id)));
  closeIds.forEach(id => modal.registerClose(document.getElementById(id)));
  return modal;
}

// ---------- Forgot Password: validate, then simulate the reset flow ----------
// The mock keeps the full journey alive: valid email -> loading -> success
// dialog (echoing the email, like the real mail step would). The dialog
// never appears on page load; it only opens after a real submit attempt
// with a valid-looking email.
function wireForgotPasswordForm(form, modal){
  const btn = form.querySelector('.btn-block');
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm(form)) return;

    hideAlert();
    setLoading(btn, true);

    // TODO(backend): replace with a real request to POST /api/auth/{role}/forgot-password
    setTimeout(() => {
      setLoading(btn, false);
      const emailField = form.querySelector('input[type="email"]');
      const email = emailField ? emailField.value.trim(): '';
      const titleEl = document.getElementById('recoveryModalTitle');
      const textEl = document.getElementById('recoveryModalText');
      if (titleEl) titleEl.textContent = 'Check your inbox';
      if (textEl){
        textEl.textContent = email
          ? 'We\'ve sent a password reset link to ' + email + '. This demo doesn\'t send real mail — the reset link would arrive there in the live system.'
          : 'We\'ve sent a password reset link to your email. This demo doesn\'t send real mail — the reset link would arrive there in the live system.';
      }
      modal.open(btn);
    }, 700);
  });
}

// ---------- Force loading/error state on load, for design QA ----------
function applyForcedState(){
  if (FORCE_STATE === 'loading'){
    const btn = document.querySelector('.auth-panel:not([hidden]) .btn-block');
    setLoading(btn, true);
  }
}

// ---------- Back to the public website ----------
// Links pointing at the public site (logo + "Back to website") navigate
// immediately: no exit transition on this page. The public homepage runs
// its own entrance animation on load, so the handoff stays smooth without
// any cross-page synchronization.

document.addEventListener('DOMContentLoaded', () => {
  initRoleFlow();
  initPasswordToggles();
  initLiveValidation();
  applyForcedState();
});
