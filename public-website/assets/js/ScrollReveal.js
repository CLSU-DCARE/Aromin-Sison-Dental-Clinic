/* =====================================================================
   ScrollReveal: Scroll-triggered reveal animations, stat counters,
   and FAQ accordion for public website pages.
   ================================================================= */

(function(){
  'use strict';

  // Scroll reveals and count-up loops add little on a touch viewport but
  // consume frame budget while the page is moving. Keep them for desktop
  // only, and respect an explicit reduced-motion preference everywhere.
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 960px)').matches;

  // =====================================================================
  // SCROLL REVEAL (fade + rise)
  // =====================================================================
  if (!prefersReduced && ('IntersectionObserver' in window)){
    var selector = [
      '.section-head', '.gcard', '.mvv-card', '.value-item', '.team-card',
      '.dentist-profile', '.timeline-item', '.visit-card', '.visit-map',
      '.cta-form-card', '.cta-copy', '.about-collage', '.commitment-quote',
      '.banner-content', '.banner-visual', '.doc-duo', '.spotlight > .wrap > div:last-child',
      '.faq-item', '.intro-side', '.intro-grid > div:first-child'
    ].join(',');

    var groups = new Map();
    document.querySelectorAll(selector).forEach(function(el){
      if (el.closest('.dentist-profile') && !el.classList.contains('dentist-profile')) return;
      var parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });

    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    groups.forEach(function(els){
      els.forEach(function(el, i){
        el.setAttribute('data-reveal', '');
        el.style.setProperty('--reveal-delay', Math.min(i, 5) * 90 + 'ms');
        io.observe(el);
      });
    });
  }

  // =====================================================================
  // ANIMATED STAT COUNTERS
  // =====================================================================
  var counts = document.querySelectorAll('.stat-count');
  if (counts.length){
    var fmt = function(n){ return n.toLocaleString('en-US'); };
    var finish = function(el){ el.textContent = fmt(parseFloat(el.dataset.target) || 0); };

    if (prefersReduced || !('IntersectionObserver' in window)){
      counts.forEach(finish);
    } else {
      var run = function(el){
        var target = parseFloat(el.dataset.target) || 0;
        var duration = 1400;
        var start = null;
        var step = function(ts){
          if (!start) start = ts;
          var p = Math.min((ts - start) / duration, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      var cio = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (e.isIntersecting){
            run(e.target);
            cio.unobserve(e.target);
          }
        });
      }, { threshold: 0.4 });
      counts.forEach(function(c){ cio.observe(c); });
    }
  }

  // =====================================================================
  // FAQ ACCORDION (animated <details> open/close)
  // =====================================================================
  var faqItems = document.querySelectorAll('.faq-item');
  if (faqItems.length){
    faqItems.forEach(function(item){
      var summary = item.querySelector('summary');
      var answer = item.querySelector('.faq-answer');
      if (!summary || !answer) return;
      // Holds the pending fallback timer for whichever animation (open or
      // close) is currently running, so a stale timer from a previous click
      // can never fire in the middle of a newer one.
      var fallbackTimer = null;

      summary.addEventListener('click', function(e){
        e.preventDefault();
        if (item.classList.contains('is-animating')) return;
        if (prefersReduced){ item.open = !item.open; return; }
        item.open ? closeItem() : openItem();
      });

      function openItem(){
        item.setAttribute('open', '');
        item.classList.add('is-animating');
        answer.style.overflow = 'hidden';
        answer.style.height = '0px';
        var target = answer.scrollHeight;
        // Wait two frames, not one: a single rAF can still land before the
        // browser has actually painted the height:0 starting point, which is
        // what caused the open/close stutter (the transition would get
        // skipped and the content would jump, or briefly flash fully open,
        // instead of animating smoothly).
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            answer.style.transition = 'height .38s var(--ease)';
            answer.style.height = target + 'px';
          });
        });
        answer.addEventListener('transitionend', onOpenEnd);
        clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(onOpenEnd, 450);
      }
      function onOpenEnd(){
        clearTimeout(fallbackTimer);
        answer.removeEventListener('transitionend', onOpenEnd);
        answer.style.height = '';
        answer.style.overflow = '';
        answer.style.transition = '';
        item.classList.remove('is-animating');
      }
      function closeItem(){
        item.classList.add('is-animating');
        answer.style.overflow = 'hidden';
        answer.style.height = answer.scrollHeight + 'px';
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            answer.style.transition = 'height .3s var(--ease)';
            answer.style.height = '0px';
          });
        });
        answer.addEventListener('transitionend', onCloseEnd);
        clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(onCloseEnd, 400);
      }
      function onCloseEnd(){
        clearTimeout(fallbackTimer);
        answer.removeEventListener('transitionend', onCloseEnd);
        item.removeAttribute('open');
        answer.style.height = '';
        answer.style.overflow = '';
        answer.style.transition = '';
        item.classList.remove('is-animating');
      }
    });
  }

  // =====================================================================
  // BFCACHE COVER FIX
  // =====================================================================
  window.addEventListener('pageshow', function(e){
    if (!e.persisted) return;
    var cover = document.getElementById('siteEnter');
    if (cover && cover.classList.contains('play')){
      cover.className = 'site-enter site-enter-off';
    }
  });
})();
