# M0-B B1b.2c — V22 schema-first rollout and shared Trash writer contract (DESIGN + TEST ONLY)

**UTC:** 2026-11-03. **Repository:** `filipto861/flytally-logbook`. Verified canonical `main@c9c2f60303236113a223942072311f5e37f876f7`. Design base: Draft #463 `test/logbook-m0b-b1b2c-retention-a-window-20261103@f13e89515cdafd697c00dbb16dd981670bb22f0d` stacked on #462→#461→#460→#459→#458→#457→#456→#455; independent B0 #454. User approved retention **A as design direction**, not runtime/production; declined DeepSeek review. This document changes **no application code or real database schema**. No production/remote SQL, merge, deployment, Restore enablement or flag changes.

## 1. Source reconciliation: a third state, previously missing

`lib/flight-trash.ts:~180,228` marks a successfully recovered deleted-flight archive with `restored_at=NOW()` and `restored_flight_id=<new id>`; it **does not immediately DELETE** that `deleted_flights` row. Both `lib/flight-trash.ts:11` (Trash listing) and `lib/privacy-account.ts:48` (privacy sweep) later delete these rows at `purge_after`.

A strict `(state='active' -> no `deleted_flights` row)` cross-table check from the *minimal synthetic lifecycle prototype* would misinterpret an **already restored but still retained** archival copy as an illegal second live event. The forward-compatible state must distinguish **the event state** (active) from **the presence and restored status of a historical Trash archive**. It cannot make the restored archive into a second active flight or convert the parent event into `purged` when that archive expires.

At expired `deleted_flights` rows, handle three cases distinctly:

| Archive status | Verified event marker | Atomic expired-archive treatment |
| --- | --- | --- |
| `restored_at IS NULL` (still Trash) and known owner/kind/UID | `trash` | Account gate first, fresh row/marker locking, transition marker to `purged`, set `marker_until = persisted purge_after + INTERVAL '12 months'` **working legal-review parameter**, then remove entire archived flight/GPS/expense payload |
| `restored_at IS NOT NULL` (already restored archive), known owner/kind/UID | `active` | Account gate first, confirm active identity/new flight association and archive digest/owner provenance; **delete expired historical archive only**, leave active registry/event untouched; reject mismatch |
| Legacy archive with `event_uid IS NULL` | Cannot prove trusted source issuer | Expire snapshot after cutoff without minting an asserted source identity. Single-flight Restore beforehand remains subject to current independent guard; later full-account Restore must fail closed for ambiguous source |

Another state, certified `voided`, must **not** be assigned the 90-day Trash TTL by inference. Source provenance, native audit and signed revision histories are separately retained by their applicable contracts.

## 2. Gate and both write paths

### Shared operation rather than duplicate direct DELETE

Propose a single small server-owned, account-scoped retention service used by **both**:
- `listDeletedFlights(userId)` after `requireUser` has established the authenticated account; UI list should not hold unrelated accounts. Avoid expensive sweep on every read if a trusted server retention job suffices; changing existing UX/side effects needs separate owner decision.
- `runPrivacyRetentionSweep()` after its existing authorized scheduled invocation; discover eligible account IDs read-only, sort numerically, run the **same** per-owner operation in bounded batches. Do not run global table-writing locks and do not let ordinary user request select `owner_id = NULL` to trigger a global sweep.

Proposed exact ordering **inside each owner-scoped SQL transaction**:

1. Verify trusted caller privilege, positive owner ID and database schema/feature status. Use server-side object authorization; merely passing an owner ID or a session variable is **not** database role-level authorization.
2. As the **first separate DB statement**, take the existing owner account-gate row lock (`SELECT .. FOR UPDATE`) using the same ordering as future Create/Edit/FSTD/Trash/void writers; missing gate must fail closed, not silently create one from untrusted input.
3. As a **subsequent SQL statement**, read eligible expired archives and registry state afresh, lock selected owner rows (`FOR UPDATE`) and re-evaluate cutoff, `restored_at`, `restored_flight_id`, and event ownership. Bound work; define deterministic owner order and avoidance of global lock contention.
4. If unrestored: atomically change `trash -> purged` with fixed `marker_until = archived purge_after + INTERVAL '12 months'`; DELETE snapshot. If restored: keep the **active** identity untouched and DELETE only the expired archive. Unknown source or incompatible state => error/rollback, not guessed provenance or silent discard.
5. Independently, expire `purged` minimal markers only after `marker_until`, but **do not** erase active/voided identities under an ordinary sweep.
6. Account erasure: handle owner-scoped minimal markers under separately authorized account privacy transaction; no generic delete of signed/native audits or independently owned participant records.

The isolated test-only PostgreSQL function in `tooling/m0b-b1b2c-trash-writer-gate-probe.mjs` mimics **sequential** first-gate/fresh-archive statements and a common per-owner function invoked by two callers. It is **not production code**: no real auth role enforcement, no migration installed, no tested HTTP driver transaction boundary, no complete cross-user lock graph. A SQL `SECURITY INVOKER` function executed by the application DB role does not authenticate a pilot merely because a `p_owner` argument was passed. The real service must validate session/cron authorization before calling it; additional DB role/row-level privilege controls need separate tests.

## 3. Schema-first rollout stages (PROPOSAL, requires separately explicit owner approval)

**S0 — decide legal/privacy boundary and data provenance.** The product direction A and an engineering **working** 12-calendar-month minimal marker are approved; lawful retention basis, duration and account-erasure exceptions are **not** signed off. Missing issuer/account evidence remains `UNAVAILABLE`. No deploy.

