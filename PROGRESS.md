# IFN — Progress / Session Context

> Read this first in a new session to know where we are. Update it as work happens.
> Design lives in `architecture.md`; deep reference in `reference/`.

## Right now
**Building:** the auth feature (register + login + forgot-password) for IFN.
**Mode:** mentor — the user writes the code; Claude directs + reviews. Do **not** write app code for them.
**Stack:** Vite SPA on Vercel ↔ Supabase (Auth + Postgres + RLS). No backend. (see architecture.md)

## Current stage
**Stage 1 — Register + profiles table + signup trigger** (IN PROGRESS).

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
