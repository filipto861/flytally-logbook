# DATA-1 — full GitHub checkout, Node24, PG16 and browser diagnostics (2026-10-29T21:02:30.499Z)

## Frozen source, authority, separation

- Repository `filipto861/flytally-logbook`, canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`.
- **Full CI source actually tested:** `087d19b2c108ccbe0d11311e598ac4d915d12bc2` on `chore/logbook-data1-full-ci-20261029`, [Draft PR #440](https://github.com/filipto861/flytally-logbook/pull/440), base [Draft PR #439](https://github.com/filipto861/flytally-logbook/pull/439) at `0e5017f4d9efbf35af238d62ad3409c57a505bdb`; upstream #438→#437→#436→#435→#434; review/design Draft #433 and independent SEC-1 Draft #432 unchanged. **No merge**.
- GitHub Actions [run #40953266033](https://github.com/filipto861/flytally-logbook/actions/runs/40953266033) `completed/success` at this exact SHA. Fully checked out private repository using `actions/checkout` on GitHub-hosted Ubuntu/Node24; NOT copied partial sources and NOT a Vercel production build/deployment.
- A **temporary push-triggered workflow** `.github/workflows/data1-full-checkout-temporary.yml` was added for diagnostics only. This checkpoint **removes it from this branch** as requested; existing `.github/workflows/verify-web.yml` and `browser-smoke.yml` remain manual-only. No workflow will be retained by Draft #440.
- **Source change after failed initial CI run:** `tooling/development-modules.json` ownership inventory updated from **416 to 419** to account for `lib/local-postgres-transaction.ts` (platform), `lib/account-backup-snapshot.ts` and `lib/account-backup-presign.ts` (data-recovery). Confirmed those modules already own the new paths; **no test assertion/coverage threshold weakened or changed**. An earlier full `npm test` at `a3c9f93e...` failed with 1774/1775 due the outdated inventory. That failure remains evidence, not relabeled PASS.

## Exact complete-repository verification

| Gate | Actual result | Notes |
| --- | --- | --- |
| Full private GitHub checkout | **PASS** | Source `087d19b2c108ccbe0d11311e598ac4d915d12bc2`, Node24 GitHub runner |
| `npm ci --no-audit --no-fund` | **PASS** | Repository lockfile |
| `npm run scope:changed -- ...` | **PASS / plan only** | Modules data-recovery + platform; requires typecheck, full Node, build, PostgreSQL and browser evidence; `scale=false` |
| `npm run typecheck` | **PASS** | Full project, not partial tsc |
| `npm test` | **PASS: 1,775 / 1,775** | 0 fail, 0 skipped, full repository |
| `npm run build` | **PASS** | Next.js production build artifact, not deployment |
| Disposable PostgreSQL16 core `npm run test:postgres` | **PARTIAL** | 39 selected files; **119 PASS, 32 SKIP, 0 FAIL** out of 151. CI job exit 0 and cleanup success, but intentional skips bar complete `postgres-acceptance` PASS. |
| v13 signed-backup / recovery desktop browser | **PASS 1/1**, no retry | `--currency-v21-risk`, explicit desktop scope |
| v13 signed-backup / recovery mobile browser | **PASS 1/1**, no retry | `--currency-v21-risk`, explicit mobile scope |
| CI job outcome | **SUCCESS** | Three jobs completed successfully; does not override PARTIAL PG |
| Full risk-selected authoritative release gate | **NOT RUN** | Github diagnostic is NOT `verify:release:risk` source-bound local ledger |
| Separate large-account stored Base64 INSERT/SELECT, real cap | **NOT RUN / UNKNOWN** | Prior synthetic Neon HTTP probe tested 16.4 MB response and 12 MiB echo, not stored archive end-to-end |
| Production DB/schema/flags | **UNKNOWN**, untouched | No production SQL/migrations/restore/delete/flags |
| Merge / production deployment | **NOT DONE** | Existing Vercel READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` sourced from `55c8076e1eb8104c14392e15b272b33e0eb29607` |

