/**
 * SessionRefreshManager: Aromin-Sison Dental Clinic System.
 * Handles sliding session refresh (every 10 min) and 2-min warning modal.
 * Uses existing modal system.
 */
(function () {
  'use strict';

  class SessionRefreshManager {
    constructor() {
      this._refreshInterval = null;
      this._warningShown = false;
      this._checkInterval = null;
      this._lastKnownActivity = Date.now();
      this._refreshEndpoint = '../backend/api/auth/refresh.php';
      this._refreshIntervalMs = 10 * 60 * 1000; // 10 minutes
      this._checkIntervalMs = 30 * 1000; // 30 seconds
    }

    init() {
      // Get timeout config from backend if available
      this._loadSessionConfig();

      // Start periodic refresh
      this._startPeriodicRefresh();

      // Start session expiry check
      this._startExpiryCheck();

      // Listen for user activity to reset warning
      this._bindActivityListeners();

      // Listen for broadcast refresh from other tabs
      this._listenForBroadcasts();
    }

    _loadSessionConfig() {
      // Try to get timeout from session guard if available
      if (window.ASDC && window.ASDC.SessionGuard) {
        // Config will be loaded via /me endpoint or we use defaults
      }
      // Defaults: 30 min timeout, 2 min warning
      this._timeoutMs = 30 * 60 * 1000;
      this._warningBeforeMs = 2 * 60 * 1000;
    }

    _startPeriodicRefresh() {
      // Refresh session every 10 minutes
      this._refreshInterval = setInterval(() => {
        this._refreshSession();
      }, this._refreshIntervalMs);

      // Also refresh on window focus (user returns to tab)
      window.addEventListener('focus', () => {
        this._refreshSession();
      });
    }

    _startExpiryCheck() {
      // Check session expiry every 30 seconds
      this._checkInterval = setInterval(() => {
        this._checkExpiry();
      }, this._checkIntervalMs);
    }

    _checkExpiry() {
      // We can't directly access server-side last_activity from frontend
      // But we can track local activity and estimate
      const now = Date.now();
      const timeSinceActivity = now - this._lastKnownActivity;

      if (timeSinceActivity >= this._timeoutMs - this._warningBeforeMs &&
          timeSinceActivity < this._timeoutMs &&
          !this._warningShown) {
        this._showWarningModal();
      } else if (timeSinceActivity >= this._timeoutMs) {
        // Session likely expired, let SessionGuard handle redirect
        this._warningShown = false;
      }
    }

    _bindActivityListeners() {
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
      events.forEach(event => {
        document.addEventListener(event, () => this._onUserActivity(), { passive: true });
      });
    }

    _onUserActivity() {
      this._lastKnownActivity = Date.now();
      this._warningShown = false;
    }

    _listenForBroadcasts() {
      if (!window.BroadcastChannel) return;
      try {
        const channel = new BroadcastChannel('asdc-auth');
        channel.onmessage = (event) => {
          if (event.data && event.data.type === 'refresh' && event.data.timestamp) {
            this._lastKnownActivity = event.data.timestamp;
            this._warningShown = false;
          }
        };
      } catch (e) {
        // Ignore
      }
    }

    async _refreshSession() {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (window.ASDC && window.ASDC._csrfToken) {
          headers['X-CSRF-Token'] = window.ASDC._csrfToken;
        }
        const response = await fetch(this._refreshEndpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: headers
        });

        if (response.ok) {
          this._lastKnownActivity = Date.now();
          this._warningShown = false;
          // Broadcast refresh to other tabs
          this._broadcastRefresh();
        } else if (response.status === 401 || response.status === 403) {
          // Session invalid, stop refresh
          this._stopAll();
        }
      } catch (e) {
        // Network error, will retry on next interval
      }
    }

    _broadcastRefresh() {
      if (!window.BroadcastChannel) return;
      try {
        const channel = new BroadcastChannel('asdc-auth');
        channel.postMessage({ type: 'refresh', timestamp: Date.now() });
      } catch (e) {
        // Ignore
      }
    }

    _showWarningModal() {
      this._warningShown = true;

      // Use existing modal system
      if (!window.ASDC.Modal) return;

      // Create or find warning modal
      let modalEl = document.getElementById('sessionWarningModal');
      if (!modalEl) {
        modalEl = this._createWarningModal();
        document.body.appendChild(modalEl);
      }

      const modal = new window.ASDC.Modal('sessionWarningModal');

      // Wire up "Stay logged in" button
      const stayBtn = document.getElementById('sessionStayBtn');
      if (stayBtn) {
        stayBtn.onclick = () => {
          modal.close();
          this._refreshSession();
        };
      }

      // Wire up "Log out" button
      const logoutBtn = document.getElementById('sessionLogoutBtn');
      if (logoutBtn) {
        logoutBtn.onclick = () => {
          modal.close();
          // Trigger logout
          if (window.openLogoutConfirm) {
            window.openLogoutConfirm();
          }
        };
      }

      modal.open(document.activeElement);
    }

    _createWarningModal() {
      const div = document.createElement('div');
      div.id = 'sessionWarningModal';
      div.className = 'modal';
      div.setAttribute('role', 'dialog');
      div.setAttribute('aria-modal', 'true');
      div.setAttribute('aria-labelledby', 'sessionWarningTitle');
      div.innerHTML = `
        <div class="modal-backdrop" tabindex="-1"></div>
        <div class="modal-dialog modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="sessionWarningTitle" class="modal-title">Session Expiring Soon</h3>
              <button type="button" class="modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
              <p>Your session will expire in <strong>2 minutes</strong> due to inactivity.</p>
              <p>Do you want to stay logged in?</p>
            </div>
            <div class="modal-footer">
              <button type="button" id="sessionLogoutBtn" class="btn btn-outline">Log Out</button>
              <button type="button" id="sessionStayBtn" class="btn btn-primary">Stay Logged In</button>
            </div>
          </div>
        </div>
      `;
      return div;
    }

    _stopAll() {
      if (this._refreshInterval) clearInterval(this._refreshInterval);
      if (this._checkInterval) clearInterval(this._checkInterval);
    }

    // Public method to manually refresh
    refreshNow() {
      return this._refreshSession();
    }
  }

  window.ASDC.SessionRefreshManager = SessionRefreshManager;
})();