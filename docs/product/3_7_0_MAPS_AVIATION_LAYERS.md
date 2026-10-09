# 3.7.0 — Maps & Aviation Layers

**Status:** Phase 0 read-only source discovery COMPLETE; design DRAFT / independent review PENDING; runtime NOT STARTED.  
**Date:** 9 October 2026  
**Baseline:** `main@162d9ba88c7302dc45e564d8b59a5c3cdf060709`; product production baseline 3.6.0.  
**Owner:** Filip Točík  
**Repository scope:** `flytally-logbook` only. No change to `flytally-training`.  
**Authority:** product design proposal, not an aviation chart or approval.

## 1. Product intent and release boundaries

Users can choose a standard map or orthophoto/satellite imagery on an existing flight map, including a saved flight GPS preview/replay. Users can optionally overlay openAIP aviation context (airspaces first, airports/navaids/reporting points only if separately accepted), without changing flight evidence.

Keep the current online-only, Leaflet-based user experience. Map background and aviation overlays are **presentation**, not canonical flight positions, airspace clearance, airspace activation, NOTAM interpretation, route validation, or certified operational aeronautical data. No flight record, T&G, SERA, recency, certification, sharing authority or GPS timing calculation may depend on these layers.

**Scope for 3.7.0:** shared map layer controller; standard/satellite switch on the approved maps; optional initial openAIP airspace overlay only after external rights and technical gates; explicit availability/attribution/failure behavior; targeted browser, unit and release verification.

**Out of scope:** new EFB/flight-planning status, live/active airspace indication, NOTAM/AIRAC guarantees, airspace infringement alerting, flight-to-airspace intersection computation, altitude-based filtering without trustworthy profile/data, offline caching or downloads, paid data resale, automatic map preference persistence, bulk openAIP import, database migration, certified record/history rewrite, training repo changes.

## 2. Phase 0 — read-only source discovery (COMPLETE within accessible scope)

All findings below are source inspection, **not** live provider, deployment, user-session or browser evidence.

| Surface | Actual source evidence | Consequence |
| --- | --- | --- |
| Stack | `package.json`: Next.js 16, React 19, `leaflet ^1.9.4`; Vercel/Neon | Reuse Leaflet; MapLibre migration is not warranted by current scope. |
| Map route | `app/(protected)/map/page.tsx`: route overview or GPS tracks, filters and scope limits | Keep both map modes, filters and click-through behavior. |
| Route overview | `components/route-overview-map.tsx`: `addFlyTallyBasemap`, routes and airports in custom panes at z-index 450/470 | Keep route clicks and airport markers ABOVE openAIP. |
| GPS tracks | `components/tracks-map.tsx`: Leaflet base, track polylines and markers | Keep color/route identity and gap semantics. |
| Saved flight | `app/(protected)/flights/[id]/page.tsx` → `components/lazy-flight-track-review.tsx` → `components/flight-track-player.tsx` | Flight detail GPS tab loads tracks on demand; map switch belongs inside the player, not record mutations. |
| GPS import review | `components/gps-import-review-player.tsx` | Optional switch can be reused with read-only map state; suggestions stay advisory. |
| Public shared flight | `app/f/[token]/page.tsx` renders `FlightTrackPlayer publicView` | Security/rights must explicitly include publicly viewable maps; do not accidentally enable a restricted overlay on public pages. |
| Story card | `components/flight-story-card.tsx`: separate SVG map tile pipeline and satellite probe | Already has satellite option. Do NOT conflate/export openAIP until image redistribution rights are checked. |
| Shared Leaflet helper | `components/leaflet-mobile.ts`: only `style=map` basemap; global `tilePane.style.filter` for dark theme; map touch-lock controls and legacy CARTO replacement | Existing dark filter must not alter satellite colors or airspace symbology; preserve iPad gestures. |
| Tile route | `app/api/map-tile/[z]/[x]/[y]/route.ts`: OSM standard and ArcGIS imagery/labels `style=satellite`; server env `ARCGIS_ACCESS_TOKEN`; validated z/x/y; 7-day cache | Satellite transport exists; availability, live token, costs and terms NOT VERIFIED. Current API silently treats unknown `style` as standard; consider strict new-style handling without breaking legacy clients. |
| Map regressions | `tests/v1314-basemap.test.ts`, `v1315-map-readability`, `v1316-dark-basemap`, `v1317-carto-like-basemap` | Source-contract tests assert legacy proxy and dark filter; adapt alongside functional map-switch tests rather than dropping guarantees. |
| Verification selection | `tooling/development-modules.json`: `gps-tracks`, `analytics` path ownership; both have browser requirements; analytics also selects PostgreSQL | Do not manually declare an unrelated gate N/A or weaken registry; exact candidate planner decides and missing browser ownership blocks. |
| Provider/legal | `lib/legal.ts` public registry lists Esri/ArcGIS, but not openAIP; `docs/compliance/V2_9_COMMERCIAL_VALIDATION.md` is fail-closed about external provider approvals | New external supplier/attribution/privacy/rights gate precedes production. |

