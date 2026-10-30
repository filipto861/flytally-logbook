# DATA-1E3 D4 — A1 owner-local PG16 two-session acceptance: single-use runbook

**2026-10-30 | FIRST OWNER-LOCAL PG16 RUN FAIL at `5ac18ee02800b4cbb973ad4e0e561c9b1ce7b307`: physical isolation PASS, baseline 3/4 PASS and AC-20 duplicate `flights_pkey` FAIL, new four A1 race cases NOT RUN, owned stop/disposal PASS. The historical replay expectation was reconciled with intentional strict A1 parent insert; updated AC-20 positive/evidence snapshot and negative replay checks are code-verified only, PostgreSQL retest PENDING. Read [complete failure/reconciliation evidence](2026-10-30-data1e3-d4-a1-first-owner-pg16-ac20-reconciliation.md).**

**Exact repository:** `filipto861/flytally-logbook`. **Scope:** D4 **A1** staged parent flight/FSTD ID conflict rollback only. This branch is stacked over Draft #448, itself stacked on Draft #447. **Not** full DATA-1 acceptance, not full app/HTTP v13, not canonical full-v21 restore, and not A2 F9 audit cleanup or A3 F8 real counts.

## Test content, positive target and hard stops

- `tooling/data1e3-d4-a1-owned-local-pg16.mjs` is a separate purpose-specific copy of the already owner-run Windows PG16 single-cluster launcher. It insists on exact Git work SHA, matching `origin/test/logbook-data1e3-d4-a1-owned-pg16-20261030`, clean checkout, Windows Node v24, explicitly installed native `C:\Program Files\PostgreSQL\16\bin`, **no** inherited DB/PG/NEON/VERCEL/CI environment, exact execute token, and fresh OS-temp ownership sentinel.
- The launcher uses only a **newly created** `data1e3_synthetic` database, role `data1e3_owner`, ephemeral port on `127.0.0.1`, fresh PG16 data dir under OS temp, verified PostgreSQL physical PID+executable+commandline, SQL data directory/role/port/IP/version, and an ephemeral UUID ownership token passed to the child. No caller-supplied `DATABASE_URL`. No Neon, Shadow, Training, prod or other pre-existing local database.
- `--probe` creates **no** DB and makes **no** connection; `--execute` creates one disposable cluster, runs existing `tests/integration/postgres-security-restore.test.ts` 4-case baseline, then new source-backed A1 probe. Only after verified stop and matching owned sentinel it removes the **specific newly created** temp directory. Failed stop/ownership validation blocks deletion.
- `tooling/data1e3-d4-a1-source-sql-probe.mjs` refuses unknown/remote/cloud target and re-checks newly owned temp sentinel, localhost PG16 SQL identity, exact physical data dir before writing a namespaced synthetic fixture. It extracts real `flights`/`fstd_sessions` INSERT+UPDATE SQL from `lib/account-restore-v6.ts` and current active source definitions of audit/protection trigger functions from `lib/db-optimization.ts`. No invented SQL success path or bypassing original guards.
- Four **two-independent-real-psql-session** race fixtures: existing newly committed flight ID **certified/locked**, existing newly committed FSTD ID **certified**, **uncertified/unlocked** draft flight and **uncertified** draft FSTD. Session A reads absence after starting a transaction and adding a transaction-owned synthetic marker; session B commits the colliding row; session A runs actual source staged parent INSERT then UPDATE and must fail with PostgreSQL PK collision. Assert: original full JSONB record unchanged, all existing audit entries unchanged, and preceding marker insert rolled back. Draft cases ensure success cannot be attributed solely to certification triggers.
- Positive branch: genuinely absent flight/FSTD IDs stage/update successfully with the source-defined protection+audit triggers. Assert certification hash fields set and expected flight audit INSERT and UPDATE events exist. Test's schema contains **selected source-defined trigger functions and fixture columns** and explicitly asserts `fullCanonicalV21:false`; this is not full production migration or authenticated `executeExactAccountRestore` invocation.

