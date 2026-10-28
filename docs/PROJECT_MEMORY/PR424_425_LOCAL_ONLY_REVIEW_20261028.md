# 2026-10-28 — PR #424 + #425 read-only pre-merge audit, PC-only test requirement

**Status:** source review PARTIAL; release/merge acceptance NOT RUN. Owner explicitly requests verification **on their Windows PC**, not Vercel Sandbox or GitHub Actions because of limits. This is an audit/test-plan authorization, **NOT merge/deploy/DB/flag approval**.

## Verified source identity (GitHub read-only)
- Logbook canonical `main@484d84c33f34c5049a30a28aecc0a957bc6d9d07`.
- Draft PR #424 OPEN, source `feat/flights-balanced-glassless-trial-20261028@a79e8d44df89d52bfd4363adf42050a4fb0c3319`, base main. Compare: 46 commits ahead, zero behind, 8 files changed (new `app/flights-balanced-glassless.css`, `tests/flights-balanced-glassless.test.ts`, final CSS import and docs).
- Draft PR #425 OPEN, source `feat/adaptive-sidebar-v3-20261028@3f3062026f126e8bd016fd6aaa4868e1594df7a7`, base #424 exact SHA above. Compare #424->#425: 52 commits ahead, zero behind, 22 files (sidebar TSX/icon/module, `app/sidebar-adaptive-v3.css`, `app/sidebar-adaptive-v42.css`, tests/tooling, CSS imports and docs). Stacking is intentional; neither merged.
- Vercel production alias `fly-tally.com` is READY `dpl_isy3ZVcV3pN9H7gwLpBDku9iYhHU`, deployed Git `f8d412171a8cbb12cdfcae88d9c23735938fcb53` from #425. GitHub compare tested source `23e46b6f7147b655b98a77379bcd8e3a01e62011` to production was documentation-only, as documented in prior checkpoints.
- No migrations/DB schema/API implementation changes in either PR changed-file list; no server authorization changes detected by the changed-file inventory. No current production DB/flags readback: UNKNOWN.

## Findings — distinguish evidence
1. **Dependency / merger order (MAJOR, CODE-VERIFIED):** #425 is based on #424, not main. Validate #424 first. If #424 is squash-merged, #425 must be carefully restacked/reviewed against the new main to avoid duplicate patch/history/docs; do not naively retarget/merge without comparing. No merge authority yet.
2. **Flights 701–760 CSS breakpoint overlap (MINOR / NEEDS LOCAL BROWSER CHECK, CODE-INFERRED):** `app/v140-flights.css` changes Flights table to mobile cards at `max-width:760px`; #424 `app/flights-balanced-glassless.css` applies `min-inline-size:1220px`, clock cells >=124px and table-scroll overflow at `min-width:701px`. The 701–760 window therefore matches *both* rules and is absent from earlier reported 768+ geometry checks. Inspect e.g. 720px actual CSS/DOM for horizontal clipping before merge; do not state regression as observed without browser evidence.
3. **Accessibility menu behavior (MINOR / UNVERIFIED):** #425 `components/sidebar.tsx` conditionally inserts `div.sidebar-more-panel` with an `aria-label` but no semantic `role`; Escape and focus return are wired, but robust keyboard/screen-reader announcement and touch dismissal need a targeted local authenticated or synthetic real-component browser check. Do not treat static regex tests as browser PASS.
4. **Description/documentation drift (MINOR, VERIFIED):** PR #425 title/body retain "V3" and initial trial notes while final shipped implementation is V4.2. Normalize title/description and keep prior decisions historically, after owner approves PR readiness. Multiple docs/checkpoint commits are expected; use small scope and avoid direct main updates.
5. **Positive scope finding (VERIFIED):** #424 CSS selectors are bounded to `data-n2-layout="flights"` and preserve record-state markers in existing stylesheet; #425 keeps role-gated More routes, collapsed preference, single NotificationBell and original mobile drawer. Native desktop/iPad owner visual approval exists, not independent interaction testing.

## Safe owner-PC verification plan
- Use a new isolated Windows directory (not owner's current working checkout), Git read-only clone/fetch and **pinned full SHAs** for #424 and #425; Node 24.x and repo lockfile. No GitHub Actions or Vercel Sandbox.
- #424: `npm ci`, source scope classification, `npm run test:target -- tests/flights-balanced-glassless.test.ts`, TypeScript and production build; optionally separate browser geometry at 720/768/1024/1440 where fixtures exist.
- #425: `npm ci`, scope classification for sidebar files, `npm run test:ui`, aggregate `npm test`, TypeScript/build, read-only `audit:design`; test Compact/Slim+More/Escape/Notifications on desktop and physical iPad separately.
- Do NOT run `test:postgres`, `verify:postgres`, `verify:browser:risk` or `verify:release:risk` automatically, as these can require **isolated disposable localhost PostgreSQL/browser fixtures**. First inspect risk planner output, then arrange guarded owner-local acceptance if REQUIRED; remote/Neon DB never used.
- A standalone PowerShell review script has been created as a **conversation-local artifact**, not committed to repo. It does not run tests by itself; the owner must download/execute it on their PC and return the `RESULTS.md` logs. Record actual executed evidence after receiving them; all new PC test results remain **NOT RUN** at this checkpoint. CI NOT RUN by owner policy.

## DO NOT / ONE next step
No merge #424/#425, no deploy/DB/flags/migrations, no Training. 
**ONE NEXT STEP:** owner executes the pinned Windows PC test script and shares `RESULTS.md`, then reconcile reported risk requirements and any 720px concern before proposing a safe merge sequence/approval.
