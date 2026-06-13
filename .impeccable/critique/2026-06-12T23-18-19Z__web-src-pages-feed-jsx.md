---
target: feed
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-06-12T23-18-19Z
slug: web-src-pages-feed-jsx
---
## Critique: Feed (web/src/pages/Feed.jsx + PostCard, CreatePostModal, RightSidebar, skeletons)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Strong (skeletons, busy labels, new-posts banner); vote failures revert silently |
| 2 | Match System / Real World | 3 | "Supertags" is invented jargon for plain tags |
| 3 | User Control and Freedom | 2 | No Esc dismiss on any modal; backdrop click discards typed content |
| 4 | Consistency and Standards | 3 | Leftover pill grammar in composer; one missed old warn hex in postKind.js |
| 5 | Error Prevention | 2 | Composer loses work on accidental backdrop click, no dirty-state guard |
| 6 | Recognition Rather Than Recall | 3 | Tag autocomplete + visible labels; #tag search syntax must be learned |
| 7 | Flexibility and Efficiency | 2 | Zero keyboard shortcuts; JS-only card navigation (no middle-click/new tab) |
| 8 | Aesthetic and Minimalist Design | 3 | Post-redesign chrome is quiet and coherent |
| 9 | Error Recovery | 2 | Blanket "Something went wrong. Please try again." everywhere |
| 10 | Help and Documentation | 1 | Nothing beyond placeholders; no contextual help anywhere |
| Total | | 24/40 | Acceptable |

### Anti-Patterns Verdict
LLM: no longer reads AI-generated; faint tells remain (letter avatars, lucide defaults, icon-heading sidebar pattern, stock empty-state copy). Deterministic scan: 0 findings on all 5 feed files. Browser overlays: not run (no browser automation available; source-only review).

### Priority Issues
- [P1] Composer discards work on backdrop click. No dirty-check/auto-draft. Fix: dirty-check on close (confirm or silent draft-save). Command: harden.
- [P1] Modals keyboard-hostile: no Esc, no focus trap, focus not returned; custom divs not <dialog>. Breaks WCAG AA commitment. Command: harden.
- [P2] Generic error copy everywhere ("Something went wrong. Please try again."); votes fail silently. Command: clarify.
- [P2] "Supertags" jargon; rename to tags. Command: clarify.
- [P2] Consistency leftovers: composer kind-picker + Drafts button still pills; postKind.js hardcodes #8a6d00 (dark-mode contrast fail, warnink token exists). Command: polish.

### Persona Red Flags
- Alex (power user): no shortcuts (c, /, j/k); JS-only card nav kills middle-click/new-tab; Esc dead.
- Jordan (first-timer): "Supertags (0/10)" opaque; "Hot" sort unexplained; "Post anonymously" ambiguous (anonymous to whom?).
- Sam (a11y): notices/errors not aria-live; skeletons lack aria-busy; tag suggestions mouse-only; modal focus leaks.

### Minor Observations
- No <time> semantics or absolute-date tooltips on timestamps.
- posts_since polling gives up permanently after 3 failures (silent staleness).
- Empty state teaches nothing.
- Search input lacks label/aria-label.

### Questions to Consider
- Should the 3 post kinds be visible tabs instead of a dropdown?
- Should feed posts show pipeline gate status (the product differentiator is invisible here)?
- Where is the anonymous-posting trust story told?
