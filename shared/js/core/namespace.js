/**
 * ASDC Namespace: Aromin-Sison Dental Clinic System.
 * Shared namespace for all frontend classes. Loaded first via script tag.
 */
(function () {
  'use strict';
  if (!window.ASDC) {
    window.ASDC = {};
  }
  if (!window.ASDC.API_BASE_URL && location.hostname === 'arominsisondental.vercel.app') {
    window.ASDC.API_BASE_URL = 'https://asdc-api-production.up.railway.app';
  }
})();
