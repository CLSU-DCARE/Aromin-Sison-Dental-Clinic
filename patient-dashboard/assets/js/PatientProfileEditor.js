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
    const pictureBtn = document.getElementById('profilePictureBtn');
    const removePictureBtn = document.getElementById('profilePictureRemoveBtn');
    const pictureInput = document.getElementById('profilePictureInput');

    editBtn?.addEventListener('click', () => this._open());

    saveBtn?.addEventListener('click', () => this._save());
    pictureBtn?.addEventListener('click', () => pictureInput?.click());
    removePictureBtn?.addEventListener('click', () => this._removePicture());
    pictureInput?.addEventListener('change', () => this._uploadPicture());

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
    const removePictureBtn = document.getElementById('profilePictureRemoveBtn');
    if (removePictureBtn) {
      removePictureBtn.hidden = !window.ASDCAuthUser?.profile_image_url;
    }
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

  async _uploadPicture () {
    const input = document.getElementById('profilePictureInput');
    const button = document.getElementById('profilePictureBtn');
    const file = input?.files && input.files[0];
    if (!file) return;

    const form = new FormData();
    form.append('profile_picture', file);
    if (button) button.disabled = true;
    try {
      const data = await apiFetch('../backend/api/auth/profile-picture.php', {
        method: 'POST',
        body: form,
      });
      window.ASDCAuthUser = Object.assign({}, window.ASDCAuthUser, data);
      this._paintAvatars(window.ASDCAuthUser);
      await refreshAfterPatientAction();
      this._showNote('Profile picture updated.', false);
      showToast('Profile picture updated.');
      const removePictureBtn = document.getElementById('profilePictureRemoveBtn');
      if (removePictureBtn) removePictureBtn.hidden = false;
    } catch (error) {
      this._showNote(error.message || 'Unable to update profile picture.', true);
    } finally {
      if (button) button.disabled = false;
      if (input) input.value = '';
    }
  }

  async _removePicture () {
    const button = document.getElementById('profilePictureRemoveBtn');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
      const data = await apiFetch('../backend/api/auth/profile-picture.php', {
        method: 'DELETE',
      });
      window.ASDCAuthUser = Object.assign({}, window.ASDCAuthUser, data);
      this._paintAvatars(window.ASDCAuthUser);
      await refreshAfterPatientAction();
      this._showNote('Profile picture removed.', false);
      showToast('Profile picture removed.');
      if (button) button.hidden = true;
    } catch (error) {
      this._showNote(error.message || 'Unable to remove profile picture.', true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  _paintAvatars (user) {
    const avatarUser = {
      name: this.state.user.name,
      full_name: user?.full_name || this.state.user.name || '',
      initials: this.state.user.initials,
      profile_image_url: user?.profile_image_url || null
    };
    this.state.user.profile_image_url = avatarUser.profile_image_url;

    [
      'chipAvatar',
      'menuAvatar',
      'sideFootAvatar',
      'profileAvatar'
    ].forEach(id => {
      ASDC.HtmlHelpers.setAvatarElement(
        document.getElementById(id),
        avatarUser
      );
    });
  }

  _escape (value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
