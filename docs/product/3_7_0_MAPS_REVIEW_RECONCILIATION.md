# 3.7.0 — Maps & Aviation Layers: independent review reconciliation

**Date:** 9 October 2026  
**Repository source verified:** `main@162d9ba88c7302dc45e564d8b59a5c3cdf060709`; draft docs PR #268.  
**Input:** independent technical review delivered as an attached text, 12 findings C1/C2, B1–B4, O1–O3, D1–D3; reviewer overall verdict **BLOCK**.  
**Status:** reconciliation documented; **no runtime change or release approval**. No reviewer or operator has approved external rights.

## Follow-up product compatibility decision (9 October 2026)

**Product decision A — APPROVED by owner, 9 October 2026:** preserve strict query parsing for `/api/map-tile/[z]/[x]/[y]`: absent `style` = legacy `map`; exactly one `style=map` or `style=satellite` is accepted; any duplicate `style` (including identical values), empty/unknown/alias/case-variant style parameter = HTTP 400 `unsupported_style` with `Cache-Control: no-store` and no upstream fetch. This deliberately changes the earlier first-value duplicate behavior. Owner accepts this compatibility trade-off. Implementation and local Node/Playwright release evidence PASS on feature HEAD `5538e0c4eec8b4a70fc5568facc55f4dc7324606`; not a merge/deploy authorization. Satellite/openAIP licensing and production gates remain separately BLOCKED.

## Decision

**Accept the production block; reject interpreting it as a global block of all work.** The current release remains `3.7.0 Maps & Aviation Layers`. Architectural Phase 1 may start **only after** the revised pane/state/lifecycle/test contract is reviewed and accepted; implementing and passing its characterization tests is part of Phase 1 DoD, not a prerequisite paradoxically requiring tests of code not yet written. Satellite Phase 2 and openAIP Phase 3 must **not** be activated in production without their independent provider gates.

The reviewer identified two **forward-looking hazards**, not evidenced current failures: C1 presently filters the *standard* basemap via `tilePane` and there is no Leaflet satellite in that shared helper; C2 currently returns standard tiles for unknown `style`, but no existing Leaflet client selects unknown styles. Both require prevention in the upcoming implementation. Do not claim existing production regression or verified runtime incident.

## Finding disposition

