# M0-B V22 expand-only first implementation candidate — SHA-bound checkpoint

**UTC:** 2026-11-04T08:37:51.702Z. **Repo:** `filipto861/flytally-logbook`. **Canonical main:** `c9c2f60303236113a223942072311f5e37f876f7`. **Work:** `feat/logbook-m0b-v22-expand-candidate-20261104`, stacked Draft [#469](https://github.com/filipto861/flytally-logbook/pull/469), base Draft #468 `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`; ancestors #467→#455; separate B0 #454. **Executable candidate SHA:** `35c70cc09f0cbbf00f36a90e83e120c4eed54107` with exact SHA-1 blobs below; **work HEAD before this documentation commit:** `372a373778ae58a157b60d1575dca72d5d043cf8`. Verify final pushed HEAD after this checkpoint.

## Changed files / scope

- `tooling/sql/m0b-v22-expand-candidate.sql` — local-only passively additive SQL, intentionally unregistered, guards database `flytally_m0b_disposable_*`, current_user `flytally`, server address `127.0.0.1`, PostgreSQL16, required source schema and no existing UID/registry. Adds 3 nullable event UID columns and passive owner/kind/UID registry, constrained marker shape, scoped active/FSTD and nonunique Trash index. No event UID generation, historical backfill, trigger, direct DELETE writer change, schema version change or retention default.
- `tooling/sql/m0b-v22-expand-candidate.test.mjs` — 10 static source guard tests.
- `docs/maintenance/2026-11-04-m0b-v22-expand-first-batch.md` — PR #454–469 consolidation, accepted and missing gates; this checkpoint; `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/SESSION_HANDOFF.md` and `ACTIVE_WORK.md` updated. FEATURES and CHANGELOG reviewed: **not changed** (no feature shipped).

Owner requested to continue from prior accepted plan and move into V22 implementation. This permission covers **scoped, un-applied work branch prototype only**, not migration/merge/deploy/remote DB. DeepSeek review previously rejected. Full-account Restore remains M0-A fail-closed.

## Evidence by exact source / environment

| Gate | Verdict |
| --- | --- |
| `node --check /tmp/flytally-v22/m0b-v22-expand-candidate.test.mjs` | **PASS**, Node v22.16.0, local |
| `node --test /tmp/flytally-v22/m0b-v22-expand-candidate.test.mjs` | **10/10 PASS**, source-only guard, Node v22.16.0 |
| Byte identity local tested source vs GitHub | **PASS** independent Git blob SHA-1 match: SQL `4eb5035aa9d384a90a87ed7426c40ac2faae4910`; test `ff757abc63547c2265f6206a88725f4a1275f855`, executable SHA `35c70cc09f0cbbf00f36a90e83e120c4eed54107` |
| Early candidate source diagnostic | One initial test FAIL from overbroad regex (incorrectly rejected registry UUID NOT NULL); test fixed, 10/10 final PASS. One GitHub edit with `String.replace` replacement `$'` corrupted SQL; corrected from verified previous blob using function replacer, final hash matched |
| Real disposable local PostgreSQL16 schema DDL, legacy compatibility, catalog and rollback | **NOT RUN** — container has no `psql/postgres/docker`; static tests are not SQL execution |
| Exact Node24 CI, full TS/build, native Windows PG16 164/164, browser/risk | **NOT RUN** |
| App-user/cron identity, real `@neondatabase/serverless` HTTP 2-client / locks, V14/B2 | **NOT RUN**; earlier synthetic PG16 and read-only Neon connector results remain separate dated evidence |
| Production Vercel | **READY** `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` app `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; production DB/schema/flags **UNKNOWN**, authenticated smoke NOT RUN |
| Isolated Neon scratch | New project `blue-haze-29352938` remains independent but **no SQL executed for this milestone** |

## Risks / DO NOT

Still must coordinate both direct expired `deleted_flights` DELETE paths before strict V22 enforcement; preserve active UID for already restored history, avoid issuer inference for old NULL and avoid global maintenance rights on shared SQL credential. Proposed +12 months from stored archive cutoff is **working owner option A**, not reviewed legal/privacy retention. Certified void/signed revisions/other participants and incomplete account erasure have separate policies. No automatic V22 registration, runtime feature flag, production/remote Neon SQL, migration, restore/delete, merge, deploy, Training changes or DeepSeek.

**ONE NEXT STEP:** on a positively owner-verified **local loopback PostgreSQL16** fixture, execute exact SQL and test negative target/schema failures, legacy NULL rows, duplicate active UID, historical restored-archive coexistence and atomic rollback. Only then design the dual-writer service behind OFF, without enabling production.
