# FlyTally Logbook — Sidebar V4.2 compact geometry defect correction (2026-10-28)
Status: **implemented on work branch; NOT deployed**. Owner supplied authenticated desktop production screenshots showing visually left-offset top toggle SVG and missing button frames in Compact. This was a visual defect report and fix request; no new explicit production deployment/merge/DB authorization.

## Grounding
Canonical main: `484d84c33f34c5049a30a28aecc0a957bc6d9d07`. Work source/test SHA `23e46b6f7147b655b98a77379bcd8e3a01e62011` on `feat/adaptive-sidebar-v3-20261028`, Draft PR #425, stacked over Draft PR #424 `feat/flights-balanced-glassless-trial-20261028@a79e8d44df89d52bfd4363adf42050a4fb0c3319`.
Current production remained V4.2 READY at Vercel `dpl_J6Npxj6JDW3saSakz2YmtZKYSPL3`, Git `b590e8750b9c4f9302e5e85bd2351a3dc23dca48`, alias `fly-tally.com` (read-only verification at task start). This CSS correction is **not live**.
Source ownership: `app/sidebar-adaptive-v42.css` and `tests/sidebar-adaptive-v42.test.ts` only. No auth, flight data, UI route, DB, schema, Training, shared design token, dependency or production flag modifications.

## Root cause and correction
The final V4.2 CSS used `display:grid;place-items:center` for the 44px header toggle but inherited `justify-content:flex-start` from an older, higher-priority sidebar rule. Measured representative Chromium final cascade: 44px button center x=183, 20px SVG center x=172 (11px error). Fix overrides `justify-content:center;place-content:center`. Browser after change confirms identical button/SVG centers.
Compact 78px nav already used 48px hit surfaces but idle destinations, More and footer controls had transparent backgrounds and borders. New scoped CSS restores consistent `var(--surface)` background and `var(--line-soft)` border for inactive route/More/notifications/Sign out while preserving green Add Flight and full selected-row tint. Hidden Compact link/sign-out labels now `display:none` rather than occupying flex layout; attention badges are absolute so they cannot shift icons. Hover/focus feedback uses existing `var(--surface-hover)` and `var(--line-strong)`. No decorative motion; existing reversible toggle and reduced-motion behavior preserved.

## Exact-SHA evidence
- **PASS** at `23e46b6f7147b655b98a77379bcd8e3a01e62011`: `npm run test:ui` 138/138; `npm test` 1758/1758; `npm run typecheck`; `npm run build` (Next 16.3.2). Node 24.22.1 nonpersistent Vercel sandbox clean Git checkout. Earlier intermediate SHA focused source tests 13/13 PASS; not substituted for final tests.
- **PARTIAL** UI geometry: final Chromium Playwright representative HTML with actual CSS import order, 5/5 final source widths/modes PASS for SVG toggle center, Compact 48px axis/frame, hover, no overflow; earlier implementation SHA geometry 11/11 with light/dark/night and 320–1440 width PASS. Both synthetic fixtures, NOT an authenticated FlyTally runtime test. Real Safari/iPad/VoiceOver **NOT RUN**.
- Candidate-bound development-scope planner: `shell-presentation`, risks `ui-presentation,ui-contract,test-contract`, `typecheck=true`, `build=true`, `postgres=false`, `browser=false`, `fullTests=false`, UI test group required. Extra Node suite and synthetic browser checks were performed.
- DB/migrations: N/A, no actions. Feature flag change: none, current prod flag readback UNKNOWN. Production deployment: not performed. PR merge: not performed.

**DO NOT:** deploy production, merge PR #425/#424, change DB/flags or Training without separate owner authority. Do not infer native Safari PASS from Chromium.

**ONE NEXT STEP:** obtain explicit owner approval for a new Vercel Logbook production deployment of this exact scoped CSS fix, then re-verify branch/PR/source SHA and target, deploy and check READY/alias/authenticated owner visual state.
