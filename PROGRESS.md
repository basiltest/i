# IFN — Progress / Session Context

> Read this first in a new session to know where we are. Update it as work happens.
> Design lives in `architecture.md`; deep reference in `reference/`.

## Right now
**Building:** the auth feature (register + login + forgot-password) for IFN.
**Mode:** mentor — the user writes the code; Claude directs + reviews. Do **not** write app code for them.
**Stack:** Vite SPA on Vercel ↔ Supabase (Auth + Postgres + RLS). No backend. (see architecture.md)

## Current stage
**Stage 0 — walking skeleton** (prove SPA → Supabase reachable).
- Step 1: create Supabase project + keys — ⏳ user doing
- Step 2: deploy Vite SPA on Vercel (auto-deploy) — ⏳
- Step 3: set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` env vars — ⏳
- Step 4: one supabase-js client module — pending
- Step 5: `getSession()` returns `session:null` cleanly = pipe proven — pending

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
