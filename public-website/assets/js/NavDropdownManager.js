/* =====================================================================
   NavDropdownManager — Desktop navigation dropdown hover/click toggles
   Manages open/close for .nav-drop elements with hover and click support.
   ================================================================= */

(function(){
  'use strict';

  var navDrops = document.querySelectorAll('.nav-drop');
  if (!navDrops.length) return;

  var hoverCloseTimer = null;
  var canHover = function(){ return window.matchMedia('(hover: hover)').matches; };

  function closeAll(){
    navDrops.forEach(function(d){
      d.classList.remove('open');
      var t = d.querySelector('.nav-drop-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  function scheduleClose(){
    clearTimeout(hoverCloseTimer);
    hoverCloseTimer = setTimeout(closeAll, 150);
  }

  function cancelClose(){ clearTimeout(hoverCloseTimer); }

  navDrops.forEach(function(drop){
    var trigger = drop.querySelector('.nav-drop-trigger');
    if (!trigger) return;

    drop.addEventListener('mouseenter', function(){
      if (!canHover()) return;
      cancelClose();
      closeAll();
      drop.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    });

    drop.addEventListener('mouseleave', function(){
      if (canHover()) scheduleClose();
    });

    trigger.addEventListener('click', function(e){
      e.stopPropagation();
      var isOpen = drop.classList.contains('open');
      closeAll();
      if (!isOpen){
        drop.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeAll();
  });
})();
