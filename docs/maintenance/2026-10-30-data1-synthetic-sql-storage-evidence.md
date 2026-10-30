# DATA-1D — independent synthetic PostgreSQL storage verification (2026-10-30)

**Result: PARTIAL.** Three **server-generated** Base64 text storage/readback cases PASS on an isolated, subsequently **deleted** Neon PostgreSQL 16 project. The intended **actual Neon Node HTTP INSERT/SELECT gzip payload transfer was NOT RUN**. This is **not** DATA-1 release approval.

## Verified GitHub candidate / identity

- Canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`; [Draft #442](https://github.com/filipto861/flytally-logbook/pull/442) initial HEAD `67b3eb7e4bf713b22c9d2f81b59420e095cc9eff`, based on [Draft #441](https://github.com/filipto861/flytally-logbook/pull/441) `da5f903566c51be7fb548f7a5362e40205772a09`. This evidence and checkpoint are docs-only.
- Owner explicitly approved creating and later deleting **one new empty disposable Neon project**. Newly created exact project ID `green-grass-72402049` name `flytally-logbook-data1-http-20261030`, new branch `br-aged-tree-b9tbjht5`, DB `synthetic_data1`, role `synthetic_data1_owner`, region `aws-eu-central-1`. PostgreSQL **16.15**, initial public table count **0**. Project was independent of existing Logbook Shadow and two Training projects. Original project IDs were independently enumerated before creation/deletion.
- Dedicated Vercel Node **v24.22.1** nonpersistent sandbox `sbx_5rdbq6xqPEndvE8GKLDtfrRskExx` prepared with `@neondatabase/serverless@1.1.0`. Sandbox network was restricted to npm registry and Neon; no production environment was copied. An in-sandbox direct-client test script was prepared; cross-system transfer of the Neon connection secret was **blocked by tool security controls**. No SQL was run in the sandbox, and no direct driver request/response bytes, latency or memory consumption were measured. Do not count Node HTTP tests as PASS.

## Executed, provider-managed SQL-only database persistence

All SQL calls explicitly targeted exact `project_id=green-grass-72402049`, `branch_id=br-aged-tree-b9tbjht5`, `database_name=synthetic_data1`; **never** an existing branch. After empty DB preflight, a disposable table `public.data1_synthetic_archive(preset_mib,payload_base64,payload_md5,payload_bytes)` was created.

For each of 1/4/12 MiB, PostgreSQL **generated** pseudo-random, fabricated Base64 text using `generate_series`, `md5(g::text)`, `decode(...,'hex')`, `encode(...,'base64')`, and removed line breaks. INSERT stored the text, its `md5` and octet count. A **separate SQL read query** independently recomputed the stored octet count, Base64 decoded byte count and stored-text digest identity. No archive/gzip data, valid HMAC, pilot records, personal data or GPS material was used.

| Base64 case | Stored bytes | Decoded bytes | Persisted MD5/length verified | Source |
| --- | ---: | ---: | --- | --- |
| 1 MiB | 1,048,576 | 786,432 | PASS | Neon connector SQL |
| 4 MiB | 4,194,304 | 3,145,728 | PASS | Neon connector SQL |
| 12 MiB | 12,582,912 | 9,437,184 | PASS | Neon connector SQL |

**Critical distinction:** Text was **generated inside PostgreSQL**. SQL requests did **not** upload 1/4/12 MiB bodies from a Node client, and SELECT did **not** download full Base64 payloads to Node. Successful persisted internal reads and hashes do not verify Neon HTTP upload/download limits, response serialization or signed v13 backup correctness. This evidence is a narrower *PostgreSQL storage + in-database integrity* gate only; even though the Neon connector uses a provider API, the tested SQL returned just small aggregate values.

## Cleanup evidence (PASS)

1. Immediately before deletion, `list_projects` positively identified exactly four projects, with the synthetic project **name and exact ID** as above and all three original projects present.
2. Called Vercel stop for session `sbx_5rdbq6xqPEndvE8GKLDtfrRskExx`; response returned stopped and independent `get_session` showed `status=stopped`, `persistent=false`.
3. Deleted **only** `green-grass-72402049` under owner's explicit prior consent. The deletion tool returned the same project ID and name. A **new** `list_projects` returned exactly three originals: `muddy-dust-14049657` Logbook Shadow, `frosty-recipe-46458686` Training Production and `dry-king-94424047` Training Acceptance; synthetic ID absent. No live project SQL, production migration, restore, feature-flag operation, merge or deployment occurred.

## Evidence ledger — 2026-10-30T07:31:29.482Z

| Scope | Outcome |
| --- | --- |
| GitHub main/branch/PR, existing source boundaries | PASS, read-only |
| New disposable Neon PG16 empty DB and role identity | PASS |
| Synthetic server-generated Base64 data persistence / separate SQL readback | **PASS 3/3** (not Node HTTP) |
| Node24 and Neon driver dependency setup | PASS as environment installation only |
| Actual Node24 Neon HTTP INSERT/SELECT full payload | **NOT RUN — credential handoff blocked** |
| Actual gzip/Base64 signed-v13 archive and GET route | **NOT RUN** |
| 50 MiB compressed app cap and provider hard HTTP maximum | **UNKNOWN** |
| Original 32 quarantined PG tests | Historical **PASS 32/32**, separate run #41017214910, different SHA |
| Candidate-specific release-risk gate | **NOT RUN** |
| Sandbox stop and exact Neon test project deletion / 3 originals preserved | **PASS** |
| Production DB/schema/flags | **UNKNOWN**; no production operations |
| Merge / deployment / Training repository change | **NOT DONE** |

**DO NOT:** reinterpret SQL-only as HTTP proof; assume a Neon provider body cap; claim 50 MiB gzip is supported over HTTP; broaden test target to production or Training; merge or deploy based on this evidence.

**ONE NEXT STEP:** implement and execute a credential-safe, owner-controlled Node24 + pinned Neon driver test harness against a **fresh, positively verified disposable** empty database, to measure a genuine 1/4/12 MiB gzip→Base64 HTTP INSERT and separate SELECT with byte/digest equality and verified exact-ID cleanup. The project used in this milestone is already deleted and must never be reused.
