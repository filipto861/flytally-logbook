# FlyTally Logbook 3.8.0 — owner-approved monetary currency product decisions

**Decision date:** 11 October 2026. **State: D1–D4 PRODUCT SCOPE FROZEN; implementation and technical contract NOT complete.**  
**Repo:** `filipto861/flytally-logbook` only; canonical source baseline `main@4ca2847795435549f36d44f253eb7c105eea6d25`.  
**Authority:** owner's explicit message **"potvrzuji"**, in direct reply to the four recommendations restated by the assistant after draft PRs #319–#321. No inference of additional unstated technical approval.

## Frozen owner decisions

| ID | Approved behavior | Must NOT be inferred |
| --- | --- | --- |
| **D1 — Account default / per-rate authority** | `user_settings.currency` supplies a **default on creation of new monetary values only**. Users can override the currency on a specific aircraft/rate entry. A flight-rate snapshot retains its actual source rate currency independently of later user/aircraft/account settings. Newly created expense items can default to the validated account currency but each expense preserves its own chosen currency. | Account currency **does not re-denominate historical amounts**, imply that old rates were CZK, or automatically update saved flights. No silent change when settings change; any failed/invalid currency must remain unavailable. |
| **D2 — Legacy denomination resolution** | A legacy positive price with no auditable denomination remains **unknown / unresolved**. Later resolution requires an **explicit, attributable, auditable owner attestation** with affected record identity, chosen ISO currency, evidence/basis, timestamp and revocation/correction trail. | Do not backfill CZK from current settings, UI text, user locale or database-wide counts. Do not UPDATE certified/voided flight records to assign currency: their evidence and archive hashes are protected. Specific attestation ledger, authentication and historical precision are M1/M2 technical design work, not signed off by approving D2. |
| **D3 — Mixed-currency arithmetic and comparison** | Aggregate prices separately by saved known currency. **Disable ambiguous global highest-cost sort** when scope contains different currencies or unresolved denominations, with a plain explanation. Permit ranking in a single explicitly known currency; unknown amounts are shown distinctly and not treated as zero. | No automatic FX; never sum/sort incomparable monetary magnitudes by bare numeric value. No implicit conversion to currently selected Settings currency. Future currency-filtered ranking or FX is a separately prioritized feature. |
| **D4 — Full monetary ISO coverage (previously approved)** | Support all **current genuine monetary ISO 4217 currencies**, including valid monetary X codes, with each currency's authoritative minor-unit exponent and deterministic searchable picker. Registry provenance is SIX ISO 4217 Maintenance Agency; check currency/fund/special classification. Retain historical denomination + applicable exponent/evidence as recorded. | Not all three-letter strings are supported currencies; metal/fund/test/no-currency codes are not ordinary currency picker options. Do not claim verified SIX source while relying solely on an unverified third-party mirror. No crypto or automatic FX. |

**Interpretation of confirmation:** The owner approved D1–D3 exactly as offered in the prior assistant response, with D4 already approved. Minor UI details (exact copy, layout), decimal quantization, a fixed vs two-currency wet/dry-rate contract, storage types, legacy attestation API and DB deployment are **not** implicit in this confirmation.

## Required domain invariants

1. **Snapshot immutability:** effective rate resolution selects the **amount + denomination + ISO exponent + source identity atomically**. Stored flight snapshots do not change on later rate/account edits.
2. **Separate financial states:** `not_tracked`, `unavailable`, `unknown_currency` and `known` remain distinguishable. Numeric zero where valid is not confused with missing.
3. **Storage semantics:** existing `double precision` money cells are source evidence, **not** safe to auto-round or rewrite. New exact rate/expense storage, rounding and serializable `bigint` transport need a separate audited contract.
4. **Owner authority and integrity:** server-side user scope required for attestations and import; certified/voided flights and archived JSON/fingerprints remain untouched; no silent upsert currency overwrite during share.
5. **Restores:** older portable backup v13 must remain readable. Missing denomination stays unresolved, shared/imported currency remains tied to source, and trash recovery preserves both amount and currency without a CZK fallback. Backup format bump must be argued, not assumed.
6. **Exponents:** new amounts validated at their currency's source-backed minor-unit scale, including JPY 0 / EUR 2 / KWD 3 (and other future source-backed scales). Any updated metadata must not retroactively reinterpret earlier values.
7. **Mixed totals:** statistics, dashboard, flight list and expense summaries must not expose a false all-currency grand total or ranking.

## What is frozen vs pending

**Frozen:** D1–D4 product policy, separate repository, no FX, no historical CZK inference, no destructive mutation of certified evidence.

**Still pending technical validation:** direct SIX XML origin parity (draft PR #321 is mirror-based and flagged unverified), Node24 domain/source/build acceptance on exact head, precision and rounding policy, wet/dry currency modeling, append-only attestation/void source binding, strict migration and fallback/dual-read design, full path inventory, v13 backup/legacy/trash/share compatibility, verified Vercel-to-Neon deployment binding.

**Execution state as of this record:** draft docs PR [#319](https://github.com/filipto861/flytally-logbook/pull/319), exact arithmetic draft [#320](https://github.com/filipto861/flytally-logbook/pull/320), nested currency-registry draft [#321](https://github.com/filipto861/flytally-logbook/pull/321) all **OPEN / UNMERGED**. Database schema version `20` on canonical source, Neon *Logbook Shadow* branch currently reports version 20 but production binding NOT VERIFIED; migrations, CI, Node24 full suite, production deploy NOT RUN. Historical source-backed findings are retained, not rewritten, in [independent review reconciliation](3_8_0_CURRENCY_REVIEW_RECONCILIATION.md).

**Next:** [M2 first additive database migration design](3_8_0_CURRENCY_M2_SCHEMA_DESIGN.md), independent source/schema review, local isolated PostgreSQL acceptance, and then a separately reviewed small code PR. **Do not mutate remote DB or register an auto-run migration before preconditions pass.**
