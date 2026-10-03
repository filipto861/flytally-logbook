# F5 Independent Review Handoff — Primary UX / Copy Simplification

Please perform a read-only independent review of the proposed F5 design for `filipto861/flytally-logbook`.

## Context

Flight Entry Workflow 3.0 F0–F4 is production verified. Domain convergence, Role/Crew parity, aircraft authority and GPS multi-part inheritance are complete. F5 is intentionally presentation-focused.

Authoritative draft:
`docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F5_PRIMARY_UX_DESIGN.md`

Canonical F5 goal:
> materially reduce decision density for common PIC entry after domain convergence.

Acceptance:
- common PIC exposes only essential current decisions;
- role-defining fields remain inline;
- Optional details stay optional;
- no duplicated Review/certification guidance;
- helper copy follows the frozen hierarchy.

## Current normal Manual PIC surface

Visible:
- Date;
- Registration;
- Role;
- Departure / Arrival;
- Off-block / Takeoff / Landing / On-block;
- BLOCK / AIR.

Collapsed but summarized:
- Flight experience with landing/PF evidence;
- Additional crew details;
- Aircraft context;
- Optional details.

One primary action:
- Save & review.

## Proposed direction

Do not structurally redesign the form again. The B1–B5 hierarchy is already largely correct.

F5 should primarily remove persistent explanatory duplication:
- shorten/remove the long New Flight page-header workflow sentence;
- remove routine `Manage aircraft` helper when the selected profile is valid;
- trim/remove the Role-default helper if the visible Role value is sufficient;
- remove `Calculated automatically...` under BLOCK/AIR when values are already present;
- retain category-specific consequence copy, unresolved warnings, validation errors, blocker navigation and all evidence-bearing summaries.

## Frozen constraints

DO NOT:
- change parser/normalizer/persistence semantics;
- change certification/recency;
- require route/times at draft save;
- hide Role;
- hide DUAL/Safety Pilot/SPIC/PICUS required identity;
- change PF/landing/Role defaults;
- invent last-aircraft/airport or other auto-prefill;
- change aircraft-profile authority;
- change optional billing;
- change GPS save semantics;
- add role-specific forms;
- add DB/schema/certification changes.

## Review questions

1. Is the proposed scope appropriately narrow?
2. Is any current common-PIC visible control unnecessary?
3. Does removing the listed helpers risk hiding authority or evidence?
4. Is the page header genuinely redundant?
5. Are there accessibility/error-recovery reasons to preserve any candidate copy?
6. Would you alter the F5.0–F5.3 milestone order?
7. Identify any regression risk not covered by the frozen constraints.

Return:
- APPROVE / APPROVE WITH CHANGES / REJECT;
- concrete findings ordered by severity;
- recommended acceptance/test changes;
- no implementation.
