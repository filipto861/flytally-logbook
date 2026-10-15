# FlyTally Logbook 3.8.0 — off-Neon v20 archival/recovery gate (15 October 2026)

**Status:** tooling staged in Draft PR #338. **Production export NOT RUN; local PG18 restore NOT RUN; NO-GO for live v21 DDL.** No backup file has been created by the assistant.

## Purpose and frozen state

Independent recoverability is distinct from Neon in-project copy-on-write branch `br-shiny-bonus-b1gqt9u7`. The owner chose **not** to purchase Neon protected-branch support; it is N/A, not enabled. The current manual-snapshot quota is occupied by older `snap-proud-fire-b1bm8oac`, which must be retained.

Canonical live target, rechecked from Neon API on 15 October:
- Project `muddy-dust-14049657`, default/primary `br-raspy-fog-b1btvu5t`, database `neondb`, PG18.6.
- **Unpooled/direct** compute endpoint `ep-proud-bar-b1ts6cq1.c-5.eu-central-1.aws.neon.tech` (`ep-proud-bar-b1ts6cq1`). The endpoint was idle at last read; not an error.
- Current production Vercel v20 application `dcc8ebbfda0eadfa01345cd875ef1db806a19e26`. Application candidate 3.8 has local four-gate PASS on `42e72909` and separate actual frozen v20-on-v21 H4 PG16 browser **8/8 PASS on `b23f9b99`**.
- Re-resolve Neon default branch, compute endpoint, DB schema and Vercel production database URL immediately before actually exporting; do not rely only on the dated values here.

## Tooling staged (strictly Windows/Node24/PG18)

- `tooling/v380-backup-archive.mjs`: streaming **AES-256-GCM + scrypt** password-based file encryption. Format `FT380A01` + 16-byte random salt + 12-byte nonce + encrypted PostgreSQL custom format + 16-byte authenticated GCM tag. Header is authenticated as AAD. Password must be at least 16 characters, and must be kept **separately** from the archive. There is **no plaintext pg_dump file** on disk. Recovery tools/source must also be retained offline with the password.
- `tooling/v380-off-neon-export.mjs`: prompt for **direct** Neon URL in masked interactive input; refuse incorrect host/DB/port, unknown URL parameters and pooled connections. Use only PG18 binaries from `%ProgramFiles%\PostgreSQL\18\bin`; authenticated TLS `verify-full`, `sslrootcert=system`, `channel_binding=require`; fail closed if certificate trust/connection cannot be verified. Production is **read-only** via `PGOPTIONS` and `pg_dump -Fc`. Identity includes PG18, SSL, exact migration 1..20 and zero v21 columns. Store only AES ciphertext in `%LOCALAPPDATA%\FlyTally\PrivateProductionBackups`, outside the Git repo; verify encrypted SHA256 and generate a nonsecret JSON manifest with provenance, counts and protected evidence fingerprints.
- `tooling/v380-off-neon-restore-check.mjs`: local **new** PG18 cluster on a random `127.0.0.1` port under a unique temp folder, new `flytally_restore_test` database, 0 production/Neon restore targets. Verify encrypted file SHA256 and source manifest, require masked passphrase, stream plaintext **only to local pg_restore stdin** (`--single-transaction --exit-on-error --no-owner --no-acl`). Verify migration registry, 52+ tables, record counts and historical certified-void/provenance whole-row hashes against the snapshot-time manifest (both sessions UTC). Stop and remove only own PostgreSQL cluster after success/failure; preserve if stop uncertain. Mark manifest restored only after all gates succeed.
- `tests/v380-off-neon-archive.test.ts`: synthetic secret binary round trip, wrong key, ciphertext tampering and source/target safety-regex guards.

