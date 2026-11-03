# M0-B B1b.2c — Source-declared owner FK and restricted DB-role proof checkpoint

**UTC:** 2026-11-03T08:21:26.776Z. **Repo:** `filipto861/flytally-logbook`. **Verified main:** `c9c2f60303236113a223942072311f5e37f876f7`. **Work branch:** `test/logbook-m0b-b1b2c-v22-role-fk-20261103`, Draft **[PR #465](https://github.com/filipto861/flytally-logbook/pull/465)** base `test/logbook-m0b-b1b2c-v22-trash-writer-gate-20261103@c1876b64fa35325b77895377aeb6b3bd390e612e` (Draft #464); ancestors #463→#455, independent #454. **Last work HEAD before checkpoint:** `e5b7b5e6b738d3670ed7e908fe4097a0b5c9b945`; **exact executable/test SHA:** `f03a8a2c2bae5b477460f783043bdf79824b86a6`. Final work HEAD must be independently verified; CI is exact-source not automatically transferable to other code.

## Authorized scope and changed files

User requested continuation of isolated FK/privilege acceptance. Owner approves retention A **as proposal only**: 90-day Trash then working +12 calendar months minimal owner UID marker from stored `purge_after`; legal/privacy signoff (purpose, duration, erasure, audit) required. Explicit owner preference **NO DeepSeek review** respected. This work changes **test-only** `tooling/m0b-b1b2c-role-fk-privilege-probe.mjs` and [analysis](docs/maintenance/2026-11-03-m0b-b1b2c-v22-role-fk-access-diagnostic.md). Temporary branch-only `.github/workflows/m0b-b1b2c-role-fk-diagnostic.yml` used for actual CI and deleted afterward. Updated `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/{SESSION_HANDOFF,ACTIVE_WORK}.md` and this checkpoint. FEATURES/CHANGELOG reviewed; no shipped capability. No app runtime/schema/migration/source data changed.

## Precise evidence

| Gate | Status / source |
| --- | --- |
| Node24 syntax `node --check tooling/m0b-b1b2c-role-fk-privilege-probe.mjs` | **PASS** [Actions #41602112295](https://github.com/filipto861/flytally-logbook/actions/runs/41602112295), exact `f03a8a2c2bae5b477460f783043bdf79824b86a6` |
| Existing target guard `node --test tooling/m0b-b1b2c-concurrency-probe.test.mjs` | **7/7 PASS**, same run/SHA |
| Actual owned disposable PostgreSQL16.15 randomized synthetic schema + 4 NOLOGIN roles | **9/9 PASS**, same run/SHA; schema and roles removed in finally |
| Owner FK mismatch for expenses/connected crew, numeric-only participation FK false claim exposed | **PASS** (negative outcome documented: legacy numeric-only FK DOES NOT protect owner) |
| Pilot role denied raw table/select/delete, other pilot wrapper, privileged sweep/erasure, arbitrary owner cleanup | **PASS**, synthetic `SET ROLE` tests |
| Pilot/sweep separate owner-first cleanup; restored archive preserves active UID, pending Trash transitions to purged | **PASS**, synthetic only; user/project role mapping NOT TESTED |
| Spoofed `restored_flight_id` owner/UID rejected and rolled back; privacy role marker delete isolated | **PASS** synthetic |
| Historic [#41601813807](https://github.com/filipto861/flytally-logbook/actions/runs/41601813807) at `f8505a70d95d8a3d1151cbdafebe1d094714df59` | **FAIL**: deferred constraint trigger running under pilot role lacked read privilege; genuine issue, not hidden |
| Historic [#41601933497](https://github.com/filipto861/flytally-logbook/actions/runs/41601933497) at `bc4c3ca173a1f25cbc91879222ad37a9ff9428b6` | **FAIL** test-only malformed PostgreSQL dollar quote during trigger fix; diagnosed and repaired |
| Actual Neon HTTP app SQL role/sweep/erasure authorization, two-client lock parity, nonuniform physical production catalog, V14 verified issuer, B2 imported/native audit | **NOT RUN / UNKNOWN** |
| Native Windows PG16 app suite 164/164, full Node TS/build, Playwright/risk, prod auth smoke | **NOT RUN** |
| Production read-only Vercel | **READY** `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub`, app `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; prod DB/schema/flags **UNKNOWN** |

## Safety and unresolved findings

- Source-declared composite owner FKs reject wrong account expenses/connected crew; numeric-only `flight_participations`, `flight_verifications`, `instructor_flight_approvals` cannot **by themselves** authenticate source-owner claims. Test deliberately demonstrates one mismatched participation row could be inserted. Signed/accepted participant evidence must not be implicitly remapped.
- Synthetic NOLOGIN roles controlled through `SET ROLE` by disposable PG superuser, **not actual Neon/shared app SQL principal, authenticated session, or proven production least-privilege architecture**. Test-only SECURITY DEFINER trigger with pinned search_path was needed to allow deferred integrity check without granting raw pilot SELECT; production definer hardening/ownership grants need separate review.
- Both current Trash delete entrypoints are still direct SQL in application; no real changes to them in this PR. Active restored archive UID, immutable void/audit and legacy issuer behavior remain protected by **design only**, not new production V22 constraints.
- **DO NOT:** merge, deploy, execute production/remote DB SQL/migration/restore/delete, change prod flags, enable full-account Restore, rewrite certified/audit evidence, modify Training, claim GDPR permission for working 12-month marker, or request DeepSeek. M0-A remains fail-closed.

**ONE NEXT STEP:** trace exact app authentication + scheduled retention call sites and shared Neon driver role, then specify an explicitly owned/authorized isolated Neon HTTP two-client transaction and privilege test plan before deployable V22 DDL.
