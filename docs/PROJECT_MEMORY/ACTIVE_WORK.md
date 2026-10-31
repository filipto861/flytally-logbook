# FlyTally Logbook — active work

> Rolling pointer to [ROADMAP](../../ROADMAP.md). Prior main history is in [archive](ACTIVE_WORK_ARCHIVE_2026-10-29.md), with [manifest](ARCHIVE_MANIFEST_2026-10-29.md).

**M0-A — IMPLEMENTED in isolated [Draft PR #452](https://github.com/filipto861/flytally-logbook/pull/452), RELEASE BLOCKED.** Tested code SHA `440c965d1270e1f31dbe9e94d42af0cf4819de3a`, main base `807f281e5870164b794d001480ecc84e0b45aea5`. Current doc checkpoint HEAD should be independently verified.

Node24 full tests **1770/1770 PASS**, typecheck and build PASS, authenticated risk browser **8/8 PASS** (Chromium desktop/mobile emulation). Native isolated PG16.15 in disposable localhost DB: **132 PASS / 0 FAIL / 32 SKIP**, PostgreSQL gate PARTIAL and `verify:release:risk` **FAIL**. [Evidence](../maintenance/2026-10-31-m0a-full-account-restore-containment-checkpoint.md). **New 2026-10-31 Linux diagnostic: 164/164 strict-TAP PASS** across six physically separate disposable PG16.15 loopback clusters (sandbox `sbx_s85J4UT8iq7XkS9xTFj0zGYI56WM`, exact pre-doc HEAD `d81dfcd95342d87fd224d395ab372cf76a859f78`). These are **VALIDATED-ONLY**, not canonical release PASS. Full owner-local **Windows** six-partition PG16 release acceptance and exact-candidate browser risk still pending. Detailed TAP hashes in checkpoint. No merge/deploy/production DB/flags/keys or Training changes. Production retains old full restore risk. Frozen DATA-1 M1–M3 decisions and the six Engineering & Security backlog IDs remain independent, not new authorization.

**ONE NEXT STEP:** execute existing approved Windows six-partition owned PG16 canonical verifier on fetched PR HEAD, then complete exact-candidate browser/risk release acceptance; separate owner merge/deploy decision only after real PASS.
