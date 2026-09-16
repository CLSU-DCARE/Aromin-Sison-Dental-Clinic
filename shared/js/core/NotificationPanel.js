/**
 * NotificationPanel: Aromin-Sison Dental Clinic System.
 * Shared notification panel with read/unread states and "mark all as read".
 * Read state is persisted through the authenticated inbox API.
 */
(function () {
  'use strict';

  const NOTIF_ICONS = {
    appt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    pay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>',
    contract:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    promo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  };

  class NotificationPanel {
    init(opts) {
      const {
        triggerId,
        panelId,
        listId,
        badgeId,
        markAllId,
        emptyId,
        notifications,
        onSelect,
        storageKey,
      } = opts;

      this._trigger = document.getElementById(triggerId);
      this._panel = document.getElementById(panelId);
      if (!this._trigger || !this._panel) return;

      this._list = document.getElementById(listId);
      this._badge = document.getElementById(badgeId);
      this._markAll = document.getElementById(markAllId);
      this._empty = document.getElementById(emptyId);
      this._onSelect = onSelect;
      this._storageKey = storageKey;

      this._items = notifications || [];

      this._bindEvents();
      this._render();
    }

    setItems(items) {
      this._items = items;
      if (this._empty) this._empty.textContent = 'No notifications yet.';
      this._render();
    }

    async _markRead(ids) {
      if (!ids.length || this._saving) return;
      this._saving = true;
      try {
        const data = await apiFetch('../backend/api/notifications/inbox.php', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
        });
        this.setItems(data.notifications);
      } catch (error) { window.ASDC._toast?.show(error.message, 'error'); }
      finally { this._saving = false; }
    }

    _openDetails(notification) {
      const escHtml = window.ASDC.HtmlHelpers.escapeHtml;
      const dialog = document.createElement('dialog');
      const kind = notification.kind || 'info';
      const kindLabel = {
        appt: 'Appointment',
        pay: 'Payment',
        stock: 'Inventory',
        contract: 'Contract',
        promo: 'Promotion',
        info: 'Notification'
      }[kind] || 'Notification';

      dialog.className = 'workflow-dialog';
      dialog.innerHTML =
        '<form method="dialog" class="modal workflow-dialog-panel notification-detail-panel">' +
        '<div class="notification-detail-icon">' +
        (NOTIF_ICONS[kind] || NOTIF_ICONS.info) +
        '</div>' +
        '<p class="notification-detail-kicker">' + escHtml(kindLabel) + '</p>' +
        '<h3>' + escHtml(notification.title || 'Notification') + '</h3>' +
        '<p class="notification-detail-message">' + escHtml(notification.desc || 'No additional details were provided.') + '</p>' +
        '<div class="notification-detail-meta">' +
        '<span>Received</span>' +
        '<strong>' + escHtml(notification.time || 'Just now') + '</strong>' +
        '</div>' +
        '<div class="modal-actions">' +
        '<button type="submit" class="btn btn-gold">Close</button>' +
        '</div>' +
        '</form>';
      document.body.appendChild(dialog);
      dialog.addEventListener('close', () => dialog.remove());
      dialog.showModal();
    }

    _render() {
      const unread = this._items.filter((n) => n.unread).length;
      if (this._badge) {
        this._badge.textContent = String(unread);
        this._badge.hidden = unread === 0;
      }
      if (!this._list) return;
      this._list.innerHTML = '';
      if (!this._items.length) {
        if (this._empty) this._empty.hidden = false;
        return;
      }
      if (this._empty) this._empty.hidden = true;

      const escHtml = window.ASDC.HtmlHelpers.escapeHtml;

      this._items.forEach((n) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'notif-item ' + (n.unread ? 'unread' : 'read');
        btn.setAttribute(
          'aria-label',
          (n.unread ? 'Unread: ' : '') + n.title
        );
        btn.innerHTML =
          '<span class="notif-ic">' +
          (NOTIF_ICONS[n.kind] || NOTIF_ICONS.info) +
          '</span>' +
          '<span class="notif-body">' +
          '<span class="notif-title">' +
          escHtml(n.title) +
          '</span>' +
          '<span class="notif-desc">' +
          escHtml(n.desc || '') +
          '</span>' +
          '<span class="notif-time">' +
          escHtml(n.time) +
          '</span>' +
          '</span>' +
          '<span class="notif-dot" aria-hidden="true"></span>';
        btn.addEventListener('click', () => {
          this._openDetails(n);
          if (n.unread) {
            this._markRead([n.id]);
          }
          if (typeof this._onSelect === 'function') this._onSelect(n);
        });
        this._list.appendChild(btn);
      });
    }

    _bindEvents() {
      const popover = new window.ASDC.Popover();

      if (this._markAll) {
        this._markAll.addEventListener('click', () => {
          this._markRead(this._items.filter(n => n.unread).map(n => n.id));
        });
      }

      this._trigger.addEventListener('click', () =>
        popover.toggle(this._trigger, this._panel, {
          onOpen: () => this._render(),
        })
      );
    }
  }

  window.ASDC.NotificationPanel = NotificationPanel;
})();
