/* =====================================================================
   Aromin-Sison Dental Clinic: Patient dashboard MOCK DATA
   Single source of truth for every sample dataset rendered in
   patient-dashboard/dashboard.html. The patient dashboard renders these
   via patient.js; later they'll be replaced one-by-one with real API
   calls:

     Current:  PatientMock.schedule       -> renderSchedule()
     Future:   fetch('/backend/api/...')  -> renderSchedule(response)

   Keep entries in the same shape you want the API to return so the
   render functions only ever take one argument.
   ===================================================================== */

/* eslint-disable no-unused-vars */
const PatientMock = {
  user: {
    initials: 'MR',
    name: 'Miguel Ramos',
    pid: 'Patient ID #A-1042',
    greeting: 'Kumusta, Miguel!',
    nextVisit: 'You have no upcoming appointments.'
  },

  notifications: [
    {
      id: 'p2',
      kind: 'pay',
      title: 'Payment due soon',
      desc: 'Your next braces payment of ₱3,600 is due Jul 15.',
      time: '3 days ago',
      unread: true
    },
    {
      id: 'p3',
      kind: 'info',
      title: 'Clinic closed: July 4 Holiday',
      desc: 'Appointments moved to July 5.',
      time: '1 week ago',
      unread: false
    },
    {
      id: 'p4',
      kind: 'promo',
      title: '20% off teeth whitening',
      desc: 'Valid until July 31, 2026.',
      time: '2 weeks ago',
      unread: false
    }
  ],

  dashboard: {
    stats: [
      {
        iconBg: 'rgba(183,196,204,0.35)',
        iconColor: '#5C6E77',
        icon:
          '<svg viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="2">' +
          '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
          '<path d="M16 2v4M8 2v4M3 10h18"/>' +
          '</svg>',
        num: '0',
        label: 'Upcoming Appointment'
      },
      {
        iconBg: 'rgba(156,139,62,0.14)',
        iconColor: 'var(--gold)',
        icon:
          '<svg viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="2">' +
          '<path d="M4 13c0-4 2-8 8-8s8 4 8 8-3 8-8 8-8-4-8-8Z"/>' +
          '<path d="M8 13h8"/>' +
          '</svg>',
        num: '72%',
        label: 'Braces Treatment Progress'
      },
      {
        iconBg: 'rgba(180,84,63,0.12)',
        iconColor: 'var(--red)',
        icon:
          '<svg viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="2">' +
          '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5' +
          'a3.5 3.5 0 0 1 0 7H6"/>' +
          '</svg>',
        num: '₱18,200',
        label: 'Outstanding Balance'
      }
    ],

    /*
     * These appointments must come from the
     * authenticated appointment API.
     */
    upcoming: [],

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
    memberSince: 'February 2026',
    primaryDentist: 'Dr. Kathrine Sison',

    info: [
      {
        label: 'Full Name',
        value: 'Miguel Ramos'
      },
      {
        label: 'Birthdate',
        value: 'March 14, 1999'
      },
      {
        label: 'Contact Number',
        value: '0917 234 5566'
      },
      {
        label: 'Email Address',
        value: 'miguel.ramos@email.com'
      },
      {
        label: 'Address',
        value:
          'Audencial St, Barangay Poblacion East, ' +
          'Muñoz, 3119 Nueva Ecija',
        wide: true
      },
      {
        label: 'Emergency Contact',
        value: 'Elena Ramos'
      },
      {
        label: 'Emergency Number',
        value: '0928 118 9902'
      }
    ]
  },

  /*
   * These arrays must remain empty initially.
   * They are populated using the signed-in patient.
   */
  schedule: [],

  history: [],

  treatments: [
    {
      title: 'Braces Adjustment: Upper Arch',
      meta:
        'Jun 28, 2026 · Dr. Kathrine Sison · ' +
        'Wire tightened, next visit in 4 weeks',
      muted: false
    },
    {
      title: 'Panoramic X-Ray',
      meta:
        'May 30, 2026 · Dr. Arsenia Aromin · ' +
        'Root positioning within expected range',
      muted: true
    },
    {
      title: 'Braces Adjustment',
      meta:
        'Apr 25, 2026 · Dr. Kathrine Sison · ' +
        'Routine tightening',
      muted: true
    },
    {
      title: 'Braces Installation',
      meta:
        'Feb 14, 2026 · Dr. Kathrine Sison · ' +
        'Metal braces, upper & lower arch',
      muted: true
    }
  ],

  braces: {
    pct: '72%',
    monthLabel: 'MONTH 13/18',
    ringOffset: '105.5',

    stages: [
      {
        kind: 'done',
        num: null,
        name: 'Braces Installation',
        date: 'Completed: Feb 14, 2026'
      },
      {
        kind: 'done',
        num: null,
        name: 'Initial Alignment Phase',
        date: 'Completed: May 2026'
      },
      {
        kind: 'current',
        num: '13',
        name: 'Arch Adjustment Phase',
        date: 'In progress: Month 13 of 18'
      },
      {
        kind: 'pending',
        num: '18',
        name: 'Braces Removal & Retainer Fitting',
        date: 'Estimated: August 2027'
      }
    ],

    next: 'Next adjustment: July 5, 2026'
  },

  contract: {
    summary: [
      {
        v: '₱65,000',
        l: 'Total Contract Amount'
      },
      {
        v: '₱18,200',
        l: 'Remaining Balance'
      },
      {
        v: 'Jul 15',
        l: 'Next Payment Due'
      }
    ],

    progress: {
      width: '72%',
      left: 'Month 13 of 18',
      right: '72% Paid'
    },

    payments: [
      {
        date: 'Jun 15, 2026',
        amount: '₱3,600',
        method: 'GCash',
        or: 'OR-20260615-042'
      },
      {
        date: 'May 15, 2026',
        amount: '₱3,600',
        method: 'Cash',
        or: 'OR-20260515-042'
      },
      {
        date: 'Apr 15, 2026',
        amount: '₱3,600',
        method: 'GCash',
        or: 'OR-20260415-042'
      }
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