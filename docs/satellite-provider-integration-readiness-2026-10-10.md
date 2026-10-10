# R2D.2 / M3-D — Provider Evidence & Integration Readiness (2026-10-10)

**State:** REVIEWED RESEARCH / ISOLATED SOURCE STAGED — production wiring BLOCKED. Repo: `flytally-logbook`, branch `feat/3.7.0-satellite-r2d2-bounded-provider-io`. Satellite OFF. No changes to `flytally-training`.

## Actual source reconstruction

- `app/api/map-tile/[z]/[x]/[y]/route.ts` authenticates Satellite, fails closed on missing token or server emergency stop; calls **legacy** `satelliteTile`. Standard is independent.
- `lib/satellite-map-provider.ts` fetches World Imagery and Static Imagery Labels with same z/y/x; if preferred labels not an image, fetches World Boundaries and Places fallback. Uses Next cached fetch and unbounded arrayBuffer/Base64 to construct a 256 SVG. **No bounded modules are provider-wired**.
- `lib/satellite-bounded-fetch.ts`, `satellite-required-pair.ts`, `satellite-tile-transport.ts`, shared admission, structural raster validation, SVG envelope exist only in isolated testable path.
- Synthetic owner validation before this batch: 44/44 Transport Hardening PASS + typecheck/build; 31/31 Resource Lab PASS + typecheck/build; offline Chromium image decode smoke PASS. These do NOT validate supplier behavior, pixel fidelity, iPad Safari, licensing or production RAM.
- `docs/satellite-provider-resource-evidence-matrix.md` details evidence and official primary source URLs.

## New isolated contract and test scope

- `lib/satellite-provider-tiling.ts`: compare Web Mercator tileInfo origins, tile dimensions and per-zoom geographic footprint; fail closed on missing/ambiguous/discrepant evidence. No defaults, invented tolerance or implicit zoom conversion.
- `tests/v370-satellite-provider-tiling.test.ts`: synthetic 256/512 *geographically equivalent* and *incompatible* cases, origin/CRS/missing LOD and invalid metadata.
- `tooling/check-satellite-tiling.mjs`: offline CLI for explicit local supplier metadata JSON exports, reporting **candidate** compatibility only, never approval or source provenance.
- `tests/v370-satellite-tiling-cli.test.ts`: no-network CLI smoke for compatible and mismatched geometry.
- No ArcGIS fetches (including metadata endpoints), no tokens, no real provider fixtures and no live provider changes.

## Why static labels require separate analysis

Esri states imagery-labels static tiles are 512x512 PNG and their level numbers have a different pixel-resolution equivalence to traditional image map services. Esri also demonstrates using World Imagery plus static labels as *two distinct client map layers*. This does NOT prove FlyTally's server-side SVG blend at identical z/y/x is correct or incorrect: geographic alignment requires actual service-specific tileInfo and coordinate matching. The CLI checks the geographic footprint, not source authenticity, raster pixel fidelity or render alignment.

## Proposed integration contract (NOT YET APPROVED)

1. **Prerequisites:** source-backed current metadata/terms for each exact upstream endpoint; owner-approved access and metering, attribution and display; representative authorized pixel decode and memory evidence; deployment isolate/concurrency budget, all with source/revision/provenance.
2. **Routing:** retain Standard unchanged, authenticate first, emergency stop before any Satellite work; missing config/policy -> 503/no-store, base provider failure -> 502/no-store; client may separately fall back to Standard. No public cache of authenticated map tiles.
3. **Budget:** one absolute deadline for complete tile, explicit caller-supplied per-fetch limits (byte/read and MIME) and per-isolate admission; do NOT claim deployment-wide RSS bound or cancellation proof; quarantine unproven operations.
4. **Decode/composition:** require image MIME + structural checks; pixel decode policy must be separately decided, with complete decoder evidence. Validate provider-specific expected dimensions and tile grid per actual service; no arbitrary rescale or zoom shift. Output SVG under explicit provenance-backed envelope.
5. **Fallback:** preferred labels fallback only on known allowed errors; if overlay cannot be shown safely under policy, base-only is preferable to improperly aligned labels. Never mix unverified tiles; no opportunistic auto-apply of newly seen metadata.
6. **Privacy & billing:** never log/export access tokens, tokenized URLs or full tile data. `no-store` traffic/cost and applicable license require owner approval before activation.
7. **Verification gate:** targeted + full tests, typecheck, production build, guarded synthetic local HTTP enabled/disabled/token-negative flows, representative supplier-pixel (separately approved), browser Chromium + Safari/iPad, cache/auth/Story/accessibility, prod smoke only after explicit deploy decision.

## Product/engineering decisions to freeze before production implementation

**D1 — Overlay strategy:** A: preserve Static Imagery Labels only if metadata proves tile footprint / source contract, correcting coordinate mapping if necessary; B: use only source-matched MapServer reference labels (fewer styling/language features); C: adopt a vendor-supported full basemap layering approach (larger refactor, new cost/security model). Default **no change** to current OFF state; no silent selection.

**D2 — Pixel integrity:** structural PNG/JPEG checks plus client browser decode vs full server-side decode; acceptance and resource budget required.

**D3 — Token/licensing/attribution:** confirm static tiles privilege `premium:user:staticbasemaptiles`, whether the current token legitimately covers all accessed services and usage, attribution in interactive map and Story. No legal/compliance assertion without agreement.

**D4 — Runtime policy:** source-backed per-tile byte/time/pixel ceilings, no-store request estimates, actual Vercel instance RAM and concurrency; approve before wiring. No synthetic numbers may become defaults.

## Suggested next authorized evidence milestone

After local verification of this source batch: gather exact *service metadata* separately for World Imagery, imagery labels and fallback, with owner approval if any provider request needs a token. Prefer the official Esri portal/docs for non-token public metadata and use controlled token scope only after authorization. Preserve source timestamp and service identifier but strip all tokens before recording. Run the offline CLI against *two matching verified exports* and reconcile zoom origin/dimensions. Only after data evidence and D1–D4 decisions implement provider wiring on a separate small branch/batch.

**Do not:** deploy, enable Satellite, merge, modify Standard, change auth, touch database, use production credentials, or treat this readiness proposal as approved.
