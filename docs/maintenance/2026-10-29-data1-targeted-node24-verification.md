# DATA-1 targeted Node24 tests and focused TypeScript verification — 2026-10-29T20:26:05.483Z

**Logbook canonical main:** `807f281e5870164b794d001480ecc84e0b45aea5`. **Source candidate actually tested:** `e45fde930b305ed4b5e25be3522423cc21c0d53a`, Draft [PR #439](https://github.com/filipto861/flytally-logbook/pull/439), stacked on [Draft #438](https://github.com/filipto861/flytally-logbook/pull/438) → #437 → #436 → #435 → #434; #433 is design-only, #432 SEC-1 unrelated. All unmerged. **No production or Training changes.**

## Exact execution environment and limitations

- **Where:** Vercel **Sandbox**, not production Vercel deployment and not GitHub Actions/CI. Name `flytally-data1-unit-20261029`, session `sbx_qDuLyjbPspR4D55yAwBR0hbPfEJH`, Logbook project sandbox assignment; **Node v24.22.1**, nonpersistent, network initially `deny-all`.
- **Source:** selected actual GitHub file contents at frozen source candidate plus the two follow-up fix commits copied into a minimal sandbox workspace (`lib/`, `tests/`, `tooling/`). **NOT a full repository checkout.** The targeted test suite includes source-order check of `lib/account-backup.ts` but does not execute the builder against a database.
- For focused TypeScript, provisioned sandbox-only `typescript@5.9.3` and `@types/node@24.0.0` through a temporary allowlist restricted to `registry.npmjs.org`; **network policy restored to deny-all** before verification. Compiler used `module:NodeNext`, strict mode, `noEmit:true`, `allowImportingTsExtensions:true`, types Node, and only the new DATA-1 helper/test import graph. Full repository `tsconfig.json` + all Next code NOT included.
- **No connection string, secrets, DB hostname, customer/flight/GPS export, Neon SQL, DB modifications, deployment, migrations or flags.** Sandbox was explicitly stopped; fresh `get_session` returned `stopped` and `persistent=false` was set at creation. Neon project list still includes exactly the three preexisting projects and **no new DATA-1 test database**.

## Observed test trail (do not erase diagnostic failures)

1. **Initial exact upstream Draft #438 `c32815588b7d34fceb4362f811741c89f0afcab6`:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --experimental-strip-types tests/v381-data1-local-snapshot.test.ts tests/v381-data1-backup-snapshot.test.ts tests/v381-data1-backup-presign.test.ts` exited **1**, summary 12 PASS / 1 FAIL. Snapshot helper failed during import with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` because `constructor(public readonly code:...)` uses parameter-property syntax unsupported by Node24 strip-only loader.
2. **First fix commit `5e75a1c90ee4904b6e9fe9031de7ef980fb5fcd6`:** changed only the error's field declaration/assignment, preserving message, code and runtime validity. Same targeted Node command **PASS 16/16** (exit 0).
3. **Focused TypeScript initial check:** `tsc --project tsconfig.target.json --pretty false` exited **2** with **TS2352** at `tests/v381-data1-backup-presign.test.ts`: TypeScript cannot infer all required v13 arrays when they are created by `Object.fromEntries(portableBackupRequiredSections(13))`.
4. **Second fix commit / source candidate `e45fde930b305ed4b5e25be3522423cc21c0d53a`:** explicit `as unknown as Payload` for the dynamically constructed fixture. No input rows, assertions, validator or production logic changed. **Focused TypeScript PASS (exit 0)**, command `./node_modules/.bin/tsc --project tsconfig.target.json --pretty false`; **targeted DATA-1 tests PASS 16/16 (exit 0)**, same Node24 command. Import tree includes ownership, certification, voided SHA and monetary validators.
5. **Standalone profiler tests:** `node --test tooling/data1-synthetic-transport-size.test.mjs` at the same source candidate **PASS 2/2 (exit 0)**. **Total 18/18 focused test cases PASS**. Not the application full suite.

## Gate status and remaining risk

| Gate | SHA / status |
| --- | --- |
| Corrected source compatibility (Node24 strip loader) | PASS (targeted, `e45fde930b305ed4b5e25be3522423cc21c0d53a`) |
| DATA-1 A/B/C/D local/parser regression tests | PASS 16/16 (`e45fde930b305ed4b5e25be3522423cc21c0d53a`) |
| DATA-1D offline profiler unit tests | PASS 2/2 (`e45fde930b305ed4b5e25be3522423cc21c0d53a`) |
| Focused TypeScript of new helper/test tree | PASS (isolated `tsconfig.target.json`, `e45fde930b305ed4b5e25be3522423cc21c0d53a`) |
| Full private-repo `npm run typecheck` | **NOT RUN** |
| Full Node suite / Next.js production build | **NOT RUN** |
| Exact application backup/restore with local PG16 | **NOT RUN** |
| Neon archive Base64 INSERT+SELECT, upload/download size threshold | **NOT RUN / LIMIT UNKNOWN** |
| Browser / CI / risk-selected release gate | **NOT RUN** |
| Production DB/flags | **UNKNOWN**, not accessed |
| Production deployment / merge | **NOT DONE** |

**Do not claim release-ready**: these tests are a focused, successfully exercised subset and do not validate the full application build, imported types or real DB behavior. Keep fail closed and v13 compatible. No new architecture or Claude quota used.

**ONE NEXT STEP:** obtain a complete private GitHub checkout in an explicitly isolated Node24 verification environment and run exact-candidate `npm run typecheck` + risk-selected tests/build, then isolated synthetic backup-storage integration if indicated. Do not merge/deploy without owner approval.
