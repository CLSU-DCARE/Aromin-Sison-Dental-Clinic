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
          window.dispatchEvent(new CustomEvent('asdc:authenticated', { detail: user }));
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

      const setAvatar = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
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
      this._wireProfilePicture(user);
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
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
