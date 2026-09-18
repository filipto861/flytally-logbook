# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Cross-product release track — authoritative from 18 September 2026

This cross-product track supersedes the older v2.8/v2.9 labels further below while preserving those sections as historical Logbook product-planning context.

### v2.8 — Compliance & Safety Foundation ✅

Completed technical foundation across Logbook and Training: GDPR/privacy self-service, legal/storage/provider boundaries, map/licensing hardening, EASA-facing evidence safeguards, Training source authority and performance fail-closed behavior, public-sharing boundaries, security and release regressions.

### v2.9 — Commercial & External Validation — current

- C1 ✅ commercial launch contract and external-validation ledger.
- C2 ✅ technical commercial legal/consumer publication structure with exact-version review/publish gating; externally reviewed content remains pending.
- C3 ✅ technical billing/entitlement foundation: provider-neutral durable grants, signed Logbook → Training entitlement snapshot and user-visible access state; payment provider, plans and prices remain an external/business decision.
- C4 ✅ technical signature/QES and regulatory-validation foundation: explicit assurance taxonomy, public authority-status surface and fail-closed external-evidence gate; ÚCL/LAA decisions remain external.
- C5 trademark/brand and marketing/regulatory claims review.
- C6 final commercial release audit and deliberate launch-stage transition.

No environment flag, payment integration or marketing copy may be treated as evidence of lawyer, regulator, rights-holder or trademark approval.

### v3.0 — Product scale

Return to product development, led by multi-aircraft scaling in FlyTally Training and broader platform capability once v2.9 external launch decisions are resolved.

## Current release — v2.7.0 — Data Integrity & Recovery 2.0

- Keep restore non-destructive and reviewable with grouped missing/present/protected-evidence preview and explicit duplicate/conflict reasons before mutation.
- Authenticate portable backup v12 with server HMAC while retaining legacy backup compatibility and withholding untrusted cross-account workflow state.
- Preserve certified revisions, signatures, GPS, sharing evidence, audit history, licences, expenses and recency evidence through the canonical recovery path.
- Keep large-account recovery atomic with a tested batch policy that stays within the existing 1,000-statement transaction safety limit for the v2.7 scale fixture.

## Post-v2.7 roadmap

The next roadmap phase prioritizes workflow quality and product consistency before another major expansion of regulatory scope.

### v2.8 — Mobile & PWA Hardening

- Run a complete iPhone/Android audit across Add flight, Actions, Flights, signatures, GPS import, Licences and Statistics.
- Harden safe-area, keyboard, date/time, focus, loading and perceived-performance behavior.
- Validate PWA install/update behavior.
- Consider limited offline capability only with a clear conflict and protected-record integrity model; do not introduce offline editing of certified evidence casually.

### v2.9 — Product Polish & Consistency

- Converge terminology, status badges, empty states, page titles, navigation, form controls, confirmations, loading/error states and accessibility.
- Remove remaining obsolete or duplicate UI components and dead code only when behavior is covered by regression tests.
- Re-run performance, mobile and protected-evidence regression audits as the final v2.x consolidation release.

### v3.0 — Professional Logbook Platform research

Do not schedule v3.0 from a single feature request. Treat it as a research boundary for a later product shift toward organization/operator accounts, instructor/student workflows, flight-school evidence, fleet-linked training, organizational verification, controlled reports and team permissions. Promote this to an implementation roadmap only when the pilot logbook, regulatory evidence, collaboration and professional-experience foundations are stable in real use.

## Permanent release principles

- **Performance:** every release retains 10k/50k gates; v2.3 establishes a 100k read-only benchmark where practical.
- **Regulatory integrity:** never infer legal status or privileges without explicit supporting evidence and a tested rule boundary.
- **Certified-data integrity:** certification fingerprints, revisions, signatures, sharing and restore behavior remain regression-protected.
- **One workflow principle:** do not create parallel Quick/Simple/Advanced versions of the same core task.
- **Mobile as a release gate:** core mobile workflows are part of release acceptance, not a later cleanup step.

## v2.6.0 — Professional Pilot Workspace 2.0

