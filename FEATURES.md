# FlyTally Logbook — FEATURE LIST

**3.8.0 release governance (14 Oct):** Restored Neon `br-raspy-fog-b1btvu5t` is explicitly owner-approved canonical production, but Currency 3.8 is **not deployed**; v21 physical schema and runtime migration version 21 are absent. Full owner-local candidate acceptance applies to code SHA `0192570a` only. An execution-grade schema-first production release contract has been documented, not implemented; post-migration runtime, signed-v13 recovery and source-provenance release gates remain open. See `docs/product/3_8_0_V21_EXACT_PRODUCTION_MIGRATION_PLAN_2026-10-14.md`.

**Currency 3.8.0 locally accepted, NOT RELEASED (14 Oct 2026).** Currency settings, source-backed exact amounts and aircraft sharing/recovery candidate pass one complete owner-local TypeScript, PG16, 1544 Node, build and desktop/mobile browser acceptance on SHA `0192570a`. Production remains schema v20; v21 execution approval, source provenance and real-history recovery are not yet established. PR #338 Draft.

**Currency 3.8.0 — sharing/recovery fix CANDIDATE (14 Oct, unreleased):** Draft PR #338 now contains v2 exact aircraft rate sharing (denomination, exponent, decimal), v1 unknown-currency compatibility, conflict-safe recipient upsert, exact-vs-legacy cache validation and signed-v13 semantic currency preflight. All are **UNVERIFIED new code pending the single complete owner-local acceptance**; they are not live production capabilities. Source regressions, pure contract tests and representative disposable-Postgres conflict test were added but have **not executed on the current HEAD**. Production remains v20, v21 draft unregistered, PR Draft.

