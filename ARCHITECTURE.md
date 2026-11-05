# FlyTally Logbook — architecture (current Next.js generation)

**2026-11-05T08:09Z — M0-B V22 non-FK provenance writer source-owner gate and reverse native PG16 race (Draft #469, OFF).** Verified `main@c9c2f60303236113a223942072311f5e37f876f7`, executable tested `d6c81879f3ddc04c3e8da0c5c86623135b8c382a` on `feat/logbook-m0b-v22-expand-candidate-20261104`, stacked Draft #468 base `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. `app/(protected)/flights/shared-actions.ts` stages source-frozen OFF V22 branch in `materializeParticipation`: authenticated recipient ownership checked before DB preflight, source owner ID taken from DB row, and a single `sql.transaction` uses **two ordered READ COMMITTED statements**—first `users.id=sourceOwnerId FOR UPDATE` requiring exactly one owner, then fresh existing full certified-source materialization/provenance SQL. OFF continues original V21 single-statement code, no new flag or migration. Physical test on two real disposable PG16.15 backends proves **reverse order**: source-owner V22 re-delete commits after its final DELETE while B waits on owner row; B's subsequent fresh snapshot inserts **0** source-provenance rows. This complements previous B-before-final-DELETE rollback test. **PASS** [Actions #41992081047](https://github.com/filipto861/flytally-logbook/actions/runs/41992081047) exact `d6c81879f3ddc04c3e8da0c5c86623135b8c382a`: Node24 **1789/1789**, owner boundary **12/12**, SQL static **13/13**, TypeScript/Next build, exact V1–V21 PG16 + feature fixture, both source races. Audit: canonical V21 participant/crew/verification/instructor/public shares have source flight FK; **source_provenance.source_flight_id**, certified revisions and void tombstone original IDs are non-FK. Runtime provenance writer requires exact certified source revision/hash (so synthetic draft source race is a defensive SQL-level case); v20 migration/reconcile and blocked full-account restore are separate writer surfaces; voiding only adds tombstone pointer. Missing actual Neon HTTP client transaction/role parity, official full PG16 164 test partition, complete prod schema, signed/voided end-to-end, browser/Safari and production auth smoke remain **NOT RUN**. No claim all DB roles/direct DML are gated. V22 literal OFF, schema version 21, +12m owner-linked retention/erasure legal approval UNKNOWN; no merge/deploy/remote SQL/flag/Training/Restore. Production READY M0-A `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` source `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, prod DB/flags UNKNOWN. [Checkpoint](docs/maintenance/2026-11-05-m0b-v22-reverse-owner-gate-provenance-writer-checkpoint.md). **ONE NEXT STEP:** Run the canonical six-partition native PostgreSQL 16 risk-selected acceptance suite (including the 164 test registry) against an independently verified local disposable schema, and reconcile any source-provenance/role parity gaps before further V22 work.

**2026-11-05T07:36:29Z — M0-B V22 protected-final-DELETE parity and two-backend late-provenance race PASS; V22 remains OFF (Draft #469).** Canonical `main@c9c2f60303236113a223942072311f5e37f876f7`, exact tested candidate `0916eb154fa988633d56a521a564d6d6d96cab8a`, work `feat/logbook-m0b-v22-expand-candidate-20261104` stacked on Draft #468 `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. `tooling/sql/m0b-v22-trash-lifecycle-candidate.sql` now repeats all **eight V21 A+ protected-association exclusions at the final live-flight DELETE**, in addition to its original pre-archive checks: participation, connected crew, verifications, instructor approvals, source provenance (either direction), public shares, certified revisions, voided certified evidence. The staged SQL function remains local-only, unregistered, and app `V22_OWNER_TRASH_RETENTION_MODE="off"`. New `tooling/sql/m0b-v22-late-link-race-setup.sql` and CI use **two actual PostgreSQL16.15 connections**: backend A has already created an uncommitted archive and pauses in a **test-only** trigger, backend B commits a non-FK `flight_source_provenance.source_flight_id` link to that source. A's repeated predicate refuses final deletion and the whole archive/UID change rolls back, while the linked evidence and original live flight survive. **PASS** [Actions #41988204263](https://github.com/filipto861/flytally-logbook/actions/runs/41988204263) on executable `0916eb154fa988633d56a521a564d6d6d96cab8a`: Node24 full **1789/1789**, owner boundary **12/12**, source/SQL **12/12**, TypeScript, Next build, source-exact V1–V21 and richer feature PG16, native two-backend late-source-link conflict and prior owner-gate concurrency, wrong-target refusal/atomic DDL rollback. **PARTIAL:** proves this controlled ordering only; a link written *after* the final DELETE predicate could still be unsafe because source provenance has no source-flight FK and other writers are not yet known to acquire the V22 owner gate. NO claim of universal race safety. Full canonical 164 PG16, actual Neon HTTP, app-DB principal grants/RLS, browsers, production authenticated smoke NOT RUN; no legal/privacy erasure approval for +12-month UID receipts. No merge/deploy/DB/flags, Training or account Restore; Vercel production M0-A `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` READY at `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, prod DB/schema/flags UNKNOWN. [Checkpoint](docs/maintenance/2026-11-05-m0b-v22-late-source-provenance-race-pg16-checkpoint.md). **ONE NEXT STEP:** Audit all protected-link creation/update writers, especially V20 source-provenance links without a source-flight FK, for a shared per-owner/per-flight gate or equivalent database-enforced serialization; test the opposite ordering (link appears after the final check) before any V22 activation.

**2026-11-04T20:44:15Z — M0-B V22 authenticated source-writer integration staged OFF (Draft #469).** Verified `main@c9c2f60303236113a223942072311f5e37f876f7` and Draft #469 base Draft #468 `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`; exact executable work SHA `4ff66bd29ffc36dfa16baace4786d33469ea0640`. Existing `lib/flight-trash.ts` contains **source-frozen OFF** conditional V22 branches: before any V22 preflight it independently verifies `requireUser().userId`; for re-delete calls an atomic SQL source writer, for restoration composes **one** ordered `sql.transaction` with existing V21 advisory+restore queries plus account gate first and V22 finalizer last. When OFF, the original V21 statements run unchanged and app schema stays 21. Local-only guarded `tooling/sql/m0b-v22-trash-lifecycle-candidate.sql` now adds immutable restoration receipts from the same PostgreSQL transaction (xmin evidence) and a protected-draft re-delete source that archives flights/tracks/expenses, removes originals, transitions registry and issues restore→re-delete edge atomically. New feature fixture derives canonical `flight_public_shares` DDL from `lib/flight-sharing.ts`. **PASS** [GitHub Actions #41909227398](https://github.com/filipto861/flytally-logbook/actions/runs/41909227398) exact `4ff66bd29ffc36dfa16baace4786d33469ea0640`: Node24 targeted owner/auth **12/12**, full Node **1789/1789**, source SQL **11/11**, TypeScript, Next build, isolated PG16.15 exact V1–V21 migrations, richer feature fixture and physically tested same-transaction receipt / detached post-commit refusal / protected share / foreign owner / archive+track+expenses deletion / immutable evidence / two independent backend owner gate / rollback / passive expand guards. **BLOCKER:** source re-delete rechecks protected associations before snapshot but not a second time at final DELETE (V21 does both); concurrent late association race NOT TESTED. Also **NOT RUN** true Neon HTTP two-client transaction/app auth/role, full official 164 PostgreSQL partition, production-schema parity, browser/Safari, B2/V14 audit and prod authenticated smoke. Retention A +12-calendar-month UID/receipt erasure legal basis UNKNOWN; evidence FK RESTRICT blocks ordinary marker erasure. V22 OFF; no deploy/merge/Neon SQL/flags, production Vercel M0-A READY unchanged `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` at `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, prod DB/flags UNKNOWN; full-account Restore blocked. [Checkpoint](docs/maintenance/2026-11-04-m0b-v22-restore-redelete-source-atomic-checkpoint.md). **ONE NEXT STEP:** Harden the V22 source re-delete final flight DELETE to re-evaluate all V21 A+ protected-relationship exclusions (not merely the pre-archive eligibility check), and prove concurrent link-insert rollback on an exact isolated PG16 candidate; remain OFF.

**2026-11-04T20:10Z — M0-B V22 immutable multi-archive lineage (INACTIVE, Draft #469).** Verified `main@c9c2f60303236113a223942072311f5e37f876f7`, tested `53c42ce340c7d98deffa8d7d20cb72e3d87eeb22` on `feat/logbook-m0b-v22-expand-candidate-20261104` based on Draft #468 `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. **New test-only source and SQL:** `tooling/sql/m0b-v22-trash-lifecycle-candidate.sql` adds append-only owner/kind/UID scoped restoration→re-delete edges and terminal-purge receipts, immutable UPDATE/DELETE rejection, trusted prototype attestation with first owner-account `FOR UPDATE` gate, bounded noncyclic 64-link terminal reachability before deleting older restored archives. Latest `purged` snapshot cannot be accepted without recorded chain; legacy NULL-UID not inferred; wrong-owner or missing witness fails closed. `tooling/m0b-v22-feature-v21-fixture.mjs` emits 44 source-derived feature tables and 15 feature-migration keys from current browser bootstrap (no DROP), then executes **canonical v20/21 source SQL** on a freshly identified disposable PG16, IN ADDITION TO preexisting exact v1–21 chain fixture. **PASS** [GitHub Actions #41903755518](https://github.com/filipto861/flytally-logbook/actions/runs/41903755518) on exact `53c42ce340c7d98deffa8d7d20cb72e3d87eeb22`: Node24 **1788/1788**, pilot/cron 11/11, new SQL source tests **10/10**, TypeScript, Next build, PG16.15 exact migrations, one/multi-hop historic archive deletion, missing/forged witness rejection, immutable trigger checks, atomic rollback, actual two-backend owner lock, enriched V21 feature/evidence fixture, wrong-DB and role-deny. **PARTIAL:** source-derived feature snapshot is NOT the full live production DB, official native 164 PG16, app authenticated and two-client Neon HTTP, production smoke/browser NOT RUN. Runtime V22 OFF, DB schema version still 21; no register, merge, deploy, remote DB/flag, Training, full-account Restore. Legal/privacy A (+12-month minimal UID) unapproved; new append-only witness FK RESTRICT means eventual marker cleanup and erasure need separate legal-reviewed contract. [Checkpoint](docs/maintenance/2026-11-04-m0b-v22-immutable-lineage-feature-v21-checkpoint.md). **ONE NEXT STEP:** Implement trustworthy atomic V22 restoration/re-deletion source writers that issue immutable lineage edges on the same owner-gated transaction (still source-frozen OFF), then prove actual Neon HTTP authorization/transaction parity; retain independent legal/privacy/erasure release blocker.

**2026-11-04T14:18Z — M0-B V22 owner-serializing lifecycle transaction, fully INACTIVE (Draft #469).** GitHub `main@c9c2f60303236113a223942072311f5e37f876f7`, `feat/logbook-m0b-v22-expand-candidate-20261104@bd857d85a95f3b74e20acb9f058e917fe561daa7`, Draft #469 stacked on Draft #468 `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. `tooling/m0b-v22-canonical-v21-fixture.mjs` builds **source-exact SQL migrations V1–V21 from `lib/db-optimization.ts` onto a minimal canonical pre-optimization base** in a newly created local disposable PostgreSQL16 database (NOT a full application-feature schema or production clone). Standalone, locally self-guarded `tooling/sql/m0b-v22-trash-lifecycle-candidate.sql` installs an unregistered **SECURITY INVOKER owner-gated 1..25-row atomic function**, gate `users FOR UPDATE` first, fresh locked archive rows second, verified owner/UID snapshot, active-restored and older-restored-while-redeleted cases, legacy NULL UID with no inferred identity, `trash→purged` with **provisional** original-cutoff +12-month marker. Wrong/unknown provenance fails closed and rolls back; ambiguous previously purged restored history is preserved, **NOT yet a solved lifecycle contract**. `lib/trash-retention-service.ts` compiles future authenticated pilot and cron batch adapters, but **source-frozen OFF throws before candidate queries**; V21 runtime/legacy cleanup unchanged, schema version stays 21, no function registered in runtime migration. **PASS** [Actions #41845881360](https://github.com/filipto861/flytally-logbook/actions/runs/41845881360) at exact `bd857d85a95f3b74e20acb9f058e917fe561daa7`: Node24 targeted 11/11, full **1788/1788**, TypeScript, Next.js build, source-only candidate 6/6, actual PostgreSQL16.15 migration-chain/negative owner+UID+restored/rollback/deny-by-role tests, and **two independent PG16 backends visibly blocked/serialized on owner gate**; prior passive expand DDL/rollback PASS. **NOT RUN:** full canonical application/feature-specific V21 schema 164 PG16 tests, authenticated app/cron dynamic Neon HTTP, real DB role parity, browser/native Safari, B2/V14 signed issuer/provenance, production smoke. Vercel M0-A production READY unchanged `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` at `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; prod DB/flags UNKNOWN. No Neon/production DML, migration, merge, deploy, flag, Training; full-account Restore remains blocked. Legal/privacy of 12-month marker and account erasure unresolved. [Checkpoint](docs/maintenance/2026-11-04-m0b-v22-owner-lifecycle-pg16-checkpoint.md). **ONE NEXT STEP:** design immutable event lineage for re-restored/re-deleted historical archives when the latest event is already purged, then verify on a full feature-equivalent V21 fixture before any V22 activation.

**2026-11-04 M0-B V22 application boundary batch (INACTIVE / Draft #469):** GitHub `main@c9c2f60303236113a223942072311f5e37f876f7`, executable `bf5cec23127922142c97b57d20f027273ff4058d`, branch `feat/logbook-m0b-v22-expand-candidate-20261104` based on stacked Draft #468 `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. Existing `lib/flight-trash.ts` per-pilot expiry and `lib/privacy-account.ts` cron expiry now delegate through **`lib/trash-retention-service.ts`**, guarded by `lib/v22-trash-retention-mode.ts` source-frozen `off`. Pilot path rechecks `requireUser()` and exact positive owner; cron route forwards Authorization header and service independently rechecks `CRON_SECRET` before any cleanup; V21 SQL and cron privacy transaction unchanged. Attempting mode other than `off` fails closed. No V22 lifecycle mutations, UID issuance, schema registration, automatic backfill or environment activation. `tooling/development-modules.json` explicitly assigns two new runtime files to `data-recovery` (audited inventory 420). **PASS** [Actions #41805142154](https://github.com/filipto861/flytally-logbook/actions/runs/41805142154) exact `bf5cec23127922142c97b57d20f027273ff4058d`: Node24 targeted 10/10, full **1787/1787**, TypeScript, Next build, disposable PG16.15 candidate DDL/negative guards/forced second-ALTER rollback. Earlier [#41804810324](https://github.com/filipto861/flytally-logbook/actions/runs/41804810324) **FAIL** 1/1787 due stale 418-file inventory; fixed by explicit new module ownership, not weakening the test. Full canonical V21 native 164 PG16, browser/native Safari, actual Neon HTTP two-client, end-to-end owner/cron runtime, prod authenticated smoke **NOT RUN**. No merge/deploy/remote SQL/flags/Training; production Vercel M0-A unchanged READY `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` source `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; prod DB/schema/flags UNKNOWN; full-account Restore blocked. Retention A +12-month minimal marker legal/privacy/account-erasure BLOCKER. [Exact checkpoint](docs/maintenance/2026-11-04-m0b-v22-trash-boundary-checkpoint.md). **ONE NEXT STEP:** Implement the actual bounded, owner-gated V22 Trash lifecycle transaction for both sources against a verified full V21-equivalent isolated PostgreSQL16 schema, while keeping the source-frozen V22 switch OFF pending Neon HTTP/auth/legal approval.


**2026-11-04 2026-11-04T08:55:00Z — M0-B V22 disposable PG16 acceptance PASS (Draft #469; NOT a migration).** GitHub main `c9c2f60303236113a223942072311f5e37f876f7`; executable work `0f0f74226c2b0b81194c4d68b95be4f96cde6277` on Draft #469, base #468 `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. [Actions #41803059399](https://github.com/filipto861/flytally-logbook/actions/runs/41803059399) **SUCCESS** at exact SHA: Node24 static **10/10 PASS**; isolated ephemeral local-loopback **PostgreSQL16.15** physical DDL, legacy NULL rows, owner UID uniqueness, duplicate restored archive rows, registry constraints, candidate rerun refusal, wrong-DB refusal, and forced second-ALTER **full rollback PASS**. Initial workflow runs #41802377024/#41802551937 FAIL: `inet_server_addr()::text` includes `/32`; fixed to `host(inet_server_addr())`. [New exact checkpoint](docs/maintenance/2026-11-04-m0b-v22-pg16-acceptance-checkpoint.md). Fixture is minimal synthetic (NOT full canonical v21 schema); Node24 full app TS/build/164 PG16/Playwright, live Neon HTTP two-client, prod DB/schema/flags and authenticated smoke **NOT RUN/UNKNOWN**. No SQL on remote, no merge/deploy/flag, schema version remains 21; M0-A full-account Restore blocked; +12-month retention A requires legal/privacy. **ONE NEXT STEP:** Implement one fail-closed, feature-OFF owner-scoped expired-Trash service covering both authenticated pilot list and authorized cron paths; preserve legacy OFF behavior and avoid schema registration or release.


**2026-11-04 M0-B V22 inactive expand-only first code candidate (Draft #469):** [Consolidated PR inventory and staged gates](docs/maintenance/2026-11-04-m0b-v22-expand-first-batch.md), [checkpoint](docs/maintenance/2026-11-04-m0b-v22-expand-checkpoint.md). `tooling/sql/m0b-v22-expand-candidate.sql` is **one-shot test-only** and not registered in `lib/migration-plan.ts` (`DATABASE_SCHEMA_VERSION=21`). SQL checks **disposable named local loopback PG16** and source tables, fails on preexisting UID/registry; passive nullable `event_uid` on flights/FSTD/deleted_flights, owner/kind/UID passive registry with optional cutoff/marker, conditional unique live/FSTD indices but **NON-UNIQUE** deleted-flight archive index. No owner-authorization implementation, lifecycle trigger, issuer inference, legal TTL or app writer; existing Trash list and cron direct DELETE remain unchanged. Local Node22.16.0 static test **10/10 PASS**, tested files independently verified byte-identical to GitHub blobs at executable SHA `35c70cc09f0cbbf00f36a90e83e120c4eed54107`; **real PG16 SQL execution NOT RUN**, so schema validity/compatibility not proven. Neon HTTP true concurrency remains NOT RUN. M0-A full Restore blocked, prod unchanged; +12-month minimal UID legal/privacy basis still open.


**2026-11-03 M0-B driver read-only temporal evidence correction, Draft #468:** Standalone test harness `tooling/m0b-b1b2c-neon-http-readonly-probe.mjs` now parses driver `timestamptz` JavaScript `Date` using `getTime()` rather than loss-prone `Date.parse(Date)`; accepts ISO text through `Date.parse`, rejects invalid values and requires distinct PG backend PIDs plus server-time overlap before claiming two concurrent clients. Two extra regression cases added at executable SHA `9a4b3eaf39244efa700c5fd715c771389cd72c8b`. Local Node22 source-equivalent but non-identical copy **15/15 PASS (PARTIAL)**, exact code Node24 CI and live serverless HTTP **NOT RUN**; original source-only/mock and Neon connector checks do **not** establish true app transport parity. No runtime app or SQL schema change. [Design](docs/maintenance/2026-11-03-m0b-neon-serverless-http-readonly-harness.md), [checkpoint](docs/maintenance/2026-11-03-m0b-http-readonly-harness-checkpoint.md). M0-A Restore containment and privacy/legal blockers unchanged.

**2026-11-03 M0-B separate EMPTY Neon PG16 actual-role/read-only experiment — Draft #467, not production:** [Provider metadata + read-only SQL evidence, role finding, P0–P8 status](docs/maintenance/2026-11-03-m0b-neon-isolated-project-readonly-evidence.md), [checkpoint](docs/maintenance/2026-11-03-m0b-neon-disposable-readonly-checkpoint.md). A **new** project `blue-haze-29352938` with branch `br-patient-sound-bacf0trt` / DB `flytally_m0b_isolated`, PG16.15, had **0 user tables**; not cloned from Logbook Shadow or production. Source-free Neon connector multi-SELECT transaction PASS under `READ COMMITTED` and SELECT error propagates, but **not** actual app `@neondatabase/serverless` HTTP two-client parity. Native Neon API LOGIN roles defaulted to `neon_superuser` with CREATEDB/CREATEROLE; attempted reduction denied, test roles removed. Two scratch NOLOGIN roles with no CREATE permissions were inspected via `SET LOCAL ROLE`; cannot be used as independent pilot/cron login credentials. [Actions #41606651155](https://github.com/filipto861/flytally-logbook/actions/runs/41606651155) exact guard SHA `82dc5259ab9a080f1c1101e2041ba10bdcacefb0` 12/12 PASS; not runtime/DB privilege verification. P1/P2 and full P3–P8 remote acceptance remain NOT VERIFIED. App `lib/db.ts` still shared SQL identity, two direct Trash DELETEs unchanged; M0-A full Restore disabled, legal/privacy +12-month retention not approved for production.


**2026-11-03 M0-B B1b.2c actual app auth / Neon HTTP transport boundary — SOURCE ONLY, Draft #466:** [Auth/cron source map and safely gated two-client HTTP P0–P8 plan](docs/maintenance/2026-11-03-m0b-b1b2c-neon-http-auth-parity-plan.md), [checkpoint](docs/maintenance/2026-11-03-m0b-b1b2c-neon-auth-source-checkpoint.md). A user Trash list derives `userId` from `requireUser`/hash-verified active session and deletes expired rows for that owner **on read**; Vercel backup cron first validates exact `CRON_SECRET` Bearer then runs a **global** expired Trash DELETE in `runPrivacyRetentionSweep`. Both share one production `lib/db.ts` `neon(DATABASE_URL)` query-function principal; synthetic per-pilot/sweep/privacy SQL roles from #465 are NOT a verified production architecture. Neon HTTP transaction is one **non-interactive predeclared batch**, so first owner lock + fresh read needs prebuilt statements or independently audited server-side SQL logic, not an `await` between HTTP requests. [Actions #41603548638](https://github.com/filipto861/flytally-logbook/actions/runs/41603548638) source `5df035db7fb17c7d6c10eb41bd38c1839067cbdd`: Node24 syntax PASS, **12/12 read-only tests PASS**, NO DATABASE_URL/SQL. This is not Neon role/lock parity; no V22 runtime/schema changes. Retention A +12 months remains working design pending legal signoff, M0-A full Restore blocked.


**2026-11-03 M0-B B1b.2c restricted-role/owner-FK proof — TEST-ONLY:** [source-shaped matrix, privilege risks and failure history](docs/maintenance/2026-11-03-m0b-b1b2c-v22-role-fk-access-diagnostic.md) + [exact SHA checkpoint](docs/maintenance/2026-11-03-m0b-b1b2c-v22-role-fk-checkpoint.md), Draft #465 stacked on #464. Real disposable PG16.15 [Actions #41602112295](https://github.com/filipto861/flytally-logbook/actions/runs/41602112295) at executable SHA `f03a8a2c2bae5b477460f783043bdf79824b86a6`: syntax PASS, safe-target 7/7, role/FK and dual cleanup **9/9 PASS**. The source-defined composite FKs for flight expenses/connected crew reject wrong owner; **numeric-only** `flight_participations.source_flight_id` still allows spoofed owner under raw SQL, so server evidence checks are necessary. Fixture role separation uses randomly named NOLOGIN roles and tests `SET ROLE` under disposable superuser; **NOT proof of current shared Neon SQL principal, real server auth/RLS, or production retention policy**. Deferred triggers require independently audited privilege model: initial role test FAIL from insufficient trigger read access; synthetic schema-owner SECURITY DEFINER with pinned search_path passed, not preapproval for deploying such functions. V22 runtime/migration NOT implemented, M0-A full-account Restore blocked, legal review of working +12 months still open.


**2026-11-03 M0-B B1b.2c dual Trash contract (DRAFT, NOT APP CODE):** [schema-first rollout and restored-archive retention semantics](docs/maintenance/2026-11-03-m0b-b1b2c-v22-schema-first-dual-trash-writer-contract.md), [exact PG16 checkpoint](docs/maintenance/2026-11-03-m0b-b1b2c-v22-dual-trash-restored-archive-checkpoint.md), Draft #464. Single-flight Trash recovery marks `restored_at/restored_flight_id` but leaves historic `deleted_flights` JSON row until 90-day expiry; the event UID is **active** even while a restored historical archive exists. Expiring that archive must NOT convert the active event to `purged`; only still-unrestored expired Trash does so. User-list and privacy-sweep entrypoints need one owner-gated service, replacing both direct DELETEs **in a future separately approved change**, never activating DB enforcement before both writers are compatible. [Actions #41600027200](https://github.com/filipto861/flytally-logbook/actions/runs/41600027200) test SHA `e40588df02c992adb0c6dffeea137d78c3ea8129`: owned-PG16 guard 7/7, synthetic corrected lifecycle 8/8 PASS, not app/Neon/auth/role proof. `eraseAccountForPrivacy` currently leaves active flight/FSTD source rows; privacy/audit obligations require explicit legal reconciliation. Retention A only owner-approved **design**, 12-month period pending legal basis; M0-A full account Restore remains blocked.


**2026-11-03 M0-B B1b.2c retention A owner decision — DESIGN ONLY:** [Owner-approved product direction](docs/maintenance/2026-11-03-m0b-b1b2c-retention-a-owner-decision.md), Draft [#463](https://github.com/filipto861/flytally-logbook/pull/463). Existing 90-day `deleted_flights.purge_after` retains payload; at cutoff a future atomic owner-scoped transition must delete expired flight/GPS/expense archive, retaining only a minimal linkable `owner/kind/event UID` marker until `purge_after + INTERVAL '12 months'` **as an engineering test parameter pending lawful retention and erasure review**. Source Trash list and privacy retention sweep currently both directly DELETE; do **not** install restrictive registry triggers without updating both. Unknown/erased original evidence -> full-account Restore UNAVAILABLE. Isolated [PG16.15 Actions #41598681099](https://github.com/filipto861/flytally-logbook/actions/runs/41598681099) exact source `f18e873aa549160e0ee876fb1d825d28ca3a2131`: safe-target 7/7 and retention A calendar/erasure proof **8/8 PASS**. This is NOT a deployed schema, privilege-controlled erasure, real app/Neon/issuer integrity validation, or automatic retention approval. M0-A production full Restore remains disabled.


**2026-11-03 M0-B B1b.2c real-declared-schema compatibility (DRAFT, NOT RUNTIME):** [V22 FK and 90-day Trash retention analysis](docs/maintenance/2026-11-03-m0b-b1b2c-v22-real-schema-compatibility-retention.md) and [exact checkpoint](docs/maintenance/2026-11-03-m0b-b1b2c-v22-compatibility-retention-checkpoint.md), Draft #462. Current CREATE TABLEs do NOT uniformly enforce composite flight ownership: expenses/connected PIC/share/provenance participant do; shared participation/verifications/instructor approvals link flight numeric IDs separately from user. Flight and FSTD certified revisions have no active-parent FK declared in their CREATE TABLE; audit and void archive must outlive active rows. Trash is deleted by **both user listing and privacy retention sweep** after roughly 90 days. [Disposable PG16.15 Actions #41596162456](https://github.com/filipto861/flytally-logbook/actions/runs/41596162456) executable SHA `a966ee5805a120f52d5707183a5667a5e2c71b53`, safe target 7/7 and compatibility A/B **7/7 PASS**; demonstrates old writer compatibility and that marker removal loses replay evidence, **not** actual application/production parity or privacy policy approval. V22 migration/issuer trust/Neon HTTP/real owner paths NOT RUN; M0-A continues blocking full Restore. No DeepSeek review by owner decision.


**2026-11-03 M0-B B1b.2c DRAFT — writer topology and PG16 registry constraint proof:** [real source topology](docs/maintenance/2026-11-03-m0b-b1b2c-writer-owner-lock-topology.md) + [exact evidence](docs/maintenance/2026-11-03-m0b-b1b2c-writer-lifecycle-checkpoint.md), Draft PR #461. Isolated PG16.15 proof [Actions #41594393542](https://github.com/filipto861/flytally-logbook/actions/runs/41594393542), executable SHA `d5d14a21e042de1ce2af706ae9cb9f22e8b43f3b`, safe-target **7/7**, lifecycle semantics **7/7 PASS**. Proposed registry prevents inconsistent Active/Trash/Void transitions, disallows void resurrection, scopes UID by owner/kind and allows identical heuristic fingerprints. **Only synthetic tables**, not app schema, migration V22, actual Neon driver or production restore. Retention/erasure policy and full owner/child FK integration remain open. Shipped runtime stays M0-A full account restore block. No DeepSeek review by owner decision.


**2026-11-03 M0-B B1b.2c synthetic PG16 proof — NOT runtime:** [Dedicated evidence](docs/maintenance/2026-11-03-m0b-b1b2c-pg16-lock-identity-proof.md) from Draft #460, source SHA `96e0e6a4d70dc96a83c4ea0d32ff9241beae22bd`, Actions #41592224174: 7/7 safe-target tests and actual PG16.15 4/4 synthetic concurrency scenarios PASS. Row-trigger-only account gate demonstrably deadlocks when a writer holds a parent row first. Explicit account-gate FIRST, followed by fresh READ COMMITTED statements and DB UNIQUE for `(user_id,kind,event_uid)`, works in minimal two-session fixture without blocking unrelated owner writes; fingerprint stays NON-UNIQUE. **No v22 schema/app writer changes, no restored audit, V14 provenance, Neon HTTP evidence or broad writer coverage exists.** M0-A production block remains canonical. Owner declined DeepSeek review for this scope.


**M0-B B1b.2c design safety review (DRAFT, NOT RUNTIME):** [Source-backed lock-order findings](docs/maintenance/2026-11-02-m0b-b1b2c-lock-order-pre-review.md) place the original [account-gate proposal](docs/maintenance/2026-11-02-m0b-b1b2c-event-identity-concurrency-v22-design.md) on **HOLD**: `BEFORE ROW` trigger alone is not proof that the per-user gate precedes row locks/predicates; a reverse lock order with Trash/void/Edit and missed child writers remains possible. `ensureDatabaseOptimizations()` may automatically apply a version 22 if naïvely registered. Independent review, exact owner-gate/identity DDL, and Neon HTTP tests NOT RUN. Shipped boundary is still M0-A fail-closed account restore.


**DRAFT M0-B B1b.2c (2026-11-02; NOT runtime contract):** [Event identity / scoped database-writer gate / v22 design](docs/maintenance/2026-11-02-m0b-b1b2c-event-identity-concurrency-v22-design.md) proposes account-owned immutable event UIDs separate from row IDs and heuristic flight fingerprints; account-specific guard rows enforced across all relevant DML through DB triggers; explicit fresh-statement conflict reads in a PostgreSQL transaction; signed V14 coherent full snapshot + verifiable issuer and separate imported audit. Global `SHARE ROW EXCLUSIVE` is proven disruptive to unrelated pilots. No v22 SQL, triggers, v14 parser, new capability or approval has been implemented. **Current canonical shipped runtime remains M0-A full-restore block.**


**PRODUCTION M0-A restoration safety boundary (2026-11-02):** **Verified 2026-11-02T18:17:33Z:** `main@f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, merged PR [#452](https://github.com/filipto861/flytally-logbook/pull/452), production Vercel [dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub](https://vercel.com/filipito/logbook/dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub) **READY** serving `fly-tally.com` at the same commit. The application disables full-account restore of stored and uploaded backups (V4+ including signed V13), with fail-closed checks at the user-facing server action and direct exact/legacy writers, before any persisted data mutation. The independent create/download/check backup operations and Trash single-flight recovery are **not** blocked. Historical restore engine code remains in-tree and unsafe for full restore until separately scoped M0-B corrections to audit/ID/shared-evidence invariants; any new entrypoint must also fail closed. No DB schema migration or flag change authorized. Source identity and evidence details: [M0-A checkpoint](docs/maintenance/2026-10-31-m0a-full-account-restore-containment-checkpoint.md).


**2026-10-25 — DRAFT D1-V11 regulatory status projection (not deployed):** `lib/data/dashboard-lapl-flights.ts` is a new bounded **2-calendar-year**, active-user-only SELECT of certified `flights`, `aircraft` Part-FCL credit metadata, verified instructor signatures (`flight_verifications`) and legacy PF movement compatibility (`flight_audit_log`/v1.35.3 marker). It never calls `ensureDatabaseOptimizations` or schema mutators. Malformed in-range flight dates or query failures cause Dashboard LAPL evidence to be **UNVERIFIED**, not a derived positive status. `lib/dashboard-lapl-overview.ts` strictly parses examiner/proficiency evidence from existing user preferences and delegates requirements/forecast to canonical `evaluateLaplA` (FCL.140.A); no new regulatory formula or DB table. `lib/dashboard-credential-overview.ts` shows CURRENT/NOT CURRENT/UNVERIFIED for LAPL(A) SEP/TMG rather than assuming current from a saved recency date, while unrelated fixed-expiry rating alerts retain precedence and do not suppress the LAPL status. FCL.060 passenger day/night indicators in `lib/dashboard-passenger-overview.ts` map the existing independent 90-day evaluation to those same explicit states, with soon metadata subordinate. `components/dashboard-editorial.tsx` reuses established badges without CSS or motion changes; historic `recency_snapshot` remains **Last check**, not legal CURRENT. These are **evidence summaries, not approval of licence, medical, electric-engine variant, passenger carriage or pilot authorization**. Source/review `dd0f4cdfcbc0e0f76ac17999f2b46ac07000fcc1`, targeted isolated Node24 23/23 domain + 7/7 source-contract PASS; full typecheck/build/PG/browser pending. Live production is still earlier PR419 runtime until separately authorized deploy. EASA October 2026 Easy Access Aircrew FCL.140.A (incl. variant applicability) is primary rule reference.

**2026-10-25T10:20:41.502Z — DRAFT Dashboard FCL.060 read contract (unreleased):** a separate bounded 90-day certified owner-scoped movement query (`lib/data/dashboard-passenger-recency.ts`) is projected with existing `resolveMovementCompatibility` and canonical `evaluatePassengerCurrencyMode`; it is not a new legal rule engine nor the full mutable Recency workspace. Displayed day/night SEP/TMG indicators and dates are recorded-evidence forecasts, not regulatory CURRENT or authorization. The present Classic fallback and persisted historic recency snapshot remain unchanged. Source `9d94fad28f09b24c9cc8b0501bd8fb1c254e440e`; PostgreSQL/browser release gates pending.


This document describes the active Next.js application and architectural rules that should guide new work. The previous title's `v2.7 generation` was ambiguous and is **not** the current canonical product version; current shipped product/release status belongs in `ROADMAP.md` and `package.json`. Historical release-specific design documents remain useful as regression context, but they are not the current system map.

## Production stack

FlyTally is a Next.js 16 / React 19 application deployed on Vercel and backed by Neon PostgreSQL. The active production runtime is TypeScript.

Primary runtime boundaries:

- `app/` — App Router pages, server actions and API routes;
- `components/` — reusable UI and interaction components;
- `lib/` — domain rules, authenticated data services, regulatory engines, certification, GPS, collaboration and recovery logic;
- `data/` — repository-owned static reference data such as the airport catalogue;
- `tests/` — TypeScript regression coverage and PostgreSQL acceptance/scale evidence;
- `tooling/` — development and CI tooling only; it must not become a second application runtime.

The pre-Vercel Streamlit/Python implementation is historical. Git history is the archive for that runtime.

## Product-domain map

The physical runtime layout remains `app/` / `components/` / `lib/`. We deliberately do not mass-move mature code merely to make directory names look modular.

For development planning and CI risk classification, `tooling/development-modules.json` maps stable path prefixes into these product domains:

- **flight-records** — Add/Edit flight, flight detail/list data and flight-entry behavior;
- **credentials-compliance** — licences, ratings, recency, SFCL/BFCL/helicopter compliance and supporting evidence;
- **connections-workflows** — Actions, notifications, participations, verification and training workflows;
- **analytics** — Dashboard, Statistics, Map and their read models;
- **data-recovery** — Data, Database, Export, Print, portable backup and restore;
- **fstd** — simulator/FSTD evidence;
- **platform** — authentication, profile/settings, administration, runtime schema and shared database infrastructure;
- **development-infrastructure** — GitHub Actions, local tooling and build/deployment configuration.

This registry is development metadata, not a runtime dependency graph. Unknown application code is intentionally classified conservatively as shared code until its ownership is made explicit.

When adding a new product module, prefer one clear canonical workflow and stable domain boundary. Register the module's path prefixes only after that boundary is real. Do not introduce parallel Quick/Simple/Advanced implementations of the same task merely to isolate code.

## Database, tenancy and schema compatibility

Neon PostgreSQL is the transactional source of truth. Queries and mutations are scoped by authenticated `user_id`; cross-user workflows use explicit participation and verification records rather than weakening ownership filters.

`lib/db.ts` owns the Neon client and initializes it lazily so build-time imports do not require a live production connection.

Schema compatibility is runtime-gated through `lib/runtime-schema.ts`. Schema gates must remain:

1. idempotent;
2. safe to retry after failure;
3. compatible with already-deployed historical records;
4. separated from presentation-only changes.

Database migrations, certification semantics and regulatory thresholds must not be changed as incidental cleanup.

## Certified and protected evidence

Ordinary flight records remain editable until certification. Certification creates a protected revision/fingerprint boundary; later corrections must not silently mutate the meaning of previously certified or signed evidence.

Important separations include:

- `flights` — the pilot's operational record;
- certification history — protected revision fingerprints;
- `flight_participations` — shared-flight workflow and ownership linkage;
- `flight_verifications` — signed evidence bound to an exact flight revision/hash;
- audit history — material change evidence independent of UI presentation.

A historical signature or verification must never appear valid for a later corrected revision unless the underlying protected evidence contract explicitly allows it.

Certified-flight voiding is separate from ordinary Trash or a certified correction: an authorized, reasoned atomic operation archives protected evidence and removes the source flight from active operational/recency views. Voided evidence remains auditable and must never be silently resurrected on restore; independently owned participant copies retain their own records and provenance. The [3.5.0 certified-flight voiding contract](docs/product/3_5_0_CERTIFIED_FLIGHT_VOIDING.md) preserves the **dated** schema-v20 archive/backup-v13 decisions and verification history. Its earlier draft/intermediate status is historical; current code, tests and release evidence remain authoritative.

## Regulatory and data-integrity source of truth

The executable implementation and regression/acceptance tests are authoritative for runtime behavior. Documentation must describe those contracts; it must not invent a parallel regulatory engine.

Current documentation authority for protected/regulatory behavior is:

- this `ARCHITECTURE.md` for cross-cutting certified-record, ownership, category, recency and recovery invariants;
- `docs/compliance/FCL050_IMPLEMENTATION.md` for the current FCL.050-oriented implementation baseline and external-approval boundary;
- `docs/compliance/FCL050_EVIDENCE_MATRIX.md` for current FCL.050 engineering traceability to fields, outputs and tests;
- current code and tests for exact executable semantics, including later corrections that supersede an older written baseline.

Version-specific regulatory notes under `docs/history/` are retained as provenance only. They must not override current code/tests or the active documents above.

The older `docs/certification-readiness/` set is retained as engineering evidence from its documented release era. Its version headers are not current release status and it must not be used to override newer active contracts.

## Multi-category regulatory model

FlyTally is one pilot logbook across `AEROPLANE`, `HELICOPTER`, `SAILPLANE`, `BALLOON`, `ULL` and conservative `OTHER` records. Category-specific evidence is explicit; category meaning must not be inferred from a convenient display label when the regulatory provenance is unknown.

The central architectural rule is **shared workflow, specialized authoritative engines**:

- flight entry remains one canonical workflow;
- certification and protected-evidence rules are category-aware;
- Part-FCL, SFCL, BFCL and supported helicopter calculations retain their own rule boundaries;
- presentation layers may normalize statuses and explanations, but must not merge distinct legal engines into a new untested super-engine.

Structured movements, launch evidence, BFCL operation context, training evidence and other regulatory inputs remain explicit evidence. Missing evidence is not silently manufactured from hours or GPS geometry.

## Recency & Compliance Workspace

The Recency workspace is a planning/read-model layer over authoritative category services. It can normalize presentation into states such as CURRENT, ACTION SOON, NOT CURRENT and INCOMPLETE EVIDENCE only when the underlying evidence supports that distinction.

Evidence links should point to the exact flights, training records, signatures or credentials already used by the authoritative engine. A row that did not contribute to the calculation must not be presented as confirmed provenance merely because it exists in the logbook.

## Flight entry and review

Flight entry now has one canonical semantic normalization boundary:

- Manual New/Edit uses `FlightForm` → `parseFlightInput(FormData)` → `manualFlightCandidate()` → pure `normalizeFlightDraft()` → `FlightInput`.
- GPS New uses reviewed source/profile state → `gpsFlightCandidate()` → the same pure `normalizeFlightDraft()` → `FlightInput` before persistence.
- `normalizeFlightDraft()` owns source-agnostic flight semantics and contains no DB, auth or FormData dependency.
- GPS retains only legitimate specialization around track/source provenance, date-effective price resolution, duplicate/advisory locks and atomic N-part flight+track persistence.

Integrity gates:
- F0.1 removed GPS invalid-profile → `ULL` fallback and restricted GPS role semantics to PIC until Role/Crew parity;
- F1.0 migration v17 preserves explicitly supplied historical make/model/variant snapshots and refreshes profile identity only on the reviewed conditions;
- F1.5 removed hidden GPS SP/class-derived Engine assumptions for applicable contexts;
- F1.6 requires explicit source-fidelity evidence where generic GPS motion is not authoritative.

Role/Crew completeness is the remaining domain gap and belongs to F2. GPS stays PIC-only until each additional role can preserve the same identity, supervision and collaboration semantics as Manual entry.

GPS suggestions for an existing saved flight require explicit review before overwriting saved values. A successful normal Save hands the pilot into final logbook-data review without bypassing certification, sharing or protected-record boundaries.

Draft-consumer boundary:
- canonical recency uses certified flights only;
- Dashboard/Statistics and Export/Print may consume draft records, so a draft still requires correct stored semantic identity even though it is not regulatory recency evidence.

The active convergence contract is `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md`.

## Collaboration and professional evidence

Connections, Actions, notifications, shared-flight participation, instructor/training verification and professional pilot context are workflow layers over the pilot's own records. They may add evidence and review state, but they do not transfer ownership implicitly or rewrite protected records.

Professional context such as operator/operation, supervised time or employment-oriented reporting remains recorded evidence unless a separate tested rule explicitly establishes a regulatory or employment conclusion.

## Data integrity and recovery

Portable backup/restore is an application-level disaster-recovery feature, separate from provider-managed PostgreSQL recovery.

The v2.7 recovery path is intentionally review-first and atomic:

- restore preview groups missing, present and protected/conflicting evidence before mutation;
- authenticated current-format backups use server-side integrity protection while legacy backups remain bounded by compatibility rules;
- certified revisions, signatures, GPS, sharing evidence, audit history, licences, expenses and recency evidence are preserved through the canonical recovery path;
- large-account recovery uses tested batching while preserving transaction safety.

Restore must remain non-destructive by default. A convenience cleanup must never weaken protected-evidence conflict detection.

## Data access and performance

High-frequency routes use compact SQL projections, set-wise lookup and aggregation where practical. Large GPS geometry is excluded from routine list payloads and loaded only by detail/review workflows that require it.

Performance rules:

- never cache user data across tenants;
- avoid N+1 queries on high-frequency pages;
- aggregate in PostgreSQL when transferring raw rows is wasteful;
- keep Dashboard read models lean and leave historical analysis to Statistics;
- **D1-V11 (Draft PR #410; not yet deployed):** classic Dashboard continues to use `getDashboardOverviewData`. The URL-opt-in Editorial preview additionally requests `getDashboardPaceData(userId,asOf)`, a separate user-scoped SQL projection restricted to 25 UTC calendar months for 24 bars and two equal completed 12-month comparisons. It mirrors established activity/flight-category/safety-pilot rules, never calls unbounded `getDashboardData`, and must fail closed on invalid in-window date evidence. Missing/unplaceable dates are not inferred into a calendar period. The old `dashboard_widgets` preferences and legacy route remain unchanged. This is an **unreleased candidate**, with performance and browser validation still NOT RUN; read [review reconciliation](docs/product/LOGBOOK_D1_V11_DEEPSEEK_REVIEW_RECONCILIATION_2026-10-24.md).
- load detailed GPS only when required;
- retain 10k/50k scale gates and the controlled 100k read benchmark for registered hot paths.

Known performance-sensitive paths are centralized in `tooling/development-modules.json`; CI uses that metadata rather than duplicating path lists in workflow YAML.

## Airport reference data

`data/airports.csv` is the repository airport catalogue used by the Next.js runtime. `lib/airport-catalog.ts` loads and normalizes it server-side and maintains a process-local read-only index.

Transactional database copies and personal source spreadsheets do not belong in the active repository.

## Development verification and deployment

The development loop is candidate-first:

1. iterate locally with targeted tests and explicit TypeScript checks;
2. use `npm run scope:changed -- <path> [...]` to inspect module/CI risk when useful;
3. run `npm run verify` before publishing a coherent candidate;
4. push one candidate commit when practical and let the pull request run the shared safety gates;
5. merge only after the exact candidate SHA is green.

Every normal PR keeps the fast application gate: TypeScript, the complete unit/regression suite and a real Next.js production build. PostgreSQL acceptance runs for application-impacting work, while registered performance hot paths and `[full-ci]` candidates retain the scale gates.

Vercel build filtering is deliberately conservative. `tooling/vercel-ignore-build.mjs` can skip a deployment only when every changed file is structurally development-only: documentation, GitHub workflow metadata, tests or non-deployment tooling. Runtime code, dependency metadata, TypeScript/Next/Vercel configuration and `tooling/vercel-ignore-build.mjs` itself are always build-relevant.

The guard uses `VERCEL_GIT_PREVIOUS_SHA` when Vercel supplies a usable commit. When preview checkouts omit that value, a one-commit candidate may fall back to its parent only when that parent is a GitHub-created production merge commit. Multi-commit or otherwise untrusted preview history fails safe toward a real build rather than inspecting only the latest commit. Production deployments compare against the previous production state, using the supplied previous SHA when available and the first parent as the safe merge/direct-push fallback.

Release-numbered regression tests are retained after their release closes. They are historical behavior contracts, not disposable scaffolding.

## Architectural rules for future work

- Prefer extending an existing canonical workflow over adding a parallel implementation.
- Keep legal/regulatory rule engines deterministic, evidence-driven and independently testable.
- Treat protected evidence, certification fingerprints and restore semantics as high-risk boundaries.
- Make new database work tenant-safe and idempotent before optimizing it.
- Add scale coverage only where the production read/write path justifies it; do not run expensive fixtures on unrelated changes.
- Refactor large modules incrementally behind behavior tests rather than combining broad code movement with feature delivery.
- Use the development module registry to make ownership and CI risk clearer, but do not distort runtime architecture merely to satisfy the registry.

## Deferred structural debt

The codebase still contains several deliberately large UI/domain modules and historical version-layered styling. They should be reduced incrementally where a concrete feature or measured maintenance problem justifies it. A repository-wide folder rewrite, CSS rewrite or regulatory-engine merge would create substantial regression risk without equivalent user value and is therefore not a default cleanup strategy.
