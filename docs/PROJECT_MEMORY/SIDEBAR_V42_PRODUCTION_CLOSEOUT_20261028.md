# FlyTally Logbook — Sidebar V4.2 production deployment checkpoint

Date: 2026-10-28 UTC. This is an **evidence record**, not an approval to merge or change resources.

## Owner scope
The owner approved Sidebar V4.2 Quiet Header visual concept and explicitly requested implementation **and Vercel production deployment**. No owner authorization for GitHub PR merge, database migration/change/restore/delete, production feature flag changes or FlyTally Training.

## Git and affected files
- Canonical Logbook main SHA: `484d84c33f34c5049a30a28aecc0a957bc6d9d07`.
- Work branch: `feat/adaptive-sidebar-v3-20261028` (Draft PR #425), stacked base `feat/flights-balanced-glassless-trial-20261028@a79e8d44df89d52bfd4363adf42050a4fb0c3319` (Draft PR #424 on main). Neither PR merged.
- Tested complete runtime/test module SHA: `7b45a9295c2e031a581adb65b49c66ea17e93446`.
- **Actual deployed Git SHA:** `b590e8750b9c4f9302e5e85bd2351a3dc23dca48`; GitHub compared it with tested SHA: only a new Markdown evidence file changed. No changed executable, test, dependency or build files.
- Runtime: `components/sidebar.tsx`, `components/sidebar.module.css`, `components/nav-icon.tsx`, `app/layout.tsx`, new `app/sidebar-adaptive-v42.css`. Scoped tests `tests/sidebar-adaptive-v42.test.ts`, updated `tests/v136-mobile-ux.test.ts`, `tests/v300-sidebar-polish.test.ts`; registry `tooling/development-modules.json` explicitly owns three inherited/new CSS assets and new navigation tests.
- UI behavior: single 44px in-flow Slim header toggle, vertically stacked Compact logo/toggle, centered 48px nav/More controls, one notification instance in desktop footer and at upper-right of <=820px mobile bar, unchanged routes/persistence/permissions/more-Escape/mobile drawer; existing semantic flight status rails and iPad BLOCK/AIR clock containment unmodified.

## Executed evidence
- **PASS**: isolated Node 24.22.1 Git checkout and `npm ci` at executable/test SHA; focused original+V4.2 11/11 Node checks; `npm test` full 1755/1755 at predecessor `3f18618420ad18d0a57653770b908bc5cd9d3ccf` (subsequent changes only UI test group registry and Markdown); current `npm run test:ui` 135/135 at `7b45a9295c2e031a581adb65b49c66ea17e93446`; `npm run typecheck` and `npm run build` at that SHA; advisory `npm run audit:design` exit0, six pre-existing heuristics.
- **PARTIAL**, NOT authenticated app browser acceptance: Chromium Playwright on sandbox with all imported effective CSS layers + representative synthetic sidebar DOM. Ten screen/theme/state viewport geometry cases passed (1440/1024 desktop, 820/768 tablet, 390/320 phone): rail width, nonoverlay toggle/logo/content, Compact control x-centers, mobile bell/menu separation and horizontal overflow. Actual signed-in Next.js app browser interactions and native Safari/VoiceOver **NOT RUN**.
- Risk planner classified browser=true, postgres=false, fullTests=true, build=true. Browser gate remains **NOT RUN**; do not claim an overall canonical release gate PASS. No isolated PostgreSQL testing required for UI-only scope; Postgres tests N/A.
- **Vercel production:** project `logbook` / `prj_GYFLbRQjVyjn82Xnre5qZjz8UlAQ`, deployment **`dpl_J6Npxj6JDW3saSakz2YmtZKYSPL3` READY**, build logs show real Next 16.3.2 compile and TypeScript PASS, static generation 41/41, outputs deployed. Alias `fly-tally.com` independently resolves to that exact deployment and deployed Git SHA. No alias mismatch; prior production rollback `dpl_129w49urPKA4W6M3Kb5i3GsSLen5` remains a reference, not invoked.
- **Public anonymous smoke:** HTTPS `/login` HTTP200; unauthenticated `/dashboard` and `/flights` finish at `/login` HTTP200. Deployment-specific Vercel error/fatal runtime log query returned no entries in checked recent window, but grouped runtime-errors endpoint returned provider error and its check is **UNKNOWN**. No authenticated application smoke performed.
- No production DB/migrations/flag changes, no feature flags, no Training changes; production DB/flag readback **UNKNOWN**. No secrets/private flight/GPS data stored.

## Limits and one next step
Native physical iPad Safari, mobile drawer keyboard VoiceOver, authenticated account actions, and real-flight list layout on the new version remain **NOT RUN**. Production visual trial is READY at correct SHA, not evidence of a certified / fully accepted release.

**ONE NEXT STEP:** owner signs into `https://fly-tally.com` and tests V4.2 on desktop and a physical iPad: Slim/Compact, top toggle and no overlap, Notifications footer, More/Escape, Flights table horizontal scroll; reports screenshots/defects. Keep #425/#424 Draft and do not merge without separate express authorization.
