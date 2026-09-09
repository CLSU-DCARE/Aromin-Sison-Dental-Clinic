/**
 * PatientProfileEditor – Edit profile modal logic.
 *
 * Replaces the Edit Profile section from patient.js (lines 868-1070).
 *
 * Usage:
 *   const profileEditor = new PatientProfileEditor({ mock: PatientMock, store: PatientStore });
 *   profileEditor.init();
 */
/* global Modal, showToast */
window.PatientProfileEditor = class PatientProfileEditor {
  constructor ({ mock, store = null } = {}) {
    this.mock  = mock;
    this.store = store;
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
    const info = this.mock.profile.info;
    const getVal = label => {
      const f = info.find(item => item.label === label);
      return f ? f.value : '';
    };

    document.getElementById('epName').value    = this.mock.user.name;
    document.getElementById('epContact').value = getVal('Contact Number');
    document.getElementById('epEmail').value   = getVal('Email Address');
    this._noteEl.hidden = true;
    this.modal.open();
  }

  _save () {
    const name    = document.getElementById('epName').value.trim();
    const contact = document.getElementById('epContact').value.trim();

    if (!name || !contact) {
      this._showNote('Name and contact number are required.', true);
      return;
    }

    const saveBtn = document.getElementById('profileSaveBtn');
    saveBtn.classList.add('is-loading');

    setTimeout(() => {
      saveBtn.classList.remove('is-loading');

      const info   = this.mock.profile.info;
      const setVal = (label, value) => {
        const f = info.find(item => item.label === label);
        if (f) f.value = value;
      };

      this.mock.user.name     = name;
      this.mock.user.initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

      setVal('Full Name', name);
      setVal('Contact Number', contact);
      setVal('Email Address', document.getElementById('epEmail').value.trim());

      if (this.store) this.store.save();

      // Re-render user/profile via globals (will be refactored later)
      if (typeof renderUser === 'function') renderUser(this.mock.user);
      if (typeof renderProfile === 'function') renderProfile(this.mock.profile);

      this.modal.close();
      showToast('Profile updated');
    }, 500);
  }

  _showNote (message, isError) {
    if (!this._noteEl) return;
    this._noteEl.textContent = message;
    this._noteEl.classList.toggle('err', !!isError);
    this._noteEl.classList.toggle('ok', !isError);
    this._noteEl.hidden = false;
  }
};
