# 3.7.0 — Phase 2.0: Satellite provider and legacy-consumer readiness

**Recorded:** 9 October 2026  
**Branch:** `docs/3.7.0-phase2-satellite-readiness`  
**Status:** READ-ONLY DISCOVERY / EXTERNAL GATES BLOCKED; draft for product and independent review. No Phase 2 runtime authorization, test PASS, licence clearance, activation, production deployment or full 3.7.0 release is implied.

**Authority:** [ROADMAP](../../ROADMAP.md) → [Maps architecture/phase contract](3_7_0_MAPS_AVIATION_LAYERS.md) → this *Phase 2.0* readiness record. In a conflict, confirm actual source/runtime and reconcile before coding. Historical Phase 1 attempts are provenance, not the current release state.

## 1. Reconstructed baseline (read-only)

- `main@7d47010e86a8a718c4df9b33443a056cb20b9e4e` includes merged PRs #268, #269 and #270. Phase 1 **standard-only** is production accepted. Application deployment remains Vercel `dpl_51zwnZYfFADxeDEyZheTYg9siXD8` on runtime `main@cc7abd41858cb2b2ddd8e794889922c856885686`, READY and assigned to `fly-tally.com` at inspection. Production product version stays **3.6.0**. PR #270 was docs-only; documentary merge does not establish a new deployed application SHA.
- `components/map-layer-controller.ts` currently declares standard-only support; `components/leaflet-mobile.ts` attaches `style=map` to `flytallyBasemap`. Route overview, tracks, saved playback and GPS import review use the shared helper. Phase 2 must preserve their state, pane ownership, touch locks, dark/light treatment, replay and marker interactivity.
- `app/api/map-tile/[z]/[x]/[y]/route.ts` **already accepts** a single `style=satellite` as well as `map` and supports omitted style = standard; malformed/duplicate style is strict 400. Satellite path reads `ARCGIS_ACCESS_TOKEN`, requests World Imagery and preferred imagery labels, falls back to a separate ArcGIS reference service if labels fail, and returns a composed SVG. The route performs no explicit authentication or satellite entitlement/feature gate. This pre-existing public transport is **not** newly introduced or enabled by Phase 2.0.
- `components/flight-story-card.tsx` already probes one satellite tile with `style=satellite&probe=1` on mount and automatically chooses satellite when the probe returns success. It can embed resulting map tiles into exported Story PNGs. The probe parameter is not a security/authorization gate in the inspected tile route. **Legacy Story behavior must not be silently changed**, and its current provider rights/export consequences must be examined before widening use.
- Vercel project `logbook` (`prj_GYFLbRQjVyjn82Xnre5qZjz8UlAQ`) exposes metadata for an `ARCGIS_ACCESS_TOKEN` **production** environment variable. Only the name/target metadata was inspected; no secret value was read or transmitted, and no token validation, account inspection, billing check or live Esri request occurred. Presence does **not** establish validity, privilege, approved usage or quota.
- Existing `lib/legal.ts` mentions Esri/ArcGIS in the public provider register. This does **not** establish an executed DPA, all underlying-image provider rights, cache/export permission or current token entitlement. openAIP remains a separate Phase 3 gate.

## 1A. Owner-supplied Esri portal evidence — 9 October 2026 (read-only)

The owner navigated the ArcGIS Location Platform organization portal `flytally.maps.arcgis.com`, opened the existing **FlyTally Satellite Imagery** developer credentials item and supplied screenshots of Overview and Settings/Application. Screenshots were examined in the conversation; no secret/token values or screenshots are stored in Git. The observations supersede the initial "account unknown" discovery state **only for the listed facts**, not for vendor-rights, billing or production-token validation:

