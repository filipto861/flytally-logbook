# 3.7.0 Phase 2 / S1 — Satellite architecture decision gate

**Status:** S1 read-only source/repository analysis complete; **PRODUCTION GO = NO / DEFER** pending external evidence and independent review.  
**Date:** 10 October 2026  
**Base:** `main@ee4f7c2f1939f54e6f2c064453c2969fef636224`  
**Scope:** `flytally-logbook` only; Satellite first, openAIP paused.  
**Decision type:** Conditional engineering preference, **not an implementation or deployment authorization**.

## 1. Decision in one paragraph

**Prefer preserving the existing Next.js + Leaflet map architecture, with World Imagery and Imagery Labels as independent provider-specific raster layers served through a session-authorized, server-owned proxy; do not switch to MapLibre merely to fix provider geometry.** Each layer must retain its own verified tile scheme, size, zoom limits, attribution, availability, and provider usage accounting. This direction follows Esri's official independently layered examples; it **does not** establish a FlyTally-specific exact z/x/y mapping or grant licensed access. Do **not** ship the current 256px composite-SVG provider as-is without geographic-footprint verification. If contractual or technical evidence later rejects layered use, reconsider the smallest compliant provider arrangement at a new S1 decision gate rather than inventing a transform.

**S1 verdict:** Architecture **CONDITIONAL PREFERENCE**; live provider, credential, rights, account/cost, effective resource ceilings and full 3.7.0 release: **DEFER/BLOCKED**. No token or supplier requests authorized by this document.

## 2. Direct repository evidence (current main vs unmerged work)

| Area | Verified repository fact | Consequence |
| --- | --- | --- |
| Main Standard map | `app/api/map-tile/[z]/[x]/[y]/route.ts` accepts `style=map|satellite`; `main` already serves public OSM/Standard; Phase 1 PR #269/#270 merged | Standard behavior and strict style parsing are frozen |
| Main Satellite backend | Same route fetches World Imagery and 512px static `arcgis/imagery/labels` at the **same** z/y/x, embeds both into one 256px SVG; also tries `World_Boundaries_and_Places` fallback; returns public-cacheable Satellite SVG, no Satellite-specific session gate | Not production-acceptable as a new public consumer; 256px resize does not prove correct footprint |
| Satellite selector | Draft PR #272 uses an OFF-by-default `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS` build-time feature flag on four authenticated map surfaces; owner LOCAL ON/OFF acceptance exists on historical exact SHA | Keep default Standard/no preference persistence; do not transfer old SHA PASS to new runtime |
| Story | `components/flight-story-card.tsx` auto-probes `style=satellite` and can embed/map-export PNG; PR #273 adds fail-closed PNG behavior | Story is an **existing separate compositor and consumer**; independent layering on Leaflet **does not** automatically solve Story export; do not silently remove or widen it |
| Auth/response gates | Stacked Draft PRs #274–#278 add satellite-specific session checks, private/no-store response, deterministic mock HTTP, server-only upstream disable; locally tested on recorded exact SHAs | Reuse after integrating/reconciling onto latest main, not a blind branch-stack merge |
| Hardening experiments | Draft PR #279 contains isolated bounded-fetch/image/admission utilities with local targeted acceptance on selected SHAs, **not wired to production provider** | No production limits or global cost/concurrency cap proven; don't merge or activate solely on synthetic tests |
| Production state | `3.6.0`, Standard Phase 1 done; Satellite feature flag OFF; no final 3.7.0 release | S1 is analysis-only; DB/certification/GPS/backup untouched |

Canonical roadmap remains `ROADMAP.md`; archive and dated branch handoffs are evidence, not live execution authority.

## 3. Authoritative Esri documentation vs missing real-provider facts

