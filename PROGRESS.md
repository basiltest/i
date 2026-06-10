# IFN — Progress / Session Context

> Read this first in a new session to know where we are. Update it as work happens.
> Design lives in `architecture.md`; deep reference in `reference/`.

## Right now
**Building:** the auth feature (register + login + forgot-password) for IFN.
**Mode:** mentor — the user writes the code; Claude directs + reviews. Do **not** write app code for them.
**Stack:** Vite SPA on Vercel ↔ Supabase (Auth + Postgres + RLS). No backend. (see architecture.md)

## Current state (2026-06-10)
**Auth module complete + audited; Profile and Settings built.** Repo: github.com/basiltest/i
(monorepo, app in web/, deployed on Vercel at ifn-gilt.vercel.app; Supabase project ref
uyepkmdpakwkpqxsofoi).

Done:
- Stage 1 register (minimal: name/email/password; trigger creates profiles row, role=student).
- Stage 2 login + session (AuthProvider) + ProtectedRoute + PublicOnlyRoute + redirect to /.
- Stage 3 forgot/reset password.
- Removed @ifheindia.org check entirely (re-add server-side later if wanted).
- Audit: auth-architecture.md (PlantUML + findings). Fixed E1 (try/catch all auth calls), V1
  (email validate), E4 (public-only guard), S1 (CSP + security headers in web/vercel.json).
  Deferred: S8 (rate limit, leaving Supabase), S3 (re-auth on pw change), S4 (pw min len in Supabase).
- Profile page (/profile): read/edit own profiles row via RLS; email+role read-only.
- Settings page (/settings): account, dark-mode toggle (persisted, applied in main.jsx), log out.
- Logo: inline via svgr (src/assets/icfai-founders.svg), currentColor so it works in dark mode.
- App shell: Layout (Outlet) + Topbar (notifications + profile dropdown) + SideNav (left rail).
  Shared: RoleBadge, lib/options.js, lib/format.js.
- App shell: Layout + Topbar (notifications stub + profile dropdown) + SideNav (left rail, items:
  Feed live, others "soon") + RightSidebar (feed-only: Trending real, Events stub).
