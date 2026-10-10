# 3.7.0 S1/A1 — Delivery gate decisions (2026-10-10)

**Status:** RECONSTRUCTED / EXTERNAL EVIDENCE BLOCKED / NO IMPLEMENTATION AUTHORIZED.
Owner priority: ship both Satellite and openAIP. This is a bounded decision record; open questions are not invitations to endless diagnostics.

## Reconstructed baseline
- Canonical main `ROADMAP.md` confirms Standard-only Phase 1 merged/deployed; `docs/product/3_7_0_MAPS_AVIATION_LAYERS.md` records `main@cc7abd41` and owner production acceptance. 3.7.0 full release remains unshipped.
- Satellite selector R1 exists in `feat/3.7.0-satellite-selector-trial`, owner ON/OFF local verified on exact runtime SHA `7661d1dd...`; branch and PR #272 not production enabled.
- Open PR inventory observed (no merge action): #271, #272, #273, #274, #275, #276, #277, #278, #279, all Satellite or provider-related. Their current diffs and branch heads still need per-PR review before any integration. Do not merge en masse.
- Current `main` does NOT yet contain documentation navigation/handoff changes on `docs/3.7.0-satellite-openaip-delivery-focus`; those are docs-branch only.

## S1 Satellite — architecture choice, provisional
**No automatic migration to MapLibre or new SDK.** Existing Next + Leaflet and authenticated server proxy are already available. Default candidate: preserve existing client-side Leaflet selector while simplifying backend provider strategy using an **officially documented, geometrically compatible Esri base/label scheme**. This is not an authorization to ship the current same-z/x/y SVG composition.

**Critical provider fact:** Esri Static Basemap Tiles docs specify 512px PNG and a vector-scheme level offset relative to traditional 256px raster tiles. Therefore current use of identical z/y/x for legacy World Imagery and static labels is not presumptively aligned. Compare actual schemes or adopt a documented transform/client layering; do not infer an offset formula without source/applicability verification.

**Alternative decision:** if current separate base+label composition cannot be proven compatible or violates credential/cost controls, choose a different provider arrangement *only after* evaluating license, terms, fit with Leaflet and server-only credentials, attribution and migration blast radius. No implementation today.

**S1 current gate = DEFER pending authoritative grid/provider contract, account entitlement/cost, allowed use/attribution and representative resource evidence.** Both approved World Imagery metadata GET attempts were unsuccessful and showed Windows Node native assertion; do not repeat without a newly scoped approval and clear expected decision impact. No real imagery tile capture.

## A1 openAIP — official public documentation vs missing authorization
**Official API documentation entrypoint** [openAIP V2 Swagger](https://github.com/openAIP/openaip-api-documentation/blob/master/index.html) advertises separate Core/IAM/Tiles API schemas and `https://api.tiles.openaip.net/api/system/specs/v1/schema.json`. **Direct retrieval in this review environment was unsuccessful (HTTP 402 from web proxy); no current Tiles schema content is verified.** Older public community examples are historical and insufficient to freeze current endpoints, auth or caching.

**A1 gate = BLOCKED:** no authoritative verified commercial usage authorization for FlyTally authenticated SaaS, tile proxy/distribution, cache retention, attribution, quotas and terms. Do not infer permission from public endpoint or a third-party summary. Need written provider confirmation / published applicable license and current contract. No live openAIP tile request or credentialed access authorized.

### Provider questions (request from authorized support, no credentials)
1. May FlyTally (authenticated online pilot logbook, potentially commercial) render openAIP **airspace raster tiles** to its users via a server-side proxy? Are there plan/contract limitations?
2. Can it cache tiles? Allowed TTL, CDN/shared cache, no-store/retention and attribution requirements?
3. What is current Tiles API OpenAPI schema/version and specific supported airspace-only raster tile endpoint? Header-based secret authorization allowed?
4. Rate limits, throttling, overage/billing, geographical/zoom availability and published updates/data age?
5. Are there distinct rights for internal/private maps vs public sharing/Story export? Current 3.7.0 intentionally excludes public/export.
6. Required UI notices, credits and source-date/aviation disclaimers?

## Next action with decision impact
- **A1:** send above narrowly scoped authorization/schema questions to openAIP or supply existing agreement; until then NO-GO for production overlay.
- **S1:** obtain exact Esri product/account terms and scheme/label layering evidence, without token exposure; compare the two existing design options against documented requirements. This is source/architecture work, not yet a new collector/test milestone.
- **Before code:** inspect PR #272 and #274–#279 exact current branch heads/diffs, compare against main and preserve frozen trial semantics. No automatic merge of old branches.

## Evidence and stop rule
No new application runtime changes, API calls with credentials, tests, migrations or deploy in this S1/A1 record. Current provider coverage = missing. Stop repeating generic Node debug cycles until a provider-gate-specific test justifies it. Decision every batch GO / NO-GO / DEFER.

**Primary Esri references:** https://developers.arcgis.com/rest/static-basemap-tiles/ ; https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-meta-data-get/ ; https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/

## 2026-10-10 — additional primary-source research / provider contact prepared

**openAIP:** Official GitHub organization `https://github.com/openAIP` publicly lists `contact@openaip.net`; prepared a concise owner-to-provider inquiry asking about commercial SaaS airspace tiles, authenticated backend proxy access, caching, attribution, rate/cost, current Tiles API docs, and no public/export inclusion. **DRAFT ONLY — NOT SENT.** API Swagger index explicitly lists Core, IAM, Tiles schemas at `https://github.com/openAIP/openaip-api-documentation/blob/master/index.html`; retrieving specific live Tiles schema and applicable usage rights still unresolved. Contact/profile source https://github.com/openAIP ; documentation https://github.com/openAIP/openaip-api-documentation .

**Esri:** Official example explicitly combines World Imagery 256-style map tile source with `arcgis/imagery/labels` static basemap 512px raster source, `tileSize:512`, in a MapLibre layered configuration: https://developers.arcgis.com/maplibre-gl-js/maps/raster-tile-basemaps/display-multiple-basemap-layers/ . This is **evidence that Esri supports layered display**; it is NOT proof the current FlyTally Leaflet server-side same-z/y/x SVG combination is aligned, nor licensing/cost/production readiness. Preserve Leaflet pending comparison; no rewrite or provider change authorized.

**S1/A1 decision:** S1 remains DEFER on provider-specific contract/evidence and implementation choice; A1 remains BLOCKED pending owner-sent provider inquiry and authoritative reply. No credentialed API call, no merge/deploy.

