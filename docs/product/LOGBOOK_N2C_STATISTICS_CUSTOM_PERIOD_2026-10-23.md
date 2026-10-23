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
