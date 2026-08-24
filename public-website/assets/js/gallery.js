// ---------- Gallery: center-focused carousel + filters + lightbox ----------
// The image source is the single point of truth: every <figure class="g-item">
// inside #gallerySource feeds the carousel, the category filters, and the
// lightbox. Adding a photo there automatically adds it everywhere.
(function(){
  const source = document.getElementById('gallerySource');
  const figures = Array.from((source || document).querySelectorAll('.g-item'));
  const items = figures.map(fig => ({
    src: fig.querySelector('img').getAttribute('src'),
    alt: fig.querySelector('img').getAttribute('alt') || '',
    caption: fig.dataset.caption || '',
    cat: fig.dataset.cat || 'Other'
  }));
  if (!items.length) return;

  const escapeHtml = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmt = n => String(n + 1).padStart(2, '0');

  // =====================================================================
  // CAROUSEL
  // =====================================================================
  const stage = document.getElementById('carouselStage');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const dotsBox = document.getElementById('carouselDots');
  const captionEl = document.getElementById('carouselCaption');
  const carCount = document.getElementById('carouselCount');
  const carousel = document.getElementById('galleryCarousel');

  let visible = items;
  let index = 0;

  function renderCarousel(dir){
    if (!stage) return;
    const n = visible.length;
    // Slides the newly rendered fan in from the direction of travel;
    // a plain render (filters, first paint) keeps the neutral entrance.
    stage.classList.remove('dir-prev', 'dir-next');
    if (dir) stage.classList.add(dir < 0 ? 'dir-prev' : 'dir-next');
    // Slots around the featured image: peek-left, side-left, featured,
    // side-right, peek-right. A single photo renders just the featured slot.
    const slots = n === 1 ? [2] : [index - 2, index - 1, index, index + 1, index + 2];
    // Snapshot the outgoing featured photo so it can slide out while the
    // new fan slides in (the re-render below would otherwise destroy it).
    const ghost = dir && n > 1
      ? stage.querySelector('.carousel-cell.is-featured')?.cloneNode(true) || null
      : null;
    stage.innerHTML = slots.map((slotIdx, slot) => {
      const itemIndex = ((slotIdx % n) + n) % n;
      const role = slot === 2 ? 'featured' : (slot === 1 || slot === 3 ? 'side' : 'peek');
      // Cards left of the featured slot (0,1) get "left", right of it (3,4)
      // get "right": the CSS uses this to fan them out on either side.
      // Without it every side/peek card falls back to the same default
      // spot and stacks invisibly on top of one another.
      const side = slot < 2 ? ' left' : (slot > 2 ? ' right' : '');
      const it = visible[itemIndex];
      return `<figure class="carousel-cell is-${role}${side}" data-index="${itemIndex}" style="animation-delay:${slot * 45}ms">
        <img src="${it.src}" alt="${escapeHtml(it.alt)}" ${slot === 2 ? '' : 'loading="lazy"'}>
      </figure>`;
    }).join('');
    if (ghost){
      ghost.classList.add('carousel-ghost');
      ghost.style.animationDelay = '0ms';
      stage.appendChild(ghost);
      ghost.addEventListener('animationend', () => ghost.remove(), { once: true });
    }
    captionEl.textContent = visible[index].caption;
    carCount.textContent = fmt(index) + ' / ' + fmt(n);
    dotsBox.innerHTML = visible.map((_, i) =>
      `<button type="button" class="dot${i === index ? ' is-active' : ''}" data-index="${i}"
        aria-label="Go to photo ${i + 1} of ${n}"${i === index ? ' aria-current="true"' : ''}></button>`
    ).join('');
    prevBtn.disabled = n <= 1;
    nextBtn.disabled = n <= 1;
    stage.classList.toggle('is-solo', n <= 1);
  }

  function setIndex(i){
    if (visible.length <= 1) return;
    const dir = i === index ? 0 : Math.sign(i - index);
    index = ((i % visible.length) + visible.length) % visible.length;
    renderCarousel(dir);
  }

  if (stage){
    prevBtn.addEventListener('click', () => setIndex(index - 1));
    nextBtn.addEventListener('click', () => setIndex(index + 1));
    stage.addEventListener('click', e => {
      const cell = e.target.closest('.carousel-cell');
      if (!cell) return;
      const i = Number(cell.dataset.index);
      if (cell.classList.contains('is-featured')) open(i, cell);
      else setIndex(i);
    });
    dotsBox.addEventListener('click', e => {
      const dot = e.target.closest('.dot');
      if (dot) setIndex(Number(dot.dataset.index));
    });
  }

  // =====================================================================
  // LIGHTBOX
  // =====================================================================
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbCaption = document.getElementById('lbCaption');
  const lbCount = document.getElementById('lbCount');
  const btnClose = document.getElementById('lbClose');
  const btnPrev = document.getElementById('lbPrev');
  const btnNext = document.getElementById('lbNext');
  if (!lb || !lbImg) return;

  let lbIndex = 0;
  let touchX = null;
  let opener = null;

  function show(i){
    lbIndex = (i + visible.length) % visible.length;
    const it = visible[lbIndex];
    lbImg.src = it.src;
    lbImg.alt = it.alt;
    lbCaption.textContent = it.caption;
    lbCount.textContent = fmt(lbIndex) + ' / ' + fmt(visible.length);
    lbImg.classList.remove('lb-pop');
    void lbImg.offsetWidth;
    lbImg.classList.add('lb-pop');
  }

  function open(pos, trigger){
    opener = trigger || null;
    show(pos);
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnClose.focus();
  }

  function close(){
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (opener) opener.focus();
  }

  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', e => { e.stopPropagation(); show(lbIndex - 1); });
  btnNext.addEventListener('click', e => { e.stopPropagation(); show(lbIndex + 1); });

  lb.addEventListener('click', e => { if (e.target === lb) close(); });

  document.addEventListener('keydown', e => {
    if (lb.classList.contains('open')){
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && visible.length > 1) show(lbIndex - 1);
      else if (e.key === 'ArrowRight' && visible.length > 1) show(lbIndex + 1);
      return;
    }
    // Carousel arrows work when focus is inside the gallery.
    if (carousel && carousel.contains(document.activeElement)){
      if (e.key === 'ArrowLeft'){ setIndex(index - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight'){ setIndex(index + 1); e.preventDefault(); }
    }
  });

  lb.addEventListener('pointerdown', e => { touchX = e.clientX; });
  lb.addEventListener('pointerup', e => {
    if (touchX === null) return;
    const dx = e.clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 40) return;
    show(lbIndex + (dx < 0 ? 1 : -1));
  });

  // =====================================================================
  // CATEGORY FILTER CHIPS
  // =====================================================================
  const chipsBox = document.getElementById('galleryFilter');
  const barCount = document.getElementById('galleryCount');

  function applyFilter(cat){
    visible = cat === 'All' ? items : items.filter(it => it.cat === cat);
    index = 0;
    renderCarousel();
    lb.classList.toggle('is-solo', visible.length <= 1);
    if (barCount) barCount.textContent = `${visible.length} of ${items.length} photos`;
  }

  if (chipsBox){
    const counts = {};
    items.forEach(it => { counts[it.cat] = (counts[it.cat] || 0) + 1; });
    const cats = ['All', ...Array.from(new Set(items.map(it => it.cat)))];
    chipsBox.innerHTML = cats.map((c, i) => {
      const n = c === 'All' ? items.length : counts[c];
      return `<button type="button" class="filter-chip${i === 0 ? ' is-active' : ''}"
        data-filter="${c}" aria-pressed="${i === 0 ? 'true' : 'false'}">${c}
        <span class="chip-count">${n}</span></button>`;
    }).join('');
    applyFilter('All');

    chipsBox.addEventListener('click', e => {
      const chip = e.target.closest('.filter-chip');
      if (!chip || chip.classList.contains('is-active')) return;
      chipsBox.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('is-active');
      chip.setAttribute('aria-pressed', 'true');
      applyFilter(chip.dataset.filter);
      if (lb.classList.contains('open')) close();
    });

    // Roving keyboard navigation: arrows move focus between chips,
    // Home/End jump to the first/last.
    chipsBox.addEventListener('keydown', e => {
      const chips = Array.from(chipsBox.querySelectorAll('.filter-chip'));
      const cur = chips.indexOf(document.activeElement);
      if (cur === -1) return;
      let next = -1;
      if (e.key === 'ArrowRight') next = (cur + 1) % chips.length;
      else if (e.key === 'ArrowLeft') next = (cur - 1 + chips.length) % chips.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = chips.length - 1;
      if (next === -1) return;
      e.preventDefault();
      chips[next].focus();
      chips[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  } else {
    applyFilter('All');
  }
})();