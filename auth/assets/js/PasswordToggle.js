/**
 * PasswordToggle: Aromin-Sison Dental Clinic System.
 * Toggles password visibility with accessible eye icons.
 */
(function () {
  'use strict';

  const EYE_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.7 21.7 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  class PasswordToggle {
    static init() {
      document.querySelectorAll('.pw-toggle').forEach((btn) => {
        const input = btn.parentElement.querySelector('input');
        btn.addEventListener('click', () => {
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          btn.setAttribute(
            'aria-label',
            show ? 'Hide password' : 'Show password'
          );
          btn.setAttribute('aria-pressed', show ? 'true' : 'false');
          btn.innerHTML = show ? EYE_OFF_ICON : EYE_ICON;
        });
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = EYE_ICON;
      });
    }
  }

  window.ASDC.PasswordToggle = PasswordToggle;
})();
