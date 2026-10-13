# FlyTally 3.8.0 — Actual Neon HTTP SDK acceptance (isolated disposable branch)

**13 October 2026 · TEST-ONLY / UNVERIFIED UNTIL OWNER-RUN.** This nested Draft adds `tooling/verify-v380-neon-http-sdk.mjs` to execute **the installed application's `@neondatabase/serverless` package** against an isolated, connector-seeded Neon branch, in contrast to earlier connector-only scratch PG18 transactions.

## Preconditions — non-negotiable

- The test does **not** read `DATABASE_URL` and never changes production app schema, migrations, `lib/flight-trash.ts`, or actual flights. It only references `ft380_sdk_acceptance` scratch tables.
- A new, nonprimary Neon branch in `Logbook Shadow` must be created for each acceptance; the full URI/credential must be copied from the Neon dashboard directly to the owner's **local computer**. **Never paste a connection URI or password into ChatGPT, GitHub, files, screenshots or terminal logs.**
- A connector-only setup call must create scratch schema `ft380_sdk_acceptance`, three scratch tables (`trash`, `flows`, `restored_flights`) and `guard`, then seed manifest guard `(branch_id,nonce,expected_host)` and synthetic archive IDs 101/102/201/202/301. No `public` writes.
- Before **ANY SQL writes**, Node probe requires all five environment variables, compares the URI's full host to `FLYTALLY_NEON_SDK_TEST_HOST`, checks `.neon.tech`/database `neondb`/allowed URL options, then verifies an existing one-row **database-resident branch-ID/host/nonce sentinel** and a **pristine scratch fixture** with only SELECTs. If missing, mismatched, or already used, it refuses all writes. Branch identity cannot be inferred from the URL alone.
- Distinct actual disposable branch ID, endpoint hostname and sentinel nonce are provided by the tester at run time. They are **not** hardcoded in project source. No destructive reset; retries require new temp scratch schema/branch.

## Test evidence contract

1. Actual SDK `sql.transaction([sql.query(...), sql.query(...)],{isolationLevel:'ReadCommitted'})` successful flow INSERT + marker UPDATE **both commit**.
2. Late negative `amount_minor` CHECK failure after a valid row and marker UPDATE aborts entire SDK transaction; DB SELECT proves **0 rows and NULL marker**.
3. Two simultaneous HTTP SDK batches on **two DISTINCT trash IDs** with the same normalized synthetic key acquire a transaction-scoped advisory lock, then run a **separate next SQL statement** in READ COMMITTED: exactly one archived row marked and one new flight analogue.
4. Same-trash independent concurrent SDK requests: exactly one restore. `price_decimal::text` remains byte-precise across NUMERIC write/read.
5. No real `lib/flight-trash.ts` tagged SQL/full-v20 schema here; **the PG16 full-source tests are separate evidence**. Ordinary Create/Edit writers are outside this test's cooperative lock coverage.

## Final owner-local SDK test + verified full cleanup (13 October 2026)

**Acceptance: PASS (synthetic-only).** Owner Windows/Node24 executed `tooling/run-v380-neon-sdk-local.ps1` on branch `test/3.8.0-neon-sdk-http-acceptance`, code SHA last confirmed before this documentation update `890b8609d1715538a20b28c25f51ef54f6c89808`. Owner supplied complete safe output:

```text
Local URI format and pinned Neon host verified. Credentials are not printed.
PASS SDK disposable branch, host, nonce, pristine fixture
PASS HTTP SDK transaction commit
PASS HTTP SDK late monetary CHECK rollback
PASS HTTP SDK concurrent different-trash same-key serialization
PASS HTTP SDK same-trash collision + exact NUMERIC
PASS: real Neon SDK HTTP acceptance (scratch only). Delete temp branch separately.
```

The script used the project's installed `@neondatabase/serverless` HTTP driver and static parameterized query arrays with explicit READ COMMITTED. Test branch was the second isolated child `br-solitary-flower-b1t8okd4`, `ft-380-sdk-http-retry-20261013-tmp`, in Neon project **Logbook Shadow**, database `neondb`. Only scratch schema `ft380_sdk_acceptance` and synthetic data involved; no real logbook data or production branch SQL.