**S1 — explicitly approved additive expand-only DDL.** Before any real migration, verify exact target/DB ownership, source SHA, `pg_catalog` constraints/indexes/triggers and migration registry; write separate operator-script preflight/rollback and prove it against an isolated realistic clone. Candidate objects: nullable `flights.event_uid`, nullable `fstd_sessions.event_uid`, nullable legacy `deleted_flights.event_uid`, owner+kind UID registry and supporting indexes; no default invented issuer and no NOT NULL on historical rows. **Do not add restrictive triggers until both existing purge paths are compatible.** No retroactive signed/audit rewriting.

**S2 — dual-compatible runtime behind OFF/feature gate.** After schema-first application and real acceptance, implement owner-gated event issuance and two-entrypoint Trash cleanup via one authorized server service. With feature OFF the current production behavior must remain safe. Avoid a state where deployed DDL forbids the old cleanup while old runtime is still eligible to run; test rolling versions/rollback explicitly. Each app writer must acquire the common owner-gate *before* its parent/child locks; row-trigger-only enforcement reintroduces the previously reproduced deadlock.

**S3 — enforce after proof of every active/legacy writer.** Gradual backfill only of verifiable local state, **not source issuer identity inferred from fingerprint/date/old integer ID**; distinguish trusted vs unproven. Verify FK/registry invariants, native audit, certification/void and other owner-crossing writers. Then enable DB-level immutability/constraints in a separately approved migration; require actual Neon HTTP batching and rollback evidence. No `DATABASE_SCHEMA_VERSION` bump without a fail-closed per-environment migration gate: `lib/migration-plan.ts` currently says `21`, and `ensureDatabaseOptimizations()` auto-applies future pending versions except for its explicit v21 special case.

**S4 — separately approved prod operations.** Approval for design or Draft PR is not permission for merge, schema migration, deployment, account restore or feature flag. Any release requires exact SHA-bound risk selection, PG16 164-case registry/integration, user/client impact, authenticated smoke, real DB shape/flags, owner-authorized deployment/rollback and retention legal signoff. M0-A full-account Restore must remain blocked until later B2/B3/B4 acceptance, not enabled by V22 alone.

### Compatibility / rollback matrix

| Runtime | DB | Expected boundary |
| --- | --- | --- |
| Existing M0-A app | Existing V21 | **Shipped** and full Restore blocked |
| Existing app | S1 additive V22 un-enforced columns | Must retain old Trash/flight behavior; **test before deploying**, no blocking trigger |
| Dual-compatible app, feature OFF | S1 expanded DB | Legacy behavior preserved; no unknown UID auto-backfill or Restore activation |
| New app, feature ON | S3 gated constraints | All protected writers and both expiration paths must be covered; exact owner locking + no duplicate event identity |
| Rollback to old app after S3 strict enforcement | S3 constraints | **Unsafe until explicitly tested**. Freeze cleanup/use backward-compatible compatibility bridge or STOP; do not silently drop immutable constraints, delete the registry or revert audit |
| Partial/failed S1/S2/S3 | Any | Abort/rollback specific transaction, preserve source data, no unverified reconciliation |

## 4. Source-of-truth limitations and hard stops

- `lib/privacy-account.ts:eraseAccountForPrivacy` **does not delete `flights` or `fstd_sessions`** in its visible statements; it removes credentials, tracks, Trash and other related data, alters shared/approval state, and deactivates/anonymizes `users`. Therefore do not describe it as proof that all retained pilot flight history is erased. Legal/privacy handling of surviving flight/audit/void records and minimal UID marker is a distinct issue.
- `lib/flight-trash.ts` single-flight recovery emits a *new* local ID while recording `restored_at`/`restored_flight_id` on its older archive. That archive is not a second live event. Active identity survives its later payload purge.
- Existing source-defined ownership FKs are not uniform; `flight_verifications`, `flight_participations`, `instructor_flight_approvals` use single numeric flight references with separate user IDs; `flight_expenses`, `flight_connected_crew`, some provenance and public shares use composite owner. Physical production schema/legacy drift **UNKNOWN**.
- Test-only database user may hold superuser privileges in isolated Docker PostgreSQL; test PASS does not establish production DB role/RLS security. Do not add trust to a backup solely based on UID; source V14 issuer and B2 imported immutable ledger remain open.
- No destructive tests against production/remote Neon, no broader feature scope, no Training, no DeepSeek. Neither the owner-approved option A nor test-only SQL authorizes production migration, merge, deploy, Restore or feature flag.

## 5. Current evidence and one next step

The existing earlier isolated PG16 lock [Actions #41592224174](https://github.com/filipto861/flytally-logbook/actions/runs/41592224174), registry lifecycle [#41594393542](https://github.com/filipto861/flytally-logbook/actions/runs/41594393542), A/B retention [#41596162456](https://github.com/filipto861/flytally-logbook/actions/runs/41596162456) and finite A window [#41598681099](https://github.com/filipto861/flytally-logbook/actions/runs/41598681099) are **historical evidence tied to their exact former executable SHAs**, not release/Neon production acceptance. This new design milestone's test run must be separately verified before labeling PASS.

**ONE NEXT STEP:** build the **real-schema-equivalent but isolated** PG16 acceptance fixture for restored archive + dual-authorized entrypoints + account-erasure, including actual non-uniform owner FKs and limited DB privileges, before deciding any deployable V22 application DDL. Legal/privacy signoff remains a release blocker.
