/**
 * SidebarController: Aromin-Sison Dental Clinic System.
 * Sidebar collapse on desktop, drawer on tablet/mobile.
 * Persists collapse state via localStorage per dashboard.
 */
(function () {
  'use strict';

  class SidebarController {
    constructor() {
      this.key = 'asdc.sidebar.collapsed';
      this.el = null;
      this.backdrop = null;
      this.toggle = null;
      this.closeBtn = null;
      this.desktopMQ = null;
      this.isCollapsed = false;
    }

    init(collapseKey) {
      this.key = collapseKey;
      this.el = document.getElementById('sidebar');
      if (!this.el) return;

      this.backdrop = document.getElementById('sidebarBackdrop');
      this.toggle = document.getElementById('sidebarToggle');
      this.closeBtn = document.getElementById('sidebarClose');
      this.desktopMQ = window.matchMedia('(min-width: 961px)');

      try {
        this.isCollapsed = localStorage.getItem(this.key) === '1';
      } catch (e) {}

      if (this.toggle) {
        this.toggle.addEventListener('click', () => {
          if (this.desktopMQ.matches) {
            this.isCollapsed = !this.isCollapsed;
            this._applyCollapsed();
          } else if (this.el.classList.contains('open')) {
            this.close();
          } else {
            this.open();
          }
        });
      }

      if (this.closeBtn)
        this.closeBtn.addEventListener('click', () => this.close());
      if (this.backdrop)
        this.backdrop.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });
      this.desktopMQ.addEventListener('change', () => this.close());
      this._applyCollapsed();
    }

    _applyCollapsed() {
      document.body.classList.toggle('sidebar-collapsed', this.isCollapsed);
      if (this.toggle)
        this.toggle.setAttribute('aria-expanded', String(!this.isCollapsed));
      try {
        localStorage.setItem(this.key, this.isCollapsed ? '1' : '0');
      } catch (e) {}
    }

    open() {
      if (!this.el) return;
      this.el.classList.add('open');
      if (this.backdrop) this.backdrop.classList.add('open');
      document.body.classList.add('sidebar-open');
      if (this.toggle) this.toggle.setAttribute('aria-expanded', 'true');
      if (!this.desktopMQ.matches && this.closeBtn) this.closeBtn.focus();
    }

    close() {
      if (!this.el) return;
      const wasOpen = this.el.classList.contains('open');
      this.el.classList.remove('open');
      if (this.backdrop) this.backdrop.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      if (this.toggle) this.toggle.setAttribute('aria-expanded', 'false');
      if (wasOpen && !this.desktopMQ.matches && this.toggle)
        this.toggle.focus();
    }
  }

  window.ASDC.SidebarController = SidebarController;
})();
