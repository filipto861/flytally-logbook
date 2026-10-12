# FlyTally 3.8.0 — M2-A-1 full-schema and monetary recovery discovery

**Date:** 12 October 2026. **Status:** SOURCE-VERIFIED ANALYSIS / DRAFT DESIGN / NO IMPLEMENTATION.  
**Repository:** `filipto861/flytally-logbook` only. **Runtime baseline:** `main@4ca2847795435549f36d44f253eb7c105eea6d25`, `DATABASE_SCHEMA_VERSION=20`; all v21 changes remain unregistered in [draft #322](https://github.com/filipto861/flytally-logbook/pull/322). **Frozen product decisions:** [D1–D4](3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md).  
**Latest owner test evidence:** exact #322 commit `6cc069960abf3a1162954be18039db5271282a71`, native Windows PG16: typecheck PASS, static 6/6 PASS, currency PG 6/6 PASS and full PG 106/106 PASS across 34 files. The full suite includes the six currency tests. This is **local**, not CI or migration permission. See [M2-A-0 handoff](3_8_0_CURRENCY_M2A0_LOCAL_POSTGRES_HANDOFF.md).

**Canonical source repository:** https://github.com/filipto861/flytally-logbook  
**Verified runtime baseline:** https://github.com/filipto861/flytally-logbook/tree/4ca2847795435549f36d44f253eb7c105eea6d25  
**Draft source / documentation branch:** https://github.com/filipto861/flytally-logbook/tree/docs/v380-currency-m0-discovery  
**Reviewer handoff:** https://github.com/filipto861/flytally-logbook/blob/docs/v380-currency-m0-discovery/docs/product/3_8_0_CURRENCY_M2A1_INDEPENDENT_REVIEW_BRIEF.md

## Independent DeepSeek review received — reconciled 12 October 2026

**Verdict received:** APPROVE WITH CHANGES (read-only; reviewer relied on provided brief/discovery and did not independently inspect DB catalog). **Source-verified disposition:** [DeepSeek R01–R17 reconciliation](3_8_0_CURRENCY_M2A1_DEEPSEEK_RECONCILIATION_2026-10-12.md). **Actual source wins over reviewer assumptions.** Accepted blockers: future v21 exact-data loss on trash restore, contradictory money tuples silently skipped in account restore, unproven real-v20 schema / signed old/new v13 roundtrip. **Rejected/corrected reviewer prescriptions:** cert trigger already uses full-row `to_jsonb`, draft has paired CHECKs, portable v13 is not forced to v14, absent `json_populate_record(NULL::table,...)` fields are NULL not PostgreSQL COLUMN DEFAULT values, full-JSON restore or forced original-ID reuse would break current restore identity semantics, S1–S10 were already enumerated.

**Design correction:** preserve current new-flight-ID/reparenting behavior in trash restore, add a **strict explicit monetary tuple projection** for proposed v21 fields and fail-closed source validation; no all-column blind SQL import. Treat legacy expense `currency` as an explicitly recorded NOT NULL field under v159, not identical to flight-price UNKNOWN; missing/corrupt expense currency must not be converted to CZK by guess. All certified/void invariants remain. Require concurrent-double-restore + signed-field-tamper negative tests and source/DB/toolchain evidence identity. Detailed next batches in reconciliation; no implementation or production changes yet.

## 1. Reconstructed schema authority and applicability

| Component | Verified source | Consequence |
| --- | --- | --- |
| Core migration sequence | `lib/migration-plan.ts:1–29`; `lib/db-optimization.ts:33–847,850–874` | Schema currently v20; initializing `ensureDatabaseOptimizations()` automatically applies registered missing migrations. **Never register v21 in this phase**. |
| Runtime *feature* schemas | `lib/runtime-schema.ts:1–39` plus `lib/v132-schema.ts`, `v1353`, `v144`, `v145`, `v148`, `v151`, `v159`, `v162`–`v166`, `v290`, `v300-aircraft-sharing-schema.ts`, `push-schema.ts` | **v20 migration number is not the complete table-definition authority.** Runtime schema also depends on separately registered feature migrations, some initialized in parallel after core migrations. |
| Dedicated v20 SQL | `tooling/v350-v20-preflight.sql`, `v350-v20-migrate.sql`, `v350-v20-postflight.sql` | These help reconstruct archive/provenance and immutable triggers. They do **not** prove current remote deployment's catalog equals source. |
| Browser smoke bootstrap | `tooling/bootstrap-browser-smoke-db.mjs:35–590` | Creates a **synthetic** local DB, DROPS `public` and premarks migrations 1–19. Use **only** in a newly created disposable database if independently checked; **never** point it at an existing DB, Shadow, Neon, or production. Synthetic schema alone is not an authoritative full-v20 reproduction. |
| Draft additive SQL | `sql/drafts/3_8_0_currency_v21_additive_candidate.sql` in #322 | 12 nullable columns, four CHECKs, four tables (`rates`, `aircraft`, `flights`, `flight_expenses`); no historical values backfilled, no currency default inference, no registered migration. Generic SQL three-letter shape does **not** validate ISO membership. |

**Full-v20 baseline acceptance cannot yet be claimed.** Before creating that fixture, enumerate all table/column type, defaults, constraints, indexes, triggers, foreign keys, feature-migration keys, and sequence ownership from source; then compare the resulting *disposable* schema against an authorized, **read-only** catalog fingerprint from the correct nonproduction source (if one is available). Any unresolved mismatch blocks the full-v20 claim. Neither a legacy test fixture nor automatic schema initialization on a live target substitutes for this inventory.

## 2. Verified backup, restore and lifecycle contracts

| Path | Source-backed observation | M2-A-1 risk / requirement |
| --- | --- | --- |
| Portable export | `lib/account-backup.ts:13–52` reads `SELECT *` on `flights`, `rates`, `aircraft`, `flight_expenses`, and exports **portable format version 13** with independent `schema_version:DATABASE_SCHEMA_VERSION`, SHA-256 digest, server signature | Nullable v21 columns are *likely* exported automatically after v21 exists, but no real full-schema v21 export/restore has been executed. Do not needlessly change **portable version 13** just because DB schema becomes 21 without a contract-based reason. |
| Integrity/authenticity | `lib/portable-backup.ts:23–35,138–155`; `lib/backup-authenticity.ts:5–20` | Digest spans serialized payload; signature binds backup version, source user ID and digest. A modified monetary value must invalidate original authenticity. Never forge a signed fixture or weaken server-authoritative restore gate. |
| Prepare restore | `lib/account-restore-v6.ts:46–85,87–181` | `classify()` on existing `id` or natural key skips a row without comparing its monetary metadata. Flight certification hashes are separately checked, but this is **not** a proof of currency agreement. Design fail-closed duplicate monetary conflict handling before exact writes, without retroactively reclassifying legacy UNKNOWN. |
| Execute restore | `lib/account-restore-v6.ts:187–249` | Uses `json_populate_record(NULL::table,item)` for relevant sections, inserts flights in unprotected stage then restores certification in second step, in an SQL transaction. Explicit v21 columns in existing signed payload should deserialize if valid, but **real v13 signed backup with v21 fields and legacy v13 missing them must both be exercised**. Nulls are not zero and legacy currency must not be inferred. |
| Certified flight/void | `lib/db-optimization.ts:792–845` | Protected rows are compared by `to_jsonb(OLD)`, including future monetary fields. Archived void needs **same-transaction exact** `flight_snapshot=to_jsonb(OLD)`. Preserve immutable history; owner attestation is a separate evidence layer, not destructive currency rewrites. |
| Trash snapshot | `lib/flight-trash.ts` function `moveFlightToTrash()` | Source snapshots entire flight and expense rows via `to_jsonb`; future v21 monetary metadata would be present in saved trash JSON. |
| Trash restoration — **blocking** | `lib/flight-trash.ts` function `restoreDeletedFlightRecord()` | `INSERT INTO flights(...)` **explicitly omits** `price_currency_code`, `price_currency_minor_units`, `price_per_hour_decimal`; expense INSERT **omits** `amount_encoding`, `amount_minor_units`. Thus restoring a future exact-denomination draft would lose evidence while retaining legacy price/expense values. Existing `COALESCE(e->>'currency','CZK')` is also a dangerous implicit assumption when source lacks a trustworthy currency. **Do not enable v21 writes until a source-preserving, fail-closed trash restore contract and tests are reviewed and implemented**. This is an observed source-level hazard, not an executed-v21 failure. |
| Legacy expense | `lib/flight-expenses.ts:9–40`, draft SQL `flight_expenses` | Old numeric encoding divides/multiplies by 100 independently of ISO exponent. Draft `amount_encoding=NULL, amount_minor_units=NULL` means **legacy two-decimal storage**, not evidence that the original ISO exponent was 2 or that a legacy flight denomination is known. |

### Recovery and classification invariant

For a monetary tuple `(currency_code, exponent, exact_decimal)`, preserve the tuple **atomically** through flight edit, trash/delete/restore, backup/export/import, collaboration, certification/void and any materialized copy. Missing, malformed, nonapplicable or contradictory metadata => **unavailable / needs resolution**, never a synthesized denomination or zero. Untrusted old backup rows must not gain new facts from account defaults. A signed v13 with an exact tuple must have its digest/authenticity verified and be rejected on inconsistent data or conflicting existing ownership/evidence. Legacy backups without v21 columns remain restorable as unresolved monetary metadata.

## 3. M2-A-1 staged acceptance matrix (proposed, NOT RUN)

| Case | Expected | Required evidence |
| --- | --- | --- |
| S1 Catalog | Deterministically rebuild full v20 + feature migrations in a **fresh disposable local PG16**; explicit schema-catalog fingerprint | DDL inventory, source/config hash and local `pg_catalog` diff; explain every difference vs authorized read-only baseline |
| S2 Additive migration | Run unregistered candidate on S1, twice; old rows/certified/archive/expenses unchanged; 12 nullable fields and 4 constraints present | Transaction-bound before/after row counts, hashes, SQL types, defaults, constraints; no user-data rewrite |
| S3 Old portable v13 | Valid old-format signed backup with missing v21 fields restores as `NULL` metadata, no inferred currency or ISO scaling | Real `parsePortableBackup` authenticity and `prepareExactAccountRestore`/`executeExactAccountRestore`, not only raw `json_populate_record` |
| S4 New portable v13 | Future v21-enabled row with JPY=0, EUR=2, KWD=3 survives signed backup/export/restore with exact decimal strings, proper expenses and unchanged protected history | Digest/signature check, full round-trip record comparison and tamper rejection; test both certified and uncertified |
| S5 Conflict | Existing identical flight/rate/expense natural identity but contradictory stored exact tuple **fails closed**, never silently skips or overwrites | Prepare, execute and DB before/after checks; include account-bound foreign records, signature and impersonation |
| S6 Trash | Draft flight and expense metadata survive trash → restore. Malformed/missing exact tuple rejected; legacy missing currency not coerced into CZK | Exact snapshots and full original-vs-restored tuple comparison; protect race and duplicate restore |
| S7 Certified correction/void | New currency fields do not bypass v20 revision protection; void archive snapshot matches **every field** and stays immutable | Real v20 triggers over full schema; verified hash and audit/provenance continuity |
| S8 Rollback/compatibility | Metadata-aware read-compatible version deployed **before** any exact money writer; no silent fallback to old app for new money | Version/write gate and old-reader/new-writer compatibility matrix; recovery/roll-forward rehearsal |
| S9 Cross-feature | Shared flight, participant materialization, records/list/print/export/statistics, manual/GPS add/edit and rates preserve or explicitly reject differing currency metadata | Route/query inventory, targeted tests on each actual mutation path |
| S10 Infrastructure | No accidental remote database, no production target guessed, no unauthorized branch/deploy, disposable cluster cleaned up | Explicit local DB identity and toolchain/version logs, no silent env inheritance, exact branch SHA |

**Ordering:** S1–S2 schema proof, S3–S5 signed backup/restore, S6 trash, S7 certification, S8 backward compatibility, S9 connected workflows, S10 final gate. Break implementation into independent, reviewable batches; do not start it until the design receives independent review.

## 4. Design choices pending technical review

1. **Monetary collision/restore semantics:** current generic `classify()` skips existing records. Recommend (pending reviewer confirmation) a new financial conflict comparator for relevant sections, with stable identity, legacy-unknown versus known distinction, and explicit fail-closed policy for contradictory v21 tuples. Keep unrelated v13 restore sections unchanged.
2. **Trash exact metadata:** recommend a minimal additive explicit column projection with consistent extraction/validation of tuple and expense encoding; require a migration-readiness gate before any exact write. No implicit CZK fallback for unknown input. Scope old legacy trash payload behavior separately so backward compatibility is tested rather than guessed.
3. **Full v20 fixture:** prefer a source-reconstructed fixture with all runtime feature migrations plus a catalog diff; browser-smoke bootstrap may supply a *disposable baseline seed* only after verifying schema fidelity, not a claim of production equivalence. No remote schema clone without explicit scope authorization.
4. **Backups:** retain v13 format **unless** source-backed requirement shows the contract must change. Preserve independently recorded `schema_version`, keep HMAC and ownership checks, and require both version-13 old/new money cases.
5. **Rollbacks:** restore target is **metadata-aware compatible reader**, never denomination-blind legacy runtime once canonical exact writes exist. Declare write enablement as a separate irreversible compatibility gate.
6. **Numeric boundaries:** unbounded PostgreSQL `NUMERIC` in draft is provisional; enforce exact string serialization, currency-exponent source applicability and precision bounds in writer contract before deploying any write path.

## 5. Do / Do not and definition of done

**Do:** discovery and evidence collection; enumerate routes/tables/contracts; document risks; independent reviewer consultation; local-only tests after reviewer reconciliation; fix blocked contracts in small code milestones; update ROADMAP/FEATURES/CHANGELOG in the same work cycle.

**Do not:** register v21, merge currency PRs, run `v350-v20-migrate.sql` or `bootstrap-browser-smoke-db.mjs` against an existing database, access Neon with uncontrolled writes, change `flytally-training`, alter certified historical records, infer CZK or an ISO exponent, quietly skip contradictory exact metadata, turn successful mocked/static fixture evidence into production authorization.

**M2-A-1 analysis milestone acceptance:** source-backed inventory of complete schema construction and data write/read/restore paths, explicit risks and dependencies, test matrix, independent review brief and documented reconciliation. This **document is a draft, not a reviewer verdict or proof of full-v20 schema fidelity**. Only after independent review may implementation/test submilestones start; execution results must be labeled local/CI/deployed separately.

## 6. Workstation handoff (12 October 2026)

Owner is on a **freshly started work PC**; do not reuse assumptions about prior Windows laptop/desktop. **No new tests were executed on this workstation** during M2-A-1 discovery. Before any new local test: verify `git status`/branch/exact HEAD and untracked changes, `node -v` (24.x), `psql --version` and `initdb`/PG16 availability, ports, database identity, required permissions, and local shell. Prefer the already-authored **native disposable** PostgreSQL runner only if actual prerequisites pass; otherwise adapt after inspection, without Docker assumption or production credentials.

**Current state:** M2-A-0 targeted + existing full PG regressions **LOCAL PASS on prior exact head**. M2-A-1 discovery **SOURCE REVIEWED / independent review NOT RUN / implementation NOT STARTED**.
