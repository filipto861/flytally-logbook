# M0-B B1a — strict parent identity, implementation and real PG16 regression checkpoint

**Date:** 2026-11-02 UTC. **Repo:** filipto861/flytally-logbook. **Verified base:** main `c9c2f60303236113a223942072311f5e37f876f7`. **Work:** `fix/logbook-m0b-b1a-parent-id-20261102` pre-doc HEAD `ace22842350cff1ec970a9134b4cfa1dca74978d` (reverify after checkpoint). B0 high-level design is in separate, **unmerged** Draft PR #454; this B1a is a small independent source slice based on current main, NOT a merger of stacked old DATA-1 PRs.

## Scoped owner authorization and functionality

The owner explicitly authorized B1a implementation and locally isolated tests on 2026-11-02 (requested prompt: "souhlasim pokracuj a at uz mame tohle vsechno hotove!!"). **No consent to merge, deploy, production DB migration/restore/delete or feature-flag changes was implied.** Full-account restore remains **M0-A fail-closed** in server actions and direct executor before any schema/SQL. Individual-flight Trash, backup create/check/download and legacy runtime flags untouched.

`lib/account-restore-v6.ts` removes exactly two instances of `ON CONFLICT DO NOTHING`: staged `INSERT INTO flights SELECT json_populate_record` and `INSERT INTO fstd_sessions SELECT json_populate_record`. Their following credential/certification UPDATEs remain *inside the same pre-existing* `sql.transaction(queries)`. Thus a concurrent or pre-existing parent PK collision produces a PostgreSQL error and rolls back the entire main transaction instead of silently skipping INSERT and updating an unrelated parent ID. This is NOT a complete full-account restore repair.

`tests/m0-account-restore-containment.test.ts` adds a static guard for the two strict parent INSERTs and preserved M0-A service block. `tests/integration/postgres-security-restore.test.ts` changes AC-20's prior unsafe duplicate replay expectation into an explicit rejected duplicate and adds four independently timed **two-session** PostgreSQL cases within that existing test: certified/locked flight, certified FSTD session, draft flight and draft FSTD session. In each: session A begins transaction and inserts an uncommitted marker; session B commits the same parent ID; A executes *source-defined* parent INSERT and UPDATE; PostgreSQL must reject; original parent's complete JSON row and native audit evidence remain equal; A's marker rolls back. Positive genuinely absent FSTD staging + certification and existing full R1/R2, signed verifications, sharing/GPS restore remain tested. No new integration test case count introduced. The SHA-256 pin of the changed integration file is updated in `tooling/postgres-partition-registry.json` with the unchanged **42 files / 164 cases / six partitions** requirements.

## Exact-source evidence

**GitHub Actions [#41508257156](https://github.com/filipto861/flytally-logbook/actions/runs/41508257156), tested HEAD `81967fdada079ef65ec969ccb3213d6d69a30a73`:**

- **PASS:** Node24 `npm run test:target -- tests/m0-account-restore-containment.test.ts` **7/7**, 0 fail/skip.
- **PASS:** `npm run typecheck`.
- **PASS:** `node tooling/validate-postgres-partition-registry.mjs` (registry *integrity*; NOT 164 PostgreSQL cases actually run).
- **PASS:** full `npm test` **1771/1771**, 0 fail/skip.
- **PASS:** `npm run build`, Next.js 16 production build.
- **PASS:** isolated GitHub Actions postgres:16 Docker service, actual SQL identity `b1a_synthetic|b1a_test|172.18.0.2|5432|160015` behind localhost-only client URL, synthetic fixed CI credentials; `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --experimental-strip-types tests/integration/postgres-security-restore.test.ts` **4/4**, 0 fail/skip, including B1a four two-session races in AC-20. Docker service was stopped/removed by GitHub Actions.
- **Earlier failures RETAINED:** Actions #41507027506 and #41507685856 identity preflight initially insisted on server loopback IP, which Docker bridge reports as private `172.18.0.2`; #41507348734 exposed two TS errors in synthetic test typing. No PostgreSQL race test ran in those FAIL runs. All were corrected; successful exact CI run is recorded, not retroactively assigned to failed SHAs.
- **Post-test doc/workflow source:** the temporary test-only `.github/workflows/m0b-b1a-temporary.yml` was removed in commit `ace22842350cff1ec970a9134b4cfa1dca74978d`. Production code/test files from successfully tested CI SHA remain unchanged. The final branch HEAD after this Markdown checkpoint will be docs-only ahead of the tested executable; do NOT call final SHA a newly executed full release candidate.

**NOT RUN:** owner-native Windows canonical six-owned-PG16 164/164 gate, signed-v13 authenticated full restore (intentionally M0-A blocked), entire `verify:release:risk` on final B1a candidate, Neon HTTP transaction parity, mobile/native Safari, full browser release, production authenticated smoke. Node and targeted CI PostgreSQL PASS do not override these. Prod DB/schema/flags UNKNOWN.

## Remaining risks and next step

- M0-A remains live on Vercel deployment `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` runtime SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; **no new deploy**. Main unchanged `c9c2f60303236113a223942072311f5e37f876f7`.
- Other B1b/B2/B3 hazards remain: natural-key collision and missing protected child checks, audit `MAX/DELETE` and imported audit ID collisions, incomplete signed-v13 snapshot, v14 provenance/issuer proof and Neon transactional contract. B1a is **one narrow guard**, not writable account restore.
- **ONE NEXT STEP:** validate this B1a candidate with canonical owned-local Windows PostgreSQL 16 **164/164** and candidate-selected release gates at exactly pinned SHA, then reconcile evidence before B1b/any merge decision. Keep all full-account restore writes disabled. No separate owner approval for merge/deploy/DB/flags was given.
