# DATA-1E3 — owner-approved security directions and staged implementation

**Status:** owner approved D1–D4 as safety direction on 2026-10-30. **This candidate implements only the independent, narrow D1/D3 slice; D2 numeric limits and D4 SQL rewrite are deliberately gated.** No application acceptance/production readiness established.

## Freeze, scope and evidence

- Canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`; unmerged DATA-1D executable `#443@16a94e051037b680f7b08e97e8880e7967ada062`; independent DeepSeek reconciliation docs `#444@512bddf0405854f1c0fe5694b00ee09c8099cb5d`; current work branch `fix/logbook-data1e3-v13-security-gates-20261030` stacked on #444.
- Review: [DeepSeek F1–F9 independently source-reconciled](2026-10-30-data1e-deepseek-independent-review-reconciliation.md) with P1 F1/F2/F3/F4, P2 F5–F9. No P0 reproduced. Historical real Neon HTTP gzip/Base64 stored transport **3/3 PASS** is not signed-v13 application GET/restore. 
- Owner **approves direction**, NOT any production migration, merge, deployment, remote DB restore/write/delete, feature flag or implicit numerical archive limit. Source priority and backwards-compatible legacy recovery must be preserved.

## Implemented small batch on this branch (source + regression tests, acceptance NOT RUN)

**D1: stored v13 authenticity.** `restoreStoredBackup` checks `portableBackupAuthenticity(stored.backup,stored.digest)==="verified"` after owner-scoped retrieval but **before** `restoreParsedBackup` can produce a preview or perform `createStoredBackup("pre_restore")` / main restore. Missing/invalid HMAC for v13 fails closed. Historical versions (<13) continue down their existing `"stored"` trust route unchanged; no accidental legacy downgrade and no new signing format. A rotated signing key may reject a previously valid stored v13: do not bypass HMAC; owner needs a separately approved secure recovery/key-rotation policy.

**D3: sanitized errors.** Authenticated GET backup load failure returns generic HTTP 404 `Backup unavailable` with `Cache-Control: private, no-store`; absent session stays 401 and invalid ID stays 400. Stored action load error returns generic non-sensitive message. Diagnostic logs use only error class, never archive payload, DB connection, user account or raw error details. Existing owner-scoped SQL remains unchanged.

New `tests/v381-data1e3-stored-recovery-guards.test.ts` uses **synthetic HMAC** and source-order assertions for before-preview signature guard, legacy preservation and generic GET errors; no real pilot/flight/GPS fixture. This is not equivalent to authenticated application HTTP/SQL restore.

## Explicit deferred gates (NOT implemented in this small batch)

**D2 — archive size safety; numeric freeze PENDING.** Existing create cap is **50 MiB compressed** and file-import cap is **150 MiB uploaded JSON**; neither establishes safe stored-read decompression, concurrent memory nor Neon provider maximum. Do **not** guess new permanent numbers. Next gated proposal must inventory *synthetic/inventory-metadata-only* valid archive sizes and establish compatible Base64/gzip/raw output limits, `gunzipSync({maxOutputLength})`, memory budget, legacy and rotated-key errors. Test oversized/high-ratio synthetic payload **locally and bounded**, never against real Neon, and verify no enormous allocation. No new limit here; the F2 gap remains open.

**D4 — stale preview, flight/FSTD certification and audit racing; isolated PG16 acceptance PENDING.** Existing `executeExactAccountRestore` carries stale plan outside one SQL transaction, staged `ON CONFLICT DO NOTHING` then certification `UPDATE` by id (flight/FSTD), delete audit rows after an external `auditFloor` and reports planned counts. A partial SQL patch could break protected evidence. Proposal for future small separate code batch: transactional fail-closed target-identity/row-version guard; UPDATE only IDs genuinely inserted in this transaction; preserve flight/FSTD certified and voided history and unrelated audit rows; actual inserted `RETURNING` counts; no unsafe trigger bypass. Must be proven with dedicated **positively identified disposable localhost PG16** and timed concurrency/rollback/audit tests before changing production behavior. Do not silently include in this non-DB-tested slice.

**F4/F5/F7 acceptance:** apparent GET may call schema ensure/session writes and recovery page may create automatic backup; local psql `maxBuffer=16MiB`; `pre_restore` backup remains as separate safety side effect on later restore failure. Future synthetic auth/HTTP fixture must ensure v21 schema-first, strict localhost target and bounded sizes.

## Candidate evidence ledger and next step

- **Source/git:** read-only source reconciliation PASS for frozen parent SHA. New runtime edits have GitHub commit history; local Node24, typecheck, build, PostgreSQL, authenticated GET/restore, browser, candidate release-risk **NOT RUN** until reproducible evidence.
- **Do not:** merge/deploy, run DB migrations, restore any real data, connect to the three original Neon projects for destructive tests, modify `flytally-training`, manufacture P0/prod breach claim.
- **ONE NEXT STEP:** run targeted **non-DB Node24** regression for this exact D1/D3 candidate and review CI evidence; then obtain separate approval for local disposable PostgreSQL16 acceptance and D2/D4 bounded implementation/test proposals.