- Expand operator/operation context, PICUS/supervised time, commander/copilot/instructor reporting and professional experience summaries.
- Improve aircraft-type and employer-oriented career reporting and exportable professional experience summaries.
- Keep CAT/NCC/SPO and other professional context explicit evidence, never inferred silently.
- Preserve the distinction between recorded evidence and a claimed regulatory or employment status.

## v2.5.0 — Recency & Compliance Workspace

- Consolidate licence/rating validity, flying recency and supporting evidence into one planning-oriented workspace.
- Keep explicit states such as CURRENT, ACTION SOON, NOT CURRENT and INCOMPLETE EVIDENCE evidence-driven and explainable.
- Improve SEP/TMG, LAPL, SPL, Balloon and supported Helicopter planning without making unsupported legal-status inferences.
- Link recency requirements to the exact flights, training, signatures and saved credentials that support them.
- Keep FSTD recency evidence deferred unless it becomes an explicit product priority during this phase.

## v2.4.0 — Flight Entry & Review 2.0

- Keep one canonical Add flight workflow while surfacing Intelligent Logbook findings next to the fields that own them.
- Keep continuation, return and local-flight assistance explicit and inside the existing Departure/Arrival controls.
- Require an explicit saved-vs-GPS review before GPS-derived time suggestions can overwrite an existing flight record.
- Hand a successful normal Save into final Logbook data review before certification and sharing, without changing certification hashes, revisions or regulatory calculations.
- Harden Quick Aircraft keyboard/focus behavior and retain the existing mobile and large-logbook release gates.

## v2.3.0 — Large Logbook Performance & Scalability

- Retain 10k/50k release gates and add a controlled 100k-flight read-performance gate for production hot paths.
- Keep Dashboard concise with a lean at-a-glance read model instead of recomputing Statistics aggregates.
- Keep complete Print preparation bounded by resolving latest aircraft and signed-verification metadata set-wise rather than once per flight row.
- Compute only the aggregates required by the active Statistics section while preserving the canonical multi-category time/category engine and backward-compatible all-section mode.
- Preserve v2.2 Action Center workflows, v2.1 Dashboard/Statistics information architecture, v2.0 regulatory semantics and certified-data integrity without a schema change or historical-row rewrite.

## v2.1.0 — Dashboard & Statistics consolidation

- Keep Dashboard as a concise, stable all-time snapshot for total flying, category totals, last flight, recency and quick actions.
- Keep historical period selection and analytical trends exclusively in Statistics while redirecting legacy Dashboard period URLs safely.
- Give Career its own Statistics workspace and make its all-time scope explicit rather than embedding it in Overview.
- Preserve saved Dashboard layouts through the v1.70 compatibility projection and keep analytical widgets out of normal Dashboard customization.
- Preserve all v2.0 category-aware time, certification, sharing, print/export and data-integrity semantics without a schema change.
## v2.0.0 — Multi-category Pilot Logbook

- Use one canonical category/capability contract for `AEROPLANE`, `HELICOPTER`, `SAILPLANE`, `BALLOON`, `ULL` and conservative `OTHER` records.
- Keep one Add/Edit flight workflow while exposing category-appropriate evidence: Part-FCL PF movements, SFCL launch/TMG evidence and BFCL take-off/landing operation context.
- Keep historical TMG in Part-FCL unless Sailplane context is explicit and never rewrite certified category evidence during compatibility migrations.
- Apply coherent category-aware time semantics across Flights, Dashboard, Statistics, Print/Export and sharing while keeping auxiliary roles out of regulatory pilot-experience totals.
- Route certification by resolved regulatory family so Part-FCL keeps FCL.050 safeguards without applying aeroplane SP/MP, SE/ME or BLOCK-time assumptions to SFCL/BFCL records.
- Preserve category, launch and BFCL evidence through certification revisions, sharing, trash/restore and portable backup, with PostgreSQL plus 10k/50k release gates.

## v1.62.0 — Sailplane / SPL / TMG support

