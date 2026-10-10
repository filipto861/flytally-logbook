# FlyTally Logbook — FEATURE LIST

**Current inventory reviewed:** 10 October 2026  
**Shipped product version:** `3.6.0`  
**Active workstream:** `3.7.0 — Maps & Aviation Layers` (some functionality merged/deployed, full release pending).

This is the **capability register**, not a dated test log. Implementation and production statements below are limited by their stated scope. Execution order and outstanding release gates are in [ROADMAP](ROADMAP.md); merged changes and source evidence in [CHANGELOG](CHANGELOG.md). The [verbatim previous feature inventory](docs/history/FEATURES_BEFORE_2026-10-10_CANONICAL_CLEANUP.md) retains every earlier milestone claim and test candidate for audit; old `Draft`/`FAIL`/`OFF` captions there are historical.

## 1. Core flight records — IMPLEMENTED

- Private multi-user electronic pilot logbook with a shared canonical flight model and consistent validation boundaries for Add/Edit and applicable GPS review workflows.
- Flight creation, editing, review, finalization/certification, search, list, filtering and detail.
- Auditable revisions/voiding of protected certified flights rather than destructive overwrites.
- Category-aware flight recording for Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other; category/role/movement/launch applicability remains explicit.
- Dashboard snapshots, Statistics/period/trends and professional experience views.
- User notes and structured expenses; stored monetary evidence is not silently converted.

## 2. Aircraft, airports and configuration — IMPLEMENTED

