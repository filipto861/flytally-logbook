# B1b.2c — source-backed lock-order pre-review and independent-review packet

**Status: LEAD ENGINEERING PRE-REVIEW ONLY; NOT a Claude/DeepSeek independent review.** UTC 2026-11-02. Sources: `main@c9c2f60303236113a223942072311f5e37f876f7`, proposed `PR #459@363213f866ff65d74f44549b22dced45c27f95c1`, stacked base `PR #458@49f7aeb85e5e61b3256d28cfb4937d38d33dba13`. Production M0-A remains READY `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` serving `fly-tally.com`, application SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`. No code, SQL, migration, test fixture, flag or deployment changed by this pre-review.

## Verdict: HOLD the proposed trigger-only account gate as a final concurrency guarantee

### F1 — BLOCKER: lock inversion and stale statement predicates

**Observed sources:** PR #459 B1b.2c design §3 proposes `BEFORE EACH ROW` triggers that take `account_write_gates FOR UPDATE`; `lib/flight-trash.ts` first explicitly locks a flight row `FOR UPDATE` before deletion; `lib/flight-voiding.ts` takes a distinct advisory key and locks the source row; `app/(protected)/flights/actions.ts` has standalone `UPDATE flights` statements and Create/GPS `NOT EXISTS` predicates. The proposed restore takes **account gate then parent rows**. Existing ordinary writes can take **parent row then account gate (trigger)**. This reverse order can deadlock; aborted transactions are an integrity safeguard but unacceptable as the untested principal concurrency mechanism.

A row-level trigger executes as part of the same DML command, not as a pre-statement handshake. In PostgreSQL `READ COMMITTED`, a statement can establish its visibility/predicate evaluation before waiting on a row-trigger gate. Acquiring the gate *inside* the `INSERT/UPDATE/DELETE` cannot be assumed to make its already-started `NOT EXISTS`/authorization predicates equivalent to fresh post-lock validation. No claim of actual exploit or test PASS is made; this is a source-backed **unresolved risk requiring two-session verification**.

**Required correction:** evaluate a **separate first transaction statement to acquire all affected owner guard rows before any parent/child row locks or predicate reads** for every relevant app writer, with deterministic multi-owner order; follow with fresh SQL statements for revalidation; use database UNIQUE/foreign-key/immutable identity constraints as hard correctness authority. A row trigger may be a defensive backstop but cannot alone serve as proof that a writer locked *first*. Show a non-cooperating writer is safely rejected/serialized by DB constraints, not just by voluntarily taking a lock. Do not globally convert current operations to this protocol without isolated trials and explicit scope.

**Reference:** [PostgreSQL 16 trigger behavior](https://www.postgresql.org/docs/16/trigger-definition.html), [CREATE TRIGGER](https://www.postgresql.org/docs/16/sql-createtrigger.html), [row locks/deadlocks](https://www.postgresql.org/docs/16/explicit-locking.html), [READ COMMITTED snapshot](https://www.postgresql.org/docs/16/transaction-iso.html).

### F2 — BLOCKER: exhaustive writer/owner/child coverage is not yet proved

**Observed:** `app/(protected)/flights/shared-actions.ts` signs and writes participation, verification and source/participant records with different users; `lib/flight-voiding.ts` archives many protected child families; `lib/flight-trash.ts` coordinates row locks/child emptiness; `app/(protected)/fstd/actions.ts` writes sessions and revisions without a shared FSTD advisory lock. The 2026-11-02 B1b.2c writer inventory explicitly has only a *representative* route map, not a verified exhaustive schema/DML trigger inventory. A trigger on the parent alone cannot guarantee source verification signatures or imported audit are semantically consistent.

**Required:** before any v22 DDL enumerate all DML paths (including database trigger side effects and schema setup), table ownership resolution and trusted FKs; list each affected owner from OLD/NEW and source/participant relationships; define deterministic multi-user lock order, allowed inserts/deletes, and fail-closed for orphan/unknown owner. Prove no bypass by direct SQL allowed to normal DB role, no recursive or bulk trigger conflict, no hidden DML action relying on prior read.

### F3 — BLOCKER: automatic migration execution violates separate schema approval if v22 is wired normally

**Observed:** `lib/migration-plan.ts` has `DATABASE_SCHEMA_VERSION=21`. `lib/db-optimization.ts` applies pending migration versions in `migrateDatabase()` via `sql.transaction(...)` and `ensureDatabaseOptimizations()`; `lib/runtime-schema.ts` invokes optimization on app schema initialization; existing writer actions also call it. Naïvely bumping version to 22 and shipping it allows app runtime to initiate DDL automatically, bypassing the intended explicit, environment-scoped schema approval.

**Required:** keep v22 out of the auto-applied production migration chain until explicit owner-authorized target separation and rollout; prototype as test-only SQL outside normal runtime wiring. Freeze expand/compatibility/backfill/trigger-enable stages separately. Verify all deployed versions can run against the staged schema. No destructive migration, automatic flags or production change now.

### F4 — HIGH: event UID is not source/issuer authentication

**Observed:** `lib/flight-dedup.ts` fingerprint is heuristic; `lib/backup-authenticity.ts` signs `(backupVersion,sourceUserId,payloadSha256)`, without authenticated source-instance namespace. `lib/account-backup.ts` uses multiple independent `Promise.all` reads, not a common `REPEATABLE READ` snapshot. Locally backfilled event UIDs cannot prove equality to original v13 source rows or distinct database clones.

**Required:** freeze signed v14 issuer/key/rotation and account-continuity rules separately from storage event UID, and include a verifiable membership commitment for every backed-up record and both audit ledgers. Unknown v13 instance or missing issuer proof => `UNAVAILABLE`, no silent match or arbitrary re-sign. New coherent export needs a real snapshot across **all** sections; old signed v13 payload remains immutable.

### F5 — HIGH: Neon HTTP batch semantics and local adapter mismatch

**Observed:** production `lib/db.ts` uses `neon(DATABASE_URL)` + fixed `sql.transaction([...])`; test-only `lib/local-postgres.ts` builds its own local `transaction(queries)` executor with a different type/implementation. A multi-statement fixed-batch transaction *can be proposed*, but isolation mode, lock timeouts, independent concurrent sessions, error rollback, query-result counts and committed-operation reconciliation have not been demonstrated with the **actual Neon HTTP protocol**. Tests using only the local adapter are not parity evidence.

**Required:** specify isolation semantics explicitly for **restore** (separate acquire statement + fresh committed snapshots under `READ COMMITTED` where appropriate), and separately for **consistent v14 export** (`REPEATABLE READ READ ONLY`); verify both against a positively identified isolated endpoint, and inspect driver support for transaction options versus the local adapter. [Neon serverless HTTP transaction docs](https://github.com/neondatabase/serverless/blob/main/CONFIG.md#transaction-function) document non-interactive batches and isolation options; source version compatibility remains to be tested.

### F6 — HIGH: native audit and protected lineage must not be silently rewritten

**Observed:** M0-A-blocked `lib/account-restore-v6.ts` still calculates global audit `MAX(id)`, later executes `DELETE FROM flight_audit_log` and imports original source audit primary IDs; `lib/db-optimization.ts` has native flight-change trigger. The present B1b.2b tests protect against specific collisions only, not B2 native/imported audit semantics.

**Required:** prohibit all native audit deletion/suppress/change/source PK reuse; model imported historical audit separately and append-only with verified source/account/event/membership. Verify full transaction rollback, preserved native events, exact certified revision/hash, independent participant evidence, immutable void/tombstone state, operation idempotency and ambiguous commit reconciliation before any full restore activation.

### F7 — DECISION: performance / product scope

A per-account gate serializes **all** affected writes from that pilot and could increase latency for KML import, large restore and multi-actor shared requests; the first design must compare:
- **A (preferred for a narrow prototype):** DB unique stable event identity/registry and exact per-event reservations + first-statement scoped lock only for affected multi-record/restore writers, preserve unrelated legacy behavior; prove noncooperating ordinary writes cannot misbind source identity. Cross-event shared evidence may still require account-level coordination.
- **B (original #459 proposal):** universal per-account gate for all child writers, but only after exhaustive source coverage, first-lock order and real concurrency/latency evidence; high blast radius.
- **C (fallback):** initial full-account restore only into a proven empty, quiescent identity namespace; *product scope change requiring explicit owner decision*, and still must be atomic against concurrent new writes.

No option is approved here. Failure to prove correctness => full restore remains `UNAVAILABLE` under M0-A.

## Precisely scoped acceptance before executable design

1. Draw two separate session timelines for Edit vs Restore, Trash vs Restore, FSTD vs Restore; verify expected row/account lock order and fresh READ COMMITTED predicate after gate. Prove deadlock cancellation produces no partial writes; test lock timeout behavior independently.
2. Simultaneous unrelated users: confirm no table-level writer lock and normal writes succeed without waiting for Restore.
3. Foreign user and cross-user flight participation/verification: sort all involved user scopes, correct old/new owner lookup, prevent signature/regulatory credit carryover.
4. Same UID/same fingerprint/missing UID/different UID mixed cases; never assume same fingerprint is same flight, nor source numeric ID a stable issuer.
5. Signed v13/v14, cloned instance, unknown issuer, rotated key, snapshot membership tampering, imported/native audit replays; reject ambiguous before mutation.
6. Native trigger audit remains unchanged when an error occurs; imported history append-only; durable pre-restore snapshot, idempotent operation and ambiguous commit reconciliation.
7. Check v22 additive migration rehearsal twice with old code/new schema and new code/old schema, and verify no automatic production migration. Protect existing single-flight Trash and backups.
8. Execute actual multi-session PG16 on locally owned isolated test DB plus separate explicitly owned Neon HTTP test endpoint; current tests `NOT RUN` for B1b.2c.

## Frozen external reviewer packet (send after current PR HEAD verified)

**Repo:** `filipto861/flytally-logbook`; **main SHA** `c9c2f60303236113a223942072311f5e37f876f7`. **Draft PR** #459 against #458. Reviewer must read the exact PR HEAD once frozen plus `docs/maintenance/2026-11-02-m0b-b1b2c-event-identity-concurrency-v22-design.md`, this pre-review, the previous writer inventory, `lib/{db,db-optimization,migration-plan,account-restore-v6,account-backup,backup-authenticity,flight-trash,flight-voiding,flight-dedup}.ts`, `app/(protected)/flights/{actions,shared-actions,certification-actions}.ts`, `app/(protected)/fstd/actions.ts`, PostgreSQL/Neon cited docs and `docs/AI_HANDOFF_TEMPLATE.md`. No secrets, real pilot records or production DB connections.

**Read-only questions (severity first):**
1. Is statement-level prelock plus a registry/UNIQUE invariant sufficient to protect all ordinary and restore writers? Show a specific remaining race or deadlock timeline if not.
2. Which triggers/relations/owners and multi-account paths are missing? Is the current single-row-trigger account gate fundamentally untenable, or can it be corrected without unacceptable blast radius?
3. Does a signed v14 issuer + account continuity + event UID and membership prevent false restoration into unrelated/clone instance and false certification/participant credit? What evidence must be retained?
4. Which Neon HTTP batch/isolation operations are actually compatible, and how should the isolated test adapter parity be proved?
5. Can a non-auto-applied v22 migration and legacy-app compatibility be demonstrated without any remote/prod mutation or auto-migrate surprise?

**Review response contract:** `APPROVE / APPROVE WITH CHANGES / BLOCK`; severity-tagged findings, exact repo path + SHA and observed vs inferred facts, alternatives and testable acceptance, plus any product/owner decision. **Not a merge or prod DB approval**.

## Evidence and next step

This report is **static/source analysis**, not independent second-model validation; no tests, SQL, migration, CI, prod DB or deployment performed for this report. B1b.2b Actions #41520038331 PASS is older exact code/test SHA only. Owner must approve any future substantive product scope change separately.

**ONE NEXT STEP:** perform a single independent read-only DeepSeek/Claude SHA-bound review of this narrowed packet; reconcile verdict, then define the minimal event-reservation/locking test-only DDL and PG16 two-session prototype. Keep M0-A full restore blocked, no merge/deploy/prod DB/flags.
