# Flight Entry Workflow 3.0 — F5 Primary UX / Copy Simplification

**Status:** DONE / LOCAL VERIFIED · F6 PRODUCTION CLOSEOUT NEXT  
**Baseline:** `main@5281d61fe2e7f38a3425ac0189007b46c68601b2`  
**Scope:** simplify the normal Manual PIC entry presentation after F0–F4 domain convergence.  
**Out of scope:** flight semantics, parser/normalizer rules, certification rules, recency, GPS persistence semantics, RoleCrew authority, aircraft-profile authority, DB/schema/certification changes.

## 1. Goal

F5 implements the frozen canonical acceptance:

- common PIC entry exposes only essential current decisions;
- role-defining fields remain inline when applicable;
- Optional details remain optional;
- Review/certification guidance is not duplicated in New Flight;
- helper copy follows the existing simplicity hierarchy.

The target is not another broad visual redesign. F5 should remove presentation noise that no longer carries a decision, while preserving every evidence-backed state that the pilot still needs to see or change.

## 2. Repository reconstruction

F0–F4 are production verified. The current New Flight Manual path still uses one canonical `FlightForm`; F5 must not fork it.

Current common aeroplane/SEP/PIC default presentation:

1. page header:
   - `LOGBOOK`;
   - `New flight`;
   - explanatory sentence describing Manual/GPS, aircraft/route, profile application and review/certification;
2. entry-source choice:
   - Manual entry;
   - Import GPS track;
3. Manual panel:
   - `Flight details`;
   - secondary Add aircraft action;
4. `Flight essentials`:
   - Date;
   - Registration;
   - Role;
   - Departure / Arrival;
   - Off-block / Takeoff / Landing / On-block;
   - live BLOCK / AIR summary;
5. `Flight experience` disclosure:
   - collapsed for a normal applicable SEP/PIC state;
   - summary already exposes landing/PF evidence, e.g. `1 day landing · PF Yes`;
6. `Additional crew details` disclosure:
   - optional for PIC;
7. `Aircraft context` disclosure:
   - profile/snapshot-backed and normally collapsed;
   - auto-opens on unresolved profile state;
8. `Optional details` disclosure:
   - Training;
   - Night / IFR;
   - Professional;
   - Costs;
   - Notes;
9. one completion/action surface:
   - draft blockers when present;
   - one primary `Save & review`.

The B1–B5 simplicity work already removed the old duplicate Review-before-save card, duplicate Ready-to-save state, initial Save-and-add-another action and much of the previously visible advanced context.

## 3. Frozen hierarchy reused by F5

The existing UI/UX Simplicity contract classifies fields as:

- **Core now** — normally needed for the current logging task;
- **Contextual** — appears when role/category/operation makes it relevant;
- **Derived/profile-backed** — visible as trustworthy summary, not routine editing;
- **Optional detail** — useful but not needed for the normal happy path;
- **Advanced/regulatory** — shown only when applicable or explicitly expanded.

F5 does not redefine these classes.

For common Manual PIC:

| Surface | F5 classification | Direction |
| --- | --- | --- |
| Date | Core now | keep visible |
| Registration | Core now | keep visible |
| Role | Core now / evidence-bearing preset | keep visible |
| Departure / Arrival | Core task data, draft-optional | keep visible |
| UTC timeline | Core task data, draft-optional | keep visible |
| BLOCK / AIR | Derived | keep compact live summary |
| Landing / PF evidence | Evidence-bearing preset | keep collapsed summary visible |
| Additional crew | Optional | collapsed |
| Aircraft context | Derived/profile-backed | collapsed unless unresolved/ambiguous |
| Training / Night / IFR / Professional / Costs / Notes | Optional | collapsed |
| Role-required DUAL / Safety Pilot / SPIC / PICUS identity | Contextual required | inline immediately |

## 4. Discovery findings

### F5-D1 — the common PIC field hierarchy is already mostly correct

After B1–B5 and F2–F4, the normal PIC path no longer exposes profile schema, costs, training, extra crew or movement adjustments by default.

Therefore F5 should **not** perform another structural rewrite of the form.

### F5-D2 — the clearest remaining duplication is page/workspace explanatory copy

The New Flight page header currently explains that the user can log manually or import GPS, select aircraft/route, receive profile defaults and then go to review before certification.

The source-choice control directly underneath already presents Manual vs GPS, and the primary action already says `Save & review`.

This repeats workflow information before the first decision and contributes no additional authority.

### F5-D3 — several helpers are persistent even when no decision is required

Examples in the normal PIC path:

