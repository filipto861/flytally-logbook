# FlyTally Logbook PR #340 — M3 isolated PostgreSQL execution design

Status: **DESIGN / INDEPENDENT REVIEW REQUIRED**. No implementation authority for destructive test execution; no DB writes and no release PASS.

## Verified current-state evidence

Owner Windows local checked out clean `54c4469b`:
- SHA-256 PG source inventory: 42 files, 163 tests, 6 groups, PASS.
- M1/M2 targeted: 31/31 PASS; typecheck PASS; full Node suite 1606/1606 PASS, zero skipped/todo. Node24 local; not CI.
- No PostgreSQL, browser or build evidence on that SHA. PR #340 Draft, no merge/deploy.
- Subsequent documentation commits did not change M1/M2 runtime behavior; latest-HEAD gates are still NOT RUN.

Canonical files inspected:
- `tooling/verify-postgres.mjs`: one `selectPostgresTests("full")` and `runNodeTests`, one candidate-bound PostgreSQL evidence ledger entry. Its default behavior must remain unchanged unless an explicit reviewed partition mode is enabled.
- `tooling/verification-execution.mjs`: Node24 `--test --test-reporter=tap --experimental-strip-types`; CLI subprocess inherits supplied environment.
- `tooling/postgres-partition-registry.json`: reviewed complete SHA-256 inventory, partition membership and expected cases.
- `tooling/postgres-partition-tap.mjs`: pure TAP checker + `VALIDATED-ONLY` aggregator; **does not execute PG or write release ledger**.
- `tooling/run-v380-cost-summary-acceptance-local.ps1`: creates a unique localhost PG16 cluster (single database), preflights exact identity, and runs canonical release: it is **not** a six-partition runner.

## Mandatory partition isolation matrix

| Partition | Files / tests | Activation | Prerequisite and ownership |
|---|---:|---|---|
| shared-core | 36 / 123 | FLYTALLY_POSTGRES_INTEGRATION=1 | Fresh disposable PG16; private-schema/nondestructive tests, no public reset |
| shared-restore | 1 / 8 | FLYTALLY_POSTGRES_INTEGRATION=1 and FLYTALLY_D2_FULL_V20_DISPOSABLE=1 | Its **own** fresh disposable cluster; test bootstrap resets/rebuilds public |
| v21-migration | 1 / 5 | FLYTALLY_POSTGRES_INTEGRATION=1 and FLYTALLY_V21_RELEASE_DISPOSABLE=1 | Its **own** verified new cluster with **zero tables in public** |
| d3b-migration-chain | 1 / 19 | FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE=1 | Its **own** disposable cluster; test creates private random schema and executes actual v1-v20 migration SQL |
| d3b-races | 1 / 6 | FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE=1 | Its **own** disposable cluster; real concurrency tests own private schema |
| real-v20-catalog | 2 / 2 | FLYTALLY_D3B_FULL_V20_DISPOSABLE=1 | Its **own** disposable cluster, seeded required pre-v1 schema, **actual v1-v20 migrations applied in public**. This is the largest unresolved dependency; never claim that browser synthetic fixture is equivalent. |

Caveat: The registry's declared 163 cases are a **source census**, not a substitute for emitted TAP cases. A review must verify whether shared-core's 36 files can run concurrently without public/shared-global interference, and whether the two full-v20 catalog cases are mutually isolation-safe. Registry counts may be updated only with corresponding reviewed source changes.

## Safety contracts to review before implementation

