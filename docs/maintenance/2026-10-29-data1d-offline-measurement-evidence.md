# DATA-1D — synthetic OFFLINE size measurement evidence (2026-10-29T19:34:07.433Z)

## Source and authorized scope

- **Repository:** `filipto861/flytally-logbook`, canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`.
- **Exact script source:** `tooling/data1-synthetic-transport-size.mjs` on pre-evidence Draft #438 HEAD `36041613c7d4f314ae723b1a91db6d4b501c1d6f`; Git blob SHA **`70dedadf6bc2667b3dc083517d09015fbe2cc308`**. Assistant's local executable copy was confirmed **byte-identical by Git blob SHA**, not an independent reimplementation.
- **User scope:** owner followed the immediately proposed offline synthetic-only measurement with “ok pokračujeme”; interpreted as permission for this **offline profiler only**, **not** to run Node test suites, compile, use Neon or operate on production.
- **Runtime:** isolated assistant container, Linux, Node **v22.16.0** (**not** repository-specified Node 24.x); Vercel/CI/PGHOST/DATABASE_URL/NEON_DATABASE_URL unset for child process; no PostgreSQL driver imported and no network/database queries made.
- **Commands:** `node tooling/data1-synthetic-transport-size.mjs --synthetic-only --preset=small`, then `medium`, then `large` with env variables above unset. Actual copy ran from assistant ephemeral working container at verified byte-identical source. Each CLI returned exit code **0**, JSON aggregates only. The script's unit tests were **NOT RUN**.
- **All data synthetic:** fabricated flights and coordinate-like strings, fake signature; never an actual GPS track, production export, server signature or restoration attempt. No raw data logged to Git.

## Raw integer-byte metrics, measured by this exact synthetic script

| Preset | Synthetic flights | Synthetic tracks | Simulated SQL results JSON | Simulated psql stdout | Unsigned compact payload | Pretty v13-shaped JSON | gzip level 9 | Base64 field |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 40 | 40 | 23,885 | 24,642 | 25,086 | 31,610 | 7,410 | 9,880 |
| medium | 500 | 500 | 4,264,429 | 4,265,186 | 4,265,632 | 4,340,236 | 2,230,526 | 2,974,036 |
| large | 4,000 | 8,000 | 34,594,826 | 34,595,583 | 34,596,031 | 35,420,635 | 17,892,516 | 23,856,688 |

**Source-derived reference values** (not measured provider limits): local `lib/local-postgres.ts` `spawnSync(... maxBuffer:16*1024*1024)` = **16,777,216 bytes**, existing stored archive compressed cap `lib/backup-center.ts` `50*1024*1024` = **52,428,800 bytes**.

## Interpretation

- Large synthetic **simulated psql stdout 34,595,583 > 16,777,216** bytes; it would exceed the current local adapter's `maxBuffer` if that exact output were emitted through `spawnSync`. This is **NOT** a physical PostgreSQL run; don't report actual adapter failure as tested. The limit applies to local testing, not independently to Neon HTTP.
- Large synthetic **gzip 17,892,516 < 52,428,800** bytes: below current compressed storage cap, but Base64 field **23,856,688** bytes. HTTP INSERT request framing and SELECT response are additional and **UNKNOWN**, so a below-cap archive is not proof of successful stored-backup round trip.
- The generated alphabet is deterministic pseudo-random **hex text**, not realistic aircraft GPS/compression entropy or certification evidence; other accounts, JSON payload shapes and SQL semantics can change all metrics.
- The script measures **neither** actual Neon HTTP request nor Neon HTTP response, time, memory, Vercel function bounds, HMAC validity, restore validity, cron scheduling or 1,000-statement exact restore.
- In particular, **the published provider limit “64 MB” is UNVERIFIED and has NOT been hardcoded**. No automatic fallback to inconsistent reads is allowed. No production size policy has been selected.

## Evidence ledger

| Gate | Status |
| --- | --- |
| GitHub SHA + exact script Git blob readback | PASS (read-only identity) |
| Three offline synthetic CLI size profiles | PASS (exit 0, returned aggregate numbers) |
| Native project Node 24 profile | **NOT RUN** (measurement environment Node 22.16.0) |
| Standalone profiler unit tests | **NOT RUN** |
| Node source tests / TypeScript / build | **NOT RUN** |
| Local PostgreSQL / Neon synthetic provider transaction | **NOT RUN** |
| HTTP transfer size, network timing and Vercel memory | **UNKNOWN / NOT RUN** |
| Browser, CI, candidate-bound release | **NOT RUN** |
| DB/migrations/production flags | **UNKNOWN** live state; no operations |
| Merge / deployment | **NOT DONE**; all Draft PRs remain unmerged |

## DO NOT / next action

No production DB reads/mutations, remote test schema, migrations, flags, merge, deploy, Training changes, real GPS exports, synthetic evidence treated as regulatory evidence, or invented vendor payload threshold.

**ONE NEXT STEP:** on a **separately approved isolated synthetic Neon test branch**, measure actual version-locked Neon HTTP transaction response, Base64 INSERT and SELECT request/response, with clean transport-size telemetry only, before choosing a production-safe transport cutoff or considering WebSocket architecture. Offline results alone are insufficient for release.
