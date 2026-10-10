# 3.7.0 Phase 2 / S1 — Satellite architecture decision gate

**Status:** S1 read-only source/repository analysis complete; **PRODUCTION GO = NO / DEFER** pending external evidence and independent review.  
**Date:** 10 October 2026  
**Base:** `main@ee4f7c2f1939f54e6f2c064453c2969fef636224`  
**Scope:** `flytally-logbook` only; Satellite first, openAIP paused.  
**Decision type:** Independent source challenge / conditional architecture gate, **not an implementation or deployment authorization**.

## 1. Decision in one paragraph

**Preserve Next.js + Leaflet. Do not yet select between (A) the existing 256px server-composed SVG and (B) two independently rendered provider-backed Leaflet layers.** The decisive question is *geographic footprint*, not pixel dimensions in isolation. Esri's static labels are 512px, but its published LOD resolutions, combined with a standard 256px Web Mercator pyramid, can yield the **same geographic tile span at identical z/x/y**; the one-level statement refers to visual resolution/scale, not automatically a one-tile geographic offset. Therefore the earlier automatic preference for two separate layers was insufficiently justified. Keep both A and B open until exact World Imagery, static labels **and** fallback origin/CRS/LOD identities are evidenced, and then compare security, export, latency, cost and reuse. Do not rewrite the map SDK. **Neither alternative is authorized for production until provenance, rights, session gate, response/resource limits and attribution are settled.**

**S1 verdict (self-review correction):** Framework **LEAFLET RETAINED**; A-vs-B compositor architecture **UNDECIDED / DEFER**; production provider, token, rights, account/cost, safe capacity and 3.7.0 release **BLOCKED**. This is an evidence-led correction to the prior conditional B preference, not a GO. No token or supplier requests authorized by this document.

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

