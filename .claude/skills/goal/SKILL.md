---
name: goal
description: Check the Idea Pipeline (design or implementation) against its acceptance metrics M1–M7 and iterate until every metric passes. Use when designing, reviewing, or implementing the pipeline, or whenever the user invokes /goal.
---

# Pipeline goal check

Verify the Idea Pipeline against the acceptance metrics in `pipeline-architecture.md` §11
(M1–M9). Loop until satisfied: evaluate → list failures → fix → re-evaluate. Do not stop at the
first pass; stop only when every metric is green or a failure needs a user decision.

When live verification is possible, prefer it over code reading: `web/scripts/e2e-pipeline.mjs`
walks both roles through the whole pipeline against the real database (creates and withdraws
its own test rows), and `web/scripts/e2e-visual.mjs` screenshots every surface with Playwright.
Both need SUPA_URL / SUPA_KEY / STUDENT_EMAIL / MENTOR_EMAIL / PASSWORD env vars. A failure
that says "re-run db/pipeline.sql" is a pending migration, not a code bug - tell the user.

## Target selection

- If `db/pipeline.sql` exists, the **implementation** is the target: check the SQL (tables, RLS,
  RPC guards, storage policies) and the UI (`web/src/pages/` pipeline/mentor/admin surfaces)
  against each metric.
- Otherwise the **design** is the target: check `pipeline-architecture.md` itself for gaps,
  contradictions, and unhandled states.

## The loop

1. Read `pipeline-architecture.md` (§11 is the contract; §0–§10 the spec).
2. For each metric M1–M7, run its concrete checks against the target. Be adversarial: hunt for
   the field that gets lost, the state with no owner, the endpoint a non-admin can reach, the
   admin task that is O(n) in applications, the file a stranger can sign a URL for, the gate
   that advances on prose alone, the SQL that breaks a `db/` convention.
3. Additionally probe these standing traps:
   - a state where `waiting_on` is ambiguous or nobody is notified
   - data entered at one gate invisible after a revision, reassignment, or reject→refine cycle
   - an RPC that trusts client input for role, ownership, gate, or IFN
   - admin override paths that skip the audit log or allow an empty reason
   - banned/locked checks missing from any student write
   - storage paths that don't bind to idea ownership
   - an application field whose minimum-substance rule is enforced only client-side (a curl
     call must not be able to file a lazier application than the form allows)
   - an application question a mentor would still have to ask as a follow-up ("so who is this
     for?", "what exists today?", "what have you done?") — G1 must pre-answer the first
     five mentor questions
   - effort lost to accident: a long form with no draft persistence, or autosave that leaks
     a draft between accounts
4. Record a verdict per metric: PASS / FAIL (with the exact gap) / DEFERRED (consciously cut,
   must be documented in §0 or §7).
5. If anything FAILS: fix the design doc or the code, note the fix, go to 2.
6. Stop when all metrics are PASS or DEFERRED-with-documentation. If a fix requires a product
   decision (e.g., PRD v3 vs v1 Scope conflict), stop and ask instead of guessing.

## Output

After the final pass, print a scorecard:

| Metric | Verdict | Evidence / gap |
|---|---|---|

…one row per M1–M7, plus: passes run, fixes applied this run, and any DEFERRED items with where
they are documented. If the target was the implementation, also list which RPCs/policies were
inspected so the check is reproducible.
