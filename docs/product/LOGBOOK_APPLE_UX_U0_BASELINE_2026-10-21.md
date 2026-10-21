# Logbook Apple-style UX — U0 read-only visual baseline

**Status:** ACTIVE / source inventory prepared; authenticated browser capture NOT RUN.
**Repo/baseline:** filipto861/flytally-logbook, main 8099149f72d493c34dd59babf65bdb064ff99fc9 (21 October 2026).
**Owner scope:** Logbook only. FlyTally Training is out of scope.

## Why U0 exists

Visual polish must follow actual rendered evidence, not a broad CSS override or an assumption from an isolated declaration. Apple Design is a behavior and usability reference: immediate feedback, clarity, direct manipulation where useful, and restraint. Existing FlyTally colors, logo, brand and functional contracts remain frozen.

## Existing truth to preserve

- docs/design-language.md owns the existing approved tokens, icon/spacing/typography direction, touch/focus rules, and effective-cascade precedence.
- docs/ux-audit.md records the historical 2026-09-19 audit and Batch 1–11 closeout. Do not reopen UX-001–039 without a new reproduction; UX-027 was expressly a false premise.
- app/layout.tsx imports legacy/versioned CSS plus the final canonical app/ui-system.css, so computed CSS must be measured before each correction.
- components/pending-action-button.tsx already provides pending label, disabled, aria-busy, and data-loading. New loading UI should reuse this contract.
- components/flight-entry-workspace.tsx offers explicit manual/GPS selection; do not infer last aircraft or airport.
- Flight certification, revision/audit evidence, monetary values, recency, shared participants and KML/GPX/CSV source semantics are not design-layer state.
- GPS Detection 2.0 research was retired. Preserve the original GPS import/review and existing track processing.

## U0 source inventory: current code / research targets

| Area | Evidence path | Source-grounded risk / question | Next measurement |
| --- | --- | --- | --- |
| New Flight readability | app/ui-system.css | Helper copy uses .66rem/.7rem in several entry areas | Actual computed size, line height and contrast on all devices |
| Sidebar | components/sidebar.module.css; components/sidebar.tsx | Fixed heights, .67rem headings and !important specificity; mixed glyph/SVG icon patterns | Effective dimensions, focus and touch target widths, expanded/collapsed |
| Flight detail tab focus | components/flight-detail-workspace.tsx | Keydown can focus next tab after an unsaved-change cancel prevented selection | Reproduce Cancel vs Confirm keyboard interaction, no data mutation |
| Aircraft photo | components/aircraft-photo-editor.tsx | Fit/Crop + pointer capture exist; rapid file selection lacks an apparent request-epoch guard | Controlled file race and WYSIWYG cover comparison |
| Dashboard | app/(protected)/dashboard/page.tsx; components/dashboard-editor.tsx | Duplicate Add flight entry points may be intentional; dashboard editor has bespoke pending presentation | Task-based screenshot/feedback comparison, no premature deletion |
| Flights & GPS | app/(protected)/flights/page.tsx; components/kml-import-form.tsx | Dense table and review states need visual/click-through validation | Mobile rows, statuses, controls, review/warning scope |
| Maps | app/(protected)/map/page.tsx; app/ui-system.css | Effective overlay/popover geometry depends on viewport and theme | Layer/popup touch, overflow, dates, labels and map legibility |
| Credentials and recency | app/(protected)/credentials/page.tsx; components/recency-compliance-workspace.tsx | Source/evidence status must never become a false CURRENT label | Read-only status/empty/error presentation |

Only the source properties above are confirmed. A source-level opportunity is NOT a proven browser-visible defect.

## Capture contract

Use the existing opt-in e2e/ui-audit-capture.spec.mjs. U0 augments its captured JSON with representative effective computed values and small-target/overflow observations. It does not assert visual PASS or automatically modify the application.

Viewport matrix: 1440×1100 desktop, 1024×768 iPad landscape, 768×1024 iPad portrait, 390×844 mobile, 320×720 narrow mobile. Both light and dark for every viewport. The test emulates touch/coarse pointer on iPad/mobile in Chromium; this is NOT Safari or physical device evidence. Maintain the existing isolated-fixture core route coverage: login, dashboard, flights, connections, settings and New Flight states (blank, registration, PIC, DUAL, Safety Pilot, advanced disclosures).

Capture output remains under test-results/ui-audit/: screenshots plus ui-audit-metrics.json. Verify calculated styles against screenshot; the computed style alone does not identify the winning CSS source selector. Gather that separately in browser devtools when an issue is confirmed.

Capture does not include authenticated private flight screenshots from real users. The runner initializes disposable test fixtures and may reset them.

**Destructive fixture guard:** The generic bootstrap issues `DROP SCHEMA public CASCADE`. For U0, `--ui-audit-v21` refuses execution unless `FLYTALLY_UI_AUDIT_V21=1`, `FLYTALLY_UI_AUDIT_CAPTURE=1`, `FLYTALLY_AUTH_BROWSER=1`, `FLYTALLY_LOCAL_POSTGRES=1`, the exact audit spec/project/args, and the exact named local DB URL. It checks effective DB owner and non-superuser/no-createdb privileges *before* resetting; repeats identity + canonical registry checks before applying v20/v21. Refuse or abort on any mismatch. Existing rows from the first failed run are disposable browser fixtures and will be replaced in this named audit DB only.

