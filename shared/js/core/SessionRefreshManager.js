/**
 * SessionRefreshManager: Aromin-Sison Dental Clinic System.
 * Keeps the login alive ONLY while the person is really using the system,
 * and warns them 2 minutes before the 30-minute idle timeout.
 *
 * How it works, in plain words:
 *  - It watches clicks, key presses, touches and scrolling (in any open tab).
 *  - If the person did something, it tells the server "still here", at most
 *    once every 5 minutes.
 *  - If nobody did anything, it says nothing. The server then lets the session
 *    end after 30 minutes, and a warning is shown 2 minutes before.
 *  - Background auto-refresh of the dashboard does NOT count as activity.
 */
(function () {
  'use strict';

  const REFRESH_URL = '../backend/api/auth/refresh.php';

  class SessionRefreshManager {
    constructor() {
      this._timeoutMs = 30 * 60 * 1000;        // must match the server (30 minutes)
      this._warningBeforeMs = 2 * 60 * 1000;   // warn 2 minutes before
      this._refreshEveryMs = 5 * 60 * 1000;    // tell the server at most every 5 minutes
      this._tickMs = 15 * 1000;

      this._lastActivity = Date.now();   // last real action in ANY tab
      this._lastRefresh = Date.now();    // last time the server was told
      this._needsRefresh = false;        // was there activity since the last refresh?
      this._expiryChecked = false;
      this._refreshing = null;
      this._timer = null;
      this._modal = null;
      this._lastActivityStamp = 0;
    }

    init() {
      this._bindActivityListeners();
      this._listenForOtherTabs();
      this._timer = setInterval(() => this._tick(), this._tickMs);
    }

    // ---------- Activity ----------

    _bindActivityListeners() {
      ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach((name) => {
        document.addEventListener(name, () => this._onUserActivity(), { passive: true, capture: true });
      });
    }

    _onUserActivity() {
      // While the warning is open, only its buttons count (so nothing extends
      // the session by accident).
      if (this._isWarningOpen()) return;
      const now = Date.now();
      this._lastActivity = now;
      this._needsRefresh = true;
      this._expiryChecked = false;

      // Let other tabs know, but not on every single event.
      if (now - this._lastActivityStamp > 10 * 1000) {
        this._lastActivityStamp = now;
        const guard = window.ASDC && window.ASDC.sessionGuard;
        if (guard) guard.broadcastRefresh();
      }
    }

    _listenForOtherTabs() {
      // Another tab reported activity: this tab is not idle either.
      window.addEventListener('asdc:session-activity', () => {
        this._lastActivity = Date.now();
        this._expiryChecked = false;
        this._hideWarning();
      });
    }

    // ---------- Timer ----------

    _tick() {
      const now = Date.now();

      if (this._needsRefresh && now - this._lastRefresh >= this._refreshEveryMs) {
        this._refreshSession();
      }

      const idle = now - this._lastActivity;
      if (idle >= this._timeoutMs - this._warningBeforeMs && idle < this._timeoutMs && !this._isWarningOpen()) {
        this._showWarning();
      } else if (idle >= this._timeoutMs && !this._expiryChecked) {
        // The time is up. Ask the server (without counting it as activity):
        // it either confirms the session ended (login page) or restores a
        // "remember me" login.
        this._expiryChecked = true;
        this._hideWarning();
        const guard = window.ASDC && window.ASDC.sessionGuard;
        if (guard) guard.revalidate({ force: true, passive: true });
      }
    }

    // ---------- Server refresh ----------

    _postRefresh() {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (window.ASDC && window.ASDC._csrfToken) headers['X-CSRF-Token'] = window.ASDC._csrfToken;
      return fetch(REFRESH_URL, { method: 'POST', credentials: 'same-origin', headers, body: '{}' });
    }

    _refreshSession() {
      if (this._refreshing) return this._refreshing;
      this._refreshing = (async () => {
        try {
          const api = window.ASDC && window.ASDC.ApiClient;
          // Make sure we hold a CSRF token first.
          if (api && api.refreshCsrf && !window.ASDC._csrfToken) await api.refreshCsrf();

          let response = await this._postRefresh();
          if (response.status === 403 && api && api.refreshCsrf) {
            // The CSRF token was replaced (it is renewed every few hours). Get the new one and retry once.
            await api.refreshCsrf();
            response = await this._postRefresh();
          }

          if (response.ok) {
            this._lastRefresh = Date.now();
            this._needsRefresh = false;
            this._lastActivity = Date.now();
            this._expiryChecked = false;
            this._hideWarning();
            const guard = window.ASDC && window.ASDC.sessionGuard;
            if (guard) guard.broadcastRefresh();
          } else if (response.status === 401) {
            // The session already ended. Let the guard restore it (remember me) or go to login.
            const guard = window.ASDC && window.ASDC.sessionGuard;
            if (guard) guard.revalidate({ force: true });
          }
        } catch (e) {
          // Offline or server busy: try again on a later tick.
        } finally {
          this._refreshing = null;
        }
      })();
      return this._refreshing;
    }

    // ---------- Warning dialog ----------

    _ensureModal() {
      if (this._modal) return this._modal;
      let overlay = document.getElementById('sessionWarningModal');
      if (!overlay) {
        // Same look as the existing "Confirm Logout" dialog.
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'sessionWarningModal';
        overlay.hidden = true;
        overlay.innerHTML = `
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sessionWarningTitle" aria-describedby="sessionWarningText">
            <h3 id="sessionWarningTitle">Session expiring soon</h3>
            <p id="sessionWarningText">You have been inactive for a while. For your security you will be signed out in about 2 minutes.</p>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" id="sessionLogoutBtn">Log Out</button>
              <button type="button" class="btn btn-primary" id="sessionStayBtn">Stay Logged In</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
      }
      this._modal = new window.ASDC.Modal('sessionWarningModal');

      const stayBtn = document.getElementById('sessionStayBtn');
      if (stayBtn) {
        stayBtn.addEventListener('click', () => {
          this._modal.close();
          this._needsRefresh = true;
          this._refreshSession();
        });
      }
      const logoutBtn = document.getElementById('sessionLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          this._modal.close();
          if (window.openLogoutConfirm) window.openLogoutConfirm();
        });
      }
      return this._modal;
    }

    _showWarning() {
      if (!window.ASDC || !window.ASDC.Modal) return;
      this._ensureModal().open(document.activeElement);
    }

    _hideWarning() {
      if (this._modal) this._modal.close();
    }

    // The dialog can also be closed with Esc or a backdrop click, so ask the dialog itself.
    _isWarningOpen() {
      return !!(this._modal && this._modal.modal && !this._modal.modal.hidden);
    }

    // Public method to manually refresh
    refreshNow() {
      this._needsRefresh = true;
      return this._refreshSession();
    }
  }

  window.ASDC.SessionRefreshManager = SessionRefreshManager;
})();
