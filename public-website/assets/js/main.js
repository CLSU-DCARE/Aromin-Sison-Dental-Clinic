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

  var casesSection = document.getElementById('successful-cases');
  var casesGrid = document.getElementById('publicCasesGrid');
  if (casesSection && casesGrid && window.fetch){
    fetch('../backend/api/public/cases.php', { cache: 'no-store' })
      .then(function(response){ return response.ok ? response.json() : null; })
      .then(function(payload){
        var cases = payload && payload.success && payload.data && Array.isArray(payload.data.cases)
          ? payload.data.cases
          : [];
        if (!cases.length) return;
        casesGrid.innerHTML = cases.map(function(item){
          var collage = Number(item.has_case_image)
            ? '<div class="public-case-images public-case-collage"><img src="../backend/api/cases/image.php?id=' + Number(item.id) + '&image=case" alt="Before-and-after collage"></div>' : '';
          var before = Number(item.has_before_image)
            ? '<figure><img src="../backend/api/cases/image.php?id=' + Number(item.id) + '&image=before" alt="Before treatment"><figcaption>Before</figcaption></figure>' : '';
          var after = Number(item.has_after_image)
            ? '<figure><img src="../backend/api/cases/image.php?id=' + Number(item.id) + '&image=after" alt="After treatment"><figcaption>After</figcaption></figure>' : '';
          var date = item.case_date ? escapeHtml(item.case_date) : '';
          return '<article class="public-promo-card public-case-card">' + (collage || '<div class="public-case-images">' + before + after + '</div>') +
            '<div class="public-promo-body"><span>' + escapeHtml(item.category) + (date ? ' · ' + date : '') + '</span><h3>' + escapeHtml(item.title) + '</h3><p>' +
            escapeHtml(item.description || '') + '</p></div></article>';
        }).join('');
        casesSection.hidden = false;
      })
      .catch(function(){});
  }
})();