- Registration shows `Manage aircraft` whenever an aircraft is selected.
- Role shows `Aircraft default · change if this flight differed.`.
- BLOCK/AIR shows a full explanatory sentence even when values are already present.

These are valid statements, but they compete with the actual values. F5 should preserve warnings/consequences and trim persistent documentation-like copy.

### F5-D4 — evidence-bearing summaries must remain

Do not remove:

- Role value;
- landing/PF summary;
- BLOCK/AIR values;
- unresolved aircraft-profile state;
- role-specific required identity fields;
- blocker navigation.

These are evidence/current-decision surfaces, not explanatory noise.

### F5-D5 — no new auto-prefill or hidden inference is justified

F5 must reuse current defaults only:

- aircraft/profile default Role;
- normal landing defaults;
- canonical PF preset;
- configured aircraft billing only.

No new last-aircraft, last-airport, role inference, route inference or automatic context application.

## 5. Proposed F5 implementation batches

### F5.0 — characterization + copy inventory

Before runtime edits:

- lock the common Manual PIC visible hierarchy in focused source tests;
- identify copy that is authority/warning versus explanatory duplication;
- preserve DUAL/Safety Pilot/SPIC/PICUS immediate role fields;
- preserve unresolved profile and blocker behavior.

### F5.1 — page/workspace copy reduction

Candidate minimal changes:

- remove or materially shorten the long New Flight header sentence;
- do not repeat Manual/GPS choice in header copy;
- do not repeat review/certification workflow above the form;
- preserve the explicit mode buttons and `Save & review`;
- keep GPS-specific upload/review instruction inside GPS mode, where it is contextual.

No form semantics change.

### F5.2 — normal PIC helper-copy triage

Candidate minimal changes:

- Registration: do not show a routine `Manage aircraft` helper on every valid selected aircraft; keep configuration/error actions when needed;
- Role: replace/remove the persistent default explanation if the selected value itself is sufficient; any retained cue must be concise and non-authoritative;
- BLOCK/AIR: show explanatory helper only when it communicates a category-specific consequence (for example BFCL AIR-time semantics) or unavailable-state instruction; do not repeat `Calculated automatically` once values are present;
- do not remove field-level validation/error copy.

### F5.3 — focused UX closeout

Require before F5 close:

- source/contract tests for the simplified common PIC hierarchy;
- TypeScript;
- targeted browser proof for common Manual PIC and at least one role-required contextual state;
- no horizontal overflow on the focused F5 states;
- no change in submitted fields / normalizer / certification contract;
- ROADMAP / FEATURES / CHANGELOG sync.

The broad full role/source viewport/theme/200% matrix remains F6.

## 6. Do / Do not

### Do

- prefer removal of redundant text over new components;
- keep one primary action;
- keep progressive disclosures;
- keep concise collapsed summaries;
- keep warnings next to the condition that causes them;
- retain current evidence-bearing presets and their visibility.

### Do not

- hide Role for common PIC;
- move role-required identity back into Review;
- require route/times at draft save;
- change UTC or duration semantics;
- change landing/PF defaults;
- change aircraft-context authority;
- change optional billing semantics;
- infer or remember new values automatically;
- remove unresolved/fail-closed states;
- create a second Manual form or role-specific forms.

## 7. Acceptance criteria

F5 is acceptable when:

1. a normal configured PIC entry opens with the smallest coherent set of current flight decisions;
2. persistent copy does not repeat mode choice, Review/certification flow or obvious derived behavior;
3. Role, landing/PF evidence and BLOCK/AIR remain visible;
4. DUAL, Safety Pilot and SPIC/PICUS required identity remains inline immediately;
5. optional and profile-backed detail stays progressively disclosed;
6. unresolved configuration and validation states remain explicit and fail closed;
7. submitted semantic data are unchanged for equivalent user input.

## 8. Verification / migration

- DB/schema migration: N/A expected.
- certification version/hash: unchanged.
- historical data rewrite: none.
- GPS semantic/persistence changes: none expected.
- production deployment belongs to F6 closeout unless a separate defect requires an earlier release.

## 9. Independent review questions

Review should challenge:

1. Is F5 correctly narrow, or is any currently visible common-PIC field actually unnecessary for the primary task?
2. Would removing the routine Registration/Role/BLOCK-AIR helpers reduce trust or discoverability?
3. Is the page-header workflow sentence redundant given the mode chooser and `Save & review`?
4. Are any proposed removals carrying hidden accessibility, compliance or error-recovery value?
5. Does the plan preserve the frozen B1–B5 hierarchy and F0–F4 domain boundaries?
6. Is any proposed simplification likely to create desktop-only gains while harming iPad/mobile?

