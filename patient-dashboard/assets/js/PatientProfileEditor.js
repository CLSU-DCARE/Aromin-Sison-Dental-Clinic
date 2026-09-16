/**
 * PatientProfileEditor – Edit profile modal logic.
 *
 * Replaces the Edit Profile section from patient.js (lines 868-1070).
 *
 * Usage:
 *   const profileEditor = new PatientProfileEditor({ state: PatientState });
 *   profileEditor.init();
 */
/* global Modal, showToast */
window.PatientProfileEditor = class PatientProfileEditor {
  constructor ({ state } = {}) {
    this.state  = state;
    this.modal = new Modal('profileModal');
    this._noteEl = null;
  }

  init () {
    if (!this.modal.modal) return;

    this.modal.registerClose(document.getElementById('profileModalClose'));
    this.modal.registerClose(document.getElementById('profileCancelBtn'));
    this._noteEl = document.getElementById('profileNote');

    const editBtn  = document.getElementById('editProfileBtn');
    const saveBtn  = document.getElementById('profileSaveBtn');

    editBtn?.addEventListener('click', () => this._open());

    saveBtn?.addEventListener('click', () => this._save());

    this.modal.modal.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.matches('input')) {
        event.preventDefault();
        saveBtn?.click();
      }
    });
  }

  _open () {
    const info = this.state.profile.info;
    const getVal = label => {
      const f = info.find(item => item.label === label);
      return f ? f.value : '';
    };

    document.getElementById('epName').value    = this.state.user.name;
    document.getElementById('epContact').value = getVal('Contact Number') === '—' ? '' : getVal('Contact Number');
    document.getElementById('epEmail').value   = getVal('Email Address');
    document.getElementById('epEmail').readOnly = true;
    document.getElementById('epEmail').title = 'Contact the clinic to change your login email.';
    this._noteEl.hidden = true;
    this.modal.open();
  }

  async _save () {
    const button = document.getElementById('profileSaveBtn');
    if (button.disabled) return;
    button.disabled = true;
    try {
      await apiFetch('../backend/api/patients/profile.php', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('epName').value, contact_number: document.getElementById('epContact').value }) });
      await refreshAfterPatientAction();
      this.modal.close(); showToast('Profile updated.');
    } catch (error) { this._showNote(error.message, true); }
    finally { button.disabled = false; }
  }

  _showNote (message, isError) {
    if (!this._noteEl) return;
    this._noteEl.textContent = message;
    this._noteEl.classList.toggle('err', !!isError);
    this._noteEl.classList.toggle('ok', !isError);
    this._noteEl.hidden = false;
  }
};
