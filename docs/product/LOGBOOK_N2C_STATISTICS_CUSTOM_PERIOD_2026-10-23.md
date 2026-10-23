# FlyTally Logbook — N2-C custom Statistics calendar interval

**Date:** 2026-10-23
**State:** candidate code staged, owner visual acceptance and exact-head runtime verification NOT RUN. No merge/deploy authority.

## Owner decisions / stack

The owner reviewed screenshots of N2-B and explicitly liked the clean, responsive, intuitive visual direction. **Freeze N2-B styling as the default method for future Logbook UI**, respecting FlyTally Light/Dark themes and cockpit legibility; no speculative CSS effects or new design system. The owner requested that the Statistics **Period** group also permit selecting a start and end date via calendar controls.

- Canonical main: `c68e6a2758423ab862cf9b03f5623515d07433e4`.
- Draft parent chain: PR #391 N1 -> main, PR #392 N2-A2 -> N1, PR #393 N2-B -> N2-A2, N2-C branch `feat/logbook-n2c-statistics-custom-period-20261023` -> N2-B. NO child merges ahead of parents and NO production changes without owner authorization.

## Interaction contract

Scenario: A pilot analyzing personal logbook statistics chooses preset period (all time / current year / rolling 12m / previous year) or expands **Custom dates**, uses native `type=date` calendar inputs labeled **From** and **To**, and presses **Apply**. The resulting URL uses `period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD` along with selected category/section. Dates are calendar days, **both inclusive**. No automatic apply on a field change. Quick presets remain one-click and clear the old custom range. The custom period survives changing Category or Analysis. The Career section remains explicitly all-time and hides period controls, as before.

Validation: both dates must be strict real Gregorian YYYY-MM-DD dates, including leap days; From must not exceed To. Missing/malformed/reversed ranges show a visible error and editable calendar inputs **without running the aggregate query or silently showing all-time totals**. This is UI/data trust, not operational aviation validity. Server revalidates regardless of client input.

- Old `pilotInsightBounds(period,today)` defaults remain unchanged for the four presets. For `custom`, parser is mandatory and `pilotInsightBounds` throws on invalid input; the page intercepts it before data access.
- `getPilotInsightsData` takes an optional validated custom range and passes its bounds into **existing parameterized PostgreSQL date_key >= start / <= end expressions**. Therefore aggregate summary, role/aircraft/airport/route breakdowns, monthly chart and counts use the same inclusive time bounds. The rolling 12-month pace comparison remains explicitly labeled rolling 12 months and not re-scoped to an arbitrary interval. The Career view stays all-time as its title/description promise.
- Existing data/certification, permissions, logged-time (BLOCK vs AIR), category and auxiliary exclusions unchanged.
- Native date controls render in the same N2-B filter station, accessible labels, visible focus, min 44px controls, 320px mobile stack, theme-aware color-scheme. Motion NONE, no new JS/calendar dependency.

## Source and tests

Code: `lib/pilot-insights.ts`; `lib/data/pilot-insights.ts`; `app/(protected)/statistics/page.tsx`; scoped `app/ui-system.css`; guarded preview script only allowlists the exact N2-C branch (still unique disposable localhost PG, physical DB identity, empty schema checks).

Tests staged: `tests/v168-pilot-insights.test.ts` (valid, leap year, impossible/ambiguous/missing/reversed, exact labels), `tests/logbook-n2c-custom-range.test.ts` (explicit apply, url persistence, invalid request, CSS/a11y), `tests/integration/postgres-pilot-insights.test.ts` (source real SQL PostgreSQL fixture inclusive August 1 / September 1; excludes Sept 2; empty 2027 day). Historic source-only tests `tests/v210-dashboard-statistics-consolidation.test.ts` and `tests/logbook-n2b-workspace-layout.test.ts` updated to recognize the existing N2-B structured nav and preserved N2-C custom URL arguments, not to weaken intended assertions.

**Source inspection:** 26/26 in-memory GitHub source invariants PASS before documentation; this is NOT a Node/TS/DB/browser test. Targeted tests, typecheck, build, Playwright, isolated PG integration, Light/Dark screenshots, phone 320/390, iPad 768/1024, keyboard/native Safari all NOT RUN for exact candidate; do not claim browser PASS or approved product runtime.

## Do not

No Training changes, no modifications to Logbook flights, flight forms, recency/certification/evidence, existing user settings, database schema, migrations, production flags, existing deployment, alternate PRs, or user's local ZIP files. No auto-filled dates: both fields start empty until the user selects a custom interval. No new datepicker packages or overlays, and no period filtering for Career.

**ONE NEXT STEP:** owner pulls N2-C stacked Draft branch, launches existing guarded disposable-local-PostgreSQL preview and checks custom picker/presets/custom navigation/invalid interval and Light/Dark at Statistics. Then run candidate-bound tests and discuss independent merge approvals.

## Final source review correction (2026-10-23)

