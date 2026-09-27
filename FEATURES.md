# FlyTally Logbook feature list

Last reconciled: **26 September 2026**

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
- Airport reference data used by planning/entry presentation.

## GPS and track workflows — IMPLEMENTED

- KML/GPX/CSV GPS import.
- Saved-vs-GPS review before applying derived suggestions.
- Track playback and aircraft marker presentation.
- Map/profile display without treating GPS as authority for unsupported regulatory evidence.

## Licences, recency and evidence — IMPLEMENTED

- Licences & ratings workspace.
- Recency planning with explicit evidence boundaries.
- Credential/medical/document presentation.
- Aircraft-training / qualification evidence.
- Category-aware regulatory presentation.
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

## Notifications and PWA — IMPLEMENTED WITH INTENTIONAL LIMITS

- Web Push subscriptions and preference controls.
- Contextual push onboarding.
- Compliance/activity/security notification preferences.
- Staged compliance reminder infrastructure.
- PWA/install support.

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

## Current closeout work — IN PROGRESS

- Root not-found/runtime-error presentation and canonical Push onboarding surface: implemented in PR #147, pending closeout.
- Email terminology consistency.
- Dashboard operational microcopy.
- Explicit online/offline connection banner while retaining online-only mutation policy.

## Planned

### Multi-aircraft Product Scale

- Repeatable no-code onboarding for additional aircraft/configurations.
- Explicit configuration/applicability rather than generic assumptions.
- Preserve a single flight model and existing regulatory/certification boundaries.

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
