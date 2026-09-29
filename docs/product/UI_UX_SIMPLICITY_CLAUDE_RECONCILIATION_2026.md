# UI/UX Simplicity Audit 2026 — Claude review reconciliation

**Status:** REVIEW RECONCILED — 3 PRODUCT DECISIONS PENDING  
**Date:** 29 September 2026  
**Repository:** `filipto861/flytally-logbook`

## Review input

Claude returned **APPROVE WITH CHANGES**.

Important limitation: Claude explicitly stated that it did **not** receive `flight-form.tsx`, the audit docs or screenshots and therefore reviewed the handoff/measurements and repository contracts by inference. The recommendations are useful as an independent architecture challenge, but they are not treated as direct visual evidence.

This reconciliation compares the review against:
- current `main` after PR #171;
- the screenshot-backed audit artifact;
- current `components/flight-form.tsx`;
- the current FCL.050 compliance/certification path;
- completed Safety Pilot/PIC work;
- FlyTally project invariants.

## Corrections to stale review assumptions

### Roadmap placement — review concern is already resolved

Claude said the UI/UX work was not on the frozen roadmap.

That was stale relative to the reviewed repository state. PR #171 is already merged to `main` and the canonical roadmap now has:

- **UI/UX Simplicity Audit 2026 — ACTIVE**;
- Multi-aircraft M2B intentionally paused behind it;
- explicit Filip reprioritization dated 29 September 2026.

No further priority decision is required.

### SP2 collision — review concern is obsolete

Claude warned that SP2 would still change the Safety Pilot / Crew section of `flight-form.tsx`.

SP2 is already DONE and merged in PR #163, and the complete Safety Pilot workflow SP1–SP5 is closed. The later General PIC extension is also DONE in PR #169.

There is therefore no pending SP2 implementation to sequence around.

The review's underlying warning remains useful: role-context simplification must preserve the completed connected Actual-PIC, instructor and PIC-sharing contracts and their tests.

## Accepted review corrections

### R1 — S03 becomes the first semantic UX fix

Accepted.

Current New Flight draft save rules and certification rules intentionally differ.

The form's current `missing` gate allows an editable draft without route/times. However the current EASA certification compliance path requires:
- Departure;
- Arrival;
- valid UTC off-block;
- valid UTC on-block;
- positive total flight time;
- plus the other applicable FCL.050 evidence.

Therefore a message such as `Ready to save` can be technically true for the draft while sounding like the record is complete for certification.

Frozen design direction:
- do **not** make route/times newly mandatory at draft-save level;
- distinguish **draft-save readiness** from **certification completeness**;
- do not represent missing route/times as zero;
- Review/certification continues to be the authority for certification blockers.

Exact non-blocking copy remains a Filip product decision below.

### R2 — Use decision metrics, not height/count alone

Accepted with repository correction.

The current Playwright measurement harness already filters to geometrically visible elements, excludes `input[type=hidden]`, and records disclosure state. So the measurements are stronger than Claude assumed.

However visible-control count is still not the same as cognitive decision count because some controls are:
- read-only;
- profile-backed;
- preselected;
- derived;
- informational rather than deliberate choices.

Future acceptance therefore adds:
- visible fields/controls at first paint;
- **deliberate user decisions** required for a normal default-profile PIC entry;
- number of unresolved choices;
- number of open contextual sections;
- screenshot/page-height evidence as a secondary metric.

No arbitrary fixed target such as “exactly three inputs” is frozen before the baseline is classified.

### R3 — Compact profile summary must expose evidence-bearing values

Accepted.

A collapsed/compact profile-backed summary may not merely say `Defaults applied`.

It must expose the meaningful values that affect interpretation, such as:
- logbook/evidence;
- class/category;
- operation / engine where applicable;
- billing outcome while billing remains a save gate.

Any missing, invalid, ambiguous or flight-overridden state must:
- become visible without requiring the user to discover it;
- auto-expand or otherwise surface the relevant controls;
- fail closed under the same canonical validation rules.

### R4 — Keep one-page progressive disclosure; do not introduce a wizard

Accepted.

