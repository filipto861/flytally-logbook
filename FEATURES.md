# FlyTally Logbook feature list

Last reconciled: **29 September 2026**

This is the canonical capability inventory for `flytally-logbook`.

It answers **what the product has, what is intentionally constrained, and what is planned**. It does not define implementation order; that belongs in `ROADMAP.md`. Completed changes belong in `CHANGELOG.md`.

## Core logbook — IMPLEMENTED

- Multi-user private electronic pilot logbook.
- Canonical Add/Edit flight workflow.
- Flight review before certification/finalization.
- Certified record revisions and integrity evidence.
- Category-aware records for Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other.
- Explicit role, movement, launch and category evidence where applicable.
- Flight list, detail, filtering and search workflows.
- Dashboard all-time snapshot.
- Statistics with period/trend/detail views.
- Career/professional experience presentation.
- Flight notes and user-owned structured expenses.

## Aircraft and airports — IMPLEMENTED

- Personal aircraft profiles.
- Searchable aircraft-type catalogue with manual fallback.
- Explicit aircraft-dependent profile state.
- Optional aircraft cover photos.
- Safe aircraft removal workflow.
- Personal aircraft profile sharing between accepted Connections as recipient-owned copies.
- Canonical fail-closed aircraft-profile validation is shared by normal Add/Edit and shared-profile import.
- Airport reference data used by planning/entry presentation.

## GPS and track workflows — IMPLEMENTED

- KML/GPX/CSV GPS import.
- Saved-vs-GPS review before applying derived suggestions.
- Track playback and aircraft marker presentation.
- Map/profile display without treating GPS as authority for unsupported regulatory evidence.
- Rolling touch-and-go altitude-discontinuity validation is bounded to the candidate's physical descent/minimum/climb evidence span, preventing unrelated sparse-sampling anomalies from suppressing valid advisory detections while preserving conservative in-span rejection.

## Licences, recency and evidence — IMPLEMENTED

- Licences & ratings workspace.
- Recency planning with explicit evidence boundaries.
- Credential/medical/document presentation.
- Aircraft-training / qualification evidence.
- Category-aware regulatory presentation.
- Type-specific helicopter recency resolves historical type from stored flight identity, with LIMITED DATA when relevant historical type evidence is unresolved.
- Evidence-first states rather than silently inferring privileges or authority approval.

## Collaboration — IMPLEMENTED

- Pilot Connections.
- Shared-flight invitation/review workflow.
- Instructor verification/signature workflows.
- Action Center for unresolved workflow decisions.
- Notifications as update/history rather than the authoritative pending-work signal.
- Public flight sharing with revocation and restricted public DTOs.
- Instagram Story / social flight-card workflow.

## Data portability and recovery — IMPLEMENTED

- Print/export workflows.
- Portable account backups.
- Backup validation and restore review.
- Deleted-flight recovery/trash workflow.
- Protection of certified revisions, signatures, GPS/sharing evidence and audit history across supported recovery paths.

## Product UX and accessibility — IMPLEMENTED

- Responsive desktop/tablet/mobile layouts.
- Light and dark themes.
- Shared design tokens, spacing and card geometry.
- Unified functional SVG icon system.
- Loading/pending action feedback.
- Required-field and validation presentation.
- Keyboard/focus/touch-target hardening.
- Reduced-motion and forced-colors fallbacks.
- Shared date/time/date-only presentation contracts.
- Legal/public page styling aligned with the product design system.
- Branded root not-found and runtime-error fallbacks with non-technical recovery actions.
- Push onboarding aligned to the canonical raised-surface design contract.
- Consistent account email terminology across sign-in/join/settings surfaces.
- Operational Dashboard lead copy that directs historical analysis to Statistics.

## Notifications and PWA — IMPLEMENTED WITH INTENTIONAL LIMITS

- Web Push subscriptions and preference controls.
- Contextual push onboarding.
- Compliance/activity/security notification preferences.
- Staged compliance reminder infrastructure.
- PWA/install support.
- Explicit offline connection banner driven by browser connectivity state; it clears automatically when the browser reports online.

Intentional current boundary:
- FlyTally is online-only for logbook loading/saving.
- Offline editing of certified or mutable logbook data is **not** an implemented feature.

## Legal, security and compliance foundations — IMPLEMENTED TECHNICALLY

- Public legal centre and provider disclosures.
- Privacy/self-service boundaries.
- Security headers and public-share indexing/cache safeguards.
- Provider registry and map-attribution/provider controls.
- Regulatory/signature assurance taxonomy.
- External-evidence gates for commercial/regulatory/claims status.

