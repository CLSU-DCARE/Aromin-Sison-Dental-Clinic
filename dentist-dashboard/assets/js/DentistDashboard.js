/* =====================================================================
   DentistDashboard - Orchestrator for the dentist dashboard view
   Manages view switching, data rendering, and filter wiring.
   Replaces the inline logic formerly in dentist.js.
   ================================================================= */

if (typeof window !== 'undefined') !window.ASDC && (window.ASDC = {});

(function(ns){
  'use strict';

  const VIEW_META = {
    dashboard:    { title: 'Dashboard',          crumb: 'Overview' },
    patients:     { title: 'Patients',           crumb: 'Patients' },
    braces:       { title: 'Braces Contracts',   crumb: 'Patients' },
    records:      { title: 'Treatment Records',  crumb: 'Records' },
    archived:     { title: 'Archived Patients',  crumb: 'Patients' },
    reports:      { title: 'Attendance Reports', crumb: 'Reports' },
    appointments: { title: 'Appointments',       crumb: 'Scheduling' }
  };

  function DentistDashboard(){
    this.viewButtons = document.querySelectorAll('.nav-item[data-view]');
    this.viewSections = document.querySelectorAll('.view');
    this.viewTitle = document.getElementById('viewTitle');
    this.viewCrumb = document.getElementById('viewCrumb');
    this.recordsFilter = 'All';
    this.patientsFilter = 'All';
    this.bracesFilter = 'All';
    this.reportPeriod = 'this_week';
    this.archivedPatients = [];
    this.appointmentScheduler = null;
    this.appointmentActions = null;
  }

  DentistDashboard.prototype.init = function(){
    this._wireViewSwitching();
    this._initCore();
    this._initNotifications();
    this._initUserMenu();
    this._wireStatCards();
    this._wireRecordsFilter();
    this._wirePatientsFilter();
    this._wireBracesFilter();
    this._wireReportPeriod();
    this._wireArchiveView();
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
      if (viewKey === 'archived') self._loadArchivedPatients();
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
if (inboxEmpty) inboxEmpty.textContent = 'Loading notifications...';
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
    // values are singular ("Treatment"/"Protocol") - map them, or every
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

  DentistDashboard.prototype._wireBracesFilter = function(){
    var self = this;
    var group = document.querySelector('#view-braces .toolbar-left');
    if (!group) return;
    new ASDC.FilterChipGroup(group, function(label){
      self.bracesFilter = label;
      self._applyBracesContracts();
    });
  };

  DentistDashboard.prototype._wireReportPeriod = function(){
    var self = this;
    var group = document.querySelector('#view-reports [aria-label="Report period"]');
    if (!group) return;
    new ASDC.FilterChipGroup(group, function(label){
      self.reportPeriod = { 'This week': 'this_week', 'Last week': 'last_week', 'This month': 'this_month' }[label] || 'this_week';
      self._renderReports(self.snapshot?.reports || AdminState.reports);
    });
  };

  DentistDashboard.prototype._wireArchiveView = function(){
    var self = this;
    document.getElementById('refreshArchivedBtn')?.addEventListener('click', function(){
      self._loadArchivedPatients();
    });
    document.getElementById('archivedPatientsBody')?.addEventListener('click', function(event){
      var view = event.target.closest('[data-archive-view]');
      if (view) self._openArchivedDetails(view.dataset.archiveView);
    });
  };

  DentistDashboard.prototype._archivedName = function(patient){
    return [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim() || ('#P-' + patient.patient_id);
  };

  DentistDashboard.prototype._loadArchivedPatients = function(){
    var self = this;
    var tbody = document.getElementById('archivedPatientsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Loading archived patients...</td></tr>';
    return apiFetch('../backend/api/patients/archived.php', { cache: 'no-store' })
      .then(function(data){
        self.archivedPatients = Array.isArray(data.patients) ? data.patients : [];
        self._renderArchivedPatients();
      })
      .catch(function(error){
        tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Unable to load archived patients.</td></tr>';
        showToast(error.message, 'error');
      });
  };

  DentistDashboard.prototype._renderArchivedPatients = function(){
    var self = this;
    var tbody = document.getElementById('archivedPatientsBody');
    if (!tbody) return;
    if (!this.archivedPatients.length){
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No archived patients assigned to you.</td></tr>';
      return;
    }
    tbody.innerHTML = this.archivedPatients.map(function(patient){
      var name = self._archivedName(patient);
      var retained = [
        Number(patient.appointment_count || 0) + ' appt',
        Number(patient.record_count || 0) + ' record',
        Number(patient.contract_count || 0) + ' contract',
        Number(patient.payment_count || 0) + ' payment',
        Number(patient.notification_count || 0) + ' notice'
      ].join(' - ');
      return '<tr>' +
        '<td>' + ASDC.HtmlHelpers.nameCell('', name, '#P-' + Number(patient.patient_id)) + '</td>' +
        '<td>' + ASDC.HtmlHelpers.escapeHtml(patient.archived_at || '') + '</td>' +
        '<td>' + ASDC.HtmlHelpers.escapeHtml(retained) + '</td>' +
        '<td>' + ASDC.HtmlHelpers.escapeHtml(patient.archived_by_name || 'System') + '</td>' +
        '<td><button class="btn btn-outline btn-sm" data-archive-view="' + Number(patient.patient_id) + '">View</button></td>' +
      '</tr>';
    }).join('');
  };

  DentistDashboard.prototype._renderArchivedDetails = function(data){
    var panel = document.getElementById('archivedDetailPanel');
    var title = document.getElementById('archivedDetailTitle');
    var body = document.getElementById('archivedDetailBody');
    if (!panel || !title || !body || !data.patient) return;
    var name = this._archivedName(data.patient);
    title.textContent = name + ' - #P-' + data.patient.patient_id;
    var groups = [
      ['Appointments', data.appointments, function(item){ return item.scheduled_date + ' ' + String(item.scheduled_time).slice(0, 5) + ' - ' + item.service_type + ' - ' + item.status; }],
      ['Treatment Records', data.records, function(item){ return item.date_recorded + ' - ' + (item.treatment_given || item.treatment_protocol || item.diagnosis || 'Clinical record'); }],
      ['Braces Contracts', data.contracts, function(item){ return '#B-' + item.contract_id + ' - ' + item.status + ' - ' + ContractFormat.peso(item.balance_amount || 0) + ' balance'; }],
      ['Payments', data.payments, function(item){ return ContractFormat.peso(item.amount_paid || 0) + ' - ' + item.status + ' - ' + (item.payment_date || item.created_at || ''); }],
      ['Notifications', data.notifications, function(item){ return item.title + ' - ' + (item.created_at || ''); }]
    ];
    body.innerHTML = '<div class="detail-grid">' +
      '<div class="row"><span>Archived</span><span>' + ASDC.HtmlHelpers.escapeHtml(data.patient.archived_at || '') + '</span></div>' +
      '<div class="row"><span>Archived By</span><span>' + ASDC.HtmlHelpers.escapeHtml(data.patient.archived_by_name || 'System') + '</span></div>' +
      '<div class="row"><span>Retention</span><span>' + ASDC.HtmlHelpers.escapeHtml(data.patient.retention_note || '') + '</span></div>' +
    '</div>' + groups.map(function(group){
      var label = group[0], rows = Array.isArray(group[1]) ? group[1] : [], format = group[2];
      return '<h4>' + ASDC.HtmlHelpers.escapeHtml(label) + ' (' + rows.length + ')</h4>' +
        (rows.length
          ? '<ul class="archive-detail-list">' + rows.map(function(row){ return '<li>' + ASDC.HtmlHelpers.escapeHtml(format(row)) + '</li>'; }).join('') + '</ul>'
          : '<p class="empty-cell">None retained in this category.</p>');
    }).join('');
    panel.hidden = false;
  };

  DentistDashboard.prototype._openArchivedDetails = function(patientId){
    var self = this;
    apiFetch('../backend/api/patients/archived.php?patient_id=' + encodeURIComponent(patientId), { cache: 'no-store' })
      .then(function(data){ self._renderArchivedDetails(data); })
      .catch(function(error){ showToast(error.message, 'error'); });
  };

  DentistDashboard.prototype._wireStatCards = function(){
    var self = this;
    var grid = document.getElementById('dashStats');
    if (!grid) return;
    grid.addEventListener('click', function(event){
      var card = event.target.closest('[data-stat-target]');
      if (card) self._switchView(card.dataset.statTarget);
    });
    grid.addEventListener('keydown', function(event){
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var card = event.target.closest('[data-stat-target]');
      if (!card) return;
      event.preventDefault();
      self._switchView(card.dataset.statTarget);
    });
  };

  DentistDashboard.prototype._renderStats = function(){
    var grid = document.getElementById('dashStats');
    if (!grid) return;
    var targets = ['appointments', 'patients', 'patients', 'patients'];
    grid.innerHTML = AdminState.dashboard.stats.map(function(stat, index){
      var target = targets[index] || 'dashboard';
      return ASDC.HtmlHelpers.statCard(stat).replace(
        'class="stat-card"',
        'class="stat-card stat-card-link" role="button" tabindex="0" data-stat-target="' + target + '" aria-label="Open ' + ASDC.HtmlHelpers.escapeHtml(stat.label) + '"'
      );
    }).join('');
  };

  DentistDashboard.prototype._bindProgressModal = function(){
    var self = this;
    var modal = new ASDC.Modal('progressFormModal');
    if (!modal.modal) return;
    modal.registerClose(document.getElementById('progressFormClose'));
    modal.registerClose(document.getElementById('progressFormCancel'));

    var current = null; // { contractId, contractNumericId, pid, name }

    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-action="update-progress"]');
      if (!btn) return;
      var contract = (self._contractsRaw || []).filter(function(c){ return c.id === btn.dataset.contractId; })[0];
      if (!contract) return;
      current = {
        contractId: contract.id,
        contractNumericId: contract.contract_id || Number(contract.id.replace('#B-', '')),
        pid: contract.pid, name: contract.name
      };
      document.getElementById('progressFormPatientLabel').textContent = contract.name + ' - ' + contract.id;
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
        self._applyBracesContracts();
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
        if (!contracts.some(c => c.pid === '#P-' + p.patient_id)) contracts.push({ id: '#P-' + p.patient_id, pid: '#P-' + p.patient_id, initials: '', name: p.first_name + ' ' + p.last_name, plan: 'No braces contract', monthly: '-', paid: '-', balance: '-', dueDate: '-', status: 'No contract', tag: 'green', progressPct: null });
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
    var currentUser = {
      name: user.name,
      full_name: user.name,
      initials: user.initials,
      profile_image_url: window.ASDCAuthUser && window.ASDCAuthUser.profile_image_url
    };
    ['sideFootAvatar', 'chipAvatar', 'menuAvatar'].forEach(function(id) {
      ASDC.HtmlHelpers.setAvatarElement(document.getElementById(id), currentUser);
    });
    this._set('sideFootName', user.name);
    this._set('sideFootRole', 'Dentist');
    this._set('menuName', user.name);
    this._set('menuRole', 'Dentist');
    this._set('greetingText', user.greeting);
    this._set('greetingSubtext', user.name + ' - Dentist');

    this._renderStats();

    this._renderQueue(AdminState.dashboard.queue);
    this._applyPatients();
    this._applyBracesContracts();
    this._applyRecords();
    this._renderReports(AdminState.reports);
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
      return '<tr><td>' + ASDC.HtmlHelpers.nameCell(p.initials, p.name, p.id) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.plan || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.monthly || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.paid || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.balance) + '</td><td>' + ASDC.HtmlHelpers.statusTag(p) + '</td><td>' + (p.progressPct === null ? '-' : p.progressPct + '%') + '</td><td>' + (p.progressPct === null ? '' : '<button class="btn btn-outline btn-sm" data-action="update-progress" data-contract-id="' + p.id + '" data-pid="' + (p.pid || '') + '">Update Progress</button>') + '</td></tr>';
    }).join('');
  };

  DentistDashboard.prototype._applyBracesContracts = function(){
    var self = this;
    var contracts = (self._contractsRaw || []).map(function(c){
      return {
        id: c.id,
        pid: c.pid,
        initials: c.initials,
        name: c.name,
        plan: c.plan,
        monthly: ContractFormat.peso(c.monthly),
        paid: ContractFormat.peso(c.paid),
        balance: ContractFormat.peso(c.balance),
        dueDate: c.dueDate || '-',
        status: c.status,
        tag: c.tag,
        progressPct: c.progress ? c.progress.pct : 0
      };
    });
    var filtered = self.bracesFilter === 'All'
      ? contracts
      : contracts.filter(function(c){ return c.status === self.bracesFilter; });
    self._renderBracesContracts(filtered);
  };

  DentistDashboard.prototype._renderBracesContracts = function(contracts){
    var tbody = document.getElementById('bracesContractsBody');
    if (!tbody) return;
    if (!contracts.length){
      tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No braces contracts match this filter.</td></tr>';
      return;
    }
    tbody.innerHTML = contracts.map(function(c){
      return '<tr><td>' + ASDC.HtmlHelpers.nameCell(c.initials, c.name, c.id) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(c.plan || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(c.monthly) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(c.paid) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(c.balance) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(c.dueDate) + '</td><td>' + ASDC.HtmlHelpers.statusTag(c) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(String(c.progressPct || 0)) + '%</td><td><button class="btn btn-outline btn-sm" data-action="update-progress" data-contract-id="' + c.id + '" data-pid="' + (c.pid || '') + '">Update Progress</button></td></tr>';
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
      var details = [r.diagnosis, r.treatment_protocol].filter(Boolean).map(function(text){
        return '<p>' + ASDC.HtmlHelpers.escapeHtml(text) + '</p>';
      }).join('');
      var summary = '<div class="record-summary-cell"><strong>' + ASDC.HtmlHelpers.escapeHtml(r.procedure || 'Treatment record') + '</strong>' +
        (details ? '<div class="record-detail-lines">' + details + '</div>' : '') + '</div>';
      var edit = '<button class="btn btn-outline btn-sm" data-edit-record="' + Number(r.record_id) + '">Edit</button>';
      return '<tr class="record-row"><td>' + ASDC.HtmlHelpers.nameCell(r.initials || '', r.name, r.dentist || '') + '</td><td><span class="tag tag-green">' + ASDC.HtmlHelpers.escapeHtml(r.category) + '</span></td><td>' + summary + '</td><td><div class="record-date-cell">' + ASDC.HtmlHelpers.escapeHtml(r.date) + edit + '</div></td></tr>';
    }).join('');
  };

  DentistDashboard.prototype._renderReports = function(reports){
    var grid = document.getElementById('reportStats');
    if (!grid) return;
    var fallback = { label: 'This Week', attended: 0, missed: 0, upcoming: 0, total: 0, attendance_rate: 0, missed_rate: 0, bars: [], rows: [] };
    var report = (reports && reports[this.reportPeriod]) || (reports && reports.this_week) || fallback;
    var stats = [
      {
        iconBg: 'rgba(92,122,92,0.12)',
        iconColor: 'var(--green)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 11 11 14 16 9"/><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
        num: String(report.attended || 0),
        label: 'Attended',
        trend: '',
        trendClass: ''
      },
      {
        iconBg: 'rgba(180,84,63,0.12)',
        iconColor: 'var(--red)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 12.4-6.7"/><path d="m17 17 4 4"/><path d="m21 17-4 4"/></svg>',
        num: String(report.missed || 0),
        label: 'Did not attend',
        trend: '',
        trendClass: ''
      },
      {
        iconBg: 'rgba(156,139,62,0.14)',
        iconColor: 'var(--gold)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m7 14 3-3 4 4 5-7"/></svg>',
        num: (report.attendance_rate || 0) + '%',
        label: 'Attendance rate',
        trend: '',
        trendClass: ''
      }
    ];
    grid.innerHTML = stats.map(ASDC.HtmlHelpers.statCard).join('');

    var set = function(id, value){ var el = document.getElementById(id); if (el) el.textContent = String(value); };
    set('reportHeading', 'Attendance: ' + (report.label || 'This Week'));
    set('reportRateTag', (report.missed_rate || 0) + '% did not attend');
    set('attendedCount', report.attended || 0);
    set('missedCount', report.missed || 0);
    set('upcomingCount', report.upcoming || 0);
    set('reportRecordCount', (report.rows || []).length + ' records');

    var donut = document.getElementById('attendanceDonut');
    if (donut) donut.style.setProperty('--attended', (report.attendance_rate || 0) + '%');

    var bars = document.getElementById('reportBars');
    if (bars){
      bars.innerHTML = (report.bars || []).map(function(b){
        var total = Number(b.attended || 0) + Number(b.missed || 0);
        var height = total ? Math.max(12, Math.round((Number(b.attended || 0) / total) * 100)) : 4;
        return '<div class="bar-col"><div class="bar attendance-bar" style="height:' + height + '%"><span>' + Number(b.attended || 0) + '/' + total + '</span></div><span class="bar-label">' + ASDC.HtmlHelpers.escapeHtml(b.day) + '</span></div>';
      }).join('');
    }

    var tbody = document.getElementById('attendanceReportBody');
    if (!tbody) return;
    var rows = report.rows || [];
    if (!rows.length){
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No attendance records for this period.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function(row){
      return '<tr>' +
        '<td>' + ASDC.HtmlHelpers.escapeHtml(row.patient || '') + '</td>' +
        '<td>' + ASDC.HtmlHelpers.escapeHtml(row.service || '') + '</td>' +
        '<td>' + ASDC.HtmlHelpers.escapeHtml((row.date || '') + ' ' + (row.time || '')) + '</td>' +
        '<td>' + ASDC.HtmlHelpers.escapeHtml(row.dentist || 'Unassigned') + '</td>' +
        '<td>' + ASDC.HtmlHelpers.statusTag({ status: row.status, tag: row.tag }) + '</td>' +
      '</tr>';
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
          ? '<div class="cell"><div class="appt-block' + (a.status === 'completed' ? ' appt-completed' : '') + '">' + a.name + ' <span class="t">' + a.t + '</span>' + (a.status === 'completed' ? '<span class="appt-status">Completed</span>' : '') + '</div></div>'
          : '<div class="cell"></div>';
      }).join('');
    }).join('');
    grid.innerHTML = header + body;
  };

  DentistDashboard.prototype._loadAppointments = function(){
    var self = this;
    this.appointmentScheduler = new AppointmentScheduler({
      apiBase: '../backend/api/appointments',
      onLoaded: state => {
        if (state.error) return;
        const week = ASDC.ScheduleView.week(state.start, state.appointments);
        self._renderWeekGrid('dashWeekGrid', week);
        self._renderQueue(ASDC.ScheduleView.queue(state.appointments));
        const label = document.getElementById('dashWeekLabel');
        if (label) label.textContent = week.label;
      }
    });
    this.appointmentActions = new AppointmentActions({ scheduler: this.appointmentScheduler });
    this.appointmentScheduler.init();
    this.appointmentActions.init();
    const apptGroup = document.querySelector('#view-appointments [aria-label="Filter schedule"]');
    if (apptGroup) new ASDC.FilterChipGroup(apptGroup, label => self.appointmentScheduler.setMode(label));

    document.getElementById('addClinicalRecord')?.addEventListener('click', () => { if (self.snapshot) ASDC.openClinicalForm(self.snapshot); });
    document.getElementById('recordsBody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-edit-record]');
      const record = self.snapshot?.records.find(r => Number(r.record_id) === Number(button?.dataset.editRecord));
      if (record) ASDC.openClinicalForm(self.snapshot, record);
    });
    window.staffLiveSync = ASDC.startPortalSync({ start: () => self.appointmentScheduler.state.start, apply: data => {
      self.snapshot = data;
      self._contractsRaw = data.contracts;
      AdminState.records = data.records;
      self._applyPatients(); self._applyBracesContracts(); self._applyRecords();
      self.inbox.setItems(data.notifications);
      AdminState.reports = data.reports || AdminState.reports;
      self._renderReports(AdminState.reports);
      self.appointmentScheduler.applySnapshot(data);
      const week = ASDC.ScheduleView.week(data.week.week_start, data.week.appointments);
      self._renderWeekGrid('dashWeekGrid', week);
      self._renderQueue(ASDC.ScheduleView.queue(data.week.appointments));
      ['dashWeekLabel'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = week.label; });
      AdminState.dashboard.stats.forEach((s,i) => { s.num = i === 2 ? ContractFormat.peso(data.metrics[i]) : String(data.metrics[i]); });
      self._renderStats();
    }});
  };

  ns.DentistDashboard = DentistDashboard;

})(ASDC);
