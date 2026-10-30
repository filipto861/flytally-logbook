# DATA-1D — REAL Neon HTTP stored gzip/Base64 1/4/12MiB acceptance evidence

**Date (UTC documentation):** 2026-10-30T09:14:11.120Z  
**Status:** **PASS 3/3 for actual owner-operated Neon HTTP INSERT and separate SELECT with exact byte-integrity verification**. This is transport acceptance only; it is **NOT** signed application v13 restore, not a provider maximum determination, not release authorization.

## Exact source/reproducibility

- User on trusted local Windows PowerShell/Node24 checked out **`test/logbook-data1-local-http-executor-20261030@60affbabda8e377656c9a6ec82e63e227803929d`** (verified against that SHA at clone). This was before the subsequent documentation-only checkpoint commit `02289138d24e623e374429e009ff1b30b4732b12`. No transport/launcher code changed between the two.
- Owner command, in local clone: `./tooling/data1-neon-http-store-local.ps1 -Mode Execute -ProjectId 'purple-lab-22755259' -BranchId 'br-wild-dew-b9wsd6yq' -ConfirmToken '31eaeb3ab1dbbcd679c4' -AllowSyntheticWrites` (on Windows the slash is `.\tooling\...`). Operator typed `EXECUTE` and entered the URI only into the local hidden prompt; no password/URI transmitted via chat, GitHub or another connector.
- Preceding real owner's read-only Probe `status:PASS` matched dedicated PG16 project, branch, DB, role, 0 tables; 20-character confirmation proof validated against independently checked Neon metadata. The owner then supplied a sanitized native test output containing `EXECUTION_PREFLIGHT PASS`, three `STORED_NEON_HTTP PASS`, and `COMPLETE passed=3`.
- **Test-only Neon project:** `purple-lab-22755259` (`FlyTally DATA1D disposable HTTP test 20261030`), branch `br-wild-dew-b9wsd6yq`, PG version `160015`, DB `synthetic_data1`, role `synthetic_data1_owner`. This remains an active, separately disposable project; deletion has **NOT** been authorized or carried out.
- Script uses pinned `@neondatabase/serverless@1.1.0` and synthetic unsigned random payloads (~1/4/12MiB gzip) with parameterized `INSERT`, separate full `SELECT`, and exact gzip/Base64/raw bytes SHA-256 verification. The SQL fetches response body contents and script reports byte counts but not secrets, real flights or GPS.

## Owner's actual Windows real HTTP output (sanitized)

| Approx compressed MiB | Raw JSON bytes | gzip bytes | Base64 bytes | HTTP INSERT request bytes | INSERT HTTP response bytes | INSERT elapsed ms | HTTP SELECT request bytes | SELECT HTTP response bytes | SELECT elapsed ms | peak current RSS MiB | Integrity |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 1,354,665 | 1,020,374 | 1,360,500 | 1,360,766 | 191 | 399 | 138 | 1,361,166 | 296 | 74 | **PASS** |
| 4 | 5,548,969 | 4,179,356 | 5,572,476 | 5,572,742 | 191 | 1,299 | 138 | 5,573,142 | 1,702 | 132 | **PASS** |
| 12 | 16,733,781 | 12,603,501 | 16,804,668 | **16,804,937** | 191 | 3,210 | 138 | **16,805,336** | 3,060 | 290 | **PASS** |

Each of the six actual HTTP calls reported status `200`; the 3 test rows `STORED_NEON_HTTP` reported `result:PASS`, and `COMPLETE` reported `passed:3`, not merely echoed command success. Timings are one Windows→Neon run, **not a latency SLA**. Larger observed HTTP request/response demonstrates this service accepted **at least these payloads at the time tested**, **NOT** a theoretical/product/provider hard maximum.

## Independent provider readback (read-only, ChatGPT Neon connector)

Used **only the exact disposable** project `purple-lab-22755259`, branch `br-wild-dew-b9wsd6yq`, database `synthetic_data1`, role `synthetic_data1_owner` via read-only `run_sql`; returned:

- `current_database=synthetic_data1`, `current_user=synthetic_data1_owner`, `server_version_num=160015`, `COUNT(*)=3`, `COUNT(DISTINCT preset_mib)=3`.
- `SELECT preset_mib, raw_bytes, compressed_bytes, octet_length(payload_base64), length(payload_sha256), (payload_base64 ~ '^[A-Za-z0-9+/]*={0,2}$')` verified exactly:
  - `1: raw=1354665, gzip=1020374, base64=1360500, SHA-hex-length=64, base64_chars=true`
  - `4: raw=5548969, gzip=4179356, base64=5572476, SHA-hex-length=64, base64_chars=true`
  - `12: raw=16733781, gzip=12603501, base64=16804668, SHA-hex-length=64, base64_chars=true`.
- Independent SQL read did **not** re-download or hash the full 16.8MB stored value; **full byte-for-byte verification was already performed in the owner's true HTTP client SELECT and reported PASS**. The independent SQL read corroborates counts/lengths, not a second full digest check.
- Provider `list_projects` returned this disposable plus exactly three original untouched IDs: Logbook Shadow `muddy-dust-14049657`, Training Production `frosty-recipe-46458686`, Training Acceptance `dry-king-94424047`. Did not run SQL against original databases.

## Release boundary, cleanup, and next action

- **Transport acceptance: PASS 3/3** for tested actual Neon HTTP body sizes. Earlier offline mocked client 10/10 and Windows launcher 4/4 are distinct evidence, not replacements for the new success.
- **NOT RUN:** signed v13 authenticated app backup GET / actual restore / user-level authorization and recovery; exact-candidate `verify:release:risk`; authenticated application/browser acceptance, production DB schema and flags readback.
- **UNKNOWN:** Neon vendor hard payload maximum beyond successfully tested 16,804,937-byte INSERT request and 16,805,336-byte SELECT response, performance under multiple runs/concurrency.
- **No source code, migrations, production databases, flags, deploy or merge changed by this verification.** Draft PR #443 stays unmerged.
- **CRITICAL resource lifecycle:** the newly created `purple-lab-22755259` contains **three synthetic rows** and remains in Neon. **DO NOT DELETE without explicit subsequent owner approval identifying exact project ID.** If approved, delete only that exact project, then independently list to verify disappearance and the three original projects' presence. No remote destructive test against original projects.
- **ONE IMMEDIATE NEXT STEP:** request owner confirmation to delete **only** disposable Neon project `purple-lab-22755259` now that transport PASS is captured, then perform exact-ID deletion and verify that the three protected projects remain. Deletion permission is distinct from merge, deploy, migration or application release approval.
