# FlyTally Logbook — portable Windows testing workflow

**22 Oct 2026 — clean candidate Windows quick validation PASS.** Owner fast-forwarded clean PR #384 branch to executable SHA `e27a11efa0770bb11cac88f1ad5602865743a700` and ran `npm run test:quick` on Windows: automatic local source safety **23/23 PASS**, selected source-contract regression **257/257 PASS**, `tsc --noEmit` **PASS**, `iteration_status=PASS` (candidate `a777868f22a5eae5600c452a8a77c747c6ce1710d136a3f79e4f32aa2925b8cf`). The previous historical-v20 source pin mismatch is resolved by exact SHA-256 re-pin, including M1 positive tests. **This is the reusable development iteration gate, not a release:** aggregate-regression/production-build/postgres-acceptance/browser-risk remain PENDING, `release_status=NOT EVALUATED`. Run only risk-selected additional gates prior to release approval. Untracked local U0/U1 ZIPs remain untouched. PR #384 not merged or deployed.


**22 Oct 2026 — owner Windows clean-branch check:** `test:local-workflow` 23/23 PASS, `test:quick` initially blocked by three M1 registry source tests despite typecheck PASS; the reason was a stale SHA-256 pin after the source-backed isolated full-v20 fixture opt-in correction. PR #384 now updates exactly that source hash in `tooling/postgres-partition-registry.json`, preserving the immutable registry membership, count and security scope. The post-fix `npm run test:quick` has not been executed on the owner Windows PC yet; **do not mark it PASS** until rerun. No need to reset PostgreSQL, rerun 50k/100k diagnostics or delete unrelated local ZIP attachments to resolve the hash mismatch. Full release gates remain separate.


**Scope:** Logbook only (`filipto861/flytally-logbook`). The Training repository uses different fixtures and tooling. This runbook describes a candidate developer-only convenience layer, **not** a new release gate or approval to access a remote database.

## Goal

Use identical npm commands on the home and office Windows PCs while keeping installed dependencies and each PC's own disposable local PostgreSQL 16 database. Git synchronizes source code; Git does **not** sync or clone passwords, local databases, Playwright browser installations or other machine state.

## Daily PowerShell commands

```powershell
git fetch origin
git status --short
# Checkout the intended work branch, then update it without merging unrelated branches.
npm run setup:local
npm run doctor
npm run test:quick
```

First-time setup (or when a database fixture is deliberately needed):

```powershell
npm run setup:local -- --with-db
# Alternative explicit DB setup, after dependencies:
npm run setup:db
```

`setup:local` is incremental: it retains installed npm dependencies and Chromium when present, and runs the dedicated source-safety suite. It never reinstalls Git or Node. It prefers a verified native Windows PostgreSQL 16 installation (`initdb.exe`, `pg_ctl.exe`, `createdb.exe`, `psql.exe`); otherwise it can use a local Docker Engine. If neither PG16 backend exists, non-DB tests remain available. `doctor` is read-only and **not** a database acceptance test.

## Available commands

| Command | Purpose | Verification meaning |
| --- | --- | --- |
| `npm run doctor` | Read-only prerequisites | No test PASS implied |
| `npm run setup:local` | Reuse/bootstrap missing dependencies and owned fixture | Setup and safety contracts only |
| `npm run setup:db` | Explicit first-time owned local fixture | Not a database application test |
| `npm run test:local-workflow` | Strict fixture ownership, path and PowerShell safety contracts | Source-only safety results |
| `npm run test:quick` | Existing candidate-aware `verify:iterate` (default `--base origin/main`) | Exact selected iteration evidence |
| `npm run test:full` | Existing `verify:release:risk` and risk planner | Only completed required gates count |
| `npm run test:db:local` | Existing 42-file PostgreSQL integration suite | May **FAIL** on strict performance budgets |
| `npm run test:browser:local` | Existing authenticated Playwright browser gate | Uses disposable local PG fixture; do not reuse an unrelated port 3000 server |

