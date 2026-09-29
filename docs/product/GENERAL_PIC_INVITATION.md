# General PIC invitation across source roles

**Status:** DESIGN / REVIEW GATE  
**Decision owner:** Filip  
**Decision date:** 29 September 2026  
**Repository:** `flytally-logbook`

## Product decision

The post-certification **Invite as PIC** workflow must not be limited to source flights recorded as `SAFETY PILOT`.

Any owner of a certified FlyTally flight, regardless of the source flight role, may explicitly invite an accepted FlyTally Connection to add the same certified event to their own logbook as `PIC`.

Examples include a source flight recorded as `INSTRUCTOR`, `EXAMINER`, `DUAL`, `SPIC`, `PICUS`, `PIC`, `CO-PILOT`, `SAFETY PILOT`, or another canonical stored role.

This is an explicit product expansion after the Safety Pilot ↔ PIC P2 closeout. The completed P2 history remains preserved.

## Important distinction

Two related but different workflows must remain separate.

### 1. Safety Pilot Actual PIC

For a source flight recorded as `SAFETY PILOT`:

- the Actual PIC may be selected before certification from an accepted Connection;
- historical Actual PIC text remains certification-protected in `flights.commander`;
- `flight_connected_crew` keeps the linked account identity separately;
- the dedicated **Invite Actual PIC** action remains available after certification;
- recipient materialization preserves the certified source `commander`.

This remains the evidence-backed Actual PIC workflow completed in P2.

### 2. General Invite as PIC

For every certified source flight:

- **Crew & logbook sharing** may offer `PIC` as a recipient role;
- the source pilot explicitly selects an accepted Connection;
- no pre-certification Actual-PIC link is required;
- the invitation is bound to the exact certified source revision/hash;
- the recipient reviews the invitation before creating their independently owned PIC record;
- invite and materialization both re-check the accepted Connection;
- no invitation is sent automatically.

The source flight's own role/credit is never rewritten because another pilot accepts a PIC copy.

## Source-role contract

`PIC` invitation is valid from **every recognized canonical source flight role**.

This must fail closed for malformed/unknown persisted roles rather than treating an arbitrary string as valid.

The canonical source-role domain is the existing flight-entry role set, not a second hand-maintained list.

The current Safety Pilot-only rule in `validCrewCombination(sourceRole, "PIC")` is therefore superseded for the general invite path.

## UI contract

On a certified flight:

- keep the dedicated **ACTUAL PIC** panel for Safety Pilot flights with a stored connected Actual PIC;
- in **Crew & logbook sharing**, include `PIC` in the role selector for all canonical source roles;
- generic PIC invitations appear in the normal invitation list;
- the dedicated Safety Pilot Actual-PIC participation must not be duplicated visually in the generic list;
- if the generic picker targets the same connected Actual PIC, the existing revision/participant uniqueness must prevent a duplicate participation row.

No new automatic prefill or silent invitation is introduced.

## Server-side authorization

The generic PIC invite must require:

- authenticated source owner;
- owned source flight;
- source flight certified;
- non-empty certification hash;
- recognized canonical source role;
- recipient is not the source owner;
- recipient is an accepted Connection at invite time;
- participant role explicitly equals `PIC`;
- one participation per source revision/recipient under the existing uniqueness contract.

Client-supplied role or recipient values are never trusted without these checks.

## Materialization semantics

All PIC materialization must continue to:

- require exact source revision/hash match;
- require the source still be certified;
- re-check accepted Connection at materialization time;
- create or reuse an independently owned recipient flight;
- use canonical PIC credit/recency semantics;
- never add PIC credit to the source flight.

### Commander snapshot

Commander handling differs by provenance:

- **Safety Pilot linked Actual PIC:** when source role is `SAFETY PILOT` and the PIC recipient matches the persisted `flight_connected_crew` Actual-PIC link, preserve the certification-protected source `commander`.
- **General PIC invitation:** otherwise snapshot the recipient account's current canonical display name into the recipient record's `commander` when materialized.

This prevents an instructor/examiner/other source flight from incorrectly copying an unrelated source commander into the recipient's PIC record.

No name matching is used to establish identity.

## Existing lifecycle

Reuse the existing participation lifecycle:

- pending;
- accepted/materialized;
- declined;
- cancelled;
- superseded.

Correction/new source revision continues to invalidate stale revision-bound pending invitations. Already materialized recipient-owned records remain independent and are never rewritten.

## Schema boundary

No schema migration is currently expected.

The existing `flight_participations` role `PIC`, revision/hash binding, accepted-Connection checks and `flight_connected_crew` Actual-PIC link are sufficient if provenance can be derived safely from:

- source role = `SAFETY PILOT`; and
- invited participant = current linked Actual PIC.

If independent review finds that this inference is ambiguous under correction/lifecycle states, stop and design an additive provenance field instead of using heuristics.

## Verification

Local verification on Filip's PC is the primary development gate for this extension.

Required before merge:

- `npm run typecheck`;
- targeted domain/source tests;
- full `npm test`;
- real PostgreSQL acceptance against a dedicated disposable test DB with integration enabled;
- `npm run build`;
- authenticated browser coverage for at least:
  - source `INSTRUCTOR` → recipient `PIC`;
  - another non-Safety-Pilot source role → recipient `PIC`;
  - Safety Pilot dedicated Actual PIC remains unchanged;
  - revoked Connection fails closed at invite and materialization;
  - duplicate/reinvite/correction lifecycle remains intact;
  - desktop + iPad/mobile layout where UI changes are visible.

GitHub Actions are optional corroborating evidence; local PASS must be reported as local, not CI.

## Do not

- do not make `PIC` invitation depend on source role being Safety Pilot;
- do not remove or weaken the Safety Pilot Actual-PIC evidence link;
- do not infer linked identity from commander/name text;
- do not copy source commander blindly for generic PIC recipients;
- do not auto-send invitations;
- do not modify source credit when a recipient accepts PIC;
- do not add a schema migration unless the provenance distinction cannot be proven safely without one.

## Independent review questions

Before implementation, ask the second AI to review:

1. Is deriving dedicated Actual-PIC provenance from Safety Pilot source role + matching `flight_connected_crew` target safe across correction/reinvite/materialization lifecycle?
2. Is recipient display-name snapshot at materialization the correct commander behavior for generic PIC invitations?
3. Are there any hidden assumptions in duplicate detection or recency that still require Safety Pilot as the source role?
4. Can `validCrewCombination` use the canonical flight-role domain without introducing a circular dependency or a second divergent role list?
5. Does the generic invitation UI need any additional guard to avoid confusing the dedicated Safety Pilot Actual-PIC panel?