- Extend the single flight-entry workflow with explicit `AEROPLANE`, `SAILPLANE`, `ULL` and `OTHER` regulatory context instead of deriving legal meaning from aircraft class alone.
- Keep legacy TMG records in Part-FCL unless SPL / Part-SFCL context is explicitly selected.
- Record non-TMG sailplane launch method/count and SPL TMG day/night take-offs as explicit evidence; GPS never invents launch methods.
- Add SPL recency evaluation for SFCL.160 sailplane/TMG privileges, passenger currency and SFCL.155 launch-method recency, including the explicit Part-FCL TMG route.
- Add SPL proficiency-check evidence and preserve the new regulatory/launch evidence through sharing, trash/restore and portable backup v9.
- Bind regulatory category and launch evidence into flight certification fingerprint v5 while preserving verification of historical v1-v4 fingerprints.
- Present sailplane protected records as Part-SFCL rather than mislabelling them FCL.050; do not fabricate a new official-looking SPL print template.

## v1.61.0 — Category-aware Flight Entry

- Keep blank New flight neutral until an aircraft is explicitly selected.
- Derive a presentation category from the selected aircraft profile and reveal only the aircraft-dependent experience controls relevant to that category.
- Keep one Add flight workflow for Aeroplane, ULL, Sailplane and future categories rather than branching into separate entry pages.
- Preserve Role as flight-specific state and keep the category helper presentation-only; existing regulatory calculations remain authoritative.

## v1.60.1 — Licences navigation cleanup

- Keep the Licences section tabs as the single normal navigation layer.
- Keep status rows compact and read-only, with detailed regulatory evidence one level deeper.
- Avoid duplicating navigation or long regulatory explanations in the everyday Overview.

## v1.60.0 — Adaptive Pilot Workspace

- Replace the normal Licences Overview with an adaptive status workspace showing only credentials, privileges and documents present in the pilot account.
- Keep items needing attention prominent while separating licence/document validity from flying recency.
- Delegate authoritative LAPL(A) SEP/TMG recency to the existing Recency Engine rather than duplicating legal calculations in the UI.
- Add presentation-only pilot-category classification as groundwork for aeroplane, ULL, sailplane, helicopter and balloon support.
- Preserve detailed Licences & ratings, Recency, Aircraft training and Medical & documents workspaces below Overview.

## v1.59.0 — Flight Entry Structure & Expenses

- Reorganize New flight around pilot workflow rather than EASA implementation groups.
- Keep landings, night/IFR and PF movement evidence together in Flight experience.
- Add user-owned structured expenses with explicit currency and no automatic FX conversion.
- Preserve expenses in portable backup and trash/restore while keeping them outside regulatory certification fingerprints.
- Preserve v1.51 regulatory semantics, v1.53.1 aircraft-state integrity and v1.56 mobile containment.

## v1.58.0 — Flight Entry Polish & Smart Defaults

- Remove Quick Routes from New flight and keep only a compact explicit local-flight helper.
- Make existing aircraft-profile defaults understandable without adding regulatory guesses.
- Move missing-state guidance next to selectors that are already required.
- Harden airport-code typing on mobile and keep the v1.57 live BLOCK/AIR + inline Review workflow.
- Preserve v1.51 regulatory semantics, v1.53.1 aircraft-state integrity and v1.56 responsive containment.

## v1.57.0 — Flight Entry Workflow Simplification

- Reuse recent route history and provide an explicit local-flight route shortcut.
- Show BLOCK/AIR feedback while entering the timeline instead of only at final review.
- Never leave a missing required choice hidden inside a collapsed Logbook or Cost section.
- Make final review name the exact missing fields and keep the mobile source selector compact.
- Preserve v1.51 regulatory semantics, v1.53.1 aircraft-state integrity and v1.56 responsive containment.

## v1.56.0 — Mobile Layout Audit & Responsive Hardening

- Fix iOS/WebKit native date and time controls at the shared responsive layer instead of clipping page overflow.
- Audit every primary navigation destination for intrinsic-width, grid, card, action and intentional-scroll behavior.
- Keep forms and cards shrinkable with a reusable inline-size containment contract.
- Preserve internal scrolling for wide tables and horizontal navigation strips.
- Keep v1.51 regulatory semantics, certification, aircraft identity, GPS, print/export and backup/restore behavior unchanged.

## v1.55.0 — Flight Entry Layout & Responsive UX

- Align Flight essentials into predictable two-column pairs on desktop.
- Keep Departure/Arrival, Off-block/On-block and Takeoff/Landing on matching rows.
- Use consistent control sizing and spacing.
- Collapse to one logical single-column sequence on mobile without changing flight data semantics.

