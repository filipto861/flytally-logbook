# FlyTally M0-B: owner-local Windows 11 PostgreSQL 16 / 164-test acceptance

**UTC checkpoint:** 2026-11-05T13:23:45.255Z. **Repo:** filipto861/flytally-logbook. **Main:** c9c2f60303236113a223942072311f5e37f876f7. **Tested executable:** 2b89f3a0ac41eab94dd8f805fcfadbffa82da446. **Work branch:** feat/logbook-m0b-v22-expand-candidate-20261104; Draft PR #469 stacked on Draft #468 0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9. Owner authorized testing locally on their own PC, not merge/deployment/remote DB operations.

## Requirements

Windows 11, ordinary Windows PowerShell 5.1, Git with permission to clone private GitHub repo, Node.js 24.x, and installed **native PostgreSQL 16** binaries under **C:\Program Files\PostgreSQL\16\bin**. Docker is not required. No Neon connection required. If any dependency is absent, first stop and provide the preflight error; do not guess paths or change an existing PostgreSQL service.

## 1. Create a separate clean clone

Run in an ordinary, non-admin Windows PowerShell window:

```powershell
$folder = Join-Path $HOME "FlyTally-M0B-PG16"
if (Test-Path $folder) { throw "The folder already exists. Choose a new, empty folder." }
git clone --branch feat/logbook-m0b-v22-expand-candidate-20261104 https://github.com/filipto861/flytally-logbook.git $folder
if ($LASTEXITCODE -ne 0) { throw "Git clone failed. Check GitHub access; STOP." }
Set-Location $folder
```

Do not overwrite or reset your existing Logbook clone. Private GitHub authentication may be requested during clone.

## 2. Safe preflight - NO database created

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tooling\run-m0b-owned-pg16-windows.ps1 -PreflightOnly
```

Only if it actually prints **PREFLIGHT PASS - PostgreSQL tests NOT RUN** may you proceed. The preflight verifies Git origin, clean worktree, exact work SHA matching freshly fetched origin, main SHA, Node 24, native PostgreSQL 16 and hash-pinned canonical inventory (42 files, six partitions, 164 cases). ExecutionPolicy Bypass affects this child PowerShell process only; no machine policy is changed.

## 3. Run the 164 cases in six fresh local PG16 clusters

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tooling\run-m0b-owned-pg16-windows.ps1
```

The wrapper installs locked Node packages with npm ci and then delegates to the existing trusted owned-PostgreSQL executor: **npm.cmd run verify:postgres -- --base origin/main** with explicit owned-PG16 environment flags. That executor creates six independent fresh local PostgreSQL 16 data directories on random loopback ports, verifies physical database/role/port/version, uses disposable fixture data, runs the protected 164-case test registry, stops its own clusters, and preserves temporary TAP/PG logs plus verified-summary.json. It does not connect to remote Neon or modify an existing local PostgreSQL installation/database. Inherited DB/PG/Neon connection environment variables are cleared only for the wrapper's child process and restored.

## Result and reporting

- The full run has **NOT RUN on owner's PC** as of this checkpoint. Do not attribute the earlier Docker CI PG16 proof to this six-partition Windows execution.
- On actual PASS, the script prints **LOCAL PG16 164/164 acceptance PASS** for the exact commit SHA and the trusted executor saves **verified-summary.json** under a unique Windows TEMP folder. A stopped cluster's logs and TAP reports are retained for verification, not uploaded automatically.
- Send the final PASS/FAIL/partial status, exact SHA and summary of six partition counts; redact any personal filesystem paths, credentials or private flight/GPS material.
- Any missing dependency, stale Git ref, non-clean worktree, unexpected environment/remote, schema or PostgreSQL identity mismatch must stop the run. Never relax pinned hashes or redirect fixtures toward production/Neon.

## Evidence and operational boundaries

**PASS** [GitHub Actions #42034781740](https://github.com/filipto861/flytally-logbook/actions/runs/42034781740) on source SHA 2b89f3a0ac41eab94dd8f805fcfadbffa82da446: Windows PowerShell 5.1 **syntax parse only**; Linux Node24 full tests/typecheck/build plus isolated Docker PostgreSQL V22 source/negative/race tests. The earlier CI failure #42033675344 was an overbroad static source matcher; first Windows parser job #42034471781 found no-BOM UTF-8 em dash incompatibility, corrected by enforcing ASCII source. Native Windows **full 164-case test remains NOT RUN** until owner executes this script.

V22 stays literal **OFF**, schema source version 21; no merge, deployment, production Neon SQL, migration, feature flag change, full-account Restore or Training change. Production M0-A Vercel READY dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub, source f8116a7311abbdc9e1a269e133fccd7f8533f5c0; production DB/schema/flags UNKNOWN. Separate legal review of owner UID witness/retention and Neon HTTP parity still required.

**ONE NEXT STEP:** Owner runs -PreflightOnly on a fresh clean PR #469 clone on Windows 11 and reports exact PASS/FAIL; after successful preflight, run the 164-case native PG16 gate and record the resulting SHA-bound evidence.
