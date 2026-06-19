-- ============================================================================
-- db/security_hardening.sql  —  applied LAST (see selfhost/apply-schema.sh ORDER)
--
-- Closes authorization holes found in the 2026-06-20 security audit
-- (reviews/SECURITY-AUDIT.md). Every statement is idempotent and depends only
-- on objects defined in earlier files (profiles.role, profiles.member_type,
-- public.can_write, public.is_admin), so it is safe to re-run.
--
-- Apply to an existing database immediately with:
--   psql "$DATABASE_URL" -f db/security_hardening.sql
-- Supabase Cloud: paste this file into the SQL editor and run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- [CRITICAL] Privilege escalation via profiles.role / profiles.member_type.
--
-- profiles.sql does `grant all on table public.profiles to authenticated`, which
-- includes column-level UPDATE on every column. The header comment claims the
-- privilege columns are "revoked in the later files that introduce them" — but
-- for `role` and `member_type` that revoke was never written (only banned,
-- restricted, restricted_reason and directory_pinned are revoked anywhere).
-- The "update own profile" policy has no column list and no WITH CHECK, and the
-- role CHECK permits 'admin'. So any authenticated, non-banned member could run,
-- directly against PostgREST with the public anon key:
--     update public.profiles set role = 'admin' where id = auth.uid();
-- is_admin() reads profiles.role, so this is instant Super Admin = full
-- compromise of the authorization model.
--
-- Legit role/member_type writes all go through SECURITY DEFINER functions
-- (admin_set_role, consume_invite, admin_update_profile) or the create-member
-- edge function (service role) — all of which bypass column GRANTs — so revoking
-- the columns from `authenticated` breaks no legitimate flow. Verified: no
-- client-side direct update touches a privileged column (Onboarding.jsx,
-- Profile.jsx and Settings.jsx only write the 14 columns granted below).
--
-- PostgreSQL GOTCHA (the reason a naive `revoke update (role)` does NOT work):
-- profiles.sql does `grant all on table profiles to anon, authenticated`, which
-- grants TABLE-level UPDATE. A column-level `revoke update (role)` CANNOT override
-- a table-level grant — has_column_privilege('authenticated','profiles.role',
-- 'UPDATE') stays TRUE. (This same gotcha silently defeated the existing
-- banned / restricted / directory_pinned column revokes too.) The ONLY correct
-- fix is to drop the table-level UPDATE and re-grant UPDATE on the safe,
-- user-editable columns only. Privileged columns (role, member_type, banned,
-- restricted, restricted_reason, directory_pinned, id, created_at) are then
-- unwritable by any client; admin / SECURITY DEFINER paths bypass column grants.
revoke update on public.profiles from anon, authenticated;
grant update (
  name, region, sector, domain, incubation_interest, linkedin, phone, bio,
  startup, show_email, directory_visible, onboarded, notification_prefs, contactable
) on public.profiles to authenticated;

-- Defense-in-depth: re-assert that a member can only write their OWN row on
-- UPDATE (USING already enforces it; WITH CHECK stops any future column-grant
-- slip from being combined with a row swap). Mirrors readonly.sql's policy and
-- keeps the can_write() read-only guard.
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id and public.can_write(auth.uid()))
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- [HIGH] Banned / read-only (restricted) users could still create and edit
-- their own posts via direct PostgREST calls. The posts insert/update policies
-- checked only `author_id = auth.uid()` and skipped public.can_write() — unlike
-- post_votes, comments, tags, team_apply, etc. The composer UI is hidden for
-- these users, but RLS (the only server-side guard) did not stop them. Re-add
-- the can_write() guard, matching the rest of the schema.
drop policy if exists "posts insert own" on public.posts;
create policy "posts insert own" on public.posts
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_write(auth.uid()));

drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.can_write(auth.uid()));
-- DELETE is intentionally left author-only: removing your own content is allowed
-- even in read-only mode. The existing column REVOKEs on posts (pinned, badges,
-- success_request, comments_locked, ...) are unaffected by these policy rewrites.

-- ---------------------------------------------------------------------------
-- [HIGH — MANUAL, NOT APPLIED HERE] idea_autopsies has NO schema/RLS tracked in
-- this repo (the table was created in the Supabase dashboard). AdminPanel.jsx
-- and AutopsyLibrary.jsx perform approve / reject / delete as DIRECT client
-- table writes (supabase.from('idea_autopsies').update/delete). If the live
-- table's RLS is missing or permissive, any member can self-approve their own
-- case study (publish without admin review) or delete others'.
--
-- ACTION: inspect the live table and lock it down. In psql:
--     \d  public.idea_autopsies      -- column names
--     \dp public.idea_autopsies      -- current grants/policies
-- Then RECONCILE the column names below against the real table and run them.
-- Left commented so this file stays apply-safe against the (untracked) schema:
--
-- alter table public.idea_autopsies enable row level security;
-- revoke update (status, rejection_reason) on public.idea_autopsies from authenticated;
--
-- drop policy if exists "autopsies read approved or own" on public.idea_autopsies;
-- create policy "autopsies read approved or own" on public.idea_autopsies
--   for select to authenticated
--   using (status = 'approved' or author_id = auth.uid() or public.is_admin());
--
-- drop policy if exists "autopsies insert own pending" on public.idea_autopsies;
-- create policy "autopsies insert own pending" on public.idea_autopsies
--   for insert to authenticated
--   with check (author_id = auth.uid() and status = 'pending' and public.can_write(auth.uid()));
--
-- drop policy if exists "autopsies delete own or admin" on public.idea_autopsies;
-- create policy "autopsies delete own or admin" on public.idea_autopsies
--   for delete to authenticated
--   using (author_id = auth.uid() or public.is_admin());
--
-- -- Status transitions (approve/reject) must be admin-only. Either keep the
-- -- column revoked and move AdminPanel's approve/reject to a SECURITY DEFINER
-- -- RPC (admin_review_autopsy), or add an UPDATE policy gated on public.is_admin().
