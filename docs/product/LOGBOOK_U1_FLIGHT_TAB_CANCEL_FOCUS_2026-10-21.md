# Logbook U1 — keyboard tab focus after cancelled unsaved switch

**Status:** Draft implementation / tests NOT RUN on this source head.  
**Source:** initial U0 source audit + separate Flight Detail implementation review; not falsely attributed to U0 screenshot coverage.  
**Scope:** `components/flight-detail-workspace.tsx`, one existing E2E regression and one focused source contract test.

## Before
Flight Detail uses `role=tablist` with roving `tabIndex`. ArrowLeft/ArrowRight/Home/End call `selectTab(nextTab)`, then unconditionally `nextTab.focus()`. When the active logbook form has unsaved changes and pilot cancels `window.confirm`, `selectTab` retains selected tab and preserved data, but focus moves to a **different, unselected tab**. Result: selected tab (`aria-selected=true`) no longer owns the keyboard focus, misleading keyboard/screen-reader interaction.

## Frozen behavior / Do Not
- Unsaved prompt wording and pilot decision remain unchanged.
- Cancel must retain the current tab, corrections and `unsaved` state; no hidden data discard or auto-approval.
- `submitting` must block real tab transitions; same-tab keyboard action may remain focused.
- Preserve existing tab order, ARIA roles, roving tabIndex, badges and focus affordance.
- No flight model, authority/recency, persisted state, CSS, migration or Training changes.

## Small implementation
- `selectTab` returns a boolean to report whether a proposed tab selection is accepted: true for already-selected tab and accepted switch, false when submitting or user cancels the unsaved-change prompt.
- Keyboard handler focuses `nextTab` **only** when selection was accepted. Pointer click and workflow-navigation call sites keep the same domain semantics.
- Existing certified-correction Playwright scenario now exercises ArrowLeft from `Logbook data` with a deliberately unsaved arrival field, cancels dialog, and checks focus/selection and unchanged unsaved edit.
- Added `tests/logbook-u1-flight-tab-focus.test.ts` source contract checks. Source assertions are **not** a substitute for E2E.

## Acceptance / verification
1. Branch exact-head `npm run test:target -- tests/logbook-u1-flight-tab-focus.test.ts`, TypeScript typecheck and related pre-existing tab/certification unit tests — **NOT RUN**.
2. Browser: `e2e/manual-authority-certification.spec.mjs` on a dedicated verified disposable database with canonical schema v21 — **NOT RUN**; do not reuse or weaken the U0-only browser harness. In particular no production database.
3. Manual keyboard: ArrowRight/Left/Home/End works without unsaved edits; switching with unsaved edits and choosing OK still selects/focuses target; Cancel keeps selection/focus/value; while submitting, no other tab focus.
4. Responsive/dark visual behavior unchanged; screen-reader/native iPad Safari — **NOT RUN**.
5. Keep PR Draft until targeted tests and independent review; no merge, deploy or migration based on code inspection alone.

## Owner-local acceptance attempt — 21 Oct 2026

- Owner switched to `fix/logbook-u1-flight-tab-cancel-focus-20261021`, targeted source test **2/2 PASS**, `npm run typecheck` **PASS**, independent optimized Next.js build **PASS** (41/41 static routes).
- Exact dedicated U0 disposable DB `flytally_ui_u0_20261021` @ `127.0.0.1:5433`: owner, role, schema registry v1–v21 and fixture user preflight **PASS**. A non-destructive, grep-filtered desktop Chromium Playwright test was run; fixture now contains synthetic test mutations, not an empty DB.
- `e2e/manual-authority-certification.spec.mjs`, `--grep "3.4.0 Manual explicit Save"`, **1 FAIL** before U1 keyboard assertions: after initial `Save & certify flight`, `Flight saved and certified.` not found within default 5-second expectation at existing `e2e/manual-authority-certification.spec.mjs` ~line 254. Page screenshot/trace/error context produced locally but **NOT RECEIVED**. No conclusion whether slow redirect, blocked certification or runtime defect.
- Related pre-existing `e2e/gps-rolecrew.spec.mjs` explicitly waits up to 20 seconds for the real post-save redirect. Increasing timeout or altering certification behavior **NOT AUTHORIZED** until failure evidence is inspected. **U1 browser feature test NOT REACHED**, therefore browser acceptance **BLOCKED**, not PASS.
- Next: inspect sanitized Playwright screenshot/error-context/trace and read-only isolated fixture row for `2026-10-05`, registration `OK-E2E`, off-block `12:00`; only then decide whether to adjust wait/assertion or investigate certification.
- No production DB, merge, deploy, release or Training changes.

