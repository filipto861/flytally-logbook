# FlyTally 3.8.0 — D3a Create/Restore lock parity & D3b protected-evidence discovery

**13 October 2026 — NESTED DRAFT / NOT RUN / NOT SHIPPED**

## Owner-local D3a completion — verified 13 October 2026

**Exact tested source commit:** `59a9801816f57375b6468c74274eb0ee1baf6f81`; owner Windows Node24, freshly initialized native PostgreSQL 16 temporary database `127.0.0.1:65383`.

Owner test output:
- `tooling/run-v380-d3a-create-restore-local.ps1`: database identity `flytally_currency_test|flytally|127.0.0.1|65383` expected/observed **MATCH**, temporary server stopped successfully.
- Project `npm run typecheck`: **PASS**.
- `tests/v380-trash-restore-v20-column-coverage.test.ts`: **7/7 PASS**, 0 fail/skip.
- `tests/integration/v380-restore-lock-and-trigger-contract.test.ts`: **6/6 PASS**, 0 fail/skip.
- `tests/integration/postgres-v380-full-v20-restore.test.ts`: **8/8 PASS**, 0 fail/skip. The new case tested parallel independent native PG16 sessions running a **Create-like canonical fingerprint lock / conditional INSERT** against the **actual source-extracted Restore SQL**: exactly one matching flight.
- Local runner: `LOCAL D3a Create/Restore fingerprint gates PASS on candidate 59a9801816f57375b6468c74274eb0ee1baf6f81. Not a production migration.`

**Disposition:** D3a Create-like/Restore advisory fingerprint parity and scope-specific serialization are **locally accepted** at this commit. Previous "NOT RUN" captions below are historical and superseded. No confirmation of authenticated Next.js Create action, Update/Edit and GPS/Quick Add alternatives, full protected evidence, or production readiness. Later documentation-only commits require no retest of source, but any runtime/test change does. No merge, deployment, v21 migration registration or remote DB write.

## Verified repository reconstruction

- Canonical repository `filipto861/flytally-logbook`, `main@4ca2847795435549f36d44f253eb7c105eea6d25` ships 3.7.0; v3.8.0 still multiple unmerged Draft PRs.
- Parent Draft **#329**, previously owner-local **Node24 typecheck + 7/7 source, 5/5 contract, 7/7 full-v20 native PG16 PASS at exact code SHA `0bb5b4965f7234991ac4530a358eb8de48951a9d`**. Draft #330 provided separate owner-local Neon JavaScript HTTP synthetic transaction PASS; all temporary Neon branches removed, independently confirmed.
- `app/(protected)/flights/actions.ts` — `createFlight` constructs `flightFingerprint(userId,{date,registration,offBlock,departure,arrival})`; issues `SELECT pg_advisory_xact_lock(hashtextextended(${fingerprint},0))` before conditional INSERT, inside one `sql.transaction([...])`. `lib/flight-dedup.ts` canonical text is `[userId, clean(date),clean(registration),clean(offBlock),clean(departure),clean(arrival)].join('|')`, with `clean` = null/undefined → empty, trim, uppercase.
- Parent Draft Restore used `hashtextextended(jsonb_build_array(...)::text,0)`, a **different lock key**. Hence passed Restore/Restore tests did **NOT** show Create/Restore serialization.
- `updateFlight` has no matching natural-key advisory lock, and writes revised date/registration/off-block/route without an explicit destination duplicate check in the inspected SQL. Do **NOT** label Create/Edit vs Restore globally race-safe. Also GPS import/split and Quick Add have separate paths requiring investigation.
- `moveFlightToTrash` guards `certified_at`, revision and `flight_certified_revisions`, but snapshots only **flight, tracks, expenses**. Source-account `flight_participations`, `flight_connected_crew`, `flight_public_shares`, instructor approvals, verifications and `flight_source_provenance` are **not included** in the trash payload. The current v20 DB uses protected `voided_certified_flights`, `voided_flight_archive_items`, `flight_source_provenance` and associated triggers; voiding uses separate auditable tombstones and explicit participant/share/provenance transitions. Do NOT silently treat these as ordinary trash children.
- Restore candidate blocks source `certified_at`, `locked_at`, revision !=1, nonempty correction reason, and original `flight_certified_revisions`, but not independently every conceivable protected marker or voided tombstone. Legacy snapshots with all blank/missing aircraft identity can fail closed. Source safety/provenance and backward compatibility need further evidence before merge.

