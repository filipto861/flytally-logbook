# Safety Pilot ↔ PIC Shared-Flight Workflow

**Status:** Priority 2 implementation — SP1 verified, SP2 next  
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

## Repository discovery — implementation design

The initial product contract has now been checked against the current runtime.

### Current save/edit paths

- `createFlight()` persists `commander` directly on the source flight.
- `updateFlight()` updates the same field while the draft is editable.
- `FlightForm` currently renders Safety Pilot **Actual PIC** as a plain text `commander` input.
- the New flight page loads only accepted Connections classified as instructors for the existing instructor datalist.
- the flight-detail page already loads **all accepted Connections** as `crewOptions` for post-certification sharing.
- GPS import does not need a second PIC-selection implementation: the imported record remains an editable draft and can use the same FlightForm on the flight-detail page before certification.

### Current participation model

`flight_participations` already provides:
- source flight / source owner;
- participant account;
- participant role;
- exact `source_revision` + `source_hash`;
- pending/accepted/declined/superseded/cancelled lifecycle;
- independently materialized `participant_flight_id`;
- one participant per source revision/member.

Current DB role constraint permits:
`CO-PILOT | SAFETY PILOT | INSTRUCTOR | EXAMINER | OBSERVER`.

`PIC` is not yet permitted.

Current materialization:
- rechecks certified source revision/hash;
- creates an independently owned recipient flight;
- derives credit through `crewRoleCredits()`;
- does **not** currently recheck accepted Connection state at acceptance/materialization;
- currently derives recipient `commander` from live account display names and does not select `f.commander` at all.

Current role/UI control flow also has two important implementation traps:
- `validCrewCombination()` falls through to a generic `return true` for roles without an explicit branch;
- the certified-flight generic crew-role dropdown is built directly from `CREW_ROLES`.

### Certification/correction behavior

`commander` is inside the certification payload and therefore remains the historical displayed Actual PIC evidence.

Opening a certified correction:
- archives the certified revision;
- increments the same flight row's revision;
- clears current certification;
- supersedes pending participation requests from the old revision.

Therefore a separate current connected-PIC link can remain attached to the same source flight ID across revisions, provided normal draft edits keep it synchronized with the current role/Actual PIC selection.


## Independent implementation-design review — reconciled

The required second-AI read-only review was completed against canonical main `e0e28b9` and then checked again against the repository before this design was frozen.

Verdict: **APPROVE WITH CHANGES**.

The data model and lifecycle were accepted. Three code-path findings are now mandatory acceptance criteria rather than implicit assumptions:

1. **PIC must get an explicit combination rule.**  
   Adding `PIC` to `CREW_ROLES` is not sufficient because `validCrewCombination()` currently has a permissive fallback. SP1 must add an explicit `participant==='PIC'` branch that returns true **only** when the source role is `SAFETY PILOT`. Unit coverage must prove `PIC→PIC`, `CO-PILOT→PIC` and other unintended mappings fail closed.

2. **PIC must never leak into the generic crew-role selector.**  
   The existing certified-flight selector is derived directly from `CREW_ROLES`. Once `PIC` exists, that generic selector must unconditionally exclude it. The dedicated PIC invite must derive the target from `flight_connected_crew` server-side and must not accept an arbitrary client-supplied `participant_id`.

3. **PIC materialization must deliberately read certified `flights.commander`.**  
   Existing materialization currently uses live account display names and does not select `f.commander`. SP4 must add `f.commander` to the source SELECT and use it only for `participantRole==='PIC'`. Existing non-PIC materialization behavior is preserved in this feature to minimize blast radius.

Additional reconciled decisions:

- migration v15 belongs in the tracked `db-optimization.ts` / `migration-plan.ts` sequence that currently ends at v14;
- New Flight needs a separate all-accepted-Connections query returning both user ID and display name for the connected-PIC control; the instructor-only name query is not reused;
- read-time revoked Connection state is **live UI authorization state**, not persisted evidence: keep the `flight_connected_crew` row, do not mutate on GET, but do not render an enabled PIC invite while the Connection is no longer accepted;
- acceptance-time Connection revalidation is scoped to **PIC participation only** in P2. The same gap for older participation roles is real but deferred as separate follow-up work rather than broadening this feature;
- no certification payload version bump is required because `commander` is already certified evidence and the connected identity remains external collaboration metadata;
- no historical backfill is required.

With these changes recorded, the design/review gate is closed and SP1 may begin.

## Frozen implementation design

### 1. Additive pre-participation entity

