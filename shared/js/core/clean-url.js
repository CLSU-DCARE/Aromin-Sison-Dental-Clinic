/**
 * Short page addresses.
 * If someone opens a page by its old file address (for example an old bookmark
 * or an old email link), this shows the short address in the browser bar.
 * The page itself is not reloaded, and the ?query and #hash are kept.
 */
(function () {
  'use strict';
  var SHORT = {
    '/auth/login.html': '/login',
    '/auth/admin-login.html': '/admin-login',
    '/auth/forgot-password.html': '/forgot-password',
    '/auth/reset-password.html': '/reset-password',
    '/admin-system/dashboard.html': '/dashboard',
    '/admin-system/patient-chart.html': '/patient-chart',
    '/public-website/index.html': '/',
    '/public-website/about.html': '/about',
    '/public-website/dentist.html': '/dentists',
    '/public-website/services.html': '/services',
    '/public-website/gallery.html': '/gallery'
  };
  var target = SHORT[window.location.pathname];
  if (!target || !window.history || !window.history.replaceState) return;
  try {
    window.history.replaceState(window.history.state, '', target + window.location.search + window.location.hash);
  } catch (e) { /* the old address still works, so nothing to do */ }
})();
