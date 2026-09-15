// Empty dashboard state. Patient and financial records are loaded from authenticated APIs.
const PatientState = {
  "user": {
    "initials": "",
    "name": "",
    "role": "",
    "pid": "",
    "greeting": "Welcome back",
    "nextVisit": "Loading appointments…"
  },
  "notifications": [],
  "dashboard": {
    "stats": [
      {
        "iconBg": "rgba(183,196,204,0.35)",
        "iconColor": "#5C6E77",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18\"/></svg>",
        "num": "—",
        "label": "Upcoming Appointment",
        "trend": "",
        "trendClass": ""
      },
      {
        "iconBg": "rgba(156,139,62,0.14)",
        "iconColor": "var(--gold)",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M4 13c0-4 2-8 8-8s8 4 8 8-3 8-8 8-8-4-8-8Z\"/><path d=\"M8 13h8\"/></svg>",
        "num": "—",
        "label": "Braces Treatment Progress",
        "trend": "",
        "trendClass": ""
      },
      {
        "iconBg": "rgba(180,84,63,0.12)",
        "iconColor": "var(--red)",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\"/></svg>",
        "num": "—",
        "label": "Outstanding Balance",
        "trend": "",
        "trendClass": ""
      },
      {
        "iconBg": "rgba(183,196,204,0.35)",
        "iconColor": "#5C6E77",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 3v5h5\"/><path d=\"M3.05 13A9 9 0 1 0 6 5.3L3 8\"/><path d=\"M9 12l2 2 4-4\"/></svg>",
        "num": "—",
        "label": "Completed Visits",
        "trend": "",
        "trendClass": ""
      },
      {
        "iconBg": "rgba(156,139,62,0.14)",
        "iconColor": "var(--gold)",
        "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"M9 13h6M9 17h6\"/></svg>",
        "num": "—",
        "label": "Treatment Records",
        "trend": "",
        "trendClass": ""
      }
    ],
    "upcoming": [],
    "announcements": []
  },
  "profile": {
    "memberSince": "—",
    "primaryDentist": "—",
    "info": []
  },
  "schedule": [],
  "history": [],
  "treatments": [],
  "braces": {
    "active": false,
    "pct": "0%",
    "monthLabel": "",
    "ringOffset": "377",
    "heading": "",
    "description": "",
    "stages": [],
    "next": ""
  },
  "contract": {
    "active": false,
    "summary": [],
    "progress": {
      "width": "0%",
      "left": "",
      "right": ""
    },
    "payments": []
  },
  "promoCards": []
};