- Personal aircraft profiles and controlled deletion, cover photos, searchable type catalogue with manual fallback and airport reference data.
- Editable aircraft flight defaults for Role, Operation and Engine (SE/ME), with engine-derived suggestions only where source aircraft evidence is unambiguous.
- Shared aircraft-profile copy workflow between accepted Connections; the recipient retains an independent profile.
- Canonical profile validation for both direct input and imported/shared aircraft profiles; missing or invalid categories/configurations do not become generic valid defaults.
- **Production data-history caution:** one-time aircraft default SE/SP backfill is documented in [PR #299](https://github.com/filipto861/flytally-logbook/pull/299); an anomalous King Air/C90 profile was explicitly excluded pending owner review. This is a report of a data-only action, not a new product feature or independent DB query.

## 3. GPS, maps and tracks — IMPLEMENTED WITH 3.7.0 RELEASE GATES

- KML/GPX/CSV import, review of GPS-derived suggestions, track playback with aircraft marker, route/GPS map presentation and configurable Standard/Dark presentation.
- Evidence-limited takeoff, touch-and-go and SERA Day/Night suggestions; gaps/teleports/sparse evidence remain constrained; IFR and unsupported regulatory facts are not auto-inferred.
- **Standard map:** accepted Phase 1 map-layer controller and lifecycle on authenticated map surfaces; existing public sharing stays Standard-only.
- **Satellite:** explicit optional Standard/Satellite map selection on four authenticated Leaflet map surfaces, merged as [PR #285](https://github.com/filipto861/flytally-logbook/pull/285). Standard remains the default. Separate session-protected tile API hardening merged as [PR #282](https://github.com/filipto861/flytally-logbook/pull/282). No silent persisted selection.
- **Aviation:** combined openAIP aviation raster on four authenticated maps, implemented by [PR #293](https://github.com/filipto861/flytally-logbook/pull/293); unified compact Map settings by [PR #295](https://github.com/filipto861/flytally-logbook/pull/295); optional Aviation overlay retained at display zoom 15–18 (native z14 raster overscale) by [PR #297](https://github.com/filipto861/flytally-logbook/pull/297). Server z<=14 bound persists, with authenticated/flagged key handling and reference-only attribution.
- **Release boundary:** The A2D/A2E/A2F runtime is merged and Production READY at exact runtime SHA `09001505`, but **3.7.0 is NOT released as a complete accepted product version**. Real signed-in map/provider/high-zoom coverage, physical iPad Safari and independent provider entitlement/currentness remain to be accepted.
- **Strict tile API:** exactly one `style=map` or `style=satellite`, missing style = legacy map; malformed/duplicate/empty/unknown/case-variant rejected HTTP 400 `unsupported_style` before upstream.
- **Explicitly not provided:** certified navigation/EFB charts, live NOTAM/activated airspace status, proof of geographic coverage or approved provider redistribution. A user-visible map layer is not operational authority.

## 4. Pilot licences, recency and evidence — IMPLEMENTED WITH BOUNDARIES

- Licences, ratings, medical/credential displays, aircraft training and qualifications.
- Category-aware recency planning and regulatory evidence presentation, including type-specific helicopter recency and `LIMITED DATA` where historic identity is insufficient.
- Evidence-first validity: missing records cannot automatically establish privilege/currency, and internal application tests are not approval by EASA, ÚCL, LAA or another aviation authority.

## 5. Collaboration and sharing — IMPLEMENTED

- Pilot Connections, shared flight invitations/review and participant-specific evidence.
- Instructor verification/signatures, Action Center for unresolved tasks and notifications as history/updates.
- Revocable public flight views with restricted public data transfer objects.
- Social/Instagram Story flight cards with privacy constraints; third-party Satellite imagery/export permission remains an external condition.

## 6. Backup, recovery and evidence protection — IMPLEMENTED

- Print/export, portable backup, backup validation and restore review, deleted-flight recovery.
- Audited preservation of certified records, signatures, GPS/share evidence and restoration constraints.
- Authenticated server-side ownership boundaries. No unsupported silent correction of invalid persisted user state.

## 7. UX, accessibility and platform — IMPLEMENTED

- Desktop/tablet/mobile responsive UI; dark and light themes; reusable design tokens, spacing, geometry and SVG icons.
- Async mutation pending/disabled feedback, duplicate-submit protection in covered workflows, form validation, accessibility/focus/keyboard/touch improvements.
- Flight-detail navigation UX, iPad page/sidebar polish and shared date/time presentation.
- Web Push preferences, contextual notification onboarding and progressive-web-app installation support.
- Connectivity banner when browser reports offline. **Logbook remains online-only:** no offline editing, queued mutations, offline certified data cache or background sync.
- Legal/disclosure pages, security headers, provider attribution, and guarded public-share indexing/caching.

## 8. Planned / conditional work — NOT IMPLEMENTED AS A COMPLETED RELEASE

| Workstream | State | Gate |
| --- | --- | --- |
| `3.7.0` integrated map/aviation release acceptance | ACTIVE / OPEN | In-map real provider smoke, light/dark, physical iPad Safari, provider rights/coverage/quotas and explicit release decision |
| `3.8.0` Currency / monetary semantics · #136 | NEXT | Audit persisted denominations, define account currency authority, backup/export effects; no invented historical currency or automatic FX |
| `3.9.0` heterogeneous multi-aircraft onboarding proof | PLANNED | Aeroplane/Helicopter/Sailplane-TMG/Balloon/ULL/Other Add/Edit/Quick Add, applicability and responsive tests |
| `3.10.0` multi-aircraft sharing/recovery/scale closeout | PLANNED | Canonical independent participant data, safe recovery/scale proof |
| GPS T&G time-normalized evidence-limited follow-up | RESEARCH | Real-track samples/source evidence |
| Professional Logbook Platform | RESEARCH | Owner-approved design/scope before version assignment |

## 9. Guarded non-features and authority

- No automatically valid/`CURRENT` regulatory status with missing evidence; no silent fabrication of limitations, ratings, hours, costs or aircraft identity.
- No destructive overwrite of finalized/certified records, no automatic FX conversion and no hidden change to shared-flight participant authority.
- No offline mutable record editing or assumption of regulatory/commercial/provider authorization based on tests, labels, deployed code or a published UI.
- `flytally-training` is a separate repository and is not part of the Logbook feature list.

**Supporting source/implementation documents:** [docs index](docs/README.md), [architecture](ARCHITECTURE.md), [3.7.0 map design](docs/product/3_7_0_MAPS_AVIATION_LAYERS.md), [A2D](docs/product/3_7_0_A2D_COMBINED_AVIATION_OVERLAY_ACCEPTANCE.md), [A2E](docs/product/3_7_0_A2E_MAP_SETTINGS_ACCEPTANCE.md), [A2F](docs/product/3_7_0_A2F_MAP_OVERLAY_ZOOM_POLISH_ACCEPTANCE.md) and [development/test evidence policy](DEVELOPMENT.md).
