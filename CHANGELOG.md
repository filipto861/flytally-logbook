# FlyTally changelog

This is the canonical record of **what actually changed** in `flytally-logbook`.

- `ROADMAP.md` is forward-looking and may contain planned work.
- `FEATURES.md` is the capability inventory.
- This file records merged/product changes and must not describe planned work as completed.
- Historical PR/version labels are preserved even where old release numbering was inconsistent with package metadata.

## Unreleased

### Flight Entry Workflow 3.0 — F1.6a GPS landing / Night / IFR source fidelity
- GPS landing detection is now treated only as a suggestion; each reviewed part requires the pilot to enter the actual Day and Night landing split explicitly.
- Each reviewed GPS part requires explicit Night and IFR duration, including `0:00` when none, so missing evidence is not silently persisted as zero.
- Added server-side validation for explicit counts/duration format and known BLOCK-time bounds.
- GPS persistence stores reviewed Day/Night landings and Night/IFR minutes rather than forcing all landings to day and omitting Night/IFR.
- Extended the GPS candidate adapter so these reviewed facts can later pass through the shared normalizer with `GPS_REVIEW` provenance.
- Regulatory PF/approach, TMG/BFCL take-off split and Sailplane launch evidence remain intentionally unresolved until F1.6b.
- DB schema/migration: N/A.
- Verification: PENDING on `feat/flight-entry-f16a-gps-time-landings`.

### Flight Entry Workflow 3.0 — F1.5 explicit GPS Operation / Engine
- Reordered F1 execution because the shared normalizer correctly treats unresolved Operation/Engine as a blocking semantic state; routing GPS through it before explicit source input would either fail every applicable import or reintroduce guessed defaults.
- Added common GPS **Operation (SP/MP)** and **Engine (SE/ME)** controls for categories where the canonical capability contract exposes those semantics.
- Aircraft/registration changes clear both selections so values cannot leak across aircraft profiles.
- Server-side GPS import now revalidates Operation/Engine and persists the explicit reviewed values rather than silently forcing `SP` and class-derived Engine.
- Non-applicable category branches retain compatibility storage values only and do not present them as regulatory evidence.
- GPS remains PIC-only; shared normalizer routing, sailplane/movement/day-night/Night/IFR convergence remain outside this batch.
- **Verification:** Verify FlyTally web #1024 PASS; TypeScript PASS; full unit/regression **1019/1019**; PostgreSQL acceptance **63/63**; Browser smoke #400 **26 passed / 2 skipped**; production build PASS.
- **DB schema/migration:** N/A.

### Flight Entry Workflow 3.0 — F1.3 Manual persistence proof
- Added source-contract coverage proving Manual create and update remain behind the `parseFlightInput(FormData)` compatibility boundary after F1.2.
- Verified flight semantic columns are persisted from normalized `FlightInput` values rather than re-read independently from FormData.
- Preserved airport canonicalization, rate resolution, duplicate fingerprint/advisory locking and edit lock guards as persistence concerns.
- Preserved expenses as separately validated child rows and connected Actual-PIC account linkage as collaboration metadata outside the pure normalizer.
- Confirmed GPS remains on its specialized path for F1.4.
- Verification: Verify FlyTally web #1013 PASS; TypeScript PASS; full unit/regression **1014/1014**; PostgreSQL acceptance **63/63**; Browser N/A because no runtime/UI behavior changed; DB schema/migration N/A.
- Next: **F1.4 GPS semantic adapter / persistence convergence**.

### Flight Entry Workflow 3.0 — F1.2 pure normalizer
- Extracted `normalizeFlightDraft(candidate)` as the source-agnostic pure semantic normalizer for flight draft data.
- Converted `parseFlightInput(FormData)` into the compatibility wrapper `FormData → manualFlightCandidate() → normalizeFlightDraft()`.
- Kept DB/auth lookup, expenses, connected-crew validation, persistence and GPS track handling outside the pure normalizer.
- Explicit unresolved candidate authority now returns a domain error instead of being coerced into an implicit value.
- Preserved existing Manual semantics across EASA/ULL validation, category mapping, sailplane/BFCL evidence, structured movements, SPIC/PICUS supervision, professional context, purpose/task and role-derived function time.
- GPS import is not routed through shared normalization yet; its persistence behavior remains unchanged in F1.2.
- Verification: Verify FlyTally web #1007 PASS; TypeScript PASS; full unit/regression **1006/1006**; PostgreSQL acceptance **63/63**; Browser smoke #388 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A.
- Earlier #1003/#1006 failures were stale/source-test maintenance and a test syntax error encountered during the refactor, not accepted runtime regressions.
- Next: **F1.3 Manual wrapper regression / persistence proof**.

### Flight Entry Workflow 3.0 — F1.1 candidate/source adapters
- Added a typed `FlightDraftCandidate` characterization layer with explicit unresolved semantic state and compact provenance metadata.
- Added Manual FormData extraction preserving the presence-sensitive fields that current `parseFlightInput()` depends on.
- Added GPS reviewed-part extraction that carries canonical aircraft-profile context when available but does not infer unresolved Operation/Engine, day/night movement, Part-FCL PF/approach, sailplane launch, night or IFR evidence.
- Future explicit common GPS Operation/Engine values are supported by the candidate contract without class-derived defaults.
- The new adapters are not wired into current Manual/GPS mutation runtime yet; persisted flight semantics remain unchanged in F1.1.
- Verification: Verify FlyTally web #998 PASS; TypeScript PASS; full unit/regression **998/998**; PostgreSQL acceptance **63/63**; Browser smoke #379 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A.
- Next: **F1.2 pure normalizer extraction** with `parseFlightInput(FormData)` retained as the compatibility boundary.

