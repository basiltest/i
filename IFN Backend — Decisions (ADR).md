---
title: IFN Backend — Decisions (ADR)
tags: [ifn, backend, adr, decisions]
---

# IFN Backend — Decisions (ADR)

Architecture decisions for the IFN PERN backend, captured during a grill-me session
(2026-06-06). Each: **Context → Decision → Consequences**. The product contract is
`~/lumenor/ifn/PRD.md` ([[IFN PRD]]).

See [[IFN Backend Index]] · [[IFN Backend — Architecture]] · [[IFN Backend — Data Model]] · [[IFN Backend — Sequence Flows]].

---

## ADR-001 — Stack: PERN modular monolith
**Context.** Frontend is Vite + React. We need a backend to replace the localStorage mock.
**Decision.** PostgreSQL + Express + React + Node, one deployable Express process split by domain
module. No microservices, no Next.js.
**Consequences.** Simple ops, shared transaction scope, fast iteration. Scaling is vertical first;
modules are seams for later extraction if ever needed.

## ADR-002 — Auth: passwordless magic-link
**Context.** PRD locks "email only, no password," `@ifheindia.org`, verify-before-login. The demo
auto-verifies and trusts any typed email — insecure for real use.
**Decision.** Passwordless magic-link: register → one-time hashed token "emailed" → verify → session.
Login mails a fresh link. Mailer is pluggable (console/Ethereal in dev, SMTP in prod).
**Consequences.** Real verification without passwords (PRD-faithful). Requires an outbound mail path
in prod. `magic_tokens` table with single-use + expiry.

## ADR-003 — Session: opaque DB-backed cookie (not JWT)
**Context.** One monolith + Postgres; need revocable sessions.
**Decision.** `sessions` table + opaque id in an httpOnly+Secure+SameSite cookie. Middleware looks up
the row per request.
**Consequences.** Instant revocation (logout/ban = DELETE), no refresh-rotation, no JWT secret. One
indexed SELECT per request — fine at this scale. JWT's stateless benefit is unused here.

## ADR-004 — Roles server-owned; admin inherits mentor
**Context.** Demo flips role client-side. PRD: student/mentor/admin, admin = Super Admin with mentor
powers, appears in the mentor dropdown, can self-assign.
**Decision.** Role stored on `users`, enforced by a guard. Client role-switch removed; only admin
changes roles via `PATCH /users/:id/role`. The guard treats admin as ≥ mentor.
**Consequences.** No privilege escalation from the client. Mentor-scoped checks (assigned mentor) are
explicit in the pipeline module.

## ADR-005 — Post schema: hybrid
**Context.** Frontend crams ideas/problems/announcements/drafts/autopsies + pipeline fields into one
array.
**Decision.** `posts`(common + `kind`) + 1:1 `ideas_pipeline` + child tables (comments, post_votes,
sub_threads, gate_transitions, attachments, post_tags; plus the dossier tables in ADR-017) + JSONB
for fixed forms (`basic_details`, `feasibility`, `mentor_criteria`, `autopsy`, `original`).
**Consequences.** Avoids a 30-column sparse table and avoids over-normalizing fixed forms. JSONB
fields are read whole, never queried piecewise. See [[IFN Backend — Data Model]].

## ADR-006 — Pipeline: strict gate state machine + audit
**Context.** PRD requires both "mentor advances G3→G6" and "admin overrides any gate anytime," plus a
server-enforced lock and IFN-n reuse on refine&retry.
**Decision.** One transition table defines legal moves per role; assigned-mentor checks; admin
override allowed with a required `reason`. Every change appends a `gate_transitions` row. Submit
returns 403 when `pipeline_settings.locked`. Refine keeps the same `ifn`.
**Consequences.** Illegal jumps blocked; full auditability; deterministic IFN numbering.

