# Local test workflow — two Windows PCs (Logbook)

**Scope:** filipto861/flytally-logbook only. Training owns its own test database and commands. This is a permanent operation runbook; canonical candidate risk verification remains in DEVELOPMENT.md and tooling/development-modules.json.

## Daily PowerShell workflow (home or office)

~~~powershell
git fetch origin
git status --short
# Switch to the intended work branch and fast-forward only when safe.
npm run setup:local
npm run doctor
npm run test:quick
~~~

Run the same commands on both computers. Git synchronizes the code and automation, while .env.test.local and its random password deliberately stay on each PC. Setup checks npm dependencies and Chromium first, keeping installed versions/browsers where complete. **The single setup command also runs `npm run test:local-workflow` before reporting completion.** It will never reinstall Node, Git or Docker. On Windows it first checks for a complete native PostgreSQL 16 server installation (`initdb.exe`, `pg_ctl.exe`, `createdb.exe`, `psql.exe`). When available, it creates a dedicated persistent PG16 cluster once and reuses it thereafter. Otherwise it can use its own Docker fixture, if a local Docker engine is running. With neither backend, non-DB tests still work.

Explicit first-time database setup:
~~~powershell
npm run setup:local -- --with-db
# Or once dependencies have been prepared:
npm run setup:db
npm run doctor
~~~

Provision prefers native Windows PostgreSQL 16 at `.flytally/persistent-local-pg16/data` (gitignored). If native tools are absent, it can create the dedicated Docker container `flytally-logbook-local-pg16` with a named persistent data volume `flytally-logbook-local-pg16-data` and `--restart unless-stopped`. Both bind only to **127.0.0.1:55439**, with database `flytally_logbook_test` and user `flytally_local`. A random password is generated only on initial setup, then saved in ignored `.env.test.local`; it is never printed or committed. Once configured, the existing owned backend is reused without data reset or credential rotation. Before any database-writing command, the wrapper verifies the actual backend. Native PG16 requires the exact owner marker, nonredirected data directory, PG_VERSION 16, verified connection to that precise data directory/user/database/127.0.0.1 port and PG16 runtime. Docker requires exact image, container name, user/database/password, sole loopback port mapping and live pg_isready. Unowned or mismatched fixtures, redirected data directories, remote Docker contexts and missing required server tools fail closed. An initialization failure leaves local files untouched for manual diagnosis. Other local PostgreSQL installations, Windows services and databases are not adopted or modified. For PostgreSQL integration, a working psql client is additionally required (from PATH, FLYTALLY_PSQL, or standard Windows PostgreSQL installation folders).

## Test commands

| Command | Contract | Database impact |
| --- | --- | --- |
| npm run doctor | Read-only prerequisite report, not DB connectivity proof | None |
| npm run setup:local | Incremental npm/Chromium setup; creates one dedicated fixture then reuses/restarts it across reboots | New owned localhost fixture on first run only |
| npm run test:quick | Delegates to existing verify:iterate using --base origin/main by default | Existing risk-policy preflight |
| npm run test:full | Runs the canonical risk planner first and then verify:release:risk; requires the owned PostgreSQL fixture **only if** DB, scale or browser evidence is selected | Only selected risk-based acceptance |
| npm run test:db:local | Full PostgreSQL integration acceptance | **Destructive**, dedicated disposable localhost DB only |
| npm run test:browser:local | Authenticated Playwright fixture acceptance | **Destructive**, dedicated disposable localhost DB only |
| npm run test:local-workflow | Test strict local URL/command contract | None |

To override candidate selection while preserving the original gate:
~~~powershell
npm run test:quick -- --base origin/main
npm run test:full -- --base origin/main
npm run test:full -- --all
~~~

Run git fetch origin before using origin/main; never fabricate an empty diff or infer PASS from a missing candidate. The authority is still the exact candidate, selected evidence, and executed canonical gates. Setup/doctor are not test evidence.

## Safety boundaries