## D3a isolated scope: single canonical Create/Restore key

- In `lib/flight-trash.ts` changed only Restore advisory argument from `jsonb_build_array(...)::text` to:
  `concat_ws('|', user_id::text, UPPER(TRIM(COALESCE(flight_data->>'date',''))), UPPER(TRIM(COALESCE(flight_data->>'registration',''))), UPPER(TRIM(COALESCE(flight_data->>'off_block',''))), UPPER(TRIM(COALESCE(flight_data->>'departure',''))), UPPER(TRIM(COALESCE(flight_data->>'arrival',''))))`.
  This matches canonical JS `flightFingerprint` field order and normalization for the supported ASCII flight identity envelope. Keep existing `sql.transaction([...],{isolationLevel:'ReadCommitted'})` two SQL statements and archive row FOR UPDATE.
- Extended source tests verify Create lock/fingerprint source presence, Restore normalized six-part string, and no speculative unique index.
- Extended full-v20 native PG16 tests to use actual Restore SQL, plus **parallel independent connections running an explicit Create-like fingerprint lock/conditional INSERT and Restore-like transaction on identical source values**. This models Create transactional SQL but does **NOT** execute the authenticated Next.js FormData action itself.
- Test runner `tooling/run-v380-d3a-create-restore-local.ps1` copied from the proved disposable PG16 Windows runner, branch pinned, temp PG16 cluster only; executes project `npm run typecheck`, existing 7 source tests, **6** lock/guard tests and **8** native PG16 tests. Expected total **21**; **ALL NEW D3A TESTS NOT RUN** until owner output. No new remote DB target allocated.

### Local run after fetch and switch to exact D3a branch

```powershell
git fetch origin
git switch fix/3.8.0-d3a-create-restore-fingerprint
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-v380-d3a-create-restore-local.ps1
```

Record exact tested SHA and all results. An initial source review / text match is NOT an execution PASS. Do not merge based on native PG only: route-level changes and proper overall regression still required.

## D3b protected/voided/shared evidence — read-only discovery, DESIGN NOT FROZEN

| Evidence/flow | Grounded dependency | Concern | Candidate acceptance |
| --- | --- | --- | --- |
| Certified/revised | `flights.certified_at`, `locked_at`, `record_revision`, `flight_certified_revisions`, verification evidence | Cannot resurrect or alter finalized evidence | old/new certified, corrected, locked records all fail closed without side effects |
| Voided certified | v20 `voided_certified_flights`, immutable archived items and source provenance | Ordinary trash is not a tombstone restore path; avoid resurrection | refuse conflicting voided parent; verify no changing void hashes/provenance |
| Source participation / PIC / instructor | `flight_participations`, `flight_connected_crew`, instructor approvals | Trash archives no corresponding complete child evidence; ownership and signed participant evidence independent | inventory actual FK/triggers; fail closed when independent evidence would be lost, unless separate authoritative restore protocol is designed and approved |
| Recipient participant flight | `flight_source_provenance` and participant foreign keys/triggers | Must not silently create detached/shared duplicate | independent source and participant evidence preserved, no destructive cascade |
| Public shares / revisions | `flight_public_shares`, verifications, snapshots | link revocation and immutability differ from deletion | prove safe source/recipient lifecycles and absence of dangling permissions |

**Do not implement destructive cascading fixes or invent new defaults.** A simple global restriction on all participant-linked drafts may change current user functionality, so first catalogue which data can exist legitimately, test actual FK/trigger behavior, and request owner decision for any compatibility tradeoff. A second independent AI review (DeepSeek/Claude) is recommended **after** this read-only inventory and before irreversible design/migration or release merge.

## Product decision / release gates

- Natural identity for `updateFlight`: options include strict locking + destination duplicate guards across **every** writer (minimal code but audit all paths), vs source-authorized explicit database uniqueness/migration after legacy collision inventory (stronger DB guarantee but may break historical legitimate duplicates). **No decision presumed.**
- Never silently alter finalized/void evidence, do not infer missing money currency, do not apply v21 writes to v20. No production Neon writes, deployment, release merge, FX/backfill or Training edits.
- Follow-up scope: native PG16 D3a verification → protected relation fixture matrix/read-only audit → design/review → small guarded batch → full source tests + SDK/Neon if transaction surface changed → v21/signed-v13/ISO/build/CI/browser release gates.
