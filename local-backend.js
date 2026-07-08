// local-backend.js
// LOCAL-ONLY ShadowDB — no Supabase, no login. All data in browser localStorage.
// Drop-in replacement for backend.js. Seeds 100 sample tasks + 3 groups on first run.
// Data lives in localStorage under 'shadow_local_db'; clearing it re-seeds.

(function () {
  'use strict';

  var LS_KEY = 'shadow_local_db';

  // ── Storage helpers ────────────────────────────────────────────────────────
  function loadDB() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch (e) { return null; }
  }
  function saveDB(db) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) {}
  }
  function uid() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }
  function nowISO() { return new Date().toISOString(); }
  function daysFromNow(n) {
    var d = new Date(); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysAgoISO(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  // ── Event bus ───────────────────────────────────────────────────────────────
  var listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, payload) { (listeners[evt] || []).forEach(function (fn) { try { fn(payload); } catch (_) {} }); }

  // ── Seed data ────────────────────────────────────────────────────────────────
  var DEV_USER = { id: 'local-dev-user', name: 'Pradeep', email: 'you@local.dev', role: 'admin', avatar: 'P', color: '#4285f4' };
  var MEMBERS = [
    { id: 'local-dev-user', name: 'Pradeep', email: 'you@local.dev', role: 'Owner',  avatar: 'P', color: '#4285f4' },
    { id: 'm_alex',         name: 'Alex Kim', email: 'alex@local.dev', role: 'Member', avatar: 'AK', color: '#0f9d58' },
    { id: 'm_sam',          name: 'Sam Lee',  email: 'sam@local.dev',  role: 'Member', avatar: 'SL', color: '#db4437' }
  ];

  var STATUSES = ['Open', 'In Progress', 'Fixed', 'Completed', 'Closed'];
  var PRIORITIES = ['High', 'Medium', 'Low'];

  function buildSeed() {
    var groups = [
      { id: 'grp_engineering', name: 'Engineering', color: '#1a73e8', type: 'group',    createdAt: daysAgoISO(30) },
      { id: 'grp_marketing',   name: 'Marketing',   color: '#34a853', type: 'group',    createdAt: daysAgoISO(25) },
      { id: 'grp_personal',    name: 'Personal',    color: '#ea4335', type: 'personal', isPersonal: true, createdAt: daysAgoISO(20) }
    ];

    var eng = [
      'Set up CI/CD pipeline', 'Implement authentication module', 'Database schema design',
      'API rate limiting', 'Write unit tests for user service', 'Refactor legacy payment module',
      'Add Redis caching layer', 'Fix SQL injection vulnerability', 'Implement search with Elasticsearch',
      'WebSocket real-time notifications', 'API documentation with Swagger', 'Mobile responsive dashboard',
      'Set up error monitoring (Sentry)', 'Implement data export (CSV/Excel)', 'Performance profiling',
      'Build notification email templates', 'Containerize app with Docker', 'Code review: auth PR #142',
      'Implement two-factor authentication', 'Migrate to TypeScript', 'Set up load balancer',
      'Build admin role management UI', 'Add pagination to list endpoints', 'Fix memory leak in worker',
      'Integration tests for payment flow', 'Dark mode for dashboard', 'Implement audit logging',
      'GraphQL API layer', 'Set up staging environment', 'Implement feature flags',
      'Database backup automation', 'Upgrade Node.js to v20 LTS', 'Build CSV import tool',
      'P95 latency investigation', 'Add health check endpoint', 'Implement GDPR data deletion',
      'Set up log aggregation (ELK)', 'Add retry logic for failed jobs', 'Frontend component library',
      'Pen test remediation tasks'
    ];
    var mkt = [
      'Q3 content calendar', 'Product launch campaign v2.0', 'Competitor analysis report',
      'Set up Google Analytics 4', 'Website homepage redesign brief', 'SEO audit and keyword research',
      'Case study: TechCorp success', 'Email list cleanup & segmentation', 'LinkedIn ads campaign setup',
      'Monthly newsletter — July', 'Brand voice & tone guidelines', 'Webinar: Productivity tips',
      'Pricing page A/B test', 'Twitter/X social strategy', 'Partner co-marketing proposal',
      'Video testimonials from customers', 'Referral program design', 'Update press kit',
      'Conference sponsorship evaluation', 'Onboarding email sequence redesign', 'G2 & Capterra review campaign',
      'Persona research interviews', 'Create demo video walkthrough', 'Update pricing page copy',
      'Podcast outreach — 10 shows', 'Build affiliate program', 'Feature highlight blog post',
      'CRM pipeline dashboard', 'Instagram visual guidelines', 'Q2 performance report',
      'Customer success stories', 'Cold email sequence for SMB', 'Product comparison pages',
      'Plan Q3 marketing offsite', 'Rewrite onboarding UX copy'
    ];
    var per = [
      'Book dentist appointment', 'Read: The Lean Startup', 'Set up standing desk',
      'Renew car insurance', 'Plan weekend hiking trip', 'Learn Figma basics',
      'File Q1 tax return', 'Monthly budget review', 'Buy birthday gift for mom',
      'Gym membership renewal', 'Meal prep for the week', 'Update LinkedIn profile',
      'Side project: finance tracker', 'Schedule annual health checkup', 'Declutter home office',
      'Spanish — 30 min daily', 'Research new laptop', 'Call parents on Sunday',
      'Write Q3 personal OKRs', 'AWS Solutions Architect course', 'Home internet upgrade',
      'Book December flights', 'Donate old clothes', 'Research meditation apps',
      'Portfolio website update'
    ];

    var tasks = [];
    function addTasks(titles, groupId, prefix) {
      titles.forEach(function (title, i) {
        var status = STATUSES[i % STATUSES.length];
        var isDone = (status === 'Completed' || status === 'Closed');
        var t = {
          id: prefix + (i + 1),
          group: groupId,
          status: status,
          title: title,
          description: '',
          priority: PRIORITIES[i % PRIORITIES.length],
          assignee: MEMBERS[i % MEMBERS.length].id,
          tags: [],
          subtasks: [],
          createdAt: daysAgoISO(30 - (i % 28)),
          modifiedDate: nowISO()
        };
        if (isDone) t.completedAt = daysAgoISO((i % 10) + 1);
        else t.dueDate = daysFromNow((i % 25) + 2);
        // a few with subtasks
        if (i % 12 === 0) {
          t.subtasks = [
            { id: uid(), title: 'Sub-step A', done: true },
            { id: uid(), title: 'Sub-step B', done: false },
            { id: uid(), title: 'Sub-step C', done: false }
          ];
        }
        tasks.push(t);
      });
    }
    addTasks(eng, 'grp_engineering', 'task_e');
    addTasks(mkt, 'grp_marketing', 'task_m');
    addTasks(per, 'grp_personal', 'task_p');

    var tags = [
      { id: 'tag_urgent',  name: 'Urgent',  color: '#e74c3c' },
      { id: 'tag_backend', name: 'Backend', color: '#3498db' },
      { id: 'tag_design',  name: 'Design',  color: '#9b59b6' }
    ];
    var categories = [
      { id: 'cat_general', name: 'General', group: null }
    ];

    return {
      tasks: tasks,
      groups: groups,
      tags: tags,
      categories: categories,
      members: MEMBERS.slice(),
      customFields: [],
      comments: [],
      activity: [],
      settings: {}
    };
  }

  // ── Initialize / load ─────────────────────────────────────────────────────────
  var db = loadDB();
  if (!db || !db.tasks || !db.tasks.length) {
    db = buildSeed();
    saveDB(db);
    console.log('[LocalDB] Seeded 100 sample tasks + 3 groups');
  }

  function persist() { saveDB(db); }

  // ── Generic CRUD over an in-memory array persisted to localStorage ──────────────
  function crud(store) {
    return {
      create: function (obj) {
        var rec = Object.assign({}, obj);
        if (!rec.id) rec.id = uid();
        if (rec.groupId && !rec.group) rec.group = rec.groupId;
        rec.createdAt = rec.createdAt || nowISO();
        rec.modifiedDate = nowISO();
        db[store].push(rec);
        persist();
        emit(store.slice(0, -1) + ':created', rec);
        emit('data:changed', { entity: store, action: 'create' });
        return Promise.resolve(rec);
      },
      get: function (id) { return this.getById(id); },
      getById: function (id) {
        return Promise.resolve(db[store].find(function (r) { return r.id === id; }) || null);
      },
      getAll: function () { return Promise.resolve((db[store] || []).slice()); },
      update: function (obj) {
        if (!obj || !obj.id) return Promise.reject(new Error('update() needs an id'));
        var idx = db[store].findIndex(function (r) { return r.id === obj.id; });
        if (idx === -1) { db[store].push(obj); }
        else { db[store][idx] = Object.assign({}, db[store][idx], obj, { modifiedDate: nowISO() }); }
        persist();
        var out = db[store][idx === -1 ? db[store].length - 1 : idx];
        emit(store.slice(0, -1) + ':updated', out);
        emit('data:changed', { entity: store, action: 'update' });
        return Promise.resolve(out);
      },
      delete: function (id) {
        db[store] = db[store].filter(function (r) { return r.id !== id; });
        persist();
        emit(store.slice(0, -1) + ':deleted', { id: id });
        emit('data:changed', { entity: store, action: 'delete' });
        return Promise.resolve(true);
      },
      count: function () { return Promise.resolve((db[store] || []).length); }
    };
  }

  var Tasks = crud('tasks');
  Tasks.getByGroup    = function (gid) { return Tasks.getAll().then(function (a) { return a.filter(function (t) { return t.group === gid; }); }); };
  Tasks.getByStatus   = function (st)  { return Tasks.getAll().then(function (a) { return a.filter(function (t) { return t.status === st; }); }); };
  Tasks.getByAssignee = function (aid) { return Tasks.getAll().then(function (a) { return a.filter(function (t) { return t.assignee === aid; }); }); };
  Tasks.complete      = function (id)  { return Tasks.update({ id: id, status: 'Completed', completedAt: nowISO() }); };
  Tasks.reopen        = function (id)  { return Tasks.update({ id: id, status: 'Open', completedAt: null }); };
  Tasks.addSubtask    = function (id, sub) {
    return Tasks.getById(id).then(function (t) {
      var subs = Array.isArray(t.subtasks) ? t.subtasks : [];
      subs.push(Object.assign({ id: uid(), done: false }, sub));
      return Tasks.update(Object.assign({}, t, { subtasks: subs }));
    });
  };
  Tasks.toggleSubtask = function (id, subId) {
    return Tasks.getById(id).then(function (t) {
      var subs = (t.subtasks || []).map(function (s) { return s.id === subId ? Object.assign({}, s, { done: !s.done }) : s; });
      return Tasks.update(Object.assign({}, t, { subtasks: subs }));
    });
  };
  Tasks.search = function (q) {
    var n = (q || '').toLowerCase();
    return Tasks.getAll().then(function (a) {
      return a.filter(function (t) { return (t.title || '').toLowerCase().indexOf(n) >= 0 || (t.description || '').toLowerCase().indexOf(n) >= 0; });
    });
  };
  Tasks.getStats = function () {
    return Tasks.getAll().then(function (a) {
      return { total: a.length, done: a.filter(function (t) { return t.status === 'Completed'; }).length, open: a.filter(function (t) { return t.status !== 'Completed'; }).length };
    });
  };

  var Groups       = crud('groups');
  var Tags         = crud('tags');
  var Categories   = crud('categories'); Categories.getByGroup = function (gid) { return Categories.getAll().then(function (a) { return a.filter(function (c) { return c.group === gid; }); }); };
  var Members      = crud('members');    Members.getByGroup    = function (gid) { return Members.getAll().then(function (a) { return a.filter(function (m) { return m.group === gid; }); }); };
  var CustomFields = crud('customFields');CustomFields.getByGroup = function (gid) { return CustomFields.getAll().then(function (a) { return a.filter(function (f) { return f.group === gid; }); }); };

  var Comments = crud('comments');
  Comments.getByTask = function (tid) { return Comments.getAll().then(function (a) { return a.filter(function (c) { return c.taskId === tid || c.task_id === tid; }); }); };

  var Activity = {
    getAll:    function ()   { return Promise.resolve((db.activity || []).slice().reverse()); },
    getByTask: function (tid){ return Promise.resolve((db.activity || []).filter(function (a) { return a.taskId === tid; }).reverse()); },
    getRecent: function (n)  { return Promise.resolve((db.activity || []).slice().reverse().slice(0, n || 50)); },
    create:    function (obj){ var rec = Object.assign({ id: uid(), createdAt: nowISO() }, obj); db.activity.push(rec); persist(); return Promise.resolve(rec); },
    clear:     function ()   { db.activity = []; persist(); return Promise.resolve(true); }
  };

  var Settings = {
    get:    function (key)    { return Promise.resolve(db.settings[key] != null ? db.settings[key] : null); },
    set:    function (key, v) { db.settings[key] = v; persist(); return Promise.resolve(true); },
    getAll: function ()       { return Promise.resolve(Object.assign({}, db.settings)); }
  };

  var STORES = { tasks: 'tasks', groups: 'groups', tags: 'tags', categories: 'categories', members: 'members', customFields: 'customFields', comments: 'comments', activity: 'activity', settings: 'settings' };

  window.ShadowDB = {
    STORES: STORES,
    _sb: null,          // no Supabase — all Supabase-guarded sync code no-ops
    _local: true,
    on: on, emit: emit,
    init: function () { return Promise.resolve(true); },
    openDB: function () { return Promise.resolve(true); },
    seed: function () { return Promise.resolve(true); },
    resetAll: function () { db = buildSeed(); persist(); emit('data:changed', { entity: 'all', action: 'reset' }); return Promise.resolve(true); },
    exportAll: function () { return Promise.resolve(JSON.parse(JSON.stringify(db))); },
    importAll: function (payload) { db = Object.assign(db, payload || {}); persist(); emit('data:changed', { entity: 'all', action: 'import' }); return Promise.resolve(true); },
    Tasks: Tasks, Groups: Groups, Tags: Tags, Categories: Categories,
    Members: Members, CustomFields: CustomFields, Comments: Comments,
    Activity: Activity, Settings: Settings
  };

  // Truthy so shadow-db-patch.js's whenDBReady() runs immediately.
  window.__shadowdbReady = true;
  window.SHADOW_DEV_USER = DEV_USER;
  window.SHADOW_DEV_MEMBERS = MEMBERS.slice();

  // ── Neutralize ShadowAuth (no login) once it exists ─────────────────────────────
  function patchAuth() {
    if (!window.ShadowAuth) return;
    ShadowAuth.getOrgMembers  = function () { return MEMBERS.slice(); };
    ShadowAuth.getCurrentUser = function () { return DEV_USER; };
    ShadowAuth.isLoggedIn     = function () { return true; };
    ShadowAuth.getRole        = function () { return DEV_USER.role; };
    ShadowAuth.hasPermission  = function () { return true; };
    ShadowAuth.checkAuth      = function () { return Promise.resolve(true); };
    ShadowAuth.renderLoginScreen = function () {};
  }

  // Fire the ready event after the DOM (and app.js listeners) are in place.
  function go() {
    patchAuth();
    document.dispatchEvent(new CustomEvent('shadowdb:ready'));
    window.dispatchEvent(new CustomEvent('shadowdb:ready'));
    console.log('[LocalDB] Ready — login disabled, data stored locally');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go);
  } else {
    setTimeout(go, 0);
  }
})();
