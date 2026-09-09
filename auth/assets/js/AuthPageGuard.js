/**
 * AuthPageGuard: Aromin-Sison Dental Clinic System.
 * Redirects authenticated users away from login/signup/forgot-password pages.
 * Handles bfcache restores and visibility changes.
 */
(function () {
  'use strict';

  class AuthPageGuard {
    static _isAuthPage() {
      return (
        !!document.getElementById('panel-login') ||
        !!document.getElementById('panel-patient-signup') ||
        !!document.getElementById('panel-forgot')
      );
    }

    static _checkAndRedirect() {
      if (!AuthPageGuard._isAuthPage()) return;

      const authShell = document.querySelector('.auth-shell');
      const api = window.ASDC.AuthApiClient;
      const destinations = api.roleDestinations;

      api
        .me()
        .then(({ response, payload }) => {
          if (payload.user && destinations[payload.user.role]) {
            if (authShell) authShell.style.visibility = 'hidden';
            window.location.replace(destinations[payload.user.role]);
          }
        })
        .catch(() => {});
    }

    static init() {
      AuthPageGuard._checkAndRedirect();

      window.addEventListener('pageshow', (e) => {
        if (e.persisted) AuthPageGuard._checkAndRedirect();
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) AuthPageGuard._checkAndRedirect();
      });
    }
  }

  window.ASDC.AuthPageGuard = AuthPageGuard;
})();
