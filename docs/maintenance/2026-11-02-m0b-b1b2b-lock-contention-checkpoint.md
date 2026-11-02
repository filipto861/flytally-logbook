# M0-B B1b.2b — fail-fast lock acquisition and cross-user contention evidence

**Date:** 2026-11-02 UTC. **Status:** scoped implementation + **targeted CI PASS**; release candidate **NOT RUN**, not merged/deployed. Repository `filipto861/flytally-logbook`; verified main `c9c2f60303236113a223942072311f5e37f876f7`; parent experimental B1b.2a Draft PR #457 `fix/logbook-m0b-b1b2-transaction-guard-20261102@615901b762750e882f2bac0ca1eb388ecd378a91`; child work `fix/logbook-m0b-b1b2b-lock-contention-20261102` pre-document HEAD `6c2f4c607282f0b2d45ec1b4e227c50c1131217e`. B1b.1 Draft #456, B1a Draft #455 and B0 Draft #454 remain unmerged. All tests use synthetic data.

## Scoped runtime and test changes

- **Runtime:** `lib/account-restore-v6.ts` changes one dormant query: `LOCK TABLE flights, fstd_sessions, flight_certified_revisions, fstd_certified_revisions, voided_certified_flights IN SHARE ROW EXCLUSIVE MODE NOWAIT`. PostgreSQL will refuse to acquire this table lock when another writer already holds a conflicting `ROW EXCLUSIVE` lock; restore does not wait for that existing writer. The lock is still held for the duration of the restore transaction and **still blocks normal writers from any account**, even if their rows are unrelated.
- **M0-A boundary remains intact:** `blockFullAccountRestore()` still runs first in exact writer; server actions and legacy writer continue to reject full-account restore, including signed v13. No restore entrypoint enabled; no DB/schema/feature flags changed; backup read/check/create and independent Trash recovery unaffected.
- **Tests:** `tests/integration/postgres-security-restore.test.ts` extends existing AC-20 with true independent PostgreSQL session A/B experiments:
  - A ordinary writer for unrelated user 11 keeps an uncommitted flight `INSERT`; B attempts source-extracted `NOWAIT` lock after adding a synthetic rollback marker. Expected lock failure `55P03`, marker rollback, original flight/audit untouched.
  - A holds source-extracted restore table lock; B attempts unrelated user 11 flight insert with **diagnostic-only 300 ms lock_timeout**; must fail for lock contention. A rolls back and B can then insert successfully; native audit unaffected by the two failed transactions. The final successful synthetic insert is intentionally cleaned up by the test.
  - Original B1a two-session parent races, B1b.2a parent/certification/voided guards and positive path retained.
- `tests/m0-account-restore-containment.test.ts` asserts exactly that the source lock uses `NOWAIT`. Original B1b.2 source ordering and M0-A fail-closed assertions unchanged.
- `tooling/postgres-partition-registry.json` re-pins the integration test SHA-256 with **42 files / 164 declared integration cases** unchanged. No threshold reduction, new package, new schema or user-visible UI.

## Exact test evidence

[GitHub Actions #41520038331](https://github.com/filipto861/flytally-logbook/actions/runs/41520038331), **tested code/test SHA `b5c95731efe93bfe9556c929274bd833a11bb1a7`**: Node24, synthetic PostgreSQL 16.15 Docker target `b1a_synthetic` identity-checked behind loopback:
- **PASS** 17/17 source/identity guards, zero failed/skipped.
- **PASS** TypeScript; **PASS** Next.js build; **PASS** full Node 1781/1781, zero failed/skipped.
- **PASS** PostgreSQL registry hash/inventory 42/164 (**NOT 164 actual PostgreSQL tests**).
- **PASS** targeted PostgreSQL integration 4/4, including the AC-20 two independent session lock contention directions. The test output's container log includes `LOCK TABLE ... NOWAIT` and `canceling statement due to lock timeout`, consistent with assertions. CI disposable PostgreSQL service stopped.
- Post-success temporary workflow `.github/workflows/m0b-b1b2b-temporary.yml` removed in `6c2f4c607282f0b2d45ec1b4e227c50c1131217e`, no executable/test changes in that removal; later checkpoint Markdown updates not re-executed.
- Previous B1b.2a exact-source Actions #41517766335 PASS (different candidate). Previous B1a owner-home Windows 6-owned-native-PG16 164/164, authenticated Chromium4/4, formal risk PASS at `68b43b98f11b79dd8e76acac9c8d6e3a916375ec` and distinct candidate ID, **not transferred** to B1b.2b.

**NOT RUN:** owner Windows native PG16 six physically separate clusters actual 164/164, formal exact B1b.2b release planner, authenticated browser, isolated actual Neon HTTP `sql.transaction` batch LOCK/exception/rollback parity, native Safari, authenticated production smoke, high-load/deadlock benchmarking. Production DB/schema/flags UNKNOWN. No independent second-AI review per prior owner preference; not a release approval.

## Architectural finding: broad table lock is not the final solution

PostgreSQL 16 documentation states `SHARE ROW EXCLUSIVE` conflicts with ordinary `ROW EXCLUSIVE` `INSERT/UPDATE/DELETE`, and `NOWAIT` affects acquisition but **not lock lifetime**. Isolated two-session PG16 tests directly show both effects. This is positive evidence of a live-service regression hazard if full restore were to be enabled. Simply changing to per-account advisory locks would **not** protect natural-key absence against ordinary writers that do not also acquire the same lock. Row locks alone protect existing rows, **not the absence of a same-natural-key row** from noncooperating writers. A date/registration/time/route tuple is an application reconciliation heuristic, not yet approved as globally unique aviation event identity; blindly adding a natural-key unique index could reject legitimate existing data.

**Proposed B1b.2c design choice (not implementation or migration approval):** establish a source-backed immutable event identity and an additive/safe uniqueness contract for it; require complete target-side authorization and transaction-bound parent/child identity proof. Where an operation must serialize per-user writes, make all relevant Create/Edit/Quick Add/flight/FSTD/import writers participate in a scoped protocol, verified across routes, rather than claiming an advisory lock on restore alone is sufficient. Use trigger/unique/index evidence and synthetic duplicate/historical fixtures to select the minimal DB invariant; add a v22 migration only after separately authorized migration plan and target verification. Coordinate with B2 append-only imported-audit ledger and signed v14 coherent backup origin/issuer policy. Do not re-enable full restore while these remain unresolved.

**Owner DO NOT:** no merge, deploy, production/staging/remote DB test, production migration/restore/delete, feature flag change or restore activation was authorized or performed. No Training changes. Keep M0-A fail closed.

**ONE NEXT STEP:** freeze a **B1b.2c granular identity/coordination contract** with actual Create/Edit/Quick Add/FSTD writer map and complete protected-child requirements, and validate read-only schema/constraint inventory before proposing any additive migration or replacing the broad lock. Preserve the B1b.2b two-session negative evidence as the rejection criterion for the current global-lock strategy.
