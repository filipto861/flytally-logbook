# DATA-1D — stored gzip/Base64 HTTP acceptance protocol (2026-10-30)

**Status: PLAN ONLY / HTTP stored INSERT+SELECT NOT RUN.** No application, schema, migration, test assertions, or production changes are authorized by this document.

## Exact source and observed baseline

- Canonical Logbook main at discovery: `807f281e5870164b794d001480ecc84e0b45aea5`. Unmerged Draft #441 head `da5f903566c51be7fb548f7a5362e40205772a09`; this plan branches from it. Stack #440 → #439 → #438 → #437 → #436 → #435 → #434; #433 design and #432 SEC-1 remain separate.
- Verified `lib/backup-center.ts`: `createStoredBackup` gzip(level 9) compresses pretty signed portable JSON; refuses `compressed.byteLength > 50 * 1024 * 1024` (**52,428,800 bytes**) before SQL. It sends `compressed.toString("base64")` via the parameterized `account_backups.payload_base64` INSERT. `loadStoredBackup` selects by `id,user_id`, decodes/unzips, parses v13 and compares digest. Neither the application gzip cap nor a successful SQL echo establishes Neon HTTP provider's maximum.
- Source `lib/db.ts` uses `@neondatabase/serverless` Neon HTTP client; actual installed version and Node runtime must be checked at execution from locked repo `package-lock.json` and environment, not inferred.
- The backup GET route `app/api/backups/[id]/route.ts` requires an authenticated session and returns uncompressed JSON, a **separate HTTP/browser transfer** from Neon driver SQL HTTP.
- Earlier verified synthetic `SELECT $1::text` **echo** at 1/4/12 MiB and repeatable-read 32-array snapshot did not persist anything; previous 32 PostgreSQL skips ran separately and passed at GitHub run #41017214910. No stored gzip/Base64 upload/download evidence exists.
- Read-only Neon `list_projects` at preparation found only **Logbook Shadow, FlyTally Training Production and FlyTally Training Acceptance**. None is authorized as an empty disposable DATA-1 write target.

## Before any cloud write — mandatory environment preflight

1. Obtain an **explicit owner decision** authorizing creation **and later deletion by exact ID** of a new, independently empty, Logbook-only synthetic Neon project. The current request to continue a project does not approve deletion of an existing resource; avoid any clone of real branches/production data.
2. Verify original Neon project list and exact IDs before creation; create with no parent data, separate database/role, and verify via project ID, branch identity, PG version, connection host, database, ownership, and zero user tables. Store credentials in ephemeral execution environment only. **Unknown or ambiguous = STOP.**
3. Use dedicated nonpersistent Node24 sandbox, pinned Neon HTTP driver, restricted network, a bounded explicit synthetic-only script. Never paste credentials, real backup files, raw GPS/flight/user data into logs or Git.
4. Establish independent cleanup authorization and an unconditional cleanup plan before first write. Cleanup must be confirmed by exact test project ID disappearance from subsequent `list_projects` and sandbox `STOPPED`. If deletion cannot be authorized or guaranteed, do not provision the resource.

## Execution matrix (synthetic only; not yet run)

| Gate | Required observation and success criterion |
| --- | --- |
| Identity | New independent empty Neon project only; initial schema verification and exact DB target; no Training/Shadow connections |
| A: 1 MiB gzip | Generate random/fabricated v13-shaped JSON, compress with actual `gzipSync(level:9)`; record *measured* gzip bytes, Base64 bytes, HTTP request/response bytes and status; persist parameterized text value and read back in **separate Neon HTTP calls** |
| B: 4 MiB gzip | Repeat byte-for-byte Base64 equality plus decoded gzip binary equality, uncompressed JSON SHA-256 equality, exact raw/compressed metadata |
| C: 12 MiB gzip | Same end-to-end checks, bounded timeout/memory measurement; on error record FAIL/limit uncertainty and STOP before larger case |
| D: up to 24 MiB gzip | **Conditional**; run only if smaller cases passed, no observed transport distress, available quotas and bounded memory permit; record actual exact bytes, HTTP status and latency. Do not classify size as vendor maximum |
| E: 50 MiB gzip cap | Offline-only exact `52,428,800` vs `52,428,801` compressed-byte predicate; **no** automatic 50 MiB remote upload, and no changed threshold |
| F: malformed archive | Isolated synthetic row only: invalid gzip, corrupted payload/digest, missing row, foreign `user_id`; fail closed without raw data leak or fallback; confirm clean failure semantics |
| G: real app contract | Separately run signed-v13 backup/restore and authenticated `GET /api/backups/[id]` on an isolated fully migrated synthetic application DB/HTTP server with real auth; a transport-table-only test **does not prove** the production application path |
| Cleanup | All fixtures removed with positive proof; temporary database/project and compute stopped/deleted only under explicit authorization |

Measurements must distinguish DB-driver HTTP **request** and **response** bodies from Next.js route downloads, headers, gzip size, Base64 field bytes, raw bytes, time and memory. No guessed 64 MiB/provider cap, no threshold change, no fallback to independently timed snapshot SELECTs. Do not log payload bytes or connection strings. Require digest/byte identity rather than checking lengths alone.

## Risk callouts / acceptance limits

- At the current source cap, Base64 field **could require** `4 * ceil(52,428,800/3) = 69,905,068` ASCII bytes (before SQL/JSON/HTTP overhead). This is a mathematical envelope, **not proof that Neon accepts it**.
- `loadStoredBackup` currently calls `gunzipSync` without an explicit decompressed-size cap. Treat memory pressure/zip expansion and direct JSON HTTP download limits as separate source-review risks; no silent acceptance or unscheduled runtime change.
- Existing `lib/local-postgres.ts` synchronous psql 16 MiB stdout cap is a *local adapter* reference, not the Neon HTTP provider limit. A successful persisted local PG round trip must not be mislabeled a Neon HTTP PASS.
- Do not sign or restore arbitrary invalid synthetic v13 content in a way that bypasses canonical validators. The fake signature in the offline profiler is **not** an authentic signed backup.

## Evidence ledger, as of 2026-10-30T07:17:04.713Z

| Evidence | Result |
| --- | --- |
| Current main, #441 SHA/base and source inspection | PASS (GitHub read-only) |
| Prior 32 historical PostgreSQL SKIPs | PASS 32/32 in four separate scoped jobs, prior SHA |
| Prior nonpersistent HTTP echo up to 12 MiB | PASS at prior sandbox/test project, **not stored** |
| Current available isolated empty Neon project | **NONE VERIFIED** |
| New stored gzip/Base64 Neon HTTP INSERT/SELECT | **NOT RUN** |
| 50 MiB archive HTTP boundary / vendor maximum | **UNKNOWN / NOT RUN** |
| Full signed backup + authenticated HTTP GET | **NOT RUN** |
| Exact new-candidate `verify:release:risk` | **NOT RUN** |
| Production DB/schema/flags | **UNKNOWN** (no access or mutation) |
| Merge, deployment, Training changes | **NOT DONE** |

**DO NOT:** merge Drafts; deploy; modify production/Shadow or Training DB, migrations or flags; weaken tests; create test data in existing projects; delete a cloud project without a separate explicit decision.

**ONE NEXT STEP:** obtain explicit approval of a brand-new disposable Neon test project **and exact-ID deletion**, then execute only A–C using the pinned Node24 HTTP client with cleanup proof.