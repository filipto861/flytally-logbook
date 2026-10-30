# DATA-1E3 D4 A1 — first owner-local PG16 attempt: AC-20 historical low-level replay incompatibility

**Date:** 2026-10-30. **Outcome:** PostgreSQL acceptance **FAIL**, isolated physical setup **PASS**, baseline **3 PASS / 1 FAIL**, A1 two-session and positive acceptance **NOT RUN**, owned cleanup **PASS as reported by owner's runner**, command exit **1**. This is an observed failing run, not a successful D4 verification.

## User-supplied exact evidence (do not erase)

- Clean fresh Git clone of `filipto861/flytally-logbook`, branch `test/logbook-data1e3-d4-a1-owned-pg16-20261030`, frozen **`5ac18ee02800b4cbb973ad4e0e561c9b1ce7b307`**; Windows Node **v24.19.0**, native PostgreSQL **16.0.15 (160015)**.
- `--probe --expected-sha=...`: `D4_A1_LOCAL_PG16_PROBE PASS`, explicitly **NO DATABASE CREATED / CONNECTION / RESTORE**.
- `--execute ... --allow-synthetic-writes --confirm=DATA1E3-A1-LOCAL-ONLY`: `D4_ISOLATED_LOCAL_PG16_PREFLIGHT PASS` newly owned one-time temp cluster, DB `data1e3_synthetic`, role `data1e3_owner`, random localhost port `52766`, OS postgres PID `28160`. No request or evidence of any remote/Neon connection.
- Actual `tests/integration/postgres-security-restore.test.ts` output **4 tests: 3 PASS, 1 FAIL**, **0 SKIP**. P1.5 dates PASS, AC-13 authorization PASS, AC-19/AC-22 HMAC protection PASS. AC-20 failed with PostgreSQL `23505` / `duplicate key value violates unique constraint "flights_pkey"` for synthetic flight `id=1001` on the historical repeated SQL `apply()`.
- Runner stopped before invoking new `tooling/data1e3-d4-a1-source-sql-probe.mjs`: all four actual A1 two-session racing cases, positive control, selected triggers and scenario-specific audit comparison **NOT RUN**. Therefore do **not** infer A1 protection PASS or FAIL from the collision seen in AC-20 alone.
- `D4_LOCAL_PG16_DISPOSAL PASS` `onlyOwnedTempDirectory=true`, `postgresStopped=true`, final `testStatus=FAIL`, `baselineStatus=NOT RUN`, `securityStatus=NOT RUN`, `isolation=PASS`, `cleanup=STOPPED`, exit 1. The old `baselineStatus=NOT RUN` is a **runner reporting defect**: a baseline really executed and failed 1/4. Owned cluster stop/deletion is confirmed by the runner's output, not independently inspected through remote OS access.

## Exact frozen source reconciliation

- `tests/integration/postgres-security-restore.test.ts:60-64` AC-20: initial `apply()` inserts staged flight and then fills certification, plus tracks, certified R1 revision, shared participation and signed verifications. All its positive flight R2 hash/R1 hash, HMAC signature, GPS and participant evidence assertions ran before the failure. At the very end it ran **`apply()` again**, previously asserting that the same low-level INSERT silently skipped the existing parent.
- `lib/account-restore-v6.ts:233-244` in A1 now deliberately stages **strict** flight and FSTD INSERTs (removed `ON CONFLICT DO NOTHING`) inside the existing atomic transaction. A second unplanned low-level parent stage must fail closed. A higher-level **freshly re-planned** exact recovery may still idempotently skip *known already-present* rows; this is a separate integration boundary **NOT PROVEN** by AC-20.
- Therefore **do not restore `ON CONFLICT DO NOTHING`, skip AC-20, ignore errors, or weaken the earlier cryptographic evidence checks** merely to make the test pass.

## Bounded corrective change on the same Draft #449 work branch

1. `tests/integration/postgres-security-restore.test.ts` preserves all positive AC-20 checks, then takes fully ordered row snapshots of flight, R1 revision, both signed verifications, GPS track and participation; verifies cardinalities, **asserts second unplanned `apply()` throws `flights_pkey`**, then verifies all five complete before/after result sets are **deep-equal**. The test remains an actual PG integration test with `skip:!enabled`; its runtime **NOT RUN since fix**.
2. `tooling/data1e3-d4-a1-owned-local-pg16.mjs` now reports `baselineStatus="FAIL"` for a nonzero *actually executed* baseline rather than `NOT RUN`. It still does not execute the A1 probe after baseline FAIL, and retains exact target ownership/cleanup requirements.
3. `tooling/data1e3-d4-a1-source-contract.test.mjs` has one additional no-DB check locking the positive AC-20 evidence assertions and strict duplicate+unchanged-snapshot requirement; no SQL or real DB access.
4. `tooling/postgres-partition-registry.json` canonical-LF pinned hash for `postgres-security-restore.test.ts` updated from `62df2fb0089cd2f84b8559758a9f17477c88969181bf662f1962d847ae90a9cc` to **`afa6035e85a4e86d1b549ea6b62723d3791d3948d6ef1524fd970249eed485f4`**. Existing `expectedTests=4` and file/partition totals unchanged; no new partition or unregistered tests.

### Verified no-DB regression evidence

- [GitHub Actions #41081787518](https://github.com/filipto861/flytally-logbook/actions/runs/41081787518), SHA `f88d0bdb5deeb51e664cb0d63bf488353f5584e2`: Windows Node24, no-DB source **4/4 PASS**, `npm run typecheck` **PASS**, canonical test hash computed by actual Node crypto. No PostgreSQL execution.
- [GitHub Actions #41082032731](https://github.com/filipto861/flytally-logbook/actions/runs/41082032731), SHA `029a85727118c00dea42a8462ff1c4c5504ecf98`: **SUCCESS**, Node24 source guard **4/4 PASS**, existing recovery source guard **6/6 PASS**, pinned `node tooling/validate-postgres-partition-registry.mjs` **PASS**, `npm run typecheck` **PASS**, no PostgreSQL touched. Temporary workflow deleted after verification. Later documentation/checkpoint commits are **not** new executable acceptance evidence.

**Release blockers still open:** A1 actual local PG16 four two-session cases + positive path NOT RUN, full canonical v21 migration/effectivity and signed-v13 authenticated app restore NOT RUN. D4 audit F9 broad delete, counts F8, natural-key races/protected child conflicts, D2 gzip bound remain. No merge, deploy, production/Shadow/Training/Neon DB SQL, schema/migration or feature-flag changes. Production DB/schema/flags UNKNOWN.

**ONE NEXT STEP:** owner fast-forward the same clean local checkout to the new verified Draft #449 SHA, run no-DB registry validation + read-only `--probe`, then explicitly run one fresh, sentinel-owned disposable PG16 `--execute`; share sanitized baseline/A1 phase status and exit, no real flight/GPS/private data.
