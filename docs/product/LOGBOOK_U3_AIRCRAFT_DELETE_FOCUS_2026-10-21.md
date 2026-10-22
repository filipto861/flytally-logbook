# U3 — Aircraft delete completion focus / initial unsampled-workflows audit

**Date:** 2026-10-21  
**Repo/branch:** `filipto861/flytally-logbook`, `fix/logbook-u3-aircraft-delete-focus-20261021`  
**Base:** `main@8099149f72d493c34dd59babf65bdb064ff99fc9`  
**Status (latest owner-local evidence, 22 Oct 2026):** PR #381 OPEN/DRAFT/unmerged. Exact executable SHA `9837776aedb3ab10d090a8ef538ccba88da1c479`: isolated local PG18/v21 fail-closed identity/schema PASS, U3 browser syntax PASS, frozen browser structure **15/15 PASS**, and hardened U3 Playwright **2/2 PASS (54.7 s, retries 0)** with desktop and Chrome touch emulation of 320/390/768/1024 × light/dark. Runtime unchanged from earlier source 3/3 and TypeScript/build PASS. Candidate-bound release plan and its selected additional gates, CI, manual screenshot review, native Safari NOT RUN. No merge/deploy. Historical sections below are dated snapshots.

## 22 October 2026 — hardened U3 browser acceptance PASS on exact runnable SHA

Owner provided the full console transcript from `C:\\Users\\filip\\Documents\\GitHub\\Logbook`. `git pull --ff-only` fast-forwarded local U3 checkout to `9837776aedb3ab10d090a8ef538ccba88da1c479` (GitHub verified branch HEAD before documentation-only checkpoint). `node --check .\\tooling\\u3-browser\\aircraft-delete-focus.spec.mjs`: **PASS**. `npm run test:target -- tests/browser-suite-structure.test.ts`: **15/15 PASS**, 0 fail/skip.

After a first direct Playwright attempt ended with **0/2 PASS** because the new PowerShell shell lacked `DATABASE_URL` (fail-closed, before synthetic DB operations), owner executed one atomic PowerShell block: verified exact Git branch/SHA, available local PostgreSQL 18 client, absence of Vercel flags, read-only physical identity of dedicated PG18 `127.0.0.1:55433/flytally_ui_u3_20261021` role `flytally_u3`, existing v21 schema evidence **`1|12|4|21`**, and port 3000 free; then set exact process-only test flags and generated temporary secrets if needed. **Preflight printed `U3 DATABASE PREFLIGHT PASS` after actual SQL/identity guards.** It ran:

```powershell
npx.cmd --no-install playwright test --config=playwright.u3.config.mjs --workers=1 --retries=0
```

Result **`2 passed (54.7s)`**, followed by **`U3 PLAYWRIGHT PASS`** and `Previous environment restored.` in `finally`. This is direct evidence for hardened shared DB preflight, desktop delete status focus + no replay, saved-flight delete protection, and 320/390 mobile + 768/1024 iPad **Chromium touch emulation** in light/dark, real-focus/DB assertions. It is **not** native iPadOS Safari, a screen-reader test, or visual screenshot acceptance.

**New head after documentation updates:** product runtime and browser script unchanged since tested executable SHA; documentation commits are evidence only. Exact U3 browser quality gate is **PASS** for the tested executable. The source regressions 3/3, TypeScript and build 41/41 were earlier owner-local on the unchanged runtime module, not rerun in this session. CI, full application suite, candidate-aware release planner/evidence and manual screenshot review remain **NOT RUN**. No production DB/feature-flag/merge/deploy operation.

**One next step:** run read-only `npm run verify:plan -- --base origin/main` from a current clean U3 checkout to discover risk-selected final release gates, then review before any destructive or production-facing command.

---

## Update 22 Oct 2026 — dedicated U3 browser test was blocked before scripted SQL

