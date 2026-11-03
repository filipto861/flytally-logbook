# M0-B B1b.2c — isolated PostgreSQL16 transaction-protocol proof checkpoint

**UTC checkpoint:** 2026-11-03T06:51:28.205Z. **Repository:** `filipto861/flytally-logbook`. Verified canonical `main@c9c2f60303236113a223942072311f5e37f876f7`. New test branch `test/logbook-m0b-b1b2c-lock-proof-20261103` on Draft **PR #460**, base Draft **PR #459@a4db663322475dcd090cdbe877130115c50f1575**; stacked ancestors #458→#457→#456→#455. B0 #454 is a separate unmerged design. **Exact executable source/test SHA:** `96e0e6a4d70dc96a83c4ea0d32ff9241beae22bd`. GitHub Actions [#41592224174](https://github.com/filipto861/flytally-logbook/actions/runs/41592224174) on that SHA **PASS**, 2026-11-03T06:49Z. Final doc/work SHA must be reverified after checkpoint and workflow removal; do not transfer execution evidence to changed code.

## Owner decision and scope

User explicitly approved continuing M0-B **without DeepSeek review**. No external second-AI reviewer invoked. The diagnostic deliberately does not implement application Restore, production schema V22, signing V14, export, UI, authorization or runtime writer changes. Runtime `lib/account-restore-containment.ts` remains on M0-A and still throws before complete restore. No merge/deploy, production DB, schema/migration/restore/delete or production feature flags; no changes to `flytally-training`. Test-only diagnostic artifacts:

- `tooling/m0b-b1b2c-concurrency-probe.mjs` — opt-in, purpose-bound synthetic PostgreSQL16 two/three-session experiment; creates/drops only a randomized private schema.
- `tooling/m0b-b1b2c-concurrency-probe.test.mjs` — seven fail-closed target preflight tests (remote host/unknown DB/port/URL overrides/flag rejected).
- Temporary `.github/workflows/m0b-b1b2c-lock-diagnostic.yml` — branch-only ephemeral PostgreSQL16 service and Node24, contents:read, no application secrets. Workflow is removable after evidence capture, preserving source/test SHA.
- This checkpoint, ROADMAP/ARCHITECTURE/Project Memory adjustments.

This is a stand-alone **DIAGNOSTIC**, not a member of the 42-file/164-case canonical PostgreSQL hash-pinned release registry and not a production or release acceptance gate.

## Exact CI evidence

| Gate / observed result | Status | Evidence |
| --- | --- | --- |
| Node24 `node --check` script | **PASS** | Actions #41592224174 @ `96e0e6a4…` |
| Node24 `node --test tooling/m0b-b1b2c-concurrency-probe.test.mjs` | **7/7 PASS** | Same run/SHA |
| Isolated PG16 **16.15** diagnostic two-session reverse lock order | **PASS** | Exact PostgreSQL server logs show `deadlock detected` (SQLSTATE behavior); model intentionally triggers deadlock, identifies and rolls back victim |
| Separate first-statement account lock, fresh subsequent read after earlier commit, unrelated user writes | **PASS** | Actual independent PG sessions; single user serializes without whole-table lock |
| Uncooperative concurrent duplicate `(user_id,kind,event_uid)` insert | **PASS** | Actual PostgreSQL UNIQUE rejection, exactly one surviving event |
| Duplicate heuristic fingerprint permitted, null UID blocked, user-scoped UID | **PASS** | Actual PostgreSQL constraint checks |
| Synthetic schema cleanup | **PASS** | Diagnostic reports own schema cleaned; no target outside disposable container |
| Native owner Windows six-cluster PG16 164/164, full Node/typecheck/build, release risk, authenticated browser | **NOT RUN** for this prototype | No application/runtime modification; earlier candidates' evidence is not transferred |
| Isolated **real Neon HTTP** transaction parity, audit/native/imported history, signed V14 consistency, complete writer/child graph | **NOT RUN** | These remain separate design/acceptance blockers |
| Production DB/schema/flags and authenticated production smoke | **UNKNOWN / NOT RUN** | No production DB access or authenticated smoke |

**Earlier failed attempts retained, not masked:** Actions [#41592031914](https://github.com/filipto861/flytally-logbook/actions/runs/41592031914) @ `c02b504c01e80cb829c9a2a9e99ae38ad3505618` failed because the PostgreSQL Docker service reports an internal bridge address, not host 127.0.0.1. Actions [#41592178136](https://github.com/filipto861/flytally-logbook/actions/runs/41592178136) @ `8f198520a2b862c3ad3b6792d7f787a4a5230679` failed after a wrongly escaped bridge-regex correction. Both had seven preflight tests PASS; repaired source SHA `96e0e6a4…` passed all tests. Explicit URL remains **127.0.0.1 only**; CI Docker-private backend exception gated by `CI=true`, plus required DB name, user and PG16 version.

## Architecture implications

**Confirmed only in synthetic schema:**

1. A BEFORE ROW account gate can acquire its row lock **after** the ordinary operation has held a parent flight row; restoring account-gate-first creates a reproducible lock inversion and deadlock. **Reject universal trigger-only locking as a proven final strategy.**
2. Explicit account-row prelock as the **first transaction statement**, then fresh READ COMMITTED SQL statements, safely serialized same-account writes in this fixture while an unrelated account still completed.
3. PostgreSQL DB UNIQUE `(user_id,kind,event_uid)` rejects a noncooperating concurrent duplicate; an advisory lock alone would not. The heuristic fingerprint must not be unique; two legitimate distinct UIDs may have identical fingerprints.
4. None of the above proves cross-lifecycle native/void/Trash identity, import, protected child completeness, multi-account signing, actual production writer lock order, or Neon HTTP behavior. Those remain BLOCKED/UNKNOWN until separate acceptance. A controlled per-account lock also imposes throughput/latency trade-offs.

**Risk / DO NOT:** do not promote the test schema to `lib/migration-plan.ts` V22 (auto-applied by current runtime), do not copy trigger-only proof into Restore, do not enable full-account restore, do not infer all ordinary flight writers cooperate, do not assume cryptographic issuer/account continuity from a numeric source ID or event UID, and do not treat signed V13 as coherent repeatable-read snapshot.

**Provider evidence:** read-only Vercel inspection on 2026-11-03 confirms M0-A deployment `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` **READY**, application SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, `fly-tally.com` alias. Not a production authenticated smoke. DB/schema/flags UNKNOWN.

## One next step

**Map complete DML writer/owner/lock-order coverage for flights/FSTD/Trash/void/shared/protected children, and define minimal test-only v22 event-identity constraints with explicit ordering and legacy compatibility — still no application migration or restore activation.** The owner does not want DeepSeek review; continue with source-backed engineering/tests only.
