# DATA-1E3 D4 — owner-local Windows PostgreSQL16 single-cluster runbook

**Status: EXECUTOR PREPARED, OWNER-LOCAL EXECUTION NOT RUN.** Operator authorized precisely one new locally owned disposable PG16 cluster with synthetic D4 tests and verified disposal. No production/Neon/Training DB access; no merge/deploy/flags.

## Contract and test meaning

The runner is tooling/data1e3-d4-owned-local-pg16.mjs on Draft PR #446. Node24 Windows only. It requires a clean checkout at a frozen 40-digit SHA matching the fetched origin topic branch, no inherited database/CI/Neon/Vercel environment, and existing native PostgreSQL16 binaries in Program Files/PostgreSQL/16/bin. No caller-supplied DATABASE_URL is accepted.

Probe only verifies local prerequisites and creates no database. Execute requires --allow-synthetic-writes and --confirm=DATA1E3-LOCAL-ONLY. Execute creates a single random OS-temp cluster and synthetic database/role, starts only on ephemeral 127.0.0.1, verifies SQL connection against the exact data_directory, database, role, PostgreSQL version, port, postmaster.pid and Windows postgres process executable and command line. It first runs existing source-backed tests/integration/postgres-security-restore.test.ts in synthetic private schemas.

It next executes tooling/data1e3-d4-source-sql-risk-probe.mjs, which performs a deterministic preflight-to-SQL collision scenario on the exact source SQL fragments from lib/account-restore-v6.ts. It uses only synthetic flight/FSTD/audit rows and isolated tables. If pre-existing protected data are overwritten or independent audit history removed, it reports **D4 SAFETY FAIL** (expected outcome for unfixed suspected F3/F9). This is NOT real two-session concurrency or authenticated application v13 restore. An expected source vulnerability reproduction must never be presented as passed security acceptance.

The runner stops its owned server after tests and deletes only a token-confirmed newly created unique OS-temp directory when stop is independently verified. If process shutdown or deletion identity is uncertain, fail closed and retain the directory instead of force-deleting. No existing cluster, Windows service, Neon project or user account is changed.

## 2026-10-30 owner first run: pg_ctl inherited-pipe timeout and corrected runner

The first owner Windows Node24.19.0 checkout `c9a0ffb97c559e4b7e1139217f4cd110a46e0a51` passed `--probe` but stopped in `pg_ctl.exe start` with `exit=0 error=ETIMEDOUT` before isolated SQL identity/restore tests. The runner reported token-owned local cluster disposal PASS and final exit code 1; **baselineStatus and securityStatus both NOT RUN**. [Full incident + source fix + Windows no-DB evidence](2026-10-30-data1e3-d4-first-windows-timeout-and-pipe-fix.md).

