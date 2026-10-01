# Independent Review Handoff — Flight Entry Workflow 3.0 / F2 Role-Crew Parity

## Reviewer role

Act as an **independent read-only architecture/data-integrity reviewer**. Challenge the design. Do not treat current UI behavior as authoritative merely because it exists.

Repository: `filipto861/flytally-logbook`  
Baseline: `main@0ebb3d1e46df62046eb460134678435547beebb5`

Primary documents:
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_DESIGN.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F2_ROLE_CREW_DESIGN.md`

Primary runtime:
- `lib/easa-logbook.ts`
- `lib/flight-input.ts`
- `lib/flight-draft-candidate.ts`
- `components/flight-form.tsx`
- `app/(protected)/flights/actions.ts`
- `lib/logbook-print.ts`
- `lib/fcl050-compliance.ts`
- `app/(protected)/flights/certification-actions.ts`
- `app/(protected)/flights/instructor-actions.ts`
- `app/(protected)/flights/shared-actions.ts`

## Current production state

F1 is DONE / production-verified:
- Manual and GPS PIC both normalize through `FlightDraftCandidate → normalizeFlightDraft() → FlightInput`;
- GPS remains PIC-only;
- explicit GPS Operation/Engine + source-fidelity evidence are live;
- F1.0 migration v17 preserves explicit historical aircraft identity;
- certification v1–v8 unchanged.

Production:
- main runtime SHA: `5c2af689c74e209358d22eebf05c3f4120a4224f`
- Vercel: `dpl_8NaCnff1TcP6DRkXSwUKmEq9dHiR` READY
- alias: `fly-tally.com`

## Current role facts

Canonical EASA roles:
PIC, SOLO, CO-PILOT, CRUISE-RELIEF CO-PILOT, DUAL, SPIC, PICUS, FI, INSTRUCTOR, EXAMINER, SAFETY PILOT.

Additional reference roles:
PAX, OBSERVER.

Current auxiliary roles:
SAFETY PILOT, PAX, OBSERVER.

Current PIC-name resolution:
- DUAL → instructor
- SPIC/PICUS → verification_name
- else explicit commander
- else self for PIC/SOLO/FI/INSTRUCTOR/EXAMINER
- otherwise unavailable

Current Save:
- SPIC/PICUS supervisor + reference are server-required.
- Safety Pilot Actual PIC is action-level server-required for EASA and Connection is rechecked.
- DUAL instructor is HTML-required and certification-required but **not server Save-required** in `normalizeFlightDraft()`.

Current UI:
- DUAL, Safety Pilot, SPIC/PICUS required identity lives in "Role details";
- all other roles expose generic optional Commander/PIC + Instructor;
- hidden stale verification fields can survive Role changes.

## Frozen product decisions

- Role meaning is source-agnostic.
- EASA DUAL Instructor/PIC is Save-required.
- EASA Safety Pilot Actual PIC is Save-required.
- EASA SPIC/PICUS supervisor + countersignature reference are Save-required.
- account links are never inferred from names.
- connected account identity is separate metadata from historical display-name snapshot.
- Certification remains the stronger final gate.
- certification v1–v8 unchanged.
- GPS remains PIC-only until a role has complete parity.
- no historical backfill/guessing.

## Proposed F2 architecture

Introduce one pure `roleCrewSpec(role,evidence)` / equivalent contract used by:
- server normalization/validation;
- Manual visibility + required cues;
- GPS role availability;
- tests.

Add pure role-owned-field normalization/sanitization:
- validates frozen Save-required identity;
- strips fields not applicable to target role;
- preserves function allocation behavior.

Keep connected Safety Pilot resolution outside pure normalizer:
- source request contains manual name or connected user id;
- action resolves accepted Connection server-side;
- server display name becomes historical commander text;
- separate `flight_connected_crew` metadata persists;
- pure RoleCrew normalizer sees resolved semantic commander, not untrusted client identity.

## Proposed EASA role policy needing review

Frozen:
- DUAL: instructor required; commander/verifier cleared.
- SPIC/PICUS: verification name + reference required; commander/instructor cleared.
- Safety Pilot: Actual PIC commander required; instructor/verifier cleared.

Proposed, not frozen:
- PIC/SOLO/FI/INSTRUCTOR/EXAMINER: self is PIC; clear commander/instructor/verifier.
- CO-PILOT/CRCP: commander required before Save; clear instructor/verifier.
- PAX/OBSERVER: commander remains Save-optional but Certification-required; clear instructor/verifier.

## Major review risks

### A. Tightening CO-PILOT / CRCP Save semantics
Current certification requires PIC name, but current Save does not. Is moving commander to Save-required correct, or should draft completeness remain weaker?

### B. Self-PIC generic fields
Current UI allows generic Commander/PIC + Instructor for PIC/SOLO/FI/INSTRUCTOR/EXAMINER. Is there any legitimate product/regulatory use that would be lost if canonical target-role persistence clears them?

### C. Legacy editable drafts
Should ordinary same-role Save sanitize irrelevant legacy crew fields, or only explicit Role changes?

### D. DUAL / SPIC connected identities
Current DUAL instructor and SPIC/PICUS supervisor are historical text evidence. Do **not** infer account identity from datalist names. Is text-only sufficient for F2 closeout, leaving explicit account linking separate?

### E. Safety Pilot connection resolver
Review whether DB/account resolution belongs before pure RoleCrew normalization and whether create/update can share one resolver without changing collaboration behavior.

### F. GPS promotion
F4 owns per-part role overrides. Should F2 enable any common GPS RoleCrew roles after parity, or keep GPS PIC-only until F4?

## Requested response structure

1. **Verdict:** APPROVE / APPROVE WITH CHANGES / BLOCK.
2. **Blocking findings.**
3. **Role-by-role matrix corrections.**
4. **Save vs Certification recommendation for CO-PILOT/CRCP and PAX/OBSERVER.**
5. **Self-PIC commander/instructor recommendation.**
6. **Legacy draft sanitization recommendation.**
7. **Safety Pilot connected-identity architecture verdict.**
8. **GPS role-promotion recommendation.**
9. **Missing tests / hidden consumers.**
10. **Recommended F2 milestone order.**
11. **Any reason runtime F2.1 should not start after reconciliation.**

Do not propose:
- inference of account links from names;
- guessed historical repairs;
- certification hash rewrite;
- broad GPS role expansion without full parity;
- a second flight model.