- The named ArcGIS Location Platform organization is **flytally**; visible account role **Location Platform Owner**. Organization created **17 September 2026**; portal shows **renewal date 18 October 2026**. Renewal mechanism, billing and continuity after that date remain **NOT VERIFIED**.
- The item **FlyTally Satellite Imagery** is marked **Application / API key credentials**; the description names ArcGIS World Imagery for FlyTally Flight Story maps. Owner/source association is therefore established at the item-metadata level, **but the match to the encrypted production `ARCGIS_ACCESS_TOKEN` has not been proven**.
- The credential item displays **one active API key**, expiring **17 September 2027**. Its allowed location-service privilege is **Static Basemap Tiles** (screenshot, Czech: `Statické dlaždice podkladové mapy`). **No token value or client secret was displayed or collected.** Having this privilege alone does not establish that the current composite tile route's World Imagery base, preferred labels, and fallback reference service are *all* authorized; they must be separately validated.
- The **only** visible allowed HTTP referrer is `https://*.vercel.app`; **`https://fly-tally.com` is absent.** The current server route's `publicReferer()` forwards a custom-domain request origin as `Referer: https://fly-tally.com/...` and defaults to `https://fly-tally.com/` if no incoming Referer. This is a **plausible production provider authorization mismatch**, not a demonstrated live HTTP rejection. Official Esri API-key credential documentation describes referrer-based request authorization.
- Per Esri documentation, **editing allowed referrers invalidates the credential's existing API keys and requires new key generation/application update**. Thus **DO NOT** edit allowed referrers, regenerate/invalidate keys or edit Vercel environment configuration until a controlled compatibility/rotation and rollback plan exists. The wildcard `https://*.vercel.app` is also broader than a single verified deployment hostname; future referrer scope should be designed deliberately.
  - https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/api-key-credentials/online/
  - https://developers.arcgis.com/documentation/security-and-authentication/faq/
- No key was rotated, Esri configuration changed, billable tile fetched, production map probed or account usage queried in this inspection. S-G1/G2/G3/G5 remain **OPEN/BLOCKED**; expiry/privilege/referrer metadata is now **PARTIALLY EVIDENCED**, not authorization PASS.

**Next read-only account inspection:** portal organization licence/renewal, actual subscriptions and billing/usage (no secrets); provider licence terms for the existing Story PNG export and World Imagery/label/references; verify the service's intended referrer and entitlement behavior before proposing a token rotation. Do not embed the existing key or client secret into issue comments or handoff notes.

## 2. Official external information — research, not FlyTally approval

1. Esri's Static Basemap Tiles documentation requires **Esri AND source-data attribution** in third-party/open-source-library applications, and the imagery-label metadata describes a service-specific privilege (`premium:user:staticbasemaptiles`). Confirm exact attribution for every service actually used by the current composite pipeline and fallback, in the applicable viewport/source region.
   - https://developers.arcgis.com/rest/static-basemap-tiles/
   - https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/
   - https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-meta-data-get/
2. Public ArcGIS Location Platform pricing inspected 9 October 2026 lists **2,000,000 free basemap tile requests/month**, then **USD 0.15 per 1,000 tiles** under its listed tile usage model. This is public reference pricing, **not a verified price, subscription, allowance or cost cap for FlyTally**. Tile requests through imagery, labels and fallback may be multiple upstream transactions; the account's exact billing category and caching effects need provider/account evidence.
   - https://developers.arcgis.com/pricing/
   - https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/basemap-usage-styles/
3. Esri credentials require matching service privileges; referrer restrictions can apply. A configured key or a successful image probe does not alone establish the right to cache, recompose, embed in SVG, export a Story image or redistribute any third-party content.
   - https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/api-key-credentials/online/
   - https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/tutorials/update-to-api-key-credentials/location-platform/
4. Existing OSM standard-map compliance is a **separate** dependency; preserve attribution, application identification, minimum cache policy and no bulk/preload behavior.
   - https://operations.osmfoundation.org/policies/tiles/
5. The openAIP API docs are discoverable at https://github.com/openAIP/openaip-api-documentation ; this observation provides **no permission for commercial/open/public use** and does not clear Phase 3.

## 3. Phase 2.0 Go/No-Go evidence matrix

