# M0-B / V22 — first passive expand candidate and stacked PR consolidation

**Date:** 2026-11-04 UTC. **Repository:** `filipto861/flytally-logbook`. **Verified main:** `c9c2f60303236113a223942072311f5e37f876f7`. Work: `feat/logbook-m0b-v22-expand-candidate-20261104`, [Draft #469](https://github.com/filipto861/flytally-logbook/pull/469), base Draft #468 `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. Earlier Drafts #467→#455 form a single dependent stack, separate discovery Draft #454 on main. The owner requested progress toward V22; this is a local-only implementation candidate, **not an owner-approved database migration or deployment**. Owner declined DeepSeek review; none requested.

## 1. Delivered candidate

- `tooling/sql/m0b-v22-expand-candidate.sql` — **standalone, one-shot, passive expand proposal**. Not imported, registered, scheduled or applied. `DATABASE_SCHEMA_VERSION` remains **21** and `lib/db-optimization.ts` has no V22 migration query.
- SQL **self-guards** a disposable **local loopback PG16** database named `flytally_m0b_disposable_*`, with SQL role `flytally`, server socket address `127.0.0.1`, required `public.users`, `flights`, `fstd_sessions` and `deleted_flights` source columns. It rejects an already-existing UID column or registry instead of silently accepting unreviewed shape drift.
- Nullable `event_uid UUID` columns on active `flights`, `fstd_sessions` and archival `deleted_flights`: no backfill, default, fingerprint source inference or fabricated importer issuer.
- Passive `logbook_event_uid_registry`, PK `(owner_id,event_kind,event_uid)`, `event_kind` flight/FSTD and lifecycle `active/trash/purged/voided`, with explicitly supplied original Trash cutoff and marker expiry required only for purged entries. **No hardcoded legal +12-month period** in DDL. Identity origins/authority, owner gate and account erasure still require future separately reviewed server behavior.
- Owner-qualified unique partial indices for active flights and FSTD. **Non-unique** partial index for archival Trash: a recovered flight can have a still-retained restored historical archive and potentially a subsequent Trash archive of the same event. Premature unique archive index would reject legitimate history.
- No SQL triggers or FK/role tightening; the **two existing direct expired Trash DELETE callers remain compatible** with this passive shape. No automatic V22 runtime or production DDL.

## 2. Exact tested evidence

| Category | Result |
| --- | --- |
| Source syntax test `node --check` | **PASS**, local Node v22.16.0 |
| `node --test /tmp/flytally-v22/m0b-v22-expand-candidate.test.mjs` | **10/10 PASS**, local Node v22.16.0, static source-safety only |
| Byte-for-byte source identity | **PASS** via independent Git blob SHA-1 of local tested bytes and read-back GitHub files |
| SQL blob `tooling/sql/m0b-v22-expand-candidate.sql` | `4eb5035aa9d384a90a87ed7426c40ac2faae4910` |
| Test blob `tooling/sql/m0b-v22-expand-candidate.test.mjs` | `ff757abc63547c2265f6206a88725f4a1275f855` |
| Actual `psql` PostgreSQL16 DDL, constraints, rollback, legacy read/write | **NOT RUN** (PG16 binaries/docker not present in the local execution container) |
| Node24/CI, complete TS/build/PG16 integration 164/164, browser/risk | **NOT RUN** |
| Neon real app-driver HTTP two clients | **NOT RUN**; Draft #468 source/mocks are not evidence of HTTP concurrency |
| Production DB catalog/schema/flags, authenticated prod smoke | **UNKNOWN / NOT RUN** |

An early local static-test **FAIL** was retained during iteration: a test wrongly forbade `event_uid UUID NOT NULL` on the **new registry** instead of only forbidding NOT NULL on legacy `flights/fstd_sessions/deleted_flights` columns. Test scope was corrected; final tested 10/10 PASS. A first GitHub SQL edit using JS `String.replace` was corrupted because the replacement string's regex literal contained a `$'` replacement token; the file was corrected from the prior verified blob using a **function replacer**, then independently compared to exact local tested hash. Final GitHub file is byte-identical to local tested SQL; failures were never interpreted as green acceptance. Do not infer actual SQL syntax from a static test.

## 3. Consolidation of Draft #454–#469

| PR range | Evidence / role | Scope retained |
| --- | --- | --- |
| #454 | Separate B0 discovery; based on main | Discovery, not a runtime release |
| #455–#458 | B1a/B1b.1/B1b.2a/b staged fail-closed Restore code and local lock tests | Review for final runtime dependencies; **not canonical until merged** |
| #459 | Trigger-only lock approach on HOLD | Do **not** deploy old trigger-only enforcement |
| #460–#462 | Synthetic PG16 owner-lock, writer-topology, FK and retention alternatives | Isolation evidence, not Neon or app auth proof |
| #463 | Owner chose retention **A as an engineering direction**; 90-day archive plus working +12-month minimal UID marker | **Legal/privacy basis, erasure and regulatory retention unresolved** |
| #464–#465 | Recovered-archive dual-writer PG16 and owner/FK/NOLOGIN role probes | Actual app/cron shared DB principal still separate issue |
| #466 | Actual authenticated Trash vs CRON_SECRET sweep, shared `neon(DATABASE_URL)` source audit | Two direct expired archive DELETEs must converge in a future service |
| #467–#468 | New independent empty PG16 Neon, read-only connector, guarded app HTTP source/mocks | Real independent `@neondatabase/serverless` HTTP two-client transaction **not proven** |
| #469 | Passive expand-only SQL and exact-source Node22 safety tests | First V22 code artifact, **not executed or registered** |

**Do not merge this 15-PR stack indiscriminately.** First separate candidate runtime fixes from historical diagnostics and their branch ancestry, confirm frozen product requirements, then prefer small reviewed PRs rebased on verified main once explicitly authorized. No existing PR changed base or merged in this milestone.

## 4. V22 sequence and nonnegotiable gates

1. **Now: isolated schema acceptance.** On an **owned disposable local loopback PG16** with explicit target guard, create minimal realistic source tables and run the exact SQL file. Verify nullable historical rows, unique active owner UID, duplicate archived restored history, marker-state CHECKs, no data rewrite, and reject missing/wrong target and rerun. Use real `psql` exit codes and catalog introspection; **not** remote Neon. Add negative rollback tests for wrong schema/preexisting UID. If the local environment is unavailable, mark NOT RUN rather than treating static source tests as a database pass.
2. **Then: behind-OFF runtime batch.** Design a single app-owned UID issuance path and one owner-gated expired Trash service replacing **both** `listDeletedFlights` on-read DELETE and `runPrivacyRetentionSweep` global DELETE. Source owner from verified `requireUser()` or separately authorized cron; do not mistake arbitrary `owner_id` parameters or synthetic SQL NOLOGIN roles for caller authentication. Keep legacy behavior compatible until all V22 writers can be toggled atomically and rolled back.
3. **Then: source/event reconciliation.** Preserve recovered active UID when its historical archive expires; purged marker needs stored original cutoff and legally approved duration; legacy NULL remains unverified; certified void, signed revisions, FSTD, other participant evidence and account erasure retain separate rules.
4. **Only after full evidence:** authorize schema-first migration on exact nonproduction target, apply with rollback, test app/Neon HTTP and per-role grants, then separately authorize main merge/production migration/deploy/full-account Restore. `DATABASE_SCHEMA_VERSION=21`, M0-A containment and production flags remain unchanged until then.

### DO NOT and one next step

No production, staging, shared Shadow or remote Neon SQL, no data copying, no schema upgrade, no Vercel deployment, merge, production flags, destructive data cleanup, full-account Restore enablement, Training repo work or DeepSeek review. No confidential flight/GPS data or secrets in this document. Test-only Neon project `blue-haze-29352938` is a separate new empty project but **was not modified in this step**. Last verified Vercel production M0-A READY `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` at app `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; prod DB/catalog/flags UNKNOWN.

**ONE NEXT STEP:** execute the exact passive expand SQL on an explicitly owned, guarded **local PostgreSQL16** fixture and verify forward/negative compatibility and transactional rollback before any application writer or registration.
