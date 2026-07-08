/**
 * user-roles-ui.js — UI for User Roles & Permission Management (PRD V1)
 * Additive: adds a "Roles & Permissions" manager, avatar badges, a QA
 * "View as role" switcher, and DOM masking. Does not modify other features.
 *
 * Surfaces (per PRD):
 *   - Members Management (role dropdown + badges)
 *   - Permission tab (action-level tier / relationship options + banners)
 *   - Custom Role Builder (name + base template + checkbox matrix)
 * Reachable from a header "Roles" chip (scoped to the active group) and,
 * when available, from the Group Settings task-settings nav.
 */
(function UserRolesUI() {
  'use strict';

  function UR() { return window.UserRoles; }
  var activeGroupId = null;
  var activeTab = 'members';

  // ── helpers ────────────────────────────────────────────────────────────────
  function groups() { return (window.state && window.state.groups) || []; }
  function members() { return (window.state && window.state.members) || (window.SHADOW_DEV_MEMBERS || []); }
  function firstGroupId() { var g = groups()[0]; return g ? g.id : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; }); }

  function roleBadgeHTML(roleId, groupId) {
    var m = UR().RoleMeta[roleId];
    var color = m ? m.color : '#64748b';
    var icon = m && m.badge ? m.badge : null;
    var label = UR().roleLabel(roleId, groupId);
    return '<span class="ur-badge" style="--ur-c:' + color + '">' +
      (icon ? '<i class="fa-solid ' + icon + '"></i>' : '') + esc(label) + '</span>';
  }

  // ── modal shell ──────────────────────────────────────────────────────────────
  function ensureModal() {
    if (document.getElementById('urModal')) return;
    var el = document.createElement('div');
    el.id = 'urModal';
    el.className = 'ur-overlay';
    el.style.display = 'none';
    el.innerHTML =
      '<div class="ur-dialog" role="dialog" aria-modal="true" aria-label="Roles & Permissions">' +
        '<div class="ur-head">' +
          '<div class="ur-title"><i class="fa-solid fa-user-shield"></i> Roles &amp; Permissions</div>' +
          '<div class="ur-group-wrap">Group: <select id="urGroupSel" class="ur-select"></select></div>' +
          '<button class="ur-close" id="urClose" title="Close">&times;</button>' +
        '</div>' +
        '<div class="ur-tabs">' +
          '<button class="ur-tab" data-tab="members"><i class="fa-solid fa-users"></i> Members</button>' +
          '<button class="ur-tab" data-tab="permissions"><i class="fa-solid fa-sliders"></i> Permission</button>' +
          '<button class="ur-tab" data-tab="custom"><i class="fa-solid fa-wand-magic-sparkles"></i> Custom Roles</button>' +
        '</div>' +
        '<div class="ur-body" id="urBody"></div>' +
        '<div class="ur-foot"><span class="ur-viewas">View as: <select id="urViewAs" class="ur-select"></select></span>' +
          '<span class="ur-foot-note">Single-user local demo — switch roles to preview enforcement.</span></div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) { if (e.target === el) closeModal(); });
    document.getElementById('urClose').addEventListener('click', closeModal);
    document.getElementById('urGroupSel').addEventListener('change', function () { activeGroupId = this.value; render(); });
    document.getElementById('urViewAs').addEventListener('change', function () { onViewAs(this.value); });
    el.querySelectorAll('.ur-tab').forEach(function (t) {
      t.addEventListener('click', function () { activeTab = t.dataset.tab; render(); });
    });
  }

  function openModal(groupId) {
    ensureModal();
    activeGroupId = groupId || activeGroupId || firstGroupId();
    document.getElementById('urModal').style.display = 'flex';
    render();
  }
  function closeModal() { var m = document.getElementById('urModal'); if (m) m.style.display = 'none'; }

  function onViewAs(val) {
    if (val === '__self') { UR().setViewAs(null); }
    else {
      var meta = UR().RoleMeta[val];
      UR().setViewAs({ id: 'viewas_' + val, name: (meta ? meta.label : val) + ' (preview)', groupRole: val });
    }
    render(); applyMasking();
  }

  // ── render ──────────────────────────────────────────────────────────────────
  function render() {
    var gsel = document.getElementById('urGroupSel');
    if (gsel) {
      gsel.innerHTML = groups().map(function (g) {
        return '<option value="' + g.id + '"' + (g.id === activeGroupId ? ' selected' : '') + '>' + esc(g.name) + '</option>';
      }).join('');
      if (!activeGroupId && groups()[0]) activeGroupId = groups()[0].id;
    }
    var vsel = document.getElementById('urViewAs');
    if (vsel) {
      var cur = UR().getCurrentUser();
      var opts = ['<option value="__self">Myself (Group Admin)</option>'];
      [UR().Roles.GROUP_ADMIN, UR().Roles.GROUP_MODERATOR, UR().Roles.MEMBER, UR().Roles.VIEWER].forEach(function (r) {
        var sel = cur && cur.groupRole === r ? ' selected' : '';
        opts.push('<option value="' + r + '"' + sel + '>' + esc(UR().RoleMeta[r].label) + '</option>');
      });
      vsel.innerHTML = opts.join('');
    }
    document.querySelectorAll('#urModal .ur-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === activeTab);
    });
    var body = document.getElementById('urBody');
    if (!body) return;
    if (activeTab === 'members') body.innerHTML = renderMembers();
    else if (activeTab === 'permissions') body.innerHTML = renderPermissions();
    else body.innerHTML = renderCustom();
    bindBody();
  }

  // ---- Members tab -------------------------------------------------------------
  function renderMembers() {
    var gid = activeGroupId;
    var assignable = UR().assignableRoles(gid);
    var standard = [UR().Roles.GROUP_ADMIN, UR().Roles.GROUP_MODERATOR, UR().Roles.MEMBER, UR().Roles.VIEWER];
    var customs = UR().listCustomRoles(gid);
    var rows = members().map(function (u) {
      var role = UR().getUserRole(u.id, gid);
      var canEdit = UR().isAdminOrMod(UR().effectiveRole(gid));
      var optionsHtml = standard.concat(customs.map(function (c) { return c.id; })).map(function (rid) {
        var label = UR().roleLabel(rid, gid);
        var disabled = (assignable.indexOf(rid) < 0 && rid !== role) ? ' disabled' : '';
        return '<option value="' + rid + '"' + (rid === role ? ' selected' : '') + disabled + '>' + esc(label) + '</option>';
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
      '<p class="ur-desc">Assign a role to each member of this group. You can only assign roles below your own level.</p>' +
      '<table class="ur-table"><thead><tr><th>Member</th><th>Email</th><th>Role</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '</div>';
  }

  // ---- Permission tab ----------------------------------------------------------
  function renderPermissions() {
    var gid = activeGroupId;
    var rows = UR().ACTIONS.map(function (a) {
      var current = UR().getAction(gid, a.key);
      var radios = a.options.map(function (opt) {
        var id = 'ur_' + a.key + '_' + opt;
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
  function renderCustom() {
    var gid = activeGroupId;
    var isAdmin = UR().can(UR().Perms.CREATE_CUSTOM_ROLES, { groupId: gid });
    var list = UR().listCustomRoles(gid);
    if (!isAdmin) {
      return '<div class="ur-section"><div class="ur-banner ur-banner-muted"><i class="fa-solid fa-lock"></i> Only the Group Admin can create or manage custom roles.</div>' +
        (list.length ? list.map(function (r) { return '<div class="ur-crole">' + roleBadgeHTML(r.id, gid) + '</div>'; }).join('') : '<p class="ur-desc">No custom roles yet.</p>') + '</div>';
    }
    var listHtml = list.length ? list.map(function (r) {
      var count = 0; var cfg = UR().getGroupConfig(gid);
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

  function renderBuilder(existing) {
    var gid = activeGroupId;
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
    document.querySelectorAll('#urCroleBuilder .ur-perm-chk').forEach(function (cb) { cb.checked = !!map[cb.value]; });
  }

  // ── body event binding ─────────────────────────────────────────────────────
  function bindBody() {
    var gid = activeGroupId;
    // Members: role change
    document.querySelectorAll('#urBody .ur-role-sel').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var res = UR().assignRole(this.dataset.uid, this.value, gid);
        if (!res.ok) { alert(res.error); }
        render(); applyMasking();
      });
    });
    // Permissions: radios
    document.querySelectorAll('#urBody input[type=radio][data-action]').forEach(function (r) {
      r.addEventListener('change', function () { UR().setAction(gid, this.dataset.action, this.value); render(); });
    });
    // Permissions: selected-user checkboxes
    document.querySelectorAll('#urBody .ur-seluser').forEach(function (c) {
      c.addEventListener('change', function () {
        var key = this.dataset.action;
        var ids = Array.prototype.map.call(document.querySelectorAll('#urBody .ur-seluser[data-action="' + key + '"]:checked'), function (x) { return x.value; });
        UR().setAction(gid, key, 'selected', ids);
      });
    });
    // Custom roles
    var nb = document.querySelector('#urBody .ur-new-crole');
    if (nb) nb.addEventListener('click', function () { document.getElementById('urCroleBuilder').innerHTML = renderBuilder(null); bindBuilder(); });
    document.querySelectorAll('#urBody .ur-edit-crole').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = UR().listCustomRoles(gid).find(function (x) { return x.id === b.dataset.id; });
        document.getElementById('urCroleBuilder').innerHTML = renderBuilder(r); bindBuilder();
      });
    });
    document.querySelectorAll('#urBody .ur-del-crole').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Delete this custom role? Affected members will be reassigned to Viewer.')) return;
        var res = UR().deleteCustomRole(gid, b.dataset.id, UR().Roles.VIEWER);
        if (res.ok && res.reassigned) alert(res.reassigned + ' member(s) reassigned to Viewer.');
        render();
      });
    });
  }

  function bindBuilder() {
    var gid = activeGroupId;
    var tpl = document.getElementById('urCroleTpl');
    if (tpl) tpl.addEventListener('change', function () { if (this.value) applyTemplate(this.value); });
    var save = document.querySelector('#urCroleBuilder .ur-save-crole');
    if (save) save.addEventListener('click', function () {
      var name = (document.getElementById('urCroleName') || {}).value || '';
      var perms = {};
      document.querySelectorAll('#urCroleBuilder .ur-perm-chk').forEach(function (cb) { perms[cb.value] = cb.checked; });
      var id = this.dataset.id;
      var res = id ? UR().updateCustomRole(gid, id, name, perms) : UR().createCustomRole(gid, name, perms);
      if (!res.ok) { alert(res.error); return; }
      render();
    });
    var cancel = document.querySelector('#urCroleBuilder .ur-cancel-crole');
    if (cancel) cancel.addEventListener('click', function () { document.getElementById('urCroleBuilder').innerHTML = ''; });
  }

  // ── header launcher chip ─────────────────────────────────────────────────────
  function addHeaderChip() {
    if (document.getElementById('urHeaderChip')) return;
    var host = document.querySelector('.header-right');
    if (!host) return;
    var btn = document.createElement('button');
    btn.id = 'urHeaderChip';
    btn.className = 'icon-btn';
    btn.title = 'Roles & Permissions';
    btn.innerHTML = '<i class="fa-solid fa-user-shield"></i>';
    btn.addEventListener('click', function () {
      var gid = (window.state && window.state.filterGroup) || firstGroupId();
      openModal(gid);
    });
    host.insertBefore(btn, host.firstChild);
  }

  // ── DOM masking (hide unauthorized actions) ──────────────────────────────────
  // Hides destructive/edit controls when the effective role lacks the permission.
  function applyMasking() {
    var R = window.UserRoles; if (!R) return;
    var gid = (window.state && window.state.filterGroup) || firstGroupId();
    var role = R.effectiveRole(gid);
    var isViewer = role === R.Roles.VIEWER;
    var canDelete = R.can(R.Perms.DELETE_TASKS, { groupId: gid, role: role });
    var canEdit = R.canDo('edit_task', { groupId: gid, role: role });
    var canCreate = R.canDo('create_tasks', { groupId: gid, role: role });

    function toggle(elm, show) { if (elm) elm.style.display = show ? '' : 'none'; }
    // New Task button
    toggle(document.getElementById('newTaskBtn'), canCreate);
    // Settings gear (core group settings) — only admins
    toggle(document.getElementById('settingsBtn'), R.can(R.Perms.EDIT_CORE_SETTINGS, { groupId: gid, role: role }) || R.isAdminRole(role));
    // Body classes for CSS-driven masking (delete icons, read-only fields)
    document.body.classList.toggle('ur-viewer-mode', isViewer);
    document.body.classList.toggle('ur-no-delete', !canDelete);
    document.body.classList.toggle('ur-no-edit', !canEdit);
  }

  // ── boot ─────────────────────────────────────────────────────────────────────
  function boot() {
    if (!window.UserRoles) return;
    addHeaderChip();
    applyMasking();
    if (window.UserRoles.subscribe) window.UserRoles.subscribe(applyMasking);
    // Re-apply masking after view re-renders
    document.addEventListener('click', function () { setTimeout(applyMasking, 50); });
    console.log('[UserRolesUI] ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);

  window.UserRolesUI = { open: openModal, applyMasking: applyMasking };
})();
