# DATA-1 — coherent signed account backups: source reconstruction and frozen review proposal

**Milestone:** DATA-1 (P1) after SEC-1; **DESIGN / REVIEW PENDING; implementation NOT STARTED**.
**Verified Logbook baseline:** `main@807f281e5870164b794d001480ecc84e0b45aea5` (2026-10-29); DATA-1 work branch `docs/logbook-data1-snapshot-design-20261029` based directly on main, not SEC-1's work branch.
**Owner instruction:** continue planned development **without running tests**. No merge, deployment, production migrations/DB/flags, remote DB access, or changes to `flytally-training`.
**Related dependency candidate:** SEC-1 Draft [PR #432](https://github.com/filipto861/flytally-logbook/pull/432), not merged into main. DATA-1 must be reconciled against main after SEC-1's independent owner decision; never implicitly depend on its packages.

## Observed current implementation — not inferred

1. `lib/account-backup.ts:buildAccountBackup(userId)` awaits schema preparation helpers and then uses `Promise.all` on **30 independent SELECTs** (`flights`, `flight_tracks`, `flight_expenses`, `flight_audit_log`, revisions, void/collaboration evidence, settings, user profile, and other sections). Each independent query can observe a different PostgreSQL MVCC snapshot. This is a plausible torn-export race, not proof of an actual production incident.
2. It computes per-section counts, constructs portable **v13**, calculates SHA-256 and server HMAC signature, and returns the export. Cryptography proves integrity and origin of serialized bytes; it does **not** prove that those bytes came from one consistent source snapshot.
3. Shared call paths: `app/api/export/route.ts` JSON export; `lib/backup-center.ts:createStoredBackup()` handles automatic/manual/pre_restore storage; caller paths include `app/api/cron/backups/route.ts`, `app/(protected)/export/actions.ts` and deletion safety backup in `app/(protected)/flights/actions.ts`. A fix must cover **all** call paths through the common `buildAccountBackup`; no endpoint-only patch.
4. `lib/db.ts` exports a lazy `sql` proxy. Locked `@neondatabase/serverless@1.1.0` supports non-interactive `sql.transaction([queries],{isolationLevel:"RepeatableRead",readOnly:true})` for one PostgreSQL snapshot: [official Neon transaction contract](https://github.com/neondatabase/serverless/blob/main/CONFIG.md).
5. `lib/local-postgres.ts` exposes `.transaction(queries)` through a single `psql` process, but its implementation currently runs `BEGIN;\n...COMMIT;` **without passing or enforcing isolation/read-only options**. Simply changing the shared builder to `sql.transaction(...,options)` would be unsafe in local acceptance because it would silently use ordinary READ COMMITTED semantics.
6. `lib/portable-backup.ts:parsePortableBackup()` checks format, digest, required sections, declared counts and ownership; `lib/backup-certification.ts:validateBackupCertificationHistory()` covers protected certification history. These checks are not a substitute for one source snapshot, and changing their existing legacy compatibility is out of scope.

## Proposed minimal implementation slice (requires independent read-only review first)

- **`lib/account-backup.ts`:** preserve the **exact SELECT projections, ordering, ownership predicates and v13 payload**. Move all 30 SELECT expressions into one `await sql.transaction([...], {isolationLevel:"RepeatableRead",readOnly:true})`. Keep schema preparation **before** the read-only transaction; no DDL inside. No Promise.all fallback. Fail closed if the snapshot transaction is unsupported, times out or returns malformed results; never sign/persist an incomplete result. Preserve existing `backup-center` and public export call sites unless evidence demands a change.
- **`lib/local-postgres.ts`:** add explicitly typed, allowlisted transaction options to the existing local `.transaction` adapter; emit one physical `BEGIN; SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; ... COMMIT;` for this exact option pair, leaving all existing read/write transaction defaults unchanged. Reject unknown/unsupported options rather than ignoring them. Preserve the existing deferred-query ownership and row-result contract.
- **Snapshot timestamp:** decide whether `exported_at` should reflect the SQL transaction snapshot or completion time. Avoid silently changing v13 semantics; recommend keep current timestamp for backward compatibility and, if necessary, add internal-only metadata outside signed schema after review. A row-visible snapshot cutoff is implicitly stabilized for `NOW()` inside the transaction.
- **Cross-record validity:** use existing `parsePortableBackup` and protected-history validators where appropriate to reject impossible or malformed relationships **before a backup is delivered/stored**, without rewriting certified evidence or fabricating missing rows. Evaluate the compatibility risk with legacy data and count constraints before deciding whether to add new mandatory validation.
- **Limits:** transaction packs all 30 results into one HTTP response. Large-account payload and query count limits of the Neon HTTP endpoint are **UNVERIFIED**; local adapter currently has `spawnSync` maxBuffer 16 MiB. A one-request transaction may hit size/time/memory limits before existing 50 MiB compressed-backup cap. Never silently truncate or fall back to uncoordinated reads; choose explicit UNAVAILABLE and a separately reviewed bounded export strategy if measured limits require it.
- **No database schema change**, format downgrade/upgrade, cleanup of shared evidence, migration, flag changes, new dependencies or user-visible redesign.

## Unresolved design risks requiring independent read-only reviewer

1. Will Neon HTTP `transaction` with 30 SELECTs, 1.1.0 driver, and a large account reliably provide a single REPEATABLE READ snapshot without an unacceptable request/response size or latency ceiling? How to fail closed for oversized data?
2. Can the local `psql` compatibility adapter enforce **exactly** read-only REPEATABLE READ for this call while keeping older mutation transactions byte-for-byte equivalent? Should the isolation statement be set inside `BEGIN` or encoded in `BEGIN TRANSACTION ISOLATION LEVEL` for visibility?
3. Must `exported_at` identify SQL snapshot time, and how can that be done compatibly with portable v13 signatures? Does required parser/certification validation risk blocking legitimate legacy backups?
4. Are there cross-user collaboration or multi-transaction writer histories where one database MVCC snapshot is not enough to prove application-level invariants? Which owner-visible failures must remain explicit?

## Proposed acceptance (future gate; NOT RUN by owner instruction)

- Synthetic concurrent two-session old/new-state mutation around flight + track + expense + certification reads: export must be **one complete state**, never a mixed state; zero partial signed backup rows.
- Controlled local PG16 production-equivalent schema: repeatable read, read-only attempts rejected, permission/ownership and absent/malformed user rows fail closed, concurrent deleted/restored and voided histories remain authentic.
- Portable v13 existing parser and restore compatibility (including signatures, revision chain, voided and shared evidence), and large synthetic account at current size caps; proof of behavior for both Neon HTTP driver and local adapter.
- Exact candidate-bound source/typecheck/build and risk-selected backup/restore/PG evidence **NOT RUN**. No automated tests, `npm ci`, build or SQL were executed in this design-only milestone, as explicitly requested.
- Security review with reviewer verdict (APPROVE / APPROVE WITH CHANGES / BLOCK), source-specific findings and lead reconciliation **PENDING**.

## DO NOT / release authority

No merge, production deploy, live Neon data access, data migration/restore/delete, production feature-flag operation, destructive test, training repo change or bypass of snapshot guarantees. Review pending is NOT implementation approval; documentation-only Draft is NOT a shipped fix.

**ONE NEXT STEP:** obtain one independent **read-only** SHA-frozen architecture/data-integrity review of this proposal, reconcile findings against source, then implement a small source change on a dedicated DATA-1 fix branch with tests explicitly NOT RUN until the owner authorizes them.