- The facade masks inherited DATABASE_URL, PG* routing settings and Next.js .env.local database values with an explicit empty default, then strips unrelated provider/purpose flags and injects the disposable URL **only after verifying physical Docker fixture ownership and readiness**. Source-only/risk-exempt tests do not need Docker. Existing .env.local is **not** overwritten. The URL must have the exact PostgreSQL scheme, host 127.0.0.1, port 55439, user flytally_local, database flytally_logbook_test, nonempty password and no query string. Remote Neon, production, staging, localhost aliases, alternate databases and Docker hostnames are rejected.
- There are **no automated remote DB operations, production migrations, backups/restores/deletes, feature-flag changes, merge or deployment**. Existing browser fixture and PostgreSQL risk runner preflight remain authoritative.
- If you already have a differently named local PostgreSQL DB, the facade will not silently adopt it. Keep it and use existing manual commands, or provision this dedicated fixture once. The PostgreSQL cluster/volume persists across reboots, but authenticated browser acceptance **intentionally resets the disposable test schema** during test runs. Never store real pilot/flight information there.
- Browser requires its own local fixture and may reset it. The portable wrapper forces a fresh local Playwright web server (it must not reuse a process already listening on port 3000). Missing psql, a stale build, unexpected localhost port 3000 or Playwright failure must be investigated as separate blockers; source-contract tests are not browser acceptance.
- Docker/native cluster readiness is not inferred from doctor alone; a DB URL is insufficient authorization to run any database-writing test. Remote Docker SSH/TCP contexts are rejected: only local Unix/named-pipe daemon endpoints may provision test containers. Inconsistent container/config is a blocker; no automatic container deletion or credential recovery is attempted.
- Before merging, record TypeScript, Node, build, PG16, browser, CI and exact-head evidence according to DEVELOPMENT.md; NOT RUN and blocked gates remain explicit.

## Maintenance

When test scripts, DB identity, fixture prerequisites or port policy change, update this runbook and DEVELOPMENT.md in the same PR. Record the branch/SHA and evidence in docs/PROJECT_MEMORY/SESSION_HANDOFF.md. Never merge Logbook/Training state or test databases.

## Reboot and two-machine persistence

Windows stops the PostgreSQL process at shutdown; it **does not delete its data**. At the next development session, run `npm run setup:local`. The facade starts only the recognized owned native cluster with `pg_ctl`, or an owned Docker container, and verifies the saved database identity. Neither the cluster, database nor password needs to be created again. Each PC retains its own independent database. No Windows administrator rights or background service registration is required for the native profile.

Docker Desktop must itself run for Docker containers to auto-start at login; the new container uses `--restart unless-stopped`. Native PG16 is restarted on demand by the setup command. Do not delete `.flytally/persistent-local-pg16`, `.env.test.local` or the managed Docker volume if you want the environment to persist.

A standalone `psql` client is not enough for native setup. The Windows installation must also provide PG16 `initdb.exe`, `pg_ctl.exe` and `createdb.exe`. The installer may already have put them in `C:\Program Files\PostgreSQL\16\bin`; for a different install location, the optional machine-local `FLYTALLY_PG16_BIN` variable can point to the verified absolute PG16 bin directory. Otherwise use an installed local Docker engine. Never work around missing tools by pointing the test runner at another PostgreSQL/Neon database.

## First-run PG16 appears to hang / interrupted setup

If `npm run setup:local` stalls after `[Playwright] Existing Chromium retained.`, do not repeatedly run the database bootstrap. The older candidate buffered `initdb`/`pg_ctl` output without showing progress, potentially looking frozen while native PostgreSQL was initializing. This candidate now prints `[DB]` and `[PG16]` phase messages, streams native initialization/startup progress, places explicit bounds on native subprocesses (including 7 s binary probes, 90 s initdb and 40 s pg_ctl startup), and reports an incomplete first-run cluster instead of silently treating it as reusable.

If already stalled, press Ctrl+C once. The interrupted process may leave **valuable local fixture files** or a PG16 process. Inspect read-only in PowerShell:

~~~powershell
Get-Process initdb,pg_ctl,postgres -ErrorAction SilentlyContinue | Select-Object ProcessName,Id,StartTime
Test-Path .\.flytally\persistent-local-pg16
Test-Path .\.env.test.local
Get-ChildItem .\.flytally\persistent-local-pg16 -Force -ErrorAction SilentlyContinue | Select-Object Name,LastWriteTime
~~~