### Flight Entry Workflow 3.0 — F1.0 historical aircraft identity preservation
- Added base database migration **v17 — historical flight aircraft identity preservation**.
- Replaced the v6 aircraft-identity trigger behavior without rewriting the already-applied v6 migration.
- Ordinary Manual/GPS-style INSERTs with an empty make/model/variant tuple still snapshot the current matching aircraft profile.
- INSERTs carrying any explicit make/model/variant member now preserve the supplied tuple atomically instead of mixing or overwriting it from mutable current profile state.
- Registration-changing UPDATEs still snapshot identity for the new registration.
- Same-registration UPDATEs no longer refresh historical identity from mutable current profile state.
- Exact backup restore remains compatible with its existing two-stage flow: staged empty identity insert followed by explicit identity restore.
- Added source-contract coverage plus PostgreSQL acceptance for existing certified rows, ordinary inserts, conflicting recipient profiles, partial explicit tuples, same-registration updates, actual registration changes, restore-style second-stage writes and idempotent reapplication.
- **Historical rows:** no existing flight is rewritten or guessed/backfilled by this migration.
- **Certification:** no certification payload/hash/version change.
- **Verification:** final PR head: Verify FlyTally web #997 PASS; TypeScript PASS; full unit/regression **992/992**; PostgreSQL acceptance **76/76**; Browser smoke #378 **26 passed / 2 skipped** across desktop/mobile; production build PASS. Early #987/#989/#371 failures exposed only migration/test-harness defects (PL/pgSQL delimiter, stale v16 fixture extraction, and browser fixture schema drift); each was corrected and the final gates passed.
- **Production:** PR #191 merged as `e7361dbe3e55fbba721ec01c2bffd5c885452c12`; Vercel deployment `dpl_EiEU6pWp95nQuNRGwGVTgtLrgSJn` is READY on `fly-tally.com`. Production Neon records migration v17 `historical flight aircraft identity preservation` applied at 2026-10-01 06:47:01 UTC; the live function/trigger definition was read back and matches the reviewed v17 behavior.

### Flight Entry Workflow 3.0 — F1 design / independent review
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_DESIGN.md` with the proposed source-adapter → typed candidate → pure normalizer → `FlightInput` architecture.
- Kept `parseFlightInput(FormData)` as the proposed compatibility wrapper to minimize Manual blast radius.
- Explicitly kept GPS tracks, expenses, connected crew, certification lifecycle and participation/verifications outside the canonical flight semantic payload.
- Split the proposed implementation into F1.1–F1.6 so Manual regression equivalence is proven before GPS is routed through shared normalization.
- Raised Operation/Engine as a blocking correctness question because current GPS silently stores SP plus class-derived engine, which is not sufficient source evidence for every FCL-style flight.
- Carried the shared-flight identity-trigger issue forward as a migration/integrity design question; no migration has been written.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_REVIEW_HANDOFF.md` for independent read-only review before runtime implementation.
- Independent review returned **APPROVE WITH CHANGES** and was reconciled into the F1 design: F1.0 trigger hotfix first; explicit EASA GPS Operation/Engine before F1 release; unresolved source evidence remains fail-closed; F2 retains Role/Crew ownership.
- **Runtime/schema behavior:** unchanged in this design PR; F1 runtime code has not started.

### Flight Entry Workflow 3.0 — F0 field / consumer contract inventory
- Added the authoritative repository-backed Manual/GPS/Edit/Certification/consumer matrix at `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md`.
- Recorded the current Manual canonical parser boundary versus the remaining GPS direct semantic INSERT path.
- Classified Save requirements separately from Certification requirements, including the existing DUAL UI/server Save-boundary mismatch.
- Recorded certification-hash v1–v8 coverage and explicitly classified non-hashed child/commercial/collaboration data.
- Recorded draft-visible Dashboard/Statistics/Export/Print behavior versus certified-only canonical Recency and certified-source Sharing.
- Recorded GPS parity gaps for sailplane launch evidence, PF movements/approaches, day/night fidelity, night/IFR, professional context, purpose, expenses and non-PIC Role/Crew.
- Identified a cross-workstream historical-identity risk for review: shared-flight INSERT supplies certified source make/model/variant while the v6 flight INSERT trigger can overwrite those fields from recipient current-profile state.
- Recorded CSV/XLS output completeness gaps without changing stored semantics.
- Added source-contract tests to keep the F0 findings explicit before F1 refactors them.
- **Runtime/schema behavior:** unchanged by F0 analysis.
- **Verification:** Verify FlyTally web #982 PASS; TypeScript PASS; full unit/regression **988/988**; PostgreSQL acceptance **55/55**; browser N/A; DB schema/migration N/A. The first #981 attempt exposed only an outdated test assertion for the existing v8 certification hash call and was corrected without runtime changes.

### Flight Entry Workflow 3.0 — F0.1 GPS fail-closed integrity hotfix
- Removed GPS UI/server fallbacks that could silently turn missing aircraft class/logbook context into `ULL`.
- GPS now resolves the selected active aircraft through the same fail-closed aircraft-profile validation used by New Flight defaults; malformed/unavailable context returns **Needs configuration** instead of invented regulatory identity.
- GPS no longer trusts submitted aircraft class/logbook/type as authoritative identity: the active selected aircraft profile is resolved server-side and submitted class/logbook must match that canonical context.
- Interim GPS Role support is intentionally narrowed to **PIC only**; DUAL, Safety Pilot, INSTRUCTOR/legacy `INSTRUKTOR`, Co-pilot, PAX, Observer and crafted unknown roles fail closed until the shared Role/Crew milestone provides complete semantics.
- Removed the visual-review-only hard-coded `ULL` provenance placeholder.
- Preserved existing GPS split/review, duplicate fingerprint, advisory-lock and single-transaction flight/track persistence behavior.
- Added F0.1 domain/source regression coverage plus authenticated browser fixtures for valid EASA/SEP, valid explicit ULL and malformed EASA aircraft context.
- No database schema/migration, certification hash/version, recency rule, historical backfill or broad UI redesign is introduced.
- **Verification status:** PASS on final runtime head before docs closeout — Verify FlyTally web #979: TypeScript PASS, full unit/regression **979/979**, PostgreSQL acceptance **55/55**; Browser smoke #366: production build PASS, authenticated Chromium desktop/mobile **26 passed / 2 skipped**.

