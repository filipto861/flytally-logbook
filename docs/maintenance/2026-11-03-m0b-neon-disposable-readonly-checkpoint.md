# M0-B B1b.2c — Independent empty Neon PG16 scoped remote read-only evidence checkpoint

**UTC:** 2026-11-03T08:57:32.614Z. **Repo:** `filipto861/flytally-logbook`; verified canonical **main `c9c2f60303236113a223942072311f5e37f876f7`**. **Work:** `test/logbook-m0b-neon-isolated-readonly-20261103`, stacked **Draft [#467](https://github.com/filipto861/flytally-logbook/pull/467)** base Draft #466 `905df42d32080db0704410d87f37a86af4e03c11`, earlier stacked #465→#455, independent #454. **Exact executable/test SHA:** `82dc5259ab9a080f1c1101e2041ba10bdcacefb0`, **last work HEAD before this checkpoint** `e83d6902280211ebf9fa7962964ec464acdb19aa`; verify final pushed SHA, only doc changes+temporary workflow removal after test.

## Owner/DO–DO NOT

Owner explicitly approved creating an **isolated disposable Neon environment with no production data copied** and P0–P8 testing. A NEW empty project was chosen over a branch from unknown-populated Logbook Shadow/Training. The safety hard stop means **no destructive tests on remote/production databases**; remote actions were new scratch creation/test role configuration and **read-only SELECT SQL** only, no flights/Trash/actual users, app schema or prod DDL. Retention A remains design-only: 90-day Trash then proposed working +12 calendar-month minimal UID, legal/privacy review pending. No DeepSeek per owner. **DO NOT** merge/deploy, run prod/staging SQL or migrations, enable full Restore, alter prod flags, rewrite certified/audit evidence, touch Training, or claim Neon HTTP parity/prod approval from this probe.

## Environment identity/provider and actual scope

New separate Neon project `blue-haze-29352938` (created 2026-11-03 08:43:34 UTC), default/test branch `br-patient-sound-bacf0trt`, DB `flytally_m0b_isolated`, operator SQL role `flytally_m0b_operator`, compute `ep-quiet-smoke-babbdfv9`, PostgreSQL **16.15**. Provider metadata + exact branch/DB/role-scoped SQL returned `current_database`, `current_user`, `server_version_num=160015`, **0 public user tables** and **0 fixture schemas**. Scratch project still exists; eventual shutdown/cleanup needs separately tracked owner-controlled action. Production project DB/schema/flags UNKNOWN; no connection to existing Neon projects or app deployment.

## Verification ledger and failures

| Scope | Evidence |
| --- | --- |
| New project and empty PG16 identity | **PASS** provider metadata + read-only SQL, branch/db/role explicitly passed |
| Real Neon connector SELECT-only multi-query transaction | **PASS** three SELECTs, `READ COMMITTED`, no allocated write xid and sample +12-calendar-month math; **NOT** exact app HTTP driver parity |
| Read-only SQL exception propagation | **PASS** expected `SELECT 1/0` produced NeonDbError; DML rollback **NOT RUN** |
| Two connector promises using same advisory lock | **INCONCLUSIVE** both succeeded but backend PID identical and timestamps separated; **NOT proof of simultaneous two-client execution** |
| Neon API created LOGIN pilot/sweep test roles | **FAIL** least-privilege expectation: inherited `neon_superuser`, CREATEDB/CREATEROLE. REVOKE membership and ALTER NOLOGIN denied. Both overly broad temporary roles subsequently deleted; absence rechecked |
| Two deliberately SQL-created NOLOGIN scratch roles | **PASS** operator could `SET LOCAL ROLE` inside scoped transaction, each had no LOGIN, CREATEDB, CREATEROLE, database/schema CREATE; postflight operator role restored. Not independent application logins |
| P0–P8 remote evidence | **PARTIAL** P0; **PARTIAL** P5, P8; **NOT RUN/NOT VERIFIED** P1/P2 and full P3/P4/P6/P7; see [evidence and explicit matrix](docs/maintenance/2026-11-03-m0b-neon-isolated-project-readonly-evidence.md) |
| Node24 pure scope guard CI | **[Actions #41606651155](https://github.com/filipto861/flytally-logbook/actions/runs/41606651155) SUCCESS** exact source SHA `82dc5259ab9a080f1c1101e2041ba10bdcacefb0`: Node24 syntax PASS and **12/12 PASS**, no DB/credentials/network; temporary workflow subsequently removed |
| App full Node/TS/build, native Windows PG16 164/164, browser/risk, V14 issuer, imported/native B2, real production authenticated smoke | **NOT RUN** |
| Prod Vercel M0-A | **READY** `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub`, app `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, production DB/schema/flags **UNKNOWN** |

**Files:** `tooling/m0b-b1b2c-neon-isolation-scope.mjs`, `tooling/m0b-b1b2c-neon-isolation-scope.test.mjs`, `docs/maintenance/2026-11-03-m0b-neon-isolated-project-readonly-evidence.md`, this checkpoint, `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/{SESSION_HANDOFF,ACTIVE_WORK}.md`. Temporary `.github/workflows/m0b-b1b2c-neon-isolated-scope.yml` was added for CI then removed. No shipped app feature (FEATURES/CHANGELOG reviewed, unchanged).

**ONE NEXT STEP:** write isolated, source-bound credential-free `@neondatabase/serverless` **read-only** HTTP two-client harness with fail-closed exact project/branch/role detection; execute only with separately verified private test credential flow. Keep all destructive DML/rollback and V22 schema acceptance on isolated **local** PG16 until release gates/owner decisions.