To use an exact candidate:

```powershell
npm run test:quick -- --base origin/main
npm run test:full -- --base origin/main
```

Use the existing `DEVELOPMENT.md` for risk selection and authoritative release verification. `test:full` does not turn a failed PostgreSQL or browser test into PASS, skip any selected mandatory evidence, or authorize release. If the scope does not require PostgreSQL, quick/risk-based gates need not initialize Docker or native PG16.

## Strict local database ownership

The **only** accepted Logbook test DB identity is:
- Host `127.0.0.1`, port `55439`, database `flytally_logbook_test`, role `flytally_local`.
- Native Windows PG16: cluster under ignored `.flytally/persistent-local-pg16/data`, exact owner marker and physical data-directory/process checks.
- Docker fallback: isolated `flytally-logbook-local-pg16` container with persistent `flytally-logbook-local-pg16-data` volume, exact identity and one loopback binding.

A randomly generated password and URL are stored **only** in gitignored `.env.test.local` on each PC. Never copy them to GitHub or another PC. The wrapper refuses mismatched, pre-existing/unowned, redirected, Docker-remote, other-repository, Neon or production resources. It removes inherited `DATABASE_URL`/`PG*` routing variables from test subprocesses; for database-writing gates it injects the verified disposable fixture URL only after physical ownership and readiness checks. The actual `.env.local` is not overwritten. Do not manually set a special full-v20 restore opt-in to bypass generic acceptance.

**Database-writing tests may create and discard their own disposable schemas; never point them to a real pilot or production database.** Do not reset/reinitialize the owned PG16 to work around test failures.

## Browser testing and U3

`npm run test:browser:local` requires the physically verified test DB, built application and Playwright Chromium. The portable browser override forces one fresh local Playwright server on `127.0.0.1:3000`, disables retry for the local diagnostic and forbids reusing an unrelated process listening on that port. Existing CI behavior and all U3/browser acceptance assertions remain unchanged. A UI screenshot or source-safety PASS cannot replace executed desktop/mobile Playwright evidence. Stop and inspect logs on build, fixture or browser failure.

## Reboot and recovery

Database data persists on disk or in the named Docker volume. A Windows reboot stops the native PG process; `npm run setup:local` restarts **only the previously recognized owned** cluster and rechecks its identity. A Docker engine must be started locally before an owned Docker container can be restarted. Actual reboot on both PCs must be verified rather than inferred.

If a native first-run bootstrap was interrupted, the tool reports an incomplete cluster and refuses automatic reset. Read-only diagnosis: `node tooling/diagnose-incomplete-local-pg16.mjs`. `tooling/recover-incomplete-local-pg16.ps1` is read-only by default; its archival mode is a separate, explicit, owner-controlled operation. `tooling/finalize-incomplete-local-pg16.mjs` verifies physical identity before any guarded completion. **Do not delete the cluster directory, print credentials, kill unidentified processes or use the production DB for recovery.**

## Evidence and status

On 22 Oct 2026, the owner previously verified the scoped core sources on Windows: source-safety 26/26 PASS and physically owned native PG16 localhost preflight PASS on the original mixed-scope PR #383. The **cleanly reconstructed core branch itself has no executable Windows/Node24, browser, reboot or exact-HEAD release test evidence until rerun**. It includes the explicit double-opt-in guard for the independently isolated full-v20 historical restore test, which is NOT independently validated. Earlier 42-file full PG integration and isolated 50k/100k scale runs had fluctuating strict performance failures. These failures remain open separately; do not mark the canonical release gate PASS by omitting diagnostic instrumentation.

No merge, production deployment, production DB migration/restore, or production feature-flag change is authorized by this runbook. Record exact branch/SHA and tests in `docs/PROJECT_MEMORY/SESSION_HANDOFF.md` before closing a milestone.
