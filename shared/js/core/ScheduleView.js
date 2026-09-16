/** Presentation adapters for authenticated appointment data. */
(function (ns) {
  const iso = date => {
    const copy = new Date(date);
    copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
    return copy.toISOString().slice(0, 10);
  };
  const timeLabel = value => new Date('2000-01-01T' + value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  ns.ScheduleView = {
    week(start, appointments) {
      const dates = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(start + 'T00:00:00');
        date.setDate(date.getDate() + i);
        return date;
      });
      const active = appointments.filter(a => !['cancelled','rejected'].includes(a.status));
      const times = [...new Set(active.map(a => a.scheduled_time))].sort();
      const esc = ns.HtmlHelpers.escapeHtml;
      return {
        label: dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + dates[5].toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        days: dates.map(date => date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })),
        rows: times.map(time => ({
          time: timeLabel(time),
          appts: dates.map(date => {
            const items = active.filter(a => a.scheduled_date === iso(date) && a.scheduled_time === time);
            return items.length ? {
              status: items.every(a => String(a.status).toLowerCase() === 'completed') ? 'completed' : '',
              name: esc(items.map(a => a.patient_name).join(', ')),
              t: esc(timeLabel(time) + ' · ' + items.map(a => a.service_type).join(', '))
            } : null;
          })
        }))
      };
    },
    queue(appointments) {
      const tags = { pending: 'amber', confirmed: 'green', completed: 'green', no_show: 'red' };
      return appointments.filter(a => a.scheduled_date === iso(new Date()) && !['cancelled','rejected'].includes(a.status)).map(a => ({
        initials: (a.patient_name || '').split(/\s+/).map(n => n[0]).slice(0, 2).join(''),
        name: a.patient_name, sub: a.service_type, time: timeLabel(a.scheduled_time),
        status: a.status.replace('_', ' '), tag: tags[a.status] || 'amber'
      }));
    }
  };
})(ASDC);
