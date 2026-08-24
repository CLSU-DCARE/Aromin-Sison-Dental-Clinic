// If the browser restores this page from bfcache while the entrance cover
// was mid-reveal, the animation frame freezes in place (cover stuck
// halfway). Force it fully away on any restore.
window.addEventListener('pageshow', e => {
  if (!e.persisted) return;
  const cover = document.getElementById('siteEnter');
  if (cover && cover.classList.contains('play')){
    cover.className = 'site-enter site-enter-off';
  }
});

const header = document.getElementById('siteHeader');
function updateHeader(){
  if (window.scrollY > 40) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
}
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

// ---------- Mobile menu ----------
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuClose = document.getElementById('mobileMenuClose');

function openMobileMenu(){
  if (!mobileMenu) return;
  mobileMenu.classList.add('open');
  header.classList.add('menu-open');
  navToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  if (mobileMenuClose) mobileMenuClose.focus();
}
function closeMobileMenu(){
  if (!mobileMenu) return;
  const wasOpen = mobileMenu.classList.contains('open');
  mobileMenu.classList.remove('open');
  header.classList.remove('menu-open');
  navToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  if (wasOpen && navToggle) navToggle.focus();
}
if (navToggle) navToggle.addEventListener('click', openMobileMenu);
if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMobileMenu);
// Tapping the empty area of the fullscreen menu (outside links) closes it.
if (mobileMenu) mobileMenu.addEventListener('click', e => {
  if (e.target === mobileMenu) closeMobileMenu();
});
if (mobileMenu){
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileMenu));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMobileMenu();
    // Trap Tab inside the open fullscreen menu so focus can't wander
    // behind it into the page.
    if (e.key === 'Tab' && mobileMenu.classList.contains('open')){
      const items = Array.from(
        mobileMenu.querySelectorAll('a[href], button, summary, [tabindex]:not([tabindex="-1"])')
      ).filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first){
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      }
    }
  });
}
// If the window grows to desktop size while the mobile menu is open,
// close it so the fullscreen panel never lingers over the navbar.
const desktopMQ = window.matchMedia('(min-width: 981px)');
desktopMQ.addEventListener('change', e => { if (e.matches) closeMobileMenu(); });

