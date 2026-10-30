# DATA-1E3 D4 — owner Windows run #2: IPv4 CIDR identity mismatch, narrow correction, synthetic fixture fix

**UTC recorded:** 2026-10-30T11:35:11.401Z  
**Status:** owner-local PostgreSQL process startup progressed, database identity assertion **FAIL BEFORE BASELINE SQL**; baseline restore and F3/F9 tests **NOT RUN**; owner wrapper's own test-cluster disposal **PASS**; non-DB Windows test **3/3 PASS** on corrected source SHA. No real signed-v13 application or production restore.

## Owner report (verified against previous executable source)

- Owner clean local Windows PowerShell checkout fast-forwarded from `c9a0ffb97c559e4b7e1139217f4cd110a46e0a51` to **`7a2ffaaec4d9c3812d3a0c74071d714aa034895d`**. SHA comparison and working directory clean; Probe `PASS`, `platform=win32`, Node `v24.19.0`, native PostgreSQL16 bin path `C:\Program Files\PostgreSQL\16\bin`.
- Execute preflight raised a strict assertion `Expected values to be strictly equal: actual '127.0.0.1/32'` at `verifyIdentity()`. That matches previous source `inet_server_addr()::text AS addr` where PostgreSQL inet text representation includes a /32 CIDR mask. It does **NOT** imply an external network endpoint, nor a passed full DB identity check; only the address assertion failed before subsequent PID/datadir/version/port verification.
- Executor emitted `D4_LOCAL_PG16_DISPOSAL` `status:PASS`, `onlyOwnedTempDirectory:true`, `postgresStopped:true`; this is **owner-provided local wrapper evidence**, not an independently observed local OS verification. Final `D4_TEST_COMPLETE`: `testStatus:FAIL`, `baselineStatus:NOT RUN`, `securityStatus:NOT RUN`, `isolation:NOT VERIFIED`, `cleanup:STOPPED`, `sourceSha=7a2ffaaec4d9c3812d3a0c74071d714aa034895d`, PowerShell exit `1`. No logged baseline SQL test or app restore. New attempt will use a new one-time local test cluster.

## Strict source fix and preventive fixture audit (PR #446 only)

- `tooling/data1e3-d4-owned-local-pg16.mjs` and `tooling/data1e3-d4-source-sql-risk-probe.mjs`: change `inet_server_addr()::text AS addr` to built-in `host(inet_server_addr()) AS addr`. **Both still require exact `127.0.0.1`** and their existing data-directory, PG16, user, port and physical process identity controls; no permissive CIDR stripping or acceptance of any alternative address.
- Discovered from source review of `lib/account-restore-v6.ts` that the synthetic SQL interleaving fixture had empty-string timestamps which would fail PostgreSQL `json_populate_record` before reaching its intended F3/F9 assertions. Changed only synthetic `certified_at` and `locked_at` fields to JSON `null`; actual product SQL/restore path untouched. This is defensive test-fixture correctness, NOT an executed SQL test.
- New `tooling/data1e3-d4-pg-identity-contract.test.mjs` checks both sources use PostgreSQL native inet host extraction, exact loopback comparison, data-directory/version and process ownership, verified stop-only cleanup and timestamp fixture values.
- **Hosted Windows 2022 / Node v24.22.1 [GitHub Actions #41048944489](https://github.com/filipto861/flytally-logbook/actions/runs/41048944489)** job `124039917251`, exact tested commit **`ca8dd9486f6405234e54581a59df093d2c1a4ff9`**, completed **SUCCESS**; `node --check` for both scripts and regression file **PASS**; `node --test tooling/data1e3-d4-pg-identity-contract.test.mjs` **3/3 PASS** (zero failures), no initdb/PG server/SQL/restore. Temporary workflow removed after this run at commit `be5751ed3dcc06378152fb745702dff20d1bdcf6`.
- The tests prove source-order/contract and fixture shape, **NOT an actual repaired PostgreSQL SQL identity or runner execution**; real owner-local code still to be run. Historical no-DB Windows pg_ctl pipe fix [Actions #41047852446](https://github.com/filipto861/flytally-logbook/actions/runs/41047852446) had separate 2/2 PASS on older SHA.

## Risk ledger and scope

- Main `807f281e5870164b794d001480ecc84e0b45aea5` verified, Draft [#446](https://github.com/filipto861/flytally-logbook/pull/446) on `test/logbook-data1e3-d4-one-local-pg16-20261030` stacked on Draft #445 `d77deeb2dfb0c9312adf3fe6e2cce0d2471f5e86`. PR remains Draft; no production changes or merge.
- **PASS:** owner read-only probe, Windows static regression 3/3, GitHub workflow job success; disposal PASS *as reported by owner-local tool*.
- **FAIL:** owner-local exact older candidate execute stopped at strict IP formatting assertion, no executed D4 test.
- **NOT RUN:** verified completed PG identity, legacy synthetic PostgreSQL restore integration, source SQL F3/FSTD/F9 risk reproduction, true two-session restore, signed-v13 authenticated app GET/restore, full Node/build/browser/risk release.
- **UNKNOWN:** production DB/schema/migration/flags; vendor hard HTTP max; D4 exploitability until actual source SQL probe.
- **DO NOT:** weaken strict localhost or process/data directory gates, execute on remote/protected Neon/Logbook Shadow/Training, handle private flight/GPS, silently choose D2 sizes, merge, deploy or change prod flags. New local Execute explicitly creates another new owner-authorized disposable single-cluster fixture after prior tool reported disposal PASS.
- **ONE NEXT STEP:** give owner the exact final PR #446 full SHA and clean fast-forward, read-only Probe, then opt-in single-local-cluster Execute; reconcile actual sanitized phase outputs before any D4 SQL product change.
