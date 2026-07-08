/**
 * user-roles.js — User Roles & Permission Management (Core engine)
 * Implements the ZTD Role & Permission Management PRD (V1).
 *
 * Scope (per PRD):
 *   - Standard group roles: Group Admin, Group Moderator, Member, Viewer
 *     (+ Org Admin as an org-level entity, billing/global only).
 *   - Custom roles: created by a Group Admin, scoped to that group only.
 *   - Standard permission matrix (Yes/No per role) exactly as specified.
 *   - Action-level permissions (Group Settings → Permission) with tier-based
 *     and task-relationship option families + Group Admin override.
 *   - Hierarchy enforcement on role assignment.
 *
 * This module is PURE LOGIC + storage. UI lives in user-roles-ui.js.
 * It is additive and does not modify any existing feature's behaviour.
 * Config is persisted locally under 'shadow_roles_v1' (single-user local mode).
 */
(function UserRoles() {
  'use strict';

  // ─────────────────────────────────────────── Roles
  var Roles = Object.freeze({
    ORG_ADMIN:      'org_admin',      // org-level: billing & global settings only
    GROUP_ADMIN:    'group_admin',    // creator/owner of the group
    GROUP_MODERATOR:'group_moderator',// operational lead
    MEMBER:         'group_member',   // full task CRUD in the group
    VIEWER:         'viewer'          // read-only (+ follow/comment per PRD note)
  });

  // rank drives hierarchy enforcement (higher = more powerful)
  var RoleMeta = Object.freeze({
    org_admin:       { label: 'Org Admin',       rank: 100, color: '#d946ef', icon: 'fa-building', badge: null },
    group_admin:     { label: 'Group Admin',     rank: 40,  color: '#f59e0b', icon: 'fa-crown',  badge: 'fa-crown' },
    group_moderator: { label: 'Group Moderator', rank: 30,  color: '#3b82f6', icon: 'fa-shield-halved', badge: 'fa-shield-halved' },
    group_member:    { label: 'Member',          rank: 20,  color: '#10b981', icon: 'fa-user',   badge: null },
    viewer:          { label: 'Viewer',          rank: 10,  color: '#6b7280', icon: 'fa-eye',    badge: 'fa-eye' }
  });

  // ─────────────────────────────────────────── Permissions catalog
  // Grouped exactly like the PRD's "Permission Control" table + custom-role matrix.
  var Perms = Object.freeze({
    // Org-Level
    ACCESS_BILLING:        'org.access_billing',
    CREATE_CUSTOM_ROLES:   'group.create_custom_roles',
    // Group-Level
    DELETE_GROUP:          'group.delete',
    EDIT_CORE_SETTINGS:    'group.edit_settings',
    ADD_REMOVE_USERS:      'group.add_remove_users',
    // Organization (tags/categories)
    MANAGE_TAGS_CATEGORIES:'group.manage_tags_categories',
    // Task Management
    CREATE_EDIT_TASKS:     'task.create_edit',
    CHANGE_ASSIGNEES:      'task.change_assignees',
    DELETE_TASKS:          'task.delete',
    // Communication
    ADD_COMMENTS:          'comm.add_comments',
    DELETE_OTHERS_COMMENTS:'comm.delete_others_comments',
    // View
    VIEW_TASKS_HISTORY:    'task.view_history'
  });

  // Human labels + category grouping for the custom-role checkbox matrix.
  var PermMeta = {
    'task.create_edit':          { label: 'Create / Edit Tasks',        category: 'Task Execution' },
    'task.change_assignees':     { label: 'Change Task Assignees',      category: 'Task Execution' },
    'task.delete':               { label: 'Delete Tasks',               category: 'Task Execution' },
    'comm.add_comments':         { label: 'Add Comments',               category: 'Communication' },
    'comm.delete_others_comments':{ label: "Delete Others' Comments",   category: 'Communication' },
    'group.manage_tags_categories':{ label: 'Manage Tags & Categories', category: 'Organization' },
    'task.view_history':         { label: 'View Tasks & History',       category: 'Organization' }
  };

  // Custom roles may ONLY toggle these (hard limits: no destructive admin acts).
  var CUSTOM_ROLE_ALLOWED = [
    Perms.CREATE_EDIT_TASKS, Perms.CHANGE_ASSIGNEES, Perms.DELETE_TASKS,
    Perms.ADD_COMMENTS, Perms.DELETE_OTHERS_COMMENTS,
    Perms.MANAGE_TAGS_CATEGORIES, Perms.VIEW_TASKS_HISTORY
  ];

  // Standard role → permission matrix (EXACTLY per PRD "Permission Control").
  var Matrix = {
    org_admin: Object.values(Perms), // everything

    group_admin: [
      Perms.CREATE_CUSTOM_ROLES,
      Perms.DELETE_GROUP, Perms.EDIT_CORE_SETTINGS, Perms.ADD_REMOVE_USERS,
      Perms.MANAGE_TAGS_CATEGORIES,
      Perms.CREATE_EDIT_TASKS, Perms.CHANGE_ASSIGNEES, Perms.DELETE_TASKS,
      Perms.ADD_COMMENTS, Perms.DELETE_OTHERS_COMMENTS,
      Perms.VIEW_TASKS_HISTORY
    ],

    group_moderator: [
      Perms.ADD_REMOVE_USERS,           // "Adds users"
      Perms.MANAGE_TAGS_CATEGORIES,
      Perms.CREATE_EDIT_TASKS, Perms.CHANGE_ASSIGNEES, Perms.DELETE_TASKS,
      Perms.ADD_COMMENTS, Perms.DELETE_OTHERS_COMMENTS,
      Perms.VIEW_TASKS_HISTORY
      // hard-blocked: DELETE_GROUP, EDIT_CORE_SETTINGS, CREATE_CUSTOM_ROLES
    ],

    group_member: [
      Perms.CREATE_EDIT_TASKS, Perms.DELETE_TASKS,
      Perms.ADD_COMMENTS,
      Perms.VIEW_TASKS_HISTORY
      // No: ADD_REMOVE_USERS, MANAGE_TAGS_CATEGORIES, CHANGE_ASSIGNEES,
      //     DELETE_OTHERS_COMMENTS, EDIT_CORE_SETTINGS, DELETE_GROUP
    ],

    viewer: [
      Perms.VIEW_TASKS_HISTORY
    ]
  };

  // ─────────────────────────────────────────── Action-level permissions (Permission tab)
  // Two option families: 'tier' and 'relationship'. time-logs offers both.
  var ACTIONS = [
    { key:'create_tasks',     label:'Who can create tasks?',      family:'tier',         options:['everyone','only_admins','selected'],              def:'everyone' },
    { key:'edit_task',        label:'Who can edit a task?',       family:'relationship', options:['everyone','creator_assignees','creator'],         def:'creator_assignees' },
    { key:'create_categories',label:'Who can create Categories?', family:'tier',         options:['everyone','only_admins','selected'],              def:'everyone' },
    { key:'add_assignees',    label:'Who can add assignees?',     family:'relationship', options:['everyone','creator'],                             def:'everyone' },
    { key:'change_status',    label:'Who can change task status?',family:'relationship', options:['everyone','creator_assignees','creator'],         def:'everyone' },
    { key:'mark_complete',    label:'Who can mark a task as complete?', family:'relationship', options:['everyone','creator_assignees','creator'],   def:'everyone' },
    { key:'add_time_logs',    label:'Who can add time logs?',     family:'mixed',        options:['everyone','only_admins','creator_assignees','creator'], def:'creator_assignees' }
  ];

  var OPTION_LABEL = {
    everyone:'Everyone', only_admins:'Only admins', selected:'Selected users',
    creator_assignees:'Creator + assignees', creator:'Creator'
  };

  // ─────────────────────────────────────────── Storage (local)
  var LS_KEY = 'shadow_roles_v1';
  var MAX_CUSTOM_ROLES = 10; // PRD role cap (default proposed 10)

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || { groups: {} }; }
    catch (e) { return { groups: {} }; }
  }
  function saveStore(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {} }

  function groupConfig(groupId) {
    var s = loadStore();
    if (!s.groups[groupId]) {
      s.groups[groupId] = { assignments: {}, customRoles: [], actions: {}, selectedUsers: {} };
      saveStore(s);
    }
    // ensure shape
    var g = s.groups[groupId];
    g.assignments = g.assignments || {};
    g.customRoles = g.customRoles || [];
    g.actions = g.actions || {};
    g.selectedUsers = g.selectedUsers || {};
    return { store: s, cfg: g };
  }

  function getGroupConfig(groupId) { return groupConfig(groupId).cfg; }
  function updateGroupConfig(groupId, mutator) {
    var gc = groupConfig(groupId); mutator(gc.cfg); saveStore(gc.store); return gc.cfg;
  }

  // ─────────────────────────────────────────── Role resolution
  // Returns roleId (standard or custom id) for a user in a group.
  function getUserRole(userId, groupId) {
    // Org admin is global
    var cu = getCurrentUser();
    if (userId === (cu && cu.id) && cu && cu.globalRole === Roles.ORG_ADMIN) return Roles.ORG_ADMIN;

    var groups = (window.state && window.state.groups) || [];
    var g = groups.find(function (x) { return x.id === groupId; });
    // explicit assignment wins
    var cfg = getGroupConfig(groupId);
    if (cfg.assignments[userId]) return cfg.assignments[userId];
    // fall back to group ownership metadata
    if (g) {
      if (g.ownerId === userId || g.createdBy === userId) return Roles.GROUP_ADMIN;
      if (Array.isArray(g.adminIds) && g.adminIds.indexOf(userId) >= 0) return Roles.GROUP_ADMIN;
      if (Array.isArray(g.memberIds) && g.memberIds.indexOf(userId) >= 0) return Roles.MEMBER;
    }
    // default: the group creator (single-user local mode) is admin of their groups
    if (cu && userId === cu.id) return Roles.GROUP_ADMIN;
    return Roles.MEMBER;
  }

  // Resolve a roleId to a permission list (standard or custom).
  function permsForRole(roleId, groupId) {
    if (Matrix[roleId]) return Matrix[roleId];
    // custom role
    var cfg = getGroupConfig(groupId);
    var cr = cfg.customRoles.find(function (r) { return r.id === roleId; });
    if (cr) {
      // custom always includes view; only allowed perms honoured
      var out = [Perms.VIEW_TASKS_HISTORY];
      CUSTOM_ROLE_ALLOWED.forEach(function (p) { if (cr.perms && cr.perms[p]) out.push(p); });
      return out;
    }
    return Matrix.viewer;
  }

  function roleRank(roleId) {
    if (RoleMeta[roleId]) return RoleMeta[roleId].rank;
    return RoleMeta.group_member.rank; // custom roles rank as Member (PRD: default as Group Member elsewhere)
  }

  function roleLabel(roleId, groupId) {
    if (RoleMeta[roleId]) return RoleMeta[roleId].label;
    var cfg = getGroupConfig(groupId || currentGroupId());
    var cr = cfg.customRoles.find(function (r) { return r.id === roleId; });
    return cr ? cr.name : roleId;
  }

  function isAdminRole(roleId) { return roleId === Roles.ORG_ADMIN || roleId === Roles.GROUP_ADMIN; }
  function isAdminOrMod(roleId) { return isAdminRole(roleId) || roleId === Roles.GROUP_MODERATOR; }

  // ─────────────────────────────────────────── Current user (dev role switcher)
  // Reuse RBAC current user if present; otherwise a local admin dev user.
  var _viewAs = null; // {id, name, globalRole, groupRole}
  function currentGroupId() {
    return (window.state && (window.state.filterGroup || (window.state.currentView === 'group' && window.state.filterGroup))) || null;
  }
  function getCurrentUser() {
    if (_viewAs) return _viewAs;
    if (window.SHADOW_DEV_USER) {
      return { id: window.SHADOW_DEV_USER.id, name: window.SHADOW_DEV_USER.name, globalRole: Roles.GROUP_ADMIN };
    }
    return { id: 'local-dev-user', name: 'You', globalRole: Roles.GROUP_ADMIN };
  }
  function setViewAs(user) { _viewAs = user; emit(); }
  function effectiveRole(groupId) {
    var cu = getCurrentUser();
    if (cu.globalRole === Roles.ORG_ADMIN) return Roles.ORG_ADMIN;
    if (cu.groupRole) return cu.groupRole;            // explicit "view as group role"
    if (!groupId) return cu.globalRole || Roles.GROUP_ADMIN;
    return getUserRole(cu.id, groupId);
  }

  // ─────────────────────────────────────────── Core permission check
  // can(permission, {groupId, userId, task})
  function can(permission, ctx) {
    ctx = ctx || {};
    var groupId = ctx.groupId || currentGroupId();
    var role = ctx.role || effectiveRole(groupId);
    if (role === Roles.ORG_ADMIN) return true;               // org admin: all
    // Group admin override for everything inside their group
    if (role === Roles.GROUP_ADMIN) return true;
    var perms = permsForRole(role, groupId);
    return perms.indexOf(permission) >= 0;
  }

  // canDo(actionKey, {groupId, userId, task}) — action-level permission gate.
  // Combines the base role capability with the Permission-tab setting.
  function canDo(actionKey, ctx) {
    ctx = ctx || {};
    var groupId = ctx.groupId || currentGroupId();
    var role = ctx.role || effectiveRole(groupId);
    var userId = ctx.userId || getCurrentUser().id;
    if (role === Roles.ORG_ADMIN || role === Roles.GROUP_ADMIN) return true; // admin override (PRD)

    // Viewer can never perform write actions
    if (role === Roles.VIEWER) return false;

    var actionDef = ACTIONS.find(function (a) { return a.key === actionKey; });
    // Map action → base permission for role-matrix gating
    var basePermMap = {
      create_tasks: Perms.CREATE_EDIT_TASKS, edit_task: Perms.CREATE_EDIT_TASKS,
      create_categories: Perms.MANAGE_TAGS_CATEGORIES, add_assignees: Perms.CHANGE_ASSIGNEES,
      change_status: Perms.CREATE_EDIT_TASKS, mark_complete: Perms.CREATE_EDIT_TASKS,
      add_time_logs: Perms.CREATE_EDIT_TASKS
    };
    var basePerm = basePermMap[actionKey];
    if (basePerm && permsForRole(role, groupId).indexOf(basePerm) < 0) return false;

    if (!actionDef) return true;
    var cfg = getGroupConfig(groupId);
    var setting = cfg.actions[actionKey] || actionDef.def;
    var task = ctx.task || {};

    switch (setting) {
      case 'everyone':   return true;
      case 'only_admins':return isAdminOrMod(role);
      case 'selected': {
        var sel = (cfg.selectedUsers[actionKey]) || [];
        return sel.indexOf(userId) >= 0;
      }
      case 'creator':    return task.createdBy === userId;
      case 'creator_assignees':
        return task.createdBy === userId ||
               (Array.isArray(task.assignees) && task.assignees.indexOf(userId) >= 0) ||
               task.assignee === userId;
      default: return true;
    }
  }

  // Per-status override (Customization → Status → Permissions) beats change_status.
  function canChangeStatus(ctx, targetStatus) {
    ctx = ctx || {};
    var groupId = ctx.groupId || currentGroupId();
    var cfg = getGroupConfig(groupId);
    var ov = cfg.statusOverrides && cfg.statusOverrides[targetStatus];
    if (ov) {
      var role = ctx.role || effectiveRole(groupId);
      if (role === Roles.ORG_ADMIN || role === Roles.GROUP_ADMIN) return true;
      if (ov === 'everyone') return true;
      if (ov === 'only_admins') return isAdminOrMod(role);
      return canDo('change_status', ctx);
    }
    return canDo('change_status', ctx);
  }

  // ─────────────────────────────────────────── Hierarchy enforcement
  // A user may only assign roles strictly BELOW their own rank.
  function assignableRoles(groupId) {
    var myRank = roleRank(effectiveRole(groupId));
    var out = [];
    [Roles.GROUP_ADMIN, Roles.GROUP_MODERATOR, Roles.MEMBER, Roles.VIEWER].forEach(function (r) {
      if (RoleMeta[r].rank < myRank) out.push(r);
    });
    // custom roles are always assignable by admins/mods (rank Member)
    if (isAdminOrMod(effectiveRole(groupId))) {
      getGroupConfig(groupId).customRoles.forEach(function (cr) { out.push(cr.id); });
    }
    return out;
  }
  function canAssignRole(targetRoleId, groupId) {
    return assignableRoles(groupId).indexOf(targetRoleId) >= 0;
  }
  function assignRole(userId, roleId, groupId) {
    if (!canAssignRole(roleId, groupId)) return { ok: false, error: 'You cannot assign a role at or above your own level.' };
    updateGroupConfig(groupId, function (cfg) { cfg.assignments[userId] = roleId; });
    emit();
    return { ok: true };
  }

  // ─────────────────────────────────────────── Custom roles
  function listCustomRoles(groupId) { return getGroupConfig(groupId).customRoles.slice(); }

  function createCustomRole(groupId, name, perms) {
    if (!can(Perms.CREATE_CUSTOM_ROLES, { groupId: groupId }))
      return { ok: false, error: 'Only the Group Admin can create custom roles.' };
    var cfg = getGroupConfig(groupId);
    if (cfg.customRoles.length >= MAX_CUSTOM_ROLES)
      return { ok: false, error: 'Custom role limit reached (' + MAX_CUSTOM_ROLES + ' per group).' };
    if (!name || !name.trim()) return { ok: false, error: 'Role name is required.' };
    // sanitize perms to allowed set only (hard limits)
    var clean = {};
    CUSTOM_ROLE_ALLOWED.forEach(function (p) { clean[p] = !!(perms && perms[p]); });
    var role = { id: 'crole_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                 name: name.trim(), perms: clean };
    updateGroupConfig(groupId, function (c) { c.customRoles.push(role); });
    emit();
    return { ok: true, role: role };
  }

  function updateCustomRole(groupId, roleId, name, perms) {
    if (!can(Perms.CREATE_CUSTOM_ROLES, { groupId: groupId }))
      return { ok: false, error: 'Only the Group Admin can manage custom roles.' };
    var res = { ok: false, error: 'Role not found.' };
    updateGroupConfig(groupId, function (cfg) {
      var cr = cfg.customRoles.find(function (r) { return r.id === roleId; });
      if (!cr) return;
      if (name && name.trim()) cr.name = name.trim();
      if (perms) { CUSTOM_ROLE_ALLOWED.forEach(function (p) { cr.perms[p] = !!perms[p]; }); }
      res = { ok: true, role: cr };
    });
    emit();
    return res;
  }

  // Delete a custom role → bulk-reassign affected users to a fallback (Viewer default).
  function deleteCustomRole(groupId, roleId, fallbackRoleId) {
    if (!can(Perms.CREATE_CUSTOM_ROLES, { groupId: groupId }))
      return { ok: false, error: 'Only the Group Admin can delete custom roles.' };
    var fallback = fallbackRoleId || Roles.VIEWER;
    var affected = [];
    updateGroupConfig(groupId, function (cfg) {
      Object.keys(cfg.assignments).forEach(function (uid) {
        if (cfg.assignments[uid] === roleId) { cfg.assignments[uid] = fallback; affected.push(uid); }
      });
      cfg.customRoles = cfg.customRoles.filter(function (r) { return r.id !== roleId; });
    });
    emit();
    return { ok: true, reassigned: affected.length, fallback: fallback };
  }

  // ─────────────────────────────────────────── Action-level settings API
  function getAction(groupId, key) {
    var cfg = getGroupConfig(groupId);
    var def = ACTIONS.find(function (a) { return a.key === key; });
    return cfg.actions[key] || (def && def.def);
  }
  function setAction(groupId, key, value, selectedUserIds) {
    updateGroupConfig(groupId, function (cfg) {
      cfg.actions[key] = value;
      if (value === 'selected' && Array.isArray(selectedUserIds)) cfg.selectedUsers[key] = selectedUserIds.slice();
    });
    emit();
  }
  function setStatusOverride(groupId, status, value) {
    updateGroupConfig(groupId, function (cfg) {
      cfg.statusOverrides = cfg.statusOverrides || {};
      if (value) cfg.statusOverrides[status] = value; else delete cfg.statusOverrides[status];
    });
    emit();
  }

  // ─────────────────────────────────────────── Change notifications
  var subs = [];
  function subscribe(fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }
  function emit() { subs.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  // ─────────────────────────────────────────── Expose
  window.UserRoles = {
    Roles: Roles, RoleMeta: RoleMeta, Perms: Perms, PermMeta: PermMeta,
    Matrix: Matrix, ACTIONS: ACTIONS, OPTION_LABEL: OPTION_LABEL,
    CUSTOM_ROLE_ALLOWED: CUSTOM_ROLE_ALLOWED, MAX_CUSTOM_ROLES: MAX_CUSTOM_ROLES,
    // current user / view-as
    getCurrentUser: getCurrentUser, setViewAs: setViewAs, effectiveRole: effectiveRole,
    currentGroupId: currentGroupId,
    // resolution
    getUserRole: getUserRole, permsForRole: permsForRole, roleRank: roleRank, roleLabel: roleLabel,
    isAdminRole: isAdminRole, isAdminOrMod: isAdminOrMod,
    // checks
    can: can, canDo: canDo, canChangeStatus: canChangeStatus,
    // hierarchy + assignment
    assignableRoles: assignableRoles, canAssignRole: canAssignRole, assignRole: assignRole,
    // custom roles
    listCustomRoles: listCustomRoles, createCustomRole: createCustomRole,
    updateCustomRole: updateCustomRole, deleteCustomRole: deleteCustomRole,
    // action-level
    getAction: getAction, setAction: setAction, setStatusOverride: setStatusOverride,
    getGroupConfig: getGroupConfig,
    // events
    subscribe: subscribe
  };

  console.log('[UserRoles] engine ready — 4 group roles + custom, PRD matrix loaded');
})();
