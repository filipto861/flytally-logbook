# DATA-1E3 D4 — one-cluster Windows launcher: actual no-DB smoke evidence

**Recorded UTC:** 2026-10-30T11:11:44.720Z  
**Owner scope:** User explicitly approved exactly **one new local disposable PostgreSQL16 cluster on their Windows PC**, synthetic D4 test operations, and deletion of **only this newly created** isolated test instance. No permission for remote Neon/Shadow/Training/production DB, merge, deployment, production migration or flags.

## GitHub and changes

- Canonical Logbook `main@807f281e5870164b794d001480ecc84e0b45aea5`, parent [Draft PR #445](https://github.com/filipto861/flytally-logbook/pull/445) HEAD `d77deeb2dfb0c9312adf3fe6e2cce0d2471f5e86`; stacked D4 [Draft PR #446](https://github.com/filipto861/flytally-logbook/pull/446) branch `test/logbook-data1e3-d4-one-local-pg16-20261030`.
- Changed executor `tooling/data1e3-d4-owned-local-pg16.mjs` — Windows Node24 one-cluster physical process/port/data-directory and owned cleanup gate; frozen-source SQL probe `tooling/data1e3-d4-source-sql-risk-probe.mjs` — isolated synthetic F3 flight/FSTD and F9 audit interleaving and fail-closed status; operator [runbook](2026-10-30-data1e3-d4-single-cluster-windows-runbook.md).
- The preexisting DATA-1D 1/4/12MiB genuine Neon HTTP 3/3 PASS is a **separate transport** test and not used for signed-v13 app acceptance. The D1/D3 Windows 41/41 regression/group/typecheck evidence is likewise from an earlier separately frozen SHA.

## Actual Windows 2022 no-DB test ledger

[GitHub Actions #41046128147](https://github.com/filipto861/flytally-logbook/actions/runs/41046128147) job `124030546318`, checkout **`f3e73f6fd0f9ad6ff886ab0b98e0faa6229f9683`**, hosted `windows-2022`, Node.js **v24.22.1**:

| Observed verification | Status |
| --- | --- |
| `node --check tooling/data1e3-d4-owned-local-pg16.mjs` | **PASS** |
| `node --check tooling/data1e3-d4-source-sql-risk-probe.mjs` | **PASS** |
| Missing expected SHA denied before any DB | **PASS** |
| Execute without confirmation denied | **PASS** |
| Probe refused in CI environment | **PASS** |
| Full execute refused in CI environment | **PASS** |
| Risk SQL probe refused when not called inside owned cluster | **PASS** |
| No PG process, no initdb, no connection or SQL | **Confirmed by workflow structure** |
| Source SQL collision run against actual owner-local PG16 | **NOT RUN** |
| Existing PostgreSQL security/restore integration | **NOT RUN** in this hosted smoke |
| Full signed-v13 HTTP/browser/production candidate release risk | **NOT RUN** |

First hosted diagnostic [#41046033334](https://github.com/filipto861/flytally-logbook/actions/runs/41046033334) failed **after** all negative-case assertions because Windows PowerShell `$LASTEXITCODE` remained nonzero from the deliberately denied final command. Corrected the **temporary workflow only** by explicit successful exit after validating all negative cases; no product or executor behavior changed, rerun #41046128147 SUCCESS. No fake test PASS for a PG SQL operation.

Temporary workflow `.github/workflows/data1e3-d4-local-runner-smoke-temporary.yml` **deleted** after the successful smoke at `aa2632b3d0c979aa1a7b0b3e04c874928c0f1df5`; the final PR must not contain it.

## Test safety and interpretation

- Operator-local execute is **NOT RUN** until the owner runs the SHA-pinned script on their own Windows machine. This assistant does not have direct access to the user's PC.
- Executor uses one unique OS-temp PostgreSQL16 cluster, a private synthetic database/role and explicit physical-process/SQL identity preflight; then runs the existing synthetic `postgres-security-restore.test.ts` and a **deterministic source SQL** F3/FSTD/F9 negative probe. The latter is deliberately a **safety gate**: if it detects a collision overwrite/audit deletion, result is **D4_SAFETY_FAIL** and program should return nonzero, even when underlying PG test and resource cleanup passed.
- These tests do **not** prove full authenticated signed-v13 Next.js backup download/restore nor two live concurrent sessions. Runtime D4 fix, D2 size safety, PostgreSQL full release registry and browser acceptance remain outstanding.
- On normal completion, test cluster is removed only after verified PostgreSQL stop and owner-token/sandbox path match. An unverified running cluster is **retained**; do not manually delete without verified PID and path. No production data or real flight/GPS fixture ever used.

**ONE NEXT STEP:** owner runs Probe then Execute in a clean Windows Node24/PG16 checkout at a verified exact final Draft #446 HEAD, returns sanitized D4 phase JSON/status and exit code; independently evaluate any safe/unsafe SQL findings before proposing D4 code correction.