- FEED is fully built to the FRD (db/*.sql + pages/Feed.jsx + components/PostCard, PostCardSkeleton,
  CreatePostModal): sorts hot(momentum, default)/new/top/by-supertag with id tiebreak; full-text
  search (tsvector+GIN); supertag filter dropdown + #-suggestions (tags-with-posts only, URL ?tag);
  upvote/downvote (optimistic, post_votes); trending tags; "X new posts, tap to refresh" banner
  (posts_since poll); error+retry; pagination (Load more); drafts (status='draft'); supertags
  (create_post RPC, new tags -> pending tag_requests).
- POST DETAIL (/post/:id, pages/PostDetail.jsx): full post + votes, creator updates (sub_threads,
  author-only add), comments (anyone add, delete own), delete own post (cascades). Title + comments
  button on cards link here.
- DB files in db/ (apply via Supabase SQL editor): posts.sql, votes.sql, tags.sql, feed.sql,
  comments.sql. db/README.md = live schema + TODO. profiles table+trigger+RLS still only in Supabase
  (db/profiles.sql backfill = TODO).

## Pending on the user (Supabase + push)
- Ensure all db/*.sql have been run in Supabase (latest: re-run feed.sql for momentum sort +
  feed_tags + posts_since + comment_count).
- git push the latest commits.

- ADMIN PANEL (/admin, pages/AdminPanel.jsx + db/admin.sql): admin-only nav item (Shield);
  Members tab (list via admin_members RPC incl. email, assign Student/Mentor/Super Admin,
  never own role); #Success requests tab (approve -> badge, reject). Post kebab gains
  Pin/Unpin + Delete (admin) and Request #Success (author); admins can delete any comment.
  Pinned + #Success chips on cards/detail. Regular supertags auto-approve (user decision);
  ONLY #Success needs approval; 'success' reserved as a tag name. Bootstrap first admin:
  db/admin.sql one-liner (college email). AuthProvider now exposes profile + isAdmin.
- DRAFTS live inside the create modal (Drafts (n) -> list -> load -> Save draft/Publish;
  publish_post RPC resets created_at). Feed: compact clamped cards, infinite scroll,
  back-to-top, poll pauses when hidden/failing.

## Next (not built)
- #IdeaValidation self-badge + Idea Autopsy (FRD D4/W13/W15).
- Edit-post UI shows original-vs-edited diff (snapshot already stored in posts.original).
- Report/flag posts -> admin queue (moderation, v1 Scope rule for anonymous posting).
- Pipeline. Calendar/events (admin create + requests). Directory. Team Board.
- @mentions + notifications table (ADR-020).

Next options: feed/posts, idea pipeline, directory, onboarding "complete profile" prompt, or the
@ifheindia.org server enforcement.

DB note: profiles table + handle_new_user trigger (security definer) + RLS (read/update own; role
column update revoked) live in Supabase (not in repo). Run via SQL editor when recreating.

---

## History
**Stage 3 — Forgot password** (built, pending test + push).

### Stage 3 built
- pages/ForgotPassword.jsx: resetPasswordForEmail(email, redirectTo /reset-password); generic
  "if an account exists, link sent" (no enumeration).
- pages/ResetPassword.jsx: the reset link creates a recovery session; updateUser({password}) sets
  new pw; guards: no session -> invalid/expired link; success -> Continue to /.
- Login.jsx: "Forgot password?" link -> /forgot-password. Routes added in App.jsx.
- NEEDS redirect URL allowlist: add /reset-password (vercel + localhost) in Supabase.

---

## Earlier stage
**Stage 2 — Login + session + guarded redirect**.

### Stage 2 built
- react-router-dom added. BrowserRouter + AuthProvider wrap the app (main.jsx).
- Routes (App.jsx): /register, /login, / (guarded). web/vercel.json adds SPA fallback so deep
  links and the email redirect do not 404 on Vercel.
- lib/AuthProvider.jsx: session context via getSession + onAuthStateChange (live across reloads).
- components/ProtectedRoute.jsx: no session -> Navigate to /login; waits on loading to avoid flash.
- pages/Login.jsx: signInWithPassword -> navigate('/'); generic error.
- pages/Home.jsx: blank authed page + email + logout (signOut) to test the cycle.
- Register "Log in" link now uses <Link>. Session is localStorage JWT (httpOnly still deferred).
- TODO: test locally (register/confirm/login/guard/logout), then commit + push.

---

## Earlier stage
**Stage 1 — Register + profiles table + signup trigger**.

### Stage 0 — walking skeleton ✅ DONE
- Supabase project `ifn` created (project ref uyepkmdpakwkpqxsofoi), Email provider + confirm on.
- Vite app in `web/`, deployed on Vercel, env vars set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- `web/src/lib/supabase.js` singleton client; `getSession()` → `session:null, error:null` confirmed.

### Stage 1 approach LOCKED: hybrid
Minimal signup (name+email+password). role auto='student' (NOT user-settable). region/sector/domain/etc
nullable, filled later via edit-profile (onboarding). Lower friction (adoption). Trigger creates the row.

### Stage 1 plan/status
- 1a concept: auth.users (managed) vs public.profiles (1:1 by id) -> DONE
- 1b/1c/1d SQL: profiles table + handle_new_user trigger (security definer) + RLS (read/update own,
  revoke update on role/id/created_at to block self-escalation). SQL written/given. STATUS: user to
  RUN + confirm in Supabase SQL editor (signup will not create a profile until this is run).
- 1e register form: DONE. web/src/pages/Register.jsx. Minimal signup (name+email+password),
  supabase.auth.signUp with name in options.data, emailRedirectTo /login, check-your-email success
  state, client validation (name, @ifheindia.org, pw>=8). role defaults student (admin promotes mentors).
- Logo: public/icfai-founders.svg (official ICFAI vector wordmark + red bar, GROUP swapped to
  FOUNDERS NETWORK), used as <img h-12> in Register. Tailwind v3 + oldcode theme tokens in place.
- NO em-dashes anywhere (user rule, saved to memory).
- 1f @ifheindia.org server enforcement (auth hook / trigger guard) -> TODO
- 1g end-to-end test: register -> confirm email -> profiles row appears with role=student -> TODO

### Two reminders the user must do (cannot be done from here)
1. Vercel env vars VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set + redeploy.
2. Supabase Auth -> URL Configuration -> Redirect URLs: add the Vercel URL + /login (and
   http://localhost:5173/login) so the email confirm link works.

## Next stages
1. Register form fields + `public.profiles` table + signup trigger + `@ifheindia.org` rule.
2. Login + redirect to blank authed route + route guard.
3. Forgot password.
4. RLS on every table; role policies (student/mentor/admin).
5. Prod hardening (Supabase Pro at launch, backups, push-to-deploy already via Vercel).

## Locked decisions
- Supabase Auth (managed), email+password, `@ifheindia.org` only.
- Session = localStorage JWT (httpOnly deferred — needs Next.js SSR).
- anon key public (RLS protects); service_role never shipped.

## Open questions / watch
- httpOnly cookie: revisit only if XSS risk becomes unacceptable → Next.js + `@supabase/ssr`.
- Complex pipeline/gate logic later may need a real backend tier (service_role server-side).
- File uploads (attachments) later: Supabase Storage or Cloudflare R2.

## Pivots history (so context isn't lost)
magic-link (reference design) → password → Supabase Auth → Vercel+Supabase-direct (no Express).
