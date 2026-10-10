# 3.7.0 — A2A openAIP Airspaces offline boundary

**Status:** code STAGED, owner tests NOT RUN; no provider transport or map UI wired.

This is the first deliberately small implementation, not a claim that openAIP is integrated. Added `lib/openaip-airspace-contract.ts` and `tests/v370-openaip-airspace-contract.test.ts`.

- Canonical z/x/y integer parsing, no coercion, bad coordinates unavailable.
- Explicit capability gate requiring requested + authenticated + deploymentEnabled + providerContractVerified.
- `providerContractVerified` must come from a verified external contract/rights decision; not from a browser flag, presence of API key, or successful HTTP status.
- No live API URL, no secret, no upstream fetch, no changes to Satellite, public Story, route, DB or runtime.
- Max zoom 22 here is a **parser-only syntactic ceiling**, NOT evidence that openAIP supports zoom 22; actual allowed zoom must be sourced from the provider later and enforced independently.
- NEXT A2B: after exact current API and rights verification, add fixed-host authenticated proxy and opt-in overlay UI, keeping `flytallyAviation` pane and feature OFF by default.
- Acceptance: target test file 4 tests, typecheck, build; owner-local evidence required.
