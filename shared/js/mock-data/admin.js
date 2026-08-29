/* =====================================================================
   Aromin-Sison Dental Clinic: Admin dashboard MOCK DATA
   Single source of truth for every sample dataset rendered in
   admin-system/dashboard.html. The admin dashboard renders these via
   admin.js; later they'll be replaced one-by-one with real API calls:

     Current:  AdminMock.patients            -> renderPatients()
     Future:   fetch('/backend/api/...)     -> renderPatients(response)

   Keep entries in the same shape you want the API to return so the
   render functions only ever take one argument.

   SCOPE: the system focuses ONLY on orthodontic patients with a
   current braces contract (status 'Current' or 'Overdue'). Every
   patient-facing list below (patients, records, schedule, queue) only
   contains patients carrying a `contract` reference — admin.js enforces
   this too, and the future API endpoints must JOIN braces_contracts and
   filter to status IN ('active','defaulted') server-side.
   ===================================================================== */

/* eslint-disable no-unused-vars */
const AdminMock = {
  // ---------- Signed-in user (sidebar foot + topbar chip) ----------
  user: {
    initials: 'DS',
    name: 'Dr. Kathrine Sison',
    role: 'Lead Dentist',
    greeting: 'A blessed day!'
  },

  // ---------- Notifications (unread dot/count in the topbar bell) ----------
  notifications: [
    { id: 'n1', kind: 'appt', title: 'New appointment request', desc: 'Alyssa Ramos requested a braces adjustment for Aug 18.', time: '5 min ago', unread: true },
    { id: 'n2', kind: 'pay', title: 'Payment received', desc: 'Juan Reyes paid ₱2,000 via GCash.', time: '1 hr ago', unread: true },
    { id: 'n3', kind: 'stock', title: 'Low stock: Masks', desc: 'Masks (box) is down to 6 units.', time: '3 hrs ago', unread: true },
    { id: 'n4', kind: 'contract', title: 'Contract payment overdue', desc: 'Alyssa Ramos is 2 payments behind.', time: 'Yesterday', unread: false },
    { id: 'n5', kind: 'info', title: 'Welcome back', desc: 'You signed in from a new device.', time: 'Aug 12', unread: false }
  ],

  // ---------- Dashboard overview ----------
  dashboard: {
    stats: [
      {
        iconBg: 'rgba(92,122,92,0.12)', iconColor: 'var(--green)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
        trend: '+12%', trendClass: 'trend-up',
        num: '128', label: 'Appointments this month'
      },
      {
        iconBg: 'rgba(199,145,62,0.14)', iconColor: 'var(--amber)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>',
        trend: '+2', trendClass: 'trend-up',
        num: '3', label: 'Active braces patients'
      },
      {
        iconBg: 'rgba(156,139,62,0.14)', iconColor: 'var(--gold)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
        trend: '+5%', trendClass: 'trend-up',
        num: '₱86k', label: 'Collections this week'
      },
      {
        iconBg: 'rgba(180,84,63,0.12)', iconColor: 'var(--red)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        trend: '1 open', trendClass: 'trend-down',
        num: '1', label: 'Overdue braces contracts'
      }
    ],
    weekLabel: 'Aug 10 – 15',
    week: {
      days: ['Mon 10', 'Tue 11', 'Wed 12', 'Thu 13', 'Fri 14', 'Sat 15'],
      rows: [
        { time: '9:00 AM', appts: [
          { name: 'J. Reyes', t: '9:00 · Braces adj.' }, null, null,
          { name: 'M. Ramos', t: '9:30 · Braces adj.' }, null, null
        ]},
        { time: '10:00 AM', appts: [
          null, { name: 'A. Ramos', t: '10:00 · Braces adj.' }, null, null,
          { name: 'P. Villanueva', t: '10:30 · Braces adj.' }, null
        ]},
        { time: '11:00 AM', appts: [null, null, null, null, null, null]},
        { time: '1:00 PM', appts: [
          null, null, null, { name: 'M. Ramos', t: '1:00 · Braces adj.' }, null, null
        ]},
        { time: '2:00 PM', appts: [
          null, null, null, null, { name: 'J. Reyes', t: '2:30 · Braces adj.' }, null
        ]},
        { time: '3:00 PM', appts: [
          null, null, null, null, null, { name: 'A. Ramos', t: '3:00 · Braces adj.' }
        ]}
      ]
    },
    queue: [
      { initials: 'JR', name: 'Juan Reyes', sub: 'Braces adjustment', time: '9:00 AM', status: 'Done', tag: 'green' },
      { initials: 'MR', name: 'Miguel Ramos', sub: 'Braces adjustment', time: '10:00 AM', status: 'In chair', tag: 'amber' },
      { initials: 'AR', name: 'Alyssa Ramos', sub: 'Braces adjustment', time: '11:30 AM', status: 'Waiting', tag: 'amber' },
      { initials: 'PV', name: 'Patricia Villanueva', sub: 'Braces adjustment', time: '2:00 PM', status: 'No-show', tag: 'red' }
    ]
  },

  // ---------- Patients (orthodontic patients with a current braces contract) ----------
  patients: [
    { initials: 'JR', name: 'Juan Reyes', id: '#P-1057', contact: '0928 444 8812', lastVisit: 'Aug 11, 2026', balance: '₱26,000.00', status: 'Current', tag: 'amber', contract: '#B-221' },
    { initials: 'AR', name: 'Alyssa Ramos', id: '#P-1044', contact: '0917 333 2266', lastVisit: 'Aug 12, 2026', balance: '₱42,000.00', status: 'Overdue', tag: 'red', contract: '#B-187' },
    { initials: 'PV', name: 'Patricia Villanueva', id: '#P-1066', contact: '0933 111 4096', lastVisit: 'Aug 5, 2026', balance: '₱8,750.00', status: 'Current', tag: 'amber', contract: '#B-198' },
    { initials: 'MR', name: 'Miguel Ramos', id: '#P-1042', contact: '0917 555 9033', lastVisit: 'Aug 14, 2026', balance: '₱7,500.00', status: 'Current', tag: 'amber', contract: '#B-205' }
  ],

  // ---------- Records & Protocols (braces patients only) ----------
  records: [
    { initials: 'JR', name: 'Juan Reyes', procedure: 'Braces adjustment', date: 'Aug 11, 2026', dentist: 'Dr. Kathrine Sison', status: 'In progress', tag: 'amber', category: 'Treatment' },
    { initials: 'AR', name: 'Alyssa Ramos', procedure: 'Braces adjustment', date: 'Aug 12, 2026', dentist: 'Dr. Kathrine Sison', status: 'In progress', tag: 'amber', category: 'Treatment' },
    { initials: 'PV', name: 'Patricia Villanueva', procedure: 'Braces placement protocol', date: 'Aug 5, 2026', dentist: 'Dr. Kathrine Sison', status: 'Complete', tag: 'green', category: 'Protocol' },
    { initials: 'JR', name: 'Juan Reyes', procedure: 'Retainer impressions (lab)', date: 'Aug 11, 2026', dentist: 'Dr. Kathrine Sison', status: 'In progress', tag: 'amber', category: 'Lab work' },
    { initials: 'MR', name: 'Miguel Ramos', procedure: 'Braces adjustment', date: 'Aug 14, 2026', dentist: 'Dr. Arsenia Aromin', status: 'Complete', tag: 'green', category: 'Treatment' },
    { initials: 'AR', name: 'Alyssa Ramos', procedure: 'Wire replacement (lab)', date: 'Aug 12, 2026', dentist: 'Dr. Kathrine Sison', status: 'In progress', tag: 'amber', category: 'Lab work' }
  ],

  // ---------- Braces contracts ----------
  braces: [
    { initials: 'JR', name: 'Juan Reyes', id: '#B-221', plan: '24-month · ₱2,000/mo', monthly: '₱2,000', paid: '₱22,000', balance: '₱26,000', status: 'Current', tag: 'amber' },
    { initials: 'AR', name: 'Alyssa Ramos', id: '#B-187', plan: '18-month · ₱3,000/mo', monthly: '₱3,000', paid: '₱12,000', balance: '₱42,000', status: 'Overdue', tag: 'red' },
    { initials: 'BC', name: 'Bea Cruz', id: '#B-154', plan: '20-month · ₱2,500/mo', monthly: '₱2,500', paid: '₱50,000', balance: '₱0', status: 'Completed', tag: 'green' }
  ],

  // ---------- Promotions ----------
  promotions: [
    { title: 'Back-to-School Smile', desc: '20% off braces adjustment for students this August.', status: 'Live', tag: 'green' },
    { title: 'New Patient Cleaning', desc: 'First cleaning & check-up at ₱499 for new patients.', status: 'Scheduled', tag: 'amber' },
    { title: 'Whitening Week', desc: 'Take-home whitening kits at 15% off, Sep 1–7.', status: 'Ended', tag: 'red' }
  ],

  // ---------- Attendance reports ----------
  reports: {
    stats: [
      {
        iconBg: 'rgba(92,122,92,0.12)', iconColor: 'var(--green)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        trend: '98%', trendClass: 'trend-up', num: '47', label: 'Present days'
      },
      {
        iconBg: 'rgba(199,145,62,0.14)', iconColor: 'var(--amber)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        trend: '2', trendClass: 'trend-down', num: '2', label: 'Late arrivals'
      },
      {
        iconBg: 'rgba(180,84,63,0.12)', iconColor: 'var(--red)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        trend: '1', trendClass: 'trend-down', num: '1', label: 'Absent day'
      }
    ],
    bars: [
      { day: 'Mon', pct: 64 },
      { day: 'Tue', pct: 88 },
      { day: 'Wed', pct: 100 },
      { day: 'Thu', pct: 76 },
      { day: 'Fri', pct: 92 },
      { day: 'Sat', pct: 52 }
    ]
  },

  // ---------- Inventory ----------
  inventory: [
    { initials: 'GM', item: 'Gloves (box)', category: 'Consumable', stock: '14', width: '70', fill: 'var(--green)', status: 'OK', tag: 'green' },
    { initials: 'MS', item: 'Masks (box)', category: 'Consumable', stock: '6', width: '30', fill: 'var(--amber)', status: 'Low', tag: 'amber' },
    { initials: 'CM', item: 'Composite resin', category: 'Material', stock: '3', width: '15', fill: 'var(--red)', status: 'Reorder', tag: 'red' },
    { initials: 'XI', item: 'X-ray film packs', category: 'Imaging', stock: '22', width: '88', fill: 'var(--green)', status: 'OK', tag: 'green' },
    { initials: 'BK', item: 'Burs (set)', category: 'Instrument', stock: '9', width: '45', fill: 'var(--amber)', status: 'Low', tag: 'amber' },
    { initials: 'DC', item: 'Dental chair', category: 'Equipment', stock: '3', width: '60', fill: 'var(--green)', status: 'OK', tag: 'green' }
  ]
};