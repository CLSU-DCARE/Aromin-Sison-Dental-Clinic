/**
 * Modal: Aromin-Sison Dental Clinic System.
 * Reusable dialog with focus trap, Escape to close, and backdrop click.
 * Singleton registry ensures one instance per DOM ID.
 */
(function () {
  'use strict';

  class Modal {
    constructor(modalId) {
      const existing = Modal._registry.get(modalId);
      if (existing) return existing;

      this.modal = document.getElementById(modalId);
      if (!this.modal) return;

      this.lastTrigger = null;
      this._onKeydown = this._onKeydown.bind(this);
      this._onBackdrop = this._onBackdrop.bind(this);
      this.modal.addEventListener('click', this._onBackdrop);

      Modal._registry.set(modalId, this);
    }

    registerTrigger(el) {
      if (!el || !this.modal) return;
      el.addEventListener('click', () => this.open(el));
    }

    registerClose(el) {
      if (!el || !this.modal) return;
      el.addEventListener('click', () => this.close());
    }

    open(trigger) {
      if (this.modal.hidden === false) return;
      this.lastTrigger = trigger || document.activeElement;
      this.modal.hidden = false;
      document.body.classList.add('modal-open');
      document.addEventListener('keydown', this._onKeydown);
      const focusable = this._focusable();
      if (focusable.length) focusable[0].focus();
    }

    close() {
      if (this.modal.hidden) return;
      this.modal.hidden = true;
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', this._onKeydown);
      if (this.lastTrigger) this.lastTrigger.focus();
      this.lastTrigger = null;
    }

    _focusable() {
      return Array.from(
        this.modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled && el.offsetParent !== null);
    }

    _onKeydown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
        return;
      }
      if (e.key === 'Tab') {
        const items = this._focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    _onBackdrop(e) {
      if (e.target === this.modal) this.close();
    }

    static anyOpen() {
      return Array.from(Modal._registry.values()).some(
        (m) => m.modal && !m.modal.hidden
      );
    }
  }

  Modal._registry = new Map();

  window.ASDC.Modal = Modal;
})();
