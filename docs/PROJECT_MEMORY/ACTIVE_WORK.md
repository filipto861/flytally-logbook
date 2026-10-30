# FlyTally Logbook — active work

## 2026-10-30T08:13:35.586Z — DATA-1D standalone credential-local HTTP executor, offline source gates PASS, real Neon transfer pending

- [Draft #443](https://github.com/filipto861/flytally-logbook/pull/443) stacked on #442→#441; main `807f281e5870164b794d001480ecc84e0b45aea5`. Changed `tooling/data1-neon-http-store-gate{,.test}.mjs` + `docs/maintenance/2026-10-30-data1-credential-local-http-executor.md` + roadmap/Project Memory only. Exact code/test SHA `b57b63a49615fc6eafad45d9c38818b8f704aa32`. Owner-local Node24 script requires two-stage read-only probe and explicit confirmation for new empty dedicated Neon PG16; credentials never cross ChatGPT/connector boundaries; SQL cannot independently verify caller-supplied project ID, requiring operator console verification.
- **Evidence at tested source SHA:** isolated Node24.22.1 clone, 5/5 new standalone tests PASS, static check PASS, installed exact locked Neon 1.1.0 API verified, fail-closed missing-credential CLI exit1. Source planner `development-infrastructure`, typecheck/full_tests/build yes, PG/browser/scale no; `npm ci`, `npm run typecheck`, **1,775/1,775 full Node tests**, `npm run build` all PASS. Synthetic 1/4/12 MiB gzip/Base64 byte counts measured offline. **Actual Neon HTTP stored INSERT/SELECT NOT RUN**, signature/GET/Neon provider max/canonical release `verify:release:risk` NOT RUN/UNKNOWN, DATA-1 remains release-blocked.
- **Cleanup:** source-testing nonpersistent Vercel sandbox `sbx_tiQXvxVL7CEVZZipvrVoEI88Gt92` stopped and independently confirmed STOPPED; no Neon project created this iteration and fresh read-only list has the same three original projects. Existing prod Vercel READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` app SHA `55c8076e1eb8104c14392e15b272b33e0eb29607` (no new deploy). Production DB/schema/flags UNKNOWN, none operated; no merge/migrations/Training/Claude.
- **ONE NEXT STEP:** run actual Neon HTTP gzip/Base64 INSERT/SELECT on **newly approved independently empty disposable** PG16 project in owner-controlled Node24 local runner, with separate project identity preflight and exact-ID deletion/verification afterward.


## 2026-10-30T07:32:52.591Z — DATA-1D SQL-only storage PASS, true HTTP backup transfer remains BLOCKED

- Draft [#442](https://github.com/filipto861/flytally-logbook/pull/442) on top of #441, canonical main `807f281e5870164b794d001480ecc84e0b45aea5`; evidence source before checkpoint `140d1ba49d0bbc4709460a51355093031494e13a`. New owner-approved disposable Neon PG16 project `green-grass-72402049` (zero initial user tables) used only for fabricated Base64 storage 1/4/12 MiB: **3/3 SQL INSERT and independent SQL readback digest/bytes PASS**, **NOT** Node HTTP payload transport nor gzip/signed-v13 acceptance. Node24 sandbox prepared; passing DB secret across tools blocked; no Node SQL executed. Provider size limit and actual HTTP upload/download **UNKNOWN/NOT RUN**.
- All test resources cleaned: Vercel session `sbx_5rdbq6xqPEndvE8GKLDtfrRskExx` independently confirmed STOPPED/nonpersistent, exact disposable Neon project deleted and verified absent; only original Logbook Shadow and 2 Training projects remain. [Evidence](../../docs/maintenance/2026-10-30-data1-synthetic-sql-storage-evidence.md). No production SQL, migrations/flags, merge, deploy or Training change. Full candidate `verify:release:risk` NOT RUN; DATA-1 not release-ready.
- **ONE NEXT STEP:** owner-controlled credential-safe Node24 test of actual gzip/Base64 Neon HTTP stored INSERT/SELECT in a freshly verified empty disposable project with exact cleanup, not a new source/size-policy change.


## 2026-10-30T07:01:22.950Z — DATA-1 32 PG SKIPs closed, stored Base64 transport still release blocker

- Main `807f281e5870164b794d001480ecc84e0b45aea5`, Draft [#441](https://github.com/filipto861/flytally-logbook/pull/441) branch `chore/logbook-data1-pg-skip-acceptance-20261030` tested pre-checkpoint `092593a1f14be1b64b733bcad77939ece15848a8`, stacked on #440→#439→#438→#437→#436→#435→#434. Prior core 119 PASS/32 SKIP was four different purpose-guarded historical suites; **all 32 executed separately** on four disposable loopback PG16 instances with explicit flags: 5 v21 +19 migration D3b +6 race D3b +2 actual full-v20 catalog = **32/32 PASS, 0 FAIL/SKIP** in [GitHub Actions #41017214910](https://github.com/filipto861/flytally-logbook/actions/runs/41017214910). Each dedicated PostgreSQL shutdown and temp-file cleanup step PASS. Original tests unmodified; first two catalog fixture FAIL attempts retained, third used source-backed real v1-v20 bootstrap. [Evidence](../../docs/maintenance/2026-10-30-data1-quarantined-pg-evidence.md).
- Temporary push-triggered workflow removed from this Draft branch; no ongoing CI resource, Neon/project, Training or production DB/flags/merge/deploy change. Full-repo TS/1775 Node/build and v13 desktop/mobile 2/2 from earlier exact SHA still recorded. **Do not call DATA-1 release-ready:** stored Base64 SQL upload/download provider size envelope and official candidate release ledger remain NOT RUN / UNKNOWN.
- **ONE NEXT STEP:** a bounded new isolated synthetic Neon Base64 storage upload+download experiment with mandatory delete+verification, prior to owner merge decision.


## 2026-10-29T21:02:30.499Z — full Node24 GitHub Actions DATA-1 evidence stored; temporary CI workflow removed

- `main@807f281e5870164b794d001480ecc84e0b45aea5`, working Draft [#440](https://github.com/filipto861/flytally-logbook/pull/440) pre-checkpoint tested SHA `087d19b2c108ccbe0d11311e598ac4d915d12bc2`, stacked on #439→#438→#437→#436→#435→#434; SEC-1 #432, design #433 independent. Audited runtime inventory `419` aligns three new stable-owned source files. GitHub Actions [#40953266033](https://github.com/filipto861/flytally-logbook/actions/runs/40953266033) full repo Node24 `typecheck` PASS, **1775/1775 Node PASS**, build PASS, isolated PG core **119 PASS/32 SKIP/0 FAIL = PARTIAL**, bounded signed-v13 recovery desktop+mobile **2/2 PASS, zero retries**. Both local PG fixtures stopped/removed, job cleanup PASS. Temporary push-triggered CI workflow **removed** on working branch; original manual-only workflows remain. [Complete evidence](../../docs/maintenance/2026-10-29-data1-full-github-actions-verification.md). No new Neon branch/project, production DB/flags, deployment, merge or Training changes. DATA-1 release blocked on PG skipped acceptance and large stored archive transport.
- **ONE NEXT STEP:** classify and close 32 PostgreSQL skips using an independently verified local disposable fixture and the canonical acceptance contract.


## 2026-10-29T20:26:05.483Z — DATA-1 targeted tests PASS; new compatibility Draft #439, release BLOCKED

- `main@807f281e5870164b794d001480ecc84e0b45aea5`, work `fix/logbook-data1-node24-strip-types-20261029` pre-checkpoint `e45fde930b305ed4b5e25be3522423cc21c0d53a`, [Draft #439](https://github.com/filipto861/flytally-logbook/pull/439) stacked on #438→#437→#436→#435→#434. Actual **Vercel Sandbox Node24.22.1** first uncovered Node strip loader FAIL and focused TypeScript TS2352 FAIL; both narrow fixes committed. Final 16/16 A/B/C/D tests PASS, 2/2 profiler tests PASS, **focused** `tsc --noEmit` PASS; source file subset only, **full repository** typecheck/build/Node suite/PG/CI/browser/release **NOT RUN**. No new Neon DB, sandbox STOPPED/verified, no merge/deploy/production DB/flags/Training. Full metrics in [verification evidence](../../docs/maintenance/2026-10-29-data1-targeted-node24-verification.md).
- **ONE NEXT STEP:** obtain full SHA-bound private checkout in isolated Node24 then run full typecheck and risk-selected release tests, preserving production no-action hold.


## 2026-10-29T20:12:59Z — DATA-1D real Node24 Neon HTTP test + cleanup VERIFIED

- [Draft #438](https://github.com/filipto861/flytally-logbook/pull/438) `chore/logbook-data1d-offline-size-envelope-20261029` pre-checkpoint `dc5d8a095cd7d9872d691d27c7b80f4a44d38f8d` stacked on #437/#436/#435/#434; main `807f281e5870164b794d001480ecc84e0b45aea5`. Created **separate clean PG16 Neon project** and nonpersistent Node24 sandbox. Actual `@neondatabase/serverless@1.1.0`: 3 read-only REPEATABLE READ 32-response query batches, both snapshot probes identical, 40/500/4000 synthetic row cases PASS (20,834/4,108,924/16,414,454 response bytes), 1/4/12MiB parameter echo PASS. No real flight/GPS or DB writes. **NEON PROJECT DELETED, SANDBOX STOPPED and verified**, original three projects untouched. [Measured details](../../docs/maintenance/2026-10-29-data1d-neon-http-driver-evidence.md). Cannot claim vendor max size or full signed-v13 backup acceptance; all source unit/typecheck/build/PG/CI/browser tests NOT RUN, no merge/deploy/flags/Training.
- **ONE NEXT STEP:** exact frozen DATA-1 stacked candidate Node24 targeted unit/typecheck, then bounded synthetic storage/restore proof if needed.


## 2026-10-29T19:45:29.629Z — DATA-1D isolated synthetic Neon query proof + verified cleanup

- Logbook `main@807f281e5870164b794d001480ecc84e0b45aea5`; working Draft PR #438 pre-checkpoint `d7d08f8d80311918cdd26f2c27a2cb2facd5cc16`. Created independent empty Neon project `odd-recipe-81483357`, confirmed PG16/0 user tables, ran single transaction 30 read-only synthetic SELECT summaries + MVCC probes; aggregate rows 40/500/4000 PASS. **Deleted project and independently verified absence**; three original Neon projects untouched, Training excluded. Exact last MVCC snapshot match not separately asserted; Neon HTTP app driver/real wire throughput and size still NOT RUN. [Evidence](../../docs/maintenance/2026-10-29-data1d-neon-ephemeral-evidence.md). Unit/typecheck/build/PG full/browser/CI/release NOT RUN; no merge/deploy/prod DB/migrations/flags. DATA-1 release BLOCKED.
- **ONE NEXT STEP:** source-backed actual locked Neon HTTP/Node24 transport test design with guaranteed ephemeral project cleanup; no new vendor cap guess.


## 2026-10-29T19:39:08.007Z — DATA-1D safety preflight (metadata only)

- Draft #438 `chore/logbook-data1d-offline-size-envelope-20261029` pre-checkpoint `a9f8d072a53bf124e2144abd922af4f49c97c295`, canonical main `807f281e5870164b794d001480ecc84e0b45aea5`; local offline 3-profile evidence rechecked, Git blob matching GitHub. Neon project metadata read-only: Logbook Shadow only active `production` branch, other branches archived with inherited data, no verified empty synthetic Logbook test environment. Training projects isolated/out of scope. **NO SQL, DB access, branch creation, tests/build/PG/Neon acceptance/CI/browser, merge/deploy/flags/Training.** Further evidence and instruction in [DATA-1D environment preflight](../../docs/maintenance/2026-10-29-data1d-environment-preflight.md). DATA-1 cannot release, HTTP payload limits UNKNOWN.
- **ONE NEXT STEP:** obtain explicit approval for new independently empty Logbook Neon project or owned local PG16, then bounded synthetic-only measurements, not production operations.


## 2026-10-29T19:34:07.433Z — DATA-1D offline measurement evidence captured; DATA-1 still on HOLD

- [Draft PR #438](https://github.com/filipto861/flytally-logbook/pull/438) `chore/logbook-data1d-offline-size-envelope-20261029` pre-evidence `36041613c7d4f314ae723b1a91db6d4b501c1d6f` on main `807f281e5870164b794d001480ecc84e0b45aea5`, stacked on #437→#436→#435→#434. Exact source blob matched assistant offline copy. 3 synthetic-only CLI profiles PASS (40, 500, 4000 flights); largest simulated psql output 34.6MB > local adapter 16MiB cap; gzip17.9MB/Base6423.9MB; [integer-byte evidence](../../docs/maintenance/2026-10-29-data1d-offline-measurement-evidence.md). Node22 assistant container, not Node24; no tests/build/Neon/DB/browser/CI. No merge/deploy/DB/flags/Training. Cannot infer Neon HTTP provider limit or real account capacity, DATA-1 release BLOCKED.
- **ONE NEXT STEP:** owner decision on isolated synthetic Neon transport measurement; no remote database operation without it.


## 2026-10-29T19:26:55.629Z — DATA-1D-2 offline synthetic envelope Draft #438

- Verified Logbook `main@807f281e5870164b794d001480ecc84e0b45aea5`, branch `chore/logbook-data1d-offline-size-envelope-20261029` pre-checkpoint `d94c1a79219669e0fcc688ad9d7304390130ced3`, [Draft #438](https://github.com/filipto861/flytally-logbook/pull/438), stacked on #437 (then #436/#435/#434). Source-only no-DB synthetic size profiler plus future standalone source tests and maintenance protocol; runnable only with explicit offline flag and benign environment; no runtime integration. Test, profiler, typecheck, build, PostgreSQL, Neon, browser, CI **NOT RUN**. No production data, merge/deploy, migration/flags/Training. HTTP vendor ceiling UNKNOWN and large-account transfer remains blocking for DATA-1 release.
- **ONE NEXT STEP:** owner-authorized offline synthetic-only execution, then isolated provider evidence and a source-backed size policy; no new Claude request unless architecture materially changes.


## 2026-10-29T19:20:18.809Z — DATA-1D-1 staged in Draft #437, UNTESTED

- Source `main@807f281e5870164b794d001480ecc84e0b45aea5` and `fix/logbook-data1d-local-transport-integrity-20261029` pre-checkpoint `a16c0cc493124b59f465678fce5cc5bb383405c3`; [Draft #437](https://github.com/filipto861/flytally-logbook/pull/437) stacked on #436 → #435 → #434. Strict `psql` result marker cardinality parser rejects missing/duplicate/malformed output; former silent empty-array substitution removed. 3 synthetic cases added, **NOT RUN**. No change to SQL/Neon HTTP, v13, DB/flags, production deployment or Training. Previous Claude review C2/C3 covered this narrow class; no new Claude request. Large-account Neon request/response limit and Base64 storage capacity unverified, **DATA-1 NOT RELEASE-READY**.
- **ONE NEXT STEP:** prepare short synthetic-only transport-size measurement and source instrumentation proposal; keep tests NOT RUN until user separately permits.


## 2026-10-29T19:13:06.396Z — DATA-1D correction carried onto staged DATA-1C PR #436

- DATA-1C source unchanged on `fix/logbook-data1-presign-integrity-20261029` pre-checkpoint `3997a5ef2093e50ee9b791f205c6a75b397ae299`, Draft #436 stacked on #435/#434. Design PR #433 now documents exact `version>=6` restore single transaction vs legacy `<6` multi-batch. Prior handoff entries claiming multi-transaction v13 exact restore are **SUPERSEDED**. Runtime gates all NOT RUN. No merge, deployment, DB/flags/Training changes.
- **ONE NEXT STEP:** read-only second-AI review of DATA-1D size/transport design before next runtime slice.


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
