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

### Stage 1 plan
- 1a concept: auth.users (managed) vs public.profiles (your fields), 1:1 by id — DONE explaining
- 1b design public.profiles columns — user designing
- 1c trigger handle_new_user → insert profiles from signUp metadata
- 1d RLS on profiles (read/edit own; admin read all)
- 1e register form + signUp({email,password,options:{data:{...}}})
- 1f @ifheindia.org enforcement (before-user-created auth hook, or trigger guard)
- 1g email-confirm flow + what the user sees

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
