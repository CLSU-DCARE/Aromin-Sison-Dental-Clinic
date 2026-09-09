/**
 * ApiClient: Shared fetch wrapper for all dashboard API calls.
 * Replaces duplicated _api() methods in AppointmentActions,
 * AppointmentScheduler, PatientAppointmentBooking, and PatientRescheduleModal.
 *
 * Automatically fetches and attaches CSRF tokens for state-changing requests.
 */
(function () {
  'use strict';

  var csrfToken = null;

  async function fetchCsrfToken() {
    try {
      var res = await fetch('../backend/api/auth/csrf-token.php', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        var data = await res.json();
        csrfToken = data.csrf_token || null;
        window.ASDC._csrfToken = csrfToken;
      }
    } catch (e) {
      csrfToken = null;
    }
    return csrfToken;
  }

  async function api(url, options) {
    options = options || {};
    var defaults = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
    var merged = Object.assign({}, defaults, options);
    if (options.headers) {
      merged.headers = Object.assign({}, defaults.headers, options.headers);
    }

    var method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      if (!csrfToken) {
        await fetchCsrfToken();
      }
      if (csrfToken) {
        merged.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    var response = await fetch(url, merged);
    var payload = {};
    try { payload = await response.json(); } catch (e) { /* empty */ }

    if (response.status === 403 && csrfToken && method !== 'GET') {
      await fetchCsrfToken();
      if (csrfToken) {
        merged.headers['X-CSRF-Token'] = csrfToken;
        response = await fetch(url, merged);
        payload = {};
        try { payload = await response.json(); } catch (e) { /* empty */ }
      }
    }

    if (!response.ok) {
      var msg = (payload.error && (payload.error.message || payload.error)) || 'Unable to process the request.';
      var error = new Error(msg);
      error.code = (payload.error && payload.error.code) || 'request_failed';
      throw error;
    }
    return payload.data || payload;
  }

  window.ASDC.ApiClient = { api: api, refreshCsrf: fetchCsrfToken };
  window.apiFetch = api;
})();
