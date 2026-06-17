// SINGLE SOURCE OF TRUTH for Supabase credentials
// ALL other files should reference this, not hardcode URLs/keys

window.SUPABASE_CONFIG = {
  URL: 'https://hnvtowaljdkndhydtngb.supabase.co',
  ANON_KEY: 'sb_publishable_4gZLAyBXfHnXpFcd4_eH1w_NvIFD-tg',
  PROJECT_REF: 'hnvtowaljdkndhydtngb'
};

// CRITICAL: Nuke old session tokens on load
(function() {
  const OLD_KEYS = [
    'shadow_session',
    'shadow_users',
    'shadow_rbac_current_user',
    'shadow_sb_auth',
    'sb-ycysvoolkezntbxcfrnq-auth-token',  // old project
    'supabase.auth.token'  // any old auth token
  ];

  OLD_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch(e) {}
  });

  console.log('[Supabase Config] Cleaned old session tokens');
})();