| Gate | Required evidence and consequence | Current state |
| --- | --- | --- |
| S-G1 — Account and terms | Owner identifies actual Esri account/product terms, entitlement for each queried service, and intended authenticated Leaflet imagery use; check any composite raster and server-proxy constraints | **BLOCKED — not inspected** |
| S-G2 — Legacy Story/export rights | Provider/qualified review of existing probe, in-browser satellite selection, SVG embedding and PNG export, geographic-provider credits, and redistribution rights. Do not silently remove historical Story | **BLOCKED — not established** |
| S-G3 — Token and provider responses | Operator-only read-only verification of expiry, scope/privileges, allowed referrers, token rotation, tiles/metadata for imagery and labels plus fallback, error 401/403/429, no secrets in evidence | **BLOCKED — env-name presence only** |
| S-G4 — Attribution | Source-correct Esri **plus** underlying contributors for imagery, labels and reference fallback; accessible on all four authenticated map surfaces/light-dark/iPad/mobile; unfiltered and not clipped | **BLOCKED — exact wording/coverage unverified** |
| S-G5 — Costs, abuse and caching | Actual pricing/account usage, quota alert/hard-stop strategy, cache rights/TTL, multiple upstream fetch accounting, public route abuse risk; decide bounded response/rate protection without breaking legacy Story | **BLOCKED — account and permitted cache unverified** |
| S-G6 — Product availability/fallback | Standard default; authenticated new Satellite selector only after explicit approval; visible loading/partial/unavailable/fallback state, no false satellite; no persistence, no public share integration, no openAIP requests | **DESIGN PROPOSED — not implemented** |
| S-G7 — Offline technical acceptance | Dedicated strict unit/API contract; deterministic tile fixtures; view/lifecycle/viewport preservation, route/playback state, dark isolation, no duplicate basemaps or retry storm; source/browser/PG/build gate selected by risk planner | **NOT RUN / NOT IMPLEMENTED** |
| S-G8 — Live provider/production | Only after S-G1–S-G7 and explicit owner approval: bounded token-safe live provider smoke, billing/runtime monitoring, iPad portrait/landscape and desktop/mobile light/dark, then production gate | **NOT AUTHORIZED** |

No inference from an existing `ARCGIS_ACCESS_TOKEN`, vendor pricing page, the legacy Story feature, or a successful single tile can flip any external gate to PASS. If missing or ambiguous: remain Standard/unavailable.

## 4. Proposed sequence — NO RUNTIME ACTIVATION

**Phase 2.0 (this milestone):** source/consumer census, official provider research, Vercel env-variable **metadata only**, explicit gates, and independent review brief. Documentation PR only.

**Phase 2.1 — Conditional design/review (offline):** after owner accepts S-G1–S-G5 investigation path, design the minimum Leaflet control and server protection while retaining legacy Story. Do not assume public-route authentication can be added without compatibility analysis. Build a deterministic test plan and identify existing `tests/` and `e2e/` registration/ownership before any code. Consult an independent reviewer on provider/licensing/security and precise fallback semantics.

**Phase 2.2 — Small technical batch (not yet authorized):** implement a disabled-by-default, explicitly gated authenticated selector on route overview, GPS tracks, saved replay and GPS import review; no flight data/DB changes; never enable satellite on public shares or change Story export implicitly. Complete exact-candidate local verification. Activation requires separate owner approval after S-G1–S-G7.

**Phase 2.3 — Production/cost watch (not yet authorized):** only after evidence and accepted rollout plan. A ready build or green unit suite does not prove live-provider licensing, cost or runtime behavior.

**Phase 3:** openAIP stays independently BLOCKED; any decision to finish/release satellite before openAIP requires explicit owner agreement about 3.7.0 release scope and feature claims.

## 5. Independent reviewer questions

- Does the existing public satellite API + existing Story auto-probe/PNG export create any provider-license or metered-usage exposure not addressed by the draft gates?
- Which minimal server-side feature/authorization/rate-limit safeguards are compatible with existing Story use, proxy cache keys and failure modes? Do **not** recommend a blanket route block without tracing consumers.
- Does composite SVG base+label rendering change attribution, reuse/caching or licensing compared with documented Esri basemap usage?
- What deterministic safety/UX browser tests best prove map instance/view preservation, attribution and fail-closed fallback in Phase 2 without contacting external suppliers?

**Evidence this work cycle:** read-only GitHub repository and named Vercel configuration/deployment metadata; official Esri/OSM/openAIP documentation. **NOT RUN:** Node tests, TypeScript, build, PostgreSQL, Playwright, native Safari, external-provider live tile check, migrations, deployment, paid API calls. No runtime, DB, certification, backup or production secrets changed.
