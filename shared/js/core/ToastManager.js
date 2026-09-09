/**
 * ToastManager: Aromin-Sison Dental Clinic System.
 * Lightweight feedback toast with optional action button.
 * Also provides screen-reader announcements via a live region.
 */
(function () {
  'use strict';

  class ToastManager {
    constructor() {
      this._timer = null;
      this._liveRegion = null;
    }

    show(message, kind = 'success', action = null) {
      const toast = document.getElementById('appToast');
      if (!toast) return;

      toast.textContent = '';
      toast.classList.remove('success', 'error', 'has-action');
      toast.classList.add(kind === 'error' ? 'error' : 'success');

      const text = document.createElement('span');
      text.textContent = message;
      toast.appendChild(text);

      if (action && action.label && typeof action.onClick === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toast-action';
        btn.textContent = action.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          clearTimeout(this._timer);
          toast.classList.remove('show');
          action.onClick();
        });
        toast.appendChild(btn);
        toast.classList.add('has-action');
      }

      toast.classList.add('show');
      clearTimeout(this._timer);
      this._timer = setTimeout(() => toast.classList.remove('show'), 2600);
      this.announce(message);
    }

    announce(message) {
      if (!message) return;
      if (!this._liveRegion) {
        this._liveRegion = document.createElement('div');
        this._liveRegion.id = 'srLiveRegion';
        this._liveRegion.setAttribute('aria-live', 'polite');
        this._liveRegion.setAttribute('role', 'status');
        this._liveRegion.style.cssText =
          'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
        document.body.appendChild(this._liveRegion);
      }
      this._liveRegion.textContent = '';
      requestAnimationFrame(() => {
        this._liveRegion.textContent = message;
      });
    }

    initTriggers() {
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-toast]');
        if (trigger) {
          this.show(
            trigger.dataset.toast,
            trigger.dataset.toastKind
          );
        }
      });
    }
  }

  window.ASDC.ToastManager = ToastManager;
})();
