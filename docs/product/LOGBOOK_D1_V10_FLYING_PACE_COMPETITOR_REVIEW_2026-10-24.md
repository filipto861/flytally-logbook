# D1-V10 — Competitor-informed Flying Pace concept (2026-10-24)

**Status:** Exploratory VISUAL PROTOTYPE, owner selection and implementation not yet authorized. **Repository:** `filipto861/flytally-logbook`. Verified baseline `main@470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`; docs branch Draft PR #408. Production Vercel previously READY at `dpl_ABShRChWDdg4oCzuygKMvQHX3oSe` on the same SHA, no deploy.

## Owner request / frozen earlier preferences
Owner likes D1-V9 Editorial and stronger recency, wants to study competitors and asks whether a modest Flying Pace chart for the last 24 months could improve the daily Dashboard. Existing frozen design boundaries: visible Add flight on left / mobile header, grouped total/ULL/EASA and integrated single Last Flight row, separate prominent recency, no redundant Quick Actions or gratuitous microcopy; no on-page Customize (compatibility migration pending).
**V10 graph is a proposal**, not blanket authorization for a heavy analytics product or new regulatory calculations.

## Primary-source competitor scan (2026-10-24)
- ForeFlight Logbook: https://foreflight.com/products/logbook/ — experience reports and currency summaries shown prominently, with drill-down; pilot-entered category/aircraft data influence validity. Useful inspiration = status discoverability and evidence link, NOT copying US FAA currency logic/labels.
- LogTen: https://logten.com/why-logten/ — totals and aircraft-type breakdowns in Analyze, with time windows; useful inspiration = keep Dashboard concise and detail in Analyze/Statistics.
- MyFlightbook: https://myflightbook.com/logbook/default.aspx and https://myflightbook.com/logbook/mvc/pub/FeatureChart — graphical trends and time-by-period reports; useful = light historical context without all statistics controls in overview.
- FLTlog: https://www.fltlog.com/ — publicly describes a Dashboard with flight totals, recency, recent activity and separate 12-month analytics.
Sources are external product claims, not evidence of FlyTally live runtime and not imported design assets.

## Proposed V10 visual layout
1. Preserve V9 Editorial principal top grid: total+ULL/EASA+integrated last flight, alongside evidence-backed prominent Licences & recency.
2. Add exactly **one full-width low-priority Flying Pace panel below** the two top cards. 24 understated bars for calendar months, labeled endpoints/period. Keyboard arrows / Home / End and touch exploration update a short month-and-hours caption. Charts show **logged time by calendar month**, not regulatory currency or flight eligibility.
3. One `Explore in Statistics` deep link; no duplicate Add flight/Flights/Map/Export actions and no extra card counters.
4. **Empty accounts:** no invented graph; `No flights recorded in this period`. Month with zero valid recorded flights can be zero only if the underlying dataset is verified complete. Missing/malformed dates are not equivalent to zero.
5. Current month is explicitly PARTIAL (month to date) when selected; 24 rolling calendar months rather than a fake number of full completed months.
6. Chart data must come from canonical monthly flying time (minutes) and respect `dashboard_total` / `activity_minutes` semantics used for the total overview; `lib/data/dashboard.ts` already implements `DashboardData.monthly` using `LEFT(date_key,7)`, but `DashboardOverviewData` is a smaller read model without monthly. Scope minimal bounded 24-month read or additive overview data projection, not unconditionally reusing a heavy historical query without performance evidence.
7. Critical user-visible alerts (pending approval/data quality) should be shown compactly **only when nonzero**; do not lose live workflow alerts when eliminating decorative Quick Actions.
8. Preserve current theme tokens, existing sidebar Add flight, no new chart package, no decorative animation; motion choice NONE, no expensive interactive zoom/filters.

## Prototype and audit
Conversation artifact `FlyTally_Dashboard_D1_V10_Flying_Pace.html` (standalone LOCAL HTML with synthetic 24-month series; not in repository app, production or PR). Synthetic dates: Nov 2024–Oct 2026 inclusive; current October explicitly marked month-to-date; illustrative values NOT user hours.
Local Chromium `page.set_content` test with the exact local HTML artifact: 320,390,768,1024,1440,1600 × light/dark = **12/12** visual responsive contexts, 0px page overflow, one integrated latest flight and one recency, 24-month bars. Mouse/touch-region click, chart keyboard Left/Right/Home/End and sample↔empty mode validated. This is **PROTOTYPE-ONLY PASS**. Real Next.js/authenticated DB/browser release gate, production build, data integrity, Native Safari, VoiceOver, screen reader announce, forced colors, 200% zoom: **NOT RUN**.
NOTE: chart uses one large focusable interactive plot with an accessible selected-month value, instead of 24 tiny interactive buttons on mobile. Final production implementation needs proven accessible semantics and tests.

## Options / recommendation
- **Recommended:** one 24-month bar chart, total logged hours only, keep advanced filters in Statistics. Do not add unrelated quick actions, flight records lists, cockpit weather, regional compliance or vanity statistics.
- **Later optional:** a succinct 12-month / previous 12-month comparison *only if it is correct, desired and properly labels incomplete current month*. Not part of V10.
- **Later optional:** a compact conditional `Needs attention` link with an actual count when there are unreviewed records/actions. Do not infer no outstanding items from screenshot of empty fixture.

## Safety and acceptance
No silent wiping/replacement of persisted `dashboard_widgets`, no new usage goals presented as legal recency, no custom status thresholds/aircraft eligibility, and no flight/GPS/domain SQL computation change without independent source review. Preserve existing regulatory labels exactly; if missing, show Not assessed/Unavailable, not CURRENT. No Training, production schema, migrations, flags, deployment or merge. The owner must approve graph and final density; then perform one read-only independent design/data-contract review, make a narrow work branch and run candidate-bound exact-SHA tests.
**ONE NEXT STEP:** owner reviews V10 graph prototype and decides whether the single, lightweight 24-month Flying Pace becomes part of the frozen D1 UI implementation scope.
