# FlyTally 3.8.0 — independent DeepSeek backup/recovery R1 disposition

## 15 Oct 2026 — R1-B/C + executable R1-D test harness STAGED, not yet run by owner

**Current code implements rather than merely proposes B-1/B-2:**
- `tooling/v380-backup-manifest.mjs` adds **immutable manifest v2** with per-archive random-salt, separately domain-separated scrypt HMAC-SHA256 over canonical immutable provenance, schema evidence, archive size/hash and timestamp; `verifyManifest` uses constant-time MAC comparison, refuses unsigned v1 and altered metadata. `v380-off-neon-export.mjs` now signs the manifest and restricts its NTFS backup directory ACL. `v380-off-neon-restore-check.mjs` authenticates the manifest BEFORE trusting source identifiers, then authenticates the archive GCM before any PG18 startup, and leaves the manifest immutable; it writes a separate **non-authoritative receipt** only after verification/stop/cleanup.
- `tooling/v380-windows-private.mjs` uses Windows SID + `icacls` to restrict private temporary restore/backup directories to current owner and SYSTEM; local restoration creates a random one-time SCRAM password, passes it to `initdb -A scram-sha-256` through a private ephemeral `--pwfile` (removed immediately), and uses scoped `PGPASSWORD` only in child environments. Both production-restore verifier and synthetic PG18 runner assert that the right password works and the wrong password is rejected. Owner must explicitly confirm a trusted **encrypted local volume** via `FLYTALLY_CONFIRMED_ENCRYPTED_VOLUME=YES` for a future real-data local restore; setting this flag is an acknowledgment, not verified BitLocker evidence, so volume security remains an operator/reviewer requirement.
- `tooling/v380-backup-toc.mjs` authenticates and streams `pg_restore --list` without DB access, parses TABLE + EXTENSION inventory; real-data verifier requires at least 50 tables and confirms each cited extension is available in the newly created local PostgreSQL before executing SQL. It retains `pg_restore --single-transaction --exit-on-error`.
- `tests/v380-off-neon-archive.test.ts` now contains **10** cases, adding manifest substitution, wrong key/modified provenance/unsigned v1, SCRAM/ACL/TOC source contracts, and 12-MiB slow writable-stream backpressure. Synthetic PG18 now exercises signed manifest, SCRAM+invalid-password denial and TOC listing in the same full actual `pg_dump`→AES→`pg_restore` path. Additional Windows symlink-path and source query timeouts fail closed.

**Validation state:** GitHub file readback/JS syntax/static safety markers **PASS**. **No Node unit tests, Windows SCRAM/ACL test, PG18 synthetic integrated test or independent DeepSeek re-review has run since these changes.** The prior owner-local 7/7 + PG18 synthetic PASS remains evidence for *older* `9d26c2cb`, not this SHA. External production backup, actual-data restore, signed-v13 history, v21 DDL/merge/deploy **NOT RUN**. Stage labels: **R1-B/C CODE STAGED; R1-D owner-local and independent-review PENDING**, release NO-GO.

**Immediate nonproduction owner-local verification:**
```powershell
git pull --ff-only
npm run test:target -- tests/v380-off-neon-archive.test.ts
node tooling/v380-off-neon-export.mjs check
node tooling/v380-off-neon-pg18-synthetic-test.mjs
```
Expect **10/10 target tests and full synthetic PG18 PASS**; stop and send the first actual error otherwise. Synthetic test alone never contacts Neon. Do **NOT** run real `export` or `restore-check verify` with customer data before re-review/decision. Re-submit exact updated commit to DeepSeek for second READ-ONLY verdict and reconcile new findings. C0 production migration/deploy owner GO remains separate.

**Status (15 Oct 2026):** design/reconciliation only; production `export`, real-data local `restore`, v21 DDL and deploy are **NO-GO**. Reviewer is independent and read-only; its findings are input, not automatic authority. Current repository HEAD checked before this document: `e093efa9eb1d6f424336427abb83adf7852f40fe`. Owner-local synthetic PG18 `pg_dump`→AES-256-GCM→`pg_restore` **PASS** at older `9d26c2cb`, archive regressions **7/7 PASS**. Subsequent restore-side pg_ctl hardening has not been owner-run.

**Provenance:** owner-supplied independent DeepSeek review dated 2026-10-15, describing inspected source and no tool executions; reviewer reports "Reviewed HEAD `1dd456320c3e3ea2eb6a95eac40ea6aecd60e9e`", older than currently inspected code. Its contents were compared directly with GitHub's latest branch source before these decisions.

## Confirmed security blockers