### Failures and corrective evidence — not concealed

1. [Run #40949828829](https://github.com/filipto861/flytally-logbook/actions/runs/40949828829) **FAIL**, 1,774/1,775 Node; stale runtime inventory `416` vs observed `419`. Fixed ONLY manifest count, without weakening test or requirements.
2. [Run #40950225357](https://github.com/filipto861/flytally-logbook/actions/runs/40950225357) **PASS** full TypeScript, Node 1,775/1,775 and build.
3. [Run #40950696766](https://github.com/filipto861/flytally-logbook/actions/runs/40950696766) **FAIL** on environment: Playwright1.55 unsupported Ubuntu26.04; eight strict historical PG cases needed a named disposable, passwordless PG16 on 127.0.0.1 nondefault port and explicit opt-in. Production code/tests not weakened.
4. [Run #40951330808](https://github.com/filipto861/flytally-logbook/actions/runs/40951330808) **CANCELLED** after changing overly broad legacy browser smoke to bounded v13 risk cases; prior PG diagnostics 119 PASS /32 SKIP, cleanup passed. Do not count cancelled browser as PASS.
5. [Run #40953266033](https://github.com/filipto861/flytally-logbook/actions/runs/40953266033) **SUCCESS**: full source jobs, loopback PG16, signed-v13 desktop/mobile browser. Browser: 1 pass (11.8 s) desktop, 1 pass (12.4 s) mobile; zero retries. Preflight v20/v21 registry 21, 12 columns, 4 CHECKs PASS before each test.

## Safety and cleanup

- No Neon test project created in this full-repo GitHub phase. Real production/Shadow and Training projects were not queried or modified.
- Postgres core tests ran only on a separate disposable **host-loopback PG16** instance on `127.0.0.1:55432` with DB `flytally_currency_test`, purpose flags `FLYTALLY_POSTGRES_INTEGRATION=1`, `FLYTALLY_D2_FULL_V20_DISPOSABLE=1`, passwordless trust **in ephemeral CI only**, and controlled hostname/user/port/DB check inside test. PG stop+directory removal CI step **SUCCESS**.
- Desktop and mobile browser v13 risk tests ran on another isolated host-loopback PG16 instance `127.0.0.1:55433` with v20/v21 synthetic schema-first fixture and synthetic CI-only session/signing values; PG stop+directory removal **SUCCESS**.
- No remote destructive tests, secrets, actual GPS/PII records, production SQL, production deploy, feature flags or migrations.
- Temporary CI workflow **removed in the checkpoint commit**; do not leave recurring push CI or permanent new integration. Original two manual workflow files remain untouched.
- Evidence belongs to **tested source SHA `087d19b2c108ccbe0d11311e598ac4d915d12bc2`**, not an automatic claim for later docs-only/checkpoint SHA; subsequent changes must be classified. After cleanup, source runtime files and package lock are identical to tested source, but Git SHA differs by the deleted temporary workflow and documentation.

## Remaining release risks

1. PostgreSQL full acceptance **PARTIAL** due 32 explicit SKIP historical cases; do not relabel N/A without planner-contract justification.
2. End-to-end **stored** Base64 upload/download boundary and large-account provider hard limit still UNKNOWN; prevent silent fallback to inconsistent SELECTs.
3. Full `npm run verify:release:risk -- <candidate>` local evidence ledger NOT RUN. No main merge, production release or production flags approved.
4. Prior multi-transaction restore finding applies to legacy backups `<v6`, **not** single-transaction current exact v13 restoration.

**ONE NEXT STEP:** resolve/classify the 32 intentionally skipped PostgreSQL cases with the repository's candidate-bound risk acceptance protocol on a positively isolated local PG16 fixture, then evaluate remaining size-envelope evidence before any owner release request.
