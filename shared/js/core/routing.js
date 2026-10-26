/**
 * Unified Routing: Aromin-Sison Dental Clinic System.
 * Single source of truth for role-based routing and URL resolution.
 */

(function () {
  'use strict';

  // Short page addresses (what people see in the browser) and the real files behind them.
  // The old file addresses still open the same pages, so old bookmarks keep working.
  const CLEAN_ROUTES = {
    '/login': '/auth/login.html',
    '/admin-login': '/auth/admin-login.html',
    '/forgot-password': '/auth/forgot-password.html',
    '/reset-password': '/auth/reset-password.html',
    '/patient-login': '/auth/patient-login.html',
    '/patient-signup': '/auth/patient-signup.html',
    '/dashboard': '/admin-system/dashboard.html',
    '/patient-chart': '/admin-system/patient-chart.html',
    '/patient-dashboard': '/patient-dashboard/dashboard.html',
    '/dentist-dashboard': '/dentist-dashboard/dashboard.html',
  };

  // Turns a short address like "/dashboard" into the real file path.
  // Any other path is returned unchanged, so the checks below work for both.
  function canonicalPath(pathname) {
    const path = String(pathname || '');
    const key = path.length > 1 ? path.replace(/\/+$/, '') : path;
    return CLEAN_ROUTES[key] || path;
  }

  const ROLE_DESTINATIONS = {
    dentist: '/dashboard',
    receptionist: '/dashboard',
  };

  const ROLE_PATH_PREFIXES = {
    dentist: '/admin-system/',
    receptionist: '/admin-system/',
  };

  const LOGIN_URL = '/login';

  const Routing = {
    ROLE_DESTINATIONS,
    CLEAN_ROUTES,
    canonicalPath,
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
      pathname = canonicalPath(pathname);
      return pathname.includes('/auth/login.html') || pathname.includes('/auth/register.html') || pathname.includes('/auth/forgot-password.html') || pathname.includes('/auth/reset-password.html');
    },

    isDashboardPath(pathname) {
      pathname = canonicalPath(pathname);
      return pathname.includes('/dentist-dashboard/') || pathname.includes('/admin-system/') || pathname.includes('/patient-dashboard/');
    },

    getRoleFromPath(pathname) {
      pathname = canonicalPath(pathname);
      if (pathname.includes('/patient-dashboard/')) return 'patient';
      if (pathname.includes('/dentist-dashboard/')) return 'dentist';
      if (pathname.includes('/admin-system/')) return 'staff';
      return null;
    },

    isCorrectDashboardForRole(pathname, role) {
      pathname = canonicalPath(pathname);
      if (pathname.includes('/admin-system/') && ['dentist', 'receptionist'].includes(role)) return true;
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
      // "page" may be given as "reset-password" or "reset-password.html"
      const url = new URL('/' + String(page).replace(/^\/+/, '').replace(/\.html$/, ''), window.location.origin);
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
      window.location.replace(url.toString());
    },
  };

  window.ASDC.Routing = Routing;
})();
