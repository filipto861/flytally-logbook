# FlyTally Logbook — Sidebar V4.2 Compact alignment correction PRODUCTION deployment checkpoint

Date: **2026-10-28 UTC**. Owner approved this specific corrective Vercel production deployment in chat (`schvaůuji`) after real authenticated screenshot defect report. This approval did not authorize GitHub merge, DB/flag/migration work, or FlyTally Training.

## Verified source, branch, PR and actual deployment
- Canonical Logbook `main`: **484d84c33f34c5049a30a28aecc0a957bc6d9d07** (GitHub read-only at release).
- Work branch: `feat/adaptive-sidebar-v3-20261028` — deployed pinned full HEAD **f8d412171a8cbb12cdfcae88d9c23735938fcb53**, Draft PR **#425 OPEN** stacked on Draft PR **#424**, base `feat/flights-balanced-glassless-trial-20261028@a79e8d44df89d52bfd4363adf42050a4fb0c3319` (#424 base main). No merge.
- Tested code and test SHA **23e46b6f7147b655b98a77379bcd8e3a01e62011**; GitHub compare from tested SHA to deployed SHA showed **only five Markdown changes** (CHANGELOG, ROADMAP, SESSION_HANDOFF, ACTIVE_WORK and product design/QA note), no executable/test/tooling files.
- Deployed to existing Vercel project **logbook** / `prj_GYFLbRQjVyjn82Xnre5qZjz8UlAQ`, target **production**. Deployment **dpl_isy3ZVcV3pN9H7gwLpBDku9iYhHU**, verified **READY**. Git source and alias **fly-tally.com** both separately resolved through Vercel to **f8d412171a8cbb12cdfcae88d9c23735938fcb53**. Real production build logs showed Next.js successful compilation, TypeScript and deployment completed.
- Previous production rollback reference (NOT invoked): `dpl_J6Npxj6JDW3saSakz2YmtZKYSPL3`, Git `b590e8750b9c4f9302e5e85bd2351a3dc23dca48`.

## Changes
- Only executable file `app/sidebar-adaptive-v42.css`; related tests `tests/sidebar-adaptive-v42.test.ts`. CSS fix explicitly centers the 20px navigation glyph in the 44px upper toggle rather than inheriting `justify-content:flex-start`. Compact 78px rail: common 48x48px quiet rounded frame for idle navigational destinations, More, Notifications and Sign Out, exact x-axis with active Dashboard and green Add Flight; hidden text takes no flex space; attention badge is positioned so it cannot offset icons. Hover/focus feedback restored with existing tokens.
- No changes to other flights, certification/recency logic, auth, navigation routes, mobile drawer logic, layout imports, aircraft data, dependencies, migrations, database, production flags or Training.

## Verification at tested executable/test SHA
- **PASS** `npm run test:ui` **138/138**; `npm test` **1758/1758**; `npm run typecheck`; `npm run build`; Node 24.22.1 sandbox isolated Git checkout.
- **PASS (synthetic-only)** Chromium representative final effective CSS/DOM geometry and hover targeted 5/5, plus earlier intermediate broad 11/11 viewport/theme check. Not authenticated browser acceptance, native iPad Safari, VoiceOver or screenshot confirmation.
- Candidate planner: `shell-presentation`, `ui-presentation` / `ui-contract` / `test-contract`; typecheck+UI source-contract+build required; `browser=false`, `postgres=false`, `fullTests=false`. Full Node tests were additional.
- Live build/TS Vercel **PASS** and alias/READY **PASS**. Vercel new-deployment filtered error/fatal logs query showed no entries in the checked window; **not evidence of absence of all errors**. Direct HTTP path smoke from this agent runtime was **NOT VERIFIED** (DNS/web tool access unavailable). Owner authenticated desktop and native iPad visual acceptance **NOT RUN** for newly deployed version.
- Production DB/schema/migrations/flags: **no actions**; state/readback **UNKNOWN**. No main merge. Preserve PR Draft and existing rollback target.

## DO NOT / next
DO NOT merge PR #425/#424, change production DB/flags, invoke test fixtures on production, modify FlyTally Training or assert native Safari/real-user browser PASS without separate authorization and evidence.

**ONE NEXT STEP:** owner reloads `https://fly-tally.com/dashboard` and tests Slim/Compact on authenticated desktop, specifically alignment/48px frames/toggle, then shares screenshot; check physical iPad separately for touch and scroll.
