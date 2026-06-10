# IFN Database Architecture (Supabase)

Live schema for the current build. Postgres on Supabase, with Supabase Auth (GoTrue) and Row
Level Security. The Vite SPA talks to the database directly with the anon key; RLS is what keeps
data safe. SQL files in this folder are the version-controlled record (applied by hand in the
Supabase SQL editor for now).

Reference design (older, Express + magic-link) lives in `../reference/IFN Backend — Data Model.md`.
Where it conflicts with this file, this file is current.

## Security model (applies to every table)
- **anon key** is public (shipped in the frontend); safe only because RLS guards every row.
- **service_role key** bypasses RLS; server-only, never shipped to the client.
- **RLS on every table**, default-deny, with explicit policies.
- Triggers that write on a user's behalf use `security definer` + `set search_path = public`.
- Privilege columns (role, pinned, badges, success_request) are revoked from `authenticated` so
  users cannot self-escalate or self-award. Never read role from `user_metadata`.

## Tables

### auth.users (managed by Supabase)
Identity: `id`, `email`, `encrypted_password` (bcrypt), confirmation state. Not directly editable.

### public.profiles
1:1 with `auth.users` (same `id`). Created by a trigger on signup.
- Columns: `id` (PK, FK auth.users, cascade), `name`, `role` (default `student`, check
  student|mentor|admin), `region`, `sector`, `domain`, `incubation_interest` (bool),
  `linkedin`, `phone`, `bio`, `startup`, `created_at`.
- Trigger `handle_new_user` (security definer): inserts the profiles row from signup metadata.
- RLS: read own, update own. `revoke update (role, id, created_at)` so role cannot be self-changed.
- Note: not yet captured as a SQL file here (see TODO).

### public.posts  (db/posts.sql)
Unified feed (ideas + problems).
- Columns: `id`, `author_id` (FK profiles, cascade), `kind` (idea|problem), `anonymous`, `startup`,
  `title`, `problem`, `solution`, `status` (draft|published), `pinned`, `badges[]`,
  `success_request` (none|pending|approved|rejected), `edited`, `edited_at`, `original` jsonb,
  `created_at`. Indexed on (kind,status,created_at), author, pinned.
- RLS: read published or own drafts; insert/update/delete own.
- Revokes: insert (pinned, badges, success_request); update (pinned, badges, success_request,
  author_id, kind, created_at).

## TODO (database work)
- [ ] Backfill `db/profiles.sql` (profiles table + `handle_new_user` trigger + RLS) so it is tracked, not just in Supabase.
- [ ] `feed_posts` RPC (security definer): join author name/role and mask anonymous authors (admins see real identity). Keeps profiles RLS strict.
- [ ] `post_votes` (per-user -1/1, composite PK, score = sum) + RLS (one vote per user per post).
- [x] `comments` + `sub_threads` + RLS + post_detail/post_comments/post_subthreads RPCs (db/comments.sql). Comments by anyone; sub_threads (updates) only by the post author; delete own; post delete cascades.
- [x] `post_votes` + RLS (db/votes.sql); feed_posts returns score + viewer vote; trending_tags RPC.
- [x] `tags` + `post_tags` + `tag_requests` + RLS + `create_post` + `update_post` RPCs (db/tags.sql). New tags auto-approved for now (moderation moves to the admin layer). Drafts = posts.status='draft'. `update_post` edits own post (snapshots first version into posts.original, marks edited, resets tags). Admin approval queue + #Success still TODO.
- [x] `feed_posts` RPC (db/feed.sql): full-text search (`p_search`) + multi-supertag AND filter (`p_tags text[]`) + sorts hot/new/top + comment_count + score + viewer vote; masks anonymous authors. `feed_tags`, `trending_tags`, `posts_since` helpers.
- [ ] `notifications` table (ADR-020) + RLS (read own); inline writes on key events.
- [ ] `reports` table (moderation) + RLS; admin resolve/hide.
- [x] Admin layer (db/admin.sql): `is_admin()` definer helper; all admin ops via guarded RPCs (no extra RLS): `admin_members` (joins auth.users for email), `admin_set_role` (student/mentor/admin, never own), `admin_pin_post`, `admin_delete_post`, `admin_delete_comment`; #Success flow: `request_success` (author) -> `admin_success_queue` -> `admin_review_success` (approve adds 'Success' to posts.badges). 'success' is a reserved tag name. Bootstrap admin = college email (update profiles via auth.users lookup).
- [x] Admin settings (db/admin.sql): `app_settings` single-row table (`feed_locked`) + `admin_set_feed_locked` (create_post rejects non-admins when locked); per-post `posts.comments_locked` (revoked from authenticated) + `admin_set_comments_locked`; comments insert RLS blocks when the post is locked; post_detail returns comments_locked.
- [x] Admin member management (db/admin.sql): `admin_get_profile` + `admin_update_profile` (edit any member's profile); ban = `profiles.banned` (revoked from authenticated) + `banned_emails` table + `block_banned_signup` trigger on auth.users (blocks re-registration); `admin_ban_user`/`admin_unban_user` (cannot self-ban); banned blocks writes (create_post, comments insert RLS, team_apply, team_posts insert) + a logout wall in ProtectedRoute. admin_members returns banned.
- [x] Directory / Network (db/directory.sql, FRD Module K): `directory(p_search, p_region, p_sector, p_domain, p_role)` security-definer RPC returns public profile fields (never email), hides banned members, ILIKE search on name/startup. Frontend pages/Directory.jsx: search + Role/Region/Sector/Domain filter dropdowns, member cards (avatar, role badge, startup, region/sector/domain chips, LinkedIn + phone contact).
- [x] Calendar & Events (db/calendar.sql, FRD Module I): `events` table (type Workshop/Mentorship/Deadline/Hackathon/Other, starts_at/ends_at, `source` for future pipeline-populated events) + RLS read-all; admin RPCs `admin_create_event`/`admin_update_event`/`admin_delete_event`. Frontend: month-grid Calendar page, per-event Add-to-Google link + .ics download (Option 1, no OAuth), Upcoming Events in the feed right sidebar, nearby events (next 7 days) in the notification bell. Pipeline-populated events deferred until the pipeline exists.
- [x] Team Acquisition (db/teamboard.sql): `team_posts` + `team_applications` (unique per person) + RLS; `team_feed` (author + app_count + i_applied + is_mine), `team_apply` (no own-post/dup, message required), `team_applicants` (post author/admin only; profile + LinkedIn, never email), `admin_delete_team_post`.
- [ ] CHECK length constraints on profiles/posts text columns (server-side cap matching the UI maxLength).
- [ ] Pipeline tables (later): `ideas_pipeline`, `pipeline_settings`, `gate_transitions`, `idea_submissions`, `idea_reviews`, `idea_extra_asks`, `attachments`.
- [ ] When moving off Supabase: these SQL files become the migration set; replace `auth.uid()`/RLS as needed (self-host GoTrue or own auth).
