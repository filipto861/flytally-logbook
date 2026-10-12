# DeepSeek / independent reviewer brief — FlyTally Logbook 3.8.0 M2-A-1

**Prepared:** 12 October 2026. **Request:** INDEPENDENT, READ-ONLY review of full-schema / portable-backup / trash-recovery compatibility **before** costly implementation. **Do not modify code, SQL, branches, data, PRs or deployment.**

## Repository access — start here

- **FlyTally Logbook GitHub repository:** https://github.com/filipto861/flytally-logbook
- **Canonical main:** https://github.com/filipto861/flytally-logbook/tree/main
- **Exact verified baseline:** https://github.com/filipto861/flytally-logbook/tree/4ca2847795435549f36d44f253eb7c105eea6d25
- **Current M2-A-1 discovery:** https://github.com/filipto861/flytally-logbook/blob/docs/v380-currency-m0-discovery/docs/product/3_8_0_CURRENCY_M2A1_SCHEMA_BACKUP_DISCOVERY.md
- **M2-A-1 DeepSeek review brief:** https://github.com/filipto861/flytally-logbook/blob/docs/v380-currency-m0-discovery/docs/product/3_8_0_CURRENCY_M2A1_INDEPENDENT_REVIEW_BRIEF.md
- **Unmerged v21 SQL candidate:** https://github.com/filipto861/flytally-logbook/blob/feat/3.8.0-currency-m2a0-sql-draft/sql/drafts/3_8_0_currency_v21_additive_candidate.sql

**Reviewer instructions:** Open the linked repository and verify actual source from the indicated **main SHA** and separate draft branches; do not confuse unmerged proposals with shipped runtime. If access is denied (private repository or missing authorization), state **REPOSITORY ACCESS UNAVAILABLE** and request read-only access or source excerpts. Do not assume that a GitHub URL alone grants access or claim to have inspected inaccessible files.

## Project context