### Flight Entry Workflow 3.0 — F0.0 characterization
- Added a characterization-only baseline for the current GPS flight-entry/write path; no runtime behavior changes in this milestone.
- Confirmed UI and server fail-open `ULL` fallbacks, direct GPS flight persistence outside `parseFlightInput()`, empty GPS commander/instructor persistence and draft consumption by Dashboard/Statistics/Export/Print while recency remains certified-only.
- Confirmed the GPS INSTRUCTOR option currently submits non-canonical stored value `INSTRUKTOR`, which receives zero function-time allocation; F0.1 therefore uses **PIC only** as the smallest proven coherent interim GPS role set.
- Added source regression coverage for the current defect/baseline, role mismatch, Manual save-boundary differences, duplicate/advisory-lock transaction behavior and downstream draft-consumer boundary.
- Detailed evidence: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F00_CHARACTERIZATION.md`.
- **Verification status:** DONE — Verify FlyTally web #970 PASS; TypeScript PASS; full unit/regression 971/971 PASS; PostgreSQL acceptance 55/55 PASS. No runtime/schema/deployment change.

### Flight Entry Workflow 3.0 — planning/design freeze
- Added the frozen `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md` contract after Claude Round 1, DeepSeek Round 2 and repository reconciliation.
- Reprioritized the roadmap so the confirmed GPS invalid-profile → `ULL` fail-open defect is addressed before Multi-aircraft M2B.
- Frozen direction: one canonical Manual/GPS semantic normalization boundary; GPS as source/provenance rather than a second flight model; source-agnostic Role/Crew semantics; atomic multi-part persistence; no guessed historical repair.
- Frozen EASA entry behavior: DUAL Instructor/PIC, Safety Pilot Actual PIC and SPIC/PICUS supervision evidence must be immediately reachable and Save-required; certification remains the authority for later certification completeness.
- Recorded the repository-backed consumer boundary: recency is certified-only, while Dashboard/Statistics and Export/Print can consume draft records, increasing the importance of correct evidence/class identity at first Save.
- Defined F0.0 as characterization-only and F0.1 as the minimal GPS fail-closed production hotfix before broader domain/UX convergence.
- This planning change does **not** modify runtime, schema, certification hash/version, recency calculations, GPS persistence or production deployment.

### New Flight intelligent review — form-scope hotfix
- Bound `IntelligentFlightEntryPanel` explicitly to the canonical manual `FlightForm` instead of selecting the first `.flight-form` mounted on the page.
- Prevented manual-entry history/profile advisories from being portaled into the simultaneously mounted GPS import form.
- Deferred intelligent-review FormData resync to the next animation frame after input/change so React-controlled aircraft profile fields are read after their coordinated update rather than from an intermediate DOM state.
- Added source regression coverage plus an authenticated browser reproduction with three recent EASA/SEP records proving a GPS-selected EASA/SEP aircraft does not receive a stale ULL history warning.
- GPS import save/parsing, aircraft profile data, historical flights, certification, recency, billing and persistence semantics are unchanged.

This section tracks changes intended for the next named release. An entry is production-complete only after the corresponding change has been merged to `main`.

### New Flight UI/UX Simplicity — B5 responsive + accessibility closeout
- Delayed ordinary required-field error styling until an explicit save attempt while keeping genuine selected-profile configuration failures immediately visible.
- Converted the existing missing-field summary into focusable blocker navigation that opens the owning native disclosure before focusing its control.
- Preserved native details/summary semantics without redundant ARIA state.
- Restored collapsed evidence summaries on narrow mobile, added earlier iPad/zoom grid reflow and disabled sticky New Flight actions where touch keyboards or very small/short viewports could cause overlap.
- Added coarse-pointer 44px targets and forced-colors treatment for blocker controls.
- Switched the small Flight-experience Change cue to the normal link token; measured canonical New Flight muted/link colors meet WCAG AA normal-text contrast on dark/light panel surfaces.
- Final authenticated screenshot review exposed Flight experience empty-state title/explanation concatenation at 320px/200% reflow; PR #182 fixed it with contextual spacing while preserving the canonical `empty-state` design-system contract.
- No parser, persistence schema, certification payload/hash, recency, collaboration, billing or UTC semantics changed.
- **Verification status:** DONE. PR #179 automated gate PASS; PR #182 Verify FlyTally web #955 PASS and Browser smoke #349 PASS. Final isolated authenticated Browser smoke #352 PASSed with 23 browser tests passed / 3 skipped and produced 132/132 New Flight screenshots (11 states × 6 viewports × light/dark); all 132 matrix records reported 0 px horizontal overflow. Production commit `45a97aacec50e9e7b20d676afd4493c2e896c1fe` is READY on Vercel and aliased to `fly-tally.com`. PostgreSQL schema/migration N/A for the presentation-only closeout.

### New Flight UI/UX Simplicity — B4 optional details + helper-copy triage
- Consolidated Training purpose/Task, Night/IFR, Professional context, Costs/expenses and Notes under one native **Optional details** disclosure.
- Populated Edit records now auto-open Optional details and summarize which optional domains already contain stored/current data.
- Moved Night/IFR duration inputs out of Flight experience while preserving the same form/parser contract and surfacing historical stored values for correction.
- Kept malformed billing fail-closed and auto-opened the containing Optional details disclosure.
- Added embedded Professional context presentation while preserving its existing applicability and hidden-input behavior.
- Removed or compacted repeated aircraft-profile, generic role, cost and Task helper prose while keeping validation, Connection and signed-evidence consequences visible.
- No parser, persistence schema, certification payload/hash, recency, collaboration, billing or UTC semantics changed.
- **Verification status:** merge-ready — TypeScript PASS, reconciled targeted contracts 34/34 PASS, full unit/regression 954/954 PASS, production build PASS on the runtime-equivalent B4 head. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B3 profile + role context
- Aircraft & logbook collapsed summary now exposes actual evidence/logbook, regulatory category, aircraft class and applicable operation/engine context instead of relying on a generic category description.
- Preserved selected-profile origin on new entry while avoiding re-deriving Edit snapshot provenance from mutable current aircraft profiles.
- Invalid or unresolved selected-aircraft context forces the profile disclosure open.
- Replaced **Crew & training** with role-driven **Role details**; DUAL, Safety Pilot, SPIC and PICUS required evidence auto-opens in one contextual area.
- Moved structured Training purpose and Task/exercise into **Optional details** while keeping FlightPurposePicker hidden submission semantics unchanged.
- No parser, persistence schema, certification payload/hash, recency, collaboration, UTC or billing semantics changed.
- **Verification status:** merge-ready — TypeScript PASS and production build PASS; reconciled targeted contracts 22/22 PASS; full unit/regression 946/946 PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B2 essentials + movement evidence
- Reordered the always-visible essentials to Date → Registration → Role, followed by grouped Route and one chronological UTC timeline.
- Kept Departure/Arrival and all time fields optional for draft save; certification remains the authority for route/time completeness.
- Preserved live BLOCK/AIR calculation and the `—` unavailable state without inventing `0:00`.
- Flight experience summary now exposes the actual landing/PF evidence-bearing preset state, with a visible Change cue while keeping detailed movement controls behind the same native disclosure.
- Reduced repeated manual-entry intro copy and made Add aircraft contextual when the pilot already has aircraft.
- Added responsive B2 layout rules for desktop, iPad-width and narrow mobile time grids.
- No parser, persistence schema, certification payload/hash, recency or billing semantics changed.
- **Verification status:** merge-ready — local TypeScript PASS, targeted B2/affected historical contracts 47/47 PASS, full unit/regression 940/940 PASS, production build PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B1B completion semantics
- Removed the duplicated inline **Review before save** card and the second `Ready to save` completion state from New Flight.
- New Flight keeps one form-level blocker/consequence surface and one primary **Save & review** action; Edit keeps **Save changes**.
- Removed initial **Save and add another** and moved **Add another flight** to the successful saved-review handoff.
- Relocated selected-aircraft/profile origin and unsaved-change context instead of discarding unique information from the removed review card.
- Preserved the existing `/flights/<id>?tab=logbook&saved=1` review-first handoff, draft-save semantics, certification blockers and PendingActionButton duplicate-submit protection.
- No schema, certification payload/hash, recency, UTC or optional-cost semantics changed.
- **Verification status:** merge-ready — local TypeScript PASS and production build PASS; reconciled targeted B1B/historical contracts 34/34 PASS; full unit/regression 934/934 PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to the later live cumulative New Flight redesign check and is not reported as PASS.

### New Flight UI/UX Simplicity — B1A optional Costs
- Added an explicit optional billing parser/serializer so blank billing means **Not tracked** instead of silently becoming BLOCK.
- New Flight and GPS import can save otherwise-valid records without aircraft-cost tracking; populated malformed billing still fails closed.
- Aircraft profile defaults now support explicit no-billing configuration while preserving configured BLOCK/AIR + share values.
- Untracked flights do not resolve or snapshot an aircraft hourly rate, and dashboard/list cost aggregates treat them as zero cost contribution instead of implicit BLOCK.
- Aircraft sharing preserves no-billing defaults and rejects/surfaces malformed populated billing rather than silently clearing or repairing it.
- Read-only billing labels distinguish **Not tracked** from malformed persisted billing (**Unavailable**).
- Legacy billing helpers remain compatible for untouched historical callers; certification, recency, UTC and crew-credit contracts are unchanged.
- **Verification status:** merge-ready — TypeScript PASS; targeted B1A 35/35 PASS; stale-contract rerun 55/55 PASS; full unit/regression 928/928 PASS; production build PASS; read-only production DB metadata confirms both billing columns are nullable text with legacy BLOCK defaults and no billing CHECK constraints, so no migration is required. Protected Preview was READY but authenticated smoke is explicitly deferred to a live post-merge check because Preview has no DATABASE_URL; the deferred check is not reported as PASS.


### New Flight UI/UX Simplicity — B0.5 integrity baseline
- Added a fail-closed selected-aircraft profile-default resolver that reuses the canonical M1 validator and rejects defaults when validation would repair or replace the stored evidence/class.
- Valid ULL profiles remain ULL; invalid/missing legacy profile context now surfaces as **Needs configuration** instead of silently falling back to ULL.
- Preserved stored same-aircraft Edit snapshots; changing to another aircraft and back restores the original stored aircraft-dependent snapshot instead of leaving mixed temporary-profile state.
- Added a complete golden EASA SEP PIC `parseFlightInput()` payload baseline plus source coverage proving manual Create and Update continue through the same canonical parser.
- Recorded the approved Role / normal landing / PF preset policy and scenario-specific decision-density baseline for later UX comparison.
- No schema, certification hash/version, recency calculation, connection/PIC materialization or UTC semantics changed.
- **Verification status:** PASS — targeted B0.5/M1/manual-entry/input suite 26/26, full suite 916/916, production build PASS; TypeScript PASS on the runtime-equivalent head and again inside the final production build. PostgreSQL N/A; dedicated browser matrix deferred by design to the presentation batches because B0.5 does not alter the normal validated-aircraft fixture path.


### General PIC invitation across source roles
- Generalized explicit post-certification `PIC` invitation beyond Safety Pilot to every recognized canonical stored source role.
- Added schema migration v16 with invite-time PIC commander provenance (`CERTIFIED_SOURCE_COMMANDER` vs `RECIPIENT_ACCOUNT`) and one-active-PIC-per-source-revision protection.
- Preserved the dedicated Safety Pilot Actual-PIC workflow and certified source commander semantics.
- Added generic PIC sharing through Crew & logbook sharing, with accepted-Connection, exact revision/hash, owner and re-share guards.
- Generic PIC materialization uses recipient account commander semantics and carries the complete certified event data while recalculating recipient role/credit as PIC.
- Added source/unit and PostgreSQL acceptance coverage for provenance, migration constraints, generic INSTRUCTOR→PIC materialization, movement/night/IFR copy, duplicate/reinvite and active-PIC guards.
- **Verification status:** local TypeScript PASS; 909/909 unit/regression PASS; production Next.js build PASS; PostgreSQL full acceptance 66/66 PASS across 24 integration files; authenticated Chromium desktop/mobile 22/22 PASS; migration v16 validated, applied to production Neon after explicit approval, and post-verified.
- PR #169 merged as `a51e8bb13f702c9a04337bff19755ad614ccfcc1`. Vercel production deployment `dpl_9ba1sxfaZ1yyBVPFwcBdF3S9B8W3` reached READY and the canonical public endpoint returned HTTP 200.

### Safety Pilot ↔ PIC lifecycle closeout — SP5
- Added release-level lifecycle coverage for certified-source corrections, pending invitation supersession, cancellation, decline and PIC reinvitation.
- Verified source correction preserves the connected-PIC link and does not rewrite already materialized recipient-owned records.
- Verified PIC reinvite may reopen declined/cancelled requests but cannot reset accepted/materialized participation.
- Kept certification payload/version unchanged and introduced no new schema migration.
- Extended authenticated browser coverage through cancel → reinvite → pending → cancel and revoked-Connection fail-closed behavior.
- Verification: 900/900 unit/regression PASS; PostgreSQL core 48/48 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS; production build PASS.
- Existing migration v15 remains the production-verified prerequisite; SP5 itself has no database migration.
- PR #166 merged; the Safety Pilot ↔ PIC workflow is complete in the repository through SP1–SP5. Production deployment status is tracked separately.

### Safety Pilot ↔ PIC materialization + recency — SP4
- Enabled the dedicated Safety Pilot → PIC participation to materialize an independently owned recipient PIC flight.
- Recipient PIC commander now comes from the certification-protected source `commander`; existing non-PIC materialization behavior is unchanged.
- Added PIC-only acceptance/materialization guards for exact source revision/hash, source Safety Pilot role and a live accepted Connection.
- PIC minutes use the canonical crew-credit path; the source Safety Pilot record remains non-PIC credit.
- Shared-flight PIC preview preserves the certified source commander.
- Added recency proof showing a materialized PIC record behaves like an equivalent ordinary PIC record while the source Safety Pilot contributes no qualifying PIC movements.
- Added PostgreSQL acceptance for independent ownership, duplicate reuse and revoked-Connection fail-closed behavior.
- Verification: 895/895 unit/regression PASS; PostgreSQL core 48/48 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS; production build PASS.

### Safety Pilot ↔ PIC certified invitation — SP3
- Added a dedicated post-certification Actual PIC invitation action for certified Safety Pilot flights.
- The recipient is derived only from persisted connected-PIC metadata; no arbitrary client-supplied PIC participant ID is accepted.
- Invite creation rechecks source ownership, Safety Pilot role, certification hash/revision state and live accepted Connection status.
- Kept PIC excluded from the generic crew-sharing selector and rejected by the generic invite action.
- Added a separate certified Actual PIC panel with pending/cancel/reinvite states and live revoked-Connection fail-closed messaging.
- Kept recipient PIC materialization intentionally blocked for SP4.
- Verification: GitHub Verify FlyTally web PASS; 890/890 unit/regression PASS; PostgreSQL core 47/47 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS.

### Safety Pilot ↔ PIC create/edit identity — SP2
- Added an explicit Safety Pilot Actual PIC choice between manual text and an accepted FlyTally Connection; manual entry remains the default and no name matching is used.
- New Flight loads accepted pilot Connection IDs/names separately from instructor suggestions.
- Connected selections are canonicalized server-side from the selected account's current display name after accepted-Connection revalidation.
- Create/Edit synchronize the flight row, expenses and current connected-PIC metadata atomically; switching to manual entry or away from Safety Pilot removes the link.
- Edit/correction reloads stored connected identity by flight ID, including a fail-closed unavailable state when the Connection is no longer accepted.
- SP2 does not send PIC invitations or create participation rows; certified sharing remains staged for SP3.
- Added SP2 source/regression and browser-contract coverage. Final verification: TypeScript PASS, 885/885 unit/regression PASS with 0 fail / 0 skip, production build PASS, isolated Neon persistence acceptance PASS, and authenticated isolated Vercel Preview acceptance PASS across desktop, mobile and iPad layouts. Preview testing found and fixed a repeated-save controlled-field reset before merge.

### Safety Pilot ↔ PIC foundation — SP1
- Added tracked schema migration v15 for separate `flight_connected_crew` collaboration metadata with owner-bound FK, one-PIC-per-flight uniqueness, self-link rejection and cascade cleanup.
- Extended shared-flight participation role storage/domain normalization to `PIC`, with an explicit fail-closed `SAFETY PILOT → PIC` combination and canonical PIC-minute credit semantics.
- Added connected-PIC persistence helpers that require an editable Safety Pilot source flight and an accepted Connection before a link can be written.
- Kept the staged rollout fail-closed: PIC is excluded from the legacy generic crew selector, rejected by its generic server action, and not materialized until the later dedicated PIC workflow milestone.
- Added unit/source and PostgreSQL contract coverage for migration, constraints, role mapping and write guards.
- Verified SP1 with TypeScript PASS, 875/875 unit/regression PASS, production build PASS, and isolated Neon PostgreSQL acceptance over real migration constraints and fail-closed write guards.
- Deleted the isolated Neon acceptance branch after verification, then applied the exact verified migration v15 to the production Neon branch as the deployment prerequisite after explicit approval; post-migration checks confirmed the new table/constraints and zero collaboration rows.
- No Safety Pilot PIC selection/invitation UI is shipped by SP1; `FEATURES.md` therefore remains PLANNED.

### GPS touch-and-go detection reliability
- Reproduced a real missed rolling touch-and-go caused by an unrelated near-zero-timestamp altitude pair remaining inside a sparse ±10-point discontinuity window.
- Added anonymized regression coverage proving equivalent touchdown geometry must classify the same despite harmless post-climb point-density differences.
- Bounded rolling-T&G altitude-discontinuity checks to the candidate's own nearest +30 m descent/climb evidence span.
- Kept the existing 28–145 km/h rolling-speed and 30 m descent/climb thresholds unchanged.
- Preserved fail-closed rejection when timestamp/altitude corruption occurs inside the qualifying T&G evidence span.
- Left take-off discontinuity behavior and unrelated point-count grouping/dedup logic unchanged.
- GPS-derived landing totals remain advisory and user-reviewed; no DB/schema/certification behavior changed.

### Multi-aircraft Product Scale — M2A
- Changed type-specific helicopter recency to resolve historical type from stored `flights.aircraft_model`, with bounded legacy fallback to stored `flights.aircraft_type`.
- Removed mutable current-aircraft model and registration as silent historical type fallbacks.
- Added fail-closed LIMITED DATA handling when unresolved historical helicopter type evidence could satisfy an otherwise missing type-specific requirement.
- Kept independently proven CURRENT results current; unresolved unrelated flights do not downgrade them.
- Added PostgreSQL and unit/source regressions proving current profile model edits cannot rewrite historical type resolution.
- No flight rows, certification payload versions/hashes, schema or ULL/Annex-I mapping semantics changed.

### Multi-aircraft Product Scale — M1
- Added one canonical server-side aircraft-profile validator for regulatory profile state.
- Routed normal Aircraft Add/Edit and accepted shared-profile imports through the same fail-closed validation contract.
- Rejected explicit class/category mismatches, incomplete EASA identity, invalid/non-applicable BFCL class/group data and malformed explicit Part-FCL credit provenance instead of silently repairing them.
- Added an actionable shared-profile error path when a received profile cannot be imported safely.
- Added full profile-matrix/source regressions and PostgreSQL acceptance proving malformed shared regulatory profiles do not reach persistence.
- Kept exact backup/restore outside interactive profile canonicalization; no schema, certified-flight payload/hash, catalogue-authority or ULL/Annex-I semantics changed.

### Documentation governance
- Consolidated the roadmap into one current planning document.
- Added a canonical `FEATURES.md`.
- Added a documentation index and historical archive under `docs/history/`.
- Moved old version-specific scope/audit notes out of the repository root without deleting their evidence from Git history.

### Design consistency audit — Batch 9
- Added branded root not-found and runtime-error fallbacks using existing FlyTally page/panel/button contracts.
- Kept runtime error presentation non-technical and added retry plus safe root navigation.
- Replaced the bespoke Push onboarding glass surface with the canonical raised-surface tokens while preserving placement and behavior.
- Closed UX-027 without a visual change after confirming the effective login-card cascade was already 11 px with no backdrop blur.

### Design consistency audit — Batch 10
- Standardized sign-in/join email terminology while preserving the more specific Account email label in Settings.
- Replaced decorative Dashboard lead phrasing with operational all-time totals / Statistics guidance.
- No authentication, input behavior, dashboard calculation, regulatory or stored-data semantics changed.

### Design consistency audit — Batch 11
- Added an explicit non-blocking offline connection banner with automatic online/offline event handling.
- Kept the service worker online-only: no navigation/API interception, offline cache or offline logbook mutation was added.
- Added source-contract and real-browser coverage for banner appearance/removal.

## v3.3 design & workflow consistency — merged through 2026-09-20

### Workflow simplification
- Simplified New flight while keeping aircraft and route selection explicit rather than silently prefilled.
- Simplified the Flights workflow and restored an obvious compact Open action.
- Unified aircraft-card layout and added safe aircraft deletion.

### Design-system consistency
- Consolidated shared tokens, geometry, spacing and tabular numeric presentation.
- Improved light-theme text contrast and moved the legacy GPS chart to theme-aware chart tokens.
- Replaced OS-dependent functional glyphs with the shared SVG icon system.
- Converged empty/loading/component states.
- Hardened accessibility, focus and touch-target behavior.
- Clarified required-field and validation presentation.
- Standardized UTC, viewer-timezone and date-only display formatting.
- Normalized protected secondary route rhythm, Share headers and public/legal layout.

### Engineering workflow
- Reduced unnecessary GitHub Actions usage while retaining risk-based verification gates.

The approved design-consistency audit is complete through Batch 11.


## v3.2 — UI consistency & verification foundation — 2026-09-19

### Changed
- Added route-level UI consistency auditing and shared UI-system regression coverage.
- Added real-browser smoke coverage plus authenticated browser and mutation coverage.
- Added transaction-backed authenticated mutation tests for higher-risk write paths.
- Unified aircraft-card presentation and added safe aircraft deletion.
- Reduced unnecessary GitHub Actions usage while retaining risk-based verification gates.

## v3.0 — UX & Product Consolidation — 2026-09-18

### Changed
- Simplified global Logbook navigation around pilot tasks and moved Notifications into the live activity model.
- Simplified Licences & Recency, Aircraft & airports, Print & data and Settings hierarchies.
- Added personal aircraft-profile sharing and cover photos while keeping recipient copies independently owned.
- Added Web Push subscriptions, preference controls and contextual onboarding.
- Clarified the save → review → certify → share workflow.
- Closed the mobile/accessibility acceptance pass for core Logbook workflows.
- Added/refined the public interactive flight viewer and Share presentation.

### Integrity
- UX consolidation did not redefine certified-record, recency, ownership or regulatory evidence semantics.
- A later FCL.060 ULL same-class correction was merged as an explicit regulatory fix rather than hidden inside UX work.

## v2.9 — Commercial & External Validation technical foundation — 2026-09-18

### Added
- Fail-closed commercial-readiness contract and external-validation ledger.
- Versioned commercial legal publication boundary.
- Provider-neutral billing/entitlement technical foundation.
- Signature-assurance and regulatory-validation boundary.
- Brand/public-claims boundary.
- Final commercial release audit and build guard.

### External boundary
- Technical implementation does not equal lawyer, regulator, trademark, payment-provider or other external approval.
- Public commercial release remains dependent on real external evidence and business decisions where required.

## v2.8 — Compliance & Safety Foundation — 2026-09-18

### Added / changed
- Added privacy self-service, retention controls and cross-product erasure coordination.
- Hardened regulator-facing logbook identity and source-of-truth handling.
- Finalized reviewed map-provider/licensing behavior and browser security controls.
- Added compliance regression coverage for legal, sharing, provider and aviation-safety boundaries.

### Integrity
- Authority acceptance is not inferred from internal implementation or tests.
- FCL.050-oriented engineering traceability remains separately documented under `docs/compliance/`.

## v2.7.1 — Recency hotfixes — 2026-09-09

- Fixed the Recency expiry-date SQL type mismatch.
- Fixed Recency light-theme readability.
- No intentional regulatory-rule expansion was bundled into these hotfixes.

## v2.7 — Data Integrity & Recovery 2.0 — 2026-09-08

### Changed
- Made restore review-first with explicit missing/present/protected-conflict preview.
- Added authenticated current-format portable backup integrity while retaining bounded legacy compatibility.
- Preserved certified revisions, signatures, GPS, sharing evidence, audit history, licences, expenses and recency evidence through the canonical recovery path.
- Added tested large-account transaction batching while preserving atomicity/safety limits.

## v2.6 — Professional Pilot Workspace 2.0 — 2026-09-08

- Expanded professional/operator context and professional-experience reporting.
- Preserved recorded-evidence vs regulatory/employment-conclusion boundaries.
- Kept professional context explicit instead of silently inferring CAT/NCC/SPO or employment status.

## v2.5 — Recency & Compliance Workspace — 2026-09-08

- Consolidated licence/rating validity, flying recency and supporting evidence into a planning-oriented workspace.
- Kept CURRENT / ACTION SOON / NOT CURRENT / INCOMPLETE EVIDENCE evidence-driven and explainable.
- Linked recency presentation to supporting flights, training, signatures and credentials without rewriting certified records.

## v2.4 — Flight Entry & Review 2.0 — 2026-09-08

- Kept one canonical Add flight workflow while integrating review findings near their owning fields.
- Added explicit saved-vs-GPS review before applying GPS-derived suggestions to an existing flight.
- Added final logbook-data review before certification/sharing while preserving certification hashes, revisions and regulatory calculations.

## v2.3 — Large Logbook Performance & Scalability — 2026-09-07

- Retained 10k/50k scale gates and added a controlled 100k read-performance benchmark for production hot paths.
- Reduced Dashboard/Statistics/Print hot-path work through leaner projections, set-wise lookup and scoped aggregation.
- Preserved v2.2 workflow semantics and certified-data integrity while improving scale behavior.

## 2.2.0 — Action Center & Shared Flight Workflow — 2026-09-07

### Added
- Added an authoritative Action Center for unresolved flight invitations, instructor verification requests, aircraft-training signatures and incoming pilot connection requests.
- Sidebar and Dashboard now surface Actions only while a real workflow decision is pending; the badge is derived from workflow state rather than unread notification state.

### Changed
- Notifications remain the update/history inbox and no longer act as the global pending-work signal.
- Needs attention remains separate and continues to contain only actionable data-quality findings from the pilot's own logbook.
- Shared-flight and signature requests reuse the existing Review & add, Review & sign and Decline workflows; inline Action Center decisions disappear immediately after completion.

### Integrity
- Pending shared-flight actions require the exact current certified source revision and hash, so stale requests do not create ghost actions.
- Legacy instructor approvals are de-duplicated when the canonical instructor participation exists, while that participation still counts once as the real action.
- Modern `signature_request` notifications now support the same direct Decline path as other shared-flight requests.
- No database schema, certification fingerprint, verification payload, sharing ownership or audit-trail semantics changed.

## 2.1.0 — Dashboard & Statistics consolidation — 2026-09-07

### Changed
- Dashboard is a stable all-time at-a-glance home without historical period controls; period analysis lives in Statistics.
- Historical Dashboard period URLs hand off to the equivalent Statistics scope instead of silently losing the selected period.
- Career snapshot is a dedicated Statistics workspace and no longer lengthens Overview; its all-time nature is explicit and its period selector is hidden.
- Existing Dashboard saved-layout migration/customization remains intact and analytical widgets cannot be re-added to Dashboard.

### Preserved
- v2.0 category-aware logged-time, certification, sharing, print/export and Dashboard Safety Pilot semantics are unchanged.
- No database schema, regulatory calculation or credential workflow changed in this release.

## 2.0.0 — Multi-category Pilot Logbook — 2026-09-07

### Added
- One canonical regulatory-category capability model for Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other records.
- Category-specific evidence and progressive disclosure inside the existing Add/Edit flight workflow rather than separate category-specific entry pages.
- Multi-category Flights presentation, filters, Statistics, Dashboard, Print/Export and pilot-context handling built on the same category contract.

### Regulatory integrity
- Historical TMG remains Part-FCL unless an explicit Sailplane / Part-SFCL snapshot exists; legacy GLIDER and BALLOON records remain conservatively resolvable without rewriting certified history.
- Part-FCL Aeroplane/Helicopter certification keeps the existing FCL.050 gate, while SFCL/BFCL records are no longer evaluated with aeroplane SP/MP, SE/ME or BLOCK-time assumptions.
- Sailplane/Balloon credited time uses AIR semantics where applicable; powered/ULL activity retains BLOCK semantics. Safety Pilot remains dashboard activity only and does not inflate regulatory pilot experience.
- Certification fingerprints, certified revisions, sharing, trash/restore and portable backup preserve category, launch and BFCL evidence.

### Hardening and release gate
- Conservative runtime migrations do not rewrite certified historical category evidence.
- RC acceptance covers historical accounts, certification, sharing, backup/restore and mixed-category PostgreSQL behavior.
- The release gate includes TypeScript, complete regression tests, PostgreSQL acceptance, retained 10k/50k scale evidence, production Next.js build and Vercel production verification.

## 1.62.0 — Sailplane / SPL / TMG support — 2026-09-01

### Added
- Explicit aeroplane/sailplane regulatory context so TMG records are not silently reclassified between Part-FCL and Part-SFCL.
- Non-TMG sailplane launch method/count evidence and explicit SPL TMG day/night take-off evidence.
- SPL recency evaluation for sailplane/TMG privileges, passenger currency, launch-method recency and proficiency-check evidence.
- Portable backup v9 coverage for SPL proficiency-check evidence.

### Integrity
- Flight certification fingerprint v5 protects regulatory category and launch evidence while historical v1-v4 fingerprints remain verifiable.
- Sharing and trash/restore preserve the new regulatory/launch fields.
- Sailplane protected-record presentation is labelled Part-SFCL rather than FCL.050.

### Preserved
- Existing TMG history remains Part-FCL unless SPL context is explicit.
- GPS never invents launch methods.
- SPL TMG take-offs remain separate from Part-FCL FCL.060 PF movement evidence.

## 1.61.0 — Category-aware Flight Entry — 2026-09-01

- Blank New flight remains neutral until an aircraft is selected.
- Aircraft-dependent experience controls adapt to the selected profile category inside the existing Add flight workflow.
- Role remains flight-specific and is never replaced by aircraft selection.
- The category layer is presentation-only; existing regulatory calculations remain authoritative.

## 1.60.1 — Licences Navigation Cleanup — 2026-09-01

- Kept section tabs as the single normal Licences navigation layer.
- Kept status rows compact and read-only while detailed evidence remains in dedicated sections.

## 1.60.0 — Adaptive Pilot Workspace — 2026-09-01

- Added an adaptive Licences Overview that shows only relevant credentials, privileges and documents.
- Separated credential validity from flying recency and kept items needing attention prominent.
- Continued to delegate LAPL(A) recency to the existing authoritative Recency Engine.
- Added presentation-only pilot-category classification as groundwork for additional aircraft/licence categories.

## 1.59.2 — Manual Entry Defaults & Aircraft Profile Integrity — 2026-09-01

- New manual flights no longer preselect the previous aircraft registration.
- Departure no longer inherits the previous arrival or configured home airport.
- Aircraft-dependent logbook/class/billing state remains neutral until the pilot explicitly selects an aircraft.
- Explicit aircraft selection reapplies the complete aircraft-dependent profile state (type, logbook, class, engine derivation, operation mode baseline, billing/share and hourly rate) in one interaction.
- Flight-specific role remains untouched when changing aircraft, preserving the v1.53.1 state-integrity boundary.
- Additional expenses and all v1.59 financial behavior are unchanged.

## 1.59.1 — Database Migration Hotfix — 2026-09-01

- Fixed production startup failure `Unknown database migration 14`.
- Added the v1.59 structured-expense schema to the primary sequential database migration runner.
- No flight, regulatory, certification, expense ownership or currency semantics changed.

## 1.59.0 — Flight Entry Structure & Expenses — 2026-09-01

### Added
- Structured personal flight expenses: Landing fee, Handling, Parking, Fuel or a custom Other item, each with amount and currency.
- Currency-grouped totals with no implicit FX conversion.
- Portable backup v8 and trash/restore coverage for personal expenses.

### Changed
- Reorganized manual entry into Flight essentials, Flight experience, Crew & training, Aircraft & logbook, Costs and Notes.
- Day/night landings, Night/IFR time and EASA PF/movement evidence now live together under Flight experience.
- SPIC/PICUS countersignature evidence now lives with Crew & training.
- Notes are no longer mixed into Costs.

### Privacy & certification boundary
- Additional expenses are owned by the current user and are not copied to shared-flight participants.
- Expenses remain outside the certified flight fingerprint/revision, so financial metadata can be maintained without rewriting regulatory evidence.

### Verification
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V159.md`.