Do not print `bootstrap-pwfile` or `.env.test.local` because they may contain passwords. Do **not** delete the cluster directory, kill an unidentified process, or retry with a different PostgreSQL database until the actual process/files are reviewed. Without `owner.json`, a partly initialized local directory is explicitly **INCOMPLETE / MANUAL INSPECTION REQUIRED**; no automatic reinitialization or adoption occurs. Non-database test commands can still be used separately, but their results cannot supply missing PostgreSQL/browser acceptance. The status of the owner PC and incomplete cluster is UNKNOWN until observed.


## One-time recovery: verified incomplete native PG16 cluster (22 Oct 2026)

**Windows parser safeguard (22 Oct, follow-up):** a later commit erroneously contained a duplicated block after the final `} finally { Pop-Location }`, so the owner observed a PowerShell `ParserError` before execution. The file has been trimmed to exactly one complete script. Before any recovery operation, run the PowerShell parser itself in read-only mode (see below). The npm safety-contract test now checks script uniqueness and invokes the Windows PowerShell parser when running on Windows. No archival or database shutdown occurred on that failed invocation.

~~~powershell
$scriptPath = (Resolve-Path .\tooling\recover-incomplete-local-pg16.ps1).Path
$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($scriptPath,[ref]$tokens,[ref]$parseErrors) | Out-Null
if ($parseErrors.Count) { $parseErrors | Select-Object Message; throw 'PowerShell syntax failed' }
'SYNTAX PASS'
~~~

**First owner dry-run correction:** the initial read-only preflight rejected the genuine output `pg_ctl (PostgreSQL) 16.15` because its version regex expected the wrong banner syntax. A fully anchored expression now accepts only the correct `pg_ctl (PostgreSQL) 16.x` form, and version-15/17 or unrelated tool banners still fail closed. Pull the latest PR branch before rerunning the read-only preflight. The failed invocation made no database changes.


An owner Windows log established that the newly created test-only PostgreSQL 16.15 process was accepting connections from its intended Logbook data directory on 127.0.0.1:55439 (observed PID 53356), while .env.test.local and owner.json were absent. The old native startup spawned PostgreSQL but did not finish recording bootstrap credentials. The old Node sync child output-pipe behavior is consistent with the observed stall; other causes have not been definitively excluded. Recovery must NOT act on any other PostgreSQL process.

On the current PR branch use the built-in PowerShell recovery guard:

~~~powershell
git pull --ff-only
powershell -NoProfile -ExecutionPolicy Bypass -File .\tooling\recover-incomplete-local-pg16.ps1
~~~

The default is READ-ONLY and independently checks incomplete ownership state, PG_VERSION, exact data directory, postmaster.pid, live PID, listening loopback address and port. If it prints READ-ONLY audit complete, explicitly opt in to archive only that verified incomplete cluster:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tooling\recover-incomplete-local-pg16.ps1 -ArchiveIncompleteOwnedCluster
npm run setup:local
~~~

The opt-in operation uses PostgreSQL pg_ctl fast shutdown of only the verified owned data directory, proves the previous listener has exited, then MOVES the entire incomplete .flytally/persistent-local-pg16 directory to a uniquely named sibling archive persistent-local-pg16-interrupted-*. It does not delete data, edit existing Windows PostgreSQL services or manipulate production/Neon. The subsequent setup is a genuinely new initialization with newly saved localhost-only credentials. If any preflight fails, STOP and inspect the condition; do not manually remove the data directory or terminate arbitrary postgres processes. The archive remains available for investigation and must not be automatically deleted.

The new native initialization displays actual initdb and pg_ctl output and includes bounded subprocess execution. Confirm setup:local and test:quick on the exact new work branch before claiming success. This recovery is a one-time developer-fixture action, not a production database restore or a release acceptance gate.

## 22 Oct Windows PG16 Unicode identity bootstrap failure (owner verified)

The owner ran `-ArchiveIncompleteOwnedCluster` against the exact scoped PG16 test fixture and observed `ARCHIVED (not deleted)`, followed by a fresh `npm run setup:local`. Windows native PG16 tools and `initdb` **PASS**, `pg_ctl` startup **PASS**, `createdb` **PASS**, but `observedIdentity` **FAILED** at physical identity validation. The new cluster has no finalized `owner.json` or `.env.test.local`; no DB test was executed. **Do not rerun setup against it or manually delete the files.** The old archive is preserved.

