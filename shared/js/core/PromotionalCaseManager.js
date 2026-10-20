/* Confidential case submissions, staff review, consent checks, and publication. */
window.ASDC = window.ASDC || {};
window.ASDC.PromotionalCaseManager = class PromotionalCaseManager {
  constructor () {
    this.cases = [];
    this.current = null;
    this.isReception = window.ASDCAuthUser?.role === 'receptionist';
    this.formModal = new Modal('caseFormModal');
    this.publishModal = new Modal('casePublishModal');
  }

  init () {
    if (!document.getElementById('promotionalCasesGrid')) return;
    this.formModal.registerClose(document.getElementById('caseFormClose'));
    this.formModal.registerClose(document.getElementById('caseFormCancel'));
    this.publishModal.registerClose(document.getElementById('casePublishClose'));
    this.publishModal.registerClose(document.getElementById('casePublishCancel'));
    document.getElementById('caseAddBtn')?.addEventListener('click', () => this.openForm());
    document.getElementById('caseFormSave')?.addEventListener('click', () => this.save());
    document.getElementById('casePublishConfirm')?.addEventListener('click', () => this.publish());
    document.getElementById('promotionalCasesGrid')?.addEventListener('click', event => this.onGridClick(event));
    const start = () => {
      this.isReception = window.ASDCAuthUser?.role === 'receptionist';
      const addButton = document.getElementById('caseAddBtn');
      if (addButton && !this.isReception) addButton.textContent = 'Submit Case';
      this.load();
    };
    if (window.ASDCAuthUser) start();
    else window.addEventListener('asdc:authenticated', start, { once: true });
  }

  async load () {
    const grid = document.getElementById('promotionalCasesGrid');
    if (!grid) return;
    grid.innerHTML = '<p class="empty-cell">Loading cases…</p>';
    try {
      const data = await apiFetch('../backend/api/cases/cases.php', { cache: 'no-store' });
      this.cases = Array.isArray(data.cases) ? data.cases : [];
      this.render();
    } catch (error) {
      grid.innerHTML = `<p class="form-note err">${escapeHtml(error.message || 'Could not load cases.')}</p>`;
    }
  }

  render () {
    const grid = document.getElementById('promotionalCasesGrid');
    if (!grid) return;
    if (!this.cases.length) {
      grid.innerHTML = `<p class="empty-cell">${this.isReception ? 'No case submissions yet.' : 'You have not submitted a case yet.'}</p>`;
      return;
    }
    grid.innerHTML = this.cases.map(item => {
      const id = Number(item.id);
      const status = String(item.status || 'draft');
      const image = (type, available) => Number(available)
        ? `<figure><img src="../backend/api/cases/image.php?id=${id}&image=${type}" alt="${type === 'before' ? 'Before treatment' : 'After treatment'} image for ${escapeHtml(item.title)}"><figcaption>${type === 'before' ? 'Before' : 'After'}</figcaption></figure>`
        : '';
      const images = Number(item.has_case_image)
        ? `<div class="case-images case-collage"><img src="../backend/api/cases/image.php?id=${id}&image=case" alt="Before-and-after collage for ${escapeHtml(item.title)}"></div>`
        : `<div class="case-images">${image('before', item.has_before_image)}${image('after', item.has_after_image)}</div>`;
      let actions = '';
      if (this.isReception) {
        actions = `<div class="case-actions">` +
          (status !== 'archived' ? `<button type="button" class="btn btn-outline btn-sm" data-case-action="edit" data-case-id="${id}">Edit</button>` : '') +
          (status === 'published'
            ? `<button type="button" class="btn btn-outline btn-sm" data-case-action="unpublish" data-case-id="${id}">Unpublish</button>`
            : status !== 'archived' ? `<button type="button" class="btn btn-gold btn-sm" data-case-action="publish" data-case-id="${id}">Review &amp; publish</button>` : '') +
          (status === 'published' ? `<button type="button" class="btn btn-outline btn-sm" data-case-action="${Number(item.is_featured) ? 'unfeature' : 'feature'}" data-case-id="${id}">${Number(item.is_featured) ? 'Remove from public section' : 'Feature publicly'}</button>` : '') +
          (status !== 'archived' ? `<button type="button" class="btn btn-outline btn-sm" data-case-action="archive" data-case-id="${id}">Archive</button>` : '') +
          `<button type="button" class="btn btn-danger btn-sm" data-case-action="delete" data-case-id="${id}">Delete</button>` +
          `</div>`;
      } else if (['draft','pending_review'].includes(status)) {
        actions = `<div class="case-actions"><button type="button" class="btn btn-outline btn-sm" data-case-action="edit" data-case-id="${id}">Revise submission</button></div>`;
      }
      const date = item.publication_date ? `Published ${escapeHtml(item.publication_date)}` : item.case_date ? `Case date ${escapeHtml(item.case_date)}` : 'Date not set';
      return `<article class="case-card">${images}` +
        `<div class="case-body"><div class="case-meta"><span class="tag tag-${this.statusColor(status)}">${escapeHtml(status.replace('_',' '))}</span><span>${escapeHtml(item.category)}</span></div>` +
        `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><small>${date}</small>${this.isReception && status === 'published' ? `<small>${Number(item.is_featured) ? 'Shown publicly' : 'Not selected for public display'}</small>` : ''}${actions}</div></article>`;
    }).join('');
  }

  statusColor (status) {
    return status === 'published' ? 'green' : status === 'pending_review' ? 'amber' : status === 'archived' ? 'red' : 'blue';
  }

  openForm (item = null) {
    this.current = item;
    document.getElementById('caseFormTitle').textContent = item ? (this.isReception ? 'Edit Case' : 'Revise Case Submission') : (this.isReception ? 'New Case' : 'Submit a Case for Review');
    document.getElementById('caseTitle').value = item?.title || '';
    document.getElementById('caseCategory').value = item?.category || '';
    document.getElementById('caseDescription').value = item?.description || '';
    document.getElementById('caseDate').value = item?.case_date || '';
    document.getElementById('caseImage').value = '';
    document.getElementById('caseImageHelp').textContent = item?.has_case_image ? 'A collage is already saved. Choose a new image to replace it.' : 'Upload one image file with the before and after panels arranged together.';
    document.getElementById('caseFormNote').hidden = true;
    document.getElementById('caseFormSaveLabel').textContent = this.isReception ? 'Save Draft' : 'Send for Review';
    this.formModal.open(document.getElementById('caseAddBtn'));
  }

  async save () {
    const button = document.getElementById('caseFormSave');
    const note = document.getElementById('caseFormNote');
    const form = new FormData();
    form.append('title', document.getElementById('caseTitle').value.trim());
    form.append('category', document.getElementById('caseCategory').value);
    form.append('description', document.getElementById('caseDescription').value.trim());
    form.append('case_date', document.getElementById('caseDate').value);
    if (this.current) form.append('case_id', Number(this.current.id));
    const caseImage = document.getElementById('caseImage').files[0];
    if (caseImage) form.append('case_image', caseImage);
    button.disabled = true;
    try {
      await apiFetch('../backend/api/cases/cases.php', { method: 'POST', body: form });
      this.formModal.close();
      await this.load();
      window.dispatchEvent(new Event('asdc:mutation'));
      showToast(this.isReception ? 'Case saved as a draft' : 'Case sent to reception for review');
    } catch (error) {
      note.textContent = error.message || 'Could not save this case.';
      note.classList.add('err');
      note.hidden = false;
    } finally { button.disabled = false; }
  }

  onGridClick (event) {
    const button = event.target.closest('[data-case-action]');
    if (!button) return;
    const item = this.cases.find(row => String(row.id) === button.dataset.caseId);
    if (!item) return;
    const action = button.dataset.caseAction;
    if (action === 'edit') return this.openForm(item);
    if (action === 'publish') {
      this.current = item;
      document.getElementById('casePublishConsent').checked = false;
      document.getElementById('casePublishNote').hidden = true;
      return this.publishModal.open(button);
    }
    this.mutate(item, action, button);
  }

  async mutate (item, action, button) {
    if (action === 'delete' && !window.confirm(`Permanently delete "${item.title}" and its promotional image? This cannot be undone.`)) return;
    button.disabled = true;
    try {
      await apiFetch('../backend/api/cases/cases.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: Number(item.id), action })
      });
      await this.load();
      window.dispatchEvent(new Event('asdc:mutation'));
    } catch (error) { showToast(error.message || 'Could not update case.', 'error'); }
    finally { button.disabled = false; }
  }

  async publish () {
    const button = document.getElementById('casePublishConfirm');
    const note = document.getElementById('casePublishNote');
    if (!document.getElementById('casePublishConsent').checked) {
      note.textContent = 'Confirm documented permission and review before publishing.';
      note.classList.add('err');
      note.hidden = false;
      return;
    }
    if (!this.current) return;
    button.disabled = true;
    try {
      await apiFetch('../backend/api/cases/cases.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: Number(this.current.id), action: 'publish', consent_confirmed: 1 })
      });
      this.publishModal.close();
      await this.load();
      window.dispatchEvent(new Event('asdc:mutation'));
      showToast('Case approved and published');
    } catch (error) {
      note.textContent = error.message || 'Could not publish this case.';
      note.classList.add('err');
      note.hidden = false;
    } finally { button.disabled = false; }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('promotionalCasesGrid')) {
    window.promotionalCaseManager = new window.ASDC.PromotionalCaseManager();
    window.promotionalCaseManager.init();
  }
});