1. **Candidate and intent:** require exact clean PR branch HEAD, `origin` HEAD match, reviewed candidate hash, Node24 + PG16 availability, allowlisted registry and toolchain hash before creating a fixture. No environment supplied by the user can authorize arbitrary production DB; reject VERCEL/VERCEL_ENV and remote/tunnel URLs, inherited conflicting purpose flags.
2. **Fixture ownership:** for every partition create a **new** exclusive temporary PG16 data directory, bind server to `127.0.0.1` on a newly selected non-default port, create exact `flytally_currency_test` as `flytally`, and verify physical SQL identity and PG server major version. An unrelated owner cluster is **never** accepted. On process crash, fail closed and retain evidence/cluster for manual inspection rather than touching others' clusters.
3. **No cross-partition contamination:** sequential execution; no blanket environment exports. For each child, strip all partition-specific purpose flags except exactly those required for that partition. When a fixture changes public schema, its predecessor/follower must have a distinct verified cluster and explicit database ownership certificate.
4. **Real v20 catalog precondition:** the v1 migration alters existing tables. A brand-new empty public schema cannot simply receive migrations 1..20. Prepare a **source-backed pre-v1 foundation** from existing D3b historical migration test (private-schema fixture) for an *isolated* public namespace, then apply the exact ordered runtime SQL and verify migration registry 1..20 and physical FK/trigger identities. This step needs a local PG16 experiment and independent review before an automated runner is enabled.
5. **Evidence:** run only each partition's exact registry file list (no test glob), Node TAP13; compare exit code, SIGINT/timeout, stdout/stderr, case count, test/suite assertions and raw SKIP/TODO with exact tested candidate. No summary-only PASS. Snapshot immutable run identity, registry SHA-256, configuration/toolchain hashes, per-partition test file digests, distinct physical DB identities and child CLI argument arrays. A stage's TAP report alone cannot prove DB provision/ownership; the M3 trusted executor must inject and attest it, not accept user-provided text.
6. **Ledger:** currently one canonical `postgres` ledger and `verify-release-risk.mjs` calls `runPostgresVerification` directly. Add an explicit opt-in routing path in that canonical call boundary and one aggregate record only after **all required 163 tests actually execute cleanly**. Leave old general `verify:postgres` default unchanged. Never treat unrelated opt-in skip as N/A, never pre-credit prior SHA, never synthesize scale evidence or browser evidence from a PostgreSQL pass.
7. **Cleanup:** stop only the owned PG16 process; only recursively remove an exact unique own temp directory after successful server shutdown. On failure stop, preserve folder and mark cleanup incomplete. Ensure Windows PowerShell 5.1 exception and CTRL-C paths restore inherited env.
8. **Future browser:** ensure a separate compatible v21+auth fixture after PG partitions; browser bootstrap resets public and must preserve exact monetary tuples. No release until risk-scoped desktop/mobile Playwright and production-ready SHA checks pass.

## Suggested milestones

- **M3a (read-only):** reviewed partition launch contract with dry-run display and fail-closed preflight: six groups, exact files/flags, database contract, candidate/config identity. Add negative tests for unknown group, missing/duplicate file, flag collision, wrong DB, stale commit, prior phase evidence reuse. **No cluster creation or release ledger write.**
- **M3b:** disposable cluster owner + lifecycle; independent negative tests showing refusal of remote/standard-port/wrong DB; Windows PowerShell 5.1 local dry-run. No historical DDL on an existing user database.
- **M3c:** run source-safe shared-core and independently verified shared-restore partitions; prove 123+8 cases and exact TAP. Preserve canonical risk runner unaffected.
- **M3d:** dedicated v21 fresh public, D3b migration/race, and actual-v20 public catalog partitions after pre-v1 foundation experiment.
- **M3e:** strict aggregate candidate-bound PostgreSQL ledger and canonical opt-in release routing; expected 163/163 with no SKIP/TODO, no duplicate fixture, zero retries.
- **M4:** currency-rich 100k real-query SQL/EXPLAIN baseline, authenticated desktop/mobile browser cost totals and production smoke only after explicit owner go/no-go and deploy plan.

## Independent review questions (DeepSeek or Claude)

1. Does shared-core actually own public or global objects that make sequential execution/cluster-per-phase insufficient?
2. Are v21 fresh-public, shared-restore reset and actual v20 public catalog exactly mutually exclusive? Which cases need even more isolation?
3. Can the real D3b pre-v1 seed and v1-v20 migrations run verbatim under `public`? Identify source code, migrations with search_path assumptions, triggers and FKs.
4. What explicit attestation should the trusted executor generate so the pure aggregator cannot accept fabricated `databaseIdentity`, `command`, `stdout` fields?
5. What negative tests demonstrate fail-closed behavior on abandoned child, port swap between TCP check and start, inherited PG* credentials, SIGINT/CTRL-C and Windows path spaces/Unicode?
6. Which parts should be reused from the existing candidate verification and run-v380 PowerShell wrapper rather than duplicated?
7. Do real TAP reports and the M2 parser handle unplanned output, nested suites, diagnostic TODO and exit-code edge cases safely?
8. Are M3c/M3d dependencies and the ledger integration boundary minimal, backward-compatible and release-auditable?

**DO NOT:** enable all flags globally, reuse an existing local cluster, modify production/Neon, mutate certified records, declare incomplete tests PASS, change currency rounding, set an invented performance threshold, deploy or merge.

**Decision required:** Owner approval after independent review before M3b+ destructive execution code. Until then this is design only.