1. **B-1 local decrypted production restore uses `initdb -A trust`.** Confirmed in `tooling/v380-off-neon-restore-check.mjs`. A loopback TCP service with a trust-authenticated superuser should not host decrypted personal/certified flight records. Planned minimal replacement: ephemeral random credential using PostgreSQL 18 `scram-sha-256`, restricted temporary credential handling, explicitly local PGHOST+PGHOSTADDR+random port, sanitized environment. Must validate that initdb credential setup is safe on Windows; no plaintext password in args, stdout, Git, logs or long-lived file. Require verified local-only auth positive and negative connection tests, PG stop/removal, and Windows ACL/BitLocker decision before executing on actual records. **Do not weaken target-locality checks.**
2. **B-2 manifest has no authenticated binding to encrypted archive.** Confirmed: a plain `.manifest.json` stores schema/row evidence and encrypted SHA256; verifier compares the digest but an attacker able to edit BOTH files can forge that comparison. Planned small schema revision: derive a **separate, domain-separated HMAC key** per archive/passphrase using independent KDF context and stored random archive salt, authenticate canonical immutable metadata binding file hash, source project/branch/host, server/registry/evidence, timestamp and format version. Never use a fixed generic KDF salt. Verify HMAC **before trusting manifest fields** and also verify archive's own AES-GCM tag. Avoid mutable `verified_restore` in signed manifest; write separate non-authoritative local verification receipt only after actual restore + cleanup PASS. Add pass/wrong-key/tamper/replacement and version-compatibility tests. New manifest format should fail closed for existing unsigned manifests (none known as real exported archives; do not silently upgrade or re-sign untrusted evidence).

## Major findings: disposition

- **M-1 snapshot mismatch — confirmed limitation.** `preflight(env)` is a separate SELECT before/after the `pg_dump` transaction; data may change in the middle while selected counts/hashes remain equal. First implement a bounded *claim*: pre/post checks are monitoring only, never assert per-row equivalence to the `pg_dump` snapshot, which PostgreSQL ensures is transactionally consistent. For critical evidence, consider `pg_export_snapshot()` and `pg_dump --snapshot=<id>` only after designing reliable live snapshot-session lifecycle and tests; **no generic assumption that pre/post is identical to dump**. Genuine production restore and protected records audit are stronger evidence; full DB parity remains OPEN unless separately proven. Do not gate merely on matching two-table digests while claiming all tables.
- **M-2 `pg_restore --single-transaction --exit-on-error` — intended fail-closed behavior, not by itself a bug.** A genuine missing extension/role/object causing rollback is an important restore incompatibility, not an archive-integrity verdict. Keep atomic restore and nonzero failure; add authenticated `pg_restore --list` read-only inventory, compare known extension/role dependencies and actionable diagnostics. Do **not** switch to partial batches just to obtain a PASS.
- **M-3 backpressure — reviewer premise inaccurate.** Current `tooling/v380-backup-archive.mjs` `decryptArchive` already uses `await pipeline(createReadStream(...),decipher,writable)`; this propagates backpressure into `child.stdin` by Node streams contract. A small two-table synthetic PG18 PASS exists. Retain implementation; add large synthetic binary/stress test for slow writable and verify `pg_restore` process termination/memory bounds, but do not add an unnecessary PassThrough solely for backpressure.

## Minor / additional risks

- On Windows, file mode `0o600` is not sufficient NTFS ACL evidence. Require protected backup and temp directories, encrypted local volume, no secrets in user-visible output, operator confirmation and lifecycle checks.
- `PGOPTIONS=default_transaction_read_only=on` offers fail-closed client behavior, but not server-side least-privilege grants; use explicit read-only database role if feasible without unsafe production role changes and independently verify privileges.
- Add `statement_timeout` / lock timeout for preflight query and test how PostgreSQL reports failures.
- Source pre/post count/digest fields are *selected integrity evidence*, not archival proof for all 52+ tables or valid signed portable v13 historical recovery.
- Review Windows process tree/timeout and restored object SQL execution under locally privileged PostgreSQL account; only trusted authenticated ciphertext + trusted source dump may be executed, on trusted computer.

## Milestones and release gates

**R1-A (design/review, current):** record independent findings, reconcile inaccurate recommendations, freeze contracts and test evidence; ROADMAP/FEATURES/CHANGELOG synchronized. No runtime changes beyond planned small batches.

**R1-B (first patch):** authenticated immutable manifest + domain-separated per-archive HMAC; tamper tests; format/version and failure behavior. **Do not perform production export**.

**R1-C (second patch):** safe SCRAM local restore credentials + Windows ACL/temporary volume conditions, no insecure trust, local allow/deny auth tests; PG18 restore lifecycle and atomic `pg_restore`; stress test. **Do not perform real-data restore**.

**R1-D (verification):** independent read-only second review of exact updated SHA; owner-local targeted tests + full synthetic PG18 and safe `pg_restore --list` inventory; reconcile all BLOCKER/MAJOR verdicts. Only then ask owner separately for *first production READ-ONLY export* approval; local restore with real personal data is a separate gate (requires own GO and protected machine). Live v21 DDL/merge/deploy remains separate owner C0 GO and backup recovery/historical v13 gates.

**Evidence current:** previous code SHA `9d26c2cb` crypto 7/7 and PG18 synthetic PASS owner-local; current R1 changes NOT RUN. Production untouched. Paid Neon protected-branch N/A by owner decision; preserve current-primary safety clone and old manual snapshot.
