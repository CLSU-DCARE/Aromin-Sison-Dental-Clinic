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
    initNotifications({
      triggerId: 'notifBtn',
      panelId: 'notifPanel',
      listId: 'notifList',
      badgeId: 'notifBadge',
      markAllId: 'notifMarkAll',
      emptyId: 'notifEmpty',
      notifications: AdminMock.notifications,
      storageKey: 'asdc.notif.dentist',
      onSelect: function(n){
        ASDC._toast.show('Opening: ' + n.title + ' (mock)');
      }
    });
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
    var records = AdminMock.records || [];
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

    var current = null; // { contractId, pid, name }

    document.getElementById('patientsBody').addEventListener('click', function(e){
      var btn = e.target.closest('[data-action="update-progress"]');
      if (!btn) return;
      var contract = ContractStore.byId(btn.dataset.contractId);
      if (!contract) return;
      current = { contractId: contract.id, pid: contract.pid, name: contract.name };
      document.getElementById('progressFormPatientLabel').textContent = contract.name + ' · ' + contract.id;
      var stageSelect = document.getElementById('pfStage');
      var activeStage = (contract.progress && contract.progress.stages || []).find(function(s){ return s.kind === 'active'; });
      stageSelect.value = activeStage ? activeStage.name : 'Consultation & Records';
      document.getElementById('pfPercent').value = contract.progress ? contract.progress.pct : 0;
      document.getElementById('pfNote').value = contract.progress ? contract.progress.description : '';
      document.getElementById('pfNext').value = contract.progress ? contract.progress.next : '';
      var note = document.getElementById('progressFormNote');
      note.hidden = true;
      modal.open(btn);
    });

    // The dentist's stage picker walks a fixed treatment sequence: every
    // stage before the chosen one is "done", the chosen one is "active",
    // everything after is "upcoming" — same convention Patient's Braces
    // Progress view already renders.
    var STAGE_ORDER = ['Consultation & Records', 'Braces Placement', 'Adjustment Phase', 'Retainer Fitting', 'Debonding & Retention'];

    document.getElementById('progressFormSave').addEventListener('click', function(){
      if (!current) return;
      var note = document.getElementById('progressFormNote');
      if (!current.pid) {
        note.textContent = 'This patient isn\'t linked to a patient account yet, so this update won\'t be visible to them.';
        note.classList.add('err'); note.classList.remove('ok');
        note.hidden = false;
      }
      var stageName = document.getElementById('pfStage').value;
      var pct = Math.max(0, Math.min(100, Number(document.getElementById('pfPercent').value) || 0));
      var description = document.getElementById('pfNote').value.trim();
      var next = document.getElementById('pfNext').value.trim();
      var stageIdx = STAGE_ORDER.indexOf(stageName);
      var stages = STAGE_ORDER.map(function(name, i){
        var kind = i < stageIdx ? 'done' : (i === stageIdx ? 'active' : 'upcoming');
        return { kind: kind, num: String(i + 1), name: name, date: kind === 'done' ? 'Complete' : (kind === 'active' ? 'Ongoing' : 'Upcoming') };
      });

      ContractStore.updateProgress(current.pid, {
        pct: pct,
        monthLabel: stageName,
        heading: pct >= 100 ? 'Treatment complete' : 'Your treatment is progressing well',
        description: description || 'Your dentist updated your treatment progress.',
        next: next || 'Your dentist will confirm your next adjustment date at your next visit.',
        stages: stages
      });

      if (current.pid) {
        PatientNotify.push(current.pid, {
          kind: 'contract',
          title: 'Treatment progress updated',
          desc: 'Dr. updated your braces progress: ' + stageName + ' (' + pct + '%).'
        });
      }

      modal.close();
      self._applyPatients();
      showToast('Progress updated for ' + current.name);
      current = null;
    });
  };

  DentistDashboard.prototype._applyPatients = function(){
    // The Patients view here shows braces CONTRACTS (Treatment Plan / Monthly
    // / Paid / Balance columns) — ContractStore is the shared source of
    // truth for those, kept in sync with what Admin and the patient's own
    // dashboard see, instead of a dentist-only copy of the numbers.
    var contracts = ContractStore.all().map(function(c){
      return {
        id: c.id, pid: c.pid, initials: c.initials, name: c.name,
        plan: c.plan, monthly: ContractStore.peso(c.monthly),
        paid: ContractStore.peso(c.paid), balance: ContractStore.peso(c.balance),
        status: c.status, tag: c.tag,
        progressPct: c.progress ? c.progress.pct : 0
      };
    });
    var filtered;
    if (this.patientsFilter === 'All') filtered = contracts;
    else if (this.patientsFilter === 'Active') filtered = contracts.filter(function(c){ return c.status !== 'Completed'; });
    else filtered = contracts.filter(function(c){ return c.status === this.patientsFilter; }.bind(this));
    this._renderPatients(filtered);
  };

  DentistDashboard.prototype._renderAll = function(){
    var user = AdminMock.user;
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
    if (statsGrid) statsGrid.innerHTML = AdminMock.dashboard.stats.map(ASDC.HtmlHelpers.statCard).join('');

    this._renderQueue(AdminMock.dashboard.queue);
    this._applyPatients();
    this._applyRecords();
  };

  DentistDashboard.prototype._renderQueue = function(queue){
    var tbody = document.getElementById('dashQueueBody');
    if (!tbody) return;
    var inClinic = queue.filter(function(q){ return q.status === 'In chair' || q.status === 'Waiting'; }).length;
    var tag = document.getElementById('dashQueueTag');
    if (tag) tag.textContent = inClinic + ' in clinic';
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
      return '<tr><td>' + ASDC.HtmlHelpers.nameCell(p.initials, p.name, p.id) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.plan || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.monthly || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.paid || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(p.balance) + '</td><td>' + ASDC.HtmlHelpers.statusTag(p) + '</td><td>' + (p.progressPct || 0) + '%</td><td><button class="btn btn-outline btn-sm" data-action="update-progress" data-contract-id="' + p.id + '" data-pid="' + (p.pid || '') + '">Update Progress</button></td></tr>';
    }).join('');
  };

  DentistDashboard.prototype._renderRecords = function(records){
    var tbody = document.getElementById('recordsBody');
    if (!tbody) return;
    if (!records.length){
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No treatment records found.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(function(r){
      return '<tr><td>' + ASDC.HtmlHelpers.nameCell(r.initials || '', r.name, r.dentist || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(r.category) + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(r.procedure || r.details || '') + '</td><td>' + ASDC.HtmlHelpers.escapeHtml(r.date) + '</td></tr>';
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
    var setLabel = function(text){
      ['dashWeekLabel', 'apptWeekLabel'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.textContent = text;
      });
    };
    var fallback = function(){
      self._renderWeekGrid('apptWeekGrid', AdminMock.dashboard.week);
      self._renderWeekGrid('dashWeekGrid', AdminMock.dashboard.week);
      setLabel(AdminMock.dashboard.weekLabel || 'This week');
    };
    fetch('../backend/api/appointments/week.php').then(function(res){
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    }).then(function(data){
      if (data.success && data.week){
        self._renderWeekGrid('apptWeekGrid', data.week);
        self._renderWeekGrid('dashWeekGrid', data.week);
        setLabel(data.week.label || 'This week');
      } else { fallback(); }
    }).catch(function(){ fallback(); });
  };

  ns.DentistDashboard = DentistDashboard;

})(ASDC);
