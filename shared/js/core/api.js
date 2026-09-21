/**
 * ApiClient: Shared fetch wrapper for all dashboard API calls.
 * Replaces duplicated _api() methods in AppointmentActions,
 * AppointmentScheduler, PatientAppointmentBooking, and PatientRescheduleModal.
 *
 * Automatically fetches and attaches CSRF tokens for state-changing requests.
 *
 * Session handling (kept simple on purpose):
 *  - If a request comes back 401 (session ended), we try ONE silent
 *    "remember me" sign-in and then repeat the request. If that fails the
 *    error is thrown as before, and the calling page sends the user to login.
 *  - Pass { passive: true } for background polling. The server then does not
 *    count the request as user activity, so an unattended screen still times out.
 */
(function () {
  'use strict';

  var csrfToken = null;
  var recovering = null;

  var ME_URL = '../backend/api/auth/me.php';
  var AUTO_LOGIN_URL = '../backend/api/auth/auto-login.php';

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

  // Run one thing at a time across ALL open tabs (when the browser supports it),
  // so two tabs never try to use the same remember-me token at the same moment.
  function withTabLock(task) {
    if (navigator.locks && navigator.locks.request) {
      return navigator.locks.request('asdc-session-recover', task);
    }
    return task();
  }

  /**
   * The session ended. Ask the server to sign us in again from the
   * "remember me" cookie (if there is one).
   * Resolves to { ok: true, user } or { ok: false, error: true|false }.
   * error === true means the server/network had trouble, NOT that the user is signed out.
   */
  function recoverSession() {
    if (recovering) return recovering;
    recovering = withTabLock(async function () {
      try {
        // Another tab may have already restored the session while we waited for our turn.
        var meRes = await fetch(ME_URL, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        if (meRes.ok) {
          var me = await meRes.json().catch(function () { return {}; });
          if (me && me.user) {
            await fetchCsrfToken();
            return { ok: true, user: me.user, restored: true };
          }
        } else if (meRes.status >= 500) {
          return { ok: false, error: true };
        }

        var res = await fetch(AUTO_LOGIN_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: '{}',
          cache: 'no-store'
        });
        if (res.ok) {
          var payload = await res.json().catch(function () { return {}; });
          var user = payload && (payload.data || payload.user);
          if (user && user.role) {
            await fetchCsrfToken(); // the new session has a new CSRF token
            return { ok: true, user: user, restored: true };
          }
        }
        return { ok: false, error: res.status >= 500 };
      } catch (e) {
        return { ok: false, error: true };
      }
    }).then(
      function (result) { recovering = null; return result; },
      function () { recovering = null; return { ok: false, error: true }; }
    );
    return recovering;
  }

  async function api(url, options) {
    options = options || {};
    var passive = !!options.passive;
    var defaults = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
    var merged = Object.assign({}, defaults, options);
    delete merged.passive;
    merged.headers = Object.assign({}, defaults.headers, options.headers || {});
    if (passive) {
      merged.headers['X-ASDC-Passive'] = '1';
    }

    var method = (options.method || 'GET').toUpperCase();
    var isWrite = method !== 'GET' && method !== 'HEAD';
    if (isWrite) {
      if (!csrfToken) {
        await fetchCsrfToken();
      }
      if (csrfToken) {
        merged.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    var response = await fetch(url, merged);

    // Session ended: try one silent sign-in from "remember me", then repeat the request once.
    if (response.status === 401) {
      var recovered = await recoverSession();
      if (recovered.ok) {
        if (isWrite && csrfToken) {
          merged.headers['X-CSRF-Token'] = csrfToken;
        }
        response = await fetch(url, merged);
      }
    }

    var payload = {};
    try { payload = await response.json(); } catch (e) { throw new Error('The server returned an invalid response. Please try again.'); }

    if (response.status === 403 && csrfToken && isWrite) {
      await fetchCsrfToken();
      if (csrfToken) {
        merged.headers['X-CSRF-Token'] = csrfToken;
        response = await fetch(url, merged);
        payload = {};
        try { payload = await response.json(); } catch (e) { /* empty */ }
      }
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.keys(payload).length) {
      throw new Error('The server returned an invalid response. Please try again.');
    }
    if (!response.ok || payload.success === false) {
      var msg = (payload.error && (payload.error.message || payload.error)) || 'Unable to process the request.';
      var error = new Error(msg);
      error.status = response.status;
      error.code = (payload.error && payload.error.code) || 'request_failed';
      throw error;
    }
    if (isWrite && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('asdc:mutation', { detail: { url: url } }));
    }
    return payload.data || payload;
  }

  window.ASDC.ApiClient = { api: api, refreshCsrf: fetchCsrfToken, recoverSession: recoverSession };
  window.apiFetch = api;
})();
