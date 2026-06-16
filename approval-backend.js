/**
 * Shadow ToDo - Approval Workflow Backend
 * Supabase-backed rewrite: replaces IndexedDB with approval_requests,
 * approval_audit_logs, and approval_settings tables.
 * Public API is identical to the previous version.
 */
const ApprovalWorkflow = (function () {
  'use strict';

  /* ── State Machine ── */
  const ApprovalState = {
    PENDING_APPROVAL:   'pending_approval',
    APPROVED:           'approved',
    CHANGES_REQUESTED:  'changes_requested'
  };

  const VALID_TRANSITIONS = {
    [ApprovalState.PENDING_APPROVAL]:  [ApprovalState.APPROVED, ApprovalState.CHANGES_REQUESTED],
    [ApprovalState.CHANGES_REQUESTED]: [ApprovalState.PENDING_APPROVAL],
    [ApprovalState.APPROVED]:          []
  };

  const REJECTION_CATEGORIES = [
    'Incomplete Work', 'Quality Issues', 'Missing Requirements',
    'Incorrect Implementation', 'Needs More Testing', 'Other'
  ];

  const LOCKED_FIELDS   = ['title','dueDate','assignee','attachments','startDate','priority','status'];
  const EDITABLE_FIELDS = ['comments','subtasks'];

  const eventListeners = {};

  /* ── Supabase helpers ── */
  function getSB() {
    if (window.ShadowDB && ShadowDB._sb) return Promise.resolve(ShadowDB._sb);
    return new Promise(resolve => {
      document.addEventListener('shadowdb:ready', () => resolve(ShadowDB._sb), { once: true });
    });
  }

  async function ownerId() {
    const sb = await getSB();
    const { data } = await sb.auth.getUser();
    return data?.user?.id || null;
  }

  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  /* ── Row mappers: JS camelCase <-> DB snake_case ── */
  function reqToRow(req, owner) {
    return {
      id: req.id || uid(),
      task_id: req.taskId,
      group_id: req.groupId,
      requester_id: req.requesterId,
      approver_id: req.approverId,
      status: req.status,
      note: req.note || '',
      decision_note: req.decisionNote || null,
      rejection_category: req.rejectionCategory || null,
      aborted_by: req.abortedBy || null,
      previous_request_id: req.previousRequestId || null,
      owner_id: owner,
      created_at: req.createdAt || new Date().toISOString(),
      updated_at: req.updatedAt || new Date().toISOString(),
      resolved_at: req.resolvedAt || null
    };
  }

  function rowToReq(row) {
    if (!row) return null;
    return {
      id: row.id,
      taskId: row.task_id,
      groupId: row.group_id,
      requesterId: row.requester_id,
      approverId: row.approver_id,
      status: row.status,
      note: row.note || '',
      decisionNote: row.decision_note || null,
      rejectionCategory: row.rejection_category || null,
      abortedBy: row.aborted_by || null,
      previousRequestId: row.previous_request_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at || null
    };
  }

  function settingsToRow(s, owner) {
    return {
      group_id: s.groupId,
      enabled: s.enabled || false,
      mandate_approval: s.mandateApproval || false,
      default_approver: s.defaultApprover || null,
      default_approver_type: s.defaultApproverType || 'member',
      approver_deleted: s._approverDeleted || false,
      owner_id: owner,
      updated_at: new Date().toISOString()
    };
  }

  function rowToSettings(row) {
    if (!row) return null;
    return {
      groupId: row.group_id,
      enabled: row.enabled || false,
      mandateApproval: row.mandate_approval || false,
      defaultApprover: row.default_approver || null,
      defaultApproverType: row.default_approver_type || 'member',
      _approverDeleted: row.approver_deleted || false
    };
  }

  /* ── Event Bus ── */
  function emit(event, data) {
    (eventListeners[event] || []).forEach(fn => fn(data));
  }
  function on(event, callback) {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(callback);
  }
  function off(event, callback) {
    if (eventListeners[event])
      eventListeners[event] = eventListeners[event].filter(fn => fn !== callback);
  }

  /* ══════════════════════════════════════════
     1.  SETTINGS
     ══════════════════════════════════════════ */
  const Settings = {
    async get(groupId) {
      try {
        const sb = await getSB();
        const { data } = await sb.from('approval_settings').select('*').eq('group_id', groupId).maybeSingle();
        return rowToSettings(data) || { groupId, enabled: false, mandateApproval: false, defaultApprover: null, defaultApproverType: 'member' };
      } catch (e) {
        return { groupId, enabled: false, mandateApproval: false, defaultApprover: null, defaultApproverType: 'member' };
      }
    },

    async save(settings) {
      const sb = await getSB();
      const owner = await ownerId();
      const { error } = await sb.from('approval_settings').upsert(settingsToRow(settings, owner), { onConflict: 'group_id' });
      if (error) throw error;
      emit('approval:settings:changed', settings);
      await AuditLog.log({ taskId: null, requestId: null, actorId: 'System', actionType: 'settings_updated', notes: 'Settings updated for group ' + settings.groupId, metadata: { settings } });
      return settings;
    },

    async isEnabled(groupId)  { return (await this.get(groupId)).enabled; },
    async isMandatory(groupId){ const s = await this.get(groupId); return s.enabled && s.mandateApproval; },

    async resolveApprover(groupId) {
      const s = await this.get(groupId);
      if (!s.defaultApprover) return null;
      try {
        const members = await ShadowDB.Members.getAll();
        if (members.some(m => m.name === s.defaultApprover)) return s.defaultApprover;
        const admin = members.find(m => ['Owner','Admin','Moderator'].includes(m.role));
        const fallback = admin ? admin.name : null;
        s.defaultApprover = fallback;
        s._approverDeleted = true;
        await this.save(s);
        emit('approval:approver:deleted', { groupId, fallback, message: 'Default approver was removed. Requests now route to ' + (fallback || 'group admin') + '.' });
        return fallback;
      } catch (e) { return s.defaultApprover; }
    }
  };

  /* ══════════════════════════════════════════
     2.  REQUESTS
     ══════════════════════════════════════════ */
  const Requests = {
    async getActiveForTask(taskId) {
      const sb = await getSB();
      const { data } = await sb.from('approval_requests').select('*').eq('task_id', taskId).eq('status', ApprovalState.PENDING_APPROVAL).maybeSingle();
      return rowToReq(data);
    },

    async getAllForTask(taskId) {
      const sb = await getSB();
      const { data } = await sb.from('approval_requests').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
      return (data || []).map(rowToReq);
    },

    async getById(id) {
      const sb = await getSB();
      const { data } = await sb.from('approval_requests').select('*').eq('id', id).maybeSingle();
      return rowToReq(data);
    },

    async getAllPending() {
      const sb = await getSB();
      const { data } = await sb.from('approval_requests').select('*').eq('status', ApprovalState.PENDING_APPROVAL).order('created_at', { ascending: false });
      return (data || []).map(rowToReq);
    },

    async submit({ taskId, requesterId, approverId, note, groupId }) {
      const settings = await Settings.get(groupId);
      if (!settings.enabled) throw new Error('Approval workflow is not enabled for this group');
      if (await this.getActiveForTask(taskId)) throw new Error('Task already has an active approval request');

      const resolvedApprover = approverId || await Settings.resolveApprover(groupId);
      if (resolvedApprover === requesterId) throw new Error('Task owners cannot approve their own tasks');
      if (!resolvedApprover) throw new Error('No approver selected and no default approver configured');
      if (note && note.length > 500) throw new Error('Note must be 500 characters or fewer');

      const req = { id: uid(), taskId, groupId, requesterId, approverId: resolvedApprover, status: ApprovalState.PENDING_APPROVAL, note: note || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resolvedAt: null, decisionNote: null, rejectionCategory: null };
      const sb = await getSB(); const owner = await ownerId();
      const { error } = await sb.from('approval_requests').insert(reqToRow(req, owner));
      if (error) throw error;

      await AuditLog.log({ taskId, requestId: req.id, actorId: requesterId, actionType: 'approval_requested', notes: note || 'Approval requested', metadata: { approverId: req.approverId } });
      emit('approval:requested', req);
      emit('approval:notification', { type: 'approval_requested', recipientId: req.approverId, taskId, requestId: req.id, message: requesterId + ' requested your approval' });
      return req;
    },

    async approve({ requestId, approverId, note }) {
      const req = await this.getById(requestId);
      if (!req) throw new Error('Approval request not found');
      if (req.status !== ApprovalState.PENDING_APPROVAL) throw new Error('Request is not pending');
      if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');

      Object.assign(req, { status: ApprovalState.APPROVED, updatedAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), decisionNote: note || '' });
      const sb = await getSB(); const owner = await ownerId();
      const { error } = await sb.from('approval_requests').update(reqToRow(req, owner)).eq('id', requestId);
      if (error) throw error;

      await AuditLog.log({ taskId: req.taskId, requestId, actorId: approverId, actionType: 'approved', notes: note || 'Approved' });
      emit('approval:approved', req);
      emit('approval:notification', { type: 'approved', recipientId: req.requesterId, taskId: req.taskId, requestId, message: approverId + ' approved your request' });
      return req;
    },

    async reject({ requestId, approverId, category, reason }) {
      if (!category) throw new Error('Rejection category is required');
      if (!reason)   throw new Error('Rejection reason is required');
      if (reason.length > 1000) throw new Error('Reason must be 1000 characters or fewer');
      if (!REJECTION_CATEGORIES.includes(category)) throw new Error('Invalid rejection category');

      const req = await this.getById(requestId);
      if (!req) throw new Error('Approval request not found');
      if (req.status !== ApprovalState.PENDING_APPROVAL) throw new Error('Request is not pending');
      if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');

      Object.assign(req, { status: ApprovalState.CHANGES_REQUESTED, updatedAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), rejectionCategory: category, decisionNote: reason });
      const sb = await getSB(); const owner = await ownerId();
      const { error } = await sb.from('approval_requests').update(reqToRow(req, owner)).eq('id', requestId);
      if (error) throw error;

      await AuditLog.log({ taskId: req.taskId, requestId, actorId: approverId, actionType: 'rejected', notes: '[' + category + '] ' + reason });
      emit('approval:rejected', req);
      emit('approval:notification', { type: 'changes_requested', recipientId: req.requesterId, taskId: req.taskId, requestId, message: approverId + ' rejected: ' + category });
      return req;
    },

    async requestChanges({ requestId, approverId, feedback }) {
      if (!feedback) throw new Error('Feedback is required');
      if (feedback.length > 1000) throw new Error('Feedback must be 1000 characters or fewer');

      const req = await this.getById(requestId);
      if (!req) throw new Error('Approval request not found');
      if (req.status !== ApprovalState.PENDING_APPROVAL) throw new Error('Request is not pending');
      if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');

      Object.assign(req, { status: ApprovalState.CHANGES_REQUESTED, updatedAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), decisionNote: feedback });
      const sb = await getSB(); const owner = await ownerId();
      const { error } = await sb.from('approval_requests').update(reqToRow(req, owner)).eq('id', requestId);
      if (error) throw error;

      await AuditLog.log({ taskId: req.taskId, requestId, actorId: approverId, actionType: 'changes_requested', notes: feedback });
      emit('approval:changes_requested', req);
      emit('approval:notification', { type: 'changes_requested', recipientId: req.requesterId, taskId: req.taskId, requestId, message: approverId + ' requested changes' });
      return req;
    },

    async resubmit({ requestId, requesterId, note }) {
      const old = await this.getById(requestId);
      if (!old) throw new Error('Original request not found');
      if (old.status !== ApprovalState.CHANGES_REQUESTED) throw new Error('Can only resubmit after changes were requested');

      const req = { id: uid(), taskId: old.taskId, groupId: old.groupId, requesterId, approverId: old.approverId, status: ApprovalState.PENDING_APPROVAL, note: note || 'Resubmitted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resolvedAt: null, decisionNote: null, rejectionCategory: null, previousRequestId: requestId };
      const sb = await getSB(); const owner = await ownerId();
      const { error } = await sb.from('approval_requests').insert(reqToRow(req, owner));
      if (error) throw error;

      await AuditLog.log({ taskId: old.taskId, requestId: req.id, actorId: requesterId, actionType: 'resubmitted', notes: note || 'Resubmitted for approval' });
      emit('approval:resubmitted', req);
      emit('approval:notification', { type: 'approval_requested', recipientId: req.approverId, taskId: req.taskId, requestId: req.id, message: requesterId + ' resubmitted for approval' });
      return req;
    },

    async abort({ requestId, adminId, reason }) {
      const req = await this.getById(requestId);
      if (!req) throw new Error('Request not found');
      if (req.status !== ApprovalState.PENDING_APPROVAL) throw new Error('Request is not pending');

      Object.assign(req, { status: ApprovalState.CHANGES_REQUESTED, updatedAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), decisionNote: 'Aborted by admin: ' + (reason || 'No reason provided'), abortedBy: adminId });
      const sb = await getSB(); const owner = await ownerId();
      const { error } = await sb.from('approval_requests').update(reqToRow(req, owner)).eq('id', requestId);
      if (error) throw error;

      await AuditLog.log({ taskId: req.taskId, requestId, actorId: adminId, actionType: 'aborted', notes: 'Admin abort: ' + (reason || 'No reason provided') });
      emit('approval:aborted', req);
      emit('approval:notification', { type: 'changes_requested', recipientId: req.requesterId, taskId: req.taskId, requestId, message: 'Approval aborted by admin ' + adminId });
      emit('approval:notification', { type: 'changes_requested', recipientId: req.approverId, taskId: req.taskId, requestId, message: 'Approval aborted by admin ' + adminId });
      return req;
    }
  };

  /* ══════════════════════════════════════════
     3.  AUDIT LOG
     ══════════════════════════════════════════ */
  const AuditLog = {
    async log({ taskId, requestId, actorId, actionType, notes, metadata }) {
      const entry = { id: uid(), taskId, requestId, actorId, actionType, notes: notes || '', timestamp: new Date().toISOString(), metadata: metadata || {} };
      try {
        const sb = await getSB(); const owner = await ownerId();
        await sb.from('approval_audit_logs').insert({ id: entry.id, task_id: taskId, request_id: requestId, actor_id: actorId, action_type: actionType, notes: notes || '', metadata: metadata || {}, owner_id: owner, created_at: entry.timestamp });
      } catch (e) { console.warn('[ApprovalWorkflow] Audit log error:', e.message); }
      emit('approval:audit:logged', entry);
      return entry;
    },

    async getForTask(taskId) {
      const sb = await getSB();
      const { data } = await sb.from('approval_audit_logs').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
      return (data || []).map(r => ({ id: r.id, taskId: r.task_id, requestId: r.request_id, actorId: r.actor_id, actionType: r.action_type, notes: r.notes, timestamp: r.created_at, metadata: r.metadata }));
    },

    async getForRequest(requestId) {
      const sb = await getSB();
      const { data } = await sb.from('approval_audit_logs').select('*').eq('request_id', requestId).order('created_at', { ascending: false });
      return (data || []).map(r => ({ id: r.id, taskId: r.task_id, requestId: r.request_id, actorId: r.actor_id, actionType: r.action_type, notes: r.notes, timestamp: r.created_at, metadata: r.metadata }));
    },

    async getAll() {
      const sb = await getSB();
      const { data } = await sb.from('approval_audit_logs').select('*').order('created_at', { ascending: false });
      return (data || []).map(r => ({ id: r.id, taskId: r.task_id, requestId: r.request_id, actorId: r.actor_id, actionType: r.action_type, notes: r.notes, timestamp: r.created_at, metadata: r.metadata }));
    }
  };

  /* ══════════════════════════════════════════
     4.  TASK FIELD LOCKING
     ══════════════════════════════════════════ */
  const TaskLock = {
    async isLocked(taskId) { return !!(await Requests.getActiveForTask(taskId)); },

    isFieldEditable(fieldName, isApprover) {
      if (isApprover) return true;
      if (EDITABLE_FIELDS.includes(fieldName)) return true;
      return !LOCKED_FIELDS.includes(fieldName);
    },

    async getLockInfo(taskId) {
      const a = await Requests.getActiveForTask(taskId);
      if (!a) return { locked: false, lockedFields: [], request: null };
      return { locked: true, lockedFields: LOCKED_FIELDS, editableFields: EDITABLE_FIELDS, request: a, approverId: a.approverId };
    },

    async validateFieldUpdate(taskId, fieldName, currentUserId) {
      const a = await Requests.getActiveForTask(taskId);
      if (!a) return { allowed: true };
      if (currentUserId === a.approverId) return { allowed: true };
      if (EDITABLE_FIELDS.includes(fieldName)) return { allowed: true };
      if (LOCKED_FIELDS.includes(fieldName)) return { allowed: false, reason: 'Field is locked while approval is pending.' };
      return { allowed: true };
    },

    async validateTaskCompletion(taskId, groupId) {
      const s = await Settings.get(groupId);
      if (s.enabled && s.mandateApproval) {
        const all = await Requests.getAllForTask(taskId);
        if (!all.some(r => r.status === ApprovalState.APPROVED))
          return { allowed: false, reason: 'Task must be approved before it can be completed or closed.' };
      }
      return { allowed: true };
    }
  };

  /* ══════════════════════════════════════════
     5.  NOTIFICATIONS (in-memory queue)
     ══════════════════════════════════════════ */
  const Notifications = {
    queue: [],
    async send(n) {
      n.id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      n.timestamp = new Date().toISOString();
      n.read = false;
      this.queue.push(n);
      emit('approval:notification:new', n);
      return n;
    },
    getUnread(userId) { return this.queue.filter(n => n.recipientId === userId && !n.read); },
    markRead(id) { const n = this.queue.find(x => x.id === id); if (n) n.read = true; },
    getAll(userId) { return this.queue.filter(n => n.recipientId === userId); }
  };

  on('approval:notification', data => Notifications.send(data));

  /* ══════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════ */
  return {
    ApprovalState, VALID_TRANSITIONS, REJECTION_CATEGORIES, LOCKED_FIELDS, EDITABLE_FIELDS,
    Settings, Requests, AuditLog, TaskLock, Notifications, on, off, emit,

    async init() {
      await getSB();
      console.log('[ApprovalWorkflow] Initialized (Supabase backend)');
      return true;
    },

    canRequestApproval(task, currentUserId) {
      return task.assignee === currentUserId || task.createdBy === currentUserId;
    },

    async isApprover(taskId, userId) {
      const a = await Requests.getActiveForTask(taskId);
      return a && a.approverId === userId;
    },

    async getAvailableApprovers(groupId) {
      try {
        const m = await ShadowDB.Members.getAll();
        return m.filter(x => x.name !== 'System');
      } catch (e) {
        return [
          { id: 1, name: 'Pradeep Kumar', role: 'Owner' },
          { id: 2, name: 'Sarah Chen',    role: 'Member' },
          { id: 3, name: 'Alex Johnson',  role: 'Moderator' },
          { id: 4, name: 'Rachel Kim',    role: 'Moderator' }
        ];
      }
    },

    async isGroupAdmin(groupId, userId) {
      try {
        const members = await ShadowDB.Members.getAll();
        const member = members.find(m => m.name === userId);
        return member && ['Owner','Admin','Moderator'].includes(member.role);
      } catch (e) { return userId === 'Pradeep Kumar' || userId === 'Pradeep'; }
    }
  };
})();
