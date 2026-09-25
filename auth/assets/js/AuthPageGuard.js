/**
 * AuthPageGuard: Aromin-Sison Dental Clinic System.
 * Redirects authenticated users away from login/signup/forgot-password pages.
 * Handles bfcache restores and visibility changes.
 * Uses unified routing.
 */
(function () {
  'use strict';

  class AuthPageGuard {
    static _isAuthPage() {
      return (
        !!document.getElementById('panel-login') ||
        !!document.getElementById('panel-patient-signup') ||
        !!document.getElementById('panel-forgot') ||
        !!document.getElementById('panel-reset')
      );
    }

    static _checkAndRedirect() {
      if (!AuthPageGuard._isAuthPage()) return;

      const authShell = document.querySelector('.auth-shell');
      const api = window.ASDC.AuthApiClient;
      const routing = window.ASDC.Routing;

      // Signed in already (or restorable from "remember me")? Then there is
      // nothing to do on a login page: go to the right dashboard.
      api
        .restoreSession()
        .then((user) => {
          if (user && routing && routing.getDestinationForRole) {
            const destination = routing.getDestinationForRole(user.role);
            if (destination && destination !== routing.getLoginUrl()) {
              if (authShell) authShell.style.visibility = 'hidden';
              window.location.replace(destination);
            }
          }
        })
        .catch(() => {});
    }

    static init() {
      // Add cache-control meta tag for auth pages to prevent bfcache issues
      if (!document.querySelector('meta[http-equiv="Cache-Control"]')) {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Cache-Control';
        meta.content = 'no-store, must-revalidate';
        document.head.appendChild(meta);
      }

      AuthPageGuard._checkAndRedirect();

      window.addEventListener('pageshow', (e) => {
        if (e.persisted) AuthPageGuard._checkAndRedirect();
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) AuthPageGuard._checkAndRedirect();
      });

      // Someone signed in from another tab: this login page is no longer needed.
      if (window.BroadcastChannel) {
        try {
          const channel = new BroadcastChannel('asdc-auth');
          channel.onmessage = (event) => {
            if (event.data && event.data.type === 'login') AuthPageGuard._checkAndRedirect();
          };
        } catch (e) {
          // not supported
        }
      }
      window.addEventListener('storage', (e) => {
        if (e.key === 'asdc:auth:event' && e.newValue) AuthPageGuard._checkAndRedirect();
      });
    }
  }

  window.ASDC.AuthPageGuard = AuthPageGuard;
})();