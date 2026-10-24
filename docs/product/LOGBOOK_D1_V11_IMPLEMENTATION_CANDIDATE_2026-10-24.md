# D1-V11 Editorial Dashboard — implementation candidate and independent review

**Date:** 2026-10-24 UTC. **Owner:** approved V11 visual and authorized implementation, NOT merging/deploying. **Repo:** `filipto861/flytally-logbook`. **Canonical main:** `470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`. **Work:** `feat/logbook-d1-v11-editorial-preview-20261024`, Draft PR #410, based directly on main. PR HEAD must be rechecked after this docs checkpoint.

## M1: reversible, opt-in V11 UI candidate (staged)
- `/dashboard?view=v11` renders Editorial flying summary, ULL and EASA category totals, exactly one integrated Latest Flight, prominent Licences & recency with evidence-first neutral unassessed state, real conditional links to `/flights/needs-attention` and `/actions`, and 24-month Flying Pace.
- `/dashboard` is the original N2-B workspace and saved `dashboard_widgets` editor, unchanged in behavior/structure. Existing **Add flight** in real global sidebar remains; V11 provides an additional Add flight button only below the mobile shell breakpoint.
- "Classic dashboard" link gives reversible route-only exit; saved layout is neither deleted nor overwritten. V11 selection is not permanently stored and does not constitute an endorsed change of default UX.
- Flying Pace: 24 calendar months ending in current UTC month, includes current partial month clearly marked MTD. Complete periods comparison is 12 months immediately before current month vs preceding 12 months (25 source months). Total/ULL/EASA toggle; user-selected month via one focusable plot using arrows/Home/End and pointer, 0 baseline comparison returns unavailable percentage; invalid/ambiguous data fails closed. Empty no-flight period has explicit empty state.
- No unsupported compliance claim: `parseRecencySnapshot` is shown as a **saved snapshot**, not a live/current/approved legal rating; missing snapshot = Not assessed. No age-based validity assumption.
- No fake action counts; only real service `getIntelligentLogbookAttention` and `getPendingActionCount` nonzero values are shown. No customizations panel, duplicate utility rail or decorative motion in V11.

## Contract and source rationale
- `lib/data/dashboard.ts` must stay byte-identical to main. Protected v2.3 large-logbook tests ban adding `jsonb_agg` or `month_key` to the lean `getDashboardOverviewData` SQL. An initial in-progress edit added aggregation there, was **reverted before the PR**, and the current file was fetched from main and restored. Do NOT reintroduce the performance regression.
- V11 preview reads `getDashboardData(session.userId,"all")` **instead of** the legacy overview read (one application data query for the selected view); its monthly source is the canonical historical Statistics aggregation using `activity_minutes`, `logged_minutes`, `dashboard_total` and `evidence`. It may be expensive and is intentionally a protected opt-in prototype gate. **No default rollout or performance PASS before validating/replacing it with a bounded query that preserves exact aviation semantics.**
- `lib/dashboard-pace.ts` is pure UTC month-series and completed comparison helper; duplicate, negative or malformed rows and non-date flight evidence result in Unavailable, not fabricated zero/currency.
- Isolated scoped stylesheet imports **before** canonical final `ui-system.css`, preserving original cascade ownership outside `.d1v11-*`. No new npm dependencies, theme tokens or color libraries.

## Files changed in current branch
- `lib/dashboard-pace.ts` (new)
- `components/dashboard-pace.tsx` (new)
- `components/dashboard-editorial.tsx` (new)
- `app/dashboard-editorial.css` (new)
- `app/layout.tsx` (one extra scoped CSS import)
- `app/(protected)/dashboard/page.tsx` (conditional reversible route preview)
- `tests/d1-v11-dashboard-pace.test.ts` (new)
- This implementation contract, ROADMAP/Project Memory checkpoint.

