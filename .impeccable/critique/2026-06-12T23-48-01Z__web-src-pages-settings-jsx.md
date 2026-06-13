---
target: settings
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-06-12T23-48-01Z
slug: web-src-pages-settings-jsx
---
## Critique: Settings (web/src/pages/Settings.jsx)

### Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Toggles save silently; failure reverts with console.error only |
| 2 | Match System / Real World | 3 | "Danger zone" oversells a logout |
| 3 | User Control & Freedom | 3 | No account deactivate/delete path |
| 4 | Consistency & Standards | 3 | Toggle lacks focus ring that .btn has |
| 5 | Error Prevention | 3 | No confirm on logout |
| 6 | Recognition vs Recall | 3 | Options visible/labeled |
| 7 | Flexibility & Efficiency | 2 | Theme binary, no System; no keyboard path |
| 8 | Aesthetic & Minimalist | 3 | Four near-identical cards slightly templated |
| 9 | Error Recovery | 1 | Silent failure everywhere |
| 10 | Help & Documentation | 2 | One account note only |
| Total | | 24/40 | Acceptable |

### Anti-Patterns Verdict
Does not read AI-generated. Detector 0 findings. Mild card-stack templating, not a tell.

### Missing (priority)
- [P1] Notification preferences: live notification system exists (bell, my_notifications, pipeline/problem events), no controls here. craft.
- [P1] Security section: email+password auth, /forgot-password exists, but no Change password and no sign-out-everywhere/sessions. craft.
- [P1] Save feedback: privacy toggles + failure path silent (console.error). Add inline saved/failed status. harden.
- [P2] "Danger zone" mislabeled: only logs out. Rename to Session, or make it a real deactivate/delete. clarify or craft.
- [P2] Theme has no System option; no prefers-color-scheme first-load sync. craft.
- [P2] Switch a11y: Toggle has no accessible name (no aria-labelledby), no focus-visible ring. harden.

### Minor
- No loading skeleton; Account card flashes ? avatar + "Unnamed" during fetch.
- Logout no confirmation (optional).
- Email change stated admin-managed but no request path.

### Persona Red Flags
- Sam (a11y): unlabeled switches, no focus ring, silent saves.
- Jordan: "Danger zone" alarming for logout; expects notifications + password here.
- Alex: no System theme, no sign-out-everywhere for shared machines.