## Current development — v1.54.3 · Aircraft Type Catalogue & Smart Aircraft Setup

Focus:
- searchable aircraft catalogue by manufacturer, model and ICAO type designator
- auto-fill Make, Model and ICAO identity from a selected catalogue result
- always preserve manual aircraft identity entry for missing/new/ultralight types
- keep Part-FCL class separate and pilot-confirmed; catalogue class hints are informational only
- use registration/profile identity as the authoritative source for later flight snapshots
- preserve v1.53.1 stale-state protections and the complete v1.51 regulatory safety net

## Current development — v1.53.1 · Aircraft state integrity

Focus:
- audit and prevent stale aircraft-dependent state when a flight registration changes
- refresh type, class, logbook, engine, operation mode, billing and rate from the newly selected aircraft profile
- preserve flight-specific role and training/crew semantics during a registration correction
- prevent a known aircraft type from being edited independently into a mixed profile; manual type entry remains available only when no active aircraft profile exists
- evaluate a worldwide aircraft-type catalogue with manual fallback as a follow-up, without introducing an unlicensed ICAO data dependency

## Current development — v1.53.0 · Guided everyday entry

Focus:
- make normal manual entry the default New flight path while keeping GPS import one click away and directly addressable with `?mode=gps`
- guide an empty account to add its first aircraft before presenting an unusable aircraft selector
- reduce first-time aircraft creation to registration, type/model and normal logbook; reveal class only for EASA and keep pricing/technical defaults optional
- simplify the full Aircraft profile with the same progressive-disclosure model so ordinary pilots do not need to understand every technical field before saving
- make flight role choices self-explanatory while preserving the exact stored role codes and all certification/recency semantics
- keep v1.51 regulatory rules, certification revisions/hashes, signatures, GPS evidence, ownership, print/export and backup/restore behavior unchanged

## v1.52.0 · Codebase Review & Cleanup

Focus:
- freeze the validated v1.51.x regulatory behavior as the release baseline rather than combining cleanup with another rules rewrite
- remove the inactive Streamlit/Python runtime, frozen SQLite/source-import artifacts, generated airport SQLite copy and obsolete migration/deployment tooling from the active production checkout
- keep `data/airports.csv` as the single airport catalogue consumed by the current Next.js runtime
- synchronize package metadata and replace stale operational architecture/documentation with the current Next.js / Vercel / Neon model
- preserve certification payloads/hashes/revisions, shared-flight ownership, Recency Engine behavior, GPS evidence, print/export semantics and portable backup/restore
- retain release-numbered TypeScript regression tests as the safety net for later refactors
- defer broad CSS consolidation, destructive database cleanup and speculative hot-path rewrites until they can be isolated and measured

## v1.51.x · Regulatory correctness core — final baseline

Focus:
- FCL.060 uses structured certified PF take-off, approach and landing evidence; explicit structured zeroes remain authoritative
- certified EASA records created before the v1.35.3 structured-movement boundary may use the bounded legacy compatibility path based on record-creation provenance, not later edits
- FCL.140.A counts eligible certified ordinary ULL / Annex-I aeroplane PIC experience automatically as SEP experience, including native ULL starts/landings
- ULL / Annex-I experience is not imported automatically into FCL.060 passenger currency and does not automatically satisfy the mandatory FI/CRI refresher element
- FCL.740.A experience planning can use eligible ULL PIC experience while retaining the separate FI/CRI refresher/exemption requirement
- Part-FCL DUAL and supervised-SOLO contribution requires current instructor-signed evidence for the certified revision
- Recency Evidence detail uses the same eligibility and effective-movement interpretation as the calculation
- IR(A) qualification detection remains distinct from instructor certificates such as IRI(A)
- the optional internal Part-FCL class override is retained only for atypical mappings such as a genuine TMG and is not exposed in the normal Aircraft UI
- preserve certification fingerprints, revision history, instructor signatures, shared-flight ownership, print/export, GPS evidence and backup/restore behavior

## v1.50.0 · UI system & theme convergence

