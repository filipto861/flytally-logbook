# General PIC invitation across source roles

**Status:** DESIGN REVIEW RECONCILED — 2 PRODUCT DECISIONS OPEN  
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

Generic PIC authorization is **separate** from `validCrewCombination(sourceRole, participantRole)`.

Add a dedicated fail-closed predicate such as `canInviteAsPic(sourceRole)`, derived from the canonical flight-entry role registry/domain rather than a second drifting list.

Unknown/malformed persisted roles are rejected.

The current Safety Pilot-only branch in `validCrewCombination(sourceRole, "PIC")` remains part of the dedicated Actual-PIC credit pairing contract and is not repurposed as the generic sharing authorization rule.

**Open product decision:** define the exact allowed role set. Claude recommends excluding `SOLO`, `PAX`, and `OBSERVER`; source role `PIC` requires an explicit Filip decision because it can produce two independently owned PIC assertions for one event.

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

### Commander provenance

Commander behavior must be selected explicitly at **invite time**, not inferred later from mutable collaboration metadata.

Add an additive nullable participation field, proposed:

`pic_commander_basis = CERTIFIED_SOURCE_COMMANDER | RECIPIENT_ACCOUNT`

Rules:
- dedicated Safety Pilot **Invite Actual PIC** writes `CERTIFIED_SOURCE_COMMANDER`;
- generic **Invite as PIC** writes `RECIPIENT_ACCOUNT`;
- existing legacy PIC participations with NULL are interpreted as `CERTIFIED_SOURCE_COMMANDER` because they can only originate from the completed Safety Pilot path;
- the basis is immutable once that participation row exists;
- a conflicting second invite path returns/reuses the existing row rather than changing provenance.

For `CERTIFIED_SOURCE_COMMANDER`, materialization must additionally re-check that the exact certified source revision is still Safety Pilot and that the recipient still matches the connected Actual-PIC link. Failure is fail-closed; never silently downgrade to recipient-account semantics.

For `RECIPIENT_ACCOUNT`, use the server-canonicalized recipient account display name as the recipient record commander. This is consistent with the current connected Actual-PIC create/edit path, which already canonicalizes `commander` from `users.display_name`.

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

Independent review found inferred provenance unsafe across correction/reinvite/materialization because `flight_connected_crew` is per-flight mutable collaboration metadata while invitations are revision-bound.

**Accepted design change:** add migration v16 with one nullable immutable participation column:

`pic_commander_basis`

Allowed values:
- `CERTIFIED_SOURCE_COMMANDER`
- `RECIPIENT_ACCOUNT`

The CHECK must make the field meaningful only for `participant_role='PIC'`. No backfill. Legacy NULL PIC rows retain Safety Pilot semantics.

A database-level single-active-PIC constraint remains under review because it interacts with the product decision on whether multiple independent PIC assertions are ever allowed. Until that decision is frozen, implementation must not add the index.

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


## Review reconciliation — Claude / 29 September 2026

Claude returned **APPROVE WITH CHANGES**.

Accepted changes:
- explicit invite-time PIC commander provenance via additive v16 participation metadata;
- generic PIC authorization separated from `validCrewCombination`;
- fail-closed declarative role authorization;
- explicit multi-PIC guard;
- re-share/lineage guard;
- generic PIC materialization must not blindly copy source role-specific evidence;
- concurrent dedicated/generic invite to the same recipient must result in one deterministic participation row;
- existing Safety Pilot tests/behavior remain unchanged.

Repository verification after review:
- `flight_connected_crew` upsert is draft-only, but the link is intentionally carried across correction on the same source flight ID and can therefore differ between revisions; inferred provenance is not sufficient.
- current materialization copies source movement fields (`landings_*`, `takeoffs_*`, `approaches_*`, `movement_evidence_recorded`) and time fields including IFR/night; that copy set is unsafe for generic PIC without a narrower contract.
- current recipient flights have no immutable ancestor/origin field on the `flights` row. Existing participation linkage can identify that a flight was materialized, so generic PIC re-sharing from a materialized shared copy should fail closed unless/until lineage is modeled explicitly.
- current generic own-flight form stores `commander` as user-entered text, while connected Actual PIC already canonicalizes from `users.display_name`. Generic PIC materialization therefore needs an explicit server-side commander rule rather than assuming an existing SELF convention.
- participation uniqueness is per source revision + participant, not per PIC role, so multiple different PIC recipients are technically possible unless separately guarded.

### Generic materialization field policy

Accepted fail-closed baseline:
- copy role-agnostic event facts: date, aircraft identity/config snapshot, airports, timestamps, block/air event timing, task/purpose where role-agnostic, and attached track provenance;
- assign canonical PIC credit through the recipient role path;
- do **not** copy source instructor/dual/countersignature evidence;
- do **not** copy source PF/movement/landing/takeoff/approach evidence automatically.

**Open product decision:** whether generic recipient PIC drafts should also start with zero/unknown IFR and night time, or whether those event-time fields are sufficiently role-agnostic to copy. The safer default is zero/unknown until recipient review.

### Re-share guard

Until explicit immutable lineage exists:
- a flight that was itself materialized from a participation may not be used as the source of another generic PIC invitation;
- direct source owner → recipient remains supported;
- this prevents A → B → A / A → B → C PIC copy chains from creating duplicate event credit.

This guard is limited to generic PIC sharing and does not rewrite existing legacy sharing semantics.
