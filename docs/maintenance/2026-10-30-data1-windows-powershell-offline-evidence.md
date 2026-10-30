# DATA-1D — native Windows PowerShell offline wrapper verification (2026-10-30)

**Status: WINDOWS POWERSHELL OFFLINE WRAPPER PASS 4/4; REAL NEON HTTP INSERT/SELECT NOT RUN.** This evidence is SHA-bound, not signed application backup/release acceptance.

## Frozen GitHub baseline and scope

- Canonical Logbook `main@807f281e5870164b794d001480ecc84e0b45aea5`; [Draft #443](https://github.com/filipto861/flytally-logbook/pull/443) stacked onto Draft #442 base `bb60178bebdbb7b0242474bc7b0fedfd99268567`.
- Existing locally prompted `tooling/data1-neon-http-store-local.ps1` was *not* weakened or modified. Added `tooling/data1-neon-http-store-local.windows.test.ps1` (permanent narrowly scoped offline test); ephemeral `.github/workflows/data1-windows-http-wrapper-temporary.yml` was used solely to invoke it on a real hosted `windows-2022` PowerShell 7 runner, then deleted on work branch at commit `d161ccb36513db0307c7874dc54812c58b090652`.
- The Windows test temporarily overrides `Get-Command node` by placing a synthetic local `node.cmd` earlier in PATH, asserts the fake executable was selected, and supplies an obviously fabricated, invalid test URL through its local `Read-Host` mock. No Neon credential, account export, GPS, network request or genuine Node SQL executed. CI is cleared **inside the offline test process only** to permit exercising an otherwise correctly CI-denying production-local wrapper; this is not a change to the wrapper's production guards.
- Real `tooling/data1-neon-http-store-gate.mjs` code remains unchanged by this milestone. No production app source/schema/migrations/flags/Training/deploy changes.

## GitHub Actions Windows executions (retain failures)

| Workflow run | Exact tested HEAD SHA | Actual outcome | Diagnosis |
| --- | --- | --- | --- |
| [#41028283436](https://github.com/filipto861/flytally-logbook/actions/runs/41028283436) | `93d9bb6cea820352fc65b6c50c874ccd77b72408` | **FAIL** | Probe and Execute passed, negative fake-node failure injection did not propagate |
| [#41028395986](https://github.com/filipto861/flytally-logbook/actions/runs/41028395986) | `95e5b4fe6975d57d290d1e8df8eea2b3d4036f8b` | **FAIL** | Marker-based negative fixture still placed after cmd arguments, negative exit not observed |
| [#41028507719](https://github.com/filipto861/flytally-logbook/actions/runs/41028507719) | `351ebf727e8981c9a18e2f7c214140e81101b323` | **FAIL despite all four assertion summaries PASS** | Fake node marker check moved before argument parsing; exception propagated and cleanup succeeded. PowerShell nevertheless propagated stale `$LASTEXITCODE=31` to final CI job, causing exit 1 after tests |
| [#41028595008](https://github.com/filipto861/flytally-logbook/actions/runs/41028595008) | **`dd5135acc633c506d2ec47e48c31ad7b69a9b5d1`** | **PASS: job completed/success** | Test-only cleanup restores final success exit code after all assertions; real Windows PowerShell wrapper successfully exercised |

The final successful Windows job `offline-powershell-mock` (job `123972599088`, GitHub Actions) verified:
1. `WIN-PROBE: PASS` — hidden URI prompt supplied via test-only fake `Read-Host`, fake `node.cmd` received synthetic-only env, no write authorization, process environment cleared.
2. `WIN-EXECUTE: PASS` — interactive confirmation returned `EXECUTE` via fake `Read-Host`, fake node received exact `--confirm` and write opt-in; environment cleared.
3. `WIN-FAILURE-CLEANUP: PASS` — fake node deliberately exited code 31, actual launcher threw expected error, `finally` cleared transient process environment.
4. `WIN-PROJECT-DENYLIST: PASS` — known existing Logbook Shadow ID rejected **before** hidden credential prompt.
The final log printed `DATA-1D WINDOWS OFFLINE WRAPPER: PASS 4/4; NO NEON REQUESTS`. Workflow completion also confirmed all checkout and cleanup steps success.

## Limits and cleanup

- **Not tested:** an actual user Windows workstation; real Neon SQL driver through the Windows wrapper; a newly provisioned empty Neon project; remote HTTP gzip/Base64 1/4/12 MiB INSERT and full SELECT; server-side signed-v13 restore and authenticated GET; provider HTTP maximum; application release risk ledger. These remain **NOT RUN/UNKNOWN**.
- Existing previous offline real-driver mocked HTTP (10/10 PASS) at different tested SHA `561e0b362b78786f147899568e3e752eae8e4304` and prior full Node24 1,775/1,775 PASS/typecheck/build at that SHA are separate evidence; do not promote them into a unified candidate-bound release PASS.
- The temporary GitHub Actions workflow was removed after the successful run. Hosted Windows GitHub runners are ephemeral. No Neon project, migration or flags were created/changed by these four workflow runs; do not confuse fake URI with a real provider connection. Production deployment and prod DB schema/flags still require independent checks and owner authorization.
- **DO NOT** create a new disposable Neon project merely to claim a tested HTTP envelope without a truly available trusted Node24 executor. Do not relay credentials between connectors or use the original three protected projects.
- **ONE NEXT STEP:** have the owner run the already verified PowerShell `Probe` and confirmed `Execute` on their trusted Windows Node24 machine against a newly approved, independently verified empty disposable Neon project with credentials entered locally only; collect actual remote HTTP byte/digest outcomes and verify exact-ID project deletion before release consideration.