On work code `a3a6f95158df8fc0950b65796a6f2622e51f5121`, Windows `node --check` dedicated config/spec PASS, `tests/browser-suite-structure.test.ts` **15/15 PASS**. Owner launched the dedicated Playwright suite; both selected tests **FAIL with `TypeError: Invalid URL`** at `new URL(process.env.DATABASE_URL||"")`, before scripted SQL, browser login, deletion or responsive assertions. This shows the new terminal lacked valid U3 `DATABASE_URL`. It is NOT evidence for or against the aircraft-delete focus fix. Any trace/screenshot is only a failure artifact.

**Safety rule for retry:** Do **not** run generic `test:browser` or `test:browser:local` or reapply v21 migration: they are not the U3 workflow. Preserve separately owned PostgreSQL 18 `127.0.0.1:55433/flytally_ui_u3_20261021` role `flytally_u3`; verify local server identity and existing v21 state read-only before setting in-session URL and purpose flags. Expected SQL identity: `flytally_ui_u3_20261021|flytally_u3|127.0.0.1|55433|18xxxx`. Expected existing canonical schema evidence `1|12|4` (named migration v21, 12 currency columns, four validated CHECK constraints). `FLYTALLY_AUTH_BROWSER=1`, `FLYTALLY_LOCAL_POSTGRES=1`, `FLYTALLY_U3_SCHEMA_FIRST=1`; `VERCEL` and `VERCEL_ENV` must not be set. Run exact dedicated `npx --no-install playwright test --config=playwright.u3.config.mjs --workers=1 --retries=0` in that same verified PowerShell session only if all guards PASS. No fixture replacement, SQL writes during preflight, secrets in logs or port-55439 PG16 substitutions.

## Scope and source finding

The U0 visual capture did **not cover** Aircraft Manage/delete, aircraft photo crop, Flight Detail edit/correction, or GPS import. This U3 milestone inspects these high-value interactive workflows from source rather than claiming additional screenshot coverage.

- **Aircraft manager — source-confirmed keyboard focus loss on successful deletion:** `components/aircraft-manager.tsx` has a proper modal Escape/tab loop and `closeModal()` returns focus to the "Manage aircraft" opener. However, the successful `deleteSelected()` path currently calls `setLibraryStatus(result);setSelectedId(null)` without returning focus. The modal is removed, and its opener belongs to the aircraft card that is being deleted; focusing it is not a reliable fallback after the card disappears. `libraryStatus` already renders a visible confirmation paragraph outside the dialog with `role="status"`.
- **Aircraft photo/crop:** `components/aircraft-photo-editor.tsx` already has Escape, tab loop, opener-focus restoration, processing errors and save pending feedback. Do **not** reimplement that prior fix based on stale audit history.
- **Flight Detail tabs:** on canonical main, keyboard navigation still has a cancellation/focus mismatch. It is **already** addressed independently in draft U1 PR #378 with owner-local evidence. Do not duplicate into U3.
- **GPS import:** `components/kml-import-form.tsx` uses source-backed parsing, explicit user review and `PendingActionButton` on save. Its multi-part, aircraft and evidence workflows need dedicated authenticated visual/interaction coverage; no additional GPS regression claimed solely from this read-only review. V2 research is retired; no revival here.
- **Flights mobile categories:** independently staged in Draft PR #380, not combined here. U2 typography remains separate in Draft #379.

## Frozen U3 micro-batch solution

After a **successful** delete action only, focus the visible, non-interactive library confirmation outside the removed modal; it must be programmatically focusable (`tabIndex=-1`), keep its current role, copy, styling and DOM order. Schedule focus from a React effect so the target exists after the modal unmounts; cancel pending animation on effect cleanup. Failed deletion keeps modal open and its existing inline alert; the normal Escape/Close focus return remains unchanged.

**Do not** modify the delete server action, eligibility check, flight count, soft/hard-delete behavior, any data model, aircraft count, photos, rates, stored flights, certification evidence, migration, auth, design tokens, or GPS code.

## Acceptance (NOT RUN until user executes)