Focus:
- converge the application on one semantic color contract for backgrounds, panels, controls, text, borders, status states, focus and chart surfaces instead of accumulating page-specific Light-mode patches
- resolve System / Light / Dark before normal page content paints; public authentication pages follow the device scheme and protected pages apply the saved preference server-side before hydration
- keep appearance reactive when the operating-system scheme changes while System is selected, with one runtime theme event for non-CSS surfaces
- use one no-key OpenStreetMap basemap path across route, track and GPS review maps and adapt map treatment plus overlay contrast to the resolved appearance
- move dashboard and GPS SVG colors to semantic chart tokens so cursors, lines and active values remain legible in both themes
- unify hover, focus-visible, disabled, success, warning, danger and informational states without changing their semantic meaning between themes
- keep mobile layout, reduced-motion behavior and the existing shared page/panel/control geometry intact while tightening visual consistency across Dashboard, Flights, Licences, Connections, Aircraft & airports, Map and Data
- keep printable FCL.050 logbook output theme-independent and preserve certification, recency, GPS inference, ownership and signed evidence behavior unchanged

## v1.49.0 · Training & recency linkage

Focus:
- make a certified, instructor-signed DUAL flight tagged **FCL.140.A** or **FCL.740.A** feed the matching Recency calculation directly, without duplicating the same refresher as manual evidence
- recalculate stored recency/dashboard state whenever a flight becomes certified, a certified flight is opened for correction, or instructor verification is signed or revoked
- support the current FCL.740.A SEP/TMG combined-experience route when both ratings are held and preserve explicit fallback evidence for external/historical refresher training or a valid refresher exemption
- keep FCL.740.A **READY** as a planning/evidence state only; never write a new SEP/TMG validity date automatically
- provide a direct handoff from a READY recency card to the saved rating where the pilot can record the actual new validity after revalidation is completed
- surface certified differences/familiarisation flights as candidates in Aircraft training; signed differences flights prefill the evidence record while exact VP/RU/T/P/TW/EFIS/SLPC or custom endorsements remain an explicit pilot selection
- preserve exact flight revision/hash signatures, append-only correction history, separate aircraft-training evidence and FCL.050 print/export semantics

## v1.48.0 · Modular training evidence

Focus:
- replace free-form aircraft-equipment entry with selectable standard endorsement codes **VP, RU, T, P, TW, EFIS and SLPC**, while retaining an explicit Other / custom field
- do not invent negative endorsement codes such as NON-EFIS or NON-SLPC
- allow instructor flights to carry more than one structured purpose at the same time, including aircraft differences/familiarisation, LAPL(A) FCL.140.A refresher training and SEP/TMG FCL.740.A refresher training
- keep Task / exercise as independent free text and preserve all selected purposes in the certified flight remarks
- retain one compatibility `purpose_code` marker for existing Recency Engine queries, with LAPL FCL.140.A taking priority when purposes are combined
- treat FCL.740.A refresher training as evidence contributing to revalidation by experience, never as an automatic rating revalidation
- keep aircraft-training signatures bound to the exact selected endorsements and preserve certified-flight hashes/revisions

## v1.47.0 · Everyday UX refinement

Focus:
- keep everyday workflows compact instead of adding another flight-entry mode or duplicating controls that already exist elsewhere
- remove the separate Flights **Quick view** row while retaining the same Draft/Certified/Correction/Locked and sharing states inside Advanced filters and active filter chips
- make **Save and add another** close the feedback loop with a clear saved-state message while reusing the existing aircraft, departure and pilot defaults rather than introducing a multi-leg editor
- keep instructor/supervising-PIC verification prominent when it can require action, but move ordinary **Crew & logbook sharing** into a collapsed secondary section on certified flight detail
- show the top-level Aircraft & airports technical-data panel only when actionable data-quality issues exist; keep the optional Data health summary available for deeper inspection
- remove the retired quick-view CSS rather than hiding obsolete controls
- keep the release presentation-only around protected evidence: it does not change flight ownership, certification, recency or GPS inference
- preserve FCL.050 print/export semantics, ULL/EASA evidence boundaries, signed aircraft-training evidence and global mobile navigation

## v1.46.0 · Compact licences workspace