| Finding | Disposition | Source evidence / correction | Gate / acceptance |
| --- | --- | --- | --- |
| **C1** dark `tilePane` filter | **ACCEPT risk; reclassify latent** | `components/leaflet-mobile.ts` filters the entire `tilePane`; present helper only requests `style=map`. Scoped basemap pane required, no filter on satellite/openAIP. | Phase 1 abstraction must preserve standard dark appearance; Phase 2 deterministic dark/light browser pixel or computed-style evidence for satellite, plus overlay readability. Reviewer-proposed "small average luminance tolerance" is not a trustworthy universal golden metric; use fixture pixels and DOM filter isolation. |
| **C2** unknown `style` fallback | **ACCEPT risk; reclassify latent** | `app/api/map-tile/[z]/[x]/[y]/route.ts`: only strict equality to `satellite`; all other strings route to `map`. | Phase 1/2 explicit `map | satellite` allowlist; legacy *missing* style stays `map` if required by prior contract; unsupported/duplicate style fails HTTP 400 with controlled response and `no-store`; do not mix aviation layer names into basemap style. Unit/route test unknown/typo style. |
| **B1** pane order | **ACCEPT; precise names corrected** | Existing route pane name is `routeLines` (450), airport pane `airportMarkers` (470); reviewer suggested new `routePane`/`airportPane` aliases **are not current names**. `overlayPane` default 400; markerPane 600. | New `flytallyBasemap` pane **210** (above default 200, below aviation 300); new `flytallyAviation` pane **300**, pointer-events none; existing `overlayPane` **400**, `routeLines` **450**, `airportMarkers` **470**, marker/tooltips/popups untouched. Named pane DOM + hit-target tests; no raw aviation tiles in overlayPane. |
| **B2** map instance test | **ACCEPT behavioral target, MODIFY test method** | Current route, tracks and player effects own their `L.map()` and may intentionally destroy/recreate on `theme` changes after cleanup. No production duplicate-container exception was shown. Package uses Node `node:test` and `@playwright/test`, **not Jest/Vitest/React Testing Library**. | Characterize current mount/unmount/theme behavior first, then test final intended one-live-instance-per-container, no duplicate active maps or tile layers, preserved viewport/cursor and cleanup via **existing Playwright + pure Node**. Do not introduce a new test framework solely for this. A theme change may be refactored to preserve map identity only after browser proof. |
| **B3** Esri attribution | **ACCEPT blocking satellite production** | Esri specifies Esri AND data-provider attribution. Existing Leaflet helper only adds OSM. Current Story SVG route is separate and does not prove interactive attribution. | Review exact-provider attribution for World Imagery + preferred labels/reference fallback, including provider attributions conditional on layer presence; desktop + iPad landscape/portrait + mobile and zoom/touch controls; DOM visible + no overlap screenshots before Phase 2 production. |
| **B4** Esri token/quota | **ACCEPT blocking satellite production** | `ARCGIS_ACCESS_TOKEN` referenced in code, but production Vercel token validity, entitlements, quotas, cache licensing and usage volume not checked. | Operator read-only credential/plan/usage audit, authorized minimal live test, quota/cost estimate, monitoring and precise provider-error UI; never disclose token. |
| **O1** openAIP licence | **ACCEPT blocking production; preserve uncertainty** | Reviewer reports live Core API schema `CC BY-NC 4.0`, but independent fetch here returned 402; Tiles schema likewise unavailable. Other third-party integrations use inconsistent licence naming and one quotes a potentially permissive statement. None proves FlyTally rights. | Obtain authoritative openAIP terms and written provider permission or qualified legal confirmation covering intended distribution, caching, attribution and proxy behavior; otherwise disabled. Do not assert use is already allowed. |
| **O2** Tiles API contract | **ACCEPT blocking Phase 3 integration** | Official openAIP Swagger UI lists Core/IAM/Tiles URLs, but direct schemas not retrievable in this environment. Historic maintainer example shows PNG tiles and 429; cannot freeze current max zoom/auth/rate/TTL from history. | Exact current schema or written official docs plus authorized credential test, recorded revision/date, supported layers, auth, rate/backoff, tile/image types, zoom, cache, response errors, fixed host, server-only secret; otherwise no Phase 3 runtime. |
| **O3** public shares | **ACCEPT and resolve conservatively** | `app/f/[token]/page.tsx` uses `FlightTrackPlayer publicView` and Story SVG has separate tile export path. | **3.7.0 openAIP is private authenticated map only; NOT shown on any public share, Story export, printed/social image.** Do not send any openAIP request from public consumers. Public satellite *new* toggle is deferred pending explicit Esri sharing rights; preserve current public standard map and existing Story behavior. Source/browser negative tests. Future broadening requires new product/right decision. |
| **D1** airspace details | **ACCEPT deferred** | Raster tiles do not provide trustworthy clicked feature metadata. | Separate source-backed Core API contract, provenance and applicability; no inferred feature popups. |
| **D2** offline caching | **ACCEPT deferred** | OSM tile policy forbids prefetch/offline tile downloads, and service caching has separate rules. | No prefetch, offline pack or bulk tiles. Cache only as permitted and revisit upstream terms. |
| **D3** broad verification gates | **ACCEPT** | `tooling/development-modules.json` maps `analytics` and `gps-tracks` to risk-scoped browser/DB requirements; dedicated map browser targets are currently absent. | Do not weaken safety registry merely to reduce gate cost. Plan+verify exact changed candidate, add browser-owned map cases before claiming PASS. |

## Revised architecture constraints (draft design freeze for next review)

1. **Pane IDs / z-index:** `flytallyBasemap` 210; `flytallyAviation` 300 (pointerEvents none); Leaflet default `overlayPane` 400; preserve existing `routeLines` 450 and `airportMarkers` 470; default `markerPane` 600, `tooltipPane` 650, `popupPane` 700. Scope the legacy dark filter to `flytallyBasemap` **only while `baseMap==='standard'` and dark theme**. A uniform base pane is acceptable if its filter is reset synchronously during switch and the previous tile layer is removed before the new layer is committed. Do not filter `tilePane`, aviation, popup, DOM controls or attributions.
2. **Lifecycle:** one active `L.Map` per mounted DOM container; map component still owns instantiation and `map.remove()` cleanup. One active basemap layer. Baselayer/overlay toggles and theme changes do not call `L.map`, `fitBounds` or reset playback. Track/data changes can intentionally re-fit only under an explicit separate contract. Unmount/remount may recreate and must clean up; "exactly one lifetime `L.map` call" is **not** a correct universal assertion across React Strict Mode remounts.
3. **Style parsing:** `style` missing remains legacy `map`; explicit supported values `map|satellite`. Typos/unknown/multiple styles: controlled HTTP 400 `unsupported_style`; no map-looking success response. A distinct, allowlisted openAIP endpoint owns overlay `layer`, never abuse `style` to conflate endpoints.
4. **Map capability:** in 3.7.0 default standard; satellite and aviation OFF unless user selects them on the authorized surface. No cross-account/browser persistence, automatic overwrite or background prefetch. Active only when permitted/configured. Response labels must tell truth; don't equate one successful tile probe with all viewport tiles.
5. **Public boundary:** keep current public flight replay and Story map appearance. Neither openAIP nor new satellite controls are available there in 3.7.0 without separate explicit licensing scope approval. Prevent openAIP tile retrieval from public endpoints even if an unauthenticated user guesses endpoint coordinates; server must gate as well as UI.
6. **Aviation meaning:** static reference context only, not operationally current airspace, NOTAM, active/clear, or infringement validation.

