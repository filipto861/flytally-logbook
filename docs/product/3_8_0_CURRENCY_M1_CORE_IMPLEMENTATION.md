# FlyTally Logbook 3.8.0 — M1 exact-money core, Batch 1 (11 October 2026)

**Status:** FIRST ISOLATED CODE BATCH IMPLEMENTED IN DRAFT PR [#320](https://github.com/filipto861/flytally-logbook/pull/320); **NOT MERGED / NOT IN PRODUCTION**. M1 complete contract **NOT FROZEN**, D1–D3 pending, no production data mutation.

## Chain of evidence and dependencies

- Canonical runtime baseline: `main@4ca2847795435549f36d44f253eb7c105eea6d25`, product `3.7.0` still released.
- Source/discovery and owner D4: [M0 documentation](3_8_0_CURRENCY_MONETARY_SEMANTICS.md), [DeepSeek reconciliation](3_8_0_CURRENCY_REVIEW_RECONCILIATION.md), draft documentation PR [#319](https://github.com/filipto861/flytally-logbook/pull/319).
- Actual code branch `feat/3.8.0-currency-core-m1`, [draft PR #320](https://github.com/filipto861/flytally-logbook/pull/320). Keep PR #319 and #320 visible as a coordinated chain; do not claim either merged or deployed.
- Owner D4 — all current genuine ISO 4217 monetary currencies including 0, 2, 3 and any eligible published minor-unit exponent — is **APPROVED**. An official version-pinned SIX ISO registry and actual monetary-vs-fund classification remain **NOT VERIFIED/NOT IMPLEMENTED**. The source authority is [SIX Financial Data Standards](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html); List One contains currency **and funds**, so do not blindly whitelist all three-letter strings.

## Batch 1 exact touched files

| File | Behavior | GitHub blob identity after write |
| --- | --- | --- |
| `lib/monetary-amount.ts` | Isolated `bigint`-backed exact major/minor parser; explicit minor-unit exponent (0–9 mechanically accepted but MUST come from official registry); billed rate × minutes / 60 / share rounded once half-up; exact formatting; same-code/same-exponent sum only | `300587c9158460a11e240aadfcc3d0d53c33c4cc` |
| `tests/monetary-amount.test.ts` | JPY 0 / EUR 2 / KWD 3, reject malformed/excess precision, exact billing and huge-value preservation, no cross-currency sum | `36171bf18f934f2e89f2cc73022d99c3082c2069` |

Both GitHub blob SHA-1s were independently matched to `git hash-object` for the exact locally executed copies. **No existing production module imports** `lib/monetary-amount.ts`; there are no schema, settings, expense, dashboard, rate, flight, sharing, backup, migration, package-version, flag or Training edits in PR #320.

### Local test evidence — exact copied bytes

Environment: container Node `22.16.0` (project requires `24.x`), TypeScript CLI available locally. Source file bytes `git hash-object` matched GitHub's blob identity before recording evidence.

| Gate | Command | Outcome |
| --- | --- | --- |
| Targeted domain tests | `node --test --experimental-strip-types tests/monetary-amount.test.ts` | **LOCAL PASS 4/4** (no failures) |
| Isolated domain module typecheck | `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler lib/monetary-amount.ts` | **LOCAL PASS** |
| Official Node 24 toolchain | project Node `24.x` | **NOT RUN** |
| Full-repository `npm test` / `npm run typecheck` / build | entire cloned app | **NOT RUN** (GitHub clone unavailable locally) |
| PostgreSQL migration and restore | isolated local PostgreSQL | **NOT RUN / N/A for pure module** |
| Playwright, CI, production DB binding/migration, smoke, deployment | actual candidate head | **NOT RUN** |

### Acceptance limitations / decisions still pending

1. **This module is not a currency registry.** `CurrencyPrecision` metadata passed by a caller only receives syntactic validation. It does **NOT** prove the currency is part of the approved all-active-monetary ISO universe. A caller MUST obtain code and exponent from a reviewed, pinned registry; until then no production write or dropdown should be hooked to this module. Test fixtures with JPY/EUR/KWD validate arithmetic examples only, not global code coverage.
2. **Rounding half-up is an isolated candidate**, not yet an owner-approved universal billing policy. M1 needs explicit consistency with current rate snapshots and billing semantics. The integer domain value `Money.minor:bigint` is not directly JSON-serializable; choose a reviewed string-decimal/database encoding before API/SQL integration.
3. **D1–D3 pending:** account default vs historical authority, legacy attestation, and mixed-currency cost sorting; do not infer owner approval from authorization to start implementation.
4. **Legacy and protected history** untouched. Certified/voided flights must never be rewritten; trash restore, v13 backup, shared-rate upserts, numeric `COALESCE` authority, and expense parser all remain separate planned M2–M5 gates.
5. **No silent FX**. Same-currency-only sum is mandatory; no currency conversion from account Settings. Missing, invalid and untracked prices must retain distinct tagged states in future adapters.
6. Currency-specific historical minor-unit exponent must be versioned per record or pinned registry version; mutable metadata must never alter old values.

## Next narrow implementation milestones

- **M1-B2:** obtain authentic SIX List One + relevant List Two and updates in reproducible checked-in or pinned format, distinguish eligible monetary currencies vs funds/metals/no-currency codes; review active/historic classification and source revision, build shared registry with `0/2/3` scale tests and change-detection. Never substitute cached third-party data without provenance review.
- **M1-B3:** freeze D1–D3 and exact value representation, rounding, immutable snapshots/attestation and backward-compatibility/API status with acceptance matrix; request independent review only for materially changed design.
- **M2:** additive migration in strictly isolated local PostgreSQL after verified schema and Vercel↔Neon binding, preserving legacy numbers and certified/voided records. No remote destructive SQL.

### Closing scope report for Batch 1

- Branch: `feat/3.8.0-currency-core-m1`; PR: [#320](https://github.com/filipto861/flytally-logbook/pull/320) **DRAFT/OPEN**; two added files. Docs: [#319](https://github.com/filipto861/flytally-logbook/pull/319) **DRAFT/OPEN**, this note and ROADMAP/FEATURES/CHANGELOG links updated there.
- Exact local test PASS evidence above; not a Node24/full project PASS. DB/schema/backup/deployment/migration: **UNCHANGED**; production version `3.7.0` unchanged.
- Batch 1 code exists and is locally tested but is not integrated into production surfaces; full M1 remains **OPEN**.
