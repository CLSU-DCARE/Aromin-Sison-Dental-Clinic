(function (ns) {
  'use strict';

  const chineseNewYear = {
    2026: '2026-02-17',
    2027: '2027-02-06',
    2028: '2028-01-26',
    2029: '2029-02-13',
    2030: '2030-02-03',
    2031: '2031-01-23',
    2032: '2032-02-11',
    2033: '2033-01-31',
    2034: '2034-02-19',
    2035: '2035-02-08',
    2036: '2036-01-28',
    2037: '2037-02-15'
  };

  const iso = date => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');

  const localDate = value => {
    const parts = String(value).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  const easter = year => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  };

  const lastMondayOfAugust = year => {
    const date = new Date(year, 7, 31);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return iso(date);
  };

  const holidaysForYear = year => {
    const easterSunday = easter(year);
    const holidays = {
      [`${year}-01-01`]: "New Year's Day",
      [iso(addDays(easterSunday, -3))]: 'Maundy Thursday',
      [iso(addDays(easterSunday, -2))]: 'Good Friday',
      [`${year}-04-09`]: 'Araw ng Kagitingan',
      [`${year}-05-01`]: 'Labor Day',
      [`${year}-06-12`]: 'Independence Day',
      [lastMondayOfAugust(year)]: 'National Heroes Day',
      [`${year}-08-21`]: 'Ninoy Aquino Day',
      [`${year}-11-01`]: "All Saints' Day",
      [`${year}-11-30`]: 'Bonifacio Day',
      [`${year}-12-25`]: 'Christmas Day',
      [`${year}-12-30`]: 'Rizal Day',
      [`${year}-12-31`]: "New Year's Eve"
    };
    if (chineseNewYear[year]) holidays[chineseNewYear[year]] = 'Chinese New Year';
    return holidays;
  };

  ns.HolidayCalendar = {
    closureForDate(value) {
      if (!value) return null;
      const date = localDate(value);
      if (Number.isNaN(date.getTime())) return null;
      if (date.getDay() === 0) return { name: 'Sunday', type: 'weekly_closure' };
      const holidays = holidaysForYear(date.getFullYear());
      return holidays[value] ? { name: holidays[value], type: 'holiday' } : null;
    },

    message(value) {
      const closure = this.closureForDate(value);
      return closure ? `Sorry, we are closed for ${closure.name}. Please choose another date.` : '';
    }
  };
})(window.ASDC || (window.ASDC = {}));
