# DATA-1D — actual Neon HTTP driver 1.1.0, Node24, ephemeral synthetic proof

**Recorded:** 2026-10-29T20:12:59Z UTC; **project:** `filipto861/flytally-logbook`; **canonical main:** `807f281e5870164b794d001480ecc84e0b45aea5`; **working PR:** [Draft #438](https://github.com/filipto861/flytally-logbook/pull/438) at pre-evidence HEAD `dc5d8a095cd7d9872d691d27c7b80f4a44d38f8d` (stacked on #437→#436→#435→#434). No merged code or production release.

## Scope/identities

- Owner authorized continuation of previously requested real HTTP/Node24 synthetic check and required complete cleanup. No production DB, actual user data, migrations, feature flags, merge, deployment, Training, or app secrets in GitHub.
- **Disposable Neon:** newly created project `FlyTally DATA1 HTTP 110 disposable 20261029`, ID `cold-shape-74578425`, region `aws-eu-central-1`; default branch `synthetic-http-only`, ID `br-holy-sound-badni0am`, `parent_id=null`; database `data1_http_probe`. Initial read-only preflight `public_tables=0` and `server_version_num=160015` (PostgreSQL 16.15). No inherited user data. **No tables created and no SQL INSERT/UPDATE/DELETE/DDL issued**.
- **Disposable execution sandbox:** Vercel sandbox `flytally-data1-http-probe-20261029`, session `sbx_HurBRhodoJCpJ7JC4QsTDAzJ3sKT`, `runtime=node24` on region `fra1`, `persistent=false`, sandbox resource associated with Logbook Vercel project for execution **only** (not a deployment, no application runtime changes). `node --version = v24.22.1`; installed exact `@neondatabase/serverless@1.1.0` with `npm install --save-exact --no-audit --no-fund`. No local Git checkout/source build claimed.
- Connection URL used only as a per-command environment variable in sandbox; deliberately not printed, saved to repo, committed, written to test source or included in output. The custom `neonConfig.fetchFunction` wrapper counted bytes of outbound HTTP JSON request bodies and response bodies via `Response.clone().arrayBuffer()`, not headers/TLS/proxy framing. Logs contained **only numeric aggregate values**.

## Observed actual HTTP transport (all 6 bounded synthetic cases exit 0)

Each snapshot case used exactly **one driver `sql.transaction([...], {isolationLevel:"RepeatableRead",readOnly:true})`** with initial and final `current_setting('transaction_isolation')`, `current_setting('transaction_read_only')`, `pg_current_snapshot()::text` checks and **30 synthetic SELECTs**. The heavy SELECT was `repeat(md5(n::text), k)` over synthetic `generate_series`; the remaining 29 SELECTs returned one harmless marker row each. The driver returned **32 arrays** in order, all probes reported `repeatable read` / `on`, initial and final snapshot strings were **exactly equal**, and heavy row cardinality matched the synthetic target. **No app `buildAccountBackup` was executed.**

| Case | Heavy generated rows | Approx synthetic heavy row size | HTTP request body (bytes) | HTTP response body (bytes) | HTTP status | Wall time (ms) | Snapshot / 32 arrays |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| small | 40 | 256 B | 3,135 | 20,834 | 200 | 204 | PASS |
| medium | 500 | 8,192 B | 3,167 | 4,108,924 | 200 | 199 | PASS |
| large | 4,000 | 4,096 B | 3,197 | 16,414,454 | 200 | 238 | PASS |

Next, independently tested **bidirectional HTTP transport without storage** using parameterized `SELECT $1::text AS value` on synthetic, constant-character strings; compared the returned text length with input length. This exercises large parameter upload and SELECT response, **not an INSERT or persisted account backup**.

| Synthetic input | HTTP request body (bytes) | HTTP response body (bytes) | HTTP status | Wall time (ms) | Exact round-trip |
| ---: | ---: | ---: | ---: | ---: | --- |
| 1 MiB = 1,048,576 chars | 1,048,626 | 1,048,766 | 200 | 39 | PASS |
| 4 MiB = 4,194,304 chars | 4,194,354 | 4,194,494 | 200 | 117 | PASS |
| 12 MiB = 12,582,912 chars | 12,582,962 | 12,583,102 | 200 | 347 | PASS |

**Important interpretation:** These prove success at tested sizes on a disposable environment; they do **NOT** establish Neon's maximum request/response limits or a real account distribution. Never infer “64MB is safe” or encode a provider size limit from these rows. Response sizes exclude HTTP headers and protocol framing. Values and durations are from a single bounded test run, not load testing or SLA evidence.

## Cleanup — verified

1. Before destructive cleanup, independently checked the created Neon project's **exact ID and exact name**.
2. Called `delete_project("cold-shape-74578425")`; provider returned success. Subsequent `list_projects` showed exactly the 3 preexisting projects, **no synthetic project**. **Neon deletion VERIFIED PASS.**
3. Called Vercel `stop_session("sbx_HurBRhodoJCpJ7JC4QsTDAzJ3sKT")`; provider response and separate `get_session` confirmed **stopped**. A later `list_named_sandboxes` confirmed the sandbox **stopped**, `persistent=false` (name/status record can remain; no running session). **Execution resource shutdown VERIFIED PASS.**
4. Original Logbook Shadow and both FlyTally Training Neon projects untouched; no production SQL or Vercel deployment.

## Gates and next action

| Evidence item | Result |
| --- | --- |
| Isolated empty Neon PostgreSQL16.15 | PASS |
| Node24.22.1 / exact Neon serverless1.1.0 | PASS |
| Three synthetic 32-query read-only MVCC transactions + same-snapshot check | PASS |
| Three synthetic parameter upload + SELECT echo transfer cases | PASS |
| Neon test project deletion verified absent | PASS |
| Sandbox stop verified | PASS |
| Actual HTTP max vendor limit | **UNKNOWN** |
| Real application v13 `buildAccountBackup`/signing/restore | **NOT RUN** |
| Stored backup Base64 INSERT / SELECT and 50MiB gzip boundary | **NOT RUN** |
| Large real account latency, Vercel function memory, cron throughput | **NOT RUN** |
| DATA-1 source-unit tests, TS typecheck, app build, PG integration, browser, CI, release | **NOT RUN** |
| Production DB/schema/flags | **UNKNOWN** — no queries or changes |
| Merge / deployment | **NOT DONE** |

**Risk:** The new shared HTTP transaction should be sized against **realistic synthetic JSON shapes** across all 30 sections before choosing conservative upload/download size policy; no fabricated provider ceiling. New strict pre-sign validators need their own compatibility tests. Legacy (<6) recovery still uses multiple transactions; current v13 exact recovery uses one bounded transaction.

**ONE NEXT STEP:** run targeted DATA-1 Node24 unit/typecheck first against an exact frozen PR stack, then separately plan realistic synthetic Base64 storage round-trip on a new disposable isolated DB only if needed for release decision. Preserve the no-merge/no-deploy gate until tests and owner approval.