1. Focused read-only source regression: success results render and focus the `role=status` library confirmation; failure leaves dialog open; normal Close/Escape still return to opener, no new unguarded delete. No reimplementation of crop UI.
2. `npm run typecheck`, `npm run build` on exact Draft head.
3. Authenticated browser on **named isolated synthetic DB only**, exact source and user permission verified first: keyboard-open no-flight aircraft → Delete aircraft → Delete permanently → modal disappears → success status visible and focused. Ensure keyboard can proceed to next control; no focus to removed DOM. Blocked aircraft with saved flights must keep delete disabled; failed delete keeps inline error and dialog. Escape, Cancel/Close return opener. Desktop Chromium plus iPad/mobile viewport and light/dark when feasible. Explicitly distinguish emulation from native Safari.
4. No production data change, no merge/deploy without owner authorization. If browser E2E needs new data fixtures, design and review isolated fixture setup before executing any destructive SQL.

## Deferred U3 route-wide audit

Create an evidence matrix for Aircraft crop/photos, Flight Detail correction, GPS multi-part import, Statistics and notifications on synthetic authenticated pages, including focus, primary CTA, pending/error/empty states, truncation, 320/390/768/1024 widths, light/dark. Treat U0 unsampled areas as **not visually verified**. Prefer one concern per small batch; do not conflate with U1/U2/U0-R01. After evidence review, prioritize fixes by severity/verified frequency.

## Owner-local first source/build run and follow-up source review (21 Oct 2026)

- Owner fetched `origin/fix/logbook-u3-aircraft-delete-focus-20261021` and switched into the branch with `git status --short` empty before checkout, then ran `npm run test:target -- tests/logbook-u3-aircraft-delete-focus.test.ts`: **2/2 PASS**; `npm run typecheck`: **PASS**; `npm run build`: **PASS** (Next.js 16.3.2, TypeScript clean, static page generation **41/41**). Local Windows PowerShell/Node 24 evidence reported by owner. Corresponding remote commit/source head **`916a8a8807a6c009b8babc29dad5b45ccb2a023b`**, based on remote branch state at checkout; no local `git rev-parse HEAD` output, so association is branch-switch evidence rather than independently printed local SHA. This is local, not CI.
- Post-test read-only source review identified **a follow-up focus-replay edge case**: the original effect depends on `[libraryStatus, selectedId]`. After a successful delete, leaving `libraryStatus` mounted, opening another aircraft and then closing its modal changes `selectedId` back to null and would requeue focus to the **old** delete status, possibly stealing focus from the just-closed modal opener.
- **Subsequent source-only amendment, NOT RUN:** add `focusedLibraryStatusRef` identity guard and mark the particular successful result once inside the scheduled focus callback. This preserves normal Close/Escape focus to the current Manage opener on later aircraft dialogs. Adds a third focused source regression test (still source-level, not a browser behavioral test). No data deletion/business logic changes.
- The earlier **2/2 tests/typecheck/build PASS do not validate this later code head**. Rerun focused tests, typecheck and build for the revised SHA; authenticated browser focus acceptance including success→open another card→Escape/Close remains NOT RUN.
- Review criterion: reopening and closing a second aircraft dialog must **not** focus the earlier deletion success; a second successful deletion (new result object) must focus its own status once.

## Revised-head owner-local static verification — 21 October 2026

- `git pull --ff-only` advanced local U3 branch from `916a8a88` to `c257ec9c9aa9b8038ce700f184771193f1d973e8`.
- `npm run test:target -- tests/logbook-u3-aircraft-delete-focus.test.ts`: **3/3 PASS**, zero fails/skips.
- `npm run typecheck`: **PASS** (`tsc --noEmit`).
- `npm run build`: **PASS**, Next.js 16.3.2, compiled successfully, TypeScript clean, generated **41/41** static pages.
- This owner-local evidence covers the amended once-per-result focus guard. Runtime focus on actual aircraft deletion and follow-up Close/Escape remains **NOT RUN**, as do authenticated browser and native mobile/iPad checks, full suite and CI. No DB/migration or deploy.
- Older `NOT RUN` and 2/2-first-head notes below remain historical snapshots, superseded **only for static gates** by these 3/3 results. PR #381 remains Draft pending browser acceptance and owner merge decision.