Reasons now supported by both the review and current architecture:
- one canonical `FlightForm`;
- Create and editable flight detail share it;
- role/category corrections are cheaper in one context;
- iPad whole-flight cross-checking is valuable;
- a wizard would create step-state/validation drift risk.

No wizard is planned.

### R5 — Role-driven context slot

Accepted.

The form should expose immediately only the evidence that the selected role/category makes relevant, for example:
- Safety Pilot Actual PIC;
- DUAL instructor/PIC;
- SPIC/PICUS supervising PIC/FI + countersignature;
- sailplane launch evidence;
- balloon operation/class evidence;
- unresolved profile evidence.

This remains one conditional context area within the canonical form, not role-specific forms.

### R6 — Training purpose becomes optional detail separate from required crew evidence

Accepted as a presentation change.

Structured Training purpose/task must remain stored and available for the existing credit/recency contracts, but it does not need to appear as if mandatory merely because a role context section is open.

Rules:
- collapsed unless populated/requested;
- populated state visible in the summary;
- editing existing populated records must not hide the data.

### R7 — Consolidate completion UI

Accepted.

Current form exposes multiple end-state signals:
- readiness text near the form;
- full `Review before save` summary;
- another readiness state near actions;
- `Save & review`.

Design target:
- one canonical readiness/blocker surface;
- one primary `Save & review` action;
- only the blockers relevant to draft save should block the button;
- certification blockers remain in the Review/certification workflow;
- removing the inline review must not remove unique warnings or evidence.

Implementation must first inventory every value/warning currently carried only by the inline review.

### R8 — Helper text is triaged, not bulk-deleted

Accepted.

Keep immediately visible:
- validation errors/blockers;
- UTC basis;
- format hints that prevent input error;
- evidence/regulatory consequences that materially change credit or sharing.

Compact/move to contextual help:
- label restatements;
- repeated profile-default explanations;
- long explanatory prose that does not change the current decision.

A per-string inventory is required before the helper-copy batch.

### R9 — Billing semantics stay frozen until Filip decides

Accepted.

The current save contract includes billing. This audit may simplify how a valid profile-backed billing state is shown, but may not remove the gate silently.

If billing remains required:
- a valid profile-backed value should normally be summarized;
- unresolved billing remains explicit and blocking.

Whether billing belongs in the universal flight-save contract is a product/business rule decision.

### R10 — S06 is treated as a symptom/acceptance metric

Accepted.

Mobile scroll depth remains important evidence but is not a standalone redesign objective. It should improve as S01/S04/S05/S07 are solved.

No arbitrary maximum page height is frozen.

### R11 — S10 is deferred

Accepted.

Repeated Add Flight entry points are low-severity and not part of the New Flight simplification core. Existing screenshot evidence may be revisited later, but this workstream will not spend an implementation batch on S10 unless task-level evidence shows a real navigation problem.

## Additional repository reconciliation

### Certification behavior resolves the S03 ambiguity

Current EASA certification blocks on missing departure/arrival/off-block/on-block/positive flight time. This means the form can safely present:

- “draft can be saved” semantics during entry;
- “certification still needs…” semantics without changing persistence gates.

The exact wording and whether the soft prompt is shown in the form remain a product choice.

### Claude's fixed “3 deliberate inputs” target is not frozen

The recommendation is useful directionally but is not a safe acceptance criterion yet.

Reasons:
- Date may be defaulted;
- aircraft-profile defaults can change what needs deliberate confirmation;
- Filip previously rejected unrelated “remember the last aircraft/airport” convenience prefills;
- role defaulting is profile-dependent;
- category/role applicability changes the required evidence.

The metric will be measured per scenario rather than forced to one number.

### Sticky action bar is not automatically accepted

A sticky primary action could reduce mobile scroll cost, but it introduces:
- iOS keyboard overlap risk;
- safe-area complexity;
- potential cockpit visual obstruction.

It remains a candidate to test in implementation design, not a frozen requirement.

## Reconciled New Flight hierarchy

### A — Flight
Always visible:
- Date;
- Aircraft;
- Role;
- Departure / Arrival;
- UTC timeline;
- compact BLOCK / AIR result.

