# 14 October 2026 — Unintended Neon snapshot restore production-branch switch

## Owner resolution and follow-up validation (14 October, later same day)

The owner **explicitly approved retaining `br-raspy-fog-b1btvu5t` as canonical production**. No automatic branch reversal, snapshot restore or infrastructure deletion is authorized or planned. Read-only recheck: Neon default/primary still `br-raspy-fog-b1btvu5t` and its `ep-proud-bar-b1ts6cq1` compute hostname matches Vercel production `DATABASE_URL`; database path is `neondb`. Both branches remain identical for table row counts and content fingerprints across **52/52** public tables at this later check. Vercel production READY deployment and GitHub main remain `dcc8ebbf`. Log query found no error/fatal entries in the available four-hour production Vercel runtime window, but cannot prove uninterrupted availability. All v21 fields/constraints remain absent; registry 1–20 only. The unwanted topology change has a recorded owner decision and no observed row drift, while its operational incident history and follow-up remain documented. Controlled v21 release still blocked until approved execution-grade schema-first migration and fresh acceptance. Proposed contract: `docs/product/3_8_0_V21_EXACT_PRODUCTION_MIGRATION_PLAN_2026-10-14.md`.

**State: incident OPEN. Release STOP. No v21 migration, Git merge, or production deploy executed.**

## Trigger and scope

During the approved controlled-release recovery readiness work for FlyTally **Logbook** currency 3.8.0, a manual Neon snapshot was created from the prior primary `br-dark-math-b1snjzub` in project `muddy-dust-14049657`. Snapshot ID: `snap-proud-fire-b1bm8oac`, timestamp 2026-10-14 13:43:33 UTC, name `flytally-logbook-3-8-pre-v21-2026-10-14`.

The subsequent `restore_snapshot` request was incorrectly sent with `finalize:true` and without a `target_branch_id`, intending an independent restore proof. The Neon API **performed a production branch swap** instead. This was **not intended or a separately approved topology change**. Immediately after discovery the release was stopped, and no automatic reversal or further production SQL writes were performed.

After the call at approximately 13:43:53 UTC:

- New primary/default branch named `production`: `br-raspy-fog-b1btvu5t`, restored from snapshot.
- Former primary `br-dark-math-b1snjzub` remains present, was renamed `ft-380-pre-v21-restore-proof-20261014 (1)`, and is **not** the current default.
- Production Vercel `logbook` encrypted `DATABASE_URL` hostname (verified without exposing credentials): `ep-proud-bar-b1ts6cq1.c-5.eu-central-1.aws.neon.tech`. Neon compute listing confirms this host was reassigned to the **new restored production branch**. The former branch has a separate new compute `ep-sweet-hall-b1lqv1k4.c-5.eu-central-1.aws.neon.tech`.
- Vercel production application remains the old `main` code SHA `dcc8ebbfda0eadfa01345cd875ef1db806a19e26`. No new deploy.

## Read-only content verification after the switch

A catalog query enumerated **52 public tables** on the former branch. Each table's row count and a deterministic row-content fingerprint were computed on **both** branches using an aggregate of per-row MD5 values sorted by row digest, without exporting private row values. All **52/52** had identical counts and content fingerprints at the time of comparison; **0 differences observed**. This includes user sessions, users, financial data, flights, protected certified revisions, void archives, provenance and account backups.

Independent count results from both branches: `flights=315`, `rates=33`, `aircraft=25`, `deleted_flights=8`, `account_backups=24`, `flight_expenses=0`, `voided_certified_flights=3`, `flight_source_provenance=12`. Schema registry `1..20` unchanged on both.

**Evidence limit:** table snapshots matching at one instant do not prove service availability throughout the swap or guarantee no future divergence from live user writes. The restore action did change Neon branch/default topology and compute assignment; this is not a harmless read-only operation.

## Mitigation / follow-up approval gate

1. **Freeze Currency 3.8.0 production migration and deployment** while this incident remains open. Do not run any v21 SQL against either branch, do not switch branch names/defaults or compute assignment automatically.
2. **Leave both branches and original manual snapshot intact** until the owner makes the infrastructure decision. Do not delete the former production branch or snapshot.
3. Ask the owner to approve the **current restored branch as canonical production** (`br-raspy-fog-b1btvu5t`) or request a separately scoped and explicitly consented recovery of the original branch identity after verifying post-switch writes. Merely changing the default branch flag is not an adequate rollback because the Vercel DB compute hostname is attached to the restored branch.
4. Once the owner chooses: repeat fresh read-only branch/host verification, live table counts/hashes as applicable, and verify operational health. Review branch IDs in runbooks, backups and release tooling. Do not infer one production target from an old branch name/id.
5. Only then resume the single controlled v21 release, with an execution-grade migration artifact, runtime registry coordination, backup/recovery evidence and separate preflight.

**Accepted source acceptance remains valid** for unchanged application code SHA `0192570a240dc3473b6dea15c7908a15e7ee16d8`: local TypeScript, 6 static SQL, 9 PostgreSQL16 integration, 1544 Node, Next build, 8 authenticated browser PASSED. This incident is **production environment governance**, not a source-code test failure.