Focus:
- keep the Licences area split into clear sections: **Overview**, **Licences & ratings**, **Recency**, **Aircraft training** and **Medical & documents**
- keep Overview as a status panel rather than an inventory dashboard: show only whether credentials/documents are valid and whether monitored recency is current
- do not show counts of licences, ratings, aircraft-training records or documents on Overview
- keep licence/rating/document validity separate from flying recency; an unlimited licence can remain valid while its associated flying privileges are not current
- keep detailed regulatory calculations and evidence inside the Recency section instead of repeating long legislative explanations in the normal Licences UI
- preserve the v1.45 aircraft-training evidence/signature model and the existing licence, rating and document data boundaries
- preserve flight certification payloads/hashes/revisions, Recency calculations, GPS inference/review, FCL.050 print layout and global mobile navigation

## v1.45.0 · Licences, pilot profile & aircraft training

Focus:
- keep licences, ratings/qualifications, validity, recency and logbook signing identity in the existing credential model instead of creating a parallel profile system
- add a separate **Types, variants & differences training** evidence layer for class/type training, differences training, familiarisation and national/ULL authorisations
- derive **Aircraft flown** from the pilot's own flight history as an informational overview only; flying an aircraft never creates or validates a privilege automatically
- preserve FCL.710-style training evidence with completion date, class/type, make/model/variant, differences/equipment, organisation, instructor/examiner, reference and notes
- allow a connected instructor/examiner to review and cryptographically sign the exact aircraft-training record using a credential snapshot, with decline and revocation states
- allow an instructor/examiner who is physically present to sign the same exact evidence on the device with a stored handwritten signature
- keep aircraft-training rows outside ordinary active rating, Recency Engine and flight-signature credential queries while retaining them in the existing portable `pilot_qualifications` backup/restore graph
- lock signed or pending aircraft-training contents against normal edits; corrections use a new evidence record rather than overwriting signed evidence
- preserve flight certification payloads/hashes/revisions, Recency calculations, GPS inference/review, FCL.050 print layout and global mobile navigation

## v1.44.0 · Production hardening & cleanup

Focus:
- restore the PostgreSQL acceptance gate to the current certification v4 and participation-only instructor workflow instead of testing obsolete v1.33/v1.38 SQL shapes
- close the stale v1.17 draft PR that duplicated every production verification run and add CI concurrency/branch guards so the production branch cannot create a second PR verification for the same SHA
- add targeted hot-path indexes for shared-flight lookups, exact verification evidence, notification links, licence lookups and the retained legacy `track_points` backup path
- make backup ownership validation cover `connection_audit_log` as well as connections, participations, approvals, verifications, licences, qualifications and notifications
- keep `track_points` deliberately present because portable backup/restore still round-trips it; removal requires a future backup-format migration rather than an ad-hoc table cleanup
- keep `instructor_flight_approvals` compatibility-only for historical backups/links while all new instructor requests remain canonical `flight_participations` records
- re-run the controlled 10k-flight Dashboard, Flights and Print acceptance benchmarks against the current query shapes
- preserve certification payloads/hashes/revisions, Recency Engine, GPS inference/review, FCL.050 print layout and global mobile navigation

## v1.43.0 · Print & Export finalisation

- use one scope vocabulary across printable logbook and flight export: Complete logbook, ULL only, EASA only and ULL + EASA
- validate calendar dates and reject invalid or reversed From/To ranges instead of silently producing empty output or a PostgreSQL date-cast error
- keep Excel FSTD content aligned with the selected print scope and date range; ULL-only exports exclude FSTD while Complete, EASA and ULL + EASA include the matching FSTD period
- keep CSV deliberately flight-row only and make the Excel/CSV difference explicit in the UI
- narrow the export flight query to the fields actually written instead of loading the complete flight record payload
- show selected record/page counts before printing, warn for large browser print jobs and show a clear empty-selection state
- keep the same FCL.050 columns 1–12, 10-row A4 landscape renderer and running-total logic for Complete, ULL, EASA and ULL + EASA
- preserve certification payloads/hashes/revisions, Recency Engine, GPS inference/review, shared-flight workflow and portable backup/restore

## v1.42.1 · GPS import review player polish

