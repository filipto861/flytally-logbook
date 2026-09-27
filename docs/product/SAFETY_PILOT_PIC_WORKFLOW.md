# Safety Pilot ↔ PIC Shared-Flight Workflow

**Status:** Priority 2 product/architecture contract  
**Last reconciled:** 27 September 2026

This document owns the detailed workflow/data-model contract. `ROADMAP.md` carries only priority and milestone status.

## User story

When the source pilot logs a flight as **SAFETY PILOT**:

- Actual PIC can be selected from an accepted FlyTally Connection; or
- Actual PIC can be entered manually when the pilot is not connected / not on FlyTally.

If a connected PIC was explicitly selected, after source certification the source pilot may explicitly invite that connection to add the same real-world flight to their own logbook as **PIC**.

The recipient gets an independently owned record. The source record remains SAFETY PILOT.

## Confirmed current repository baseline

- `SAFETY PILOT` is an existing flight role.
- The source flight already stores Actual PIC in `flights.commander`.
- `commander` is part of the certification payload/fingerprint, so the historical displayed PIC name is protected with the certified flight.
- Current Actual PIC UI is free text.
- Current new-flight suggestions expose accepted instructors, not all accepted pilot Connections.
- `flight_participations` is the canonical post-certification shared-flight linkage.
- Current shareable crew roles exclude `PIC`.
- participation acceptance rechecks the exact source revision/hash before materializing a recipient-owned flight.

## Frozen lifecycle model

The workflow has three deliberately separate facts:

1. **Historical displayed PIC name**  
   Stored in the existing `flights.commander` field before certification and therefore protected by the source certification fingerprint.

2. **Optional connected PIC identity**  
   Stored as separate collaboration metadata linked to the source flight and selected user. It is **not** inferred from the commander/name text and is **not** added as mutable identity data inside the certified flight row.

3. **Post-certification invitation / participation**  
   Created only after explicit source action and only against the exact certified source revision/hash.

### Persistence decision

Use a separate additive **pre-participation connected-crew linkage** for the selected connected PIC identity.

Do not add a mutable connected-user-id field to the certified `flights` row.

The exact table/schema name can be finalized in implementation design, but the entity must be:

- tenant/owner scoped;
- keyed to the source flight;
- linked to one explicit connected user and intended role;
- mutable/removable while the source flight is still editable;
- non-authoritative for flight credit;
- independent from `flight_participations` until an actual certified invitation exists.

No name matching is permitted.

## Invitation lifecycle

- Selecting a connected PIC does **not** send an invitation automatically.
- Source pilot certifies the flight first.
- Invite action rechecks:
  - source ownership;
  - source certification/revision/hash;
  - linked target identity;
  - accepted Connection state.
- Accept/materialize action rechecks accepted Connection state again because it may have changed after invite.
- Existing participation cancellation/revocation semantics are reused where applicable.
- No new automatic invitation expiry is assumed unless separately approved.
- A source correction/new certified revision supersedes stale revision-bound invitations according to the existing participation integrity model.

## PIC participation semantics

Adding PIC is not merely an enum expansion.

Implementation must explicitly cover:

- `CREW_ROLES` / normalization support for PIC participation;
- `validCrewCombination`: allow only the approved Safety Pilot → PIC source/recipient relationship for this feature unless broader mappings are separately designed;
- `crewRoleCredits`: recipient PIC record receives PIC minutes through the same canonical materialized-flight credit path; source SAFETY PILOT record gains no PIC credit;
- `materializeParticipation`: recipient gets an independently owned flight with role PIC and copied certified facts;
- source revision/hash revalidation;
- duplicate prevention;
- notification wording;
- accepted-Connection revalidation;
- recipient recency behavior must be the normal PIC behavior of the materialized independent flight, not a special hidden recency shortcut.

## Relation to Multi-aircraft M2B

This feature does **not** change the `part_fcl_credit_*` current-aircraft applicability contract and does not depend on M2B's audit of mutable aircraft-profile identity.

However, because the recipient PIC record participates in normal recency calculations, P2 acceptance must prove that the materialized PIC record behaves exactly like an equivalent normal PIC entry and does not create source-record credit.

M2B therefore remains independently scheduled after P2.

## Manual fallback

Manual Actual PIC text remains first-class:

- it is stored in `commander`;
- it can be certified as historical display evidence;
- it does not create any account link;
- it does not permit an invite until a real accepted Connection is explicitly selected.

## Compatibility / migration boundary

A new additive collaboration entity is expected for connected PIC selection.

No rewrite/backfill of existing flights is required.

Existing Safety Pilot records with only free-text commander remain valid.

No certification payload version change is required merely to add the external connected-identity link because `commander` remains the protected source-flight evidence.

Any database migration must be additive, tenant-safe, idempotent and deployed before code that depends on it.

## Acceptance

- Safety Pilot entry offers one simple Actual PIC control with connected-Connection selection plus manual fallback;
- stored commander text remains correct and certification-protected;
- selected connected identity persists separately without name matching;
- no invite is sent before explicit user action after certification;
- invite and accept both fail closed if Connection state or source revision/hash is no longer valid;
- recipient materializes an independent PIC flight;
- recipient PIC minutes/recency follow normal PIC semantics;
- source SAFETY PILOT record remains non-PIC credit;
- manual-only records remain fully usable;
- existing instructor / Safety Pilot / CO-PILOT / EXAMINER / OBSERVER collaboration remains backward compatible;
- PostgreSQL, unit/source and browser coverage verifies ownership, duplicate prevention and lifecycle behavior.
