# FlyTally Logbook — adaptive sidebar visual decision (28 October 2026)

**OWNER-APPROVED FOR IMPLEMENTATION AND SEPARATE MANUAL PRODUCTION REVIEW; CODE IN DRAFT PR #425, NOT MERGED.**

## Approved intent and visual contract
Owner reviewed iPad Sidebar V2 Compact Dock and Slim Sidebar concept and explicitly requested **both views as two collapsible/expandable states of the SAME global sidebar** (not mutually exclusive designs). Current production sidebar also retains collapsed navigation in local storage; do not break this behavior.

- **Compact / collapsed:** narrow icon dock, primary navigation and accessible item names, one-tap Flights/Dashboard/Map/Statistics, a visible reversible expand control. More/Records remains accessible via labelled menu. Keep usable workspace width for iPad Flights table.
- **Slim / expanded:** restrained, rounded sidebar showing icons **plus text labels**, meaningful Workspace and Pilot & Records grouping, same navigation routes, clear one-tap collapse control and preservation of active route.
- **Selected route:** softly colored fill across the **whole rounded nav button**, using current semantic FlyTally color tokens; **remove green inset stripe / colored left rail on sidebar navigation buttons**. Preserve border/background contrast, icon + text or accessible label, focus-visible, and textual route semantics.
- Critical distinction: this ban affects **sidebar NAVIGATION decoration only**. **Do not remove certified/draft/correction/locked left-side status indicators on flight RECORD rows**. Those are semantic record-state cues and remain as implemented in current V2.
- Keep existing brand/logo, rounded components, neutral Glassless surfaces, small button touch targets **>=44 CSS px**, keyboard/escape + focus return for menus, simple or no motion, reduced-motion respect, contrast/light and dark, iPad portrait/landscape, phone mobile drawer. No libraries, no new routes and no invented flight facts.
- Sidebar remains app-wide shared component, not exclusive to Flights. Scope must be reviewed independently from Flights Draft PR #424 to avoid coupling global-shell redesign into that existing release candidate.

## Concept prototype / QA
- Local-only standalone interactive prototype: **FlyTally Adaptive Sidebar V3** (HTML and compare screenshots attached to owner conversation, not committed to GitHub). Contains only synthetic flight records and illustrative navigation controls; no authentication, product data/API, server mutation or GPS.
- The prototype adds an explicit in-sidebar expand/collapse 44px button, preserves the tabular content and scan state, eliminates the sidebar active-item left stripe and keeps existing record-status row indicators.
- Chromium **12/12 responsive-theme combinations PASS** in standalone study: iPad landscape/portrait/phone x collapsed/expanded x dark/light, with 44px touch sizing, full tinted active nav, no CSS sidebar active shadow, retained synthetic flight record-state rail and no document overflow. Explicit sidebar toggle click and Enter key, focus retention, menu Escape/focus return, sample filtering **PASS**.
- **Not executed:** authenticated real FlyTally shell, actual Next.js code changes, full Node/TS/Next/PG suites, native iPad Safari touch/VoiceOver, production route functionality. No production deployment and no DB/feature flag changes during this prototype iteration.

## Project context and change authority
- Canonical logbook `main@484d84c33f34c5049a30a28aecc0a957bc6d9d07` verified on 2026-10-28. Existing active Flights code work `feat/flights-balanced-glassless-trial-20261028@a79e8d44df89d52bfd4363adf42050a4fb0c3319`, Draft PR #424 OPEN, unmerged. Production `fly-tally.com` READY on `dpl_Hbu1FtwhrGCebg8d551SNTJUrAmi` source `0eb002f382400f906732b255bc9889ecb7b43b81`.
- This selection authorizes **concept refinement only**. It does **NOT** authorize production/global sidebar code edits, PR merge, deployment, DB/migrations, feature flags, Training or changing current main roadmap priority.
- Relevant source when implementation is separately approved: `components/sidebar.tsx`, `components/sidebar.module.css`, `components/notification-bell.tsx`, `app/ui-system.css`, `app/globals.css`, `app/v300-u6-acceptance.css`. Verify final specificity/CSS cascade before editing; no blind override.

**ONE NEXT STEP:** Owner reviews V3 interactive collapse/expand study and explicitly approves or requests final adjustments; only then propose a separately scoped implementation milestone/branch with proper app regression tests and device checks.

## Implementation checkpoint — 2026-10-28
- Draft PR #425 `feat/adaptive-sidebar-v3-20261028`, stacked on active unmerged Glassless V2 PR #424 branch; no direct main edits. Source/test checkpoint `c12de53686df44624ed3f6eb9a146d5ab817a16d`.
- Changes exactly shared `components/sidebar.tsx`, `components/nav-icon.tsx`, `app/sidebar-adaptive-v3.css`, `app/layout.tsx` import and source contract test `tests/sidebar-adaptive-v3.test.ts`.
- Compact <=78px icon dock with 44–46px targets and accessible More popover; expanded 218px labelled sidebar, persistent existing `localStorage("logbook-sidebar")`, keyboard Escape/focus return, mobile <=820px existing drawer. Icon-only links retain accessible names. Active navigation uses full fill without left strip, flights record source-status rails preserved.
- Node24 source mirror test 6/6 PASS at exact candidate SHA above; initial 5/6 fail from unnecessary legacy !important CSS override, removed and retested. Full actual browser, PG, full Node, native iPad Safari NOT RUN; Vercel build pending. No data/DB/flag/Training modification or merge; deployment requires owner explicit permission (already given for visual trial, only). Motion NONE.
- **ONE NEXT STEP:** pin exact documentation-checkpoint HEAD and run owner-authorized manual Vercel production build, verify READY + alias, then owner checks iPad and desktop.
