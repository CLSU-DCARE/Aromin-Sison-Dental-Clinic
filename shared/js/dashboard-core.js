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
     wirePublicSiteLinks() - reserved hook for "View Public Site" links
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
  // "View Public Site" links (topbar button + user menu) should behave like
  // an ordinary link: open the public marketing pages while the staff/
  // patient session stays fully intact underneath, so coming back to the
  // dashboard (or clicking browser Back) never forces a re-login. This used
  // to call the same session-destroy routine as the real Sign Out button,
  // which was the bug — logging people out just for viewing the public
  // site. Real sign-out is still handled separately by LogoutManager, and
  // is not affected by this.
  window.wirePublicSiteLinks = () => {
    // Intentionally a no-op: plain <a href="../public-website/..."> links
    // already navigate normally and keep the session cookie, so nothing
    // needs to be intercepted here. Kept as a named hook (rather than
    // deleted outright) in case a future need — e.g. opening in a new tab —
    // wants a single place to wire it up, without reintroducing a logout.
  };

  wirePublicSiteLinks();

  // ---------- Seed sample payment submissions (once) ----------
  // Payment submissions live in localStorage (shared between the patient
  // and receptionist dashboards). On a brand new browser/profile that
  // store is empty, so Payment Approvals would show nothing at all — this
  // seeds a few realistic sample receipts the first time only, and never
  // overwrites anything a real patient/receptionist has already done.
  (function seedSamplePayments() {
    const KEY = 'asdc.payments';
    try {
      if (localStorage.getItem(KEY)) return; // already seeded or has real data
      // Small neutral placeholder "receipt" image (inline SVG, no network needed).
      const placeholderReceipt = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520">' +
        '<rect width="400" height="520" fill="#f4f1ea"/>' +
        '<text x="200" y="250" font-family="sans-serif" font-size="18" fill="#8a8272" text-anchor="middle">Sample Receipt</text>' +
        '</svg>'
      );
      const seed = [
        { id: 'pay-seed-1', pid: '#P-1057', patient: 'Juan Reyes', amount: '₱2,000.00', method: 'Online (QR)', note: 'August braces adjustment payment', receiptDataUrl: placeholderReceipt, status: 'pending', submittedAt: 'August 12, 2026 at 9:10 AM', reviewedAt: null, orNumber: null },
        { id: 'pay-seed-2', pid: '#P-1044', patient: 'Alyssa Ramos', amount: '₱3,000.00', method: 'Over the counter', note: '', receiptDataUrl: placeholderReceipt, status: 'approved', submittedAt: 'August 10, 2026 at 2:40 PM', reviewedAt: 'August 10, 2026 at 3:00 PM', orNumber: 'OR-20260810-101' },
        { id: 'pay-seed-3', pid: '#P-1066', patient: 'Patricia Villanueva', amount: '₱1,500.00', method: 'Online (QR)', note: 'Partial payment', receiptDataUrl: placeholderReceipt, status: 'pending', submittedAt: 'August 13, 2026 at 4:15 PM', reviewedAt: null, orNumber: null }
      ];
      localStorage.setItem(KEY, JSON.stringify(seed));
    } catch (e) { /* storage unavailable — nothing to do */ }
  })();
})();
