/**
 * AuthApiClient: Aromin-Sison Dental Clinic System.
 * Handles all auth-related HTTP requests with timeout support.
 */
(function () {
  'use strict';

  const ENDPOINTS = {
    login: '../backend/api/auth/login.php',
    me: '../backend/api/auth/me.php',
    logout: '../backend/api/auth/logout.php',
    register: '../backend/api/auth/register.php',
    forgotPassword: '../backend/api/auth/forgot-password.php',
    resetPassword: '../backend/api/auth/reset-password.php',
    refresh: '../backend/api/auth/refresh.php',
    autoLogin: '../backend/api/auth/auto-login.php',
    sessions: '../backend/api/auth/sessions.php',
    sessionRevoke: '../backend/api/auth/session-revoke.php',
    sessionRevokeOthers: '../backend/api/auth/session-revoke-others.php',
  };

  class AuthApiClient {
    static get endpoints() {
      return ENDPOINTS;
    }

    static get roleDestinations() {
      return window.ASDC.Routing ? window.ASDC.Routing.ROLE_DESTINATIONS || {} : {};
    }

    static async fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    static async readJson(response) {
      try {
        return await response.json();
      } catch (e) {
        return {};
      }
    }

    static loginError(response, payload) {
      if (response.status === 401)
        return 'Invalid email address, mobile number, or password. Please try again.';
      if (response.status === 429)
        return (
          payload.error?.message ||
          payload.error ||
          'Too many login attempts. Please wait and try again.'
        );
      if (response.status >= 500)
        return 'The clinic server is unavailable right now. Please try again shortly.';
      return (
        payload.error?.message ||
        payload.error ||
        'Unable to sign in. Please check your details and try again.'
      );
    }

    // The CSRF token is only needed for requests that change things while
    // signed in. Auth pages have no session yet, so fetch one when needed.
    static async csrfHeaders(extra = {}) {
      const headers = Object.assign({ 'Content-Type': 'application/json' }, extra);
      try {
        const response = await fetch('../backend/api/auth/csrf-token.php', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (response.ok) {
          const data = await AuthApiClient.readJson(response);
          if (data.csrf_token) headers['X-CSRF-Token'] = data.csrf_token;
        }
      } catch (e) {
        // request below will simply be rejected by the server
      }
      return headers;
    }

    // Only one tab at a time may use the "remember me" cookie (when the browser supports it).
    static withTabLock(task) {
      if (navigator.locks && navigator.locks.request) {
        return navigator.locks.request('asdc-session-recover', task);
      }
      return task();
    }

    /**
     * Who is signed in? If nobody, quietly sign in from the "remember me" cookie.
     * Resolves to the user object, or null when the person really is signed out
     * (or the server could not be reached; the caller then just stays on the page).
     */
    static restoreSession() {
      return AuthApiClient.withTabLock(async () => {
        try {
          const { response, payload } = await AuthApiClient.me();
          if (response.ok && payload.user) return payload.user;
          if (response.status >= 500) return null;
          const auto = await AuthApiClient.autoLogin();
          const user = auto.payload && (auto.payload.data || auto.payload.user);
          if (auto.response.ok && user && user.role) return user;
        } catch (e) {
          // offline or timed out
        }
        return null;
      });
    }

    // Tell other open tabs that someone just signed in (they re-check who).
    static announceLogin() {
      try {
        if (window.BroadcastChannel) {
          const channel = new BroadcastChannel('asdc-auth');
          channel.postMessage({ type: 'login' });
          setTimeout(() => channel.close(), 1000);
        } else {
          localStorage.setItem('asdc:auth:event', JSON.stringify({ type: 'login', ts: Date.now() }));
        }
      } catch (e) {
        // ignore
      }
    }

    static async login(identifier, password, rememberMe = false) {
      const response = await AuthApiClient.fetchWithTimeout(
        ENDPOINTS.login,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password, remember_me: rememberMe }),
        }
      );
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    static async me() {
      const response = await AuthApiClient.fetchWithTimeout(ENDPOINTS.me, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    static async logout() {
      try {
        await fetch(ENDPOINTS.logout, {
          method: 'POST',
          credentials: 'same-origin',
          headers: await AuthApiClient.csrfHeaders(),
          body: '{}',
        });
      } catch (e) {}
    }

    static async refresh() {
      try {
        const response = await fetch(ENDPOINTS.refresh, {
          method: 'POST',
          credentials: 'same-origin',
          headers: await AuthApiClient.csrfHeaders(),
          body: '{}',
        });
        return { response, payload: await AuthApiClient.readJson(response) };
      } catch (e) {
        return { response: { ok: false }, payload: {} };
      }
    }

    // No CSRF token here: the person has no session yet. The server checks the
    // HttpOnly "remember me" cookie instead (see auto-login.php).
    static async autoLogin() {
      try {
        const response = await fetch(ENDPOINTS.autoLogin, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: '{}',
          cache: 'no-store',
        });
        return { response, payload: await AuthApiClient.readJson(response) };
      } catch (e) {
        return { response: { ok: false }, payload: {} };
      }
    }

    static async getSessions() {
      const response = await AuthApiClient.fetchWithTimeout(ENDPOINTS.sessions, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    // sessionRef is the "session_ref" value returned by getSessions() (never the real session ID).
    static async revokeSession(sessionRef) {
      const response = await AuthApiClient.fetchWithTimeout(ENDPOINTS.sessionRevoke, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: await AuthApiClient.csrfHeaders(),
        body: JSON.stringify({ session_ref: sessionRef }),
      });
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    static async revokeOtherSessions() {
      const response = await fetch(ENDPOINTS.sessionRevokeOthers, {
        method: 'POST',
        credentials: 'same-origin',
        headers: await AuthApiClient.csrfHeaders(),
        body: '{}',
      });
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    static async register(data) {
      const response = await AuthApiClient.fetchWithTimeout(
        ENDPOINTS.register,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    static async forgotPassword(email) {
      const response = await AuthApiClient.fetchWithTimeout(
        ENDPOINTS.forgotPassword,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
        30000
      );
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    static async resetPassword(token, password) {
      const response = await AuthApiClient.fetchWithTimeout(
        ENDPOINTS.resetPassword,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        }
      );
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    static isAbortError(error) {
      return error && error.name === 'AbortError';
    }

    static connectionError(isAbort) {
      return isAbort
        ? 'The clinic server took too long to respond. Please try again.'
        : 'Unable to reach the clinic server. Check your connection and try again.';
    }
  }

  window.ASDC.AuthApiClient = AuthApiClient;
})();
