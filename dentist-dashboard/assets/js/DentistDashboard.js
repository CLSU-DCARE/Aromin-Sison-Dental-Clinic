/* =====================================================================
   DentistDashboard — Orchestrator for the dentist dashboard view
   Manages view switching, data rendering, and filter wiring.
   Replaces the inline logic formerly in dentist.js.
   ================================================================= */

if (typeof window !== 'undefined') !window.ASDC && (window.ASDC = {});

(function(ns){
  'use strict';

  const VIEW_META = {
    dashboard:    { title: 'Dashboard',          crumb: 'Overview' },
    patients:     { title: 'Patients',           crumb: 'Patients' },
    records:      { title: 'Treatment Records',  crumb: 'Records' },
    appointments: { title: 'Appointments',       crumb: 'Scheduling' }
  };

  function DentistDashboard(){
    this.viewButtons = document.querySelectorAll('.nav-item[data-view]');
    this.viewSections = document.querySelectorAll('.view');
    this.viewTitle = document.getElementById('viewTitle');
    this.viewCrumb = document.getElementById('viewCrumb');
    this.recordsFilter = 'All';
    this.patientsFilter = 'All';
  }

  DentistDashboard.prototype.init = function(){
    this._wireViewSwitching();
    this._initCore();
    this._initNotifications();
    this._initUserMenu();
    this._wireRecordsFilter();
    this._wirePatientsFilter();
    this._bindProgressModal();
    this._renderAll();
    this._loadAppointments();
  };

  DentistDashboard.prototype._wireViewSwitching = function(){
    var self = this;
    this.viewButtons.forEach(function(btn){
      btn.addEventListener('click', function(){ self._switchView(btn.dataset.view); });
    });
  };

  DentistDashboard.prototype._switchView = function(viewKey){
    var target = document.getElementById('view-' + viewKey);
    if (!target || target.classList.contains('active')) return;

    this.viewButtons.forEach(function(b){
      var active = b.dataset.view === viewKey;
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    var meta = VIEW_META[viewKey] || { title: viewKey, crumb: '' };
    if (this.viewTitle) this.viewTitle.textContent = meta.title;
    if (this.viewCrumb) this.viewCrumb.textContent = meta.crumb;

    var current = document.querySelector('.view.active');
    var self = this;
    var swap = function(){
      self.viewSections.forEach(function(s){ s.classList.remove('active', 'view-leave'); });
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      ASDC._sidebar.close();
      ASDC._toast.show('Showing ' + meta.title);
    };
    if (current && current !== target){
      current.classList.add('view-leave');
      setTimeout(swap, 180);
    } else {
      swap();
    }
  };

  DentistDashboard.prototype._initCore = function(){
    ASDC._toast.initTriggers();
    ASDC._sidebar.init('asdc.dentist.sidebar.collapsed');
    ASDC._logout.init('../auth/login.html');
  };

  DentistDashboard.prototype._initNotifications = function(){
this.inbox = initNotifications({ triggerId: 'notifBtn', panelId: 'notifPanel', listId: 'notifList', badgeId: 'notifBadge', markAllId: 'notifMarkAll', emptyId: 'notifEmpty', notifications: [] });
const inboxEmpty = document.getElementById('notifEmpty');
if (inboxEmpty) inboxEmpty.textContent = 'Loading notifications…';
  };

  DentistDashboard.prototype._initUserMenu = function(){
    var userChip = document.getElementById('userChip');
    var userMenu = document.getElementById('userMenu');
    if (!userChip || !userMenu) return;
    userChip.addEventListener('click', function(){ ASDC._popover.toggle(userChip, userMenu); });
    var signOut = document.getElementById('menuSignOut');
    if (signOut){
      signOut.addEventListener('click', function(){
        ASDC._popover.close(userMenu);
        ASDC._logout.open(userChip);
      });
    }
  };

  DentistDashboard.prototype._wireRecordsFilter = function(){
    var self = this;
    var group = document.querySelector('#view-records .toolbar-left');
    if (!group) return;
    new ASDC.FilterChipGroup(group, function(label){
      self.recordsFilter = label;
      self._applyRecords();
    });
  };

  DentistDashboard.prototype._applyRecords = function(){
    var records = AdminState.records || [];
    // Chip labels are plural ("Treatments"/"Protocols") but record.category
    // values are singular ("Treatment"/"Protocol") — map them, or every
    // filter except "All" would always show zero results.
    var categoryMap = { Treatments: 'Treatment', Protocols: 'Protocol' };
    var category = categoryMap[this.recordsFilter] || this.recordsFilter;
    var filtered = category === 'All'
      ? records
      : records.filter(function(r){ return r.category === category; });
    this._renderRecords(filtered);
  };

  DentistDashboard.prototype._wirePatientsFilter = function(){
    var self = this;
    var group = document.querySelector('#view-patients .toolbar-left');
    if (!group) return;
    new ASDC.FilterChipGroup(group, function(label){
      self.patientsFilter = label;
      self._applyPatients();
    });
  };

  DentistDashboard.prototype._bindProgressModal = function(){
    var self = this;
    var modal = new ASDC.Modal('progressFormModal');
    if (!modal.modal) return;
    modal.registerClose(document.getElementById('progressFormClose'));
    modal.registerClose(document.getElementById('progressFormCancel'));

    var current = null; // { contractId, contractNumericId, pid, name }

    document.getElementById('patientsBody').addEventListener('click', function(e){
      var btn = e.target.closest('[data-action="update-progress"]');
      if (!btn) return;
      var contract = (self._contractsRaw || []).filter(function(c){ return c.id === btn.dataset.contractId; })[0];
      if (!contract) return;
      current = {
        contractId: contract.id,
        contractNumericId: contract.contract_id || Number(contract.id.replace('#B-', '')),
        pid: contract.pid, name: contract.name
      };
      document.getElementById('progressFormPatientLabel').textContent = contract.name + ' · ' + contract.id;
      var stageSelect = document.getElementById('pfStage');
      var progress = contract.progress || {};
      var currentStageName = progress.stage
        || ((progress.stages || []).filter(function(s){ return s.kind === 'active'; })[0] || {}).name
        || 'Consultation & Records';
      stageSelect.value = currentStageName;
      document.getElementById('pfPercent').value = progress.pct || 0;
      document.getElementById('pfNote').value = progress.note || progress.description || '';
      document.getElementById('pfNext').value = progress.next || '';
      var note = document.getElementById('progressFormNote');
      note.hidden = true;
      modal.open(btn);
    });

    document.getElementById('progressFormSave').addEventListener('click', function(){
      if (!current) return;
      var note = document.getElementById('progressFormNote');
      var stageName = document.getElementById('pfStage').value;
      var pct = Math.max(0, Math.min(100, Number(document.getElementById('pfPercent').value) || 0));
      var description = document.getElementById('pfNote').value.trim();
      var next = document.getElementById('pfNext').value.trim();
      var saveBtn = document.getElementById('progressFormSave');
      saveBtn.classList.add('loading');
      saveBtn.disabled = true;

      var afterSave = function(){
        modal.close();
        self._applyPatients();
        showToast('Progress updated for ' + current.name);
        current = null;
        saveBtn.classList.remove('loading');
        saveBtn.disabled = false;
      };

        apiFetch('../backend/api/contracts/progress.php', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_id: current.contractNumericId,
            current_stage: stageName,
            progress_pct: pct,
            progress_note: description,
            next_note: next
          })
        }).then(afterSave).catch(function(error){
          note.textContent = error.message;
          note.classList.add('err'); note.classList.remove('ok');
          note.hidden = false;
          saveBtn.classList.remove('loading');
          saveBtn.disabled = false;
        });
    });
  };

  DentistDashboard.prototype._applyPatients = function(){
    var self = this;
      var contracts = (self._contractsRaw || []).map(function(c){
        return {
          id: c.id, pid: c.pid, initials: c.initials, name: c.name,
          plan: c.plan, monthly: ContractFormat.peso(c.monthly),
          paid: ContractFormat.peso(c.paid), balance: ContractFormat.peso(c.balance),
          status: c.status, tag: c.tag,
          progressPct: c.progress ? c.progress.pct : 0
        };
      });
      (self.snapshot?.patients || []).forEach(function(p) {
        if (!contracts.some(c => c.pid === '#P-' + p.patient_id)) contracts.push({ id: '#P-' + p.patient_id, pid: '#P-' + p.patient_id, initials: '', name: p.first_name + ' ' + p.last_name, plan: 'No braces contract', monthly: '—', paid: '—', balance: '—', status: 'No contract', tag: 'green', progressPct: null });
      });
      var filtered;
      if (self.patientsFilter === 'All') filtered = contracts;
      else if (self.patientsFilter === 'Active') filtered = contracts.filter(function(c){ return c.status !== 'Completed'; });
      else filtered = contracts.filter(function(c){ return c.status === self.patientsFilter; });
      self._renderPatients(filtered);
  };

  DentistDashboard.prototype._renderAll = function(){
    var user = AdminState.user;
    this._set = function(id, value){ var el = document.getElementById(id); if (el) el.textContent = value; };
    this._set('sideFootAvatar', user.initials);
    this._set('sideFootName', user.name);
    this._set('sideFootRole', 'Dentist');
    this._set('chipAvatar', user.initials);
    this._set('menuAvatar', user.initials);
    this._set('menuName', user.name);
    this._set('menuRole', 'Dentist');
    this._set('greetingText', user.greeting);
    this._set('greetingSubtext', user.name + ' · Dentist');

    var statsGrid = document.getElementById('dashStats');
    if (statsGrid) statsGrid.innerHTML = AdminState.dashboard.stats.map(ASDC.HtmlHelpers.statCard).join('');

    this._renderQueue(AdminState.dashboard.queue);
    this._applyPatients();
    this._applyRecords();
  };

  DentistDashboard.prototype._renderQueue = function(queue){
    var tbody = document.getElementById('dashQueueBody');
    if (!tbody) return;
    var inClinic = queue.length;
    var tag = document.getElementById('dashQueueTag');
    if (tag) tag.textContent = inClinic + ' today';
    if (!queue.length){
      tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">No patients in the queue right now.</td></tr>';
      return;
    }
    tbody.innerHTML = queue.map(function(q){
      return '<tr><td>' + ASDC.HtmlHelpers.nameCell(q.initials, q.name, q.sub) + '</td><td>' + q.time + '</td><td>' + ASDC.HtmlHelpers.statusTag(q) + '</td></tr>';
    }).join('');
  };

  DentistDashboard.prototype._renderPatients = function(patients){
    var tbody = document.getElementById('patientsBody');
    if (!tbody) return;
    if (!patients.length){
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No patients to display.</td></tr>';
      return;
    }
    tbody.innerHTML = patients.map(function(p){
      return '<tr><td>' + ASDC.HtmlHelpers.nameCell(p.initials, p.name, p.id) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.plan || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.monthly || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.paid || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.balance) + '</td><td>' + ASDC.HtmlHelpers.statusTag(p) + '</td><td>' + (p.progressPct === null ? '—' : p.progressPct + '%') + '</td><td>' + (p.progressPct === null ? '' : '<button class="btn btn-outline btn-sm" data-action="update-progress" data-contract-id="' + p.id + '" data-pid="' + (p.pid || '') + '">Update Progress</button>') + '</td></tr>';
    }).join('');
  };

  DentistDashboard.prototype._renderRecords = function(records){
    var tbody = document.getElementById('recordsBody');
    if (!tbody) return;
    if (!records.length){
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No treatment records match this filter.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(function(r){
      return '<tr><td>' + ASDC.HtmlHelpers.nameCell(r.initials || '', r.name, r.dentist || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(r.category) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml([r.diagnosis, r.procedure, r.treatment_protocol].filter(Boolean).join(' · ')) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(r.date) + (Number(r.dentist_id) === Number(window.ASDCAuthUser?.user_id) ? '<button class="btn btn-outline btn-sm" data-edit-record="' + Number(r.record_id) + '">Edit</button>' : '') + '</td></tr>';
    }).join('');
  };

  DentistDashboard.prototype._renderWeekGrid = function(containerId, week){
    var grid = document.getElementById(containerId);
    if (!grid) return;
    var header = [''].concat(week.days).map(function(d){
      return '<div class="cell' + (d ? ' head' : '') + '">' + d + '</div>';
    }).join('');
    var body = week.rows.map(function(row){
      return '<div class="cell time">' + row.time + '</div>' + row.appts.map(function(a){
        return a
          ? '<div class="cell"><div class="appt-block">' + a.name + ' <span class="t">' + a.t + '</span></div></div>'
          : '<div class="cell"></div>';
      }).join('');
    }).join('');
    grid.innerHTML = header + body;
  };

  DentistDashboard.prototype._loadAppointments = function(){
    var self = this;
    const weekInput = document.getElementById('dentistWeekStart');
    weekInput?.addEventListener('change', () => { self.weekStart = weekInput.value; window.staffLiveSync.refetch(); });
    document.getElementById('addClinicalRecord')?.addEventListener('click', () => { if (self.snapshot) ASDC.openClinicalForm(self.snapshot); });
    document.getElementById('recordsBody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-edit-record]');
      const record = self.snapshot?.records.find(r => Number(r.record_id) === Number(button?.dataset.editRecord));
      if (record) ASDC.openClinicalForm(self.snapshot, record);
    });
    window.staffLiveSync = ASDC.startPortalSync({ start: () => self.weekStart || '', apply: data => {
      self.snapshot = data;
      if (weekInput) weekInput.value = data.week.week_start;
      self._contractsRaw = data.contracts;
      AdminState.records = data.records;
      self._applyPatients(); self._applyRecords();
      self.inbox.setItems(data.notifications);
      const week = ASDC.ScheduleView.week(data.week.week_start, data.week.appointments);
      self._renderWeekGrid('apptWeekGrid', week); self._renderWeekGrid('dashWeekGrid', week);
      self._renderQueue(ASDC.ScheduleView.queue(data.week.appointments));
      ['dashWeekLabel','apptWeekLabel'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = week.label; });
      AdminState.dashboard.stats.forEach((s,i) => { s.num = i === 2 ? ContractFormat.peso(data.metrics[i]) : String(data.metrics[i]); });
      document.getElementById('dashStats').innerHTML = AdminState.dashboard.stats.map(ASDC.HtmlHelpers.statCard).join('');
      ASDC.renderDentistActions(document.getElementById('dentistAppointmentActions'), data);
    }});
  };

  ns.DentistDashboard = DentistDashboard;

})(ASDC);
