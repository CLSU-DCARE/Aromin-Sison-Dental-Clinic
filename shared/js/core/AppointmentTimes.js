(function () {
  'use strict';
  window.ASDC = window.ASDC || {};
  const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30'];
  const label = time => {
    const [hour, minute] = time.split(':').map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  };
  function options(selected = '') {
    return '<option value="">Choose a time</option>' + ['Morning', 'Afternoon'].map(period =>
      `<optgroup label="${period}">` + times.filter(time => (time < '12:00') === (period === 'Morning')).map(time =>
        `<option value="${time}"${time === String(selected).slice(0, 5) ? ' selected' : ''}>${label(time)}</option>`
      ).join('') + '</optgroup>'
    ).join('');
  }
  function populate(select, date = '') {
    if (!select) return;
    const selected = select.value;
    select.innerHTML = options(selected);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const value = name => parts.find(part => part.type === name).value;
    const today = `${value('year')}-${value('month')}-${value('day')}`;
    const now = `${value('hour')}:${value('minute')}`;
    Array.from(select.options).forEach(option => {
      if (option.value && date === today && option.value <= now) {
        option.disabled = true;
        if (option.selected) select.value = '';
      }
    });
  }
  window.ASDC.AppointmentTimes = { times, options, populate, allows: value => times.includes(String(value).slice(0, 5)) && /^\d{2}:\d{2}(?::00)?$/.test(String(value)) };
  document.querySelectorAll('select[data-appointment-times]').forEach(select => populate(select));
})();
