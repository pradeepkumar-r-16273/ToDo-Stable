// Vanilla JS Supabase client helper.
// Returns the shared client once ShadowDB has booted, or creates a new one.

(function () {
  const SUPABASE_URL = window.SUPABASE_CONFIG?.URL || 'https://hnvtowaljdkndhydtngb.supabase.co';
  const SUPABASE_KEY = window.SUPABASE_CONFIG?.ANON_KEY || 'sb_publishable_4gZLAyBXfHnXpFcd4_eH1w_NvIFD-tg';

  function getClient() {
    if (window.ShadowDB && window.ShadowDB._sb) return window.ShadowDB._sb;
    if (window.supabase && window.supabase.createClient) {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
    throw new Error('Supabase JS not loaded yet. Wait for shadowdb:ready event.');
  }

  // Returns a promise that resolves with the client when it's ready.
  function getClientAsync() {
    if (window.ShadowDB && window.ShadowDB._sb) {
      return Promise.resolve(window.ShadowDB._sb);
    }
    return new Promise(function (resolve) {
      document.addEventListener('shadowdb:ready', function () {
        resolve(window.ShadowDB._sb);
      }, { once: true });
    });
  }

  window.ShadowSupabase = { getClient, getClientAsync, SUPABASE_URL, SUPABASE_KEY };
})();