Important boundary:
- these features do not mean FlyTally is approved by EASA, ÚCL, LAA or another authority;
- internal signature mechanisms are not represented as QES unless independently established;
- legal/trademark/payment-provider approvals remain external decisions where applicable.

## Planned

### UI/UX Simplicity & New Flight cognitive-load reduction — IMPLEMENTED

- Screenshot-backed audit of the authenticated product across desktop, iPad landscape, iPad portrait and mobile in light/dark.
- Dedicated New Flight field inventory classifying controls as core-now, contextual, profile-backed, optional or advanced/regulatory.
- Simplification through information hierarchy and progressive disclosure rather than invented defaults or weaker validation.
- One canonical FlightForm/business-rule path remains mandatory.
- Independent review and repository reconciliation are complete; Filip's product decisions are frozen.
- B0.5 hardens selected-aircraft profile defaults so invalid/missing evidence/class cannot be silently presented as ULL.
- Valid Role/landing/PF presets remain allowed, with evidence-bearing preset visibility scheduled in the essentials batch.
- B1A implements Costs as an optional domain contract: blank means **Not tracked**, configured BLOCK/AIR defaults may auto-apply, and malformed populated values fail closed.
- Untracked billing contributes no calculated aircraft cost and does not synthesize a BLOCK basis or rate snapshot; structured expenses remain independent.
- Missing route/times remain draft-save compatible and certification-gated.
- B1B simplifies completion to one blocker/action surface and one primary **Save & review** action; **Add another flight** is offered only after a successful save in the saved review handoff.
- The saved-flight review/certification workspace remains authoritative; New Flight no longer duplicates it with a second inline review card.
- B2 promotes Role beside Date/Aircraft, groups Route and one UTC timeline, and exposes the applied landing/PF evidence in the collapsed Flight experience summary without forcing normal preset reconfirmation.
- Existing movement adjustment remains available through progressive disclosure; draft route/time optionality and certification/recency rules are unchanged.
- B3 exposes the real Aircraft & logbook snapshot context, keeps required DUAL/Safety Pilot/SPIC/PICUS evidence in a role-driven section, and separates Training purpose/Task into Optional details without changing structured purpose parsing.
- B4 consolidates Training/Task, Night/IFR, Professional context, Costs/expenses and Notes under one Optional details disclosure, auto-opens populated Edit data, and trims non-decision helper copy while preserving validation and evidence consequences.
- B5 adds delayed pristine validation styling, focusable blocker navigation, preserved mobile disclosure summaries, 320px/zoom reflow safeguards, touch-keyboard-safe action fallback and measured helper/link contrast without changing flight semantics.
- Final authenticated closeout matrix passed on the isolated browser fixture: 11 New Flight states × 6 required viewports × light/dark = **132 screenshots**, with zero horizontal overflow recorded in every matrix state.
- Screenshot review exposed one presentation defect in the Flight experience empty state at 320px/200% reflow; PR #182 fixed the title/explanation separation while preserving the canonical `empty-state` design-system contract.
- Final production commit `45a97aacec50e9e7b20d676afd4493c2e896c1fe` is deployed READY to `fly-tally.com`; no parser, persistence, certification, recency, collaboration, billing or UTC semantics changed in the closeout fix.
- Detailed audit: `docs/product/UI_UX_SIMPLICITY_AUDIT_2026.md`.
- Frozen implementation contract: `docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`.

### Safety Pilot ↔ PIC shared-flight workflow — IMPLEMENTED

Implemented by SP1–SP5:
- Safety Pilot flight can record the actual PIC by selecting an accepted FlyTally Connection or by entering a name manually.
- Connected PIC identity is preserved independently from displayed name text and reloaded by source flight ID without name matching.
- Manual PIC text never silently creates an account link; switching back to manual removes the current connected-PIC link.
- After certification, the source pilot can explicitly invite only the stored connected Actual PIC; the target is derived server-side and the action fails closed when the Connection is no longer accepted.
- The invited recipient can materialize the exact certified event as an independently owned PIC record; certified source commander evidence is preserved, PIC credit uses the canonical path, and acceptance rechecks the live Connection.
- Materialized PIC recency follows the same evidence path as an equivalent ordinary PIC record; the source Safety Pilot record remains separate and gains no PIC credit.
- Source correction supersedes only pending invitations from the old revision, preserves the current connected-PIC link for the editable correction, and never rewrites an already materialized recipient-owned flight.
- Cancel, decline and reinvite lifecycle is bounded to the existing participation states; accepted/materialized participation is not silently reset.
- The workflow preserves the existing certification payload version and uses the already-deployed additive migration v15; no later schema migration is required.

### General PIC invitation across source roles — IMPLEMENTED

