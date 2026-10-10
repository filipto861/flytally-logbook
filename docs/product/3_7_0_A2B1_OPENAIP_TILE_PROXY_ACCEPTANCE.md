# FlyTally 3.7.0 — openAIP A2B1 Private Tile Proxy

**Status:** Draft branch, tests not yet run; no provider access enabled, no UI overlay.

## Evidence boundaries
- A2A PR #287 was squashed to current `main` as `c631f3862ff5bbf61c5f1ee72ca0ec6bbf03e0fc`; owner-local release verified A2A on pre-merge SHA `2b7d60f8`. This A2B1 commit is a NEW candidate and has no automatic inherited PASS.
- openAIP vendor support (15 August 2022) documents the specific raster layer path `https://{s}.api.tiles.openaip.net/api/data/airspaces/{z}/{x}/{y}.png?apiKey=...`. [Vendor support](https://groups.google.com/g/openaip/c/MY4-xil3Ve0).
- openAIP Aug 2024 auth migration message documents `x-openaip-api-key` header for API requests: [official message](https://groups.google.com/g/openaip/c/SXblkRg3Ic8). Current Tiles OpenAPI `https://api.tiles.openaip.net/api/system/specs/v1/schema.json` could not be verified, and no current provider credentials/API response/usage allowances were exercised. New endpoint is therefore OFF by default.
- The endpoint is not a regulatory airspace database, NOTAM service, activation detector, or source of flight clearance. A successful raster tile does not mean airspace status is current/approved.

## In-scope A2B1 acceptance
- Only `GET /api/airspace-tile/[z]/[x]/[y]` with literal fixed `https://api.tiles.openaip.net/api/data/airspaces/{z}/{x}/{y}.png`. No user-specified URL, host, layer or provider query params and no browser-visible API key.
- Reject non-canonical tile coordinates before session/secret/fetch. A2A parser's `z<=22` is syntax-only. Bounded A2B1 requests add `z<=14` as conservative FlyTally traffic limit, *not* documented coverage.
- Request-time `getSession()` must return authenticated identity **before** key or provider access; anonymous 401. Exact-true `FLYTALLY_OPENAIP_AIRSPACES_ENABLED` and `FLYTALLY_OPENAIP_PROVIDER_VERIFIED` (server settings) plus non-empty server-only `OPENAIP_API_KEY` required; missing conditions 503, never call upstream.
- Upstream `x-openaip-api-key` HTTP header, `Accept: image/png`, no caching, 5-second timeout, no redirects, no client-provided data. HTTP 429 returns 503 without retry; other provider failures 502.
- Accept only `image/png`, PNG 8-byte signature and <=1 MiB. Return private/no-store, nosniff, no wildcard CORS on all statuses. No provider URL/key/stack in viewer errors. No retention of derived imagery or pilot flight data.
- Mocked route behavior covers invalid coordinates, anonymous 401, both independent flags, missing key, correct upstream host/header, response MIME/signature/size, provider 429, network failures and absence of retries.
- Registry owns new route under `gps-tracks` and exact browser-risk target selection; audited source count 389→390, synchronized source assertions.
- **No** UI, Leaflet overlay, openAIP client-side SDK, image display, DB/schema, flight evidence changes, commercial claims, Training changes, Vercel env changes or production rollout in this PR.

## Verification and next milestone
1. Exact clean detached feature SHA and `npm run test:target -- tests/v370-openaip-airspace-tile-auth-behavior.test.ts tests/v370-openaip-airspace-contract.test.ts tests/timezone-semantics-source.test.ts tests/v370-map-layers.test.ts`.
2. `npm run verify:plan -- --base origin/main`; honor planner gates and unresolved ownership. `npm run verify:iterate -- --base origin/main --rerun` and independent `npm run build`. Then `npm run verify:release:risk -- --base origin/main --rerun` with a **new verified EMPTY localhost disposable PostgreSQL browser fixture**, if browser required. The bootstrap DROPS its public schema; no shared/production DB.
3. Owner-local vs CI vs preview/prod evidence distinguished. Browser tests use synthetic local data; NO live upstream request.
4. Only after verified A2B1: A2B2 adds a separate, default-OFF, authenticated-map-only toggle on `flytallyAviation` pane and synthetic browser acceptance, independent of Standard/Satellite and public Story. Real API key and live current provider response/zoom/transparent tiles must then be verified before any production ON decision. The two server flags are **manual assertions**, not independent provider verification.
