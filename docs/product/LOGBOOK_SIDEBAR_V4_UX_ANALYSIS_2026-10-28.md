# FlyTally Logbook — Adaptive Sidebar V4 UX analysis (PROPOSAL ONLY)

**Date:** 2026-10-28. **Owner feedback:** authenticated production desktop expanded + compact screenshots: V3 control relocation to bottom rejected; compact buttons judged off-center, inconsistent and visually fragmented. This is an owner-provided visual finding (NOT automated UI/browser/native test).

**Status:** analysis proposal for review, **NOT OWNER-APPROVED IMPLEMENTATION**. No V4 CSS/JS/test changes, no new authorization to merge/deploy/DB/flag edits.

## Verified baseline
- Canonical `main@484d84c33f34c5049a30a28aecc0a957bc6d9d07`.
- Work `feat/adaptive-sidebar-v3-20261028@4ff3101f7b714d0ee4da609e16ae176468a4f626` (PR #425 OPEN DRAFT), base `feat/flights-balanced-glassless-trial-20261028@a79e8d44df89d52bfd4363adf42050a4fb0c3319` (PR #424 OPEN DRAFT on main).
- `fly-tally.com` Vercel deployment `dpl_129w49urPKA4W6M3Kb5i3GsSLen5` READY at source `09814685067b9ce153b8ee0d8ffa6b933f628c6f` verified read-only on 2026-10-28.
- Current V3 `components/sidebar.tsx` puts `.sidebar-layout-controls` below `nav` and above sign-out; `app/sidebar-adaptive-v3.css` applies `position:static; inset:auto; transform:none` to `.sidebar-toggle`, replacing earlier edge-aligned affordance. It also contains different geometry for nav links (46px), More (46px + margin-top 10px), brand notification (40px), and collapse and sign-out; legacy `components/sidebar.module.css` adds `!important` margins for primary CTA. Visual alignment must be confirmed via computed layout before fix.
- Older `app/ui-system.css` placed a sidebar-edge control near the top on pointer-fine desktop; earlier v3.5.5 specialized `@media(min-width:821px) and (pointer:coarse)` uses 44x44 edge handle at `50dvh`. This approved tablet behavior must be considered rather than silently erased.

## Proposed V4 interaction contract (pending owner choice)
1. Keep **two persistent states**, Slim 218px and Compact 78px, existing URLs, grouping and role-gated More; do not introduce third mode.
2. Desktop pointer-fine: use one 44x44 **rail-edge toggle** attached to right boundary near brand/header top, same vertical position and icon meaning before/after collapse. Prefer quiet opaque token background, 11–14px radius, 20px panel-direction icon and clear focus ring. Avoid tiny external chevron and avoid bottom toolbar relocation. Let x-position move with rail width while y-position remains anchored.
3. Tablet/coarse >=821: preserve/validate accessible 44x44 **vertically centered edge handle** from original v3.5.5, unless owner explicitly opts for one common top-edge position after hardware review. Never overlap content or steal primary touch gestures.
4. Compact 78px: one centered geometry for all interactive dock surfaces: 48x48px hit/visual boxes, 20px SVG icons, consistent inline spacing, 6–8px vertical rhythm; center each relative to rail width, not only its own differing box. Use one 40–42px centered non-interactive brand mark. Notification bell, Add Flight, four primary nav routes, More and Sign out should align on same x-axis. Keep Add Flight semantically primary with existing brand green, active full rounded tint for nav, other idle surfaces visually quiet and no arbitrary frames.
5. More must be unmistakably secondary navigation: use an ellipsis/explicit More glyph rather than an ambiguous settings/sliders pictogram. Preserve keyboard Escape, opener focus return, outside click and role-specific entries.
6. Expanded Slim: text, controls and icon columns aligned to a fixed leading inset; toggle belongs to rail edge, not internal bottom stack. Sign out stays low priority in footer. Keep brand + notifications logically grouped and accessible.
7. <=820px mobile: leave existing top-bar/drawer and focus-lock behavior unchanged unless actual regression is demonstrated. Light/dark/system appearance, keyboard, reduced motion and zoom supported.

## Root-cause / severity (2026-10-28)
| Finding | Evidence | Severity | Proposed narrow remedy |
| --- | --- | --- | --- |
| Collapse toggle moved to footer | screenshot OBSERVED + `sidebar.tsx` / V3 CSS CODE VERIFIED | MAJOR usability | Restore edge-affordance near upper header on pointer fine; preserve coarse touch edge model |
| Compact dock lacks consistent centering and visual rhythm | screenshot OBSERVED; mixed CSS heights/margins CODE VERIFIED | MAJOR visual consistency | One shared compact nav-button geometry and axis; remove conflicting specificity narrowly |
| More icon reads as configuration, not more routes | screenshot OBSERVED + `NavIcon manage` CODE VERIFIED | MINOR discoverability | Semantically clear More icon + accessible label |
| Existing text/ARIA focus, persistence and mobile drawer | source contracts CODE VERIFIED, actual browser behavior NOT RUN | REGRESSION RISK | Keep handlers/routes and test with keyboard + persisted state |

## Proposed acceptance / verification before deployment
- Desktop 1440/1786 widths: button anchored to sidebar edge, reachable with one hand/pointer and unchanged y after collapse, no obstruction of Dashboard/Flights.
- Compact 78px: all clickable surfaces centers share one x-axis; no special CTA/More/sign-out margins or inconsistent radii; 44px minimum target (48 proposed). Text-only labels are screen-reader available; icon tooltips are accurate.
- Tablet 768/1024 and portrait/landscape: >=821 coarse edge handle behavior verified; <=820 drawer remains accessible. Phone 320/390; keyboard Tab/Enter/Space/Escape and focus visible; both light/dark and reduced motion.
- Check FINAL computed cascade after module rules and last `app/sidebar-adaptive-v3.css` import. Repeat target source tests plus actual authenticated Playwright responsive/keyboard check; physical iPad Safari remains NOT RUN until owner tests.
- Motion: SIMPLE only for existing short rail width transition; NONE for new decorative effects; reduced motion = no width animation.
- DO NOT touch flight records, recency logic, status rails, Glassless list / BLOCK–AIR corrections, data, auth, DB, migrations, production flags, brand colors, libraries or Training.
- Independent AI second review not necessary for a narrowly approved CSS/JS navigation fix unless material behavior/architecture expands.

**One next step:** owner reviews proposed V4 rail-edge toggle + centered compact geometry and approves/adjusts design before implementation on PR #425 branch. No merge or production deployment without separate permission.
