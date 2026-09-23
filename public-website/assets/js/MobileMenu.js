/* =====================================================================
   MobileMenu: Fullscreen mobile navigation overlay
   Handles open/close, Escape key, focus trap, and desktop breakpoint auto-close.
   ================================================================= */

(function(){
  'use strict';

  var header     = document.getElementById('siteHeader');
  var navToggle  = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  var closeBtn   = document.getElementById('mobileMenuClose');

  if (!mobileMenu) return;

  function open(){
    mobileMenu.classList.add('open');
    if (header) header.classList.add('menu-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  }

  function close(){
    var wasOpen = mobileMenu.classList.contains('open');
    mobileMenu.classList.remove('open');
    if (header) header.classList.remove('menu-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (wasOpen && navToggle) navToggle.focus();
  }

  if (navToggle) navToggle.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);

  mobileMenu.addEventListener('click', function(e){
    if (e.target === mobileMenu) close();
  });

  mobileMenu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', close);
  });

  document.addEventListener('keydown', function(e){
    if (!mobileMenu.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab'){
      var items = Array.from(
        mobileMenu.querySelectorAll('a[href], button, summary, [tabindex]:not([tabindex="-1"])')
      ).filter(function(el){ return el.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first){
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      }
    }
  });

  var desktopMQ = window.matchMedia('(min-width: 981px)');
  desktopMQ.addEventListener('change', function(e){ if (e.matches) close(); });
})();
