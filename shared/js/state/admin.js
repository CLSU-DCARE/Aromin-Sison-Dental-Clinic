// Empty dashboard state. Patient and financial records are loaded from authenticated APIs.
const AdminState = {
  "user": {
    "initials": "",
    "name": "",
    "role": "",
    "pid": "",
    "greeting": "Welcome",
    "nextVisit": "Loading appointments…"
  },
  "notifications": [],
  "dashboard": {
    "stats": [
      {
        "iconBg": "rgba(92,122,92,0.12)",
        "iconColor": "var(--green)",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 12h-4l-3 9L9 3l-3 9H2\"/></svg>",
        "trend": "",
        "trendClass": "",
        "num": "—",
        "label": "Appointments this month"
      },
      {
        "iconBg": "rgba(199,145,62,0.14)",
        "iconColor": "var(--amber)",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z\"/></svg>",
        "trend": "",
        "trendClass": "",
        "num": "—",
        "label": "Active braces patients"
      },
      {
        "iconBg": "rgba(156,139,62,0.14)",
        "iconColor": "var(--gold)",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><line x1=\"2\" y1=\"10\" x2=\"22\" y2=\"10\"/></svg>",
        "trend": "",
        "trendClass": "",
        "num": "—",
        "label": "Collections this week"
      },
      {
        "iconBg": "rgba(180,84,63,0.12)",
        "iconColor": "var(--red)",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"/></svg>",
        "trend": "",
        "trendClass": "",
        "num": "—",
        "label": "Overdue braces contracts"
      }
    ],
    "weekLabel": "This week",
    "week": {
      "days": [],
      "rows": []
    },
    "queue": []
  },
  "patients": [],
  "records": [],
  "braces": [],
  "promotions": [],
  "reports": {
    "stats": [],
    "bars": []
  },
  "inventory": []
};