Introduce a new additive table:

`flight_connected_crew`

Proposed logical fields:

- `id` — BIGSERIAL primary key;
- `source_flight_id` — FK to `flights(id)`, ON DELETE CASCADE;
- `source_user_id` — FK to `users(id)`;
- `connected_user_id` — FK to `users(id)`;
- `intended_role` — currently constrained to `PIC`;
- `created_at`, `updated_at`;
- CHECK source user != connected user;
- UNIQUE(`source_flight_id`, `intended_role`).

This table is **collaboration metadata**, not flight evidence and not flight credit.

Server code must always verify that:
- the source flight belongs to `source_user_id`;
- the linked user is an accepted Connection at the time the link is created/changed;
- the source flight is still editable;
- `intended_role='PIC'` is only retained while source `role='SAFETY PILOT'`.

No historical backfill is required.

### 2. Canonical Safety Pilot form behavior

For `role='SAFETY PILOT'`, FlightForm exposes one clear Actual PIC mode:

**Connected pilot**
- choose from all accepted pilot Connections;
- selected account ID is submitted separately;
- the displayed `commander` value is derived from the selected user's current FlyTally display name on the server;
- the user cannot silently change the name while retaining a different connected identity.

**Manual entry**
- no connected user ID;
- user enters `commander` text directly;
- no account link or later invitation is implied.

Switching away from Safety Pilot removes the connected-PIC link on save.

Existing DUAL/instructor selection remains separate and unchanged.

### 3. Server-side create/update contract

Create and update must not trust a client-supplied connected user ID blindly.

Before persistence:
1. parse the normal flight record;
2. if role is Safety Pilot and a connected PIC ID was supplied:
   - prove the selected user is an accepted Connection;
   - load the target display name;
   - use that display name as canonical `commander`;
   - persist/update the separate `flight_connected_crew` link;
3. if manual PIC or non-Safety-Pilot role:
   - persist the normal commander text;
   - ensure any existing PIC link is deleted.

The flight row and connected-crew metadata update must be transactional.

### 4. Migration

Use the next additive database migration (currently expected as migration **v15**) to:

- create `flight_connected_crew`;
- add tenant/query indexes required by source flight and connected user;
- extend the `flight_participations.participant_role` CHECK to include `PIC`.

No existing rows are rewritten.

Migration must be idempotent and verified in PostgreSQL before application code depending on it is released.

### 5. PIC invitation is dedicated, not generic

Do not make PIC appear as an unrestricted option in the generic crew-role dropdown. The existing `availableRoles` filter must explicitly exclude `PIC` regardless of source role.

For a certified source record where:
- source role = `SAFETY PILOT`;
- a `flight_connected_crew` PIC link exists;
- linked user is still an accepted Connection;

show a dedicated action such as:

**Invite <pilot> as PIC**

The invite action must:
- accept the linked user from server-side stored metadata, not an arbitrary submitted target;
- recheck source ownership;
- require a certified source revision/hash;
- recheck accepted Connection state;
- require source role = Safety Pilot;
- insert/update a revision-bound `flight_participations` record with participant role `PIC`.

Manual-only Actual PIC records display normally but have no PIC invite action.

### 6. Acceptance/materialization

PIC participation must be supported explicitly:

- add `PIC` to participation-role normalization/DB constraint;
- `validCrewCombination('SAFETY PILOT','PIC')` = true through an explicit PIC branch before the current generic fallback;
- `validCrewCombination('PIC','PIC')`, `validCrewCombination('CO-PILOT','PIC')` and every other source→PIC mapping remain false unless a later feature explicitly adds one;
- `crewRoleCredits('PIC', minutes)` assigns PIC minutes;
- source Safety Pilot credit remains unchanged;
- materialized recipient role is `PIC`;
- recipient commander comes from the **certification-protected source `commander`** value;
- `materializeParticipation` must select `f.commander` and use an explicit `participantRole==='PIC'` commander branch; existing non-PIC live-name behavior is not generalized in P2;
- all other certified source facts continue through the existing materialization path.

Before materialization/acceptance of a PIC participation:
- source revision/hash must still match;
- participant must still be an accepted Connection to the source owner.

This acceptance-time Connection recheck is intentionally PIC-only in P2. Existing non-PIC participation behavior is not changed by this feature; broader revalidation is tracked separately rather than generalized without a dedicated review.

### 7. Correction/revision lifecycle

Because the connected-PIC link is current collaboration metadata on the same source flight ID:

