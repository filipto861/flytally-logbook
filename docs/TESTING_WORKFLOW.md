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
