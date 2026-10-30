# DATA-1D — credential-local Neon HTTP stored gzip/Base64 test gate (2026-10-30)

**Status: exact-source Node24 offline/complete application gates PASS; real Neon HTTP database execution NOT RUN.** Do not treat a test harness or offline PASS as storage transport proof.

## Contract / source

- The source for this tool is tooling/data1-neon-http-store-gate.mjs, with isolated tool tests at tooling/data1-neon-http-store-gate.test.mjs.
- Exact parent Draft #442 HEAD bb60178bebdbb7b0242474bc7b0fedfd99268567; canonical main at discovery 807f281e5870164b794d001480ecc84e0b45aea5; #441 and upstream DATA-1 drafts unmerged.
- Existing lib/backup-center.ts uses gzipSync(level:9), 50 MiB compressed guard, SQL-parameterized Base64 payload insert, and Base64 decode + gunzipSync + parsed SHA-256 readback. This test reproduces transport **shape** only, not real signed v13, authenticated GET, or full restore.

## Security / execution model

The earlier Neon→Vercel cross-tool credential transfer was blocked. Do not circumvent it. Instead the connection string must originate and stay **inside the owner-controlled executor** (e.g. user's secured local Node24 session), with Neon project creation/deletion separately managed and confirmed.

- The script does **not** retrieve a connection string from a connector, create a Neon project, access real flight/GPS data, deploy, restore, drop tables or delete databases. Its only schema write is a dedicated synthetic table after a two-stage gate.
- Operator first obtains a **fresh standalone empty** Neon PostgreSQL16 project, never an existing Shadow or Training project; verifies its exact project ID and branch ID in the Neon dashboard, plus its dedicated database/role. Only this specific new resource can be used; an existing project must not be relabeled as disposable.
- The program requires explicit DATA1_SYNTHETIC_ONLY=1, named project and branch identifiers, dedicated synthetic_data1 / synthetic_data1_owner names, Neon hostname, Node24, locked driver @neondatabase/serverless 1.1.0, no inherited CI/Vercel/alternative DB environment. Known non-test IDs are hard-blocked. Project and branch IDs are supplied by the operator; **SQL alone cannot independently attest project identity**, so the operator's Neon-console preflight remains mandatory.
- --probe performs SQL SELECT only: PG16 version, role, database, 0 public user tables, server boot time; emits an identity-bound 20-hex confirmation token (no secret). --execute requires that token, DATA1_ALLOW_TEST_WRITES=YES_DISPOSABLE_ONLY, fresh repeated preflight (still empty), and then one CREATE TABLE.
- For each **approximately** 1, 4 and 12 MiB gzip size: generate random synthetic JSON (deliberately not a valid signed v13 backup), gzip level 9, Base64, parameterized INSERT, **separate** SELECT returning full encoded field, byte-for-byte Base64 and gzip comparisons, SHA-256 raw JSON equality and row size assertions. Each call measures actual driver HTTP request and response body bytes using fetchFunction, HTTP status, elapsed milliseconds and process RSS.
- Log only safe aggregate counters, status and truncated error class; never print SQL parameters, credentials, raw payload, GPS, names or user data. Stop on first failure. HTTP vendor **maximum unknown**, even if all three sizes succeed. 50 MiB cap is offline math only; no 50 MiB automatic cloud upload.
- **Mandatory cleanup is external, with explicit owner approval:** shut down any ephemeral compute, delete ONLY the newly created positively identified project ID, re-list original projects and verify the test ID absent. Preserve failure history. An executor script's successful completion does not prove cleanup.

## Owner-side executable Windows / Node24 guide — real Neon HTTP gate, NOT RUN

**Prerequisite owner action, no connector-to-connector secret relay:** This phase can execute ONLY in a trusted Windows PowerShell session owned by the operator. The ChatGPT connector can read Neon project metadata but cannot operate the owner's Windows terminal, nor safely forward a Neon database password into a separate Vercel/GitHub runner. Do not create another idle cloud test project just to attempt an unavailable execution path.

**1. Prepare the disposable target first.** In the [Neon Console](https://console.neon.tech/), manually create one **independent new** PostgreSQL **16** project dedicated to this single synthetic test, with **no data imported or branch copied from another project**. Ensure the branch has dedicated database `synthetic_data1` and role `synthetic_data1_owner`, no pre-existing public user tables. Record the *new* exact **Project ID** (`word-word-digits`) and **Branch ID** (`br-...`) from the Neon Console and visually compare the selected project's endpoint, database and role with its connection dialog. The original Logbook Shadow and both Training projects are prohibited. Agree separately on **deletion of this exact new project ID**, and do not proceed without that authorization and an achievable cleanup plan. The current three original IDs are `muddy-dust-14049657`, `frosty-recipe-46458686`, `dry-king-94424047`; the launcher hard-rejects them. If PG16 / dedicated database and role cannot be set up, mark the test **BLOCKED**, not PASS.

**2. Prepare a clean Windows Node 24 checkout.** In a *new interactive PowerShell session* (not CI, not a production deployment shell), with an authenticated GitHub account that can read the private Logbook repository:

```powershell
git clone --branch test/logbook-data1-local-http-executor-20261030 --single-branch https://github.com/filipto861/flytally-logbook.git
Set-Location .\flytally-logbook
git rev-parse HEAD
node --version
npm ci --ignore-scripts --no-audit --no-fund
```

Verify that the SHA matches the **current unmerged Draft #443** on GitHub and that Node reports `v24.x`. The last independently verified native-Windows offline wrapper source was `dd5135acc633c506d2ec47e48c31ad7b69a9b5d1`; later commits are documentation-only and workflow removal. If the work branch has changed in executable files, stop and obtain new exact-SHA verification. Do not install arbitrary dependencies, use `main`, or use Training repository files.

**3. Run read-only `Probe`.** Replace the **quoted sample strings** with the exact IDs of *your newly created test project* (the literal example IDs below are intentionally invalid and cannot be used). Leave the URI out of commands, chat, logs and repository files: the launcher asks for it interactively with hidden input.

```powershell
.\tooling\data1-neon-http-store-local.ps1 -Mode Probe -ProjectId 'REPLACE-with-new-project-id' -BranchId 'br-REPLACE-with-new-branch-id'
```

The script should print `READ_ONLY_PROBE`, database `synthetic_data1`, role `synthetic_data1_owner`, PG16 version, `tables=0`, and a **20-character hex proof**. **Crucial:** the Project and Branch IDs in this output are **operator assertions**, not independently proved by SQL. Cross-check them again in Neon Console. Any mismatch, unknown project identity, existing table, or failure means **STOP**.

**4. Execute only after independently checking the probe and authorizing writes.** Use *the same brand-new disposable Project/Branch IDs*, replace the sample proof with the actual 20-hex value, and accept the separate interactive `EXECUTE` prompt. The URI is entered again locally and **must be the same verified test-project connection**; it never belongs in an argument or pasted transcript.

```powershell
.\tooling\data1-neon-http-store-local.ps1 -Mode Execute -ProjectId 'REPLACE-with-new-project-id' -BranchId 'br-REPLACE-with-new-branch-id' -ConfirmToken '0123456789abcdef0123' -AllowSyntheticWrites
```

The displayed `0123456789abcdef0123` is **not a valid token for this target**; substitute the fresh proof. Expected test cases are only **approximately 1, 4 and 12 MiB compressed** synthetic payloads (actual sizes measured); each uses the pinned real Neon driver for a parameterized remote HTTP INSERT and a **separate** full-field SELECT, comparing Base64 text, gzip bytes, raw JSON bytes and SHA-256. Record `STORED_NEON_HTTP` statuses, HTTP body byte counts and command exit code. A successful 12 MiB case **does not establish the provider's maximum**, and a synthetic archive is **not** a genuinely signed v13 restore.

**5. Cleanup is mandatory, even on failure.** Using Neon Console or a separately authorized owner-controlled mechanism, select **only the exact new test Project ID**, confirm its identity once more, delete it with the owner's explicit project-specific approval, and refresh the project list: the test ID must be absent and the original three project IDs must remain. The script intentionally does not remove cloud projects. Clear terminal history **only if it inadvertently contains secrets**, and do not paste URI/password, full debug traces or account data into ChatGPT. Report only sanitized `Probe` identity/metadata, test sizes/status/byte counts, the SHA used, and the independent cleanup result.

**Security limits:** The Windows helper keeps a plaintext URI briefly in its own process environment for the child Node process and clears it in `finally`. Privileged local processes or a compromised workstation may still observe it; this is **not** cryptographic secrecy against a local administrator. The stored HTTP gate remains **NOT RUN** until supported by an actual remote request/response log from this process and independently verified project cleanup.

### Original direct commands (for operators already using a secure local secret manager)

## Owner-side commands (PowerShell with Node 24)

The example intentionally omits entering a DATABASE_URL; use the owner's secure local environment / secret handling, **not shell command history, chat or GitHub**. Never use a connection string copied from an existing Logbook Shadow or Training project.

1. Ensure the new project was independently created, its role, database, hostname and branch verified, and that its SQL public schema is empty.
2. On a clean checkout at an exact Draft SHA run npm ci (normal project lockfile). Do not run npm install with arbitrary changed dependencies.
3. Configure these values in the **same local process environment**: DATA1_SYNTHETIC_ONLY=1, DATA1_EXPECTED_PROJECT_ID=<new project ID>, DATA1_EXPECTED_BRANCH_ID=<new branch ID>, DATA1_EXPECTED_DATABASE=synthetic_data1, DATA1_EXPECTED_ROLE=synthetic_data1_owner. Supply DATABASE_URL *locally only*. Leave DATA1_ALLOW_TEST_WRITES unset for probe.
4. Execute:
   - node tooling/data1-neon-http-store-gate.mjs --synthetic-only --probe
   - Independently reconcile the returned project ID/branch, database and role with the Neon dashboard. The former two are operator assertions, not verified by SQL.
   - Set DATA1_ALLOW_TEST_WRITES=YES_DISPOSABLE_ONLY in that same ephemeral environment.
   - node tooling/data1-neon-http-store-gate.mjs --synthetic-only --execute --confirm=<20-hex-token-from-probe>
5. Record only sanitized numeric outcomes and exit code for each test. Clear sensitive environment data and externally delete/verify the disposable project by **exact ID**. Stop and investigate upon any identity mismatch, unknown table, HTTP failure, memory pressure or absent cleanup proof.

The tool is not an authorization to provision or delete a resource. A new disposable Neon project is not currently approved in this new slice; obtain explicit approval for each resource where policy requires it.

## Actual verification at initial code SHA b57b63a49615fc6eafad45d9c38818b8f704aa32

- Fresh isolated Vercel **Node v24.22.1** sandbox cloned the exact public Git SHA, confirmed git rev-parse HEAD equals b57b63a49615fc6eafad45d9c38818b8f704aa32.
- node --check tooling/data1-neon-http-store-gate.mjs **PASS**.
- node --test tooling/data1-neon-http-store-gate.test.mjs **PASS 5/5, FAIL 0, SKIP 0, exit 0** (CLI opt-in / invalid variants, strict Neon target denylist, bounded Base64+gzip and corruption rejection, probe token binding, Base64 maximum arithmetic).
- Repo package-lock resolves @neondatabase/serverless **1.1.0**; isolated sandbox npm ci --omit=dev --ignore-scripts returned exit 0. Driver runtime API inspection: neon(...).query === function, neonConfig.fetchFunction initially undefined and injectable. **NO database request was made**.
- Negative direct CLI run without DATABASE_URL refused with exit 1 and sanitized log, without attempting a database connection.
- No actual HTTP INSERT/SELECT, full v13 signed backup, browser GET, complete typecheck/build/full suite/PG or verify:release:risk was executed for this test-tooling Draft.
- No Neon project was provisioned in this slice; production DB/schema/flags unknown. No merge, deployment or Training change.


## Broader candidate-bound source verification (2026-10-30, same executable/test SHA)

The exact cloned source and executable test files remained at Git SHA b57b63a49615fc6eafad45d9c38818b8f704aa32; all commits after that source SHA on Draft #443 are documentation-only.

- npm run scope:changed -- tooling/data1-neon-http-store-gate.mjs tooling/data1-neon-http-store-gate.test.mjs **PASS**: development-infrastructure; typecheck=true, full_tests=true, build=true; PostgreSQL=false, browser=false, scale=false; application-source-contract and development-pipeline selected.
- npm ci --ignore-scripts --no-audit --no-fund **PASS**, Node24.22.1 isolated source clone.
- npm run typecheck **PASS, exit 0**.
- npm test **PASS 1,775/1,775, FAIL 0, SKIP 0, exit 0**.
- npm run build **PASS, exit 0**. This is a build on the candidate source tree, NOT deployed runtime.
- Independent synthetic random (no real account data) fixture profiler via makeSyntheticArchive in Node24: targets 1/4/12 MiB yielded raw 1,354,665 / 5,548,969 / 16,733,781 bytes; gzip level9 1,020,352 / 4,179,423 / 12,603,499 bytes; Base64 1,360,472 / 5,572,564 / 16,804,668 ASCII bytes. One isolated random run only; do NOT treat as provider throughput or vendor size limit.
- The sandbox session sbx_tiQXvxVL7CEVZZipvrVoEI88Gt92 was stopped successfully and **independently read back STOPPED**, persistent=false; no Neon project or connection credential was created, read or used in this iteration. Original three Neon projects have not been altered.
- Source/Node/typecheck/build are PASS only for tested SHA; standalone source files unchanged by later docs commits. Final SHA candidate-bound verify:release:risk evidence **NOT RUN**; real stored Neon HTTP INSERT/SELECT, signed-v13 app backup and browser GET **NOT RUN**; provider maximum **UNKNOWN**.

## 2026-10-30T08:24:15.279Z — Windows PowerShell secure launcher staged; exact-source Node24 verification

- Additional `tooling/data1-neon-http-store-local.ps1` is a **local interactive adapter**, not a cloud runner. It prompts for the disposable connection URL using `Read-Host -AsSecureString`, passes the URI only into the current process environment while invoking Node, clears environment and BSTR in `finally`, refuses inherited DATABASE_URL/CI/VERCEL/NODE_OPTIONS, and rejects three existing FlyTally project IDs before asking for the secret. It never creates or deletes Neon resources.
- The launcher still requires external owner verification of project ID/branch/empty schema; a console check is indispensable because PostgreSQL alone cannot cryptographically attest Neon project identity. This is **not** a bypass of the earlier blocked cross-tool credential transfer.
- Exact code/test/docs source SHA **`8ab50b3b75aa7e5af16d77761a2bd33309c4f897`** cloned into nonpersistent Vercel Sandbox `sbx_pYaw4krogy5rNcjzOhAHExTLiTdo` with **Node v24.22.1**, `git rev-parse HEAD` matched.
- `node --check tooling/data1-neon-http-store-gate.mjs`: **PASS**; standalone `node --test tooling/data1-neon-http-store-gate.test.mjs`: **6/6 PASS**, 0 fail/skip. Sixth test checks PowerShell source guards **statically only**.
- Scope planner `npm run scope:changed -- tooling/data1-neon-http-store-local.ps1 tooling/data1-neon-http-store-gate.test.mjs`: PASS, development-infrastructure; TypeScript=true/full Node=true/build=true; PG=false/browser=false/scale=false. `npm ci --ignore-scripts --no-audit --no-fund` **PASS**; `npm run typecheck` **PASS**; `npm test` **1,775/1,775 PASS**, 0 fail/skip; `npm run build` **PASS**, all at this exact SHA, process exit 0.
- **PowerShell runtime NOT RUN:** the isolated Node24 Linux sandbox had no `pwsh`; `Read-Host` and secret-lifecycle behavior were not exercised on Windows. Genuine Neon HTTP stored gzip/Base64 INSERT/SELECT **NOT RUN**, signed application v13 restore/download **NOT RUN**, actual provider max **UNKNOWN** and authoritative candidate `verify:release:risk` **NOT RUN**. No database credential was supplied to any connector in this milestone.
- **Cleanup PASS:** test sandbox stop acknowledged, independent get_session returned `stopped`, persistent=false. Read-only Neon list remained exactly three original projects (Logbook Shadow + 2 Training); no test project was created. Production deployment previously independently READY at app `55c8076e1eb8104c14392e15b272b33e0eb29607`; production DB/flags **UNKNOWN**. No merge, deployment, prod DB operations, Training or Claude.

**ONE NEXT STEP:** run the PowerShell `Probe`/confirmed `Execute` sequence on the owner's trusted Windows/Node24 system against a **new explicitly approved disposable, independently verified empty Neon test project**, record HTTP byte/digest evidence, and verify exact-ID deletion externally before any release decision.

