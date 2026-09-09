/**
 * HtmlHelpers: Aromin-Sison Dental Clinic System.
 * Shared HTML rendering utilities: escaping, cell builders, status tags,
 * stat cards, icons, and empty states.
 */
(function () {
  'use strict';

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const nameCell = (initials, name, sub) =>
    `<div class="cell-name"><div class="mini-avatar">${escapeHtml(initials)}</div><div class="name-block">` +
    `<div class="full">${escapeHtml(name)}</div>${
      sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''
    }</div></div>`;

  const statusTag = (status) =>
    `<span class="tag tag-${status.tag}">${status.status}</span>`;

  const statCard = (s) =>
    `<div class="stat-card">
      <div class="stat-top">
        <div class="stat-icon" style="background:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
        <span class="stat-trend ${s.trendClass}">${s.trend}</span>
      </div>
      <div class="stat-num">${s.num}</div>
      <div class="stat-label">${s.label}</div>
    </div>`;

  const EMPTY_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
    '<path d="M16 2v4M8 2v4M3 10h18"/>' +
    '</svg>';

  const emptyState = (text, actionHtml = '') =>
    `<div class="empty-state">` +
    `<div class="es-ic" aria-hidden="true">${EMPTY_ICON}</div>` +
    `<div>${text}</div>` +
    `${
      actionHtml
        ? `<div class="es-action">${actionHtml}</div>`
        : ''
    }</div>`;

  const eyeIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const pencilIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
  const trashIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

  const initials = (name) =>
    name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  window.ASDC.HtmlHelpers = {
    escapeHtml,
    nameCell,
    statusTag,
    statCard,
    emptyState,
    eyeIcon,
    pencilIcon,
    trashIcon,
    EMPTY_ICON,
    initials,
  };
})();
