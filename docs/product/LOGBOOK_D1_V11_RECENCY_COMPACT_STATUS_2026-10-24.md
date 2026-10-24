# D1-V11 — compact mobile-first Recency status (unreleased candidate)

**Date:** 2026-10-24 UTC. **Repo:** `filipto861/flytally-logbook`. **Base:** verified production `main@2f7aaa07ecd7ecf1de200f08094a72b95e1e44f7`. **Work:** `fix/logbook-v11-recency-traffic-light-20261024`, separate from docs-only Draft #411. **Owner request:** make Recency at the top of mobile Dashboard obvious, color-coded (green OK, orange due soon, red not current) and remove confusing historical/provenance prose while preserving aviation truth and existing design.

## Source discovery and decision
Current V11 reads **only** persisted `RecencySnapshot` from `preferences_json`: `status: "ok" | "warning" | "attention"`, `generatedAt`, `label`; it **does not recalculate recency on Dashboard page load**. The existing domain service maps `reviewCount>0` to snapshot status `attention`, including incomplete evidence, mixed monitoring states or actual not-current evaluations. Therefore `attention` is **NOT sufficient evidence of legal NOT CURRENT**, and an old saved `ok` is **NOT current clearance**. Never fake a legal result or invent a freshness/time-until-expiry threshold.

## Frozen UI mapping for this UI-only batch
| Persisted source | Dot / token | Large status text | Interpretation |
| --- | --- | --- | --- |
| snapshot `ok` | green `--success-text` | **Last check: OK** | Historical result only, not CURRENT |
| snapshot `warning` | amber `--warning-text` | **Last check: Due soon** | Historical configurable monitor warning, not newly computed expiry |
| snapshot `attention` | red `--danger-text` | **Last check: Needs review** | Some reviewed item requires attention; NOT necessarily NOT CURRENT |
| absent / invalid snapshot | grey `--muted` | **Not assessed** | No trustworthy snapshot; never green |

The heading `LICENCES & RECENCY` remains without an extra redundant header badge. The large heading starts with **Last check:** (except when no assessment exists). A single **[date] · Verify before flight** line conveys that the result is historical, without the redundant word Saved. When no snapshot exists, the status is **Not assessed** and no misleading date/detail line is shown. One prominent high-tap-target `Check recency →` route navigates to `/credentials`. Status communicated in text as well as color. No stacked `SAVED SNAPSHOT` + `Historical snapshot` + `Saved result:` + legal paragraph. Compact h2 and 15px colored indicator; existing card/background/layout and mobile-first order remain. Link stays at least 44px. Motion decision **NONE**.

**Explicit deferral:** User's exact red **Not current** label is applicable only when future source contracts can show a *specific* unequivocally not-current evaluation; no such discriminator exists in the persisted snapshot. A future separately reviewed source-backed live/current read model may enable true `Current / Expiring soon / Not current / Incomplete evidence` without changing regulator meaning. Do not map `attention` to `not-current` or auto-refresh/silently mutate snapshot in this UI fix.

## Scope and tests
- Modify only `components/dashboard-editorial.tsx`, `app/dashboard-editorial.css`, and the existing `tests/d1-v11-dashboard-pace.test.ts` source regression.
- No extra data queries, roles, recency-service rules, saved JSON schemas, notification thresholds, DB migrations, feature flags, new dependencies, global brand/style, or changes to Classic Dashboard or `dashboard_widgets` preferences.
- Require targeted Node tests, project TypeScript/build, browser 320/390/768/1024/1440 in Light/Dark/night where supported; synthetic fixtures for all four statuses, focus/tab, 200% zoom, pointer. Chrome emulation != native Safari.
- **Current branch actual Node/TS/build/Playwright: NOT RUN**. GitHub source contract inspection only (advisory). Existing main release verification does not automatically apply to this new candidate.

## Release limits
Draft PR only until exact-HEAD owner-local risk verification and explicit approval. No automatic merge/deploy/production DB change. Separate docs-only PR #411 is unrelated and untouched.

**ONE NEXT STEP:** run candidate-bound targeted Node/TypeScript and mobile browser checks for the new recency card, then obtain owner visual approval for default color/text semantics before release.
