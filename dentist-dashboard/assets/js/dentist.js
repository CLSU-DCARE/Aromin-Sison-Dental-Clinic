/* =====================================================================
   Aromin-Sison Dental Clinic: Dentist Dashboard
   Orchestrator init - delegates to ASDC.DentistDashboard class.
   ================================================================= */

(function(){
  'use strict';
  var dashboard = new ASDC.DentistDashboard();
  dashboard.init();
  window.switchView = function(view){ dashboard._switchView(view); };
})();
