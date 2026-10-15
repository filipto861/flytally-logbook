# FlyTally Logbook 3.8.0 — off-Neon v20 archival/recovery gate (15 October 2026)

## 15 October 2026 — R1-B/C security implementation staged; R1-D actual owner tests PENDING

This addendum supersedes older run instructions that mention manifest `schema:1`/`verified_restore` or `initdb -A trust`. No real archive should exist yet; unsigned v1 manifests are now **explicitly refused** and must never be silently trusted/migrated.

**Updated architecture:** `tooling/v380-backup-manifest.mjs` signs the **immutable v2 JSON** with per-archive random-salt domain-separated HMAC-SHA256; AES-GCM ciphertext is independently authenticated; original backup SHA256 and selected schema/count/provenance facts are MAC-bound. The audit `.verification-<timestamp>.json` is a separate non-authoritative local receipt and can NEVER replace manifest verification. `tooling/v380-windows-private.mjs` restricts the source backup directory and temporary local real-data PG18 directory with SID-based NTFS ACLs before sensitive writes. `initdb` uses SCRAM with a random per-run 36-byte bootstrap secret through an ACL-protected short-lived `--pwfile`, never `trust` for actual customer flight records; a wrong-password connection must be denied. `pg_restore --list` reads only authenticated decrypted metadata via stdin before any local PG18 SQL; full archive inventory and extension availability checked; atomic `pg_restore --single-transaction` retained, must fail closed on mismatch.

**Real-data restrictions (DO NOT run yet):** trusted physically controlled Windows host with encrypted volume required, no live untrusted users, secure custody of archive password in a distinct location, no connection URL/key/archive data in chat/repo. The `FLYTALLY_CONFIRMED_ENCRYPTED_VOLUME=YES` variable on a future approved *real-data restore* is only an explicit operator acknowledgment, not cryptographic verification of BitLocker. The new manifest is signed only when an archive is actually exported, not in the `check` command. The backup recovery proof remains weaker than a complete signed portable account-v13 historical recovery and cannot be cited as such. Archive/source snapshot is PG-consistent through `pg_dump`, but pre/post `psql` evidence remains distinct MVCC snapshots; matching selected counts/digests cannot prove all rows were identical to the external SELECT evidence.

**Next safe non-production tests only:**
```powershell
git pull --ff-only
npm run test:target -- tests/v380-off-neon-archive.test.ts
node tooling/v380-off-neon-export.mjs check
node tooling/v380-off-neon-pg18-synthetic-test.mjs
```
Expected **10/10** archive regressions and a complete fresh disposable PG18 synthetic PASS including real SCRAM/wrong-password refusal, authenticated manifest, TOC, AES-GCM, single-transaction restore, source/target data equality, and owned PG18 cleanup. These tests have **NOT RUN on the R1 patch**. Failures must be reconciled before export. Follow with exact-commit independent DeepSeek read-only re-review of `docs/product/3_8_0_OFF_NEON_SECURITY_R1_DISPOSITION_2026-10-15.md` + code, then separate approval of any use of real production data.

## 15 October 2026 — actual synthetic PostgreSQL18 encrypted backup/restore locally PASS (not real production)

Owner verified candidate SHA `9d26c2cb6d01dcf596f64dd6186fbc300323c8ae`: archive crypto/security/fast-exit tests **7/7 PASS** and synthetic PG18 integration script **PASS** through all 10 stages, including isolated PG18 new DBs on random loopback port `62750`, custom-format **2,806-byte pg_dump**, AES-256-GCM streaming encryption, complete authenticated ciphertext validation before restore, `pg_restore --single-transaction`, synthetic data/hash parity and removal of its owned local PG18 instance. Prior failed test reports are historical and superseded **for the synthetic gate only**. **No current Neon production export, encrypted production archive, external recovery copy, production-data restore, signed portable account v13 recovery or independent reviewer verdict exists yet.**

Post-run technical review identified a Windows `pg_ctl` pipe hang still present in the *production-data restore verifier*; this was patched and a source assertion added **after the tested SHA**. Do not equate 7/7 prior unit evidence or synthetic PG18 PASS with full production-restore verifier PASS at current code.

**Next:** independent read-only DeepSeek security verdict against the exact updated source (`docs/product/3_8_0_OFF_NEON_INDEPENDENT_SECURITY_REVIEW_HANDOFF_2026-10-15.md`), reconcile identified blockers, and rerun targeted regressions. In particular examine the temporary PG18 instance's localhost `-A trust` configuration for a machine storing plaintext production records during test, physical storage encryption and backup/key custody, SSL/prod branch identity, and source snapshot/data integrity coverage. **Interactive real Neon `export` remains NOT AUTHORIZED for this stage.** Explicit C0 release/migration authorization remains separate.

## 15 October 2026 — synthetic pg_dump stdout race fixed in source; PG18 retest PENDING

