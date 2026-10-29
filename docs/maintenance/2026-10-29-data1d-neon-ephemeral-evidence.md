# DATA-1D — isolated disposable Neon synthetic SQL probe and cleanup

**UTC checkpoint:** 2026-10-29T19:45:29.629Z
**Repository:** `filipto861/flytally-logbook`
**Main:** `807f281e5870164b794d001480ecc84e0b45aea5`
**Work branch:** `chore/logbook-data1d-offline-size-envelope-20261029` / [Draft PR #438](https://github.com/filipto861/flytally-logbook/pull/438), pre-checkpoint HEAD `d7d08f8d80311918cdd26f2c27a2cb2facd5cc16`
**Permission:** Owner approved independently empty Neon project, synthetic-only measurement, and explicitly required complete cleanup ("pak uklidit po sobe musis"). No permission to merge, deploy, migrate production, restore/delete production data, modify flags or Training.

## Environment identity and cleanup (VERIFIED)

- Created NEW independent Neon project named `FlyTally Logbook DATA1 synthetic ephemeral 20261029`, ID `odd-recipe-81483357`; not a branch cloned from existing Logbook/Training.
- PG **16.15** confirmed via `server_version_num=160015`; default new branch `synthetic-only` ID `br-steep-mud-b9ld9k4g`, `parent_id=null`, `ready`; new database `synthetic_data1`.
- Initial database read-only SQL preflight: `public_tables=0` (**PASS**).
- No tables created, no imported data, **all executed SQL was SELECT-only** except `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY` in a single transaction. No real flight/GPS/user data, credentials, migrations or DDL/DML.
- **Cleanup**: `delete_project(project_id="odd-recipe-81483357")` returned success; a separate `list_projects` returned 3 original projects and **did not include this test project**. **Deletion verified PASS; nothing test-related left in Neon**. No Training project or Logbook Shadow branch touched.

## Exact narrowly scoped Neon connector observations

1. In one `run_sql_transaction` call, executed `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`, first MVCC probe, **30 synthetic SQL aggregation SELECTs**, final MVCC probe. The tool returned a successful response, an observed first probe of `isolation="repeatable read"`, `read_only="on"`, `snapshot="763:763:"`, and aggregate results for all sections. The connector response serialized length was **2,218 characters** and call-side elapsed wall time approximately **3,019 ms**. **Exact last-probe equality was not independently evaluated or recorded**; do not elevate this to a full 32-result and same-snapshot application acceptance PASS.
2. Synthetic `generate_series` aggregate queries returned:

| Fabricated rows | Synthetic length per row | Aggregate bytes | Connector SQL status |
| ---: | ---: | ---: | --- |
| 40 | 256 | 10,240 | PASS |
| 500 | 256 | 128,000 | PASS |
| 4,000 | 256 | 1,024,000 | PASS |

These are **server-computed byte sums**, not HTTP response payload sizes: the SQL returns a small aggregate result rather than the 1 MiB payload itself. All synthetic strings are `repeat(md5(n::text),8)`; no actual GPS or certified flight evidence.

## Important non-evidence

- This used the **Neon connector** `run_sql` / `run_sql_transaction`, **NOT** the app's pinned `@neondatabase/serverless@1.1.0` HTTP driver. It does **not** verify HTTP batch serialization, request/response ceiling, auth, memory, cron `maxDuration`, or an actual Flight/GPS v13 backup/restore.
- No 50 MiB gzip Base64 INSERT or SELECT was executed (the project was empty and must remain synthetic-only); no large row payload returned. Previous offline JSON/gzip/Base64 measurements remain separate Node22 evidence.
- DB project creation and deletion are **separately observed successful provider operations**, not production actions. The original free/paid billing/quota impact is not independently quantified; no lingering test environment.
- **NOT RUN**: DATA-1 Node unit tests, TS typecheck, app build, real Neon HTTP driver 1.1.0, full PostgreSQL schema acceptance, browser, GitHub CI, Vercel candidate/release gates, and production smoke for this candidate. Vendor maximum HTTP payload size still **UNKNOWN**. No DATA-1 claim of releasability.
- No new second-AI review; the narrow synthetic SQL measurement adds no change to the frozen architecture.

**ONE NEXT STEP:** assess feasibility of a bounded **actual Node24 + `@neondatabase/serverless@1.1.0` HTTP-only synthetic test** with guaranteed disposable test project and cleanup; independently record full first/last probe equality and actual driver request/response size. Until then keep DATA-1 Draft/unmerged and size policy undecided.