// ---------- Desktop nav dropdowns (Our Story / Dentists) ----------
const navDrops = document.querySelectorAll('.nav-drop');
function closeAllNavDrops(){
  navDrops.forEach(d => {
    d.classList.remove('open');
    const t = d.querySelector('.nav-drop-trigger');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
}
// Hover opens the dropdown automatically on mouse-capable devices
// (touch screens keep the click toggle, so nothing sticks open).
let hoverCloseTimer = null;
const canHover = () => window.matchMedia('(hover: hover)').matches;
function scheduleNavDropClose(){
  clearTimeout(hoverCloseTimer);
  hoverCloseTimer = setTimeout(closeAllNavDrops, 150);
}
function cancelNavDropClose(){
  clearTimeout(hoverCloseTimer);
}
navDrops.forEach(drop => {
  const trigger = drop.querySelector('.nav-drop-trigger');
  if (!trigger) return;
  drop.addEventListener('mouseenter', () => {
    if (!canHover()) return;
    cancelNavDropClose();
    closeAllNavDrops();
    drop.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  });
  drop.addEventListener('mouseleave', () => {
    if (canHover()) scheduleNavDropClose();
  });
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = drop.classList.contains('open');
    closeAllNavDrops();
    if (!isOpen){
      drop.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
});
document.addEventListener('click', closeAllNavDrops);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllNavDrops();
});

// ---------- CTA booking form (frontend-only mock) ----------
function showCtaNote(message, kind){
  const note = document.getElementById('ctaNote');
  if (!note) return;
  note.textContent = message;
  note.classList.toggle('ok', kind === 'ok');
  note.classList.toggle('err', kind === 'err');
  note.hidden = false;
}
const ctaForm = document.getElementById('ctaForm');
if (ctaForm){
  const ctaDate = document.getElementById('ctaDate');
  if (ctaDate){
    // Past dates can't be booked: clamp the picker to today onwards.
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    ctaDate.min = today.toISOString().split('T')[0];
  }
  ctaForm.addEventListener('submit', e => {
    e.preventDefault();
    const service = document.getElementById('ctaService');
    const btn = document.getElementById('ctaSubmit');
    if (!service || !service.value){
      showCtaNote('Please choose a service.', 'err');
      if (service) service.focus();
      return;
    }
    if (!ctaDate || !ctaDate.value){
      showCtaNote('Please pick a preferred date.', 'err');
      if (ctaDate) ctaDate.focus();
      return;
    }
    const note = document.getElementById('ctaNote');
    if (note) note.hidden = true;
    btn.classList.add('is-loading');
    btn.disabled = true;
    // TODO(backend): replace with a real request to POST /api/public/booking-requests
    setTimeout(() => {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      showCtaNote('Request received! Our team will confirm within the hour.', 'ok');
      ctaForm.reset();
    }, 900);
  });
}

// ---------- Animated stat counters (scroll-triggered count-up) ----------
(function(){
  const counts = document.querySelectorAll('.stat-count');
  if (!counts.length) return;
  const fmt = n => n.toLocaleString('en-US');
  const finish = el => { el.textContent = fmt(parseFloat(el.dataset.target) || 0); };
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = (el) => {
    const target = parseFloat(el.dataset.target) || 0;
    const duration = 1400;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      // Ease-out cubic: fast start that settles gently into the final value.
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window) || prefersReduced){
    counts.forEach(finish);
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting){
        run(e.target);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  counts.forEach(c => io.observe(c));
})();

// ---------- FAQ accordion: smooth open/close instead of the browser's
// instant <details> snap ----------
// <details> is kept as the real element (so it still works with no JS,
// and keyboard/screen-reader behavior stays native); we just intercept
// the click and animate the height ourselves instead of letting the
// browser show/hide the content in a single frame.
(function(){
  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  items.forEach(item => {
    const summary = item.querySelector('summary');
    const answer = item.querySelector('.faq-answer');
    if (!summary || !answer) return;

    summary.addEventListener('click', e => {
      e.preventDefault();
      if (item.classList.contains('is-animating')) return;
      if (prefersReduced){
        item.open = !item.open;
        return;
      }
      item.open ? closeItem() : openItem();
    });

    function openItem(){
      item.setAttribute('open', '');
      item.classList.add('is-animating');
      answer.style.overflow = 'hidden';
      answer.style.height = '0px';
      const target = answer.scrollHeight;
      requestAnimationFrame(() => {
        answer.style.transition = 'height .38s var(--ease)';
        answer.style.height = target + 'px';
      });
      answer.addEventListener('transitionend', onOpenEnd);
    }
    function onOpenEnd(){
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
      requestAnimationFrame(() => {
        answer.style.transition = 'height .3s var(--ease)';
        answer.style.height = '0px';
      });
      answer.addEventListener('transitionend', onCloseEnd);
    }
    function onCloseEnd(){
      answer.removeEventListener('transitionend', onCloseEnd);
      item.removeAttribute('open');
      answer.style.height = '';
      answer.style.overflow = '';
      answer.style.transition = '';
      item.classList.remove('is-animating');
    }
  });
})();

// ---------- Scroll reveal (fade + rise into place) ----------
// Applies the same quiet entrance to section headings, cards, and feature
// blocks on every public page, so the whole site reads as one design
// system rather than a page-by-page patchwork. Elements are picked up by
// selector rather than hand-tagged in every HTML file, so new sections
// inherit the same behavior automatically.
(function(){
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || !('IntersectionObserver' in window)) return;

  const selector = [
    '.section-head', '.gcard', '.mvv-card', '.value-item', '.team-card',
    '.dentist-profile', '.timeline-item', '.visit-card', '.visit-map',
    '.cta-form-card', '.cta-copy', '.about-collage', '.commitment-quote',
    '.banner-content', '.banner-visual', '.doc-duo', '.spotlight > .wrap > div:last-child',
    '.faq-item', '.intro-side', '.intro-grid > div:first-child'
  ].join(',');

  // Group targets by their parent so items in the same row/grid stagger
  // in sequence instead of all popping in at once.
  const groups = new Map();
  document.querySelectorAll(selector).forEach(el => {
    if (el.closest('.dentist-profile') && !el.classList.contains('dentist-profile')) return;
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  groups.forEach(els => {
    els.forEach((el, i) => {
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--reveal-delay', Math.min(i, 5) * 90 + 'ms');
      io.observe(el);
    });
  });
})();