**Cleanup: PASS, independently verified.** Immediately after the user reported PASS, read target metadata and confirmed exact expected ID, name, parent `br-dark-math-b1snjzub`, `primary=false`, `default=false`, `ready`. Executed `delete_branch` for that ID. A fresh `list_branches` showed **four pre-existing branches only**: `production` (`br-dark-math-b1snjzub`), `sp2-safety-pilot-pic-acceptance`, `pre-v20-2026-10-07`, `general-pic-invitation-acceptance`. Confirmed the second temporary branch **absent**. The earlier first temporary branch `br-patient-waterfall-b10m3abc` had separately been deleted and confirmed absent. **No FlyTally 3.8.0 test child branches are left running.**

**Evidence limits:** This certifies the synthetic SDK HTTP transaction contract (commit, rollback, lock and precision) but **not** actual full-v20 `lib/flight-trash.ts` execution through Next.js, protected/void/shared/participant evidence, ordinary Add/Edit writer conflicts, schema v21 or release acceptance. Local PG16 full-source 7+5+7 PASS at `0bb5b4965f7234991ac4530a358eb8de48951a9d` is separate. No production merge, migration or deploy took place.

### Historical setup, preflight failure, and replacement (now completed)

## Retry after malformed clipboard — old branch cleaned, new isolated target ready (13 October 2026)

**First owner attempt** on previous temporary branch `br-patient-waterfall-b10m3abc`: local Node24 failed at `new URL(url)` with `Invalid Neon test URI` **BEFORE creating the SDK client or issuing ANY remote SQL**. No SDK HTTP transaction, rollback or concurrency test ran. Shell `Set-Clipboard -Value ''` raised `ArgumentNullException` on Windows PowerShell 5.1; the environment variables were cleaned by `finally`. Root cause of invalid clipboard contents is **unconfirmed**; do not assume credentials were wrong.

**Cleanup COMPLETE for first attempt:** verified name/parent/nondefault/nonprimary, deleted exact `br-patient-waterfall-b10m3abc`; fresh Neon branch list confirmed it **ABSENT**, with original four branches (including `production`) preserved.

**Correction authored:** `tooling/run-v380-neon-sdk-local.ps1` accepts pinned expected branch/host/nonce, reads clipboard, requires a **single plain `postgresql://` URI**, validates its host and `neondb` before populating any environment variables or calling Node. It prints **no URI, password or username** and clears environment variables in `finally`; replaces clipboard contents with a single space for PowerShell 5.1 compatibility. Node probe also returns an actionable secret-free invalid-URI error. The wrapper itself **has not yet been executed on owner Windows**.

### Current SECOND temporary branch (LIVE; delete after retry regardless of PASS/FAIL)

- Project: **Logbook Shadow** `muddy-dust-14049657`.
- Branch **`ft-380-sdk-http-retry-20261013-tmp`**, ID **`br-solitary-flower-b1t8okd4`**; parent `br-dark-math-b1snjzub`; explicitly verified **primary=false / default=false / ready**.
- **Pinned pooled hostname (public endpoint metadata, no password):** `ep-square-river-b1jjvpkl-pooler.c-5.eu-central-1.aws.neon.tech`.
- **New scratch-only nonce:** `f882344d-6a05-4e40-8f58-5313692e97c3`.
- Seeded exact fresh `ft380_sdk_acceptance` scratch schema with `guard_rows=1`, `trash_rows=5`, `flow_rows=0`, `restored_rows=0`. No writes to `public`, real flights or production branch.
- **Connection URI belongs in owner's local clipboard ONLY**, via Neon Console > Logbook Shadow > `ft-380-sdk-http-retry-20261013-tmp` > Connect > database `neondb`, pooled connection. **Copy just the raw connection string**, starting `postgresql://`, **not** a `psql` command, label, shell quotes or dashboard text. Never paste it into this chat, logs or GitHub.

**Corrected local run (after copying only the connection URI into the clipboard):**

```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-v380-neon-sdk-local.ps1 `
  -ExpectedHost 'ep-square-river-b1jjvpkl-pooler.c-5.eu-central-1.aws.neon.tech' `
  -ExpectedBranchId 'br-solitary-flower-b1t8okd4' `
  -ExpectedNonce 'f882344d-6a05-4e40-8f58-5313692e97c3'
