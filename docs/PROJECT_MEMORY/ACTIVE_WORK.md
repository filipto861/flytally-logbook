# FlyTally Logbook — active work

## 2026-10-29T18:28:31.043Z — DATA-1 coherent account backup design (review gate)

- New [Draft PR #433](https://github.com/filipto861/flytally-logbook/pull/433) from main `807f281e5870164b794d001480ecc84e0b45aea5` on `docs/logbook-data1-snapshot-design-20261029`, pre-checkpoint `03e58fbe20d54fcbc5303a6c91c934ac99fdc31c`; standalone DATA-1 scope, independent from open SEC-1 Draft #432. Design proposal in `docs/maintenance/2026-10-29-data1-backup-snapshot-design.md` details single PG REPEATABLE READ/READ ONLY snapshot, local adapter enforcement, v13 compatibility, fail-closed size constraints. DATA-1 code NOT IMPLEMENTED; independent review PENDING. Tests/typecheck/build/PG/browser/CI **NOT RUN by owner request**. No merge/deploy/DB/flags/Training.
- **ONE NEXT STEP:** independent read-only source/SHA-bound review of DATA-1 design, then minimal implementation batch.


Current owner decisions live in [ROADMAP](../../ROADMAP.md). [Archived prior ledger](ACTIVE_WORK_ARCHIVE_2026-10-29.md) and [manifest](ARCHIVE_MANIFEST_2026-10-29.md) preserve previous checkpoints.

## 2026-10-29 — documentation reset

- GitHub `main@eb98982d9ce7cb166c32ba77c9262683989570f8`; all 33 previously open Draft PRs closed without merge. Owner intentionally deleted their original branches; remote-head check found none of the 33 names. [Inventory](../maintenance/2026-10-29-pr-closure-inventory.md) pins historical names and head SHAs. Current open PR count: zero at verification.
- Work branch `docs/logbook-main-documentation-reset-20261029` consolidates documentation navigation, memory archives and present-state pointers. No runtime/Training/DB/flag/deploy changes.
- Documentation checker: 3 pre-existing unresolved missing targets, 7 path fixes; checker tests 6/6 PASS; production DB and flags UNKNOWN. Historical test outcomes remain at their source SHAs.
- **Next action:** owner reviews documentation cleanup before any merge or new product milestone.