1. [Esri Imagery Labels tile reference](https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-tile-get/) explicitly defines 512×512 PNG static tiles, level 0–22, `premium:user:staticbasemaptiles` privilege, and **static zoom level 12 corresponding in scale to traditional imagery level 13**. This disproves any **untested assumption** that identical z/x/y and a 256px resize necessarily yield the same geographic footprint; it does not alone prove a particular mismatch for every coordinate.
2. [Esri Imagery Labels metadata](https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-meta-data-get/) documents the source-specific metadata endpoint and Bearer auth. Current actual `tileInfo`/origin/CRS/LOD for the three FlyTally upstreams was **not captured** in previous owner attempts.
3. [Esri example: World Imagery + Imagery Labels in separate MapLibre layers](https://developers.arcgis.com/maplibre-gl-js/maps/raster-tile-basemaps/display-multiple-basemap-layers/) documents independent raster layers, with `tileSize: 512` for static labels. [Esri OpenLayers example](https://developers.arcgis.com/openlayers/maps/raster-tile-basemaps/display-multiple-basemap-layers/) also shows independent sources. This supports **layer separation as a legitimate provider pattern**; it does **not** explicitly certify FlyTally Leaflet integration, provider-specific zoom transforms, licensing, or a secure custom proxy.
4. [Esri static basemap service guide](https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/) requires **Esri and underlying supplier attribution**, including in third-party/open-source clients. Dynamic regional imagery/source credits may differ from a single hardcoded label.
5. [Esri API key credential guide](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/api-key-credentials/online/) says referrer changes require new access token issuance, invalidating previous tokens. Prior owner screenshots showed only `https://*.vercel.app` in the key's allowed referrers, whereas FlyTally's backend forwards the `fly-tally.com` referer. **Possible** mismatch, not a confirmed upstream denial. **Never** edit/referrer-rotate credentials without a coordinated operator plan.
6. Old owner-approved base-metadata attempts (only World Imagery) did not yield sanitized usable `tileInfo`: unexpected MIME then HTTP 200 text/plain rejection; a Windows Node24 native assertion occurred after both. **No proven Esri server failure or Node crash root cause**. Do not repeat generic collectors or any billable endpoint requests by default.

No collected source establishes the exact Esri contract for FlyTally's account, all provider service privileges, allowed server-side proxy/cache/recomposition, Story PNG redistribution, current supplier attribution, token rotation impact, customer-specific costs or defensible production byte/timeout/admission values.

## 4. Architecture alternatives, evaluated

| Candidate | Advantage | Major unresolved problem | S1 disposition |
| --- | --- | --- | --- |
| A. Existing same-z/y/x server-composed SVG | Smallest near-term code change, matches legacy Story format | Unproven geographic footprint, full-response `arrayBuffer()`, 256 resize, provider rights and cache/resource exposure | **NO-GO AS-IS**; may be reconsidered only if supplier-specific geometry and operational constraints are proved |
| B. Leaflet with separate imagery and label layers through authenticated backend | Matches documented provider layering principle; preserves current Leaflet, playback and independent layer scale; avoids expensive client framework switch | Requires provider-specific tile scheme and server-proxy endpoint contract, layered state/fallback and separate Story export treatment | **PREFERRED FOR DETAILED DESIGN**, still **DEFER** for implementation/production pending gates |
| C. MapLibre replacement | Esri documented tutorial directly applies | Unnecessary UI map-library replacement, risks map touch controls, GPS playback, public map and component lifecycle | **NOT SELECTED** absent evidence that B cannot comply |
| D. Single imagery layer without labels | Minimal geometry/overlay path, potentially fewer upstream requests | Flight map usability/labels, Story expectations, source/attribution still gated | **Fallback product option only**, needs explicit owner agreement and documented UX change |

### Candidate B boundary (conditional, not implementation specification)

- Keep existing Leaflet `L.Map` instance, `flytallyBasemap` pane and flight/replay state. Satellite selection may attach two separate tile layers; each layer must have explicit `tileSize`/`zoomOffset`/`nativeZoom`/range only after the actual provider scheme is verified. The current one-base-layer controller and 256px compositor are **not** ready for this without an intentionally scoped change.
- New imagery/label proxy endpoints (or another reviewed same-origin route contract) must authorize on every Satellite request **before** cache/upstream/token access. Existing public Standard URI/query contract remains unchanged; do not expose provider API tokens or create a client direct-to-Esri dependency without a separate auth/security/terms decision.
- Primary imagery failure => visible Satellite unavailable or user-visible Standard fallback. Label failure may only degrade to **image-only** if approved as a product and attribution/availability contract; never silently add a geographically inconsistent overlay.
- Distinguish client UI flag OFF from server authorization and server-only emergency upstream disable. Dynamic/upstream cache semantics follow approved vendor terms and authenticated response protection. No fabricated global quota, per-process concurrency safety claim or numeric byte/time defaults.
- **Story**: keep Standard/Satellite export choices and fail-closed tile capture. Story's fixed 256px grid needs separately validated provider-compliant raster composition or another approved export-specific strategy. Do not assume Leaflet layers can be captured into the Story SVG for free; do not remove or expand user-facing Story behavior during S1. Export rights and accurate credits are independent blockers.
- Public shared flight replay stays Standard-only. openAIP implementation remains paused; no new map controls, Flight/GPS/recency derivations or schema changes.

## 5. Evidence gates before S2 and before production

| Gate | Minimum authoritative evidence / acceptance | Status |
| --- | --- | --- |
| S1-G1 — Provider/service geometry | Verified service-specific imagery, preferred-label and fallback tileInfo (CRS/origin/LOD/tile dimensions/footprints), mapped against Leaflet/Story coordinates; provenance and sample correctness; no guessed transform | **BLOCKED** |
| S1-G2 — Licensing and Story | Operator/Esri product terms or qualified decision on authenticated web display, fixed-host server proxy, provider-side caching, composite SVG and redistribution in downloadable Story PNG | **BLOCKED** |
| S1-G3 — Account credentials/referrers | Confirm FlyTally account subscription, active key's privileges for **all three** services, actual accepted Referer and expiry; written scoped rotation/rollback plan if editing restrictions | **PARTIAL / BLOCKED** |
| S1-G4 — Attribution | Correct Esri + region/service-specific providers, interactive layers and Story PNG, accessibility and credit visibility | **BLOCKED** |
| S1-G5 — Billing/operational safety | Account-specific cost/usage, quota/alert or hard-stop policy, session/abuse controls, upstream caching rights, bounded response/per-instance vs multi-instance limits supported by deployment evidence | **BLOCKED** |
| S1-G6 — Product/engineering design | Independent DeepSeek read-only review reconciled against repo + sources; smallest safe migration of PR #272–#279; cover existing Story and public Standard | **PENDING** |
| S2-G7 — Exact-candidate implementation | Per-layer positioning tests, fail closed/no false satellite, ON/OFF auth/HTTP/Story, Next build, selected isolated PostgreSQL and desktop/mobile/iPad portrait/landscape/night; no changes in certified flights | **NOT RUN** |
| S3-G8 — Provider/production | Separately owner-approved, bounded live provider evidence; physical browser where required, usage/error watch, production smoke, rollback; explicit release authorization | **NOT AUTHORIZED** |

**Fail-closed exit:** If G1–G6 remain unsupported, **DEFER** provider integration and keep Satellite OFF; do not invent an alternative currentness or license assumption to call it GO.

## 6. Smallest next executable actions (no network to Esri)

**S1.1 — independent architecture review (NEXT):** send this document plus exact PR #272–#279/source SHA references to DeepSeek for read-only critique. Ask about (a) separate Leaflet layers vs SVG, (b) fixed token-safe server proxy and shared-cache hazards, (c) Story export equivalence/rights, (d) source-backed tile coordinate transform only after real tileInfo, (e) minimum integration branch plan and acceptance. Reconcile review; reviewers are not authority.

**S1.2 — provider account evidence (operator only):** on the ArcGIS Location Platform portal, inspect subscription/usage/permissions/renewal, service credit docs, actual allowed referrer and supplier terms **without showing secret values**. Do not change credential/referrer/production env. If rights/terms are unclear, prepare a narrow written Esri inquiry. Only after explicit new owner authorization define any controlled metadata/service requests with fixed endpoints, count, timeout/bytes, no tile imaging or secret logs. Previous supplier GET authorization does not roll over.

**S1.3 — revised GO/NO-GO/DEFER:** after review and source closure, freeze the implementation contract; only then start smallest runtime S2 branch. Avoid further generic Node transport experimentation or openAIP work in parallel.

### Read-only review handoff — to DeepSeek

```text
FlyTally Logbook 3.7.0 — S1 independent architecture review (READ ONLY).
Current main: ee4f7c2f1939f54e6f2c064453c2969fef636224; release 3.6.0.
Review docs/product/3_7_0_S1_SATELLITE_ARCHITECTURE_DECISION.md and exact current branches PR #272–#279 (stacked Draft, no merge).
Owner freezes: Satellite FIRST then openAIP, both in full 3.7.0; Standard default/public replay Standard-only; authenticated map surfaces + existing Story preserved; no provider calls/rights assumptions; no runtime merge or production flag changes.
Decision candidate: Next.js + Leaflet, independent World Imagery and Imagery Labels layers through token-safe authenticated backend. Existing server-side same-z/y/x 256px SVG is NOT accepted as geometrically valid without source proof. Esri static labels are 512px and 1 level off vs traditional 256px image scheme; actual endpoint tileInfo, licence and supplier credits unavailable.
Independently challenge architecture, tile mapping, Leaflet layer lifecycle, auth/cache cost exposure, standalone Story PNG export, admission/resource safety, fallback/no false satellite, and smallest PR integration plan.
Return concrete evidence-linked ACCEPT / CHANGE / REJECT findings; distinguish verified source vs hypothesis; DO NOT modify repo, credentials, supplier accounts, production or generate invented policies.
```

## 7. Verification and change boundary for this document

- **Performed:** read-only latest main/PR and key implementation file inspection; official public Esri docs comparison; historical owner-local test evidence reviewed without transferring PASS to this draft.
- **NOT RUN on this document/branch:** Node/TypeScript/build/Playwright/PostgreSQL, CI, physical Safari, actual ArcGIS account/provider tile/metadata, deployment/production smoke.
- **No changes:** runtime code, external credentials, supplier calls, `flytally-training`, database schema, GPS/certified-flight evidence, existing public sharing, product version or production environment.
