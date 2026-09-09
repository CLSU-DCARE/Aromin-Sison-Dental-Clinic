/* =====================================================================
   Aromin-Sison Dental Clinic: shared dashboard core
   Single source of truth for utilities used by ALL dashboards
   (dentist, receptionist, and patient). Load this BEFORE the
   page-specific dashboard script (dentist.js / admin.js / patient.js).

   This file now delegates to OOP classes in shared/js/core/.
   Global functions are kept for backward compatibility.

   Exposes (all global):
     class Modal           - reusable dialog (focus trap, Esc, backdrop)
     showToast(msg, kind)  - app toast via #appToast
     announce(message)     - screen-reader live region
     initToastTriggers()   - wires [data-toast] click delegation
     initFullscreenToggle() - wires #fullscreenToggle
     initSidebar(key)      - sidebar collapse/drawer
     openSidebar/closeSidebar/applyCollapsed - sidebar helpers
     initLogout(url)       - wires #logoutModal confirm-logout flow
     openLogoutConfirm(el) - opens logout modal programmatically
     Popover               - anchored dropdown panels
     initNotifications(opts) - notification panel wiring
     wirePublicSiteLinks() - destroy session before navigating
   ===================================================================== */

// ---------- Core class imports (loaded via <script> tags before this file) ----------
// ASDC.Modal, ASDC.ToastManager, ASDC.Popover, ASDC.SidebarController,
// ASDC.HtmlHelpers, ASDC.ViewRouter, ASDC.FilterChipGroup,
// ASDC.SessionGuard, ASDC.NotificationPanel, ASDC.LogoutManager,
// ASDC.FullscreenToggle, ASDC.ReportExporter

// ---------- Create singleton instances ----------
(function () {
  'use strict';

  // Sidebar
  const sidebar = new ASDC.SidebarController();
  ASDC._sidebar = sidebar;

  // Toast
  const toast = new ASDC.ToastManager();
  ASDC._toast = toast;

  // Popover (global instance for direct use)
  const popover = new ASDC.Popover();
  ASDC._popover = popover;

  // Logout
  const logout = new ASDC.LogoutManager();
  ASDC._logout = logout;

  // Session guard
  const guard = new ASDC.SessionGuard();
  guard.init();

  // CSRF token bootstrap
  if (window.ASDC.ApiClient && window.ASDC.ApiClient.refreshCsrf) {
    window.ASDC.ApiClient.refreshCsrf();
  }

  // Fullscreen
  const fs = new ASDC.FullscreenToggle();
  fs.init();

  // ---------- Backward-compatible global functions ----------

  // Modal (keep class global for legacy `new Modal('id')` usage)
  window.Modal = ASDC.Modal;

  // Toast
  window.showToast = (message, kind, action) => toast.show(message, kind, action);
  window.announce = (message) => toast.announce(message);
  window.initToastTriggers = () => toast.initTriggers();

  // Fullscreen
  window.initFullscreenToggle = () => {}; // already initialized above

  // Sidebar
  window.initSidebar = (key) => sidebar.init(key);
  window.openSidebar = () => sidebar.open();
  window.closeSidebar = () => sidebar.close();
  window.applyCollapsed = () => sidebar._applyCollapsed();

  // Logout
  window.initLogout = (url) => logout.init(url);
  window.openLogoutConfirm = (trigger) => logout.open(trigger);
  window.destroySessionAndRedirect = (url) => logout._destroyAndRedirect(url);

  // Popover
  window.Popover = popover;
  window.placePopover = ASDC.placePopover;

  // HTML helpers (backward-compatible globals)
  window.escapeHtml = ASDC.HtmlHelpers.escapeHtml;
  window.nameCell = ASDC.HtmlHelpers.nameCell;
  window.statusTag = ASDC.HtmlHelpers.statusTag;
  window.statCard = ASDC.HtmlHelpers.statCard;
  window.emptyState = ASDC.HtmlHelpers.emptyState;
  window.EMPTY_ICON = ASDC.HtmlHelpers.EMPTY_ICON;
  window.eyeIcon = ASDC.HtmlHelpers.eyeIcon;
  window.pencilIcon = ASDC.HtmlHelpers.pencilIcon;
  window.trashIcon = ASDC.HtmlHelpers.trashIcon;
  window.initials = ASDC.HtmlHelpers.initials;

  // Notifications
  window.initNotifications = (opts) => {
    const panel = new ASDC.NotificationPanel();
    panel.init(opts);
  };

  // Filter chips (backward-compatible globals)
  window.wireChips = (group, onChange) => new ASDC.FilterChipGroup(group, onChange);
  window.setChipGroup = (group, label) => {
    if (!group) return;
    group.querySelectorAll('.filter-chip').forEach((c) => {
      const active = c.textContent.trim() === label;
      c.classList.toggle('active', active);
      c.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  // Report export
  window.exportTablePDF = (opts) => ASDC.ReportExporter.exportPDF(opts);
  window.getLogoDataUrl = () => ASDC.ReportExporter.getLogoDataUrl();

  // Public site links
  window.wirePublicSiteLinks = () => {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href*="public-website"]');
      if (!link) return;
      e.preventDefault();
      destroySessionAndRedirect(link.getAttribute('href'));
    });
  };

  wirePublicSiteLinks();
})();
