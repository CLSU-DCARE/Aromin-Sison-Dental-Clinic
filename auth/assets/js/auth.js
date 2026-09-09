/* Aromin-Sison Dental Clinic: Auth module.
   Delegates to OOP classes: AuthApiClient, FormValidator, PasswordToggle,
   AuthPageGuard, AlertManager, and ASDC.Modal (from shared core).
   Global functions kept for backward compatibility with HTML inline scripts. */

// ---------- Query-param overrides (for design/QA) ----------
const FORCE_STATE = new URLSearchParams(location.search).get('state');

// ---------- Backward-compatible globals (delegate to classes) ----------
function eyeIcon() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
}
function eyeOffIcon() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.7 21.7 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}

function initPasswordToggles() { ASDC.PasswordToggle.init(); }
function showAlert(message) { ASDC.AlertManager.show(message); }
function hideAlert() { ASDC.AlertManager.hide(); }
function setFieldError(inputEl, message) { ASDC.FormValidator.setFieldError(inputEl, message); }
function clearFieldError(inputEl) { ASDC.FormValidator.clearFieldError(inputEl); }
function setLoading(btn, on) { ASDC.AlertManager.setLoading(btn, on); }
function validateField(input) { return ASDC.FormValidator.validateField(input); }
function validateForm(form) { return ASDC.FormValidator.validateForm(form); }
function initLiveValidation() { ASDC.FormValidator.initLiveValidation(); }

function readJsonResponse(response) { return ASDC.AuthApiClient.readJson(response); }
function fetchWithTimeout(url, options, timeoutMs) { return ASDC.AuthApiClient.fetchWithTimeout(url, options, timeoutMs); }
function loginErrorMessage(response, payload) { return ASDC.AuthApiClient.loginError(response, payload); }

const AUTH_ENDPOINTS = ASDC.AuthApiClient.endpoints;
const ROLE_DESTINATIONS = ASDC.AuthApiClient.roleDestinations;

// =====================================================================
// LOGIN FORM
// =====================================================================
function initLoginForm(form) {
  if (!form) return;
  const btn = form.querySelector('.btn-block');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm(form)) return;

    hideAlert();
    setLoading(btn, true);

    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');

    try {
      const { response, payload } = await ASDC.AuthApiClient.login(email, password);
      if (!response.ok) {
        showAlert(loginErrorMessage(response, payload));
        return;
      }

      const meResult = await ASDC.AuthApiClient.me();
      const user = meResult.payload.user;
      const destination = user && ROLE_DESTINATIONS[user.role];
      if (!meResult.response.ok || !destination) {
        await ASDC.AuthApiClient.logout();
        showAlert('Your account session could not be verified. Please sign in again.');
        return;
      }

      window.location.replace(destination);
    } catch (error) {
      showAlert(ASDC.AuthApiClient.connectionError(ASDC.AuthApiClient.isAbortError(error)));
    } finally {
      setLoading(btn, false);
    }
  });
}

// =====================================================================
// REUSABLE MODAL — ASDC.Modal (from shared core)
// =====================================================================
function setupModal(modalId, triggerIds = [], closeIds = []) {
  const modal = new Modal(modalId);
  triggerIds.forEach(id => modal.registerTrigger(document.getElementById(id)));
  closeIds.forEach(id => modal.registerClose(document.getElementById(id)));
  return modal;
}

// =====================================================================
// FORGOT PASSWORD
// =====================================================================
function wireForgotPasswordForm(form, modal) {
  const btn = form.querySelector('.btn-block');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm(form)) return;

    hideAlert();
    setLoading(btn, true);
    const emailField = form.querySelector('input[type="email"]');
    try {
      const { response, payload } = await ASDC.AuthApiClient.forgotPassword(emailField.value.trim());
      if (!response.ok) {
        showAlert(payload.error || 'Unable to send a reset link. Please try again.');
        return;
      }
      const titleEl = document.getElementById('recoveryModalTitle');
      const textEl = document.getElementById('recoveryModalText');
      if (titleEl) titleEl.textContent = 'Check your inbox';
      if (textEl) textEl.textContent = 'If an active account matches that email, a password reset link has been sent.';
      modal.open(btn);
    } catch (error) {
      showAlert(ASDC.AuthApiClient.connectionError(ASDC.AuthApiClient.isAbortError(error)));
    } finally {
      setLoading(btn, false);
    }
  });
}

// =====================================================================
// RESET PASSWORD
// =====================================================================
function wireResetPasswordForm(form) {
  if (!form) return;
  const btn = form.querySelector('.btn-block');
  const token = new URLSearchParams(location.search).get('token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    showAlert('This password reset link is invalid or incomplete. Request a new one.');
    btn.disabled = true;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm(form) || btn.disabled) return;
    hideAlert();
    setLoading(btn, true);
    try {
      const { response, payload } = await ASDC.AuthApiClient.resetPassword(token, form.elements.password.value);
      if (!response.ok) {
        showAlert(payload.error || 'Unable to reset your password. Please request a new link.');
        return;
      }
      form.hidden = true;
      const success = document.getElementById('resetSuccess');
      if (success) success.hidden = false;
    } catch (error) {
      showAlert(ASDC.AuthApiClient.connectionError(ASDC.AuthApiClient.isAbortError(error)));
    } finally {
      setLoading(btn, false);
    }
  });
}

// =====================================================================
// AUTHENTICATED-USER GUARD — ASDC.AuthPageGuard
// =====================================================================
function guardAuthPages() { ASDC.AuthPageGuard.init(); }

// ---------- Force loading/error state on load, for design QA ----------
function applyForcedState() {
  if (FORCE_STATE === 'loading') {
    const btn = document.querySelector('.auth-panel:not([hidden]) .btn-block');
    setLoading(btn, true);
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  guardAuthPages();
  initPasswordToggles();
  initLiveValidation();
  applyForcedState();
});
