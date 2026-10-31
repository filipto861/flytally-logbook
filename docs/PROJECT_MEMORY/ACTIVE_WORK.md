# FlyTally Logbook — active work

> Short state pointer, updated 2026-10-31T09:58:49.802Z UTC. [Unchanged pre-compaction active-work archive](ACTIVE_WORK_ARCHIVE_PRE_COMPACTION_2026-10-31.md), original Git blob `3d0074bb2346da44e1c6d4001a2265d9a8a25fd4`. Earlier history remains in [2026-10-29 active-work archive](ACTIVE_WORK_ARCHIVE_2026-10-29.md). For active priorities use [ROADMAP](../../ROADMAP.md), not old archived statuses.

## Current scope
- **Docs-only milestone:** compact ROADMAP and rolling memory, preserve full original bytes in immutable dated archives. Branch `docs/logbook-data1e3-d4-a2-provenance-model-20261030`, Draft [#451](https://github.com/filipto861/flytally-logbook/pull/451) base Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`, pre-memory HEAD `870cb3a542674b72cd3c24e904e2e15edbb8494e`; verify final HEAD before handoff. Canonical main `807f281e5870164b794d001480ecc84e0b45aea5`.
- **Main V14 status:** approved **DESIGN ONLY** Option 2, signed v13 A/V13-I, L1, N2-S, conditional C2, R1 K1/T1/E. Frozen executable `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1`, V7 design `f8f3dc07edce42357a0871599d054c9b5e44f146`, previous V3 + independent Review A **BLOCK**. Second Claude audit waived for now, **NOT RUN**.
- **P0 operational risk:** production-reachable full account restore can delete native audit evidence; source confirmed at Vercel production SHA `55c8076e1eb8104c14392e15b272b33e0eb29607`, no actual incident proven. Avoid production full account restore pending separately approved mitigation.
- **Evidence:** GitHub archive Git blob equalities checked; docs-only changes. Node, TypeScript, build, real PG16/Neon, browser, prod authenticated smoke **NOT RUN**. Production DB/schema/flags **UNKNOWN**. No code, DB, migrations, keys, erasure, flags, merge, deploy or Training changes.
- **Product backlog:** N3 Manual/GPS simplification and future 3.9/3.10 remain distinct from DATA-1; no implicit reprioritisation or implementation consent.

**ONE NEXT STEP:** Present bounded M0 native-audit restore safety remediation **design** and acceptance tests to owner; implement nothing until separately approved. Update this rolling pointer in place on the next checkpoint.