The visual hierarchy may subgroup this into identity / where / when / role without creating separate pages.

### B — Required context
Appears only when applicable or unresolved:
- Actual PIC;
- instructor/supervising PIC;
- countersignature evidence;
- sailplane launch evidence;
- balloon evidence;
- unresolved/ambiguous aircraft profile evidence.

This is the highest-priority dynamic section.

### C — Logbook/profile details
Normally compact:
- logbook/evidence;
- class/category;
- operation/engine where applicable;
- billing outcome while billing remains mandatory.

A clear Change/Edit affordance remains. Anything unresolved auto-surfaces.

### D — Optional details
Collapsed unless populated/requested:
- training purpose/task;
- professional context;
- costs/expenses;
- notes.

### E — Completion
One surface:
- draft-save blockers;
- optional non-blocking completeness hint if Filip approves it;
- one primary `Save & review`;
- treatment of `Save and add another` remains a Filip decision.

## Reconciled implementation order

### Batch 0 — DONE / baseline
Already available from PR #171:
- deterministic screenshots;
- viewport/theme matrix;
- first-pass measurements;
- source-backed field inventory/findings;
- independent Claude review.

Before runtime Batch 1, add/confirm:
- golden create/update payload equivalence test;
- decision-count baseline for normal PIC + DUAL + Safety Pilot.

### Batch 1 — Completion semantics and duplicate review
- separate draft-save readiness from certification completeness;
- consolidate duplicate readiness/review surfaces;
- keep exact existing save gates;
- preserve Review/certification blockers.

Dependency: Filip decision on the soft route/time prompt and `Save and add another`.

### Batch 2 — Profile-backed summary
- compact evidence-bearing profile/logbook summary;
- auto-surface unresolved/ambiguous values;
- preserve canonical validation.

Dependency: billing rule remains current unless Filip explicitly changes it.

### Batch 3 — Role/context separation
- create one role/category-driven required-context area;
- separate optional training metadata from required crew identity;
- preserve Safety Pilot/DUAL/SPIC/PICUS contracts.

### Batch 4 — Optional details + helper-copy triage
- training purpose/task;
- professional context;
- costs/expenses;
- notes;
- populated edit-state indicators;
- per-string helper-text review.

### Batch 5 — Essentials hierarchy + responsive polish
- visually subgroup Flight / Where / When / Role as appropriate;
- verify desktop, both iPad orientations and mobile;
- test sticky action treatment only if evidence supports it;
- 320 px reflow, 200% zoom, touch/focus/keyboard/safe-area checks.

No batch may change:
- certification payload/hash/version;
- recency calculations;
- UTC semantics;
- patch semantics;
- profile/source-of-truth semantics;
- connection/PIC materialization rules;
- missing-evidence fail-closed behavior.

## Acceptance additions

For each relevant scenario capture:
- visible controls at first paint;
- deliberate choices required before draft save;
- unresolved decisions;
- open disclosure count;
- page height as secondary evidence;
- one primary action;
- one draft readiness state;
- no duplicate blocker text.

Behavior:
- every current draft-save blocker remains a blocker unless separately approved;
- every certification blocker remains enforced;
- invalid/missing profile evidence becomes visible automatically;
- populated optional details remain discoverable during edit;
- collapsed content is not keyboard-focusable;
- error navigation opens the containing disclosure before focus;
- no mobile horizontal overflow;
- 44 px touch targets;
- 320 px reflow and 200% zoom;
- light/dark + desktop/iPad landscape/iPad portrait/mobile;
- no keyboard obstruction if any sticky action treatment is adopted.

## Pending Filip product decisions

Only three genuine product choices remain before freezing Batch 1/2 behavior:

1. **Billing gate:** keep billing mandatory for every saved flight, or make cost tracking optional?
2. **Missing route/times:** show a non-blocking completeness hint during entry, or leave that entirely to Review/certification?
3. **Save and add another:** keep it as a visible secondary action on New Flight, or move that option until after the first save/review?

All other Claude points are either accepted/reconciled above, already resolved in the repository, or explicitly deferred.