Revised runner starts and stops PostgreSQL with `stdio:"ignore"` to avoid inherited stdout pipe hangs, and refuses unsafe removal if stop status is not independently checked. [GitHub Actions #41047852446](https://github.com/filipto861/flytally-logbook/actions/runs/41047852446) on Windows Node24.22.1 **2/2 PASS** reproduced the exact `exit 0 + ETIMEDOUT` simulated mechanism and confirmed the corrected pipe handling. **This did not run PostgreSQL or owner-local DB tests**.

Owner may reuse the existing clean checkout at `$HOME\flytally-data1e3-d4-local`; do not clone again. Update with `git fetch origin` and `git merge --ff-only origin/test/logbook-data1e3-d4-one-local-pg16-20261030`, then verify the **new exact 40-character HEAD** and clean worktree. Prior SHA is obsolete. The owner must consciously invoke execute again because it creates **a new, separate one-time local cluster**; never silently retry on failing preflight. See the actual final SHA supplied after checkpoint commits; do not guess from this dated paragraph.

## Second owner attempt — PostgreSQL inet /32 identity output (2026-10-30)

Owner fast-forwarded to `7a2ffaaec4d9c3812d3a0c74071d714aa034895d`, Probe PASS, and Execute successfully progressed beyond the old `pg_ctl` inherited-pipe problem. It stopped before tests at strict SQL identity comparison: PostgreSQL `inet_server_addr()::text` emitted `127.0.0.1/32` rather than expected `127.0.0.1`. Reported baseline and security test `NOT RUN`; owned cleanup `PASS`. [Full evidence](2026-10-30-data1e3-d4-second-windows-inet-preflight-and-fixture-fix.md).

The launcher and its child risk probe now use `host(inet_server_addr())`, which yields the unmasked IPv4 address; both still demand **exact `127.0.0.1`**, matching database, role, data directory and PostgreSQL16 identity. Synthetic timestamp fields were also corrected from invalid `""` to `null` before attempting source SQL. **No application or security rule was loosened.** [Windows Node24 GitHub Actions #41048944489](https://github.com/filipto861/flytally-logbook/actions/runs/41048944489) 3/3 source-contract PASS at `ca8dd9486f6405234e54581a59df093d2c1a4ff9`, actual DB test still NOT RUN.

Reuse the existing clean clone and follow the fast-forward workflow from the first incident note. The previously used SHA `7a2ffaaec4d9c3812d3a0c74071d714aa034895d` is **obsolete**; substitute the newly verified final 40-character PR #446 HEAD. Each Execute creates one new disposable test cluster and is an explicit owner action, never an automatic retry.

## Third owner-local attempt — Windows process CommandLine path formatting (2026-10-30)

Owner updated to `a0923434cdd8af0181864bd942eb3a55cac48ac0` and Probe passed. Execute progressed through prior pg_ctl timeout and PostgreSQL /32 issues, then **failed the strict `Win32_Process.CommandLine` path check**: `PostgreSQL command line does not point at newly-owned data dir`. The user-local script reported stop and owned directory deletion PASS, but full identity and both SQL test phases remained **NOT RUN**, final exit 1. [Incident and source-backed uncertainty](2026-10-30-data1e3-d4-third-windows-process-cli-path-fix.md).

The test helper now normalizes forward/backward separators, case and Unicode in Windows process command lines and requires a **whole expected data directory, not a prefix or partial match**. Windows hosted Node24 [Actions #41050835559](https://github.com/filipto861/flytally-logbook/actions/runs/41050835559) **9/9 PASS** against synthetic slash/Unicode/trap fixtures; no PostgreSQL executed. The original PID, executable, database, port, server data directory and owned-cleanup checks remain intact. The actual format in the owner's `Win32_Process.CommandLine` was **not observed**, so runtime correction is still **NOT RUN**.

If the strict path proof fails again, the runner prints sanitized `D4_PG_CMDLINE_FORMAT_DIAGNOSTIC` booleans only; send those flags, **not** the raw process command line or full Windows paths. A retry is permitted only after operator checks a new exact 40-character SHA. The prior `a0923434...` SHA is obsolete.

## Owner Windows PowerShell: run against verified full PR #446 HEAD

Node.js v24 and native PostgreSQL16 must already be installed. Use a new clone, never an existing data directory. Replace the SHA placeholder only with the full verified PR #446 HEAD supplied with this release of the runbook.

~~~powershell
$ErrorActionPreference = 'Stop'
if ((node --version) -notmatch '^v24\.') { throw 'Node24 required' }
Set-Location $HOME
git clone --branch test/logbook-data1e3-d4-one-local-pg16-20261030 --single-branch https://github.com/filipto861/flytally-logbook.git flytally-data1e3-d4-local
if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
Set-Location .\flytally-data1e3-d4-local
$ExpectedSha = 'REPLACE-WITH-EXACT-FULL-PR446-SHA'
if ((git rev-parse HEAD).Trim() -ne $ExpectedSha) { throw 'Git SHA mismatch, STOP' }
if ((git status --porcelain).Length -ne 0) { throw 'Dirty checkout, STOP' }
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

node .\tooling\data1e3-d4-owned-local-pg16.mjs --probe "--expected-sha=$ExpectedSha"
if ($LASTEXITCODE -ne 0) { throw 'Probe failed, STOP' }

node .\tooling\data1e3-d4-owned-local-pg16.mjs --execute "--expected-sha=$ExpectedSha" --allow-synthetic-writes --confirm=DATA1E3-LOCAL-ONLY
$D4ExitCode = $LASTEXITCODE
Write-Host "DATA1E3 D4 exit code: $D4ExitCode"
~~~

Do not override failed preflight or use remote/tunneled/local pre-existing DB for convenience. Do not manually delete a retained process directory until its exact PID and ownership are independently verified.

## Outcome interpretation

| Phase | Meaning |
| --- | --- |
| D4_LOCAL_PG16_PROBE PASS | No database created. Local prerequisite check only. |
| D4_ISOLATED_LOCAL_PG16_PREFLIGHT PASS | New local cluster matched physical process, SQL identity and disk path. |
| D4_BASELINE_SOURCE_SQL_RESTORE PASS | Existing isolated synthetic SQL restore regression passed, not full signed-v13 HTTP. |
| D4_SOURCE_SQL_INTERLEAVING FAIL | Frozen-source F3/F9 hazard was reproduced; D4 security remains BLOCKED pending source hardening and true two-session tests. Exit 1 can correctly signal this failure. |
| D4_LOCAL_PG16_DISPOSAL PASS | Only the newly owned temp cluster was shut down and deleted. |
| Missing/mismatched identity, tool or cleanup proof | NOT RUN / FAIL; do not relabel as PASS or fall back to protected databases. |

**Never paste private flights, GPS, passwords or database URLs.** Send only sanitized phase JSON, test counts, exact SHA and exit code. D2 archive caps, complete authenticated signed-v13 GET/restore, two-session concurrency, full Node/build/browser/risk release remain pending. DATA-1 is not release-ready.

**ONE NEXT STEP:** run the SHA-pinned Probe, then Execute locally; return sanitized phase statuses and exit code so the D4 code change can be decided from actual evidence.
