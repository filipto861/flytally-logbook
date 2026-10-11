# FlyTally Logbook — FEATURE LIST

**Capability inventory reviewed:** 11 October 2026. **Current release status and next milestone:** [ROADMAP](ROADMAP.md). **Dated release/deploy evidence:** [CHANGELOG](CHANGELOG.md). This inventory describes capabilities and restrictions; it does not independently establish deployment or provider permission.

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

## 3. GPS, maps and tracks — 3.7.0 IMPLEMENTED / RELEASED (EXTERNAL RIGHTS UNVERIFIED)

- KML/GPX/CSV import, review of GPS-derived suggestions, track playback with aircraft marker, route/GPS map presentation and configurable Standard/Dark presentation.
- Evidence-limited takeoff, touch-and-go and SERA Day/Night suggestions; gaps/teleports/sparse evidence remain constrained; IFR and unsupported regulatory facts are not auto-inferred.
- **Standard map:** accepted Phase 1 map-layer controller and lifecycle on authenticated map surfaces; existing public sharing stays Standard-only.
- **Satellite:** explicit optional Standard/Satellite map selection on four authenticated Leaflet map surfaces, merged as [PR #285](https://github.com/filipto861/flytally-logbook/pull/285). Standard remains the default. Separate session-protected tile API hardening merged as [PR #282](https://github.com/filipto861/flytally-logbook/pull/282). No silent persisted selection.
- **Aviation:** combined openAIP aviation raster on four authenticated maps, implemented by [PR #293](https://github.com/filipto861/flytally-logbook/pull/293); unified compact Map settings by [PR #295](https://github.com/filipto861/flytally-logbook/pull/295); optional Aviation overlay retained at display zoom 15–18 (native z14 raster overscale) by [PR #297](https://github.com/filipto861/flytally-logbook/pull/297). Server z<=14 bound persists, with authenticated/flagged key handling and reference-only attribution.
- **Capability and evidence boundary:** Standard/Satellite and combined Aviation layers were part of the completed Maps milestone; detailed dated implementation, owner acceptance and deployment proof belong in the [3.7.0 acceptance record](docs/product/3_7_0_FINAL_PRODUCTION_ACCEPTANCE_2026-10-11.md). Provider rights, quotas, attribution/export, coverage and currentness remain **UNVERIFIED**. The map is reference-only, not approved aviation chart/EFB evidence.
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
- Social/Instagram Story flight cards with privacy constraints; third-party Satellite imagery/export permission remains an external condition. **Known current limitation (historical M2A source review):** the Story exporter can omit failed map tiles instead of rejecting export; do not claim a guaranteed-complete tile export. Owner retired the [legacy R2 branch](docs/maintenance/2026-10-10-r2-m2a-source-audit.md) rather than approving a port. Any newly prioritized fix must start from current main, with separate evidence and owner approval.

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
| Esri/openAIP third-party rights/coverage/usage evidence after 3.7.0 | UNVERIFIED / DEFERRED | Commercial/use rights, relevant attribution and redistribution/export restrictions, currency/coverage, quota/cost and evidence before broader use; not approved by the 3.7.0 release |
| `3.8.0` Currency / monetary semantics · #136 | ACTIVE / design review | [M0 inventory](docs/product/3_8_0_CURRENCY_MONETARY_SEMANTICS.md) and [review reconciliation](docs/product/3_8_0_CURRENCY_REVIEW_RECONCILIATION.md); **D1–D4 owner-approved:** account default for new monetary values, explicit per-rate currency, auditable unresolved legacy denominations, no cross-currency totals/price ranking, and all active monetary ISO 4217 codes. [Frozen product decisions](docs/product/3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md), [M2 additive schema proposal](docs/product/3_8_0_CURRENCY_M2_SCHEMA_DESIGN.md), [received DeepSeek M2 review reconciliation](docs/product/3_8_0_CURRENCY_M2_DEEPSEEK_RECONCILIATION_2026-10-11.md) and [unregistered SQL candidate draft PR #322](https://github.com/filipto861/flytally-logbook/pull/322) with [six isolated PG acceptance cases, five static checks and a Windows Docker runner](docs/product/3_8_0_CURRENCY_M2A0_LOCAL_POSTGRES_HANDOFF.md); Windows PowerShell 5.1 encoding/CRLF fixes staged, **awaiting rerun**, PostgreSQL execution **NOT RUN / NOT DEPLOYED**. [M1-B1 exact arithmetic](docs/product/3_8_0_CURRENCY_M1_CORE_IMPLEMENTATION.md) in draft [PR #320](https://github.com/filipto861/flytally-logbook/pull/320); [M1-B2 mirrored-source candidate registry](docs/product/3_8_0_CURRENCY_M1_ISO_REGISTRY.md) in nested [PR #321](https://github.com/filipto861/flytally-logbook/pull/321), **offline source-byte verifier authored, not official-SIX-byte-verified, not merged or shipped**. Exact schema/rounding/attestation/app integration and source verification pending; no invented historical denomination or FX |
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