## Test/evidence ledger at current work
- GitHub file create/update success and read-back: commit-backed source exists.
- Source-only candidate audit of existing v1341/v170/N2-B/v230 contracts: manual inspection, no automatic real test execution, **ADVISORY**.
- New `tests/d1-v11-dashboard-pace.test.ts`: added but repository test runner **NOT RUN**; tests 24 UTC months, 25th source month comparison, empty/invalid/zero, out-of-window activity, category and legacy preview.
- Isolated **exact-source helper** exercise: after adding the out-of-window source-row fix, local copy of `lib/dashboard-pace.ts` matched GitHub file length **2421 UTF-16 code units** and FNV-1a hash **0x17a61515**. In Node 22 with `--experimental-strip-types`, 5/5 focused direct-source pure-function tests **PASS** (calendar bounds, category split, invalid/duplicate/negative, zero comparison and empty/out-of-window, year rollover). This is NOT the registered repository test runner or a Next.js test; no claim of TypeScript app acceptance.
- TypeScript/build/Next authenticated Chromium with test PG16/100k performance/risk plan/native Safari/VoiceOver/200% zoom/CI: **NOT RUN**. Do not imply production functional success from branch or prototype.
- DB/migrations/flags: NO CODE CHANGE; production DB state UNKNOWN. Production Vercel last read READY deployment `dpl_ABShRChWDdg4oCzuygKMvQHX3oSe` at main SHA, not V11. No merge, deploy, migration, flag change, unrelated repo writes.

## Independent DeepSeek/Claude read-only review (requested before release)
Freeze exact main SHA and latest PR #410 work HEAD. Ask reviewer to inspect code and answer:
1. Is the URL-only opt-in route truly backward-compatible with saved `dashboard_widgets` and legacy N2-B tests? What would a safe permanent user-controlled promotion/rollback contract require?
2. Do V11 Total/ULL/EASA monthly series and comparison preserve canonical safety-pilot, category, invalid-date and calendar boundaries? Flag any wrong equivalence of NULL vs 0 or unsupported source-to-output assumptions.
3. Can the heavy `getDashboardData` read in V11 impact 100k-flight performance and what minimal bounded equivalent avoids domain duplication? No new schema/DDL.
4. Accessibility/responsiveness: one slider for 24 month bars, coarse touch, keyboard, 320px, focus/cancel/ARIA, empty/very-large values, 200% zoom, RTL/long labels.
5. Recency: ensure no `CURRENT`/validity claim from stale snapshot; distinguish saved source from real-time status and avoid silently hiding attention.
Reviewer MUST be read-only and return BLOCKER/MAJOR/MINOR with exact paths and recommended acceptance criteria. No permission to merge/modify production.

## Required owner-local gates before release consideration
On checked-out work HEAD from PR #410 and verified local isolated PG16 (never remote/prod) use the current `DEVELOPMENT.md` candidate-bound risk planner:
- `npm run test:target -- tests/d1-v11-dashboard-pace.test.ts tests/v230-large-logbook-performance.test.ts tests/v1341-dashboard-customization.test.ts tests/v170-dashboard-statistics-ux.test.ts tests/logbook-n2b-workspace-layout.test.ts`
- `npm run typecheck`
- `npm run audit:design` (advisory)
- `npm run verify:plan -- --base origin/main`; then `npm run verify:release:risk -- --base origin/main` when candidate/fixture scope is confirmed.
- Safe authenticated browser: classic view versus `?view=v11`, light/dark, 320/390/768/1024/1440/1600; zero/long/dense data, keyboard slider and pointer, recency no snapshot, real saved preference, pending + Needs Attention counts, no horizontal clipping, 200% zoom, reduced motion. Native iPad Safari separate.
No PASS without actual console + ledger from exact SHA.

**ONE NEXT STEP:** independent read-only DeepSeek/Claude review of Draft #410 frozen code, then reconcile findings and run exact-candidate user-local risk tests before any default switch or merge request.

### 2026-10-24: local helper-only type validation
The separately copied `lib/dashboard-pace.ts` matches the GitHub source revision in UTF-16 character count and FNV-1a fingerprint after the out-of-window fix (integrity indicator, **not cryptographic proof of byte identity**). On Linux with installed TypeScript 5.8.3 and Node 22, `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck lib/dashboard-pace.ts` **PASS** for that single helper module. Application-wide TypeScript/React/build tests **NOT RUN**. This additional evidence is narrower than the repository's required Node24 release gate.
