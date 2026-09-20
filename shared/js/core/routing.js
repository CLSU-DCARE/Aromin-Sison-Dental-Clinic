/**
 * Unified Routing: Aromin-Sison Dental Clinic System.
 * Single source of truth for role-based routing and URL resolution.
 */

(function () {
  'use strict';

  const ROLE_DESTINATIONS = {
    dentist: '../dentist-dashboard/dashboard.html',
    receptionist: '../admin-system/dashboard.html',
    patient: '../patient-dashboard/dashboard.html',
  };

  const ROLE_PATH_PREFIXES = {
    dentist: '/dentist-dashboard/',
    receptionist: '/admin-system/',
    patient: '/patient-dashboard/',
  };

  const LOGIN_URL = '../auth/login.html';

  const Routing = {
    ROLE_DESTINATIONS,
    getDestinationForRole(role) {
      return ROLE_DESTINATIONS[role] || LOGIN_URL;
    },

    getPrefixForRole(role) {
      return ROLE_PATH_PREFIXES[role] || '';
    },

    getLoginUrl() {
      return LOGIN_URL;
    },

    isAuthPage(pathname) {
      return pathname.includes('/auth/login.html') || pathname.includes('/auth/register.html') || pathname.includes('/auth/forgot-password.html') || pathname.includes('/auth/reset-password.html');
    },

    isDashboardPath(pathname) {
      return pathname.includes('/dentist-dashboard/') || pathname.includes('/admin-system/') || pathname.includes('/patient-dashboard/');
    },

    getRoleFromPath(pathname) {
      if (pathname.includes('/patient-dashboard/')) return 'patient';
      if (pathname.includes('/dentist-dashboard/')) return 'dentist';
      if (pathname.includes('/admin-system/')) return 'receptionist';
      return null;
    },

    isCorrectDashboardForRole(pathname, role) {
      const expectedPrefix = this.getPrefixForRole(role);
      return expectedPrefix && pathname.includes(expectedPrefix);
    },

    redirectToDashboard(role) {
      const destination = this.getDestinationForRole(role);
      window.location.replace(destination);
    },

    redirectToLogin(error) {
      const url = new URL(LOGIN_URL, window.location.origin);
      if (error) {
        url.searchParams.set('error', error);
      }
      window.location.replace(url.toString());
    },

    redirectToAuthPage(page, params = {}) {
      const url = new URL('../auth/' + page, window.location.origin);
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
      window.location.replace(url.toString());
    },
  };

  window.ASDC.Routing = Routing;
})();