Owner on `d1cc5b91` observed archive tests **5/5 PASS**, synthetic local PG18 at stage05 **FAIL** `pg_dump exit 0, empty source stream; stderr (empty)`, then reported stage10 cleanup. An independent local Node fast-exit reproduction showed that attaching a reader only after an async delay like scrypt can lose child stdout, whereas immediate PassThrough piping preserved all bytes. PostgreSQL's `pg_dump -Fc` uses stdout when no `--file` is specified. Both the synthetic runner and production export now call `retainChildStdout(dump)` immediately after spawning pg_dump, using a bounded 64KiB backpressure-aware stream, before asynchronous encryption key derivation. This does **not** weaken PGDMP/exit/AES integrity checks. A fast-exit child regression and source-order invariant have been added; **source readback only, owner-local Windows runtime NOT YET VERIFIED**.

Next owner-local no-Neon commands:
```powershell
git pull --ff-only
npm run test:target -- tests/v380-off-neon-archive.test.ts
node tooling/v380-off-neon-pg18-synthetic-test.mjs
```
Require final `SYNTHETIC PG18 ENCRYPTED BACKUP/RESTORE PASS.` and local PG18 stop/cleanup. **Do not run real production export** before isolated full runtime PASS and independent reviewer reconciliation; no production v21 authorization has been granted.

## 15 October 2026 — PG18 synthetic run after Windows pg_ctl fix: stage-05 FAIL; signed-stream validation revision (awaiting retest)

Owner checkout `c0d6f2d4`: four archive security/source tests **PASS**, isolated PG18 initialized, started on loopback port 50207, created synthetic databases, inserted synthetic rows, and reached encrypted `pg_dump` stream at stage 05. It failed `Encrypted database archive unexpectedly small`, then reported stage 10 stop/cleanup without error. **Full encrypted PG18 restore NOT RUN/PASS.** This error was generated by an arbitrary 1024-byte payload floor **before** observing `pg_dump` exit/stderr; actual dump validity cannot be concluded.

Revised codec removes arbitrary threshold but **does not accept empty/foreign dump streams**: it requires nonempty ciphertext, exact on-stream `PGDMP` signature (for `pg_dump` export callers), AES-GCM authenticated tag, and original `pg_dump` exit code = 0. Added synthetic diagnostics for nonzero child code/stderr and actual input bytes; separate restore must still succeed and verify SQL record integrity before any PASS. Tiny archives are never accepted as production-safe solely by size/signature. **Latest changes NOT YET RUN locally.**

Next safe local commands:
```powershell
git pull --ff-only
npm run test:target -- tests/v380-off-neon-archive.test.ts
node tooling/v380-off-neon-pg18-synthetic-test.mjs
```
**Do not run real production `export` yet.** Independent security review, live backup/recovery, and signed v13 historic restore remain open. Historical protocol below remains for audit trail.

## 15 October 2026 — owner PG18 gate PASS; hardening and synthetic restore PENDING

Owner tested exact prior code SHA `4a88bae044dc307ea5f9571e46626cd681f161d5` from Windows/Node24: `tests/v380-off-neon-archive.test.ts` **3/3 PASS**, and `node tooling/v380-off-neon-export.mjs check` **PASS** (`PG18 clients found. Backup NOT RUN.`). No Neon production `pg_dump`/backup/restore performed.

Subsequent independent security pre-review found two meaningful deficiencies in unrun code and **patched them before first live export**:
- Inherited `PGHOSTADDR`/`PGSERVICE`/`PGSERVICEFILE`/other `PG*` environment could override `PGHOST`. Both source and restore tools now strip inherited `PG*` and `DATABASE_URL`; local restore pins **both** `PGHOST` and `PGHOSTADDR` to `127.0.0.1`.
- GCM tag validation occurs at end of streamed decryption; one-pass restore could feed as-yet-unauthenticated plaintext into `pg_restore`. Verification now decrypts **the whole archive to a discard sink before starting any local PostgreSQL instance** and rechecks ciphertext SHA256. Only after full authentication does it start local PG18 and stream again into `pg_restore`; no new plaintext dump file is created.
- No restore PASS manifest is written until the plaintext test PostgreSQL is **stopped and its private directory actually removed**.
- Export preflight metadata (schema/count/protected evidence digest) is queried again after dump, and the archive is refused/discarded if monitored values changed before/after, preventing false manifest parity during active writes. `pg_dump` itself has independent transaction-consistent snapshot; these are different guarantees.
- Added `tooling/v380-off-neon-pg18-synthetic-test.mjs`: owner-local full disposable **synthetic** PostgreSQL18 `pg_dump -Fc` → encryption → full tag validation → `pg_restore --single-transaction` → data digest parity. No production data/URL is used. This is the next gate.

**Next safe operator commands** after `git pull --ff-only`:

```powershell
npm run test:target -- tests/v380-off-neon-archive.test.ts
node tooling/v380-off-neon-export.mjs check
node tooling/v380-off-neon-pg18-synthetic-test.mjs
```

**Do not run the interactive production `export` yet.** First require synthetic PG18 PASS, independent reviewer disposition of `docs/product/3_8_0_OFF_NEON_INDEPENDENT_SECURITY_REVIEW_HANDOFF_2026-10-15.md`, and any minimal patches/regressions. This addendum supersedes the older, less stringent stage instructions below while preserving their history.

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
