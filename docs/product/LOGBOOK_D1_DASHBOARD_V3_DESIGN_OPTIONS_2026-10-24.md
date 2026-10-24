# Logbook D1 — Dashboard V3 design direction (owner choice pending)
Date: 2026-10-24. Repo `filipto861/flytally-logbook`; canonical main `470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`. Scope: Dashboard only, not Flights/New Flight yet. Existing D1-A artifact #409 source `e57a888367022b672329026c6ef709da950dbc3c`. This is a DESIGN PROPOSAL, not code or release approval.

## User's updated direction (2026-10-24)
Owner says that `Customize dashboard` lacks meaningful functions: EITHER make it genuinely useful OR remove it. Owner otherwise accepts prior narrow fixes (44px targets, accessible status, singular/plural text), and is open to a visibly different UI using Apple Design V2/Design Quality V2. **This is not a finalized instruction to delete persisted layouts, change fly-time values, or change the brand.**

## Current verified product behavior and constraints
- `components/dashboard-editor.tsx`: actually supports show/hide, reorder, sizes, General/ULL/Instructor presets, reset and server save; edits `dashboard_widgets`.
- `lib/dashboard-widgets.ts`: legacy 11 widget definitions, but only five user-facing Dashboard overview IDs: total-time, ull-time, easa-time, last-flight, gps-tracks. Existing stored preferences require compatibility, including legacy widget IDs. Default overview has GPS widget disabled.
- `app/(protected)/dashboard/page.tsx`: overview data from `getDashboardOverviewData(userId,"all")`, main card cluster, one optional recency snapshot link, Quick Actions, persistent editor at bottom.
- `lib/data/dashboard.ts`: narrow `DashboardOverviewData` includes only total, ULL, EASA, safetyMinutes, tracks/GPS and lastFlight. Its larger historical `DashboardData` is a different, heavier query for Statistics. Additional PIC and deep history widgets are NOT mere CSS changes.
- D1-A observed: at 1440px large boxed page header, very large hero, EASA/ULL side cards, last flight isolated half-width, separate full-width Quick Actions with duplicated Add flight (visible 3 at desktop with sidebar, 2 mobile). Current screenshots show clean 0px overflow at 320-1440 in both themes, but do not cover >1499 two-column rail.
- Current FlyTally brand palette/type/semantic surface tokens preserved: see docs/design-language.md. No automatic prefill, invented recency or flight calculation.

## Design choices (owner decision required)
### A — Recommended: purposeful stable Dashboard; retire front-page customizer
1. Establish a curated top-level Dashboard hierarchy: **one dominant all-time flying summary (total flight time + grouped ULL/EASA)**, **last flight as a clearly navigable record**, **actionable pending/data-quality tasks when present**, compact secondary navigation to Flights / Statistics / Data. Header contains ONE prominent Add flight CTA; do not change global sidebar in this milestone.
2. Remove `Customize dashboard` from the daily main page **after** providing a safe, owner-approved backward-compatibility/exit path for existing saved `dashboard_widgets`. Do not discard old preferences, silently reset layouts, or leave a legacy customized user with an irrevocably frozen setting. Options: relocate management/reset to explicit Settings advanced area (temporarily), or retire preferences only with a separate migration design and deliberate user action.
3. Keep five lightweight overview data types from current read model. No fancy charts that merely duplicate Statistics. No additional DB requests.
4. Tradeoff: cleaner everyday UX and fixed stable hierarchy, less personalization for instructors/ULL-only users; requiring compatibility-safe staged retirement.
**Recommended product direction** based on present limited widget value and everyday Dashboard priority.

### B — Genuine customization feature
- Retain or move editor; add meaningful optional modules (e.g. PIC ULL/EASA, recent activity, period-aware data), stronger presets, visible layout preview, accessible drag/reorder OR keyboard move, safe status/error management.
- New widgets require explicit data read models and tests, new page layout constraints and regression/release scope. Avoid mixing with D1 visual cleanup and riskier recency/compliance logic.
- Tradeoff: more capability but higher maintenance, greater complexity and potentially slower initial dashboard.
**Not recommended as the immediate D1 priority without evidence of user demand for these specific widgets.**

