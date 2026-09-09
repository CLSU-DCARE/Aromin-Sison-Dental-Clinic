/* =====================================================================
   CtaBookingForm — Handles the CTA booking form submission on public pages
   Posts to the public appointment-requests endpoint with loading state.
   ================================================================= */

(function(){
  'use strict';

  var ctaForm = document.getElementById('ctaForm');
  if (!ctaForm) return;

  var ctaDate = document.getElementById('ctaDate');
  if (ctaDate){
    var today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    ctaDate.min = today.toISOString().split('T')[0];
  }

  function showNote(message, kind){
    var note = document.getElementById('ctaNote');
    if (!note) return;
    note.textContent = message;
    note.classList.toggle('ok', kind === 'ok');
    note.classList.toggle('err', kind === 'err');
    note.hidden = false;
  }

  ctaForm.addEventListener('submit', function(e){
    e.preventDefault();
    var service = document.getElementById('ctaService');
    var btn = document.getElementById('ctaSubmit');

    if (!service || !service.value){
      showNote('Please choose a service.', 'err');
      if (service) service.focus();
      return;
    }
    if (!ctaDate || !ctaDate.value){
      showNote('Please pick a preferred date.', 'err');
      if (ctaDate) ctaDate.focus();
      return;
    }

    var note = document.getElementById('ctaNote');
    if (note) note.hidden = true;
    btn.classList.add('is-loading');
    btn.disabled = true;

    fetch('../backend/api/public/appointment-requests.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        first_name: document.getElementById('ctaFirstName').value,
        last_name: document.getElementById('ctaLastName').value,
        contact_number: document.getElementById('ctaContact').value,
        email: document.getElementById('ctaEmail').value,
        service_type: service.value,
        requested_date: ctaDate.value,
        requested_time: document.getElementById('ctaTime').value
      })
    }).then(function(res){
      return res.json().then(function(payload){
        if (!res.ok) throw new Error(payload.error && payload.error.message || 'Unable to submit booking.');
        btn.classList.remove('is-loading');
        btn.disabled = false;
        showNote('Request received! Our team will confirm within the hour.', 'ok');
        ctaForm.reset();
      });
    }).catch(function(error){
      btn.classList.remove('is-loading');
      btn.disabled = false;
      showNote(error.message, 'err');
    });
  });
})();
