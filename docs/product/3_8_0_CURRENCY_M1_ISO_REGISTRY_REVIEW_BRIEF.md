# Independent read-only review handoff — FlyTally Logbook 3.8.0 M1-B2 ISO 4217 registry

**Reviewer:** DeepSeek or Claude. **Scope:** read-only source/provenance & currency-parser review. **DO NOT** write code, alter Git/DB, infer owner decisions D1–D3, approve migrations or trigger deployment.

## Baseline and exact candidates

- Repo `filipto861/flytally-logbook`; verified `main@4ca2847795435549f36d44f253eb7c105eea6d25` product 3.7.0.
- Owner D4 frozen: **all currently active genuine ISO 4217 monetary currencies** with currency-specific published exponent (not six-code subset; no FX), funds/metals/tests/no-currency excluded from ordinary monetary picker. Document [decision/reconciliation](3_8_0_CURRENCY_REVIEW_RECONCILIATION.md), and [M0 contract](3_8_0_CURRENCY_MONETARY_SEMANTICS.md).
- Draft PR [#320](https://github.com/filipto861/flytally-logbook/pull/320) — `feat/3.8.0-currency-core-m1` exact isolated `bigint` arithmetic.
- Nested draft PR [#321](https://github.com/filipto861/flytally-logbook/pull/321) — `feat/3.8.0-currency-registry-m1`, base PR #320, **five newly added files**. All unmerged, no production caller uses the registry.
- Snapshot: `data/iso4217/list-one-2026-09-17.xml`; Git blob SHA-1 `1b8df1bec436592b955286d4e39c72518be9e444`, sourced from third-party [EventTrader GitHub commit](https://github.com/faisalanjum/EventTrader/blob/5d22ac8d33afb1e118fd3d87b17c680b19cd5563/driver/reference_data/iso4217-list-one-2026-09-17.xml). XML internal `Pblshd=2026-09-17`. **NOT verified byte-identical with the original official SIX download**; metadata correctly records `verifiedDirectlyWithSIX:false`. Official SIX source is [SIX Currency Codes List One](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html).
- Additional [Batch 2 evidence report](3_8_0_CURRENCY_M1_ISO_REGISTRY.md). Captured read-only counts: 280 XML entries, 178 distinct alpha-3 codes, 155 eligible monetary codes, 10 `IsFund=true`, 13 `N.A.` minor-unit entries, 3 entries without a currency code. In-memory exact `parseListOneXml`/renderer function parity and duplicate-conflict rejection **PASS**; original Node CLI/tests/Node24/CI/full app/DB/browser **NOT RUN**.

## Eight review questions, severity first

1. **Provenance blocker:** Does the registry correctly treat the source as mirrored-but-unverified, rather than pretending official SIX authority? Is direct SIX List One byte/date/hash comparison necessary before using these codes for new persisted writes? Identify a safe reproducible alternative only if evidence is at least equally authoritative.
2. **Classification:** Inspect XML `CcyNm IsFund="true"`, List Two fund identification, `CcyMnrUnts=N.A.`, and code gaps; check current `XAD`/`UYW` 2026-09 vs older CLDR 2026-01 changes. Is exclusion of `BOV, CLF, COU, MXV, CHE, CHW, USN, UYI, UYW, XAD` appropriate for ordinary cost currency selection? Challenge exceptions with source evidence.
3. **Monetary X-codes:** Confirm `XAF/XOF/XPF` are genuine spendable ISO currencies with 0 decimals, while metals `XAU/XAG/XPD/XPT`, special `XDR`, `XXX`, `XTS` are not ordinary tender. Do not blanket reject codes starting X.
4. **Parser fail-closed:** Could real SIX XML variations in `CcyNtry` or `CcyNm` attrs cause silent omission, incorrect normalization, duplicate conflict suppression, fund promotion, unsafe Unicode/XML entity handling or acceptance of malformed exponents? Provide exact code-location proofs.
5. **Registry API:** Inspect `supportedIsoCurrency`, `searchSupportedIsoCurrencies`, `listSupportedIsoCurrencies`, and exact arithmetic adapters. Are invalid/currently unsupported codes rejected and known 0/2/3 decimal exponents handled correctly without FX? Is the all-155 lookup/search UX sound for iPad/touch without list clutter? Existing app UI is not yet wired.
6. **Rounding / exact arithmetic:** Evaluate `lib/monetary-amount.ts` and test coverage: fractional rates, `minutes/60/share`, half-up tie, integer overflow boundaries, `bigint` JSON/API compatibility; identify what must be frozen before production. Half-up is currently a technical candidate, not owner-approved business policy.
7. **Historical semantics:** Can withdrawn or changed minor-unit metadata ever reinterpret prior saved rates/expenses? What immutable currency/exponent snapshot and legacy backup policy would you require before M2? Do **not** propose rewriting certified/voided flights or using mutable current account currency as history.
8. **Testing/dependencies:** Which minimal tests are essential to move PR #321 from draft to ready, before moving to M2? Distinguish actual completed in-memory checks from NOT RUN Node24/typecheck/browser/PostgreSQL and source verification.

## Response contract

Deliver **APPROVE / APPROVE WITH CHANGES / BLOCK**, severity-ranked findings and smallest safe fixes. Separate **observed code facts**, **third-party mirror assertions**, **direct SIX source evidence**, **untested hypotheses**, and **owner decisions**. Cite actual paths, lines or source URL/revision. No speculative deployment/DB evidence, no code or migration writes. Explicitly mark direct official SIX XML parity as `NOT VERIFIED` unless personally checked against primary original; do not promote our mirrored data to an authority.
