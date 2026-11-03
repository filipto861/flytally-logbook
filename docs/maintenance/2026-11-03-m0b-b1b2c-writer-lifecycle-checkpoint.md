# M0-B B1b.2c — writer/owner topology and disposable PG16 lifecycle proof checkpoint

**UTC:** 2026-11-03T07:12:09.544Z. **Repo:** `filipto861/flytally-logbook`. **GitHub main verified:** `c9c2f60303236113a223942072311f5e37f876f7`. **Work:** `docs/logbook-m0b-b1b2c-writer-topology-20261103`, Draft **PR #461** base `test/logbook-m0b-b1b2c-lock-proof-20261103@8d783f4b7a80d9b8c67987e2ca68558ceb1750aa` (Draft #460), stacked #459→#458→#457→#456→#455, B0 Draft #454 separate. **Tested executable SHA:** `d5d14a21e042de1ce2af706ae9cb9f22e8b43f3b`; documentation commit/head after this checkpoint must be independently verified. No merge.

## Owner scope and files

User directed continuation with **no DeepSeek review**, respected. Scope: source-audited writer/owner map, test-only PostgreSQL16 lifecycle schema and negative guards, documentation. Affected new: `docs/maintenance/2026-11-03-m0b-b1b2c-writer-owner-lock-topology.md`, `tooling/m0b-b1b2c-lifecycle-probe.mjs`, this checkpoint. Temporary branch-only `.github/workflows/m0b-b1b2c-lifecycle-diagnostic.yml` installed solely for isolated CI and removed after PASS. Updated `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/{SESSION_HANDOFF,ACTIVE_WORK}.md`. `FEATURES.md`, `CHANGELOG.md` reviewed: no shipped capabilities, no changelog release. No application runtime/schema/migration code changed.

## Evidence for exact source SHA

| Gate | Result | Authority |
| --- | --- | --- |
| `node --check tooling/m0b-b1b2c-lifecycle-probe.mjs` under Node24 | **PASS** | [Actions #41594393542](https://github.com/filipto861/flytally-logbook/actions/runs/41594393542) @ `d5d14a21e042de1ce2af706ae9cb9f22e8b43f3b` |
| `node --test tooling/m0b-b1b2c-concurrency-probe.test.mjs` | **7/7 PASS** | Same run/source SHA |
| Disposable real PostgreSQL **16.15**, synthetic registry/child FKs, deferred lifecycle triggers | **7/7 PASS** | Same run/source SHA; random test schema created and removed |
| Incomplete state transition, untracked Trash purge, void resurrection, foreign owner, duplicate/missing UID | **Correctly REJECTED** | Same isolated run/PG server logs |
| Native app owner Windows six-PG16 164/164, full Node, TypeScript/build, browser/risk | **NOT RUN** | No app runtime/schema changes, not release candidate |
| Actual Neon HTTP multi-statement parity; v14 coherent source/account signer; B2 audit migration; production authenticated smoke | **NOT RUN / UNKNOWN** | Not exercised; future separate acceptance |
| Independent DeepSeek/Claude review | **N/A — owner declined** | Explicit owner decision |
| Read-only production Vercel deployment metadata | **READY** | `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` app SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, alias `fly-tally.com` |
| Production DB/schema/flags | **UNKNOWN** | No access/queries against production DB |

Prior PR #460 [Actions #41592224174](https://github.com/filipto861/flytally-logbook/actions/runs/41592224174) synthetic lock-order 4/4 PASS attaches only to its distinct source SHA `96e0e6a4d70dc96a83c4ea0d32ff9241beae22bd`; not transferable to real app writer paths. No claim of V22 release acceptance.

## Findings, blockers, DO NOT

- Source map expands earlier incomplete writer inventory to include bulk airport-code flight rewrites, GPS-derived flight clock updates, signed cross-account instructor/participant workflows, shared materialization/provenance, Trash retention, privacy account erase, schema initialization migrations and dormant legacy restore. Still **SOURCE AUDIT ONLY**; SQL-generated/DB-catalog triggers and privileges not fully verified.
- Test-only registry proves scoped immutable UID + one Active/Trash/Void state can be enforced on a disposable schema; it **does not** prove compatibility with real flight/FSTD tables/children, legacy JSON Trash snapshots, existing void provenance or native audit. Source issuer/account identity and v13 origin remain unverified.
- **Retention blocker:** existing `runPrivacyRetentionSweep()` deletes expired Trash after ~90 days; strict test registry requires archived row until a separately defined purge/tombstone policy. GDPR-style erasure can't silently keep private data indefinitely. Needs owner/policy freeze before migration.
- Original trigger-only account gate remains on HOLD after proven inverted-order deadlock; no global table locks or restore-only advisory changes accepted. Actual Neon HTTP batching and source V14 signed snapshot parity UNKNOWN.
- **DO NOT:** merge, deploy, execute any remote/production DB DDL/DML/migration/restore/delete, change production feature flags, activate full-account Restore, rewrite native audit or modify Training. Test target was disposable CI loopback-only PostgreSQL16 with synthetic data.

**ONE NEXT STEP:** reconcile real existing flight/FSTD owner FKs and legacy Trash/void relationships against the synthetic event registry, define explicit retention/erasure-safe lifecycle state before any deployable V22 DDL; then narrow isolated PG16/Neon parity acceptance. No DeepSeek review.
