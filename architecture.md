# IFN — Architecture (living design)

> Single design doc for what we're **building now**. Grows as we go. The deep reference
> material (data model, ADRs, PRD, sequence flows, etc.) lives in `reference/`.
> Day-to-day state + next steps live in `PROGRESS.md`.

## What IFN is
Tech-incubator network for ICFAI students: share startup ideas, get mentored through a gated
pipeline (G1→G6), connect with mentors/alumni/teammates. See `reference/IFN PRD.md`.

## Locked stack (2026-06-10)
- **Frontend:** Vite + React SPA, hosted on **Vercel**.
- **Backend + Database:** **Supabase** — Auth + Postgres + Row Level Security (RLS). **No separate
  Express/Render backend.** The SPA talks directly to Supabase via `@supabase/supabase-js`.
- **Auth:** Supabase Auth (managed), **email + password**, restricted to `@ifheindia.org`.
- **Session:** Supabase default for a Vite SPA = **JWT in localStorage** (not a server httpOnly
  cookie). httpOnly would require a server runtime (Next.js + `@supabase/ssr`) — deferred.
- **Why no backend yet:** removes CORS, cross-site cookies, and a whole tier. RLS is the data
  guard. A backend tier can be added later for complex server logic (the gate/pipeline machine).

## Security model (the rules that keep the DB safe)
- **anon key** — public, ships in the frontend. Safe **only because RLS guards every row**.
- **service_role key** — SECRET, bypasses RLS (god mode). Server-only; in this stack we don't ship
  it anywhere. Never in frontend, never in git.
- **RLS** — OFF by default on new tables. **Enable on every table, default-deny**, then add
  explicit policies keyed to `auth.uid()` (+ role). No RLS = public table.

## Auth feature design (in progress)
- **Register:** Supabase `signUp()` with extra profile fields; `@ifheindia.org` enforced via an
  auth hook / DB trigger; email confirmation on.
- **Profiles:** `auth.users` is managed by Supabase. A `public.profiles` table (1:1, FK to
  `auth.users.id`) holds IFN fields (role, region, sector, domain, …), filled by a trigger on signup.
- **Login:** `signInWithPassword()` → session in localStorage → redirect to a blank authed route
  (guarded: no session → bounce to login).
- **Forgot password:** `resetPasswordForEmail()` → email link → `updateUser({password})`. Generic
  "if the account exists, we sent a link" (no enumeration).

## Reference (deeper, pre-build design)
In `reference/`: Architecture · Data Model · Decisions (ADR) · Authorization Matrix · Sequence
Flows · Security & Threats · Runbook · Backup & Restore · v1 Scope · Workflows · PRD · Index.
Note: that reference set assumed an Express+Postgres backend with **passwordless magic-link** auth.
This build **pivoted** to Supabase Auth + password (see decision log). Treat `reference/` as design
input, not the current truth where it conflicts with this file.

## Decision log (append as we go)
- 2026-06-10 — Auth method: **magic-link → password** (user choice). Adds reset-token + brute-force
  surface; building it via Supabase Auth.
- 2026-06-10 — Provider: **Supabase Auth** (managed) over hand-rolled, for speed + managed security.
- 2026-06-10 — Topology: **Vercel SPA ↔ Supabase direct**, no Express. Session = localStorage JWT.
- 2026-06-10 — httpOnly cookie requirement **relaxed** for this stack (would need Next.js SSR).
