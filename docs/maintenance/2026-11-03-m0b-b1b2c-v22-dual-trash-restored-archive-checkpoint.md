# M0-B B1b.2c — Dual Trash writer and restored-archive source/test checkpoint

**UTC:** 2026-11-03T08:04:05.457Z. **Repo:** `filipto861/flytally-logbook`, verified GitHub `main@c9c2f60303236113a223942072311f5e37f876f7`. **Work:** `test/logbook-m0b-b1b2c-v22-trash-writer-gate-20261103`, Draft **PR #464** base `test/logbook-m0b-b1b2c-retention-a-window-20261103@f13e89515cdafd697c00dbb16dd981670bb22f0d` (Draft #463), ancestors #462→#455, B0 #454 separately. **Tested executable SHA:** `e40588df02c992adb0c6dffeea137d78c3ea8129`; checkpoint docs commit/full work HEAD must be verified separately after push; only Markdown and removal of temporary workflow are permitted post-test differences. Tests never transfer to different executable code.

## Owner scope and files

Owner approved retention **A as a design direction** (existing ~90-day Trash + working 12 calendar months for minimal owner UID marker after stored cutoff); the retention basis/account-erasure exceptions are not legally cleared. Owner **declined DeepSeek review**; none performed. This milestone inspects only existing source and commits test-only and docs: `tooling/m0b-b1b2c-trash-writer-gate-probe.mjs`, `docs/maintenance/2026-11-03-m0b-b1b2c-v22-schema-first-dual-trash-writer-contract.md`, this checkpoint, `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/{SESSION_HANDOFF,ACTIVE_WORK}.md`. Temporary test workflow `.github/workflows/m0b-b1b2c-trash-writer-gate.yml` created solely to execute isolated CI, then **removed**. FEATURES/CHANGELOG reviewed, no shipped feature to record. No app runtime, real schema, V22 migration, Restore or production SQL changes.

## Exact test ledger

| Gate | Verdict / evidence |
| --- | --- |
| Node24 `node --check tooling/m0b-b1b2c-trash-writer-gate-probe.mjs` | **PASS** [Actions #41600027200](https://github.com/filipto861/flytally-logbook/actions/runs/41600027200), exact `e40588df02c992adb0c6dffeea137d78c3ea8129` |
| `node --test tooling/m0b-b1b2c-concurrency-probe.test.mjs` | **7/7 PASS**, same run/source SHA |
| Disposable loopback Docker PostgreSQL **16.15** synthetic schema, owner-gate first and two modeled callers | **8/8 PASS**, same run/source SHA, random schema removed |
| Restored archive still present before cutoff, but its active UID preserved after expired archive deletion | **PASS**, source-shaped synthetic fixture; distinguishes recovered archive from pending Trash |
| Direct old DELETE would leave pending Trash without registry | **REJECTED** in deferred synthetic fixture |
| Owner list cleanup and independent owner-sorted sweep share per-owner procedure | **PASS** test-only; real routes/auth not exercised |
| Existing marker rejects UID replay until expiry; missing account gate aborts; legacy NULL UID safe cleanup | **PASS** synthetic |
| Full Node/TS/build, owner-native Windows PG16 164/164, real physical DB role privileges/FKs, Neon HTTP parity, Playwright/risk, native/imported audit B2 and signed V14 issuer | **NOT RUN** |
| Production authenticated smoke / production DB/catalog/flags | **NOT RUN / UNKNOWN** |
| No DeepSeek | **N/A by explicit owner instruction** |

## Source-based risks and DO NOT

1. **New verified source nuance:** `lib/flight-trash.ts` updates `deleted_flights.restored_at/restored_flight_id` but retains restored archival row; its expiration must not change active event identity to `purged`. Both user Trash listing and privacy retention sweep currently DELETE expired rows directly. A strict trigger installed before both writers are modified will break existing behavior. No real writer changed here.
2. `lib/privacy-account.ts:eraseAccountForPrivacy` deactivates/anonymizes user and removes related sensitive data but **does not DELETE active flights or FSTD sessions** in inspected statements. Regulatory/history/erasure and UID treatment require independent assessment; do not claim all flight records erased.
3. Source owner FKs non-uniform; model only demonstrates synthetic owner gate, **not actual server authorization nor Neon HTTP concurrency**. App DB SQL principal may have broader permissions. V22 runtime migration must **not** be automatically registered in `lib/migration-plan.ts` (current version 21) or applied from `ensureDatabaseOptimizations` without explicit authorized schema-first target verification.
4. Production M0-A Vercel deployment `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` READY at app SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, `fly-tally.com`; production DB/schema/flags **UNKNOWN**. Full-account Restore continues fail-closed.
5. **DO NOT:** merge, deploy, run production/remote DB SQL/migration/restore/delete, change production flags, activate full Restore, rewrite native audit/certification, extend personal-data retention without lawful basis, touch Training or request DeepSeek.

**ONE NEXT STEP:** build an isolated, actual-schema-equivalent PostgreSQL16 acceptance fixture for BOTH authenticated-owner and authorized sweep entrypoints, real nonuniform owner FKs and least-privilege roles; do not promote V22 to deployable schema until independent legal/privacy gate and Neon HTTP parity are verified.