**Currency sharing/release limitations (14 Oct 2026; Draft #338):** Exact rate/flight/expense functionality is implemented on an **unreleased branch**; aircraft-profile sharing still serializes/imports legacy numeric rates with no source currency/exponent/exact decimal, and a conflicting import can modify the numeric rate without updating existing exact metadata. Dual-value snapshot consistency is not enforced. The v21 physical schema is a prerequisite for deploying the current runtime. These remain release blockers pending implementation and independent review, even after successful local acceptance and disposable Neon DDL rehearsal. [Evidence and DeepSeek handoff](docs/product/3_8_0_CURRENCY_PRE_RELEASE_INDEPENDENT_REVIEW_HANDOFF_2026-10-14.md).

**Currency 3.8.0 — v21 PG18.6 rehearsal (14 Oct 2026):** Candidate v21 additive DDL successfully rehearsed twice on an owner-authorized **temporary Neon child** of production v20: 12 nullable nondefault columns, 4 validated constraints, unchanged existing row counts and migration registry v20. A separate production read-only check confirmed v21 still absent. Temporary branch deleted and removal verified. PG18 active constraint-rejection probe was blocked (**NOT RUN**), and actual app Neon SDK/signed-v13 historic restore on PG18 not tested. No released/migrated product changes. Evidence: [Neon rehearsal report](docs/product/3_8_0_CURRENCY_V21_NEON_PG18_REHEARSAL_2026-10-14.md).

**Currency 3.8.0 capability status — 14 Oct 2026:** Complete owner-local acceptance **PASS on code SHA `669708fec856f5e88072a474f2b97b573a7881f6`**: typecheck, 6/6 SQL source, 8/8 disposable PostgreSQL16, 1533/1533 full unit/source, local Next build and 8/8 authenticated desktop/mobile Trash + signed-v13 browser scenarios. **UNRELEASED** (Draft PR #338). Live **read-only** Neon Logbook Shadow production preflight shows v1–v20 and no v21 monetary columns/constraints; current Vercel `logbook` production `DATABASE_URL` endpoint and DB name match the Neon production branch. This is not v21 migration approval, complete historic backup/restore evidence, or live production release; no production changes made. Subsequent docs-only commit is not separately test-executed.

**Currency 3.8.0 full acceptance gate (14 Oct, Draft #338):** Owner-local `a9c01c1c` typecheck, static 6/6 and disposable PostgreSQL16 8/8 PASS; full source/unit suite 1532/1533 due to outdated SQL shape assertion, not a proven functional regression. The flight expense test now requires the v20-safe/v21-exact `to_jsonb` projection and original persisted expense fields. New HEAD NOT TESTED; prior authenticated browser 8/8 PASS applies to `a9c01c1c` only. No production migration/merge/deploy.


**Currency 3.8.0 signed v13 browser completion (14 Oct; Draft #338):** Owner-local desktop/mobile browser on `afe862a6` passed 7/8, including all monetary Trash flows and mobile signed-v13 exact restore. Desktop signed-v13 did not complete within default whole-test 30s; reason still unverified. Browser recovery now requires an explicit server-side success/error result before checking exact persisted rates and expenses, with bounded longer timeout for the backup+restore workflow. Current changes NOT RUN and unreleased.


**Currency 3.8.0 browser verification (14 Oct; Draft #338):** The protected signed-v13 Download flow is now exercised with real browser session successfully reaching restore preview. Follow-up work fixes missing FSTD certification correction columns in **disposable test fixture only**, and separates GPS deletion database verification from UI revalidation. Previous exact browser `4e0975f5`: build PASS, **5/8 browser**; new HEAD NOT RUN. Currency v21 remains unregistered and unreleased.


**3.8.0 signed backup browser acceptance (14 Oct, not released):** The authenticated v13 browser test now downloads via the normal user-visible Download link rather than a separate APIRequestContext which returned HTTP 401 in the isolated localhost fixture. A browser-origin GET diagnoses auth failures; the downloaded file is checked for version, server signature and exact currency before restore. All production endpoint authentication remains unchanged. Latest browser result on predecessor `a3f0d809`: **6/8 PASS**; updated test **NOT RUN**.


**3.8.0 Currency browser recovery hardening (14 Oct 2026; unreleased):** Flight detail expense projection now reads optional v21 precision fields through `to_jsonb`, compatible with v20 and v21. Opt-in owner-local desktop/mobile browser runner applies the reviewed v21 candidate once to its verified disposable PostgreSQL fixture before all tests, with unique currency test identities per browser project. Signed v13 recovery and KWD/JPY Trash test diagnostics improved. **Owner-local full suite and PG passed on `5957261f`, but browser acceptance failed (3/8); newer fix commit NOT TESTED.** No production v21 migration or release.


**Currency 3.8.0 backup and browser acceptance candidate (14 Oct 2026):** Portable backup format remains signed v13. A currency-bearing payload now requires compatible v21 schema for preview and execution; legacy NULL-only rows remain compatible. Verified logic added for detecting exact currency in primary rows and archived JSON, plus a decimal-regex fix in Trash. Desktop/mobile browser scenarios for precise KWD/JPY Trash and signed v13 restoration are registered and wired to a separate isolated localhost PG16 runner. **New HEAD test execution NOT RUN; not a released feature.**


**Currency-aware Deleted Flights restore (14 Oct 2026, Draft #338):** New runtime code conditionally restores v21 exact monetary metadata for eligible user-owned draft archives using an atomic SQL transaction; pre-v21 snapshots keep the original restore path. Rejects missing v21 columns or invalid ISO/scale/encoding. Implemented but latest commit verification NOT RUN; not released or production-migrated.


**Currency v21 restore acceptance evidence (14 Oct 2026):** PostgreSQL integration cases added for round-tripping KWD flight and expense amount tuples and aborting the complete transaction if a child amount encoding is invalid. New tests NOT RUN; Trash currency-bearing restore remains unavailable pending controlled runtime implementation.


**Currency 3.8.0 recovery integration in progress (14 Oct 2026):** exact restore expense matching now retains source integer amount and encoding/exponent identity, reading missing pre-v21 columns safely as absent. No currency guessing or FX. New work NOT RUN; overall 3.8.0 not released.


**Capability inventory reviewed:** 13 October 2026. **Current release status and next milestone:** [ROADMAP](ROADMAP.md). **Dated release/deploy evidence:** [CHANGELOG](CHANGELOG.md). This inventory describes capabilities and restrictions; it does not independently establish deployment or provider permission.

This is the **capability register**, not a dated test log. Implementation and production statements below are limited by their stated scope. Execution order and outstanding release gates are in [ROADMAP](ROADMAP.md); merged changes and source evidence in [CHANGELOG](CHANGELOG.md). The [verbatim previous feature inventory](docs/history/FEATURES_BEFORE_2026-10-10_CANONICAL_CLEANUP.md) retains every earlier milestone claim and test candidate for audit; old `Draft`/`FAIL`/`OFF` captions there are historical.

**Currency 3.8.0 consolidated Draft PR #338 (13 Oct 2026):** ISO-backed Settings currency choice/server validation and conservative unknown legacy denomination presentation are implemented on branch; disabled unsafe global highest-cost sorting and excluded unverified aircraft costs from currency-labelled expense totals. Current rates, new expenses and flight cost snapshots still need v21 exact currency write/read integration before the release; no migration activated. **Status: IN PROGRESS / NOT DEPLOYED.**

**Currency 3.8.0 local verification progress (14 Oct 2026):** At commit `83e7c54d`, TypeScript and isolated PostgreSQL tests passed; full 1518-test run had 7 historical source-assertion failures and no build. Source assertion compatibility updated in Draft #338 without enabling v21; full rerun on latest HEAD pending. Certified/void history, backup and currency-bearing Trash restore remain release gates.

**Currency 3.8.0 implementation hardening (14 Oct 2026):** Strict saved rate snapshots and error handling, expense ISO scaling/read projection, visible invalid-expense state, v21-null-aware legacy Trash restore are implemented in Draft #338; not merged/tested on current HEAD. New-money Trash restore and signed v13 backup still gate release.

**Currency 3.8.0 accelerated delivery (14 Oct 2026):** Consolidated in-progress currency UI/backend in Draft PR #338; one local acceptance runner now combines disposable PostgreSQL16, full tests and build. New runner NOT RUN; no v21 registration, deployment or historical re-denomination.

**Currency M2-A-1 compatibility assessment (13 Oct 2026):** Isolated PostgreSQL 16 and static tests each 6/6 PASS on candidate `8a9e03e0`. Source audit identifies signed portable v13 backup, aircraft share decimal/coercion, billing and certified/void provenance as integration boundaries; new currency write paths and v21 activation remain NOT IMPLEMENTED. [Audit](docs/product/3_8_0_CURRENCY_M2A1_COMPATIBILITY_AUDIT_2026-10-13.md).

**Currency M2-A-0 staged (13 Oct 2026):** The existing offline v21 schema draft and isolated PostgreSQL acceptance suite are ported unchanged onto a clean current-main branch, apart from updating harness branch guards. Not a registered or deployed migration. New-branch tests/PG **NOT RUN**; legacy money attribution remains explicitly unknown.

**Currency M1-B2 provenance acceptance (13 Oct 2026):** User supplied and authorized official SIX List One XML whose Git blob matches the pinned snapshot exactly; owner-attested origin documented, independent network authentication not established. Technical check 1497/1497 on `ff6fd97e`; read-only registry still not wired to UI or DB. [Source evidence](docs/product/3_8_0_CURRENCY_ISO4217_SOURCE_ATTESTATION_2026-10-13.md).

**3.8.0 Currency M1-B2 staged registry (13 Oct 2026):** Offline ISO 4217 List One monetary registry and validators are staged in a new isolated Draft PR from current `main`, with explicit unverified SIX provenance; generated candidate contains 155 eligible currencies. Source verification and tests on new HEAD are NOT RUN. No UI, DB, FX or live money behavior. M1 exact arithmetic is separately merged (`#336`, `d6ab59e0`) and Vercel READY.

**3.8.0 integrity integration (13 Oct 2026):** D2/D3a/D3b including A+ ordinary Trash safeguards merged into `main` in [PR #334](https://github.com/filipto861/flytally-logbook/pull/334), commit `0b5a313c`. Vercel production reports READY for this SHA and assigns alias `fly-tally.com`; direct HTTP and authenticated production smoke NOT RUN. Currency #136 remains unfinished. Earlier Draft status in the milestone inventory below is historical, not the current status of D3b-1 integration.

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
| `3.8.0` Currency / monetary semantics · #136 | **ACTIVE / M1 EXACT CORE DRAFT #336 / NOT WIRED** | Owner-frozen [D1–D4 currency policy](docs/product/3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md); isolated amount parser, bigint minor units, half-up billing candidate, same-denomination-only sum are copied byte-identically from earlier #320 into new [PR #336](https://github.com/filipto861/flytally-logbook/pull/336). Prior isolated Node22 4/4 + strict typecheck passed on identical Git blobs; new Node24 full project tests NOT RUN. Exact source-backed SIX registry, technical precision, unregistered v21 draft, historical attestation, signed backup/share and UI read/write remain pending. No FX, no historical CZK backfill, no v21 deployment. |
| `3.8.0` D3a Create/Restore deduplication and D3b protected-history safety | **MERGED/DEPLOYED in #334; production authenticated smoke OPEN** | Existing D2/D3a/D3b integration shipped in `main@0b5a313c`, Vercel READY; prior source/native PG16 and browser gates are exact older-SHA local evidence. No Currency v21 changes and overall 3.8.0 not released. [Full evidence](docs/product/3_8_0_D3A_CREATE_RESTORE_D3B_PROTECTED_EVIDENCE_HANDOFF.md). |
| `3.8.0` D3b-1 owner-approved A+ ordinary Trash lifecycle | **MERGED/DEPLOYED #334; auth production smoke NOT RUN** | Previous owner-local 1484/1484 source/unit, build, 4/4 authenticated desktop/mobile Playwright PASS on exact code `a027afa3`; final integration merge `0b5a313c` deployed Vercel READY with all v1–v20 schema versions checked read-only. No new Currency migration. [Contract](docs/product/3_8_0_D3B1_ATOMIC_FAIL_CLOSED_TRASH_CONTRACT.md). |
| `3.8.0` D3b-0 sequential migration v1–v20 SQL verification | OWNER-LOCAL 15/15 PASS / APP INTEGRATION OPEN | At exact SHA `7f87eb76`, Node24 typecheck PASS, 3/3 source, 5/5 targeted native PG16 and 7/7 sequential v1→v20 migration/FK/trigger/Trash tests PASS on disposable PG16. Reproduced CASCADE evidence loss and archive-plus-active certified flight in the migrated minimal-base test environment. Full historic production schema/data, authenticated writer paths and safe runtime fix remain unverified / unshipped. |
| `3.8.0` D3b-0 native PostgreSQL Trash safety reproduction | OWNER-LOCAL TARGETED 8/8 PASS / FULL-v20 ACCEPTANCE PENDING | Exact source SHA `dd0823af`: Node24 typecheck, 3 source tests and 5 native PostgreSQL16 SQL tests PASS on disposable, synthetic pre-v20 schema with real v20 triggers. Reproduced linked crew/verification CASCADE and archive-plus-active-flight interleaving; immutable provenance rollback and certified guard PASS. This is test evidence, **not** a shipped data-integrity fix. Full applied-v20 parity, canonical writer races, approved A+ behavior and release remain pending. |
| `3.8.0` D3b reviewer reconciliation / atomic archive-delete invariant | DESIGN PROVISIONAL / TARGETED MIGRATION-CHAIN PG16 VERIFIED | Owner-forwarded independent DeepSeek review reconciled against actual source. On `7f87eb76` Node24/typecheck and 15/15 source/PG16 migration-chain tests PASS: archive-plus-active-flight race and child CASCADE are reproduced in a minimal-base native PostgreSQL schema with original optimizer v1–v20 SQL. Option A+ must protect independent evidence and confirm final DELETE; broader production-schema/application verification and owner behavior decision are pending. No runtime fix or release. [Full reconciliation](docs/product/3_8_0_D3B_DEEPSEEK_REVIEW_RECONCILIATION_2026-10-13.md). |
| `3.8.0` D3b protected/voided/shared Trash lifecycle integrity | PG16 SQL RISKS REPRODUCED / PRODUCT DECISION PENDING | Source confirms ordinary Trash archives only flight/tracks/expenses while independent participant/verification/connected-crew/provenance relationships require explicit lifecycle. Scoped 15/15 Node24/PG16 tests on `7f87eb76` reproduced orphaned archive marker and linked-evidence CASCADE after real runtime optimizer migrations v1–v20, but canonical application paths and complete historical production schema remain unverified. [Source-backed matrix + independent reviewer handoff](docs/product/3_8_0_D3B_PROTECTED_TRASH_INTEGRITY_REVIEW.md). No product fix or claim of safe connected/certified history deletion. |
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
