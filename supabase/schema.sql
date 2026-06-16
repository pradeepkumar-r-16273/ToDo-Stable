-- ============================================================
-- Shadow ToDo — Complete Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks)
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. CORE TABLES (tasks, groups, etc.)
--    These should already exist. Script will skip
--    if present and only add missing columns.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.groups (
  id          text PRIMARY KEY,
  name        text,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  data        jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.categories (
  id          text PRIMARY KEY,
  group_id    text REFERENCES public.groups(id) ON DELETE CASCADE,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  data        jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.tags (
  id          text PRIMARY KEY,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  data        jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.members (
  id          text PRIMARY KEY,
  group_id    text REFERENCES public.groups(id) ON DELETE CASCADE,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  data        jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public."customFields" (
  id          text PRIMARY KEY,
  group_id    text REFERENCES public.groups(id) ON DELETE CASCADE,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  data        jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id           text PRIMARY KEY,
  group_id     text REFERENCES public.groups(id) ON DELETE CASCADE,
  status       text DEFAULT 'todo',
  assignee_id  text,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  data         jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.comments (
  id          text PRIMARY KEY,
  task_id     text REFERENCES public.tasks(id) ON DELETE CASCADE,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  data        jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.activity (
  id          text PRIMARY KEY,
  task_id     text REFERENCES public.tasks(id) ON DELETE CASCADE,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  data        jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.settings (
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb,
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (owner_id, key)
);

-- ──────────────────────────────────────────────
-- 2. USERS TABLE
--    Mirrors auth.users with app-level profile data
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name               text,
  email              text,
  role               text DEFAULT 'member',
  avatar             text,
  color              text,
  theme_preference   text DEFAULT 'light',
  theme_color        text,
  onboarded_at       timestamptz,
  last_login_at      timestamptz,
  preferences        jsonb DEFAULT '{}',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 3. NOTIFICATIONS TABLE
--    Replaces localStorage shadow_bell_notifications
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          text PRIMARY KEY,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text,
  task_id     text,
  actor       text,
  message     text,
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 4. NOTIFICATION PREFERENCES TABLE
--    Replaces localStorage shadow_notif_prefs
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  owner_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled boolean DEFAULT true,
  desktop               jsonb DEFAULT '{}',
  reminder              jsonb DEFAULT '{}',
  email_prefs           jsonb DEFAULT '{}',
  priority_users        jsonb DEFAULT '[]',
  dnd                   jsonb DEFAULT '{}',
  triggers              jsonb DEFAULT '{}',
  group_prefs           jsonb DEFAULT '{}',
  updated_at            timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 5. TEMPLATES TABLE
--    Replaces localStorage shadow_templates
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.templates (
  id              text PRIMARY KEY,
  owner_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text,
  emoji           text,
  description     text,
  priority        text DEFAULT 'medium',
  tags            jsonb DEFAULT '[]',
  subtasks        jsonb DEFAULT '[]',
  is_favourite    boolean DEFAULT false,
  shared_with     jsonb DEFAULT '[]',
  source          text,
  created_by      text,
  created_by_name text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 6. USER VIEW PREFERENCES TABLE
--    Replaces localStorage svk_state_{userId}
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_view_prefs (
  owner_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefs       jsonb DEFAULT '{}',
  updated_at  timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 7. APPROVAL WORKFLOW TABLES
--    Migrates from IndexedDB to Supabase
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id                   text PRIMARY KEY,
  task_id              text REFERENCES public.tasks(id) ON DELETE CASCADE,
  group_id             text REFERENCES public.groups(id) ON DELETE CASCADE,
  requester_id         text,
  approver_id          text,
  status               text DEFAULT 'pending',
  note                 text,
  decision_note        text,
  rejection_category   text,
  aborted_by           text,
  previous_request_id  text,
  owner_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  resolved_at          timestamptz
);

CREATE TABLE IF NOT EXISTS public.approval_audit_logs (
  id          text PRIMARY KEY,
  task_id     text REFERENCES public.tasks(id) ON DELETE CASCADE,
  request_id  text REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  actor_id    text,
  action_type text,
  notes       text,
  metadata    jsonb DEFAULT '{}',
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_settings (
  group_id               text PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  enabled                boolean DEFAULT false,
  mandate_approval       boolean DEFAULT false,
  default_approver       text,
  default_approver_type  text,
  approver_deleted       boolean DEFAULT false,
  owner_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at             timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 8. TASK REACTIONS TABLE (Likes)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_reactions (
  id            text PRIMARY KEY,
  task_id       text REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text DEFAULT 'like',
  created_at    timestamptz DEFAULT now(),
  UNIQUE (task_id, user_id, reaction_type)
);

-- ──────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY (RLS)
--    Each user can only see/edit their own data
-- ──────────────────────────────────────────────

ALTER TABLE public.groups                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."customFields"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_view_prefs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reactions          ENABLE ROW LEVEL SECURITY;

-- RLS Policies — owner sees and manages their own rows
DO $$ DECLARE
  tbl text;
  tables text[] := ARRAY[
    'groups','categories','tags','members','"customFields"','tasks',
    'comments','activity','settings','users','notifications',
    'notification_preferences','templates','user_view_prefs',
    'approval_requests','approval_audit_logs','approval_settings',
    'task_reactions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "owner_all_%s" ON public.%s
       FOR ALL USING (auth.uid() = owner_id)
       WITH CHECK (auth.uid() = owner_id)',
      regexp_replace(tbl, '[^a-z0-9]', '_', 'g'), tbl
    );
  END LOOP;
END $$;

-- Special policies for tables with different PK structure
DROP POLICY IF EXISTS "owner_all_users" ON public.users;
CREATE POLICY "owner_all_users" ON public.users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "owner_all_notification_preferences" ON public.notification_preferences;
CREATE POLICY "owner_all_notification_preferences" ON public.notification_preferences
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "owner_all_user_view_prefs" ON public.user_view_prefs;
CREATE POLICY "owner_all_user_view_prefs" ON public.user_view_prefs
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "owner_all_approval_settings" ON public.approval_settings;
CREATE POLICY "owner_all_approval_settings" ON public.approval_settings
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "owner_all_task_reactions" ON public.task_reactions;
CREATE POLICY "owner_all_task_reactions" ON public.task_reactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 10. INDEXES (for query performance)
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_owner        ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group        ON public.tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee     ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_task      ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_task      ON public.activity(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON public.notifications(owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read  ON public.notifications(owner_id, read);
CREATE INDEX IF NOT EXISTS idx_approval_req_task  ON public.approval_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_approval_req_group ON public.approval_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_req  ON public.approval_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_reactions_task     ON public.task_reactions(task_id);
