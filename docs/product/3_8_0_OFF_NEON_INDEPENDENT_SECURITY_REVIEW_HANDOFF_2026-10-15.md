# FlyTally 3.8.0 — Independent backup/recovery SECURITY review request (15 Oct 2026)

**To: DeepSeek (independent read-only reviewer)**. This is a release-critical audit request, **not** implementation authorization or a request to access production credentials. Work exclusively from repository source; never read/print production secret DB URLs, passwords or archived user data.

## Evidence and scope

Repository `filipto861/flytally-logbook`, Draft [PR #338](https://github.com/filipto861/flytally-logbook/pull/338), candidate branch `feat/3.8.0-m2a0-schema-review-main`, last reviewed HEAD **`1dd456320c3e3ea2eb6a95eac40ea6a6ecd60e9e`** (refresh at review time). The current Vercel production v20 app SHA `dcc8ebbfda0eadfa01345cd875ef1db806a19e26` and legacy PostgreSQL v20 remain live. Candidate 3.8.0 v21 local four-gate (TypeScript, native PG16, Node 1555/1555, Next build, Playwright 8/8) was PASS on code `42e72909`; H4 actual frozen deployed v20 running on isolated v21 fixture PG16 8/8 PASS on `b23f9b99`.

Owner-local Windows/Node24 `npm run test:target -- tests/v380-off-neon-archive.test.ts` **3/3 PASS** on prior `4a88bae0`, and PG18 binary `node tooling/v380-off-neon-export.mjs check` **PASS** (client + local server binaries available). **These were before follow-on security hardening commits**, which remain untested. No live production export or local PG18 restore has been executed.

Neon current canonical primary project `muddy-dust-14049657`, branch `br-raspy-fog-b1btvu5t`, PG18.6 `neondb`; unique direct compute hostname is hard-pinned in source. Protected branch is N/A on current Free tier per owner, not enabled. A previous Neon in-project no-compute checkpoint exists `br-shiny-bonus-b1gqt9u7` and must not be touched; it is not an off-provider backup. Existing manual snapshot from prior primary is retained.

## Files for exact review

- `tooling/v380-backup-archive.mjs`: binary streaming AES-256-GCM/scrypt custom archive, 16-byte salt, 12-byte nonce, 16-byte GCM tag, AAD header.
- `tooling/v380-off-neon-export.mjs`: Windows Node24 PG18 preflight, masked Neon connection URL, exact host+DB+TLS+readonly, sanitize all inherited libpq vars to block `PGHOSTADDR` reroute, pre/post dump schema and protected-row digest parity guard, `pg_dump -Fc` into encrypted-only unique file under `%LOCALAPPDATA%\FlyTally\PrivateProductionBackups`, non-secret provenance manifest. **No plaintext pg_dump archive**.
- `tooling/v380-off-neon-restore-check.mjs`: exact archive path/provenance/hash, masked passphrase, **full AES-GCM verification pass before any PG18 server startup** (discard stream), operator confirmation, then new isolated local PG18 test cluster, decrypt archive second time straight into `pg_restore` stdin; validate schema, counts and protected history digests; **write PASS manifest only after stop and temporary decrypted test database removal**.
- `tooling/v380-off-neon-pg18-synthetic-test.mjs`: new end-to-end no-production synthetic PG18 cluster/pg_dump→AES archive→authenticated preflight→pg_restore; NOT RUN yet.
- `tests/v380-off-neon-archive.test.ts`: synthetic AES roundtrip, tamper/wrong pass, static source security contracts.
- `docs/product/3_8_0_OFF_NEON_BACKUP_RECOVERY_PROTOCOL_2026-10-15.md`: operator protocol, acceptance, limitations.

## Frozen safety boundaries

1. **DO NOT** access live Neon or production user data, mutate DB/branches, delete snapshots, migrate schema, merge or deploy. No DB credentials in prompts/results.
2. Restore **never** targets Neon, production or any pre-existing DB: only an owned loopback PG18 ephemeral cluster. Delete only resources created by that process when safely stopped.
3. Historical certified/voided records and provenance must survive exactly. Missing, differing or ambiguous source/target evidence => fail closed.
4. Owner alone authorizes later production DDL and deployment. Owner will execute local export/recovery after security review and synthetic gate.
5. No new dependency/subscription/provider changes unless justified and approved. PG18 installed alongside PG16.

## Independent review questions

1. Is end-to-end **PG18 on Windows** `pg_dump -Fc` stdout→AES-GCM pipe→`pg_restore --single-transaction` stdin sound and does it handle binary streams and backpressure correctly?
2. Could ANY inherited `PG*`, libpq service/hostaddr/SSL environment, URI argument, or subprocess option redirect **export away from approved source** or **restore off localhost**, bypass target guards, or leak a password?
3. Are AES-256-GCM IV/salt/tag handling, scrypt parameters, two-pass complete authentication, directory/filename locking, integrity check and cleanup robust under wrong password, corrupted/truncated files, partial process failures, process crashes and archive replacement races?
4. Are the source schema pre/postflight checks enough to bind a consistent manifest to the actual `pg_dump` MVCC snapshot? If not, propose bounded fail-closed alternatives, clearly noting unsupported stronger claims.
5. Could the restore execute unauthenticated malicious SQL, start PostgreSQL on unintended interfaces, overwrite existing DBs, leave plaintext or claim PASS before stop/cleanup?
6. Does the full production PostgreSQL18 Neon database contain extension/role/collation/privilege dependencies that would make a fresh local Windows PostgreSQL18 restore fail even though code compiles? What non-destructive checks can identify them?
7. Are `account_backups`, certified/void/provenance records and signed v13 portable restore differentiated correctly from a logical full DB backup? Does the audit overclaim full-table fidelity vs only selected counts/digests?
8. Are error messages and standard streams kept free of DB credentials or personal record contents? Is the local archive passphrase/storage story sufficient and what should be required operationally?
9. Provide **BLOCKER / MAJOR / MINOR** findings with exact file/line or snippet and exploit/failure mechanism; minimal patches/tests; clear **GO/NO-GO for first production read-only export** and independent GO/NO-GO for release/migration.

**Output request:** independent assessment, not automatic code changes. Separate verified repo facts from hypothetical risks. Any suggested relaxation of target verification or data integrity is unacceptable.
