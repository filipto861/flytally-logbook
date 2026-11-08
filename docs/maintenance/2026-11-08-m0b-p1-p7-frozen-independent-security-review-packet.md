# M0-B / V22 — Frozen P1–P7 architecture and security review packet

**Prepared (UTC):** 2026-11-08T10:17:00.292Z. **Status:** LEAD-ONLY SOURCE DISCOVERY / FROZEN THIRD-PARTY REVIEW INPUT — **NOT YET AN INDEPENDENT CLAUDE OR DEEPSEEK REVIEW**. No private code or data has been transferred to an external reviewer.

## Identity and governance

- **Repository:** `filipto861/flytally-logbook`, Logbook only (NEVER FlyTally Training). Canonical GitHub main `c9c2f60303236113a223942072311f5e37f876f7`.
- **Audited code/docs HEAD:** `3fbe72328f23842f489fb0c2576d4c5d2bafcbd4` on `feat/logbook-m0b-v22-expand-candidate-20261104`, unmerged [Draft PR #469](https://github.com/filipto861/flytally-logbook/pull/469), stacked on unmerged [Draft PR #468](https://github.com/filipto861/flytally-logbook/pull/468) at `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. Current work HEAD differs from owner P0/P8 exact tested `fe9ffbc67471c6268d63739b2b442fced0550aec` **only by documentation** (GitHub compare confirms four Markdown files, no executable source changed). A later docs-only review checkpoint is not a tested runtime SHA.
- **Product baseline:** `DATABASE_SCHEMA_VERSION=21` in `lib/migration-plan.ts`; `V22_OWNER_TRASH_RETENTION_MODE="off"` hard-coded in `lib/v22-trash-retention-mode.ts`. V22 SQL is **local-disposable-only candidate**, not in normal runtime migrations. Full-account Restore remains blocked by M0-A before mutation. Nothing in this review grants a migration, merge, deployment, flag change, database role change or release.
- **Owner direction:** retention option **A**: retain no expired full Trash payload to preserve UID identity. Existing Trash expiry follows persisted `purge_after` (typically 90 days). **Provisional engineering design only**: minimal owner-scoped UID marker through `purge_after + INTERVAL '12 months'` using PostgreSQL calendar months, with account-erasure/legal basis undecided. Legacy/null/ambiguous source provenance must fail closed; certified/voided regulatory evidence and independent shared participant evidence must not be silently erased/recredited.
- **Deployment:** read-only verified Vercel `logbook` production M0-A deployment `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` READY at Git SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`. Production SQL schema, credential roles, grants and feature flags **UNKNOWN**, authenticated production smoke **NOT RUN**.
- **External review governance:** user earlier declined DeepSeek at a previous design stage; the present “pokračuj” and stated next step authorize preparing a bounded review packet but **do not on their own authorize transmitting this private repository to another service**. External reviewer execution remains **NOT RUN**. A reviewer cannot grant deploy/DB/merge approval.

## Verified evidence ledger (do not overstate)

| Boundary | What actually passed | Still unknown or blocked |
| --- | --- | --- |
| Native owned Windows 11 PostgreSQL 16.15 acceptance | Owner console exact `f21473d4d42574ac03722978d287eef03bed6a9f`: 6 NEW localhost clusters, **164/164 PASS** (124+8+5+19+6+2), Node24.19; current source changes since then CI+Markdown only | Owner's `verified-summary.json` contents not independently imported; native local adapter != Neon HTTP writer transport |
| Offline HTTP/scope guards | GitHub Actions [#42466682211](https://github.com/filipto861/flytally-logbook/actions/runs/42466682211) at `77531363ac6b173ceb88e9a1e38aecc3f93beec9`: **15/15** fake Neon HTTP and **12/12** exact target-scope tests PASS, zero skips | Mocks are not live DB role, locking or rollback proof |
| Real P0/P8 HTTP read-only | Owner home PC command at `fe9ffbc67471c6268d63739b2b442fced0550aec`: exact direct isolated Neon DB `flytally_m0b_isolated`/role `flytally_m0b_operator`/PG16.15/current_user, no public tables or fixture schema; READ ONLY `ReadCommitted` batch PASS. Two distinct backend-PID read-only transactions showed server-side overlap >=200 ms; **P0/P8 PASS**, exit 0. Private URL entered locally masked, cleared from process env, not shared. | P1–P7 writing SQL over Neon HTTP not executed. Earlier cloud-sandbox P0 `NeonDbError` is still a separate historical failure; not proof that its environment was fixed |
| Exact GitHub CI for owner tested code and current docs | [Actions #42468287730](https://github.com/filipto861/flytally-logbook/actions/runs/42468287730) at `fe9ffbc67471c6268d63739b2b442fced0550aec` **SUCCESS**, [#42469480995](https://github.com/filipto861/flytally-logbook/actions/runs/42469480995) at `3fbe72328f23842f489fb0c2576d4c5d2bafcbd4` **SUCCESS**; full Node ~1790, typecheck/build and targeted disposable PG16 pass | GitHub CI uses synthetic disposable PostgreSQL and offline HTTP; cannot claim deployed runtime/real write permissions |
| P1–P7 actual Neon HTTP writer / privileges | Local synthetic PG16 candidate source/owner/late provenance races and rollback demonstrably tested; source-provenance/redelete/restore receipt candidates exist | Live Neon HTTP write transaction parity, real separate auth roles, DDL/grants, account erasure/legal review, signed B2+ full Restore and production status **NOT RUN / BLOCKED** |

## Current source evidence (observed, not proposed)

1. **Transport and authority:** `lib/db.ts` uses a cached single shared `neon(DATABASE_URL,{fullResults:false,arrayMode:false})` HTTP query function; `lib/local-postgres.ts` is a different adapter. `requireUser()`/cookie session and CRON_SECRET bearer authorization are server-side identity checks, **not PostgreSQL current_user**. Isolated Neon branch provider metadata has one operator LOGIN and two `NOLOGIN` scratch roles; this does not demonstrate distinct pilot vs cron vs erasure SQL credentials. Source `@neondatabase/serverless@1.1.0` supports `sql.transaction([...],{isolationLevel:'ReadCommitted'})` as a noninteractive single request; P0/P8 only proved read-only batches.
2. **Pilot/cron expiry:** `lib/trash-retention-service.ts:expireTrashForAuthenticatedPilot` validates `requireUser().userId===owner` and retains V21 owner-scoped `DELETE FROM deleted_flights`; `authorizedCronTrashExpiryStatement` checks CRON_SECRET and retains global `DELETE FROM deleted_flights` inside `lib/privacy-account.ts:runPrivacyRetentionSweep`. Proposed OFF-only `logbook_v22_expire_owner_candidate(owner,25)` is **not** active. Neither V21 direct DELETE may coexist blindly with strict V22 UID transition triggers.
3. **Current local V22 DB candidate:** `tooling/sql/m0b-v22-expand-candidate.sql` is a **loopback-only PG16** protected additive `event_uid` and `logbook_event_uid_registry(owner_id,event_kind,event_uid)` proposal (nullable historical values, no migrated issuer). `tooling/sql/m0b-v22-trash-lifecycle-candidate.sql` adds test-only immutable lineage, `expire_owner`, `finalize_restored_source`, `redelete_source` functions. These are `SECURITY INVOKER`, `SET search_path=pg_catalog,pg_temp`, with explicit `REVOKE ... FROM PUBLIC` at its end, but the local fixture owner retains access. **A function argument `p_owner` or REVOKE PUBLIC is not a proven pilot authorization boundary if the deployed SQL principal retains table/function privileges.** These scripts fail closed on nonlocal targets and MUST NOT be run remotely.
4. **Lock order:** `lib/flight-trash.ts:restoreDeletedFlightRecord` stages in one HTTP batch: conditional `users.id FOR UPDATE`, advisory lock, original canonical V21 restore CTE, conditional local-only finalizer; V22 is OFF. `app/(protected)/flights/shared-actions.ts:materializeParticipation` has a V22 OFF-only source-owner `users.id FOR UPDATE` statement then fresh `READ COMMITTED` data-modifying CTE. Tests covered both source provenance race orders on two physical local PG16 backends, **not actual Neon write lock contention**. Some values for materialization are derived from pre-lock source reads; reviewer should evaluate whether later CTE revalidation is sufficient for certification, audit and privacy (not presume exploitable).
5. **Protected lineage:** `flight_source_provenance.source_flight_id`, certified revision historical IDs and void tombstone original IDs do not carry ordinary source FK. Other child links often have FK. Candidate re-delete repeats the eight protected relationship checks at final DELETE and immutable receipt checks. Exhaustive future ordinary writer/owner/signer paths and noncooperating SQL writers remain an authorization/DB constraint proof obligation.
6. **Full-account Restore remains separate:** `lib/account-restore-v6.ts:executeExactAccountRestore` calls `blockFullAccountRestore()` before SQL. Dormant implementation still contains MAX(native audit ID), subsequent `DELETE FROM flight_audit_log` and source audit import/rebinding patterns. V22 UID is **not** a release fix for account Restore; signed v13/v14 issuer and coherent backup snapshot evidence, native audit append-only semantics, ambiguous identity/migration rollback still need separate B2/B3/B4 design.
7. **Erasure:** `lib/privacy-account.ts:eraseAccountForPrivacy` cancels/revokes linked records, deletes selected account data (including Trash/tracks/settings), deactivates/anonymizes user, but **does not delete live `flights` or `fstd_sessions`** in visible SQL. Decide minimal UID marker personal-data status and erasure exceptions with owner/legal review, and never erase independently owned participant certification or certified Void audit as routine Trash.

## Required independent reviewer challenge: P1–P7

| Gate | Adversarial question | Acceptance evidence needed before any implementation/release |
| --- | --- | --- |
| **P1 — lock order** | Is a first-statement owner gate sufficient when writers also hold flight/FSTD rows, advisory locks and FK child locks? Which calls invert this order; can a predicate start before waiting on trigger? | Exhaustive source writer/trigger lock graph; two-session forward and reverse real local PG16 races, bounded wait/timeouts, no partial writes or stale snapshot. Never use trigger-only gate as primary proof |
| **P2 — cross-account contention** | Does owner-first account locking unnecessarily serialize independent pilots or deadlock with shared/cross-owner evidence? What deterministic lock order covers old/new/source/recipient/signer owners? | Two independent users progress concurrently; cross-owner user list sorted before row/child locks; cancel/timeout/rollback tests and estimated perf impact |
| **P3 — UID uniqueness / issuer trust** | Which constraints stop ordinary noncooperating inserts reusing erased or absent event UIDs? Are UID registry and active/Trash/FSTD row transitions consistent with legacy NULL; what can be proven about historical v13 backup identity without signed source-instance lineage? | DB UNIQUE/FK/transition/immutability proof; duplicates with same/different owner/kind/UID, missing/erased markers, clone, migrated rows and unknown issuer => conflict or UNAVAILABLE |
| **P4 — Restore/Trash lineage** | Do restored archival copies remain historical while registry stays active; can archive expiry mistakenly mark an active flight purged? Does `xmin`/transaction-ID same-transaction attestation remain sound under wrap/subtransactions? | Local PG16 real-schema restore/re-delete/re-expiry with immutable receipts and forced mid-batch abort; verified exact source audit and archive digest. `xmin` is a diagnostic mechanism until reviewed |
| **P5 — identity and SQL privileges** | Given shared `neon(DATABASE_URL)`, who can call SQL functions with arbitrary `p_owner`, who can directly mutate UID/Trash rows, who can execute `SECURITY INVOKER` routines, and can pilot/cron/erasure truly be separated? Is server-only auth enough or must role/topology/RLS/privilege design change first? | Negative privilege matrix against a **separately authorized isolated** role and grants (no remote destructive tests); role membership, `EXECUTE`, table DML, RLS/bypass, search_path, ownership and service-secret rotation; no claim that current NOLOGIN scratch roles authenticate |
| **P6 — privacy/legacy and regulatory records** | Is provisional 12-calendar-month owner-linked UID witness lawful, with erasure exceptions and retention of immutable certification/void/shared evidence? What happens to restored Trash copies, native audit and legacy identity without issuer? | Documented lawful basis/retention and deletion ownership decision, exact cutoff, account erasure and cross-user evidence isolation; no certification/audit silent rewrite; explicit owner decision |
| **P7 — rollback/idempotency/Neon HTTP** | Does fixed-array HTTP transaction guarantee atomic owner gate + restore + finalizer in actual remote driver? What if HTTP response is lost after commit and caller retries? Could source-preflight outside transaction cause stale authorization or inconsistent UI errors? | Post-commit uncertainty policy, idempotency keys and reconciliation status; local forced error rollback and driver protocol evidence; later live write parity only on expressly authorized target and reviewed safe plan |

## Design options for reviewer; NONE approved

- **A — narrow owner/event scoped first-statement gate + DB identity constraints** (preferred **candidate to challenge**, not a decision). Touch only operations needing cross-record retention/Restore/provenance, keep V21 OFF compatible. Lower blast radius but requires proof that unrelated ordinary writers cannot bypass identity/lineage protection via direct table DML, and owner/recipient sharing may need broader coordination.
- **B — universal per-account gate for all relevant writers** after full enumeration. Easier conceptual serialization but high latency/deadlock surface and migration/legacy blast radius. A prior **lead-only** pre-review at `docs/maintenance/2026-11-02-m0b-b1b2c-lock-order-pre-review.md` **blocked trigger-only B**, so do not resubmit it as approved.
- **C — limited Restore into provably empty/quiescent account identity namespace**, with explicit owner-approved product scope reduction. Does not solve audit-native Restore, signer/legal proof or silent issuer ambiguity.
- **Release sequencing stays S0→S1→S2→S3→S4**: privacy/role design and source proofs; explicitly approved additive expand only; OFF dual-compatible writers + both expiry entrypoints; DB enforcement after exhaustive writer proof; separate merge, migration, feature enable and deploy approvals. Any version 22 auto-registration in `lib/migration-plan.ts` requires special protection because `ensureDatabaseOptimizations` can auto-run migrations.

## Frozen reviewer file manifest (23 representative sources, under 50-file DeepSeek limit)

Use the **exact audited code revision `3fbe72328f23842f489fb0c2576d4c5d2bafcbd4`** (or a later docs-only commit with verified unchanged executable tree) and attach ONLY these tracked repository files, no `.env*`, credentials, database dumps, flight exports or GPS:
```text
AGENTS.md
ROADMAP.md
ARCHITECTURE.md
DEVELOPMENT.md
docs/AI_HANDOFF_TEMPLATE.md
docs/maintenance/2026-11-03-m0b-b1b2c-retention-a-owner-decision.md
docs/maintenance/2026-11-02-m0b-b1b2c-lock-order-pre-review.md
docs/maintenance/2026-11-03-m0b-b1b2c-v22-schema-first-dual-trash-writer-contract.md
docs/maintenance/2026-11-08-m0b-p0-p8-owner-native-neon-http-pass.md
lib/db.ts
lib/v22-trash-retention-mode.ts
lib/trash-retention-service.ts
lib/flight-trash.ts
lib/privacy-account.ts
lib/account-restore-v6.ts
lib/migration-plan.ts
lib/db-optimization.ts
lib/auth/require-user.ts
lib/auth/session.ts
lib/cron-auth.ts
app/api/cron/backups/route.ts
app/(protected)/flights/shared-actions.ts
lib/flight-voiding.ts
tooling/sql/m0b-v22-expand-candidate.sql
tooling/sql/m0b-v22-trash-lifecycle-candidate.sql
tooling/m0b-b1b2c-role-fk-privilege-probe.mjs
```

The manifest above has 26 explicit paths, within the supported 50-file cap. Reviewers unable to read private GitHub must receive only owner-reviewed selected copies or an owner-generated local archive. **Do not send private source automatically.**

### Suggested exact reviewer instruction (copy into Claude or DeepSeek after owner chooses to share files)

> You are an **independent read-only security and data-integrity reviewer** for FlyTally Logbook. Treat the attached 26 tracked files as frozen source at `filipto861/flytally-logbook@3fbe72328f23842f489fb0c2576d4c5d2bafcbd4`. Canonical main is `c9c2f60303236113a223942072311f5e37f876f7`, Draft PR #469 is open/unmerged and stacked on #468. No access to production, database secrets, live user records or GitHub write operations. Do not write code, open PRs, run remote SQL, change roles, merge, deploy, modify flags or suggest bypassing safety gates. Read the technical freeze and evidence matrix in `docs/maintenance/2026-11-08-m0b-p1-p7-frozen-independent-security-review-packet.md` first, then challenge the P1–P7 first-lock/authorization/UID/retention/restore/rollback design. Separate observed code from assumptions, and do not confuse real owner P0/P8 READ ONLY PASS or local PG16 164 PASS with writer/grant parity. For each finding give **severity (BLOCKER/HIGH/MEDIUM/LOW), exact path/function and proof, adversarial scenario, bounded alternative, proposed synthetic local acceptance**, and whether it requires an explicit owner or privacy/legal decision. Address the three design options A/B/C and give an overall verdict **APPROVE / APPROVE WITH CHANGES / BLOCK**. If missing source or evidence prevents a conclusion, mark **UNKNOWN**, not PASS. Respond with a brief Czech executive summary and technical findings.

## Reviewer output required

Return `Verdict: APPROVE | APPROVE WITH CHANGES | BLOCK`; a table `Finding ID / severity / source path / observed condition / inferred risk / attack or race sequence / safe minimal mitigation / acceptance test / owner decision`; a phase-ordered change proposal; a list of **not proved** properties; and the final explicit **DO NOT**. The lead subsequently reconciles every finding into ACCEPT, REJECT WITH REPO EVIDENCE, or DEFER TO OWNER. Independent reviewer authority is **advisory only**.

**ONE NEXT STEP:** Filip selects and authorizes a single read-only external reviewer and (separately) whether to share the bounded private-source packet. After review returns, reconcile it against pinned GitHub code and present a narrow approved plan before any implementation or remote write.
