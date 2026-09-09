/**
 * FullscreenToggle: Aromin-Sison Dental Clinic System.
 * Wires the #fullscreenToggle button to toggle browser fullscreen mode.
 */
(function () {
  'use strict';

  class FullscreenToggle {
    init() {
      const fsToggle = document.getElementById('fullscreenToggle');
      if (!fsToggle) return;

      fsToggle.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement
            .requestFullscreen()
            .catch((err) => {
              console.error(
                'Error attempting to enable fullscreen mode: ' + err.message
              );
            });
        } else {
          document.exitFullscreen();
        }
      });

      document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
          fsToggle.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"/></svg>';
        } else {
          fsToggle.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
        }
      });
    }
  }

  window.ASDC.FullscreenToggle = FullscreenToggle;
})();
