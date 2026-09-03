/* Aromin-Sison Dental Clinic: Auth module. */

// ---------- Query-param overrides (for design/QA) ----------
const FORCE_STATE = new URLSearchParams(location.search).get('state');

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

// ---------- Alert banner ----------
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
  if (input.type === 'checkbox' && input.hasAttribute('required') && !input.checked){
    setFieldError(input, 'You need to agree before continuing.');
    return false;
  }

  clearFieldError(input);
  return true;
}

function validateForm(form){
  const fields = form.querySelectorAll('input[required], input[type="email"]');
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

function initLiveValidation(){
  document.querySelectorAll('.auth-panel input').forEach(input => {
    input.addEventListener('blur', () => { if (input.value.trim()) validateField(input); });
    input.addEventListener('input', () => {
      const group = input.closest('.form-group');
      if (group && group.classList.contains('has-error')) validateField(input);
    });
  });
}

// =====================================================================
// REAL SESSION LOGIN
// =====================================================================
const AUTH_ENDPOINTS = {
  login: '../backend/api/auth/login.php',
  me: '../backend/api/auth/me.php',
  logout: '../backend/api/auth/logout.php',
  forgotPassword: '../backend/api/auth/forgot-password.php',
  resetPassword: '../backend/api/auth/reset-password.php'
};

const ROLE_DESTINATIONS = {
  dentist: '../dentist-dashboard/dashboard.html',
  receptionist: '../admin-system/dashboard.html',
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

function setupModal(modalId, triggerIds = [], closeIds = []){
  const modal = new Modal(modalId);
  triggerIds.forEach(id => modal.registerTrigger(document.getElementById(id)));
  closeIds.forEach(id => modal.registerClose(document.getElementById(id)));
  return modal;
}

// ---------- Forgot Password: validate, then simulate the reset flow ----------
function wireForgotPasswordForm(form, modal){
  const btn = form.querySelector('.btn-block');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm(form)) return;

    hideAlert();
    setLoading(btn, true);
    const emailField = form.querySelector('input[type="email"]');
    try {
      const response = await fetchWithTimeout(AUTH_ENDPOINTS.forgotPassword, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailField.value.trim() })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok){
        showAlert(payload.error || 'Unable to send a reset link. Please try again.');
        return;
      }
      const titleEl = document.getElementById('recoveryModalTitle');
      const textEl = document.getElementById('recoveryModalText');
      if (titleEl) titleEl.textContent = 'Check your inbox';
      if (textEl) textEl.textContent = 'If an active account matches that email, a password reset link has been sent.';
      modal.open(btn);
    } catch (error){
      showAlert(error && error.name === 'AbortError'
        ? 'The clinic server took too long to respond. Please try again.'
        : 'Unable to reach the clinic server. Check your connection and try again.');
    } finally {
      setLoading(btn, false);
    }
  });
}

function wireResetPasswordForm(form){
  if (!form) return;
  const btn = form.querySelector('.btn-block');
  const token = new URLSearchParams(location.search).get('token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)){
    showAlert('This password reset link is invalid or incomplete. Request a new one.');
    btn.disabled = true;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm(form) || btn.disabled) return;
    hideAlert();
    setLoading(btn, true);
    try {
      const response = await fetchWithTimeout(AUTH_ENDPOINTS.resetPassword, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.elements.password.value })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok){
        showAlert(payload.error || 'Unable to reset your password. Please request a new link.');
        return;
      }
      form.hidden = true;
      const success = document.getElementById('resetSuccess');
      if (success) success.hidden = false;
    } catch (error){
      showAlert(error && error.name === 'AbortError'
        ? 'The clinic server took too long to respond. Please try again.'
        : 'Unable to reach the clinic server. Check your connection and try again.');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ---------- Force loading/error state on load, for design QA ----------
function applyForcedState(){
  if (FORCE_STATE === 'loading'){
    const btn = document.querySelector('.auth-panel:not([hidden]) .btn-block');
    setLoading(btn, true);
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();
  initLiveValidation();
  applyForcedState();
});
