/**
 * NotificationManager: Aromin-Sison Dental Clinic System.
 * Manages notification log table, template loading, and send modal
 * for the admin/receptionist dashboard.
 */
(function () {
  'use strict';

  const API_BASE = '../backend/api/notifications';

  class NotificationManager {
    constructor() {
      this._filter = 'All';
      this._templates = [];
      this._modal = null;
    }

    init() {
      this._loadTemplates();
      this._wireFilter();
      this._initSendModal();
    }

    async _loadTemplates() {
      try {
        const data = await apiFetch(API_BASE + '/templates.php?active_only=1');
        if (data.success && data.templates) { this._templates = data.templates; return; }
        throw new Error('no templates');
      } catch (e) {
        this._templates = [];
        showToast('Unable to load notification templates.', 'error');
      }
    }

    _wireFilter() {
      const group = document.querySelector('#view-notifications .toolbar-left');
      if (!group) return;
      wireChips(group, (label) => {
        this._filter = label;
        this.renderLog();
      });
    }

    async renderLog(snapshot = null) {
      snapshot = snapshot || window.staffSnapshot;
      const tbody = document.getElementById('notifLogBody');
      const empty = document.getElementById('notifLogEmpty');
      if (!tbody) return;

      let logs = [];
      try {
        const params = new URLSearchParams();
        if (this._filter === 'Email') params.set('channel', 'email');
        if (this._filter === 'Failed') params.set('status', 'failed');
        params.set('limit', '50');
        const data = snapshot ? { success: true, logs: snapshot.logs.filter(log => this._filter === 'All' || (this._filter === 'Failed' ? log.status === 'failed' : log.channel === this._filter.toLowerCase())) } : await apiFetch(API_BASE + '/list.php?' + params.toString());
        if (data.success) logs = data.logs || [];
        else throw new Error('list failed');
      } catch (e) {
        if (empty) { empty.hidden = false; empty.textContent = 'Unable to refresh notifications. Showing the last update.'; }
        return;
      }

      if (!logs.length) {
        tbody.innerHTML = '';
        if (empty) empty.hidden = false;
        return;
      }
      if (empty) empty.hidden = true;

      const esc = escapeHtml;
      tbody.innerHTML = logs
        .map((log) => {
          const chTag =
            log.channel === 'email'
              ? '<span class="tag tag-blue">Email</span>'
              : '<span class="tag tag-amber">Legacy</span>';
          const stTag =
            log.status === 'sent'
              ? '<span class="tag tag-green">Sent</span>'
              : log.status === 'failed'
                ? '<span class="tag tag-red">Failed</span>'
                : '<span class="tag tag-amber">Pending</span>';
          const subject = log.subject || '\u2014';
          const date = log.sent_at
            ? new Date(log.sent_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : '\u2014';
          return `<tr>
            <td>${esc(log.patient_name || '')}</td>
            <td>${chTag}</td>
            <td>${esc(subject)}</td>
            <td>${stTag}</td>
            <td>${esc(date)}</td>
          </tr>`;
        })
        .join('');
    }

    _initSendModal() {
      this._modal = new Modal('sendNotifModal');
      if (!this._modal.modal) return;

      this._modal.registerClose(document.getElementById('sendNotifClose'));
      this._modal.registerClose(document.getElementById('sendNotifCancel'));

      const snPatient = document.getElementById('snPatient');
      const snTemplate = document.getElementById('snTemplate');
      const snChannel = document.getElementById('snChannel');
      const snSubject = document.getElementById('snSubject');
      const snBody = document.getElementById('snBody');
      const snNote = document.getElementById('sendNotifNote');
      const snSaveBtn = document.getElementById('sendNotifSave');

      const fillPatientDropdown = async () => {
        snPatient.innerHTML = '';
        try {
          const data = await apiFetch('../backend/api/patients/list.php');
          snPatient.innerHTML = data.patients.map(p => '<option value="' + p.patient_id + '">' + escapeHtml(p.first_name + ' ' + p.last_name) + '</option>').join('');
        } catch (error) { showToast('Unable to load patients.', 'error'); }
      };

      const fillTemplateDropdown = () => {
        snTemplate.innerHTML =
          '<option value="">Custom message...</option>' +
          this._templates
            .map(
              (t) =>
                `<option value="${escapeHtml(t.template_key)}">${escapeHtml(t.name)} (${t.channel})</option>`
            )
            .join('');
      };

      snTemplate.addEventListener('change', () => {
        const key = snTemplate.value;
        if (!key) {
          snSubject.value = '';
          snBody.value = '';
          snChannel.value = 'email';
          return;
        }
        const t = this._templates.find((x) => x.template_key === key);
        if (t) {
          snSubject.value = t.subject || '';
          snBody.value = t.body || '';
          snChannel.value = 'email';
        }
      });

      document.getElementById('sendNotifBtn').addEventListener('click', () => {
        snNote.hidden = true;
        fillPatientDropdown();
        fillTemplateDropdown();
        snSubject.value = '';
        snBody.value = '';
        snChannel.value = 'email';
        snTemplate.value = '';
        this._modal.open();
      });

      snSaveBtn.addEventListener('click', async () => {
        const patientId = snPatient.value;
        if (!patientId) {
          snNote.textContent = 'Please select a patient.';
          snNote.classList.add('err');
          snNote.classList.remove('ok');
          snNote.hidden = false;
          return;
        }
        if (!snBody.value.trim()) {
          snNote.textContent = 'Please enter a message body.';
          snNote.classList.add('err');
          snNote.classList.remove('ok');
          snNote.hidden = false;
          return;
        }

        snSaveBtn.classList.add('loading');
        snSaveBtn.disabled = true;

        const payload = {
          patient_id: parseInt(patientId, 10),
          channel: 'email',
          subject: snSubject.value.trim() || null,
          body: snBody.value.trim(),
        };
        if (snTemplate.value) {
          payload.template_key = snTemplate.value;
          delete payload.subject;
          delete payload.body;
        }

        try {
          const data = await apiFetch(API_BASE + '/send.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (data.success) {
            if (!Array.isArray(data.results) || data.results.some(result => result.status !== 'sent')) {
              this.renderLog();
              throw new Error('Some messages could not be delivered. Check the notification log before retrying.');
            }
            this._modal.close();
            showToast(
              'Notification sent to ' +
                (snPatient.selectedOptions[0]?.textContent || 'patient')
            );
            this.renderLog();
          } else {
            throw new Error(data.error || 'send failed');
          }
        } catch (e) {
          snNote.textContent = e.message || 'Unable to send notification. Please try again.';
          snNote.classList.add('err');
          snNote.hidden = false;
        } finally {
          snSaveBtn.classList.remove('loading');
          snSaveBtn.disabled = false;
        }
      });
    }
  }

  window.ASDC.NotificationManager = NotificationManager;
})();
