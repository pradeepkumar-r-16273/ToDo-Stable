-- ============================================================
-- Shadow ToDo — Sample Seed Data
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Creates 3 groups + 100 tasks for the user whose email is set below
--
-- HOW TO USE:
--   1. Replace the email below with the email you sign in to the app with
--   2. Paste this whole script into Supabase SQL Editor and Run
-- ============================================================

DO $$
DECLARE
  target_email text := 'pradeep@todo.app';  -- <-- CHANGE THIS if needed
  uid uuid;
  now_ts timestamptz := now();
BEGIN

SELECT id INTO uid FROM auth.users WHERE email = target_email LIMIT 1;

IF uid IS NULL THEN
  RAISE EXCEPTION 'No auth user found for email %. Sign up/sign in to the app first, or update target_email at the top of this script.', target_email;
END IF;

-- ──────────────────────────────────────────────
-- GROUPS
-- ──────────────────────────────────────────────
INSERT INTO public.groups (id, name, owner_id, created_at, updated_at, data) VALUES
  ('grp_engineering', 'Engineering',  uid, now_ts - interval '30 days', now_ts, '{"type":"group","color":"#1a73e8","adminIds":[],"memberIds":[]}'::jsonb),
  ('grp_marketing',   'Marketing',    uid, now_ts - interval '25 days', now_ts, '{"type":"group","color":"#34a853","adminIds":[],"memberIds":[]}'::jsonb),
  ('grp_personal',    'Personal',     uid, now_ts - interval '20 days', now_ts, '{"type":"personal","color":"#ea4335","adminIds":[],"memberIds":[],"isPersonal":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- ENGINEERING TASKS (40)
-- ──────────────────────────────────────────────
INSERT INTO public.tasks (id, group_id, status, owner_id, created_at, updated_at, data) VALUES
('task_e01','grp_engineering','todo',uid,now_ts-'29d'::interval,now_ts,('{"title":"Set up CI/CD pipeline","description":"Configure GitHub Actions for automated testing and deployment","priority":"high","dueDate":"'||(now_ts+'7d'::interval)::date||'","tags":["DevOps","CI"],"subtasks":[{"id":"sub1","title":"Create workflow YAML","done":false},{"id":"sub2","title":"Add test stage","done":false},{"id":"sub3","title":"Configure deployment","done":false}]}')::jsonb),
('task_e02','grp_engineering','in-progress',uid,now_ts-'28d'::interval,now_ts,('{"title":"Implement authentication module","description":"Build JWT-based auth with refresh token support","priority":"high","dueDate":"'||(now_ts+'3d'::interval)::date||'","tags":["Auth","Security"],"subtasks":[{"id":"sub1","title":"JWT generation","done":true},{"id":"sub2","title":"Refresh token logic","done":true},{"id":"sub3","title":"Session management","done":false}]}')::jsonb),
('task_e03','grp_engineering','done',uid,now_ts-'27d'::interval,now_ts,('{"title":"Database schema design","description":"Design normalized schema for core entities","priority":"high","tags":["Database","Architecture"],"completedAt":"'||(now_ts-'5d'::interval)::timestamptz||'"}')::jsonb),
('task_e04','grp_engineering','review',uid,now_ts-'26d'::interval,now_ts,('{"title":"API rate limiting","description":"Implement token bucket algorithm for rate limiting","priority":"medium","dueDate":"'||(now_ts+'5d'::interval)::date||'","tags":["API","Security"]}')::jsonb),
('task_e05','grp_engineering','todo',uid,now_ts-'25d'::interval,now_ts,('{"title":"Write unit tests for user service","priority":"medium","dueDate":"'||(now_ts+'10d'::interval)::date||'","tags":["Testing"]}')::jsonb),
('task_e06','grp_engineering','in-progress',uid,now_ts-'24d'::interval,now_ts,('{"title":"Refactor legacy payment module","description":"Migrate from v1 Stripe SDK to v3","priority":"high","dueDate":"'||(now_ts+'2d'::interval)::date||'","tags":["Payments","Refactor"]}')::jsonb),
('task_e07','grp_engineering','todo',uid,now_ts-'23d'::interval,now_ts,('{"title":"Add Redis caching layer","description":"Cache frequently accessed queries in Redis","priority":"medium","tags":["Performance","Infrastructure"]}')::jsonb),
('task_e08','grp_engineering','done',uid,now_ts-'22d'::interval,now_ts,('{"title":"Fix SQL injection vulnerability","description":"Sanitize all raw queries in the reports module","priority":"high","tags":["Security","Bug"],"completedAt":"'||(now_ts-'8d'::interval)::timestamptz||'"}')::jsonb),
('task_e09','grp_engineering','todo',uid,now_ts-'21d'::interval,now_ts,('{"title":"Implement search with Elasticsearch","priority":"medium","dueDate":"'||(now_ts+'14d'::interval)::date||'","tags":["Search","Infrastructure"]}')::jsonb),
('task_e10','grp_engineering','review',uid,now_ts-'20d'::interval,now_ts,('{"title":"WebSocket real-time notifications","description":"Push notifications for task updates","priority":"medium","tags":["Real-time","Feature"]}')::jsonb),
('task_e11','grp_engineering','todo',uid,now_ts-'19d'::interval,now_ts,('{"title":"API documentation with Swagger","priority":"low","dueDate":"'||(now_ts+'20d'::interval)::date||'","tags":["Documentation"]}')::jsonb),
('task_e12','grp_engineering','in-progress',uid,now_ts-'18d'::interval,now_ts,('{"title":"Mobile responsive dashboard","description":"Make admin dashboard mobile-friendly","priority":"medium","dueDate":"'||(now_ts+'6d'::interval)::date||'","tags":["Frontend","UI"]}')::jsonb),
('task_e13','grp_engineering','done',uid,now_ts-'17d'::interval,now_ts,('{"title":"Set up error monitoring (Sentry)","priority":"medium","tags":["DevOps","Monitoring"],"completedAt":"'||(now_ts-'3d'::interval)::timestamptz||'"}')::jsonb),
('task_e14','grp_engineering','todo',uid,now_ts-'16d'::interval,now_ts,('{"title":"Implement data export (CSV/Excel)","priority":"low","dueDate":"'||(now_ts+'25d'::interval)::date||'","tags":["Feature","Export"]}')::jsonb),
('task_e15','grp_engineering','todo',uid,now_ts-'15d'::interval,now_ts,('{"title":"Performance profiling — identify bottlenecks","priority":"medium","dueDate":"'||(now_ts+'12d'::interval)::date||'","tags":["Performance"]}')::jsonb),
('task_e16','grp_engineering','in-progress',uid,now_ts-'14d'::interval,now_ts,('{"title":"Build notification email templates","priority":"low","tags":["Email","Frontend"]}')::jsonb),
('task_e17','grp_engineering','todo',uid,now_ts-'13d'::interval,now_ts,('{"title":"Containerize app with Docker","priority":"medium","dueDate":"'||(now_ts+'8d'::interval)::date||'","tags":["DevOps","Docker"]}')::jsonb),
('task_e18','grp_engineering','done',uid,now_ts-'12d'::interval,now_ts,('{"title":"Code review: auth PR #142","priority":"high","tags":["Code Review"],"completedAt":"'||(now_ts-'2d'::interval)::timestamptz||'"}')::jsonb),
('task_e19','grp_engineering','review',uid,now_ts-'11d'::interval,now_ts,('{"title":"Implement two-factor authentication","priority":"high","dueDate":"'||(now_ts+'4d'::interval)::date||'","tags":["Security","Auth"]}')::jsonb),
('task_e20','grp_engineering','todo',uid,now_ts-'10d'::interval,now_ts,('{"title":"Migrate to TypeScript","description":"Convert core modules from JS to TypeScript","priority":"low","dueDate":"'||(now_ts+'30d'::interval)::date||'","tags":["Refactor","TypeScript"]}')::jsonb),
('task_e21','grp_engineering','todo',uid,now_ts-'9d'::interval,now_ts,('{"title":"Set up load balancer","priority":"medium","dueDate":"'||(now_ts+'15d'::interval)::date||'","tags":["Infrastructure"]}')::jsonb),
('task_e22','grp_engineering','in-progress',uid,now_ts-'8d'::interval,now_ts,('{"title":"Build admin role management UI","priority":"medium","tags":["Admin","Frontend"]}')::jsonb),
('task_e23','grp_engineering','todo',uid,now_ts-'7d'::interval,now_ts,('{"title":"Add pagination to all list endpoints","priority":"medium","dueDate":"'||(now_ts+'9d'::interval)::date||'","tags":["API","Performance"]}')::jsonb),
('task_e24','grp_engineering','done',uid,now_ts-'6d'::interval,now_ts,('{"title":"Fix memory leak in worker process","priority":"high","tags":["Bug","Performance"],"completedAt":"'||(now_ts-'1d'::interval)::timestamptz||'"}')::jsonb),
('task_e25','grp_engineering','todo',uid,now_ts-'5d'::interval,now_ts,('{"title":"Integration tests for payment flow","priority":"high","dueDate":"'||(now_ts+'11d'::interval)::date||'","tags":["Testing","Payments"]}')::jsonb),
('task_e26','grp_engineering','review',uid,now_ts-'4d'::interval,now_ts,('{"title":"Dark mode for dashboard","priority":"low","tags":["UI","Frontend"]}')::jsonb),
('task_e27','grp_engineering','todo',uid,now_ts-'3d'::interval,now_ts,('{"title":"Implement audit logging","priority":"medium","dueDate":"'||(now_ts+'18d'::interval)::date||'","tags":["Compliance","Backend"]}')::jsonb),
('task_e28','grp_engineering','in-progress',uid,now_ts-'2d'::interval,now_ts,('{"title":"GraphQL API layer","description":"Add GraphQL alongside REST for frontend flexibility","priority":"medium","dueDate":"'||(now_ts+'16d'::interval)::date||'","tags":["API","GraphQL"]}')::jsonb),
('task_e29','grp_engineering','todo',uid,now_ts-'1d'::interval,now_ts,('{"title":"Set up staging environment","priority":"high","dueDate":"'||(now_ts+'5d'::interval)::date||'","tags":["DevOps","Infrastructure"]}')::jsonb),
('task_e30','grp_engineering','todo',uid,now_ts,now_ts,('{"title":"Implement feature flags","priority":"medium","dueDate":"'||(now_ts+'22d'::interval)::date||'","tags":["Feature","Backend"]}')::jsonb),
('task_e31','grp_engineering','todo',uid,now_ts,now_ts,('{"title":"Database backup automation","priority":"high","dueDate":"'||(now_ts+'3d'::interval)::date||'","tags":["DevOps","Database"]}')::jsonb),
('task_e32','grp_engineering','done',uid,now_ts-'15d'::interval,now_ts,('{"title":"Upgrade Node.js to v20 LTS","priority":"medium","tags":["Maintenance"],"completedAt":"'||(now_ts-'10d'::interval)::timestamptz||'"}')::jsonb),
('task_e33','grp_engineering','in-progress',uid,now_ts-'3d'::interval,now_ts,('{"title":"Build CSV import tool","priority":"low","dueDate":"'||(now_ts+'28d'::interval)::date||'","tags":["Feature","Import"]}')::jsonb),
('task_e34','grp_engineering','todo',uid,now_ts-'2d'::interval,now_ts,('{"title":"P95 latency investigation","description":"API P95 latency spiked to 800ms last week","priority":"high","dueDate":"'||(now_ts+'2d'::interval)::date||'","tags":["Performance","Urgent"]}')::jsonb),
('task_e35','grp_engineering','review',uid,now_ts-'1d'::interval,now_ts,('{"title":"Add health check endpoint","priority":"low","tags":["DevOps","API"]}')::jsonb),
('task_e36','grp_engineering','todo',uid,now_ts,now_ts,('{"title":"Implement GDPR data deletion","priority":"high","dueDate":"'||(now_ts+'7d'::interval)::date||'","tags":["Compliance","GDPR"]}')::jsonb),
('task_e37','grp_engineering','done',uid,now_ts-'20d'::interval,now_ts,('{"title":"Set up log aggregation (ELK)","priority":"medium","tags":["DevOps","Logging"],"completedAt":"'||(now_ts-'12d'::interval)::timestamptz||'"}')::jsonb),
('task_e38','grp_engineering','todo',uid,now_ts-'1d'::interval,now_ts,('{"title":"Add retry logic for failed jobs","priority":"medium","dueDate":"'||(now_ts+'13d'::interval)::date||'","tags":["Backend","Reliability"]}')::jsonb),
('task_e39','grp_engineering','in-progress',uid,now_ts-'4d'::interval,now_ts,('{"title":"Frontend component library setup","priority":"medium","tags":["Frontend","Design System"]}')::jsonb),
('task_e40','grp_engineering','todo',uid,now_ts,now_ts,('{"title":"Pen test remediation tasks","description":"Address findings from Q2 security audit","priority":"high","dueDate":"'||(now_ts+'6d'::interval)::date||'","tags":["Security","Compliance"]}')::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- MARKETING TASKS (35)
-- ──────────────────────────────────────────────
INSERT INTO public.tasks (id, group_id, status, owner_id, created_at, updated_at, data) VALUES
('task_m01','grp_marketing','todo',uid,now_ts-'25d'::interval,now_ts,('{"title":"Q3 content calendar","description":"Plan blog posts, social, and email for Q3","priority":"high","dueDate":"'||(now_ts+'5d'::interval)::date||'","tags":["Content","Planning"]}')::jsonb),
('task_m02','grp_marketing','in-progress',uid,now_ts-'24d'::interval,now_ts,('{"title":"Product launch campaign — v2.0","description":"Full-funnel campaign for the v2.0 release","priority":"high","dueDate":"'||(now_ts+'10d'::interval)::date||'","tags":["Launch","Campaign"],"subtasks":[{"id":"sub1","title":"Landing page copy","done":true},{"id":"sub2","title":"Email sequence","done":false},{"id":"sub3","title":"Social assets","done":false},{"id":"sub4","title":"Press release","done":false}]}')::jsonb),
('task_m03','grp_marketing','done',uid,now_ts-'23d'::interval,now_ts,('{"title":"Competitor analysis report","priority":"medium","tags":["Research","Strategy"],"completedAt":"'||(now_ts-'7d'::interval)::timestamptz||'"}')::jsonb),
('task_m04','grp_marketing','todo',uid,now_ts-'22d'::interval,now_ts,('{"title":"Set up Google Analytics 4","priority":"medium","dueDate":"'||(now_ts+'8d'::interval)::date||'","tags":["Analytics","Setup"]}')::jsonb),
('task_m05','grp_marketing','review',uid,now_ts-'21d'::interval,now_ts,('{"title":"Website homepage redesign brief","priority":"high","dueDate":"'||(now_ts+'4d'::interval)::date||'","tags":["Website","Design"]}')::jsonb),
('task_m06','grp_marketing','in-progress',uid,now_ts-'20d'::interval,now_ts,('{"title":"SEO audit and keyword research","priority":"medium","dueDate":"'||(now_ts+'14d'::interval)::date||'","tags":["SEO","Content"]}')::jsonb),
('task_m07','grp_marketing','todo',uid,now_ts-'19d'::interval,now_ts,('{"title":"Create case study: TechCorp success story","priority":"medium","dueDate":"'||(now_ts+'20d'::interval)::date||'","tags":["Content","Case Study"]}')::jsonb),
('task_m08','grp_marketing','done',uid,now_ts-'18d'::interval,now_ts,('{"title":"Email list cleanup and segmentation","priority":"low","tags":["Email","CRM"],"completedAt":"'||(now_ts-'4d'::interval)::timestamptz||'"}')::jsonb),
('task_m09','grp_marketing','todo',uid,now_ts-'17d'::interval,now_ts,('{"title":"LinkedIn ads campaign setup","priority":"medium","dueDate":"'||(now_ts+'12d'::interval)::date||'","tags":["Ads","LinkedIn"]}')::jsonb),
('task_m10','grp_marketing','todo',uid,now_ts-'16d'::interval,now_ts,('{"title":"Monthly newsletter — July edition","priority":"high","dueDate":"'||(now_ts+'3d'::interval)::date||'","tags":["Email","Newsletter"]}')::jsonb),
('task_m11','grp_marketing','in-progress',uid,now_ts-'15d'::interval,now_ts,('{"title":"Brand voice & tone guidelines","priority":"medium","dueDate":"'||(now_ts+'16d'::interval)::date||'","tags":["Brand","Content"]}')::jsonb),
('task_m12','grp_marketing','todo',uid,now_ts-'14d'::interval,now_ts,('{"title":"Webinar: Productivity tips for teams","description":"Host a free webinar to generate leads","priority":"medium","dueDate":"'||(now_ts+'21d'::interval)::date||'","tags":["Event","Lead Gen"]}')::jsonb),
('task_m13','grp_marketing','review',uid,now_ts-'13d'::interval,now_ts,('{"title":"Pricing page A/B test","priority":"high","dueDate":"'||(now_ts+'6d'::interval)::date||'","tags":["Conversion","Testing"]}')::jsonb),
('task_m14','grp_marketing','done',uid,now_ts-'12d'::interval,now_ts,('{"title":"Twitter/X social strategy","priority":"low","tags":["Social Media"],"completedAt":"'||(now_ts-'6d'::interval)::timestamptz||'"}')::jsonb),
('task_m15','grp_marketing','todo',uid,now_ts-'11d'::interval,now_ts,('{"title":"Partner co-marketing proposal","priority":"medium","dueDate":"'||(now_ts+'18d'::interval)::date||'","tags":["Partnerships","Strategy"]}')::jsonb),
('task_m16','grp_marketing','in-progress',uid,now_ts-'10d'::interval,now_ts,('{"title":"Video testimonials from top customers","priority":"medium","dueDate":"'||(now_ts+'25d'::interval)::date||'","tags":["Content","Video"]}')::jsonb),
('task_m17','grp_marketing','todo',uid,now_ts-'9d'::interval,now_ts,('{"title":"Referral program design","priority":"high","dueDate":"'||(now_ts+'9d'::interval)::date||'","tags":["Growth","Strategy"]}')::jsonb),
('task_m18','grp_marketing','done',uid,now_ts-'8d'::interval,now_ts,('{"title":"Update press kit and media assets","priority":"low","tags":["PR","Brand"],"completedAt":"'||(now_ts-'2d'::interval)::timestamptz||'"}')::jsonb),
('task_m19','grp_marketing','todo',uid,now_ts-'7d'::interval,now_ts,('{"title":"Conference sponsorship evaluation","description":"Evaluate SaaStr, Web Summit, and ProductCon","priority":"medium","dueDate":"'||(now_ts+'30d'::interval)::date||'","tags":["Events","Budget"]}')::jsonb),
('task_m20','grp_marketing','review',uid,now_ts-'6d'::interval,now_ts,('{"title":"Onboarding email sequence redesign","priority":"high","dueDate":"'||(now_ts+'7d'::interval)::date||'","tags":["Email","Onboarding"]}')::jsonb),
('task_m21','grp_marketing','todo',uid,now_ts-'5d'::interval,now_ts,('{"title":"G2 and Capterra review campaign","priority":"medium","dueDate":"'||(now_ts+'15d'::interval)::date||'","tags":["Reviews","Social Proof"]}')::jsonb),
('task_m22','grp_marketing','in-progress',uid,now_ts-'4d'::interval,now_ts,('{"title":"Persona research interviews (5 customers)","priority":"medium","dueDate":"'||(now_ts+'20d'::interval)::date||'","tags":["Research","UX"]}')::jsonb),
('task_m23','grp_marketing','todo',uid,now_ts-'3d'::interval,now_ts,('{"title":"Create demo video walkthrough","priority":"high","dueDate":"'||(now_ts+'11d'::interval)::date||'","tags":["Video","Sales"]}')::jsonb),
('task_m24','grp_marketing','done',uid,now_ts-'2d'::interval,now_ts,('{"title":"Update pricing page copy","priority":"medium","tags":["Website","Conversion"],"completedAt":"'||(now_ts-'1d'::interval)::timestamptz||'"}')::jsonb),
('task_m25','grp_marketing','todo',uid,now_ts-'1d'::interval,now_ts,('{"title":"Podcast outreach — 10 shows","priority":"low","dueDate":"'||(now_ts+'35d'::interval)::date||'","tags":["PR","Content"]}')::jsonb),
('task_m26','grp_marketing','todo',uid,now_ts,now_ts,('{"title":"Build affiliate marketing program","priority":"medium","dueDate":"'||(now_ts+'40d'::interval)::date||'","tags":["Growth","Partnerships"]}')::jsonb),
('task_m27','grp_marketing','review',uid,now_ts-'1d'::interval,now_ts,('{"title":"Product feature highlight blog post","priority":"medium","dueDate":"'||(now_ts+'4d'::interval)::date||'","tags":["Content","Blog"]}')::jsonb),
('task_m28','grp_marketing','in-progress',uid,now_ts-'3d'::interval,now_ts,('{"title":"CRM pipeline reporting dashboard","priority":"low","dueDate":"'||(now_ts+'17d'::interval)::date||'","tags":["CRM","Analytics"]}')::jsonb),
('task_m29','grp_marketing','todo',uid,now_ts-'2d'::interval,now_ts,('{"title":"Instagram visual identity guidelines","priority":"low","dueDate":"'||(now_ts+'28d'::interval)::date||'","tags":["Brand","Social Media"]}')::jsonb),
('task_m30','grp_marketing','done',uid,now_ts-'10d'::interval,now_ts,('{"title":"Q2 marketing performance report","priority":"high","tags":["Reporting","Analytics"],"completedAt":"'||(now_ts-'5d'::interval)::timestamptz||'"}')::jsonb),
('task_m31','grp_marketing','todo',uid,now_ts,now_ts,('{"title":"Customer success stories — 3 new case studies","priority":"medium","dueDate":"'||(now_ts+'45d'::interval)::date||'","tags":["Content","Case Study"]}')::jsonb),
('task_m32','grp_marketing','todo',uid,now_ts-'1d'::interval,now_ts,('{"title":"Cold email sequence for SMB segment","priority":"high","dueDate":"'||(now_ts+'6d'::interval)::date||'","tags":["Email","Sales"]}')::jsonb),
('task_m33','grp_marketing','in-progress',uid,now_ts-'5d'::interval,now_ts,('{"title":"Product comparison landing pages","priority":"medium","dueDate":"'||(now_ts+'19d'::interval)::date||'","tags":["SEO","Website"]}')::jsonb),
('task_m34','grp_marketing','todo',uid,now_ts-'2d'::interval,now_ts,('{"title":"Plan Q3 offsite for marketing team","priority":"low","dueDate":"'||(now_ts+'50d'::interval)::date||'","tags":["Team","Planning"]}')::jsonb),
('task_m35','grp_marketing','review',uid,now_ts,now_ts,('{"title":"Rewrite onboarding checklist UX copy","priority":"medium","dueDate":"'||(now_ts+'5d'::interval)::date||'","tags":["UX","Content"]}')::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- PERSONAL TASKS (25)
-- ──────────────────────────────────────────────
INSERT INTO public.tasks (id, group_id, status, owner_id, created_at, updated_at, data) VALUES
('task_p01','grp_personal','todo',uid,now_ts-'20d'::interval,now_ts,('{"title":"Book dentist appointment","priority":"medium","dueDate":"'||(now_ts+'7d'::interval)::date||'","tags":["Health"],"isMyDay":true}')::jsonb),
('task_p02','grp_personal','in-progress',uid,now_ts-'19d'::interval,now_ts,('{"title":"Read: The Lean Startup","description":"Finish last 5 chapters","priority":"low","dueDate":"'||(now_ts+'14d'::interval)::date||'","tags":["Reading","Learning"]}')::jsonb),
('task_p03','grp_personal','done',uid,now_ts-'18d'::interval,now_ts,('{"title":"Set up home office standing desk","priority":"medium","tags":["Home","Setup"],"completedAt":"'||(now_ts-'10d'::interval)::timestamptz||'"}')::jsonb),
('task_p04','grp_personal','todo',uid,now_ts-'17d'::interval,now_ts,('{"title":"Renew car insurance","priority":"high","dueDate":"'||(now_ts+'3d'::interval)::date||'","tags":["Finance","Admin"]}')::jsonb),
('task_p05','grp_personal','todo',uid,now_ts-'16d'::interval,now_ts,('{"title":"Plan weekend hiking trip","priority":"low","dueDate":"'||(now_ts+'10d'::interval)::date||'","tags":["Travel","Fitness"]}')::jsonb),
('task_p06','grp_personal','in-progress',uid,now_ts-'15d'::interval,now_ts,('{"title":"Learn Figma basics","description":"Complete beginner course on Figma","priority":"medium","dueDate":"'||(now_ts+'20d'::interval)::date||'","tags":["Learning","Design"]}')::jsonb),
('task_p07','grp_personal','done',uid,now_ts-'14d'::interval,now_ts,('{"title":"File Q1 tax return","priority":"high","tags":["Finance","Admin"],"completedAt":"'||(now_ts-'8d'::interval)::timestamptz||'"}')::jsonb),
('task_p08','grp_personal','todo',uid,now_ts-'13d'::interval,now_ts,('{"title":"Monthly budget review","priority":"medium","dueDate":"'||(now_ts+'5d'::interval)::date||'","tags":["Finance"],"isMyDay":true}')::jsonb),
('task_p09','grp_personal','todo',uid,now_ts-'12d'::interval,now_ts,('{"title":"Buy birthday gift for mom","priority":"high","dueDate":"'||(now_ts+'4d'::interval)::date||'","tags":["Personal","Family"]}')::jsonb),
('task_p10','grp_personal','done',uid,now_ts-'11d'::interval,now_ts,('{"title":"Gym membership renewal","priority":"low","tags":["Health","Fitness"],"completedAt":"'||(now_ts-'6d'::interval)::timestamptz||'"}')::jsonb),
('task_p11','grp_personal','todo',uid,now_ts-'10d'::interval,now_ts,('{"title":"Meal prep for the week","priority":"low","tags":["Health","Routine"],"isMyDay":true}')::jsonb),
('task_p12','grp_personal','todo',uid,now_ts-'9d'::interval,now_ts,('{"title":"Update LinkedIn profile","priority":"low","dueDate":"'||(now_ts+'15d'::interval)::date||'","tags":["Career","Personal Brand"]}')::jsonb),
('task_p13','grp_personal','in-progress',uid,now_ts-'8d'::interval,now_ts,('{"title":"Side project: personal finance tracker","priority":"medium","dueDate":"'||(now_ts+'30d'::interval)::date||'","tags":["Side Project","Coding"],"subtasks":[{"id":"sub1","title":"Design wireframes","done":true},{"id":"sub2","title":"Set up Next.js project","done":true},{"id":"sub3","title":"Build income/expense tracking","done":false},{"id":"sub4","title":"Charts and visualizations","done":false}]}')::jsonb),
('task_p14','grp_personal','todo',uid,now_ts-'7d'::interval,now_ts,('{"title":"Schedule annual health checkup","priority":"medium","dueDate":"'||(now_ts+'21d'::interval)::date||'","tags":["Health"]}')::jsonb),
('task_p15','grp_personal','done',uid,now_ts-'6d'::interval,now_ts,('{"title":"Declutter home office","priority":"low","tags":["Home","Productivity"],"completedAt":"'||(now_ts-'3d'::interval)::timestamptz||'"}')::jsonb),
('task_p16','grp_personal','todo',uid,now_ts-'5d'::interval,now_ts,('{"title":"Spanish — 30 minutes daily (Duolingo)","priority":"low","dueDate":"'||(now_ts+'60d'::interval)::date||'","tags":["Learning","Language"]}')::jsonb),
('task_p17','grp_personal','todo',uid,now_ts-'4d'::interval,now_ts,('{"title":"Research new laptop options","priority":"medium","dueDate":"'||(now_ts+'12d'::interval)::date||'","tags":["Tech","Finance"]}')::jsonb),
('task_p18','grp_personal','done',uid,now_ts-'3d'::interval,now_ts,('{"title":"Call parents on Sunday","priority":"high","tags":["Family","Personal"],"completedAt":"'||(now_ts-'1d'::interval)::timestamptz||'"}')::jsonb),
('task_p19','grp_personal','todo',uid,now_ts-'2d'::interval,now_ts,('{"title":"Write Q3 personal OKRs","priority":"high","dueDate":"'||(now_ts+'6d'::interval)::date||'","tags":["Planning","Goals"]}')::jsonb),
('task_p20','grp_personal','in-progress',uid,now_ts-'1d'::interval,now_ts,('{"title":"Online course: AWS Solutions Architect","priority":"medium","dueDate":"'||(now_ts+'45d'::interval)::date||'","tags":["Learning","Cloud","Career"]}')::jsonb),
('task_p21','grp_personal','todo',uid,now_ts,now_ts,('{"title":"Home internet upgrade research","priority":"low","dueDate":"'||(now_ts+'10d'::interval)::date||'","tags":["Home","Tech"]}')::jsonb),
('task_p22','grp_personal','todo',uid,now_ts-'1d'::interval,now_ts,('{"title":"Book flights for December vacation","priority":"medium","dueDate":"'||(now_ts+'25d'::interval)::date||'","tags":["Travel","Planning"]}')::jsonb),
('task_p23','grp_personal','done',uid,now_ts-'5d'::interval,now_ts,('{"title":"Donate old clothes to charity","priority":"low","tags":["Personal","Home"],"completedAt":"'||(now_ts-'2d'::interval)::timestamptz||'"}')::jsonb),
('task_p24','grp_personal','todo',uid,now_ts,now_ts,('{"title":"Research meditation apps","priority":"low","dueDate":"'||(now_ts+'8d'::interval)::date||'","tags":["Health","Wellness"]}')::jsonb),
('task_p25','grp_personal','review',uid,now_ts,now_ts,('{"title":"Personal website portfolio update","priority":"medium","dueDate":"'||(now_ts+'35d'::interval)::date||'","tags":["Personal Brand","Design"]}')::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- SAMPLE COMMENTS (on a few tasks)
-- ──────────────────────────────────────────────
INSERT INTO public.comments (id, task_id, owner_id, created_at, updated_at, data) VALUES
('cmt_01','task_e02',uid,now_ts-'2d'::interval,now_ts-'2d'::interval,'{"body":"JWT implementation looks good. Need to add token rotation on each refresh.","authorName":"You"}')::jsonb),
('cmt_02','task_e02',uid,now_ts-'1d'::interval,now_ts-'1d'::interval,'{"body":"Token rotation added. PR ready for review tomorrow.","authorName":"You"}')::jsonb),
('cmt_03','task_e06',uid,now_ts-'3d'::interval,now_ts-'3d'::interval,'{"body":"Stripe v3 migration guide: https://stripe.com/docs/upgrades","authorName":"You"}')::jsonb),
('cmt_04','task_m02',uid,now_ts-'1d'::interval,now_ts-'1d'::interval,'{"body":"Landing page copy approved by design. Moving to email sequence next.","authorName":"You"}')::jsonb),
('cmt_05','task_p13',uid,now_ts-'2d'::interval,now_ts-'2d'::interval,'{"body":"Decided to use Chart.js for visualizations. Lightweight and well-documented.","authorName":"You"}')::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- SAMPLE ACTIVITY
-- ──────────────────────────────────────────────
INSERT INTO public.activity (id, task_id, owner_id, created_at, updated_at, data) VALUES
('act_01','task_e03',uid,now_ts-'5d'::interval,now_ts-'5d'::interval,'{"action":"status_changed","actor":"You","from":"in-progress","to":"done","message":"Marked as done"}')::jsonb),
('act_02','task_e08',uid,now_ts-'8d'::interval,now_ts-'8d'::interval,'{"action":"status_changed","actor":"You","from":"todo","to":"done","message":"Security fix deployed to production"}')::jsonb),
('act_03','task_e02',uid,now_ts-'1d'::interval,now_ts-'1d'::interval,'{"action":"comment_added","actor":"You","message":"Added a comment"}')::jsonb),
('act_04','task_m03',uid,now_ts-'7d'::interval,now_ts-'7d'::interval,'{"action":"status_changed","actor":"You","from":"in-progress","to":"done","message":"Report delivered to leadership"}')::jsonb),
('act_05','task_e19',uid,now_ts-'1d'::interval,now_ts-'1d'::interval,'{"action":"status_changed","actor":"You","from":"in-progress","to":"review","message":"Moved to review"}')::jsonb)
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE 'Seed complete: 3 groups, 100 tasks, 5 comments, 5 activity records inserted for user %', uid;

END $$;
