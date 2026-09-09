/**
 * ViewRouter: Aromin-Sison Dental Clinic System.
 * Crossfade-based view switching with nav item state and breadcrumb.
 * Used by all three dashboards (admin, patient, dentist).
 */
(function () {
  'use strict';

  class ViewRouter {
    constructor(views, navSelector = '.nav-item[data-view]') {
      this.views = views;
      this.navSelector = navSelector;
      this.viewTitle = document.getElementById('viewTitle');
      this.viewCrumb = document.getElementById('viewCrumb');

      document.querySelectorAll(navSelector).forEach((btn) => {
        btn.addEventListener('click', () => this.switch(btn.dataset.view));
      });
    }

    switch(viewKey) {
      const target = document.getElementById('view-' + viewKey);
      if (!target || target.classList.contains('active')) return;

      document.querySelectorAll(this.navSelector).forEach((el) => {
        const active = el.dataset.view === viewKey;
        el.classList.toggle('active', active);
        if (active) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      });

      const meta = this.views[viewKey] || { title: viewKey, crumb: '' };
      if (this.viewTitle) this.viewTitle.textContent = meta.title;
      if (this.viewCrumb) this.viewCrumb.textContent = meta.crumb;

      const current = document.querySelector('.view.active');
      const swap = () => {
        document
          .querySelectorAll('.view')
          .forEach((el) => el.classList.remove('active', 'view-leave'));
        target.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.ASDC._sidebar) window.ASDC._sidebar.close();
        if (window.ASDC._toast)
          window.ASDC._toast.announce('Showing ' + meta.title);
      };

      if (current && current !== target) {
        current.classList.add('view-leave');
        setTimeout(swap, 180);
      } else {
        swap();
      }
    }
  }

  window.ASDC.ViewRouter = ViewRouter;
})();
