/**
 * PatientBracesProgress – Render braces treatment progress ring and stages.
 *
 * Replaces renderBracesProgress() from patient.js (lines 1655-1744).
 *
 * Usage:
 *   const braces = new PatientBracesProgress();
 *   braces.render(PatientState.braces);
 */
/* global escapeHtml */
window.PatientBracesProgress = class PatientBracesProgress {
  render (braces) {
    this._setValue('ringPct', braces.pct);
    this._setValue('ringSub', braces.monthLabel);
    this._setValue('bracesNext', braces.next);
    this._setValue('bracesHeading', braces.heading);
    this._setValue('bracesDescription', braces.description);

    const offset = document.getElementById('ringOffset');
    if (offset) offset.setAttribute('stroke-dashoffset', braces.ringOffset);

    const list = document.getElementById('stageList');
    if (!list) return;

    list.innerHTML = braces.stages.map(stage => {
      const check = stage.kind === 'done'
        ? '<div class="stage-check done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></div>'
        : `<div class="stage-check ${stage.kind}">${stage.num}</div>`;

      return `<div class="stage">${check}<div><div class="stage-name">${escapeHtml(stage.name)}</div><div class="stage-date">${escapeHtml(window.formatDate ? window.formatDate(stage.date) : stage.date)}</div></div></div>`;
    }).join('');
  }

  _setValue (id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
};
