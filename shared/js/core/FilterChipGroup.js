/**
 * FilterChipGroup: Aromin-Sison Dental Clinic System.
 * Wires segmented filter chip controls with active state management.
 */
(function () {
  'use strict';

  class FilterChipGroup {
    constructor(container, onChange) {
      this.container = container;
      this.onChange = onChange;
      this._init();
    }

    _init() {
      if (!this.container) return;
      this.container.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        this.container.querySelectorAll('.filter-chip').forEach((c) => {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
        this.onChange(chip.dataset.filter || chip.textContent.trim());
      });
    }

    setChip(label) {
      if (!this.container) return;
      this.container.querySelectorAll('.filter-chip').forEach((c) => {
        const active = c.textContent.trim() === label;
        c.classList.toggle('active', active);
        c.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  window.ASDC.FilterChipGroup = FilterChipGroup;
})();