Likely root cause: the working directory contains Czech-accented characters. On Windows a `psql` native child process may output path bytes in a legacy code page while Node decodes `spawnSync` output as UTF-8; a correct `data_directory` therefore fails comparison. The updated identity query now sends the PostgreSQL data directory as ASCII hex-encoded UTF-8 bytes (`encode(convert_to(...,'UTF8'),'hex')`); the Node check decodes the exact path before canonical comparison. `PGCLIENTENCODING=UTF8` is also explicitly set. A future failed comparison reports **which identity field** disagrees, without exposing a password, full path or database contents. This hypothesis is source-backed but not yet Windows runtime-proven.

The updated first-run bootstrap preserves the generated `bootstrap-pwfile` inside the gitignored fixture directory **until both marker and .env.test.local have been written**; on failure it stays for owner-reviewed recovery (never auto-adopt a partial cluster), and on success it is deleted. It is a secret: never display, commit, upload or share that file. The already-failed owner first run used the older code that removed its pwfile, so that instance still requires one more guarded archival recovery as documented above, followed by fresh `npm run setup:local`. Do not skip the explicit read-only preflight or archive any cluster that no longer matches its exact PID/path/port.

Before another archive/setup, pull current PR branch and run `npm run test:local-workflow` to check source contracts and the Windows PowerShell parser. After the guarded archive, run setup and stop if any new `[BLOCKED]` diagnostic appears; do not repeatedly reinitialize. PostgreSQL acceptance, browser and build claims require separate exact-SHA evidence.


## 22 Oct retained-credential read-only diagnostic (current blocker)
**Owner diagnostic follow-up:** At cb0a1f76 Windows safety tests passed 18/19; the single FAIL was a static regex incorrectly rejecting a harmless status text about an unchanged password file, not an actual secret leak. The read-only diagnostic authenticated and ran `SELECT 1` and core identity SELECT, but core identity validation rejected the returned fields. The candidate now labels only failing fields: `field-count`, `database`, `database-user`, `server-address`, `server-port` or `server-version`; it does not print raw SQL output. The status text was adjusted and the test's original secret-output guard retained. Pull then rerun local safety tests and the SELECT-only diagnostic; preserve the current retained-credential fixture until exact cause is known.



After the third native setup attempt the owner reported initdb PASS, pg_ctl startup PASS, and createdb PASS, but a PostgreSQL physical identity query failed rather than a field-specific identity mismatch. The prior PGCLIENTENCODING=UTF8 and SQL convert_to changes are hypotheses until we inspect the SQL failure. The current attempt used the revised bootstrap that retains the private password file at .flytally/persistent-local-pg16/bootstrap-pwfile until both owner marker and .env.test.local exist; so **do not archive, delete, print secrets or rerun setup**.

On the updated Logbook work branch, the following commands only inspect local fixture files and execute SELECT via the exact loopback PostgreSQL instance:

~~~powershell
git pull --ff-only
npm run test:local-workflow
node .\tooling\diagnose-incomplete-local-pg16.mjs
~~~

The diagnostic refuses completed fixtures, checks exact PG16 version, real data-directory path, postmaster.pid, port, running state and retained credential, and sanitizes its results. It emits only query step PASS/FAIL, exit codes, SQLSTATE when extractable, field-name mismatches and no raw paths/passwords/stderr. If it fails, stop; do not run the existing archival recovery on this recoverable cluster. If it passes, use the diagnosis to design and separately verify a guarded one-time resume/finalize that reuses this exact test database; do not silently create owner.json or .env.test.local from a URL alone.

The earlier archived directories remain intact. Product schema, remote Neon, Training, merge and deployment remain out of scope. Current diagnostic test/runtime result and completed setup remain NOT RUN until the owner runs the new command.


## 22 Oct server-address mismatch: PostgreSQL inet::text includes /32

