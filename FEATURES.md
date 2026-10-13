# FlyTally Logbook — FEATURE LIST

**Capability inventory reviewed:** 13 October 2026. **Current release status and next milestone:** [ROADMAP](ROADMAP.md). **Dated release/deploy evidence:** [CHANGELOG](CHANGELOG.md). This inventory describes capabilities and restrictions; it does not independently establish deployment or provider permission.

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
| `3.8.0` Currency / monetary semantics · #136 | ACTIVE / MULTIPLE UNMERGED DRAFTS (not shipped) | Owner-frozen D1–D4; isolated A1-T1 validators #323, A1-T2a catalog #324, A1-T2b PG16 #325, A1-T2c D1 reduced-schema #327, and independent **production-path v20 trash restore fidelity guard** candidate. The latter explicitly covers 52 safe v20 flight columns, blocks v21 money being downgraded, preserves recorded CZK and refuses invalid expense/child data; **owner-local Node24 typecheck and 7/7 source tests PASS at #328 e24c982f; nested D2 full-v20 SQL/trigger PG16 tests **6/6 PASS plus guard 3/3 PASS** at exact `7676563e`, not merged or deployed**. Cross-writer concurrency, protected/void/shared records, complete child content, official SIX ISO evidence, signed-v13 backup and Cross-trash cooperative Restore serialization **owner-local verified on PG16 at exact `0bb5b496` (7/7 source + 5/5 contracts + 7/7 real SQL; Node24 typecheck PASS), still nested Draft/NOT SHIPPED**; ordinary Add/Edit writer races still not covered. Scratch Neon PG18 connector-level transaction/rollback/same-row test **PASS and temporary branch DELETED** ([evidence](docs/product/3_8_0_NEON_TEMP_BRANCH_TRANSACTION_CLEANUP_2026-10-13.md)), but app JavaScript Neon HTTP SDK is **NOT VERIFIED** and still gates release. No silent FX, migration v21, deployment or production approval |
| `3.8.0` D3a Create/Restore deduplication and D3b protected-history safety | D3a OWNER-LOCAL PASS / NESTED DRAFT; D3b DISCOVERY | Restore advisory key matches canonical Create fingerprint; **owner-local native PG16 tests 7/7 source + 6/6 contract + 8/8 actual SQL PASS at `59a98018`, project typecheck PASS**, plus protected/voided/shared provenance compatibility inventory. No assertion of Edit/GPS global collision safety; no scheme v21 or shipment. [Audit handoff](docs/product/3_8_0_D3A_CREATE_RESTORE_D3B_PROTECTED_EVIDENCE_HANDOFF.md). Prior D2 PG16 and separate actual Neon SDK synthetic HTTP tests PASSED at older code; Neon scratch branches cleaned |
| `3.8.0` D3b-0 native PostgreSQL Trash safety reproduction | TEST HARNESS AUTHORED / NOT RUN | Source-extracted real five-step Trash SQL and real v20 trigger SQL in isolated synthetic pre-v20 schema; includes two-session certification race, cross-account evidence cascade and immutable provenance rollback. Full applied-v20 migration fidelity, acceptance tests, A+ fix and release still pending. |
| `3.8.0` D3b reviewer reconciliation / atomic archive-delete invariant | DESIGN PROVISIONAL / D3b-0 NATIVE PG NOT RUN | Owner-forwarded independent DeepSeek review reconciled against actual source. Candidate A+ must preserve independent evidence, protect source references lacking FK, and couple archived marker with successful final flight DELETE; first characterize PG16 actual full-v20 triggers/races. No behavioral change, schema migration or release. [Full reconciliation](docs/product/3_8_0_D3B_DEEPSEEK_REVIEW_RECONCILIATION_2026-10-13.md). |
| `3.8.0` D3b protected/voided/shared Trash lifecycle integrity | READ-ONLY INVENTORY / PRODUCT DECISION PENDING | Source confirms ordinary Trash archives only flight/tracks/expenses while independent participant/verification/connected-crew/provenance relationships require explicit lifecycle. [Source-backed matrix + independent reviewer handoff](docs/product/3_8_0_D3B_PROTECTED_TRASH_INTEGRITY_REVIEW.md). No destructive code or full-v20 PG runtime proof yet; do not claim safe deletion/restore of connected or certified histories. |
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
