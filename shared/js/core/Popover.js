/**
 * Popover: Aromin-Sison Dental Clinic System.
 * Anchored dropdown panels (notifications, account menu, search).
 * - Anchored to trigger, flipped up if overflow
 * - Clamped horizontally inside viewport
 * - Closes on outside click, Escape, or opening another
 * - Becomes bottom sheet on phones (<=640px)
 */
(function () {
  'use strict';

  function placePopover(panel, trigger) {
    if (window.matchMedia('(max-width: 640px)').matches) {
      panel.classList.add('sheet');
      panel.style.left = '';
      panel.style.top = '';
      return;
    }
    panel.classList.remove('sheet');
    const rect = trigger.getBoundingClientRect();
    const gap = 10;
    const width = panel.offsetWidth || 320;
    let left = rect.right - width;
    left = Math.max(gap, Math.min(left, window.innerWidth - width - gap));
    let top = rect.bottom + gap;
    if (top + panel.offsetHeight > window.innerHeight - gap) {
      top = Math.max(gap, rect.top - panel.offsetHeight - gap);
    }
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  class Popover {
    constructor() {
      this._open = new Map(); // panel -> trigger
      this._initGlobalListeners();
    }

    toggle(trigger, panel, opts = {}) {
      if (this._open.has(panel)) return this.close(panel);
      this.closeAll();
      if (typeof opts.onOpen === 'function') opts.onOpen();
      placePopover(panel, trigger);
      panel.classList.add('open');
      this._open.set(panel, trigger);
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      const first = panel.querySelector(
        'button, input, [href], select, [tabindex]:not([tabindex="-1"])'
      );
      if (first) first.focus();
      else {
        panel.tabIndex = -1;
        panel.focus();
      }
    }

    close(panel) {
      if (!this._open.has(panel)) return;
      const trigger = this._open.get(panel);
      this._open.delete(panel);
      panel.classList.remove('open');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    }

    closeAll() {
      this._open.forEach((trigger, panel) => {
        panel.classList.remove('open');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
      this._open.clear();
    }

    _initGlobalListeners() {
      document.addEventListener('click', (e) => {
        if (!this._open.size) return;
        this._open.forEach((trigger, panel) => {
          if (
            panel.contains(e.target) ||
            (trigger && trigger.contains(e.target))
          )
            return;
          this.close(panel);
        });
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._open.size) this.closeAll();
      });

      window.addEventListener('resize', () => {
        this._open.forEach((trigger, panel) =>
          placePopover(panel, trigger)
        );
      });
    }
  }

  window.ASDC.Popover = Popover;
  window.ASDC.placePopover = placePopover;
})();
