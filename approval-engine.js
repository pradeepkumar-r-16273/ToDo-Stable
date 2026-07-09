/**
 * approval-engine.js — Approval Workflow (Task Approval) engine — PRD rebuild.
 * Local-only, self-contained. Persists to localStorage['shadow_approvals_v1'].
 * Exposes window.ApprovalWorkflow (same public name the app expects).
 *
 * Data shape:
 *   { settings: { [groupId]: {...} }, requests: [ {...} ], audit: [ {...} ] }
 *
 * A request is "open" while status is pending_approval or changes_requested.
 * A task is "locked" only while a request is pending_approval.
 */
(function ApprovalEngine() {
  'use strict';

  var LS_KEY = 'shadow_approvals_v1';

  var State = Object.freeze({
    PENDING: 'pending_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CHANGES_REQUESTED: 'changes_requested',
    ABORTED: 'aborted'
  });

  var REJECTION_CATEGORIES = [
    'Incomplete', 'Out of Scope', 'Needs Revision',
    'Quality Issues', 'Missing Requirements', 'Other'
  ];

  // Core task fields locked for non-approvers while pending (PRD).
  var LOCKED_FIELDS = ['title', 'dueDate', 'assignee', 'attachments', 'priority', 'startDate'];

  // ── storage ─────────────────────────────────────────────────────────────────
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || { settings: {}, requests: [], audit: [] }; }
    catch (e) { return { settings: {}, requests: [], audit: [] }; }
  }
  function save(db) { try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) {} }
  function uid(p) { return (p || 'ap_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nowISO() { return new Date().toISOString(); }

  // ── helpers on app state ─────────────────────────────────────────────────────
  function members() { return (window.state && window.state.members) || (window.SHADOW_DEV_MEMBERS || []); }
  function memberById(id) { return members().find(function (m) { return m.id === id; }) || null; }
  function memberName(id) { var m = memberById(id); return m ? m.name : (id || 'Unknown'); }
  function currentUserId() { return (window.state && window.state.currentUserId) || (window.SHADOW_DEV_USER && window.SHADOW_DEV_USER.id) || 'local-dev-user'; }

  function roleLabel(userId, groupId) {
    if (window.UserRoles) {
      try { return window.UserRoles.roleLabel(window.UserRoles.getUserRole(userId, groupId), groupId); } catch (e) {}
    }
    var m = memberById(userId);
    return m && m.role ? m.role : 'Member';
  }
  function isGroupAdmin(groupId, userId) {
    userId = userId || currentUserId();
    if (window.UserRoles) {
      try {
        var r = window.UserRoles.getUserRole(userId, groupId);
        if (r === window.UserRoles.Roles.GROUP_ADMIN || r === window.UserRoles.Roles.ORG_ADMIN) return true;
      } catch (e) {}
    }
    var m = memberById(userId);
    return !!(m && (m.role === 'Owner' || m.role === 'admin' || m.role === 'Admin'));
  }
  function groupAdminId(groupId) {
    // first Owner/admin member, else first member
    var list = members();
    var admin = list.find(function (m) { return isGroupAdmin(groupId, m.id); });
    return admin ? admin.id : (list[0] && list[0].id) || null;
  }

  // ── events ───────────────────────────────────────────────────────────────────
  var subs = {};
  function on(evt, fn) { (subs[evt] = subs[evt] || []).push(fn); }
  function off(evt, fn) { if (subs[evt]) subs[evt] = subs[evt].filter(function (f) { return f !== fn; }); }
  function emit(evt, data) { (subs[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
    (subs['*'] || []).forEach(function (fn) { try { fn(evt, data); } catch (e) {} }); }
  function notify(recipientId, type, taskId, message) {
    if (!recipientId || recipientId === actingOrCurrent()) { /* still emit for hub refresh */ }
    emit('approval:notify', { recipientId: recipientId, type: type, taskId: taskId, message: message });
  }
  function actingOrCurrent() { return (window.ApprovalUI && window.ApprovalUI.actingUserId && window.ApprovalUI.actingUserId()) || currentUserId(); }

  // ── settings ───────────────────────────────────────────────────────────────────
  function defaultSettings(groupId) {
    return { groupId: groupId, enabled: false, mandateApproval: false, defaultApprover: null, defaultApproverType: 'member', approverDeleted: false };
  }
  var Settings = {
    get: function (groupId) {
      var db = load();
      return Object.assign(defaultSettings(groupId), db.settings[groupId] || {});
    },
    save: function (s) {
      var db = load();
      db.settings[s.groupId] = Object.assign(defaultSettings(s.groupId), db.settings[s.groupId], s);
      save(db);
      emit('approval:settings:changed', db.settings[s.groupId]);
      return Promise.resolve(db.settings[s.groupId]);
    },
    isEnabled: function (groupId) { return !!Settings.get(groupId).enabled; },
    isMandatory: function (groupId) { var s = Settings.get(groupId); return !!(s.enabled && s.mandateApproval); },
    // resolve the effective approver id; fall back to group admin if default removed
    resolveApprover: function (groupId) {
      var s = Settings.get(groupId);
      if (!s.defaultApprover) return null;
      if (memberById(s.defaultApprover)) return s.defaultApprover;
      // default approver no longer a member → mark + fall back to admin
      Settings.save({ groupId: groupId, defaultApprover: s.defaultApprover, approverDeleted: true });
      return groupAdminId(groupId);
    }
  };

  // ── requests ─────────────────────────────────────────────────────────────────
  function isOpen(r) { return r.status === State.PENDING || r.status === State.CHANGES_REQUESTED; }

  var Requests = {
    getAllForTask: function (taskId) { return load().requests.filter(function (r) { return r.taskId === taskId; })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }); },
    getActiveForTask: function (taskId) { return Requests.getAllForTask(taskId).find(isOpen) || null; },
    getLatestForTask: function (taskId) { return Requests.getAllForTask(taskId)[0] || null; },
    getById: function (id) { return load().requests.find(function (r) { return r.id === id; }) || null; },
    getAll: function () { return load().requests.slice(); },
    listForUser: function (userId) {
      return load().requests.filter(function (r) { return r.requesterId === userId || r.approverId === userId; });
    },

    submit: function (p) {
      // p: {taskId, groupId, requesterId, approverId, note}
      var db = load();
      var existing = db.requests.filter(function (r) { return r.taskId === p.taskId; }).find(isOpen);
      if (existing) return { ok: false, error: 'An approval request is already active for this task.' };
      if (p.approverId === p.requesterId) return { ok: false, error: 'You cannot select yourself as the approver.' };
      if (!p.approverId) return { ok: false, error: 'Please select an approver.' };
      var r = {
        id: uid('areq_'), taskId: p.taskId, groupId: p.groupId,
        requesterId: p.requesterId, approverId: p.approverId,
        status: State.PENDING, note: (p.note || '').slice(0, 500),
        decisionNote: null, rejectionCategory: null, feedback: null,
        abortedBy: null, previousRequestId: null,
        createdAt: nowISO(), updatedAt: nowISO(), resolvedAt: null
      };
      db.requests.push(r); save(db);
      AuditLog.log({ taskId: r.taskId, requestId: r.id, actorId: r.requesterId, actionType: 'approval_requested', notes: r.note, groupId: r.groupId });
      emit('approval:requested', r); emit('approval:changed', r);
      notify(r.approverId, 'approval_requested', r.taskId, memberName(r.requesterId) + ' requested your approval');
      return { ok: true, request: r };
    },

    approve: function (p) { return decide(p.requestId, p.approverId, State.APPROVED, { decisionNote: p.note || '' }, 'approved',
      function (r) { return memberName(r.approverId) + ' approved the task'; }); },

    reject: function (p) {
      if (!p.category) return { ok: false, error: 'Please select a rejection category.' };
      if (!p.reason || !p.reason.trim()) return { ok: false, error: 'A rejection reason is required.' };
      return decide(p.requestId, p.approverId, State.REJECTED,
        { rejectionCategory: p.category, decisionNote: p.reason.slice(0, 1000) }, 'rejected',
        function (r) { return memberName(r.approverId) + ' rejected the task: ' + r.rejectionCategory; });
    },

    requestChanges: function (p) {
      if (!p.feedback || !p.feedback.trim()) return { ok: false, error: 'Feedback is required to request changes.' };
      return decide(p.requestId, p.approverId, State.CHANGES_REQUESTED,
        { feedback: p.feedback.slice(0, 1000) }, 'changes_requested',
        function (r) { return memberName(r.approverId) + ' requested changes'; });
    },

    // Re-trigger after rejected / changes requested → back to same approver.
    resubmit: function (p) {
      var db = load();
      var r = db.requests.find(function (x) { return x.id === p.requestId; });
      if (!r) return { ok: false, error: 'Request not found.' };
      if (r.status !== State.REJECTED && r.status !== State.CHANGES_REQUESTED)
        return { ok: false, error: 'Only rejected or changes-requested items can be re-submitted.' };
      r.status = State.PENDING;
      r.note = (p.note || r.note || '').slice(0, 500);
      r.decisionNote = null; r.rejectionCategory = null; r.feedback = null;
      r.resolvedAt = null; r.updatedAt = nowISO();
      save(db);
      AuditLog.log({ taskId: r.taskId, requestId: r.id, actorId: r.requesterId, actionType: 'resubmitted', notes: r.note, groupId: r.groupId });
      emit('approval:resubmitted', r); emit('approval:changed', r);
      notify(r.approverId, 'approval_requested', r.taskId, memberName(r.requesterId) + ' re-submitted for your approval');
      return { ok: true, request: r };
    },

    abort: function (p) {
      var db = load();
      var r = db.requests.find(function (x) { return x.id === p.requestId; });
      if (!r) return { ok: false, error: 'Request not found.' };
      if (!isGroupAdmin(r.groupId, p.adminId)) return { ok: false, error: 'Only a Group Admin can abort an approval.' };
      r.status = State.ABORTED; r.abortedBy = p.adminId; r.decisionNote = p.reason || ''; r.resolvedAt = nowISO(); r.updatedAt = nowISO();
      save(db);
      AuditLog.log({ taskId: r.taskId, requestId: r.id, actorId: p.adminId, actionType: 'aborted', notes: r.decisionNote, groupId: r.groupId });
      emit('approval:aborted', r); emit('approval:changed', r);
      notify(r.requesterId, 'aborted', r.taskId, 'Approval was aborted by an admin');
      notify(r.approverId, 'aborted', r.taskId, 'Approval was aborted by an admin');
      return { ok: true, request: r };
    }
  };

  function decide(requestId, approverId, newStatus, extra, auditType, msgFn) {
    var db = load();
    var r = db.requests.find(function (x) { return x.id === requestId; });
    if (!r) return { ok: false, error: 'Request not found.' };
    if (r.approverId !== approverId) return { ok: false, error: 'Only the designated approver can decide this request.' };
    if (r.status !== State.PENDING) return { ok: false, error: 'This request is not pending a decision.' };
    Object.assign(r, extra, { status: newStatus, resolvedAt: nowISO(), updatedAt: nowISO() });
    save(db);
    AuditLog.log({ taskId: r.taskId, requestId: r.id, actorId: approverId, actionType: auditType,
      notes: extra.decisionNote || extra.feedback || '', groupId: r.groupId, metadata: extra.rejectionCategory ? { category: extra.rejectionCategory } : {} });
    emit('approval:' + auditType, r); emit('approval:changed', r);
    notify(r.requesterId, auditType, r.taskId, msgFn(r));
    return { ok: true, request: r };
  }

  // ── audit log (immutable) ────────────────────────────────────────────────────
  var AuditLog = {
    log: function (p) {
      var db = load();
      var e = {
        id: uid('aud_'), taskId: p.taskId, requestId: p.requestId || null,
        actorId: p.actorId, actorName: memberName(p.actorId), actorRole: roleLabel(p.actorId, p.groupId),
        actionType: p.actionType, notes: p.notes || '', metadata: p.metadata || {}, timestamp: nowISO()
      };
      db.audit.push(e); save(db);
      emit('approval:audit:logged', e);
      return e;
    },
    getForTask: function (taskId) {
      return load().audit.filter(function (e) { return e.taskId === taskId; })
        .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    },
    getAll: function () { return load().audit.slice(); }
  };

  // ── task lock ────────────────────────────────────────────────────────────────
  var TaskLock = {
    isLocked: function (taskId) { var r = Requests.getActiveForTask(taskId); return !!(r && r.status === State.PENDING); },
    lockedRequest: function (taskId) { var r = Requests.getActiveForTask(taskId); return (r && r.status === State.PENDING) ? r : null; },
    isFieldEditable: function (field, isApprover) {
      if (isApprover) return true;
      return LOCKED_FIELDS.indexOf(field) < 0; // comments/subtasks not in list → editable
    },
    // For mandate: is the task allowed to move to Completed/Closed?
    validateTaskCompletion: function (taskId, groupId) {
      if (!Settings.isMandatory(groupId)) return { allowed: true };
      var latest = Requests.getLatestForTask(taskId);
      if (latest && latest.status === State.APPROVED) return { allowed: true };
      return { allowed: false, reason: 'This group mandates approval. Send the task for approval and get it approved before completing it.' };
    }
  };

  // ── init / expose ──────────────────────────────────────────────────────────────
  window.ApprovalWorkflow = {
    State: State, REJECTION_CATEGORIES: REJECTION_CATEGORIES, LOCKED_FIELDS: LOCKED_FIELDS,
    on: on, off: off, emit: emit,
    init: function () { return Promise.resolve(true); },
    // helpers reused by UI
    members: members, memberById: memberById, memberName: memberName, currentUserId: currentUserId,
    roleLabel: roleLabel, isGroupAdmin: isGroupAdmin, groupAdminId: groupAdminId,
    canRequest: function (task, userId) {
      userId = userId || currentUserId();
      if (!task) return false;
      return task.createdBy === userId || task.assignee === userId ||
        (Array.isArray(task.assignees) && task.assignees.indexOf(userId) >= 0) ||
        (!task.createdBy && userId === currentUserId());
    },
    getAvailableApprovers: function (groupId, excludeId) {
      return members().filter(function (m) { return m.name !== 'System' && m.id !== excludeId; });
    },
    Settings: Settings, Requests: Requests, AuditLog: AuditLog, TaskLock: TaskLock
  };

  console.log('[ApprovalEngine] ready — localStorage-backed, PRD flow loaded');
})();
