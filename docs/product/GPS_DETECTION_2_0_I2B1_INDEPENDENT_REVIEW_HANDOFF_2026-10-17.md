# FlyTally GPS Detection 2.0 — I2-B1 independent security review

**Review type:** READ-ONLY SOURCE REVIEW, no execution. **Date:** 2026-10-17.
**Repository:** `filipto861/flytally-logbook`
**Tested executable commit:** `ae1eb81c35ea27b56798e30b37ce4cacc2ef46a8`
**Branch:** `docs/gps-r21-p0-d3-native-pg16-readiness`
**PR:** [#359](https://github.com/filipto861/flytally-logbook/pull/359) (Draft, unmerged).
The latest docs-only commits after the tested SHA are not new execution evidence. Review the exact five I2-B1 source files at the tested executable SHA or verify their blobs against the hashes below.

## What is actually verified

Owner ran Windows PowerShell in an exact clean checkout (HEAD verified, `git status --porcelain` empty):
- `node --check` on both I2-B1 `.mjs` files: **PASS**.
- `npm run test:target -- tests/gps-r21-p0-d3-native-pg16-guards.test.ts tests/gps-r21-p0-d3-native-pg16-i2-offline.test.ts tests/gps-r21-p0-d3-native-pg16-i2b1-inventory.test.ts`: **20/20 PASS**, 0 fail, skip or cancelled.
- `npm run typecheck` / `tsc --noEmit`: **PASS**.
- **NOT RUN:** positive invocation of the PowerShell 5.1 inventory probe; actual Windows PowerShell parse/CLI positive path; independently attested token, trusted ACL, live postmaster identity; any native cluster creation/start/stop, PostgreSQL SQL/RLS; full suite/build/browser/CI, production/Neon or real GPS authorization.
- I1 12 and I2-A 3 cases are included in the 20; **5** are new I2-B1 cases. The total does not establish 20 distinct independent security boundaries.

## Exactly reviewed source, pin by blob

- `research/gps-r21-p0-d3-synthetic-security/read-native-pg16-i2b1-inventory.ps1`: `6f9d0ae1f04cef29e6c57f827d145779ab81ffe2`
- `research/gps-r21-p0-d3-synthetic-security/run-native-pg16-i2b1-inventory.mjs`: `9af1fc6f4dc7b212ec101d9800d01468ca034415`
- `research/gps-r21-p0-d3-synthetic-security/native-pg16-i2b1-inventory.mjs`: `9185f7a5e3503c749f0eb1c63f781461fc887724`
- `research/gps-r21-p0-d3-synthetic-security/native-pg16-i2b1-inventory.d.mts`: `b023437ed84bc1183b234654b86e18eea38a9be4`
- `tests/gps-r21-p0-d3-native-pg16-i2b1-inventory.test.ts`: `ee6304b2ecde0fadcbc5227ab4a4fb5260065b15`

For complete design and original corrections, read:
- [I2-B1 scope and prior gating](GPS_DETECTION_2_0_R2_1B_P0_D3_NATIVE_PG16_I2B1_WINDOWS_INVENTORY_2026-10-17.md)
- [Native PG16 safety design](GPS_DETECTION_2_0_R2_1B_P0_D3_NATIVE_PG16_READINESS_2026-10-17.md)

## Frozen boundaries

Only research; no production GPS engine, authenticated read-only data access, other-account tracks, DB schema/migration, or Training changes. Existing Windows services `postgresql-x64-16` and `postgresql-x64-18` must remain untouched. Future optional native PG16 must have exclusive isolated owner-controlled PGDATA, exact version/loopback/SCRAM/HBA preflight, independently verified server path/system identifier/nonce before any DDL, and fail-closed process/cleanup identity. No Docker dependency. No PostgreSQL startup or SQL without separate owner approval.

I2-B1 inventory **MUST NOT** be mistaken for Windows trust attestation. It explicitly sets `aclTrusted=false`, `identityAttested=false`, `runtimeAuthorization=false`, `permitsClusterMutation=false`, and every accepted result has `permitsRuntime=false`.

## Reviewer challenge (please do not execute anything)

1. **Potential HIGH preflight issue:** `run-native-pg16-i2b1-inventory.mjs` reads `process.env.SystemRoot`, checks only Windows absolute/non-UNC shape, then calls the derived `System32\\WindowsPowerShell\\v1.0\\powershell.exe` path. Could a user-controlled environment redirect invocation to another binary? If so, propose a minimal fail-closed correction and adversarial test. Do **not** merely assert `SystemRoot` is always trusted.
2. Is `[Security.Principal.WindowsPrincipal]::new(...)`, `$services[$name] = if (...) { ... } elseif ...`, multi-line `if` and hashtable expressions correct in **Windows PowerShell 5.1**? Node static tests are not PS5 parser tests. Propose an explicit, non-mutating PS5 parse gate before any positive inventory execution.
3. Is the child environment allowlist enough to prevent accidental credential leakage or execution redirection? Distinguish `PATH`, `SystemRoot`, `WINDIR`, PowerShell profiles (`-NoProfile`), explicit `-ExecutionPolicy Bypass`, script-path symlink/junction issues, and inherited handles.
4. Is `WindowsPrincipal.IsInRole(Administrator)` a useful non-elevation signal, and what evidence would actually prove the effective token and its ownership? Do not promote a `false` check into attestation.
5. Does `Probe-Path` with `Get-Item` and `Get-Acl` report only the final component rather than ancestor junction/ACL trust? Could a probing race or inaccessible ACL be misclassified as safe? Under no circumstance should it claim writable-path safety.
6. Assess the current five Node tests: identify false positives and high-value dynamic mock cases. Source regex assertion is not an exhaustive non-mutation proof. Separate `unit/mock` vs `actual OS probe` vs `real RLS`.
7. Provide a bounded verdict **GO TO CORRECT/VERIFY READ-ONLY I2-B1** or **FIX BEFORE ANY POSITIVE PROBE**. Separately identify prerequisites for I2-B2 and I2-C; do not authorize DB runtime or real GPS analysis.

**Requested format:** prioritized findings with severity, exact file and code location, realistic exploit/failure scenario, minimal change, tests, and clear Do/Do Not. Label observations as source-only vs executed evidence. Review must not access private data or infer real-PostgreSQL RLS PASS.
