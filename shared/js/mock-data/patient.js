/* =====================================================================
   Aromin-Sison Dental Clinic: Patient dashboard initial state

   Patient-specific records normally come from the authenticated patient
   API (../backend/api/patients/appointments.php and braces.php). The
   sample data below is what patient.js falls back to whenever those
   endpoints aren't reachable yet, so the dashboard always has something
   realistic to show instead of rendering completely empty. Once the real
   endpoints are live, a successful fetch simply overwrites these fields —
   see loadPatientAppointments()/loadPatientBraces() in patient.js.

   This sample persona ("Juan Reyes") matches the same patient used in the
   admin dashboard's sample data (shared/js/mock-data/admin.js), so the two
   dashboards tell a consistent story when demoed side by side.
   ===================================================================== */

/* eslint-disable no-unused-vars */
const PatientMock = {
  user: {
    initials: 'JR',
    name: 'Juan Reyes',
    pid: '#P-1057',
    greeting: 'Welcome back, Juan!',
    nextVisit: 'Your next visit is on Aug 18, 2026 at 9:00 AM for Braces Adjustment.'
  },

  notifications: [
    { id: 'n1', kind: 'appt', title: 'Appointment confirmed', desc: 'Your braces adjustment on Aug 18 has been confirmed.', time: '2 hr ago', unread: true },
    { id: 'n2', kind: 'pay', title: 'Payment approved', desc: 'Your ₱2,000.00 payment was approved (OR-20260801-045).', time: 'Yesterday', unread: true },
    { id: 'n3', kind: 'contract', title: 'Upcoming payment due', desc: 'Your next braces payment of ₱2,000 is due Sep 1.', time: '2 days ago', unread: false }
  ],

  dashboard: {
    stats: [
      {
        iconBg: 'rgba(183,196,204,0.35)', iconColor: '#5C6E77',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
        num: '1', label: 'Upcoming Appointment'
      },
      {
        iconBg: 'rgba(156,139,62,0.14)', iconColor: 'var(--gold)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 13c0-4 2-8 8-8s8 4 8 8-3 8-8 8-8-4-8-8Z"/><path d="M8 13h8"/></svg>',
        num: '62%', label: 'Braces Treatment Progress'
      },
      {
        iconBg: 'rgba(180,84,63,0.12)', iconColor: 'var(--red)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        num: '₱26,000.00', label: 'Outstanding Balance'
      },
      {
        iconBg: 'rgba(183,196,204,0.35)', iconColor: '#5C6E77',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M9 12l2 2 4-4"/></svg>',
        num: '8', label: 'Completed Visits'
      },
      {
        iconBg: 'rgba(156,139,62,0.14)', iconColor: 'var(--gold)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>',
        num: '6', label: 'Treatment Records'
      }
    ],
    upcoming: [
      { d: '18', m: 'AUG', svc: 'Braces Adjustment', meta: '9:00 AM · Dr. Kathrine Sison', status: 'Confirmed', tag: 'green' }
    ],
    announcements: [
      {
        title: '20% Off Teeth Whitening',
        sub: 'Until July 31, 2026'
      },
      {
        title: 'Clinic closed: July 4 Holiday',
        sub: 'Appointments moved to July 5'
      }
    ]
  },

  profile: {
    memberSince: 'March 2024',
    primaryDentist: 'Dr. Kathrine Sison',
    info: [
      { label: 'Full Name', value: 'Juan Reyes' },
      { label: 'Patient ID', value: '#P-1057' },
      { label: 'Contact Number', value: '0928 444 8812' },
      { label: 'Email Address', value: 'juan.reyes@example.com' },
      { label: 'Date of Birth', value: 'May 14, 1998' },
      { label: 'Home Address', value: '123 Rizal St., Cabanatuan City, Nueva Ecija', wide: true }
    ]
  },

  schedule: [
    { date: 'Aug 18, 2026', time: '9:00 AM', svc: 'Braces Adjustment', dentist: 'Dr. Kathrine Sison', status: 'Confirmed', tag: 'green' }
  ],

  history: [
    { date: 'Aug 11, 2026', svc: 'Braces Adjustment', dentist: 'Dr. Kathrine Sison', status: 'Completed', tag: 'green' },
    { date: 'Jul 14, 2026', svc: 'Braces Adjustment', dentist: 'Dr. Kathrine Sison', status: 'Completed', tag: 'green' },
    { date: 'Jun 16, 2026', svc: 'Braces Adjustment', dentist: 'Dr. Kathrine Sison', status: 'Completed', tag: 'green' },
    { date: 'May 19, 2026', svc: 'Retainer Impressions', dentist: 'Dr. Kathrine Sison', status: 'Completed', tag: 'green' }
  ],

  treatments: [
    { title: 'Braces Adjustment', meta: 'Aug 11, 2026 · Dr. Kathrine Sison' },
    { title: 'Braces Adjustment', meta: 'Jul 14, 2026 · Dr. Kathrine Sison' },
    { title: 'Retainer Impressions (Lab)', meta: 'May 19, 2026 · Dr. Kathrine Sison' },
    { title: 'Braces Placement Protocol', meta: 'Mar 10, 2024 · Dr. Kathrine Sison', muted: true }
  ],

  braces: {
    active: true,
    pct: '62%',
    monthLabel: 'Month 15 of 24',
    ringOffset: '143', // circle circumference ~377 at r=60 -> 377 * (1 - 0.62)
    heading: 'Your treatment is progressing well',
    description: 'You are in month 15 of a 24-month treatment plan. Keep up with your monthly adjustments!',
    stages: [
      { kind: 'done', name: 'Consultation & Records', date: 'Mar 3, 2024' },
      { kind: 'done', name: 'Braces Placement', date: 'Mar 10, 2024' },
      { kind: 'active', num: '3', name: 'Adjustment Phase', date: 'Ongoing · Monthly' },
      { kind: 'upcoming', num: '4', name: 'Retainer Fitting', date: 'Expected Feb 2027' }
    ],
    next: 'Next adjustment: Aug 18, 2026 at 9:00 AM'
  },

  contract: {
    active: true,
    summary: [
      { v: '₱48,000', l: 'Total Contract Value' },
      { v: '₱22,000', l: 'Total Paid' },
      { v: '₱26,000', l: 'Remaining Balance' }
    ],
    progress: { width: '46%', left: '15 of 24 months paid', right: '46% Paid' },
    payments: [
      { date: 'Aug 1, 2026', amount: '₱2,000.00', method: 'Over the counter', or: 'OR-20260801-045' },
      { date: 'Jul 1, 2026', amount: '₱2,000.00', method: 'Over the counter', or: 'OR-20260701-038' },
      { date: 'Jun 1, 2026', amount: '₱2,000.00', method: 'Online (QR)', or: 'OR-20260601-031' }
    ]
  },

  promoCards: [
    {
      title: '20% Off Teeth Whitening',
      desc: 'Valid until July 31, 2026'
    },
    {
      title: 'Clinic Closed: July 4 Holiday',
      desc: 'All appointments moved to July 5'
    },
    {
      title: 'New: Digital Scanning Now Available',
      desc: 'Faster, more comfortable impressions'
    },
    {
      title: 'Refer a Friend, Get ₱500 Off',
      desc: 'Ongoing · Applies to any treatment'
    }
  ]
};