**Acceptance:** `D4_A1_ISOLATED_LOCAL_PG16_PREFLIGHT=PASS` (launcher emits `D4_ISOLATED_LOCAL_PG16_PREFLIGHT`), baseline 4/4 PASS, all four `D4_A1_*_TWO_SESSION=PASS`, positive source SQL PASS, `D4_A1_TEST_COMPLETE=PASS`, positive stop/disposal PASS, final owner summary testStatus PASS and PowerShell exit 0. Capture actual output; *do not relabel* a test as PASSED from a log string if process status or cleanup says FAIL.

## Operator commands (Windows PowerShell; run only after confirming current frozen SHA in the PR)

```powershell
$ErrorActionPreference = 'Stop'
if ((node --version) -notmatch '^v24\.') { throw 'Node.js v24 required.' }
Set-Location $HOME
git clone --branch test/logbook-data1e3-d4-a1-owned-pg16-20261030 --single-branch https://github.com/filipto861/flytally-logbook.git flytally-data1e3-d4-a1-local
if ($LASTEXITCODE -ne 0) { throw 'Clone failed.' }
Set-Location .\flytally-data1e3-d4-a1-local
if (git status --porcelain) { throw 'Expected clean checkout.' }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
# Set this to the exact 40-character, verified final PR HEAD supplied in the handoff.
$Sha = '<VERIFIED_FULL_SHA_FROM_LATEST_HANDOFF>'
if ($Sha -notmatch '^[a-f0-9]{40}$') { throw 'Unverified SHA. STOP.' }
if ((git rev-parse HEAD).Trim() -ne $Sha) { throw 'Unexpected HEAD. STOP.' }
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Dependency install failed.' }
node .\tooling\data1e3-d4-a1-owned-local-pg16.mjs --probe "--expected-sha=$Sha"
if ($LASTEXITCODE -ne 0) { throw 'Read-only physical preflight failed.' }
# This is explicit, synthetic destructive test authorization for one new owned local cluster ONLY.
node .\tooling\data1e3-d4-a1-owned-local-pg16.mjs --execute "--expected-sha=$Sha" --allow-synthetic-writes --confirm=DATA1E3-A1-LOCAL-ONLY
Write-Host ("A1 local PG16 exit code: " + $LASTEXITCODE)
```

If the directory already exists, **STOP**, do not overwrite it or silently delete an old fixture. The owner must independently check the repo/branch/full SHA and understand that `--execute` creates/mutates/destroys **only its own newly created disposable cluster**. Do **not** override identity failures, reuse a previous PG cluster, edit the script to add remote URLs, or run it against any Neon environment. Do **not** paste credentials, full OS paths, private flight/GPS records in chat; share sanitized phase/status/exit only.

## Evidence / limits at package preparation

- Source and launcher no-DB Windows Syntax/guard test [Actions #41072082996](https://github.com/filipto861/flytally-logbook/actions/runs/41072082996), Node v24, **3/3 PASS** at SHA `1a7347c009866ec1fc3361e30cd7630bb9eb50ea`; only `node --check` two files and source contract tests. Temporary workflow deleted after successful run.
- First no-DB run [#41071774572](https://github.com/filipto861/flytally-logbook/actions/runs/41071774572) **FAIL 2/3** from newly added static test using an incomplete two-argument `assert.equal` string instead of actual three-argument assertion including message; fixed source contract, no weakening A1 SQL check or runtime code. Failure retained in history.
- Actual new one-time PostgreSQL16 `--probe`/**`--execute`**, four two-session collision cases, positive SQL, cleanup and owner-PC environment **NOT RUN / UNKNOWN**. Native Windows PG16 executable presence on owner's machine known from historical older #446 test, but **not reverified** for this candidate. Production schema/migrations/flags **UNKNOWN**.
- A1 strict inserts and sanitized error on underlying Draft #448 Windows Node24 source tests 6/6 + typecheck PASS at old exact SHA `58e076eccec2f1212af7d92c3896050f0129de9e`; not real A1 DB proof.
- **DO NOT:** merge, deploy, migrate, change production flags, touch Logbook Shadow or Training, infer D4 full PASS from this test, change natural-key uniqueness without new owner decision, delete audit by ID floor, silently skip protected children. D2 gzip size policy still unimplemented, F9/F8 still open.

**ONE NEXT STEP:** owner runs the exact pinned, clean, one-use local Windows PG16 A1 probe and execute on their PC; review sanitized phase/status and process exit before marking A1 PostgreSQL acceptance PASS or FAIL. Then separately plan A2 audit provenance.
