# DATA-1E3 D4 A1 — second owner-local isolated PostgreSQL16 acceptance: scoped PASS

**Evidence date:** 2026-10-30. **Evidence type:** user-supplied unedited Windows PowerShell console in conversation, exact executable SHA, not an independent remote OS inspection. **Disposition:** **A1 selected-source SQL / selected-trigger two-session acceptance PASS**, **D4 overall NOT RELEASE READY**.

## 1. SHA, isolation and operator trace

- Canonical `filipto861/flytally-logbook` `main@807f281e5870164b794d001480ecc84e0b45aea5`, reverified read-only from GitHub after result. User cloned clean owner-local work branch `test/logbook-data1e3-d4-a1-owned-pg16-20261030`, `git fetch`, `git merge --ff-only`, verified **`0891ae0fb5f1a1c99a6982f55e7f701411bee001`** as HEAD and checked clean checkout. This is [Draft PR #449](https://github.com/filipto861/flytally-logbook/pull/449) stacked on [Draft #448](https://github.com/filipto861/flytally-logbook/pull/448) base `55e3aac2f2a01c1670b0e1b238e45515e711b543`. All PRs remain unmerged.
- `node tooling/validate-postgres-partition-registry.mjs`: **`postgres_registry_status=PASS`**, **42 files / 164 tests / 6 partitions**, `registry_sha256=aa208880641c4ed7cc303871dd30ce2b4ab3ca8be5afb3aa7d1ac59104cdc55d`, `postgres_execution=NOT RUN` for this *registry-only check*. Do not misconstrue 164 catalogued cases as 164 tests actually executed.
- Owner Windows Node **v24.19.0**, native PostgreSQL **16.0.15** (`server_version_num=160015`). Read-only/no-DB `--probe` returned `D4_A1_LOCAL_PG16_PROBE status=PASS`, exact source SHA and explicit `NO DB CREATED, NO CONNECTION, NO RESTORE`.
- With explicit `--execute --expected-sha=<exact> --allow-synthetic-writes --confirm=DATA1E3-A1-LOCAL-ONLY`, runner created **one new disposable OS-temp** cluster: `D4_ISOLATED_LOCAL_PG16_PREFLIGHT status=PASS`, `db=data1e3_synthetic`, `role=data1e3_owner`, loopback ephemeral port, physical PID/PGDATA+SQL/process identity verified by runner, `syntheticOnly=true`. Exact ephemeral PID/port and personal Windows paths intentionally omitted from canonical documentation.
- No inherited Neon/Training/production database target. Independent post-test provider inventory still lists **only** existing `muddy-dust-14049657` Logbook Shadow, `frosty-recipe-46458686` Training Production and `dry-king-94424047` Training Acceptance; this read-only inventory does **not** independently prove absence of an operation on those databases, but the operator runner's confirmed target and guarded source establish the scoped local test intent.

## 2. Actual source SQL evidence and pass criteria

| Executed phase | User-reported result | Concrete verified invariant |
| --- | --- | --- |
| PostgreSQL registry validation | **PASS**, 42/164/6 catalogued | Pinned test registry integrity only |
| `D4_BASELINE_SOURCE_SQL_RESTORE` | **PASS**, actual `node --test` 4/4, 0 failed, 0 skipped | Date-only time zone; cross-user SQL guard; certification + HMAC tamper guard; AC-20 restored R1/R2/hash/signatures/participation/GPS and negative unexpected same-ID replay without mutation |
| `D4_A1_SELECTED_SOURCE_TRIGGERS` | **PASS**, `threeTriggers=true` | Selected source-defined flight audit, certified-flight and FSTD certification guard functions installed in minimal disposable fixture; `fullCanonicalV21=false` |
| `D4_A1_FLIGHT_CERTIFIED_TWO_SESSION` | **PASS** | Conflict rejected; certified existing flight unchanged; audit unchanged; prior transaction marker rolled back |
| `D4_A1_FSTD_CERTIFIED_TWO_SESSION` | **PASS** | Conflict rejected; certified existing FSTD unchanged; audit unchanged; marker rolled back |
| `D4_A1_FLIGHT_DRAFT_TWO_SESSION` | **PASS** | Conflict rejected even without certification lock, existing draft unchanged, audit unchanged, marker rolled back |
| `D4_A1_FSTD_DRAFT_TWO_SESSION` | **PASS** | Conflict rejected even without certification lock, existing draft unchanged, audit unchanged, marker rolled back |
| `D4_A1_POSITIVE_SOURCE_SQL` | **PASS**, `flightAndFstd=true`, `auditCreatedAndUpdated=true` | Absent-ID flight/FSTD stage + certification update succeeded; flight INSERT and UPDATE audit entries created |
| `D4_A1_TEST_COMPLETE` | **PASS** | `twoRealSessions=true`, `fourRaceCases=true`, `sourceSql=true`, `sourceDefinedTriggers=true`; explicit scope limits below |
| `D4_A1_DB_ACCEPTANCE` | **PASS** | Explicit selected-source A1 SQL acceptance |
| `D4_LOCAL_PG16_DISPOSAL` | **PASS** | Runner reported `onlyOwnedTempDirectory=true`, `postgresStopped=true`; remote independent OS verification NOT RUN |
| `D4_A1_OWNER_TEST_COMPLETE` | **testStatus=PASS**, **baselineStatus=PASS**, **securityStatus=PASS**, **isolation=PASS**, **cleanup=STOPPED**, source SHA **`0891ae0fb5f1a1c99a6982f55e7f701411bee001`**, exit **0** | All required bounded owner-local A1 phases passed and cleanup reported |

The **two-session test is genuine PostgreSQL concurrency with a deterministic preview-to-insert interleaving**, not only a synthetic one-session SQL reorder. It uses a selected minimal schema, selected **source-defined triggers**, and real source INSERT/UPDATE SQL fragments, **not** the exact complete `executeExactAccountRestore` operation, full canonical SQL-v21 migrations/constraints, Neon HTTP adapter, or authenticated signed-v13 GET/preview/restore. The `true` flags are therefore evidence for *only their named conditions*.

## 3. Comparison to prior failed attempt (retain both)

- Earlier owner run at **`5ac18ee02800b4cbb973ad4e0e561c9b1ce7b307`** had baseline **3/4 PASS / AC-20 FAIL** because legacy positive double `apply()` expected silent `ON CONFLICT DO NOTHING` behavior. Four A1 race cases NOT RUN; exit 1, physical isolation and cleanup PASS.
- Updated candidate at **`0891ae0fb5f1a1c99a6982f55e7f701411bee001`** retained all positive AC-20 cryptographic/track/shared-evidence checks, replaced the unexpected second *low-level* replay expectation with strict duplicate rejection plus deep-equal existing evidence snapshots, and repinned the locked PostgreSQL test hash. **4/4 baseline PASS / all A1 probes PASS** in the second newly owned cluster. See [earlier FAIL and technical reconciliation](2026-10-30-data1e3-d4-a1-first-owner-pg16-ac20-reconciliation.md). This is a legitimate tested contract change, not deleting or skipping the failing test.

## 4. Remaining work / prohibited actions

- A1 same-ID parent collision under selected source SQL fixture: **SCOPED PASS**. Not equivalent to full D4, full Data-1, product release, schema or statutory/regulatory acceptance.
- D4 **A2 F9 audit floor/deletion**, **A3 F8 actual committed counts**, **A4 natural-key different-ID race and protected child silent conflicts** remain **OPEN / NOT IMPLEMENTED** in current stack. The A1 positive audit test does not remediate or exercise F9 broad audit deletion.
- D2 capped decompression policy still unfrozen/unimplemented. Authenticated signed-v13 application flow, full canonical v21 triggers/foreign keys/migrations, cross-client/Neon HTTP parity, complete Node/build/browser/risk and production smoke **NOT RUN** for this D4 candidate.
- No merge, production deployment, production/Shadow/Training/Neon DB SQL, production migration/delete/restore or flag change was authorized or performed by the assistant. Original Neon projects read-only inventory remains unchanged; production schema/feature flags **UNKNOWN**. Vercel read-only latest production **READY** `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` at older code SHA `55c8076e1eb8104c14392e15b272b33e0eb29607` (not this branch).
- GitHub checkpoint documentation added *after* executed source SHA; do **not** transfer the PASS label to changed executable code without new execution. Record docs-only additions separately. Preserve read-only DeepSeek reconciliation and owner A–D freeze.

**ONE NEXT STEP:** begin **A2 audit provenance and immutable history design/source discovery** on a new narrowly scoped branch, without changing/merging/deploying product SQL until the approved policy has a source-backed narrow plan and regression criteria.