### C — Low-risk temporary compromise
- Keep current editor working but relocate its entry point to a less prominent dedicated Settings/Advanced destination while redesigning the visible overview. Respect all saved layouts, provide explicit reset, then choose A/B later.
- Lower migration risk but doesn't truly solve feature-product value; should not be mistaken for retirement.

## Dashboard V3 visual specification (recomposition, not rebrand)
- Distinct structure from current 3+ independent cards: use a single `Flying overview` summary with strongly separated total figure and ULL/EASA metrics as subsections; all time window displayed, aligned tabular numbers, correct singular/plural.
- Last flight should include registration/date and leg as one scan-friendly clickable block with obvious `Open flight` affordance; keep missing-last-flight state and link to Flights.
- Quick Actions should become a compact activity/navigation list; preserve pending and needs-attention warnings, show only if supported by actual service results, and make priority evident. Avoid repeating `Add flight` if primary header CTA remains available at 320px.
- Recency shows **no invented CURRENT or validity**. Either preserve existing conditional snapshot or, after separate policy check, link neutrally to `Licences & recency`; empty snapshot is not a confirmed status.
- Desktop >1499px: validate the original N2-B main column/utility rail before changing breakpoints. 1024/768/390/320 and all supported themes: one contiguous mobile reading order, no decorative empty panels or horizontal overflow, keyboard/touch hit targets >=44 where possible.
- Visual craft: reuse existing FlyTally semantic palette, Inter/system UI fonts, 11px control and 17px card radii, canonical spacing; remove redundant nested chrome, align page hierarchy, use measured whitespace not ornament. No new library, brand/palette or full app CSS overhaul.
- Motion decision: NONE. Preserve hover/focus/pressed/async semantics without visual-only status.
- Design reference prototype (external LOCAL artifact created in this chat only): `FlyTally_Dashboard_D1_V3_Concept.html`, static synthetic HTML design study, no runtime connection or new GitHub app code. Do not claim it is an app-verified layout.

## Proposed ROADMAP amendment — NOT CANONICAL until owner decision
> D1 dashboard design phase: owner decision A (retire front-page customization compatibly) or B (expand with approved widgets) pending. First milestone D1-V3 DOM/CSS composition under frozen existing read model and saved user layouts; accept proven B1 copy and accessibility fixes compatible with chosen scope. Independently review concept (DeepSeek/Claude read-only). Implement smallest reversible branch with exact SHA tests. Then D2 Flights, D3 Add Flight GPS/Manual. No direct main/deploy/DB/flags or Training work.

## Acceptance and hard stops
- Pre-change screenshot baseline = owner D1-A 30 PNG + 30 measurements exact capture HEAD `e57a888367022b672329026c6ef709da950dbc3c`. Tested 320/390/768/1024/1440 in light/dark, with >1499, 200% zoom, night/native Safari as NOT RUN.
- Verify actual computed cascade from `app/layout.tsx` (late `app/ui-system.css`) and `app/dashboard-customization.css` before any CSS change. No speculative style cleanup.
- Regressions: saved widget preferences including reordered hidden/gps disabled and legacy user selections, no invisible reset, no role/flight data semantics changes, totals exact, 1 flight/landing plural correct, feature redirects and side nav correct, keyboard/VoiceOver semantics and touch.
- Authoritative owner-local scoped development/risk planner, Node/TypeScript/build, isolated PG fixture and authenticated Playwright on exact work SHA as selected by DEVELOPMENT.md; no PASS claims from static design or image only.
- No merges, releases, production schema migrations/flag edits, new external components/fonts or autonomous redesign of Flights/New Flight.
- Legacy feature retirement is a decision that must be explicitly frozen before implementation.

## Next step
Owner chooses A, B, or C after inspecting the standalone V3 concept and tradeoffs; then freeze architecture/compatibility/acceptance and request one independent read-only DeepSeek review before any major UI code change.