- opening a correction leaves the current link available for the editable new revision;
- old pending participation requests remain superseded by the existing revision workflow;
- editing the corrected draft may change/remove the linked PIC;
- a new invite can only be created after the new revision is certified;
- already materialized recipient-owned historical flights remain independent and are never rewritten.

### 8. UI surfaces

Required surfaces:

- New flight: a separate query returns `id + display_name` for all accepted Connections for Safety Pilot Actual PIC selection; do not reuse the existing instructor-only, name-only query.
- Flight detail editable Logbook data: show current connected selection or manual mode.
- GPS-imported editable draft: uses the same detail FlightForm before certification; no duplicate GPS-specific PIC model.
- Certified flight overview: dedicated PIC invitation state/action when applicable.
- Shared-flight review: PIC role renders through the existing Review → Add → Certify workflow.

## Implementation milestones

### SP1 — schema + pure domain contract

- migration v15 in the existing tracked `db-optimization.ts` / `migration-plan.ts` sequence;
- `flight_connected_crew` persistence helpers;
- add `PIC` to participation normalization/DB constraint;
- add an explicit fail-closed PIC branch in `validCrewCombination()` before the generic fallback;
- add PIC credit in `crewRoleCredits()`;
- unit tests for valid and invalid source→PIC combinations;
- PostgreSQL contract tests for table CHECK/UNIQUE/FK/cascade semantics.

**Implementation state:** verified on `feat/safety-pilot-pic-sp1`; ready to merge before SP2 begins.

Staged-deployment safety is explicit:
- the existing generic crew selector excludes `PIC`;
- the existing generic `inviteCrewMember` action rejects `PIC` server-side even if a client crafts the form;
- existing `materializeParticipation` fails closed for `PIC` until SP4 adds the certified-`commander`, Connection-recheck and recency semantics;
- therefore migration/domain support can land without exposing a partial PIC-sharing workflow.

No connected/manual PIC UI is introduced in SP1.

**SP1 verification closeout — 27 September 2026**
- TypeScript: PASS.
- Full unit/regression suite: 875/875 PASS on the current SP1 head.
- Production Next.js build: PASS.
- Migration v15 and connected-PIC schema/write contracts passed on an isolated Neon child branch.
- Verified owner-bound composite FK, PIC-only role, self-link rejection, one PIC link per flight/role, source-flight cascade, and PIC participation-role storage.
- Verified accepted-Connection, editable Safety Pilot, lock/certification, wrong-owner delete, and unconnected-target fail-closed behavior.
- The isolated Neon acceptance branch was deleted after verification. After explicit product-owner approval, the exact verified migration v15 was then applied successfully to the production Neon branch as the deployment prerequisite. Post-migration verification confirmed `flight_connected_crew`, the owner-bound FK, PIC participation-role support, and zero rows in the new collaboration table.

### SP2 — flight create/edit persistence

- load all accepted Connections with `id + display_name` on New flight using a separate query;
- FlightForm connected/manual Actual PIC control;
- create/update transactional link lifecycle;
- edit/correction state reload;
- source tests + browser form coverage.

### SP3 — certified PIC invitation

- unconditionally exclude `PIC` from the existing generic `availableRoles` selector;
- dedicated server-side linked-PIC invite action that derives the target from stored metadata and accepts no arbitrary client participant ID;
- certified-flight PIC invitation UI gated by live accepted-Connection state without mutating the link on read;
- accepted-Connection + source role + revision/hash checks;
- notification/review wording.

### SP4 — PIC materialization + recency proof

- recipient PIC materialization;
- add `f.commander` to the materialization source SELECT;
- use certified source `commander` specifically for PIC recipients while preserving existing non-PIC commander behavior;
- PIC credit through canonical credit path;
- accepted Connection recheck at materialization;
- prove recipient recency behaves like an equivalent ordinary PIC record;
- prove source Safety Pilot receives no PIC credit.

### SP5 — release closeout

- correction/revision lifecycle;
- duplicate/cancel/decline/reinvite cases;
- PostgreSQL acceptance;
- complete regression suite;
- build + Chromium desktop/mobile;
- migration/deploy verification;
- ROADMAP / FEATURES / CHANGELOG closeout.

## Review gate status

The required independent read-only architecture/data-model review is complete and reconciled above. No unresolved design blocker remains before SP1.

Implementation must preserve the reconciled findings as acceptance criteria; in particular, adding `PIC` to a shared enum must not make it reachable through the permissive combination fallback or the generic arbitrary-recipient crew invite UI.

