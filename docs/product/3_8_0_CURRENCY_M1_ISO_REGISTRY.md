# 3.8.0 Currency — M1 Batch 2: ISO 4217 registry, classification and provenance (11 October 2026)

**Status:** IMPLEMENTED IN ISOLATED **DRAFT PR [#321](https://github.com/filipto861/flytally-logbook/pull/321)**, nested on unmerged [M1 Batch 1 PR #320](https://github.com/filipto861/flytally-logbook/pull/320); **NOT MERGED, NOT SHIPPED, NOT IN EXISTING RUNTIME CALLERS**. Owner approved full ISO 4217 monetary-currency coverage (D4); D1–D3 and technical contract remain pending.

## Source authority and limitation

- SIX is the authoritative ISO 4217 Maintenance Agency and publishes [List One: Current Currency & Funds XML](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html). List One includes currencies **and funds**; do not treat every alpha-3 code as ordinary money.
- Official source URL: `https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml`.
- **The primary SIX XML could NOT be downloaded from this execution environment** (web parser rejects `application/xml`; container network DNS blocked). Direct official file hash/date comparison **NOT VERIFIED**. **This is a release blocker** for the reference-data authority claim; never represent the candidate as approved official ISO snapshot.
- Candidate is an XML mirror at [faisalanjum/EventTrader@5d22ac8d33afb1e118fd3d87b17c680b19cd5563](https://github.com/faisalanjum/EventTrader/blob/5d22ac8d33afb1e118fd3d87b17c680b19cd5563/driver/reference_data/iso4217-list-one-2026-09-17.xml); exact Git blob SHA-1 `1b8df1bec436592b955286d4e39c72518be9e444`; embedded `<ISO_4217 Pblshd="2026-09-17">`. This mirror is **source evidence with a provenance caveat**, not a verified official SIX download.
- Cross-checked older [Unicode CLDR List One](https://github.com/unicode-org/cldr/blob/7cdeb9e7fac52c59f22fc7248b05f989ee5689c2/tools/cldr-code/src/main/resources/org/unicode/cldr/util/data/dl_iso_table_a1.xml) (published 2026-01-01) and an older FormatJS 2025-05-12 snapshot. The 2026-09 candidate differs from January on fund flags for `XAD` and `UYW`; older snapshots are **NOT** proof that September source is correct. May 2025 included `BGN`; authoritative SIX web page explicitly states the January 2026 move of BGN to historical. Treat future published-source changes and exceptions as reviewed catalog updates, not silent changes.

## Actual M1-B2 code scope

| File | Exact behavior |
| --- | --- |
| `data/iso4217/list-one-2026-09-17.xml` | Pinned mirror bytes, blob `1b8df1bec436592b955286d4e39c72518be9e444`; original download verification pending |
| `tooling/generate-iso4217-registry.mjs` | Offline deterministic source verification and generation with `--check` / `--write`. Rejects changed source blob/date, malformed currency/numeric/exponent values, inconsistent duplicated entity definitions, unexpected fund-code leaks. No implicit network sync |
| `lib/iso4217-currency-data.ts` | Generated immutable-source metadata plus a sorted 155-item name/code/numeric/exponent table; metadata `verifiedDirectlyWithSIX:false` |
| `lib/iso4217-currency-registry.ts` | Read-only code/name search, full list with common currencies first, strict monetary-code lookup, currency-specific exact money parser/calculator adapters. **No existing app import** |
| `tests/iso4217-currency-registry.test.ts` | Five authored Node unit tests for snapshot/regeneration equality, full list, fund/metal/test/no-currency rejection, JPY/EUR/KWD amount and billing, search, conflict/tamper behavior; **NOT RUN** against GitHub branch |

**Candidate-source in-memory data validation, actual GitHub read-back:** 280 XML entity rows, 3 without currency code, 178 distinct codes, 10 `IsFund=true` codes, 13 codes without defined minor units (`N.A.`), and **155** eligible distinct monetary codes. Exact JSON row-by-row comparison between pinned XML and generated TypeScript metadata **PASS**. This is NOT independent live SIX XML verification and is NOT a Node unit-test run.

**Notable included:** `JPY:0`, `EUR:2`, `KWD:3`, genuine monetary X-codes `XAF:0`, `XOF:0`, `XPF:0`. **Excluded from new ordinary currency selection:** `XAU`, `XAG`, `XTS`, `XXX`, `XDR`, `BOV`, `CLF`, `XAD`, `UYW` and other flagged fund/unscaled values. Legacy/historical amounts retain their recorded denomination; the current picker must not destroy them.

## Required tests and release gates

- **NOT RUN:** `node tooling/generate-iso4217-registry.mjs --check`, `node --test --experimental-strip-types tests/iso4217-currency-registry.test.ts`, full Node24 suite, TypeScript project, build, browser, PostgreSQL, CI, live smoke. Source bytes + generated data were compared via GitHub connector in-memory; do not call that Node24 PASS.
- **Must do before merge/integration:** retrieve the contemporaneous official SIX XML bytes, confirm published date and code/fund/exponent parity; investigate differences, source revision/effective dates and historic code policy, otherwise hold candidate. Run exact-head generator check, Node24 targeted+project tests; independently review classification, zero/three/four-decimal edges, metadata tampering and change governance.
- **Before DB/production:** freeze D1–D3, exact storage/rounding/API/attestation and legacy-restore contract, protected-flight enforcement, migration rollback/forward compatibility. Verify actual Vercel→Neon binding, use isolated local PostgreSQL tests only, never destructively mutate remote DB on assumption. No FX, no silent CZK inference.
- **UI not started:** no Settings/Rate/Flight/Expense/Statistics changes, no currency picker consumer wired. New registry lookup is a staged building block with a **pending official-source verification flag**, not currently approved production validation.
- **Review handoff:** request an independent read-only pass before integrating the currency lookup with production writes: verify snapshot origin/date and `IsFund` parsing against SIX List One and List Two, updated XAD/UYW classification, treatment of historical BGN, absent exponent, code uniqueness, and precision semantics; preserve reviewer disagreement until resolved against direct primary evidence.

## Scope / closeout ledger

- Code PR #321: `feat/3.8.0-currency-registry-m1` (based on #320), 5 added files, **DRAFT/OPEN**; code runtime not wired. #319 is separate docs-only draft PR, containing roadmap and this evidence.
- Code/test **authored**, snapshot source and JSON classification **READ-BACK/IN-MEMORY CHECK PASS**. Actual full test execution **NOT RUN**. No schema/data, backup, migration, version, flag, deployment or `flytally-training` changes.
- Next safe task: primary SIX XML provenance check and Node24 tests + classify Diff; then D1–D3 and final money contract, before any migration or producer integration.