## Verification ledger

- Source inspection of current main and PR separation: **DONE** (GitHub connector).
- Exact-head Node tests/typecheck/build/browser: **NOT RUN**.
- DB/migration: **N/A for source patch**; no mutations attempted.
- Merge/deploy: **NONE**.

## U3 authenticated Desktop Chromium acceptance — owner-local PASS (21 Oct 2026)

**Evidence provenance:** Owner provided Windows PowerShell output from `C:\\Users\\filip\\Documents\\GitHub\\Logbook`, branch `fix/logbook-u3-aircraft-delete-focus-20261021`. `git pull --ff-only` fast-forwarded `c2e74c48` -> `fd67eee235dfd1daa103ed4095a3d8100af0f4fb`; following this, owner performed all checks below in the same shell. This is **local**, not GitHub Actions / CI.

- **Test DB isolation:** Dedicated user-owned PostgreSQL 18 cluster, `127.0.0.1:55433`, database `flytally_ui_u3_20261021`, role `flytally_u3`. Owner verified exact database URL, `FLYTALLY_AUTH_BROWSER=1`, `FLYTALLY_LOCAL_POSTGRES=1`, `FLYTALLY_U3_SCHEMA_FIRST=1`, and absence of `VERCEL` / `VERCEL_ENV`. Existing U0 database on 5433 was not used. **Only this disposable U3 DB was bootstrapped and migrated.**
- **First browser attempt (historical FAIL):** `npm run test:browser -- e2e/logbook-u3-aircraft-delete-focus.spec.mjs --project=desktop-chromium --workers=1 --retries=0` reset the U3 fixture, and Next auto-applied v20 before failing closed on missing approved v21. Login stalled; no U3 delete behavior was exercised. A first U3 schema-first helper required exactly v1–v19 and refused the now-v20 registry; no SQL change from that rejected attempt.
- **Schema-first recovery (PASS):** Corrected `tooling/apply-u3-v21-disposable.mjs` checks exact canonical v1–v20 registry and applies **v21 only**, using source SQL from `lib/db-optimization.ts` in a transaction and verifying the v21 registry entry, 12 columns and four validated CHECK constraints. Owner ran `node --check .\\tooling\\apply-u3-v21-disposable.mjs` **PASS** and `node .\\tooling\\apply-u3-v21-disposable.mjs` **PASS**, log: `Disposable U3 schema-first v21 only: registry 21, columns 12, CHECKs 4 PASS.`
- **Authenticated real-browser U3 test (PASS):** `npx playwright test e2e/logbook-u3-aircraft-delete-focus.spec.mjs --config=playwright.config.mjs --project=desktop-chromium --workers=1 --retries=0`: **1 passed (9.7 s)**. The test exercises login; delete of synthetic no-flight `OK-U3ZZ` through the UI; confirmation visibility and actual focused DOM target; DB absence of deleted row; opening another aircraft and closing via Escape returns focus to its opener without stale success-focus replay; `OK-E2E` saved-flight profile remains protected by a disabled delete button and exists in the DB. This test does **not** exercise a forced server failure, pending-submit timing or a second successful deletion.
- **Source/type/build gates:** Owner-local targeted Node source regressions **3/3 PASS** on amended runtime code; `npm run typecheck` PASS (earlier verification), and a subsequent `npm run build` PASS with Next.js 16.3.2, TypeScript completed and 41/41 static pages. The latter build preceded test-only U3 E2E/helper commits, which do not change application runtime code. No claim of exact documentation-head build or full-suite PASS.

**Outstanding acceptance / scope:** U3 keyboard-focus behavior is verified on **Desktop Chromium only**. Mobile Chrome/iPad emulation, native Safari, light/dark visual review, forced failure/duplicate-submission behavior and full regression suite/CI remain **NOT RUN**. None of this constitutes general U0 visual audit completion. Review/merge/deploy are owner decisions. **PR #381 remains Draft, unmerged and undeployed.**

