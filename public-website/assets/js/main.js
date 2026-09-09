/* =====================================================================
   Aromin-Sison Dental Clinic: Public Website
   Initializes header scroll behavior. All other behaviors are handled
   by MobileMenu.js, NavDropdownManager.js, CtaBookingForm.js, and
   ScrollReveal.js loaded via script tags.
   ================================================================= */

(function(){
  'use strict';

  var header = document.getElementById('siteHeader');
  function updateHeader(){
    if (window.scrollY > 40) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  if (header){
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }
})();
