/* =====================================================================
   Aromin-Sison Dental Clinic: Public Website
   Initializes header scroll behavior. All other behaviors are handled
   by MobileMenu.js, NavDropdownManager.js, CtaBookingForm.js, and
   ScrollReveal.js loaded via script tags.
   ================================================================= */

(function(){
  'use strict';

  var header = document.getElementById('siteHeader');
  var ticking = false;
  var isScrolled = null;
  function updateHeader(){
    var next = window.scrollY > 40;
    if (next !== isScrolled){
      header.classList.toggle('scrolled', next);
      isScrolled = next;
    }
    ticking = false;
  }
  if (header){
    window.addEventListener('scroll', function(){
      if (!ticking){
        ticking = true;
        requestAnimationFrame(updateHeader);
      }
    }, { passive: true });
    updateHeader();
  }
})();