## Safe owner-local execution (first attempt BLOCKED; corrected runner NOT RUN)

1. Obtain latest branch and install dependencies locally with Node version matching repo configuration.
2. Verify DATABASE_URL points to a disposable localhost PostgreSQL cluster with no real data. Never point the fixture reset at Neon/production or a valuable local database.
3. Configure the existing local browser fixture, then in PowerShell:

~~~powershell
$env:FLYTALLY_AUTH_BROWSER = '1'
$env:FLYTALLY_LOCAL_POSTGRES = '1'
$env:FLYTALLY_UI_AUDIT_CAPTURE = '1'
$env:FLYTALLY_UI_AUDIT_V21 = '1'
node tooling/run-auth-browser.mjs --ui-audit-v21 e2e/ui-audit-capture.spec.mjs --project=desktop-chromium --retries=0 --workers=1
~~~

4. Record the tested Git SHA, fixture DB identity (without credentials), command/exit code and screenshots + JSON evidence. If guard/preconditions fail, stop. Do not bypass the harness.
5. Review screenshots manually, including any apparent contrast, clipping, pointer targets and text zoom; open a numbered issue only when route, state, viewport and reproduction are known.

## U0 acceptance / handoff to U1–U5

- U0 is not complete until visual evidence exists on the exact tested code, including before screenshots and computed styles for each proposed correction.
- Every finding must state route, selector/component, state, viewport, theme, expected/actual behavior, root cause, severity and whether CONFIRMED or NEEDS REPRODUCTION.
- U1: narrow focus/correctness issues first; U2: typography/icons/cascade; U3: Flight/Aircraft workflows; U4: small motion pilots; U5: acceptance and actual-device checks.
- Separate PRs; no bulk CSS delete, no implicit data prefill, no invented recency authority, no editing certified/immutable flights.

## U0 owner-local Playwright acceptance — 21 Oct 2026 (new evidence)

**Exact tested git head:** `1ce6cc0e17d2845f7dc6b5925301e15fb9552478` (the owner reported `git pull --ff-only` as already up to date before executing the test; independent local SHA printout is still requested if there is any ambiguity).

- Local owner report: `node --check e2e/ui-audit-capture.spec.mjs` PASS; guarded `--ui-audit-v21` pre-bootstrap URL/role/owner validation PASS; disposable fixture bootstrap PASS; canonical v20/v21 registry/12 columns/4 CHECKs PASS.
- `node tooling/run-auth-browser.mjs --ui-audit-v21 e2e/ui-audit-capture.spec.mjs --project=desktop-chromium --retries=0 --workers=1` → **Playwright 1 passed in 2.9 minutes, 0 failed** and independent disposable schema-first v21 physical postcheck PASS, according to the provided PowerShell log.
- Screenshot contents and JSON measurement artifact **NOT YET RECEIVED / NOT REVIEWED**. This passes the automation collection gate, not the visual design acceptance gate.
- Browser run is Chromium viewport/touch emulation, not native iPad Safari. Nonblocking Next.js root/package-lock warning was emitted; no browser error was reported.
- This is local evidence, not GitHub Actions CI. No merge, deploy, production DB change or app/CSS fix.

## Evidence at this commit

- Source/roadmap review: DONE, pinned to stated baseline.
- First owner-local screenshot attempt (21 Oct 2026) used the original generic `run-auth-browser.mjs` path: FAIL/BLOCKED. Local Next build and TypeScript passed (41/41 static pages). Browser fixture bootstrap held only v1..v19, application correctly refused implicit Currency v21 DDL. Login stayed on `/login`; Playwright 1 FAIL. No UI conclusions from this run. Existing isolated U0 DB was confirmed owner-owned, empty and unprivileged before that run.
- Second owner-local browser attempt (21 Oct 2026) on `c9eb1b44`: original 11/11 targeted tests and all three `node --check` commands PASS; U0 DB purpose/owner, fixture bootstrap and canonical v20/v21 migrations + physical checks PASS. Runtime no longer reports `SESSION_SECRET` after owner set distinct 64-character local-only session/signing secrets, but screenshot test **1 FAIL** on its 5-second login URL assertion; route still `/login`. Actual app login rejection vs slow action vs cookie issue is **NOT DETERMINED** by that output.
- Follow-up test-only instrumentation aligns U0 login wait with existing 15-second `e2e/browser-actions.mjs` helper, compares pathname, and on failure reports only generic login UI alert, submit busy/disabled and pathname; never records credentials, cookies or connection secrets. **New-head browser outcome NOT RUN.**
- Corrective U0-only purpose `--ui-audit-v21` now uses exactly the existing canonical v20/v21 SQL in a guarded migration step between generic fixture reset and Next startup; strict DB name `flytally_ui_u0_20261021`, owner/role same, localhost `127.0.0.1:5433`, explicit flags, source registry and physical postchecks; no production or generic currency bypass. The original Currency v21 purpose remains separate. **New U0 runner Playwright: NOT RUN.**
- Physical Safari/iPad: NOT RUN.
- TypeScript, Node, build, DB, deploy: NOT RUN / N/A for this source-only stage.
- No user data, runtime behavior, CSS or application routes changed.
