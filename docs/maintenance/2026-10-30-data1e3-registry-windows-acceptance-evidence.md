# DATA-1E3 — registered recovery-contract Windows Node24 non-DB acceptance

**Written UTC:** 2026-10-30T10:53:44.188Z  
**Evidence:** [GitHub Actions run #41043848019](https://github.com/filipto861/flytally-logbook/actions/runs/41043848019), job **124022940337**, `windows-2022`, exact checkout SHA **`807d3d35129963cc67db69ff10882c3171846853`**, Node.js **v24.22.1**. Run + job **completed SUCCESS**, each required step SUCCESS. Does **not** prove a live application signed-v13 restore.

## Changed source and exact proof

- Canonical Logbook `main@807f281e5870164b794d001480ecc84e0b45aea5`, work Draft [#445](https://github.com/filipto861/flytally-logbook/pull/445), branch `fix/logbook-data1e3-v13-security-gates-20261030` based on Draft #444 `512bddf0405854f1c0fe5694b00ee09c8099cb5d` (stacked on Draft #443 `16a94e051037b680f7b08e97e8880e7967ada062`).
- `tooling/development-modules.json`: added `data-recovery-contract` application-source-contract group owning exactly `tests/v381-data1e3-stored-recovery-guards.test.ts` and selected it from module `data-recovery`. Risks: domain-data-integrity, persistence-schema, test-contract; conservative gate values postgres=true, browser=true, fullTests=true, build=true, scale=false. Existing `ui-contract` and module domain-unit tests retained.
- `tests/development-scope.test.ts`: source-backed regression for test ownership, correct source group/module mapping, no `unowned-test`, all PostgreSQL/browser/full Node/build and domain/source requirements preserved. No PostgreSQL partition registry, version, hash or pinned file changed.
- `docs/maintenance/2026-10-30-data1e3-d4-local-pg16-acceptance-gate.md`: D4 safety design and execution authorization boundary. This document is a plan only; **no test cluster is created**.
- Temporary GitHub workflow `.github/workflows/data1e3-registry-windows-temporary.yml` was used **only** to run isolated, non-DB Node24 and removed at commit **`c81e1d8e30a5bba2a54e3385cf704f17c24b7822`** after PASS. Production CI workflows unchanged.

## Exact executed commands and results

| Gate | Result / corroboration |
| --- | --- |
| Checkout, setup-node@v4, preflight | **PASS**: printed exact `TESTED_SHA=807d3d35129963cc67db69ff10882c3171846853`, `NODE=v24.22.1`; refused inherited `DATABASE_URL`, `POSTGRES_URL`, `NEON_DATABASE_URL`, `PGHOST`, `PGHOSTADDR`, `PGSERVICE`, `VERCEL`, `VERCEL_ENV`; did not create/use DB |
| `npm ci --ignore-scripts --no-audit --no-fund` | **PASS** |
| `npm run test:target -- tests/development-scope.test.ts tests/development-pipeline.test.ts tests/v381-data1e3-stored-recovery-guards.test.ts` | **PASS: 41/41; 0 FAIL, 0 SKIP** |
| `npm run test:group -- data-recovery-contract` | **PASS: 3/3; 0 FAIL, 0 SKIP** (re-runs the same 3 recovery test cases; don't inflate distinct test count) |
| `npm run scope:changed -- 'tests/v381-data1e3-stored-recovery-guards.test.ts' 'app/(protected)/export/actions.ts' 'app/api/backups/[id]/route.ts'` | **PASS**; group `data-recovery-contract,ui-contract`; no `unowned-test`; typecheck=true, postgres=true, browser=true, full_tests=true, build=true; requiredEvidence `application-source-contract,browser-acceptance,domain-unit,postgres-acceptance` |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** |
| PostgreSQL16, migrations, app HTTP, signed v13 restore, browser, full Node suite, build, risk release | **NOT RUN**; not declared PASS, not N/A |

**Earlier separately verified:** D1/D3 targeted 3/3 and typecheck PASS on Windows Node24 at SHA `08121cd05f58348e2a8db20a98cc22cc7f4625b1`; real synthetic Neon stored HTTP 1/4/12 MiB 3/3 PASS at older source SHA `60affbabda8e377656c9a6ec82e63e227803929d`, authorized cleanup PASS. No new remote provider or application acceptance ran here.

## Scope, limits, and next gate

The immutable PostgreSQL partition registry remains **42 registered files, 164 cases, 6 physical groups**. A future new D4 integration test must go through a separately reviewed schema/partition/hash/fixture update, not silently bypass this gate. The D4 plan mandates positive physical verification of a fresh **127.0.0.1 PG16**, unique port/PID/data directory, synthetic-only account/flight evidence and exact-ID cleanup. Existing `run-auth-browser.mjs` can drop public schema; it must never be pointed at a pre-existing local database, remote Neon, Logbook Shadow, Training or production. No test cluster/prod SQL was operated by this GitHub run.

**No merge, deploy, DB migration/restore/flag changes or Training work.** DATA-1 **NOT RELEASE-READY**; D2 and D4 source issues still open. Production DB/schema/flags **UNKNOWN**; Neon project inventory previously only the three original protected projects.

**ONE NEXT STEP:** owner explicitly authorizes provisioning and destructive synthetic testing **only** in a newly created positively identified *local-only PostgreSQL16 disposable cluster* per the D4 protocol, including exact-directory deletion after testing. Only then design/test D4 SQL changes against that target; do not create a cloud Neon test project.
