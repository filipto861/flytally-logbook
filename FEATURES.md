# FlyTally Logbook feature list

Last reconciled: **27 September 2026**

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

### Safety Pilot ↔ PIC shared-flight workflow — PARTIALLY IMPLEMENTED

Implemented by SP1–SP3 in the current delivery:
- Safety Pilot flight can record the actual PIC by selecting an accepted FlyTally Connection or by entering a name manually.
- Connected PIC identity is preserved independently from displayed name text and reloaded by source flight ID without name matching.
- Manual PIC text never silently creates an account link; switching back to manual removes the current connected-PIC link.
- After certification, the source pilot can explicitly invite only the stored connected Actual PIC; the target is derived server-side and the action fails closed when the Connection is no longer accepted.

Still planned in SP4–SP5:
- the invited recipient can materialize the certified event as an independently owned PIC record;
- recipient record remains independently owned/certified and follows normal PIC credit/recency semantics;
- source Safety Pilot record remains independent evidence and does not gain PIC credit;
- correction/revision, duplicate/cancel/decline/reinvite and release-closeout cases remain staged.

### Multi-aircraft Product Scale — PAUSED

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
