# FlyTally D4 A2 — targeted N2 + R1 / signed-v14 independent security audit

**READ-ONLY DEEPSEEK / CLAUDE REVIEW. No code, migrations, DB access, flags, merge or deployment.**

## Frozen source and design targets

- Repo: private `filipto861/flytally-logbook`.
- Verified main `807f281e5870164b794d001480ecc84e0b45aea5`.
- **Executable frozen source**: `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1` in stacked Draft PR #449. Do not substitute the main runtime for these files.
- **Design Draft PR #451**, stacked on Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`. Parent design HEAD before this package `8a874a3f7c3488f15fb59cbdc10aa4c79fadaa6b`. **Reviewer must pin the actual final PR #451 head commit SHA after these files are committed**, not assume the parent is the final review candidate.
- Read `docs/maintenance/2026-10-30-data1e3-d4-a2-v14-review-contract-v2.md` completely, alongside v14 V1, signed-v13 policy A, earlier A2-CONTRACT and reviewed independent Option 2 findings.
- Existing independent DeepSeek “APPROVE WITH CHANGES — DESIGN ONLY” covered broader Option 2 before new N2 and R1 detail. That is NOT independent review of this V2.

## Frozen owner choices — design only

Option 2: independent immutable imported ledger; no deletion of native audit. Signed v13 A: different verified backup digests with same source user+audit ID reject, even if event bytes identical. L1: imported history unattached to local flights. **N2**: stable UUID per new native audit event; historical UUID assigned only during migration and clearly distinguished. **R1**: original immutable JSONB/hash, signed snapshot verification at import without redundant whole-source retention or claim of future independent membership proof. These choices do not approve SQL, migration/backfill, exact v14 wire schema, flags, code, merge, or deploy.

## Files to source-verify at exact executable SHA

1. `lib/db-optimization.ts:39-80` (native BIGSERIAL, actor/flight triggers) and `lib/migration-plan.ts:1-27` (v21).
2. `lib/account-backup.ts:15-67` (v13 whole payload, native audit `SELECT *`, 32-query snapshot), `lib/account-backup-snapshot.ts:30-70` (exact slots/probe).
3. `lib/account-backup-presign.ts:32-85` (version===13), `lib/portable-backup.ts:124-145,248-263` (version>=13 fallback).
4. `lib/backup-authenticity.ts:7-20` (no instance proof); `lib/backup-center.ts:13-56` (automatic/manual/pre_restore + pruning).
5. `lib/account-restore-v6.ts:119-155,220-285` (preview, global MAX, DELETE audit, ON CONFLICT skip), `app/(protected)/export/actions.ts:62-108` (restore/safety backup dispatch).
6. `lib/data/flight-audit.ts:8-14` and `app/(protected)/flights/[id]/audit/page.tsx` (native audit vs certified revision record).

**Private repository access:** if the reviewer cannot read these files, mark facts **UNVERIFIED** and request complete exact source excerpts. The V2 document is a proposal, not proof of runtime.

## Review questions

1. N2 stable UID: direct native column versus sidecar UID identity table, write trigger defaults, old `SELECT *` and `json_populate_record` compatibility, historical backfill during concurrent appends, unique/immutable database constraints and rollback.
2. Clone divergence: copied installation identifier and ancestor UIDs; independent subsequent UUIDs; conflicting identical UIDs across tenants/signed snapshots; physical origin not proven.
3. R1 evidence: accurate signature-verification-at-import versus independently reproducible per-event membership proof, key rotation/source deletion, canonical JSON/JSONB hashing and privacy caps.
4. v14 completeness: native+imported ledgers, L1 required `imported_event_flight_links: []`, lineage claims, exact 30+3+2=35 MVCC slots as proposed, signature, array counts and all export/manual/automatic/pre_restore/stored paths.
5. Atomic safety: owner auth, v13 different-digest A conflict, two writers, signed v14 native/imported roundtrip, all trigger events preserved, no MAX/DELETE/unchecked ON CONFLICT; Neon HTTP fixed-batch semantics.
6. Phased release: which missing schema/flag states must block; least dangerous migration/backup/restore order; legacy v5-v13 signature and certification/void/GPS data preserved; smallest local PG16 and provider parity test inventory.

## Answer requirements

Return **APPROVE / APPROVE WITH CHANGES / BLOCK — DESIGN ONLY**. Number findings by severity P0/P1/P2, distinguish **source-confirmed old behavior** from **future design risk**; for each provide exact SHA/path/line or UNVERIFIED, failure mechanism, smallest safe adjustment, reproducible acceptance test, and any further owner decision. State whether N2 direct column remains viable versus sidecar; state what R1 cannot independently verify; identify irreversible risks and hard blockers. Provide one minimal ordered implementation plan only as advice, not applied change.

**All new v14/A2 PG16, Neon HTTP, Node/TS/build/Playwright tests NOT RUN.** Production `fly-tally.com` READY on earlier SHA `55c8076e1eb8104c14392e15b272b33e0eb29607`; prod DB/schema/flags UNKNOWN.

Return full Markdown report for lead to reconcile. Never edit repo or access private user flight/GPS data or credentials.
