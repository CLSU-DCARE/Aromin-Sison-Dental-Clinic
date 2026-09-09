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
  };

  const ROLE_DESTINATIONS = {
    dentist: '../dentist-dashboard/dashboard.html',
    receptionist: '../admin-system/dashboard.html',
    patient: '../patient-dashboard/dashboard.html',
  };

  class AuthApiClient {
    static get endpoints() {
      return ENDPOINTS;
    }

    static get roleDestinations() {
      return ROLE_DESTINATIONS;
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
          payload.error ||
          'Too many login attempts. Please wait and try again.'
        );
      if (response.status >= 500)
        return 'The clinic server is unavailable right now. Please try again shortly.';
      return (
        payload.error ||
        'Unable to sign in. Please check your details and try again.'
      );
    }

    static async login(email, password) {
      const response = await AuthApiClient.fetchWithTimeout(
        ENDPOINTS.login,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
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
        }
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
