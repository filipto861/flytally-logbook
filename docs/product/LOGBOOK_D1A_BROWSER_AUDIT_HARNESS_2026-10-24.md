# D1-A Dashboard — guarded browser audit harness (2026-10-24)

## Authority and scope
Repository: filipto861/flytally-logbook. Baseline main SHA 470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9. Owner priorities Dashboard -> Flights list -> Add Flight GPS and Manual. Existing D1 source audit is separate Draft PR #408. This branch adds measurement infrastructure, not a redesign.

## Files
- e2e/d1-dashboard-visual-audit.spec.mjs: opt-in authenticated Chromium capture through existing Playwright configuration, with a synthetic user in an isolated local fixture.
- tooling/run-d1-dashboard-audit-local.ps1: guarded Windows runner. Creates new private GUID-qualified PostgreSQL 16/18 cluster on 127.0.0.1 with a new empty flytally_currency_test DB. Verifies DB identity, physical data directory and empty public schema before synthetic fixture bootstrap. Builds Next.js and runs the existing Playwright browser test. Cleans up the owned cluster after execution.
- This document: execution, scope and acceptance.

## Owner-local execution
Use a CLEAN checkout of branch test/logbook-d1-dashboard-visual-audit-20261024. Node 24, PostgreSQL 16/18, repo dependencies and Playwright Chromium are prerequisites. From Windows PowerShell:

    git fetch origin
    git switch test/logbook-d1-dashboard-visual-audit-20261024
    git pull --ff-only
    npm ci
    npx playwright install chromium
    powershell -NoProfile -ExecutionPolicy Bypass -File .\tooling\run-d1-dashboard-audit-local.ps1

Save the produced FlyTally-D1-Dashboard-Audit-<HEAD12>.zip and share it for review. Never send browser storage state, environment files, passwords, database cluster, user flight records or GPS data.

The runner refuses CI, Vercel, another Git branch, tracked worktree modifications, an occupied HTTP port 3000 and pre-existing target evidence directory. If a cluster cannot be stopped, it is preserved rather than removed unsafely.

## Matrix
Five sizes: 1440x900 desktop, 1024x768 iPad landscape emulation, 768x1024 iPad portrait emulation, 390x844 mobile, 320x720 small mobile. Two themes: light and dark. Three states: overview, editor open, preset modified but unsaved. This produces 30 screenshot PNG files plus sanitized dashboard-audit.json with final computed surfaces, component geometry, horizontal overflow, move-button target sizes, accessibility status regions, widget ordering and recency affordance presence.

Source-guided findings only: potential 34px dashboard reorder targets, editor contrast inconsistencies, absent save announcement semantics, layout/typography consistency. Any measurable issue must be reviewed against screenshot and effective CSS before implementation. Neither a captured screenshot nor a passed capture script means the UI is visually accepted.

## Not verified
Native iPad Safari and VoiceOver NOT RUN. Zero-flight account and save/server race NOT RUN. Production authenticated browser NOT RUN. No code changes to flight data, recency engine, GPS, save, SQL, schema, flags, production deployment, brand tokens or Training.

## Evidence
GitHub source saved on test branch, JS stripped-import V8 syntax inspection PASS (advisory). Node 24, PowerShell, PostgreSQL fixture, production build and Playwright execution NOT RUN in assistant environment. Production remains G3 READY at deployment dpl_ABShRChWDdg4oCzuygKMvQHX3oSe on SHA 470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9; no change requested or made in this branch.

ONE NEXT STEP: execute the guarded owner-local screenshot runner and review the resulting 30 captures plus measurements, then freeze a narrow D1-B UI batch for independent read-only DeepSeek review before implementation.
