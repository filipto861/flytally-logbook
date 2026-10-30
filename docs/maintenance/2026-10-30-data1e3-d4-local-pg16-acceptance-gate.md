# DATA-1E3 — D4 isolated PostgreSQL16 acceptance: owner approval gate (DESIGN ONLY)

**Prepared UTC:** 2026-10-30T10:51:14.635Z  
**Status:** source-backed plan + non-DB test ownership; **no PostgreSQL cluster, database, role, browser fixture, restore or migration created/executed in this milestone**. This document is **not** authorization to execute destructive fixtures or change production.

## 1. Frozen facts and scope

- Repository: `filipto861/flytally-logbook`; canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`. Working Draft [#445](https://github.com/filipto861/flytally-logbook/pull/445), branch `fix/logbook-data1e3-v13-security-gates-20261030`, stacked on Draft #444 `512bddf0405854f1c0fe5694b00ee09c8099cb5d`, #443 `16a94e051037b680f7b08e97e8880e7967ada062`. Reverify **full** work SHA, base and dependencies before actual runtime testing.
- Owner accepted D1–D4 **direction** and explicitly asked to continue with isolated PG16 test **preparation** / registry ownership. D1 stored-v13 signature and D3 generic HTTP error are an **unmerged code candidate** (previous GitHub Actions [#41042561314](https://github.com/filipto861/flytally-logbook/actions/runs/41042561314): Windows Node24 3/3 targeted PASS and typecheck PASS, source SHA `08121cd05f58348e2a8db20a98cc22cc7f4625b1`). D2 numeric limits and D4 SQL rewrite are NOT IMPLEMENTED.
- DeepSeek review and code reconciliation identified F3 flight/FSTD **preflight-to-execution race** (plan built before transaction, `INSERT ... ON CONFLICT DO NOTHING` followed by certification `UPDATE` based on `plan.addRows`), F8 `added` based on planned count, F9 unrelated audit deletion possible across the separately-read `auditFloor` threshold. These are **source-observed concerns**, **not reproduced data loss**.
- This milestone changes only `tooling/development-modules.json`, `tests/development-scope.test.ts`, documentation. It MUST NOT change `lib/account-restore-v6.ts` or database schema until a separately reviewed, isolated execution scope is approved.

## 2. Approved test-ownership registration (no loosening)

- `tests/v381-data1e3-stored-recovery-guards.test.ts` is now owned by a new `data-recovery-contract` test group, evidence class `application-source-contract`, attached to the existing `data-recovery` module. This is *not* miscategorized as UI.
- The group conservatively continues to select `postgres=true`, `browser=true`, `fullTests=true`, `build=true`, `scale=false`, with `domain-data-integrity`, `persistence-schema` and `test-contract` risk. The existing module still selects `ui-contract` and its `domain-unit` evidence.
- `tests/development-scope.test.ts` checks group ownership, removal of `unowned-test` for this file, inclusion from runtime recovery paths and **retention** of PostgreSQL, browser, full Node, build, domain and source evidence. This test must be executed on exact SHA before claiming registry PASS.
- **Separate locked registry:** `tooling/postgres-partition-registry.json` is immutable-by-contract with 42 hashed files, 164 cases, six physical partitions at current baseline. **No change to this PostgreSQL registry or existing test SHA allowed in this design stage.** Adding D4 PostgreSQL tests later requires a deliberately reviewed update of approved partition test list, counts, SHA and isolated fixture ownership together; never suppress a registry failure to obtain PASS.

## 3. D4 trusted test-machine preflight (requires distinct execution permission)

**Target:** a single freshly created, owner-controlled, physically isolated **local PostgreSQL 16** cluster bound only to `127.0.0.1`, unique nondefault port, unique ephemeral absolute data directory and single-use *synthetic* database + role. May be Windows Node24. Owner explicitly authorizes the exact disposal scope and database creation **before** launch.

**Positive identity, all mandatory:**
1. Verify `git rev-parse HEAD` exact frozen Draft SHA; git status clean; Node24, installed PostgreSQL 16 binaries (`initdb`, `pg_ctl`, `psql`); repository-owned launcher and tests read; no CI/Vercel/prod environment.
2. Resolve local `postgres` executable/PID, owning process, data directory, config and sockets; reject any port forwarding, Docker daemon proxy, SSH tunnel, hostname alias, `PGSERVICE`/driver overrides, ambiguous process or already-existing cluster. **A URL containing `127.0.0.1` by itself is insufficient evidence of physical locality.**
3. Verify `SELECT version(), current_database(), current_user, inet_server_addr(), inet_server_port(), current_setting('data_directory'), current_setting('transaction_read_only')` against the expected single-use directory, process and role. **Never print secrets or full DATABASE_URL.** No SQL writes until exact identity matches.
4. Reject any inherited environment `PG*` overrides, Neon/Training/production tokens, remote `DATABASE_URL`, `VERCEL*`, `NEON*`, or unexpected `FLYTALLY_*` flags. Use repo-supported `FLYTALLY_LOCAL_POSTGRES=1`, isolated test-only `SESSION_SECRET` and `SIGNING_SECRET`; separate explicit browser/auth purpose flags only at authorized phase.
5. Initialize schema **only after** positive physical-locality and empty-schema checks. The `bootstrap-browser-smoke-db.mjs` path **drops and recreates public schema**; existing `run-auth-browser.mjs` performs fixture bootstrap, and v21 schema-first mode has purpose-gated SQL. These paths must be reviewed for a *newly created* fixture, not re-used against an ordinary local developer DB. Require canonical migration registry v1–v21 and relevant feature migrations when a source path uses `ensureDatabaseOptimizations()`.
6. Refuse schema drift, nonempty preexisting tables, unknown project identity, invalid version, missing tests/binaries or failed cleanup preflight. Fail closed with `NOT RUN`; do not substitute Shadow, Training or Neon for convenience.

**Execution authority note:** no cluster startup, `initdb`, `DROP`, migration, restore or synthetic account write is authorized by this read-only design. An existing generic acceptance script must not be presumed safe solely because it checks the URL.

## 4. Proposed separate D4 acceptance cases (not yet run)

All test content is synthetic; artificial user A/B, fictional flights and FSTD sessions, no real logbook/GPS/PII.

| Case | Test source/method | Required PASS or fail-closed evidence |
| --- | --- | --- |
| D4-0 baseline | Signed v13 fixture, A/B session ownership, full canonical v21 schema, certified flight/FSTD and audit hash snapshots | Signature, account binding, immutable evidence and valid preview; zero unexpected writes pre-restore |
| D4-1 control | Single-session preview then `RESTORE` using unchanged, explicitly missing synthetic records | Exact changed-row counts, valid final certification hashes, pre-restore safety-backup placement |
| D4-2 stale flight ID | Preview says missing; another session inserts/certifies same flight ID before execute | Reject or skip **without any UPDATE** of existing flight/certification and without false added count |
| D4-3 stale FSTD ID | Same pattern for FSTD and certified revision | No overwrite of existing protected FSTD evidence |
| D4-4 concurrent audit | Other session appends audit record after auditFloor and before/inside restoring newly staged flight | No deletion or mutation of unrelated audit evidence; per-entry hash/ID retained |
| D4-5 injected failure | Cause reversible SQL error mid-transaction after simulated earlier writes | All main-restore DB changes rolled back; log/sequence/independent safety-backup effects reported separately, never false zero-side-effect claim |
| D4-6 replay and conflict | Repeat signed restore with different/identical records and two concurrent restore sessions | Idempotency, explicit conflict semantics, no duplicate protected child evidence and accurate counts |
| D4-7 malicious archive/safety | Corrupt signature/changed digest, foreign user A backup retrieved by B, expired/revoked session, induced failed pre-restore safety backup | Fail before main write, no cross-account disclosure; explicit ledger of safety-backup writes |
| D4-8 cleanup | Stop owned app/browser server, release PG clients, confirm physical PID and exact data directory | Exact-ID disposable-only removal after explicit cleanup authorization; no other DB impacted |

**Important validation note:** `sql.transaction(queries)` alone does not protect assumptions made in `prepareExactAccountRestore` or `createStoredBackup('pre_restore')` before that transaction. Merely checking `COUNT` at the end cannot establish that existing flight certificates or audit rows were untouched. Use before/after cryptographic hashes, table counts and controlled two-session barriers.

## 5. Review / implementation gate before PostgreSQL execution

1. Inspect one fully frozen D4 design and test SQL, specifically `lib/account-restore-v6.ts`, constraints/triggers on flights/FSTD and `flight_audit_log`, `lib/db.ts` local adapter semantics and canonical restore model. Keep compatibility, no new dependency, no production migration or trigger bypass.
2. Choose a transaction-safe strategy **before coding**: acquire appropriate identity locks, verify insert outcomes and restrict subsequent certified field updates to rows really inserted, preserve append-only history. Cover F8 actual inserted counts. An initial re-check outside the transaction is inadequate.
3. Independent read-only reviewer: existing DeepSeek F3/F9 findings are evidence of the *old design*, **not approval of a new locking algorithm**. A materially new SQL design warrants a targeted independent read-only reviewer at its frozen SHA before execution.
4. Decide how to register *new* PG test fixture in the immutable partition inventory, including hashes/counts/purpose gates and any new isolated partition; apply only when the actual test code is ready, and preserve existing 164/164 contract unless migration of registry is reviewed as a separate approval.
5. Candidate ledger after execution must distinguish `typecheck`, target/full Node, build, PostgreSQL, browser, exact `verify:release:risk`, and native hardware limitations; an earlier signed HMAC source test is not a DB restore test.

## 6. Status, blockers, one next step

**Registry ownership:** **non-DB Windows Node24 registry 41/41 PASS, recovery group 3/3 PASS, typecheck PASS** at exact tested SHA `807d3d35129963cc67db69ff10882c3171846853` ([test evidence](2026-10-30-data1e3-registry-windows-acceptance-evidence.md)); no runtime PostgreSQL restore performed.  
**D4 local PG16:** design READY, creation/restore/runtime **NOT RUN**.  
**D2 gzip/archive cap:** size policy NOT FROZEN, NOT IMPLEMENTED; prior Neon 1/4/12MiB transport is not max-bound measurement or representative signed archive acceptance.  
**DATA-1 release:** **BLOCKED**.  
**DB/migrations/flags/deploy/merge:** NO changes; production DB state UNKNOWN. Historical DATA-1D disposable Neon project has been deleted and cannot serve as a PG16 acceptance target.

**ONE NEXT STEP:** execute the **non-DB** registry/scope regression on exact working SHA, preserve evidence, then present this isolated PG16 test scope to owner for explicit permission to provision and run a disposable local cluster; do not run any actual D4 SQL until approved.