- keep one authoritative synchronized GPS map/player in the import workflow instead of repeating a static map in every flight review card
- retain altitude/speed profiles and interactive take-off, landing, touch-and-go and split markers
- retain the v1.38.1–v1.38.2 split/landing/take-off heuristics unchanged

## v1.41.0 · Map & GPS UX

- keep ordinary flight-detail loads lightweight by fetching only GPS track summaries on the server; detailed player coordinates are requested only when the GPS tab is actually opened
- expose a dedicated authenticated, user-scoped, no-store GPS review endpoint for the detailed track/player payload
- compare saved BLOCK/AIR values with the current GPS-derived suggestion before the pilot chooses to apply it
- show detected landing count as advisory evidence only; it is never written by the Apply GPS time suggestions action
- make provenance explicit: GPS suggestions remain derived/reviewable data until the pilot deliberately applies them, and certified records remain immutable
- show source file name, stored point count, distance and start time for each attached track in the GPS manager
- retain the existing synchronized map/altitude/speed player and the v1.38.1–v1.38.2 GPS split/landing/take-off heuristics unchanged

## v1.40.0 · Flights UX & logbook polish

- make the Flights list an operational workspace rather than a raw table: record and sharing views expose Drafts, Certified records, waiting shared-flight requests and records shared with the current pilot
- add exact record-state filters for Draft, Certified, Correction and Locked records without changing certification state or evidence
- add user-scoped shared-flight filters for Waiting, Shared/accepted, Shared with me and Not shared
- surface shared-flight state directly beside each flight's role and certification badge
- preserve existing search, ULL/EASA, role, aircraft, airport, route, GPS, date and sort filters and keep them combinable
- keep Previous/Next navigation consistent when a record or shared-workflow filter is active
- keep the fast Flights path N+1-free and exclude GPS coordinate JSON from the list query
- present flight rows as compact mobile cards below 760 px while leaving the global mobile shell/navigation untouched

## v1.39.0 · Core cleanup & performance

- make `flight_participations` the canonical model for all new instructor requests; `instructor_flight_approvals` is no longer populated by the modern request path
- retain `instructor_flight_approvals` as compatibility evidence for historical backups and old links
- make legacy approval synchronization exact by approval id, source owner, instructor, certified revision and flight hash
- consolidate protected-runtime schema initialization behind the retryable `ensureRuntimeSchema()` gate
- explicitly retain legacy `track_points`: portable backup/restore still round-trips it
- preserve backup/restore support for existing instructor approval rows while stopping creation of new duplicates
- keep certification payloads/hashes/revisions, Recency Engine, GPS inference, dashboard behavior and global mobile navigation unchanged

## v1.38.2 · GPS take-off time hardening

- `flightEnvelope()` ignores isolated taxi/runway speed spikes and requires sustained movement plus real climb when altitude evidence is usable
- automatic take-off is anchored to the first point clearly above the local ground baseline
- speed-only fallback remains available for tracks without useful altitude data

## v1.38.1 · GPS split & landing detection hardening

- automatic GPS splitting is stricter than generic track validation: both proposed flight sections must contain credible airborne movement and at least 1 km of actual tracked movement
- short taxi/GPS bursts followed by ground waits are not promoted to separate flights
- altitude-based touch-and-go candidates reject physically implausible GPS altitude discontinuities

## v1.38.0 · Dashboard, Airports & Routes overhaul

- scheduled backup and recency endpoints fail closed when `CRON_SECRET` is missing
- certified ULL and EASA records share one read-only field structure
- Aircraft and Costs are one coherent dashboard area
- Airports and Routes are separate period-aware statistics with direct drill-down to Flights

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed product foundation