## 1.58.0 — Flight Entry Polish & Smart Defaults — 2026-09-01

### Removed
- Quick Routes from New flight, including the unnecessary recent-route query on that page.

### Changed
- Local flight is now a small contextual `Use DEP for local flight` action below Arrival rather than a separate route-shortcut block.
- Aircraft-profile defaults are explained next to Registration and the initial role, so automatic values are visible rather than surprising.
- Existing required selectors show inline missing-state guidance in addition to the final Review summary.
- Departure and Arrival disable mobile autocorrect/spellcheck for cleaner airport-code entry.

### Preserved
- No new regulatory inference and no change to flight parsing/storage, recency, movements, certification, aircraft identity, GPS evidence, sharing, export or backup semantics.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + production CI/runtime audit.
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V158.md`.

## 1.57.0 — Flight Entry Workflow Simplification — 2026-09-01

### Added
- Recent-route shortcuts in manual New flight using FlyTally's existing route-history query.
- Explicit local-flight shortcut to set arrival equal to the current departure only when the pilot chooses it.
- Live BLOCK/AIR duration feedback directly below the timeline.
- Human-readable missing-field list in the final review card.

### Changed
- Logbook and Cost sections open automatically when they contain a missing or relevant required choice, without auto-closing after completion.
- Manual/GPS source selection is more compact on mobile.
- Entry-progress wording reflects the actual inline review workflow.

### Preserved
- No change to flight parsing/storage semantics, regulatory calculations, EASA movement evidence, certification/revisions, aircraft identity authority, GPS evidence, sharing, print/export or backup/restore.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + post-deploy runtime audit.
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V157.md`.