- Any certified source flight in **any recognized canonical stored role** may explicitly invite an accepted FlyTally Connection to create an independently owned `PIC` copy.
- The existing Safety Pilot **Actual PIC** link/panel remains a distinct evidence-backed workflow and is not replaced.
- Generic PIC invitations are revision/hash bound, re-check accepted Connection state at invite and materialization, and never rewrite source credit.
- Generic PIC recipient commander semantics must be participant-correct; source `commander` is preserved only for the linked Safety Pilot Actual-PIC case.
- The accepted PIC copy is fully populated from the certified source event (timing, route, GPS, movement evidence, IFR/night and other event facts), while recipient-owned role/credit fields are recalculated as PIC rather than blindly cloned.
- No automatic invitation and no identity inference from names.
- Migration v16 persists invite-time PIC commander provenance and enforces one active PIC participation per source revision.

### Flight Entry Workflow 3.0 — ACTIVE · F2.2 IMPLEMENTATION

Product target:
- one canonical flight semantic contract for Manual and GPS creation;
- GPS remains source/provenance/suggestion rather than a separate flight model;
- normal PIC entry becomes materially simpler and presents only current decisions;
- role-defining fields appear immediately when Role makes them applicable;
- Review/Certification reviews and certifies; it is not the first place fundamental role identity becomes discoverable.

Frozen behavior:
- invalid/missing aircraft context never silently becomes `ULL`;
- valid explicit ULL remains ULL;
- EASA DUAL exposes Instructor/PIC inline and requires it before Save;
- EASA Safety Pilot exposes Actual PIC inline and requires Manual/accepted-Connection identity before Save;
- EASA SPIC/PICUS expose supervision + countersignature evidence inline and require it before Save;
- route/time completeness can remain draft-incomplete under the existing certification contract;
- optional billing remains **Not tracked** when absent;
- server-side role validation is authoritative;
- GPS Safety Pilot remains fail-closed until full Manual parity exists;
- multi-part GPS uses one common aircraft identity plus deterministic whole-group Role/Crew overrides;
- one invalid multi-part record aborts the whole import;
- historical/certified records are never repaired by guessed crew/profile values.

Current priority:
- F0/F0.1 are DONE: GPS aircraft context fails closed and interim GPS role support remains PIC-only until Role/Crew parity;
- F1 is DONE/production-verified: Manual and GPS PIC drafts converge on the same candidate → pure normalizer → `FlightInput` semantic contract before persistence, while GPS track/provenance and atomic N-part persistence remain specialized;
- explicit GPS Operation/Engine and category-specific source-fidelity evidence are required where applicable; generic GPS movement does not become regulatory evidence;
- **F2 Role/Crew parity has an F2.2 implementation candidate**: DUAL, Safety Pilot, SPIC and PICUS role-defining identity is shown directly in Flight essentials using the shared RoleCrew contract for applicability/required cues; the completion surface points to those inline controls; generic commander/instructor inputs remain available under Additional crew details; persistence, certification v1–v8 and GPS PIC-only behavior are unchanged pending verification.

Detailed contract: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md`.

### Multi-aircraft Product Scale — QUEUED

Existing multi-aircraft profiles remain the foundation. The active scale phase is not a second fleet model.

The source-of-truth contract is recorded in `docs/product/MULTI_AIRCRAFT_SCALE_CONTRACT.md`.

Planned closeout:
- historical helicopter type-specific recency reads stored flight identity before any mutable profile state and fails closed when type evidence is unresolved;
- canonical fail-closed aircraft-profile validation across Add/Edit and shared-profile import is implemented;
- explicit separation of mutable aircraft-profile defaults, dynamic applicability metadata and historical flight snapshots;
- established ordinary ULL→SEP experience behavior and atypical effective-dated override provenance remain explicit and regression-covered;
- no-code onboarding proof across every currently supported regulatory category with manual identity fallback;
- sharing, exact backup/restore and multi-profile selection regression coverage at scale;
- no organization/fleet ownership or new regulatory category implied by this phase.

## Research only

### Professional Logbook Platform

Possible future capabilities include organization/operator accounts, instructor/student workflows, flight-school evidence, fleet-linked training, organizational verification, controlled reports and team permissions.

These are not implementation commitments until promoted in `ROADMAP.md`.

## Explicit non-features / guarded boundaries

- No silent rewrite of certified/finalized history.
- No invented regulatory evidence.
- No automatic claim of licence/rating validity without required evidence.
- No automatic FX conversion unless a future business rule explicitly defines it.
- No unsupported offline editing.
- No authority/legal/trademark/provider approval inferred from code, tests or internal status.
