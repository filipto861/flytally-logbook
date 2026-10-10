# 3.7.0 — A2A openAIP Airspaces offline boundary

**Status (10 October 2026):** A2A isolated pure-source contract PORTED onto current secured Satellite-enabled `main` in a new feature branch; owner-local exact SHA `c0219507` targeted 24/24, source 233/233, domain 24/24, typecheck and independent build PASS; risk-release NOT RUN. No provider transport, route, map overlay or UI wired.

This is the first bounded source milestone, not a claim that airspace rendering works. Reused the prior isolated A2A files without behavior changes on the new current-main branch: `lib/openaip-airspace-contract.ts` and `tests/v370-openaip-airspace-contract.test.ts`.

- Canonical z/x/y integer parsing, no coercion, bad coordinates unavailable.
- Explicit capability gate requiring requested + authenticated + deploymentEnabled + providerContractVerified.
- `providerContractVerified` must come from a verified external contract/rights decision; not from a browser flag, presence of API key, or successful HTTP status.
- No live API URL, no secret, no upstream fetch, no changes to Satellite, public Story, route, DB or runtime.
- Max zoom 22 here is a **parser-only syntactic ceiling**, NOT evidence that openAIP supports zoom 22; actual allowed zoom must be sourced from the provider later and enforced independently.
- NEXT A2B: use a verified Tiles API contract for a fixed-host authenticated, bounded proxy with server-held secret and an opt-in overlay on existing `flytallyAviation` pane. No tiles from unconfigured/inapplicable provider; keep OFF by default. Private views only; no operational-status claims. No broad new SDK rewrite.
- Acceptance: target test file (4 tests), timezone/map registry tests, `verify:plan`, typecheck, build, full risk-gated tests as selected by planner; owner-local exact HEAD evidence required. Runtime source inventory changed from 388 to 389 because this new pure lib module is counted. Domain direct evidence includes these four tests. Candidate `94a285627c8d6d864b578cc9dae25796aae657eb88f72db230ddab8123ebd2e9`; no blocked evidence in iteration; full aggregate and browser acceptance NOT RUN. Exact-SHA tested evidence refers to previous commit before this docs update, and does not automatically transfer.
