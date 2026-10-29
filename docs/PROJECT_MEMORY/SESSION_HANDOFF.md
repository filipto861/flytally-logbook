# FlyTally Logbook — current session handoff

## 2026-10-29T18:50:08.815Z — DATA-1 source slice A on Draft PR #434, no verification executed

- **Verified:** Logbook `main@807f281e5870164b794d001480ecc84e0b45aea5`; work branch `fix/logbook-data1-local-snapshot-adapter-20261029` pre-checkpoint `e0814e9b5f795a141e014c44a85359bcfbad3d7d`, [Draft PR #434](https://github.com/filipto861/flytally-logbook/pull/434), base main, open/unmerged. Independent design/review [Draft PR #433](https://github.com/filipto861/flytally-logbook/pull/433) at `4a0186c0adf762dcce39072bc67259110d3d9d09`; independent dependency [Draft PR #432](https://github.com/filipto861/flytally-logbook/pull/432) still unmerged.
- **Code scope:** `lib/local-postgres-transaction.ts` implements an exact allowlist for `{isolationLevel:"RepeatableRead",readOnly:true}`; `lib/local-postgres.ts` passes options to same-tick locally owned psql transaction, leaving legacy default BEGIN/COMMIT command byte-for-byte unchanged. Four source unit tests staged at `tests/v381-data1-local-snapshot.test.ts`. Claude's independent review verdict **APPROVE WITH CHANGES** reconciled in PR #433. Current patch changes only local PG compatibility; `lib/account-backup.ts` still has independent Promise.all reads and **is not fixed**.
- **Evidence:** All DATA-1 tests (including the newly written cases), typecheck, Node suite, build, PostgreSQL, browser, CI, release **NOT RUN** per explicit owner instruction. Source diff inspected via GitHub; not behavioral evidence. Prod `fly-tally.com` last observed READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` from code `55c8076e1eb8104c14392e15b272b33e0eb29607`; live DB/schema/flags UNKNOWN. No migrations, remote queries, flag actions, merge, production deploy or Training edits.
- **Risks/blockers:** 64 MB Neon HTTP response limit (review claim, endpoint untested), local 16MiB psql maxBuffer, lack of restore multi-batch invariants, absent snapshot probes and actual account-bound profile validation. No release without future owner-approved targeted concurrent source/PG/Neon acceptance.
- **ONE NEXT STEP:** design bounded PR-B backup builder with explicit MVCC snapshot probes, length/profile checks and fail-closed large-account behavior; do not run tests or touch production.


## 2026-10-29T18:48:00Z — DATA-1 implementation slice A: local snapshot isolation adapter (UNTESTED)

- **GitHub source:** `main@807f281e5870164b794d001480ecc84e0b45aea5`, new work branch `fix/logbook-data1-local-snapshot-adapter-20261029` based directly on main; DOCS-only independent review proposal [Draft #433](https://github.com/filipto861/flytally-logbook/pull/433) separate; SEC-1 [Draft #432](https://github.com/filipto861/flytally-logbook/pull/432) separate and unmerged.
- **Reviewed proposed change:** `lib/local-postgres-transaction.ts` pure allowlisted `RepeatableRead/readOnly:true` transaction script transform; `lib/local-postgres.ts` passes optional mode into same-tick local transaction execution and leaves default `BEGIN;…COMMIT;` behavior unchanged; `tests/v381-data1-local-snapshot.test.ts` stages four focused regression tests. No backup builder change yet. No new dependency, migration, format or feature flag.
- **Tests and evidence:** every DATA-1 test, typecheck, build, PG, browser, release gate **NOT RUN** by owner directive. Merely writing tests does not establish PASS. Source has not been integrated into any production release.
- **DO NOT:** merge, deploy, access production DB, migrate/restore/delete/flags, modify Training or remove snapshot validation; `fly-tally.com` last READY at `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` from deployed executable `55c8076e1eb8104c14392e15b272b33e0eb29607`; actual production DB/flags UNKNOWN.
- **ONE NEXT STEP:** after documenting Claude review reconciliation, implement guarded `buildAccountBackup` single-snapshot data reads on a separately reviewed PR-B, explicitly protecting large accounts and signed-v13 failure modes; do not test until authorization.


Verify GitHub and provider state independently. [Complete checkpoint archive](SESSION_HANDOFF_ARCHIVE_2026-10-29.md) preserves every earlier entry; [manifest](ARCHIVE_MANIFEST_2026-10-29.md) pins original blobs.

## 2026-10-29 — owner-directed PR closure and documentation reset

- **Main:** `eb98982d9ce7cb166c32ba77c9262683989570f8`. New docs-only branch `docs/logbook-main-documentation-reset-20261029` starts from this commit. [Closure inventory](../maintenance/2026-10-29-pr-closure-inventory.md) records the 33 closed Draft PRs, historical branch names and head SHAs. GitHub open-PR search returned zero; owner intentionally deleted the original branches, and none of their 33 names appears in current remote heads. PR discussions remain accessible.
- **Owner scope:** close existing PRs without merge, preserve history, clean documentation, then choose future work. No application, Training, DB/schema/flags or deployment change.
- **Evidence:** DOC-6A navigation changes and DOC-6B byte-preserving archives carried into the new docs branch. Archive Git blob IDs equal their source IDs. Documentation checker: 3 unresolved missing targets in older product docs after 7 path fixes; isolated checker tests 6/6 PASS. Runtime, PostgreSQL and browser gates NOT RUN for docs-only work.
- **Production:** last provider check: `fly-tally.com` READY deployment `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU`, source `55c8076e1eb8104c14392e15b272b33e0eb29607`; reverify before release. Production DB and flags UNKNOWN.
- **Next action:** review the scoped documentation-reset candidate; merge only after a separate owner decision.
