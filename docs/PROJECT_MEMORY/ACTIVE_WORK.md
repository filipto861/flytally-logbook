# FlyTally Logbook — active work

> Short rolling pointer. [Full historical archive](ACTIVE_WORK_ARCHIVE_PRE_COMPACTION_2026-10-31.md) Git blob `3d0074bb2346da44e1c6d4001a2265d9a8a25fd4`; [ROADMAP](../../ROADMAP.md) is the sole active plan. Updated 2026-10-31T10:00:00Z.

## M0 — active DESIGN work, implementation awaiting owner decision
- Main `807f281e5870164b794d001480ecc84e0b45aea5`; Draft [#451](https://github.com/filipto861/flytally-logbook/pull/451), work `docs/logbook-data1e3-d4-a2-provenance-model-20261030` pre-checkpoint `5cd1e8130ec935f20dc7db69783b772110950ec1`, base Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`. Verify final work head.
- [M0-A proposal](../maintenance/2026-10-31-data1e3-m0-account-restore-safety-containment-proposal.md): temporary server guard **ALL account backup restore v4+** stored/uploaded and exported exact service; UI restore disabled, create/check/download preserved. M0-B/V13-I separately restores functionality later. **NOT IMPLEMENTED OR APPROVED.**
- Current production Vercel READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` SHA `55c8076e1eb8104c14392e15b272b33e0eb29607` retains native audit MAX/DELETE/unchecked INSERT; legacy v4/v5 batch restore non-atomic. Source-confirmed operational risk; real incident unknown. Avoid full account restores pending mitigation.
- V14 Option2, V13-A/V13-I, L1, N2-S, conditional C2, R1 K1/T1/E still DESIGN ONLY; prior V3 and first V7 A BLOCK; second Claude audit NOT RUN by owner choice. No implementation, remote/production DB, schema, flags, keys, erasure, merge/deploy or Training changes.
- Read-only GitHub/Vercel source-check PASS; candidate Node/TS/build/PG16/Neon/browser/smoke NOT RUN; prod DB/schema/flags UNKNOWN. Future M0-A code should branch fresh main outside stacked PRs.

**ONE NEXT STEP:** review [M0-A Draft #452](https://github.com/filipto861/flytally-logbook/pull/452) from main (`aaf5a7f4f3ff0ad963842a2da787ae897b7834c7` code; `81a83914ac2b9481e66fa6a84ad8319812090364` report), complete full-checkout candidate verification. Implementation-only owner approval; 6/6 focused Node24 source tests PASS, typecheck/build/PG16/browser NOT RUN, merge/deploy/DB/flags unapproved and unchanged.
