# DATA-1D — real execution locations, Neon inventory and safe next gate

**Recorded:** 2026-10-29T19:39:08.007Z UTC. **Evidence:** GitHub read-only SHA / PR checks, assistant's local container file identity check, and Neon project/branch **metadata-only** listing. No database SQL, connection string retrieval, compute creation or mutation.

## Verified source and execution environment

- Logbook canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`; Draft [PR #438](https://github.com/filipto861/flytally-logbook/pull/438), `chore/logbook-data1d-offline-size-envelope-20261029` pre-checkpoint `a9f8d072a53bf124e2144abd922af4f49c97c295`, stacked on #437 → #436 → #435 → #434, independent from SEC-1 #432. Production deployment last observed READY at `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` from `55c8076e1eb8104c14392e15b272b33e0eb29607`.
- Three previous offline synthetic CLI results were produced in **ChatGPT's ephemeral Linux container** under `/mnt/data/data1d_offline/` (not GitHub Actions, Vercel, owner's Windows PC or Neon). Source `data1-synthetic-transport-size.mjs` local `git hash-object` exactly matches GitHub blob `70dedadf6bc2667b3dc083517d09015fbe2cc308`. Local Node **v22.16.0**; repo requires Node24, so Node24 acceptance remains **NOT RUN**.
- Existing aggregate results `small.json`, `medium.json`, `large.json` physically present and read back, byte counts match [integer-byte evidence](2026-10-29-data1d-offline-measurement-evidence.md). These are fabricated measurements, **not** current app unit-test or database acceptance evidence.
- All DATA-1 code/Node unit tests, TypeScript, build, PostgreSQL, Neon, browser and CI remain **NOT RUN**; no new tests in this checkpoint.

## Neon read-only metadata inspection (2026-10-29)

- Connected Neon account project list includes `Logbook Shadow`, `FlyTally Training Production` and `FlyTally Training Acceptance`.
- In **Logbook Shadow**, the *only ready active branch shown* is named `production` and has substantial existing data; other listed branches were **archived** and originated from parent data.
- **There is no verified empty/isolated Logbook test branch or independent clean DATA-1 synthetic project.** Names like Shadow or an archived “rehearsal” DO NOT establish data isolation. Do not use any of these branches for synthetic payload insertion, destructive acceptance, or transport stress tests. Training's databases are out of scope.
- The metadata listing used read-only API calls only: no Neon SQL, no role/credential changes, no branch creation, no data transfer/download. No claim is made about actual primary DB schema, record contents, production connection strings or privileges.

## Proposed isolated provider acceptance boundary (NOT AUTHORIZED / NOT RUN)

1. Owner explicitly authorizes creating/using a **new independently empty Logbook-only Neon test project**, after confirming quota/billing and isolation from real users. **Do not fork or clone the existing production/Shadow branch**, which could copy real user records.
2. Before connecting, record exact project+branch ID, no-protected-target assertion, independent synthetic-only database, compute endpoint, environment origin and controlled teardown; never infer that a name proves safety. Never load real backups, GPS exports or secrets into the test environment.
3. Run **only owner-authorized, bounded, synthetic, non-destructive test SQL** or separate disposable local PostgreSQL fixture per DEVELOPMENT.md; capture request/response byte-size telemetry without row contents. No remote destructive test, even on a test branch.
4. Verify Neon driver v1.1.0 real HTTP request/response size and two MVCC probes; separate stored-backup gzip/Base64 INSERT and SELECT envelope, actual time and memory. Do not use an unverified “64 MB” assumption or treat offline JSON as driver wire bytes.
5. Select an evidence-backed fail-closed envelope only after provider-size and legacy/large-account compatibility gates. Do not alter automatic backup semantics or invent fallbacks.
6. Production DB, migrations, restore/delete, flags, merges, deploy and Training remain prohibited without their own explicit owner approvals.

**ONE NEXT STEP:** obtain owner approval for a separately provisioned **empty** Logbook DATA-1 test environment (or choose a verified disposable local PG16 approach), then write and execute only narrowly authorized synthetic provider/transport measurements. Until then, DATA-1 is **BLOCKED FOR RELEASE**.
