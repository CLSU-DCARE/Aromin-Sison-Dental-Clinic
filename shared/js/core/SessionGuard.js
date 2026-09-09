/**
 * SessionGuard: Aromin-Sison Dental Clinic System.
 * Validates session on page load, bfcache restore, and visibility change.
 * Redirects to login if session is invalid.
 */
(function () {
  'use strict';

  class SessionGuard {
    constructor() {
      this._loginUrl = '../auth/login.html';
      this._roleDestinations = {
        patient: '../patient-dashboard/dashboard.html',
        dentist: '../dentist-dashboard/dashboard.html',
        receptionist: '../admin-system/dashboard.html',
      };
    }

    init() {
      this._guardDashboard();
      this._initBfcache();
      this._initVisibilityChange();
    }

    _guardDashboard() {
      const isPatient = location.pathname.includes('/patient-dashboard/');
      const isDentist = location.pathname.includes('/dentist-dashboard/');
      const isReceptionist = location.pathname.includes('/admin-system/');
      const isAny = isPatient || isDentist || isReceptionist;
      if (!isAny) return;

      document.documentElement.style.visibility = 'hidden';

      this._checkSession()
        .then((user) => {
          const destination = this._roleDestinations[user.role];
          const correctDashboard =
            (isPatient && user.role === 'patient') ||
            (isDentist && user.role === 'dentist') ||
            (isReceptionist && user.role === 'receptionist');

          if (!destination) {
            location.replace(this._loginUrl);
            return;
          }
          if (!correctDashboard) {
            location.replace(destination);
            return;
          }

          window.ASDCAuthUser = user;
          this._populateUserUI(user);
          document.documentElement.style.visibility = '';
        })
        .catch(() =>
          location.replace(this._loginUrl + '?error=session')
        );
    }

    _populateUserUI(user) {
      const initials = String(user.full_name || '')
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

      [
        'sideFootAvatar',
        'chipAvatar',
        'menuAvatar',
        'profileAvatar',
      ].forEach((id) => set(id, initials));
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
    }

    _checkSession() {
      return fetch('../backend/api/auth/me.php', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
        .then(async (response) => {
          let payload = {};
          try {
            payload = await response.json();
          } catch (e) {}
          if (!response.ok || !payload.user)
            throw new Error('unauthenticated');
          return payload.user;
        });
    }

    _initBfcache() {
      window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        this._checkSession().catch(() => {
          window.location.replace(
            this._loginUrl + '?error=session'
          );
        });
      });
    }

    _initVisibilityChange() {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        this._checkSession().catch(() => {
          window.location.replace(
            this._loginUrl + '?error=session'
          );
        });
      });
    }
  }

  window.ASDC.SessionGuard = SessionGuard;
})();