**Documentation reconciliation:** Earlier “NOT RUN” lines in the historical sections and initial verification ledger describe **older branch heads**; the current-status statement and this evidence block supersede those statements for the specific tests actually executed, not for other gates.


## U3 follow-up: isolated responsive browser matrix STAGED — 21 Oct 2026, NOT RUN

**Reason for harness isolation:** The prior U3 spec lived in \`e2e/\`, but \`tests/browser-suite-structure.test.ts\` freezes a named standard E2E list in \`tooling/browser-suite-baseline.json\`. An extra U3-only spec would alter that baseline and, in the ordinary browser bootstrap, attempt to run the U3-specific database assertion against a different DB. This is **test harness contamination**, not an aircraft runtime bug. To preserve the standard browser suite, the previous dedicated test has been moved to \`tooling/u3-browser/aircraft-delete-focus.spec.mjs\`; the old \`e2e/logbook-u3-aircraft-delete-focus.spec.mjs\` was removed. The new \`playwright.u3.config.mjs\` uses its own test directory, a single desktop Chromium project, one worker, zero retries and \`reuseExistingServer:false\`. No production runtime files or normal \`playwright.config.mjs\` modified.

**Frozen test environment:** the owner already created and initialized an isolated PostgreSQL 18 cluster on \`127.0.0.1:55433\`, role \`flytally_u3\`, DB \`flytally_ui_u3_20261021\`; the prior successful v21-only migration yielded \`registry 21, columns 12, CHECKs 4 PASS\`. The new matrix requires this exact host/port/database/user plus purpose environment flags, and refuses hosted \`VERCEL\` / \`VERCEL_ENV\`. It **never** invokes generic \`npm run test:browser\`, which resets the fixture's public schema. Do not rerun the v21-only helper after it has succeeded; it is intentionally not an idempotent no-op after registry 21.

**Coverage added, not yet verified:** The original desktop deletion/focus test remains within the isolated spec. A second serial test executes **eight** cases: Chrome touch/mobile context widths \`320\`, \`390\`, \`768\` (iPad portrait), \`1024\` (iPad landscape), each with \`light\` and \`dark\` system color scheme. Each case verifies the actual \`html[data-theme]\`, no document horizontal overflow, open/manage/delete of a distinct synthetic no-flight aircraft, dialog disappearance, visible and focused live status message, DB row deletion, subsequent Escape returns focus to another surviving aircraft's Manage opener without stale status replay, and captures screenshots of both focus states. These are **Chrome touch emulations**, not native iPadOS/WebKit/Safari. Screenshots are for subsequent human visual review and are not themselves a visual PASS.

**Local commands (PowerShell), after independently verifying environment again:**

\`\`\`powershell
git pull --ff-only
git status --short
git rev-parse HEAD
node --check .\playwright.u3.config.mjs
node --check .\tooling\u3-browser\aircraft-delete-focus.spec.mjs
npm run test:target -- tests/browser-suite-structure.test.ts
# Verify $env:DATABASE_URL host=127.0.0.1, port=55433,
# path=/flytally_ui_u3_20261021, user=flytally_u3, no password;
# flags FLYTALLY_AUTH_BROWSER, FLYTALLY_LOCAL_POSTGRES,
# FLYTALLY_U3_SCHEMA_FIRST are 1; no VERCEL/VERCEL_ENV.
npx playwright test --config=playwright.u3.config.mjs --workers=1 --retries=0
\`\`\`

**Current verification boundary:** Original 1/1 Desktop Chromium PASS is historical *before relocation* at test code head \`fd67eee235dfd1daa103ed4095a3d8100af0f4fb\`; new dedicated config and the 8-case matrix are **NOT RUN**. Exact-head syntax / frozen suite structure / desktop re-run / responsive tests: **NOT RUN**. Previous unchanged-runtime source 3/3, owner TypeScript and build (41/41) remain prior evidence, not new test-run claims. Full suite, CI, native Safari, manual screenshot/contrast/focus-ring review **NOT RUN**.

**Next single action:** Owner-local run of the exact U3 config above on the verified *existing migrated* disposable fixture, then triage any failures and review the attached screenshots. Do not merge/deploy or modify production DB/flags. \`main\` advanced after branch creation and now contains Project Memory files absent from this older branch; don't create conflicting copies of the rolling handoff until branch synchronization is approved.

## 22 Oct 2026 — Final PR #381 source review and open release gate

### Verified source and base

- Actual GitHub `main`: `860df276f7044586834871808e7e3843a10daaac`. Reviewed PR #381 OPEN/DRAFT, `mergeable=true`; branch behind by **one main docs-only Project Memory commit**, ahead 41 commits at start of review; main contains canonical Project Memory files not added to this earlier U3 branch. GitHub mergeability is not approval to merge.
- U3 production runtime diff: `components/aircraft-manager.tsx` only, 13 added / 2 deleted lines. Reuses existing deletion `role=status` and transfers focus once after modal unmount; normal Escape restores surviving Manage opener and failed/blocked deletion handling unchanged. No server action/DB/auth/certification/CSS/flight records or GPS runtime changes.
- Supporting U3-scoped source regression, isolated Playwright config/spec, disposable-v21 helper, and dated canonical docs are additional PR files. Ordinary frozen `e2e/` suite is not modified.

### Review finding addressed: differing safety preflight on destructive tests

The earlier **desktop** U3 browser case checked only partial database URL and two purpose flags before test-only SQL `DELETE`/`INSERT`, while the responsive case checked additional flags/password/hosting. In a direct `--grep` run, the first case could execute against a syntactically matching URL without a physical database identity check. No unsafe connection or production impact has been observed; this is a preventive test-harness safeguard.

- **Test-only fix staged:** one shared `assertU3DisposableTarget()` called at the beginning of both browser tests. Requires explicit named PostgreSQL URL `postgresql://flytally_u3@127.0.0.1:55433/flytally_ui_u3_20261021`, password/query/hash absent, `FLYTALLY_AUTH_BROWSER=1`, `FLYTALLY_LOCAL_POSTGRES=1`, `FLYTALLY_U3_SCHEMA_FIRST=1`, no Vercel hosting markers. Read-only `psql` probe verifies **actual PG18 host/port/database/role** and exact **21-row migration registry with named v21** before test mutations. Desktop fixture refuses its synthetic registration if any saved flights already exist. A code-level regex sanity check against the expected PG18 identity and incorrect port/version was performed. No schema/migration is executed by this guard.
- **Regression qualification:** this changes the U3 test code after the owner-local **2/2 PASS on executable SHA `3de30a64...`**; previous browser PASS is evidence for earlier behavior, **not a PASS for the newly hardened test code**. Application runtime component is unchanged. Dedicated config/spec syntax, frozen structure regression, U3 full two-case rerun and candidate-bound final release gate **NOT RUN** on new HEAD.

### Final review disposition

**No demonstrated application-runtime blocker in U3 focus change; final acceptance PENDING exact-head test-only hardening verification and relevant candidate gates.** Existing 2/2 desktop/responsive Chrome emulation remains useful historical evidence. Original test screenshots were attached during Playwright but **not visually inspected in this review**; screen-reader and native iPad Safari evidence **NOT RUN**. The test does not force a failed server delete or a second successful deletion; those are explicit coverage limits, not claimed success.

**One next action:** owner-local `git pull --ff-only` into U3 work branch, `node --check playwright.u3.config.mjs`, `node --check tooling/u3-browser/aircraft-delete-focus.spec.mjs`, `npm run test:target -- tests/browser-suite-structure.test.ts`, and a **direct** `npx.cmd --no-install playwright test --config=playwright.u3.config.mjs --workers=1 --retries=0` after read-only exact U3 PG18/v21/environment verification. Do **not** run `npm run test:browser`, reapply v21, reset database, or run generic risk gates pointed at the U3 database. After targeted PASS, inspect read-only candidate plan `npm run verify:plan -- --base origin/main` and decide which additional required isolated fixtures/gates are possible. PR must remain Draft; explicit owner merge authorization and deploy authorization are distinct.