During GitHub source inspection, the refactor's regular Statistics render path was discovered to contain **two page headers** (one reusable `header` variable plus the prior inline JSX). This was fixed before any owner preview; the N2-C source guard now asserts exactly one header definition reused in both valid and invalid-render paths. Final focused source inspection: **19/19 checks PASS**, and original 26/26 broader source invariants were satisfied before docs. These are in-memory static inspections only, **not** executable TypeScript, Node, PostgreSQL or browser test evidence. This correction does not alter the approved N2-B layout.


## 2026-10-23 owner screenshot refinement — Custom must stay IN the Period row

**Observed:** On the owner’s actual desktop/light N2-C Statistics screenshot, the initial `Custom dates` disclosure appeared in a separate row below the four Period presets and increased the whole filter station height. The owner rejected this placement as visually awkward, while keeping the approved N2-B visual direction.

**Implemented small, presentation-only fix (same Draft PR #394):**
- The four preset links and `Custom` disclosure now sit as peer children of ONE `statistics-period-toolbar` segmented control; Custom remains keyboard/touch accessible with an accessible name `Custom dates`.
- The toolbar is one flex row at every viewport. Presets retain horizontal scrolling in narrow space; the Custom entry stays visible at the right. On desktop >=1500px, modestly rebalance filter-column widths to give Period enough room. No premature wrapping into a second row.
- The native calendar `From`/`To` fields plus Apply render inside a bounded, anchored **absolute-positioned panel** below the Custom trigger only when expanded, instead of adding another layout row. This panel is a simple native `details` disclosure, not a modal/focus trap; the same summary click closes it. No automatic apply or new package.
- After applying a valid custom period, Custom displays selected styling but its disclosure **starts closed**; the chosen dates remain visible in the existing scope/range label and in the editable date inputs when reopened. Invalid interval still fails closed as before.
- Existing custom date parser, URL persistence, inclusive SQL bounds, category/analysis links, preset behavior and Career section untouched. No new motion; theme tokens and reduced-motion expectations unchanged.
- Static review **22/22 GitHub source assertions PASS** at code checkpoint. Executable Node tests, typecheck, actual browser CSS, 320/390, 768/1024, Chrome/real Safari remain **NOT RUN**; visual owner acceptance of the new placement pending.

**ONE NEXT STEP:** owner pulls updated N2-C and confirms the inline fifth Period control + anchored calendar in light/dark, then runs candidate-bound tests.


## 2026-10-23 — exact-head verification preparation

### Risk classification (candidate-specific, not a PASS)

N2-C changes a **date-range domain helper + server-side aggregate date bounds + a protected interactive UI**. Verification must therefore include **domain unit**, **application source contract**, **owned isolated PostgreSQL acceptance**, **authenticated browser UI/responsivity** and TypeScript/build evidence as selected by the actual `DEVELOPMENT.md` candidate risk planner. A successful user screenshot proves visual direction only. Source assertions are not browser or SQL evidence.

### Source review findings and corrections

- Caught stale N2-C source-test expectations after the user-requested inline Custom control: test looked for an obsolete `className` shape and an obsolete CSS section marker. Repaired only those assertions to match the verified exact markup/style while retaining original checks.
- The optional PostgreSQL integration test could be launched directly, bypassing the main development runner's localhost preflight. Added a fail-closed PostgreSQL URL protocol and localhost-host check in `tests/integration/postgres-pilot-insights.test.ts` **before CREATE SCHEMA**; a remote `DATABASE_URL` is rejected. Unique test schema cleanup remains unchanged.
- Added `e2e/logbook-n2c-statistics-range.spec.mjs` using the existing authenticated pilot/browser helper; it checks Custom stays inline through 1440/1024/768/390/320 and both themes, plus explicit Apply, selected custom interval URL, category/analysis persistence, preset reset, and invalid deep-link fail-closed behavior. Requires the repository's **owned isolated test DB and purpose-gated browser harness**; do not run directly against remote databases.
- Source-only check **18/18 PASS** at implementation stage across page markup, CSS, test updates, existing date bounds/SQL and local-only safeguards. **NOT a Node/Playwright/PostgreSQL PASS**.

### Local verification commands — safe first stage, no database operations

With PowerShell at the Logbook repository on `feat/logbook-n2c-statistics-custom-period-20261023` and Node 24 installed:

```powershell
git rev-parse HEAD
npm run typecheck
npm run test:target -- tests/v168-pilot-insights.test.ts tests/logbook-n2c-custom-range.test.ts tests/logbook-n2b-workspace-layout.test.ts tests/v210-dashboard-statistics-consolidation.test.ts
npm run scope:changed -- "app/(protected)/statistics/page.tsx" "lib/pilot-insights.ts" "lib/data/pilot-insights.ts" "app/ui-system.css" "e2e/logbook-n2c-statistics-range.spec.mjs" "tests/integration/postgres-pilot-insights.test.ts"
```

The `scope:changed` step is **read-only planner output**, not testing. Do not claim status unless exact-head command output is captured. The following stages (owned PostgreSQL + authenticated Playwright + candidate release gate) must use verified isolated localhost fixtures and the canonical risk runner, not the user's production `DATABASE_URL`.

**ONE NEXT STEP:** Owner executes the safe local Node/TypeScript/plan commands and shares PASS/FAIL with exact HEAD; investigate failures, then run the required separate owned PostgreSQL/Playwright gates.
