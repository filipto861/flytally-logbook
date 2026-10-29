# FlyTally Logbook — active work

## 2026-10-29T19:05:42.874Z — DATA-1C staged, Draft PR #436 (verification NOT RUN)

- `main@807f281e5870164b794d001480ecc84e0b45aea5`; [Draft PR #436](https://github.com/filipto861/flytally-logbook/pull/436) branch `fix/logbook-data1-presign-integrity-20261029` pre-checkpoint `95c77473cdb29e3b43dabd4e43d018ff714de55f` stacked on DATA-1B [Draft #435](https://github.com/filipto861/flytally-logbook/pull/435) then DATA-1A [Draft #434](https://github.com/filipto861/flytally-logbook/pull/434); design/Claude review [Draft #433](https://github.com/filipto861/flytally-logbook/pull/433); SEC-1 [Draft #432](https://github.com/filipto861/flytally-logbook/pull/432) separate. New `lib/account-backup-presign.ts` validates original v13 payload before signature via existing parser/restore logic (ownership, relationships, certification, void archive digests, currency); `track_points:[]` only in validator view, never in exported JSON. Original v13 signing preserved. 5 staged unit tests **NOT RUN** and no typecheck/build/PG/Neon/browser/risk release. No merge/deploy/schema/DB/flags/Training. Production DB/flags UNKNOWN.
- **ONE NEXT STEP:** read-only DATA-1D restore-writer atomicity and large-export investigation, with no tests or database operations.


## 2026-10-29T18:58:22.448Z — DATA-1B snapshot builder Draft PR #435, NOT TESTED / NOT RELEASED

- Current Logbook `main@807f281e5870164b794d001480ecc84e0b45aea5`; [Draft PR #435](https://github.com/filipto861/flytally-logbook/pull/435) stacked on [Draft #434](https://github.com/filipto861/flytally-logbook/pull/434). Builder `lib/account-backup.ts` now has one read-only REPEATABLE READ transaction (30 unchanged SELECTs + two MVCC probes), strict 32-section result/owner validation via `lib/account-backup-snapshot.ts`, four new source tests staged, **none executed**. Format v13 retained, no live DB queries, no prod changes. Claude review reconciled in independent [Draft #433](https://github.com/filipto861/flytally-logbook/pull/433). SEC-1 [Draft #432](https://github.com/filipto861/flytally-logbook/pull/432) separate/unmerged.
- **Blockers:** local 16 MiB / Neon HTTP large-response limits unverified; restore can span multiple commits; pre-sign relationship checks pending. Node/typecheck/build/PG/Neon/browser/release **NOT RUN** by owner request. Production DB/schema/flags UNKNOWN, deployment unchanged READY as previously verified. No merge/deploy/prod DB/flags/Training.
- **ONE NEXT STEP:** inspect existing restore-side validators and prepare minimal DATA-1C fail-closed pre-sign validation as a separate stacked PR, preserving signed-v13 legacy behavior and no tests until owner changes instruction.


## 2026-10-29T18:50:08.815Z — DATA-1 source slice A staged in Draft PR #434 (UNTESTED)

- `main@807f281e5870164b794d001480ecc84e0b45aea5`; local adapter branch `fix/logbook-data1-local-snapshot-adapter-20261029` pre-checkpoint `e0814e9b5f795a141e014c44a85359bcfbad3d7d`, [Draft PR #434](https://github.com/filipto861/flytally-logbook/pull/434), separate from reviewed [design/reconciliation Draft #433](https://github.com/filipto861/flytally-logbook/pull/433) and SEC-1 Draft #432. Only code files `lib/local-postgres.ts`, `lib/local-postgres-transaction.ts`; 4 future tests staged but **NOT RUN**; no source exporter change. Claude APPROVE WITH CHANGES review reconciled in #433. Project incomplete/UNRELEASED, no merge/deploy/DB/schema/flags/Training changes. Production and local DB writes NOT ATTEMPTED.
- **ONE NEXT STEP:** prepare next small fail-closed backup builder PR-B, taking Neon response limits and multi-batch restore invariants into account before any release claim.


Current owner decisions live in [ROADMAP](../../ROADMAP.md). [Archived prior ledger](ACTIVE_WORK_ARCHIVE_2026-10-29.md) and [manifest](ARCHIVE_MANIFEST_2026-10-29.md) preserve previous checkpoints.

## 2026-10-29 — documentation reset

- GitHub `main@eb98982d9ce7cb166c32ba77c9262683989570f8`; all 33 previously open Draft PRs closed without merge. Owner intentionally deleted their original branches; remote-head check found none of the 33 names. [Inventory](../maintenance/2026-10-29-pr-closure-inventory.md) pins historical names and head SHAs. Current open PR count: zero at verification.
- Work branch `docs/logbook-main-documentation-reset-20261029` consolidates documentation navigation, memory archives and present-state pointers. No runtime/Training/DB/flag/deploy changes.
- Documentation checker: 3 pre-existing unresolved missing targets, 7 path fixes; checker tests 6/6 PASS; production DB and flags UNKNOWN. Historical test outcomes remain at their source SHAs.
- **Next action:** owner reviews documentation cleanup before any merge or new product milestone.
