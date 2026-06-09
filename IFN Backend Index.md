---
title: IFN Backend Index
tags: [ifn, backend, index]
---

# IFN Backend — Documentation Index

Architecture + design docs for the planned **PERN** backend (PostgreSQL · Express · React · Node, modular monolith, Docker) of the **ICFAI Founders Network**. Current app is a frontend-only MVP (`~/lumenor/ifn`, Vite + React, localStorage); these notes specify the backend that replaces the mock data layer.

## Notes

- [[IFN Backend — Architecture]] — system overview, component (C4) + deployment PlantUML, modules, request lifecycle
- [[IFN Backend — Data Model]] — Postgres schema, ER diagram, table-by-table columns
- [[IFN Backend — Sequence Flows]] — PlantUML sequence diagrams for auth, posts, pipeline gates, approvals, calendar, apply
- [[IFN Backend — Decisions (ADR)]] — locked architecture decisions with context + consequences
- [[IFN — Workflows]] — every user workflow (W1–W39) + PlantUML, mapped to the Playwright E2E suite
- [[IFN PRD]] — verbatim copy of the decision-locked product spec

## Quick reference — locked decisions

| Area | Decision |
|---|---|
| Auth | Passwordless magic-link (console/Ethereal dev → SMTP prod); no passwords |
| Session | Opaque DB session cookie (`sessions`), httpOnly+Secure+SameSite; not JWT |
| Posts | Hybrid: `posts` + `ideas_pipeline` + child tables + JSONB forms |
| Pipeline | Strict gate state machine + `gate_transitions` audit; admin override w/ reason; refine keeps IFN-n |
| Attachments | Local volume + DB metadata behind `Storage` iface; 10MB, mime-sniffed |
| Real-time | None (plain REST); per-idea private conversation removed |
| Frontend | Hard cut: `store.jsx` → `src/lib/api.js`, drop localStorage |
| Seed | Env-split: dev = full demo port; prod = admin + tags |
| Calendar | Computed visibility + `event_hidden` + `event_requests` |
| Apply | Real `team_applications` |
| API | `/api/v1`, zod, `{error:{code,message,details}}`, helmet/cors/pino |
| Docker | 3 services: db · api · web(nginx) |

> Source of truth for features: `~/lumenor/ifn/PRD.md`. Source code: `~/lumenor/ifn`.