### Required deterministic acceptance before Phase 1 closes

- Inspect named pane DOM, class/filter + z-index, one standard basemap tile layer, pointer events, route/airport popup/click selection and GPS overlay order.
- Use controlled fake tile responses/fixtures for `map`, `satellite` and later openAIP: no reliance on paid API, unstable provider images or network for regression gates.
- Theme switch while a map is mounted: no active second map instance, stable viewport, standard map dark style preserved, satellite/aviation unfiltered.
- Toggle provider layer during playback: retained cursor, rate, play/pause state, aircraft bearing/position, no `fitBounds` or duplicate layer.
- Invalid/duplicate `style` yields controlled 400; missing legacy `style` still standard; provider 401/403/429/5xx/non-image yields truthful unavailable state.
- iPad landscape/portrait and mobile: attribution visible, no overlap with map-touch unlock and zoom controls, keyboard/focus accessible.
- Public negative test: no openAIP network requests from `/f/[token]` and Story image; no accidental public private-tile proxy access.

**Evidence:** read-only inspection and official published docs only, tests/build/Playwright/live provider/license/DB/deploy **NOT RUN / NOT VERIFIED**.

## External reference hierarchy and what was actually retrieved

- **Official Leaflet** [panes](https://leafletjs.com/examples/map-panes/) confirms per-map panes and using `pointer-events: none` on noninteractive raster layers. These are design rules, not runtime verification.
- **Official Esri** [static basemap introduction](https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/) requires Esri and underlying data provider attribution for non-Esri renderers; [data attribution](https://developers.arcgis.com/documentation/glossary/data-attribution/) documents map/provider names. Exact World Imagery suppliers and licensing terms still require operator-level check.
- **Official OSM** [tile policy](https://operations.osmfoundation.org/policies/tiles/) requires visible attribution, identified upstream requests, appropriate caching and no offline/bulk fetching; commercial services have no guaranteed SLA.
- **Official openAIP Swagger UI source** [repository index](https://github.com/openAIP/openaip-api-documentation/blob/master/index.html) confirms current advertised Core/IAM/Tiles schema URLs. In this work session, direct Core/Tiles schema fetches were **unsuccessful (402)**; no API/rights approval inferred.
- **Historic openAIP maintainer** [v2 migration thread](https://groups.google.com/g/openaip/c/MY4-xil3Ve0) documents PNG layer examples/429 behavior as of 2022; do not treat historical implementation as today's API specification.
- Third-party integration docs disagree over licence nomenclature (e.g. [AirTrail](https://github.com/johanohly/AirTrail/blob/main/docs/content/docs/integrations/openaip.mdx)); [TallyAir](https://tallyair.app/legal/data-sources) quotes a potentially permissive openAIP text, but is not itself a licence grant to FlyTally. The reviewer asserted a Core API CC BY-NC 4.0 licence based on a successful upstream fetch; **not independently reverified here**. Further official provider correspondence is required.

## Remaining decisions and gate owner

| Gate | Owner | Current |
| --- | --- | --- |
| Technical Phase 1 scope/architecture | Filip + implementation review | **Draft ready for review; no code** |
| Current openAIP Terms/Tiles API permission | Provider / qualified legal reviewer | **BLOCKED external** |
| ArcGIS imagery license/token/quotas & attributions | Provider account owner | **NOT VERIFIED — blocks satellite production** |
| Public map overlay scope | Product | **Conservatively excluded from 3.7.0** |
| Browser coverage + exact candidate planner | Implementation | **NOT RUN** |

Do not automatically mark Phase 0 externally closed merely because the review was reconciled. Contract reconciliation is a **documentary design milestone**; provider and implementation approvals are distinct.

---

## Second independent re-review — 9 October 2026 (subsequent review, retained independently)

**Verdict received: APPROVE WITH CHANGES for Phase 1 technical contract.** Phase 2 satellite **production** and Phase 3 openAIP **production** remain BLOCKED by their respective external gates. This re-review does not approve runtime, a provider licence or a release, and does not retroactively change the earlier BLOCK verdict. The earlier finding dispositions above remain the historical record.

**Accepted conditions and scope corrections:**

| Re-review item | Reconciled obligation | When it must be proved |
| --- | --- | --- |
| C1 | No global `tilePane` dark filter; effective computed filter only on Standard/dark `flytallyBasemap`; deterministic controlled image or computed-style regression | Phase 1 for standard isolation; Phase 2 for actual satellite pixels |
| C2 | Strict `URLSearchParams.getAll('style')`: missing => legacy Standard; exactly one `map`/`satellite` => known style; explicit empty, typo, unknown, any duplicate => 400 `unsupported_style`, no upstream fetch | Phase 1 route tests |
| B1 | Exact per-map panes + effective z-index, noninteractive aviation; default panes unchanged; route/airport panes only where the route overview creates them | Phase 1 Playwright/browser DOM |
| B2 | One live map and preserved map pane identity/view/playback through theme or layer updates; `.leaflet-container` count alone is insufficient; Strict Mode teardown/re-mount permitted | Phase 1 Playwright/browser; source characterization |
| S1 | Exact Esri and each applicable underlying data supplier attribution text/link, including labels fallback, desktop/iPad portrait+landscape/mobile legibility | Phase 2 production gate |
| S2 | Actual ArcGIS token plan/entitlement, quotas, allowed cache period, volume/cost and controlled 403/429 behavior documented | Phase 2 production gate |
| O1 | Binding openAIP usage rights/licence and attribution, cache, public image/export interpretation, not inferred from CC headline | Phase 3 production gate |
| O2 | Current provider Tiles API schema/revision, auth/zoom/layers/429/headers/content-type/cache/errors | Phase 3 integration gate |
| O3 | New openAIP endpoint server-authenticated: 401 without session / 403 authenticated without rights; public guessed URL negative tests, no shared-flight/Story requests | Phase 3 security gate |
| Deferred | Error matrix public restrictions, CSP audit, provider+layer+z/x/y+revision cache identity, noncached errors, bounded validated raster size/type and provider zoom | Design now, implement in gated phase |

**Technical correction to re-review evidence:** the reviewer calls C1/C2 "confirmed defect in existing runtime." Actual baseline shows a broad dark filter and permissive style parser **already exist**, but satellite is not selected by the current shared Leaflet helper and malformed styles are not a documented UI path. The potential future incorrect result is confirmed by source logic, **not** a demonstrated production incident. Their required fixes are accepted without claiming a production outage.

**Test registration clarified:** the reviewer requires Phase 1 test registration and assertions to be accepted before Phase 1 is called ready. Actual registration is **not performed** in this docs-only PR. The explicit proposed map browser targets, exact titles/projects, fixture strategy, lifecycle oracle and risk-plan ownership are specified in `docs/product/3_7_0_PHASE1_TEST_ACCEPTANCE.md`. Existing `node:test` and `@playwright/test` are the only planned frameworks. We will register executable cases and demonstrate them PASS in Phase 1 implementation; documentation does not satisfy that implementation DoD.

**CSP factual correction:** current `next.config.ts` includes `img-src 'self' data: blob: https:` and `connect-src 'self'`. New proxied aviation requests should remain same-origin and must not broaden `connect-src`. Narrowing the existing `img-src` to `'self'` without a separate compatibility audit is **not** part of Phase 1.

**Phase 1 disposition:** **TECHNICAL DIRECTION CONDITIONALLY APPROVED BY INDEPENDENT REVIEWER; ACCEPTANCE CONTRACT PREPARED; IMPLEMENTATION NOT AUTHORIZED BY THIS DOCUMENT, NOT STARTED.** The next action is to accept the Phase 1 test plan and start a minimal independent implementation branch after Filip's approval. No need to wait for openAIP provider licence to do **standard-only Phase 1**.

**Phase 2/3 disposition:** external rights and provider schema/entitlement gates unchanged, **BLOCKED**; do not add enabled tiles, UI availability claims or public overlays.

**State evidence:** source/doc-only reconciliation, no tests/build/DB/Playwright/provider-live checks/deploy; all **NOT RUN**, DB migration **N/A** in this scope.
