# Certified-flight correction — single-step Save & certify (16 October 2026)

**Repository:** `flytally-logbook` only  
**Status:** MERGED ON MAIN via PR #341 (`ea35b6a6`); owner-local canonical release acceptance PASS for exact source `aef0f65e`; no schema change, data backfill or verified production deployment  
**Branch:** `fix/certified-correction-save-and-certify`  
**Trigger:** Owner reproduced data loss by editing an opened certified-flight correction and selecting *Continue to certification* without first pressing *Save changes*. The tab transition unmounted the local form; certification then sealed the older persisted row.

## Final verification and merge evidence (16 October 2026)

- **Source HEAD:** `aef0f65e9b85c9b437b745d9efb96e5aa489ac85`, containing PR #342 infrastructure merged `main@b88ea277`.
- **Canonical risk release:** `release_status=PASS`, candidate ID `f884f186e3252929bc408506b5172bf3aa61f6ce0254ffc98d15cddc325ed501`; source/domain/typecheck/aggregate/build/postgres/browser PASS, scale N/A, `blocked_evidence=none`, release exit 0.
- **Local evidence:** targeted 27/27, source 257/257, domain 19/19, Node 1623/1623, production build PASS, PostgreSQL16 six disposable owned partitions 163/163 PASS, Playwright desktop 11/11 PASS and mobile 11/11 PASS. Browser v20/v21 disposable schema-first fixture passed. Test PostgreSQL server stopped. Controlled local shared-core `work_mem=64MB` does not prove production performance.
- **PR #341:** squash merged as `ea35b6a6f35b665f3bcf89c449a40496d565b468`; GitHub main updated. No post-merge runtime/prod smoke claim.
- **Decision:** user explicitly waived independent second-AI review for expedited completion. No production deployment requested/executed through this workflow. Migration: N/A.
- Any `NOT RUN` / draft acceptance entries retained below describe the pre-acceptance plan and are superseded by this exact-head evidence.

## Frozen owner decision

After opening a correction (R2+), the flight edit form must present both **Save changes** and **Save & certify**. The second button is explicit user authorization to persist the submitted draft and certify its exact saved row in one action, as Manual New does. A workflow/tab navigation must not silently discard form edits.

## Implementation contract

1. **Archive remains first.** `startCertifiedCorrection` preserves the original certified snapshot and prior fingerprint, increments `record_revision`, marks the new version an editable draft and invalidates relevant pending/sharing evidence. No existing archived certification is overwritten.
2. **Edit remains the canonical parser/authority path.** `updateFlight` uses `parseFlightInput`, profile/snapshot authority, RoleCrew resolver, expense parsing and one SQL CTE. It explicitly refuses mutation when `certified_at IS NOT NULL`, even if an independent lock field were somehow cleared.
3. **Save & certify is submit intent, not a separate data model.** When and only when draft update `RETURNING` succeeds and explicit `intent=certify`, pass the updated flight's PostgreSQL `xmin` to `certifyStoredFlight`. The shared service loads the persisted owned row, verifies the requested `xmin`, runs unchanged compliance and SHA-256 v8 certification, and atomically seals the matching row using its existing optimistic `xmin` predicate. Concurrent mutations fail closed as stale rather than certifying somebody else's submitted version.
4. **Partial result is explicit.** If save succeeds but certification is blocked, stale or uncertain, the app reports that the flight changes were saved while certification was not confirmed; the UI does not mark this as unsaved. If save fails, certification is never attempted. Unexpected certification errors preserve uncertainty and request reload rather than falsely claiming certified or draft status.
5. **Navigation guard.** While an edit form is dirty, workflow button and tab navigation prompt for explicit discard; dismissal keeps the form mounted and original edits untouched. Navigation during form submission is ignored. The browser/page-leave unsaved guard continues to operate.
6. **No auto-certification.** Implicit Enter submits the first `intent=draft` edit button. Certification requires clicking the separate explicit `intent=certify` control; the original `Save & certify flight` New entry flow is retained.
7. **No change to:** GPS import, FSTD corrections, certificate hashing/content/schema versions, historic archives, recency rules, collaboration, production DB or deployed runtime.

## Acceptance and verification plan

- Source/unit contract: `tests/v340-flight-certification-service.test.ts` proves explicit edit intents, immutable-certified WHERE, update token returned/passed and stale gate; `tests/v300-u4-flight-workflow.test.ts` proves dirty-tab navigation guard and pending state coupling.
- Authenticated browser: existing `3.4.0 Manual explicit Save & certify...` Playwright case now exercises R1 certification → open correction R2 → edit arrival without saving → attempt Continue to certification, dismiss discard → original saved DB remains unchanged, new input remains on screen → single **Save & certify** → R2 certified, changed arrival persisted, new fingerprint, archived R1 snapshot and reload. Browser fixture is a disposable authenticated local DB.
- Required risk gates before merge: exact-head TypeScript, targeted contracts, full Node regression, isolated PostgreSQL acceptance, same-head build, authenticated desktop **and mobile** Playwright. Review persisted/certification/recency failure modes independently (DeepSeek/Claude read-only) before merging.
- DB migrations: **N/A**. Production data mutation: **none authorized**.
- Any failed or unexecuted gate remains FAIL/NOT RUN; branch is not a verified release.

## Evidence ledger

- 16 Oct 2026: Source inspection of current `main@9573810884f839c22eae2e74c5114f1e167b98b3` identified `FlightDetailWorkspace` conditional tab rendering + `useUnsavedFormGuard` only guarding page leave, while `certifyStoredFlight` reads the persisted DB row.
- Same day: Scoping/implementation on `fix/certified-correction-save-and-certify`. GitHub source commits exist; **node/typecheck/build/PostgreSQL/browser NOT RUN** from this environment. No deployment, PR approval or production validation claimed.