Canonical repository: `filipto861/flytally-logbook`; **do not touch** `flytally-training`. Production app 3.7.0. Main baseline inspected: `4ca2847795435549f36d44f253eb7c105eea6d25`; `DATABASE_SCHEMA_VERSION=20`. Currency 3.8.0 design docs [draft PR #319](https://github.com/filipto861/flytally-logbook/pull/319), BigInt exact math [draft #320](https://github.com/filipto861/flytally-logbook/pull/320), SIX XML registry candidate [draft #321](https://github.com/filipto861/flytally-logbook/pull/321), unregistered additive SQL and local tests [draft #322](https://github.com/filipto861/flytally-logbook/pull/322).

**Frozen owner decisions D1–D4:** (D1) account currency is **only** default for *new* inputs and may be overridden by a rate; stored flight pricing has independent denomination. (D2) unprovable legacy currency => **UNKNOWN**; attest separately without rewriting certified/void records. (D3) aggregate/rank only one known same currency, **no FX**, UNKNOWN not zero. (D4) cover all active **monetary** ISO 4217 codes (including monetary X codes), with provenance/exponent; never accept special fund/nonmonetary codes by guess.

**Verified test evidence:** owner locally executed `powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-local.ps1 -Full` on #322 exact SHA `6cc069960abf3a1162954be18039db5271282a71`, Node 24 / Windows isolated PG16: TypeScript PASS, 6/6 static tests, 6/6 focused currency PostgreSQL tests and existing full PostgreSQL suite **106/106 PASS across 34 files** (the full suite includes the six currency PG tests). Original app/Neon data were not touched; v21 is **NOT** registered, code is **NOT** merged/deployed. **Actual real-v20-schema v21 migration and extended signed v13 backup/restore NOT RUN.**

## Source inventory for direct cross-check

Read [M2-A-1 discovery and proposed matrix](3_8_0_CURRENCY_M2A1_SCHEMA_BACKUP_DISCOVERY.md) first, then verify actual sources:
- `lib/migration-plan.ts`, `lib/db-optimization.ts` (v1–v20, immutable certification, automatic migrations), `lib/runtime-schema.ts`, `lib/v132-schema.ts` through `lib/v166-schema.ts`, `lib/v290-schema.ts`, `lib/v300-aircraft-sharing-schema.ts`, `lib/push-schema.ts`.
- `tooling/v350-v20-{preflight,migrate,postflight}.sql`; `tooling/bootstrap-browser-smoke-db.mjs` (**destructive DROP public; synthetic only**).
- `lib/account-backup.ts`, `lib/portable-backup.ts`, `lib/backup-authenticity.ts`, `lib/backup-certification.ts`, `lib/account-restore-v6.ts`, `lib/backup-center.ts`.
- `lib/flight-trash.ts`, `lib/flight-voiding.ts`, `lib/flight-expenses.ts`, `lib/rate-history.ts`, `lib/certification-integrity.ts`.
- #322 `sql/drafts/3_8_0_currency_v21_additive_candidate.sql` and `tests/integration/postgres-currency-v21-schema.test.ts`.
- Related tests: `tests/integration/postgres-backup-v13-void-history.test.ts`, `postgres-security-restore.test.ts`, `postgres-flight-expenses.test.ts`, `tests/v350-backup-v13.test.ts`.

## Material risks already observed in source, NOT yet resolved

1. **Trash loses future exact currency evidence:** `moveFlightToTrash()` stores full `to_jsonb(f)` and expense rows, but `restoreDeletedFlightRecord()` uses explicit INSERT lists omitting **flight `price_currency_code`, `price_currency_minor_units`, `price_per_hour_decimal`** and **expense `amount_encoding`, `amount_minor_units`**. Old expense fallback `COALESCE(e->>'currency','CZK')` can infer currency without proof. This is a **future v21 write enablement blocker**.
2. **Exact metadata collisions on restore:** `account-restore-v6.ts:46–59` `classify()` skips existing IDs/natural keys after identity check but does **not** compare monetary tuples for flights/rates/aircraft/expenses. Certified hash validation helps certified history, not denomination equivalence; silently discarding conflicting exact metadata risks data integrity.
3. **Fixture fidelity:** 106/106 legacy PG PASS is strong existing workflow evidence, but new currency test uses a **reduced** fixture with v20 trigger. Browser smoke SQL starts with `DROP SCHEMA public CASCADE` and is **not** a safe/proven production v20 clone. Main migration version 20 does not include all separate runtime feature migrations.
4. **Backup encoding/version:** `account-backup.ts:49` exports portable `version:13`, independent `schema_version`; `SELECT *` carries future nullable columns, but real signed old-v13-without-v21 and future-v13-with-v21 full round trips have not been exercised. `json_populate_record(NULL::table,...)` does not validate assumed defaults. Preserve SHA-256 and server signature.
5. **Cert/void immutability:** v20 trigger's `to_jsonb(OLD)` compares all columns and requires exact same-tx void snapshot. New metadata on certified rows cannot be backfilled or silently modified.
6. **Compatibility rollback:** old runtime cannot interpret exact money metadata. Require separately deployed metadata-aware reader and disabled exact writers until verified; rollback cannot silently downgrade to denomination-blind code.
7. **Workstation:** owner is back on **freshly booted work PC** (12 October). Previous Node24/PG16 PASS applies only to the prior workstation's exact candidate. New local execution requires fresh toolchain/DB identity checks; **do not assume Docker or PG are installed here**.

## Requested independent judgement

Provide **APPROVE / APPROVE WITH CHANGES / BLOCK** with source citations (file, function, line if available), separating observed facts from hypotheses. Answer:

1. Is the source inventory sufficient to claim a **full-v20-equivalent disposable schema**? Which tables, feature migrations, catalog fingerprints and materialized evidence must be included? Is a faithful source-only build possible without authorized read-only catalog diff? Identify blockers.
2. What is the minimal **fail-closed** fix for trash restore so new flight and expense monetary tuples survive, while legacy UNKNOWN stays UNKNOWN? Explicitly address existing `CZK` fallback, mixed encoding, original IDs, duplicate/race behavior, and certification protection.
3. How should restore treat an existing record with same ID or natural key but different **v21 money tuple**? Which exact conflict checks belong in preparation vs SQL transaction, and how to avoid TOCTOU/race? Should equality include metadata for all `rates`, `aircraft`, `flights`, `flight_expenses`?
4. Does `portable format v13` need a version bump to carry new columns, or is schema version + signed optional fields sufficient? Demonstrate necessary old/new-format tamper, role, ownership, and immutable-void test cases. Do **not** propose bypassing verification or fabricating signatures.
5. Evaluate provisional unbounded `NUMERIC`, precise serialization, paired constraints, ISO membership and exponent validation, missing-versus-default semantics, and write/read rollout order.
6. Critique proposed S1–S10 test matrix: missing negative cases, realistic fixture setup, SHA/row-count pre/post invariants, metadata-aware rollback barrier, false-pass risks, and exact acceptance criteria.
7. Are any of the known risks **not** actually valid given current code? Identify evidence clearly; do not simply endorse our hypotheses.

## Constraints / frozen decisions

Correctness and evidence first; fail closed on ambiguous values; no extrapolated currency or scale; certified records immutable; independent participant evidence; all v21 fields optional until canonical writes enabled; no FX; keep backward compatibility and audit trail. Do **NOT** modify other repositories. Do not alter v13 cryptographic/authenticity guarantees. Do not alter production feature flags, schemas, remote DB credentials or Vercel. Keep v21 unregistered, all currency PRs Draft and `main` canonical.

**Desired output:** concise numbered issues ranked P0/P1/P2, root cause and source anchor, proposed minimal design amendment, test and acceptance criteria, deployment/rollback caveats, list of exact **frozen decisions unchanged**, and recommendation for the next smallest safe implementation milestone. Independent review is a gate **before** implementation; reviewer authority is advisory and findings must be reconciled against repository/source.

**State upon preparation:** brief AUTHORED, independent review **NOT YET RECEIVED**, M2-A-1 implementation **NOT STARTED**.
