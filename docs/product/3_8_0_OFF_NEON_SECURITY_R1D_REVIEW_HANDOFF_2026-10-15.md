# FlyTally 3.8.0 — R1-D independent read-only re-review handoff

**Repository:** `filipto861/flytally-logbook` / `feat/3.8.0-m2a0-schema-review-main` / Draft PR [#338](https://github.com/filipto861/flytally-logbook/pull/338). **Exact candidate HEAD (after implementation + docs):** re-resolve latest PR HEAD at review time; implementation was staged before documentation commit `02ce63f3a9c5cf655e98d35ec9a19f0b7765bc16`. No Production DDL, deploy, migration or live backup export was performed. Do not access Neon or credentials; this is source review only.

**Owner evidence before remediation:** SHA `9d26c2cb`, targeted encryption/source tests 7/7 PASS + actual **synthetic PG18** `pg_dump -Fc` 2,806 bytes → AES-GCM → `pg_restore --single-transaction` → data equality/cleanup PASS. **After R1 hardening all runtime acceptance remains NOT RUN**, so do not infer a current PASS.

**R1 disposition:** `docs/product/3_8_0_OFF_NEON_SECURITY_R1_DISPOSITION_2026-10-15.md`.

## What changed

1. **B-2 sealed immutable manifest**: `tooling/v380-backup-manifest.mjs` signs fixed schema v2 fields via per-archive salt+domain-separated scrypt HMAC-SHA256, constant-time comparison, nested canonical serialization, unsigned v1 rejection. `tooling/v380-off-neon-export.mjs` signs the actual archive's metadata; `tooling/v380-off-neon-restore-check.mjs` authenticates manifest before using source claims, also checks ciphertext hash/GCM. The manifest is never modified for status; receipt is independent/non-authoritative.
2. **B-1 safe local actual-data restoration**: `tooling/v380-windows-private.mjs` owner/SYSTEM private Windows NTFS ACL. Random SCRAM password passed to `initdb --pwfile` through short-lived owner-protected file, then removed. `initdb -A scram-sha-256` in both synthetic and actual-data restore. Wrong password must fail, correct password must work; local `127.0.0.1`/random port and scrubbed libpq env. Actual-data path requires explicit encrypted-volume operator acknowledgment (does **not** automatically prove BitLocker). Restored plaintext cluster is stopped/removed before status receipt; interrupt refuses PASS.
3. **M-2 object inventory**: `tooling/v380-backup-toc.mjs` performs `pg_restore --list` via authenticated decrypted stdin without DB target; actual-data restore requires expected table count and available PG18 extensions before `pg_restore --single-transaction --exit-on-error`.
4. **M-3 stream confidence**: `decryptArchive` already used `pipeline()` with backpressure; new 12-MiB slow consumer test. Synthetic PG18 runner now exercises signed manifest + private ACL + SCRAM positive/negative auth + TOC before complete actual pg_dump/restoration.

## Requested exact reviewer verdict

Inspect exact source (not previous R1 SHA); answer **BLOCKER / MAJOR / MINOR** with verifiable file/line:
- Confirm HMAC canonicalization, per-archive salt/domain separation, MAC-before-provenance, ciphertext-bound SHA and failure of forged metadata, wrong pass, old v1 and archive substitution.
- Confirm SID/icacls command syntax/NTFS resulting ownership on Windows and whether `initdb --pwfile` is always protected/cleaned, including SIGINT, process failure and success. Evaluate risk of ephemeral password in memory/child env and temporary plaintext disk. Identify any bypass of SCRAM/local routing.
- Does streaming `pg_restore --list` from custom format stdin work reliably on PostgreSQL18 and accurately find extensions/tables? How does it fail on unknown extensions / malicious TOC / large TOC? Is 3MiB cap appropriate?
- Confirm restore process/cleanup, archive replacement/symlink/race and no success before cleanup. Does either script log or retain secrets/personal data on error?
- Is the immutable manifest actual source preflight still from independent MVCC snapshots? Note **known, not falsely resolved**; propose only source-supported strengthening.
- New regression tests now **10**, but only static source/syntax readback checked by implementer. Request specific owner Windows commands to verify and resolve any failing test; do not mark passed based on code presence.
- Separate **GO/NO-GO for first production read-only export**, **GO/NO-GO for real-data isolated restore**, and **GO/NO-GO for v21 DDL/deploy**. Current status of all three is **NO-GO** pending owner tests, reviewer disposition and owner authorization.

**Do not modify repository or production as reviewer.** No connection strings, archives or private user data are supplied. Owner makes final release decision.
