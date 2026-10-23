# Logbook navigation and global UI/UX — scoped redesign audit (2026-10-23)

**Status:** DISCOVERY / SOURCE REVIEW ONLY. No approved solution, implementation, browser acceptance, PR merge, production change or release. Video review PENDING.

## Frozen owner objective

Review **main menu, wayfinding and overall visual consistency of FlyTally Logbook** with the merged Logbook Agent Skills V1 and Apple Design V2. Work toward this goal in small milestones; DO NOT detour into unrelated bugs, flight-domain behavior, Training, database, migrations, auth, GPS/performance, infrastructure or other draft PRs. Unrelated findings may be recorded separately as deferred, never fixed incidentally. Preserve approved FlyTally identity, existing behavior and aviation evidence unless the owner explicitly approves a scoped change.

## Source authority and verified repository

- Repository: `filipto861/flytally-logbook`, canonical `main` full SHA `c68e6a2758423ab862cf9b03f5623515d07433e4` at discovery.
- PR #388 Agent Skills V1 merged into `f1052cac8d518342bfdf10c6f03b51199d78ad69`; PR #390 Apple Design V2 merged into the above `main` SHA. Loaded full `.agents/skills/README.md`, `apple-design/SKILL.md`, its entire 17-section `references/APPLE_DESIGN_PLAYBOOK.md`, `ui-ux-design`, `design-engineering`, `mobile-ipad`, `ui-quality-audit`, `testing-quality` skills from exact `main`.
- Existing separate Draft PRs #377 (U0 browser baseline), #378 (Flight tab focus), #379 (text legibility), #380 (narrow Flights categories) and #389 (skills docs checkpoint). DO NOT combine or rebase them into this effort without explicit scoped decision.
- Vercel project `filipito/logbook`: latest inspected READY production deployment `dpl_4XGBawGy187VyJpG5nyRFe2p2fKW` from Git SHA `34b865bb0ced1222945cecb107589826890ee31a`; this is not the latest docs-only `main`. Live authenticated UI/screenshot/browser verification NOT RUN.

## Current navigation inventory — code evidence, NOT visual observation

- `components/sidebar.tsx`: primary **Add flight** action `/flights/new`; core destinations Dashboard `/dashboard`, Flights `/flights`, Map `/map`, Statistics `/statistics`.
- “Pilot & records” group: Licences & recency `/credentials`, Aircraft & airports `/database`, Connections `/connections`, Print & data `/data`, Settings `/profile`. Admin role additionally sees Administration `/admin`; Sign out separately; notification bell in header.
- Flights remains the active parent for `/flights/*` and `/fstd`; active location uses `aria-current="page"`. Existing `tests/v300-navigation-hierarchy.test.ts` and `tests/v300-sidebar-polish.test.ts` freeze some intentional grouping decisions. Any regrouping requires explicit design review and adjusted tests, not an incidental rename.
- Desktop sidebar can collapse; preference uses `localStorage("logbook-sidebar")`. At `<=820px`, the header is fixed and nav opens as a scrollable left drawer with backdrop, Escape, focus trap and scroll lock. A coarse pointer at `>820px` can use a centered 44px edge handle. Do not assume emulated iPad behavior equals native Safari.
- `app/layout.tsx` imports many historical CSS layers, finally `app/ui-system.css`. Navigation selectors are also split between `app/globals.css`, `app/theme.css`, `components/sidebar.module.css`, `app/v300-u6-acceptance.css` and `app/ui-system.css`. Computed final styles, screenshots and responsive runtime remain UNVERIFIED.
- Existing `docs/design-language.md` describes frozen brand (colors, logo, typography direction), token spacing/card geometry, 24px SVG icon language; use current code/cascade over historic written assumptions.

## Focused design investigation (questions, NOT claimed defects)

1. **Wayfinding & IA:** Is it instantly clear where the user is and how to reach common destinations? Is “Pilot & records” the best grouping without altering domain workflow or existing task-oriented intent?
2. **Hierarchy & visual rhythm:** Do Add flight, current location, section headings and tertiary options have the correct visual weight across desktop/expanded/collapsed and narrow navigation?
3. **Cross-page consistency:** Inspect shared tokens, effective cascade, headers, cards, spacing, controls, states; identify only app-wide design differences that materially affect this redesign.
4. **Mobile/iPad usability:** Examine drawer width, discoverability, scrolling, focus return, safe areas and coarse-pointer edge handle with actual video/real browser; no assumptions from source alone.
5. **Feedback & access:** Keyboard/focus, touch target, disabled/loading/error states where directly linked to menu or shared chrome; reduced motion/contrast. Motion decision: **NONE by default**, switch to SIMPLE only if a demonstrable navigation clarity benefit.
6. **Adversarial content:** Long translated labels, very narrow 320px width, browser zoom, collapsed navigation, empty/notification count, multiple themes; synthetic only.

## Acceptance and DO NOT

- Audit output: observed vs source-inferred vs unverified finding, location, severity, affected component, minimal in-scope fix, test, deferred items; avoid a speculative redesign or shotgun refactor.
- Video and preferably matched screenshots are required before making claims about current visual or interaction defects. Current video **NOT RECEIVED**.
- Preserve current color/font/logo and operational semantics; no new libraries, gratuitous glass/blur/animation, auto-prefill/auto-apply, unrelated CSS cleanup, altered records or schema.
- No merge, deploy, production DB migration/restore/delete or feature flag change without explicit approval.
- Verification so far: GitHub source/files/branch/PR/skills read **PASS (inspection)**. Typecheck/Node/build/Playwright/native Safari/visual regression **NOT RUN**. Database/migrations/flags **UNKNOWN / NOT TOUCHED**. Production READY verified as historical deployment metadata only.

**ONE NEXT STEP:** Analyze the owner's forthcoming screen recording against this source inventory, then prepare a constrained, evidence-labeled navigation/design proposal for owner's approval before editing runtime UI.