## Failure artifacts reviewed and narrow test correction (21 Oct 2026)

- Owner uploaded `FlyTally-U1-Playwright-Failure.zip`, containing `error-context.md`, failed screenshot and the full Playwright trace; plus read-only PostgreSQL row for fixture `OK-E2E` / `2026-10-05` / off-block `12:00`: `id=2`, `arrival=LKPR`, **CERTIFIED, revision 1**.
- Browser screenshot and accessibility snapshot at failure: still on `/flights/new`, with both save controls in disabled pending state (`Saving draft…`, `Saving & certifying…`); no validation error. Trace shows `POST /flights/new` initiated and not completed in the captured network record by test teardown. The test's default `toBeVisible` expectation timed out after **5 seconds**. This is a synchronization / late response problem with an otherwise persisted certified fixture row, **not proof that the certification action failed**.
- Source-equivalent neighboring `e2e/gps-rolecrew.spec.mjs` already waits up to **20 seconds** for the post-save detail redirect before asserting certified state. This precedent is adopted in this one E2E: initial save and draft Enter wait for a real detail URL (20 s); R2 correction already begins on a detail URL, so it explicitly waits up to 20 s for the completion banner instead. Certifying success text, R1/R2 badge, database integrity and old-revision evidence are still independently asserted. No runtime code or certification service changed.
- Targeted source test gains a synchronization contract assertion; new-head tests/browser **NOT RUN**. The fixture now contains synthetic certified data and must be verified before another run.
- This resolves the diagnosed **test waiting defect in source only**; a successful Playwright rerun remains required for U1 acceptance. If the real redirect or certificate state is absent within 20 s, **fail closed** and inspect trace/DB, do not increase the timeout repeatedly.

## Fourth owner-local E2E — complete acceptance PASS (21 October 2026)

**Tested source branch/head:** `fix/logbook-u1-flight-tab-cancel-focus-20261021` at `f6db89b7c7b427f01563811e58753d82640ae92a`, based on owner-local `git pull --ff-only` fast-forward to `f6db89b7` immediately before the commands. Changes after that tested head are governance documentation only; no runtime/E2E/test source modification.

- `node --check e2e/manual-authority-certification.spec.mjs` — **PASS** (local).
- `npm run test:target -- tests/logbook-u1-flight-tab-focus.test.ts` — **5/5 PASS** (local, 216.5 ms), including 90-second scope and focus source assertions.
- `npm run typecheck` — **PASS** (earlier U1 local execution on the unchanged runtime source). Optimized `npm run build` — **PASS**, Next.js generated 41/41 static pages (earlier owner-local build on the unchanged app code; not rerun at final head). This is not CI.
- Verified before browser run: exact local disposable PostgreSQL 18 database `flytally_ui_u0_20261021` @ `127.0.0.1:5433`; database/current user/owner exact match; no superuser, no createdb; registered schema up to v21; local test session secrets >=32 chars. No production DB.
- `e2e/manual-authority-certification.spec.mjs` `--project=desktop-chromium --grep "3.4.0 Manual explicit Save" --retries=0` — **1/1 PASS (47.3 seconds)**. Explicit assertions passed: new R1 certification; R1 archival; correction draft R2; keyboard ArrowLeft + user Cancel preserved selection, focus and unsaved arrival; persisted draft not silently changed; R2 recertified with archived R1 hash intact; Enter at /flights/new resulted in **DRAFT**, not accidental certification; no root horizontal overflow.
- Non-blocking Next.js root/package-lock warning; slow-server-task diagnostic output observed. No errors reported by successful browser run.
- Verification limits: scoped Chromium desktop only, not native Safari/iPad; full-suite, CI, separate accept-dialog navigation, submitting-state focus, screen reader and production smoke **NOT RUN**. Browser tests used a mutable synthetic fixture, **not an empty DB**.
- Result: **U1 core acceptance PASS, ready for owner review**. Still Draft PR #378; **not merged, not deployed**. Broader device/assistive acceptance remains U5.

