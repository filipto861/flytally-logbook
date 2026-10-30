# DATA-1D — credential-local Neon HTTP stored gzip/Base64 test gate (2026-10-30)

**Status: implemented as standalone test tooling on a stacked Draft; real Neon HTTP database execution NOT RUN.** Do not treat a test harness or offline PASS as storage transport proof.

## Contract / source

- The source for this tool is tooling/data1-neon-http-store-gate.mjs, with isolated tool tests at tooling/data1-neon-http-store-gate.test.mjs.
- Exact parent Draft #442 HEAD bb60178bebdbb7b0242474bc7b0fedfd99268567; canonical main at discovery 807f281e5870164b794d001480ecc84e0b45aea5; #441 and upstream DATA-1 drafts unmerged.
- Existing lib/backup-center.ts uses gzipSync(level:9), 50 MiB compressed guard, SQL-parameterized Base64 payload insert, and Base64 decode + gunzipSync + parsed SHA-256 readback. This test reproduces transport **shape** only, not real signed v13, authenticated GET, or full restore.

## Security / execution model

The earlier Neon→Vercel cross-tool credential transfer was blocked. Do not circumvent it. Instead the connection string must originate and stay **inside the owner-controlled executor** (e.g. user's secured local Node24 session), with Neon project creation/deletion separately managed and confirmed.

- The script does **not** retrieve a connection string from a connector, create a Neon project, access real flight/GPS data, deploy, restore, drop tables or delete databases. Its only schema write is a dedicated synthetic table after a two-stage gate.
- Operator first obtains a **fresh standalone empty** Neon PostgreSQL16 project, never an existing Shadow or Training project; verifies its exact project ID and branch ID in the Neon dashboard, plus its dedicated database/role. Only this specific new resource can be used; an existing project must not be relabeled as disposable.
- The program requires explicit DATA1_SYNTHETIC_ONLY=1, named project and branch identifiers, dedicated synthetic_data1 / synthetic_data1_owner names, Neon hostname, Node24, locked driver @neondatabase/serverless 1.1.0, no inherited CI/Vercel/alternative DB environment. Known non-test IDs are hard-blocked. Project and branch IDs are supplied by the operator; **SQL alone cannot independently attest project identity**, so the operator's Neon-console preflight remains mandatory.
- --probe performs SQL SELECT only: PG16 version, role, database, 0 public user tables, server boot time; emits an identity-bound 20-hex confirmation token (no secret). --execute requires that token, DATA1_ALLOW_TEST_WRITES=YES_DISPOSABLE_ONLY, fresh repeated preflight (still empty), and then one CREATE TABLE.
- For each **approximately** 1, 4 and 12 MiB gzip size: generate random synthetic JSON (deliberately not a valid signed v13 backup), gzip level 9, Base64, parameterized INSERT, **separate** SELECT returning full encoded field, byte-for-byte Base64 and gzip comparisons, SHA-256 raw JSON equality and row size assertions. Each call measures actual driver HTTP request and response body bytes using fetchFunction, HTTP status, elapsed milliseconds and process RSS.
- Log only safe aggregate counters, status and truncated error class; never print SQL parameters, credentials, raw payload, GPS, names or user data. Stop on first failure. HTTP vendor **maximum unknown**, even if all three sizes succeed. 50 MiB cap is offline math only; no 50 MiB automatic cloud upload.
- **Mandatory cleanup is external, with explicit owner approval:** shut down any ephemeral compute, delete ONLY the newly created positively identified project ID, re-list original projects and verify the test ID absent. Preserve failure history. An executor script's successful completion does not prove cleanup.

## Owner-side commands (PowerShell with Node 24)

The example intentionally omits entering a DATABASE_URL; use the owner's secure local environment / secret handling, **not shell command history, chat or GitHub**. Never use a connection string copied from an existing Logbook Shadow or Training project.

1. Ensure the new project was independently created, its role, database, hostname and branch verified, and that its SQL public schema is empty.
2. On a clean checkout at an exact Draft SHA run npm ci (normal project lockfile). Do not run npm install with arbitrary changed dependencies.
3. Configure these values in the **same local process environment**: DATA1_SYNTHETIC_ONLY=1, DATA1_EXPECTED_PROJECT_ID=<new project ID>, DATA1_EXPECTED_BRANCH_ID=<new branch ID>, DATA1_EXPECTED_DATABASE=synthetic_data1, DATA1_EXPECTED_ROLE=synthetic_data1_owner. Supply DATABASE_URL *locally only*. Leave DATA1_ALLOW_TEST_WRITES unset for probe.
4. Execute:
   - node tooling/data1-neon-http-store-gate.mjs --synthetic-only --probe
   - Independently reconcile the returned project ID/branch, database and role with the Neon dashboard. The former two are operator assertions, not verified by SQL.
   - Set DATA1_ALLOW_TEST_WRITES=YES_DISPOSABLE_ONLY in that same ephemeral environment.
   - node tooling/data1-neon-http-store-gate.mjs --synthetic-only --execute --confirm=<20-hex-token-from-probe>
5. Record only sanitized numeric outcomes and exit code for each test. Clear sensitive environment data and externally delete/verify the disposable project by **exact ID**. Stop and investigate upon any identity mismatch, unknown table, HTTP failure, memory pressure or absent cleanup proof.

The tool is not an authorization to provision or delete a resource. A new disposable Neon project is not currently approved in this new slice; obtain explicit approval for each resource where policy requires it.

## Actual verification at initial code SHA b57b63a49615fc6eafad45d9c38818b8f704aa32

- Fresh isolated Vercel **Node v24.22.1** sandbox cloned the exact public Git SHA, confirmed git rev-parse HEAD equals b57b63a49615fc6eafad45d9c38818b8f704aa32.
- node --check tooling/data1-neon-http-store-gate.mjs **PASS**.
- node --test tooling/data1-neon-http-store-gate.test.mjs **PASS 5/5, FAIL 0, SKIP 0, exit 0** (CLI opt-in / invalid variants, strict Neon target denylist, bounded Base64+gzip and corruption rejection, probe token binding, Base64 maximum arithmetic).
- Repo package-lock resolves @neondatabase/serverless **1.1.0**; isolated sandbox npm ci --omit=dev --ignore-scripts returned exit 0. Driver runtime API inspection: neon(...).query === function, neonConfig.fetchFunction initially undefined and injectable. **NO database request was made**.
- Negative direct CLI run without DATABASE_URL refused with exit 1 and sanitized log, without attempting a database connection.
- No actual HTTP INSERT/SELECT, full v13 signed backup, browser GET, complete typecheck/build/full suite/PG or verify:release:risk was executed for this test-tooling Draft.
- No Neon project was provisioned in this slice; production DB/schema/flags unknown. No merge, deployment or Training change.

**ONE NEXT STEP:** owner selects a secure local Node24 executor and obtains separate approval/provisions one fresh, independently empty disposable Neon project; run the two-stage gate and record measured HTTP wire payloads plus independently verified exact-ID cleanup before release consideration.
