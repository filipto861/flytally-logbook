# DATA-1D — synthetic offline transport-size profile (source-only)

Status: staged in a Draft PR; NOT RUN; no measurement evidence. The script has no DB driver, network requests, application imports, filesystem writes or HMAC secrets. It explicitly requires an offline-only command and refuses inherited database/CI/deployment environments. The generated data is fabricated and does not contain customer GPS/flight records.

Future locally authorized use: node tooling/data1-synthetic-transport-size.mjs --synthetic-only --preset=small
Other synthetic profiles: medium, large (bounded source generation to 40 MiB synthetic text).
Future source test only: node --test tooling/data1-synthetic-transport-size.test.mjs. Neither command has been run.

The script creates a v13-shaped synthetic object with 29 section arrays, one synthetic user and two MVCC-like probes (32 arrays). It emits only an aggregate JSON summary: synthetic snapshot JSON bytes, simulated psql marker stdout bytes, compact payload bytes, pretty stored archive bytes, gzip level-9 bytes and exact Base64-field bytes. It reports the existing 50 MiB gzip cap and 16 MiB local psql buffer as reference numbers.

Vendor HTTP request and response limits remain UNKNOWN (JSON null). A synthetic JSON result is NOT the actual Neon driver HTTP protocol. This does NOT measure real HTTP request/response, Postgres work_mem, Node/Vercel RSS, latency, cron throughput or success of restoration. The synthetic coordinates blob is deterministic pseudo-random ASCII, not a real GPS sample. The dummy signature is deliberately invalid. Never use this output to certify backup format, data quality or a user account's capacity.

The following release blockers remain:
1. Neon driver transaction request and response byte limits, real wire protocol and execution time; require current primary vendor source and isolated synthetic-only provider run.
2. Stored gzip-to-Base64 one-INSERT transfer size and one-SELECT return size. Compression alone cannot prove the HTTP limit.
3. A single committed v13 exact restore is already atomic in the code path; legacy versions below 6 use multiple transactions. Keep that distinction.
4. Account backup must fail closed on oversized/partial read and pre-sign validation; never fall back to uncoordinated reads or sign a fragment.
5. Typecheck, build, PostgreSQL, Neon, browser, CI and all candidate-bound release tests remain NOT RUN by owner instruction. No merge, deployment or production DB actions.

ONE NEXT STEP: review the offline measurement dimensions, then seek explicit owner approval for a limited synthetic-only offline run and isolated-provider validation before setting any size policy or releasing DATA-1.
