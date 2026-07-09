/**
 * user-roles-ui.js — UI for User Roles & Permission Management (PRD V1)
 * Group-specific, rendered inside Group Settings as two top-level tabs:
 *   - "Member Roles"        → member listing + role steering + Custom Roles
 *                             ("Create Custom Role" opens a modal builder)
 *   - "Permission Management"→ action-level permission settings + banners
 * Each group keeps its own independent config (see user-roles.js).
 * Additive; no other feature altered.
 */
(function UserRolesUI() {
  'use strict';

  function UR() { return window.UserRoles; }

  // ── helpers ────────────────────────────────────────────────────────────────
  function groups() { return (window.state && window.state.groups) || []; }
  function members() { return (window.state && window.state.members) || (window.SHADOW_DEV_MEMBERS || []); }
  function groupName(gid) { var g = groups().find(function (x) { return x.id === gid; }); return g ? g.name : gid; }
  function curGid() { return window.currentGroupId || (groups()[0] && groups()[0].id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; }); }

  function roleBadgeHTML(roleId, gid) {
    var m = UR().RoleMeta[roleId];
    var color = m ? m.color : '#64748b';
    var icon = m && m.badge ? m.badge : null;
    return '<span class="ur-badge" style="--ur-c:' + color + '">' +
      (icon ? '<i class="fa-solid ' + icon + '"></i>' : '') + esc(UR().roleLabel(roleId, gid)) + '</span>';
  }

  // ── Member Roles tab ─────────────────────────────────────────────────────────
  function mountMemberRoles() {
    var host = document.getElementById('memberRolesMount'); if (!host || !UR()) return;
    var gid = curGid();
    var assignable = UR().assignableRoles(gid);
    var standard = [UR().Roles.GROUP_ADMIN, UR().Roles.GROUP_MODERATOR, UR().Roles.MEMBER, UR().Roles.VIEWER];
    var customs = UR().listCustomRoles(gid);
    var canEdit = UR().isAdminOrMod(UR().effectiveRole(gid));
    var canManageCustom = UR().can(UR().Perms.CREATE_CUSTOM_ROLES, { groupId: gid });

    var rows = members().map(function (u) {
      var role = UR().getUserRole(u.id, gid);
      var options = standard.concat(customs.map(function (c) { return c.id; })).map(function (rid) {
        var disabled = (assignable.indexOf(rid) < 0 && rid !== role) ? ' disabled' : '';
        return '<option value="' + rid + '"' + (rid === role ? ' selected' : '') + disabled + '>' + esc(UR().roleLabel(rid, gid)) + '</option>';
      }).join('');
      return '<tr>' +
        '<td><div class="ur-user"><span class="ur-avatar" style="background:' + (u.color || '#64748b') + '">' + esc(u.avatar || (u.name || '?')[0]) + '</span>' +
          '<span>' + esc(u.name) + ' ' + roleBadgeHTML(role, gid) + '</span></div></td>' +
        '<td class="ur-email">' + esc(u.email || '') + '</td>' +
        '<td>' + (canEdit ? '<select class="ur-select ur-role-sel" data-uid="' + u.id + '">' + options + '</select>' : roleBadgeHTML(role, gid)) + '</td>' +
      '</tr>';
    }).join('');

    var cfg = UR().getGroupConfig(gid);
    var customList = customs.length ? customs.map(function (r) {
      var count = 0; Object.keys(cfg.assignments).forEach(function (uid) { if (cfg.assignments[uid] === r.id) count++; });
      return '<div class="ur-crole">' +
        '<div>' + roleBadgeHTML(r.id, gid) + ' <span class="ur-desc">(' + count + ' member' + (count === 1 ? '' : 's') + ')</span></div>' +
        (canManageCustom ? '<div class="ur-crole-actions">' +
          '<button class="ur-btn-sm ur-edit-crole" data-id="' + r.id + '">Edit</button>' +
          '<button class="ur-btn-sm ur-danger ur-del-crole" data-id="' + r.id + '">Delete</button>' +
        '</div>' : '') +
      '</div>';
    }).join('') : '<p class="ur-desc">No custom roles yet.</p>';

    host.innerHTML =
      '<div class="ur-section">' +
        '<p class="ur-desc">Assign a role to each member of <strong>' + esc(groupName(gid)) + '</strong>. You can only assign roles below your own level.</p>' +
        '<table class="ur-table"><thead><tr><th>Member</th><th>Email</th><th>Role</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="ur-crole-head" style="margin-top:18px">' +
          '<div><strong>Custom Roles</strong><p class="ur-desc" style="margin-top:2px">Custom roles live only inside this group (max ' + UR().MAX_CUSTOM_ROLES + ').</p></div>' +
          (canManageCustom ? '<button class="ur-btn ur-new-crole"' + (customs.length >= UR().MAX_CUSTOM_ROLES ? ' disabled' : '') + '><i class="fa-solid fa-plus"></i> Create Custom Role</button>' : '') +
        '</div>' +
        customList +
        '<div class="ur-foot" style="margin-top:16px;border-top:1px solid var(--border-color,#e5e7eb);padding-top:12px">' +
          '<span class="ur-viewas">Preview as: <select id="urViewAs" class="ur-select"></select></span>' +
          '<span class="ur-foot-note">Preview enforcement without switching accounts.</span>' +
        '</div>' +
      '</div>';

    // preview-as options
    var vsel = host.querySelector('#urViewAs');
    var cur = UR().getCurrentUser();
    vsel.innerHTML = ['<option value="__self">Myself (Group Admin)</option>'].concat(
      [UR().Roles.GROUP_ADMIN, UR().Roles.GROUP_MODERATOR, UR().Roles.MEMBER, UR().Roles.VIEWER].map(function (r) {
        return '<option value="' + r + '"' + (cur && cur.groupRole === r ? ' selected' : '') + '>' + esc(UR().RoleMeta[r].label) + '</option>';
      })).join('');
    vsel.addEventListener('change', function () {
      if (this.value === '__self') UR().setViewAs(null);
      else { var m = UR().RoleMeta[this.value]; UR().setViewAs({ id: 'viewas_' + this.value, name: (m ? m.label : this.value) + ' (preview)', groupRole: this.value }); }
      mountMemberRoles(); applyMasking();
    });

    // bind members
    host.querySelectorAll('.ur-role-sel').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var res = UR().assignRole(this.dataset.uid, this.value, gid);
        if (!res.ok) alert(res.error);
        mountMemberRoles(); applyMasking();
      });
    });
    // custom role buttons
    var nb = host.querySelector('.ur-new-crole');
    if (nb) nb.addEventListener('click', function () { openCustomRoleModal(gid, null); });
    host.querySelectorAll('.ur-edit-crole').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = UR().listCustomRoles(gid).find(function (x) { return x.id === b.dataset.id; });
        openCustomRoleModal(gid, r);
      });
    });
    host.querySelectorAll('.ur-del-crole').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Delete this custom role? Affected members will be reassigned to Viewer.')) return;
        var res = UR().deleteCustomRole(gid, b.dataset.id, UR().Roles.VIEWER);
        if (res.ok && res.reassigned) alert(res.reassigned + ' member(s) reassigned to Viewer.');
        mountMemberRoles();
      });
    });
  }

  // ── Permission Management tab ─────────────────────────────────────────────────
  function mountPermissions() {
    var host = document.getElementById('permissionMgmtMount'); if (!host || !UR()) return;
    var gid = curGid();
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
    host.innerHTML = '<div class="ur-section">' +
      '<p class="ur-desc">Decide who can perform each task action in <strong>' + esc(groupName(gid)) + '</strong>.</p>' +
      '<div class="ur-banner"><i class="fa-solid fa-circle-info"></i> Group Admins can always perform every action, regardless of these settings.</div>' +
      rows +
      '<div class="ur-banner ur-banner-muted"><i class="fa-solid fa-layer-group"></i> Per-status permissions (Customization → Status) take precedence over “Who can change task status”.</div>' +
    '</div>';

    host.querySelectorAll('input[type=radio][data-action]').forEach(function (r) {
      r.addEventListener('change', function () { UR().setAction(gid, this.dataset.action, this.value); mountPermissions(); });
    });
    host.querySelectorAll('.ur-seluser').forEach(function (c) {
      c.addEventListener('change', function () {
        var key = this.dataset.action;
        var ids = Array.prototype.slice.call(host.querySelectorAll('.ur-seluser[data-action="' + key + '"]'))
          .filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
        UR().setAction(gid, key, 'selected', ids);
      });
    });
  }

  // ── Custom Role creation modal ────────────────────────────────────────────────
  function openCustomRoleModal(gid, existing) {
    var old = document.getElementById('urCroleModal'); if (old) old.remove();
    var cats = {};
    UR().CUSTOM_ROLE_ALLOWED.forEach(function (p) {
      var meta = UR().PermMeta[p] || { label: p, category: 'Other' };
      (cats[meta.category] = cats[meta.category] || []).push({ perm: p, label: meta.label });
    });
    var perms = existing ? existing.perms : {};
    var matrix = Object.keys(cats).map(function (cat) {
      return '<div class="ur-cat"><div class="ur-cat-title">' + esc(cat) + '</div>' +
        cats[cat].map(function (x) {
          return '<label class="ur-chk"><input type="checkbox" class="ur-perm-chk" value="' + x.perm + '"' + (perms[x.perm] ? ' checked' : '') + '> ' + esc(x.label) + '</label>';
        }).join('') + '</div>';
    }).join('');
    var templates = '<option value="">— Base template —</option>' +
      '<option value="group_member">Member (task CRUD)</option>' +
      '<option value="group_moderator">Moderator (ops lead)</option>' +
      '<option value="viewer">Viewer (read-only)</option>';

    var el = document.createElement('div');
    el.id = 'urCroleModal';
    el.className = 'ur-overlay';
    el.innerHTML =
      '<div class="ur-dialog" role="dialog" aria-modal="true" style="max-width:620px">' +
        '<div class="ur-head"><div class="ur-title"><i class="fa-solid fa-wand-magic-sparkles"></i> ' + (existing ? 'Edit Custom Role' : 'Create Custom Role') + '</div>' +
          '<button class="ur-close" id="urCroleClose">&times;</button></div>' +
        '<div class="ur-body">' +
          '<div class="ur-builder" style="border:none;background:transparent;padding:0">' +
            '<div class="ur-field"><label>Role Name</label><input type="text" id="urCroleName" class="ur-input" value="' + esc(existing ? existing.name : '') + '" placeholder="e.g. Contributor"></div>' +
            '<div class="ur-field"><label>Base Template</label><select id="urCroleTpl" class="ur-select">' + templates + '</select></div>' +
            '<div class="ur-field"><label>Permissions</label><div class="ur-matrix">' + matrix + '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="ur-foot">' +
          '<button class="ur-btn ur-save-crole" data-id="' + (existing ? existing.id : '') + '">' + (existing ? 'Save Changes' : 'Create Role') + '</button>' +
          '<button class="ur-btn ur-ghost" id="urCroleCancel">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) { if (e.target === el) el.remove(); });
    el.querySelector('#urCroleClose').addEventListener('click', function () { el.remove(); });
    el.querySelector('#urCroleCancel').addEventListener('click', function () { el.remove(); });
    el.querySelector('#urCroleTpl').addEventListener('change', function () {
      if (!this.value) return;
      var base = UR().Matrix[this.value] || [];
      el.querySelectorAll('.ur-perm-chk').forEach(function (cb) { cb.checked = base.indexOf(cb.value) >= 0; });
    });
    el.querySelector('.ur-save-crole').addEventListener('click', function () {
      var name = (el.querySelector('#urCroleName') || {}).value || '';
      var p = {}; el.querySelectorAll('.ur-perm-chk').forEach(function (cb) { p[cb.value] = cb.checked; });
      var id = this.dataset.id;
      var res = id ? UR().updateCustomRole(gid, id, name, p) : UR().createCustomRole(gid, name, p);
      if (!res.ok) { alert(res.error); return; }
      el.remove(); mountMemberRoles();
    });
  }

  // ── DOM masking ────────────────────────────────────────────────────────────────
  function applyMasking() {
    var R = window.UserRoles; if (!R) return;
    var gid = (window.state && window.state.filterGroup) || (groups()[0] && groups()[0].id);
    var role = R.effectiveRole(gid);
    function toggle(elm, show) { if (elm) elm.style.display = show ? '' : 'none'; }
    toggle(document.getElementById('newTaskBtn'), R.canDo('create_tasks', { groupId: gid, role: role }));
    document.body.classList.toggle('ur-viewer-mode', role === R.Roles.VIEWER);
    document.body.classList.toggle('ur-no-delete', !R.can(R.Perms.DELETE_TASKS, { groupId: gid, role: role }));
    document.body.classList.toggle('ur-no-edit', !R.canDo('edit_task', { groupId: gid, role: role }));
  }

  // ── boot / hooks ─────────────────────────────────────────────────────────────
  function boot() {
    if (!window.UserRoles) return;
    applyMasking();
    if (window.UserRoles.subscribe) window.UserRoles.subscribe(applyMasking);
    document.addEventListener('click', function (e) {
      var tab = e.target.closest && e.target.closest('.group-tab');
      if (tab) {
        var which = tab.dataset.tab;
        if (which === 'memberRoles') setTimeout(mountMemberRoles, 30);
        else if (which === 'permissionMgmt') setTimeout(mountPermissions, 30);
      }
      setTimeout(applyMasking, 60);
    });
    console.log('[UserRolesUI] ready — Member Roles + Permission Management tabs');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);

  window.UserRolesUI = { mountMemberRoles: mountMemberRoles, mountPermissions: mountPermissions, openCustomRoleModal: openCustomRoleModal, applyMasking: applyMasking };
})();
