# GPS Detection 2.0 — I2-B1 independent review reconciliation

**Date:** 2026-10-17. **Repository:** `filipto861/flytally-logbook`.
**PR:** [#359](https://github.com/filipto861/flytally-logbook/pull/359), Draft / research only.
**Review origin:** Owner-forwarded DeepSeek report (87 lines), verdict **FIX BEFORE ANY POSITIVE PROBE**.
**Reviewer limitation:** Explicitly **did not inspect** the five source files, did not receive full design, and did not execute Node, PowerShell 5.1, PostgreSQL or SQL. This is a design/handoff review, NOT independent source-level PASS. ChatGPT independently read the five GitHub source blobs before patching.

## Verified earlier local baseline

Owner clean exact executable SHA `ae1eb81c35ea27b56798e30b37ce4cacc2ef46a8`: I1 12 + I2-A 3 + I2-B1 5 = **20/20 targeted Node PASS**, both I2-B1 `node --check` PASS, `npm run typecheck` PASS. **NOT RUN** actual PS5 parser or positive inventory, Windows ACL/token trust or actual PostgreSQL SQL/RLS. These results must NOT be inherited by changed implementation SHA.

## Decision — deliberately close unsafe entry point, not invent binary attestation

Before any positive probe, disable `run-native-pg16-i2b1-inventory.mjs` unconditionally, including on `--read-only-inventory`. **No `child_process`, no native executable resolution, no process/environment forwarding, no PowerShell invocation.** This makes the previously exploitable `SystemRoot`-derived executable launch path unreachable. This is **NOT** an attested safe PowerShell launcher; it remains intentionally unavailable until a separate, reviewed source + actual Windows trust implementation exists.

The separate `check-native-pg16-i2b1-ps51-parse.ps1` reads and AST-parses only `read-native-pg16-i2b1-inventory.ps1` on Windows PowerShell 5.1 and includes an invalid in-memory `ParseInput('if (')` negative control. Neither script creates/starts/stops PostgreSQL or issues SQL. The parse-only script is **NOT YET OWNER-RUN**; Node static contracts cannot replace actual PS5 parsing.

The observational token field `elevated` was misleading because `WindowsPrincipal.IsInRole(Administrator)` is not a full token-elevation attestation. Rename the observation to `adminRoleObserved` and conservatively refuse when true, while continuing to emit `identityAttested=false`, `aclTrusted=false` and `permitsRuntime=false`. Do not infer an effective token integrity level or security proof from either boolean value.

## Source-checked disposition of reviewer findings

| Finding | Source reconciliation | Patch / remaining gate |
| --- | --- | --- |
| I2B1-01 HIGH `SystemRoot` | **Confirmed**: old launcher resolved `powershell.exe` from inherited `process.env.SystemRoot`. | Unsafe launch path **removed by unconditional CLI refusal**, including hostile fake roots. Trusted positive executable resolution remains **NOT IMPLEMENTED / NO-GO**. |
| I2B1-02 HIGH PS5 parsing | **Confirmed**: 20 targeted Node tests did not run Windows AST parser. | Separate self-falsifying parse-only PS5 gate authored. **Windows parse execution NOT RUN.** Positive probe still blocked. |
| I2B1-03 MED child env | Old launcher forwarded `PATH`, and `SystemRoot` was untrusted; no explicit `PSModulePath` forwarding in object, but inherited environment was material. | All child process spawn/environment forwarding removed. A future executable launcher needs complete re-review. |
| I2B1-04 MED `ExecutionPolicy Bypass` | Old launcher supplied Bypass; this never constituted an executable authenticity check. | Launcher disabled. No new bypass. |
| I2B1-05 MED script path | Source path was taken from Node module directory without full ACL/reparse-chain attestation. | Remains **OPEN** for any positive execution; parse-only reading has no execution authority. |
| I2B1-06 MED admin-role semantics | Actual PowerShell code computed `IsInRole(Administrator)` and called it `elevated`. This is not token integrity/elevation proof. | Rename to `adminRoleObserved`; refuse positive signal. Full Windows token/owner attestation **NOT IMPLEMENTED**. |
| I2B1-07 MED path ACLs | Actual `Probe-Path` inspects each named path individually, not every ancestor. It always outputs `aclTrusted=false`. | Not misrepresented as trust; complete ancestor walk / ACL ownership / TOCTOU mitigations **OPEN** before runtime adapter. |
| I2B1-08 LOW-MED tests | Old source regex checked only certain disallowed command strings; not exhaustive non-mutation proof. | Add dynamic positive-mode refusal tests under forged `SystemRoot`, `PATH` and inherited credentials, plus parse-gate source assertions. Native Windows parser must still run. |
| I2B1-09 LOW handles | Old code used `spawnSync`, `shell:false`, bounded timeout and `maxBuffer`, but executable identity incomplete. | No spawned process in revised CLI. |
| I2B1-10 LOW evidence | Prior 20 tests = I1 12 + I2-A 3 + I2-B1 5, not 20 independent risk boundaries. | Keep totals and scope explicit; new expected target 22 (5 + 2 I2-B1), not execution evidence yet. |

## Required verification for this patch

1. Owner exact clean source SHA (to be printed after final docs and executable change), `node --check` on touched `.mjs`, combined targeted Node I1/I2-A/I2-B1 expected **22** cases, `npm run typecheck`. No skipped cases or hidden failures.
2. In the **already-open Windows PowerShell 5.1 terminal**, manually invoke only the AST parser on both `.ps1` source files and confirm a deliberately invalid `ParseInput('if (')` yields a syntax error. **Do not invoke** `run-native-pg16-i2b1-inventory.mjs --read-only-inventory`, do not invoke `read-native-pg16-i2b1-inventory.ps1 -InventoryOnly`. The added parse-only gate is permissible after source and syntax review but is not required for Node/TS checks.
3. No build/full Node/CI/browser, PostgreSQL runtime, ACL or SQL is inferred from targeted tests. A second review of the **actual changed source** is required before positive probing.

**No-go stays frozen:** I2-B2 privileged native adapter, I2-C actual PostgreSQL RLS, owner-specific Neon read-only SQL, real GPS tracks, models/training, app production GPS switch, migrations, merge/deploy. Existing PG16 and PG18 services untouched.

**Next product work:** in parallel with the pending native safety infrastructure, continue source-only synthetic GPS detector falsification/benchmark and design a feature-flagged advisory pilot review, without importing unverified research into production.
