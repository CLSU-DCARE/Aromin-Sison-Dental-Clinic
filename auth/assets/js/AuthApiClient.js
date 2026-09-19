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
        return 'Invalid email or password. Please try again.';
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

    static async login(email, password, rememberMe = false) {
      const response = await AuthApiClient.fetchWithTimeout(
        ENDPOINTS.login,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, remember_me: rememberMe }),
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
        var headers = { 'Content-Type': 'application/json' };
        if (window.ASDC && window.ASDC._csrfToken) {
          headers['X-CSRF-Token'] = window.ASDC._csrfToken;
        }
        await fetch(ENDPOINTS.logout, {
          method: 'POST',
          credentials: 'same-origin',
          headers: headers
        });
      } catch (e) {}
    }

    static async refresh() {
      try {
        var headers = { 'Content-Type': 'application/json' };
        if (window.ASDC && window.ASDC._csrfToken) {
          headers['X-CSRF-Token'] = window.ASDC._csrfToken;
        }
        const response = await fetch(ENDPOINTS.refresh, {
          method: 'POST',
          credentials: 'same-origin',
          headers: headers
        });
        return { response, payload: await AuthApiClient.readJson(response) };
      } catch (e) {
        return { response: { ok: false }, payload: {} };
      }
    }

    static async autoLogin() {
      try {
        var headers = { 'Content-Type': 'application/json' };
        if (window.ASDC && window.ASDC._csrfToken) {
          headers['X-CSRF-Token'] = window.ASDC._csrfToken;
        }
        const response = await fetch(ENDPOINTS.autoLogin, {
          method: 'POST',
          credentials: 'same-origin',
          headers: headers
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

    static async revokeSession(sessionId) {
      const response = await AuthApiClient.fetchWithTimeout(ENDPOINTS.sessionRevoke, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const payload = await AuthApiClient.readJson(response);
      return { response, payload };
    }

    static async revokeOtherSessions() {
      var headers = { 'Content-Type': 'application/json' };
      if (window.ASDC && window.ASDC._csrfToken) {
        headers['X-CSRF-Token'] = window.ASDC._csrfToken;
      }
      const response = await fetch(ENDPOINTS.sessionRevokeOthers, {
        method: 'POST',
        credentials: 'same-origin',
        headers: headers
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
