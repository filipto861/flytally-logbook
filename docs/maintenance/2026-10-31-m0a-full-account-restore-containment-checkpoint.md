# M0-A — full-account restore containment / acceptance checkpoint

**UTC:** 2026-10-31T18:14:46Z. **Repo:** `filipto861/flytally-logbook`. Canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`. Isolated work branch `fix/logbook-m0a-account-restore-containment-20261031`, [Draft PR #452](https://github.com/filipto861/flytally-logbook/pull/452), base `main`. **Exact tested CODE/TEST SHA:** `440c965d1270e1f31dbe9e94d42af0cf4819de3a` (the subsequent documentation checkpoint does not change executable source). Owner-approved implementation + verification only; **NO MERGE / DEPLOY / PRODUCTION DB / FLAG approval**.

## Implementation and regression

- Full-account restore from stored/uploaded backups V4+ including signed V13 **temporarily blocked on server** before mutation. Exact writer and legacy V4/V5 writer also directly fail closed. M0-A does **not** permanently repair old unsafe native audit `MAX(id)` / `DELETE` / imported `INSERT`; that dormant logic is future M0-B. Old-restore production deployment is **still at risk**, but no incident was established.
- UI: check/preview only, no full Restore confirmation; manual/automatic backup create/download/check and single-flight Trash restore preserved. Motion **NONE**. Authenticated desktop/mobile test now verifies signed V13 creation, actual download, integrity/currency metadata, preview and **no recreated flight, pre_restore backup or new audit record**.
- Browser acceptance title and registry updated consistently: `e2e/trash-integrity.spec.mjs`, `tests/browser-suite-structure.test.ts`, `tooling/browser-suite-baseline.json`, `tooling/development-modules.json`. `tests/v380-currency-signed-backup-schema.test.ts` now asserts the M0-A negative full-restore contract. Original **positive** signed V13 recovery scenario remains in Git history for future M0-B; it was NOT executed or declared successful on M0-A.

## Exact-SHA verifications (Node 24.22.1, isolated Vercel Sandbox)

Sandbox: `sbx_FnyZFksJbovFcwvZT7c0TCOPJLbx`. Full verified private repo checkout with `npm ci` PASS. Every DB server below was **newly created in sandbox-owned /tmp**, PostgreSQL **16.15** physically verified via SQL `inet_server_addr()`, `inet_server_port()`, `data_directory`, `server_version_num` against **127.0.0.1**. No remote Neon/prod DB connection, migration, key or flag manipulation.

| Gate | Status / exact evidence |
| --- | --- |
| `npm run verify:plan -- --base 807f281e5870164b794d001480ecc84e0b45aea5` | **PASS**; candidate `db1b910b5e164bfe64bba1febf0306e4c982bbfc591f8a8043fa18556e88bb82`; requires PostgreSQL AND browser |
| `npm run typecheck` | **PASS**, exit 0 |
| `npm test` | **PASS 1770/1770**, 0 fail/skip, exit 0 |
| Exact-candidate Next build | **PASS**, Next 16.3.2; release verifier recorded build PASS |
| `npm run verify:browser:risk -- --base <main>` | **PASS 8/8**, 0 fail/skip, exit 0, **4 desktop + 4 mobile Chromium emulation**, disposable schema-first V20/V21 fixture at localhost port 55455 |
| `npm run verify:release:risk -- --base <main>` | **FAIL exit 1**, blocked by PostgreSQL **PARTIAL**, even though source, domain, typecheck, full tests, build all PASS |
| Canonical PG acceptance in risk release | **PARTIAL 132/164 PASS, 0 FAIL, 32 SKIP**, localhost port 55457 with explicit D2 full-V20 disposable flag. **Skipped tests do NOT count as acceptance** |
| Isolated two-session D2 full-V20 Trash restore | **PASS 8/8** in independent DB (port 55449) with both disposable flags, not a substitute for 164/164 six-partition evidence |
| Native iPad/Safari, Neon HTTP parity, production authenticated smoke | **NOT RUN** |

Prior PG run without D2 flag was **124 PASS / 8 FAIL / 32 SKIP**: all eight failures were missing test-purpose flags; rerun with explicit owned-disposable flags produced **132 PASS / 0 FAIL / 32 SKIP**, not a full release PASS. In the current canonical PostgreSQL gate, 32 protected/specialist tests remain skipped. Repo's six-partition owned PG16 release executor enforces native **Windows**; this Linux sandbox cannot claim equivalent canonical coverage without owner-approved methodology.

**Release status: BLOCKED.** Do not reinterpret build PASS or 8/8 browser PASS as release authority. Browser mobile project is Chromium viewport/touch emulation, **not native Safari**. Production READY deployment remains `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU`, SHA `55c8076e1eb8104c14392e15b272b33e0eb29607` (source still unsafe). Production DB/schema/flags **UNKNOWN**. No merge, deploy, production DB writes, migrations or Training changes.

**ONE NEXT STEP:** execute the remaining 32 PostgreSQL cases in the repo-approved **owner-local Windows six-fresh-PG16-partition** flow against the current exact candidate SHA, reconcile their protected fixtures and rerun `verify:release:risk`. Only after a real green release gate request **separate** owner merge/deploy GO.

## 2026-10-31T18:44:31Z — independent continuation / exact missing-case attribution

- **Read-only evidence source:** GitHub `main@807f281e5870164b794d001480ecc84e0b45aea5`, Draft PR #452 `fix/logbook-m0a-account-restore-containment-20261031`, pre-checkpoint work HEAD `34d507240a8e5a8787bf8e72d3255dedc9688b64`, exact earlier tested executable `440c965d1270e1f31dbe9e94d42af0cf4819de3a`. GitHub compare shows only three Markdown files changed since the tested code SHA; earlier 1,770 Node and 8 browser PASS are **historical SHA-bound evidence, not rerun today**. Current Vercel `fly-tally.com` is still production READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` at `55c8076e1eb8104c14392e15b272b33e0eb29607`.
- **Exact 32 skips**, confirmed against the current `tooling/postgres-partition-registry.json`: `v21-migration` **5** (`FLYTALLY_V21_RELEASE_DISPOSABLE`), `d3b-migration-chain` **19** (`FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE`), `d3b-races` **6** (`FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE`), `real-v20-catalog` **2** (`FLYTALLY_D3B_FULL_V20_DISPOSABLE`). The previous single-DB 132 PASS comprise `shared-core` **124** and `shared-restore` **8**. Partition expectations total **164** across **42** files.
- **Why not rerun here:** current chat execution container is **Linux / Node v22.16.0**, with no PG16 native binary or Windows PowerShell. The canonical executor deliberately rejects non-Windows, CI/Vercel, dirty tree, or mismatched fetched PR ref; GitHub's available manual workflows use Ubuntu. **New canonical PostgreSQL test execution: NOT RUN.** A Linux or manually flag-enabled shortcut must not be labeled canonical PASS. No source/migration/test logic or benchmark thresholds changed.
- **Approved owner-local Windows procedure** (clean, freshly fetched branch HEAD exactly matching origin, Node 24.x, native `C:\Program Files\PostgreSQL\16\bin`; no caller DB URL):
  ```powershell
  git fetch origin
  git switch fix/logbook-m0a-account-restore-containment-20261031
  git pull --ff-only origin fix/logbook-m0a-account-restore-containment-20261031
  git status --porcelain
  $env:FLYTALLY_OWNED_PG16_RELEASE = "1"
  $env:FLYTALLY_OWNED_PG16_EXPECTED_REF = "refs/remotes/origin/fix/logbook-m0a-account-restore-containment-20261031"
  npm run verify:postgres -- --base origin/main
  npm run verify:release:risk -- --base origin/main
  Remove-Item Env:FLYTALLY_OWNED_PG16_RELEASE,Env:FLYTALLY_OWNED_PG16_EXPECTED_REF -ErrorAction SilentlyContinue
  ```
  The second command additionally requires its own verified authenticated browser fixture or reusable same-candidate browser evidence. Never aim fixture/reset commands at an existing, remote, Neon or production DB. `tooling/run-pr340-postgres-partitions-local.ps1` is historical PR340, hardcodes a different branch and prints `VALIDATED-ONLY`; it is **not** the canonical PR452 release path.
- **Status:** PostgreSQL **PARTIAL 132/164, 32 SKIP** (historical); release **BLOCKED**. New Windows six-partition acceptance and new release gate **NOT RUN**. Prod DB/migrations/flags **UNKNOWN**, unchanged by this continuation. No merge/deploy/schema/flag/Training actions.
- **ONE NEXT STEP:** run the canonical `FLYTALLY_OWNED_PG16_RELEASE=1` Windows six-cluster verifier on the freshly fetched exact PR #452 HEAD, then rerun `verify:release:risk` with the separate browser requirement and record actual TAP/ledger results.
