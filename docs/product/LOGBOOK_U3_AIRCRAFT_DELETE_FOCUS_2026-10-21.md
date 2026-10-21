# U3 — Aircraft delete completion focus / initial unsampled-workflows audit

**Date:** 2026-10-21  
**Repo/branch:** `filipto861/flytally-logbook`, `fix/logbook-u3-aircraft-delete-focus-20261021`  
**Base:** `main@8099149f72d493c34dd59babf65bdb064ff99fc9`  
**Status (latest, 21 Oct 2026):** Draft PR #381; owner-local authenticated Desktop Chromium **1/1 PASS** on isolated U3 fixture after explicit canonical v21 migration; source tests **3/3 PASS**, TypeScript/build **PASS** (41/41). Mobile/iPad, native Safari, full suite and CI NOT RUN. No merge/deploy. Earlier verification notes below are historical snapshots.

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
