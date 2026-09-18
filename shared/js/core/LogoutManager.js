/**
 * LogoutManager: Aromin-Sison Dental Clinic System.
 * Handles logout modal flow and synchronous session destruction.
 */
(function () {
  'use strict';

  class LogoutManager {
    constructor() {
      this._modal = null;
    }

    init(redirectUrl) {
      this._modal = new window.ASDC.Modal('logoutModal');
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

    _destroyAndRedirect(url) {
      try {
        var xhr = new XMLHttpRequest();
        if (window.ASDC && !window.ASDC._csrfToken) {
          xhr.open('GET', '../backend/api/auth/csrf-token.php', false);
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              window.ASDC._csrfToken = (JSON.parse(xhr.responseText) || {}).csrf_token || null;
            } catch (e) {}
          }
        }
        xhr.open('POST', '../backend/api/auth/logout.php', false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (window.ASDC && window.ASDC._csrfToken) {
          xhr.setRequestHeader('X-CSRF-Token', window.ASDC._csrfToken);
        }
        xhr.send();
      } catch (e) {}
      window.location.replace(url);
    }
  }

  window.ASDC.LogoutManager = LogoutManager;
})();