**Known limitations:** copy-on-write Neon branch is not a separate disaster recovery backup. Local test cluster briefly contains **plaintext personal/flight data** on disk; the owner must run it only on a trusted/encrypted Windows volume, keep the computer secure, not share archives or passwords, and preserve AES password separately. `pg_dump` is transactionally consistent but the pre-export count/hashes are taken separately; concurrent user writes may produce legitimate manifest mismatches. **Fail closed and reconcile**, never force acceptance. The encryption tool and key cannot be assumed available if the GitHub repository or device is lost; keep an offline copy of restoration instructions/tool. PostgreSQL roles/global privileges are not included in database-level `pg_dump`; the restore uses `--no-owner --no-acl`. Signed portable **account v13** restore is a distinct workflow still OPEN.

## Owner-local acceptance sequence — do not run before review

1. Install official PostgreSQL **18** binaries on Windows (installing 18 alongside existing 16 is supported when ports remain distinct); no need to use an existing PG16 server. Keep Node **24**.
2. From a clean `feat/3.8.0-m2a0-schema-review-main`:
   ```powershell
   git pull --ff-only
   npm run test:target -- tests/v380-off-neon-archive.test.ts
   node tooling/v380-off-neon-export.mjs check
   ```
3. Only if all PASS and independent source review is complete:
   ```powershell
   node tooling/v380-off-neon-export.mjs export
   ```
   Copy the **direct (pooling disabled)** connection URL from Neon Console when prompted. **Never paste the secret URL into chat, commands, log files or GitHub.** Supply/confirm a unique long passphrase in masked terminal prompt. Record output archive path and SHA256 only. File creation **does not** prove restore.
4. On a trusted **encrypted** Windows system volume with PG18 server binaries installed:
   ```powershell
   node tooling/v380-off-neon-restore-check.mjs verify "C:\...\flytally-pre-v21-....ftbak"
   ```
   Provide only the archive password in masked input. The second confirmation prompt accepts exactly `RESTORE_TEST`. Ensure success prints `OFF-NEON RESTORE CHECK PASS` and that the temporary server stops.
5. Report **safe-only evidence**: commit SHA, three test outcomes, export archive SHA256 (no archive contents/path if private), DB server/version and aggregate counts, restore result. Never send the connection URL/password/dump.

## Acceptance criteria

- Exact current-primary identity API and connection endpoint match, current production still v20, no branch or Vercel drift.
- PG18 tools and Node24 available; unit tests PASS (not merely source readback).
- Export produces authenticated encrypted artifact **outside Neon and outside repository**, manifest and checksum; no plaintext archive file created.
- **Independent local PG18 restore** PASS with all 52+ tables, unchanged migration registry, matching complete selected counts/archived-certification/provenance digests; temporary cluster stopped. Treat all failures as NO-GO.
- Explicitly preserve real production, old branches, original manual snapshot and no-compute checkpoint; no DDL, merge or deploy.
- Independent DeepSeek/security review of the encrypted-archive implementation and this procedure before use with production data. Review especially parser bypass/credentials, pg_dump consistency, binary streaming GCM tag/auth, Windows workdir cleanup, full restore/malformed archive behavior, digest timezone, Windows PG18/Neon extension compatibility and crash handling. DeepSeek verdict is **not authoritative**; reconcile with repo/test evidence.
- Separately complete **historic signed account v13** recovery, independent source provenance/reviewer disposition, production v21 preflight and explicit owner C0 migration authorization.

## Documentation and reference

- Neon: [Backups with pg_dump](https://neon.com/docs/manage/backup-pg-dump). Direct/unpooled connection required.
- PostgreSQL: [pg_dump 18](https://www.postgresql.org/docs/18/app-pgdump.html), [pg_restore 18](https://www.postgresql.org/docs/18/app-pgrestore.html), [TLS verification](https://www.postgresql.org/docs/18/libpq-ssl.html).
- Earlier exact runbook: `docs/product/3_8_0_V21_EXACT_PRODUCTION_MIGRATION_PLAN_2026-10-14.md`. Historical stages superseded only where explicitly stated.
