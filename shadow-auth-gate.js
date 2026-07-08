// shadow-auth-gate.js — DISABLED for local dev.
// Login has been removed. This file intentionally does nothing except mark the
// gate as "already passed" so app.js does not try to show a login wall or
// double-initialize. All data is local (see local-backend.js).
(function () {
  'use strict';
  window._sagGateReady  = true;   // tell app.js a gate exists…
  window._sagAppStarted = true;   // …and that startup is already handled
  // Local "sign out" = wipe local data and reload with a fresh seed.
  window.sagLogout = function () {
    try { localStorage.removeItem('shadow_local_db'); } catch (e) {}
    location.reload();
  };
  console.log('[AuthGate] Login disabled (local dev mode)');
})();