## 1.56.0 — Mobile Layout Audit & Responsive Hardening
- Added the shared iOS/WebKit native date/time sizing fix and a primary-navigation responsive containment audit.
- Preserved internal scrolling for genuinely wide tables/navigation rather than hiding page overflow.

## 1.55.0 — Flight Entry Layout & Responsive UX
- Paired Date/Registration, Departure/Arrival, Off-block/On-block, Takeoff/Landing and Role/Day landings into an aligned desktop grid with a logical single-column mobile flow.

## 1.54.4 — Aircraft Picker Selection Close Fix
- Prevented a confirmed aircraft catalogue selection from immediately reopening because of the debounced search effect.

## 1.54.3 — Aircraft Type Catalogue & Smart Aircraft Setup
- Added the structured FAA aircraft-type catalogue, searchable Make/Model/ICAO picker and manual fallback while keeping Part-FCL class separately pilot-confirmed.

## 1.53.1 — Aircraft State Integrity
- Prevented mixed or stale aircraft state when changing registration or aircraft type in flight entry.

## 1.53.0 — Guided Everyday Entry
- Made normal manual entry the default and simplified first-aircraft/profile setup through progressive disclosure.

## 1.52.0 — Codebase Review & Cleanup
- Removed the retired Streamlit/Python runtime and obsolete generated artifacts while preserving the validated regulatory core.

## 1.51.x — Regulatory Correctness Core
- Established the tested FCL.060, LAPL/FCL.740.A, legacy movement, eligible automatic ULL-credit and certification-evidence baseline retained by later releases.