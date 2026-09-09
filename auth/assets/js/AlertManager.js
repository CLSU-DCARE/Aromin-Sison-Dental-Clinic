/**
 * AlertManager: Aromin-Sison Dental Clinic System.
 * Shows/hides the auth alert banner and manages loading states.
 */
(function () {
  'use strict';

  class AlertManager {
    static show(message) {
      const alertBox = document.getElementById('authAlert');
      const alertText = document.getElementById('authAlertText');
      if (!alertBox) return;
      if (alertText) alertText.textContent = message;
      alertBox.hidden = false;
    }

    static hide() {
      const alertBox = document.getElementById('authAlert');
      if (alertBox) alertBox.hidden = true;
    }

    static setLoading(btn, on) {
      if (!btn) return;
      btn.disabled = on;
      btn.classList.toggle('is-loading', on);
    }
  }

  window.ASDC.AlertManager = AlertManager;
})();
