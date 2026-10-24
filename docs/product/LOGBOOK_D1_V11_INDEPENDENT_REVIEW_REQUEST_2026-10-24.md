# Read-only independent review request — FlyTally Logbook D1-V11
Date: 2026-10-24 (UTC). Reviewer: DeepSeek or Claude. **READ ONLY**: no code edits, database queries/writes, migrations, merge, deploy or flag changes. Review code in `filipto861/flytally-logbook` ONLY.

## Identity and decisions
- Canonical baseline `main@470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`.
- Draft PR **#410**, branch `feat/logbook-d1-v11-editorial-preview-20261024`; **source revision for review `9edb3cc2f3fbd367c21360f3fff9742b7da40be7`** (checkpoint docs appended afterwards, so check actual PR HEAD/changed paths).
- Current production Vercel `dpl_ABShRChWDdg4oCzuygKMvQHX3oSe` READY on baseline main, not the Draft.
- Owner approved implementing the V11 Editorial design but **NOT** enabling V11 by default, merging, deploying, altering production DB, or irreversible preference migration.
- The V11 route is **only `/dashboard?view=v11`**; old `/dashboard` retains saved layouts, old editor/server actions and routes. `Add flight` remains in global sidebar and is exposed in page header on small screens. Historical period/detail links continue redirecting.
- No schema/flag/dependency/brand/new-regulatory-calculation changes, no Training changes.

## Exact changed runtime files
- `app/(protected)/dashboard/page.tsx`: URL opt-in switch, one monthly-aggregating source query for preview, lean overview for classic, shared authorized preferences/recency/actions.
- `components/dashboard-editorial.tsx`: grouped all-time/ULL/EASA, integrated latest flight, saved recency result **explicitly historical** with captured date, real conditional alerts.
- `components/dashboard-pace.tsx`: accessible keyboard/pointer 24-month time chart; category switch; full 12v12 month comparison.
- `lib/dashboard-pace.ts`: pure UTC 25 source months → 24 plotted calendar months + equal prior completed 12-month comparisons; invalid/duplicate/negative/unaccounted date fail-closed, empty if only out-of-window rows.
- `app/dashboard-editorial.css` and `app/layout.tsx`: scoped class system; import BEFORE canonical last `app/ui-system.css`.
- `tests/d1-v11-dashboard-pace.test.ts`: month math, invalid/empty, legacy parity, CSS and saved-recency source assertions.
- Important: **`lib/data/dashboard.ts` remains byte-identical to canonical main**, not in the PR effective changed file list.

## Reviewer goals — challenge both design and implementation
1. **BLOCKER/PERFORMANCE:** V11 uses the existing heavy `getDashboardData(session.userId,"all")` instead of protected lean `getDashboardOverviewData` on preview, not BOTH. It returns long-history summaries/top routes/airports and unbounded monthly arrays. Is this unacceptable at 100k flight rows? Identify the *narrowest* bounded 25-month read with fidelity to existing `activity_minutes`, `logged_minutes`, `dashboard_total`, `evidence` and safety pilot handling; propose test and rollback, do not implement. Preserve v2.3 100k lean overview assertion. The current heavy-preview path is **NOT ready for default rollout** unless performance is proven.
2. **REGULATORY/RECENCY:** `parseRecencySnapshot` is persisted, not live validity. Check whether `Saved result: ...` and `Captured YYYY-MM-DD` are sufficient to stop a stale `Recency OK` label being mistaken for CURRENT or legal clearance. No invented expiration or time-age thresholds; may recommend a clearer fail-closed presentation.
3. **DATA TRUTH:** two 12-month comparisons are full completed UTC calendar months; graph contains current partial month. Confirm 25-source-month offset and boundary, months without data vs malformed/invalid dates, 0 baseline and no fabricated percentage, ULL/EASA/Total category relationship. User can have safety pilot, missing date, historical-only flights and 0 logged minutes. Tests should prove output ↔ canonical rows.
4. **COMPATIBILITY:** Classic Dashboard `dashboard_widgets` preferences, legacy `dashboardLayoutFromPreferences`, `DashboardEditor`, legacy redirects, existing action links and user-scoped `requireUser` must remain intact. If future default switch is desired, spell out opt-in/rollback strategy that never silently wipes layouts.
5. **UX/A11Y:** focusable plot role=slider with arrows/Home/End; touch/drag/pointer capture; tab focus, locale/date readout, selected label, visual focus, low-vision 200% zoom, 320/390/768/1024/1440/1600 light/dark. If 24-month bars are inaccessible, propose smallest change, not library import. Check real CSS cascade and empty/pending conditions.
6. **TEST COVERAGE:** identify genuine blockers vs low-priority polish. Provide minimal exact-SHA Node/TS/build/safe owned PostgreSQL browser/scale matrix selected per `DEVELOPMENT.md`; no production DB testing.

## Evidence (accurate limited claims)
- GitHub source read-back and source-only contract inspection found original lean overview identical to main and preserved classic URL/editor/sidebar; **SOURCE REVIEW ONLY**, not compiled.
- After a newly found out-of-window empty-chart bug, helper was fixed and exact source copied with FNV-1a hash match `0x17a61515`, 2421 UTF-16 code units, then executed by a local Node 22 `--experimental-strip-types` isolated harness: **5/5 focused pure-function tests PASS**, including complete 12/12, categories, invalid dates, empty/out-of-window, zero-minute, UTC year rollover. This is NOT the app's npm runner or full test file, which remains **NOT RUN**.
- Actual repo `npm run test:target`, `npm run typecheck`, `npm run build`, candidate-bound `verify:release:risk`, local owned PostgreSQL, 100k benchmark, authenticated V11 browser, native iPad Safari, VoiceOver, 200% zoom and release/production smoke are **NOT RUN**. Historic synthetic V11 HTML screenshots are not React implementation evidence.
- No real pilot/flight/GPS/credential data in reviewer packet.

## Required output format
Verdict: **APPROVE / APPROVE WITH CHANGES / BLOCK** for moving beyond opt-in review candidate (not for deployment). Each finding:
`Severity BLOCKER/MAJOR/MINOR/IDEA | OBSERVED/CODE-INFERRED/UNVERIFIED | exact file + reason | effect on aviation/UX/performance | narrow remedy | acceptance test`.
Then provide 1) must-fix ordered steps; 2) deferred items; 3) outstanding owner decisions; 4) one precise next action. Do **not** mark code as tested, approved, compliant or deployed without its own evidence. No merge/flags/DB.
