/**
 * NotificationPanel: Aromin-Sison Dental Clinic System.
 * Shared notification panel with read/unread states and "mark all as read".
 * Uses localStorage for read-state persistence via NotifStore.
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

  const NotifStore = {
    readIds(key) {
      if (!key) return new Set();
      try {
        const raw = localStorage.getItem(key);
        return new Set(raw ? JSON.parse(raw) : []);
      } catch (e) {
        return new Set();
      }
    },
    saveIds(key, ids) {
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(Array.from(ids)));
      } catch (e) {}
    },
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

      const readIds = NotifStore.readIds(storageKey);
      this._items = notifications.map((n) =>
        Object.assign({}, n, { unread: n.unread && !readIds.has(n.id) })
      );
      this._readIds = readIds;

      this._bindEvents();
      this._render();
    }

    _persist() {
      this._readIds.clear();
      this._items.forEach((n) => {
        if (!n.unread) this._readIds.add(n.id);
      });
      NotifStore.saveIds(this._storageKey, this._readIds);
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
          if (n.unread) {
            n.unread = false;
            this._persist();
            this._render();
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
          this._items.forEach((n) => {
            n.unread = false;
          });
          this._persist();
          this._render();
          if (window.ASDC._toast)
            window.ASDC._toast.show('All notifications marked as read');
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
