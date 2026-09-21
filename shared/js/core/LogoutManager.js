/**
 * LogoutManager: Aromin-Sison Dental Clinic System.
 * Handles the logout dialog and makes sure the server session is REALLY ended
 * before the person is sent to the login page.
 * Other open tabs are told to leave only after the server confirms the logout.
 */
(function () {
  'use strict';

  const LOGOUT_URL = '../backend/api/auth/logout.php';

  class LogoutManager {
    constructor() {
      this._modal = null;
      this._sessionGuard = null;
      this._busy = false;
    }

    init(redirectUrl) {
      this._modal = new window.ASDC.Modal('logoutModal');
      // Use the page's shared guard so there is only one BroadcastChannel per tab.
      this._sessionGuard = window.ASDC.sessionGuard || new window.ASDC.SessionGuard();
      const logoutBtn = document.getElementById('logoutBtn');
      const cancelBtn = document.getElementById('logoutCancelBtn');
      const confirmBtn = document.getElementById('logoutConfirmBtn');
      const closeBtn = document.getElementById('logoutModalClose');

      if (logoutBtn) this._modal.registerTrigger(logoutBtn);
      if (cancelBtn) this._modal.registerClose(cancelBtn);
      if (closeBtn) this._modal.registerClose(closeBtn);
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          this._destroyAndRedirect(redirectUrl);
        });
      }
    }

    open(trigger) {
      if (this._modal)
        this._modal.open(trigger || document.activeElement);
    }

    // One logout request. Uses a fresh CSRF token every time, because the one
    // kept in memory can be out of date (the server renews it every few hours).
    async _requestLogout() {
      const api = window.ASDC && window.ASDC.ApiClient;
      const send = async () => {
        const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
        if (window.ASDC && window.ASDC._csrfToken) headers['X-CSRF-Token'] = window.ASDC._csrfToken;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
          return await fetch(LOGOUT_URL, {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: '{}',
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      };

      if (api && api.refreshCsrf) await api.refreshCsrf();
      let response = await send();
      if (response.status === 403 && api && api.refreshCsrf) {
        await api.refreshCsrf();
        response = await send();
      }
      return response.ok;
    }

    async _destroyAndRedirect(url) {
      if (this._busy) return;
      this._busy = true;
      const confirmBtn = document.getElementById('logoutConfirmBtn');
      if (confirmBtn) confirmBtn.disabled = true;

      let ended = false;
      try {
        ended = await this._requestLogout();
      } catch (e) {
        ended = false;
      }

      if (!ended) {
        // Never pretend to be logged out when the server still has the session.
        this._busy = false;
        if (confirmBtn) confirmBtn.disabled = false;
        if (window.showToast) {
          window.showToast('Could not log out. Check your connection and try again.', 'error');
        }
        return;
      }

      // The server session is gone, so it is now safe to tell the other tabs.
      if (this._sessionGuard && this._sessionGuard.broadcastLogout) {
        this._sessionGuard.broadcastLogout();
      }
      window.ASDCAuthUser = null;
      window.location.replace(url);
    }
  }

  window.ASDC.LogoutManager = LogoutManager;
})();
