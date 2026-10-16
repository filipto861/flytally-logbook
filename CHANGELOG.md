# FlyTally changelog

**16 Oct 2026 — test(PR340 Playwright TypeScript module interop), staged:** Owner SHA `5b666f8c` full release verification passed source 257, domain 39, aggregate Node 1617, production build and PostgreSQL 163, but failed browser startup with missing named TypeScript export. Removed direct TypeScript import from E2E browser DB helper; introduced native Node strip-types certification CLI with canonical v8 hash/verify, strict test fixture identity, local-purpose checks and tamper verification. Added file to browser evidence source identity and updated source/executable tests. No production SQL or certification logic changes; new HEAD acceptance NOT RUN, no merge/deploy.


**16 Oct 2026 — PR340 browser remediation staged; not re-tested:** Aircraft Quick Add now projects a legacy numeric zero sentinel only for the non-null historical default price field when no price is provided; v21 exact-money fields remain NULL and no rate row is created. Safety Pilot fixture 9903 now derives and checks a real v8 certification fingerprint from its persisted test row instead of a literal invalid token. Two source regression assertions added. No production schema, data, merge or deployment. Typecheck/browser/full release pending.


**16 Oct 2026 — fix(PR340 Windows owned PG16 launch), NOT YET LOCALLY VERIFIED:** Second full local release gate at `d747c1ec` passed source 257/257, domain 26/26, typecheck, Node 1615/1615 and Next build; canonical PG failed early at `pg_ctl.exe; exit=0` without proof of exact root cause. Updated trusted PG16 runner to avoid inherited stdio pipe handles during pg_ctl start/stop and expose spawn error codes/signals. Added contract assertion. Browser and scale NOT RUN; no runtime migration/deploy.


**16 Oct 2026 — test(PR340 M2 stale contract):** Owner's first full local gate at `2eef9c36` showed source 256/257 PASS and FAIL at obsolete `runNodeTests(tests)` source-pattern assertion; PG and Playwright were not executed. Updated M2 contract to validate preserved legacy `runNodeTests(configuration.testFiles)`, authorized six-cluster execution, and pure aggregate non-authority. Owner-local retest NOT RUN on new commit. No production changes.


**16 Oct 2026 — fix(PR340 TS fixture typing), awaiting owner recheck:** Change declared PR340 PG preflight/executor `env` argument to `Partial<NodeJS.ProcessEnv>` for intentionally missing-environment negative tests. Owner prior run 9/9 targeted tests PASS, typecheck 2 TS2741 failures before this fix. No change to runtime behavior, database or deployment.


**16 Oct 2026 — chore/test(PR340 canonical PG bridge), NOT YET VERIFIED:** Introduced `tooling/pr340-owned-postgres-acceptance.mjs` trusted native Windows PG16 six-cluster executor and type declarations; wired explicit opt-in from disposable PR340 acceptance wrapper to canonical `verify-postgres.mjs` ledger. Enforces SHA/clean-tree/registry/current branch, six distinct owned targets, strict zero-skip TAP for 163 cases, actual v20 bootstrap, and exact work_mem 64MB shared-core benchmark only in fresh local DB. Updated release config identity and added fail-closed contract tests. No product SQL/migrations/limits changed. Previous owner-local Node/build and separate PG evidence remain valid for their earlier SHA only; new end-to-end test/build/PG/browser NOT RUN. No merge/deploy.


**16 Oct 2026 — verification evidence (no runtime change):** Owner-local exact SHA `15e138e5` Node 1610/1610 PASS (no skips), Next production build PASS (41/41 static pages), PostgreSQL real-v20-catalog 2/2 PASS. Previous owner-local 38/38 other PG cases PASS on prior SHA, shared-core 123/123 diagnostic work_mem=64MB PASS on earlier SHA. Canonical full release/PG ledger and Playwright NOT RUN. Actual release verifier remains single-DB and must not inherit fabricated six-partition PASS; PR Draft / no merge / no deploy.


**16 Oct 2026 — test(PR340 source-backed real-v20 public catalog, NOT YET LOCALLY VERIFIED):** Added guarded empty-public PG16 bootstrap, executing canonical optimizer migrations v1–v20 with migration-record audit and enabling real-v20-catalog 2-test partition; updated partition runner, TAP gate and source contract. Prior 38/38 non-shared-core cases passed on owner local PG16; shared-core 123/123 only in 64MB diagnostic configuration. New source head PG tests/build/browser NOT RUN; PR stays Draft, no merge/deploy.


**16 Oct 2026 — test(PR340 work_mem PG16 diagnosis), NOT LOCALLY VERIFIED:** Opt-in `-WorkMemDiagnostic` on `shared-core` creates the original owned disposable cluster, applies PostgreSQL work_mem 64MB using ALTER SYSTEM and pg_reload_conf, verifies SHOW work_mem, then runs unchanged 123 tests. Diagnostic explicitly marked non-release; all normal runner defaults, SQL and performance thresholds remain unchanged. Local run NOT RUN, no production DB/deploy/merge change.


**16 Oct 2026 — test(PR340 D3b 17/19 blocker, NOT YET VERIFIED LOCALLY):** Real PG16 D3b-chain evidence exposed two failures inserting `amount_encoding` into actual v20 schema. In test-only `expensesSaveSql`, added assertion-guarded projection removing exactly the two v21-only columns from INSERT, SELECT and JSON-recordset declaration, preserving actual parent-lock, ownership, delete and race semantics. Updated pinned registry source hash. No production runtime, migration, database or release evidence changes; rerun NOT RUN.


**16 Oct 2026 — test(PR340 50k Insights diagnostic, NOT YET VERIFIED LOCALLY):** Added compact EXPLAIN plan-node output on unchanged v1.69 50k SQL benchmark failure; refreshed pinned SHA256 in PostgreSQL source registry. Standalone failure evidence: 3134.911ms > 3000ms, 4/5 test cases PASS, 0 skips. No product SQL, limit, runtime, database, ledger, deployment or merge change. Local gates/PG run after these code changes NOT RUN.


**16 Oct 2026 — test(PR340 M3 shared-core isolate historic 50k/100k benchmarks), NOT YET VERIFIED:** Owner's first two clean shared-core PG16 runs each yielded 122/123 PASS with 0 SKIP/TODO; first failed 100k Insights limit by 6.908ms, second failed unrelated 50k Insights by 40.374ms. Changed only `tooling/run-pr340-partition-tests.mjs` and its source contract test to run each heavy performance file separately from the other 113 tests, using strict per-segment TAP and total 123-case accounting, preserving existing SQL and limits. Local Node/typecheck/PG rerun on new SHA NOT RUN. No migration, deployment, release ledger or production data change.


**16 Oct 2026 — test(PR340 M3 partial partition runner), NOT VERIFIED LOCALLY:** Added `tooling/run-pr340-postgres-partitions-local.ps1`, `tooling/run-pr340-partition-tests.mjs` and source-only contract test registered in development-pipeline. Proposed execution uses owned distinct temporary PG16 clusters and exact registry specs with fail-closed strict TAP; intentionally refuses real-v20-catalog until its source-backed historical `public` migration prerequisite is implemented. The script can execute at most 161/163 cases; 163/163 PostgreSQL release evidence and Playwright NOT RUN. No production data or canonical ledger writes, merge or deploy.


**16 Oct 2026 — docs(PR340 M3 execution design, review pending):** Added `docs/product/3_8_0_PR340_M3_PARTITION_EXECUTION_DESIGN_2026-10-16.md` after inspecting canonical PostgreSQL runner, six purpose-bound suites, current disposable PowerShell wrapper and M2 strict TAP. Defines isolation, fresh PG16 ownership/cleanup, real pre-v1 foundation and v1–v20 catalog, candidate evidence, release ledger and staged M3a–M3e rollout with independent reviewer questions. No runner/schema/runtime/DB changes, no tests on new docs SHA, no merge or deploy.


**16 Oct 2026 — owner-local M2 verification completed, PR Draft:** Clean `54c4469b` checked out and verified on Windows Node24; read-only PostgreSQL registry PASS (42 files/163 tests/6 groups); M1/M2/fixture/ledger targeted 31/31 PASS; typecheck PASS; complete Node 1606/1606 PASS, no skipped/TODO. This closes the pure M1/M2 test infrastructure milestones locally. M3 independent, purpose-bound ephemeral database orchestration remains design-only, PostgreSQL/Playwright/build **NOT RUN** on exact commit, no merge or deployment.


**16 Oct 2026 — fix(PR340 M2 local validation blockers), verification pending:** Owner Node24 on clean `2e69206a` confirmed registry PASS, typecheck PASS, targeted 25 PASS/2 FAIL, complete Node 1603 PASS/3 FAIL. Corrected nested child Node TAP fixture inheritance (`NODE_TEST_CONTEXT`), 40-char Git commit SHA guard (SHA-256 fields retain 64), and both incorrectly escaped regexes in full-v20 fixture source test. Exact-head owner-local tests after changes NOT RUN; PG/scale/Playwright NOT RUN; no product runtime or production database change, merge or deploy.


**16 Oct 2026 — M1 locally verified, M2 pure TAP parser implementation staged, NOT RELEASED:** Owner Windows Node24 clean commit `8043ede6`: PostgreSQL registry validator PASS 42 files/163 tests/6 partitions, focused 11/11 PASS, typecheck PASS. Implemented `tooling/postgres-partition-tap.mjs` + `.d.mts`, M2 strict TAP13 case/suite accounting and candidate-bound pure evidence aggregator, plus eight regression tests `tests/v380-pr340-postgres-tap-partitions.test.ts` for true TAP and adversarial false evidence. Added M2 files to `tooling/verification-identity.mjs` and test to development-pipeline. M2 source changes not yet owner-local tested. No DB, scale, browser, release acceptance or production deployment for new head. Existing PostgreSQL gate continues unchanged with 32 raw gated skips; M3 partition orchestration not implemented.


**16 Oct 2026 — fix(PR340 M1):** Corrected cross-platform SHA-256 validation for PostgreSQL source test inventory after owner Windows Node24 M1 run returned two false registry-drift test failures and TS7016 (`7/9 PASS`, typecheck FAIL). Hash canonically normalizes CRLF→LF but preserves all substantive bytes, explicitly rejects invalid UTF-8/bare CR; registry contract renamed `sha256-utf8-canonical-lf`. Added LF/CRLF and malformed-file negative regression checks, adjacent `tooling/validate-postgres-partition-registry.d.mts` declaration and verification identity pin. No PostgreSQL operations, product runtime, schema, merge or deployment. Latest changes NOT YET owner-locally tested.


**16 Oct 2026 — PR #340 M1 PostgreSQL registry (staged; tests NOT RUN):** Created `tooling/postgres-partition-registry.json` (42 SHA-256 pinned test files, 163 declared cases, six partitions) and `tooling/validate-postgres-partition-registry.mjs` (read-only drift detection). Added `tests/v380-pr340-postgres-registry-validation.test.ts` negative tests and registered them in development-pipeline source-contract inventory; added registry and validator to `tooling/verification-identity.mjs` configuration hash. Existing PostgreSQL execution, release ledger policy, 3.8.0 runtime and production untouched. User-local Node24 validation and all PG/scale/browser gates on updated exact PR SHA NOT RUN.


**15 Oct 2026 — PR #340 release-gate discovery and design (STAGED, not deployed):** Added `docs/product/3_8_0_PR340_POSTGRES_EVIDENCE_PARTITION_REVIEW_2026-10-15.md`; added source-only `tests/v380-pr340-postgres-partition-inventory.test.ts` and registered it in `tooling/development-modules.json`. Independently inspected actual suites and recovered 32 opt-in tests (5+19+6+1+1); canonical raw skips remain PARTIAL. Proposed fresh-DB per-partition execution and actual v20 public catalog authority for external DeepSeek review. Code/source inspection PASS only; new Node, PostgreSQL, scale, browser and build **NOT RUN** on updated PR head. No changes to application runtime, schema, certified flight data or production deployment.


**15 Oct 2026 — PR #340 PostgreSQL full-v20 fixture fix, not released:** Owner-local exact candidate `d01f1ba0`: 3/3 new runner guards, source 234/234, domain 26/26, typecheck, full Node and build PASS; PostgreSQL 123 PASS / 8 FAIL / 32 SKIP, all eight fail before SQL on duplicate `deleted_flights.expenses_data` column creation. Removed redundant `ALTER TABLE` from `tests/integration/postgres-v380-full-v20-restore.test.ts` and replaced with strict existing-column shape assertion. Added dedicated fixture-drift regression to `tests/v380-pr340-disposable-gate-flag.test.ts`. Source inspection PASS; updated local PG/Playwright verification NOT RUN. Remaining raw skipped dedicated PG scenarios require explicit acceptance evidence; PR still Draft, no merge or deployment.


**15 Oct 2026 — PR #340 release-test runner correction (pending local verification):** Corrected `tooling/run-v380-cost-summary-acceptance-local.ps1` to turn on historical full-v20 PostgreSQL restore only after the fresh random-port PG16 cluster passes exact DB identity verification, verify the flag reaches the Node child, and restore its previous value on completion/error. Added `tests/v380-pr340-disposable-gate-flag.test.ts` regression coverage. Previous local run `14e32e26`: source 234/234 PASS, domain 26/26 PASS, typecheck/full Node/Next build PASS; PG full 123 PASS / 8 FAIL / 32 SKIP (all eight failed the missing opt-in before SQL). Actual 10k, 50k, 100k performance fixtures PASS, despite release-level `scale=NOT RUN`; browser NOT RUN. New source tests/full release gate **NOT RUN**; no production deploy, data migration, or runtime SQL changes.


**15 Oct 2026 — PR #340 PG16 full-gate discrepancy triage, corrective test-fixture batch STAGED.** Owner reran clean HEAD `e4e75a6eb289d30532c566813906a5164c11942f`: targeted source security 16/16 PASS, source-contract 234/234 PASS, domain-unit 26/26 PASS, typecheck PASS, full Node suite PASS, production Next build PASS; isolated PostgreSQL16 exact identity `flytally_currency_test|flytally|127.0.0.1|61001` verified, then canonical PostgreSQL full gate **112 PASS / 12 FAIL / 13 SKIP**. Scale and Playwright **NOT RUN**; release status FAIL; local DB successfully stopped and cleaned. Six PG errors were `column f.price_currency_code does not exist` in 10k/50k/100k and mixed-category scoped test schemas created by tests themselves (production v21 contains the column). Four independent isolated integration fixture files have now added the **three nullable/no-default v21 flight money columns** to their temporary `CREATE TABLE flights` DDL; values remain absent, never guessed as CZK. The historical D3b fixture now verifies registry v21's exact name but continues actually applying only v1-v20 SQL by design. Previous strict v20 legacy Trash source tests had parsed a single SQL statement directly inside the transaction, whereas production runtime already has explicit **currencyRestore ? modern : legacy** query selection followed by the same advisory-locked two-statement transaction. Their source-driven parsers now extract **both existing SQL branches**, check row locks and identity/fingerprint contracts, execute exclusively the legacy branch in the historical v20 test, and independently assert v21 exact currency/expense fields and digest checks; production restore runtime is **unchanged**. Independent static source-pattern recheck PASS; **new head must still run all targeted and full isolated PG tests, and demonstrate 10k/50k/100k real execution timings.** No fixture test has been disabled, no safety assertion intentionally dropped, and no production deployment, DB migration, certification mutation or data change was made. PR stays Draft. This fixes deterministic test-schema/parser drift; do **not** interpret it as evidence that new full-scope cost aggregation meets existing performance thresholds before remeasurement.


**15 Oct 2026 — exact-head local gate failure analysis and correction (PR #340).** Owner tested HEAD `175f42e7` in a clean, detached worktree: Node 24.19, `npm ci` PASS, typecheck PASS, 22/22 focused v21-risk/currency/exact-cost tests PASS. Dedicated disposable PostgreSQL16 instance `127.0.0.1:51946 / flytally_currency_test` was independently identity-checked and stopped cleanly in `finally`. Canonical `verify:release:risk -- --base origin/main` stopped at **source 233/234 PASS, 1 FAIL**, before domain/full-tests/build/PostgreSQL/scale/browser. The single failure in `tests/development-pipeline.test.ts` expected the generic missing-auth guard from a child invocation of `tooling/run-auth-browser.mjs`, but inherited the parent wrapper's explicit `FLYTALLY_V21_RISK_BROWSER=1` and therefore correctly received the prior risk-purpose guard. The test now clears `FLYTALLY_V21_RISK_BROWSER` and `FLYTALLY_CURRENCY_V21_BROWSER` **only in the spawned no-auth test child** so that its original contract is tested while the release wrapper and v21 purpose safety remain unchanged. No runtime, schema, migration, certified data or production change. **Retest on new exact PR head pending; do not infer PostgreSQL or browser PASS from source stage.**


**15 Oct 2026 — PR #340 post-local-PASS browser/v21 acceptance bridge STAGED, re-verification pending.** Owner's clean detached worktree on `df4be9cd` reported `npm ci` completed (two retry warnings on `@img/colour`), Node `v24.19.0`, and `git status --short` empty. Exact candidate planner on the clean worktree: 15 PR files, source/domain/typecheck/full Node/build + PostgreSQL full/scale + browser-risk all required; no blockers. Because standard browser bootstrap sets v19/v20 until explicitly migrated, the PR now adds a **purpose-guarded v21 browser-risk path** in `tooling/run-auth-browser.mjs` and `tooling/verify-browser-risk.mjs`, preserving original `--currency-v21` recovery-only semantics. New `tooling/run-v380-cost-summary-acceptance-local.ps1` accepts clean detached latest PR head, verifies local repo SHA and a separately created ephemeral `127.0.0.1` PostgreSQL16 `flytally_currency_test` cluster, enforces schema-first v21, runs the **candidate-aware full release gate**, and cleans up only the cluster it created. Its mode strictly rejects remote/wrong database and unapproved Playwright CLI. Existing KWD/JPY archive-restore E2E now additionally checks exact **1,131.281 KWD** in Flights header and Statistics registration. New security regression tests cover denial before destructive bootstrap. **New head has NOT YET been locally executed**; PostgreSQL/scale/browser PASS cannot be claimed and production PR remains Draft. Do not use the old branch-pinned currency script; use the PR340 runner only. Note: the original locally verified 1,579/1,579 full tests/typecheck/build PASS belongs to `df4be9cd`, and will require rerun on latest PR code. No application schema, production DB or certification rows were changed.


**Local verification update (15 October 2026, PR #340):** On initial PR head before maintenance corrections, owner's PowerShell log reports `npm ci` PASS (with retried tarball warnings), `npm run typecheck` PASS, 9/9 exact-cost targeted tests PASS, `npm run build` PASS (Next.js 16.3.2). Aggregate `npm test`: **1,575/1,579 PASS; 4 FAIL**, all identified: (1) frozen v20-only H4 tests counted in live browser baseline (59 versus 57); (2) 397 current runtime files versus 396 registered; (3) deprecated hardcoded `Legacy rates have no recorded currency` assertion; (4) stale 3.7.0 package-version assertion while production is 3.8.0. Follow-up commits reconcile browser-suite exclusion and Playwright `testIgnore` while preserving the H4 dedicated runner, update registry inventory, test current fail-closed summary, and align version policy to 3.8.0. Independent source census verified exactly 57 distinct expected live browser test names, H4 separately retained. **No aggregate test, typecheck, build, authenticated browser or scale gate has yet been rerun on the revised head**; therefore keep PR draft / production unchanged.


## 15 Oct 2026 — 3.8.0 cost summary/UI follow-up STAGED (not yet deployed)

Prepared a fix for hardcoded `Unverified` in Flights summary and Statistics registration costs after owner-attested CZK historical backfill. Flight list summary now derives exact per-flight rounded NUMERIC minor-unit totals from all records in the same server-side filter scope irrespective of page size. Mixed currencies displayed individually, unsupported/missing values excluded explicitly; no FX, no arbitrary CZK defaults, no personal expenses included. Statistics registration costs use selected source snapshots with identical money-domain arithmetic and existing period/category/role filters. No DB DDL/DML or certified flight modification. Read-only PG18 Neon fixture tests: 283 flights 776,891.84 CZK on pages 1/2, ULL 229 flights 562,812.84 CZK, synthetic CZK/JPY/KWD and failure states PASS; Statistics 13 registrations/261 price sources SQL PASS. Targeted automated Node24/typecheck/build/Playwright still NOT RUN; branch remains non-production until verified.


## 15 Oct 2026 — 3.8.0 production hotfix (data only): CZK for all historic rates and active flights

Product owner explicitly confirmed historical denominations as CZK and authorized completion on 25 aircraft, 33 rates and 315 active flights. First updated 25 aircraft, 33 rate rows and 203 unlocked flight rows; then safely completed 112 protected rows (110 certified plus 2 locked-only). Full transactional PostgreSQL18 rehearsal on isolated production-derived Neon child; production prechange checkpoint retained; only three exact currency fields amended per protected flight with complete row audit and 112 explicit owner-attributed maintenance events. **Postflight PASS**: 25/25 aircraft CZK, 33/33 rates CZK, 315/315 flights CZK; guard re-enabled; 110/110 certified + 112/112 locked preserved, hashes/revisions and all other columns unchanged in 112/112 audited comparisons. No new certification revision or app deploy. Narrow explicitly authorized maintenance exception to D2; future unknown currency still fails closed. Four user accounts covered by global product-owner attestation, not four independent account-owner attestations. Signed-in page refresh pending. [Detailed report](docs/operations/2026-10-15-czk-historical-backfill.md).


## 15 Oct 2026 — FlyTally Logbook 3.8.0 RELEASED: Neon v21 migrated, PR #338 merged, Vercel READY

**Owner C0 production GO and risk waiver:** owner explicitly authorized the live v21 migration/deployment after accepting a release without a new independent off-Neon backup. This does NOT provide independent disaster recovery. Preserve historical Neon snapshot, same-project safety checkpoint `br-shiny-bonus-b1gqt9u7` and other original branches. Independent signed historical account-v13 recovery remains unproven; source-provenance independent reviewer verdict remains pending and should not be claimed approved.

**Exactly executed:** canonical Neon production project `muddy-dust-14049657`, default primary `br-raspy-fog-b1btvu5t`, `neondb` PostgreSQL18.6, direct `ep-proud-bar-b1ts6cq1`. Before migration registry v1–20, zero v21 columns/checks, 315 flights, 33 rates, 25 aircraft, 24 backups, 3 archived voids, 12 provenance, two flight-protection triggers. Source `tooling/v380-v21-migrate.sql`, Git blob `4abc32a9430943affaaa836e6737ad7b1c9021f4`, was parsed into **16 SQL statements** (psql wrappers removed and exact `expected_database=neondb` bound), executed within ONE Neon database transaction on the explicitly verified **production** branch. **Production v21 migration PASS**. Independent read-only postflight PASS: registry exactly v1–21, 12/12 exact nullable/no-default fields, 4/4 validated CHECKs, 2 preserved triggers, historical new fields all NULL. All **7/7** pre/post whole-row content digests of existing flight/rate/aircraft/expense/account_backups/certified-void/provenance data match (legacy money rows compared with new NULL columns removed); row counts preserved.

**Actual Neon PG18 rehearsal before production:** production-derived isolated child `br-square-fog-b1lb1igm` received the exact same 16 source statements transactionally; 12 columns, 4 checks, 21 migrations and certified/provenance hashes PASS. It remains a nondefault rehearsal child; do not delete or alter without owner cleanup authorization.

**Application release:** [PR #338](https://github.com/filipto861/flytally-logbook/pull/338) marked ready, merged into `main` at `a76ab8987514ff6ff398df8e8fb18edebc3c220e`; `package.json` and `package-lock.json` release version **3.8.0**. First Vercel build `dpl_SU8hEX8fcnLiUDdkACNAx2qyjufm` **ERROR** during TypeScript check of the Node-only `.mjs` integration harness, *after app compilation*, not a runtime incident. Narrow test-file-only `// @ts-nocheck` exemption at `tests/v380-off-neon-archive.test.ts` was applied on `main` commit `4123b9fa72a51806d37ce8c21334823ded886708` to avoid TypeScript attempting to type-check untyped Node-only MJS modules; **no production app runtime logic changed** in that fix. Vercel production deployment **`dpl_GWWkMe8hiwxJYWMaJpV8betBRXur` READY**, source `main@4123b9fa`, domain aliases include **`fly-tally.com`**. The prior `main@dcc8ebbf` Vercel deployment remains a known legacy rollback code candidate; schema v21 is additive, so rollback is application-only, never destructive DDL. Scoped Vercel runtime error lookup for the new deployment/window returned no errors. This is not complete authenticated production browser smoke.

**Test evidence scope:** prior 3.8 currency owner-local targeted PostgreSQL16/typecheck/full Node 1555/1555/Next build/authenticated desktop+mobile Playwright 8/8 PASS on `42e72909`; frozen v20 app on v21 H4 browser 8/8 PASS on `b23f9b99`; encrypted PostgreSQL18 synthetic backup/restore and 11/11 new targeted security tests PASS on `a3f2a7b0`; exact production PG18 migration and row-hash postflight PASS at release. Do not claim a new complete full-suite/Playwright run on `4123b9fa`: not run. Network-dependent public HTTP smoke from assistant environment was blocked; user-authenticated **post-deployment browser/UI smoke still PENDING**, explicitly not PASS. If it reveals a regression, investigate logs and consider *application-only* rollback preserving v21 and certified history.

**Release status:** DATABASE MIGRATION PASS; PR MERGED; VERCEL PRODUCTION READY, version 3.8.0 deployed; final owner manual authenticated smoke/opening core pages remains a follow-up. Independent full off-Neon recovery, signed historic v13 proof and external reviewer approval not claimed. Source code and primary production DB retained; no delete/restore/switch.

## 15 Oct 2026 — owner backup-waived 3.8.0 accelerated release PREPARED; PG18 real-schema rehearsal PASS, live C0 GO NOT YET GIVEN

**Owner decision (2026-10-15):** explicitly accepted accelerated v3.8.0 release **without new independent off-Neon backup**, including the risk of not recovering the most recent production changes after provider/data disaster. This supersedes the *off-provider backup as a mandatory prerequisite* in older planning, but **does not create the backup**, certify its functionality, waive exact production-target checks or itself authorize live production DDL. Retain all existing checkpoints and snapshots without deletion. No paid branch protection requirement (previous owner N/A decision).

**Read-only production verification on 2026-10-15:** Neon project `muddy-dust-14049657`, canonical primary/default `br-raspy-fog-b1btvu5t`, direct compute `ep-proud-bar-b1ts6cq1`, `neondb` PostgreSQL18.6, exact v20 registry 20 rows, v21 monetary columns 0, new CHECKs 0; flights 315, rates 33, aircraft 25, expenses 0, account_backups 24, archived certified voids 3, source provenance 12, existing flight-protection triggers 2. **Vercel production `DATABASE_URL` inspected without disclosing its secret**: production target points to the exact unpooled endpoint `ep-proud-bar-b1ts6cq1.c-5.eu-central-1.aws.neon.tech/neondb`. Vercel live production deployment `dpl_HTHj1v1rq5kojpMafUfEekdgrBwi` READY, source `main@dcc8ebbfda0eadfa01345cd875ef1db806a19e26` and `fly-tally.com` alias confirmed. Draft [PR #338](https://github.com/filipto861/flytally-logbook/pull/338) remains mergeable/unmerged on base `dcc8ebbf`.

**Exact SQL Neon PG18 rehearsal:** created explicitly nondefault/nonprimary **isolated child** of canonical production `br-square-fog-b1lb1igm` named `ft-380-v21-exact-sql-final-rehearsal-20261015` with small 0.25 CU read-write compute `ep-calm-queen-b1s6re03`. Verified clone registry v1..20, v21 cols0, protected/flight/rate counts matching production before any rehearsal DDL. Fetched **`tooling/v380-v21-migrate.sql` from exact PR candidate** and stripped only `psql` metacommands/explicit BEGIN/COMMIT, binding `expected_database=neondb`; its remaining **16 exact SQL statements** (advisory lock, strict registry/source guards, four ADD-column tables, four constraints, registry 21 and postflight DO) ran **atomically in one Neon SQL transaction ON TEST CHILD ONLY — PASS**, no errors. **Read-only postflight on child:** registry exactly 21 with name `source-backed currency exact-money`, 12/12 nullable/no-default correct-type monetary columns, 4/4 validated CHECKs, historical money fields newly added remain NULL (all four tracked tables zero modified rows), flight counts315, aircraft25, rates33, expenses0, account_backups24, protected archived voids3, provenance12, protective flight triggers2. Whole-row SHA-equivalent MD5 aggregate digests of certified-void and provenance records **identical between child and separately queried production** (`35b568...` and `65f93c...`), scope selected protected tables only. This is a real Neon PG18 rehearsal against a production-derived clone, not production v21 deployment; direct `psql -f` execution itself was not performed. **Preserve rehearsal child** pending owner disposition: no branch deletion authorized.

**Other exact-SHA local evidence:** candidate full Node 1555/1555 + desktop/mobile Chromium 8/8 on `42e72909`; actual old v20 app over v21 schema 8/8 on `b23f9b99`; local encrypted synthetic PG18 11/11 and full restore PASS on `a3f2a7b0`. All separately scoped and not universal current-HEAD reexecution. Unverified historical signed-v13 real recovery and independent source provenance still remain risks; do not claim source/backup regulatory approval. Current HEAD since application acceptance contains tooling, tests and documentation; PR has 103 files, requiring diff/merge scope confirmation before deploy.

**NEXT: explicit separate C0 production schema migration GO**, with SQL source and target rechecked just-in-time, then ONE transactional v21 production DDL, read-only postflight/legacy/protected digest validation while v20 app remains live; stop on any drift. Only after C4 PASS merge PR #338 and verify Vercel READY SHA, production route smoke. Recovery remains app-only rollback to v20; never delete audit evidence or reverse additive schema on error. **At this timestamp: NO LIVE DDL, NO MERGE, NO 3.8.0 DEPLOY.**

## 15 October 2026 — owner-local R1-D security and full synthetic PG18 PASS; development handoff (unreleased)

- Owner ran exact `a3f2a7b0af13f849d3ff291eb04819f4751f71b1` on Windows: targeted tests **11/11 PASS**, no failures/skips. Synthetic PostgreSQL18 on fresh isolated port 53662 passed valid/invalid SCRAM auth, custom `pg_dump -Fc` **2,806 bytes**, signed immutable v2 manifest, full AES-GCM decryption/authentication, `pg_restore --list` **2 TABLE + 2 TABLE DATA**, atomic restore to second synthetic database, source/target row-digest equality, and owned cluster shutdown/removal: **SYNTHETIC PG18 ENCRYPTED BACKUP/RESTORE PASS**.
- This supersedes older `NOT RUN`/TOC/parser failure for the **tested synthetic path only**, preserves historical failures. R1-B/C implementation and scoped R1-D owner-local test acceptance complete; user requested stopping repeated acceptance loops to resume new feature development. Closeout: `docs/product/3_8_0_LOCAL_TECHNICAL_CLOSEOUT_AND_FEATURE_HANDOFF_2026-10-15.md`.
- **No actual Neon production export, independent real-data restore, v21 DDL/merge/deployment or final DeepSeek R1-D verdict.** Draft PR #338 remains unreleased/frozen, current `main`/production data untouched. Independent features can proceed separately from v20 main; no implicit merging of this Draft.

## 15 October 2026 — TOC parser corrects TABLE versus TABLE DATA (staged, unreleased)

- Owner-local prior checkout f765c438: targeted 10/10 PASS, PG18 binary check PASS; synthetic PostgreSQL18 SCRAM valid/wrong-password behavior, custom pg_dump 2,806 bytes and full AES-GCM authentication PASS. End-to-end test FAIL before SQL restore on TOC count; owned cluster stopped.
- Replaced overly broad TABLE prefix regex with explicit PostgreSQL custom archive TOC parsing: distinguish TABLE definitions, TABLE DATA row payload, TABLE ATTACH metadata; validate format and extensions and fail closed on malformed entries. Added 11th regression with realistic sample and invalid cases, plus actual count diagnostics. Independent pure JS fixture PASS. Owner 11-test suite and end-to-end PG18 retest NOT RUN after changes.
- No Neon production export, encrypted production backup, actual-data restore, v21 migration, merge or deployment. Draft PR #338 stays NO-GO.

## 15 October 2026 — Off-Neon backup R1-B/C remediation implemented, unreleased and UNTESTED on Windows

- Added `tooling/v380-backup-manifest.mjs`: immutable manifest schema v2, per-archive salt and domain-separated HMAC-SHA256 distinct from AES-GCM, constant-time verified MAC, deterministic nested JSON representation and refusal of unsigned legacy/forged metadata. Production export now signs immutable source identity/data evidence/cipher digest; restore verifies manifest before trusting it, authenticates full GCM tag before SQL, and stores a separate non-authoritative `.verification-*.json` receipt only after actual-data clean shutdown.
- Added `tooling/v380-windows-private.mjs`: SID-based NTFS directory restriction before any sensitive write, private short-lived bootstrap password file, real-data `initdb -A scram-sha-256` with random per-run password, mandatory wrong-password refusal, random loopback only, encrypted-volume operator acknowledgment; backup export directory ACL secured.
- Added `tooling/v380-backup-toc.mjs`: authenticated custom-format `pg_restore --list` inventory over stdin without DB connection, fail-closed physical table/extension checks in actual restoration. Kept atomic `pg_restore --single-transaction --exit-on-error`, Node `pipeline()` backpressure and original source pre/post monitoring limitations.
- Updated synthetic PG18 end-to-end test to exercise private Windows ACL + SCRAM positive/negative auth, HMAC-signed manifest and TOC, with same existing full AES-GCM and DB content validation. Archive unit suite expanded from 7 to 10 tests incl wrong key/tampering/swapped archive/legacy v1 refusal and 12-MiB slow writer stress. Added real-data SIGINT fail-closed handling and refusal of symlink archive paths.
- **Only source syntax/readback verified for current batch. Actual Node targeted 10-test suite, Windows PG18 SCRAM/ACL end-to-end, independent DeepSeek R1-D exact SHA review and real production backup/restore NOT RUN.** Previous 7/7 + synthetic PG18 PASS belongs to `9d26c2cb` only. PR #338 Draft; no production DDL/merge/deploy.

## 15 October 2026 — independent backup/recovery security R1 review reconciliation (documentation only)

- Received owner-supplied read-only DeepSeek review and checked findings against current branch. Confirmed B-1 (`initdb -A trust` for real decrypted records) and B-2 (unauthenticated JSON manifest), M-1 (unbound pre/post MVCC snapshots; selected hashes only); captured NTFS ACL and least-privilege concerns.
- Corrected two reviewer premises: `decryptArchive` already uses Node `pipeline()` with built-in backpressure; `pg_restore --single-transaction --exit-on-error` is intended fail-closed and should not be weakened to partial recovery for convenience. Still require extended payload stress and extension/role object inventory.
- Added `docs/product/3_8_0_OFF_NEON_SECURITY_R1_DISPOSITION_2026-10-15.md` with explicit B1/B2 patch scopes, immutable manifest MAC domain-separation contract, SCRAM Windows credential/temporary data constraints, independent re-review, and owner GO gates.
- **NO runtime changes or test PASS caused by R1 documentation itself; R1-B/C/D PENDING.** Production export, actual off-provider backup/restore, historical signed-v13 proof, Neon DDL, merge and deployment NOT RUN. Existing owner-local synthetic PG18 PASS stays scoped to tested `9d26c2cb` code.

## 15 October 2026 — external backup PG18 synthetic end-to-end ACCEPTANCE PASS (owner-local, unreleased)

- Owner ran on exact SHA `9d26c2cb6d01dcf596f64dd6186fbc300323c8ae`: encrypted archive/security/fast-child test suite **7/7 PASS** (0 fail/skip); separate actual PostgreSQL18 synthetic backup→AES-256-GCM full authenticate→single-transaction restore script **PASS**. PG18 test used fresh random localhost port 62750, two disposable synthetic databases, exit-0 custom `pg_dump` payload 2,806 bytes, record/hash comparisons and verified 10/10 local shutdown/cleanup. No Neon credentials, production flight records or user data involved.
- Root cause of previous `pg_dump exit 0, empty stdout` addressed by connecting bounded `PassThrough` immediately after child spawn; success now verified by both targeted runtime regression and real owner-local PG18 fixture.
- Subsequent read-only production-restore source inspection found `pg_ctl` stdout/stderr captured on Windows, retaining old inherited-pipe hang risk outside synthetic runner. Adjusted `tooling/v380-off-neon-restore-check.mjs` to use `stdio:"ignore"` for `pg_ctl`, handle its unique private PID on failed startup and report own PG log. Added static source regression; **these follow-up changes NOT YET OWNER TESTED**.
- **No production export, real external encrypted backup, historical production PostgreSQL18 data restore, account signed-v13 recovery, Neon DDL, PR merge or deployment.** Draft PR #338 and release NO-GO until independent security R1 and subsequent recovery evidence.

## 15 October 2026 — pg_dump exit=0/empty stdout race reproduced and fixed in staged encrypted backup code (NOT YET RUN)

- Owner `d1cc5b91` tests: AES-GCM/format/security **5/5 PASS**, actual isolated PG18 synthetic test **FAIL** at stage 05, `pg_dump exit 0` yet streamed **0 bytes**, stderr empty. Test-only PG18 stage10 stop/cleanup reported; no live backup/export.
- Independently reproduced short-lived child stdout loss in Node (no database): delayed stdout consumption during async key derivation yields empty data, synchronous `PassThrough` attachment before waiting preserves `PGDMP`.
- Added `retainChildStdout(child)` in `tooling/v380-backup-archive.mjs`: bounded 64KiB in-memory PassThrough with source-error forwarding/backpressure, connected immediately after pg_dump spawn and before asynchronous `scrypt` in both actual production export and synthetic runner. Binary source still never written as an unencrypted dump file; PGDMP magic, exit status, AES-GCM tag and restoration evidence remain mandatory.
- Added regression for fast exiting child and order invariants in both callers; updated existing safety assertions to use `bufferedDump`. V8 syntax/GitHub source readback PASS; actual owner-local Node tests/PG18 Windows synthetic end-to-end **NOT RUN after patch**. Off-Neon production export and full signed v13 historical restore remain blocked; no production SQL/Neon/branch/merge/deploy. Draft PR #338 remains NO-GO.

## 15 October 2026 — synthetic PG18 encrypted backup stage-05 failure triaged (fix NOT YET EXECUTED)

- Owner cleanly removed three abandoned synthetic PG18 folders after stopping verified test-only PostgreSQL. On code `c0d6f2d4`, 4/4 crypto/source regression tests PASS; isolated synthetic PG18 reached stage 05/10 then **FAIL** `Encrypted database archive unexpectedly small`. Logged stage 10 owned PG18 shutdown/cleanup without warning; no PASS for PostgreSQL dump→restore.
- Analysis: `v380-backup-archive.mjs` imposed arbitrary ciphertext minimum (header+GCM tag+1024) before callers could read `pg_dump` process exit/stderr. Either an unusually short valid compressed test dump or a failed/empty child could trigger it; original error does not distinguish them. 
- Replaced 1024-byte threshold with streaming **nonempty plaintext and optional PGDMP signature** validation (chunk-safe); AES-GCM authentication and exact ciphertext size retained. Both production export and synthetic driver now require exact PostgreSQL custom-format signature; actual child exit/stderr surfaced on error and archive never marked complete on failure. Added tests for tiny signed payload, zero payload and invalid signature plus source diagnostic guards. **New tests/PG18 rehearsal NOT RUN**; only source syntax readback verified.
- No production Neon DB access/export/restore, v21 DDL, merge or deploy. PR #338 remains Draft, release NO-GO until synthetic runtime test & independent reviewer and recoverability gates.

## 15 Oct 2026 — synthetic PG18 local test failure: pg_ctl ETIMEDOUT (investigation)

Owner reported last PG18 synthetic test **FAIL**, exact console `SYNTHETIC PG18 CHECK NOT PASS: pg_ctl failed: spawnSync C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe ETIMEDOUT`. Concurrent targeted encrypted-archive tests **3/3 PASS** and PostgreSQL18 binaries `check` PASS, but **actual pg_dump→restore integrated synthetic gate remains FAIL/NOT VERIFIED**; no production connection/export/migration. That run's console had **no** newly staged `[PG18 synthetic] 00/10...` progress labels, indicating it ran an older script revision (or at least not the GitHub code with those labels); successful `git pull --ff-only` had reported `Already up to date` before later GitHub source changes appeared.

**Likely Windows issue, not yet confirmed:** old synchronous `pg_ctl start` captured stdout/stderr pipes while the child `postgres.exe` inherited open handles; `spawnSync` may wait on them despite `pg_ctl` exiting, then report ETIMEDOUT. Current script sets `stdio:"ignore"` specifically for `pg_ctl`, has 00–10 progress markers and bounded timeout. Follow-up hardening adds test-folder path printing; if `pg_ctl` fails but this *exact test folder's* `postmaster.pid` exists, `finally` attempts to stop **only the owned test server**; reads only that folder's `postgres.log` for diagnostic evidence; on uncertain startup leaves path explicit for manual investigation rather than deleting unknown running data. Added source regressions. These fixes are **GitHub source-only; NOT owner-tested yet**. No production DB actions performed.

**Owner next (no deletion or new test until read-only orphan check):**
```powershell
git pull --ff-only
git rev-parse --short HEAD
Get-ChildItem -Path $env:TEMP -Directory -Filter 'flytally-380-pg18-synthetic-*' | Select-Object FullName,LastWriteTime
Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -match 'flytally-380-pg18-synthetic-' } | Select-Object ProcessId,CommandLine
```
If a matching PostgreSQL process is running or the temp directories remain, inspect source logs and safe shutdown before rerun; do not `Stop-Process` indiscriminately or remove potentially live PGDATA. If no remnants, rerun `node tooling/v380-off-neon-pg18-synthetic-test.mjs` on pulled HEAD and report stage/error. This is synthetic-only. Release still NO-GO, independent security review & historic signed backup recovery OPEN, live backup remains NOT RUN.

## 15 October 2026 — backup security pre-review hardening and synthetic PG18 full restore test (NOT YET RUN)

- Owner-local evidence at `4a88bae0`: archive roundtrip/tampering/source guards **3/3 PASS**; all PG18 client and restore/server tools `check` **PASS**. No production dump/restore yet.
- Hardened off-Neon export and isolated restore to scrub inherited libpq `PG*` and `DATABASE_URL` (including `PGHOSTADDR`/service overrides); local restore pins `127.0.0.1` host+host address explicitly. Separate **full AES-GCM tag pre-authentication** before any decrypted archive bytes are passed to an SQL interpreter. Verified restore manifest now finalized only **after** local PG18 stop/removal. Export now detects monitored schema/count/protected row-hash drift before/after pg_dump.
- New `tooling/v380-off-neon-pg18-synthetic-test.mjs` builds disposable synthetic PG18 data on random loopback port, exercises actual custom `pg_dump -Fc`→AES-GCM→authenticated preflight→`pg_restore --single-transaction`, compares synthetic data, and cleans owned test resources. Added contract assertions for those guards. Wrote read-only DeepSeek security handoff and updated off-provider backup operating protocol.
- **No post-fix owner runtime tests yet; synthetic PG18 end-to-end NOT RUN; independent security review PENDING.** No production export, snapshot change, DDL, merge, deployment or data migration; PR remains Draft/NO-GO.

**15 Oct 2026 — off-Neon backup prerequisite owner-local result.** On source SHA `08fbe547558016c7807bf0dc5c83a40fc4eea51f`, owner ran `npm run test:target -- tests/v380-off-neon-archive.test.ts`: **3/3 PASS** (AES-GCM roundtrip, tampering/wrong password, fail-closed source/target guards; 0 fail/skip). `node tooling/v380-off-neon-export.mjs check` **BLOCKED** safely before any database connection/export: `PostgreSQL 18 pg_dump not installed` at `C:\Program Files\PostgreSQL\18\bin`. **No production export, no encrypted backup, no restore.** Small follow-on safeguard adds `initdb`, `pg_ctl`, `createdb` to PG18 local prerequisite check and a test assertion, code SHA `74665cc1cc2a9a2acbcbc46331272110bf4aa210`; not yet owner-tested. Next: install official PostgreSQL 18 server and command line tools alongside 16 (separate port, retain 16 service), `git pull --ff-only`, rerun 3 tests and `check`. Do not run `export` before independent security review and confirmed prerequisites. Backup/recovery release gate remains OPEN; production unchanged.

## 15 October 2026 — staged encrypted off-Neon v20 backup/PG18 restore tooling (NOT executed against production)

- Added `tooling/v380-backup-archive.mjs` for streaming AES-256-GCM + scrypt encrypted custom-format `pg_dump` data, unique salt/nonce and authenticated tag, no plaintext archive materialization.
- Added `tooling/v380-off-neon-export.mjs` requiring operator-local Node24 + official PG18 binaries, masked exact unpooled Neon production URL, TLS `verify-full`/system CA/channel binding, production read-only v20 schema proof, unique non-overwriting encrypted backup under `%LOCALAPPDATA%\FlyTally\PrivateProductionBackups`, SHA256+nonsecret provenance/selected count/history hash manifest.
- Added `tooling/v380-off-neon-restore-check.mjs` requiring masked passphrase and named local-restore confirmation; it validates ciphertext integrity, starts **its own** ephemeral localhost PG18 and restores archive into an isolated database via binary stdin with atomic `pg_restore`, verifies v20 registry/table/row/count/certified-void/source provenance digests in UTC, and stops/removes its own test cluster when safely stopped. No Neon restore actions.
- Added `tests/v380-off-neon-archive.test.ts` for binary AES roundtrip, wrong-key/cipher tampering and source/target fail-closed guards; new operational recovery protocol and independent review handoff `docs/product/3_8_0_OFF_NEON_BACKUP_RECOVERY_PROTOCOL_2026-10-15.md`.
- **Only source/readback syntax checks PASS; no runtime crypto unit tests, PG18 tooling checks, production pg_dump, real backup archive, isolated PG18 pg_restore or historical signed-v13 proof run yet**. Any pass is future owner evidence, not inferred. Current Neon primary/app/main untouched; PR Draft, release NO-GO. Earlier H4 8/8 locally PASS separately.

## 15 October 2026 — frozen production v20-on-v21 H4 acceptance PASS (owner-local, unreleased)

- Exact SHA `b23f9b99e4327412204af74d2e42d2d9dbe33bf9` tested on owner Windows host. H4 static source gates **4/4 PASS**; fresh isolated PostgreSQL16 exact loopback identity verified; canonical schema-first v20/v21 applied with registry version 21, twelve new currency fields and four CHECK constraints.
- Detached actual Vercel production application `dcc8ebbfda0eadfa01345cd875ef1db806a19e26` built successfully with Next.js 16.3.2 (41/41 static pages; TypeScript PASS); authenticated desktop/mobile **8/8 Playwright PASS (1.1 minutes)** including frozen old-route read/write and Trash scenarios. Native runner's post-check completed before `LOCAL H4 PASS`; temporary PostgreSQL server stopped.
- npm reported a retried `@img/colour` tarball integrity warning but `npm ci` completed successfully; **not an H4 failure**. Earlier H4 NOT RUN status is historical and now superseded for this exact SHA.
- **Scope limitation:** disposable PG16 fixture and synthetic data, not Neon PG18/production restore; no historical signed-v13 genuine backup recovery, independent off-provider disaster recovery or final third-party source review performed. No production SQL/DDL, application deployment, migration, GitHub merge or production data mutation. PR #338 Draft; release NO-GO.

## 15 October 2026 — H4 frozen production v20 rollback test infrastructure (unreleased; NOT RUN)

- New `tooling/run-currency-380-h4-v20-rollback-local.ps1`: creates/validates and later removes an exclusively owned disposable localhost PostgreSQL16, applies exact v20+v21 canonical SQL with v21 registry and shape checks, checks out immutable Vercel-production `dcc8ebbfda0eadfa01345cd875ef1db806a19e26` application into a temp detached worktree, installs its dependencies and compiles actual old Next code, and exercises the old worktree's own browser Trash-integrity test together with targeted authenticated H4 reads on desktop/mobile. The extra test-only v20 aircraft/rate workspace fixture columns make the existing narrow browser seed compatible with the frozen v20 database-workspace queries. No old tracked app source is changed.
- Added `e2e/v380-h4-frozen-v20.spec.mjs` for authenticated flight/database reads, synthetic certified record preservation and NULL v21 metadata, plus `tests/v380-h4-rollback-contract.test.ts` for source fail-closed orchestration/frozen-SHA/cleanup checks. Browser retries and server reuse are zero for H4, no production environment allowed.
- **Source-level GitHub readback only PASS; actual Node tests, PG16 fixture, optimized v20 build and Playwright NOT RUN** at code SHA `66e1d7683f1f409a9ac6cc0581586bd3b8124ec2`. Last complete owner-local v3.8 acceptance was on older code SHA `42e72909`. No Neon, production database or deployment touched. Draft PR #338 remains release NO-GO pending executable H4 evidence and independent backups/review.

## 15 October 2026 — owner-approved checkpoint proof branch cleanup

- Deleted **only** PG18 read-proof child `br-lucky-shape-b16omzi4` after owner authorization. Preflight verified exact child-parent relationship, no default/primary/protection, descendants or snapshot dependencies. Neon API deletion succeeded and independent branch inventory confirmed target absent.
- Logbook project now has **5 branches**. Production primary `br-raspy-fog-b1btvu5t` remains READY, current-primary point-in-time safety fork `br-shiny-bonus-b1gqt9u7` remains READY with original parent, and old manual snapshot `snap-proud-fire-b1bm8oac` is retained. No data restore, production schema change, SQL DDL, merge or deploy.
- Earlier scoped PG18 child read/record-count/hash evidence retained in history; functional H4 and off-Neon backup/restore remain release NO-GO gates.

## 15 October 2026 — PostgreSQL 18.6 checkpoint materialization/read verification (local to Neon branch, no restore)

- New **non-production test child** `br-lucky-shape-b16omzi4` created from safety checkpoint `br-shiny-bonus-b1gqt9u7` at matching parent LSN `0/10E02258` with 0.25 CU compute; child READY. Custom suspend-time request was rejected by plan before child creation; retry omitted unsupported override.
- Branch-id-bound **read-only SQL** on test child: v20 migration registry 20, v21 absent, PG18.6, public tables **52**, flights **315**, rates **33**, aircraft **25**, account backups **24**, voided certified **3**, flight-source provenance **12**. Independent current-primary read-only query matched all these counts and whole-row MD5 aggregates for voided-certified and provenance tables. Queries not atomically cross-branch: limited corroboration, not full-database parity proof.
- Safety checkpoint untouched with no compute. **Probe child still exists and should be deleted only with explicit owner approval**; off-Neon portable backup restore and H4 old-app-v21 compatibility NOT RUN, release NO-GO. No production SQL writes, currency DDL, restore/finalize, merge/deploy.

## 15 October 2026 — current-primary no-compute safety fork, branch protection excluded by owner decision

- Owner elected to proceed within existing Neon plan without treating unsupported `protected:true` as release precondition. Missing feature recorded as owner-accepted N/A, **not** protected. Snapshot quota still blocked; existing old-branch manual snapshot retained.
- Live preflight explicitly checked Neon Logbook project `muddy-dust-14049657` primary/default `br-raspy-fog-b1btvu5t`, database `neondb`, v20 registry 20, v21 0 and counts flights 315/voided 3/provenance 12. Created additive **no-compute** checkpoint `br-shiny-bonus-b1gqt9u7`, `ft-380-current-primary-pre-v21-safety-copy-20261015`, from exact current primary at `2026-10-15T08:11:43Z` (parent LSN `0/10E02258`). Read-back verifies `READY`, parent id correct, 0 compute, primary remains unchanged; Logbook 5/10 branches. **No production writes or currency DDL**.
- Recovery contents and realistic restore **NOT VERIFIED**; checkpoint is not a separate external `pg_dump` backup. Frozen production app SHA `dcc8ebbf` source only verified `DATABASE_SCHEMA_VERSION=20` and `version<=` registry filtering; actual H4 v20 app against physical v21 database **NOT RUN**. Keep schema-first release blocked until these controls, reviewer/source disposition and explicit owner GO are satisfied. PR Draft; no merge/deploy.

## 15 October 2026 — approved cleanup of four unused Neon test branches (verified deletion)

- Owner requested removal of old unused Neon branches. Exact identity, archived/non-primary/non-default/unprotected state, idle September compute, snapshot associations and GitHub/Vercel configuration were evaluated before deletion.
- Deleted: Logbook `br-shiny-mountain-b1ye1aqc` (general-PIC acceptance); Training Production `br-proud-smoke-b1ajnja6` (M9 real-seed) and `br-flat-meadow-b1csc4ps` (M9 seed); Training Acceptance `br-purple-feather-b1gl5g43` (no-code acceptance).
- Post-deletion inventories independently confirm **four deleted IDs absent**, 6/10 total org branches remain across projects (4 Logbook, 1 Training Production, 1 Training Acceptance); all three default branches and all Logbook historical recovery points maintained. Kept Logbook SP2 branch because dedicated historical Vercel preview config remains unresolved.
- **Not a currency release:** branch quota is per project; deleting branches did not free separate manual-snapshot or protected-branch plan quotas. Original Logbook manual snapshot unchanged. No production DB queries that mutate data, no v21 DDL, no deployment, no merge. PR #338 remains Draft, release NO-GO.

## 15 October 2026 — owner-authorized Neon snapshot and branch protection blocked by account quotas (no state change)

- Owner explicitly authorized current-primary manual snapshot and `protected:true` on project `muddy-dust-14049657` branch `br-raspy-fog-b1btvu5t`; live default-branch and v20 schema identity reverified first. `create_snapshot` returned **HTTP 422 `snapshots limit exceeded`**: no snapshot created. `update_branch(protected:true)` returned **HTTP 422 maximum protected branches for current plan**: protection not enabled.
- Independent postcheck: Neon production branch READY but **`protected:false`**, sole manual snapshot `snap-proud-fire-b1bm8oac` still from former branch `br-dark-math-b1snjzub`. No snapshot deletion, branch change, live database DDL, restore, merge, Vercel deployment, or production data modification.
- **Release NO-GO** until fresh/current-primary recoverability, protection decision and all remaining operator/historic recovery gates are satisfied. Existing full local four-gate PASS remains valid for unchanged code.

## 15 October 2026 — v21 release target read-only inspection (no deployment)

- Neon project `muddy-dust-14049657`: default/primary `br-raspy-fog-b1btvu5t` READY; explicit read-only `neondb` query PG18.6, registry versions 1–20 count 20, version21 count 0, currency columns 0/12 and CHECKs 0/4; flights 315, rates 33, aircraft 25, voided certified 3, provenance 12. No SQL mutations.
- Neon branch currently reports **`protected:false`**. Only inventoried manual snapshot `snap-proud-fire-b1bm8oac` originates from **old** `br-dark-math-b1snjzub`; the current canonical primary has **no fresh manual snapshot recorded**. Recovery and branch protection are **release blockers** pending owner decisions and evidence.
- Vercel `logbook` latest reported production READY deployment remains from `main` at `dcc8ebbfda0eadfa01345cd875ef1db806a19e26`. Candidate PR #338 not deployed. No snapshots, branch protection, DDL, migrations, merge or Vercel deployments were performed.

## 15 October 2026 — Currency 3.8.0 complete four-gate owner-local acceptance PASS (not released)

- Owner-local Windows/Node24 `run-currency-380-acceptance.ps1 -WithBrowser` on exact code SHA `42e72909b798b8e71d0d9d3e66f551c14aad5931` emitted **LOCAL ACCEPTANCE PASS**. Gate 1: disposable PostgreSQL16 confirmed, TypeScript PASS, static SQL **6/6**, PG integration **9/9**, executable v21 production SQL **5/5**. Gate 2: **1555/1555** Node/source tests, zero failures or skips. Gate 3: optimized Next.js 16.3.2 build PASS, **41/41** static pages. Gate 4: dedicated new disposable PostgreSQL16, canonical schema-first v20/v21 registry/12 columns/4 constraints PASS, authenticated desktop/mobile Playwright **8/8 PASS (2.1 min)**, postflight shape PASS and PostgreSQL server stopped.
- This is **local executable evidence** on the exact application code, **not CI or a production result**. No full real-history signed portable v13 recovery, protected v20 runtime-on-v21 H4 or fresh production Neon backup/restore was established by this run. Draft #338 stays unreleased, no production DDL/merge/deploy or original data changes. Release NO-GO pending independent validation and explicit owner authorization.

## 15 October 2026 — Currency v21 isolated authenticated browser accepted on `694b0793` (local only)

- Owner report from Windows/Node24 exact `694b079384cbadc39aab4c4c0a71effa090e3c9f`: targeted source/guard/signed-backup tests **19/19 PASS**; unique disposable PostgreSQL16 identity confirmed; Next 16.3.2 optimized build PASS (41/41 static); dedicated schema-first fixture prepared canonical v20→v21 with registry count 1, twelve monetary columns and four CHECK constraints.
- **Eight authenticated desktop/mobile Playwright scenarios PASS (2.0 min).** Independent postflight v21 registry/columns/CHECKs PASS, temporary local PostgreSQL server stopped. No current browser regression demonstrated; earlier 0/8 test-environment failure is now superseded for this code SHA.
- **Not yet done:** combined four-gate acceptance (full Node suite), H4 running old v20 app on migrated v21, real-history portable signed v13 recovery, PG18/Neon branch/protection/production snapshot verification, CI, production v21 DDL, merge, release approval or deploy. PR #338 Draft; production unchanged.

## 15 October 2026 — Currency schema-first browser SQL separator repair (unreleased; new SHA NOT TESTED)

- Owner-local `68947b34`: targeted tests **19/19 PASS**; isolated PG16 identity/cleanup, PowerShell-to-Node, harness bootstrap checks and Next optimized build **PASS**; schema-first staging **FAILED** with `syntax error at or near CREATE` before any Playwright test. Previously separate `sql` blocks were concatenated with newlines but without SQL statement terminators.
- Fixed disposable-only `tooling/apply-currency-v21-disposable.mjs` to ensure one trailing semicolon per extracted canonical v20/v21 block; added source regression for this exact failure mode. No application code, production DDL, live DB or deployed services changed. New SHA targeted/browser tests **NOT RUN**. PR #338 remains Draft, release NO-GO.

## 15 October 2026 — Currency browser schema-first fixture correction (unreleased, NOT TESTED)

- Replaced the fragile expectation that the optimized Next server automatically applies v21 in Playwright. Currency-only browser harness now prepares the **verified new disposable localhost PG16 fixture** with the canonical runtime v20/v21 SQL and exact migration registry entries in a single transaction **before starting Next**. It fails closed on purpose/URL/identity mismatch, unexpected v1–v19 history, source SQL drift/interpolation, or an invalid v21 physical postcheck (registry 1, columns 12, validated checks 4). No second approximation of monetary DDL; scripts read `lib/db-optimization.ts`.
- For this dedicated Currency run only, Playwright's `reuseExistingServer` is disabled. Source regression updated to assert protected ordering and explicit preconditions. General authenticated browser harness retains legacy behavior without Currency intent.
- **Not run on new candidate:** targeted source tests, PG16 execution, optimized build, authenticated Playwright, full suite. Previous `40104b91` browser 0/8 remains historic FAIL; earlier PG/Node/build PASS results are tied to their specific SHAs. Application runtime guard, migration SQL, Neon production schema, deployment and user data **not modified**. PR #338 remains Draft and release **NO-GO**.

## 15 October 2026 — v21 browser compiler environment compatibility (unreleased; tests pending)

- Owner-local `40104b9158f4d39b47fd21a468825822b67f3f36`: signed-backup/fixture source **9/9 PASS**, verified ephemeral PostgreSQL16 identity/clean stop; both native Node and currency harness purpose/URL preflight **PASS**, optimized Next 16.3.2 build PASS (41 static pages), authenticated desktop+mobile Playwright **0/8 FAIL**. Same runtime fail-closed error prevents migration and subsequent fixture rows; local acceptance NOT PASS.
- Changed only `lib/db-optimization.ts` runtime v21 authorization call to pass an explicit six-field object built from `process.env.KEY` property access, instead of the whole `process.env` object (possible Next/Turbopack environment-object transform issue). No gate rule, database DDL or runtime migration algorithm weakened. Added source regression ensuring all three allow flags, two Vercel deny markers and exact DATABASE_URL are supplied once. Root cause is still **unconfirmed** until E2E retest; independent reviewer/production GO not completed.
- Prior runtime code SHA test results do not automatically carry forward. Production Neon remains physical v20. No schema, branch/snapshot/protection, merge or deploy changes.

## 15 October 2026 — Currency browser environment fail-closed diagnosis (unreleased, NOT TESTED)

- On owner-local `2dd3a182d84a87ee80c0235a52af1196476852cd`, targeted `v380-currency-signed-backup-schema.test.ts` **9/9 PASS**, disposable PG16 identity verified, optimized Next production build PASS, but authenticated Playwright **0/8 FAIL** again from the same `Currency schema v21 requires approved explicit migration before runtime` error. Moving build after DB/flag setup did **not** resolve failure. Missing explicit `Disposable Currency browser fixture is ready...` line in harness output is evidence that currency-specific opt-in may be missing in the harness, not yet confirmed as root cause.
- Added explicit `--currency-v21` purpose token to the dedicated runner, and native Node environment-inheritance check before build. `tooling/run-auth-browser.mjs` now requires the correct named fixture and purpose flags **before** calling destructive browser bootstrap and strips the dedicated switch before invoking Playwright. Generic D3b browser calls without currency intent remain supported. Added source regression to enforce explicit opt-in, native Node check, correct argument routing and pre-bootstrap fail closed.
- **New diagnostic SHA tests/browser NOT RUN.** Did not modify lib/database runtime guard, released v21 SQL, Neon, or production. Existing Node 1555/1555 and PG 20/20 PASS remain evidence only for previous `4ea4a38a` SHA; no claim of complete new acceptance. Release NO-GO, PR #338 Draft.

## 15 October 2026 — Currency v21 browser test build environment ordering (unreleased, NOT TESTED)

- Owner-local candidate `4ea4a38a` targeted 46/46 PASS, TypeScript PASS, isolated PG16 static 6/6 + native schema 9/9 + executable v21 release 5/5 PASS; full Node **1555/1555 PASS**, local optimized Next build PASS (41/41 static pages). Authenticated Playwright **0/8 FAIL**. The Next server rejected guarded v21 DDL (`Currency schema v21 requires approved explicit migration before runtime`); first browser logins remained at `/login`, subsequent fixtures lacked `flights.price_currency_code`; all eight failed in shared environment precondition, not demonstrated separate application regressions.
- Isolated browser runner compiled Next **before** setting verified ephemeral Postgres URL and all three browser purpose flags, a potential frozen/build-time environment mismatch. `d19995e2106f2492eca23353be95854133765c58` moves `npm.cmd run build` **after** verified disposable database identity, retains build before destructive fixture/bootstrap and Playwright, rejects Vercel-marked environments, and adds regression asserting purpose→DB identity→build→browser order. No production SQL/DB optimizer/guard relaxed or changed. Source-only readback PASS; new runner/test still **NOT RUN**.
- Release remains **NO-GO** pending successful browser/whole acceptance on exact new SHA, H4 real v20-app-on-v21 and operational/provenance/recovery approval gates. PR Draft; no production SQL, Neon/branch, merge or deploy.

## 15 October 2026 — v21 H1/H5 repeat local acceptance, remove duplicated hard-coded ownership counts (unreleased)

- Owner tested `7e0a39d8`: focused earlier failing tests 32/32 PASS, TypeScript PASS, isolated native PostgreSQL16 identity validated and stopped; static 6/6, native schema 9/9, full executable release SQL v21 5/5 PASS. Complete Node suite 1553/1555: the remaining 2 FAIL were hard-coded old module inventory counts (`395` vs new audited `396`) in timezone and 3.7 map source-contract tests. Optimized Next build and authenticated browser NOT RUN, full acceptance FAIL.
- `efcda5dc` removes **only** redundant historic numeric assertions in `tests/timezone-semantics-source.test.ts` and `tests/v370-map-layers.test.ts`; timezone/mapping and satellite-to-browser-risk checks remain intact. Canonical independent full runtime-file audit remains in `tests/development-scope.test.ts`, so module coverage is not weakened. No app runtime or v21 SQL modified. New head tests NOT RUN.
- PR #338 stays Draft. No production database/Neon/branch/backup, merge or deployment changes. H4 real v20-app-on-v21 rollback, independent review and operator/recovery/source release gates remain OPEN.

## 15 October 2026 — R1 H1/H5 local acceptance partial; align development registry and historical E1.5 contract (unreleased)

- Owner-local `e8cf3f1d6f48f9b0b0871399826248c83ad65ffa`: TypeScript PASS, targeted guard/release tests **10/10 PASS**; isolated native PostgreSQL16 identity validated, schema source **6/6 PASS**, native schema **9/9 PASS**, executable v21 release artifact **5/5 PASS**, disposable cluster stopped; full Node suite **1552/1554 PASS**, two legacy infrastructure source assertions failed. Next.js build/Playwright **NOT RUN** because Gate2 stopped.
- Fixed the development module ownership manifest to count **396** runtime files, explicitly classify new cross-cutting `lib/currency-v21-migration-safety.ts` as shared and require persistence-schema/PG and browser tests when changed; added regression for its risk ownership. Updated E1.5 historic runtime filter test to accept `SELECT version,name FROM public.flytally_schema_migrations WHERE version<=${DATABASE_SCHEMA_VERSION}` while still requiring version filtering and v21 shape/name checks. Test/registry-only correction `cc6b58a9d062d3a443a96e7ea6ae4eb4788e6577`.
- **Corrected code tests/full build/authenticated browser NOT RUN**, earlier PG PASS remains bound to old SHA. No production SQL, Neon branch/snapshot/protection, merge or Vercel deploy change. PR #338 Draft, physical production schema v20; H4 and independent review/open release gates remain unresolved.

## 15 October 2026 — DeepSeek R1 corrective runtime migration hardening (unreleased, NOT TESTED)

- Implemented strict local-only, purpose-bound `allowDisposableLocalV21Migration(env)` using dedicated authenticated browser flags, exact 127.0.0.1 address, `flytally` test role, `flytally_currency_test` DB, explicit allowed protocol/non-standard port, no password, and Vercel marker veto. **Do not** indiscriminately reject `NODE_ENV=production`, because local Playwright tests exercise an optimized production-mode Next build on disposable PG16.
- `lib/db-optimization.ts` checks physical v21 against registry21 at boot: exact version21 registry name, 12 correctly typed nullable no-default columns and 4 validated table-specific CHECK constraints; mismatch throws fail-closed. Strengthened complete eight-block draft/release/runtime parity tests, isolated unit denial tests, and actual PG16 runtime-shape SQL probes for registry-only/11-column/3-CHECK drift.
- Production release SQL and historical review draft **unchanged**. Independent reviewer H2 dismissed; H3 unqualified DDL under explicit search path is LOW and deferred rather than widening release SQL surface. H4 old app runtime/schema v21 actual compatibility test still required; no claim of rollback proof. N3 repeated startup failure LOW deferred.
- **New SHA tests/typecheck/build/browser NOT RUN**. Previous local complete PASS belongs only to `4f816527`. Neon canonical production still v20; no live SQL, protection mutation, merge or Vercel deploy. R1 re-review and release safeguards remain open.

## 15 October 2026 — Independent v21 release review intake and accepted-source code packet (documentation only)

- Received DeepSeek's first independent **documentation-only** review of Currency 3.8 R1; reviewer declared no repository/code/cloud access, no exact `path:line` verification and no executed tests. Findings B1-B5/H1-H5 are advisory until source-level reconciliation.
- Read actual accepted `4f816527` code and confirmed procedural current-primary branch-protection/branch-identity risk and code improvements: H1 generic loopback-only v21 runtime opt-in, H3 path hardening, H5 missing schema validation when registry21 already exists; historical v20 migrator filters version21 but runtime rollback remains untested. Noted that an in-DB branch-ID sentinel is cloned with the DB and cannot independently prove Neon identity.
- Added `docs/product/3_8_0_V21_DEEPSEEK_R1_SOURCE_REVIEW_PACKET_2026-10-15.md`: source snapshot from exact accepted SHA with original line numbers, three complete v21 SQL artifacts, migration plan, new tests and relevant runtime/Playwright excerpts for independent code review. **No runtime/SQL/test modifications, no new acceptance run.** Pending independent source review and next approved corrective small batch; PR #338 Draft; production unchanged v20.

## 14 October 2026 — Currency 3.8.0 complete local implementation acceptance PASS (NOT RELEASED)

- Exact owner-local code SHA `4f8165272ff5dc33facdc60af1931f37b97c0303`: targeted 38/38 PASS; TypeScript PASS; native disposable PostgreSQL16 tests **6/6 static**, **9/9 integration**, **3/3 executed v21 release SQL**; full Node **1549/1549 PASS**; Next.js 16.3.2 optimized build **PASS 41/41** in both standard and browser phases; isolated authenticated desktop/mobile Playwright **8/8 PASS**; browser PostgreSQL schema evidence verified exactly one registry21 row, 12 columns, 4 CHECKs. Both localhost PG clusters identity-checked and stopped. **Owner-local, not CI or production**.
- Post-acceptance READ ONLY GitHub/Vercel/Neon identity verified: PR #338 still Draft, `main` and Vercel latest READY `dcc8ebbf`; Vercel production `DATABASE_URL` points to canonical restored Neon `br-raspy-fog-b1btvu5t`/PG18.6/`neondb`, registry v20, 0/12 v21 columns, 0/4 v21 checks, live counts `33/25/315/0/3/12/24` (rates/aircraft/flights/expenses/voids/provenance/backups). Current canonical Neon primary `protected:false`; old snapshot is from the former primary.
- Added `docs/product/3_8_0_V21_LOCAL_ACCEPTANCE_AND_FINAL_RELEASE_GATES_2026-10-14.md` to separate completed local implementation from **pending** independent reviewer, ISO provenance, actual signed-v13 real-history recovery, fresh approved backup, PG18 compatibility and separate owner production DDL GO. No source/runtime/SQL changes, no production schema mutation, merge or deployment. All prior failing test runs remain preserved in history.

## 14 October 2026 — Align legacy browser source-contract assertions with canonical Currency fixture (unreleased)

- On exact `aac5222f7b7757298dd7b9028d465c43d5cbba49`, owner-local fixture test **9/9 PASS**, Gate1 TypeScript and isolated PostgreSQL **6/6 + 9/9 + 3/3 PASS**; full Node **1546/1549 PASS**, three FAIL from obsolete `generate_series(1,19)` assertions in `safety-pilot-pic-sp2`, `v323-auth-browser`, `v340-flight-entry-phase1`. No build/browser gate executed in this rerun.
- Updated those three historical fixture contract assertions, not their aviation/financial behavior, to require canonical v1..19 migration names and ordered registry with no test-only placeholder. No application runtime, SQL migration or production fixture altered. Test-only commits `7c1b7820f690c44cc07b13fe5d9da549606aed75`, `8052f2d427b2d5f73a7f9f766b4bc4aa0722f023`. Source inspection confirmed new assertion strings match fixture; **local targeted/full test, build and browser still NOT RUN on corrected commit**.
- PR #338 stays **Draft**; Neon canonical remains physical v20, no merge/migration/deploy, independent review and owner authorization remain open.

## 14 October 2026 — Repair disposable Currency v21 browser migration fixture (unreleased; retest pending)

- Owner-local full acceptance at exact `d671707d9de30d1710ad7a9944461b4b5e2a3731`: isolated PG16 migration gates PASS (6/6 static, 9/9 integration, 3/3 execution SQL); TypeScript PASS; full Node **1549/1549 PASS**; Next.js build PASS in both standard and browser steps. Authenticated browser tests **0/8 FAIL** (desktop/mobile) at startup with `v21: registry name drift at version 1`; login redirects were only symptoms. Browser database was a separately verified, disposable PG16 instance; shutdown succeeded.
- Root cause: browser bootstrap registered versions 1..19 under generic `browser-smoke-preapplied` names; new v21 runtime correctly validates canonical migration names. A second latent issue: harness applied v21 review-only ALTER/CHECK blocks without atomic version21 registration, creating a partial schema state rejected by strict runtime.
- Replaced the disposable fixture's name placeholders with exact canonical values derived from `lib/migration-plan.ts`, fail-closed on missing/duplicate/out-of-order versions. Currency-specific browser harness now does **not** preapply partial review-only SQL and instead exercises guarded localhost-only runtime v20/v21 migration, followed by independent read-only `1|12|4` registry/columns/CHECK count verification after browser PASS. Added/updated static browser contract tests for all 21 name agreements and no partial draft preapply. Runtime migration, production SQL and v21 protection logic unchanged.
- Source commits `8f23ba24dfa3e033c335d389f6f498ba0ff4ec0c` and `7fe305a4ff53df0d386e1f2ce786f78b9a5c14e9`. **Fixed browser contract and acceptance NOT RUN on new SHA.** PR stays Draft; production Neon canonical branch remains untouched v20. Full acceptance plus independent review/production authority remain open.

## 14 October 2026 — Update historical schema tests for v21 while preserving v20 invariants (unreleased)

- Exact owner-local acceptance candidate `14773c538327c278c9f8ec06047945e636114218`: targeted v21 static source contracts **5/5 PASS**; isolated local PostgreSQL16 typecheck **PASS**, v21 draft static **6/6 PASS**, schema integration **9/9 PASS**, executable release SQL integration **3/3 PASS**. Test cluster confirmed expected ID and stopped. Full Node tests **1546/1549 PASS**: two assertions still expected migration list to end at v20 and one historical v20 certified flight contract incorrectly required `DATABASE_SCHEMA_VERSION=20`. Next build and Playwright **NOT RUN**.
- Minimal **test-only** correction `97a0aebe0099467a0af107adce844f94eb04900c`: migration plan tests now assert preserved v1..20 + explicit v21, partial, pending v21 and fully applied cases; v20 certified voiding contract checks v20 registration and archive guards independent of current highest schema version. No production SQL/runtime changes.
- New SHA source/unit targeted and complete acceptance **NOT RETESTED**. PR Draft; Neon canonical production stays schema v20, no migration/merge/deploy.

## 14 October 2026 — Fix Windows CRLF parsing in v21 static SQL source contract (unreleased)

- Owner-local `npm run typecheck` on `3cb1eeb74d6f99f40e18d3e871c5b11b377bd7c4`: **PASS**. Targeted v21 release contract: **4/5 PASS**, first check failed `0 !== 4` because regex expected exactly LF (`\n`) in an ALTER TABLE block but SQL has Windows CRLF (`\r\n`) on checkout.
- Test-only commit `3f7b685bb6dad158b5f71f6d922b20360c110510` changes the parser to accept `\r?\n`, preserving all eight draft/executable/runtime SQL parity assertions. Source comparison on repository LF and simulated Windows CRLF found 4 ALTER and 4 CHECK definitions; all eight matched both release SQL and runtime. **Corrected local test and full acceptance NOT RUN**.
- No migration SQL/runtime functionality change, no Neon SQL, PR merge or Vercel deploy. Next owner reruns targeted static then consolidated local acceptance.

## 14 October 2026 — Block unsanctioned runtime v21 migration on real databases (unreleased, untested)

- Applied fail-closed guard in `lib/db-optimization.ts` before any version-21 DDL transaction: if version21 is pending, runtime throws unless the environment explicitly marks disposable local PostgreSQL and `DATABASE_URL` hostname is loopback. The normal production path requires a separately approved schema-first SQL migration that has **already written registry version 21** before v21 app code is deployed. No remote schema upgrade may silently originate from application startup.
- Added static source contract for the guard. Neither this code SHA nor the earlier v21 release SQL candidate has passed local TypeScript/Node/PG/build/browser acceptance yet. No production SQL, deployment or merge.

## 14 October 2026 — Stage guarded Currency v21 release tooling and new integration tests (unreleased, unverified)

- Added explicit SQL `tooling/v380-v21-preflight.sql`, `v380-v21-migrate.sql`, `v380-v21-postflight.sql`. The migration copies exactly the established 12 nullable/non-defaulted columns and four CHECKs, guards exact v20 registry/protection, rejects any partial v21, uses bounded statement/lock timeout and advisory transaction lock, inserts v21 registry in the same transaction, and validates the result before commit. Expected DB passed explicitly; Neon branch must be separately verified.
- Registered version 21 `source-backed currency exact-money` in `lib/migration-plan.ts` and `lib/db-optimization.ts`, including exact additive runtime DDL and fail-closed precheck. Corrected a generated source-insertion defect in a follow-up commit before acceptance. Historical version 1–20 untouched. Kept review-only `sql/drafts/3_8_0_currency_v21_additive_candidate.sql` unchanged.
- Added four static source/parity tests plus three native disposable PostgreSQL16 release artifact integration scenarios; updated `tooling/run-currency-m2a0-local.ps1` to run them after its existing fixture test with an isolated-loopback-only environment flag. Static read-only comparison found source parity 4 ALTER + 4 CHECK and one runtime registration. **TypeScript, Node, PostgreSQL, build, browser on NEW SHA NOT RUN.**
- No production DDL, Neon branch operation, merge or deploy. Draft PR #338. Owner's approved canonical Neon production remains `br-raspy-fog-b1btvu5t`; separate migration execution GO required.

## 14 October 2026 — Owner retains restored production branch; prepare reviewed v21 migration sequence (docs only)

- Owner explicitly accepted Neon branch `br-raspy-fog-b1btvu5t` as canonical production. Former `br-dark-math-b1snjzub` and snapshot `snap-proud-fire-b1bm8oac` retained; no reverse branch swap. Fresh read-only current primary and Vercel DB hostname/database checks agree.
- Two-branch repeat inventory: identical row counts/content hashes on **52/52** public tables at the measurement moment. Production schema still registered v1–v20, with 0 of 12 target currency columns and 0 of 4 v21 CHECKs. Existing main/production Vercel app remains `dcc8ebbf`; no v21 SQL, merge or deploy.
- Added `docs/product/3_8_0_V21_EXACT_PRODUCTION_MIGRATION_PLAN_2026-10-14.md`: targeted preflight, new snapshot on current primary, no finalizing restore test, separate reviewed explicit SQL/registry + v21 runtime support, atomic DDL before deployment, postflight content checks, smoke, stop/rollback. **DESIGN ONLY**, execution artifact/runtime code not yet implemented and not approved. Existing local acceptance `0192570a` remains source baseline but will need rerun after migration code changes.

## 14 October 2026 — Controlled-release snapshot verification caused unexpected Neon production branch swap (OPEN incident)

- Pre-migration manual snapshot `snap-proud-fire-b1bm8oac` created from Neon original `production` primary `br-dark-math-b1snjzub`. A `restore_snapshot` attempt with `finalize:true` unexpectedly reassigned production primary/default branch and its original compute to restored `br-raspy-fog-b1btvu5t`; former branch remains preserved, no data deletion executed. This was **not** an intended or separately approved topology change. Release immediately **STOPPED**.
- Live read-only post-incident verification: Vercel prod database hostname is the Neon endpoint now serving the restored branch; the former branch has a distinct compute. Row counts and deterministic content hashes for **52/52 tables match** on both branches at the time of testing; no observed content drift. This does not establish zero service interruption or future equality.
- Incident documented in `docs/product/3_8_0_NEON_SNAPSHOT_RESTORE_INCIDENT_2026-10-14.md`. **No v21 migration, application deploy, PR merge or further production writes performed**. Local full acceptance on prior `0192570a` remains valid for unchanged application code. Require explicit owner approval of retained new primary vs separately managed restoration before continuing.

## 14 October 2026 — Currency 3.8.0 owner-local acceptance PASS; controlled release outstanding

- On exact SHA `0192570a240dc3473b6dea15c7908a15e7ee16d8`: targeted share 6/6; TypeScript PASS; static SQL 6/6; disposable PG16 9/9; full Node 1544/1544; Next build PASS with 41/41 static pages; authenticated desktop/mobile Playwright 8/8. Both temporary local PG servers stopped. Local-only evidence, no CI or production test.
- Read-only production preflight: Vercel READY/main `dcc8ebbf`; Neon PG18.6 registry versions 1–20 contiguous, no v21 fields/constraints. Counts rates/aircraft/flights/expenses/deleted/backups 33/25/315/0/8/24.
- No release authority provided, v21 remains unregistered REVIEW candidate, no production DB/deploy/merge. Protect verified backup and historical evidence, approve migration and registry sequencing before deployment.

## 14 October 2026 — Align aircraft sharing source-contract test with SQL aliases (unreleased)

- Owner-local complete Currency 3.8.0 acceptance ran on exact `f1a3b63ab533d7521c64319e50058d8ec0f4edf6`. TypeScript **PASS**, static v21 schema checks **6/6 PASS**, native disposable PG16 **9/9 PASS**, full Node source/unit **1543/1544 PASS**; one failing source-contract regex at `tests/v380-currency-share-integrity.test.ts:87`. PostgreSQL cluster on `127.0.0.1:56397` stopped cleanly. Because Gate 2 failed, Next.js build and authenticated desktop/mobile browser gates **NOT RUN**.
- The test expected contiguous unqualified default rate columns although the original sender query correctly selects `a.default_price_currency_code,a.default_price_currency_minor_units`. Source assertion fixed in **test-only** commit `82c3efeabff9c4a52937e939eaf2214f0aa2f283`; all remaining assertions of the same test were checked against the live PR source as a read-only text match. **Full Node and combined acceptance have NOT been rerun** on corrected SHA.
- No implementation, production schema, migration registry, deployment or merge change; PR #338 Draft. Next owner-local targeted test followed by combined full acceptance.

## 14 October 2026 — Correct PostgreSQL test harness for exact-recipient sharing conflict (unreleased)

- On exact `dc9b217477d4bd2b213c553656a270cffc7ad810`, user-local `npm run typecheck` **PASS**. Combined local acceptance Gate 1: temporary PostgreSQL16 `127.0.0.1:62277` identity verified; v21 static tests **6/6 PASS**, native integration **8/9 PASS**. The ninth new sharing-conflict test failed with PostgreSQL syntax error at `INSERT INTO`, because the test's `rows()` helper embeds its input in `FROM (...) t` and is designed for SELECT, not a standalone INSERT. Temporary server stopped. Later full Node, production build and authenticated browser **NOT RUN**.
- Minimal test-only fix at `2709b47f2648fb1977cd2a9dd1339ee0bc74dea5`: use existing `run()` to execute top-level `INSERT ... RETURNING id` and assert no returned ID, then retain exact-recipient immutability and KWD exact-upsert assertions. GitHub diff: test file only, 2 lines replaced. **Corrected integration test NOT YET RETESTED**, no feature/SQL/runtime changes.
- ROADMAP/CHANGELOG evidence updated; PR #338 Draft, v21 remains unregistered, no production Neon/Vercel changes. Next gate: repeat combined local acceptance on exact new HEAD.

## 14 October 2026 — Preserve strict type narrowing for exact shared dry rates (unreleased)

- Owner-local standalone `npm run typecheck` at `340ab061dc1375ef1d436086025b20c45fb810f9` failed TS2322 on `lib/aircraft-sharing.ts:71`; TypeScript could not prove that `dryDecimal` obtained from a generic object was `string|null`.
- Minimal source guard in `31960d5794ba368524ac6a2990aa1bb107bc734d` rejects any non-null nonstring before returning typed payload; malformed values do **not** silently become null. Matching isolated `tsc --strict --noEmit --lib es2022` typecheck PASS; repository-wide `npm run typecheck`, other tests/build/browser **NOT RUN** on corrected source.
- No production DB mutation, migration registration, merge or deploy. PR #338 Draft; next standalone local typecheck followed by consolidated acceptance.

## 14 October 2026 — Correct failed acceptance at TypeScript `TS2552` (unreleased)

- User ran owner-local `run-currency-380-acceptance.ps1 -WithBrowser` at exact `3f9efa0accc68492d9ba45fb2022f67b104dfbee`: disposable PostgreSQL16 identity on port `49235` verified; `npm run typecheck` **FAIL** `TS2552` line 71 of `lib/aircraft-sharing.ts`. Isolated cluster shut down correctly, no later acceptance stages ran.
- Root cause: `dryPriceDecimal` returned as an undeclared shorthand although `dryDecimal` is the validated local variable. Minimal one-line fix `dryPriceDecimal:dryDecimal` in source SHA `5705254cae1d1b952a4dcee8cd389adcffb54214`. GitHub compare from failing SHA reports one line added/removed in that file only.
- Corrected source **NOT YET TYPECHECKED / ACCEPTED**. Next check `npm run typecheck` first in owner-local environment, then entire combined acceptance on a known current SHA. No production migration, merge or deploy.

## 14 October 2026 — Fix TypeScript parser stop discovered by owner-local Currency acceptance

- Owner-local exact `4093fd34` combined acceptance started a verified disposable PostgreSQL16 on `127.0.0.1:64768` and stopped at **typecheck TS1128**, `lib/aircraft-sharing.ts:137`; all later stages **NOT RUN**. Database identity matched; isolated server shut down cleanly.
- Corrected an extra `}` closing `parsed.defaults` on source line 118, one-line syntax patch in commit `965c8988dd3ea1d2556cd2b0a4d756d080ae6bde`; no behavior or database change intended. A direct GitHub compare to previous HEAD confirmed **only** `lib/aircraft-sharing.ts` changed (1 addition/1 deletion).
- New commit local/CI typecheck, tests, build and browser **NOT RUN**; PR #338 stays Draft, v21 unregistered, no Neon/Vercel production mutations. Complete owner-local acceptance must be rerun on corrected HEAD.

## 14 October 2026 — Currency sharing and signed recovery hardening candidate (PR #338; NOT YET VERIFIED)

- Owner froze one coherent implementation block, one full acceptance and one controlled release. Source edits staged through application-code SHA `ff22625b40f06faeb32b574d17cec14bb9bafaa6` on Draft PR #338; no new branch/production change.
- Added versioned v2 exact aircraft-rate sharing and explicit legacy-unknown v1 compatibility in `lib/aircraft-sharing.ts` and `app/(protected)/connections/aircraft-share-actions.ts`. Sender includes actual source money tuple; receiver writes all fields together and conditional legacy conflict cannot mutate a recipient's existing exact metadata. UI displays exact currency or 'currency unknown' and reports skipped conflicting legacy rates, no invented CZK.
- Validates derived DOUBLE cache against decimal source in `lib/currency-rate-snapshot.ts`; no unapproved epsilon/guess-based conversion.
- Added signed-v13 backup semantic monetary preflight in `lib/portable-backup.ts` before preview and execution in `lib/account-restore-v6.ts`, preserving all-null legacy unknowns and distinguishing JSONB numeric archive tokens from NUMERIC string values; fail-closed on partial/wrong scale/currency/contradiction.
- Added `tests/v380-currency-share-integrity.test.ts`, `tests/v380-currency-backup-evidence.test.ts` and an isolated PostgreSQL import conflict case. These are **IMPLEMENTED, NOT RUN**. Prior 1533/1533 acceptance belongs only to older `669708fe` SHA. Current code typecheck, tests, build, Playwright, production smoke **NOT RUN**.
- v21 SQL remains unregistered; PR Draft; no Neon production DDL/DML, GitHub merge or Vercel production deploy. Next: one full `tooling/run-currency-380-acceptance.ps1 -WithBrowser` at exact HEAD, fix any proved regressions, then owner-controlled migration/release gate.

## 14 October 2026 — Currency source-level pre-release review and independent AI handoff (Draft #338)

- READ-ONLY inspected exact `ab4aff5a` source: identified that aircraft sharing sends legacy Number-only rates and recipient ON CONFLICT updates legacy price fields without exact monetary metadata; confirmed stored dual-amount validator checks each field's validity but not legacy-vs-exact amount consistency. Runtime new SQL needs physical v21 ahead of deployment while migration registry remains v20. These are unshipped **release blockers** and require independent validation/targeted tests.
- Created [review + independent DeepSeek handoff](docs/product/3_8_0_CURRENCY_PRE_RELEASE_INDEPENDENT_REVIEW_HANDOFF_2026-10-14.md) with source paths, frozen D1–D4, minimal M3/M4 milestone design, acceptance matrix and distinctions between source facts and NOT RUN checks. DeepSeek review **NOT YET RECEIVED**.
- No runtime/test/SQL modifications, no new tests run, no Neon branch/DDL/DML, no merge/deploy. PR remains Draft; earlier `669708fe` application acceptance and isolated PG18 rehearsal remain scoped historic evidence.

## 14 October 2026 — v21 temporary-Neon PG18.6 migration rehearsal (unreleased; Draft #338)

- Owner-authorized temporary child of Logbook Shadow production created and verified as nonprimary/nondefault: `ft-380-v21-pg18-rehearsal-20261014` (`br-gentle-glade-b1erhgaj`, parent `br-dark-math-b1snjzub`). Database `neondb`, PostgreSQL **18.6**, initial contiguous migrations v1–v20, no v21 columns/checks.
- Applied review-only SQL from Draft #338 (four additive ALTER TABLE operations and four conditional CHECK blocks) in one connector transaction with v20 guard. **PASS**: all 12 columns nullable with no default, four CHECKs `convalidated=true`; existing cloned data row counts preserved (rates 33, aircraft 25, flights 315, expenses 0, deleted flights 8, backups 24), new metadata remains NULL. Reapplied same eight SQL statements with no error (**idempotency PASS**). Migration registry unchanged v20.
- Separate read-only production check: still v20 with no proposed v21 columns/checks; identical counts. The attempted PG18 synthetic temp-row CHECK probe was **BLOCKED by tool safety** and therefore **NOT RUN**; no negative-write PG18 acceptance claim. Local PG16 8/8 tests remain distinct evidence. No real Neon JS SDK application or wide historical signed-v13 restore proof.
- Deleted the exact temporary branch after confirming its nonprimary/nondefault ID and parent; independent branch listing confirmed absence, original four branches unchanged. **No production DDL/DML, no registered v21, no merge, no release/deploy**. See [detailed report](docs/product/3_8_0_CURRENCY_V21_NEON_PG18_REHEARSAL_2026-10-14.md). New docs-only commit automated tests **NOT RUN**.

## 14 October 2026 — Currency 3.8.0 local acceptance complete and production read-only preflight (Draft #338)

- Owner Windows combined `tooling/run-currency-380-acceptance.ps1 -WithBrowser` on exact `669708fec856f5e88072a474f2b97b573a7881f6`: TypeScript PASS, draft v21 SQL source **6/6**, native disposable PostgreSQL16 **8/8**, full Node **1533/1533**, optimized local Next.js build PASS, authenticated desktop/mobile Playwright **8/8** including exact KWD/JPY Trash and scoped signed stored-v13 round-trip. Local database identities matched; both test clusters stopped safely. This is **local**, not CI or live release evidence.
- Separate assistant **read-only** Neon production catalog/config preflight: `Logbook Shadow` project `muddy-dust-14049657`, branch `production`/`br-dark-math-b1snjzub`, database `neondb`, PostgreSQL **18.6**. Registry v1–v20 contiguous; 12 draft v21 monetary columns and four constraints not present. Vercel `logbook` production `DATABASE_URL` endpoint host/database compared in memory to the matching Neon production compute `neondb`: MATCH, with no credential disclosed or settings changed.
- No changes to runtime, SQL registration, user data, remote DDL/DML or deployment. Migration rehearsal/PG18 production applicability, broad historical certified/void/share/backup coverage, ISO provenance caveat, owner go/no-go, merge and deploy remain open. PR stays Draft. This **documentation-only** follow-up does not change the tested code tree; new docs HEAD full acceptance **NOT RUN**.

## 14 October 2026 — Currency combined acceptance SQL test reconciliation (Draft #338)

- Owner-local `a9c01c1c` combined acceptance: TypeScript PASS; static schema 6/6 PASS; verified isolated PostgreSQL16 8/8 PASS; full Node source/unit suite **1532/1533** (one stale `tests/flight-expenses.test.ts` assertion); build/browser not reached in this fail-fast invocation. The independent browser 8/8 PASS remained verified on that exact previous SHA.
- Updated the source regression to require the exact `to_jsonb(e)->>'amount_encoding'` and typed `amount_minor_units` projection with original expense identity, owner scope and date fields, rather than rejecting a v20-compatible SQL query. No runtime or DB change.
- Current new HEAD targeted/full tests/build/browser **NOT RUN**; production v21 SQL remains an unapplied/unregistered candidate. Draft PR, Neon and release untouched.


## 14 October 2026 — signed v13 desktop restore browser completion diagnostics (Draft #338)

- Owner-local `afe862a6`: isolated PG16 identity verified, local optimized Next build PASS, authenticated Playwright **7/8 PASS**. D3b/GPS and KWD/JPY Trash desktop/mobile PASS; signed v13 mobile PASS. Desktop signed-v13 exhausted overall 30s test timeout while SQL polling returned no flight row; no application error/success was captured, so persistence outcome remains unknown.
- Limited whole-test timeout extension to **90s for signed v13 workflow only** (includes download, Trash, protection backup and atomic restore). Test now waits up to 45s for explicit Server Action success or diagnostic error *before* querying exact restored KWD and expense values, and bounds final DB verification at 10s. Added source regression guard. No application, auth, database schema or monetary runtime changes.
- Latest HEAD unit, PG, browser and build **NOT RUN**. Production migration v21 unregistered; PR stays Draft.


## 14 October 2026 — Signed-v13 preflight fixture and protected GPS deletion browser follow-up (Draft #338)

- Owner browser on exact `4e0975f5`: optimized Next build PASS; isolated PG16/browser **5/8 PASS**. Signed v13 HTTP 401 fixed: real browser downloaded backup and proceeded to restore preview; desktop/mobile preview failed because browser fixture `fstd_sessions` lacked `record_revision` (not an established production schema defect).
- Updated disposable FSTD table to mirror the canonical certified-correction optimizer columns `record_revision`, `correction_reason`, `correction_opened_at`, `correction_opened_by_user_id`; added source contract regression.
- One desktop D3b GPS track deletion timed out after 5 seconds with DOM row still visible. Updated its browser test to separately wait for persisted deletion and refreshed UI, retaining the signed pre-restore backup/remaining-track checks. No claim that the previous deletion persisted or failed; next run must determine this.
- New HEAD TypeScript, unit, PostgreSQL, browser and build **NOT RUN**. No migration v21 registration, production DB action, merge or deployment.


## 14 October 2026 — Signed v13 authenticated download test fix (Draft #338)

- Owner-local Playwright on `a3f0d809`: **6/8 PASS**; both desktop/mobile failures were the signed v13 `page.request` download GET returning HTTP 401. Existing D3b and monetary Trash UI flows passed, no runtime or PostgreSQL failure reported.
- Changed signed backup scenario to use the application **Download** link in the real authenticated browser and parse the browser-downloaded JSON byte stream, with a same-origin GET diagnostic. Preserved real session checks and guest HTTP 401 in `app/api/backups/[id]/route.ts`; no auth relaxation.
- Added source guard for the protected download endpoint and UI coverage. Latest exact HEAD unit/browser/full acceptance **NOT RUN**; no schema registration/migration/merge/deploy.


## 14 October 2026 — Currency acceptance browser failure triage (Draft PR #338)

- Owner-local acceptance of `5957261f`: PostgreSQL16 schema 8/8, complete Node tests 1528/1528, TypeScript/Next builds PASS; authenticated Playwright 3/8 PASS, 5/8 FAIL. Combined gate correctly failed.
- Fixed direct `flight_expenses.amount_encoding` / `.amount_minor_units` SELECT on v20 flight detail using optional `to_jsonb` metadata extraction.
- Opt-in 3.8 browser runner now installs the standalone v21 review DDL **once after disposable PostgreSQL bootstrap**, before Playwright. Existing D3b/legacy cases continue with NULL metadata; no change to production auto-migrations.
- Split KWD/JPY and signed v13 test registrations/IDs by desktop/mobile to prevent real duplicate-flight guards being triggered by prior project, and wait for a strictly newer manual backup ID.
- Added diagnostic errors for signed v13 backup HTTP download and recovery preflight/action failure; root cause of previous v13 HTTP failure remains **UNVERIFIED** until rerun.
- Current branch-head tests/build/browser **NOT RUN**. Production Neon, migration and deployment untouched; v21 remains unregistered. A passing browser suite is still required.


## 14 October 2026 — Currency v13 recovery schema guard and browser acceptance (Draft #338)

- Added explicit v21 compatibility preflight before both signed v13 exact restore preview and execution; detects exact monetary metadata in ordinary and archived records and refuses recovery when any required target schema column is missing. All-NULL legacy metadata is not converted to a guessed currency.
- Corrected double-escaped rate-decimal regex in currency-bearing Trash runtime that would reject valid values such as `1234.125`. Added unit/source regression cases.
- Added 3.8.0 authenticated desktop/mobile browser scenarios to verify exact KWD/JPY Trash restoration and signed stored v13 backup download/restore. Preserved the 55 original browser contracts and their frozen historical run evidence; registered four new canonical browser targets.
- Added `tooling/run-currency-380-browser-local.ps1` creating and shutting down a dedicated local PG16 cluster; consolidated acceptance now supports optional `-WithBrowser`.
- All tests/build/browser on latest HEAD **NOT RUN**. Earlier owner-local PASS at `46d8b184` only. Production v21 migration **NOT REGISTERED**, no remote DB changes, no merge/deploy.


## 14 October 2026 — Currency-aware atomic Trash restore (Draft #338)

- Added a v21 archive restore path within the existing one-transaction flight, GPS track, expense and archive-mark CTE. Restore preserves precise source rate decimal/currency/exponent and per-expense encoding/minor units; existing v20 legacy statement remains intact.
- Read-only preflight validates available v21 columns and ISO currency precision, and the SQL candidate matches preflight archive digest to reject concurrent archive changes.
- Added source contract guards and two new disposable-PG test cases for exact restoration and full rollback on malformed expense metadata. New code/test HEAD NOT RUN; signed portable v13 end-to-end, authenticated browser and production preflight NOT RUN. v21 unregistered, no merge/deployment.


## 14 October 2026 — Disposable PostgreSQL monetary restore contract tests

- Added v21 exact JSON flight/expense restore round-trip and atomic rollback-on-invalid-expense integration tests in the existing isolated PostgreSQL harness.
- Current exact commit tests NOT RUN; runtime Trash does not yet restore currency-bearing records and remains fail-closed. No registered v21 migration or production change.


## 14 October 2026 — Currency exact account restore expense identity (Draft PR #338)

- Recorded local PASS at previous `59a8f861` (typecheck, PostgreSQL16 6/6, static SQL 6/6, full 1518/1518 tests, Next build).
- Changed exact restore expense matching to compare raw persisted minor integer text with explicit encoding/scale, rather than Number coercion; reads metadata via to_jsonb for pre-v21 compatibility. Added source contract regression tests.
- New HEAD tests, end-to-end signed v13 restore, browser, production DB and deploy NOT RUN. v21 unregistered.


This is the canonical record of **what actually changed** in `flytally-logbook`.

- `ROADMAP.md` is forward-looking and may contain planned work.
- `FEATURES.md` is the capability inventory.
- This file records merged/product changes and must not describe planned work as completed.
- Historical PR/version labels are preserved even where old release numbering was inconsistent with package metadata.
- From 4 October 2026 forward, canonical product releases use numeric `MAJOR.MINOR.PATCH`; see `docs/product/VERSIONING.md`.

## 14 October 2026 — Currency acceptance regression reconciliation (Draft PR #338)

- Owner-local at `83e7c54d`: typecheck PASS; disposable PostgreSQL16 6/6, static M2 checks 6/6 PASS; full suite 1511/1518 PASS (7 FAIL); build NOT RUN. Ephemeral database stopped; no production DB accessed.
- Preserved canonical `FlightForm` prop order with new explicit currency preference; reconciled historical source tests with registered unexecuted `sql/drafts` path, extended flight expense insert/price snapshot tuple, and nullable-v21-aware legacy Trash checks. Genuine non-null currency-bearing snapshots remain excluded from v20 restore writer.
- Latest HEAD tests/typecheck/build/browser NOT RUN; PR #338 still Draft, no v21 registration/merge/deploy.

## 14 October 2026 — Currency default-query typing correction (Draft PR #338)

- Corrected two unsupported Neon query type assertions in Aircraft and New Flight pages. Both queries now treat settings rows as untrusted `Record<string,unknown>` before passing the currency through source-backed ISO validation. No runtime DB behavior change.
- Owner-local consolidated acceptance at `e26812bd` stopped on exactly two TS2352 errors. Disposable PG16 identity verified and cluster stopped; targeted PG test suite, full tests and build were NOT RUN in that attempt. Corrected branch HEAD verification NOT RUN.

## 14 October 2026 — Currency cross-surface integrity fixes (Draft PR #338)

- Added strict stored rate currency snapshot validation; manual create/edit and GPS import stop on corrupted exact metadata rather than silently replacing a saved rate. Legacy unknown-denomination rates remain unknown.
- Explicit expense encoding is now required in newly posted expense rows; corrected saved flight expenses to load source encoding and exponent, with 0/2/3 minor-unit and bad-metadata regression cases. Known totals show a warning when invalid expense rows cannot be included.
- Updated legacy Trash restore predicates to allow newly added v21 keys only when their values are null; genuine new-money snapshots still fail closed pending safe restore. Signed backup/restore and production migration NOT RUN.
- Registered one new shared runtime module (395 total); branch tests/typecheck/build/PG/browser NOT RUN on latest HEAD. PR remains Draft and unmerged.

## 14 October 2026 — Currency one-command acceptance workflow (Draft PR #338)

- Added Windows PowerShell 5.1-compatible `tooling/run-currency-380-acceptance.ps1` to execute disposable local PostgreSQL 16 M2 tests, complete Node24 test suite, and local production build with immediate failure stop and exact commit guard.
- Tool only: does not register or execute v21 on remote DB, merge, or deploy. New runner and current implementation branch are NOT RUN; authenticated browser and complete signed v13 restore remain separate release gates.

## 13 October 2026 — Currency consolidated implementation batch (Draft PR #338)

- Implemented source-backed all-monetary ISO currency dropdown in Settings, enforced validated code in both account-setting mutations, and displayed explicit invalid configuration errors; no account preference silently converts stored amounts.
- Removed unsafe global highest-cost sorting and hardcoded CZK claims on legacy-rate flight/aircraft/stats/dashboard/share UI; older cost-sort URLs fall back to newest. Legacy aircraft cost is no longer added to CZK expense totals.
- Added source-contract tests for the ISO selector/server checks and unknown-denomination financial presentation; corrected historic rate-label test and expense test expectation.
- Does not yet persist new currency-bearing rates/flight snapshots or ISO minor-unit expenses. No registered v21 migration, production DB changes, deploy or merge; current exact HEAD tests/typecheck/build/browser NOT RUN. Owner approved fewer integration batches, not relaxing historical, certificate or backup safety.

## 13 October 2026 — Currency M2-A-1 source compatibility audit

- Recorded owner-local PostgreSQL 16 and static M2 test results, each 6/6 PASS at `8a9e03e0`; TypeScript PASS. No full PG regression or signed v13 end-to-end verified.
- Audited `lib/portable-backup.ts`, `lib/aircraft-sharing.ts`, `lib/billing.ts`, isolated v21 draft and PG tests. Identified legacy `numberOrZero`/floating-number rate sharing and billing paths as blockers for future exact currency writes, not a reason to change current legacy behavior.
- Added M2-A-1 review document; no code, SQL registration, DB mutation or deployment.

## 13 October 2026 — Currency M2-A-0 clean-main schema review candidate

- Carried 5 isolated draft/test/harness artifacts from old PR #322 to current main and updated both test-runner branch guards. Candidate SQL remains unregistered, and no new currency UI, migration, SQL execution, data rewrite or deployment was performed.
- Exact-new-branch Node24, disposable PostgreSQL and full suite **NOT RUN**; old source static tests do not constitute real DB acceptance.

## 13 October 2026 — Currency ISO List One owner-attested XML evidence

- Owner-uploaded `list-one.xml` (published 2026-09-17) was compared byte-for-byte by Git blob SHA-1 (`1b8df1be...`) and SHA-256 (`33139b43...`) against pinned PR #337 XML; equal. Owner authorized use and attested download from SIX. This is **not** independent TLS-origin authentication; `verifiedDirectlyWithSIX:false` remains.
- Recorded reproducible evidence in `docs/product/3_8_0_CURRENCY_ISO4217_SOURCE_ATTESTATION_2026-10-13.md`; no runtime or currency data modifications. Owner-local generator check and 1497/1497 tests passed at `ff6fd97e`. Docs-only follow-up SHA not separately tested. No merge/deployment/migration.

## 13 October 2026 — Currency M1-B2 ISO registry staged (unverified)

- Staged the nine existing read-only registry, generation and origin-check files from old draft #321 onto current `main` without enabling a production caller.
- Reconciled two new `lib/` files in explicit `shared-runtime` registry and updated audit count 392→394 with two corresponding source test assertions.
- Source List One XML is an unverified third-party 2026-09-17 mirror; official SIX source parity NOT VERIFIED; no currency selection, FX, historical relabeling, migration v21, DB mutation or production change.
- New branch Node24 tests/typecheck/build/browser/PG: NOT RUN. Next: direct source acquisition, verification and isolated tests before merge.

## 13 October 2026 — Currency M1 exact-money core rebased onto current main (PR #336 Draft)

- Reused exact source blobs from isolated draft #320: `lib/monetary-amount.ts` (`300587c9`) and `tests/monetary-amount.test.ts` (`36171bf1`). Pure, unconnected exact decimal parsing/bigint minor-unit operations and denomination/precision-preserving sums; half-up billing is only an isolated candidate, not a new live business rule.
- Copied the 11 Oct [owner-approved D1–D4 contract](docs/product/3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md) unchanged from documentation draft #319, avoiding any newly inferred decisions.
- Prior exact-blob local Node22 targeted 4/4 and isolated TypeScript 5.8 strict check PASS (documented in #319 M1 implementation handoff); new current-main candidate has not yet been tested end-to-end with Node24. Tests, build, PG, browser, CI, production smoke: NOT RUN on #336 HEAD.
- PR #336 remains Draft, not merged/deployed. No existing application consumer, data write, schema v21 registration, database migration, historical currency inference, FX or Training changes. Separate former #319/#320 source drafts remain open for provenance pending reconciliation.

## 13 October 2026 — D2/D3a/D3b main integration and Vercel production READY

- [PR #334](https://github.com/filipto861/flytally-logbook/pull/334) merged as `0b5a313c032d1e8e27a7be3c4a0b0b0fc8ab5d4c`, including earlier #333 ordinary Trash A+ guard; no Currency v21 migration or FX behavior.
- Vercel production deployment `dpl_ELnrucicsLkVC1Ga1A3EeLANTHef` reports READY and assigns `fly-tally.com`; queried 30-minute runtime error view returned none. Direct HTTP/authenticated production smoke: NOT RUN because DNS/network access from this environment was unavailable.
- Read-only production Neon schema preflight: applied versions v1–v20, required D3b tables and selected integrity triggers. No DB mutation or migration.
- Owner-local 1484/1484 unit, Next build and 4/4 authenticated browser PASS were obtained at earlier code SHA `a027afa3`; only documentation changed afterward. The integration merge SHA has no separately executed local regression suite.
- D3b-1 integration is MERGED/DEPLOYED; overall 3.8.0 and Currency #136 remain OPEN. Prior Draft descriptions below remain historical evidence.

## 13 October 2026 — D3b-1g local acceptance PASS (PR #333 Draft, not shipped)

- Owner-tested SHA `a027afa316d86349ce70d8138b77b524a092ac68`: unit/source **1484/1484 PASS**, Next.js production build and TypeScript **PASS**, authenticated desktop/mobile Playwright **4/4 PASS** with disposable PostgreSQL16 identity `flytally_currency_test|flytally|127.0.0.1|58610`; cluster stopped normally.
- Selected GPS track deletion produced mandatory `pre_restore` backup and preserved the other track/legacy points; ordinary Trash archived remaining GPS and expenses. Pending participation blocked Trash without evidence loss.
- Interim `178affe4` browser 2/4 failure traced to localhost-only `WITH ... DELETE` capture logic; corrected adapter and source regression test in final candidate. Older 0/4 results below remain historical.
- Scope is local app/PG16 only. Real Neon HTTP adapter, historical production DB schema parity and remaining D3b writer paths **NOT VERIFIED**. No merge, schema migration, production DB operation or deploy.

## 13 October 2026 — D3b-1g first authenticated browser failure reproduced; narrow test-fixture and browser-registry corrections staged (NOT RETESTED)

- Owner at SHA `37f60bef92c7f9a49635fcdeca48087bc3ef119f`: full `npm.cmd test` **1482/1483 PASS, 1 FAIL** from static Phase 0C fixed count 53 vs actual 55; Next 16.3.2 optimized build **PASS** (TypeScript, static 41/41). Isolated PostgreSQL16 database `flytally_currency_test|flytally|127.0.0.1|58031` verified, cleanly shut down. Actual authenticated desktop/mobile browser scenarios **0/4 PASS**: GPS deletion blocked at mandatory `createStoredBackup()` because synthetic `airports` omitted `id` referenced by account backup; pending-participation refusal reached `trash=blocked` but test used ambiguous `getByRole('alert')` also matching Next route announcer. No production DB operation.
- Corrected only testing/governance artifacts: `tooling/browser-suite-baseline.json` includes the two new logical Trash acceptance titles (55 total), `tests/browser-suite-structure.test.ts` enforces unchanged first 48 and subsequent 5 map + 2 Trash rather than weakening guard; `tooling/development-modules.json` explicitly registers four new risk-browser targets for flight-records/GPS. Browser fixture now mirrors authoritative preapplied migration shapes: `airports.id`, `fstd_sessions`, `fstd_certified_revisions`, `account_backups` in addition to previous legacy points/expense archive. `e2e/trash-integrity.spec.mjs` scopes application error selector and requires a saved `pre_restore` backup before claiming track deletion. Expanded existing D3b source-contract tests accordingly.
- New corrections **NOT RUN**; source assertion logic was simulated against actual GitHub text and checked 3/3, **not actual Node test evidence**. Last runtime D3b-1f 32/32 PG16, full 1480/1480 and build PASS still refer only to earlier `2fcd9799`. Browser 0/4 on `37f60bef` remains the latest real acceptance until rerun. PR #333 Draft, no merge, schema migration, production DB or deploy.

## 13 October 2026 — D3b-1g browser test credentials isolated (NOT RUN)

- Hardened the new disposable PG16 browser runner to generate fresh, independent process-scoped `SESSION_SECRET` and `SIGNING_SECRET` for each local verification run, then restore the owner's prior process environment. This supports real cookie authentication and the canonical signed pre-track-delete backup without using any real production signing secret. Updated the source contract accordingly. **No credentials, database, server or browser were created/run in this work cycle.**

## 13 October 2026 — D3b-1g isolated authenticated Trash browser acceptance added (NOT RUN)

- Added `e2e/trash-integrity.spec.mjs`, 2 concrete end-to-end flows projected to desktop and mobile: actual signed-in UI removal of one of two legacy-point GPS tracks, preservation of the nonselected track, ordinary Trash UI confirmation and exact persisted archive track/expense counts; and pending participant evidence blocking ordinary Trash with user-visible error and no mutation. Tests use `browserSqlScalar` solely to assert persisted results on local isolated fixture and invoke actual Next.js server actions through Playwright.
- Added `tooling/run-v380-d3b1-browser-local.ps1`, reusing the existing vetted PG16 disposable cluster lifecycle but **never accepting caller DATABASE_URL as the browser test target**. Its unique local cluster uses random port, fresh `flytally_currency_test`, explicit observed/expected identity check, user-input worktree safety, port 3000 refusal, candidate build, local authenticated browser flags and clean temp-cluster shutdown. Existing `run-auth-browser` resets `public` with `DROP SCHEMA ... CASCADE`; its use is constrained to the runner-created disposable cluster. No existing localhost DB/Neon/product DB may be passed to the destructive fixture.
- Completed only the **disposable browser fixture schema** with legacy `track_points` and `deleted_flights.expenses_data`, corresponding to canonical runtime dependencies. Added 3 source-contract tests (`tests/v380-d3b-browser-fixture-isolation.test.ts`) covering runner isolation, fixture shape and live behavior expectations. The new JS files were statically parsed and source-contract predicates evaluated against the GitHub text; this is **not real Playwright/Node/PG execution**.
- **NEW candidate validation status:** TypeScript NOT RUN; full `npm test` NOT RUN (expected previous 1480 + 3 new source tests), authenticated browser 4 cases **NOT RUN**, browser fixture PG16 and Next build NOT RUN. Earlier full 1480/1480, scoped 32/32 and Next build PASS remain bound to old tested source SHA `2fcd9799` and do not certify the new tests/fixture/runner. No runtime authorizations, schema migration, production DB changes or deploy. PR #333 Draft, currency #136 separate.

## 13 October 2026 — D3b-1f follow-on bounded source census and Currency draft discovery (READ-ONLY / NO NEW EXECUTION)

- Reviewed actual current actions after 32/32 native, 1480/1480 unit and build PASS. `updateFlight()` has one conditional parent `UPDATE ... RETURNING` CTE gating expense/crew child operations; `applyGpsTimes()` mutates only owned unlocked parent and does not create/delete track children, though its zero-row outcome is not surfaced. Shared-flight `current_source` materialization requires matching certified revision/hash; optimizer v12 source participation FK and v20 recipient provenance FK were identified. This narrows the next race-check search; it is **not** an executed SDK or complete historical production FK audit.
- Existing authenticated browser runner `tooling/run-auth-browser.mjs` enforces localhost/flags and calls `tooling/bootstrap-browser-smoke-db.mjs`, which **drops the target `public` schema with CASCADE**. **Never run it on an existing local/prod/Neon database**; a unique empty disposable localhost PG cluster is a prerequisite. Existing browser cases emphasize GPS import, certified void and responsive workflow; they do not establish direct A+ ordinary Trash/deleteTrack/expense action coverage. Browser tests NOT RUN in this cycle.
- Located separate `feat/3.8.0-currency-m2a0-sql-draft` with `sql/drafts/3_8_0_currency_v21_additive_candidate.sql` and local/dedicated PG16 test runners; static test requires v21 remains **unregistered** while `DATABASE_SCHEMA_VERSION=20`. Currency/monetary #136 remains a separate product decision and runtime release gate. No data conversion or migration/merge implied. No runtime/tests/schema/deploy action in this read-only classification.

## 13 October 2026 — D3b-1f owner-local full scoped evidence PASS, not released

- Owner on Windows at exact source SHA `2fcd9799f2728ad4769b7930d08bfaf5303b8363` executed `git pull --ff-only` PASS and `tooling/run-v380-d3b1-atomic-trash-local.ps1` on disposable PostgreSQL 16 **PASS**: `tsc --noEmit` PASS; source A+ and writer guard contracts **7/7 PASS**; original native SQL Trash **6/6 PASS**; sequential actual optimizer migration SQL v1→v20 **19/19 PASS** (new selected-only GPS point persistence, Trash-first/delete-first track cases, both expense snapshot orders, locked and foreign-owner safety). Total **32/32 PASS; 0 FAIL, 0 SKIP**. The historical pre-fix GPS child-first **negative control deliberately reproduces unsafe behavior**; its PASS is NOT positive acceptance. Expected/observed disposable DB identity `flytally_currency_test|flytally|127.0.0.1|58874` matched; local cluster cleanly stopped. 14 unrelated untracked files ignored, untouched.
- Same tested SHA owner `npm.cmd test` **1,480/1,480 PASS, 0 FAIL/SKIP** (7.639 s). `npm.cmd run build` Next.js **16.3.2/Turbopack PASS**, compilation (884ms), build TypeScript PASS (2.6s), all **41/41 static pages** generated. `git log -1 --oneline` confirms exact head `2fcd9799`. Results are local only and bounded by exact SHA, NOT CI or deployed runtime proof.
- **Scope:** new track delete and expense transaction behavior passed native source-derived SQL tests. Full historical production-schema parity, authenticated Next.js/Neon SDK transactions, interactive desktop/iPad/mobile light/dark browser and other source/recipient evidence writer races NOT VERIFIED. No schema migration, main merge, production DB write or deployment. PR #333 remains Draft. Supersedes preceding **NOT RUN** only for the stated source SHA; preceding entries remain historical.

## 13 October 2026 — D3b-1f selected GPS track deletion + expense snapshot locking (DRAFT / NOT TESTED)

- Edited only `app/(protected)/flights/actions.ts` writer paths `deleteTrack()` and `saveFlightExpenses()`: `deleteTrack()` preserves its pre-delete backup, verifies selected track ownership, then serializes parent via owned/unlocked `SELECT ... FOR UPDATE` before a selected-only `track_points` DELETE (not all tracks of the same flight) and selected `flight_tracks` DELETE; both child mutations guard the live owned/unlocked parent. Absent/locked/superseded flight becomes a no-op, and native SQL error is logged server-side rather than leaked.
- Expense replacement retains its existing ability to update expenses on locked/certified records (financial metadata remains separate from certified flight facts), but transaction begins with owned-parent `FOR UPDATE` and subsequent `DELETE`/`INSERT` refer to a live owned flight. Zero-row parent lock results in clear conflict feedback; caught write errors avoid raw end-user failures. No automatic FX conversion, no default currency, no migration.
- Added two source-contract tests in `tests/integration/v380-d3b-trash-source-characterization.test.ts` and five bounded native optimizer migration/PG16 tests in `tests/integration/postgres-v380-d3b-migrations-v1-v20-trash.test.ts`: selected-vs-unselected track/legacy point preservation, both deleteTrack↔Trash transaction orders, expense replace↔Trash both orders and locked/cross-user guards. Tests use **source-extracted original writer SQL** and the existing isolated PG16 v1..v20 migration schema; they are not full authenticated Next.js or Neon HTTP adapter tests. Corrected source-extraction action boundaries before any execution. Runner now labels the D3b-1f safety checks.
- **NEW CODE AND TESTS NOT RUN**. Expected isolated runner 7 source + 6 original native SQL + 19 optimizer/native tests = **32 total**, including the previous expected-unsafe pre-fix characterization, which remains distinct from positive safety evidence. Earlier 25/25 targeted, full `npm test` 1480/1480 and build PASS apply only to old runtime SHA `19e195e6`. No production DB writes, schema changes, main merge or deployment.

## 13 October 2026 — D3b-1e follow-up read-only writer census: deleteTrack scope mismatch identified (NOT TESTED)

- Static review of `app/(protected)/flights/actions.ts`: `deleteTrack()` verifies a specific `trackId` but its `DELETE FROM track_points` targets **all** `flight_tracks` with the same owner+flight, whereas the subsequent `DELETE FROM flight_tracks` targets the requested single track. This may discard retained legacy points of other GPS tracks in a multi-track flight. **SQL predicate mismatch confirmed in source; no multi-track runtime reproduction yet and no production data-loss claim.** The action also performs an unlocked parent read, an external backup and later child deletes in a separate transaction; Trash concurrency safety is NOT VERIFIED.
- `saveFlightExpenses()` similarly reads owned flight before an independent expense DELETE/INSERT transaction. A concrete archive-snapshot interleaving is not yet proven; requires isolated two-session test. Mark both as scoped follow-up milestones, do not broadly change lifecycle or silently restore child records.
- This work cycle is **source analysis/documentation only**; no additional runtime code, test results, schema migration, production DB writes or deploy. Previously recorded exact SHA `19e195e6` remains current verified GPS parent-first fix evidence.

## 13 October 2026 — D3b-1e owner-local fix acceptance: 25/25 scoped PG16/source + 1,480/1,480 full unit + build PASS (DRAFT / NOT SHIPPED)

- Owner second Windows PC checked out exact commit `19e195e6daeb739792d8b9b434bf2c2f52dc5f92` and ran `tooling/run-v380-d3b1-atomic-trash-local.ps1` with Node24, isolated native PostgreSQL16: `tsc --noEmit` **PASS**; source A+ and GPS contracts **5/5 PASS**; native actual A+ five-statement SQL **6/6 PASS**; native optimizer migration SQL v1..v20 **14/14 PASS**, including **one pre-fix EXPECTED-UNSAFE negative control**, two new **SAFE parent-first GPS/Trash** interleavings (Trash-first no orphan; GPS-first full track archive). **25/25 executed, 0 fail/skip**; negative-control PASS is reproduced old vulnerability, never safety approval. Database identity `flytally_currency_test|flytally|127.0.0.1|49862` matched expected/observed; disposable server cleanly stopped. 14 unrelated untracked items ignored, untouched.
- Same exact code SHA `npm.cmd test`: **1,480/1,480 PASS, 0 fail/skip**, ~7.65s. `npm.cmd run build`: **PASS** with Next.js 16.3.2/Turbopack, production compile completed, TypeScript passed and **41/41 static pages** generated. These are OWNER-LOCAL results, NOT CI, server runtime smoke or Vercel deployment.
- Scope of proof: the new source-first GPS writer row lock + conditional child write tests and two-session models succeed in the **bounded no-FK** disposable PG16 v1..v20 fixture. It does NOT establish that actual historical production schema is equivalent or that authenticated Next.js FormData/Neon SDK and independent `deleteTrack`/`saveFlightExpenses`/Edit/GPS/provenance writers are safe. No new runtime changes or data migrations in this evidence update. PR #333 stays Draft, unmerged, no production DB operations or deploy.

## 13 October 2026 — D3b-1e baseline orphan reproduction; GPS parent-lock fix and both-order regressions staged (NOT TESTED)

- Owner Windows/Node24 executed the isolated native PG16 runner at SHA `c90c35c3c1aab1a14e0df82db7db097ff8168d23`: TypeScript PASS, A+ source **4/4 PASS**, targeted actual PostgreSQL **6/6 PASS**, optimizer v1→v20 migrated SQL **12/12 PASS** including one **EXPECTED-UNSAFE CHARACTERIZATION**. The baseline test confirms a child `flight_tracks` row without parent FK can commit after Trash deletes the parent, while the Trash archive omits the track. It is **reproduced in the bounded local fixture, not established against actual production historical schema**. Isolated DB identity `flytally_currency_test|flytally|127.0.0.1|64811` exactly matched; PostgreSQL stopped cleanly.
- Added an **untested runtime safety candidate** in `app/(protected)/flights/actions.ts` `attachKmlTrack()`: first query in the entire upload/Replace transaction acquires a row lock on the owned unlocked flight; subsequent Replace children and INSERT are explicitly guarded by a still-existing unlocked parent (no FK dependency), and the final flight UPDATE and INSERT return rows checked by the server action. No changes to `moveFlightToTrash()`, migrations, historical archive schema or unrelated writers.
- Converted the old reproduced risk to a **pre-fix negative control** (still deliberately unsafe, not counted as a safety acceptance). Added one GPS source contract and **two positive PG16 regression tests** (Trash-first gate blocks missing child, writer-first serializes archive and deletion). Updated runner final note to distinguish negative control versus real safety tests. The tests model the source-derived SQL ordering/guards against a deliberately minimal no-FK schema; they are not a full Next.js FormData/SDK integration test.
- **No fresh tests yet** on these runtime/test commits: typecheck NOT RUN, expected 5 source + 6 targeted + 14 migration tests NOT RUN, full npm tests and build NOT RUN, browser and actual Neon SDK NOT RUN. Do not carry forward the earlier 22/22 / 1480/1480 results as proof of the new code. Draft #333 still unmerged; no production writes, migrations or deploy.

## 13 October 2026 — D3b-1e disposable no-FK track/Trash race characterization authored (NOT RUN)

- In the actual v1→v20 native PG16 isolated migration-chain fixture, added one source-tied **analysis-only** two-session test modeling current `attachKmlTrack()` order: unlocked parent check; transaction INSERT into `flight_tracks`, then parent UPDATE. Scenario holds Trash parent FOR UPDATE after snapshot, starts track INSERT against a fixture with no parent FK, observes the writer waiting at parent UPDATE, finishes Trash DELETE, then checks for archival omission and orphan child. New `pg_constraint` assertion fails closed if the fixture gains a parent FK. **No new test execution/PASS claimed.** This is a minimal modeled writer interaction, not the complete authenticated server action or production schema.
- Test title is explicitly `CHARACTERIZATION ONLY`. If the scenario passes, it is evidence of the **unsafe** no-FK fixture behavior, not a passing release safety gate. Updated the disposable runner's final output to warn accordingly. Previous original D3b-1 native **21/21 PASS**, full unit **1480/1480 PASS**, and Next build PASS remain associated only with previously tested code SHAs; new test/runner commit still **NOT RUN**.
- No changes to `lib/flight-trash.ts`, `attachKmlTrack()`, database schema, migrations, production, Vercel or `main`. PR #333 Draft pending owner-local characterization, smallest evidence-based mitigation and repeat acceptance.

## 13 October 2026 — D3b-1 external read-only review received and reconciled against source (ANALYSIS ONLY)

- Received DeepSeek F1–F8 advisory review. The reviewer stated it had read the brief only, **not** the repository or source/schema/test executions; therefore no new defect is claimed proven by the review itself.
- Independently inspected current D3b-1 source and created [finding-by-finding reconciliation](docs/product/3_8_0_D3B1_SECOND_AI_RECONCILIATION_2026-10-13.md). Confirmed A+ uses unconditional parent `FOR UPDATE`, repeated eight relation guards, and operation-token-bound archive/delete assertion. Actual Neon HTTP `sql.transaction([...])` is documented upstream as a single non-interactive DB transaction; this narrows F2/F8 but does not replace an exact v1.1.0 app/SDK runtime test.
- Important reproducible candidate identified: `attachKmlTrack()` checks parent before async parsing, then runs `INSERT flight_tracks` before parent `UPDATE` with no affected-row assertion; disposable native/browser foundational fixtures define tracks **without** a parent FK. Under concurrent Trash parent lock an uncommitted child INSERT might survive after the parent DELETE, or a concurrent track may be missed by archive. **NOT REPRODUCED; live production FK parity NOT VERIFIED.** Next planned D3b-1e is a deterministic isolated two-session characterization test *before any runtime fix*. Other expense/Edit/GPS/participant/provenance writer races require dedicated proof, not speculation.
- No runtime/test/migration/DB/deploy changes made during this read-only reconciliation, and no new PASS asserted; prior 1480/1480, 21/21 PG16 and 41/41 build results remain tied to their tested SHAs. Draft PR #333 not merge-ready.

## 13 October 2026 — D3b-1 current-candidate owner-local native PG16 + production build PASS (DRAFT / NOT RELEASED)

- Second Windows PC on exact branch HEAD `8cf6cb8a5a186cb1e9be21be7607fca7e13731ea`, Node v24.19.0, PostgreSQL 16 binaries installed. `tooling/run-v380-d3b1-atomic-trash-local.ps1`: TypeScript **PASS**, source contracts **4/4 PASS**, original five-statement SQL against disposable native PG16 **6/6 PASS**, original sequential runtime optimizer migration SQL v1→v20 and lifecycle/races **11/11 PASS**. Total **21/21 PASS; 0 FAIL; 0 SKIP**. Isolated temporary DB identity expected and observed `flytally_currency_test|flytally|127.0.0.1|51374` match; server cleanly stopped. Runner reported 14 unrelated untracked files, none modified or removed.
- Same exact HEAD `npm.cmd run build`: Next.js **16.3.2 (Turbopack)** compiled in 3.2s; TypeScript phase completed in 8.6s; 41/41 static pages generated; production bundle optimization completed. **Build PASS locally, not deploy/runtime smoke**.
- Previously owner-verified `npm run typecheck` PASS, targeted participant/roadmap/Windows safety 13/13 PASS, entire `npm test` **1480/1480 PASS** at `ca59d29b54555df9bf545be17ccd71f5998c6a33`; only subsequent documentation updates separate that code SHA from `8cf6cb8a5a186cb1e9be21be7607fca7e13731ea`. Documentation updates do not assert an additional full-suite run at HEAD.
- **Release and safety limitations remain OPEN:** not a full actual historic production database clone; no authenticated Next.js server-action / real Neon SDK transaction proof, no track/expenses/Edit/GPS/no-source-FK provenance concurrency closure, no full browser responsive/iPad/mobile/light/night review, independent second-AI reconciliation or approval to merge. Draft #333 still unmerged, no DB migrations/production write or deployment.

## 13 October 2026 — D3b-1 owner-local TypeScript and full source/unit regression PASS (DRAFT / NOT SHIPPED)

- Owner on Windows/Node24 ran `git pull --ff-only` to exact code candidate `ca59d29b54555df9bf545be17ccd71f5998c6a33`, followed by `npm run typecheck` **PASS** and targeted `npm run test:target` on `v1311-participant-ownership-lapl`, `v1312-hotfix`, `v300-navigation-hierarchy`, `v352-postgres-windows-portability`: **13/13 PASS, 0 FAIL/SKIP**. The participant-owned bypass regression, updated canonical roadmap expectation and Windows `psql -d` argument safety test all pass.
- Same owner-local candidate's `npm test`: **1,480/1,480 PASS, 0 FAIL, 0 SKIP**, reported duration **28,252.4964 ms**. This is the complete `tests/*.test.ts` source/unit command, **not** the separate PostgreSQL integration, build or browser suite. The earlier 1,476/1,480 FAIL and 12/13 FAIL entries below remain historical evidence at their prior SHAs.
- **Remaining gates:** rerun isolated native PG16 D3b-1 A+ acceptance after removal of legacy inline participant deletion, `npm run build`, authenticated Next.js/Neon transaction and child-writer races (track/expenses/Edit/no-source-FK provenance), browser responsive/light/dark and independent review. Earlier PG16 **21/21 PASS** was on older source SHA `83c7aa61bcba1d92c5e2df9b86c790cab4c867e0` only. Draft PR #333 still unmerged; no schema migration/production database/deployment change.

## 13 October 2026 — D3b-1 owner-local corrected 12/13 targeted PASS; Windows -d parser false positive fixed (DRAFT / RETEST REQUIRED)

- Owner retested code SHA `2ad57b22f140cde1ed5fa813a1da0d57cff376a9` after `git pull --ff-only`: `npm run typecheck` **PASS**; `npm run test:target -- tests/v1311-participant-ownership-lapl.test.ts tests/v1312-hotfix.test.ts tests/v300-navigation-hierarchy.test.ts tests/v352-postgres-windows-portability.test.ts` **13 total / 12 PASS / 1 FAIL / 0 SKIP**. All participant-owned A+ protection checks and canonical roadmap checks PASS. Windows portability test failed on a false positive: `["-d",databaseUrl,"-X",...]` was incorrectly interpreted as a positional database URL.
- Only `tests/v352-postgres-windows-portability.test.ts` changed: check **exactly one explicit `-d` option and its paired value**, remove that option-value pair from the token string, and **only then** reject an extra positional `databaseUrl`, `localDatabaseUrl()`, or `url`. Keep the exact `psql --version` non-connection exemption, unparsed-call fail-closed check, and SQL `-c` command-line rejection. Static sanity cases distinguish proper leading/non-leading `-d` from positional URLs, duplicate `-d`, and SQL `-c`.
- **New corrected SHA has NOT BEEN TESTED**, including TypeScript, full `npm test`, native PG16, build, browser and SDK. Historical D3b-1 21/21 scoped PG16 PASS remains bound to `83c7aa61`; full aggregate `npm test` at `707e1a5f` was **1,476/1,480 PASS**. PR #333 remains Draft; no merge, migration or deploy.

## 13 October 2026 — D3b-1 full-unit 4-FAIL triage and protected participant deletion bypass closure (DRAFT / RE-TEST REQUIRED)

- Owner ran `npm test` on Windows/Node24 at exact SHA `707e1a5f66f27f9a5eb9484bda151649ff061eef`: **1,480 tests, 1,476 PASS, 4 FAIL, 0 SKIP**. Full-unit test gate **FAIL**; errors in `v1311-participant-ownership-lapl`, `v1312-hotfix`, `v300-navigation-hierarchy`, and `v352-postgres-windows-portability`. No PostgreSQL/build/browser tests were run in this exact full-unit command.
- Source audit of legacy owner-removal tests exposed `app/(protected)/flights/[id]/page.tsx` `removeParticipant()` inline server action that bypassed `moveFlightToTrash()`, changed `flight_participations.participant_flight_id` to NULL, cleared lock fields, deleted tracks, verifications, certified revisions and parent flight directly. This is **outside the approved A+ ordinary Trash contract** and cannot be preserved solely to satisfy historical source assertions.
- In separate Draft PR #333 commits **removed the independent destructive inline action and its participant-owned 'Remove from my logbook' button**, leaving protected copies read-only to ordinary deletion and displaying an explicit nontechnical explanation. No separate participant-copy retirement flow has been approved. This closure removes a known destructive bypass; it does not establish full database or end-to-end writer parity. Unused inline-action imports also removed.
- Reconciled `v1311` and `v1312` assertions to check canonical source/recipient evidence and absence of the legacy bypass. Reconciled `v300` to the current, post-10-October canonical roadmap without deleting history. Replaced `v352` incorrect count-per-file/leading-`-d` assumption with per-invocation `psql` argv checks that enforce explicit `-d` anywhere in the argument list, prohibit positional database URLs or SQL `-c` text, and fail closed on unparsed call forms.
- Follow-up source scan of all 36 `postgres-*` integration files plus three runtime/browser PG subprocess helpers inspected **45 literal `psql` subprocess calls**. One legacy call is only `psql --version` (no database connection), so the updated Windows portability test now exempts **that exact version-only argv** while continuing to require explicit `-d` for database operations. **This is static review, not an executed `npm test` PASS.**

- **All four edited tests, full `npm test`, TypeScript, new native PG16, build, browser, Neon SDK and UI acceptance NOT RUN for these new commits**. Earlier D3b-1 targeted 21/21 PASS applies only to `83c7aa61bcba1d92c5e2df9b86c790cab4c867e0`. No schema migration, main merge, production DB or deployment.

## 13 October 2026 — D3b-1 owner-local native PG16 A+ targeted acceptance 21/21 PASS (DRAFT / NOT SHIPPED)

- Owner executed `tooling/run-v380-d3b1-atomic-trash-local.ps1` at exact candidate `83c7aa61bcba1d92c5e2df9b86c790cab4c867e0` on Windows/Node24. TypeScript `tsc --noEmit` **PASS**, D3b-1 A+ source **4/4 PASS**, native PG16 five-statement Trash/rollback **6/6 PASS**, actual sequential optimizer migration SQL v1→v20 with A+ evidence and real two-session certification row-lock test **11/11 PASS**, overall **21/21 PASS, zero failures, zero skips**. Disposable PG16 endpoint at `127.0.0.1:65028`, verified expected/observed DB identity `flytally_currency_test|flytally|127.0.0.1|65028`; server stopped cleanly.
- Proven within this scoped schema: clean uncertified draft archives/deletes; linked crew, verification, pending participation, instructor approval, revoked share and source provenance with no source FK block Trash and persist; certified flight excluded; forced post-archive conditional zero-row DELETE raises rollback; competing certification writer waits on parent `FOR UPDATE` before deletion. The test fixture is not an exhaustive historic production clone or an authenticated application/Neon SDK test.
- **Scope of PASS**: the exact `83c7aa61` D3b-1 code candidate only. Full regression, build, browser, iPad/mobile/night UX, source-reference writer races, actual Neon SDK and production-scheme/data parity **NOT RUN**. PR #333 remains Draft; no main merge, v21/schema migration or production deploy. Historical preflight failures preserved below.

## 13 October 2026 — D3b-1 owner-local source PASS; PostgreSQL test loader CRLF failure corrected (DRAFT / NEW TESTS NOT RUN)

- Owner ran `tooling/run-v380-d3b1-atomic-trash-local.ps1` at exact commit `94b4414be134421f073191aebcfef21f8b3a5ea0` (Windows, Node24). **TypeScript PASS, D3b-1 source characterization 4/4 PASS**. Disposable native PostgreSQL16 cluster at `127.0.0.1:62241` passed expected/actual DB identity `flytally_currency_test|flytally|127.0.0.1|62241` and shut down cleanly.
- The targeted integration test failed **before any database cases executed**: source-extraction assertion `Cannot locate exact Trash SQL transaction`. The old extractor searched for a literal LF (`\n`) sequence at the end of `sql.transaction([...])`, while the owner's Windows checkout uses CRLF (`\r\n`). **Targeted and v1→v20 PG16 cases NOT RUN** at this SHA. This is a fixture-source parser failure, not evidence that the A+ transaction failed.
- Corrected **both** A+ PG16 test extractors to scope to `moveFlightToTrash()` and locate the five original SQL templates using a whitespace-tolerant expression, supporting LF and CRLF without bypassing source-contract checks. Static extraction against GitHub source shows 5 SQL statements with either newline convention; new code **NOT RUN**.
- Two pre-existing provenance negative tests were still expecting PostgreSQL trigger exceptions. A+ should reject the archive eligibility *without* a database exception, so these tests now assert successful transaction execution plus unchanged flight, provenance, and Trash state. New assertions **NOT RUN**.
- No runtime product changes in this correction, no migrations, no `main` merge, no production/Neon or deploy actions. Await next owner-local native PG16 run.

## 13 October 2026 — D3b-1 first owner-local runner blocked by duplicate share export (DRAFT / RE-TEST REQUIRED)

- Owner ran `tooling/run-v380-d3b1-atomic-trash-local.ps1` on exact commit `ca5f893b4b697a3157fa0a270a38fbb565a27b26`. **Typecheck FAIL (TS2323/TS2393)**: two exported `ensureFlightSharingSchema()` definitions in `lib/flight-sharing.ts` (lines 12 and 22). Preflight correctly stopped before source/PG16 cases; **D3b-1 PostgreSQL NOT RUN**.
- Source audit confirmed `ensureFlightSharingSchema()` **already existed in D3b-0**. Removed only the extra D3b-1 declaration; `lib/flight-sharing.ts` now byte-for-byte matches the base PR #332 version. A+ `flight-trash.ts` continues to import the existing helper. **Corrected D3b-1 code NOT YET RETESTED**, no PASS claimed, no merge, DB migration or deploy.

## 13 October 2026 — D3b-1 A+ fail-closed ordinary Trash candidate authored (NESTED DRAFT / NOT TESTED / NOT SHIPPED)

- New nested branch `fix/3.8.0-d3b1-atomic-fail-closed-trash` based on D3b-0 Draft #332, after explicit owner approval of A+. `moveFlightToTrash()` uses one `sql.transaction` with parent `SELECT ... FOR UPDATE` before snapshot, no participant auto-unlock, guards on existing independent participation, connected crew, verification, instructor approval, public shares (including revoked legacy rows), source or participant provenance (including source lacking FK), revisions and void identity. Keeps flight/tracks/expenses archive semantics.
- Last SQL statement uses `DELETE ... RETURNING` inside a CTE and an evaluated SQL invariant: an archive marker with zero-row final DELETE raises an exception and rolls the entire transaction back. Success now requires the confirmed deleted row and the archive; denied candidates do not remove flight/child evidence.
- Reuses the canonical lazy `flight_public_shares` table initializer, rather than a new independently maintained DDL. Adds safe blocked/error redirect and flight-detail message, no raw SQL errors. Original certified Void and unrelated repositories unchanged.
- Updated existing D3b source, targeted PG16 and sequential genuine runtime optimizer migrations v1→v20 suites to assert A+ preservation/rollback; added legacy instructor approval, revoked shares, no-source-FK provenance and independent-session certification locking scenarios. New branch-pinned disposable Windows/Node24/PG16 runner `tooling/run-v380-d3b1-atomic-trash-local.ps1` added.
- **NO D3b-1 typecheck/tests/native PG16/build/UI/browser/production smoke RUN; review and execution REQUIRED.** Previous D3b-0 15/15 PASS at `7f87eb76` is historical evidence on a different code snapshot and cannot certify A+. No schema migration, main merge, Vercel or production/Neon DB action.

## 13 October 2026 — D3b-1 A+ owner decision frozen and new branch prepared (DESIGN ONLY / NOT SHIPPED)

- Owner explicitly **approved Option A+**, conservative fail-closed ordinary Trash, after exact D3b-0 owner-local v1→v20 PG16 15/15 PASS at `7f87eb76caa2b90b2a2fdb64ed97a29a8e2b2ac1`. Dedicated nested D3b-1 implementation branch from D3b-0 Draft #332.
- Added [D3b-1 approved transaction and evidence contract](docs/product/3_8_0_D3B1_ATOMIC_FAIL_CLOSED_TRASH_CONTRACT.md), including lazy share-table provision, participant source+recipient evidence, provenance source no-FK, archive/final-DELETE atomic invariant, lock ordering and a source-backed acceptance matrix.
- **At this design milestone** no runtime code, schema migration, unit/native PostgreSQL execution, merging or production deployment; owner approval of semantics is not a test PASS.

## 13 October 2026 — D3b-0 sequential v1→v20 native PostgreSQL integration OWNER-LOCAL PASS (DRAFT / NOT SHIPPED)

- Owner Windows / Node24 executed `tooling/run-v380-d3b-migration-chain-local.ps1` at **exact source SHA `7f87eb76caa2b90b2a2fdb64ed97a29a8e2b2ac1`**. Dedicated native PostgreSQL 16 server `127.0.0.1:65332` reported exact expected database/user/host/port identity `flytally_currency_test|flytally|127.0.0.1|65332` and shut down successfully after tests.
- **TypeScript `tsc --noEmit`: PASS.** Source characterization **3/3 PASS**, targeted real five-statement Trash SQL tests **5/5 PASS**, sequential actual runtime migrations v1→v20 with FK/trigger and safety/race tests **7/7 PASS**. **15/15 scoped tests PASS, 0 fail, 0 skip.** Earlier TS error belongs to the previous SHA; historical entries below preserved.
- **Reproduced on the sequentially migrated, minimal-foundation isolated PG16 schema:** normal Trash cascades away linked draft crew/verification or legacy pending participation without complete Trash child archive; two-session archive → certification → later conditional DELETE leaves a committed archive while the certified flight remains active. Immutable accepted participant provenance rejects deletion and transaction rolls back archive; certified source is excluded from normal Trash.
- **Evidence boundary:** actual optimizer migration SQL v1–v20 and real protective v20 triggers applied, but foundational pre-optimization schema remains deliberately minimal. **NOT** proof of a complete historical production database, external feature migrations, production prevalence, application certification/share writer reachability or production transaction SDK semantics. **No D3b product/runtime fix, schema/prod migration, merge, deploy.** Next: application-writer concurrency/linked-evidence full compatibility matrix, owner decision on fail-closed A+ lifecycle, then separate D3b-1 correction.

## 13 October 2026 — D3b-0 first sequential v1→v20 owner-local attempt stopped at TypeScript (DRAFT / RE-TEST REQUIRED)

- Owner on Windows / Node 24 ran `tooling/run-v380-d3b-migration-chain-local.ps1` at exact commit `f56536a5bee2420a34c4200f77caff63684df2ab`. **TypeScript FAILED (TS2554)** at `tests/integration/postgres-v380-d3b-migrations-v1-v20-trash.test.ts:11`: `randomUUID().replaceAll("-")` lacked the required replacement argument. **No source tests or PostgreSQL runtime cases ran in this attempt; the isolated database was not started.**
- Corrected the expression to `replaceAll("-","")` on the same D3b Draft branch and checked the test file's remaining `replaceAll` calls for missing second arguments. **New code still NOT RUN**. The earlier scoped owner-local native PG16 **8/8 PASS** at `dd0823af65866bd21de87240f304cb5ef4cf0b9e` remains separate evidence; no runtime/DB/production/merge/deploy change.

## 13 October 2026 — D3b-0 v1→v20 sequential PostgreSQL migration test authored (DRAFT / NOT RUN / NOT SHIPPED)

- Added `tests/integration/postgres-v380-d3b-migrations-v1-v20-trash.test.ts`. This test extracts all 20 sets of unmodified runtime migration SQL from `lib/db-optimization.ts`, executes them sequentially with migration registry entries and advisory transaction locks on a dedicated, random schema inside isolated PG16, then verifies effective FK actions, enabled v20 protective triggers and original five-statement Trash SQL.
- Native SQL scenarios cover ordinary and certified flights, connected-crew/verification CASCADE, legacy pending invitation CASCADE, immutable accepted recipient provenance rollback and two-session archive→certify→conditional-DELETE mismatch. All scenarios are characterization of current behavior, not a proposed safe Trash implementation.
- Added `tooling/run-v380-d3b-migration-chain-local.ps1` with exact branch and local DB identity gates, Node24/typecheck/source preflight, original targeted PG tests, sequential migration-chain PG tests, own cluster creation/cleanup and separate test flag `FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE`.
- The foundational tables in this fixture are intentionally minimal: **real v1–v20 optimizer migration SQL** does not mean all historical base schema, external feature migrations or production data are cloned. New typecheck/native PG16 tests **NOT RUN**. Earlier targeted 8/8 PASS applies to exact older SHA `dd0823af65866bd21de87240f304cb5ef4cf0b9e`, not this updated candidate. No product/runtime changes, schema migration, merge or deploy.

## 13 October 2026 — D3b-0 native PG16 targeted Trash/participation tests (OWNER-LOCAL PASS / NOT SHIPPED)

- Owner Windows / Node 24 ran `tooling/run-v380-d3b-targeted-local.ps1` at **exact commit `dd0823af65866bd21de87240f304cb5ef4cf0b9e`**. Disposable native PostgreSQL 16 at `127.0.0.1:54833`; expected and observed identity `flytally_currency_test|flytally|127.0.0.1|54833` **MATCHED**; temporary server stopped cleanly.
- **TypeScript `tsc --noEmit` PASS**, D3b source characterization **3/3 PASS**, native PostgreSQL actual-`moveFlightToTrash`-SQL tests **5/5 PASS**, overall targeted tests **8/8 PASS, 0 failures, 0 skips**.
- Actual five-statement Trash SQL with real v20 protection SQL on a **bounded synthetic pre-v20 schema**: unlinked draft archived/deleted; linked draft `flight_connected_crew` and `flight_verifications` deleted by FK CASCADE without corresponding normal Trash child snapshot; immutable participant provenance rejected recipient draft DELETE and rolled back archive; certified source ordinary Trash did not archive/delete; **two-session archive → other-session certification → final conditional DELETE** reproduced a committed archive entry alongside a still-active certified flight.
- These are **confirmed targeted PostgreSQL behaviors**, not yet proof of the *entire applied production v20 schema* or the *actual certification application's* orchestration/locking. The source SQL currently reports `results[1]` (INSERT), not final DELETE row count; a guard/locking fix remains a release gate. Canonical reachability of linked draft states, third-party evidence semantics and production incidence are not established.
- **Remaining D3b-0 gates:** exact full applied-v20 migration/catalog and constraints, actual entrypoint end-to-end acceptance, participant acceptance and provenance source-reference races, fail-closed option A+ owner decision, updated verification on any future code SHA. **No runtime code change, schema migration, merge or deploy.**

## 13 October 2026 — D3b-0 second owner-local test, source assertion corrected (DRAFT / RE-TEST REQUIRED)

- Owner Windows/Node24 reran `tooling/run-v380-d3b-targeted-local.ps1` on exact commit `d6f421a027d36218f764bb7352bc62ebbe520ff8`. New disposable PG16 cluster at `127.0.0.1:57846`; observed/expected identity matched, server stopped cleanly. **Typecheck PASS**. Source characterization **2 PASS / 1 FAIL**; native PostgreSQL integration **NOT RUN** because the runner stopped at the failed source gate.
- The failed assertion incorrectly searched the entire Trash INSERT statement for `flight_participations`, including the authorization `WHERE` clause. The source contains a participation existence predicate, but the snapshot projection still archives flight/tracks/expenses only. Corrected test to inspect the archive `SELECT` projection and separately assert the participation predicate. Source-side static comparison against current SQL matches; **new source suite still NOT RUN**.
- Moved TypeScript and source tests before ephemeral PG16 cluster startup in `tooling/run-v380-d3b-targeted-local.ps1` to avoid unnecessary database initialization for preflight failures. No Trash runtime logic, schema migration, main merge, production or remote DB action. Owner-local revalidation remains required.

## 13 October 2026 — D3b-0 first owner-local run blocked by TypeScript; corrected (DRAFT / RE-TEST REQUIRED)

- Owner-local native PG16 targeted runner at exact `372ca1674738d6f51b964038314172aac2df9b40`: disposable cluster `127.0.0.1:54251`, expected/observed DB identity `flytally_currency_test|flytally|127.0.0.1|54251` matched. Initialization and cleanup completed.
- **Typecheck FAILED (3× TS7053)** in three newly authored D3b test files because an inferred environment object was indexed by a dynamic `string`. All PostgreSQL test cases **NOT RUN** at that SHA. This was a failed gate, not a PostgreSQL failure.
- Fixed the three declarations to `NodeJS.ProcessEnv` on the D3b Draft branch. **Corrected branch has NOT been retested**; no claim of TypeScript PASS, SQL race PASS, full-v20 fixture fidelity or deployment. No runtime/product/DB change.

## 13 October 2026 — D3b-0 actual Trash SQL PostgreSQL race tests authored (DRAFT / NOT RUN / NOT SHIPPED)

- Added `tests/integration/postgres-v380-d3b-real-trash-races.test.ts`: extracts the five original SQL statements from `moveFlightToTrash()`, applies the v20 migration SQL blocks from `lib/db-optimization.ts` in an isolated schema and asserts draft deletion, linked evidence CASCADE, provenance-trigger rollback, certified protection, and a deterministic two-session certification-after-archive race.
- Added `tooling/run-v380-d3b-targeted-local.ps1`, reusing the isolated Windows native PG16 cluster lifecycle with exact branch/identity checks, typecheck and targeted source + runtime tests. This is a **bounded synthetic pre-v20 fixture with actual v20 functions/triggers**, NOT proof of full v19→v20 migration fidelity.
- Earlier D3b catalog/zero-row source tests and their gating runner remain staged; **ALL new D3b tests NOT RUN**, no assertion of reproduced production data loss, no D3b-1 behavior change, DB migration, main merge or deploy.

## 13 October 2026 — Independent DeepSeek D3b review reconciled with live repository sources (READ-ONLY / NOT SHIPPED)

- Received owner-forwarded DeepSeek review. Reviewer explicitly lacked repository access; treated severity assertions as hypotheses and checked actual `lib/flight-trash.ts`, `lib/db-optimization.ts` v12/13/15/20, `lib/flight-sharing.ts`, `lib/flight-voiding.ts`, `app/(protected)/flights/actions.ts` and shared participation actions.
- Accepted **Option A+ as provisional design**, with atomic parent locking and child evidence eligibility. Corrected overly broad assumptions: certified-only invitation/public-share canonical paths; v20 immutable provenance trigger may reject FK cascade and abort whole SQL transaction; `flight_source_provenance` lacks a **source-flight FK** and so source-row `FOR UPDATE` cannot universally block new provenance; certified void is separate from ordinary Trash. Actual full-v20 trigger behavior still **NOT RUN**.
- Identified **new source-level P0 race candidate**: `moveFlightToTrash` returns the outcome of the archive INSERT (`results[1]`) even though the final conditional `DELETE flights` is a later transaction statement; SQL transaction atomicity does not imply final DELETE affected one row when no SQL exception is raised. Exact two-session reproduction and final row-count coupling required before merge, no production failure yet claimed.
- Added [D3b independent review reconciliation, explicit atomicity contract, corrected severity and D3b-0 native PG test plan](docs/product/3_8_0_D3B_DEEPSEEK_REVIEW_RECONCILIATION_2026-10-13.md). No code changes, PG runtime tests, migration, production or Neon writes, merge or deploy. Owner's lifecycle policy decision pending characterization.

## 13 October 2026 — D3b protected/voided/shared Trash lifecycle source audit (READ-ONLY / NOT SHIPPED)

- On isolated analysis Draft (parent #331) inspected ordinary `moveFlightToTrash` and Restore, v12/13 `flight_participations`, v13 `flight_verifications`, v15 `flight_connected_crew`, v20 immutable `voided_certified_flights` and `flight_source_provenance`, `flight_public_shares`, and `updateFlight` in actions. Existing Trash archive captures **flight, tracks, expenses** only, while dependent participant/verification/connected-PIC/public-share evidence may cascade or detach under FKs and does not have a trash rehydration contract. Certified void uses separate protected tombstone; normal Edit lacks canonical natural-key writer cooperation. These are identified risks and source-backed relationships, **not actual destructive runtime reproduction**.
- Created [D3b protected data integrity matrix and independent reviewer handoff](docs/product/3_8_0_D3B_PROTECTED_TRASH_INTEGRITY_REVIEW.md) with 10-case disposable full-v20 test matrix and options. Preferred **conservative fail-closed** linked-draft gate is a proposal only; requires independent review and owner's compatibility decision before implementation. No code, migration or production/Neon writes; D3b runtime tests NOT RUN. Previous D3a source commit `59a98018` 21/21 local PG16 PASS remains valid for its own scoped code.

## 13 October 2026 — D3a exact-commit Create/Restore PostgreSQL acceptance (OWNER-LOCAL PASS / NOT SHIPPED)

- At code SHA **`59a9801816f57375b6468c74274eb0ee1baf6f81`** owner ran Windows/Node24 `tooling/run-v380-d3a-create-restore-local.ps1` using disposable native PostgreSQL16 `127.0.0.1:65383`. Database identity expected/observed matched **PASS**; full TypeScript `tsc --noEmit` **PASS**; v20 restore source tests **7/7 PASS**; lock/trigger/canonical Create–Restore fingerprint tests **6/6 PASS**; actual full-v20 PG16 tests **8/8 PASS**, including Create-like transaction competing with exact Restore SQL for same natural identity; **0 failed/0 skipped**. Cluster stopped cleanly. No production or Neon database modifications.
- **Disposition:** D3a cooperative Create-like/Restore serialization locally verified for this source SHA. Not proven: actual authenticated Create action in Next.js, Edit Flight, split/import/Quick Add, void/shared/certified evidence, old archive variants, v21/signed backup, CI/build/browser/production smoke. The previous D3a `NOT RUN` entry below is historic and superseded for this SHA, not a release approval.

## 13 October 2026 — D3a Create/Restore fingerprint parity & D3b protected-evidence audit (NESTED DRAFT / NOT SHIPPED)

- Read the actual `main` and parent Draft flight mutation paths. Confirmed `createFlight` already serializes against a JS six-field `flightFingerprint` string, but D2 Restore's lock used a JSONB-array text serialization. Consequently previous 19/19 native PG16 Restore tests **did not establish Create-vs-Restore concurrency safety**.
- New Draft branch `fix/3.8.0-d3a-create-restore-fingerprint`: minimal Restore advisory lock argument only now builds SQL `concat_ws('|',user_id,...)` over trimmed uppercase six canonical fields (same ordering/normalization as `lib/flight-dedup.ts`). No separate database function/index, no altered persisted flight fields, monetary amount logic, archival columns, triggers, schema version, or import/edit action; prior tested READ COMMITTED two-query transaction retained.
- Added a source contract test proving cross-file Create/Restore fingerprint parity; source tests total **6**. Added eighth native full-v20 PG16 test with simultaneous **Create-like canonical lock+insert** and actual Restored source SQL in independent sessions, asserting one flight; prior seven cases retained. New branch-pinned `tooling/run-v380-d3a-create-restore-local.ps1` creates a private temporary local PG16 cluster and runs typecheck plus 7+6+8 targeted tests.
- **D3a Node24 typecheck, 21 targeted tests, actual PG16 and CI/build/browser NOT RUN**. Parent D2 `0bb5b496` 19/19 PASS and sibling Neon SDK scratch HTTP PASS are earlier distinct evidence, not results for changed code. No production/Neon remote DB writes, migration v21 registration, main merge, deploy, backfill or Training change.
- D3b read-only discovery: `updateFlight` lacks canonical destination identity locking/check, and current ordinary trash snapshots only flights/tracks/expenses rather than dependent participant, void, source provenance and certification evidence; [audit/dependency matrix](docs/product/3_8_0_D3A_CREATE_RESTORE_D3B_PROTECTED_EVIDENCE_HANDOFF.md). Do not silently change lifecycle behavior or delete shared evidence until repository source hierarchy and owner-approved product semantics are reconciled.

## 13 October 2026 — Distinct-trash concurrent restore owner-local PostgreSQL acceptance (DRAFT / NOT SHIPPED)

- Owner Windows executed exact `test/3.8.0-d2-full-v20-pg16-runtime` commit **`0bb5b4965f7234991ac4530a358eb8de48951a9d`** using `tooling/run-v380-d2-full-v20-local.ps1`: newly isolated native PostgreSQL 16 server `127.0.0.1:50066`, expected/observed `flytally_currency_test|flytally|127.0.0.1|50066` identity **PASS**; project Node24 `npm run typecheck` **PASS**; seven v20 source regressions **7/7 PASS**; five lock/trigger/two-query contract checks **5/5 PASS**; seven actual full-v20 PG16 restore/rollback/concurrency SQL tests **7/7 PASS**, **zero failures, zero skips**. Native PG cluster stopped successfully.
- Seventh integration case ran **two independent PostgreSQL sessions restoring two separate trash IDs with the SAME natural-key identity** and verified one restored flight and one marker. This supports **cooperating Restore/Restore serialization only** under the explicit READ COMMITTED batch; normal Add/Edit writes do not acquire this lock, and DB natural-key index is nonunique. No claim of global duplicate prevention.
- **Disposition:** scoped distinct-trash Restore/Restore native PG16 gate **LOCALLY VERIFIED** at precise code SHA. Earlier authored `NOT RUN` status below preserved for provenance. Remaining `@neondatabase/serverless` application HTTP SDK transaction semantics, full protected/certified/void/shared/participant and legacy snapshots, signed v13, official currency registry and v21 migration, build/CI/browser/production smoke **NOT RUN**. Any later change to runtime SQL requires fresh evidence. No merge, deploy, production DB write, schema registration or Training edit.

## 13 October 2026 — Cross-trash competing restore lock and release-gate test (DRAFT / NOT SHIPPED)

- Continued Draft PR #329 after exactly verified 13 October code `7676563ec6bf288b57b4a99ef792033cad434f4e` (Node24 typecheck and 7+3+6 local native PG16 PASS) and cleaned-up Neon PG18 connector scratch tests. Reconstructed that the existing flight restoration natural-key index is **not unique** and two distinct deleted-flight rows are not serialized by the prior same-trash row lock.
- Candidate `lib/flight-trash.ts` now wraps a shared normalized-six-field-key `pg_advisory_xact_lock` and the original row-locked CTE restore as **two statements in the same `sql.transaction([...],{isolationLevel:'ReadCommitted'})`**. No new DB function or unique index. **Only cooperating Restore paths acquire the lock; ordinary Add/Edit races remain unresolved and not authorized as globally unique.**
- Added source-driven seventh full-v20 PG16 integration case with **two independent DB sessions restoring two DIFFERENT trash IDs of the SAME natural flight**, expecting exactly one restored row and marker; previous six actual-source PG16 tests remain. Added two contract source tests asserting two-statement transaction, exact identity dimensions, no speculative unique index. Expected new local tests: 7 static v20, 5 guard and 7 actual PG16 (19 targeted).
- **On this changed code SHA: Node24 typecheck, PG16 tests, SDK HTTP tests, full suite/CI/build/browser/prod smoke NOT RUN.** New source SQL extraction/static review only; previous 16/16 D2 and scratch Neon connector evidence are for different code paths/branches. Verify exact HEAD with the existing `tooling/run-v380-d2-full-v20-local.ps1` before treating as accepted. Official Neon docs support two-query `sql.transaction` plus explicit READ COMMITTED, but **the project's actual Neon HTTP SDK behavior is NOT VERIFIED**. No database/Neon write, main merge, migration registration, production deployment or Training changes.

## 13 October 2026 — Temporary Neon scratch transaction test and confirmed cleanup (NO SHIPMENT)

- Owner explicitly authorized creation of an isolated test branch in `Logbook Shadow` with mandatory cleanup. Created `ft-380-atomic-acceptance-20261013-temp` (`br-sparkling-leaf-b1giaanc`) as **nondefault, nonprimary** child of `production` in project `muddy-dust-14049657`; queries always targeted this child by explicit ID. Neon engine was **PostgreSQL 18.6** (not local PG16). Created only synthetic `ft380_atomic_20261013` tables/function, no writes to actual app tables or production branch.
- Through Neon connector `run_sql_transaction` executed synthetic successful flow + archive-marker batch **PASS**; forced late negative `amount_minor` CHECK failure and verified **full transaction rollback** (`flow_rows=0`, archive `restored_at IS NULL`); two parallel connector `run_sql` calls to a same-trash row-lock test function returned exactly one `restored` and one `already_restored`, persisted exactly one flow with recorded `CZK`. **This DOES NOT test the app `@neondatabase/serverless` `sql.transaction([...])` SDK or actual `lib/flight-trash.ts` SQL.** [Source and test-evidence handoff](docs/product/3_8_0_NEON_TEMP_BRANCH_TRANSACTION_CLEANUP_2026-10-13.md).
- **Cleanup COMPLETE:** independently verified exact child branch name, parent ID, `primary=false`, `default=false` before deletion. `delete_branch` succeeded. Subsequent `list_branches` confirmed temporary branch **absent**; original four project branches including primary `production` remained intact. No database credentials recorded, no other branch deleted.
- Scoped full-v20 D2 Node24 and PG16 evidence remains previously **7/7 + 3/3 + 6/6 PASS at exact `7676563e...`**; current HEAD subsequently changed only docs. Pending: real Neon JS SDK HTTP transaction test, cross-trash/Add/Edit races, certified/void/shared/participant checks, full backups/source/v21 rollout, CI/build/browser/prod smoke. **NO merge, registered migration, production deploy, or Training changes**.

## 13 October 2026 — D2 full-v20 PostgreSQL restore acceptance (OWNER-LOCAL PASS / NOT SHIPPED)

- Owner Windows executed exact `test/3.8.0-d2-full-v20-pg16-runtime` draft commit **`7676563ec6bf288b57b4a99ef792033cad434f4e`** via `tooling/run-v380-d2-full-v20-local.ps1`. Disposable native PostgreSQL 16 started at `127.0.0.1:64675`; database/user/address/port expected and observed `flytally_currency_test|flytally|127.0.0.1|64675` **PASS**. Project `npm run typecheck` **PASS**, v20 coverage Node tests **7/7 PASS**, lock/historical identity Node tests **3/3 PASS**, full-v20 actual-source SQL/trigger/rollback/two-session PG16 integration **6/6 PASS**; **zero failures/skips**. Runner printed `LOCAL full-v20 integration gates PASS on candidate 7676563ec6bf288b57b4a99ef792033cad434f4e. Not a production migration.` Disposable DB server shutdown **PASS**.
- PG16 scope includes historical make/model/variant retention, track/expense reconstruction, missing currency fail-closed, blank historical aircraft identity rejected rather than trigger rewritten, atomic rollback after forced late expense CHECK, and one successful restore from two separate sessions targeting the same archived flight. It **does not** prove two separate trash entries sharing the same normalized flight identity, unrelated Add/Edit writers, complete certified/void/shared participant evidence, old pre-v17 archive variants, production Neon HTTP transactions, full financial currency registry or signed v13 restore.
- **Milestone disposition:** D2 source-exact full-v20 PostgreSQL integration is **LOCALLY VERIFIED at tested SHA** only. Earlier authored `NOT RUN` for this batch is historical and superseded. Documentation-only updates followed; no main merge, v21 registration, application release, Neon/production database writes, FX/backfill, or changes in `flytally-training`. Remaining required acceptance: source/backward-compatibility audit; authorized isolated nonprod Neon HTTP; cross-trash/concurrent-writer test; A1-C/A1-F/A1-G; full CI/build/browser/prod smoke. No production approval implied.

## 13 October 2026 — D2 full-v20 SQL/trigger and concurrency test gate (NESTED DRAFT / NOT SHIPPED)

- Owner Windows retested corrected [PR #328](https://github.com/filipto861/flytally-logbook/pull/328) **exact commit `e24c982fda95a1219c7e5fd4a66a47afe16707da`**: **full Node24 typecheck PASS and all seven source regressions PASS, 0 failed/skipped**. The earlier TS2345 failure remains historical, superseded by this verified evidence; it does not establish PostgreSQL runtime behavior.
- Created isolated nested branch `test/3.8.0-d2-full-v20-pg16-runtime` with narrow `lib/flight-trash.ts` candidate changes: `FOR UPDATE OF deleted_flights` to lock the authoritative source row; fail closed on blank historical aircraft identity when the actual `logbook_snapshot_aircraft_identity` BEFORE INSERT trigger would enrich/rewrite it. Added three guard source tests, actual full-v20 (61 flight columns) PG16 test extracting **runtime SQL** (six scenarios: historic flight/track/expense preservation, blank-identity zero-write, missing expense currency, forced late CHECK rollback, two independent same-trash sessions, static contract), and disposable local Windows runner. Browser fixture omits archive `expenses_data`, so test adds this source-backed v14 field **after** validating the dedicated disposable backend.
- [Handoff](docs/product/3_8_0_D2_FULL_V20_PG16_RESTORE_HANDOFF.md). **New branch Node24/targeted tests, actual PG16, CI, build, Neon HTTP, complete certified/void/shared, cross-trash/global Add/Edit races, signed-v13 and production smoke NOT RUN.** Existing 7/7 PASS evidence belongs to older #328 tested SHA only. No migration registration/v21 enablement, production database write, main merge, deploy, FX/backfill or Training changes.

## 13 October 2026 — Restore D2 first owner-local tests and type-only TS2345 fix (DRAFT / NOT SHIPPED)

- Owner Windows tested exact [PR #328](https://github.com/filipto861/flytally-logbook/pull/328) original commit `220b3e9cb1271e663a139856df9cef3c0e93ff22`: targeted source/column coverage Node tests **7/7 PASS**, 0 failed or skipped; full `npm run typecheck` **FAIL TS2345** at `tests/v380-trash-restore-v20-column-coverage.test.ts:24`. The regression test declared `excluded` with `as const`, causing TypeScript `readonly literal tuple.includes()` to reject a generic `string` argument from `columns.filter`. Runtime SQL was not the demonstrated failure.
- Committed minimal **test-only** type widening to `const excluded: readonly string[] = [...]` at `36f6c1e4efda2e58c367ed93bae6059b78442518`; production restore SQL and testing logic unchanged. Isolated TypeScript 5.8.3 `--strict --noEmit` expression check **PASS**. **Full repo Node24 typecheck and targeted Node tests on corrected branch NOT RUN**; full-v20 PG16 trigger tests, Neon HTTP, CI/build/browser/prod remain NOT RUN. No merge, migration or deployment.

## 13 October 2026 — Currency 3.8.0 restore D2 full-v20 fidelity hardening (ISOLATED DRAFT / NOT SHIPPED)

- From canonical `main@4ca2847795435549f36d44f253eb7c105eea6d25`, created independent `fix/3.8.0-trash-restore-v20-fidelity` for production-path **candidate only**. Source audit confirmed 61 columns in full-v20 `flights` smoke fixture, 49 columns in existing `lib/flight-trash.ts` restore, including three omitted historical `aircraft_make`, `aircraft_model`, `aircraft_variant`. Candidate explicitly restores those three, making 52 ordinary fields explicit while keeping nine identity/certification/revision fields excluded.
- Added guarded candidate/fallback rejection for future v21 monetary snapshot keys (including presence of NULL-valued future columns), malformed JSON/owner/protected evidence and bad expense money; removed guessed `CZK`, silently filtered nonpositive expense records, track/expense metadata defaults. Added seven source/coverage regression cases `tests/v380-trash-restore-v20-column-coverage.test.ts` and [D2 test/evidence handoff](docs/product/3_8_0_TRASH_RESTORE_V20_FIDELITY_D2_HANDOFF.md).
- **Evidence:** exact GitHub readback/source inspection confirmed **61 total = 52 explicit safe columns + nine explicitly excluded**, one restore function/expense CTE and no former CZK/filter default patterns. **NOT RUN:** this draft's Node24 project typecheck, new node tests, actual PG16 runtime restoration, trigger/empty historical identity, certified/void/shared protections, independent concurrency, Neon HTTP, full signed-v13, build/CI/browser/prod smoke. Earlier A1-T2c D1 reduced PG16 8/8+11/11 PASS belongs to a *different* exact SHA. **DO NOT MERGE/DEPLOY** until these safety gaps are closed. No `main` modification, registered migration v21, remote database or Training changes.

## 11 October 2026 — Independent documentation audit follow-up (docs only)

- Reconciled the independent Claude documentation review against the GitHub source: corrected the misleading pending-review phrasing in ROADMAP, marked the DOC workstream completed in the docs index, and linked the existing 3.5.0 certified-flight voiding archive/backup-v13 contract from ARCHITECTURE and the docs index. Historical implementation states remain dated evidence, not active release status.
- Clarified independent read-only reviewer wording in AGENTS and the AI handoff template to cover DeepSeek or Claude without changing review triggers, owner authority or the one-review-per-frozen-design limit. No changes to FEATURES capabilities, version 3.7.0, planned 3.8.0 Currency, application logic, tooling, flags, DB, Training or production.
- **Evidence:** exact-main read-only GitHub source and linked-document reconciliation. The independent Claude audit reported an isolated Node 22 checker run (0 findings) and fixture tests (6/6 PASS) on the preceding main; those are **not** new Node-24 or exact-candidate test results. Full local checker rerun, Node suite, TypeScript/build, PostgreSQL, Playwright, CI and production smoke: **NOT RUN / N/A** for this documentation-only patch.

## 11 October 2026 — DOC-5 governance closeout (documentation only)

- Completed source-backed reconciliation after DOC-1–4 merged PRs #313–#316 and retained DeepSeek review #312. [DOC-5 closeout](docs/maintenance/2026-10-11-doc5-ai-governance-closeout.md) confirms single-owner status documentation, verbatim Phase 0 history, minimal AGENTS/handoff, and opt-in report-only consistency checker. Actual package+lock versions 3.7.0; next product release 3.8.0 Currency. No third-party provider approval inferred.
- GitHub/source check performed; new local Node/TypeScript/build/Playwright/DB/CI/production smoke **NOT RUN / N/A** for this docs-only closeout. No runtime, flag, DB, Training or production deploy change.

## 11 October 2026 — DOC-4 report-only documentation consistency tool

- Added optional, local-only [documentation report checker](docs/scripts/README.md) under `docs/scripts/`, plus an independent Node built-in fixture test. It checks `package.json` against lock root versions and ordinary relative links from current Markdown documents. Dated historical snapshots, maintenance audits and certification-readiness history are excluded as **sources**; external URLs, anchors and semantic/regulatory claims are intentionally not asserted.
- **Owner-frozen non-blocking behavior:** issues print `WARN` and exit 0, never silently modifying source; an invalid root/invocation exits 2. No CI/build/deploy or merge enforcement wired up. `tooling/development-modules.json` and runtime source unchanged; explicit `docs/` classification avoids adding a development-infrastructure release gate for this manual documentation helper.
- **Evidence:** exact source blob SHA values for the GitHub copies match six Node fixture tests executed locally in an isolated container (**6/6 PASS**, including intentional failures/mismatch/encoded-route cases). This is **local isolated tool verification only**, not a full repository Node test/build/Playwright/DB/CI acceptance or current-production request. Applicability and limitations are documented.

## 11 October 2026 — DOC-3 stable AI entrypoint and evidence handoff

- Added short root [AGENTS](AGENTS.md) with repo boundary, authoritative document navigation, fail-closed evidence expectations and one independent DeepSeek read-only review trigger, **without duplicating volatile product release status**.
- Added [AI handoff and reviewer template](docs/AI_HANDOFF_TEMPLATE.md): exact repo/main/candidate SHA, last/current/next, owner frozen decisions, DO/DO NOT, relevant source paths, PASS/FAIL/NOT RUN/N/A/PARTIAL gate ledger, DB/deploy context and bounded reviewer questions. Reviewer findings must be reconciled once against actual repo before implementation.
- Updated README, docs index and ROADMAP pointers. No runtime, flight schema, auth, deployment, Training or test-tool changes; local Node/build/Playwright/DB/CI **NOT RUN / N/A** for navigation-only scope.

## 11 October 2026 — DOC-2 active development workflow / verbatim Phase 0 history

- Extracted the original 19,350-character `DEVELOPMENT.md` module-registry / Phase 0B/0E/0F narrative **verbatim** to [historical verification development](docs/history/DEVELOPMENT_PHASE0_VERIFICATION_HISTORY.md), preserving its time-scoped evidence and chronology exactly. Active DEVELOPMENT retains the same unchanged remainder of the risk/DB/browser/deployment/documentation workflow, plus a compact registry and npm-command pointer; historical statements no longer masquerade as current instructions.
- GitHub read-only exact string checks confirm the archived segment matches the old text byte-for-byte and the remaining active suffix is preserved unchanged. All 8 referenced npm commands were present in package.json; the 17 `DEVELOPMENT.md` source-regression regex assertions from `tests/development-pipeline.test.ts` were individually evaluated against the updated document: **17/17 static matches PASS**. This is **not** a real Node test suite PASS; Node, build, Playwright, DB, CI **NOT RUN / N/A** for docs-only scope. No runtime, Training, Vercel or registry change.

## 11 October 2026 — AI governance approved; DOC-1 current-document ownership

- Owner approved the independently reviewed documentation/AI development redesign, prioritizing speed, accuracy and low duplication. Frozen document responsibilities: ROADMAP owns current status/plans, FEATURES capability inventory, VERSIONING numbering rules, CHANGELOG full historical record; planned stable AGENTS entrypoint, SHA-bound handoff and initially report-only checks. Training remains separate.
- Current README now points to authoritative documents rather than duplicating deployed version/next release; FEATURES drops top-level duplicate deployment metadata but preserves actual mapping capabilities and external provider limitations; VERSIONING stops repeating the current full release sequence (retains dated 9 October renumbering decision and technical-version checkpoint). Actual release evidence remains in CHANGELOG and acceptance. No runtime, DB/schema, public map, flags or source asset changes.
- DOC-1 verified by GitHub diff plus relative link and text-contract checks; Node/Playwright/production/DB gates **NOT RUN / N/A** for documentation-only scope. Subsequent DOC-2/3/4 work is not claimed completed here.

## 11 October 2026 — Documentation + AI workflow audit opened (analysis only)

- At current `main@19bd8419`, inventoried 123 Markdown files (~1.9 MB), classified current sources, dated histories and incomplete compliance evidence; scanned common inline relative Markdown links (71 occurrences, nine unresolved **only in relocated verbatim history snapshots**, one URL-encoded pathname requiring decoding). External and anchor links and complete semantic correctness **NOT VERIFIED**. No history deleted or rewritten.
- Created [documentation/AI workflow audit](docs/maintenance/2026-10-11-documentation-ai-workflow-audit.md) and [read-only DeepSeek consultation brief](docs/maintenance/2026-10-11-deepseek-ai-workflow-review-brief.md), with minimal proposed taxonomy, AI handoff, risk-based verification, non-destructive archival and staged roadmap. **Independent DeepSeek review now received and reconciled against actual PR #312/main:** verdict APPROVE WITH CHANGES; current release-status duplication, DEVELOPMENT current/history mixing and VERSIONING table duplication confirmed, but milestone-era v2/368-of-381/“not active yet” claims are time-scoped history rather than contradictory current registry status. [Reconciliation](docs/maintenance/2026-10-11-deepseek-review-reconciliation.md) documents exact evidence, proposed architecture and owner decisions. **Architecture/implementation still pending owner approval.** `FEATURES.md` reviewed; no product capability changed.
- GitHub read-only documentation/source checks only. Node, TypeScript, Next build, Playwright, PostgreSQL, CI, production smoke: **NOT RUN / N/A** for this docs-only assessment. No runtime, DB, Training, provider config, deploy or release changes.

## 11 October 2026 — Documentation entrypoint + version assertion correction

- Corrected root `README.md` from the obsolete 3.6.0/partial-3.7.0 status to the verified 3.7.0 production baseline and 3.8.0 next release. Updated the documentation index's historical PR triage description to reflect the subsequently deleted Satellite branch refs and retained archival tag roots; the dated triage snapshot remains untouched.
- Fixed an extra escape in the footer source assertion in `tests/versioning-governance.test.ts`: the old regex did not match the actual `components/app-shell.tsx` source. Independently checked the corrected regex against current main source; **static expression check PASS**. Full targeted Node test/CI/build/browser/DB: **NOT RUN** for this narrow docs/test-only fix, and no production app logic or deployment change.

## 3.7.0 — 2026-10-11 · Maps & Aviation Layers — PRODUCTION

- **Released:** Owner approved functional closure, citing completed 10 October production UX testing; all nine PROD-01–09 scenarios recorded as **owner-reported UX acceptance**, not independent per-step/browser automation. Explicitly confirmed live Standard ↔ Satellite switching, combined Aviation display through z18 (native source capped at z14), GPS flight replay/scrub without reset, GPS Tracks and iPad Safari. Relevant code phases A2D/A2E/A2F had already been deployed, last map-logic merge [PR #297](https://github.com/filipto861/flytally-logbook/pull/297) (`09001505`).
- **Version cut:** [PR #309](https://github.com/filipto861/flytally-logbook/pull/309) merged at `main@39ee01b74f25bbd647d5e79f58d4b184034f61a0`, synchronizing `package.json`, `package-lock.json` and the footer's existing package-derived version to `3.7.0`; related stale version governance test and docs updated. No map behavior, auth, feature flag, database, flight-record or Training changes.
- **Production verification:** Vercel `dpl_Az24Z1mL7BxGN16zHpiiGDGXGPui` is **READY**, commit SHA matches the version cut, and live `fly-tally.com` alias is assigned. Vercel build logs show `pilot-logbook-web@3.7.0 build`, Next.js optimized compilation **PASS**, TypeScript **PASS**, and static page generation **41/41**. Aggregated runtime error review for the selected recent window showed **no reported errors**, not exhaustive request-level or authenticated-feature proof. **Post-release direct browser/HTTP smoke NOT RUN** from this tool environment (public-domain fetch inaccessible), and no new footer screenshot was captured; earlier live behavior acceptance is owner testimony on unchanged map logic.
- **Known external exception, NOT APPROVED:** Esri/openAIP and supplier licence/usage/attribution/export/Story rights, quota/cost and data coverage/freshness remain **UNVERIFIED** and should be resolved separately before asserting provider entitlement or broader commercial redistribution. This release is not an approved aviation chart/EFB or commercial launch clearance. Owner deferred additional Esri attribution work; that does not create permission.
- **Verification boundary:** Prior exact-A2F candidate had owner-local ON/OFF Node 1473/1473, TypeScript/build and Chromium desktop/mobile 8/8 per mode; those gates were **not rerun** on the packaging-only #309 SHA. Independent local Node tests, CI and PostgreSQL verification for #309: **NOT RUN / N/A**; Vercel production build PASS as above. No release Git tag was created; recent 3.4–3.6 canonical releases likewise did not have corresponding tags.
## 11 October 2026 — 3.7.0 numeric release candidate (not yet deployed)

- Staged package version `3.7.0` in `package.json`, root `package-lock.json` and lockfile workspace root; app footer derives its version directly from package metadata. This is **release candidate metadata** while actual `fly-tally.com` production still serves the last verified 3.6.0 deployment `09001505`. Version-specific `tests/versioning-governance.test.ts` updated to follow the current canonical ROADMAP instead of stale historical section literals.
- Owner-reported UX acceptance completed for Maps, Satellite, combined openAIP Aviation, high-zoom, GPS replay/track/import/share and iPad Safari. No new map logic, provider credentials, database migrations or feature flags. Previous exact-A2F source/Node/Chromium tests remain valid only for that exact code SHA. Candidate-specific tests/build **NOT RUN yet**; do **not** infer deployment, tag, CI or numeric release publication.
- Third-party Esri/openAIP and applicable supplier rights, attribution/export terms, coverage/currentness and quota/cost checks remain separately **UNVERIFIED/BLOCKED**, not granted by user visual acceptance. The application is not an approved aviation EFB/chart. Complete the release only after exact production rollout and operational smoke; preserve exceptions and separate compliance follow-up.

## 11 October 2026 — Owner signs off 3.7.0 functional acceptance (no version cut yet)

- Owner explicitly reports that all 3.7.0 user-facing functionality was tested on 10 October 2026 and requests final closeout. The 9 PROD-01–09 cases in [current acceptance record](docs/product/3_7_0_FINAL_PRODUCTION_ACCEPTANCE_2026-10-11.md) have **owner-reported functional acceptance**, with explicit conversation confirmations for Standard/Satellite switching, Aviation visible at display z18, GPS replay/scrub, iPad Safari and GPS Tracks. This is not independently captured trace or proof of every failure-injection assertion.
- Numeric package version and production release remain **pending exact-candidate checks and Vercel rollout evidence**. Provider entitlements/redistribution and certified-airspace-data validity still unverified; no commercial or provider approval implied. No feature flag, credential, database, Training or runtime map logic altered by this acceptance record.

## 11 October 2026 — Owner confirms basic production map functionality (acceptance evidence only)

- Owner confirmed live map rendering, **Standard ↔ Satellite switching** and **Aviation overlay visibility at maximum zoom 18** in production. Logged owner-observed partial PASS for PROD-01/02/03 in the active 3.7.0 acceptance record; owner subsequently confirmed playback and timeline scrubbing in GPS Flight Replay plus Standard ↔ Satellite switching without observed reset or map freeze (**partial PROD-05 PASS**). In direct response to the physical iPad Safari portrait/landscape check, owner confirmed map/Map Settings work (**partial PROD-08 PASS** for basic functional behavior; detailed device/touch assertions not independently verified). Remaining fine-grained assertions, separate GPS tracks/import, public share, themes and detailed iPad checks **NOT YET CONFIRMED**. Owner instructed to defer further Esri attribution work for now; unresolved provider permissions remain separately recorded as unverified and are not represented as approved. No application code, credentials, flags, version, database or production deployment changed.

## 11 October 2026 — Final 3.7.0 production/provider acceptance opened (docs/read-only)

- Verified Vercel `fly-tally.com` alias still targets A2F `READY` deployment `dpl_8thpSpB1aGPEBtbjkPnU61qL771t` at exact runtime SHA `090015053e33fb4b391a304e0a9e57f4145223a4`; current main documentation SHA is later and does not equal a new production runtime. Vercel runtime error clusters / error-fatal logs showed **none in the queried 24-hour window**, not a feature-use PASS.
- Read current strict server-side Satellite and Aviation routes; attempted read-only unauthenticated public route fetches but received **no usable HTTP evidence in this environment**. No authenticated production requests, provider-credential fetches, provider traffic, production flag changes or cache purges were performed.
- Opened [3.7.0 final acceptance record](docs/product/3_7_0_FINAL_PRODUCTION_ACCEPTANCE_2026-10-11.md) with owner-executable production Desktop/GPS/replay/import/iPad Safari matrix and explicit Esri, openAIP and OSM license/cache/quota review. Public official Esri attribution requirements and OSMF tile policy checked; openAIP live schema/site not retrievable (HTTP 402 here), so openAIP rights remain **BLOCKED**. Account-specific Esri rights, provider permissions, Story export, source coverage and data freshness **NOT APPROVED/UNVERIFIED**.
- No code/test additions, schema/DB, product version, deployment or Training change. Local typecheck/tests/Next build/Playwright/DB/CI **NOT RUN** for this documentation-only milestone. `FEATURES.md` remains unchanged; 3.7.0 release still **OPEN**.

## 11 October 2026 — Six fully-merged legacy branches removed (Git refs only)

- Owner ran the separately prepared PowerShell script `flytally-logbook-merged-branch-cleanup-2026-10-11.ps1` in dry-run mode and then with `-Apply`. The terminal output reports successful exact-SHA checks followed by successful removal of: `codex/v335-batch8-routes-headers-legal` (`8e09aa14`), `docs/flight-entry-f1-closeout` (`5c2af689`), `feat/flight-entry-f33-aircraft-authority` (`8031f3d0`), `feat/flight-entry-f34-aircraft-context-ux` (`844ce1c4`), `fix/story-map-toggle` (`af15f8e5`) and `test/flight-entry-f35-closeout` (`512e2eb3`). Each was independently compared to then-current `main@77ade8d88c3ad82b1aa9b29ce540c112e2155a87` with `ahead=0`; these branch heads are already ancestors of main and required no new archival tags.
- Independently rechecked live GitHub after execution: **28 remote branches (34 before this batch; 44 before both pruning batches), 0 open PRs, 15 tag refs**, including the same three archive tags at their verified expected SHA and original 12 releases/tags. None of the six names was present in the complete remaining branch list. Main was unchanged at `77ade8d88c3ad82b1aa9b29ce540c112e2155a87` before this docs-only follow-up; deliberate `chore/pre-f3-integration-anchor` remains present.
- **Scope strictly Git reference hygiene.** No application code, schemas, database, feature flags, releases, production deployment or user-facing features changed. Typecheck, Node tests, build, Playwright, DB verification, CI and smoke checks: **NOT RUN / N/A** for this bookkeeping batch. `FEATURES.md` checked: no capability changes needed. Full 3.7.0 release gates remain open.

## 11 October 2026 — Legacy Satellite R1/R2 branch pruning EXECUTED (Git ref cleanup only)

- The owner ran the SHA-pinned dry-run and then executed the PowerShell cleanup with `-Apply`. The supplied terminal log shows **three newly pushed archival tags** (for the #279 history tip, #271 readiness, #281 S1 review) and **ten deleted branch refs** corresponding to previously closed/unmerged PRs #271–#279 and #281. PowerShell surfaced Git's ordinary stderr push progress as `NativeCommandError`; this did not indicate a failed remote operation in this case.
- Independently verified against live GitHub **after execution**, before this documentation change: **34 branches (previously 44), 15 tags (previously 12), 0 open PRs**; archival refs point respectively to `096b86d8800ac763f2d74bbcba5cb54f978b0984`, `b08905b5a0e10276fcab1f48dcfac121e8d5428d` and `25fe505dedaaa521b20b5f3579cf9dcb4dc66451`. Main at verification remained `1b73058cff6116a14cfd4d97d36bcd117cb19208`. All ten retired branches are absent from the complete branch list, while original 12 tag refs are preserved; historical commits remain reachable via archive tags.
- **No product code, runtime, DB/schema, flags, provider tokens or production deploy changed.** Build/typecheck/Playwright/DB/CI/deploy **NOT RUN / N/A** for reference pruning. Six other legacy ancestor-of-main branches remain optional, and the integration anchor was intentionally retained. The full 3.7.0 release remains open.

## 11 October 2026 — Branch pruning preflight (documentation only; NO deletion)

- Compared actual main with all 10 closed/unmerged R1/R2 source branches and seven older `ahead=0` branches. Established that #272–#279 are one ancestor chain ending at #279, with separate unique documentation commits at #271 and #281; recommended three archival tags before any branch deletion. Prepared [exact-SHA pruning plan](docs/maintenance/2026-10-11-branch-prune-preflight.md) and a separate owner-run, dry-run-first PowerShell script. **No tags created, remote branch deleted, repository code changed, build/test/DB/deploy executed.** GitHub connection does not expose a branch-delete operation, so owner-local execution and subsequent actual-state reconciliation are still required. Product version, ongoing 3.7.0 acceptance gates and historical owner decisions unchanged.

## 11 October 2026 — Retire legacy Satellite R1/R2 pull requests (GitHub metadata only)

- Following explicit owner decision that the previous R1/R2 paths were abandoned experiments, **closed without merging** all ten remaining drafts: #271, #272, #273, #274, #275, #276, #277, #278, #279 and #281. Each has a dated disposition comment. GitHub confirmed **0 open PRs** after closure; main remained at `d70d15713a262d56cb383a8a9ced56025061c5af` and the repository listed 44 branches at the closeout checkpoint. No branch, tag, original commits, PR discussions or releases deleted. Source differences identified on 10 October remain historical evidence, **not an approved code-port roadmap**. No runtime, database, version, feature flag, provider key, tests, build or deployment changed by this GitHub cleanup. 3.7.0 remains an unfinished release.

## 10 October 2026 — M2A source audit of unmerged Satellite R1/R2 drafts (docs only)

- Inspected actual current main and PR-head code for #273, #278, #279 and #281; [documented exact-SHA findings](docs/maintenance/2026-10-10-r2-m2a-source-audit.md). Story export partial-tile failure and absent Satellite emergency disable are **verified source differences, not diagnosed production incidents**. Provider resource modules remain isolated, and Esri 512px/256px geometry does not prove actual provider grid alignment. No runtime integration, test execution, DB, provider request, GitHub branch deletion or deployment in this analysis-only batch. Candidate follow-ups await owner decision and fresh verification.

## 10 October 2026 — Documentation governance and PR cleanup (docs-only)

- [PR #298](https://github.com/filipto861/flytally-logbook/pull/298) reconciled current A2D–A2F production status; [PR #300](https://github.com/filipto861/flytally-logbook/pull/300) recorded dated repository hygiene inventory; [PR #301](https://github.com/filipto861/flytally-logbook/pull/301) replaced contradictory current ROADMAP/FEATURES timelines with short source-aware canonical docs and preserved complete verbatim historical snapshots. Git/blob-link checks performed against exact PR head; no typecheck/Node/PostgreSQL/browser/CI/deploy executed as part of these docs-only changes.
- Documentation-only PRs #294, #296, and #299 were closed **without merging** as superseded, with preservation comments and unchanged historical Git refs. #299's owner-reported DB-only entry is incorporated below; no new Neon query or data operation was performed. The unique old Satellite R1/R2 stack remains open for [read-only code disposition](docs/maintenance/2026-10-10-open-pr-triage.md), not bulk merger or deletion.

## 2026-10-10 — Production aircraft default backfill (data only; no code release)

- Owner-requested one-time update on Neon Logbook Shadow / production primary (not Training). Preflight verified 25 aircraft profiles across 5 users, 24 eligible profiles, 0 identity mismatches and 0 conflicting existing defaults.
- A transactional, exact-ID/model/ICAO/class/evidence-guarded UPDATE filled 21 empty default_engine_type = SE cells and 22 empty default_operation_type = SP cells, affecting 23 aircraft profiles (one eligible profile already had both). Existing non-null user selections were preserved; no flight records updated. Data-only cleanup marker: 2026-10-10_aircraft_defaults_sp_se_v1 in flytally_data_cleanups.
- Production post-read verified 22 SE, 24 SP, 0 ME/MP. The two unpowered L23 Blaník gliders were assigned SP but deliberately kept engine classification unset. King Air / C90 profile ID 19 has conflicting ULL class/evidence and was excluded entirely for owner review; no invented/forced classification. Thus three engine defaults and one operation default remain unset.
- Scope and verification: DB transaction PASS; post-write read-only DB census PASS. No DB schema migration, product runtime change, test/build/CI/Playwright execution, code merge or deployment. ROADMAP.md and FEATURES.md reviewed: no change needed for this historical one-time data correction.

**Provenance:** [PR #299](https://github.com/filipto861/flytally-logbook/pull/299) records the owner's transactional preflight/post-read evidence. This documentation-only consolidation did **not** independently connect to Neon, rerun SQL, change schema, run test/build/browser verification or alter flight/aircraft records. The open PR #299 should be dispositioned against this incorporated entry after diff review.

## 3.7.0 A2F — compact Map settings and Aviation high-zoom fix shipped to production (10 October 2026)

- **Verified current state — 10 October 2026:** A2D combined openAIP Aviation and A2E unified Map settings are already merged and Production READY. Owner-approved **A2F** compact menu + high-zoom fix is now **MERGED** ([PR #297](https://github.com/filipto861/flytally-logbook/pull/297), squash `090015053e33fb4b391a304e0a9e57f4145223a4`) and Vercel production deployment `dpl_8thpSpB1aGPEBtbjkPnU61qL771t` is **READY**, associated with `fly-tally.com` and this exact SHA. The visible settings popover contains only Standard, Satellite, Aviation overlay. Once explicitly selected, Aviation remains active through Leaflet z18 by overscaling native z14 tiles; the authenticated server still rejects z>14 requests. Error fail-closed, reference-only attribution/coverage disclaimer, session and server-only key and OFF-by-default client semantics are unchanged. No DB migration or Training/public-view changes. Full `3.7.0` release is **not** declared. **Remaining:** real signed-in production high-zoom/provider tile smoke, desktop light/dark, physical iPad Safari portrait/landscape, rights/coverage/currentness evidence.
- **Owner-local pre-merge verification (exact PR head `569088746f07c126cc3a0b353d0e94effbc07468`; candidate `ebfa3f66dcfe3eac9b59ce24bce36cc2e175700b92a4d537d354a18d175313b5`):** Targeted 17/17 PASS, iteration source 233/233 PASS, domain 36/36 PASS and TypeScript PASS. **Both Aviation ON and Aviation OFF** separate `verify:release:risk --rerun` gates passed on the same exact source SHA, each with source 233/233, domain 36/36, full Node 1473/1473, TypeScript and Next build PASS, Chromium desktop 8/8 and mobile 8/8, no browser skips/failures/retries, fresh builds and distinct verified-empty localhost PostgreSQL18 browser fixtures. Planner selected standalone PostgreSQL/scale N/A. This is owner-local evidence, **not** GitHub Actions CI, native iPad Safari, or live openAIP tile verification. Previous A2F 8cbf4efe/5aa77c6d browser-sequencing failures are retained below as historical, superseded test evidence.
- **History boundary:** The subsequent pre-merge A2D/A2E/A2F sections below preserve original decisions, test failures and checkpoints **as historical evidence**. In particular, phrases such as “Draft/unmerged”, “NOT RUN”, “zoom above 14 disables Aviation”, and old panel headings/notes refer to earlier candidates; they are **not** the current runtime, product decision or deploy state. A2F changes supersede the earlier UI/zoom presentation contract but not the A2D authenticated server z<=14 limit or reference-only aviation source hierarchy. Separate draft documentation PRs [#294](https://github.com/filipto861/flytally-logbook/pull/294) (A2D) and [#296](https://github.com/filipto861/flytally-logbook/pull/296) (A2E) still exist; reconcile/close them deliberately and **do not merge their stale status lines** into this current state.

### Historical pre-merge release records (retained verbatim)

## A2F — compact Map settings and Aviation high-zoom retention (feature branch, NOT MERGED — 10 October 2026)

- User-reported: duplicate menu headings/disclaimers; Aviation deselects and disappears when zoom increases beyond 14. Fixed in feature branch by removing intentional `zoomend` detachment, keeping overlay selected and using Leaflet `maxNativeZoom:14` with display `maxZoom:18`. Existing server request cap z<=14, upstream auth/key/transport checks, runtime error/no-retry behavior and openAIP map attribution remain unchanged; no claim of source coverage or higher-resolution data.
- The panel now displays only Standard, Satellite, Aviation overlay; legacy group/region accessibility labels, keyboard/outside click, visual selected state and genuine loading/error statuses retained. Browser regression now checks full zoom, persistence and all requested z values <=14; source contracts updated. **Initial source/domain/Node/typecheck/build PASS; desktop Playwright 7/8 and release FAIL; new test-only commit NOT RUN**, no DB/Training/deploy/config change; old #295 evidence cannot be transferred to a new SHA.

- **Browser timing regression follow-up:** **A2F initial owner-local full gate (Aviation ON; 10 October 2026):** Original head `8cbf4efe` / candidate `fa8c4a26360c70c9430965a6d6842f73f541660b6b0b8dfea77a444e8a00d68e`: targeted **17/17**, source **233/233**, domain **36/36**, full Node **1473/1473**, typecheck and Next production build **PASS**. Browser desktop **7/8 PASS**: Route Map test expected Zoom in disabled after twenty rapid click attempts. Since Leaflet zoom is animated, repeated clicks may not produce twenty completed zoom transitions. Browser PARTIAL; release FAIL. Mobile and Aviation OFF **NOT RUN**. No production change or runtime defect established. Corrected E2E waits for actual tile zoom increments and Leaflet animation completion, asserts z18, and reloads normal fitted map before route-click acceptance. **New exact SHA needs fresh targeted/iterate and ON/OFF release tests; no PASS claim.**

- **Second owner-local A2F browser follow-up:** **A2F second owner-local release attempt — FAIL, E2E visibility sequencing corrected (10 October 2026):** Head `5aa77c6d`, candidate `59762bd6a25dafef86dad50a6054e9c72fbe079065f3a8514c68923443563bea`: targeted **17/17 PASS**, iteration source **233/233 PASS**, domain **36/36 PASS**, typecheck **PASS**; ON release source **233/233**, domain **36/36**, aggregate Node **1473/1473**, build/typecheck **PASS**. Desktop Chromium **7/8 PASS**; high-zoom test successfully reached z18 and disabled Zoom in, but Playwright then could not find the Aviation overlay button with `getByRole` because the expected outside-pointer dismissal had closed Map settings. This is a test-sequence error: application control closes the menu on zoom-button clicks while aviation layer stays independent. On this second run, direct layer/attribution assertions were not reached after the button lookup failed. Mobile Chromium and Aviation OFF **NOT RUN** (fail-fast); release **FAIL**. Corrected test now requires closed menu at z18, checks aviation pane raster/attribution and only upstream z<=14 tile requests with menu closed, reopens Map settings and asserts pressed state before OFF/ON toggles. **Newest commit requires new candidate-bound verification; no PASS/merge/deploy claim.**

## 3.7.0 A2E — Map settings UX (feature branch; NOT MERGED, 10 October 2026)

- **Staged implementation only:** combined the separately mounted Satellite and Aviation Leaflet controls into one per-map **Map settings** popover on four protected map surfaces. Standard/Satellite and Aviation remain independent; existing source-backed errors, public exclusion, attribution and reference-only status are preserved. Added responsive scoped Light/Dark CSS, accessible expanded state/Escape/outside dismiss/focus return and updated source/browser regression tests. No DB, authentication, provider URL/key, Training, public Story, persistent user settings or release-version change.
- **Owner-local first full gate evidence + mobile test-sequence correction (10 October 2026):** A2E first release attempt (owner-local 10 October 2026), exact `c720a16b10f05f3f54e643f3e053333cbe042775`: targeted **17/17 PASS**, source **233/233**, domain **62/62**, Node **1473/1473**, TypeScript/build **PASS**, PostgreSQL **100/100**, desktop Chromium **11/11 PASS**, mobile Chromium **10/11 PASS**, no browser retries; **release_status=FAIL** (mobile Route Map hover timed out because the test left Map settings open and the Standard button correctly intercepted its covered hit target). Aviation OFF release **NOT RUN** because the runner stopped on the first ON failure. No runtime defect established by this evidence. E2E test now closes and asserts hidden panel before route hit-target hover/click. **New commit requires a fresh candidate identity, targeted/iteration and ON/OFF release gates; neither new PASS nor merge/deploy is claimed.** This commit updates only the one E2E scenario to explicitly dismiss the popover before route hover/click, plus these status documents. No runtime UI/CSS/provider changes. No PR merge/deploy.


## 3.7.0 A2D — combined openAIP Aviation overlay (feature branch, 10 October 2026)

- Owner product decision: choose **Aviation overlay** (combined openAIP raster) instead of the previously intended airspaces-only overlay, after hidden-key owner-local z=9/x=276/y=173 probe returned **404 JSON** for legacy `airspaces` and **200 PNG / 13,425 bytes / nonempty alpha** for `openaip`. No API key was shared/stored in this development session.
- **Staged code change:** fixed-host, server-held-key authenticated `/api/airspace-tile` proxy now selects upstream `/api/data/openaip/{z}/{x}/{y}.png`; keep strict canonical tile validation, session-before-secret, exact-true enable/provider assertions, 5s timeout, bounded PNG, private no-store, 429/no-retry and error fallback. Route path, header and flag names remain as legacy internal compatibility identifiers — **do not** rename customer-visible Aviation back to Airspaces. Separate `components/airspace-map-control.ts` changes button/ARIA/status/attribution to **Aviation**, still OFF by default, opt-in on four private maps and never on public replay/Story.
- **Owner-local original-runtime-SHA verification (10 October):** `b10d81b7ee7e6ce9fbf58d262a67d54be0543e56`, candidate `18095a61ef81f1c3eda4e9098224a1864efd1bfa6bcba77a373c69bb52db9eb4`, base `9d711b2eee2135120de20b7f2d8aa22303322a02`. Targeted tests 32/32 PASS, `verify:iterate` source 233/233 + domain 36/36 + typecheck PASS, independent production build PASS. `verify:release:risk -- --base origin/main --rerun` **PASS in both Aviation ON and Aviation OFF client modes**, each separately rebuilt with Satellite ON and distinct brand-new verified-empty disposable localhost PostgreSQL18 browser DB: per mode source **233/233**, domain **36/36**, full Node **1472/1472**, typecheck and Next build PASS, authoritative Chromium **8/8 desktop + 8/8 mobile**, `blocked_evidence=none`, no browser retries. The first ON browser attempt failed because local `SESSION_SECRET` was missing; rerun with a generated test-only secret passed. Browser fixtures used PostgreSQL; standalone PostgreSQL integration and scale gates reported **N/A** under this candidate's plan. ON/OFF evidence retained separately outside the repo. **This documentation-only follow-up makes a new head/candidate, not automatically covered by these exact-runtime-SHA results**. CI, actual app-level live openAIP proxy smoke, native iPad/Safari, merge, Production deploy/configuration, third-party provider rights/currentness and 3.7.0 release **NOT RUN / NOT VERIFIED**. No schema migration, Training, Story or runtime feature-flag change.

## Production security maintenance — 10 October 2026

- **Satellite endpoint session-auth containment deployed:** [PR #282](https://github.com/filipto861/flytally-logbook/pull/282) **MERGED** to main as `00305fb6a37bdbca99cf1a262b7dcb39a74a269a`; Vercel **READY** production deployment `dpl_JAdh7zGNZmXVQwDLoZ5yeLJvnvsn`, and `fly-tally.com` alias confirms that deployment. Product package/version display stays **3.6.0**; this emergency security patch was **not tagged 3.6.1** and is not full 3.7.0.
- Live session gate blocks anonymous `style=satellite` before ArcGIS token/upstream, returns **401 private/no-store**; authenticated Satellite replies are **private/no-store** and omit permissive wildcard CORS; public Standard/omitted style remains accessible. No new migration, feature flag enabling or supplier approval. Existing authenticated Story can still reach provider; rights and cost governance remain open.
- Owner-local clean PR head `e27dbc2ed789463f25f8789485806a75417d7744`: exact-candidate **release_status=PASS** with source **233/233**, domain **20/20**, aggregate Node **1,453/1,453**, typecheck, production build and Chromium **8/8 desktop + 8/8 mobile**. Synthetic PG18 browser fixture only; separate Postgres/scale gates **N/A**. Earlier fixture init failure fixed test-only; prior real local Next 401/400 checked at an earlier runtime-identical SHA. **Not CI**.
- **Post-deploy production HTTP smoke PASS (owner PowerShell, 10 October 2026 14:11:01–02 UTC):** direct `curl.exe --noproxy "*"` to `https://fly-tally.com/api/map-tile/0/0/0?style=satellite` returned **401 Unauthorized**, `Cache-Control: private, no-store`, `X-FlyTally-Map-Style: unavailable`, `X-Vercel-Cache: MISS`, `Age: 0`, and **no `Access-Control-Allow-Origin` header**. Duplicate parameter `style=map&style=satellite` returned **400 Bad Request**, `Cache-Control: no-store`, `X-Vercel-Cache: MISS`, `Age: 0`. These are specific actual live edge responses, **not global CDN purge evidence**. Remaining: stale CDN/browser objects, production Standard map smoke, signed-in/expired auth/Story and live Esri acceptance. No CDN purge or live provider GET performed; do not roll back to public-Satellite-cache code without security assessment.

## Production Satellite UI rollout — 10 October 2026

- [PR #285](https://github.com/filipto861/flytally-logbook/pull/285) **MERGED** as `c1500a47298e661fa4e37b050b550b4d21e3afd3`. Four authenticated Leaflet maps gain Standard/Satellite selector (Standard default, opt-in, same map/viewport, error fallback). Public sharing stays Standard-only; previously secured map-tile endpoint and Story unchanged. No migration or full 3.7.0 version bump.
- Exact tested pre-squash HEAD `ac96abf017e8239f759c07612e3409f28d5c785d`, candidate `6bcd3a7a10a41fc595cb4d8f007de0795392c9bbf87b76155c1765e011a04451`: owner-local **SATELLITE ON and SATELLITE OFF release_status=PASS**, each aggregate Node **1456/1456**, source **233/233**, domain **46/46**, PostgreSQL **100/100**, typecheck/build, Chromium desktop **11/11**, mobile **11/11**. Earlier timezone registry 387/388 error is resolved; this is local, not CI or real imagery approval.
- Owner confirmed Vercel Production env `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true` before merge; live Vercel project lists key targeted at Production. New deployment `dpl_483QVp2729JzS16w8g1VJz7MBcCJ` **READY**, production alias `fly-tally.com` updated accordingly. Real malformed duplicate-style API **400 no-store** observed on this deployment. Anonymous Satellite app-level **401** on the new deployment, signed-in real-UI tile success/failure and physical Safari **NOT YET VERIFIED**; upstream provider consent/cost and stale cached tiles remain unverified.

## 3.7.0 openAIP A2B2 — MERGED, OFF-default production code deployed (10 October 2026)

- [PR #289](https://github.com/filipto861/flytally-logbook/pull/289) **MERGED** to main at `49077967d9ba15f8dcabc80b036f8b157220d16d`. Four signed-in map surfaces get a build-flag-gated default-OFF separate `Airspaces` control on the existing unfiltered `flytallyAviation` pane, independent of the Standard/Satellite basemap. Raster source is the secured A2B1 proxy; show reference/coverage-unverified state and provider attribution. Explicit activation only, tile error removes layer and blocks repeated requests until map remount; public/shared flight maps stay unchanged. Added five A2B2 source-contract tests, synthetic Chromium positive/503 modes, map/browser ownership and audited runtime count 390→391. No flight/certification mutation, no migration, no Training code or operational claim.
- **Exact SHA acceptance:** PR head `476fd1a1c33fe4c7f18b21d6253a4c1c4cfdfae4`, candidate `93112220dfa2e3eafebc8c18217618333ff9c7d368061f4565b132040a2fb3d6`; owner clean Windows detached worktree. Independent `verify:release:risk` **Airspaces ON and Airspaces OFF both `release_status=PASS`**, each on different verified-new and initially empty isolated localhost PG18 fixture, with distinct fresh Next builds and server-provider flags/key empty. Each mode: Node **1472/1472**, source **233/233**, direct domain **62/62**, PostgreSQL **100/100**, TypeScript/build PASS, Chromium **11/11 desktop + 11/11 mobile PASS**, blocked evidence none. `scale=N/A` per planner. Owner-local, not CI; provider traffic entirely synthetic.
- Vercel production `dpl_Fk7ReBtutVRS3XUvABaaDFyZvgod` **READY**, `fly-tally.com` alias points there. Production env inventory verified **no openAIP/Airspaces flag or key configured**, so **provider disabled and Airspaces control not exposed**; Satellite remains separately configured. Real live A2B2 provider/coverage/source age/licensing/credit/quota and authenticated physical iPad/Safari acceptance **NOT VERIFIED**. Product `3.6.0` metadata remains; no full `3.7.0` release yet.
- **Historical A2A/A2B1/A2B2 draft-stage notes below are preserved as dated evidence, not the current status.** Next gate is lawful/current provider contract and bounded live response verification plus explicit owner activation decision; no Production enable until resolved.

## 3.7.0 openAIP A2C — owner-hidden-key raster endpoint result (10 October 2026; docs only)

- Owner ran exactly **two** authenticated fixed raster GETs for z=9/x=276/y=173 using a key entered into hidden PowerShell prompt, without sharing/storing the key. Legacy `/api/data/airspaces/9/276/173.png`: **404 application/json**; current `/api/data/openaip/9/276/173.png`: **200 image/png**, **13,425 bytes**, valid PNG signature, at least one alpha-positive pixel. Both used the same host, XYZ and `x-openaip-api-key` header. No source imagery entered GitHub.
- Confirms old single-category raster is not usable at sampled point, current **combined** raster is reachable with key; full content categories and transparent coverage, tile range, recency, operational activation, origin terms and quotas not established. Deployed `airspaces` proxy remains unchanged and all production flags/credential UNSET/OFF.
- **Blocked on FlyTally product decision**: either rename/use combined imagery as an explicit Aviation overlay with client/server path change and OFF/ON full re-verification, or retain strict `Airspaces` and design a separately verifiable/filtered vector data interface. No UI/provider/DB or Training code changes in this documentation-only checkpoint.

## 3.7.0 openAIP A2C — provider API diagnostic planned (10 October 2026; no runtime changes)

- Product owner confirmed possession of an openAIP API key (secret never shared with this workflow) and chose to handle any licensing questions independently; this is a scope decision, not external license approval or authority to falsely describe source validity. Production provider stays OFF.
- Newly retrieved **primary openAIP maintainer statement from 3 May 2023** reveals single combined raster layer `openaip`, superseding separate `airspaces` and `airports` endpoints cited in older 2022 examples (https://groups.google.com/g/openaip/c/sG8GlccNS6w/m/U8OJiGGHAgAJ). Vendor 5 Aug 2024 key-header migration: `x-openaip-api-key` (https://groups.google.com/g/openaip/c/SXblkRg3Ic8). Current Tiles API schema inaccessible to independent validation; **live key-authenticated requests NOT RUN**.
- **A2B1 production route therefore may request an obsolete raster path.** Do not make an unverified hotfix replacing an airspace-specific URL with multi-category `openaip` unless owner explicitly accepts the changed content scope. First a two-request bounded diagnostic on fixed tiles endpoints and official-source/source-type review, then choose either combined raster or airspaces-only filtered vector architecture. A2A/A2B1/A2B2 synthetic verified and deployed OFF state remain unchanged.

## 3.7.0 openAIP A2B1 — private airspace PNG proxy (draft branch, 10 October 2026)

- Prior A2A PR #287 **MERGED** as `c631f3862ff5bbf61c5f1ee72ca0ec6bbf03e0fc` after exact-head owner-local release **PASS**: aggregate Node **1460/1460**, source **233/233**, direct domain **24/24**, typecheck/build PASS, Chromium 3 desktop + 3 mobile PASS, PostgreSQL N/A, no blocked evidence. Provider still unavailable; no aviation overlay yet.
- New small A2B1 branch: private `GET /api/airspace-tile/[z]/[x]/[y]`, fixed-host PNG openAIP transport, server-held key, live-session authorization before reading secrets, exact-true 2-gate deployment guard, no cache/no CORS, 1MB payload maximum, timeout, exact PNG header, missing/429/invalid/network failure unavailable without retries. `14` is a deliberately conservative application request ceiling, **not** claim of provider zoom coverage; live provider API contract/current access still unverified. Tests use synthetic upstream only. No Leaflet UI, new user-visible airspace data, DB migration, Training or production enable.
- Update audited runtime inventory **389→390**, direct GPS domain evidence and risk-scoped map browser ownership, affected fixed-count tests. **First A2B1 owner-local attempt (exact SHA `71646cd2`)**: targeted **31/31 PASS**, source **233/233 PASS**, direct domain **31/31 PASS**, but TypeScript and independent Next build **FAIL** (`TS2345`: `ArrayBufferLike` passed to `NextResponse` as BodyInit); aggregate/Playwright **NOT RUN**. The next code commit copies the validated bounded bytes into an explicit `ArrayBuffer` for `NextResponse`, with no provider/auth logic change. **Updated HEAD still NOT RUN**; do not merge/deploy without exact-head evidence. Provider API reference and auth sourced from vendor discussions dated 2022/2024; current Swagger fetch unavailable, so production provider flags remain OFF.

## 3.7.0 openAIP A2B2 — private Airspaces overlay UI (draft, 10 October 2026)

- **A2B1 closed:** [PR #288](https://github.com/filipto861/flytally-logbook/pull/288) squash-merged as `03e849b6ae9721d52858a29901a062b5bbbeca3f` after user-local exact-head `ad070753` `release_status=PASS`, candidate `8cee4384d3d12fb45a2809765cdc9387f8c9a039c1e7a0a6533743f1e9623a5f`: source 233/233, direct domain 31/31, TypeScript and production build PASS, Node 1467/1467, browser Chromium 5/5 desktop and 5/5 mobile, postgres and scale N/A, blocked evidence none. Previous intermittent ECONNRESET could not be reproduced on subsequent exact-head full release; no diagnosed root cause. Production provider gates/key remain OFF/UNSET; **no live openAIP imagery**.
- **A2B2 draft, untested:** new OFF-by-default exact-true `NEXT_PUBLIC_FLYTALLY_AIRSPACES_MAPS` flag and isolated `components/airspace-map-control.ts` implementing Airspaces toggle in existing unfiltered, noninteractive Leaflet `flytallyAviation` pane. Four authenticated map consumers opt in: route overview, GPS tracks, private flight replay, GPS import review; public flight replay explicitly excluded. Same map/viewport/tracks maintained; separate Standard/Satellite controller untouched. Explicit click-only fetches through private A2B1 proxy, provider error disables/removes layer, zoom app limit 14 without coverage guarantee, openAIP attribution and explicit reference/coverage/current-status caveat. Add 5 source tests and synthetic PNG success/503 browser behaviors including Satellite switching and public exclusion. Source inventory 390→391; no DB change, provider request, production rollout, flight/certification mutation or Training change. **Current A2B2 HEAD tests/build/Playwright/CI NOT RUN**.

## Unreleased
## 3.7.0 openAIP A2A offline port — feature branch only (10 October 2026)

- After Satellite production deployment, start a small openAIP-only branch from the current `main` and bring forward precisely two isolated files from the old paused A2A branch: `lib/openaip-airspace-contract.ts` and `tests/v370-openaip-airspace-contract.test.ts`. Canonical XYZ parsing, unsupported/unsafe input rejection, and the explicit requested/authenticated/deploymentEnabled/providerContractVerified gate remain unchanged; no provider/runtime/UI requests.
- Register the new pure source contract in the GPS/map development registry with direct domain-unit tests; increase audited runtime source count `388` → `389` and synchronize its two regression assertions. Document unavailable/disabled behavior and next authenticated proxy milestone. **Owner-local at exact SHA `c02195078d4565b35ef0dbe0a28ad58d86b55c35`:** targeted **24/24 PASS**, source **233/233 PASS**, domain **24/24 PASS**, TypeScript **PASS**, independent Next.js build **PASS** (41/41 static pages), `blocked_evidence=none` and `iteration_status=PASS`. Candidate `94a285627c8d6d864b578cc9dae25796aae657eb88f72db230ddab8123ebd2e9`; `release_status=NOT EVALUATED`, full aggregate/authoritative Playwright/CI **NOT RUN**. Documentation update itself advances HEAD and needs candidate-bound retest. No migration, vendor traffic, production flag or deployment.



### 3.7.0 Satellite map selector — pre-merge development history (10 October 2026)

- Port the previously locally exercised PR #272 map-local Standard/Satellite selector to the **security-patched current `main`**, not the older stacked satellite branches. Scope: four authenticated Leaflet surfaces (route overview, GPS tracks, saved track playback, GPS import review); existing Share Story flow and publicly shared flight replay unchanged (Standard-only).
- Keep explicit selection, Standard default, no saved preference/no automatic Satellite load, same map/track/viewport identity, dark filtering on Standard only, Satellite attribution and failure fallback with disabled retry. Existing `getSession()`/private/no-store/strict-style tile endpoint is **not modified**. Build-time exact-true flag `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS` remains OFF unless explicitly enabled in an inspected deployment.
- Copy ported R1 controller, small UI control, CSS, scoped client integration, source guards and synthetic Playwright interactions; register new controller as owned GPS/browser risk. **Verification history:** at `368434b6`, targeted **16/16 PASS**, source **233/233 PASS**, domain **46/46 PASS**, typecheck and Next production build PASS. First exact-head Satellite ON release attempt **FAILED** in full Node aggregate (**1,455/1,456 PASS**) because `tests/timezone-semantics-source.test.ts` hardcoded registry count 387 after the new `components/satellite-map-control` moved actual registry total to 388; PostgreSQL, browser and OFF gate **NOT RUN**. Updated test inventory assertion 387→388 in the same PR after reviewing the owned new controller; **new HEAD not yet tested, no release PASS or production enable claim.** No DB migration, supplier GET, feature flag flip, training repo or deploy in this batch. Provider external-use entitlement remains unverified rather than claimed.

### Satellite security containment — local acceptance and Playwright fixture correction (10 October 2026; Draft PR #282)

- At exact PR head `be52aee27945f4833950e2d7c0ab73f82fe2bb63`, owner-local targeted Node **13/13 PASS**, full Node **1,453/1,453 PASS**, typecheck/source/domain **PASS**, production Next 16.3.2 build **PASS**; live local unauthenticated Satellite **401 private/no-store** and malformed duplicate style **400 no-store**, with no wildcard Satellite CORS. **Not CI or production evidence.**
- First risk-scoped browser gate at that SHA: dedicated localhost PostgreSQL fixture precheck/bootstrap **PASS**, desktop Playwright **4/5 PASS, 1 fixture setup FAIL**, mobile **NOT RUN**. Missing `flight_public_shares` arose because the map test fixture deleted from a runtime-lazy table before its first public-share route use. No test proved a Satellite map regression.
- Test-only `e2e/map-layers.spec.mjs` correction initializes the lazy public-share schema via synthetic local public-route probe and asserts table existence before fixture deletion. No runtime/DB migration/provider changes. **Re-verification of the new PR HEAD is pending**; no release gate PASS, merge, production deploy, provider license or CDN confirmation.

### Satellite authorization test compatibility — 10 October 2026 (unmerged Draft)

- Owner-local Node 24.19.0 first targeted run **12/13 PASS** (all five isolated API handler behavior tests PASS, one source assertion failed because it searched a literal LF line break on Windows), `npm run typecheck` PASS, `npm run build` PASS (Next.js 16.3.2, 41/41 pages). The exact local commit SHA was **not supplied**; branch was at remote HEAD before the fix according to the supplied commands.
- Follow-up change only to `tests/v370-map-layers.test.ts`: replace brittle `indexOf("if (wantsSatellite) {\\n    const svg")` with line-ending-independent `lastIndexOf("if (wantsSatellite) {")`. Runtime handler unchanged; **new-head test rerun NOT RUN**, full Node suite/PG/real Next HTTP/browser/CI/deploy NOT RUN.


### Security remediation candidate — Satellite endpoint session check (10 October 2026; unmerged)

- **Draft code only:** Add `getSession()` authorization before Satellite token/upstream access in `/api/map-tile/[z]/[x]/[y]`, `401` for unauthenticated `style=satellite`, `private, no-store` on permitted responses and remove Satellite wildcard CORS; preserve public Standard style including legacy omitted style. Next.js 16 default GET request-time handling is retained; an initial proposed `force-dynamic` export was removed because it would also override the existing Standard upstream cache. This caching assumption must still be checked in a real Next HTTP test.
- Add targeted source-contract regression asserting order of style parsing → session authorization → token/upstream and distinct private Satellite vs public Standard response policies. Added isolated `tests/v370-map-tile-auth-behavior.test.ts` exercising the actual compiled GET handler with mock session/provider (anonymous 401/no fetch, signed-in SVG/private, missing token 503, strict style 400, public Standard). Added [security acceptance + CDN rollout runbook](docs/product/3_7_0_SATELLITE_AUTH_SECURITY_ACCEPTANCE.md). **Both are staged, test runner NOT RUN.** Existing authenticated Story continues using the same endpoint; actual behavioral preservation requires local browser/HTTP verification.
- This patch does **not** fix existing CDN caches automatically, set server-side global upstream disable, validate Esri licence/tiling, impose proven resource limits or enable Satellite maps. **Node/build/DB/Playwright/CI/production smoke NOT RUN** for this new exact branch; merge/deploy/version decision PENDING.


### Documentation governance — 10 October 2026 (docs-only branch; not yet merged)

- Reconciled `ROADMAP.md` and `FEATURES.md` against actual GitHub states: Standard Maps PR #269 **MERGED**, documentation PR #270 **MERGED**; Phase 1 owner-accepted. Production remains **3.6.0**; full 3.7.0, Satellite and openAIP are **not shipped**.
- Promoted the owner's **Satellite FIRST** decision to the canonical forward plan: source-backed Satellite provider decision and integration/acceptance before continuing openAIP. Both capabilities remain 3.7.0 targets unless the owner changes release scope. Esri rights/grid/cost and openAIP rights/current API stay blocked.
- Shortened current ROADMAP from 1,159 lines to a concise active execution plan; the full previous text is copied verbatim to `docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md`. The archive preserves old verification, frozen decisions and outdated time-of-writing statuses; these must not be read as current.
- This is documentation only. No runtime, data model, GPS/certification, provider traffic, DB schema, production env, flag, release version or deployment changed. **Local full tests/build/Playwright/DB/CI/production smoke NOT RUN** for this docs branch; targeted source/document invariants will be inspected prior to PR review. No merge yet.

**Historical evidence below:** claims that PR #269 or #270 were once Draft/pending, or Phase 1 smoke was pending, refer to earlier dated checkpoints and are **superseded**, not current status. Retained unchanged to protect the audit trail.


- **Phase 1 standard-only production functional acceptance (9 October 2026; documentation closeout in Draft PR #270):** Owner confirmed browser Map/light-dark, existing GPS replay and playback continuity, public share/privacy, and mobile/iPad interaction work on `fly-tally.com`. This is **user-reported manual PASS**, not independent native Safari screenshots or browser traces. Production Map API HTTP 4/4 PASS (real OSM image and strict style 400); Vercel READY at `cc7abd41`; latest inspected aggregated runtime errors none. Prior local exact candidate full `release_status=PASS`. Remaining: merge docs PR #270 to complete documentary Phase 1 closure; product version 3.6.0 and full Maps 3.7.0 release unchanged; satellite/openAIP provider gates BLOCKED.


- **Production public Map API smoke PASS 4/4 (9 Oct, GET-only):** `fly-tally.com` returned Standard OSM tile HTTP 200 `image/png`; unknown style and two forms of duplicated `style` returned HTTP 400 JSON `unsupported_style`, `no-store`. User PowerShell reported `PUBLIC MAP API SMOKE PASS`. **Live signed-in map/GPS playback, public share/privacy and native iPad/mobile browser smoke remain NOT VERIFIED**. Production acceptance stays OPEN, no full 3.7.0 release.


- **Phase 1 Maps standard-only MERGED / Vercel READY (9 Oct 2026; full 3.7.0 NOT RELEASED):** PR #269 squash merge `cc7abd41858cb2b2ddd8e794889922c856885686` from locally verified candidate `ef19b98cc30759a5b1f2b5f6b72ce8780be6890e293dd528bb6d04a794ce29ff`. Release gate PASS: Node 1,447/1,447, build, PG 100/100, Chromium desktop/mobile 12/12 each. Vercel `dpl_51zwnZYfFADxeDEyZheTYg9siXD8` READY on `fly-tally.com`; no full browser/live OSM/public-share production smoke confirmed yet. No new DB migration or certification changes; no 3.7.0 version bump or tag; old READY `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs` available for rollback. Satellite/openAIP external gates still BLOCKED; Phase 1 closeout PENDING.


- **Final pre-merge governance alignment after 9 Oct aggregate failure (NOT RELEASED):** On integrated feature head `82541845a6f79211d1b7dd4e79cb67a12a3988ec` targeted historical regression **4/4 PASS**, iteration **PASS** (source **233/233**, domain **46/46**, TypeScript PASS), candidate `b4666d0271de4fa728711769ebb43750a2a833d99c5ce2747661ae11859d21f1`; risk release **FAIL** at aggregate Node because two stale versioning-governance tests still expected pre-reprioritization Currency 3.7.0 / Onboarding 3.8.0. Aggregate/build/PostgreSQL/browser release PASS **not established** on that candidate. Test-only correction now validates Maps 3.7.0, Currency 3.8.0, onboarding 3.9.0 across ROADMAP and VERSIONING; VERSIONING status updated from obsolete "runtime not started" to implemented Draft/PENDING. Exact new-head release gate **NOT RUN**. Production code, DB schema and certification unchanged; PR #269 remains Draft/unmerged.


- **Post-docs-merge integration test repair (9 October 2026; NOT RELEASED):** docs PR #268 squash-merged to `main@5944f917`; feature PR #269 integrated it on `03257ee` with application/runtime trees unchanged. Local iteration `source=FAIL` 232/233 (one stale historical `v300-navigation-hierarchy` assertion still bound Currency to 3.7.0) and release `release_status=FAIL` stopped at same source gate; build, aggregate, PostgreSQL and browser **NOT RUN** on that candidate. Test-only correction `f0a0e0b` now asserts Maps 3.7.0 and Currency 3.8.0; new exact-head testing **PENDING**, not PASS. Previous `5538e0c` 1,447/1,447 + PostgreSQL 100/100 + desktop/mobile 12/12 each release PASS remains historical. Product strict-style decision A approved; no runtime/DB/deploy changes.


- **Phase 1 compatibility decision finalized (9 October 2026; NOT MERGED/DEPLOYED):** product owner accepted **A — strict HTTP 400** on duplicate, malformed or unknown `style` parameters; omitted `style` continues to select standard map. Deliberate incompatibility with legacy duplicate first-value parsing is approved. No extra runtime commit required: `5538e0c` passed exact-candidate local release gate. Satellite/openAIP external production gates are unchanged and blocked.


### Documentation / planning only (not a product release)
- **LATEST Phase 1 exact-candidate full local release PASS (9 October 2026, NOT MERGED/DEPLOYED):** PR #269 `feat/3.7.0-map-controller-phase1@5538e0c4eec8b4a70fc5568facc55f4dc7324606`, candidate `3334933268257a8e231ac7e172b1ffed38fa043d31b36699afe977d595ba7856`. Targeted Node 16/16, source 233/233, domain 46/46, typecheck PASS; release `release_status=PASS`: aggregate Node **1,447/1,447 PASS**, Next.js production build PASS, isolated PostgreSQL **100/100 PASS**, authoritative Playwright **12/12 desktop + 12/12 mobile PASS**, `scale=N/A` per planner, no blocked evidence. Test-only public share certified fixture setup/cleanup was repaired with transaction-scoped isolated cleanup; production flight certification/DB/schema untouched. Historic earlier release FAILs and iPad emulation on prior SHA are retained below; this current HEAD was not re-reviewed on native Safari/real provider tiles. Both PRs #268/#269 remain Draft/unmerged; CI, live provider, production smoke and deploy NOT RUN. Owner **approved decision A** (9 Oct): strict HTTP 400 for duplicate `style` values, including identical pairs, accepting legacy first-value compatibility change; independent satellite/openAIP provider gates still BLOCKED.

- **11th local verification / regression patch (9 Oct 2026):** user fast-forwarded exact feature head `9a325ca`, guarded dedicated PostgreSQL at 127.0.0.1:55432 and ran `verify:iterate` **PASS** (source 233/233, domain 46/46, TypeScript PASS, `candidate_id=473c1318a0797ea474751f4207a96a39667687cc729035002c7652fb92ea3f64`, no evidence blockers). `verify:release:risk` returned **`release_status=FAIL`, `aggregate=FAIL`** because two Node source/unit tests failed: (1) historical public-share viewer test asserted a direct `FlightTrackPlayer` string in public page, incompatible with the deliberate SSR-safe `PublicFlightMap` boundary; (2) case-variant `Style=satellite` was not rejected by case-sensitive malformed-style key matcher (returned standard `map` instead of `null`). This is not PostgreSQL/browser failure: those gates were **NOT RUN** after aggregate FAIL. PR #269 now on unverified feature head `1a930465ea3d465cb20d6eac17712d9511888436`: update public-share source contract to assert the dynamic `PublicFlightMap -> FlightTrackPlayer` delegation and `ssr:false`, reject case-variant `style*` keys in parser, and include uppercase/mixed alias cases in unit + HTTP e2e. **New-head tests/build/PostgreSQL/browser NOT RUN**; prior 24-browser/100-PG and iPad 16/16 PASS only on `b3917c7` are historical. Both PRs remain Draft, no merge/deploy. Owner compatibility decision for legacy duplicate style still open.
- **Independent PR review + iPad evidence and pre-merge remedial Draft PR #269 (9 Oct 2026; NOT RELEASED):** DeepSeek/Claude read-only independent reviewer verdict **APPROVE WITH CHANGES** on PR269.patch. Received and inspected 16 PNG screenshots/report/server log: iPad Chromium touch emulation **16/16 PASS** for portrait/landscape × light/dark × four map surfaces on original `b3917c7`; map movement lock/enable gestures PASS; native Safari and live provider tiles NOT RUN. Validated two review blockers and updated feature PR #269 to **`9a325ca1021c9305f1d3ecc0456c0921d086f9e5`**: strict rejection of malformed `style[foo]` / nested/mixed style aliases with unit/browser cases, client-only public `/f/[token]` GPS replay wrapper with SSR source guard across all app page/layout modules, regression route fixture, risk registry ownership and audited runtime count 387. Actual source has correct UTF-8 loading ellipses; patch mojibake was a decoding artifact, no code change. Legacy satellite duplicate query style remains intentionally rejected (owner acknowledgment pending), mocked tile/browser visuals do not verify upstream, transient hover highlight is minor deferred. **New head has no completed verification gates**; historical full-release PASS on `b3917c7` is not transferable. No merge/deploy, both PRs Draft.
- **Supplementary closure preparation (9 Oct 2026, NOT ACCEPTANCE PASS):** conducted a first-party read-only diff inspection of feature PR #269 (28 changed files; HEAD `b3917c7`). Produced a **separate git-ignored local iPad Chromium touch-emulation kit**, covering 820x1180 portrait and 1180x820 landscape, light/dark across route, GPS tracks, saved replay and GPS import (16 screenshot/test combinations). It tests pane/filter/attribution, overflow, movement-toggle lock and CDP simulated touch pan, logs JS failures and packages screenshot+JSON evidence. The runner was syntax checked but **NOT EXECUTED** against the Windows app; it uses controlled SVG tiles and does NOT constitute native iPad Safari or real-provider visual equivalence proof. A read-only independent DeepSeek/Claude PR #269 review handoff is prepared but **NOT SUBMITTED/REVIEWED** via a separate AI, so no independent verdict can be claimed. Review attention: examine strict style parser handling `style[foo]` aliases, Leaflet SSR/basemap cleanup, route hit targets and legacy satellite endpoint licensing. No code/feature candidate change; both PRs remain Draft/unmerged. Next actual evidence: owner runs the isolated iPad kit and sends evidence ZIP, forwards handoff to independent reviewer, then findings are reconciled before merge decision.
- **Phase 1 exact-head risk release PASS (9 Oct 2026; evidence, not deployment):** feature Draft PR #269 at `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`, candidate `e8685272ae5e753ab6c8a577799da203795fb1ffcac382c096f63c2350915e25`. User-local `verify:release:risk -- --base origin/main` **`release_status=PASS`**: source-contract 232/232 PASS reused, domain-unit 46/46 PASS reused, TypeScript PASS reused; aggregate Node **1,444/1,444 PASS** (0 fail/skip); Next.js 16.3.2 production build **PASS** (41 static paths); isolated full PostgreSQL acceptance **100/100 PASS** including 10k/50k/100k scenarios; authoritative Playwright **12 desktop + 12 mobile = 24/24 PASS** (single worker, no retries reported); `scale=N/A` per planner; `blocked_evidence=none`. The previous GPS Save & certify timeout and Next/Leaflet SSR `window is not defined` error did not appear in the final provided run. Only nonfatal parent lockfile warnings and `slow-server-task` observations remain; no new DB/certification/backup feature change. **Remaining DoD:** standalone iPad portrait/landscape light/dark and pointer proof, final independent reviewer, owner's merge decision and production smoke/deploy. Docs PR #268 and runtime PR #269 still DRAFT/unmerged, CI/merge/deploy NOT RUN. Provider-gated satellite/openAIP remain BLOCKED.
- **Ninth verification cycle (9 October 2026, updated exact head `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`):** user clean Windows checkout fast-forwarded to feature head, and `npm.cmd run verify:iterate -- --base origin/main` completed **iteration_status=PASS**, source-contract **232/232 PASS**, domain-unit **46/46 PASS**, typecheck **PASS**, blocked_evidence **none**. Candidate ID `e8685272ae5e753ab6c8a577799da203795fb1ffcac382c096f63c2350915e25`. `release_status=NOT EVALUATED`, with **aggregate regression, production build, PostgreSQL acceptance and browser-risk PENDING for this new candidate**. This does not supersede the previous head's browser FAIL or prove the SSR fix/GPS browser synchronization; final release only after current-candidate `verify:release:risk` and browser cases pass. Existing dedicated localhost PostgreSQL on port 55432 must be identity-checked again before fixture bootstrap. No merge/deploy.
- **Eighth work cycle (9 October 2026 — saved GPS result confirmed; browser test repair NOT VERIFIED):** user executed a read-only SQL identity-guarded query against isolated `flytally_browser` at `127.0.0.1:55432` after the failing Playwright run: **one matching flight; certified=1, drafts=0, certification_version=8, certification_hash length=64, GPS tracks=1** for `user_id=9001`, `OK-E2E`, `2026-10-05`, off-block `14:00`. This proves persisted certified+GPS state at query time; due possible later fixture changes, not a complete timestamped action-latency measurement. The prior 5-second UI assertion failed while the trace showed a pending POST, rather than demonstrating a rejected certification. Feature PR #269 now at `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`: **test-only** GPS e2e adjustment waits for real flight-detail redirect with explicit 20-second limit, keeps banner, `CERTIFIED R1`, hash/version `8|64` and GPS-track `1` assertions; one-case 60-second test budget covers setup and navigation. No production GPS/certification/DB code was changed. Map SSR client boundaries and this test change are **NOT YET TESTED** on the new head; all former PASS evidence belongs to `5b011c8`. Risk release remains FAIL / not ready until exact-head verifier and browser checks pass.
- **Trace investigation (9 Oct 2026):** the user supplied the failed GPS Playwright `trace.zip`. The click on `Save & certify flight` completed, and an authenticated `POST /flights/new` began; the network archive records that request with `status=-1` and no response before Playwright's five-second confirmation expectation timed out. The screenshot shows `Saving draft…` and `Saving & certifying…` pending; no server-action error or certification result is evidenced by the trace. Thus **server action slow/incomplete is observed, but GPS persistence/certification failure is not proven**. Next: before any re-run/fixture reset, use a read-only SQL query for the exact known fixture (`user_id=9001`, `OK-E2E`, `2026-10-05`, `off_block=14:00`) to establish whether it reached draft/certified state. Keep the 5s failure as real acceptance FAIL; do not simply waive/skip it. Map SSR mitigation in head `3777fb0` remains NOT TESTED.
- **Seventh work cycle (9 October 2026 — SSR hardening drafted, NOT VERIFIED):** read-only inspection identified direct Leaflet imports in SSR-rendered client module graph for `/map` and flight-detail GPS replay. Feature branch PR #269 now introduces `components/client-maps.tsx` with `next/dynamic({ssr:false})` wrappers for route/track maps, updates `app/(protected)/map/page.tsx`, dynamically loads the Leaflet flight player inside `components/lazy-flight-track-review.tsx`, and adds a source regression contract in `tests/v370-map-layers.test.ts`. Latest feature head `3777fb0f76bd4555ef420da5b750403cbc8eb39e` (seven small feature commits after `5b011c8`), including explicit risk/browser-target registry ownership for `components/client-maps.tsx` and audited runtime total 386. This specifically attempts to address the observed `window is not defined` SSR errors; **no runtime/typecheck/browser tests have been run on this new head**, so resolution is not yet claimed. GPS direct Save & certify has **not** been changed: failure screenshot still shows `Saving draft…` / `Saving & certifying…` pending after a 5s expectation; persisted-row outcome unknown until trace/read-only fixture query. The previous 100/100 PostgreSQL, 1,443/1,443 aggregate and Next build PASS apply to earlier `5b011c8` only and must not be silently reused for the new candidate. Both PRs remain Draft; no merge/deploy.
- **Sixth user-local run (9 October 2026, same feature head 5b011c8 / candidate afab37e...):** isolated PostgreSQL `flytally_browser` verified at 127.0.0.1:55432 (own cluster, separate from default server); `npm run verify:release:risk -- --base origin/main` reused source/domain/typecheck/aggregate/build PASS. **Full PostgreSQL acceptance 100/100 PASS**, including 10k/50k/100k scale tests (scope planner marked scale N/A for this candidate, but canonical full suite ran its scale cases). **Browser-risk first desktop group: 10 PASS / 1 FAIL**: `e2e/gps-rolecrew.spec.mjs` GPS Save & certify completion banner `Flight saved and certified.` not visible within 5s. Production Next server also logged two `ReferenceError: window is not defined` module-evaluation errors during map theme/replay scenarios despite those cases counted PASS. **Authoritative browser evidence PARTIAL; final `release_status=FAIL`.** Browser mobile group NOT RUN because browser risk stops on failing desktop group. Screenshot, Playwright trace and error-context.md preserved on user workstation; root cause and persisted certified-row state are NOT YET CONFIRMED. Do not mask with longer assertion timeout or ignore SSR errors; investigate evidence first and keep both PRs Draft/unmerged. No code or schema/deploy changes from this acceptance run.
- **Phase 1 first exact-candidate release attempt (9 Oct):** feature `5b011c8`, candidate `afab37e13e2568a966c0821dc48f842427b1416dd5ccec35bc6be964f328a35a`, `verify:release:risk -- --base origin/main` reused source/domain/typecheck PASS, executed aggregate **1,443/1,443 PASS** and Next.js 16.3.2 production build **PASS** (41 static paths). Final `release_status=NOT RUN`, PostgreSQL **NOT RUN**, browser-risk **NOT RUN**, `blocked_evidence=none`. Windows environment had no PowerShell `DATABASE_URL` and no `psql` on PATH; an existing PostgreSQL 16 installation folder was found. This is a test-environment blocker, not a verified application failure. No merge, DB migration or deploy.
- **Phase 1 fast verification (9 Oct):** user-local Node 24.19.0 `verify:iterate -- --base origin/main` on feature `5b011c8` completed **iteration_status=PASS**, source 232/232 PASS, domain 46/46 PASS, typecheck PASS, blocked_evidence=none, candidate_id=`afab37e13e2568a966c0821dc48f842427b1416dd5ccec35bc6be964f328a35a`; **release_status=NOT EVALUATED**. Release gates remain pending. Browser fixture bootstrap destroys/recreates PostgreSQL `public` schema; only use a dedicated isolated localhost test DB.
- **Phase 1 test evidence update (9 Oct):** user-local full `npm test` on exact feature branch commit `5b011c8` completed **1,443/1,443 PASS**, 0 FAIL, 0 SKIP. Earlier isolated failures are resolved. This is **not a product release** or merge: latest-candidate `verify:iterate`/typecheck/build/PostgreSQL/Playwright/risk release remain pending; both PRs are Draft.
- Follow-up local check of unmerged Phase 1 PR #269 at `fc68861`: **1,442/1,443 PASS, 1 FAIL**. The remaining `tests/timezone-semantics-source.test.ts` inventory assertion expected 383 instead of actual 385 new runtime files. Corrected only the assertion in feature commit `5b011c8`; **post-fix npm test NOT RUN**, no merge/deploy.
- Recorded 9 Oct local validation evidence for **unmerged Draft PR #269**: earlier candidate `fb0471c` typecheck and Next build PASS, `npm test` **1,437/1,443 PASS; 6 FAIL**, and `verify:plan` with no blocked evidence. Feature PR now contains proposed fixes to all six test contracts/registry expectations (historical 98 browser executions retained; new five logical browser tests distinguish planned from verified). **Post-fix suite, PostgreSQL, Playwright and deployment NOT RUN**. No runtime change in this documentation PR.
- Phase 1 test contract was accepted by Filip; a separate **Draft, unmerged feature PR #269** was opened from canonical `main` with a standard-only Leaflet map controller candidate, strict tile-style parser, theme-lifecycle refinements and browser/Node tests. This is a report of **unverified proposed code in another PR**, **not** a shipped change in this documentation branch or production. Only the **byte-identical standalone style parser** was tested locally (4/4 PASS on Node22; Git blob SHA verified). Repository-wide tests/typecheck/build/Playwright/DB/deploy **NOT RUN**. Docs-only PR #268 remains unmerged.
- Received follow-up **APPROVE WITH CHANGES** review for the 3.7.0 Phase 1 map design, while Esri satellite production and openAIP production remain externally BLOCKED. Added an explicit Phase 1 test-registration/acceptance contract (map-specific Playwright target identities, fixtures, pane/lifecycle DOM oracle, route `style` failure matrix), clarified server-side 401/403 auth, provider proxy cache/raster/CSP guards, and reconciled ROADMAP/FEATURES. This is **planning only**; browser targets are NOT registered, runtime/testing/production unchanged.
- Reconciled the independent **BLOCK** review of the 3.7.0 map contract: exact Leaflet pane names/z-index, scoped dark-filter requirement, strict map tile `style` allowlist, native Node/Playwright behavioral acceptance, separation of map-instance lifecycle from controls, explicit exclusion of new public-share satellite/openAIP overlays, and still-blocking Esri/openAIP rights/credential/API gates. Added review reconciliation document and synchronized roadmap/feature plan. **No runtime changes or provider approval; no tests/build/deploy claimed.**
- At Filip's 9 October 2026 product reprioritization, drafted the **3.7.0 Maps & Aviation Layers** read-only Phase 0 inventory, technical contract and independent review handoff. Shifted the unimplemented Currency / monetary semantics workstream (#136) to 3.8.0, heterogeneous aircraft onboarding to 3.9.0 and aircraft sharing/recovery/scale to 3.10.0 while preserving their requirements and historical reservations. Updated ROADMAP, FEATURES, VERSIONING and the documentation index. **No runtime code, DB schema, certification/backup format, application package version or deployment changed; API/provider rights and design review remain pending.**

## 3.6.0 — 9 October 2026

### Saved-date / timezone semantics
- Completed P1.0 read-only discovery on `main@eafc347fe00e781f966cc328da67ec24e52c8287` and drafted the Phase 1 contract. Confirmed Prague-hard-coded saveable defaults in Manual New Flight, Aircraft Manager and Quick Add; a separate UTC fallback in FlightForm; raw timezone persistence in Settings; date-only authority for stored flight/rate dates; UTC authority for current GPS/FCL.050 server consumers; and backup/restore preservation of stored dates/settings.
- Independent P1.1 review returned **APPROVE WITH CHANGES**. Repository-specific recommendations were re-checked against the private actual repo before acceptance because the reviewer could not access it directly.
- Reconciled/froze the design before runtime work: strict `resolved / needs_configuration / unavailable` saveable-calendar result; server-authoritative named-timezone validation with raw numeric offsets rejected; mounted-form defaults stable across midnight/timezone changes; server-provided Manual Flight default replacing the client UTC fallback; explicit Quick Add rate/effective-date fail-closed rule; cross-timezone restore invariance; and production timezone-value census required before release.
- Completed the hidden-consumer audit relevant to #144: active GPS save/review paths use the `lib/kml.ts` UTC override or explicit `utcParts`; in-scope date inputs remain string-backed; rate selection remains date-only; CSV/XLS/print preserve stored flight dates without timezone conversion. Adjacent credential/recency/print current-date semantics are tracked separately as #258 rather than silently expanding this release.
- P1.1 is **DONE / REVIEW RECONCILED** and P1.2 is implementation-ready. Runtime implementation remains **NOT STARTED** at this documentation head. DB migration, historical backfill and portable-backup version bump remain N/A on current evidence.
- Started P1.2 implementation: added a strict named-timezone/date primitive and fail-closed per-user saveable-calendar resolver; retained the resilient display-only timezone helper unchanged; Settings now validates timezone at the server write boundary before account-setting persistence and surfaces a controlled invalid-timezone error; new unit/source-contract coverage includes DST and non-whole-hour zones. The existing Settings browser transaction case now also verifies an invalid timezone cannot partially persist unrelated account changes. Manual Flight/Aircraft/Quick Add consumer rewiring is not included yet. Verification pending.
- Closed P1.2 as **DONE / VERIFIED** and merged PR #259 to `main` as `445454b73bfad305264ed10ce74bc02335474c8c`. Exact implementation head `c38ac15a673f770c2ae8cd13a4b02a32c70188dd`, candidate `b8520903792d8af18f502469b028b3ab59c9c098bb47bf5bcbd42e5021fc13b5`, passed source-contract, TypeScript, aggregate **1419/1419**, build **41/41**, PostgreSQL **99/99**, and authoritative browser-risk **10/10** (5 desktop + 5 mobile, one worker); domain/scale N/A; no blocked evidence. FEATURES and DEVELOPMENT were reviewed and require no P1.2 capability/process change. P1.3 Manual Flight timezone default is now the next runtime milestone. Vercel production deployment `dpl_ALW8boy5UhafiGdymAxXkxGLi2Qv` for that merge reached **READY**. Public HTTP smoke was NOT RUN from the available environment.
- Started P1.3 Manual Flight timezone implementation: New Flight now resolves the strict user-calendar default server-side and passes it explicitly to FlightForm; the old Prague date in `getManualEntryDefaults()` and the client UTC `toISOString().slice(0,10)` fallback are removed as saveable-date authorities. New forms fail closed to an empty editable date with controlled configuration/unavailable guidance when automatic derivation is unavailable; Edit keeps the stored flight date; UTC flight-time semantics remain unchanged. Verification pending.
- Closed P1.3 as **DONE / VERIFIED** and merged PR #261 to `main` as `12b31ba6d837bdda17ae9e3d676ed9261ef816c7`. Exact implementation head `99babf404656f02cd3a07dcb53636a37d0eae9d5`, candidate `fa17f53001d3691fd510fa1b00049d47935e8b4cf39400b82c27ed38642a6b11`, passed source-contract, direct domain-unit, TypeScript, aggregate **1421/1421**, build **41/41**, PostgreSQL **99/99**, and authoritative browser-risk **10/10** (5 desktop + 5 mobile, one worker); scale N/A; no blocked evidence. P1.4 Aircraft/rate timezone defaults is now the next runtime milestone. Vercel production deployment `dpl_5ppQUbnQaTWqiVCJQ3RJ4oFfcbf6` for that merge reached **READY**. Public HTTP smoke was NOT RUN from the available environment.
- Started P1.4 Aircraft/rate timezone implementation: Aircraft Manager and Quick Add now receive the strict server-derived user calendar result; hard-coded Prague `today` constants are removed; new initial-rate and rate-history effective-date defaults come only from the resolved account timezone. Unresolved defaults remain empty instead of being guessed, visible rate dates stay manually editable, and Quick Add explains when an automatic rate date is unavailable. A positive initial hourly rate without a valid effective date now fails closed before the aircraft/rate transaction instead of silently dropping the historical rate. Existing rate history and date-only lookup semantics are unchanged. Verification pending.
- P1.4 planner pass initially failed closed because the development registry still owned `app/(protected)/database/` as `data-recovery`, while that module intentionally has no browser target ownership. Corrected the route ownership to `aircraft-airports` instead of weakening browser selection, and added planner regressions proving database page/actions select the approved aircraft browser targets without recovery-module blockers. Verification must be rerun on the new exact candidate. The `aircraft-airports` module now also requires PostgreSQL acceptance and carries `persistence-schema` risk so this ownership correction cannot weaken DB evidence for aircraft/rate mutations.
- Closed P1.4 as **DONE / VERIFIED** and merged PR #263 to `main` as `7920164f2e461cacbd99279488cc092ad3fc4674`. Exact implementation head `4caaae0e4e917f3d20f31db18096b1c953ff5559`, candidate `a67621e0618d2a847fef597f34ea7bf093781f572e4e55854f1ae1a6d3fdf952`, passed source-contract, direct domain-unit, TypeScript, aggregate **1427/1427**, build **41/41**, PostgreSQL **99/99**, and authoritative browser-risk **10/10** (5 desktop + 5 mobile, one worker); scale N/A; required evidence satisfied; blocked evidence none. FEATURES and DEVELOPMENT were reviewed and require no P1.4 capability/process change. P1.5 GPS/backup invariance and production timezone census is now active. Vercel production deployment `dpl_3q1Fj4kM1wKGsbXyVSJN14e77Nka` for that merge reached **READY**. Public HTTP smoke was NOT RUN from the available environment.

- Started P1.5 final invariance/closeout evidence: added regressions proving active GPS timestamp authority remains UTC/fail-closed, portable backup keeps flight/rate calendar dates literal, export/print do not reinterpret stored flight dates, and historical rate selection remains date-only. The dormant Prague `track-processing.localParts` helper is retained for backward compatibility but is not an authoritative active GPS path; deletion is deferred without exhaustive retirement proof. A read-only production census on 8 October 2026 found 5/5 users with settings, all five timezone values `Europe/Prague`, and zero missing/NULL/blank/invalid timezone configurations under the same Node 24 validation semantics. No production mutation was performed. P1.5 remains **ACTIVE / verification pending**; no runtime/schema/backfill/backup-format change is introduced by the evidence candidate.
- Reconciled independent P1.5 review: no timezone-semantic blocker found. Accepted the review's PostgreSQL-evidence concern and added an integration test proving PostgreSQL `json_populate_record` preserves flight/rate date-only values under both Pacific/Auckland and America/Los_Angeles session time zones, while source-contract assertions bind that behavior to the production exact-restore primitive. Optional cleanup suggestions (legacy helper naming/removal and export `date::text` hardening) remain deferred. Exact-candidate verification must be rerun because the candidate changed.
- Closed P1.5 and Phase 1 as **DONE / VERIFIED** on exact head `56e3b05620ee4c35693994e1e60276387a41fe97`, candidate `bd04725222af573ca986239dc168383a39e6c9da3809f8c8edd69dc51f78f988`: targeted P1.5 evidence **38/38 PASS**, TypeScript **PASS**, planner selected aggregate full-tests + PostgreSQL acceptance with no blockers, `verify:iterate` **PASS**, aggregate regression **1433/1433 PASS**, and PostgreSQL **100/100 PASS** including the cross-session-timezone date-only restore test. Build/scale/browser were correctly N/A; required `postgres-acceptance` was satisfied; blocked evidence none. FEATURES was reconciled to the implemented Phase 1 capability; DEVELOPMENT was reviewed unchanged.
- Final documentation-only closeout candidate `89514f05c9d1372b41c9d201e8935bd77e1cfdb78c01860714e8127e541be0ee` on head `d7fc026dbd8c0f4552ef5bec3a6a4870bfdb331f` returned `release_status=PASS` with every runtime/heavy gate correctly N/A, required evidence none and blocked evidence none. PR #265 then squash-merged to `main` as `d96aed69b9fee41550820a1d05666420bce4e9fb`; its Vercel production deployment was skipped/canceled by the development-only ignore guard because the merge changed only tests/documentation.
- Release candidate PR #266 advanced package/footer metadata to `3.6.0` and passed exact candidate `028ab691e12df14ebe79c2ce43ed284fcea21d25c7ac08f5c16ce43c9850e221` on head `32c3fa0dd1a5decd5dda7f0c0e67518f4e2da438`: source-contract and TypeScript PASS, aggregate regression **1433/1433 PASS**, production build **PASS (41/41 static pages)**, PostgreSQL/scale/browser correctly N/A, required `application-source-contract` satisfied and blocked evidence none. PR #266 squash-merged to `main` as `168bd029540474d6e806bf3e261fa855824b7c2a`; Vercel production deployment `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs` reached **READY** on that exact SHA and carries `fly-tally.com`; root and `/login` smoke returned **HTTP 200** from that deployment and the immediate checked runtime-error window contained no runtime errors. Product version is now **3.6.0** in production; schema remains v20, certification payload v8 and portable backup v13.

### Development / verification governance
- Added the 3.6.0 Phase 0 engineering-quality gate before any saved-date/timezone runtime implementation.
- Recorded and independently reviewed the current test/development audit, including the suite-wide PostgreSQL silent-skip exposure, test-scope registry drift, browser-runner reproducibility, browser-suite ownership and stale Git/PR hygiene.
- Started Phase 0A hardening: explicitly invoked PostgreSQL acceptance now owns the integration-test flag, rejects malformed or non-localhost database targets, preflights a real connection before test fanout, and supports an explicit `FLYTALLY_PSQL` path that is propagated to PostgreSQL/browser child processes when the client is installed outside `PATH`.
- Pinned Playwright Test 1.55.0 in repository dependencies, added an explicit authenticated browser gate, removed the ad-hoc manual-workflow runner install, and execute the pinned Playwright CLI directly through Node instead of a platform command wrapper.
- Hardened authenticated browser acceptance against current product contracts: certified test-fixture cleanup is local-only and transaction-scoped, GPS tests explicitly reopen auto-collapsing review sections and use the current first-split control before interaction, and obsolete pre-3.5.2 Night-definition browser expectations were replaced with the frozen always-on GPS/SERA behavior.
- Aligned the development/manual-workflow Node line to the production Vercel project's Node 24.x runtime.
- Corrected the browser PostgreSQL bootstrap timeout variable to `PGCONNECT_TIMEOUT`.
- Phase 0A gate-safety/reproducibility is verified locally: targeted governance **32/32 PASS**, PostgreSQL core **86/86 PASS**, PostgreSQL full **99/99 PASS**, TypeScript **PASS**, production build **PASS (41/41 static pages)**, authenticated browser acceptance **96 PASS / 2 intentional skips / 0 failed**, and the final corrected historical v1.44 source contract **5/5 PASS** after the preceding full suite proved the other 1,316 tests.
- Runtime product behavior is unchanged by this engineering-infrastructure work; FEATURES remains unchanged. Phase 0B risk-model / deterministic-selection work is now active.
- Phase 0B.1 registry convergence is verified: development risk/gate metadata and named targeted test groups share one v2 registry, CSS is UI/presentation instead of documentation, unknown runtime no longer invents PostgreSQL risk, and `test:ui` delegates to the registry-backed group runner rather than duplicating its 16-file list in package scripts. Verification: UI group **113/113 PASS**, TypeScript **PASS**, production build **PASS (41/41 static pages)**, full suite **1322/1323 PASS** with one stale documentation assertion, followed by the corrected development-pipeline file **12/12 PASS**.
- Phase 0B.2 stable ownership is verified: the audited 381-file app/components/lib runtime surface has **368 stable-owned files (96.6%)**, up from **121 (31.8%)**; the remaining **13** reviewed cross-cutting files are explicitly `shared-runtime` rather than guessed into a product domain. Verification: targeted scope/pipeline **28/28 PASS**, TypeScript **PASS**.
- Phase 0B.3 command convergence is verified: PostgreSQL scale-suite membership is single-sourced in the development registry, manual-cloud targeted verification executes the generic registry-backed `ui-contract` group, and DEVELOPMENT defines `scope:changed` as a planner with independent targeted/full/PostgreSQL/scale/browser/build gates. Verification: targeted scope/pipeline **29/29 PASS**, TypeScript **PASS**. Phase 0B is complete; Phase 0C browser-suite structure discovery/design is active.
- Phase 0C discovery inventoried the current authenticated browser architecture before refactor: the main spec is 2,053 lines/~127.6 kB with 48 logical tests and 25 browser-DB helper imports; two device projects still intentionally serialize through one mutable isolated PostgreSQL fixture. Draft 0C sequencing keeps one worker, splits helpers/spec ownership first, then removes only proven redundant device-project execution for tests that already own their viewport/theme matrices.
- Independent Phase 0C review returned **ACCEPT WITH CHANGES**. The reconciled plan adds a machine-checkable 0C.0 baseline, makes helper extraction deliberately minimal, keeps browser DB ownership centralized, splits into seven modest domains with full browser acceptance after each split batch, treats project×matrix deduplication as the highest-risk step, and keeps per-worker DB isolation out of scope.
- Added and verified the 0C.0 browser-suite baseline and structure contract: exact 48 logical test names, two-project/one-worker/retry invariants, centralized browser DB helper exports/fixture IDs/users, and required responsive/theme states. Verification: targeted structure/scope/pipeline **34/34 PASS**, TypeScript **PASS**.
- Phase 0C.1 minimal helper extraction is verified: only `expectNoHorizontalOverflow` and `loginBrowserPilot` moved into `e2e/browser-actions.mjs`; GPS/details/RoleCrew/request-hold helpers remain local, no tests moved, and browser DB/project/worker/retry behavior is unchanged. Verification: targeted structure/scope/pipeline **35/35 PASS**, TypeScript **PASS**, full authenticated browser **96 PASS / 2 intentional skips / 0 failed** in **4.9m**.
- Phase 0C.2 Batch 1 is verified: the four settings/connections mutation tests live in `e2e/settings-connections-mutations.spec.mjs` with unchanged names/assertions/fixture IDs. Verification: targeted structure/scope/pipeline **36/36 PASS**, TypeScript **PASS**, focused spec **8/8 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.8m**.
- Phase 0C.2 Batch 2 is verified: seven E1/Night/SERA advisory tests live in `e2e/advisory-presentation.spec.mjs`. Verification: targeted structure/scope/pipeline **37/37 PASS**, TypeScript **PASS**, focused advisory **14/14 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.7m**. The run again logged Windows/PostgreSQL shared-memory reservation warnings without a failing browser/persistence assertion; retain as a local-environment watch item if future failures correlate.
- Phase 0C.2 Batch 3 is verified: five Manual RoleCrew / verification / Safety Pilot PIC tests live in `e2e/manual-rolecrew-verification.spec.mjs` with unchanged names/assertions and centralized browser DB fixtures. Verification: targeted structure/scope/pipeline **38/38 PASS**, TypeScript **PASS**, focused spec **10/10 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **5.0m**. The recurring Windows/PostgreSQL shared-memory warning remains a local-environment watch item because it did not coincide with a failing assertion.
- Phase 0C.2 Batch 4 is verified: eight Manual aircraft-authority/certification tests live in `e2e/manual-authority-certification.spec.mjs` with unchanged names/assertions. Verification: targeted structure/scope/pipeline **39/39 PASS**, TypeScript **PASS**, focused spec **16/16 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.8m**.
- Phase 0C.2 Batch 5 is verified: nine broad responsive/theme matrix tests live in `e2e/responsive-presentation.spec.mjs` with unchanged names/assertions and F6 viewport/theme state labels. Verification: targeted structure/scope/pipeline **40/40 PASS**, TypeScript **PASS**, focused responsive spec **18/18 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **12.0m** on the second local PC. Its initial all-login failure was traced to missing local `SESSION_SECRET`, not a test assertion regression.
- Phase 0C.2 Batch 6 is verified: ten GPS functional acceptance tests and their GPS-only interaction helpers live in `e2e/gps-rolecrew.spec.mjs`; `e2e/public-shell.spec.mjs` contains exactly five public/auth/shell tests and no direct browser-DB/GPS helper ownership. Verification: targeted structure/scope/pipeline **41/41 PASS**, TypeScript **PASS**, focused GPS / RoleCrew **20/20 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **11.8m**. Phase 0C.2 domain splitting is complete.
- Started Phase 0C.2a helper-ownership reconciliation: generic `expectAuthenticatedRoute`, `ensureDetailsOpen`, and `holdPost` now have one shared home in `e2e/browser-actions.mjs`; shared GPS interaction helpers now live in domain-scoped `e2e/gps-actions.mjs`; local duplicates were removed from the consuming specs while presentation/shell-only helpers remain local. Source inventory remains **48 unique logical acceptance tests**. Verification is pending.
- Corrected the first 0C.2a candidate after focused Playwright discovery exposed a syntax-invalid stale `completeF43GpsPart` body tail in the GPS and responsive specs. Removed both tails and added a structure-gate `node --check` sweep for every `e2e/*.mjs` module so syntax-invalid browser modules fail before Playwright. Verification remains pending on the corrected head.
- Phase 0C.2a is verified on the corrected head: targeted structure/scope/pipeline **43/43 PASS** (including syntax checks for every `e2e/*.mjs`), TypeScript **PASS**, focused GPS **20/20 PASS**, focused responsive **18/18 PASS**, and full browser **96 PASS / 2 intentional skips / 0 failed** in **11.4m**.
- Started Phase 0C.3 proof-driven project×matrix deduplication: only four F6 tests that each own the complete viewport/theme matrix are tagged `@self-managed-presentation` and excluded from the Pixel 7 project via `grepInvert`; five narrower responsive tests retain both projects. Candidate keeps all 48 logical tests and targets 94 total full-gate executions instead of 98. Verification is pending.
- Phase 0C.3 is verified: targeted structure/scope/pipeline **44/44 PASS**, TypeScript **PASS**, focused responsive **14/14 PASS**, and full serialized browser acceptance with explicit retries=0 **92 PASS / 2 intentional skips / 0 failed** across **94 executions** in **10.3m**.
- Phase 0C.4 final acceptance is complete: all **48 unique logical browser tests** remain, fixture/reset identities and centralized `browser-db.mjs` are preserved, workers=1 remains, required presentation states remain evidenced, no product runtime/timezone/schema behavior changed, and per-worker DB isolation remains out of scope. Phase 0C is closed.
- Phase 0D independent review returned **ACCEPT WITH CHANGES**. The reconciled design keeps one development registry, separates risk/gate/evidence semantics, keeps build outside behavioral evidence, treats the full Node suite as aggregate regression only, and keeps `scope:changed` planner-only rather than fabricating observed test results.
- Started the Phase 0D evidence-taxonomy candidate: `development-modules.json` is schema v3 with four behavioral evidence classes; named `ui-contract` and `development-pipeline` groups are explicitly homogeneous application/source-contract groups; a JSON Schema contract and fail-closed evidence evaluator were added; `scope:changed` now reports required evidence, aggregate gates and build independently.
- Added negative evidence-contract regressions so source-contract PASS, aggregate `fullTests` PASS and build PASS cannot masquerade as domain/PostgreSQL/browser acceptance; required missing evidence reports NOT RUN, raw acceptance skips/retries prevent PASS, and explicit N/A cases remain distinguishable from skipped execution. Phase 0D verification is pending; no product runtime, DB schema, browser fixture architecture or timezone semantics changed.
- Phase 0D first full regression run exposed **14 stale source-contract assertions** left behind by the verified Phase 0C browser-spec split: the assertions still read `e2e/public-shell.spec.mjs` even though the covered browser behavior had moved to domain specs/helpers. The run itself was **1340/1354 PASS, 14 FAIL**; all failures were source-location drift, not browser/runtime execution failures. Retargeted those historical assertions to `browser-actions.mjs`, `settings-connections-mutations.spec.mjs`, `manual-rolecrew-verification.spec.mjs`, `manual-authority-certification.spec.mjs`, `responsive-presentation.spec.mjs`, and `advisory-presentation.spec.mjs`.
- Closed Phase 0D after correction verification on exact code head `686734911f5c3f45e395fdda6b7d98a5021e84ae`: development-pipeline **65/65 PASS**, TypeScript **PASS**, aggregate regression **1354/1354 PASS**, and production build **PASS** with **41/41** static pages. `domain-unit`, PostgreSQL acceptance and browser acceptance are **N/A** for this tooling/source-contract candidate under the frozen evidence taxonomy. Phase 0E canonical verification commands is now active.
- Started Phase 0E.1 canonical planner implementation: added explicit candidate-source parsing, content-aware candidate fingerprints, JSON/human `verify:plan` output, explicit planner `typecheck` selection, `--force-all` gate forcing without candidate expansion, and dedicated planner contract tests.
- Closed Phase 0E.1 after local exact-head verification on `34146fdc2cf8dc7645acfb1aea9de66078cd430a`: development-pipeline **72/72 PASS**, TypeScript **PASS**, aggregate regression **1361/1361 PASS**, production build **PASS (41/41 static pages)**, and canonical planner JSON smoke **PASS**. Phase 0E.2 available direct domain evidence is now active.
- Started Phase 0E.2: registered exact reviewed direct `domain-unit` evidence for all **10/10** current domain-risk modules, added pure aircraft-profile and professional-experience direct suites, added registry schema/selection enforcement, and extended `verify:plan` with module-scoped direct-domain tests plus fail-closed blocked-evidence reporting.
- Closed Phase 0E.2 after local exact-head verification on `3227bb587cd89a1d4d93cb8396b7a0388ebe4dc5`: development-pipeline **75/75 PASS**, dedicated direct-domain candidate **6/6 PASS**, TypeScript **PASS**, aggregate regression **1370/1370 PASS**, production build **PASS (41/41 static pages)**, and canonical direct-domain planner smoke **PASS** with no blocked evidence. Phase 0E.3 evidence ledger / canonical gate wrappers is now active.
- Started Phase 0E.3: added ignored candidate-bound verification ledgers; canonical `verify:app`, `verify:domain`, `verify:postgres`, browser-only `verify:browser`, and compatibility `verify:browser:with-build`; same-candidate Next build freshness enforcement; explicit browser N/A classification for the audit-capture exclusion; and registry risk mapping for the new PostgreSQL/browser harness wrappers. Verification is pending.
- First 0E.3 local verification attempt exposed two development-contract defects before heavy acceptance: one overly strict browser source assertion and TypeScript declaration errors caused by static `.mjs` imports in the new ledger test. Corrected both without product runtime changes and added a no-argument compatibility wrapper for legacy `npm run verify`; correction verification is pending.
- Corrected 0E.3 verification then passed development-pipeline **83/83**, TypeScript, aggregate regression **1378/1378**, production build **41/41**, and PostgreSQL full acceptance **99/99**. Full browser acceptance remained **FAIL** at **90 PASS / 2 FAIL / 2 intentional skips** (11.6 min); both failures were mobile-only and require focused reproduction before any test/runtime correction. Phase 0E.3 remains open.
- Focused mobile reruns of both browser failures passed independently with retries disabled. Added test-only synchronization hardening: explicit bounded post-save navigation wait for the GPS server action, and completion-state wait plus summary-scoped persistence assertions for Connection access. Full browser rerun is still required before 0E.3 can close.
- The synchronization correction passed a **6/6** targeted mobile repeat. `verify:app` remained green at **1378/1378** regression tests plus **41/41** build pages. The next full browser gate improved to **91 PASS / 1 FAIL / 2 intentional skips**; only the mobile F3.5 Quick Add status wait timed out. 0E.3 remains open and the next step is focused Quick Add reproduction, not another full matrix run.
- Isolated mobile F3.5 Quick Add then passed **5/5** with retries disabled, confirming suite-load timing. Hardened that browser test only: wait for the successful Quick Add dialog close and success notice with a bounded 15 s server-action window before proceeding. Product runtime remains unchanged.
- Product decision: the ~12-minute full 94-test browser matrix is removed from the normal development/Phase-0 closeout path. It remains available as a manual diagnostic, but targeted risk-owned browser checks will become the normal evidence path in 0E.4. 0E.3 requires only the cheap targeted Quick Add correction repeat; no unrun full-browser PASS will be claimed.
- Closed Phase 0E.3 after final targeted Quick Add correction **5/5 PASS** at retries=0/workers=1. Final 0E.3 evidence: development-pipeline **83/83 PASS**, planner PASS, direct-domain N/A for the tooling candidate, `verify:app` PASS with **1378/1378** aggregate regression + **41/41** build pages, PostgreSQL full **99/99 PASS**, and targeted browser correction evidence **11/11 PASS** across GPS, Connections and Quick Add. The legacy full browser matrix is **NOT RUN** after the policy change. Phase 0E.4 fast iteration / risk-based release orchestration is now active.
- Drafted the Phase 0E.4 fast-verification architecture: explicit registry-owned browser targets, fail-closed target selection, candidate-scoped `browser-risk` evidence, `verify:iterate`, exact-ledger reuse, risk-based `verify:release`, and preservation of the 94-test full browser command as manual diagnostics only. Implementation is pending independent review; no runtime/schema/timezone behavior changed.
- Phase 0E.4 independent review returned **ACCEPT WITH CHANGES**. Reconciled the design to keep legacy `verify:release` semantics unchanged, introduce `verify:release:risk`, machine-enforce browser-risk authority and exact selection/config/build/tool/fixture identity, fail closed on missing/stale/ambiguous browser ownership, and harden dirty/untracked candidate identity. 0E.4a implementation is active.
- Implemented the 0E.4a planning candidate: verification candidate/ledger schema v2 with dirty/untracked worktree identity; deterministic config/toolchain/browser-fixture contract hashes; registry schema for **41** exact risk-scoped browser targets; fail-closed browser target validation/selection and selection hashing; planner schema v2 browser-evidence output; and the correction that browser-required plans also require a production build artifact. Verification is pending; no new browser executor or release command is active yet.
- First 0E.4a local verification passed development-pipeline **91/91**, aggregate regression **1386/1386**, TypeScript and build **41/41**, but exposed generated local `test-results` / scale-evidence files as untracked candidate members. Added explicit ignores plus a regression test so generated verification artifacts no longer contaminate candidate identity. Final exact-head verification then passed at `4b14f34585f8d1653112e964ed4043c444dfe655`: clean worktree, development-pipeline **92/92**, aggregate regression **1387/1387**, TypeScript and build **41/41**, with planner candidate identity free of generated artifacts. 0E.4a is DONE / VERIFIED.
- Started 0E.4b fast iteration implementation: canonical source-contract execution/ledger, TypeScript ledger, exact candidate/config/toolchain reuse contract, planner source-evidence ownership and a separate `verify:iterate` command. Release/browser semantics remain unchanged; verification pending.
- 0E.4b candidate now runs/reuses only the cheap planner-selected source/domain/typecheck evidence and explicitly reports heavy aggregate/build/PostgreSQL/browser work as release **NOT EVALUATED**. Added `--rerun`, reserved/rejected `--with-browser` until 0E.4c, regression coverage for exact reuse/N/A reuse/docs-only iteration, and preserved the legacy `verify:release` command unchanged.
- Closed 0E.4b on exact candidate `d01813c978c63cd5fc14945fca9a310226d338d2`: first fast iteration development-pipeline **98/98 PASS** + TypeScript PASS, immediate exact-candidate repeat reused all cheap evidence, then `verify:app` passed TypeScript + aggregate regression **1393/1393** + production build **41/41**. PostgreSQL/browser were N/A for that tooling batch.
- Started 0E.4c risk-browser execution: planner-selected browser targets now have a dedicated `browser-risk` release-authority source, exact Playwright case identity/report schema, same-candidate build binding and an optional `verify:iterate --with-browser` path. The legacy full browser command is diagnostic only. Verification pending.
- First 0E.4c local run passed TypeScript, aggregate regression **1396/1396** and build **41/41**, then failed before browser execution with `No tests found`: the risk executor anchored `--grep` to the raw test title, but Playwright evaluates grep against its composed full title. Fixed the selector to use an escaped unanchored title fragment and retained exact post-execution `{spec,title,project}` equality as the authoritative completeness check. Fixed-head verification pending.
- Fresh-PC follow-up exposed a malformed edit in the new risk-title helper: development-pipeline reported **98/101 PASS** with all three failures caused by the same syntax error. Repaired the module, kept the full-title grep regression, and added `playwright-report/` to ignored/generated verification artifacts with candidate-identity regression coverage. Verification pending.
- Closed 0E.4c on exact head `9e9ec3a3d3cb70f43f3ea7b83e168edf174b2e6a`: development-pipeline **101/101 PASS**, authoritative browser-risk **41/41 PASS** (21 desktop + 20 mobile, retries=0, workers=1), TypeScript PASS, aggregate regression **1396/1396 PASS**, and production build **41/41 PASS**. PostgreSQL full was N/A for the 0E.4c browser-harness candidate; legacy 94-case browser remained NOT RUN by policy.
- Started 0E.4d release orchestration: added candidate-bound aggregate regression evidence, reusable build validation, config/toolchain-bound PostgreSQL evidence, conservative release-harness classification, and a new `verify:release:risk` command that reuses exact valid ledgers and evaluates one final evidence matrix. Existing `verify:release` semantics remain unchanged; verification pending.
- Closed 0E.4d and the 0E.4 fast-verification milestone on exact implementation candidate `7a8a98a587d0c2c80bac893ca0c50b24e86f06f0`: clean worktree, development-pipeline **109/109 PASS**, planner no blockers, iteration **222/222 PASS** with release correctly **NOT EVALUATED**, then `verify:release:risk` **PASS** with source/domain/typecheck exact-candidate reuse, aggregate regression **1404/1404 PASS**, production build **41/41 PASS**, PostgreSQL full **99/99 PASS**, browser-risk **41/41 PASS** (21 desktop + 20 mobile), scale N/A and no blocked evidence. The legacy 94-case browser diagnostic remained NOT RUN by policy and static `verify:release` remains unchanged. DEVELOPMENT/ROADMAP/detailed contract were reconciled; FEATURES was reviewed and remains unchanged because product capability/runtime did not change.
- Started Phase 0E.5 verification hardening: added direct negative coverage for ledger schema/gate/evidence/exit/config drift, candidate freshness for tracked dirty files outside explicit candidates, build-output freshness, browser-risk selection/config/toolchain/fixture/build freshness, and identity-input coverage. The small optional test seams in build/browser reuse preserve existing default runtime behavior; no product runtime, database schema, certification, backup or timezone semantics changed.
- Closed Phase 0E.5 on exact candidate `68351c78a0dac2b1f95de3530d2ceac116f2475e`: clean worktree, development-pipeline **113/113 PASS**, planner no blockers, iteration **226/226 PASS** + TypeScript PASS, aggregate regression **1408/1408 PASS**, production build **41/41 PASS**, authoritative browser-risk **41/41 PASS** (21 desktop + 20 mobile), PostgreSQL/scale N/A and final `release_status=PASS`.
- Started Phase 0E.6 manual-workflow alignment: DEVELOPMENT now names `verify:release:risk` as the canonical final candidate decision; manual GitHub workflow jobs are explicitly diagnostic, the Browser smoke workflow labels its repository-wide run as legacy/full diagnostic, stale pull-request-only job logic was removed, and regression coverage prevents those workflows from silently invoking candidate-bound release/browser-risk authority.
- First 0E.6 exact-candidate release attempt on `088aa71c6a8a43b48b40962c3eb667647d93d202` passed development-pipeline **113/113** and TypeScript, but aggregate regression stopped at **1406/1408** because two preserved v3.2 source-contract tests still asserted the superseded workflow labels `Chromium desktop + mobile` and `Application gate`. This was test-contract drift caused by the intentional diagnostic relabeling, not a product-runtime failure; both historical assertions were updated to the new explicit diagnostic labels and require targeted/release re-verification.
- Closed Phase 0E.6 on fixed head `734473252fe1acf64388fa15d9373777112d4977`: targeted historical workflow-label regressions **9/9 PASS**; `verify:release:risk` source PASS, domain N/A, TypeScript PASS, aggregate **1408/1408 PASS**, production build **41/41 PASS**, PostgreSQL/scale/browser N/A, no blocked evidence and final `release_status=PASS`.
- Started Phase 0E.7 exact-candidate closeout. The final Phase 0E verification boundary is the verified Phase 0D head `686734911f5c3f45e395fdda6b7d98a5021e84ae` through the final Phase 0E head; closeout will run `verify:release:risk --force-all` so all risk-scoped authoritative gates execute on one candidate. Legacy full browser remains diagnostic-only.
- First 0E.7 planner attempt correctly returned **NOT RUN** before execution because the cumulative Phase 0D → Phase 0E range includes `e2e/ui-audit-capture.spec.mjs`, which is explicitly diagnostic-only and has no authoritative browser target. The selector remains fail-closed; no target will be invented and the legacy full-browser diagnostic will not be promoted into release authority. Final 0E.7 closeout now uses verified 0E.5 head `68351c78a0dac2b1f95de3530d2ceac116f2475e` as the explicit base so the substantive 0E.6 alignment is reverified with `--force-all` while earlier milestones keep their own exact-candidate evidence.
- Closed Phase 0E.7 and Phase 0E on exact head `335704c1125ee0336528f5f1e43c3bc1528c92d3` / candidate `221190494ba79b32bb25f9e32c3ce09041dfd624f3f3a514cc8fb7a905c9477a`: `verify:release:risk --force-all` passed source-contract **226/226**, TypeScript, aggregate **1408/1408**, build **41/41**, PostgreSQL full **99/99**, scale, and authoritative browser-risk **41/41** (21 desktop + 20 mobile); domain was N/A, blocked evidence none, final `release_status=PASS`. Legacy 94-case browser remained diagnostic-only / NOT RUN. FEATURES was reviewed and unchanged. Phase 0F hygiene/closeout is now active.
- Verified the final Phase 0E documentation-only reconciliation on head `2969fae73e151044f0a2e6962d7abd57e8983da9`, candidate `dc3edcbb35b218aa2aceccafd139cf8187c86b0d3f8318937865f75a6694c732`: `release_status=PASS`, all behavioral/heavy gates N/A, required evidence none, blocked evidence none.
- Phase 0F discovery reconciled DEVELOPMENT against executable commands and audited repository hygiene. Seven historical branches are proven ancestors of `main`; five older open feature PRs (#187/#201/#206/#231/#232) are diverged/non-mergeable and remain untouched pending explicit supersession proof. PR #255 remains the active Phase 0 integration PR.
- Phase 0F supersession review proved all five stale parallel PRs obsolete and closed them without merge: #187 was replaced by merged #188/F0.1, #201 by merged #200/F1.4, #206 by merged #207/F2.2, and #231/#232 by the final F3.3 head `065896d3c9aa75fee8c2c0c7cc7a2f6abc20e52a` plus later F3.4/F3.5 stack already ancestral to `main`. No historical branch was deleted; the explicit pre-F3 rollback anchor is retained.
- Closed Phase 0F and Phase 0 on exact head `68ba83167c27e6de1e1027e007ea3b81acad17cc`, candidate `792ef0f2c8430a01f4bb1e24474b05991d0a83abee63650b7d72b8cb274892df`: `verify:release:risk` returned PASS with source/domain/typecheck/aggregate/build/PostgreSQL/scale/browser all correctly N/A, required evidence none and blocked evidence none. FEATURES was reviewed and unchanged. PR #255 integration into `main` remains the only repository action before Phase 1 timezone runtime work.
- Merged Phase 0 PR #255 into canonical `main` as `2238d0e1a645a4f9b584b291ecc12fbf8a2ee230`. Vercel production deployment `dpl_3hb8gebeWMYcxJWdsDmn6vumhK5f` reached **READY** and carries the `fly-tally.com` alias. External public HTTP smoke was NOT RUN from the available web-fetch surface. Phase 1 saved-date/timezone work is now ACTIVE for discovery/design; runtime code remains blocked until its contract is frozen.

### Print / PDF
- Hid the keyboard accessibility `Skip to content` link from printed logbook and Save-as-PDF output while preserving it in the interactive app.
- Added a source regression guard so the accessibility link cannot silently reappear in print output.

## 3.5.5 — 7 October 2026

### iPad sidebar collapse-control alignment
- Reworked the coarse-pointer collapse chevron into a dedicated 44 px sidebar-edge handle, separate from the logo and notification controls.
- Centers the handle vertically in the viewport and tracks the expanded/collapsed sidebar width so it stays attached to the rail in both states.
- The first production placement from PR #252 was visually rejected on iPad and intentionally superseded rather than treated as accepted.
- Corrective exact-head local gate before the final production fix: targeted **17/17 PASS**, TypeScript **PASS**, full unit/regression **1308/1308 PASS**, production build **PASS** with 41/41 static pages.
- PR #253 squash-merged to `main` as `ec75388ab437218086ef4fb86d1d53648fb77dbe`; Vercel production deployment `dpl_4NbxFjAa6dJyQn1VdiSwf4wndiUW` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- Production iPad visual acceptance confirmed the final centered edge-handle placement is accepted.
- Scope is presentation-only: sidebar state, notifications, routes and mobile navigation semantics are unchanged.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.

## 3.5.4 — 7 October 2026

### iPad flight-detail visual hotfix
- Keeps Back / Previous / Next / More together on wider iPad/desktop flight-detail headers instead of allowing only **More** to wrap onto a second line.
- Reflows the whole flight-detail header navigation below the flight identity on narrower tablet widths.
- Fully hides the keyboard **Skip to content** link until focus so its focus-colored border cannot leak into the iPad safe area.
- Final local gate: targeted **21/21 PASS**, TypeScript **PASS**, full unit/regression **1305/1305 PASS**, production build **PASS** with 41/41 static pages.
- PR #251 squash-merged to `main` as `8ed7567ca3f1f2ffb2834ecca0f29359bbd330c6`; Vercel production deployment `dpl_BceR2z3B27eXwnFuNzDL3AugQNjc` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- Production iPad visual acceptance confirmed the two targeted defects are resolved.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.

## 3.5.3 — 7 October 2026

### Flight detail navigation UX
- Reworked the existing flight-detail navigation into an obvious **Back to flights** control plus explicit **Previous flight** / **Next flight** controls.
- Previous/Next continue to use the existing filter-aware server navigation and preserve the active Flights query context.
- Boundary directions remain visible but disabled instead of disappearing, keeping the navigation layout stable.
- Mobile gives Back its own row and keeps Previous/Next in a two-column row without horizontal core-navigation scrolling.
- Final pre-merge local gate: targeted **18/18 PASS**, TypeScript **PASS**, full unit/regression **1302/1302 PASS**, production build **PASS** with 41/41 static pages.
- PR #250 squash-merged to `main` as `7068c5f03a3bf5b05ef5f0b45793db54848b9c9e`; Vercel production deployment `dpl_5w2vFSXpSbVEruqcP8mzjXRLuqag` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.
- Post-deploy iPad visual review found two presentation-only defects (More wrapping and a hidden skip-link safe-area border fragment); corrective scope is isolated in 3.5.4.

## 3.5.2 — 7 October 2026

### Always-on GPS/SERA Night suggestions
- Removed the account-level **Night definition** selector from Settings; GPS/SERA Night suggestion behavior is no longer user-toggleable.
- GPS import now attempts the existing SERA Day/Night landing split and conservative Night-time suggestion automatically whenever the canonical flight context supports those fields.
- Preserved the existing civil-twilight calculation and fail-closed evidence contract: -6° geometric boundary, ±0.5° confidence guard, explicit UTC/offset evidence, sparse-gap/track-integrity rejection, sticky pilot edits and manual fallback when exact GPS evidence is unavailable.
- IFR remains manual. Legacy stored `night_definition` values are ignored by active flight-entry behavior; no DB migration, certification-payload change or historical-flight rewrite was introduced.
- Added/reconciled source regression coverage for the removed Settings switch, always-on applicability gating and sticky manual Day/Night/Night-time edits.
- Final exact-head local verification: targeted 3.5.2 / 3.4.1 / E2 GPS contract **24/24 PASS**, TypeScript **PASS**, full unit/regression **1298/1298 PASS**, production build **PASS** with 41/41 static pages.
- PR #248 squash-merged to `main` as `60be6fd23f283302dadc7a3d611a19ff0bc8ebf3`; Vercel production deployment `dpl_4pyJEv2pjWQLNcmNPpFYcjsf3PHj` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the checked immediate runtime-error window was clean.
- PostgreSQL migration **N/A**; production schema remains v20, certification payload v8 and portable backup v13.

## 3.5.1 — 7 October 2026

### GPS touch-and-go reliability
- Tightened advisory GPS touch-and-go inference against three reproduced real-track false positives without adding a new auto-counted T&G path.
- Rolling-altitude T&G now requires post-minimum climb evidence beyond a single timed altitude edge; the existing 28–145 km/h rolling-speed range, 30 m altitude evidence and 25 m/s gross-discontinuity guard remain unchanged.
- Short speed/ground events are no longer accepted as T&G when direct event motion exceeds the existing 145 km/h rolling ceiling or usable altitude changes by at least 30 m during the alleged ground interval.
- Takeoff inference, shared ground-stop split detection, the public T&G DTO, database schema, certification data and historical flights are unchanged.
- Added anonymized real-derived regressions for the level-shift false event, climb-out sawtooth false event and duplicate/stale-fix false HIGH event, plus positive controls for five rolling T&Gs and a genuine stop-and-go.
- The separate real T&G missed near 15:59 remains intentionally non-auto-counted: new evidence proves the current ±10-array-point qualification window is defective, but that event also crosses gross-corrupt approach altitude evidence. Time-normalized qualification and an evidence-limited non-counted review tier remain separate unnumbered research rather than weakening fail-closed behavior.
- Local isolated verification on the feature branch: targeted 3.5.1 **6/6 PASS**, focused GPS/track corpus **62/62 PASS**, full unit/regression **1297/1297 PASS**, TypeScript **PASS**, production build **PASS** with 41/41 static pages. PostgreSQL and browser acceptance are **N/A / NOT RUN** for this pure track-inference change; no DB or UI runtime contract changed.
- PR #245 merged to `main` as `230d835a9e4c3fddb02bf7b729242632626cb9a7`; Vercel production deployment `dpl_AGLoght4FF1khhviPaZvMu5SZ2oT` is READY on that exact SHA, carries `fly-tally.com`, returned HTTP 200 on the root/login smoke surface, and had no grouped runtime errors in the checked post-deploy window.


## 3.5.0 — 7 October 2026

### Certified flight voiding + multi-aircraft integrity
- Certified flight voiding: owners can remove an incorrectly certified flight from active-logbook use while preserving immutable certification and audit evidence.
- Permanent void audit: the original certified snapshot, certification fingerprint and revisions, verification evidence, void actor/time and mandatory reason are retained.
- Collaboration safety: public shares are revoked, pending source workflows are superseded, and independently owned participant copies remain intact with permanent source provenance.
- Backup/restore v13: protected void and provenance history is portable as authenticated history-only evidence and cannot silently resurrect an active certified flight.
- Multi-aircraft integrity audit: historical regulatory facts remain flight-snapshot authoritative; production census found no malformed or legacy Part-FCL override state requiring a runtime compatibility layer.
- Database schema v20: permanent void archive/provenance protections were deployed with preflight, recovery branch, reconciliation and postflight verification.
- Production verification: final local gate passed 1289/1289 unit/regression and 99/99 PostgreSQL integration+scale; authenticated certified-voiding acceptance passed desktop/mobile 2/2; production deployment reached READY and immediate runtime-error check is clear.

### Detailed implementation record
- Froze the archive+delete model after independent review: certified flights will be removable from all active logbook consumers while permanent certification/audit evidence remains.
- Started schema v20 with a permanent certified-void tombstone, protected revision/verification archive tables, typed dependent-evidence archive rows, accepted participant-copy provenance, same-transaction certified DELETE authorization and active/tombstone coexistence protection.
- Added source-level and PostgreSQL acceptance coverage for migration v20, archive immutability, participant provenance, direct-delete rejection, same-transaction deletion and certified-correction compatibility.
- Repository reconciliation corrected the portable-backup baseline: current exports are v12 with server authenticity; certified-void archive support is therefore reserved for portable backup v13.
- M2 now includes the canonical authenticated atomic void mutation: exact-row optimistic locking, permanent evidence archiving, pending workflow supersession, public-share revocation, participant-copy provenance binding, active revision/track removal, final evidence-count-gated flight deletion, recency refresh and active-view invalidation.
- Shared-flight materialization now persists source provenance before an accepted participant copy is linked.
- Added the certified-flight removal UX and dedicated immutable void-audit route, including mandatory reason, duplicate-submit protection, active-logbook exclusion warning, success-to-audit link, and legacy audit-link fallback.
- Added authenticated browser acceptance that creates and certifies a real test flight, removes it via the UI, verifies active-logbook disappearance and permanent tombstone/audit retention, and runs in both desktop and mobile Chromium.
- First browser execution correctly exposed an unsupported `track_points` assumption in the new void service. FlyTally has no such canonical table; GPS evidence is stored completely on `flight_tracks`, so the runtime/schema/tests were corrected to archive only the real persisted source.
- Second browser execution reached the real void flow without the prior database exception but did not leave the current flight-detail URL. Completion is now redirected server-side after successful mutation, and the browser test proves database deletion/tombstone creation before checking navigation.
- Third browser execution exposed a test sequencing race: the test read PostgreSQL before the asynchronous Server Action had an authoritative completion state. It now waits for server redirect or a surfaced action error before asserting database state.
- Fourth browser execution showed the mobile void path reached successful deletion/tombstone/redirect assertions; remaining failures were caused by a transient certification-banner dependency on desktop and a broad date/registration list selector that matched the failed desktop fixture. The acceptance test now uses durable certified state and exact flight-id disappearance.
- Final M2/M3 browser acceptance passed **2/2** across desktop and mobile Chromium, proving certified-flight removal, active-row exclusion, permanent tombstone/audit retention and legacy-audit redirect end to end.
- Portable backup format v13 is implemented pending verification: signed backups include permanent void/provenance history, exact restore is history-only and conflict-guarded, legacy v4–v12 `track_points` remains parser-compatible without current-schema queries, and participant source provenance is append-only.
- Backup v13 implementation is present and awaits verification; schema v20 is **not applied to production**.
- First M4 verification run failed on typed recovery-conflict wiring and stale test assumptions; these were corrected on the feature branch.
- Second M4 gate on `25d73e6`: TypeScript PASS and production build PASS; unit/regression was **1259/1273 PASS** with 14 failures traced to historical source-contract drift plus one Node direct-import alias in `void-evidence.ts`. PostgreSQL did **not execute** because the shell had no `DATABASE_URL` (all 93 integration cases failed setup). Follow-up corrections update historical assertions to v13/schema-v20/current-roadmap semantics, keep legacy `track_points` parser compatibility explicit, and make the void-evidence helper directly Node-testable.
- Third M4 gate on `e311a4e`: TypeScript PASS; unit/regression **1280/1280 PASS**; production build PASS. PostgreSQL core executed after restoring local `psql` access and reached **82/85 PASS**. The three failures were acceptance-fixture drift: the certification fixture loaded the v20 protection function without creating its referenced `voided_certified_flights` table, while the E2 migration-19 helper accidentally parsed migration 20 blocks because its end marker still targeted the global `throw`. Follow-up fixes make both fixtures version-bounded without weakening runtime contracts.
- Final M4 PostgreSQL rerun on `7d18fb9`: TypeScript **PASS** and PostgreSQL core **85/85 PASS**. All v13 history-restore, archive immutability, resurrection/conflict, certified-delete, migration-19, participant-provenance and correction-compatibility acceptance cases passed. Because `7d18fb9` changed only PostgreSQL acceptance fixtures and documentation after the `e311a4e` runtime gate, the existing **1280/1280 unit/regression PASS** and production build PASS remain the runtime-code evidence for M4. M4 is therefore **VERIFIED LOCAL**. No production migration/deploy occurred.
- M5A consumer audit found that workflow notification rows outlive source participation/approval rows by design. Certified voiding now prevents stale inbox links: owner notifications that pointed at the removed source flight/audit are redirected to the permanent void-audit route, and recipient `/connections/shared/*` / `/connections/flight/*` links tied to the removed source are cleared before cascade. Notification text/history remains intact and is not promoted to protected certification evidence.
- M5A verification on exact head `bb3fcd2`: TypeScript **PASS**; targeted consumer/domain contract **13/13 PASS**; full unit/regression **1285/1285 PASS**; production build **PASS**. M5A is **VERIFIED LOCAL**.
- M5B adds isolated PostgreSQL collaboration acceptance proving that a void transaction can archive live collaboration evidence, supersede pending work, revoke the public share, redirect/neutralize notification links before cascade, preserve an accepted participant-owned flight, bind its immutable provenance to the tombstone, and remove the source-side live workflow rows.
- M5B verification on exact head `efd9b62`: PostgreSQL core **86/86 PASS**, including the new collaboration teardown acceptance. M5B is **VERIFIED LOCAL**.
- M5C extends the existing authenticated desktop/mobile certified-void browser acceptance: after void, the source is absent from the active flight list, the permanent audit remains reachable, the legacy active-flight audit URL redirects to that audit, and retained owner notification history opens the permanent audit instead of a dead source-flight route.
- M5C browser execution reached the actual certified-void flow. An initial fully configured run passed desktop and exposed only a serialized test-notification collision on mobile; the fixture was isolated without changing runtime behavior. Final rerun on exact head `a423239` passed **2/2** across desktop and mobile Chromium, including certified removal, active-logbook exclusion, permanent audit retention, legacy audit redirect, and retained owner-notification navigation to the permanent audit. M5 is **VERIFIED LOCAL**.
- Phase 1 M6 local release gate on exact head `a2d3f65` is green: TypeScript PASS; full unit/regression **1285/1285 PASS**; full PostgreSQL integration + retained scale fixtures **99/99 PASS**; production Next.js build PASS. GitHub CI is **NOT RUN — local-first policy**. No production migration or deployment occurred; `3.5.0` remains unreleased while Phase 2 of the canonical combined scope proceeds.
- Phase 2 discovery found that historical regulatory category/class/type consumers are already flight-snapshot based; the remaining deliberate current-profile dependency is the effective-dated Annex-I/ULL `part_fcl_credit_class/basis/from` tuple used by aeroplane recency and its evidence audit. The current profile validator requires complete provenance, while the evaluator still accepts older class-only metadata; this compatibility boundary is frozen for independent review before runtime changes.
- Added a characterization-only Phase 2 suite that freezes the consumer census, Manual/GPS PROFILE + SNAPSHOT boundaries, and the legacy class-only explicit-credit behavior before any regulatory runtime change. Initial suite **4/4 PASS** on exact head `69310a3`.
- Independent review accepted the snapshot/external-applicability split and the default no-migration/no-certification-change direction, but correctly required a bounded compatibility rule before legacy eligibility is widened. Repository-history reconciliation then found an important correction to the review handoff: v1.51.3 UI/engine copy described override basis/from as optional, but the server-side Aircraft Add/Edit action still required both whenever an explicit class was persisted. Exact restore remained intentionally outside current profile validation. An unverified draft compatibility batch was therefore superseded before local verification and runtime returned to the verified `69310a3` characterization state.
- Phase 2 production census completed read-only on the production Primary branch / `neondb`: **25 aircraft profiles, all `NONE`**, 25 active / 0 inactive, 295 saved flights and 36 certified ULL flights; zero complete overrides, partial tuples, orphan metadata, invalid dates or invalid classes. Production schema remains **v19**. Decision: no Phase 2 runtime compatibility layer, no schema v21 and no certification-version change. The census tooling was corrected after its first operator run exposed a malformed SQL regex literal; the corrected query was executed successfully before documenting the result.
- Canonical 3.5 final local gate on exact head `f0a1f1a` passed: TypeScript PASS; unit/regression **1289/1289 PASS**; full PostgreSQL integration + scale **99/99 PASS**; production build PASS. GitHub CI is **NOT RUN — local-first policy**.
- Added explicit v20 production deployment tooling: strict read-only v19 preflight, transactionally locked migration mirroring the runtime v20 DDL, idempotent post-deploy participant-provenance reconciliation to close the old-runtime/deploy window, and read-only v20 postflight verification. Tooling source verification on `eddbfb5` is **10/10 PASS** with TypeScript PASS; no production write has been performed.
- Reconciled the unreleased candidate package/app-visible version to **3.5.0** in `package.json` and `package-lock.json`, consistent with the canonical versioning policy. Candidate metadata verification on exact head `c0daa46` is **5/5 PASS** and production build PASS with 41/41 static pages generated.
- Production v20 preflight completed **read-only** on 7 October 2026 against Primary/`neondb`: transaction read-only ON; exact registry v1..v19; no partial v20 objects; 295 flights / 95 certified flights / 56 certified revisions; 16 participations / 11 accepted; **7** clean provenance backfill candidates; all preflight integrity guards passed.
- After explicit approval, created pre-migration Neon branch `pre-v20-2026-10-07` (`br-dry-moon-b1n30x0b`) at the production pre-write LSN, then applied the exact transactionally guarded schema-v20 migration to production. Immediate read-only postflight PASS: exact registry v1..v20; **7/7** participant provenance rows; 295 flights, 95 certified flights, 56 certified revisions, 5 verifications, 16 participations / 11 accepted, 8 deleted-flight rows; zero voided-flight/archive rows. Production app runtime is still 3.4.1; deploy, post-deploy provenance reconciliation, final postflight and smoke remain pending.


## 3.4.1 — 6 October 2026

### GPS Night-time reliability
- Opened a narrow production-correction follow-up after GPS review showed a NIGHT landing suggestion while Night time remained unavailable/manual.
- Added structured Night-time unavailable reasons and concise GPS-review explanation while preserving manual editable Night time and manual-only IFR.
- Reused the canonical GPS position-discontinuity thresholds from track processing rather than creating a second quality model.
- Final correctness review rejected the attempted >600 s same-state proof: endpoint displacement/quality does not prove the unobserved intermediate path. Sparse segments above the existing 600 s direct-interpolation guard therefore remain fail-closed with `SEGMENT_GAP_TOO_LARGE`.
- Hardened equal-time conflicting positions, non-monotonic/ambiguous timestamps, unsupported solar envelope and twilight-confidence cases to explicit fail-closed reasons.
- Added a real-like EHAM → LKPR regression that preserves the valid distinction between a confidently NIGHT landing event and unavailable exact Night time when an earlier sparse gap prevents a complete total; partial/lower-bound values are never auto-applied.
- Added the frozen single-phase contract at `docs/product/3_4_1_GPS_NIGHT_TIME_RELIABILITY.md`. No DB migration, certification-version change or historical-record rewrite is part of 3.4.1.
- Added authenticated browser coverage for the sparse-gap fallback: automatic Night time stays blank with an explicit reason, and a pilot-entered manual value remains sticky.
- Final local runtime candidate verification: TypeScript PASS, full unit/regression suite **1238/1238 PASS**, production Next.js build PASS, and targeted authenticated sparse-gap browser acceptance **2/2 PASS** across desktop and mobile Chromium.
- Release verification also reconciled stale repository contract tests with the already-adopted manual-only GitHub Actions policy, browser fixture schema v19, the compact 3.4 certification summary, and the 3.4.1 roadmap state; the manual Verify workflow is now self-contained instead of depending on pull-request event fields.
- PR #241 merged to `main` as `b3e1de097b6d16cdaa96082d281602a2765b8ae0`; production deployment `dpl_3911vZiDAFduLhsPbyMnB1YtHKwn` is READY on that exact SHA, carries `fly-tally.com`, returned HTTP 200 on the public smoke surface, and had no grouped runtime errors in the checked post-deploy window.

## 3.4.0 — 5 October 2026

### Flight Entry Simplification
- Local release verification now includes TypeScript PASS, 1230/1230 unit/regression PASS, 73/73 PostgreSQL core PASS, production build PASS, 13/13 targeted 3.4.0 contract PASS, 6/6 targeted authenticated desktop/mobile Playwright PASS, and a focused responsive Flight Entry smoke **1/1 PASS** covering desktop 1440, iPad landscape, iPad portrait and mobile 390 in light + dark. GitHub CI is intentionally NOT RUN under the local-first policy.
- Switched repository verification to local-first release gating; GitHub Verify and Browser Smoke are now manual-only diagnostics rather than automatic PR/release requirements.
- Simplified the GPS import hierarchy: clean single-flight track review collapses by default, multi-flight/ambiguous/warned track review stays surfaced, and redundant clean-quality status copy was removed.
- Reduced primary GPS Flight context to aircraft/regulatory basis/role/applicable operation-engine; Billing and Cost share now live in a separate collapsed Costs disclosure while invalid stored billing still blocks save.
- Replaced generic GPS reviewed-state UX with deterministic evidence readiness plus targeted GPS-quality acknowledgement; incomplete imports navigate to the first unresolved flight card.
- Multi-flight GPS remains draft-only and atomic; direct batch certification is not introduced by these changes.
- Added explicit same-page **Save draft** and **Save & certify flight** completion for eligible single Manual and GPS entries. Certification always re-reads the persisted row and reuses the existing v8 compliance/hash authority. Flight-detail readiness/blocker UI now uses that same category-aware certification compliance contract instead of the old Part-FCL-only blocker view.
- Added compact pre-certification summaries for the evidence being sealed, draft fallback messaging when certification is blocked/deferred, and draft-first implicit/Enter-key behavior. The completion summary was then flattened to four concise evidence groups instead of another nested card grid.
- Updated authenticated browser coverage for the removed generic GPS review checkbox and added direct Manual/GPS certification, Enter-to-draft, multi-flight draft-only, and targeted GPS-quality acknowledgement acceptance cases.

### Documentation / versioning governance
- Standardized future product releases and ROADMAP targets on numeric `MAJOR.MINOR.PATCH` versions; 3.4.0 is now the first canonical unified production release after the one-time reconciliation jump from 2.7.0.
- New implementation phases use numeric Phase 1 / Phase 2 / … naming rather than new E/F/B/SP/M milestone families.
- Database schema, certification payload and backup-format versions remain independent technical counters.
- Added the 3.4.0 design/review-reconciliation contract and numeric forward release sequence.
- PR #240 merged as `76b57c5674ffcc8c62bfbe73c59974cfde341a7a`; production deployment `dpl_3Zcyq7QmdSGPj1AcSHe2gj2Rn29r` is READY on that exact SHA and carries `fly-tally.com`.
- Post-deploy runtime logs show successful 200 responses across authenticated dashboard/flight routes, and the checked runtime-error window contained no grouped errors.
- Production DB remains schema v19 and certification payload remains v8; 3.4.0 introduced no schema migration or historical flight/certification rewrite.

## Legacy unversioned development / production history — through 4 October 2026

### Flight Entry E2 — production verified
- Hardened advisory take-off anomaly locality around corrupt GPS transitions while preserving discontinuity warnings and editable GPS-derived values.
- Added nullable aircraft `default_engine_type = SE | ME | NULL` with no historical backfill; unambiguous catalogue engine count may suggest a value but does not become authority.
- Extended explicit SERA Day/Night handling to supported ULL GPS review, added conservative GPS Night-time suggestion, kept IFR always pilot-entered, and made FCL.060 PF movement evidence optional/fail-closed.
- Final PR #238 CI passed: Verify #1141 — TypeScript PASS, **1208/1208** unit/regression, PostgreSQL **86/86**; Browser #514 — production build PASS, **84/84** with 2 intentional skips.
- Production v19 preflight proved exact v1–v18/no partial state; v19 migration committed successfully; postflight proved nullable/no-default engine column, validated NULL/SE/ME constraint, **0** backfilled defaults, unchanged baseline data counts and exact registry v1–v19.
- PR #238 merged as `ba2b4324f1f9ae84161ec86e82fc13d268938160`; production deployment `dpl_FsVYmDgJ2b3KNx4Yhd9jPsLJkvYc` is READY on that SHA, aliases `fly-tally.com` with no alias error, and immediate runtime-error check found none.
- No historical flight, certification, audit, recovery or aircraft-default backfill mutation was performed.


### Development workflow governance
- Adopted a risk-based verification cadence in `DEVELOPMENT.md`: targeted tests during iteration, subsystem-specific evidence at milestones, one complete local release gate for the final candidate, independent PR CI, and production-only preflight/postflight/smoke during closeout.
- Heavy PostgreSQL, authenticated browser and scale suites are no longer repeated after every small edit by default. Documentation/stale-source-guard corrections after an already-valid full gate require targeted re-verification unless they change runtime, persistence/schema, auth/security, certification/recency, or performance-critical behaviour.
- This is a development-process change only; product scope, ROADMAP priority and FEATURES capability inventory are unchanged.


### Flight Entry Follow-up E1 — discovery/design
- Production-use follow-up audit opened after Flight Entry Workflow 3.0 production closeout.
- Confirmed Manual New currently uses a generic SP fallback for `operation_type`, while GPS intentionally requires explicit SP/MP and clears the value on aircraft change.
- Confirmed aircraft profiles already persist default Role/billing but have no Operation default.
- Confirmed GPS Common details currently submit `Task = GPS import`.
- Confirmed `task` is included in the flight certification payload from certification v1 onward; certified rows therefore cannot be bulk-cleared by raw SQL without invalidating audit/integrity semantics.
- Confirmed GPS review already has detected T&G/final-landing event indices with UTC timestamps and track coordinates; the airport catalogue also has worldwide lat/lon/country.
- Confirmed Intelligent Logbook continuation/return assistance is portalled inside individual Route field labels, explaining the observed Departure/Arrival misalignment.
- Added E1 design and independent-review handoff.
- Independent review returned **APPROVE WITH CHANGES**. Accepted: certified Task correction contract, explicit Operation propagation/validation, route a11y, event-coordinate precedence and jurisdiction/provenance copy. Rejected one reviewer premise after authoritative verification: civil twilight remains the geometric solar-centre -6° boundary; sunrise/sunset refraction/solar-disc offset is not applied to civil twilight.
- E1.1 implementation: Intelligent `Continue from…` / `Return to…` suggestions now render in a dedicated `aria-live="polite"` full-width row below both Route fields instead of inside one label; the action remains an explicit keyboard-focusable button.
- E1.1 implementation: GPS Common details no longer expose or default `Task = GPS import`; new GPS imports submit an empty Task. Manual/Edit Task remains unchanged. Historical rows were **not** mutated.
- Added focused source contracts and authenticated browser route-alignment coverage. E1.1 local verification: targeted **30/30 PASS**, TypeScript PASS, production build PASS and authenticated browser **3/3 PASS**. E1.1 is DONE / LOCAL VERIFIED.
- E1.2 implementation staged schema v18 `aircraft.default_operation_type` as nullable `SP | MP | NULL` with a database CHECK constraint and **no aircraft-profile backfill**.
- Aircraft Add/Edit and Quick Add now expose optional Default operation; persistence validates and verifies the saved value. New Manual/GPS flight entry receives the profile default only as a prefill and the per-flight Operation remains editable.
- Manual New no longer silently normalizes a missing applicable Operation to SP: an incomplete draft may preserve `operation_type=''`, while existing FCL.050 certification remains fail-closed unless SP/MP is explicitly recorded. The existing `flights.operation_type` column and certification payload/version are unchanged.
- GPS still requires an explicit resolved SP/MP before Save; a profile default may preselect the control but does not bypass the server requirement.
- Aircraft sharing carries the default as part of optional Flight defaults. Legacy pending shares that predate the field preserve an existing recipient default rather than silently clearing it; a new share with an explicitly blank default can clear it to NULL when Flight defaults are imported.
- Account backup/restore remains exact through schema-aware `SELECT *` + `json_populate_record` after migration v18. Unknown imported defaults fail closed via parser/database constraint.
- Added focused E1.2 source/domain tests, PostgreSQL migration acceptance and authenticated Manual/GPS browser proof. Local verification completed: targeted **54/54 PASS**, focused migration regression **5/5 PASS**, TypeScript PASS, PostgreSQL acceptance **2/2 PASS**, production build PASS and authenticated browser **4/4 PASS**. Browser verification also exposed a pre-existing branch regression in migration 17 (`AS $` instead of `AS $$`); the dollar quote was restored and a source regression guard added. E1.2 is **DONE / LOCAL VERIFIED**. Production migration v18 remains **NOT APPLIED**.
- E1.3 discovery mapped the existing GPS evidence path: T&G and final landing already have exact track indices, timestamps and coordinates; timezone-less track timestamps already fail closed. Draft implementation uses geometric solar-centre altitude at the SERA -6° boundary, requires every detected landing event to classify before suggesting an aggregate split, limits first-release auto-prefill to the EASA/SERA path, and tracks landing split provenance explicitly as UNSET/SUGGESTED/MANUAL so unrelated UI state cannot overwrite pilot edits. Added dedicated read-only independent-review handoff before implementation.
- E1.3 independent review returned **APPROVE WITH CHANGES**. Reconciled contract now adds a conservative calculation-confidence guard around the unchanged -6° SERA boundary, bounds the initial NOAA/Meeus implementation to its documented support envelope, requires complete landing-event classification, keeps applicability as an account/logbook setting rather than aircraft identity, keeps suggestion provenance ephemeral, resets review evidence on split changes, and requires accessible provenance association.
- E1.3 core implementation added a pure fail-closed geometric solar-altitude classifier and landing-event aggregate. It uses each exact T&G/final landing point, rejects ambiguous timestamps, invalid coordinates, unsupported year/latitude, near-boundary confidence cases, partial classification and event-count mismatches. Added focused ordinary-latitude, equatorial, supported high-latitude, envelope, confidence-guard and aggregate tests. Core verification: targeted **24/24 PASS** and TypeScript PASS.
- E1.3 wiring staged account-level `night_definition` (`MANUAL` default/fail-closed, `SERA` opt-in) in existing settings JSON, passes it into GPS review, prefills only EASA `DAY_NIGHT` reviews with available event-level suggestions, tracks review provenance ephemerally as `UNSET/SUGGESTED/MANUAL`, clears a suggested split when the reviewed landing total changes, preserves direct pilot edits across unrelated state changes, and associates visible provenance with both Day/Night inputs. No schema/certification/sharing/recency change. Local verification completed: focused wiring + GPS regression **38/38 PASS**, TypeScript PASS, production build PASS and authenticated browser **5/5 PASS**. E1.3 is **DONE / LOCAL VERIFIED**.
- E1.4 discovery removed the residual server fallback that could synthesize `Task = GPS import`; focused source/certification/census tests previously reached **15/15 PASS**, TypeScript PASS, and the local SELECT-only census completed through **ROLLBACK** after browser-fixture schema alignment. Production target proof then confirmed `neondb`, read-only ON, schema v17 and required history tables. The production census found **14 exact live rows across 3 accounts, all 14 currently certified**, with **0 ordinary draft candidates**, plus **4 certified revision snapshots**, **2 deleted-flight recovery copies** and **51 audit events** carrying the legacy value. Independent review returned **APPROVE WITH CHANGES** and was reconciled: no automated historical mutation; pilot correction only through the existing owner-scoped correction/re-certification workflow; additive exact-match legacy UI annotation without changing export/print/certification data. Added a PostgreSQL correction-history acceptance case and presentation/export/hash/ownership guards. Focused E1.4/E1.1/certification tests are **20/20 PASS**, TypeScript PASS, PostgreSQL certification/correction acceptance is **5/5 PASS** on the local `flytally_browser` database, the production build is PASS (Next.js 16.3.8; 41/41 static pages generated), and targeted authenticated Playwright owner/shared legacy annotation coverage is **1/1 PASS**. E1.4 is therefore **DONE / LOCAL VERIFIED**. No production historical Task value was mutated.
- E1.5 closeout opened after E1.4 local verification. Added a dedicated production-closeout design and independent migration-review handoff. Current proposed order is full local release gate → PR/CI → fail-closed production v17 preflight/recovery point → explicit additive v18 migration → postflight verification → merge/deploy/smoke. No E1.5 production write, migration, merge or deploy has been executed yet. Independent review returned **APPROVE WITH CHANGES**. Reconciliation proved current production main v17 ignores future registry versions above its advertised schema, automatic feature-branch Vercel deployments are canceled while CI uses isolated PostgreSQL services, and relevant old-app aircraft consumers tolerate the additive nullable column. Added fail-closed production v18 preflight/migration/postflight tooling plus source-contract guards. Focused E1.5/E1.2/migration-plan sanity verification completed **16/16 PASS**. Full local release verification then produced TypeScript PASS and **1193/1198** unit/regression tests with five failures. Repository reconciliation classified all five as stale regression/document expectations, not runtime failures: three old unconditional `SP` source assertions were superseded by E1.2 nullable Operation-default semantics, the B1A aircraft-share assertion was superseded by the combined billing/Operation fail-closed default guard, and the v3.0 roadmap assertion still expected Workflow 3.0 to be ACTIVE after its production closeout. Those guards and current roadmap summary were reconciled; the targeted remediation pack passed **26/26**, complete unit/regression passed **1198/1198**, TypeScript PASS, and full PostgreSQL acceptance passed **84/84** including 10k/50k/100k scale coverage plus E1.2 migration and E1.4 certified-history correction checks. Production Next.js 16.3.8 build then passed with **41/41** static pages generated. The first full authenticated desktop/mobile Playwright run completed **82 passed / 2 skipped / 1 failed / 1 flaky**. Reconciliation found no runtime defect: the single failure came from E1.4 fixture residue left by the desktop project, which made the mobile core-shell `OK-E2E` row locator resolve both the baseline draft and certified legacy fixture; the flaky F3.4 case raced a controlled `<details>` close against the invalid-profile auto-open effect and passed on retry. Browser harness remediation now adds `finally` cleanup for E1.4 fixture rows, pins the core-shell assertion to the deterministic baseline flight, and tests invalid-profile auto-open from a fresh closed page. Added a source guard for E1.4 cross-project cleanup. Remediation verification then passed **6/6** source tests and **4/4** targeted Playwright checks across desktop + mobile with zero fail/flaky. The authoritative complete authenticated browser rerun, executed with the same single-worker discipline as CI, passed **84/84** with **2 intentional skips** and zero fail/flaky. A separate local run using Playwright's default four workers produced cross-test fixture collisions because both projects mutate the same isolated `flytally_browser` database; this was classified as an invalid harness run rather than a product regression. To prevent recurrence, `playwright.config.mjs` now pins `workers:1` for local and CI execution, v367 guards the serialization contract, and DEVELOPMENT documents the canonical browser command. That harness-only change is now verified by the E1.5 source-contract suite **7/7 PASS** and a config-driven desktop/mobile core-shell smoke **2/2 PASS**, which reported `using 1 worker` without a CLI worker override. The first canonical exact-head `npm run verify` then reached the unit/regression stage and failed **2/1200** only because older v3.2 source guards still asserted the superseded generic `OK-E2E` row locator and the previous CI-only worker expression. The worker-serialization guard is reconciled to unconditional `workers:1`. A first targeted v3.2 rerun then showed the old generic OK-E2E locator assertion had not actually been replaced; that remaining stale source guard is now corrected to the deterministic baseline-row locator. Runtime behavior is unchanged. Final targeted v3.2 verification then passed **5/5**. Canonical exact-head `npm run verify` passed completely: TypeScript PASS, **1200/1200** unit/regression tests, and production Next.js 16.3.8 build PASS with **41/41** static pages. Combined with the earlier complete PostgreSQL **84/84 PASS** and authoritative serialized authenticated Playwright **84/84 PASS** with **2 intentional skips** and zero fail/flaky, the E1.5 local release gate is closed. PR #237 `[full-ci]` then ran on GitHub: Browser smoke passed **84/84** with **2 intentional skips** using one worker, and PostgreSQL acceptance passed. The Fast application gate failed only one unit/regression source contract (**1199/1200 PASS**) because `v300-navigation-hierarchy` still expected the superseded exact `E1.5 ACTIVE` roadmap heading after documentation advanced to PR/CI. TypeScript passed and no runtime/browser/database defect was exposed. That guard is now stage-tolerant across E1.5 closeout transitions; CI rerun is required before production work. No production write, v18 migration, merge or deploy has been executed.

### Flight Entry Workflow 3.0 — F6 browser/responsive/production closeout
- Activated the final F6 acceptance phase after F5 completed local verification.
- Added a shared required presentation matrix covering 1440 desktop, iPad landscape, iPad portrait, 390 mobile, 320 compact mobile and a 720 × 450 CSS viewport representing 1440 × 900 at 200% browser reflow; every state runs in Light + Dark and checks document-level horizontal overflow.
- Added authenticated Manual coverage for PIC, DUAL, Safety Pilot Manual, Safety Pilot Connection, SPIC and PICUS.
- Added authenticated GPS single-flight coverage for the strict implemented role allowlist PIC / DUAL / SAFETY PILOT, including Manual + connected Actual-PIC modes.
- Added authenticated GPS multi-part coverage for inherited common DUAL plus complete connected Safety Pilot per-flight override and Reset-to-common visibility.
- Added Manual + GPS invalid-profile recovery coverage across the full presentation matrix.
- Added focused source contract `tests/v360-flight-entry-f6-closeout.test.ts` and closeout design `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F6_CLOSEOUT.md`.
- Runtime/parser/normalizer/persistence/schema/certification/recency changes: **none**. Local F6 verification completed with focused closeout contract **6/6 PASS**, authenticated F6 matrix **4/4 PASS**, and full authenticated Playwright **72 passed / 2 skipped / 0 failed** across desktop + mobile projects. PR #235 then passed Fast application gate, PostgreSQL acceptance, Chromium desktop + mobile, Classify CI risk and Vercel Preview Comments; it squash-merged to `main` as `fb0bbb3da5d3c0be36ecd3190b1840977edbd252`. Vercel production deployment `dpl_GM9nQX2gBwbn4GgzEy7YrJPnmR4F` is READY for that exact SHA, aliases `fly-tally.com` without alias error, and production smoke returned HTTP 200 from the exact deployment for `/`, `/login` and `/flights/new` with unauthenticated protected routing resolving to Login as designed. Immediate 30-minute runtime-error check found no errors. Flight Entry Workflow 3.0 F0–F6 is **DONE / PRODUCTION VERIFIED**. DB/schema migration N/A; certification version/hash unchanged; no historical rewrite.

### Flight Entry Workflow 3.0 — F5 Primary UX discovery/design
- Reconstructed the post-F4 production state from `main@5281d61fe2e7f38a3425ac0189007b46c68601b2` and reconciled roadmap drift: F0–F4 are production verified, while F5 and F6 remain outstanding milestones.
- Activated F5 on branch `feat/flight-entry-f5-primary-ux`.
- Source audit confirms the common Manual PIC hierarchy is already largely aligned with the frozen B1–B5 simplicity model: Date/Registration/Role, Route and UTC timeline are visible; landing/PF evidence, additional crew, aircraft context and Optional details use progressive disclosure.
- Draft F5 direction is intentionally narrow: remove duplicated workflow/helper copy rather than redesign flight semantics or invent new defaults.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F5_PRIMARY_UX_DESIGN.md` and `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F5_REVIEW_HANDOFF.md`.
- Runtime/schema/certification changes during discovery: **none**.
- Independent review returned **APPROVE WITH CHANGES** and was reconciled against the repository before implementation.
- Repo verification corrected the review scope: `FlightForm` is shared by Manual New + Manual Edit; GPS uses `KmlImportForm`; current Dashboard “Add flight” routes to New Flight rather than a separate Quick Add flight form.
- F5.1 removes the redundant long New Flight header workflow paragraph while preserving the mode chooser, GPS contextual instruction, `Save & review` and the action-surface draft/review consequence.
- F5.2 keeps Registration `Manage aircraft` because the valid collapsed Aircraft context has no equivalent manage link; unresolved profile recovery remains unchanged.
- F5.2 retains Role provenance as concise New-only `Aircraft default`, and removes the misleading cue from Edit/SNAPSHOT.
- F5.2 removes the generic BLOCK/AIR “Calculated automatically” helper only for New Flight when both values are resolved; BFCL authority copy, incomplete-state instruction, Edit helper behavior and the `aria-live` value surface remain.
- Added focused F5 source contracts and reconciled the historical v1.58 Role-provenance test. Verification: **NOT RUN**.
- Added two focused authenticated F5 browser cases: common Manual PIC exact persistent-control/helper allowlist across desktop/iPad/mobile, and PIC→DUAL contextual identity with the Role-default cue removed.
- Verification evidence: F5 focused/source batch **46/46 PASS**, TypeScript PASS and production build PASS.
- First full regression reached **1150/1151 PASS**; the only failure was the historical U4 source assertion still requiring the removed header sentence. It has been reconciled to the retained action-surface draft/review cue without runtime changes.
- First F5 browser run reached **1/2 PASS**; the common-PIC allowlist correctly encountered the existing contextual intelligent continuation suggestion (`Continue from LKPR…`). The F5 allowlist is now scoped to persistent/core helpers and controls while explicitly preserving/asserting contextual `data-intelligent-review` assistance. No runtime change.
- Final verification complete: focused reconciliation **16/16 PASS**, full unit/regression **1151/1151 PASS**, production build PASS, and authenticated F5.3 browser **2/2 PASS**. The browser proof preserves contextual Intelligent Logbook continuation assistance while keeping the persistent/core helper allowlist explicit. F5 is **DONE / LOCAL VERIFIED**. No DB/schema/certification change; deploy belongs to F6 closeout.

### Flight Entry Workflow 3.0 — F4 GPS inheritance design/review gate
- Completed repository discovery for the frozen F4 multi-part GPS inheritance milestone; no runtime behavior changed.
- Confirmed GPS remains intentionally PIC-only at both UI and server role gate, per-part Review state currently contains no Role/Crew context, and every reviewed part already passes through the shared `gpsFlightCandidate() → normalizeFlightDraft()` semantic boundary.
- Confirmed existing atomic import prepares and normalizes every part before one duplicate-safe transaction; F4 should extend this boundary rather than replace it.
- Confirmed Safety Pilot cannot be enabled by UI expansion alone: GPS must preserve Manual/accepted-Connection Actual-PIC authority, account-ID Connection recheck, display-name snapshot and one atomic connected-crew child row per resulting source flight.
- Drafted one common complete Role/Crew context plus all-or-nothing whole-part overrides; field-level inheritance, per-part aircraft identity and inferred crew remain prohibited.
- Proposed fail-closed split behavior clears part Role/Crew overrides when split structure changes instead of guessing which new segment owns old crew evidence.
- Added F4 design and independent-review handoff. Runtime/schema/certification: unchanged.
- Reconciled the independent review against current code: GPS already persists commander/instructor/role/verification name/reference from normalized per-part input; duplicate fingerprint excludes Role/Crew; Safety Pilot remains intentionally unwired from GPS.
- Staged F4.0 characterization coverage locking persistence-column parity, duplicate identity, temporary PIC-only scope, Safety Pilot non-wiring and shared DUAL/SPIC/PICUS Save requirements. No runtime behavior changed.
- Frozen implementation order: common Role/Crew → whole-part overrides → Safety Pilot. One product decision remains before enabling SPIC/PICUS: whether a common countersignature reference may apply to multiple split flight records.
- F4.0 local verification completed: targeted 5/5 PASS and full unit/regression 1124/1124 PASS.
- Implemented F4.1 common GPS Role/Crew for PIC + DUAL only: strict server resolution after aircraft authority, shared EASA DUAL Instructor/PIC validation, candidate propagation into the shared normalizer, controlled common UI, and inherited-review invalidation on common Role changes. SPIC/PICUS and Safety Pilot remain unavailable.
- F4.1 local closeout PASS: targeted cross-path tests **55/55**, TypeScript PASS, full unit/regression **1129/1129**, production build PASS, and authenticated desktop Chromium **2/2 PASS** against the disposable PostgreSQL browser DB. The browser proof covers PIC/DUAL role-surface behavior, common DUAL review invalidation, required Instructor/PIC gating, successful Save, and persisted normalized `DUAL + Instructor` values. The browser-only bootstrap now creates the minimal `airports` relation needed by GPS airport detection. No production DB/schema/certification change.
- Implemented F4.2 whole-part GPS Role/Crew overrides for the currently supported PIC + DUAL scope. Each split submits explicit `INHERIT` or complete `OVERRIDE`; the server validates envelope shape/count, rejects unknown/duplicate/stale fields and per-flight common-context drift, resolves each part without field-level fallback, and passes the fully resolved Role/Crew context through the existing GPS candidate/normalizer path before atomic persistence. The review UI supports per-flight override, deterministic Reset to common, inherited-only invalidation on common Role changes, and automatic override clearing with a visible notice when split boundaries change. Added focused F4.2 unit/source-contract coverage in `tests/v357-flight-entry-f42-whole-part-role-crew.test.ts`. F4.2 local closeout PASS: focused cross-path batch **67/67 PASS**, full unit/regression **1134/1134 PASS**, production build PASS including TypeScript, and authenticated desktop Chromium **4/4 PASS** against the isolated local PostgreSQL browser DB. Browser proof covers mixed INHERIT/OVERRIDE persistence, inherited-only invalidation, deterministic Reset to common, split-boundary override clearing with a visible notice, and persisted per-flight PIC/DUAL Role/Crew. No production DB/schema/certification change.
- Implemented F4.3 GPS Safety Pilot core while preserving Manual Actual-PIC authority semantics. GPS role scope now adds only SAFETY PILOT; common and whole-part overrides support explicit Manual Actual PIC text or accepted-Connection account ID without display-name matching. Extracted a reusable lower-level Safety Pilot resolver while keeping the Manual FormData wrapper, server-snapshot current connected display name into `commander`, propagate connected account ID separately, and recheck accepted Connection state in the atomic GPS write. Each connected Safety Pilot flight creates its own `flight_connected_crew` row in the same transaction as flight + track; a zero parent/track/required-child write forces rollback of the complete N-part transaction. Added F4.3 focused contract tests, isolated PostgreSQL atomicity coverage and advanced the browser role-surface expectation. Verification on the runtime-equivalent F4.3 head: focused F1.4/F4.3 **12/12 PASS**, targeted cross-path **80/80 PASS**, isolated PostgreSQL Manual-resolver + GPS Safety Pilot **5/5 PASS**, TypeScript PASS, and production build PASS. The PostgreSQL division-by-zero in the rollback test is intentional fail-closed evidence. The first full-suite run exposed 6 stale source-contract assertions only; these were reconciled in `safety-pilot-pic-sp2`, F0.0, F0.1 and F2.5 tests without runtime changes. Final reconciliation **9/9 PASS**, TypeScript PASS, and final full regression **1141/1141 PASS**. Production build remains PASS on the runtime-equivalent head. F4.3 local closeout completed. The first authenticated browser attempt exposed a localhost-only transaction-adapter parser defect: `track_insert` was misidentified as a top-level `INSERT` token. The adapter now requires a left identifier boundary before command recognition and has a focused U6 regression test. Final verification after rebuild: adapter **4/4 PASS**, TypeScript PASS, full unit/regression **1142/1142 PASS**, production build PASS, and authenticated desktop Chromium F4.3 **3/3 PASS**. Browser proof covers common Manual persistence without account link, common connected account-ID persistence with authoritative server display-name snapshot + one `flight_connected_crew` PIC row, and revoked per-flight connected override fail-closed behavior with zero partial split persistence. Earlier F4.3 evidence remains targeted cross-path **80/80 PASS** and isolated PostgreSQL **5/5 PASS**. No DB/schema/certification change; deploy NOT RUN.
- Started F4.4 closeout. Added one authenticated responsive GPS Role/Crew override matrix covering desktop 1280, iPad landscape 1024, iPad portrait 768, mobile 390 and mobile 320 under light + dark. The staged state uses inherited DUAL plus a complete connected Safety Pilot per-flight override and verifies stable override controls/values plus no horizontal overflow. No application runtime behavior changed. SPIC/PICUS remain fail-closed pending the separate countersignature-reference product decision. Responsive browser closeout is **1/1 PASS** on authenticated desktop Chromium while internally exercising 5 viewport sizes × light/dark with stable inherited DUAL and connected Safety Pilot override state and zero horizontal overflow. F4.4 is now production-closed: PR #233 squash-merged to `main` as `252bcb8eb0258603c1164c5e19bfdcf25bc0d9dd`; Vercel deployment `dpl_3Jh1ghZ8wfkZRE5w3ZN83gxasnzd` is READY on that SHA and aliases `fly-tally.com`; production smoke returned HTTP 200 for `/`, `/login` and `/flights/new`, with protected unauthenticated entry resolving to Login as expected; immediate 30-minute runtime-error check found no errors. F4 is DONE / PRODUCTION VERIFIED. No DB/schema/certification change. No DB/schema/certification change.


### Flight Entry Workflow 3.0 — F3.5 closeout and F3 production integration
- Reconciled the F3.5 closeout plan against an independent second-AI review. Verdict: **APPROVE WITH CHANGES**; no confirmed correctness defect, but action/persistence proof is required for crafted authority drift and historical SNAPSHOT boundaries.
- Froze the minimum closeout scope: no runtime change unless a test proves a bypass or stale-profile consumer; no generic historical-context override; no DB migration; GPS remains PIC-only.
- Source-audited downstream consumers before adding duplicate tests: CSV/XLS export and Statistics derive regulatory context from stored `flights`; Trash serializes/restores raw flight context; Print reads F3 evidence/category/class/type from `flights` and consults current Aircraft only for ICAO type-code presentation; existing certification/shared/backup/restore/recency suites remain the primary invariance evidence.
- Deferred as non-blocking unless evidence changes: the microscopic PROFILE read→flight-write race, explicit historical-context correction UX, wider browser matrix beyond already-verified F3.4 states, and any new schema.
- Added focused source-contract coverage plus authenticated browser/PostgreSQL fixtures for historical SNAPSHOT, crafted authority drift, submit-time PROFILE re-resolution, TMG/OTHER A+, Balloon ownership and Quick Add → immediate Save. Browser-fixture schema was aligned with current aircraft mutation columns and optional untracked flight billing; these are test-only changes.
- **Local verification:** final unit/regression **1119/1119 PASS**, 0 fail, 0 skipped; browser bootstrap PASS; targeted authenticated desktop Chromium **4/4 PASS**. PostgreSQL core **66/66 PASS**, TypeScript PASS and production build PASS were already established on the runtime-identical F3.5 branch before the final test-only fixture/assertion refinements.
- **Runtime/schema/certification:** no application-runtime change in F3.5, no DB migration, certification v1–v8 unchanged.
- **Integration/deploy:** F3 stack was fast-forwarded to `main`; rollback anchor `chore/pre-f3-integration-anchor` preserves pre-F3 main. Vercel initially ignored the docs-only closeout commit, so an empty tree-identical commit `a4b1c626d487aad86ef3e2de887df50a0a2b9248` triggered the intended production build without changing runtime contents. Deployment `dpl_Dn3PAymjG7aCds9xsw18shzkYM4a` is READY, aliases `fly-tally.com` with no alias error, public smoke returned HTTP 200, and no runtime errors were reported in the immediate 30-minute post-deploy check. GitHub Actions and PR were intentionally not run. F4 is next.


### Flight Entry Workflow 3.0 — F3.4 compact aircraft-context UX (locally verified, not yet merged/deployed)
- Replaced routine Manual Logbook/Class/Aircraft type editors with one compact **Aircraft context** surface backed by the F3 authority model.
- PROFILE entry submits server-supported profile-owned evidence, class, aircraft type and Balloon class/group as hidden authority fields; only genuine TMG/OTHER regulatory context from `allowedFlightContexts(profile)` remains selectable.
- Same-registration Edit presents **Stored flight context** and submits the stored SNAPSHOT tuple instead of refreshing it from the mutable current profile. Legacy rows with blank stored `regulatory_category` remain blank on submission and are described without invented backfill.
- Invalid PROFILE state is now part of the Manual completion blocker list and links to Aircraft configuration in a new tab/window so the current draft is preserved.
- GPS Common details now uses the same compact profile-context presentation and removes disabled duplicate Logbook/Class/Aircraft type controls while preserving the common TMG/OTHER selector.
- Operation/Engine, Balloon FREE/TETHERED, sailplane launch evidence and Role/Crew remain explicit flight-specific inputs.
- Added focused F3.4 source/contract coverage and reconciled earlier B3/B5/F3 characterization assertions with the superseding compact-authority UX.
- Browser fixture was aligned with the existing F3 authority provenance columns and now includes an explicit TMG fixture for multi-context acceptance; this is test-fixture-only and does not alter application schema.
- **Local verification on `e305f3ef3985d371a385a0e7231ec42d8a6d135e`:** TypeScript PASS; full unit/regression **1110/1110 PASS**, 0 fail, 0 skip; production `next build` PASS; disposable localhost browser DB bootstrap PASS; targeted authenticated desktop-Chromium suite **5/5 PASS**, including Manual/GPS compact context, invalid PROFILE blocker, TMG A+ choice, GPS-save SNAPSHOT reopen and the responsive light/dark RoleCrew/context matrix.
- **CI/PR/deploy:** NOT RUN intentionally for this local closeout; no merge or production deployment is claimed.
- **Schema/certification:** no migration and no certification v1-v8 change.


### Flight Entry Workflow 3.0 — F3.3 server enforcement (locally verified, not yet merged/deployed)
- Wired Manual New and registration-change saves to server-side owned-profile authority using the shared F3 resolver; submitted aircraft context must be a member of the profile's allowed context set, and persistence now uses the canonical server-authorized context rather than the raw normalized request values.
- Wired same-registration Edit to server-derived SNAPSHOT authority; unchanged historical context is persisted from the stored snapshot without consulting the mutable current profile. Legacy blank regulatory-category rows are preserved rather than silently upgraded by the current UI's derived presentation value.
- Routed GPS through the same shared PROFILE authority while keeping its active-aircraft selection boundary and PIC-only Role scope.
- Added one common GPS TMG/OTHER regulatory-context choice and server validation against `allowedFlightContexts(profile)`; no full evidence/class override was introduced.
- Propagated Part-FCL credit provenance into entry/profile authority validation so malformed provenance fails closed rather than being dropped at the F3 boundary.
- Added focused F3.3 unit/source-contract coverage and retired stale F3.0/F3.2/F1.3 assertions that conflicted with the now-authoritative persistence boundary.
- Hardened the local PostgreSQL acceptance/browser harness for Windows: connection URLs are passed with explicit `-d`, SQL is streamed through UTF-8 stdin, and CRLF query output is normalized before assertions. The harness remains localhost-only.
- **Local verification:** final branch head `065896d3c9aa75fee8c2c0c7cc7a2f6abc20e52a` — full unit/regression **1102/1102 PASS**. On runtime-identical head `3644a85d6da5e01a96c6869b9537c114d395e299`: TypeScript PASS, PostgreSQL core **66/66 PASS**, production `next build` PASS. The only change after that runtime verification was a stale source-contract test assertion aligned to canonical F3 authority persistence.
- **CI/PR/deploy:** NOT RUN intentionally for this local closeout; no claim of merge or production deployment.
- **Schema/certification:** no migration and no certification v1-v8 change.


### Flight Entry Workflow 3.0 — F3.2 authority resolver
- Added the pure shared aircraft-context authority resolver and its focused unit matrix.
- The resolver keeps evidence/class, Balloon class/group and aircraft type profile-owned, while allowing only the frozen TMG/OTHER multi-context categories.
- Added PROFILE/SNAPSHOT authority derivation from stored versus final normalized registration and raw SNAPSHOT comparison that preserves legacy blank category values.
- F3.2 remains intentionally unwired from Manual/GPS mutations; F3.3 owns enforcement.
- PR #229 merged as `abc66ae13cfc8a3af7f6ee21f19ab5c8ab63bc73`; Verify #1097 PASS, PostgreSQL 66/66; Browser #470 PASS including production build.
- Production deployment is READY on the exact merge SHA with the `fly-tally.com` alias and no alias error.
- DB migration/schema: N/A.

### Flight Entry Workflow 3.0 — F3.1 production census
- Completed the required read-only aircraft-context census before runtime enforcement.
- Current profiles pass the canonical validation gate; no pre-enforcement bulk repair or migration is required.
- Historical flight/profile differences were classified as legacy blank-category snapshots plus one older stored regulatory snapshot against a later-updated current profile; no explicit nonblank category conflict was found.
- Historical aircraft identity differences remain SNAPSHOT evidence and are not refresh targets.
- No current production TMG/OTHER/Balloon population was available to validate multi-context frequency; focused contract tests remain required.
- A+ remains frozen and F3.2 pure resolver work is next.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F31_PRODUCTION_CENSUS.md` and updated ROADMAP/FEATURES/F3 design.
- **Runtime/schema/certification/deploy:** N/A; no production data was mutated.

### Flight Entry Workflow 3.0 — F3 independent-review reconciliation
- Reconciled the F3 aircraft-context design against the independent review and current repository contracts before any runtime enforcement.
- Superseded the draft full regulatory override (Option B) with **A+**: evidence/class remain profile-owned; explicit flight-level choice is limited to genuine profile-supported TMG/OTHER multi-context semantics plus deliberate same-registration historical correction.
- Froze server-derived PROFILE/SNAPSHOT authority with no generic client-sent override-authority flag; PROFILE drift must reject, while unchanged SNAPSHOT context must remain historical and must not be revalidated against today's stricter profile validator.
- Froze Manual New/registration-change authority as **owned + canonically valid** profile, allowing inactive owned profiles to remain available for explicit historical back-fill; GPS retains its existing active-owned-profile selection boundary.
- Froze aircraft identity/type and Balloon class/group as profile/snapshot-owned; Balloon FREE/TETHERED remains flight-specific.
- Kept narrow Manual/GPS convergence in F3: the common resolver will expose the same whole-session TMG/OTHER choice where a profile has multiple allowed contexts; GPS Role/Crew expansion remains F4.
- Reordered F3 so **F3.1 is a read-only production census** before resolver/enforcement implementation. The census may not repair, normalize, backfill or invent production evidence.
- **Runtime/schema/certification:** no change in this reconciliation step.

### Flight Entry Workflow 3.0 — F3.0 aircraft-context discovery / review
- Characterized aircraft-context authority across Manual New/Edit, GPS import, canonical aircraft-profile validation and historical identity snapshots.
- Confirmed Manual currently applies profile defaults client-side but create/update do not re-resolve the active profile, while GPS already re-queries and validates the active profile server-side.
- Confirmed Manual invalid-profile state is visible as **Needs configuration** but is not itself an action-level profile gate.
- Confirmed same-registration Edit preserves stored context; registration change applies current profile/identity snapshot semantics.
- Added F3 design, independent-review handoff and v349 characterization coverage for valid ULL/EASA, TMG/OTHER multi-context profiles, Manual/GPS authority divergence and historical snapshot boundaries.
- Draft authority model is PROFILE / SNAPSHOT / explicit OVERRIDE; override breadth and GPS timing are review-gated.
- **Verification:** PR #225 merged as `4e42dbf7fd095aa768e404500b141510386a18c5`; Verify FlyTally web #1096 PASS — **1084/1084** unit/regression and PostgreSQL **66/66**. Browser/deploy N/A because F3.0 is docs + characterization only.
- **Runtime/schema/certification:** no change in F3.0.

### Flight Entry Workflow 3.0 — F2.4 producer-consumer audit / review gate
- Audited Role/Crew producers and consumers across Manual normalization, Safety Pilot linkage, Certification, explicit instructor verification, shared-flight materialization, print/read-only output, CSV/XLS export, audit, backup/restore, recency and GPS boundaries.
- Confirmed a remaining Certification-time DUAL/SPIC/PICUS display-name → account inference path; the repository already has an explicit account-ID post-certification request flow that can replace it.
- Confirmed `instructor` is overloaded with aircraft differences/familiarisation training evidence and `verification_*` is overloaded with generic endorsement evidence; broad Role-only clearing remains unsafe.
- Identified one unresolved semantic mismatch: current PIC-name output lets stored commander override account self identity on self-PIC roles even though the frozen RoleCrew contract says self is authoritative.
- Added the F2.4 audit and an independent-review handoff; no runtime, schema, certification-version, recency or historical-data change yet.
- **Verification:** documentation/repository analysis only; runtime tests not applicable to this analysis commit.
- **F2.4A runtime:** removed Certification-time DUAL/SPIC/PICUS display-name → account matching and the implicit verification request side effect; explicit `instructor_id` account selection remains the only account-bound request path.
- Updated Crew Verification copy so typed names are described as stored flight evidence, not account bindings or automatic request triggers.
- Added source-contract and authenticated browser coverage proving a certified matching typed name remains unbound and only an explicit connected-account request control is offered.
- **Final verification:** Verify FlyTally web #1089 PASS — TypeScript PASS, full unit/regression **1052/1052**, PostgreSQL acceptance **66/66**; Browser smoke #465 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #212 merged as `06b50d911e0cedcafbd5f10bea41868098f8d8b0`.
- Production deployment `dpl_DP43Y79vK4Kny2L86Wuw5VCjAoHH` is READY for that exact merge SHA, aliases `fly-tally.com`, and reports no alias error.
- **DB/schema:** N/A. Certification v1–v8, certified rows, Safety Pilot F2.3, shared materialization and GPS PIC-only boundaries are unchanged.
- **F2.4B discovery:** confirmed that self-PIC `commander` can be intentional rather than stale: Manual UI exposes optional Commander/PIC for non-DUAL roles and shared PIC materialization writes participant/source commander snapshots onto recipient `PIC` rows. The earlier draft preference to make SELF always override stored commander is therefore no longer considered safe without independent review.
- Added a focused F2.4B independent-review handoff. No runtime, schema, certification-output or persisted-data change in this discovery step.
- Added F2.4B characterization coverage for self-PIC fallback/explicit commander precedence, Manual commander availability, shared PIC commander snapshot production and raw integrity/export visibility. PR #215 merged as `064be0862b9506e472545eb16491b21019a90a50`; Verify FlyTally web #1090 PASS — TypeScript PASS, **1057/1057** unit/regression, PostgreSQL **66/66**. No runtime behavior or schema change.
- **F2.4B B1 runtime:** split the RoleCrew contract into role-level PIC identity (`rolePicIdentitySource`) and backward-compatible display precedence (`picDisplayPrecedence`); self-PIC `commander` is modeled as optional evidence rather than falsely `not_applicable`. `pilotInCommandName()` delegates to the shared pure resolver while preserving previous results.
- **Final verification:** Verify FlyTally web #1091 PASS — TypeScript PASS, full unit/regression **1058/1058**, PostgreSQL acceptance **66/66**; Browser smoke #466 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #217 merged as `6f1b33745d8b5c352d0d3331ea4891bb9f8d9f58`.
- Production deployment `dpl_4MfDPVYDhR3ibgQ7uHoeUAagQkQW` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A. No destructive canonicalization, certification payload/version change, certified-history rewrite, shared-materialization change or GPS role expansion.
- **F2.4B B2 semantic closeout:** intentionally performs no destructive canonicalization. Cross-role regression coverage preserves commander/instructor/verification evidence for DUAL, SPIC and PIC contexts, including generic training/endorsement evidence. Current commander-over-SELF display precedence remains frozen for F2; any future change requires an explicit reopened decision rather than silent reinterpretation.
- PR #219 merged as `1c0ecf7be2e18feba7e583039ed5c27919dcdd42`; Verify FlyTally web #1092 PASS — TypeScript PASS, **1059/1059** unit/regression, PostgreSQL **66/66**. Browser rerun was not required because this closeout changed tests/docs only; runtime behavior remained the already production-verified B1 implementation.
- **F2.4C cross-path characterization:** added coverage spanning Manual RoleCrew preservation, Certification/request separation, exact revision/hash verification evidence, shared-flight materialization, print/read-only/CSV/XLS, audit/backup, recency evidence, Safety Pilot F2.3 and GPS PIC-only. Extended authenticated browser coverage to expose both explicit connected-account and in-person verifier paths without implicit binding.
- **Final verification:** Verify FlyTally web #1094 PASS — TypeScript PASS, full unit/regression **1068/1068**, PostgreSQL acceptance **66/66**; Browser smoke #468 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #221 merged as `84b5f5362f03ef1959956fba91584059a36c2db5`.
- **Runtime/schema/deploy:** no runtime or schema behavior changed; production deployment N/A.
- **F2.5 final regression + F2 closeout:** added exhaustive RoleCrew matrix/crafted Save coverage, v1–v8 certification compatibility checks, explicit invitation boundary checks, auxiliary-role non-creditability/GPS PIC-only guards, and responsive authenticated browser coverage for PIC/DUAL/SPIC/PICUS/CO-PILOT/Safety Pilot across desktop, iPad landscape/portrait and mobile in light + dark.
- **Final verification:** Verify FlyTally web #1095 PASS — TypeScript PASS, full unit/regression **1077/1077**, PostgreSQL acceptance **66/66**; Browser smoke #469 PASS — production build PASS, Chromium **36 passed / 2 skipped**.
- PR #223 merged as `bc187e307958054efa2e32db316b06139d10df6e`.
- Production deployment `dpl_GFWksQDdFMoSr9qyvQYgiCBd2ShJ` is READY for exact merge SHA `bc187e307958054efa2e32db316b06139d10df6e`, aliases `fly-tally.com` with no alias error, and the production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A. F2 closes without destructive RoleCrew canonicalization, certification-version change, historical rewrite or GPS role expansion.

### Flight Entry Workflow 3.0 — F2.3 Safety Pilot resolver convergence
- Added one server-owned `resolveSafetyPilotPicForSave()` path used by both Manual create and update.
- Manual Safety Pilot mode preserves the normalized commander and fails closed for a blank EASA Actual PIC; connected mode validates a positive non-self account ID, requires a currently accepted Connection and ignores client commander text.
- Connected mode snapshots the current server `users.display_name` as the historical commander; no account identity is inferred from names.
- Create/update persist the shared resolver output and also recheck accepted Connection state inside the parent write predicate to prevent a revoked Connection from producing a parent or child mutation.
- `flight_connected_crew` remains separate metadata and is inserted/updated/deleted only when the parent create/update succeeds.
- A zero-row connected write is reclassified through the same resolver so a concurrent revocation returns the existing Connection-specific error instead of silently degrading.
- Added focused source regression coverage, PostgreSQL acceptance for the production resolver query, and authenticated browser coverage for display-name resnapshot on create/update plus revoked-Connection Save rejection.
- GPS remains PIC-only; certification payload versions v1–v8 and collaboration/materialization semantics are unchanged.
- **Final verification:** Verify FlyTally web #1077 PASS — TypeScript PASS, full unit/regression **1048/1048**, PostgreSQL acceptance **66/66**; Browser smoke #453 PASS — production build PASS, Chromium **32 passed / 2 skipped**.
- PR #209 merged as `d90215f88514e953e062980798954c497ca76be7`.
- Production deployment `dpl_84eHWKabeoy8DqgGuM6rDATjTTjR` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the public production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2.2 Manual inline Role/Crew UX
- Moved role-defining DUAL Instructor/PIC, Safety Pilot Actual PIC, and SPIC/PICUS supervision/countersignature controls directly into Flight essentials immediately after Role.
- Manual applicability and required cues now consume the shared `roleCrewSpec(role,evidence)` contract introduced in F2.1.
- Added completion blockers and direct focus targets for EASA DUAL Instructor/PIC and SPIC/PICUS supervisor/countersignature fields, alongside the existing Safety Pilot Actual PIC blocker.
- Kept generic Commander/PIC + Instructor inputs available under a separate optional **Additional crew details** disclosure; no destructive field cleanup or persistence canonicalization is introduced.
- Preserved local instructor/supervision form state across role switches before Save.
- Safety Pilot connection authority remains server/action-owned; GPS remains PIC-only; certification payload versions v1–v8 are unchanged.
- Added focused F2.2 source/UX regression coverage and reconciled B3/B5 characterization tests.
- Added authenticated Chromium coverage proving DUAL and SPIC/PICUS inline fields are required under EASA and retain unsaved values across Role switches.
- **Final verification:** Verify FlyTally web #1075 PASS — TypeScript PASS, full unit/regression **1042/1042**, PostgreSQL acceptance **63/63**; Browser smoke #451 PASS — production build PASS, Chromium **30 passed / 2 skipped**.
- PR #207 merged as `205483eda15f82770c1000c0a91fa4df92177fcd`.
- Production deployment `dpl_9v8FjPuj8F2jAuH4TAVNfHrM4eAE` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the public production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2.1 RoleCrew validation
- Added a pure `roleCrewSpec(role,evidence)` contract describing role-specific Save requirements and PIC-identity source semantics without DB/account dependencies.
- Routed EASA DUAL and SPIC/PICUS Save validation through the shared RoleCrew contract.
- EASA DUAL now fails closed server-side when Instructor/PIC is missing instead of relying on HTML required + later Certification.
- Preserved CO-PILOT/CRCP/PAX/OBSERVER Save-optional commander behavior and existing ULL behavior.
- Safety Pilot remains action/resolver-authoritative in F2.1; accepted-Connection resolution is not moved into the pure normalizer.
- No destructive commander/instructor/verification sanitization is introduced in F2.1; overloaded training/endorsement evidence remains intact for later F2.4 reconciliation.
- GPS remains PIC-only; certification payload versions v1–v8 are unchanged.
- Added targeted RoleCrew unit/integration coverage for the frozen matrix and non-sanitization boundary.
- **Final verification:** Verify FlyTally web #1065 PASS (TypeScript, full unit/regression, PostgreSQL acceptance); Browser smoke #441 PASS including production build and real Chromium smoke.
- PR #204 merged as `0f00a3c256843dd24b84a801f6b1e0cae60771d5`.
- Production deployment `dpl_Dd3wzaNm51qBVKDBzRMFHF7cEgfP` reached READY for that exact SHA; `fly-tally.com` is aliased with no alias error and returned HTTP 200.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2 Role/Crew review reconciliation
- Independent review returned **APPROVE WITH CHANGES** and was reconciled against current repository consumers/producers.
- Frozen CO-PILOT/CRCP commander as Save-optional with the current Certification PIC-name gate unchanged; PAX/OBSERVER Save behavior also remains unchanged.
- Rejected the proposed new self-PIC commander requirement because the F0 contract and `pilotInCommandName()` explicitly support account-derived self identity with blank stored commander.
- Found that broad Role-only sanitization is unsafe: `instructor` also gates Aircraft Differences/Familiarisation purpose evidence and `verification_*` feeds general endorsement warnings.
- Found an existing DUAL/SPIC/PICUS certification auto-request path that matches typed names to connected accounts; this conflicts with the frozen no-name-inference rule and is deferred to explicit F2 reconciliation.
- Narrowed F2.1 to a pure RoleCrew requirement contract + server validation only. Destructive evidence-aware sanitization moves to F2.4.
- GPS is frozen PIC-only through F2; F4 owns Role/Crew inheritance/overrides.
- **Runtime/schema behavior:** unchanged by this reconciliation.

### Flight Entry Workflow 3.0 — F2 Role/Crew design
- Added a repository-backed F2 Role/Crew design draft after F1 production closeout.
- Characterized the current split boundaries: EASA DUAL is UI/certification-required but not yet server Save-required; Safety Pilot Actual PIC is action-level with accepted-Connection recheck; SPIC/PICUS supervision is already server Save-required.
- Proposed one source-agnostic `roleCrewSpec(role,evidence)` contract plus canonical role-owned-field sanitization.
- Kept connected-account resolution outside the pure normalizer and preserved the historical-text vs account-link distinction.
- Kept GPS PIC-only during design; F4 remains owner of per-part RoleCrew overrides.
- Prepared an independent review handoff covering CO-PILOT/CRCP Save policy, self-PIC crew fields, legacy draft sanitization, Safety Pilot connection architecture and GPS role promotion.
- **Runtime/schema behavior:** unchanged; F2 implementation has not started.

### Flight Entry Workflow 3.0 — F1.4 shared GPS normalization
- Routed every reviewed GPS PIC part through `gpsFlightCandidate() → normalizeFlightDraft() → FlightInput` before any flight persistence.
- GPS flight INSERT semantics now consume the same normalized `FlightInput` contract as Manual entry instead of recomputing role credit, billing, operation/engine and other flight semantics independently.
- Kept GPS track coordinates/provenance, date-effective price lookup, duplicate fingerprinting, sorted advisory locks and the atomic N-part transaction outside the semantic normalizer.
- Preserved F0.1 fail-closed aircraft context, F1.5 explicit Operation/Engine and F1.6 explicit source-evidence review; GPS remains PIC-only.
- Added Manual/GPS equivalent-EASA-PIC semantic equivalence coverage plus authenticated browser persistence coverage.
- Reconciled the isolated browser `flight_tracks` fixture with the runtime `overview_version` column and made the mutation test deterministic/cleanup-safe.
- Final PR-head verification before docs closeout: Verify #1055 PASS; TypeScript PASS; full unit/regression **1030/1030**; PostgreSQL acceptance **63/63**; Browser smoke #431 **28 passed / 2 skipped**; production build PASS.
- F1.4 merged as PR #200 on `main@5c2af689c74e209358d22eebf05c3f4120a4224f`.
- Production deployment `dpl_8NaCnff1TcP6DRkXSwUKmEq9dHiR` reached READY for that exact main SHA and is aliased to `fly-tally.com` with no alias error.
- DB schema/migration: N/A for F1.4; F1.0 migration v17 remains the only schema prerequisite in F1.
- F1 shared semantic normalization is therefore **DONE / production-verified**; F2 Role/Crew parity is next.
- Superseded parallel PRs #196 and #198 were closed without merge.

### Flight Entry Workflow 3.0 — F1.6 GPS source fidelity
- Added category-driven GPS review requirements instead of inferring regulatory evidence from generic movement.
- Reviewed landing totals must be explicitly classified day/night where the current domain distinguishes them; non-TMG sailplane keeps the existing total-landing compatibility model.
- Part-FCL/ULL PF movement credit now requires an explicit Yes/No pilot decision; positive PF evidence requires explicit day/night take-off and approach counts.
- Part-SFCL TMG and Part-BFCL take-offs require explicit day/night counts; non-TMG sailplane requires explicit launch method/count.
- Added optional reviewed Night/IFR fields for standard-time categories; track motion does not infer either value.
- GPS candidate adapters now resolve these source-sensitive fields only from explicit reviewed input, while unresolved/missing required facts remain fail-closed.
- Current GPS persistence stores the reviewed source-fidelity fields in preparation for F1.4 shared-normalizer convergence.
- Added source/domain and authenticated browser coverage for the new review boundary.
- DB schema/migration: N/A.
- Verification: final Verify FlyTally web #1031 PASS; TypeScript PASS; full unit/regression **1025/1025**; PostgreSQL acceptance **63/63**; Browser smoke #407 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A. The first #1030 run failed only because an F0.1 source-characterization assertion still expected the pre-F1.6 readiness expression; the assertion was reconciled without runtime changes.

### Flight Entry Workflow 3.0 — F1.5 explicit GPS Operation / Engine
- Reordered F1 execution because the shared normalizer correctly treats unresolved Operation/Engine as a blocking semantic state; routing GPS through it before explicit source input would either fail every applicable import or reintroduce guessed defaults.
- Added common GPS **Operation (SP/MP)** and **Engine (SE/ME)** controls for categories where the canonical capability contract exposes those semantics.
- Aircraft/registration changes clear both selections so values cannot leak across aircraft profiles.
- Server-side GPS import now revalidates Operation/Engine and persists the explicit reviewed values rather than silently forcing `SP` and class-derived Engine.
- Non-applicable category branches retain compatibility storage values only and do not present them as regulatory evidence.
- GPS remains PIC-only; shared normalizer routing, sailplane/movement/day-night/Night/IFR convergence remain outside this batch.
- **Verification:** Verify FlyTally web #1024 PASS; TypeScript PASS; full unit/regression **1019/1019**; PostgreSQL acceptance **63/63**; Browser smoke #400 **26 passed / 2 skipped**; production build PASS.
- **DB schema/migration:** N/A.

### Flight Entry Workflow 3.0 — F1.3 Manual persistence proof
- Added source-contract coverage proving Manual create and update remain behind the `parseFlightInput(FormData)` compatibility boundary after F1.2.
- Verified flight semantic columns are persisted from normalized `FlightInput` values rather than re-read independently from FormData.
- Preserved airport canonicalization, rate resolution, duplicate fingerprint/advisory locking and edit lock guards as persistence concerns.
- Preserved expenses as separately validated child rows and connected Actual-PIC account linkage as collaboration metadata outside the pure normalizer.
- Confirmed GPS remains on its specialized path for F1.4.
- Verification: Verify FlyTally web #1013 PASS; TypeScript PASS; full unit/regression **1014/1014**; PostgreSQL acceptance **63/63**; Browser N/A because no runtime/UI behavior changed; DB schema/migration N/A.
- Next: **F1.4 GPS semantic adapter / persistence convergence**.

### Flight Entry Workflow 3.0 — F1.2 pure normalizer
- Extracted `normalizeFlightDraft(candidate)` as the source-agnostic pure semantic normalizer for flight draft data.
- Converted `parseFlightInput(FormData)` into the compatibility wrapper `FormData → manualFlightCandidate() → normalizeFlightDraft()`.
- Kept DB/auth lookup, expenses, connected-crew validation, persistence and GPS track handling outside the pure normalizer.
- Explicit unresolved candidate authority now returns a domain error instead of being coerced into an implicit value.
- Preserved existing Manual semantics across EASA/ULL validation, category mapping, sailplane/BFCL evidence, structured movements, SPIC/PICUS supervision, professional context, purpose/task and role-derived function time.
- GPS import is not routed through shared normalization yet; its persistence behavior remains unchanged in F1.2.
- Verification: Verify FlyTally web #1007 PASS; TypeScript PASS; full unit/regression **1006/1006**; PostgreSQL acceptance **63/63**; Browser smoke #388 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A.
- Earlier #1003/#1006 failures were stale/source-test maintenance and a test syntax error encountered during the refactor, not accepted runtime regressions.
- Next: **F1.3 Manual wrapper regression / persistence proof**.

### Flight Entry Workflow 3.0 — F1.1 candidate/source adapters
- Added a typed `FlightDraftCandidate` characterization layer with explicit unresolved semantic state and compact provenance metadata.
- Added Manual FormData extraction preserving the presence-sensitive fields that current `parseFlightInput()` depends on.
- Added GPS reviewed-part extraction that carries canonical aircraft-profile context when available but does not infer unresolved Operation/Engine, day/night movement, Part-FCL PF/approach, sailplane launch, night or IFR evidence.
- Future explicit common GPS Operation/Engine values are supported by the candidate contract without class-derived defaults.
- The new adapters are not wired into current Manual/GPS mutation runtime yet; persisted flight semantics remain unchanged in F1.1.
- Verification: Verify FlyTally web #998 PASS; TypeScript PASS; full unit/regression **998/998**; PostgreSQL acceptance **63/63**; Browser smoke #379 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A.
- Next: **F1.2 pure normalizer extraction** with `parseFlightInput(FormData)` retained as the compatibility boundary.

### Flight Entry Workflow 3.0 — F1.0 historical aircraft identity preservation
- Added base database migration **v17 — historical flight aircraft identity preservation**.
- Replaced the v6 aircraft-identity trigger behavior without rewriting the already-applied v6 migration.
- Ordinary Manual/GPS-style INSERTs with an empty make/model/variant tuple still snapshot the current matching aircraft profile.
- INSERTs carrying any explicit make/model/variant member now preserve the supplied tuple atomically instead of mixing or overwriting it from mutable current profile state.
- Registration-changing UPDATEs still snapshot identity for the new registration.
- Same-registration UPDATEs no longer refresh historical identity from mutable current profile state.
- Exact backup restore remains compatible with its existing two-stage flow: staged empty identity insert followed by explicit identity restore.
- Added source-contract coverage plus PostgreSQL acceptance for existing certified rows, ordinary inserts, conflicting recipient profiles, partial explicit tuples, same-registration updates, actual registration changes, restore-style second-stage writes and idempotent reapplication.
- **Historical rows:** no existing flight is rewritten or guessed/backfilled by this migration.
- **Certification:** no certification payload/hash/version change.
- **Verification:** final PR head: Verify FlyTally web #997 PASS; TypeScript PASS; full unit/regression **992/992**; PostgreSQL acceptance **76/76**; Browser smoke #378 **26 passed / 2 skipped** across desktop/mobile; production build PASS. Early #987/#989/#371 failures exposed only migration/test-harness defects (PL/pgSQL delimiter, stale v16 fixture extraction, and browser fixture schema drift); each was corrected and the final gates passed.
- **Production:** PR #191 merged as `e7361dbe3e55fbba721ec01c2bffd5c885452c12`; Vercel deployment `dpl_EiEU6pWp95nQuNRGwGVTgtLrgSJn` is READY on `fly-tally.com`. Production Neon records migration v17 `historical flight aircraft identity preservation` applied at 2026-10-01 06:47:01 UTC; the live function/trigger definition was read back and matches the reviewed v17 behavior.

### Flight Entry Workflow 3.0 — F1 design / independent review
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_DESIGN.md` with the proposed source-adapter → typed candidate → pure normalizer → `FlightInput` architecture.
- Kept `parseFlightInput(FormData)` as the proposed compatibility wrapper to minimize Manual blast radius.
- Explicitly kept GPS tracks, expenses, connected crew, certification lifecycle and participation/verifications outside the canonical flight semantic payload.
- Split the proposed implementation into F1.1–F1.6 so Manual regression equivalence is proven before GPS is routed through shared normalization.
- Raised Operation/Engine as a blocking correctness question because current GPS silently stores SP plus class-derived engine, which is not sufficient source evidence for every FCL-style flight.
- Carried the shared-flight identity-trigger issue forward as a migration/integrity design question; no migration has been written.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_REVIEW_HANDOFF.md` for independent read-only review before runtime implementation.
- Independent review returned **APPROVE WITH CHANGES** and was reconciled into the F1 design: F1.0 trigger hotfix first; explicit EASA GPS Operation/Engine before F1 release; unresolved source evidence remains fail-closed; F2 retains Role/Crew ownership.
- **Runtime/schema behavior:** unchanged in this design PR; F1 runtime code has not started.

### Flight Entry Workflow 3.0 — F0 field / consumer contract inventory
- Added the authoritative repository-backed Manual/GPS/Edit/Certification/consumer matrix at `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md`.
- Recorded the current Manual canonical parser boundary versus the remaining GPS direct semantic INSERT path.
- Classified Save requirements separately from Certification requirements, including the existing DUAL UI/server Save-boundary mismatch.
- Recorded certification-hash v1–v8 coverage and explicitly classified non-hashed child/commercial/collaboration data.
- Recorded draft-visible Dashboard/Statistics/Export/Print behavior versus certified-only canonical Recency and certified-source Sharing.
- Recorded GPS parity gaps for sailplane launch evidence, PF movements/approaches, day/night fidelity, night/IFR, professional context, purpose, expenses and non-PIC Role/Crew.
- Identified a cross-workstream historical-identity risk for review: shared-flight INSERT supplies certified source make/model/variant while the v6 flight INSERT trigger can overwrite those fields from recipient current-profile state.
- Recorded CSV/XLS output completeness gaps without changing stored semantics.
- Added source-contract tests to keep the F0 findings explicit before F1 refactors them.
- **Runtime/schema behavior:** unchanged by F0 analysis.
- **Verification:** Verify FlyTally web #982 PASS; TypeScript PASS; full unit/regression **988/988**; PostgreSQL acceptance **55/55**; browser N/A; DB schema/migration N/A. The first #981 attempt exposed only an outdated test assertion for the existing v8 certification hash call and was corrected without runtime changes.

### Flight Entry Workflow 3.0 — F0.1 GPS fail-closed integrity hotfix
- Removed GPS UI/server fallbacks that could silently turn missing aircraft class/logbook context into `ULL`.
- GPS now resolves the selected active aircraft through the same fail-closed aircraft-profile validation used by New Flight defaults; malformed/unavailable context returns **Needs configuration** instead of invented regulatory identity.
- GPS no longer trusts submitted aircraft class/logbook/type as authoritative identity: the active selected aircraft profile is resolved server-side and submitted class/logbook must match that canonical context.
- Interim GPS Role support is intentionally narrowed to **PIC only**; DUAL, Safety Pilot, INSTRUCTOR/legacy `INSTRUKTOR`, Co-pilot, PAX, Observer and crafted unknown roles fail closed until the shared Role/Crew milestone provides complete semantics.
- Removed the visual-review-only hard-coded `ULL` provenance placeholder.
- Preserved existing GPS split/review, duplicate fingerprint, advisory-lock and single-transaction flight/track persistence behavior.
- Added F0.1 domain/source regression coverage plus authenticated browser fixtures for valid EASA/SEP, valid explicit ULL and malformed EASA aircraft context.
- No database schema/migration, certification hash/version, recency rule, historical backfill or broad UI redesign is introduced.
- **Verification status:** PASS on final runtime head before docs closeout — Verify FlyTally web #979: TypeScript PASS, full unit/regression **979/979**, PostgreSQL acceptance **55/55**; Browser smoke #366: production build PASS, authenticated Chromium desktop/mobile **26 passed / 2 skipped**.

### Flight Entry Workflow 3.0 — F0.0 characterization
- Added a characterization-only baseline for the current GPS flight-entry/write path; no runtime behavior changes in this milestone.
- Confirmed UI and server fail-open `ULL` fallbacks, direct GPS flight persistence outside `parseFlightInput()`, empty GPS commander/instructor persistence and draft consumption by Dashboard/Statistics/Export/Print while recency remains certified-only.
- Confirmed the GPS INSTRUCTOR option currently submits non-canonical stored value `INSTRUKTOR`, which receives zero function-time allocation; F0.1 therefore uses **PIC only** as the smallest proven coherent interim GPS role set.
- Added source regression coverage for the current defect/baseline, role mismatch, Manual save-boundary differences, duplicate/advisory-lock transaction behavior and downstream draft-consumer boundary.
- Detailed evidence: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F00_CHARACTERIZATION.md`.
- **Verification status:** DONE — Verify FlyTally web #970 PASS; TypeScript PASS; full unit/regression 971/971 PASS; PostgreSQL acceptance 55/55 PASS. No runtime/schema/deployment change.

### Flight Entry Workflow 3.0 — planning/design freeze
- Added the frozen `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md` contract after Claude Round 1, DeepSeek Round 2 and repository reconciliation.
- Reprioritized the roadmap so the confirmed GPS invalid-profile → `ULL` fail-open defect is addressed before Multi-aircraft M2B.
- Frozen direction: one canonical Manual/GPS semantic normalization boundary; GPS as source/provenance rather than a second flight model; source-agnostic Role/Crew semantics; atomic multi-part persistence; no guessed historical repair.
- Frozen EASA entry behavior: DUAL Instructor/PIC, Safety Pilot Actual PIC and SPIC/PICUS supervision evidence must be immediately reachable and Save-required; certification remains the authority for later certification completeness.
- Recorded the repository-backed consumer boundary: recency is certified-only, while Dashboard/Statistics and Export/Print can consume draft records, increasing the importance of correct evidence/class identity at first Save.
- Defined F0.0 as characterization-only and F0.1 as the minimal GPS fail-closed production hotfix before broader domain/UX convergence.
- This planning change does **not** modify runtime, schema, certification hash/version, recency calculations, GPS persistence or production deployment.

### New Flight intelligent review — form-scope hotfix
- Bound `IntelligentFlightEntryPanel` explicitly to the canonical manual `FlightForm` instead of selecting the first `.flight-form` mounted on the page.
- Prevented manual-entry history/profile advisories from being portaled into the simultaneously mounted GPS import form.
- Deferred intelligent-review FormData resync to the next animation frame after input/change so React-controlled aircraft profile fields are read after their coordinated update rather than from an intermediate DOM state.
- Added source regression coverage plus an authenticated browser reproduction with three recent EASA/SEP records proving a GPS-selected EASA/SEP aircraft does not receive a stale ULL history warning.
- GPS import save/parsing, aircraft profile data, historical flights, certification, recency, billing and persistence semantics are unchanged.

This section tracks changes intended for the next named release. An entry is production-complete only after the corresponding change has been merged to `main`.

### New Flight UI/UX Simplicity — B5 responsive + accessibility closeout
- Delayed ordinary required-field error styling until an explicit save attempt while keeping genuine selected-profile configuration failures immediately visible.
- Converted the existing missing-field summary into focusable blocker navigation that opens the owning native disclosure before focusing its control.
- Preserved native details/summary semantics without redundant ARIA state.
- Restored collapsed evidence summaries on narrow mobile, added earlier iPad/zoom grid reflow and disabled sticky New Flight actions where touch keyboards or very small/short viewports could cause overlap.
- Added coarse-pointer 44px targets and forced-colors treatment for blocker controls.
- Switched the small Flight-experience Change cue to the normal link token; measured canonical New Flight muted/link colors meet WCAG AA normal-text contrast on dark/light panel surfaces.
- Final authenticated screenshot review exposed Flight experience empty-state title/explanation concatenation at 320px/200% reflow; PR #182 fixed it with contextual spacing while preserving the canonical `empty-state` design-system contract.
- No parser, persistence schema, certification payload/hash, recency, collaboration, billing or UTC semantics changed.
- **Verification status:** DONE. PR #179 automated gate PASS; PR #182 Verify FlyTally web #955 PASS and Browser smoke #349 PASS. Final isolated authenticated Browser smoke #352 PASSed with 23 browser tests passed / 3 skipped and produced 132/132 New Flight screenshots (11 states × 6 viewports × light/dark); all 132 matrix records reported 0 px horizontal overflow. Production commit `45a97aacec50e9e7b20d676afd4493c2e896c1fe` is READY on Vercel and aliased to `fly-tally.com`. PostgreSQL schema/migration N/A for the presentation-only closeout.

### New Flight UI/UX Simplicity — B4 optional details + helper-copy triage
- Consolidated Training purpose/Task, Night/IFR, Professional context, Costs/expenses and Notes under one native **Optional details** disclosure.
- Populated Edit records now auto-open Optional details and summarize which optional domains already contain stored/current data.
- Moved Night/IFR duration inputs out of Flight experience while preserving the same form/parser contract and surfacing historical stored values for correction.
- Kept malformed billing fail-closed and auto-opened the containing Optional details disclosure.
- Added embedded Professional context presentation while preserving its existing applicability and hidden-input behavior.
- Removed or compacted repeated aircraft-profile, generic role, cost and Task helper prose while keeping validation, Connection and signed-evidence consequences visible.
- No parser, persistence schema, certification payload/hash, recency, collaboration, billing or UTC semantics changed.
- **Verification status:** merge-ready — TypeScript PASS, reconciled targeted contracts 34/34 PASS, full unit/regression 954/954 PASS, production build PASS on the runtime-equivalent B4 head. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B3 profile + role context
- Aircraft & logbook collapsed summary now exposes actual evidence/logbook, regulatory category, aircraft class and applicable operation/engine context instead of relying on a generic category description.
- Preserved selected-profile origin on new entry while avoiding re-deriving Edit snapshot provenance from mutable current aircraft profiles.
- Invalid or unresolved selected-aircraft context forces the profile disclosure open.
- Replaced **Crew & training** with role-driven **Role details**; DUAL, Safety Pilot, SPIC and PICUS required evidence auto-opens in one contextual area.
- Moved structured Training purpose and Task/exercise into **Optional details** while keeping FlightPurposePicker hidden submission semantics unchanged.
- No parser, persistence schema, certification payload/hash, recency, collaboration, UTC or billing semantics changed.
- **Verification status:** merge-ready — TypeScript PASS and production build PASS; reconciled targeted contracts 22/22 PASS; full unit/regression 946/946 PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B2 essentials + movement evidence
- Reordered the always-visible essentials to Date → Registration → Role, followed by grouped Route and one chronological UTC timeline.
- Kept Departure/Arrival and all time fields optional for draft save; certification remains the authority for route/time completeness.
- Preserved live BLOCK/AIR calculation and the `—` unavailable state without inventing `0:00`.
- Flight experience summary now exposes the actual landing/PF evidence-bearing preset state, with a visible Change cue while keeping detailed movement controls behind the same native disclosure.
- Reduced repeated manual-entry intro copy and made Add aircraft contextual when the pilot already has aircraft.
- Added responsive B2 layout rules for desktop, iPad-width and narrow mobile time grids.
- No parser, persistence schema, certification payload/hash, recency or billing semantics changed.
- **Verification status:** merge-ready — local TypeScript PASS, targeted B2/affected historical contracts 47/47 PASS, full unit/regression 940/940 PASS, production build PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B1B completion semantics
- Removed the duplicated inline **Review before save** card and the second `Ready to save` completion state from New Flight.
- New Flight keeps one form-level blocker/consequence surface and one primary **Save & review** action; Edit keeps **Save changes**.
- Removed initial **Save and add another** and moved **Add another flight** to the successful saved-review handoff.
- Relocated selected-aircraft/profile origin and unsaved-change context instead of discarding unique information from the removed review card.
- Preserved the existing `/flights/<id>?tab=logbook&saved=1` review-first handoff, draft-save semantics, certification blockers and PendingActionButton duplicate-submit protection.
- No schema, certification payload/hash, recency, UTC or optional-cost semantics changed.
- **Verification status:** merge-ready — local TypeScript PASS and production build PASS; reconciled targeted B1B/historical contracts 34/34 PASS; full unit/regression 934/934 PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to the later live cumulative New Flight redesign check and is not reported as PASS.

### New Flight UI/UX Simplicity — B1A optional Costs
- Added an explicit optional billing parser/serializer so blank billing means **Not tracked** instead of silently becoming BLOCK.
- New Flight and GPS import can save otherwise-valid records without aircraft-cost tracking; populated malformed billing still fails closed.
- Aircraft profile defaults now support explicit no-billing configuration while preserving configured BLOCK/AIR + share values.
- Untracked flights do not resolve or snapshot an aircraft hourly rate, and dashboard/list cost aggregates treat them as zero cost contribution instead of implicit BLOCK.
- Aircraft sharing preserves no-billing defaults and rejects/surfaces malformed populated billing rather than silently clearing or repairing it.
- Read-only billing labels distinguish **Not tracked** from malformed persisted billing (**Unavailable**).
- Legacy billing helpers remain compatible for untouched historical callers; certification, recency, UTC and crew-credit contracts are unchanged.
- **Verification status:** merge-ready — TypeScript PASS; targeted B1A 35/35 PASS; stale-contract rerun 55/55 PASS; full unit/regression 928/928 PASS; production build PASS; read-only production DB metadata confirms both billing columns are nullable text with legacy BLOCK defaults and no billing CHECK constraints, so no migration is required. Protected Preview was READY but authenticated smoke is explicitly deferred to a live post-merge check because Preview has no DATABASE_URL; the deferred check is not reported as PASS.


### New Flight UI/UX Simplicity — B0.5 integrity baseline
- Added a fail-closed selected-aircraft profile-default resolver that reuses the canonical M1 validator and rejects defaults when validation would repair or replace the stored evidence/class.
- Valid ULL profiles remain ULL; invalid/missing legacy profile context now surfaces as **Needs configuration** instead of silently falling back to ULL.
- Preserved stored same-aircraft Edit snapshots; changing to another aircraft and back restores the original stored aircraft-dependent snapshot instead of leaving mixed temporary-profile state.
- Added a complete golden EASA SEP PIC `parseFlightInput()` payload baseline plus source coverage proving manual Create and Update continue through the same canonical parser.
- Recorded the approved Role / normal landing / PF preset policy and scenario-specific decision-density baseline for later UX comparison.
- No schema, certification hash/version, recency calculation, connection/PIC materialization or UTC semantics changed.
- **Verification status:** PASS — targeted B0.5/M1/manual-entry/input suite 26/26, full suite 916/916, production build PASS; TypeScript PASS on the runtime-equivalent head and again inside the final production build. PostgreSQL N/A; dedicated browser matrix deferred by design to the presentation batches because B0.5 does not alter the normal validated-aircraft fixture path.


### General PIC invitation across source roles
- Generalized explicit post-certification `PIC` invitation beyond Safety Pilot to every recognized canonical stored source role.
- Added schema migration v16 with invite-time PIC commander provenance (`CERTIFIED_SOURCE_COMMANDER` vs `RECIPIENT_ACCOUNT`) and one-active-PIC-per-source-revision protection.
- Preserved the dedicated Safety Pilot Actual-PIC workflow and certified source commander semantics.
- Added generic PIC sharing through Crew & logbook sharing, with accepted-Connection, exact revision/hash, owner and re-share guards.
- Generic PIC materialization uses recipient account commander semantics and carries the complete certified event data while recalculating recipient role/credit as PIC.
- Added source/unit and PostgreSQL acceptance coverage for provenance, migration constraints, generic INSTRUCTOR→PIC materialization, movement/night/IFR copy, duplicate/reinvite and active-PIC guards.
- **Verification status:** local TypeScript PASS; 909/909 unit/regression PASS; production Next.js build PASS; PostgreSQL full acceptance 66/66 PASS across 24 integration files; authenticated Chromium desktop/mobile 22/22 PASS; migration v16 validated, applied to production Neon after explicit approval, and post-verified.
- PR #169 merged as `a51e8bb13f702c9a04337bff19755ad614ccfcc1`. Vercel production deployment `dpl_9ba1sxfaZ1yyBVPFwcBdF3S9B8W3` reached READY and the canonical public endpoint returned HTTP 200.

### Safety Pilot ↔ PIC lifecycle closeout — SP5
- Added release-level lifecycle coverage for certified-source corrections, pending invitation supersession, cancellation, decline and PIC reinvitation.
- Verified source correction preserves the connected-PIC link and does not rewrite already materialized recipient-owned records.
- Verified PIC reinvite may reopen declined/cancelled requests but cannot reset accepted/materialized participation.
- Kept certification payload/version unchanged and introduced no new schema migration.
- Extended authenticated browser coverage through cancel → reinvite → pending → cancel and revoked-Connection fail-closed behavior.
- Verification: 900/900 unit/regression PASS; PostgreSQL core 48/48 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS; production build PASS.
- Existing migration v15 remains the production-verified prerequisite; SP5 itself has no database migration.
- PR #166 merged; the Safety Pilot ↔ PIC workflow is complete in the repository through SP1–SP5. Production deployment status is tracked separately.

### Safety Pilot ↔ PIC materialization + recency — SP4
- Enabled the dedicated Safety Pilot → PIC participation to materialize an independently owned recipient PIC flight.
- Recipient PIC commander now comes from the certification-protected source `commander`; existing non-PIC materialization behavior is unchanged.
- Added PIC-only acceptance/materialization guards for exact source revision/hash, source Safety Pilot role and a live accepted Connection.
- PIC minutes use the canonical crew-credit path; the source Safety Pilot record remains non-PIC credit.
- Shared-flight PIC preview preserves the certified source commander.
- Added recency proof showing a materialized PIC record behaves like an equivalent ordinary PIC record while the source Safety Pilot contributes no qualifying PIC movements.
- Added PostgreSQL acceptance for independent ownership, duplicate reuse and revoked-Connection fail-closed behavior.
- Verification: 895/895 unit/regression PASS; PostgreSQL core 48/48 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS; production build PASS.

### Safety Pilot ↔ PIC certified invitation — SP3
- Added a dedicated post-certification Actual PIC invitation action for certified Safety Pilot flights.
- The recipient is derived only from persisted connected-PIC metadata; no arbitrary client-supplied PIC participant ID is accepted.
- Invite creation rechecks source ownership, Safety Pilot role, certification hash/revision state and live accepted Connection status.
- Kept PIC excluded from the generic crew-sharing selector and rejected by the generic invite action.
- Added a separate certified Actual PIC panel with pending/cancel/reinvite states and live revoked-Connection fail-closed messaging.
- Kept recipient PIC materialization intentionally blocked for SP4.
- Verification: GitHub Verify FlyTally web PASS; 890/890 unit/regression PASS; PostgreSQL core 47/47 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS.

### Safety Pilot ↔ PIC create/edit identity — SP2
- Added an explicit Safety Pilot Actual PIC choice between manual text and an accepted FlyTally Connection; manual entry remains the default and no name matching is used.
- New Flight loads accepted pilot Connection IDs/names separately from instructor suggestions.
- Connected selections are canonicalized server-side from the selected account's current display name after accepted-Connection revalidation.
- Create/Edit synchronize the flight row, expenses and current connected-PIC metadata atomically; switching to manual entry or away from Safety Pilot removes the link.
- Edit/correction reloads stored connected identity by flight ID, including a fail-closed unavailable state when the Connection is no longer accepted.
- SP2 does not send PIC invitations or create participation rows; certified sharing remains staged for SP3.
- Added SP2 source/regression and browser-contract coverage. Final verification: TypeScript PASS, 885/885 unit/regression PASS with 0 fail / 0 skip, production build PASS, isolated Neon persistence acceptance PASS, and authenticated isolated Vercel Preview acceptance PASS across desktop, mobile and iPad layouts. Preview testing found and fixed a repeated-save controlled-field reset before merge.

### Safety Pilot ↔ PIC foundation — SP1
- Added tracked schema migration v15 for separate `flight_connected_crew` collaboration metadata with owner-bound FK, one-PIC-per-flight uniqueness, self-link rejection and cascade cleanup.
- Extended shared-flight participation role storage/domain normalization to `PIC`, with an explicit fail-closed `SAFETY PILOT → PIC` combination and canonical PIC-minute credit semantics.
- Added connected-PIC persistence helpers that require an editable Safety Pilot source flight and an accepted Connection before a link can be written.
- Kept the staged rollout fail-closed: PIC is excluded from the legacy generic crew selector, rejected by its generic server action, and not materialized until the later dedicated PIC workflow milestone.
- Added unit/source and PostgreSQL contract coverage for migration, constraints, role mapping and write guards.
- Verified SP1 with TypeScript PASS, 875/875 unit/regression PASS, production build PASS, and isolated Neon PostgreSQL acceptance over real migration constraints and fail-closed write guards.
- Deleted the isolated Neon acceptance branch after verification, then applied the exact verified migration v15 to the production Neon branch as the deployment prerequisite after explicit approval; post-migration checks confirmed the new table/constraints and zero collaboration rows.
- No Safety Pilot PIC selection/invitation UI is shipped by SP1; `FEATURES.md` therefore remains PLANNED.

### GPS touch-and-go detection reliability
- Reproduced a real missed rolling touch-and-go caused by an unrelated near-zero-timestamp altitude pair remaining inside a sparse ±10-point discontinuity window.
- Added anonymized regression coverage proving equivalent touchdown geometry must classify the same despite harmless post-climb point-density differences.
- Bounded rolling-T&G altitude-discontinuity checks to the candidate's own nearest +30 m descent/climb evidence span.
- Kept the existing 28–145 km/h rolling-speed and 30 m descent/climb thresholds unchanged.
- Preserved fail-closed rejection when timestamp/altitude corruption occurs inside the qualifying T&G evidence span.
- Left take-off discontinuity behavior and unrelated point-count grouping/dedup logic unchanged.
- GPS-derived landing totals remain advisory and user-reviewed; no DB/schema/certification behavior changed.

### Multi-aircraft Product Scale — M2A
- Changed type-specific helicopter recency to resolve historical type from stored `flights.aircraft_model`, with bounded legacy fallback to stored `flights.aircraft_type`.
- Removed mutable current-aircraft model and registration as silent historical type fallbacks.
- Added fail-closed LIMITED DATA handling when unresolved historical helicopter type evidence could satisfy an otherwise missing type-specific requirement.
- Kept independently proven CURRENT results current; unresolved unrelated flights do not downgrade them.
- Added PostgreSQL and unit/source regressions proving current profile model edits cannot rewrite historical type resolution.
- No flight rows, certification payload versions/hashes, schema or ULL/Annex-I mapping semantics changed.

### Multi-aircraft Product Scale — M1
- Added one canonical server-side aircraft-profile validator for regulatory profile state.
- Routed normal Aircraft Add/Edit and accepted shared-profile imports through the same fail-closed validation contract.
- Rejected explicit class/category mismatches, incomplete EASA identity, invalid/non-applicable BFCL class/group data and malformed explicit Part-FCL credit provenance instead of silently repairing them.
- Added an actionable shared-profile error path when a received profile cannot be imported safely.
- Added full profile-matrix/source regressions and PostgreSQL acceptance proving malformed shared regulatory profiles do not reach persistence.
- Kept exact backup/restore outside interactive profile canonicalization; no schema, certified-flight payload/hash, catalogue-authority or ULL/Annex-I semantics changed.

### Documentation governance
- Consolidated the roadmap into one current planning document.
- Added a canonical `FEATURES.md`.
- Added a documentation index and historical archive under `docs/history/`.
- Moved old version-specific scope/audit notes out of the repository root without deleting their evidence from Git history.

### Design consistency audit — Batch 9
- Added branded root not-found and runtime-error fallbacks using existing FlyTally page/panel/button contracts.
- Kept runtime error presentation non-technical and added retry plus safe root navigation.
- Replaced the bespoke Push onboarding glass surface with the canonical raised-surface tokens while preserving placement and behavior.
- Closed UX-027 without a visual change after confirming the effective login-card cascade was already 11 px with no backdrop blur.

### Design consistency audit — Batch 10
- Standardized sign-in/join email terminology while preserving the more specific Account email label in Settings.
- Replaced decorative Dashboard lead phrasing with operational all-time totals / Statistics guidance.
- No authentication, input behavior, dashboard calculation, regulatory or stored-data semantics changed.

### Design consistency audit — Batch 11
- Added an explicit non-blocking offline connection banner with automatic online/offline event handling.
- Kept the service worker online-only: no navigation/API interception, offline cache or offline logbook mutation was added.
- Added source-contract and real-browser coverage for banner appearance/removal.

## v3.3 design & workflow consistency — merged through 2026-09-20

### Workflow simplification
- Simplified New flight while keeping aircraft and route selection explicit rather than silently prefilled.
- Simplified the Flights workflow and restored an obvious compact Open action.
- Unified aircraft-card layout and added safe aircraft deletion.

### Design-system consistency
- Consolidated shared tokens, geometry, spacing and tabular numeric presentation.
- Improved light-theme text contrast and moved the legacy GPS chart to theme-aware chart tokens.
- Replaced OS-dependent functional glyphs with the shared SVG icon system.
- Converged empty/loading/component states.
- Hardened accessibility, focus and touch-target behavior.
- Clarified required-field and validation presentation.
- Standardized UTC, viewer-timezone and date-only display formatting.
- Normalized protected secondary route rhythm, Share headers and public/legal layout.

### Engineering workflow
- Reduced unnecessary GitHub Actions usage while retaining risk-based verification gates.

The approved design-consistency audit is complete through Batch 11.


## v3.2 — UI consistency & verification foundation — 2026-09-19

### Changed
- Added route-level UI consistency auditing and shared UI-system regression coverage.
- Added real-browser smoke coverage plus authenticated browser and mutation coverage.
- Added transaction-backed authenticated mutation tests for higher-risk write paths.
- Unified aircraft-card presentation and added safe aircraft deletion.
- Reduced unnecessary GitHub Actions usage while retaining risk-based verification gates.

## v3.0 — UX & Product Consolidation — 2026-09-18

### Changed
- Simplified global Logbook navigation around pilot tasks and moved Notifications into the live activity model.
- Simplified Licences & Recency, Aircraft & airports, Print & data and Settings hierarchies.
- Added personal aircraft-profile sharing and cover photos while keeping recipient copies independently owned.
- Added Web Push subscriptions, preference controls and contextual onboarding.
- Clarified the save → review → certify → share workflow.
- Closed the mobile/accessibility acceptance pass for core Logbook workflows.
- Added/refined the public interactive flight viewer and Share presentation.

### Integrity
- UX consolidation did not redefine certified-record, recency, ownership or regulatory evidence semantics.
- A later FCL.060 ULL same-class correction was merged as an explicit regulatory fix rather than hidden inside UX work.

## v2.9 — Commercial & External Validation technical foundation — 2026-09-18

### Added
- Fail-closed commercial-readiness contract and external-validation ledger.
- Versioned commercial legal publication boundary.
- Provider-neutral billing/entitlement technical foundation.
- Signature-assurance and regulatory-validation boundary.
- Brand/public-claims boundary.
- Final commercial release audit and build guard.

### External boundary
- Technical implementation does not equal lawyer, regulator, trademark, payment-provider or other external approval.
- Public commercial release remains dependent on real external evidence and business decisions where required.

## v2.8 — Compliance & Safety Foundation — 2026-09-18

### Added / changed
- Added privacy self-service, retention controls and cross-product erasure coordination.
- Hardened regulator-facing logbook identity and source-of-truth handling.
- Finalized reviewed map-provider/licensing behavior and browser security controls.
- Added compliance regression coverage for legal, sharing, provider and aviation-safety boundaries.

### Integrity
- Authority acceptance is not inferred from internal implementation or tests.
- FCL.050-oriented engineering traceability remains separately documented under `docs/compliance/`.

## v2.7.1 — Recency hotfixes — 2026-09-09

- Fixed the Recency expiry-date SQL type mismatch.
- Fixed Recency light-theme readability.
- No intentional regulatory-rule expansion was bundled into these hotfixes.

## v2.7 — Data Integrity & Recovery 2.0 — 2026-09-08

### Changed
- Made restore review-first with explicit missing/present/protected-conflict preview.
- Added authenticated current-format portable backup integrity while retaining bounded legacy compatibility.
- Preserved certified revisions, signatures, GPS, sharing evidence, audit history, licences, expenses and recency evidence through the canonical recovery path.
- Added tested large-account transaction batching while preserving atomicity/safety limits.

## v2.6 — Professional Pilot Workspace 2.0 — 2026-09-08

- Expanded professional/operator context and professional-experience reporting.
- Preserved recorded-evidence vs regulatory/employment-conclusion boundaries.
- Kept professional context explicit instead of silently inferring CAT/NCC/SPO or employment status.

## v2.5 — Recency & Compliance Workspace — 2026-09-08

- Consolidated licence/rating validity, flying recency and supporting evidence into a planning-oriented workspace.
- Kept CURRENT / ACTION SOON / NOT CURRENT / INCOMPLETE EVIDENCE evidence-driven and explainable.
- Linked recency presentation to supporting flights, training, signatures and credentials without rewriting certified records.

## v2.4 — Flight Entry & Review 2.0 — 2026-09-08

- Kept one canonical Add flight workflow while integrating review findings near their owning fields.
- Added explicit saved-vs-GPS review before applying GPS-derived suggestions to an existing flight.
- Added final logbook-data review before certification/sharing while preserving certification hashes, revisions and regulatory calculations.

## v2.3 — Large Logbook Performance & Scalability — 2026-09-07

- Retained 10k/50k scale gates and added a controlled 100k read-performance benchmark for production hot paths.
- Reduced Dashboard/Statistics/Print hot-path work through leaner projections, set-wise lookup and scoped aggregation.
- Preserved v2.2 workflow semantics and certified-data integrity while improving scale behavior.

## 2.2.0 — Action Center & Shared Flight Workflow — 2026-09-07

### Added
- Added an authoritative Action Center for unresolved flight invitations, instructor verification requests, aircraft-training signatures and incoming pilot connection requests.
- Sidebar and Dashboard now surface Actions only while a real workflow decision is pending; the badge is derived from workflow state rather than unread notification state.

### Changed
- Notifications remain the update/history inbox and no longer act as the global pending-work signal.
- Needs attention remains separate and continues to contain only actionable data-quality findings from the pilot's own logbook.
- Shared-flight and signature requests reuse the existing Review & add, Review & sign and Decline workflows; inline Action Center decisions disappear immediately after completion.

### Integrity
- Pending shared-flight actions require the exact current certified source revision and hash, so stale requests do not create ghost actions.
- Legacy instructor approvals are de-duplicated when the canonical instructor participation exists, while that participation still counts once as the real action.
- Modern `signature_request` notifications now support the same direct Decline path as other shared-flight requests.
- No database schema, certification fingerprint, verification payload, sharing ownership or audit-trail semantics changed.

## 2.1.0 — Dashboard & Statistics consolidation — 2026-09-07

### Changed
- Dashboard is a stable all-time at-a-glance home without historical period controls; period analysis lives in Statistics.
- Historical Dashboard period URLs hand off to the equivalent Statistics scope instead of silently losing the selected period.
- Career snapshot is a dedicated Statistics workspace and no longer lengthens Overview; its all-time nature is explicit and its period selector is hidden.
- Existing Dashboard saved-layout migration/customization remains intact and analytical widgets cannot be re-added to Dashboard.

### Preserved
- v2.0 category-aware logged-time, certification, sharing, print/export and Dashboard Safety Pilot semantics are unchanged.
- No database schema, regulatory calculation or credential workflow changed in this release.

## 2.0.0 — Multi-category Pilot Logbook — 2026-09-07

### Added
- One canonical regulatory-category capability model for Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other records.
- Category-specific evidence and progressive disclosure inside the existing Add/Edit flight workflow rather than separate category-specific entry pages.
- Multi-category Flights presentation, filters, Statistics, Dashboard, Print/Export and pilot-context handling built on the same category contract.

### Regulatory integrity
- Historical TMG remains Part-FCL unless an explicit Sailplane / Part-SFCL snapshot exists; legacy GLIDER and BALLOON records remain conservatively resolvable without rewriting certified history.
- Part-FCL Aeroplane/Helicopter certification keeps the existing FCL.050 gate, while SFCL/BFCL records are no longer evaluated with aeroplane SP/MP, SE/ME or BLOCK-time assumptions.
- Sailplane/Balloon credited time uses AIR semantics where applicable; powered/ULL activity retains BLOCK semantics. Safety Pilot remains dashboard activity only and does not inflate regulatory pilot experience.
- Certification fingerprints, certified revisions, sharing, trash/restore and portable backup preserve category, launch and BFCL evidence.

### Hardening and release gate
- Conservative runtime migrations do not rewrite certified historical category evidence.
- RC acceptance covers historical accounts, certification, sharing, backup/restore and mixed-category PostgreSQL behavior.
- The release gate includes TypeScript, complete regression tests, PostgreSQL acceptance, retained 10k/50k scale evidence, production Next.js build and Vercel production verification.

## 1.62.0 — Sailplane / SPL / TMG support — 2026-09-01

### Added
- Explicit aeroplane/sailplane regulatory context so TMG records are not silently reclassified between Part-FCL and Part-SFCL.
- Non-TMG sailplane launch method/count evidence and explicit SPL TMG day/night take-off evidence.
- SPL recency evaluation for sailplane/TMG privileges, passenger currency, launch-method recency and proficiency-check evidence.
- Portable backup v9 coverage for SPL proficiency-check evidence.

### Integrity
- Flight certification fingerprint v5 protects regulatory category and launch evidence while historical v1-v4 fingerprints remain verifiable.
- Sharing and trash/restore preserve the new regulatory/launch fields.
- Sailplane protected-record presentation is labelled Part-SFCL rather than FCL.050.

### Preserved
- Existing TMG history remains Part-FCL unless SPL context is explicit.
- GPS never invents launch methods.
- SPL TMG take-offs remain separate from Part-FCL FCL.060 PF movement evidence.

## 1.61.0 — Category-aware Flight Entry — 2026-09-01

- Blank New flight remains neutral until an aircraft is selected.
- Aircraft-dependent experience controls adapt to the selected profile category inside the existing Add flight workflow.
- Role remains flight-specific and is never replaced by aircraft selection.
- The category layer is presentation-only; existing regulatory calculations remain authoritative.

## 1.60.1 — Licences Navigation Cleanup — 2026-09-01

- Kept section tabs as the single normal Licences navigation layer.
- Kept status rows compact and read-only while detailed evidence remains in dedicated sections.

## 1.60.0 — Adaptive Pilot Workspace — 2026-09-01

- Added an adaptive Licences Overview that shows only relevant credentials, privileges and documents.
- Separated credential validity from flying recency and kept items needing attention prominent.
- Continued to delegate LAPL(A) recency to the existing authoritative Recency Engine.
- Added presentation-only pilot-category classification as groundwork for additional aircraft/licence categories.

## 1.59.2 — Manual Entry Defaults & Aircraft Profile Integrity — 2026-09-01

- New manual flights no longer preselect the previous aircraft registration.
- Departure no longer inherits the previous arrival or configured home airport.
- Aircraft-dependent logbook/class/billing state remains neutral until the pilot explicitly selects an aircraft.
- Explicit aircraft selection reapplies the complete aircraft-dependent profile state (type, logbook, class, engine derivation, operation mode baseline, billing/share and hourly rate) in one interaction.
- Flight-specific role remains untouched when changing aircraft, preserving the v1.53.1 state-integrity boundary.
- Additional expenses and all v1.59 financial behavior are unchanged.

## 1.59.1 — Database Migration Hotfix — 2026-09-01

- Fixed production startup failure `Unknown database migration 14`.
- Added the v1.59 structured-expense schema to the primary sequential database migration runner.
- No flight, regulatory, certification, expense ownership or currency semantics changed.

## 1.59.0 — Flight Entry Structure & Expenses — 2026-09-01

### Added
- Structured personal flight expenses: Landing fee, Handling, Parking, Fuel or a custom Other item, each with amount and currency.
- Currency-grouped totals with no implicit FX conversion.
- Portable backup v8 and trash/restore coverage for personal expenses.

### Changed
- Reorganized manual entry into Flight essentials, Flight experience, Crew & training, Aircraft & logbook, Costs and Notes.
- Day/night landings, Night/IFR time and EASA PF/movement evidence now live together under Flight experience.
- SPIC/PICUS countersignature evidence now lives with Crew & training.
- Notes are no longer mixed into Costs.

### Privacy & certification boundary
- Additional expenses are owned by the current user and are not copied to shared-flight participants.
- Expenses remain outside the certified flight fingerprint/revision, so financial metadata can be maintained without rewriting regulatory evidence.

### Verification
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V159.md`.

## 1.58.0 — Flight Entry Polish & Smart Defaults — 2026-09-01

### Removed
- Quick Routes from New flight, including the unnecessary recent-route query on that page.

### Changed
- Local flight is now a small contextual `Use DEP for local flight` action below Arrival rather than a separate route-shortcut block.
- Aircraft-profile defaults are explained next to Registration and the initial role, so automatic values are visible rather than surprising.
- Existing required selectors show inline missing-state guidance in addition to the final Review summary.
- Departure and Arrival disable mobile autocorrect/spellcheck for cleaner airport-code entry.

### Preserved
- No new regulatory inference and no change to flight parsing/storage, recency, movements, certification, aircraft identity, GPS evidence, sharing, export or backup semantics.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + production CI/runtime audit.
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V158.md`.

## 1.57.0 — Flight Entry Workflow Simplification — 2026-09-01

### Added
- Recent-route shortcuts in manual New flight using FlyTally's existing route-history query.
- Explicit local-flight shortcut to set arrival equal to the current departure only when the pilot chooses it.
- Live BLOCK/AIR duration feedback directly below the timeline.
- Human-readable missing-field list in the final review card.

### Changed
- Logbook and Cost sections open automatically when they contain a missing or relevant required choice, without auto-closing after completion.
- Manual/GPS source selection is more compact on mobile.
- Entry-progress wording reflects the actual inline review workflow.

### Preserved
- No change to flight parsing/storage semantics, regulatory calculations, EASA movement evidence, certification/revisions, aircraft identity authority, GPS evidence, sharing, print/export or backup/restore.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + post-deploy runtime audit.
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V157.md`.

## 1.56.0 — Mobile Layout Audit & Responsive Hardening
- Added the shared iOS/WebKit native date/time sizing fix and a primary-navigation responsive containment audit.
- Preserved internal scrolling for genuinely wide tables/navigation rather than hiding page overflow.

## 1.55.0 — Flight Entry Layout & Responsive UX
- Paired Date/Registration, Departure/Arrival, Off-block/On-block, Takeoff/Landing and Role/Day landings into an aligned desktop grid with a logical single-column mobile flow.

## 1.54.4 — Aircraft Picker Selection Close Fix
- Prevented a confirmed aircraft catalogue selection from immediately reopening because of the debounced search effect.

## 1.54.3 — Aircraft Type Catalogue & Smart Aircraft Setup
- Added the structured FAA aircraft-type catalogue, searchable Make/Model/ICAO picker and manual fallback while keeping Part-FCL class separately pilot-confirmed.

## 1.53.1 — Aircraft State Integrity
- Prevented mixed or stale aircraft state when changing registration or aircraft type in flight entry.

## 1.53.0 — Guided Everyday Entry
- Made normal manual entry the default and simplified first-aircraft/profile setup through progressive disclosure.

## 1.52.0 — Codebase Review & Cleanup
- Removed the retired Streamlit/Python runtime and obsolete generated artifacts while preserving the validated regulatory core.

## 1.51.x — Regulatory Correctness Core
- Established the tested FCL.060, LAPL/FCL.740.A, legacy movement, eligible automatic ULL-credit and certification-evidence baseline retained by later releases.