### Verified public documentation / still unknown

- openAIP publishes separate Core and Tiles API Swagger specifications at `https://api.core.openaip.net/api/system/specs/v1/schema.json` and `https://api.tiles.openaip.net/api/system/specs/v1/schema.json`, advertised by its [official API-documentation repository](https://github.com/openAIP/openaip-api-documentation/blob/master/index.html). The source API endpoints, max zoom, cache directives, supported layers, headers and rate limits must be verified again on the **live** current contract before implementation. Direct schema retrieval was unavailable in this discovery environment; **no specific endpoint shape is frozen**.
- An [openAIP maintainer's 2022 v2 integration example](https://groups.google.com/g/openaip/c/MY4-xil3Ve0) described per-layer PNG tiles, such as airspaces, airports, navaids and reporting points, plus 429/rate limiting and a caching recommendation. This is evidence of feasibility, not a substitute for a current API contract.
- An [openAIP 2024 API-auth migration notice](https://groups.google.com/g/openaip/c/SXblkRg3Ic8) describes `x-openaip-api-key` or `apiKey`. Prefer server-owned credentials **if current Tiles API supports that mode**; do not put a private token into a browser query URL.
- [OpenStreetMap Foundation tile policy](https://operations.osmfoundation.org/policies/tiles/) requires attribution, contactable identification, suitable cache (honour headers or at least 7 days), no bulk fetching, and flags commercial usage availability. Existing OSM proxy must retain its policy-compliant treatment.
- [Esri static basemap terms](https://developers.arcgis.com/rest/static-basemap-tiles/) require Esri **and underlying data attribution**. [Esri pricing](https://developers.arcgis.com/pricing/) bills tile usage; existing ArcGIS account, usage and licensed caching/rendering need live operator review before expanding consumers.
- openAIP is reported as CC BY-NC 4.0 by independent current research referencing its Core API license metadata ([verification article](https://aerocommons.org/articles/2026-09-02-openaip-license-verification/)); a third-party site reproduces a potentially more permissive openAIP explanatory statement for embedding with paid applications ([third-party quotation](https://tallyair.app/legal/data-sources)). **Neither is a binding permission for FlyTally.** Confirm openAIP's controlling live data + tile terms, application/commercial/redistribution interpretation and required attribution with the provider or qualified reviewer. Until approved, **PRODUCTION BLOCKED** for openAIP. This includes public sharing and exported images.

**Not verified:** production `ARCGIS_ACCESS_TOKEN` existence/permissions; real OSM/Esri or openAIP tile responses; licensing correspondence; current openAIP API specs/rate limits; Vercel billing/provider usage; browser/device rendering or accessibility; provider DPA/transfer assessment; deployment health for any new map function. Never report these as PASS.

## 3. Draft technical contract — pending independent review

### 3.1 Layer state and lifecycle

Use one shared Leaflet-compatible map layer-controller contract, adopted incrementally by existing maps. Keep individual `L.Map` lifecycle in its owning component; basemap or overlay changes update **layers**, not `L.map()` instance or `fitBounds()`.

Proposed UI state (not stored or implemented yet):

- `baseMap: 'standard' | 'satellite'`; initial state `standard`.
- `airspacesEnabled: boolean`; initial state `false`, and **forced unavailable** if external approval/config/availability is absent.
- Additional `airports`, `navaids`, `reportingPoints` are deferred options and must not appear enabled before they exist.
- All switches are user-initiated and local to the map instance. Cross-page/account persistence is **NOT approved**; do not silently add last-used defaults or local storage.
- Preserve map center/zoom, current track playback position/speed, clickable route/airport markers, current filters and mobile gesture locks. A theme change must preserve the chosen basemap and overlay values, even if a surrounding React component recreates its current map (current theme dependencies require characterization).

Suggested responsibility split: `map-layer-controller` orchestrates layer identity/state/lifecycle; `map-provider-contract` centralizes provider URLs, attribution, error/availability states; `leaflet-mobile` keeps only shared responsive/touch behavior. Exact paths/interfaces are subject to review; no parallel map implementation.

### 3.2 Pane contract and dark mode

Separate:
1. standard OR satellite basemap (one only), at/below default tile pane;
2. noninteractive raster aviation context above basemap but **below** GPS/route/airport layers;
3. canonical route/GPS overlays and interaction surfaces above aviation tiles.

The current CSS filter on the *whole* `tilePane` is **not** acceptable once satellite and openAIP coexist. Keep existing standard dark-map appearance, applying dark treatment **only** to standard map imagery. Satellite retains authentic imagery color; openAIP retains provider colors and text legibility. Preserve route and marker custom panes (450/470) and click targets. Specify exact pane z-index and attribution layering after visual review.

### 3.3 Provider/backend boundary

Retain current `/api/map-tile/[z]/[x]/[y]?style=map|satellite` contract for existing uses. Extend satellite selection through existing server endpoint; do not create another vendor-dependent browser URL. Do not expose ArcGIS access token to client, error, log or static HTML.

For future openAIP: prefer an explicitly named server-side **allowlisted per-layer tile endpoint** rather than arbitrary upstream URLs; accept strictly validated `layer/z/x/y`, supported zoom and provider configuration; fetch only approved upstream host/path, with credentials server-side; validate expected image types and size, propagate controlled 401/403/429/5xx/unavailable state, provider-compliant cache directives, sensible throttling/usage safeguards and no raw upstream error responses to users. No user/private GPS coordinates, account identifiers or tokens are passed to openAIP; tile coordinates necessarily express viewed geographic area. Public tile access is an explicit separate decision for shared-flight routes.

Do not assume a probe that returns one valid tile establishes global coverage or status for an entire rendered viewport. A display's state should distinguish requested, loading, available, partial and unavailable coverage, as far as reliably measurable, without fake success; satellite fallback must be visible as fallback, not mislabeled satellite. Fail closed on malformed or unauthorized responses; do not fall back to an unrelated aviation provider or fabricated geometry.

### 3.4 Attribution, aviation meaning and accessibility

- Basemap attribution follows the **currently selected** provider (OSM for standard; Esri AND data suppliers for satellite). Show the openAIP attribution whenever openAIP pixels/data are visible, with exact wording and link after rights review. Never hide attribution under compact/iPad overlays or in the public replay.
- `Airspaces` describes chart-like **reference context only**. A shown boundary does not prove activation or safe clearance at the historic/current flight time. Do not show `ACTIVE`, `CLEAR`, NOTAM status or an altitude/airspace penetration result. No operationally authoritative colors or alerts beyond licensed provider depiction.
- `Airspace details` (names, class, lower/upper levels or click popups) require an independently source-backed Core API feature-data contract, provenance/age and geometric identification; PNG-only raster tiles cannot support trustworthy per-feature click lookup. Keep details out of Phase 3 unless reviewed as a separate milestone.
- Controls are accessible buttons/checkboxes with status and focus, 44px usable coarse touch targets where applicable, non-overlapping with Leaflet zoom and `Enable map movement`. Verify light/dark and portrait/landscape.

### 3.5 Error and security matrix (acceptance)

| Condition | Required behavior |
| --- | --- |
| Existing standard map; feature OFF | Exactly legacy default behavior and attribution, no openAIP requests |
| Satellite selected, configured and licensed | Satellite tiles + correct Esri/data attribution; flight overlays unchanged |
| Satellite token absent/unauthorized/provider error | Visible `Satellite unavailable` state; optionally revert to clearly labeled Standard; no exposed token |
| openAIP permission/config not approved | Hidden/disabled `Airspaces` with explanatory unavailable state; never fetch data |
| openAIP 401/403/429/5xx/malformed/non-image | Controlled failure, no false coverage, no retry storm, no raw credentials/error |
| OpenAIP partial tile failures | Partial/unavailable context signaled rather than falsely complete aviation layer |
| Switch while GPS playback running | No playback reset, no GPS mutation, map center/zoom preserved |
| Dark and light/theme switch | No filtered satellite/openAIP symbology; standard dark styling retained |
| Public share/story export | No new data/rights leak; openAIP not exported; public sharing subject to explicit rights approval |
| Invalid layer/z/x/y or untrusted host | Reject before fetch; no SSRF; no external dynamic host selection |
| Keyboard/iPad mobile interactions | Controls reachable, no accidental pan, map movement lock preserved |

## 4. Phased delivery / dependency chain

**Phase 0 — Read-only discovery & design: DONE for current source inventory.** This document and the independent review handoff capture implementation contract and unresolved external gates. The Phase 0 **design approval** remains PENDING; it is not a runtime sign-off.

**Phase 1 — Shared Leaflet layer abstraction:** standard-only behavior first, preservation of current map/touch/dark/proxy behavior; map lifecycle and view-state characterization tests. No vendor switch until visual acceptance.

**Phase 2 — Satellite on existing maps:** route overview, GPS tracks, saved flight replay, GPS import review, and public share **only if ArcGIS rights cover it**. Reuse existing backend and distinct satellite availability/attribution; Story SVG pipeline remains separate and stable. Release may ship satellite independently if external openAIP approval is pending, but do not describe unfinished openAIP as delivered.

**Phase 3 — openAIP aviation overlay (externally gated):** current API verification, explicit rights and provider/legal review, static airspace raster tiles, provider proxy/cache/security/attribution/error states, conditional public-map applicability. Airports/navaids/reporting points are later, separately approved additions.

**Phase 4 — Release verification / production closeout:** exact-candidate `verify:plan`, `verify:iterate`, `verify:release:risk` selection; map/browser acceptance across desktop/iPad landscape+portrait/mobile, light+dark, routes+GPS+saved flight+import+public share, failure injection; production provider smoke only after approved configuration; Vercel runtime errors/cost watch; release number/build/DB state and ROADMAP/FEATURES/CHANGELOG synchronization.

No phase is DONE until tests and, where applicable, production evidence satisfy the repository DoD. Any scope shift (e.g., full vector airspace or operational airspace queries) requires an updated contract and an explicit Filip decision before implementation.

## 5. Targeted tests and verification

Before implementation, add/register dedicated map browser-acceptance targets when required by the current module ownership; characterize that existing `gps-tracks` and `analytics` registration currently selects broader browser/PostgreSQL work and may block if target evidence is missing. Do not edit verification ownership solely to bypass hard gates.

Retain current `v1314`–`v1317` map visual/source contracts, updating exact assertions **with proof**, and add behavioral tests for state switching/cleanup, stale layer removal, attribution and correct z-index, early invalid-input rejection, provider failure and rate limiting, no duplicate map instances and retained playback. A provider-unavailable deterministic test must not require a live API token.

Evidence baseline for Phase 0: **source inspection only; tests/typecheck/build/Playwright/PostgreSQL/deploy NOT RUN; DB migration N/A on proposed scope**.

## 6. Gates and outstanding decisions

1. **External openAIP license + tile permission** — blocking production Phase 3; verify official terms, commercial/free-distribution interpretation, attribution, public replay, caching and image-export rights. Direct permission or qualified legal analysis must be recorded, not guessed from CC wording.
2. **Current openAIP API contract + key** — blocking Phase 3 implementation; exact live schema, supported layer names and zoom, rate limits, error/content type, cache, authentication.
3. **Esri imagery entitlement and provider attribution** — blocking enabled production satellite selection; actual `ARCGIS_ACCESS_TOKEN` and plan, pricing, terms, downstream attribution requirements and usage controls.
4. **Product behavior** — default standard and airspaces OFF proposed/frozen for review; any persistent preference is deferred. If Filip wants overlays on the public flight share, must explicitly confirm provider rights before release; Story image overlay remains OUT.
5. **Acceptance coverage** — map-specific browser cases and screenshot/interaction proof across portrait iPad, landscape iPad and mobile; ensure CI planner does not silently lack this evidence.

## 7. Review / frozen and not-frozen decisions

**Frozen by product request:** map satellite toggle in flight map preview and optional openAIP overlay; `3.7.0` as new active release; no runtime implementation during Phase 0; prior currency and multi-aircraft feature intents preserved/resequenced.

**Recommended, awaiting independent review:** Leaflet reuse; no DB changes; default standard, airspace OFF; shared controller with provider-specific panes; server-owned openAIP key/proxy; initial airspace raster only; optional independently shipable satellite phase.

**Not approved / not evidenced:** provider licensing, operational suitability, public use, per-feature airspace details, cost model, current rate/zoom contract, runtime success, database/regulatory approval.

Related review document: `docs/product/3_7_0_MAPS_REVIEW_HANDOFF.md`.