```

The wrapper refuses malformed/wrong-host clipboard input **locally before any Node/Neon connection**. It cleans ephemeral environment values and overwrites clipboard with a space even on failure. The Node script still verifies the **database-resident** ID/host/nonce manifest and pristine scratch before any write.

**Mandatory next action after receiving PASS/FAIL output:** inspect exact second branch name/ID/parent, delete only `br-solitary-flower-b1t8okd4` and independently re-list branches to verify **absence and all four originals present**. If the owner delays/refrains from testing, delete the branch instead of keeping it indefinitely.

**Status:** SDK HTTP test **NOT RUN** on either branch; first attempt failed client-side URI preflight. New wrapper and second scratch target pending owner run. No production writes, migration, merge or deploy.

## Temporary Neon branch established (13 October 2026; SDK NOT RUN)

Owner had previously authorized creation and mandatory deletion of temporary branches for isolated FlyTally tests. Temporary child branch **`ft-380-sdk-http-acceptance-20261013-tmp`**, ID **`br-patient-waterfall-b10m3abc`**, parent **`br-dark-math-b1snjzub`** in **Logbook Shadow** project `muddy-dust-14049657`, database `neondb`, was created and independently verified `primary=false`, `default=false`, `current_state=ready`. Existing original branches untouched.

- **Pinned pooler endpoint hostname:** `ep-damp-tooth-b1ktlyz1-pooler.c-5.eu-central-1.aws.neon.tech` — hostname only, NOT a connection secret.
- **Scratch guard nonce:** `37d2df0f-b556-48a7-9418-26115e7a22bb` (not a credential).
- Only scratch schema `ft380_sdk_acceptance` created in the child, with `guard`, `trash`, `flows`, `restored_flights` and five synthetic test rows IDs 101,102,201,202,301.
- Connector post-setup SQL check showed `guard_rows=1`, `trash_rows=5`, `flow_rows=0`, `restored_rows=0`. **No SDK test has yet executed.**
- **Live temporary resource requiring deletion:** `br-patient-waterfall-b10m3abc`. After owner Node24 run **PASS OR FAIL**, verify exact nonprimary name/parent/id, delete precisely this branch, then independently list branches to prove absent and original four remain. Do not leave the temporary resource indefinitely.
- Owner local should copy the **pooled** connection URI matching the pinned hostname via Neon Dashboard branch connection details; never paste the URI/password into chat, GitHub or a committed file. Any direct/nonmatching host will fail closed.

## Owner local execution (only after temporary branch setup)

From the dedicated project branch with installed dependencies and Node24, set variables **in the current PowerShell process only**. Get the actual URI from Neon's **temporary branch connection details** and do not paste it in messages; the values `HOST`, `BRANCH_ID`, `NONCE` are separately displayed without password:

```powershell
git fetch origin
git switch test/3.8.0-neon-sdk-http-acceptance
git pull --ff-only
# Copy the temporary branch URI from Neon Dashboard, then:
$env:FLYTALLY_NEON_SDK_TEST_URL = Get-Clipboard
$env:FLYTALLY_NEON_SDK_TEST_HOST = "<TEMP_BRANCH_HOST>"
$env:FLYTALLY_NEON_SDK_TEST_BRANCH_ID = "<TEMP_BRANCH_ID>"
$env:FLYTALLY_NEON_SDK_TEST_NONCE = "<SENTINEL_UUID>"
$env:FLYTALLY_NEON_SDK_DISPOSABLE_ONLY = "isolated-branch-only"
try {
    node .\tooling\verify-v380-neon-http-sdk.mjs
} finally {
    Remove-Item Env:FLYTALLY_NEON_SDK_TEST_URL,Env:FLYTALLY_NEON_SDK_TEST_HOST,Env:FLYTALLY_NEON_SDK_TEST_BRANCH_ID,Env:FLYTALLY_NEON_SDK_TEST_NONCE,Env:FLYTALLY_NEON_SDK_DISPOSABLE_ONLY -ErrorAction SilentlyContinue
    Set-Clipboard -Value ""
}
```

**Never run** on the production branch or an existing work branch. On PASS or FAIL, supply output **without secrets**, then delete **only** the exact approved child via Neon branch API and verify its absence, retaining original branches. If owner does not run immediately, remove the branch rather than leaving long-lived test resources.

## Status

- Previous D2 native PG16 exact-head tests on `0bb5b4965f7234991ac4530a358eb8de48951a9d`: full typecheck + 7/7 v20 source + 5/5 lock/trigger + 7/7 PG16 SQL **OWNER-LOCAL PASS**. This proves cooperating Restore/Restore, not unrelated Add/Edit.
- Previous scratch Neon PG18 connector SQL transactions and rollback **PASS** on deleted branch `br-sparkling-leaf-b1giaanc`, cleanup verified; these are not SDK evidence.
- **New SDK script**: source authored, **Node24 SDK HTTP RUN NOT YET PERFORMED**, target branch creation/seed/cleanup pending. No merge, registered migration v21, CI/build/browser/prod deploy, or Training change.
