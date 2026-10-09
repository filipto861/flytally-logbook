# 3.7.0 — Maps & Aviation Layers: independent architecture / rights review handoff

**Review requested:** independent, read-only; no runtime implementation, database writes, production configuration, deploy or auto-merge.  
**Project:** `filipto861/flytally-logbook`; baseline `main@162d9ba88c7302dc45e564d8b59a5c3cdf060709` (9 October 2026).  
**Authoritative proposal:** `docs/product/3_7_0_MAPS_AVIATION_LAYERS.md`.  
**Status:** draft; Filip is final product decision-maker. Reviewers are independent, not authority.

**First review outcome (9 October 2026):** Independent reviewer returned **BLOCK**; retained for provenance. **Second independent re-review (9 October 2026):** **APPROVE WITH CHANGES** for Phase 1 technical direction, still **BLOCKED** for satellite/openAIP production. Both verdicts and finding-level disposition are recorded at `docs/product/3_7_0_MAPS_REVIEW_RECONCILIATION.md`. Phase 1 proposed test registration and acceptance are at `docs/product/3_7_0_PHASE1_TEST_ACCEPTANCE.md` and are not implemented. No runtime code was changed.

## Context

3.6.0 is product production-closed. The user reprioritized maps and openAIP as 3.7.0 (previous reservation for monetary semantics #136 moved to 3.8.0; multi-aircraft phases moved to 3.9.0 and 3.10.0, intentions preserved). No runtime change authorized now. Existing Next.js 16 / React 19 / Leaflet ^1.9.4 app already serves OSM proxy tiles and ArcGIS World Imagery satellite tiles from the same backend; Leaflet maps only select the standard style, while the separate social Story card uses the satellite style.

## Inspect actual code (do not assume architecture)

- `app/api/map-tile/[z]/[x]/[y]/route.ts`: existing OSM/Esri proxy, credentials/cache/strict x/y/z.
- `components/leaflet-mobile.ts`: basemap, legacy CARTO replacement, broad dark tilePane CSS filter, mobile touch lock.
- `components/route-overview-map.tsx`, `components/tracks-map.tsx`: interactive route/airport and GPS paths.
- `components/flight-track-player.tsx`, `components/gps-import-review-player.tsx`, `components/lazy-flight-track-review.tsx`: playback and GPS state lifecycle.
- `app/(protected)/map/page.tsx`, `app/(protected)/flights/[id]/page.tsx`, `app/f/[token]/page.tsx`: protected and public consumers.
- `components/flight-story-card.tsx`: SVG export pipeline; must remain compatible.
- `tests/v1314-basemap.test.ts` to `tests/v1317-carto-like-basemap.test.ts`: legacy source-contract map tests.
- `tooling/development-modules.json`, `DEVELOPMENT.md`: risk-based verification evidence and browser gate ownership.
- `lib/legal.ts` and `docs/compliance/V2_9_COMMERCIAL_VALIDATION.md`: provider/legal gates.

## Frozen requirements

- Correctness/safety/source evidence > convenience; lack of provider data/rights => unavailable, not invented result.
- 3.7.0 feature: selectable satellite/orthophoto base including saved flight preview, plus optional openAIP display layer.
- Default legacy standard map unchanged while disabled. No silent user-level persistence, map prefill or auto overlay.
- Historical flight data, GPS evidence, certified records, sharing/recency and Training remain unchanged.
- Provider/source attribution and licensing must be settled before live integration; no EFB or authoritative airspace status claim.
- Changes only in small milestones; do not rewrite the entire mapping stack.

## Please review independently

1. Is the proposed shared Leaflet controller genuinely minimal? Where should layer lifecycle/state live so theme changes, React effects and viewport fits do not re-instantiate maps or lose playback?
2. Does segregating the dark CSS filter to the standard basemap pane preserve legacy visual behavior while avoiding distortion of Esri/openAIP? Any limitations of DOM SVG/canvas overlays, panes (route 450/airports 470), or hit areas?
3. Is the existing ArcGIS satellite SVG-composite tile approach suitable for interactive maps, zoom/pixel density, attribution and memory? Are there limits from licensing, cache, concurrency or tile costs? Propose narrow alternatives if justified.
4. How should the UI distinguish `REQUESTED / LOADING / PARTIAL / AVAILABLE / UNAVAILABLE` for tile layers without claiming full geographic coverage because a probe passed? What test oracle proves fallback is truthfully labeled?
5. openAIP's current official Core/Tiles OpenAPI schemas were not retrievable in Phase 0 environment. Independently verify supported raster tile paths, key/header support, zoom/coverage, 429/rate limits, caching, cost and error behavior. Distinguish documented from inference.
6. openAIP CC BY-NC 4.0 metadata has independent evidence but commercial-use explanation is disputed/unconfirmed. What exact official grant/confirmation, attribution and public-share/image-export permission should be obtained? Do not imply legal approval.
7. Security: tile proxy SSRF bounds, header/query key leakage, public tile access, CSP, image/content-type/size validation, cache poisoning, Vercel egress and abuse/quotas. What must be server-side?
8. Verification: which existing browser risk targets cover maps, where are map-specific targets missing, and whether analytics/gps paths rightly require PostgreSQL and wider regression without weakening gate ownership.
9. Confirm whether Phase 2 satellite can ship separately if openAIP external permission is still blocked **without** labeling the release's aviation overlay as delivered.

## Deliverable

Return **APPROVE / APPROVE WITH CHANGES / BLOCK** for the proposed contract. For each finding provide evidence file/line or authoritative provider source, severity, exact minimal change and test/acceptance consequence. Separate:
- confirmed defect in existing runtime;
- blocker before Phase 1;
- blocker before satellite production;
- blocker before openAIP production;
- deferred enhancement.

No code edits or PR merges. Reviewer opinion is not substitute for a tested runtime or legal approval; reconcile with current repo and product decision before implementation.

## Useful official material

- https://github.com/openAIP/openaip-api-documentation/blob/master/index.html
- https://api.core.openaip.net/api/system/specs/v1/schema.json
- https://api.tiles.openaip.net/api/system/specs/v1/schema.json
- https://groups.google.com/g/openaip/c/MY4-xil3Ve0 (historic maintainer integration)
- https://groups.google.com/g/openaip/c/SXblkRg3Ic8 (auth transition)
- https://operations.osmfoundation.org/policies/tiles/
- https://developers.arcgis.com/rest/static-basemap-tiles/
- https://developers.arcgis.com/pricing/
