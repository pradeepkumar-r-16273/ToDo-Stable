/**
 * user-roles-ui.js — UI for User Roles & Permission Management (PRD V1)
 * Group-specific: renders INSIDE Group Settings → "Roles & Permissions".
 * Each group has its own independent roles, permissions, and custom roles
 * (persisted per-group by user-roles.js). Additive; no other feature altered.
 *
 * Surfaces (per PRD, all group-level):
 *   - Members Management (role dropdown + authority badges)
 *   - Permission tab (action-level tier / relationship options + banners)
 *   - Custom Role Builder (name + base template + checkbox matrix)
 *   - "Preview as role" control + DOM masking to demonstrate enforcement.
 */
(function UserRolesUI() {
  'use strict';

  function UR() { return window.UserRoles; }
  var panelRoot = null;      // the #rolesSettingsMount container
  var panelGroupId = null;   // group currently shown in the panel
  var activeTab = 'members';

  // ── helpers ────────────────────────────────────────────────────────────────
  function groups() { return (window.state && window.state.groups) || []; }
  function members() { return (window.state && window.state.members) || (window.SHADOW_DEV_MEMBERS || []); }
  function groupName(gid) { var g = groups().find(function (x) { return x.id === gid; }); return g ? g.name : gid; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; }); }
  function q(sel) { return panelRoot ? panelRoot.querySelector(sel) : null; }
  function qa(sel) { return panelRoot ? Array.prototype.slice.call(panelRoot.querySelectorAll(sel)) : []; }

  function roleBadgeHTML(roleId, groupId) {
    var m = UR().RoleMeta[roleId];
    var color = m ? m.color : '#64748b';
    var icon = m && m.badge ? m.badge : null;
    var label = UR().roleLabel(roleId, groupId);
    return '<span class="ur-badge" style="--ur-c:' + color + '">' +
      (icon ? '<i class="fa-solid ' + icon + '"></i>' : '') + esc(label) + '</span>';
  }

  // ── mount / render ────────────────────────────────────────────────────────────
  function mountPanel(container, groupId) {
    if (!container || !UR()) return;
    panelRoot = container;
    panelGroupId = groupId || panelGroupId || (groups()[0] && groups()[0].id);
    container.innerHTML =
      '<div class="ur-panel">' +
        '<div class="ur-tabs">' +
          '<button class="ur-tab" data-tab="members"><i class="fa-solid fa-users"></i> Members</button>' +
          '<button class="ur-tab" data-tab="permissions"><i class="fa-solid fa-sliders"></i> Permission</button>' +
          '<button class="ur-tab" data-tab="custom"><i class="fa-solid fa-wand-magic-sparkles"></i> Custom Roles</button>' +
        '</div>' +
        '<div class="ur-body" id="urBody"></div>' +
        '<div class="ur-foot"><span class="ur-viewas">Preview as: <select id="urViewAs" class="ur-select"></select></span>' +
          '<span class="ur-foot-note">Preview enforcement for this group without switching accounts.</span></div>' +
      '</div>';
    container.querySelectorAll('.ur-tab').forEach(function (t) {
      t.addEventListener('click', function () { activeTab = t.dataset.tab; render(); });
    });
    var vsel = container.querySelector('#urViewAs');
    vsel.addEventListener('change', function () { onViewAs(this.value); });
    render();
  }

  function onViewAs(val) {
    if (val === '__self') UR().setViewAs(null);
    else {
      var meta = UR().RoleMeta[val];
      UR().setViewAs({ id: 'viewas_' + val, name: (meta ? meta.label : val) + ' (preview)', groupRole: val });
    }
    render(); applyMasking();
  }

  function render() {
    if (!panelRoot) return;
    var gid = panelGroupId;
    qa('.ur-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === activeTab); });
    var vsel = q('#urViewAs');
    if (vsel) {
      var cur = UR().getCurrentUser();
      var opts = ['<option value="__self">Myself (Group Admin)</option>'];
      [UR().Roles.GROUP_ADMIN, UR().Roles.GROUP_MODERATOR, UR().Roles.MEMBER, UR().Roles.VIEWER].forEach(function (r) {
        opts.push('<option value="' + r + '"' + (cur && cur.groupRole === r ? ' selected' : '') + '>' + esc(UR().RoleMeta[r].label) + '</option>');
      });
      vsel.innerHTML = opts.join('');
    }
    var body = q('#urBody'); if (!body) return;
    if (activeTab === 'members') body.innerHTML = renderMembers(gid);
    else if (activeTab === 'permissions') body.innerHTML = renderPermissions(gid);
    else body.innerHTML = renderCustom(gid);
    bindBody();
  }

  // ---- Members tab -------------------------------------------------------------
  function renderMembers(gid) {
    var assignable = UR().assignableRoles(gid);
    var standard = [UR().Roles.GROUP_ADMIN, UR().Roles.GROUP_MODERATOR, UR().Roles.MEMBER, UR().Roles.VIEWER];
    var customs = UR().listCustomRoles(gid);
    var canEdit = UR().isAdminOrMod(UR().effectiveRole(gid));
    var rows = members().map(function (u) {
      var role = UR().getUserRole(u.id, gid);
      var optionsHtml = standard.concat(customs.map(function (c) { return c.id; })).map(function (rid) {
        var disabled = (assignable.indexOf(rid) < 0 && rid !== role) ? ' disabled' : '';
        return '<option value="' + rid + '"' + (rid === role ? ' selected' : '') + disabled + '>' + esc(UR().roleLabel(rid, gid)) + '</option>';
      }).join('');
      return '<tr>' +
        '<td><div class="ur-user"><span class="ur-avatar" style="background:' + (u.color || '#64748b') + '">' + esc(u.avatar || (u.name || '?')[0]) + '</span>' +
          '<span>' + esc(u.name) + ' ' + roleBadgeHTML(role, gid) + '</span></div></td>' +
        '<td class="ur-email">' + esc(u.email || '') + '</td>' +
        '<td>' + (canEdit
          ? '<select class="ur-select ur-role-sel" data-uid="' + u.id + '">' + optionsHtml + '</select>'
          : roleBadgeHTML(role, gid)) + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="ur-section">' +
      '<p class="ur-desc">Assign a role to each member of <strong>' + esc(groupName(gid)) + '</strong>. You can only assign roles below your own level.</p>' +
      '<table class="ur-table"><thead><tr><th>Member</th><th>Email</th><th>Role</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '</div>';
  }

  // ---- Permission tab ----------------------------------------------------------
  function renderPermissions(gid) {
    var rows = UR().ACTIONS.map(function (a) {
      var current = UR().getAction(gid, a.key);
      var radios = a.options.map(function (opt) {
        return '<label class="ur-radio"><input type="radio" name="ur_act_' + a.key + '" value="' + opt + '"' +
          (opt === current ? ' checked' : '') + ' data-action="' + a.key + '"> ' + esc(UR().OPTION_LABEL[opt]) + '</label>';
      }).join('');
      var picker = '';
      if (current === 'selected') {
        var cfg = UR().getGroupConfig(gid);
        var sel = (cfg.selectedUsers[a.key]) || [];
        picker = '<div class="ur-picker">' + members().map(function (u) {
          return '<label class="ur-chk"><input type="checkbox" class="ur-seluser" data-action="' + a.key + '" value="' + u.id + '"' +
            (sel.indexOf(u.id) >= 0 ? ' checked' : '') + '> ' + esc(u.name) + '</label>';
        }).join('') + '</div>';
      }
      return '<div class="ur-perm-row"><div class="ur-perm-q">' + esc(a.label) + '</div>' +
        '<div class="ur-perm-opts">' + radios + '</div>' + picker + '</div>';
    }).join('');
    return '<div class="ur-section">' +
      '<div class="ur-banner"><i class="fa-solid fa-circle-info"></i> Group Admins can always perform every action, regardless of these settings.</div>' +
      rows +
      '<div class="ur-banner ur-banner-muted"><i class="fa-solid fa-layer-group"></i> Per-status permissions (Customization → Status) take precedence over “Who can change task status”.</div>' +
    '</div>';
  }

  // ---- Custom Roles tab --------------------------------------------------------
  function renderCustom(gid) {
    var isAdmin = UR().can(UR().Perms.CREATE_CUSTOM_ROLES, { groupId: gid });
    var list = UR().listCustomRoles(gid);
    if (!isAdmin) {
      return '<div class="ur-section"><div class="ur-banner ur-banner-muted"><i class="fa-solid fa-lock"></i> Only the Group Admin can create or manage custom roles.</div>' +
        (list.length ? list.map(function (r) { return '<div class="ur-crole">' + roleBadgeHTML(r.id, gid) + '</div>'; }).join('') : '<p class="ur-desc">No custom roles yet.</p>') + '</div>';
    }
    var cfg = UR().getGroupConfig(gid);
    var listHtml = list.length ? list.map(function (r) {
      var count = 0;
      Object.keys(cfg.assignments).forEach(function (uid) { if (cfg.assignments[uid] === r.id) count++; });
      return '<div class="ur-crole">' +
        '<div>' + roleBadgeHTML(r.id, gid) + ' <span class="ur-desc">(' + count + ' member' + (count === 1 ? '' : 's') + ')</span></div>' +
        '<div class="ur-crole-actions">' +
          '<button class="ur-btn-sm ur-edit-crole" data-id="' + r.id + '">Edit</button>' +
          '<button class="ur-btn-sm ur-danger ur-del-crole" data-id="' + r.id + '">Delete</button>' +
        '</div></div>';
    }).join('') : '<p class="ur-desc">No custom roles yet.</p>';

    return '<div class="ur-section">' +
      '<div class="ur-crole-head"><p class="ur-desc">Custom roles live only inside this group (max ' + UR().MAX_CUSTOM_ROLES + '). Destructive admin actions cannot be granted.</p>' +
        '<button class="ur-btn ur-new-crole"' + (list.length >= UR().MAX_CUSTOM_ROLES ? ' disabled' : '') + '><i class="fa-solid fa-plus"></i> New Custom Role</button></div>' +
      listHtml +
      '<div id="urCroleBuilder"></div>' +
    '</div>';
  }

  function renderBuilder(gid, existing) {
    var name = existing ? existing.name : '';
    var perms = existing ? existing.perms : {};
    var cats = {};
    UR().CUSTOM_ROLE_ALLOWED.forEach(function (p) {
      var meta = UR().PermMeta[p] || { label: p, category: 'Other' };
      (cats[meta.category] = cats[meta.category] || []).push({ perm: p, label: meta.label });
    });
    var matrix = Object.keys(cats).map(function (cat) {
      return '<div class="ur-cat"><div class="ur-cat-title">' + esc(cat) + '</div>' +
        cats[cat].map(function (x) {
          return '<label class="ur-chk"><input type="checkbox" class="ur-perm-chk" value="' + x.perm + '"' +
            (perms[x.perm] ? ' checked' : '') + '> ' + esc(x.label) + '</label>';
        }).join('') + '</div>';
    }).join('');
    var templates = '<option value="">— Base template —</option>' +
      '<option value="group_member">Member (task CRUD)</option>' +
      '<option value="group_moderator">Moderator (ops lead)</option>' +
      '<option value="viewer">Viewer (read-only)</option>';
    return '<div class="ur-builder">' +
      '<div class="ur-field"><label>Role Name</label><input type="text" id="urCroleName" class="ur-input" value="' + esc(name) + '" placeholder="e.g. Contributor"></div>' +
      '<div class="ur-field"><label>Base Template</label><select id="urCroleTpl" class="ur-select">' + templates + '</select></div>' +
      '<div class="ur-matrix">' + matrix + '</div>' +
      '<div class="ur-builder-actions">' +
        '<button class="ur-btn ur-save-crole" data-id="' + (existing ? existing.id : '') + '">' + (existing ? 'Save Changes' : 'Create Role') + '</button>' +
        '<button class="ur-btn ur-ghost ur-cancel-crole">Cancel</button>' +
      '</div></div>';
  }

  function applyTemplate(tpl) {
    var map = {}; UR().CUSTOM_ROLE_ALLOWED.forEach(function (p) { map[p] = false; });
    var base = UR().Matrix[tpl] || [];
    UR().CUSTOM_ROLE_ALLOWED.forEach(function (p) { if (base.indexOf(p) >= 0) map[p] = true; });
    qa('#urCroleBuilder .ur-perm-chk').forEach(function (cb) { cb.checked = !!map[cb.value]; });
  }

  // ── body event binding ─────────────────────────────────────────────────────
  function bindBody() {
    var gid = panelGroupId;
    qa('.ur-role-sel').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var res = UR().assignRole(this.dataset.uid, this.value, gid);
        if (!res.ok) alert(res.error);
        render(); applyMasking();
      });
    });
    qa('input[type=radio][data-action]').forEach(function (r) {
      r.addEventListener('change', function () { UR().setAction(gid, this.dataset.action, this.value); render(); });
    });
    qa('.ur-seluser').forEach(function (c) {
      c.addEventListener('change', function () {
        var key = this.dataset.action;
        var ids = qa('.ur-seluser[data-action="' + key + '"]').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
        UR().setAction(gid, key, 'selected', ids);
      });
    });
    var nb = q('.ur-new-crole');
    if (nb) nb.addEventListener('click', function () { q('#urCroleBuilder').innerHTML = renderBuilder(gid, null); bindBuilder(); });
    qa('.ur-edit-crole').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = UR().listCustomRoles(gid).find(function (x) { return x.id === b.dataset.id; });
        q('#urCroleBuilder').innerHTML = renderBuilder(gid, r); bindBuilder();
      });
    });
    qa('.ur-del-crole').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Delete this custom role? Affected members will be reassigned to Viewer.')) return;
        var res = UR().deleteCustomRole(gid, b.dataset.id, UR().Roles.VIEWER);
        if (res.ok && res.reassigned) alert(res.reassigned + ' member(s) reassigned to Viewer.');
        render();
      });
    });
  }

  function bindBuilder() {
    var gid = panelGroupId;
    var tpl = q('#urCroleTpl');
    if (tpl) tpl.addEventListener('change', function () { if (this.value) applyTemplate(this.value); });
    var save = q('#urCroleBuilder .ur-save-crole');
    if (save) save.addEventListener('click', function () {
      var name = (q('#urCroleName') || {}).value || '';
      var perms = {};
      qa('#urCroleBuilder .ur-perm-chk').forEach(function (cb) { perms[cb.value] = cb.checked; });
      var id = this.dataset.id;
      var res = id ? UR().updateCustomRole(gid, id, name, perms) : UR().createCustomRole(gid, name, perms);
      if (!res.ok) { alert(res.error); return; }
      render();
    });
    var cancel = q('#urCroleBuilder .ur-cancel-crole');
    if (cancel) cancel.addEventListener('click', function () { q('#urCroleBuilder').innerHTML = ''; });
  }

  // ── Group Settings integration ───────────────────────────────────────────────
  function mountIntoSettings() {
    var mount = document.getElementById('rolesSettingsMount');
    if (!mount) return;
    var gid = window.currentGroupId || (groups()[0] && groups()[0].id);
    if (panelRoot === mount && panelGroupId === gid) { render(); return; }
    mountPanel(mount, gid);
  }

  // ── DOM masking (hide unauthorized actions) ──────────────────────────────────
  function applyMasking() {
    var R = window.UserRoles; if (!R) return;
    var gid = (window.state && window.state.filterGroup) || (groups()[0] && groups()[0].id);
    var role = R.effectiveRole(gid);
    var isViewer = role === R.Roles.VIEWER;
    var canDelete = R.can(R.Perms.DELETE_TASKS, { groupId: gid, role: role });
    var canEdit = R.canDo('edit_task', { groupId: gid, role: role });
    var canCreate = R.canDo('create_tasks', { groupId: gid, role: role });
    function toggle(elm, show) { if (elm) elm.style.display = show ? '' : 'none'; }
    toggle(document.getElementById('newTaskBtn'), canCreate);
    document.body.classList.toggle('ur-viewer-mode', isViewer);
    document.body.classList.toggle('ur-no-delete', !canDelete);
    document.body.classList.toggle('ur-no-edit', !canEdit);
  }

  // ── boot ─────────────────────────────────────────────────────────────────────
  function boot() {
    if (!window.UserRoles) return;
    applyMasking();
    if (window.UserRoles.subscribe) window.UserRoles.subscribe(applyMasking);

    // Render the panel whenever the "Roles & Permissions" task-settings tab is opened.
    document.addEventListener('click', function (e) {
      var nav = e.target.closest && e.target.closest('.task-settings-nav-item[data-tsection="roles"]');
      if (nav) { setTimeout(mountIntoSettings, 30); return; }
      // opening a group / switching sub-tabs may re-show the roles section
      setTimeout(function () {
        var sec = document.getElementById('tsection-roles');
        if (sec && sec.classList.contains('active')) mountIntoSettings();
        applyMasking();
      }, 60);
    });
    console.log('[UserRolesUI] ready — Roles & Permissions embedded in Group Settings');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);

  window.UserRolesUI = { mountIntoSettings: mountIntoSettings, applyMasking: applyMasking };
})();