No runtime implementation should begin until this review is reconciled against the repository and frozen contracts.


## 10. Independent review reconciliation

Independent review returned **APPROVE WITH CHANGES**. The review was reconciled against the current repository before runtime implementation.

### Accepted: Role provenance is retained

Repo verification:
- current Role helper is `Aircraft default · change if this flight differed.`;
- `FlightForm` has no separate role-provenance/touched state;
- Role itself is evidence-bearing and drives inline Role/Crew requirements.

Decision:
- do **not** remove the provenance cue;
- reduce it to **`Aircraft default`**;
- show it only on New Flight, never on Edit/SNAPSHOT;
- do not add a new touched-state solely for copy behavior;
- a pilot-selected role different from the aircraft default has no default cue.

If the pilot later deliberately returns the Role value to the aircraft default, the cue may reappear because F5 deliberately uses the existing value/default comparison rather than inventing a second provenance state.

### Accepted with repo correction: shared-form context

Repo verification:
- `FlightForm` is shared by Manual New and editable Flight Detail;
- GPS New/review uses `KmlImportForm`, not `FlightForm`;
- the current Dashboard has links to `/flights/new`; there is no separate runtime Quick Add form using `FlightForm`.

Therefore candidate copy changes inside `FlightForm` must be gated where Edit semantics differ. F5 does not claim that GPS uses the Manual form.

### Accepted: BLOCK/AIR copy gets explicit conditions

Repo verification:
- `.flight-time-summary` is the live region via `aria-live="polite"`;
- no `aria-describedby` points to the generic helper;
- BFCL authority copy is category-specific;
- Sailplane AIR-time authority is also preserved in the Sailplane experience evidence note.

Decision for **New Flight only**:
- BFCL consequence copy remains unchanged;
- when both BLOCK and AIR are resolved, omit the generic `Calculated automatically...` sentence;
- when either value is unresolved, retain an instruction that the timeline is incomplete;
- Edit keeps its existing helper behavior to avoid changing historical-edit presentation in F5.

The BLOCK/AIR values and live-region semantics remain unchanged.

### Accepted: page header can be reduced

Repo verification:
- the mode chooser immediately below already says Manual entry vs Import GPS track;
- GPS mode retains its own upload/review instruction;
- the completion surface already says `Creates an editable draft for final review.`;
- the primary action is `Save & review`;
- route-level UI consistency tests require the shared page rhythm, not a mandatory descriptive paragraph on New Flight.

Decision:
- remove the long explanatory paragraph from the New Flight page header;
- retain eyebrow + title;
- keep draft/review consequence copy at the action surface.

### Accepted: Registration helper stays

Repo verification:
- the routine valid-profile Registration field currently exposes `Manage aircraft`;
- the collapsed valid Aircraft context card does **not** contain a manage/edit link;
- only unresolved profile state provides the draft-preserving `Open Aircraft` recovery link;
- Add aircraft creates a new aircraft and is not equivalent to managing the selected aircraft.

Decision:
- **retain `Manage aircraft`** in F5;
- do not relocate it or add a new management component.

### Accepted: Date/UTC excluded

F5 will not alter:
- Date copy;
- UTC label;
- time-field labels;
- saved-date/timezone semantics;
- issue #144 behavior.

### Accepted: tests assert invariants, not deleted copy

F5 tests will explicitly lock:
- common Manual New interactive hierarchy;
- retained Role default cue;
- Edit does not show the New-only Role-default cue;
- Registration recovery/manage path remains;
- BLOCK/AIR live region remains;
- no dangling descriptor dependency is introduced;
- role-required identity remains inline;
- GPS continues to use its separate `KmlImportForm`;
- semantic parser/normalizer/certification boundaries remain untouched.

## 11. Final implementation order after review

### F5.0 — characterization
- add source/contract coverage for New vs Edit vs GPS ownership;
- lock the common Manual PIC visible-control hierarchy and retained evidence surfaces;
- lock the retained recovery/a11y boundaries.

### F5.1 — lowest-risk page copy
- remove the redundant New Flight header paragraph only.

### F5.2 — helper triage
1. BLOCK/AIR generic helper on New only;
2. Role helper trim + New-only gate;
3. Registration helper **unchanged**.

### F5.3 — focused verification
- focused source/unit contracts;
- TypeScript;
- browser: common Manual PIC + one role-required contextual state;
- include desktop, iPad and narrow mobile focused states;
- no horizontal overflow;
- no semantic submit/persistence changes.

F6 remains the broad all-role/all-source viewport/theme/200% production closeout.