## ADR-007 — Attachments: local volume behind a Storage interface
**Context.** Demo stores doc/PDF as base64 in localStorage.
**Decision.** `multer` → Docker named volume; metadata in `attachments`; a `Storage` interface
abstracts read/write so S3 swaps in later. 10MB cap, extension allow-list (.pdf/.doc/.docx) +
magic-byte mime sniff (don't trust client mime).
**Consequences.** No extra infra for dev; clean migration path to object storage; safer uploads.

## ADR-008 — Remove the per-idea private conversation
**Context.** Demo has a private student↔mentor↔admin DM (`conversation`/`addMessage`) — the main
real-time driver.
**Decision.** Drop it. Keep public `comments`, `sub_threads` (progress updates), and
`mentor_feedback`.
**Consequences.** No `idea_conversation` table, no socket layer needed. Async mentor↔student happens
via sub-threads + feedback.

## ADR-009 — No real-time; plain REST
**Context.** PRD notification toggles are UI-only; no delivery specified.
**Decision.** REST only. Optional ~15s poll on the open idea-detail view. A `notifications` table can
be added later if real delivery is needed.
**Consequences.** Much less infra; no socket auth/scaling. Slightly stale views between polls.

## ADR-010 — Frontend: hard cut to the API
**Context.** `store.jsx` reads/writes localStorage.
**Decision.** `store.jsx` actions call `src/lib/api.js`; localStorage persistence removed (session
cookie only). `seed.js` becomes the DB seed + test fixtures, not a runtime fallback.
**Consequences.** Single source of truth; one data path to maintain. The app needs the API running.

## ADR-011 — Seed: env-split by NODE_ENV
**Context.** Demo data is single-user; PRD §6 pins demo counts.
**Decision.** Dev/staging seed = faithful port of `seed.js` (every member → a real passwordless
account; demo `'me'` → `basilambrosestevenson.bca24@ifheindia.org`). Prod seed = bootstrap only (one
admin + approved-tag baseline). Selected by `NODE_ENV`. Seed runs once on an empty DB; migrations run
every deploy.
**Consequences.** Realistic data to build against; clean prod start; no manual cleanup. Nothing is
"deleted" in prod — demo data is simply never inserted there.

## ADR-012 — Calendar: computed visibility + join tables
**Context.** Demo uses `audience` + a single global `removedEventIds`; PRD adds founder event
requests and per-user removal.
**Decision.** One `events` row per event; visibility derived at query time (`audience='all'` →
students; `'self'` → creator). `event_hidden(user,event)` for per-user removal. `event_requests`
admin queue → approve creates the event.
**Consequences.** No per-user event duplication; edits never fan out; removals are the only per-user
rows.

## ADR-013 — Talent Acquisition: real applications
**Context.** Demo "Apply" is a fake toast that stores nothing.
**Decision.** `team_applications(team_post_id, applicant_id, message, status, created_at)`; posters
can list applicants.
**Consequences.** Turns a stub into a working feature; one small table.

## ADR-014 — API conventions
**Context.** Need a consistent, evolvable HTTP surface.
**Decision.** REST under `/api/v1`; zod validates every request; one error envelope
`{error:{code,message,details}}`; helmet + cors (allow the web origin) + pino logging.
**Consequences.** Predictable client integration; versioned evolution; consistent error handling.

## ADR-015 — Testing: integration suite
**Context.** The risky logic is auth, the gate machine, masking, and approvals.
**Decision.** supertest integration tests on a disposable test DB covering: magic-link auth, full
G1→G6 progression + admin override, anonymous masking (admin sees identity), tag approval, and role
guards.
**Consequences.** Confidence in the dangerous paths; CI needs a throwaway Postgres.

## ADR-016 — Docker: 3 services
**Context.** Need a reproducible run.
**Decision.** `db` (postgres:16 + volume + healthcheck), `api` (node:20; entrypoint waits for db,
migrates, seeds, starts), `web` (nginx serving built React, proxying `/api`). `docker-compose.dev.yml`
override for hot-reload.
**Consequences.** `docker compose up` = seeded healthy stack; clear separation of web/api/db tiers.

## ADR-017 — Idea Dossier: full submission + per-stage deliverables
**Context.** Today Mentor Review shows only title/problem/solution + one attachment, and the Admin
Panel shows a line-clamped title. Rich fields the student already provides (`basicDetails`,
`targetUsers`, `solutionHypothesis`, `marketSize`, `team`, `testsDone`) never reach the reviewer, and
there are no per-stage deliverables. A mentor cannot mentor from a one-line description.
**Decision.** Every idea is an accumulating **dossier**, fetched via `GET /api/v1/ideas/:id/dossier`,
visible **only to the author, the assigned mentor, and admin**. Each gate has a deliverable template
(hybrid: fixed fields + files + optional mentor/admin extra asks — see ADR-001 grill / Q1). The
student submits each stage's deliverables (`idea_submissions` + `attachments` tagged by gate/slot);
the assigned mentor reviews each stage (`idea_reviews` — 7-criteria rubric + feasibility
confirm/override + feedback + approve|revision); approval advances the gate. `idea_extra_asks`
generalizes the old `actionable_steps`. The public Feed still shows only the post overview.
**Consequences.** Reviewers see the complete case file and full G1→G6 history, not a blurb. New tables
`idea_submissions`, `idea_reviews` (review history, not in-place overwrite), `idea_extra_asks`;
`attachments` gains `submission_id`/`gate`/`slot_key`. New endpoints
`GET /ideas/:id/dossier`, `POST /ideas/:id/stages/:gate/submit`,
`POST /ideas/:id/stages/:gate/review`, `POST /ideas/:id/extra-asks`. Frontend: `MentorReview` and
`AdminPanel` render a new `IdeaDossier` component instead of a description. Supersedes the thin review
described in PRD §4.7 / §4.8.

---

Related: [[IFN Backend — Architecture]] · [[IFN Backend — Data Model]] · [[IFN Backend — Sequence Flows]] · [[IFN PRD]]
