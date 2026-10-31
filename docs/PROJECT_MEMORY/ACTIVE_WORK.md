# FlyTally Logbook — active work

> Short rolling pointer. [Full historical archive](ACTIVE_WORK_ARCHIVE_PRE_COMPACTION_2026-10-31.md) Git blob `3d0074bb2346da44e1c6d4001a2265d9a8a25fd4`; [ROADMAP](../../ROADMAP.md) is the sole active plan. Updated 2026-10-31T10:00:00Z.

## M0-A — implemented in isolated Draft #452, release acceptance pending
- Main `807f281e5870164b794d001480ecc84e0b45aea5`; Draft [#451](https://github.com/filipto861/flytally-logbook/pull/451), work `docs/logbook-data1e3-d4-a2-provenance-model-20261030` pre-checkpoint `5cd1e8130ec935f20dc7db69783b772110950ec1`, base Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`. Verify final work head.
- [M0-A proposal](../maintenance/2026-10-31-data1e3-m0-account-restore-safety-containment-proposal.md): temporary server guard **ALL account backup restore v4+** stored/uploaded and exported exact service; UI restore disabled, create/check/download preserved. M0-B/V13-I separately restores functionality later. **IMPLEMENTED WITH OWNER APPROVAL ON DRAFT #452 ONLY, NOT MERGED/DEPLOYED.**
- Current production Vercel READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` SHA `55c8076e1eb8104c14392e15b272b33e0eb29607` retains native audit MAX/DELETE/unchecked INSERT; legacy v4/v5 batch restore non-atomic. Source-confirmed operational risk; real incident unknown. Avoid full account restores pending mitigation.
- V14 Option2, V13-A/V13-I, L1, N2-S, conditional C2, R1 K1/T1/E still DESIGN ONLY; prior V3 and first V7 A BLOCK; second Claude audit NOT RUN by owner choice. No implementation, remote/production DB, schema, flags, keys, erasure, merge/deploy or Training changes.
- Isolated full-checkout and loopback PG16 source verification: Node24 1770/1770, typecheck, build, authenticated Chromium browser 8/8 PASS. PostgreSQL 132 PASS / 0 FAIL / 32 SKIP = PARTIAL, `verify:release:risk` FAIL, release BLOCKED. Native Safari/Neon HTTP/prod smoke NOT RUN; prod DB/schema/flags UNKNOWN. See standalone Draft #452 technical checkpoint.

**ONE NEXT STEP:** complete 32 skipped protected PostgreSQL tests using repo-approved Windows six-fresh-PG16 partition executor at [M0-A Draft #452](https://github.com/filipto861/flytally-logbook/pull/452) tested SHA `440c965d1270e1f31dbe9e94d42af0cf4819de3a` and rerun exact release gate. No merge/deploy/DB/flags authority.
