# DATA-1E3 D4 — owner-local Windows PostgreSQL16 single-cluster runbook

**Status: EXECUTOR PREPARED, OWNER-LOCAL EXECUTION NOT RUN.** Operator authorized precisely one new locally owned disposable PG16 cluster with synthetic D4 tests and verified disposal. No production/Neon/Training DB access; no merge/deploy/flags.

## Contract and test meaning

The runner is tooling/data1e3-d4-owned-local-pg16.mjs on Draft PR #446. Node24 Windows only. It requires a clean checkout at a frozen 40-digit SHA matching the fetched origin topic branch, no inherited database/CI/Neon/Vercel environment, and existing native PostgreSQL16 binaries in Program Files/PostgreSQL/16/bin. No caller-supplied DATABASE_URL is accepted.

Probe only verifies local prerequisites and creates no database. Execute requires --allow-synthetic-writes and --confirm=DATA1E3-LOCAL-ONLY. Execute creates a single random OS-temp cluster and synthetic database/role, starts only on ephemeral 127.0.0.1, verifies SQL connection against the exact data_directory, database, role, PostgreSQL version, port, postmaster.pid and Windows postgres process executable and command line. It first runs existing source-backed tests/integration/postgres-security-restore.test.ts in synthetic private schemas.

It next executes tooling/data1e3-d4-source-sql-risk-probe.mjs, which performs a deterministic preflight-to-SQL collision scenario on the exact source SQL fragments from lib/account-restore-v6.ts. It uses only synthetic flight/FSTD/audit rows and isolated tables. If pre-existing protected data are overwritten or independent audit history removed, it reports **D4 SAFETY FAIL** (expected outcome for unfixed suspected F3/F9). This is NOT real two-session concurrency or authenticated application v13 restore. An expected source vulnerability reproduction must never be presented as passed security acceptance.

The runner stops its owned server after tests and deletes only a token-confirmed newly created unique OS-temp directory when stop is independently verified. If process shutdown or deletion identity is uncertain, fail closed and retain the directory instead of force-deleting. No existing cluster, Windows service, Neon project or user account is changed.

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
