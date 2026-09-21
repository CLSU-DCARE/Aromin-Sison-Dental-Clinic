/**
 * SessionGuard: Aromin-Sison Dental Clinic System.
 * Keeps a dashboard page tied to a real, valid session:
 *  - checks the session when the page opens, when it is restored from the
 *    back/forward cache, and when the tab becomes visible again;
 *  - sends the person to the right dashboard (or the login page) if the
 *    session is gone or belongs to a different role / a different user;
 *  - keeps all open tabs in step (logout, login as someone else) through
 *    BroadcastChannel (or the "storage" event on older browsers).
 *
 * A temporary network or server problem is NEVER treated as "logged out".
 */
(function () {
  'use strict';

  const ME_URL = '../backend/api/auth/me.php';

  class SessionGuard {
    constructor() {
      this._loginUrl = window.ASDC.Routing ? window.ASDC.Routing.getLoginUrl() : '../auth/login.html';
      this._channel = null;
      this._user = null;          // who this page was built for
      this._verifying = null;     // a check that is running right now
      this._lastVerifyAt = 0;
      this._redirecting = false;
      this._initBroadcastChannel();
    }

    init() {
      this._guardDashboard();
      this._initBfcache();
      this._initVisibilityChange();
    }

    // ---------- Multi-tab messages ----------

    _initBroadcastChannel() {
      if (window.BroadcastChannel) {
        try {
          this._channel = new BroadcastChannel('asdc-auth');
          this._channel.onmessage = (event) => this._handleBroadcastMessage(event.data);
        } catch (e) {
          this._channel = null;
        }
      }
      // Older browsers: the "storage" event fires in the OTHER tabs only.
      window.addEventListener('storage', (e) => {
        if (e.key !== 'asdc:auth:event' || !e.newValue) return;
        try {
          this._handleBroadcastMessage(JSON.parse(e.newValue));
        } catch (err) {
          // ignore bad data
        }
      });
    }

    _handleBroadcastMessage(message) {
      if (!message || !message.type) return;
      switch (message.type) {
        case 'logout':
          // Someone signed out in another tab: leave this page too.
          this._goToLogin(false);
          break;
        case 'login':
          // Someone signed in in another tab. It may be a different person,
          // so this page must check that it still shows the right account.
          this.revalidate({ force: true });
          break;
        case 'activity':
        case 'refresh':
          // The person is active in another tab. Tell the idle timer.
          window.dispatchEvent(
            new CustomEvent('asdc:session-activity', { detail: { timestamp: message.timestamp || Date.now() } })
          );
          break;
      }
    }

    _broadcast(message) {
      if (this._channel) {
        try {
          this._channel.postMessage(message);
          return;
        } catch (e) {
          // fall through to localStorage
        }
      }
      try {
        localStorage.setItem('asdc:auth:event', JSON.stringify(Object.assign({ ts: Date.now() }, message)));
      } catch (e) {
        // storage not available
      }
    }

    // ---------- Redirects ----------

    _goToLogin(expired) {
      if (this._redirecting) return;
      this._redirecting = true;
      window.ASDCAuthUser = null;
      if (expired) {
        // The login page shows "session expired" when it finds this flag.
        try {
          sessionStorage.setItem('asdc:session-expired', '1');
        } catch (e) {}
      }
      window.location.replace(this._loginUrl);
    }

    _redirectTo(url) {
      if (this._redirecting) return;
      this._redirecting = true;
      window.ASDCAuthUser = null;
      window.location.replace(url);
    }

    _pageRole() {
      const routing = window.ASDC.Routing;
      if (routing && routing.getRoleFromPath) return routing.getRoleFromPath(location.pathname);
      if (location.pathname.includes('/patient-dashboard/')) return 'patient';
      if (location.pathname.includes('/dentist-dashboard/')) return 'dentist';
      if (location.pathname.includes('/admin-system/')) return 'receptionist';
      return null;
    }

    _destinationFor(role) {
      const routing = window.ASDC.Routing;
      return (routing && routing.ROLE_DESTINATIONS && routing.ROLE_DESTINATIONS[role]) ||
        this._roleDestinations[role] || this._loginUrl;
    }

    // ---------- Page guard ----------

    _guardDashboard() {
      if (!this._pageRole()) return; // not a dashboard page

      // Keep the page invisible until the server confirms who is signed in.
      document.documentElement.style.visibility = 'hidden';
      this._firstCheck(0);
    }

    async _firstCheck(attempt) {
      const result = await this._checkSession();
      if (result.state === 'none') {
        this._goToLogin(true);
        return;
      }
      if (result.state === 'error') {
        // The server could not be reached. That is not a logout: show the page
        // (its own "reconnecting" messages take over) and keep trying quietly.
        document.documentElement.style.visibility = '';
        setTimeout(() => this._firstCheck(attempt + 1), Math.min(2000 * Math.pow(2, attempt), 30000));
        return;
      }
      this._accept(result.user);
    }

    _accept(user) {
      const pageRole = this._pageRole();
      if (pageRole && user.role !== pageRole) {
        // Signed in, but this is the wrong dashboard for the role.
        this._redirectTo(this._destinationFor(user.role));
        return;
      }
      const isFirst = !this._user;
      this._user = user;
      window.ASDCAuthUser = user;
      this._populateUserUI(user);
      document.documentElement.style.visibility = '';
      if (isFirst) {
        window.dispatchEvent(new CustomEvent('asdc:authenticated', { detail: user }));
      }
    }

    /**
     * Ask the server who is signed in (and quietly restore a "remember me" login).
     * Resolves to { state: 'ok', user } | { state: 'none' } | { state: 'error' }.
     * 'error' means a network/server problem, so callers must NOT log the person out.
     * @param {{passive?: boolean}} [options] passive = do not count as user activity.
     */
    async _checkSession(options) {
      const headers = { Accept: 'application/json' };
      if (options && options.passive) headers['X-ASDC-Passive'] = '1';

      try {
        const response = await fetch(ME_URL, {
          method: 'GET',
          credentials: 'same-origin',
          headers,
          cache: 'no-store',
        });
        let payload = {};
        try {
          payload = await response.json();
        } catch (e) {}
        if (response.ok && payload.user) return { state: 'ok', user: payload.user };
        if (response.status >= 500) return { state: 'error' };
      } catch (e) {
        return { state: 'error' };
      }

      // Not signed in. Try the "remember me" cookie before giving up.
      const api = window.ASDC.ApiClient;
      if (!api || !api.recoverSession) return { state: 'none' };
      const recovered = await api.recoverSession();
      if (recovered.ok) return { state: 'ok', user: recovered.user, restored: true };
      return { state: recovered.error ? 'error' : 'none' };
    }

    /**
     * Check again that the session is still valid AND still belongs to the
     * same person this page was built for. Called on tab focus, back/forward
     * restore, coming back online, and when another tab logs in.
     */
    revalidate(options) {
      const opts = options || {};
      if (this._verifying) return this._verifying;
      if (!opts.force && Date.now() - this._lastVerifyAt < 5000) return Promise.resolve();
      this._lastVerifyAt = Date.now();

      this._verifying = this._checkSession({ passive: !!opts.passive })
        .then((result) => {
          if (result.state === 'none') {
            this._goToLogin(true);
            return;
          }
          if (result.state !== 'ok') return; // temporary trouble: stay where we are

          const user = result.user;
          const pageRole = this._pageRole();
          if (pageRole && user.role !== pageRole) {
            this._redirectTo(this._destinationFor(user.role));
            return;
          }
          if (this._user && String(user.user_id) !== String(this._user.user_id)) {
            // Another tab signed in as a different person. Never keep showing
            // the previous person's records: load this dashboard again.
            this._redirectTo(this._destinationFor(user.role));
          }
        })
        .finally(() => {
          this._verifying = null;
        });
      return this._verifying;
    }

    _populateUserUI(user) {
      const initials = window.ASDC.HtmlHelpers
        ? window.ASDC.HtmlHelpers.avatarInitials(user)
        : String(user.full_name || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
      const roleLabel =
        user.role.charAt(0).toUpperCase() + user.role.slice(1);
      const isPatient = location.pathname.includes('/patient-dashboard/');

      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };

      const setAvatar = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (window.ASDC.HtmlHelpers) {
          window.ASDC.HtmlHelpers.setAvatarElement(el, user);
          return;
        }
        el.classList.toggle('has-photo', Boolean(user.profile_image_url));
        if (user.profile_image_url) {
          el.innerHTML = `<img src="${this._escape(user.profile_image_url)}" alt="" loading="lazy">`;
        } else {
          el.textContent = initials || '?';
        }
      };

      [
        'sideFootAvatar',
        'chipAvatar',
        'menuAvatar',
        'profileAvatar',
      ].forEach((id) => setAvatar(id));
      ['sideFootName', 'menuName', 'profileName'].forEach((id) =>
        set(id, user.full_name)
      );
      ['sideFootRole', 'menuRole'].forEach((id) => set(id, roleLabel));

      if (!isPatient)
        set(
          'greetingSubtext',
          user.full_name + ' · ' + roleLabel
        );
      else set('welcomeTitle', 'Welcome, ' + user.full_name + '!');

      const chip = document.getElementById('userChip');
      if (chip) chip.title = user.full_name + ': ' + roleLabel;
      if (!window.ASDC_DISABLE_MENU_PROFILE_PICTURE) {
        this._wireProfilePicture(user);
      }
    }

    _wireProfilePicture(user) {
      const menu = document.getElementById('userMenu');
      if (!menu || menu.dataset.profilePictureReady === '1') return;
      menu.dataset.profilePictureReady = '1';

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.hidden = true;
      input.id = 'profilePictureInput';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'user-menu-item';
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span>Change profile picture</span>';
      button.addEventListener('click', () => input.click());

      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const form = new FormData();
        form.append('profile_picture', file);
        button.disabled = true;
        try {
          const data = await window.apiFetch('../backend/api/auth/profile-picture.php', {
            method: 'POST',
            body: form,
          });
          window.ASDCAuthUser = Object.assign({}, window.ASDCAuthUser, data);
          this._populateUserUI(window.ASDCAuthUser);
          if (window.showToast) window.showToast('Profile picture updated.');
        } catch (error) {
          if (window.showToast) window.showToast(error.message || 'Unable to update profile picture.', 'error');
        } finally {
          button.disabled = false;
          input.value = '';
        }
      });

      const signOut = document.getElementById('menuSignOut');
      menu.insertBefore(input, signOut || null);
      menu.insertBefore(button, signOut || null);
    }

    _escape(value) {
      // The entity text is built in two pieces so it cannot be mangled by copy/paste tools.
      const map = {
        '&': '&' + 'amp;',
        '<': '&' + 'lt;',
        '>': '&' + 'gt;',
        '"': '&' + 'quot;',
        "'": '&' + '#39;',
      };
      return String(value).replace(/[&<>"']/g, (c) => map[c]);
    }

    _initBfcache() {
      window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        // The browser brought back an old copy of the page (Back/Forward).
        // It may still show data from before a logout, so hide it until the
        // server confirms the session is still valid.
        const isDashboard = !!this._pageRole();
        if (isDashboard) document.documentElement.style.visibility = 'hidden';
        this.revalidate({ force: true }).finally(() => {
          if (isDashboard && !this._redirecting) document.documentElement.style.visibility = '';
        });
      });
    }

    _initVisibilityChange() {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.revalidate();
      });
      window.addEventListener('online', () => this.revalidate({ force: true }));
    }

    // Public method to notify other tabs of logout
    broadcastLogout() {
      this._broadcast({ type: 'logout' });
    }

    // Public method to tell other tabs the person is active (resets their idle timers)
    broadcastRefresh() {
      this._broadcast({ type: 'activity', timestamp: Date.now() });
    }
  }

  // Role destinations used when the shared router is not available
  SessionGuard.prototype._roleDestinations = {
    patient: '../patient-dashboard/dashboard.html',
    dentist: '../dentist-dashboard/dashboard.html',
    receptionist: '../admin-system/dashboard.html',
  };

  window.ASDC.SessionGuard = SessionGuard;
})();
