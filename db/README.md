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
- [ ] `is_admin()` security-definer helper + admin policies (pin, gate override, moderate) without RLS recursion.
- [ ] CHECK length constraints on profiles/posts text columns (server-side cap matching the UI maxLength).
- [ ] Pipeline tables (later): `ideas_pipeline`, `pipeline_settings`, `gate_transitions`, `idea_submissions`, `idea_reviews`, `idea_extra_asks`, `attachments`.
- [ ] When moving off Supabase: these SQL files become the migration set; replace `auth.uid()`/RLS as needed (self-host GoTrue or own auth).
