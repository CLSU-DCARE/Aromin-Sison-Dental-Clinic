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
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const initials = (name) =>
    String(name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const parseDateValue = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return null;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      return new Date(
        Number(match[1]), Number(match[2]) - 1, Number(match[3]),
        Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)
      );
    }
    const parsed = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return raw || '-';
    const date = parseDateValue(raw);
    return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : raw;
  };

  const formatDateTime = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return raw || '-';
    const date = parseDateValue(raw);
    return date ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : raw;
  };

  const avatarInitials = (user, fallback = '?') => {
    const value = typeof user === 'string'
      ? user
      : (user && (user.initials || user.full_name || user.name || user.email)) || '';
    return initials(String(value)) || fallback;
  };

  const profileImageUrl = (user) =>
    (user && (user.profile_image_url || user.profileImageUrl || user.profile_image_path || user.profileImagePath)) || '';

  const avatarHtml = (user, options = {}) => {
    const label = avatarInitials(user, options.fallback || '?');
    const imageUrl = profileImageUrl(user);
    const className = options.className || 'mini-avatar';
    if (imageUrl) {
      return `<div class="${escapeHtml(className)} has-photo"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('has-photo');this.parentNode.textContent='${escapeHtml(label)}';"></div>`;
    }
    return `<div class="${escapeHtml(className)}">${escapeHtml(label)}</div>`;
  };

  const setAvatarElement = (element, user, options = {}) => {
    if (!element) return;
    const label = avatarInitials(user, options.fallback || '?');
    const imageUrl = profileImageUrl(user);
    element.classList.toggle('has-photo', Boolean(imageUrl));
    if (imageUrl) {
      element.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">`;
      const image = element.querySelector('img');
      if (image) {
        image.addEventListener('error', () => {
          element.classList.remove('has-photo');
          element.textContent = label;
        }, { once: true });
      }
    } else {
      element.textContent = label;
    }
  };

  const nameCell = (initialsValue, name, sub) =>
    `<div class="cell-name">${avatarHtml({ initials: initialsValue || initials(name), name })}<div class="name-block">` +
    `<div class="full">${escapeHtml(name)}</div>${
      sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''
    }</div></div>`;

  const statusTag = (status) =>
    `<span class="tag tag-${status.tag}">${status.status}</span>`;

  const statCard = (s) =>
    `<div class="stat-card">
      <div class="stat-top">
        <div class="stat-icon" style="background:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
        ${
          s.trend
            ? `<span class="stat-trend ${s.trendClass || ''}">${s.trend}</span>`
            : ''
        }
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

  window.ASDC.HtmlHelpers = {
    escapeHtml,
    nameCell,
    avatarHtml,
    avatarInitials,
    profileImageUrl,
    setAvatarElement,
    statusTag,
    statCard,
    emptyState,
    eyeIcon,
    pencilIcon,
    trashIcon,
    EMPTY_ICON,
    initials,
    formatDate,
    formatDateTime,
  };
})();