- v1.34.0–v1.34.2: modular dashboard, per-user layout, System/Dark/Light appearance and responsive UI consistency
- v1.35.0–v1.35.5: selectable recency monitoring, forecasts, structured revalidation evidence, audit detail and simplified landing-based FCL.060 planning indicator
- v1.36.0–v1.36.2: mobile/iOS presentation work, single-tap navigation hotfix and isolated status-area handling
- v1.37.0: unified shared-flight notification/review workflow, explicit Review → Add → Certify states and protected ULL logbook-entry presentation
- v1.38.0: dashboard consolidation, distinct airport/route analytics, ULL/EASA field-parity regression guard and fail-closed cron authentication
- v1.38.1–v1.38.2: conservative GPS split/landing/take-off inference based on real SkyDemon failure cases
- v1.39.0: canonical participation workflow, exact legacy compatibility updates and cached runtime schema initialization
- v1.40.0: record/workflow-aware Flights filtering, shared-flight status in the list, narrowed list payload and mobile flight cards
- v1.41.0: lazy GPS detail payload, saved-vs-derived review and explicit track provenance
- v1.42.0–v1.42.1: visual GPS import player with take-off, landing, touch-and-go and split markers, followed by removal of the redundant per-flight map
- v1.43: Print & Export finalisation — shared scope/range semantics, filtered FSTD exports and large-logbook guidance
- v1.44.0: CI/acceptance hardening, backup ownership validation and targeted production indexes
- v1.45.0: licence/profile finalisation plus aircraft-flown overview and signed type/variant/differences-training evidence
- v1.46.0: compact sectioned Licences workspace with status-only Overview and validity separated from Recency
- v1.47.0: everyday UX refinement with less duplicated flight-list chrome, quieter certified-flight sharing and action-only data-quality alerts
- v1.48.0: selectable aircraft endorsement codes and modular instructor-flight purpose evidence without automatic privilege/revalidation claims
- v1.49.0: signed training-flight linkage into Recency, explicit rating-validity handoff and flight-backed aircraft-training candidates
- v1.50.0: semantic theme convergence with server-resolved appearance, adaptive maps/charts and stable printable output
- v1.51.x: regulatory correctness core with structured PF evidence, bounded legacy compatibility and automatic eligible ULL credit
- v1.52.0: retired Streamlit/Python cleanup and current-runtime documentation
- v1.53.0–v1.53.1: guided everyday entry and aircraft-state integrity
- v1.54.3–v1.54.4: aircraft catalogue and picker close fix
- v1.55.0–v1.59.2: flight-entry/mobile workflow hardening, structured expenses and manual-entry default integrity
- v1.60.0–v1.60.1: adaptive pilot workspace and Licences navigation cleanup
- v1.61.0: category-aware flight-entry presentation layer
- v1.62.0: Sailplane / SPL / TMG regulatory context and Part-SFCL recency core

## Near term

- observe the simplified everyday workflows in real use before adding further flight-entry helpers or new modes
- observe real-world use of signed aircraft-training records before expanding regulatory automation around them
- observe large career-logbook browser print performance before changing the fixed FCL.050 page renderer
- keep FSTD recency evidence deferred until it becomes a product priority
- retire `instructor_flight_approvals` only after historical backup/restore consumers and old links are fully migrated
- migrate backup/restore away from `track_points` before considering removal of that compatibility table

## Later / research — Automatic Flight Capture

Do not treat this as a near-term implementation until the data-source and background-recording constraints are resolved.

- support historical ADS-B flight discovery by saved aircraft / ICAO 24-bit address plus date, with a provider-neutral integration rather than coupling FlyTally to one vendor
- keep ADS-B as reviewable source evidence only; imported data must pass through the existing flight-review workflow and must never create or certify a logbook entry automatically
- defer paid historical ADS-B providers until their cost and long-term data-retention/licensing terms make sense for FlyTally
- investigate open ADS-B data only if lookup can be made operationally practical without downloading or indexing multi-gigabyte daily archives inside normal Vercel requests
- revisit direct FlyTally GPS recording only when reliable background recording with a locked display is available; a browser/PWA recorder that requires the screen to remain awake is not considered a production-quality solution
- prefer a small native iOS/Android companion recorder if necessary, with offline/local-first recording and sync into the existing `flight_tracks` review pipeline
- preserve track provenance by source and keep externally sourced tracks separate from pilot-owned device GPS evidence

Prerequisites before implementation:
- acceptable historical ADS-B provider cost/licensing or a sustainable open-data backend
- reliable background GPS recording with the phone locked
- one normalized track-source contract feeding the existing conservative GPS inference/review engine

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Compatibility cleanup must never rewrite certified evidence. GPS inference must remain conservative and reviewable; presentation preferences, dashboard analytics, advisory recency evidence and aircraft-flown summaries must never alter certified evidence or regulatory records automatically.
