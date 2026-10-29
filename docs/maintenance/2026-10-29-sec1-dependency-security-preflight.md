# SEC-1 — dependency security preflight (2026-10-29)

**Status: INVESTIGATION / LOCKFILE UPDATE BLOCKED, NOT FIXED.** This is a scoped evidence and reproducibility record, **not** a release acceptance or a security clearance.

## Authority / source
- Baseline canonical `main@807f281e5870164b794d001480ecc84e0b45aea5` after merged PR #431; owner-approved roadmap is `ROADMAP.md` on branch `fix/logbook-sec1-dependency-remediation-20261029`.
- Owner-supplied external audit files `FlyTally-engineering-audit-2026-10-29.md` and `FlyTally-audit-evidence.json` used as initial findings. The actual SHA-pinned repository and upstream sources were independently checked. External local audit harness is **not** committed to this repository and was not rerun here.
- Production `fly-tally.com` last read-only: READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU`; deployed source SHA `55c8076e1eb8104c14392e15b272b33e0eb29607`. Production package runtime contents not independently inspected. Production DB and flags UNKNOWN.

## Actual lockfile (package-lock.json, blob `17a80253c7c4b23c25e5a77e1b3e8dd82c114d39`)
| Package | Locked | Proposed remediated threshold | Notes |
| --- | --- | --- | --- |
| `next` | `16.3.2` | investigate stable `16.4.3` (patched range begins `16.4.1`) | Direct dependency `^16.0.0`; new exact `package.json` range must be resolved with generated lock. |
| `sharp` | `0.35.3` | `>=0.35.5` | Transitive optional dependency; Next.js Image Optimization / native library advisories are deployment-dependent. |
| `source-map-js` | `1.2.1` | `>=1.2.2` | Indirect through PostCSS; verify updated resolved graph. |
| `postcss` | `8.5.23` | determine via generated dependency resolution | Not independently a justification for upgrading all dependencies. |
| `react` / `react-dom` | `19.2.8` | preserve unless compatibility/security evidence demands a change | Do not introduce unreviewed updates. |

**Primary references, fetched 2026-10-29:**
- [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r): App Router + Server Action DoS; `16.0.0–16.4.0` affected, `16.4.1` patched. FlyTally has Server Actions. No exploit or production incident was tested.
- [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw): glibc Linux + SVG Image Optimization upstream native library RCE concern; patched Next `16.4.1`, `sharp>=0.35.5` workaround. Do not claim that application exposes this endpoint without checking.
- [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q): source-map-js < 1.2.2 denial-of-service path.
- [Next.js stable release `v16.4.3`](https://github.com/vercel/next.js/releases/tag/v16.4.3), [Sharp `v0.35.5`](https://github.com/lovell/sharp/releases/tag/v0.35.5).

## Blocking toolchain constraint (observed)
- The available ChatGPT container has **Node `v22.16.0` / npm `10.9.2`**, not the repo's required Node24 baseline.
- `npm view next@16.4.3 version --fetch-timeout=8000 --fetch-retries=0` failed with **`EAI_AGAIN`** contacting `registry.npmjs.org`. Registry metadata/tarballs for new versions are not present in the local npm cache.
- Accordingly **NO dependency edits to package.json / package-lock.json, NO npm ci, NO npm audit rerun, NO build, NO release gate.** Never insert invented package hashes or modify only package.json such that npm ci breaks.

## Implementation when a permitted Node 24 + npm registry executor is available
1. Reverify main/work/production identities and package-advisory applicability. Pin a reviewed Next.js stable candidate and regenerate `package-lock.json` via npm, not by editing integrity/resolved fields manually. Ensure optional `sharp` and indirect `source-map-js` reach patched versions, with unchanged/justified unrelated packages.
2. Run `npm ci` with repo Node24, `npm audit --omit=dev --json`; explicitly classify every remaining advisory, vulnerability preconditions and whether fix is available. Never `npm audit fix --force`.
3. Run `npm run scope:changed -- package.json package-lock.json`, then the actual candidate planner; collect typecheck, selected auth/Server Action, certification, backup/restore, Node, build, browser, isolated PG and other **selected** gates on the exact source SHA. Browser tests require isolated verified local PG; an unavailable safe DB is NOT RUN, not PASS.
4. Review package/API breaking changes; obtain independent read-only security review if needed before implementation or merge. Record risks and rollback path. Create a Draft PR and stop before merge/deploy.

## DO / DO NOT
**DO:** preserve existing behavior, isolate dependency change, evidence-bound test candidate, update only current canonical docs and short handoff. **DO NOT:** modify Training, introduce redesign/features, alter aviation rules/flight evidence, mutate prod DB/flags, merge, deploy, or run destructive PostgreSQL fixtures on remote addresses.

**One next step:** obtain a permitted Node24 environment with working npm registry; generate and verify the minimal dependency+lockfile update on this work branch before requesting a release decision.
