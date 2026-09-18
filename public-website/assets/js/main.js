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

  function escapeHtml(value){
    return String(value || '').replace(/[&<>"']/g, function(ch){
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  var promoSection = document.getElementById('promotions');
  var promoGrid = document.getElementById('publicPromoGrid');
  if (promoSection && promoGrid && window.fetch){
    fetch('../backend/api/public/promotions.php', { cache: 'no-store' })
      .then(function(response){ return response.ok ? response.json() : null; })
      .then(function(payload){
        var promotions = payload && payload.success && payload.data && Array.isArray(payload.data.promotions)
          ? payload.data.promotions
          : [];
        if (!promotions.length) return;
        promoGrid.innerHTML = promotions.map(function(promo){
          var image = promo.image_path
            ? '<img src="../backend/' + escapeHtml(promo.image_path) + '" alt="' + escapeHtml(promo.title) + '">'
            : '';
          var dates = promo.end_date ? 'Until ' + escapeHtml(promo.end_date) : escapeHtml(promo.status || 'Live');
          return '<article class="public-promo-card">' + image +
            '<div class="public-promo-body"><span>' + dates + '</span><h3>' + escapeHtml(promo.title) + '</h3><p>' +
            escapeHtml(promo.desc || '') + '</p></div></article>';
        }).join('');
        promoSection.hidden = false;
      })
      .catch(function(){});
  }
})();
