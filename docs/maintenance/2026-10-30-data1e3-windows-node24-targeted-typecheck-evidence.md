# DATA-1E3 — Windows Node24 D1/D3 targeted regression + typecheck evidence

**UTC checkpoint:** 2026-10-30T10:43:14.508Z  
**Status:** Windows **targeted 3/3 PASS**, **typecheck PASS**, risk scope classifier PASS. **No PostgreSQL, authenticated HTTP, real restore, full regression or release acceptance was executed**.

## Exact tested source and environment

- Repository: `filipto861/flytally-logbook` Draft [PR #445](https://github.com/filipto861/flytally-logbook/pull/445), branch `fix/logbook-data1e3-v13-security-gates-20261030` stacked onto Draft #444 `512bddf0405854f1c0fe5694b00ee09c8099cb5d`, itself stacked on Draft #443 `16a94e051037b680f7b08e97e8880e7967ada062`; canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`. All unmerged.
- **Actual checkout SHA tested: `08121cd05f58348e2a8db20a98cc22cc7f4625b1`**, GitHub hosted `windows-2022`, Node **v24.22.1**, GitHub Actions [run #41042561314](https://github.com/filipto861/flytally-logbook/actions/runs/41042561314), job `124018663235` (`targeted-node24-typecheck`), **completed SUCCESS** and all steps completed SUCCESS.
- Exact test commits have no product source changes between the code commit before the workflow and temporary workflow commit `08121cd...`. The workflow source was **deleted after the successful run** at `4761bcf1ed1e7a9b388faf4eb13d9e818ea0a1b1`. No scheduled/push test workflow from this temporary run remains on the working PR.
- Test runner deliberately passed **no DB credentials, no SQL calls, no application server, no DB restore**, and checked `DATABASE_URL`, `POSTGRES_URL`, `NEON_DATABASE_URL`, `PGHOST`, `PGSERVICE`, `PGHOSTADDR` absent. It did not use or query protected Neon data. Only synthetic test signing key, fake numeric user IDs and synthetic SHA digests.

## Executed checks, observed results

| Exact command / gate | GitHub job evidence |
| --- | --- |
| `actions/checkout@v4`, `actions/setup-node@v4` (`node-version:24`) | PASS; `git rev-parse HEAD=08121cd05f58348e2a8db20a98cc22cc7f4625b1`, `node v24.22.1` |
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS |
| `npm run scope:changed -- 'app/(protected)/export/actions.ts' 'app/api/backups/[id]/route.ts' 'tests/v381-data1e3-stored-recovery-guards.test.ts'` | PASS (planner; **not** application testing) |
| `npm run test:target -- tests/v381-data1e3-stored-recovery-guards.test.ts` | **3 tests PASS, 0 FAIL, 0 SKIP, 0 CANCELLED** |
| `npm run typecheck` → `tsc --noEmit` | **PASS** |

The three actual test names:
1. `DATA-1E3 D1: stored v13 HMAC binds account/version/digest, not database digest alone`
2. `DATA-1E3 D1: stored v13 is rejected before preview or restore and pre-restore writes`
3. `DATA-1E3 D3: backup download errors do not leak internal exceptions and stay private/no-store`

**Source-test limitation:** the HMAC helper test exercises real pure signing/verifying code, while source-order/error-shape tests inspect file text. They do **not** prove actual signed v13 HTTP download, user session authorization, pre-restore DB side effects, invalid persisted rows, legacy real stored archives or concurrent restore behavior. Test results are SHA-bound and must not be promoted to production acceptance.

## Required candidate risk gates, not run

The exact planner classified the touched paths as `data-recovery`; risks `browser-ui,domain-data-integrity,persistence-schema,test-contract,ui-contract,unowned-test`. It returned:

- `typecheck=true` → performed, PASS.
- `postgres=true`, `browser=true`, `fullTests=true`, `build=true`, `scale=false`; `testGroups=ui-contract`; `requiredEvidence=application-source-contract,browser-acceptance,domain-unit,postgres-acceptance`.
- Remaining `npm test`, `npm run build`, selected UI-contract/source/domain, isolated local PostgreSQL16, authenticated browser and exact candidate `verify:release:risk` **NOT RUN**.
- `unowned-test` means the new `v381-data1e3-stored-recovery-guards.test.ts` requires module/test-group registry ownership assessment. Do **not** loosen planner/thresholds to obtain a green release gate.

## Scope and safety

**DONE:** non-DB Node24 targeted and typecheck gate; temporary workflow cleanup.  
**NOT DONE:** D2 valid-size inventory/cap design and D4 transactional protected-flight/FSTD/audit hardening; both have explicit owner-approved *direction* but require independent isolated acceptance. DATA-1 remains **NOT RELEASE-READY**. No migrations, remote SQL, feature flags, merge, production deployment or Training changes. Neon retains exactly three original projects, and last verified Vercel deployment is READY on previously deployed SHA `55c8076e1eb8104c14392e15b272b33e0eb29607`; production DB/schema/flags UNKNOWN.

**ONE NEXT STEP:** build/approve an isolated local PostgreSQL16 candidate acceptance protocol and register the new test in the risk module registry before D4 SQL hardening; do not create a test DB or execute restore until its exact disposable target and safety controls are approved.
