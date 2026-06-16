// Theme management - Light theme is default (Zoho Design)
function init() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  
  const saved = localStorage.getItem('shadow-theme');
  const isDark = saved === 'dark';
  
  if (isDark) {
    document.body.classList.add('dark-theme');
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-sun';
  } else {
    document.body.classList.remove('dark-theme');
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-moon';
  }
  
  btn.addEventListener('click', function() {
    const nowDark = document.body.classList.toggle('dark-theme');
    const theme = nowDark ? 'dark' : 'light';
    localStorage.setItem('shadow-theme', theme);
    const icon = btn.querySelector('i');
    if (icon) icon.className = nowDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    syncThemeToSupabase(theme);
  });

  function syncThemeToSupabase(theme) {
    if (!window.ShadowDB || !ShadowDB._sb) return;
    ShadowDB._sb.auth.getUser().then(function(res) {
      var uid = res.data && res.data.user && res.data.user.id;
      if (!uid) return;
      ShadowDB._sb.from('users').upsert({ id: uid, theme_preference: theme, updated_at: new Date().toISOString() }, { onConflict: 'id' }).then(function(){}).catch(function(){});
    });
  }

  /* On boot, load theme from Supabase if available */
  document.addEventListener('shadowdb:ready', function() {
    if (!window.ShadowDB || !ShadowDB._sb) return;
    ShadowDB._sb.auth.getUser().then(function(res) {
      var uid = res.data && res.data.user && res.data.user.id;
      if (!uid) return;
      ShadowDB._sb.from('users').select('theme_preference, theme_color').eq('id', uid).maybeSingle().then(function(r) {
        if (r.error || !r.data) return;
        if (r.data.theme_preference) {
          var isDark = r.data.theme_preference === 'dark';
          localStorage.setItem('shadow-theme', r.data.theme_preference);
          document.body.classList.toggle('dark-theme', isDark);
          var icon = btn && btn.querySelector('i');
          if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        if (r.data.theme_color) {
          localStorage.setItem('themeColor', r.data.theme_color);
        }
      });
    });
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