1. [Esri Imagery Labels tile reference](https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-tile-get/) explicitly defines 512×512 PNG static tiles, level 0–22, `premium:user:staticbasemaptiles` privilege, and **static zoom level 12 corresponding in visual pixel resolution to traditional imagery level 13**. **CORRECTION:** this is NOT evidence that tiles sharing z/x/y cover different geographic areas. Tile geographic span is tile pixel width multiplied by the service's metres-per-pixel resolution. For illustration, Esri's labels L12 has 512 × 19.109257 ≈ **9784 m per tile**, while a published traditional 256px Web Mercator MapServer L12 example has 256 × 38.218514 ≈ **9784 m per tile**. Those spans *can coincide* when origins/CRS and numbering coincide. The latter traditional value is from Esri's [sample tileInfo in Map Tile Layer documentation](https://developers.arcgis.com/documentation/portal-and-data-services/data-services/map-tile-services/item-properties/), **not actual metadata for FlyTally's specific World Imagery endpoint**; treat it as scheme arithmetic, NOT supplier-specific alignment proof.
2. [Esri Imagery Labels metadata](https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-meta-data-get/) documents the source-specific metadata endpoint and Bearer auth. Current actual `tileInfo`/origin/CRS/LOD for the three FlyTally upstreams was **not captured** in previous owner attempts.
3. [Esri example: World Imagery + Imagery Labels in separate MapLibre layers](https://developers.arcgis.com/maplibre-gl-js/maps/raster-tile-basemaps/display-multiple-basemap-layers/) documents independent raster layers, with `tileSize: 512` for labels; [Esri OpenLayers example](https://developers.arcgis.com/openlayers/maps/raster-tile-basemaps/display-multiple-basemap-layers/) supports the same separation. This proves independent rendering is a **supported vendor example**, NOT that FlyTally must use it or that a per-z/x/y SVG is wrong. The exact Leaflet `tileSize`/`zoomOffset` behavior must also be tested against provider metadata; **do not set `zoomOffset=-1` simply because pixel width is 512**. Scheme level numbering, tile footprint and client display zoom are distinct.
4. [Esri static basemap service guide](https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/) requires **Esri and underlying supplier attribution**, including in third-party/open-source clients. Dynamic regional imagery/source credits may differ from a single hardcoded label.
5. [Esri API key credential guide](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/api-key-credentials/online/) says referrer changes require new access token issuance, invalidating previous tokens. Prior owner screenshots showed only `https://*.vercel.app` in the key's allowed referrers, whereas FlyTally's backend forwards the `fly-tally.com` referer. **Possible** mismatch, not a confirmed upstream denial. **Never** edit/referrer-rotate credentials without a coordinated operator plan.
6. Old owner-approved base-metadata attempts (only World Imagery) did not yield sanitized usable `tileInfo`: unexpected MIME then HTTP 200 text/plain rejection; a Windows Node24 native assertion occurred after both. **No proven Esri server failure or Node crash root cause**. Do not repeat generic collectors or any billable endpoint requests by default.

No collected source establishes the exact Esri contract for FlyTally's account, all provider service privileges, allowed server-side proxy/cache/recomposition, Story PNG redistribution, current supplier attribution, token rotation impact, customer-specific costs or defensible production byte/timeout/admission values.

### Independent self-review correction — LOD vs geography

The earlier S1 draft treated static 512px LOD semantics as a reason to *prefer* two map layers. That preference was **premature**, because the published static LOD's geographic *span* may equal that of a traditional 256px tile at the same level. At static L12, `512 × 19.1092570712683 ≈ 9783.94 metres`; traditional Esri 256px example L12 `256 × 38.2185141425366 ≈ 9783.94 metres`. These arithmetic results depend on matching origin, CRS and addressable tile row/column conventions, which **have not been verified for FlyTally's World Imagery, Imagery Labels and fallback endpoints**. Never infer a universal `z+1` or `z-1` correction from pixel-density equivalence; such a change could be the actual source of misalignment.

This is a **documented source/analysis correction**, not a supplier observation or runtime test. Separate-layer vendor examples establish a possible implementation pattern; neither pattern is source-approved for FlyTally yet.

## 4. Architecture alternatives, evaluated

| Candidate | Advantage | Major unresolved problem | S1 disposition |
| --- | --- | --- | --- |
| A. Existing same-z/y/x server-composed SVG | Minimum blast radius; compatible with current fixed-grid Story exporter; one response to browser | Exact provider-specific footprint still unverified; unbounded `arrayBuffer()`, public cache/auth and rights/resource issues must be fixed | **CANDIDATE / DEFER**. No GO as-is, but not geometrically disproven by tile size |
| B. Leaflet with separate imagery and label layers through authenticated backend | Vendor demonstrates independent rendering; per-source rendering/fallback flexibility | Requires new layer lifecycle/requests, server-only auth for both sources, source-specific tile-grid design, and independent Story compositor | **CANDIDATE / DEFER**. Do not assume safer or simpler until measured |
| C. MapLibre replacement | Esri documented tutorial directly applies | Unnecessary UI map-library replacement, risks map touch controls, GPS playback, public map and component lifecycle | **NOT SELECTED** absent evidence that B cannot comply |
| D. Single imagery layer without labels | Minimal geometry/overlay path, potentially fewer upstream requests | Flight map usability/labels, Story expectations, source/attribution still gated | **Fallback product option only**, needs explicit owner agreement and documented UX change |

### Shared boundary for Candidates A and B (conditional, not implementation specification)

- Preserve the existing Leaflet `L.Map` instance, `flytallyBasemap` pane and flight/replay state. **A** may keep the existing one-base-layer UI and separately harden the SVG provider; **B** would require a new atomic imagery/labels layer lifecycle with explicit partial-load semantics. For B, client `tileSize`, `zoomOffset`, supported zoom range and tile coordinates must be derived from source-specific footprints plus actual Leaflet behavior. A 512px upstream tile downscaled to 256px is not automatically geographically incorrect; independently verify whether it is visually acceptable and supplier-permitted.
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

**S1.1 — independent architecture review (NEXT):** send this **corrected** document plus exact PR #272–#279/SHA references to DeepSeek for read-only critique. Ask reviewer to **independently recompute tile coverage** (512 × static LOD resolution vs 256 × traditional LOD resolution, origin/CRS/row/column) and explicitly challenge the former assumption that the 'one zoom level' statement proves geographic misalignment. Compare A (hardened current SVG) with B (separate Leaflet layers) including token-safe auth/cache, Story PNG, latency and operational resource risk. No default winner; reviewers are not authority.

**S1.2 — provider account evidence (operator only):** on the ArcGIS Location Platform portal, inspect subscription/usage/permissions/renewal, service credit docs, actual allowed referrer and supplier terms **without showing secret values**. Do not change credential/referrer/production env. If rights/terms are unclear, prepare a narrow written Esri inquiry. Only after explicit new owner authorization define any controlled metadata/service requests with fixed endpoints, count, timeout/bytes, no tile imaging or secret logs. Previous supplier GET authorization does not roll over.

**S1.3 — revised GO/NO-GO/DEFER:** after review and source closure, freeze the implementation contract; only then start smallest runtime S2 branch. Avoid further generic Node transport experimentation or openAIP work in parallel.

### Read-only review handoff — to DeepSeek

```text
FlyTally Logbook 3.7.0 — S1 independent architecture review (READ ONLY).
Current main: ee4f7c2f1939f54e6f2c064453c2969fef636224; release 3.6.0.
Review docs/product/3_7_0_S1_SATELLITE_ARCHITECTURE_DECISION.md and exact current branches PR #272–#279 (stacked Draft, no merge).
Owner freezes: Satellite FIRST then openAIP, both in full 3.7.0; Standard default/public replay Standard-only; authenticated map surfaces + existing Story preserved; no provider calls/rights assumptions; no runtime merge or production flag changes.
Decision candidate: KEEP Next.js + Leaflet. Do NOT preselect A (existing same-z/y/x SVG, harden it) or B (independent Leaflet imagery and label layers). Important self-correction: static labels 512px at Esri L12 × 19.109257 m/px and illustrative traditional imagery 256px at L12 × 38.218514 m/px both yield ~9784 m footprint. Static label L12 is *pixel resolution* comparable to traditional L13, which does NOT by itself prove footprint misalignment. Actual three upstream tileInfo origins/CRS/LOD unverified.
Independently derive geography and client tiling offsets; compare A vs B on correctness, smallest blast radius, Story preservation, authenticated route/cache/cost, safe resources, attribution, provider licensing, and smallest implementation batches. Identify any unwarranted assumptions in this dossier.
Return concrete evidence-linked ACCEPT / CHANGE / REJECT findings; distinguish verified source vs hypothesis; DO NOT modify repo, credentials, supplier accounts, production or generate invented policies.
```

## 7. Verification and change boundary for this document

- **Performed:** read-only latest main/PR and key implementation file inspection; official public Esri docs comparison; historical owner-local test evidence reviewed without transferring PASS to this draft.
- **NOT RUN on this document/branch:** Node/TypeScript/build/Playwright/PostgreSQL, CI, physical Safari, actual ArcGIS account/provider tile/metadata, deployment/production smoke.
- **No changes:** runtime code, external credentials, supplier calls, `flytally-training`, database schema, GPS/certified-flight evidence, existing public sharing, product version or production environment.
