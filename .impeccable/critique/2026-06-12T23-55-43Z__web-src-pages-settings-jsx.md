---
target: settings
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-12T23-55-43Z
slug: web-src-pages-settings-jsx
---
## Critique: Settings (web/src/pages/Settings.jsx) — re-run after P1 rework

### Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Toggle Saved/Not saved + password success/error; no in-flight state on switch |
| 2 | Match System / Real World | 4 | "Session" honest; plain language |
| 3 | User Control & Freedom | 4 | Logout, sign-out-everywhere, reversible toggles |
| 4 | Consistency & Standards | 4 | One Row/Toggle vocabulary; focus rings everywhere |
| 5 | Error Prevention | 4 | Password min-length + match guards, sign-out confirm |
| 6 | Recognition vs Recall | 4 | Options visible/labeled |
| 7 | Flexibility & Efficiency | 3 | No System theme option |
| 8 | Aesthetic & Minimalist | 3 | Six stacked identical cards monotonous |
| 9 | Error Recovery | 3 | "Not saved" marker no reason/retry |
| 10 | Help & Documentation | 3 | Section subtitles + account note |
| Total | | 35/40 | Good |

### Anti-Patterns Verdict
Not AI-generated. Detector 0 findings. Prior three P1s closed: notification prefs wired to notify(), real security section, save feedback everywhere.

### What's Working
- Notification toggles map to backend categories; notify() honors them.
- Per-row Saved/Not-saved + optimistic-with-revert kills the silent-failure P1.
- Switches have accessible names + focus rings (AA gap closed).

### Remaining (P2/P3)
- [P2] Toggle no in-flight state: rapid clicks race optimistic value + revert. Disable while pending. harden.
- [P2] Password change does not re-authenticate; unlocked-screen risk on shared machines. Require current password / recent login. harden.
- [P2] Theme binary; no System option / prefers-color-scheme sync. craft.
- [P3] Six identical stacked cards; group or lighten. layout.

### Persona Red Flags
- Sam (a11y): clean now.
- Alex: sign-out-everywhere present; no System theme.
- Jordan: notifications + password where expected; no alarming labels.