## Third owner-local E2E attempt — test-wide 30s budget exhausted (21 Oct 2026)

- Owner pulled branch `8e459473`, JS syntax PASS, focused Node source tests **4/4 PASS**, verified the exact local disposable DB owner, role, no-superuser and v21 schema.
- Browser made it all the way through R1 creation and certification, archived R1 -> R2 draft correction, canceling unsaved keyboard tab selection with focus/persisted draft invariants, re-certification of R2 and reload. No failing assertion was reported before the test's last Enter-as-draft sequence.
- At the final `input[name="arrival"].press("Enter")`, `expect(page).toHaveURL(...,{timeout:20_000})` was interrupted by the **test-wide 30,000ms timeout** while the page still showed `/flights/new`. **No evidence yet that Enter failed to submit**: a shorter outer test deadline superseded the step's remaining wait. A final draft row and full E2E PASS remain UNVERIFIED.
- Repo precedent: `e2e/gps-rolecrew.spec.mjs`, `e2e/airport-elevation.spec.mjs`, and `e2e/trash-integrity.spec.mjs` scope longer, multi-action browser tests to 60–90s. Narrow fix adds `test.setTimeout(90_000)` only to this `3.4.0` scenario. 20s response bounds, real redirects and persisted certification/archived-hash checks remain unchanged; test source contract verifies that final Enter/draft checks remain.
- **New head syntax, Node, build, Playwright: NOT RUN**. On rerun, if final Enter still fails within its 20s step budget, capture fresh browser trace and fixture row (13:00) before altering behavior. No data model, Server Action, production or Training changes.

## Second owner-local E2E attempt — R2 observation blocked (21 Oct 2026)

- Owner reported clean targeted Node source tests **3/3 PASS**, exact disposable DB identity/owner/v21 preflight PASS, then desktop Chromium targeted Playwright **1 FAIL**.
- The initial `Save & certify` redirect + R1 lock badge **both passed** with corrected waiting. The next step clicked `Open correction R2`, but old 5s default `toContainText("CORRECTION R2")` still read `CERTIFIED R1`. The later U1 keyboard regression remained **NOT REACHED**. Owner did not yet supply a new trace or query of current correction revision: R2 mutation completion in this run is **UNVERIFIED**, not assumed.
- Source review of `startCertifiedCorrection` (server action): explicit correction writes the archived R1 snapshot, conditionally opens the draft R2, updates sharing/verification state, then awaits `refreshRecencySnapshot` and revalidates the detail page; it does **not** redirect. The existing 5s browser-visible badge expectation may expire before a legal UI refresh, but the current logs alone do not prove the action eventually completed.
- Staged narrow **E2E-only** correction: wait up to 20s for `CORRECTION R2` on the existing detail page; immediately assert synthetic DB `record_revision=2|DRAFT` and exactly one archived revision R1. These are strict fail-closed acceptance checks, not a runtime bypass. All existing keyboard cancellation, unsaved arrival and recertification hash checks remain.
- New-head targeted Node/Playwright/build **NOT RUN**. If the badge fails at 20s or the DB invariants disagree, collect fresh trace/DB evidence before touching actual certified-correction logic. No production DB, migration, main merge or deploy.

## Branch and evidence
- Branch: `fix/logbook-u1-flight-tab-cancel-focus-20261021`, created from main `8099149f72d493c34dd59babf65bdb064ff99fc9`; no dependency on pending U0 PR #377.
- Local Node/Playwright/build/typecheck/DB: NOT RUN on this branch at time of authoring.