**Owner local in-place finalization confirmed (22 Oct 2026):** Tested branch head `381cc1fd0d8a4f414985a6202189f16b060f862c` on owner Windows: `test:local-workflow` 22/22 PASS; read-only SELECT 1, core identity, binary postmaster.pid read and full physical identity **PASS**; `node .\tooling\finalize-incomplete-local-pg16.mjs` **FINALIZED**, reporting persistent local fixture config saved. This was an explicit single completion of an existing test-only PG16 cluster, not a new initdb or restoration. Do not rerun finalizer on the now marked fixture. Verify reuse and application tests next:
~~~powershell
npm run setup:local
npm run test:quick
~~~
If these pass, run relevant DB/browser gates separately and test reboot/restart reuse later; no evidence for those yet. Never share credentials or archived fixture files.


**Owner SQLSTATE 22021 finding (22 Oct):** At commit 23be4b1f, native Windows source safety tests PASS (22/22), and the read-only localhost `SELECT 1` + core identity PASS. However, the path conversion query (`convert_to(current_setting('data_directory'),'UTF8')`) fails with SQLSTATE 22021, indicating invalid/unrepresentable text bytes. The guarded `finalize-incomplete-local-pg16.mjs` correctly BLOCKED without writing marker or environment configuration. This is NOT a reason to change server encoding, weaken the identity guard or rebuild the database.

PostgreSQL 16 documents `pg_read_binary_file()` returning arbitrary bytes without encoding checks (https://www.postgresql.org/docs/16/functions-admin.html). Updated native identity and diagnostic verify the *physical* PostgreSQL process by reading the server-side binary `postmaster.pid` (ASCII hex output) and comparing it byte-for-byte to the PID file under the exact, nonredirected Logbook-only PGDATA. The field `postmaster-identity` fails if bytes differ. Other guards remain: exact database/user, host 127.0.0.1, port 55439, PG16 server version, credentials and server state. SQL queries remain read-only.

**Next owner validation without reinitialization:**

~~~powershell
git pull --ff-only
npm run test:local-workflow
node .\tooling\diagnose-incomplete-local-pg16.mjs
~~~

Only if tests PASS and diagnostic outputs `Physical identity: PASS` + `READ-ONLY COMPLETE`, then run the already guarded in-place finalizer:

~~~powershell
node .\tooling\finalize-incomplete-local-pg16.mjs
npm run setup:local
npm run test:quick
~~~

Stop at any `BLOCKED` or `FAIL`. Do not archive, restart, reset or expose the local bootstrap-pwfile. The status of the updated Windows diagnostic and finalization remains NOT RUN until owner proof.



Owner Windows at work HEAD e7b4ac9a: 20/20 local safety tests PASS, read-only authenticated SELECT 1 and core SQL SELECT PASS, but core identity rejected exactly the server-address field. PostgreSQL documents that explicit inet::text produces an unabbreviated IP with netmask (127.0.0.1/32), whereas host(inet) gives the bare address (127.0.0.1). This was a format mismatch, not evidence the server had moved to a different address. We still compare to exactly 127.0.0.1; we do not whitelist other hosts or strip arbitrary prefixes. The native identity query and both read-only diagnostic queries now use host(inet_server_addr()). Source: https://www.postgresql.org/docs/current/functions-net.html

**Complete the currently running local cluster without resetting it** after pulling this PR branch:

~~~powershell
git pull --ff-only
npm run test:local-workflow
node .\tooling\diagnose-incomplete-local-pg16.mjs
~~~

Only when local safety tests pass AND the diagnostic shows Physical identity: PASS and READ-ONLY COMPLETE, run the explicit one-time local fixture completion:

~~~powershell
node .\tooling\finalize-incomplete-local-pg16.mjs
npm run setup:local
npm run test:quick
~~~

The finalize command requires an incomplete Logbook-only native cluster with exact expected data directory (no redirections), PG_VERSION16, running pg_ctl, absence of owner.json and .env.test.local, and the retained random password in gitignored bootstrap-pwfile. It uses the credential to authenticate, proves the strict PostgreSQL physical database identity, and only then writes the exact ownership marker and .env.test.local with exclusive creation. The intermediate password file is removed only after those two files are successfully saved. It does not start/restart PostgreSQL, initialize clusters, create or drop databases/tables, import remote data, or access production/Training. If any check fails, STOP; do not archive or reinitialize, and do not share the password file or local env. Existing test-only archives stay untouched. No completed acceptance claims until exact-head owner Windows output.
