# DATA-1: closure of 32 quarantined PostgreSQL acceptance SKIPs

**Recorded UTC:** 2026-10-30T07:01:22.950Z. **Repository:** `filipto861/flytally-logbook`.
**Main:** `807f281e5870164b794d001480ecc84e0b45aea5` (checked via GitHub).
**PR:** [Draft #441](https://github.com/filipto861/flytally-logbook/pull/441), `chore/logbook-data1-pg-skip-acceptance-20261030` at **tested pre-checkpoint HEAD `092593a1f14be1b64b733bcad77939ece15848a8`**.
**Base:** Draft #440 branch `chore/logbook-data1-full-ci-20261029@d7c9b531773de7d1ec5fd2ace9eec083a5a62e74`; nested upstream Drafts #439→#438→#437→#436→#435→#434. Independent design #433 and SEC-1 #432 untouched. No merge/deploy.

## Prior baseline: why they were SKIP

[Full initial CI evidence](2026-10-29-data1-full-github-actions-verification.md) [#40953266033](https://github.com/filipto861/flytally-logbook/actions/runs/40953266033), code SHA `087d19b2c108ccbe0d11311e598ac4d915d12bc2`, reported PostgreSQL core **119 PASS, 32 SKIP, zero FAIL**. These 32 are **four opt-in isolated historical fixture contracts**, not newly discovered DATA-1 export bugs and not eligible to count as PASS until executed.

| Source test file(s) | Contract flag | Prior SKIP count | Required isolated fixture |
| --- | --- | ---: | --- |
| `tests/integration/postgres-currency-v21-release.test.ts` | `FLYTALLY_V21_RELEASE_DISPOSABLE=1` + integration flag | 5 | pristine, purpose-identified standalone public schema v20 miniature |
| `tests/integration/postgres-v380-d3b-migrations-v1-v20-trash.test.ts` | `FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE=1` | 19 | unique per-test schema; actual ordered optimizer v1–v20 migrations |
| `tests/integration/postgres-v380-d3b-real-trash-races.test.ts` | `FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE=1` | 6 | unique schema with protected Trash and multi-session races |
| `tests/integration/v380-d3b-full-v20-catalog.test.ts` and `v380-d3b-zero-delete-counterexample.test.ts` | `FLYTALLY_D3B_FULL_V20_DISPOSABLE=1` | 2 | entire **canonical actual** v1–v20 catalog (FKs + lifecycle triggers), not browser stub |

## Proven isolated Node24/PG16 rerun

[GitHub Actions run **#41017214910**](https://github.com/filipto861/flytally-logbook/actions/runs/41017214910), head `092593a1f14be1b64b733bcad77939ece15848a8`, `completed/success`, independent GitHub Ubuntu 24.04 jobs, **no production DB/Neon**.

Each job provisioned a **new** `initdb` PostgreSQL16 instance bound strictly to loopback `127.0.0.1` using a different nondefault port (**55435/55436/55437/55438**), created only `flytally_currency_test` with role `flytally` and passwordless trust local to its temporary runner. A physical preflight verified the exact database/user/address/port/server version16, and zero existing public tables, before any fixture SQL. No normal production credentials, actual flights or GPS used. Four standalone `node --experimental-strip-types --test` test selections with original unmodified assertions, explicit opt-in flags and a **hard failure if any test skipped**.

| GitHub job | Job ID | Executed / PASS | FAIL | SKIP | Job cleanup |
| --- | ---: | ---: | ---: | ---: | --- |
| Currency v21 release | `123936168508` | 5/5 | 0 | 0 | PASS |
| D3b actual v1-v20 migrations | `123936168370` | 19/19 | 0 | 0 | PASS |
| D3b multisesion races | `123936168133` | 6/6 | 0 | 0 | PASS |
| D3b actual v20 FK/trigger catalog and SQL counterexample | `123936168372` | 2/2 | 0 | 0 | PASS |
| **Total** | | **32/32** | **0** | **0** | **4/4 PASS** |

The full-v20 catalog job used existing repository `tooling/bootstrap-pr340-real-v20-local.mjs` to apply the **actual canonical migration SQL 1…20** and verify 20 registered migration rows before test. Its log explicitly recorded `real_v20_catalog_bootstrap=PASS migrations=20 target=owned-localhost-PG16 schema=public release_status=NOT RUN`.

All four isolated PostgreSQL services were shut down by their `pg_ctl -m immediate -w stop` commands and owned temporary directories removed in `if: always()` cleanup. GitHub recorded **cleanup step SUCCESS in all four jobs**. Runners are ephemeral. No Neon project or branch was created.

## Diagnostic failures kept visible

1. [Run #41016909331](https://github.com/filipto861/flytally-logbook/actions/runs/41016909331) @`bdb6189186c9b9549e509ce8bcface9b77e15b1a`: **FAIL** catalog 1/2 because a browser bootstrap registered historical migrations 1…19, not v20. Other three suites were PASS.
2. [Run #41017059299](https://github.com/filipto861/flytally-logbook/actions/runs/41017059299) @`9dc1aab3dbe02479def8fc1d845378ea3f189ee8`: **FAIL** catalog 1/2 despite v20/v21 migration because the browser's intentionally simplified historical schema lacked required source FK. Other three suites PASS.
3. [Run #41017214910](https://github.com/filipto861/flytally-logbook/actions/runs/41017214910) @`092593a1f14be1b64b733bcad77939ece15848a8`: **SUCCESS 4/4 isolated jobs, 32/32 test cases**, real optimizer migration chain, zero SKIPs. The changes between runs were **temporary workflow fixture setup only**; no application or original test source changed.

Do not reinterpret the negative-control counterexample as a confirmed production race: it deliberately forces zero-row final DELETE inside a rolled-back synthetic transaction, as documented in source.

## Release gate interpretation

- The **previous 32 skipped cases now have independent direct execution evidence** at `092593a1f14be1b64b733bcad77939ece15848a8`. Prior core suite 119 PASS/32 SKIP and the four focused 32 PASS belong to **separate candidate-bound test runs**; do not invent one single 151/151 test execution.
- Existing private full Node24 `npm run typecheck` PASS, `npm test` **1,775/1,775 PASS**, `npm run build` PASS, and v13 signed backup/recovery desktop/mobile **2/2 PASS** at earlier [run #40953266033](https://github.com/filipto861/flytally-logbook/actions/runs/40953266033), runtime unchanged since except runtime inventory and docs/ephemeral CI cleanup.
- Current exact branch after checkpoint will have **only documentation** additions versus base Draft #440; `.github/workflows/data1-pg-skips-temporary.yml` is DELETED in checkpoint. The new cleanup commit is **not the tested exact Git SHA**; cite tested `092593a1f14be1b64b733bcad77939ece15848a8` for the new 32-case result and verify no production source/test changed.
- **Still UNVERIFIED:** actual large **stored backup** gzip/Base64 SQL INSERT and subsequent SELECT transfer boundary, Neon provider's maximum HTTP request/response, large account failure semantics, cron performance, and authoritative repository `verify:release:risk` candidate ledger. **DATA-1 NOT RELEASE READY**.
- **Production:** Vercel last observed `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` READY at `55c8076e1eb8104c14392e15b272b33e0eb29607`; production DB/flags/schema UNKNOWN and untouched. No migrations, production SQL, deployment, feature-flag changes, merge, or Training edits. Owner has limited free Claude: no new AI reviewer called.

**ONE NEXT STEP:** design and then separately execute a **bounded synthetic-only stored-backup Base64 upload/download roundtrip** on a new independently empty disposable Neon project and Node24 sandbox with explicit cleanup, before choosing a transport limit or requesting merge/release.
