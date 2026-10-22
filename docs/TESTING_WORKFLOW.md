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

Run the same commands on both computers. Git synchronizes the code and automation, while .env.test.local and its random password deliberately stay on each PC. Setup checks npm dependencies and Chromium first, keeping installed versions/browsers where complete. It will never reinstall Node, Git or Docker. It can create an isolated database when a Docker engine exists; absent Docker leaves normal non-DB development available.

Explicit first-time database setup:
~~~powershell
npm run setup:local -- --with-db
# Or once dependencies have been prepared:
npm run setup:db
npm run doctor
~~~

This provisions a Docker PostgreSQL 16 container named flytally-logbook-local-pg16, bound **only to 127.0.0.1:55439**, database flytally_logbook_test, user flytally_local. The password is randomly generated and written to ignored .env.test.local; it is never printed or committed. Existing dedicated containers or credentials are reused without resetting data. An unexpected container, missing config for an existing container, mismatched URL or unavailable Docker engine fails closed. Existing system PostgreSQL installations and databases are not modified. For PostgreSQL integration, a working psql client is additionally required (from PATH, FLYTALLY_PSQL, or standard Windows PostgreSQL installation folders).

## Test commands

| Command | Contract | Database impact |
| --- | --- | --- |
| npm run doctor | Read-only prerequisite report, not DB connectivity proof | None |
| npm run setup:local | Incremental npm/Playwright setup and optional local fixture provision | New local disposable DB only |
| npm run test:quick | Delegates to existing verify:iterate using --base origin/main by default | Existing risk-policy preflight |
| npm run test:full | Delegates to canonical verify:release:risk using --base origin/main by default | Only selected risk-based acceptance |
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

- The facade strips inherited DATABASE_URL and provider/purpose flags and only injects the explicitly validated dedicated local URL into test commands where required. Existing .env.local is **not** overwritten. The URL must have the exact PostgreSQL scheme, host 127.0.0.1, port 55439, user flytally_local, database flytally_logbook_test, nonempty password and no query string. Remote Neon, production, staging, localhost aliases, alternate databases and Docker hostnames are rejected.
- There are **no automated remote DB operations, production migrations, backups/restores/deletes, feature-flag changes, merge or deployment**. Existing browser fixture and PostgreSQL risk runner preflight remain authoritative.
- If you already have a differently named local PostgreSQL DB, the facade will not silently adopt it. Keep it and use the legacy manual commands, or explicitly provision this dedicated fixture once. Never put real pilot/flight information in the disposable fixture.
- Browser requires its own local fixture and may reset it. Missing psql, a stale build, unexpected localhost port 3000 or Playwright failure must be investigated as separate blockers; source-contract tests are not browser acceptance.
- Docker/container readiness is not inferred from doctor alone. Inconsistent container/config is a blocker; no automatic container deletion or credential recovery is attempted.
- Before merging, record TypeScript, Node, build, PG16, browser, CI and exact-head evidence according to DEVELOPMENT.md; NOT RUN and blocked gates remain explicit.

## Maintenance

When test scripts, DB identity, fixture prerequisites or port policy change, update this runbook and DEVELOPMENT.md in the same PR. Record the branch/SHA and evidence in docs/PROJECT_MEMORY/SESSION_HANDOFF.md. Never merge Logbook/Training state or test databases.
