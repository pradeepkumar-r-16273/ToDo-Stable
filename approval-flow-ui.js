/**
 * approval-flow-ui.js — Approval Workflow UI (PRD rebuild).
 * Config panel (group Approvals tab), in-task approval UI + modals, mandate
 * guard, and the Approvals Hub (RHS) with an "Acting as" switcher.
 * Depends on window.ApprovalWorkflow (approval-engine.js). Local-only.
 */
(function ApprovalFlowUI() {
  'use strict';

  function AW() { return window.ApprovalWorkflow; }
  var _actingUserId = null; // Acting-as override (Approvals Hub)

  function currentUserId() { return AW() ? AW().currentUserId() : 'local-dev-user'; }
  function actingUserId() { return _actingUserId || currentUserId(); }
  function members() { return AW() ? AW().members() : []; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; }); }
  function taskById(id) { return (window.state && window.state.tasks || []).find(function (t) { return t.id === id; }) || null; }
  function fmtTime(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return iso; } }

  // ── toast ──────────────────────────────────────────────────────────────────────
  function showToast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'approval-toast ' + (kind || 'info');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2600);
  }

  // ── modal helper ────────────────────────────────────────────────────────────────
  function modal(title, headerClass, bodyHTML, footerButtons) {
    var ov = document.createElement('div');
    ov.className = 'approval-modal-overlay';
    ov.innerHTML = '<div class="modal-content">' +
      '<div class="modal-header ' + (headerClass || '') + '">' + esc(title) + '</div>' +
      '<div class="modal-body">' + bodyHTML + '</div>' +
      '<div class="modal-footer"></div></div>';
    var foot = ov.querySelector('.modal-footer');
    (footerButtons || []).forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = b.cls || 'btn-cancel'; btn.textContent = b.label;
      btn.addEventListener('click', function () { b.onClick && b.onClick(ov); });
      foot.appendChild(btn);
    });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    return ov;
  }
  function closeModal(ov) { if (ov) ov.remove(); }

  // ── Config panel (group Approvals tab) ─────────────────────────────────────────
  function renderConfigPanel(groupId) {
    var W = AW();
    var s = W.Settings.get(groupId);
    var isAdmin = W.isGroupAdmin(groupId, currentUserId());
    var card = document.createElement('div');
    card.className = 'approval-settings-card';
    var approverOpts = W.getAvailableApprovers(groupId).map(function (m) {
      return '<option value="' + m.id + '"' + (s.defaultApprover === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>';
    }).join('');
    card.innerHTML =
      '<div class="approval-settings-header-row"><i class="fa-solid fa-clipboard-check approval-settings-icon"></i>' +
        '<h3>Approval Workflow</h3></div>' +
      '<p class="settings-description">Require stakeholder sign-off on tasks in this group.</p>' +
      (isAdmin ? '' : '<div class="approver-warning"><i class="fa-solid fa-lock"></i> Only the Group Admin can change these settings.</div>') +
      '<div class="approval-setting-block"><div class="approval-setting-row">' +
        '<div class="setting-info"><strong>Enable Approval</strong><div class="setting-desc">Show a “Request Approval” action on tasks in this group.</div></div>' +
        '<label class="toggle-switch"><input type="checkbox" id="apEnable"' + (s.enabled ? ' checked' : '') + (isAdmin ? '' : ' disabled') + '><span class="toggle-slider"></span></label>' +
      '</div></div>' +
      '<div id="apMandateBlock" class="approval-setting-block" style="' + (s.enabled ? '' : 'display:none') + '"><div class="approval-setting-row">' +
        '<div class="setting-info"><strong>Mandate Approval</strong><div class="setting-desc">Block Complete/Close until the task is approved.</div></div>' +
        '<label class="toggle-switch"><input type="checkbox" id="apMandate"' + (s.mandateApproval ? ' checked' : '') + (isAdmin ? '' : ' disabled') + '><span class="toggle-slider"></span></label>' +
      '</div></div>' +
      '<div id="apApproverBlock" class="approval-setting-block" style="' + (s.enabled ? '' : 'display:none') + '">' +
        '<div class="setting-info"><strong>Default Approver</strong><div class="setting-desc">Auto-route every request to this person (owner can’t change it unless empty).</div></div>' +
        (s.approverDeleted ? '<div class="approver-warning"><i class="fa-solid fa-triangle-exclamation"></i> The previous default approver was removed — requests now fall back to the Group Admin.</div>' : '') +
        '<select id="apDefaultApprover" class="approver-select"' + (isAdmin ? '' : ' disabled') + '><option value="">— No default (owner chooses) —</option>' + approverOpts + '</select>' +
      '</div>';

    if (isAdmin) {
      var enable = card.querySelector('#apEnable');
      var mandate = card.querySelector('#apMandate');
      var appr = card.querySelector('#apDefaultApprover');
      enable.addEventListener('change', function () {
        W.Settings.save({ groupId: groupId, enabled: enable.checked });
        card.querySelector('#apMandateBlock').style.display = enable.checked ? '' : 'none';
        card.querySelector('#apApproverBlock').style.display = enable.checked ? '' : 'none';
        showToast('Approval workflow ' + (enable.checked ? 'enabled' : 'disabled'), 'success');
        updateHubBadge();
      });
      mandate.addEventListener('change', function () { W.Settings.save({ groupId: groupId, mandateApproval: mandate.checked }); showToast('Saved', 'success'); });
      appr.addEventListener('change', function () { W.Settings.save({ groupId: groupId, defaultApprover: appr.value || null, approverDeleted: false }); showToast('Default approver updated', 'success'); });
    }
    return card;
  }

  function mountConfig() {
    var host = document.getElementById('approvalConfigMount'); if (!host || !AW()) return;
    var gid = window.currentGroupId || (window.state && window.state.groups && window.state.groups[0] && window.state.groups[0].id);
    host.innerHTML = '';
    if (!gid) { host.innerHTML = '<p class="settings-description">Select a group to configure approvals.</p>'; return; }
    host.appendChild(renderConfigPanel(gid));
  }

  // ── In-task approval UI ─────────────────────────────────────────────────────────
  function clearInTask() {
    ['apStatusStrip', 'apDecisionPanel', 'apAuditTrail', 'apLockBanner'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.remove();
    });
    ['apRequestBtn', 'apResubmitBtn', 'apAbortBtn'].forEach(function (id) {
      var e = document.querySelector('.tdp-header-actions #' + id); if (e) e.remove();
    });
    ['detailTitle', 'detailStatus', 'detailAssignee', 'detailDueDate', 'detailPriority'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.classList.remove('field-locked');
    });
  }

  function injectInTask() {
    var W = AW(); if (!W) return;
    var panel = document.getElementById('taskDetailPanel');
    var open = panel && (panel.classList.contains('open') || panel.style.display === 'flex');
    var taskId = window.state && window.state.selectedTaskId;
    if (!open || !taskId) { clearInTask(); return; }
    var task = taskById(taskId); if (!task) return;
    var gid = task.group || task.groupId;
    clearInTask();
    if (!W.Settings.isEnabled(gid)) return;

    var body = panel.querySelector('.tdp-body'); if (!body) return;
    var headerActions = panel.querySelector('.tdp-header-actions');
    var me = actingUserId();
    var active = W.Requests.getActiveForTask(taskId);
    var latest = W.Requests.getLatestForTask(taskId);
    var amApprover = active && active.approverId === me && active.status === W.State.PENDING;
    var amAdmin = W.isGroupAdmin(gid, me);
    var amRequester = W.canRequest(task, me);

    if (active && active.status === W.State.PENDING) {
      var strip = document.createElement('div');
      strip.id = 'apStatusStrip'; strip.className = 'approval-status-strip pending';
      strip.innerHTML = '<i class="fa-solid fa-clock"></i> <span class="approval-status-strip-text">Approval Pending — sent to ' +
        esc(W.memberName(active.approverId)) + ' · ' + fmtTime(active.createdAt) + '</span>';
      body.insertBefore(strip, body.firstChild);

      if (!amApprover) {
        var lb = document.createElement('div'); lb.id = 'apLockBanner'; lb.className = 'task-lock-banner';
        lb.innerHTML = '<i class="fa-solid fa-lock"></i> Core fields are locked while this task is pending approval. Comments and subtasks stay open.';
        body.insertBefore(lb, strip.nextSibling);
        ['detailTitle', 'detailStatus', 'detailAssignee', 'detailDueDate', 'detailPriority'].forEach(function (id) {
          var e = document.getElementById(id); if (e) e.classList.add('field-locked');
        });
      }
      if (amApprover) body.insertBefore(decisionPanel(active), body.children[1] || null);
      else if (amAdmin && headerActions) headerActions.insertBefore(iconBtn('apAbortBtn', 'fa-ban', 'Abort approval', function () { showAbortModal(active); }), headerActions.firstChild);
    } else if (latest && latest.status === W.State.APPROVED) {
      var s2 = document.createElement('div'); s2.id = 'apStatusStrip'; s2.className = 'approval-status-strip approved';
      s2.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span class="approval-status-strip-text">Approved by ' + esc(W.memberName(latest.approverId)) + ' · ' + fmtTime(latest.resolvedAt) + '</span>';
      body.insertBefore(s2, body.firstChild);
    } else if (latest && (latest.status === W.State.REJECTED || latest.status === W.State.CHANGES_REQUESTED)) {
      var isRej = latest.status === W.State.REJECTED;
      var s3 = document.createElement('div'); s3.id = 'apStatusStrip'; s3.className = 'approval-status-strip changes-requested';
      s3.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> <span class="approval-status-strip-text">' +
        (isRej ? 'Rejected' : 'Changes requested') + ' by ' + esc(W.memberName(latest.approverId)) +
        (latest.rejectionCategory ? ' (' + esc(latest.rejectionCategory) + ')' : '') + ' — ' + esc(latest.decisionNote || latest.feedback || '') + '</span>';
      body.insertBefore(s3, body.firstChild);
      if (amRequester && headerActions) headerActions.insertBefore(textBtn('apResubmitBtn', 'Re-submit', 'resubmit', function () { showResubmitModal(latest); }), headerActions.firstChild);
    }

    // Request button when no open request and user may request
    var noOpen = !active;
    var canShowRequest = noOpen && amRequester && (!latest || latest.status === W.State.APPROVED || latest.status === W.State.ABORTED || !latest);
    if (canShowRequest && latest && latest.status === W.State.APPROVED) canShowRequest = false; // already approved; leave as-is
    if (noOpen && amRequester && (!latest || latest.status === W.State.ABORTED) && headerActions && !document.getElementById('apRequestBtn')) {
      headerActions.insertBefore(textBtn('apRequestBtn', 'Request Approval', 'request', function () { showRequestModal(task, gid); }), headerActions.firstChild);
    }

    var trail = auditTrail(taskId);
    var timeline = document.getElementById('timelineList');
    if (timeline && timeline.parentNode) timeline.parentNode.insertBefore(trail, timeline);
    else body.appendChild(trail);
  }

  function iconBtn(id, icon, title, onClick) {
    var b = document.createElement('button'); b.id = id; b.className = 'icon-btn'; b.title = title;
    b.innerHTML = '<i class="fa-solid ' + icon + '"></i>';
    b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
    return b;
  }
  function textBtn(id, label, kind, onClick) {
    var b = document.createElement('button'); b.id = id; b.className = 'approval-btn ' + (kind || '');
    b.textContent = label; b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
    return b;
  }

  function decisionPanel(req) {
    var W = AW();
    var wrap = document.createElement('div'); wrap.id = 'apDecisionPanel'; wrap.className = 'approval-decision-panel';
    wrap.innerHTML = '<h4>Your Decision Required</h4>' +
      (req.note ? '<div class="decision-note">“' + esc(req.note) + '” — ' + esc(W.memberName(req.requesterId)) + '</div>' : '') +
      '<div class="decision-actions">' +
        '<button class="decision-btn approve">Approve</button>' +
        '<button class="decision-btn reject">Reject</button>' +
        '<button class="decision-btn changes">Request Changes</button>' +
      '</div>';
    wrap.querySelector('.approve').addEventListener('click', function () { showApproveModal(req); });
    wrap.querySelector('.reject').addEventListener('click', function () { showRejectModal(req); });
    wrap.querySelector('.changes').addEventListener('click', function () { showChangesModal(req); });
    return wrap;
  }

  function auditTrail(taskId) {
    var W = AW();
    var entries = W.AuditLog.getForTask(taskId);
    var wrap = document.createElement('div'); wrap.id = 'apAuditTrail'; wrap.className = 'approval-audit-trail';
    if (!entries.length) { wrap.innerHTML = '<div class="audit-empty">No approval activity yet.</div>'; return wrap; }
    var iconMap = { approval_requested: 'fa-paper-plane', approved: 'fa-circle-check', rejected: 'fa-circle-xmark', changes_requested: 'fa-pen', resubmitted: 'fa-rotate', aborted: 'fa-ban' };
    var textMap = { approval_requested: 'requested approval', approved: 'approved', rejected: 'rejected', changes_requested: 'requested changes', resubmitted: 're-submitted', aborted: 'aborted the approval' };
    wrap.innerHTML = '<div class="audit-trail-header"><i class="fa-solid fa-clock-rotate-left"></i> Approval History</div>' +
      '<div class="audit-timeline">' + entries.map(function (e) {
        return '<div class="audit-timeline-item ' + e.actionType + '"><span class="audit-icon"><i class="fa-solid ' + (iconMap[e.actionType] || 'fa-circle') + '"></i></span>' +
          '<div><div><strong>' + esc(e.actorName) + '</strong> <span class="audit-role">(' + esc(e.actorRole) + ')</span> ' + esc(textMap[e.actionType] || e.actionType) + '</div>' +
          (e.notes ? '<div class="audit-notes">' + esc(e.notes) + '</div>' : '') +
          '<div class="audit-timestamp">' + fmtTime(e.timestamp) + ' (UTC-local)</div></div></div>';
      }).join('') + '</div>';
    return wrap;
  }

  // ── modals ───────────────────────────────────────────────────────────────────
  function showRequestModal(task, gid) {
    var W = AW();
    var pre = W.Settings.resolveApprover(gid);
    var locked = !!W.Settings.get(gid).defaultApprover && !!pre;
    var opts = W.getAvailableApprovers(gid, actingUserId()).map(function (m) {
      return '<option value="' + m.id + '"' + (pre === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>';
    }).join('');
    var body = '<div class="form-group"><label class="form-label">Approver</label>' +
      '<select id="apReqApprover" class="form-select"' + (locked ? ' disabled' : '') + '><option value="">— Select approver —</option>' + opts + '</select>' +
      (locked ? '<div class="lock-info-banner"><i class="fa-solid fa-lock"></i> A default approver is set for this group.</div>' : '') + '</div>' +
      '<div class="form-group"><label class="form-label">Note (optional)</label>' +
      '<textarea id="apReqNote" class="form-textarea" maxlength="500" placeholder="Add context for the approver…"></textarea>' +
      '<div class="char-counter"><span id="apReqCount">0</span>/500</div></div>' +
      '<div class="lock-info-banner"><i class="fa-solid fa-lock"></i> Submitting locks core task fields until a decision is made.</div>';
    var ov = modal('Request Approval', '', body, [
      { label: 'Cancel', cls: 'btn-cancel', onClick: closeModal },
      { label: 'Send Request', cls: 'btn-submit', onClick: function (m) {
        var approverId = locked ? pre : (m.querySelector('#apReqApprover').value);
        var res = W.Requests.submit({ taskId: task.id, groupId: gid, requesterId: actingUserId(), approverId: approverId, note: m.querySelector('#apReqNote').value });
        if (!res.ok) { showToast(res.error, 'error'); return; }
        mirrorTimeline(task, 'Requested approval from ' + W.memberName(approverId));
        closeModal(m); showToast('Approval requested', 'success'); refresh();
      } }
    ]);
    var note = ov.querySelector('#apReqNote'), cnt = ov.querySelector('#apReqCount');
    note.addEventListener('input', function () { cnt.textContent = note.value.length; });
  }

  function showApproveModal(req) {
    var W = AW();
    var body = '<div class="form-group"><label class="form-label">Note (optional)</label>' +
      '<textarea id="apApproveNote" class="form-textarea" placeholder="Add an optional note…"></textarea></div>';
    modal('Approve Task', 'approve-header', body, [
      { label: 'Cancel', cls: 'btn-cancel', onClick: closeModal },
      { label: 'Approve', cls: 'btn-approve-submit', onClick: function (m) {
        var res = W.Requests.approve({ requestId: req.id, approverId: actingUserId(), note: m.querySelector('#apApproveNote').value });
        if (!res.ok) { showToast(res.error, 'error'); return; }
        mirrorTimeline(taskById(req.taskId), 'Approved by ' + W.memberName(actingUserId()));
        closeModal(m); showToast('Task approved', 'success'); refresh();
      } }
    ]);
  }

  function showRejectModal(req) {
    var W = AW();
    var cats = W.REJECTION_CATEGORIES.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
    var body = '<div class="form-group"><label class="form-label">Category</label>' +
      '<select id="apRejCat" class="form-select"><option value="">— Select —</option>' + cats + '</select></div>' +
      '<div class="form-group"><label class="form-label">Reason</label>' +
      '<textarea id="apRejReason" class="form-textarea" maxlength="1000" placeholder="Explain why this is rejected…"></textarea>' +
      '<div class="char-counter"><span id="apRejCount">0</span>/1000</div></div>';
    var ov = modal('Reject Task', 'reject-header', body, [
      { label: 'Cancel', cls: 'btn-cancel', onClick: closeModal },
      { label: 'Reject', cls: 'btn-reject', onClick: function (m) {
        var res = W.Requests.reject({ requestId: req.id, approverId: actingUserId(), category: m.querySelector('#apRejCat').value, reason: m.querySelector('#apRejReason').value });
        if (!res.ok) { showToast(res.error, 'error'); return; }
        mirrorTimeline(taskById(req.taskId), 'Rejected by ' + W.memberName(actingUserId()));
        closeModal(m); showToast('Task rejected', 'success'); refresh();
      } }
    ]);
    var r = ov.querySelector('#apRejReason'), c = ov.querySelector('#apRejCount');
    r.addEventListener('input', function () { c.textContent = r.value.length; });
  }

  function showChangesModal(req) {
    var W = AW();
    var body = '<div class="form-group"><label class="form-label">Feedback</label>' +
      '<textarea id="apChgFeedback" class="form-textarea" maxlength="1000" placeholder="What needs to change?"></textarea></div>';
    modal('Request Changes', 'changes-header', body, [
      { label: 'Cancel', cls: 'btn-cancel', onClick: closeModal },
      { label: 'Request Changes', cls: 'btn-changes', onClick: function (m) {
        var res = W.Requests.requestChanges({ requestId: req.id, approverId: actingUserId(), feedback: m.querySelector('#apChgFeedback').value });
        if (!res.ok) { showToast(res.error, 'error'); return; }
        mirrorTimeline(taskById(req.taskId), 'Changes requested by ' + W.memberName(actingUserId()));
        closeModal(m); showToast('Changes requested', 'success'); refresh();
      } }
    ]);
  }

  function showResubmitModal(req) {
    var W = AW();
    var body = '<div class="form-group"><label class="form-label">Note (optional)</label>' +
      '<textarea id="apResubNote" class="form-textarea" maxlength="500" placeholder="What did you change?"></textarea></div>' +
      '<div class="lock-info-banner"><i class="fa-solid fa-rotate"></i> This re-sends the request to ' + esc(W.memberName(req.approverId)) + '.</div>';
    modal('Re-submit for Approval', '', body, [
      { label: 'Cancel', cls: 'btn-cancel', onClick: closeModal },
      { label: 'Re-submit', cls: 'btn-submit', onClick: function (m) {
        var res = W.Requests.resubmit({ requestId: req.id, requesterId: actingUserId(), note: m.querySelector('#apResubNote').value });
        if (!res.ok) { showToast(res.error, 'error'); return; }
        mirrorTimeline(taskById(req.taskId), 'Re-submitted for approval');
        closeModal(m); showToast('Re-submitted', 'success'); refresh();
      } }
    ]);
  }

  function showAbortModal(req) {
    var W = AW();
    var body = '<div class="form-group"><label class="form-label">Reason (optional)</label>' +
      '<textarea id="apAbortReason" class="form-textarea" placeholder="Why are you aborting this approval?"></textarea></div>';
    modal('Abort Approval', 'abort-header', body, [
      { label: 'Cancel', cls: 'btn-cancel', onClick: closeModal },
      { label: 'Abort', cls: 'btn-abort', onClick: function (m) {
        var res = W.Requests.abort({ requestId: req.id, adminId: actingUserId(), reason: m.querySelector('#apAbortReason').value });
        if (!res.ok) { showToast(res.error, 'error'); return; }
        mirrorTimeline(taskById(req.taskId), 'Approval aborted by admin');
        closeModal(m); showToast('Approval aborted', 'success'); refresh();
      } }
    ]);
  }

  function mirrorTimeline(task, action) { if (task && typeof window.addTimelineEntry === 'function') { try { window.addTimelineEntry(task, action); } catch (e) {} } }

  // ── mandate guard (block Complete/Close when unapproved) ─────────────────────────
  function installMandateGuard() {
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || el.id !== 'detailStatus') return;
      var W = AW(); if (!W) return;
      var taskId = window.state && window.state.selectedTaskId; var task = taskById(taskId); if (!task) return;
      var gid = task.group || task.groupId;
      var val = el.value;
      if (val !== 'Completed' && val !== 'Closed') return;
      var check = W.TaskLock.validateTaskCompletion(taskId, gid);
      if (!check.allowed) {
        e.stopImmediatePropagation();   // prevent app.js handler from applying the change
        el.value = task.status;          // revert visible selection
        if (confirm(check.reason + '\n\nSend this task for approval now?')) showRequestModal(task, gid);
      }
    }, true); // capture phase
  }

  // ── Approvals Hub (RHS) ─────────────────────────────────────────────────────────
  function pendingCountFor(userId) {
    return AW().Requests.getAll().filter(function (r) { return r.approverId === userId && r.status === AW().State.PENDING; }).length;
  }
  function updateHubBadge() {
    var btn = document.getElementById('approvalsHubBtn'); if (!btn) return;
    var badge = btn.querySelector('.ap-hub-badge');
    var n = AW() ? pendingCountFor(actingUserId()) : 0;
    if (!badge) { badge = document.createElement('span'); badge.className = 'ap-hub-badge'; btn.appendChild(badge); }
    badge.textContent = n; badge.style.display = n > 0 ? '' : 'none';
  }

  var hubTab = 'for_me';
  function openHub() {
    var W = AW(); if (!W) return;
    var existing = document.getElementById('apHubOverlay'); if (existing) existing.remove();
    var ov = document.createElement('div'); ov.id = 'apHubOverlay'; ov.className = 'approval-modal-overlay';
    ov.innerHTML = '<div class="modal-content ap-hub">' +
      '<div class="modal-header ap-hub-header"><span><i class="fa-solid fa-clipboard-check"></i> Approvals Hub</span>' +
        '<span class="ap-actas">Acting as: <select id="apActAs" class="form-select"></select></span>' +
        '<button class="ap-hub-close" id="apHubClose">&times;</button></div>' +
      '<div class="ap-hub-tabs">' +
        '<button class="ap-hub-tab" data-t="for_me">For my approval</button>' +
        '<button class="ap-hub-tab" data-t="by_me">Requested by me</button>' +
      '</div><div class="modal-body" id="apHubBody"></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    ov.querySelector('#apHubClose').addEventListener('click', function () { ov.remove(); });
    var sel = ov.querySelector('#apActAs');
    sel.innerHTML = members().map(function (m) { return '<option value="' + m.id + '"' + (m.id === actingUserId() ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('');
    sel.addEventListener('change', function () { _actingUserId = this.value; updateHubBadge(); renderHubBody(); injectInTask(); });
    ov.querySelectorAll('.ap-hub-tab').forEach(function (t) { t.addEventListener('click', function () { hubTab = t.dataset.t; renderHubBody(); }); });
    renderHubBody();
  }

  function statusLabel(s) {
    return ({ pending_approval: 'Pending', approved: 'Approved', rejected: 'Rejected', changes_requested: 'Changes requested', aborted: 'Aborted' })[s] || s;
  }

  function renderHubBody() {
    var W = AW(); var body = document.getElementById('apHubBody'); if (!body) return;
    document.querySelectorAll('#apHubOverlay .ap-hub-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.t === hubTab); });
    var me = actingUserId();
    var all = W.Requests.getAll();
    function taskTitle(id) { var t = taskById(id); return t ? t.title : id; }
    function row(r, showActions) {
      return '<div class="ap-hub-row" data-task="' + r.taskId + '">' +
        '<div class="ap-hub-row-main"><div class="ap-hub-task">' + esc(taskTitle(r.taskId)) + '</div>' +
        '<div class="ap-hub-meta">' + esc(W.memberName(r.requesterId)) + ' → ' + esc(W.memberName(r.approverId)) +
        ' · <span class="ap-status ' + r.status + '">' + statusLabel(r.status) + '</span>' + (r.note ? ' · “' + esc(r.note) + '”' : '') + '</div></div>' +
        (showActions && r.status === W.State.PENDING ?
          '<div class="ap-hub-actions"><button class="decision-btn approve" data-a="approve" data-id="' + r.id + '">Approve</button>' +
          '<button class="decision-btn reject" data-a="reject" data-id="' + r.id + '">Reject</button>' +
          '<button class="decision-btn changes" data-a="changes" data-id="' + r.id + '">Changes</button></div>' : '') +
        '</div>';
    }
    var html = '';
    if (hubTab === 'for_me') {
      var forMe = all.filter(function (r) { return r.approverId === me; });
      var pending = forMe.filter(function (r) { return r.status === W.State.PENDING; });
      var decided = forMe.filter(function (r) { return r.status !== W.State.PENDING; });
      html += '<div class="ap-hub-section-title">Pending (' + pending.length + ')</div>';
      html += pending.length ? pending.map(function (r) { return row(r, true); }).join('') : '<div class="audit-empty">Nothing awaiting your decision.</div>';
      html += '<div class="ap-hub-section-title">Decided by me (' + decided.length + ')</div>';
      html += decided.length ? decided.map(function (r) { return row(r, false); }).join('') : '<div class="audit-empty">No decisions yet.</div>';
    } else {
      var byMe = all.filter(function (r) { return r.requesterId === me; });
      html += byMe.length ? byMe.map(function (r) { return row(r, false); }).join('') : '<div class="audit-empty">You haven’t requested any approvals.</div>';
    }
    body.innerHTML = html;
    body.querySelectorAll('.ap-hub-actions .decision-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var req = W.Requests.getById(b.dataset.id); if (!req) return;
        if (b.dataset.a === 'approve') showApproveModal(req);
        else if (b.dataset.a === 'reject') showRejectModal(req);
        else showChangesModal(req);
      });
    });
    body.querySelectorAll('.ap-hub-row').forEach(function (rw) {
      rw.addEventListener('dblclick', function () { var tid = rw.dataset.task; var o = document.getElementById('apHubOverlay'); if (o) o.remove(); if (typeof window.showTaskDetail === 'function') window.showTaskDetail(tid, 'panel'); });
    });
  }

  // ── refresh orchestration ────────────────────────────────────────────────────
  function refresh() {
    injectInTask(); updateHubBadge();
    if (document.getElementById('apHubOverlay')) renderHubBody();
    var m = document.getElementById('approvalConfigMount'); if (m && m.offsetParent !== null) mountConfig();
  }

  // ── boot ─────────────────────────────────────────────────────────────────────
  function boot() {
    if (!AW()) { setTimeout(boot, 300); return; }
    installMandateGuard();
    setInterval(injectInTask, 600);
    updateHubBadge();
    AW().on('approval:changed', refresh);
    AW().on('approval:notify', function (d) {
      if (typeof window.pushBellNotification === 'function') window.pushBellNotification(d.type || 'approval', d.taskId, '', d.message);
      updateHubBadge();
    });
    document.addEventListener('click', function (e) {
      var tab = e.target.closest && e.target.closest('.group-tab');
      if (tab && tab.dataset.tab === 'approvals') setTimeout(mountConfig, 30);
      var hub = e.target.closest && e.target.closest('#approvalsHubBtn');
      if (hub) openHub();
    });
    console.log('[ApprovalFlowUI] ready — in-task UI, mandate guard, Approvals Hub');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);

  window.ApprovalUI = {
    renderConfigPanel: renderConfigPanel, mountConfig: mountConfig,
    // legacy alias so any stale caller (settings.js) still gets a valid node
    renderSettingsPanel: function (groupId) { return renderConfigPanel(groupId); },
    openHub: openHub, actingUserId: actingUserId, updateHubBadge: updateHubBadge,
    injectInTask: injectInTask, showToast: showToast, init: function () { return Promise.resolve(true); }
  };
})();
