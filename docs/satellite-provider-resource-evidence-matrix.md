# Satellite production gate — provider / decode / resource evidence matrix

Updated 2026-10-10. This document records **requirements**, not fabricated provider specifications. Production Satellite remains OFF.

| Contract item | Current evidence | State | Required acceptance |
|---|---|---|---|
| ArcGIS base imagery HTTP format, transfer encoding, typical and maximum sizes | Live provider URL in `lib/satellite-map-provider.ts`; synthetic JPEG 1x1 only | MISSING provider evidence | Record official Esri product/version docs and authorized controlled observations; note location/zoom/response provenance |
| Preferred imagery labels format and dimensions | URL and synthetic PNG 1x1 | MISSING | Source and representative approved response observations |
| Reference label fallback format/dimensions | URL and synthetic PNG 1x1 | MISSING | Separate fallback contract and limitations |
| Full JPEG/PNG pixel decode | Node structural parser, synthetic valid fixtures | MISSING production proof | Explicit supported-format/decoder policy, representative decode and corruption tests |
| Browser decode compatibility | Offline Playwright Chromium synthetic smoke available, not yet verified by owner | PARTIAL TOOLING ONLY | Owner local Chromium test, then iPad Safari and mobile evidence |
| Transport bytes / read deadline | Caller-configurable isolated bounded fetch, unit tests | VERIFIED isolated mechanism; PRODUCTION POLICY MISSING | Credible published/observed envelope and owner-approved effective ceilings |
| Node RSS, heap, JS strings, concurrent load | Single-process 1x1 synchronous memory snapshots | MISSING deployment evidence | Representative Next worker and load measurements incl. transient/peak methodology |
| Multi-instance admission | Per-isolate shared gate only | MISSING | Document instance count/autoscaling and safe aggregate strategy or fail-closed |
| Cancellation | Best-effort body cancel and unproven quarantine | PARTIAL | Verify platform termination behavior; do not call cancel a proof |
| Satellite no-store supplier traffic/cost | Intended isolation, no real supplier usage measurement | MISSING | Supplier terms, traffic/limits and owner approval |
| Attribution/licensing | Provider URLs only | MISSING | Explicit authorized license terms and UI attribution check |

## No-production-access batch (current)

New `tooling/verify-satellite-browser-decode.mjs` is an **offline opt-in** smoke test using installed Playwright Chromium. It checks the synthetic PNG and JPEG fixture decode and final 256 SVG wrapper presentation dimensions in an actual Chromium image element; all non-data network requests are aborted. It does **not** measure pixel fidelity, decoder peak RSS, iPad Safari behavior or actual ArcGIS contractual properties. It must not auto-apply results as production limits. Playwright browser executable may need installation; any missing executable is NOT RUN, not a product failure.

## Release gate

Do not modify production provider or flip Satellite flag until source-backed provider contract, decoder requirement and representative performance budgets are reviewed and an explicit owner activation decision is recorded. This evidence matrix alone is NOT approval.


## 2026-10-10 official Esri contract research — READ-ONLY, no provider calls

Exact live endpoints from `lib/satellite-map-provider.ts`:

| FlyTally input | Endpoint family | Grounded fact vs unknown |
|---|---|---|
| Required base | `ibasemaps-api.arcgis.com/.../World_Imagery/MapServer/tile/{z}/{y}/{x}` | Esri documents this image map-tile path. Actual tileInfo, MIME variants, observed sizes and latency for FlyTally token **not yet observed**. |
| Preferred labels | `static-map-tiles-api.arcgis.com/.../arcgis/imagery/labels/static/tile/{z}/{y}/{x}` | Esri expressly documents **512x512 PNG**, levels 0–22, and required `premium:user:staticbasemaptiles` privilege; provider metadata must be checked before assuming tiling equivalence. |
| Backup labels | `services.arcgisonline.com/.../Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` | This is a separate MapServer service; live metadata/effectivity, attribution and permissible commercial usage not yet established. |

**Tiling issue found:** the existing server-side composer passes the **same** `z/y/x` to a traditional image MapServer and the 512px static-label service and resizes both into 256px SVG. Esri explicitly says static tile levels differ in pixel-resolution equivalence (example: static level 12 corresponds to image level 13). This alone **does not prove a geographic misalignment**: correct overlay depends on source `tileInfo` origins, CRSs and each requested level's actual geographic footprint (`cols*resolution` and `rows*resolution`), not raw pixel size alone. Esri has a client-layer tutorial showing World Imagery + static labels layered with `tileSize:512` for the latter; this is **not** proof that FlyTally's server-side per-coordinate SVG composition matches without reconciliation.

Added isolated, fail-closed `lib/satellite-provider-tiling.ts` and `tooling/check-satellite-tiling.mjs`. Given **locally supplied, separately provenance-verified** metadata exports from both actual endpoints, the CLI checks identical CRS family (Web Mercator), origins, and per-level geographic tile span without implicit zoom conversion or floating-point tolerance. Any missing or discrepant metadata -> unavailable, not "assumed equivalent." CLI output is only `candidate-compatible` / `unavailable`; never licensing or integration approval. No requests are sent.

### Official primary sources

- Esri map tile data/service URLs: https://developers.arcgis.com/rest/basemap-styles/service-data/
- Imagery Labels tile path, PNG/512px, zoom equivalence and required static tile privilege: https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-tile-get/
- Imagery Labels metadata contract: https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-meta-data-get/
- Traditional MapServer tileInfo metadata (rows/cols/origin/lods): https://developers.arcgis.com/rest/services-reference/enterprise/map-service/
- Esri example combining imagery + 512px labels as **separate client layers**: https://developers.arcgis.com/maplibre-gl-js/maps/raster-tile-basemaps/display-multiple-basemap-layers/
- Licensing/attribution: https://location.arcgis.com/help/licensing-and-attribution/
- Static basemap tile metered pricing (service-specific; do not apply numbers to other endpoints/account without agreement): https://developers.arcgis.com/rest/static-basemap-tiles/

### Pre-integration decisions / remaining evidence

1. Verify supplier-origin service metadata for required imagery, preferred labels **and fallback labels**, stored as sanitized evidence outside repo; assess `z/y/x` coverage and HTTP response MIME/dimensions separately.
2. Select an **explicit** overlay strategy: (A) preserve preferred 512px overlay only when tiling equivalence is proven, with a coordinate/window transformation if evidence requires it; (B) use only confirmed geographically equivalent MapServer label fallback with accepted loss of language/style options; (C) redesign as Esri-supported layered client basemap with revised caching, security and cost. Do not silently auto-switch.
3. Verify credentials' applicable static basemap privilege without exposing tokens; browser/server token and attribute obligations to be reviewed.
4. Verify actual pixel integrity and realistic resource envelope on representative *authorized* samples, with no token/response body dumped to logs, and establish deployment concurrency/cost budget from evidence and owner approval.
5. Verify attribution both on the interactive map and Story where Satellite might appear. Esri requires **Powered by Esri** plus relevant data providers; the correct provider-specific credits cannot be substituted by generic OpenStreetMap attribution.
6. If owner approves controlled supplier calls later, predeclare scope/coordinates, maximum requests and safe recording fields; do not retroactively treat synthetic test results as supplier evidence.

### Offline metadata comparison CLI

```powershell
node --experimental-strip-types tooling/check-satellite-tiling.mjs .\\local-base-metadata.json .\\local-labels-metadata.json 0-18
```

**Do not commit token-bearing metadata exports or save live credentials in the repository.** Comparison cannot establish provider origin of local files. It intentionally never fetches real tiles or metadata.
