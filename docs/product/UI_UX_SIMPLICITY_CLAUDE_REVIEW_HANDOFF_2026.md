# Claude review handoff — FlyTally UI/UX Simplicity Audit 2026

## Role

Act as an **independent read-only UI/UX architecture reviewer**.

Do not implement code. Do not assume the current design is correct. Do not optimize for visual novelty. The goal is a substantially simpler and more self-explanatory pilot logbook without weakening data integrity.

Return an explicit verdict:

- **APPROVE**
- **APPROVE WITH CHANGES**
- **REJECT / REDESIGN**

Then provide:
1. critical issues;
2. disagreements with the draft findings;
3. recommended information architecture;
4. New Flight field hierarchy;
5. mobile/iPad risks;
6. accessibility risks;
7. hidden data-integrity/product risks;
8. recommended implementation batches;
9. tests/acceptance criteria;
10. questions that require Filip's product decision.

## Product/repository context

Repository: `filipto861/flytally-logbook`

Current canonical product principles:
- correctness > convenience;
- source evidence > assumptions;
- fail closed > plausible defaults;
- certified/finalized history must not be silently rewritten;
- one canonical flight/data model;
- Create/Edit/GPS should share business rules;
- missing evidence is not zero/default;
- responsive cockpit/iPad usability is first-class;
- simplicity and low cognitive load are product goals;
- do not invent automatic prefill behavior merely to save clicks.

The previous visual-consistency audit is complete. This is a **fresh task-flow / cognitive-load audit** prompted by a new user becoming confused by the amount of information presented during flight entry.

## Current evidence

Read:
- `docs/product/UI_UX_SIMPLICITY_AUDIT_2026.md`
- `docs/product/UI_UX_SIMPLICITY_AUDIT_FINDINGS_2026.md`
- current `components/flight-form.tsx`
- `components/flight-purpose-picker.tsx`
- `components/professional-context-fields.tsx`
- `components/flight-expenses-editor.tsx`
- existing source tests around Add Flight and workflow simplicity.

Screenshot evidence is produced from an isolated authenticated Playwright fixture, not production data.

Evidence matrix:
- desktop 1440×1100;
- iPad landscape 1024×768;
- iPad portrait 768×1024;
- mobile 390×844;
- light + dark;
- New Flight blank / aircraft-selected / PIC / DUAL / Safety Pilot / all-disclosures;
- Login / Dashboard / Flights / Connections / Settings.

If screenshots are attached, inspect them directly. If not, use the measured evidence below and explicitly state that the visual review is limited.

### Measured New Flight density

| State | Desktop height | Desktop controls | Helper text | Mobile height | Mobile controls |
| --- | ---: | ---: | ---: | ---: | ---: |
| Blank | 1,974 px | 57 interactive / 25 form | 27 | 2,774 px | 46 / 25 |
| Aircraft selected/PIC | 1,910 px | 71 / 36 | 30 | 2,737 px | 60 / 36 |
| DUAL | 2,334 px | 65 / 31 | 30 | 3,542 px | 54 / 31 |
| Safety Pilot | 2,521 px | 67 / 33 | 31 | 3,817 px | 56 / 33 |
| All disclosures | 2,971 px | 71 / 36 | 30 | 4,671 px | 60 / 36 |

## Current New Flight behavior

The top "Flight essentials" surface contains:
- Date
- Aircraft registration
- Departure / Arrival
- Off-block / On-block
- Takeoff / Landing
- derived BLOCK / AIR
- Role

Then disclosure sections include:
- Flight experience
- Crew & training
- Aircraft & logbook
- optional Professional context
- Costs
- Notes

Then:
- a large "Review before save" summary;
- a separate final readiness state;
- `Save & review`;
- `Save and add another`.

Aircraft selection already applies profile-backed defaults for type/logbook/class/regulatory context/billing.

Current persistence readiness requires:
- Date
- Aircraft
- Role
- Logbook/evidence
- Class/category
- Billing
- contextual Safety Pilot/sailplane/balloon evidence where applicable

Departure, Arrival and all four timeline fields are currently optional under the existing business contract.

## Draft findings to challenge

Current first-pass audit identifies:

- **S01:** user sees too much of the data model before understanding the task;
- **S02:** readiness/review/save state is duplicated;
- **S03:** "Ready to save" can appear with route/timeline blank, creating a semantic mismatch between valid draft and visually complete flight;
- **S04:** profile-backed configuration occupies too much conceptual space;
- **S05:** role-specific screens expose unrelated optional training detail too early;
- **S06:** mobile scroll depth is excessive;
- **S07:** helper-copy density becomes documentation rather than guidance;
- **S08:** essentials are a flat mix of identity/route/time/role decisions;
- **S09:** billing as a universal save gate may be product-semantic rather than logbook-essential;
- **S10:** repeated Add Flight entry points may weaken hierarchy;
- **S11:** the current architecture is reusable; simplify presentation rather than rewrite the model.

Do not accept these automatically. Identify where the evidence does not justify them.

## Draft information architecture to challenge

### A — Log the flight
Dominant surface:
- Date
- Aircraft
- Role
- Route
- Timeline
- compact BLOCK/AIR result

### B — Context that needs attention
Prominent only when applicable:
- Actual PIC
- instructor/supervising PIC
- sailplane launch evidence
- balloon evidence
- missing/ambiguous profile evidence

### C — Logbook details
Compact summary when profile-backed data are valid:
- logbook
- class/category
- operation/engine
- experience/recency evidence

### D — Optional details
Collapsed unless populated/requested:
- training purpose/task
- professional context
- costs/expenses
- notes

### Completion
- one completion signal;
- one dominant primary action;
- avoid a second full inline review if the next stage is already Review.

## Hard constraints

DO NOT recommend:
- silent copying of previous flight/airport/aircraft values unless explicitly user-approved later;
- hiding required evidence in a way that allows invalid persistence;
- turning unknown evidence into zero/default;
- a separate simplified data model;
- aircraft/category-specific parallel FlightForm implementations;
- changing UTC/time/duration semantics as part of presentation cleanup;
- changing certification hash/version semantics without separate review;
- assuming billing can simply be made optional without a product decision;
- changing regulatory/recency logic because the UI looks complicated.

## Questions for Claude

1. Is the first-pass diagnosis correct that **decision density**, not visual inconsistency, is now the main New Flight UX problem?
2. Would you keep this as a single-page progressive form, or use a multi-step/wizard model? Explain correction cost, cockpit/iPad use and edit-flow implications.
3. What should be visible above the fold on desktop/iPad/mobile for a normal PIC flight?
4. How should route/timeline be presented when they are useful core facts but currently not mandatory for persistence?
5. Is it better to hide valid profile-backed Logbook/Class/Billing details behind a compact summary, and what must remain visible for trust?
6. How should DUAL/SPIC/PICUS/Safety Pilot diverge from normal PIC without creating role-specific parallel forms?
7. Should structured Training purpose be a distinct optional disclosure instead of always living in an opened Crew & training section?
8. Is the current full inline "Review before save" redundant given the `Save & review` lifecycle?
9. Which helper text must remain immediately visible, and which can move to contextual help?
10. What is the safest treatment of the Billing requirement from a UX perspective without silently changing the business rule?
11. Which current findings are overreactions to one fresh-user session?
12. What 3–6 implementation batches would minimize blast radius and allow measurable before/after acceptance?
13. What objective usability acceptance should we capture in Playwright/screenshots rather than relying on aesthetic preference?
14. Are there any accessibility or mobile/iPad regressions likely from aggressive progressive disclosure?
15. What would you explicitly **not** change?

## Requested output format

### Verdict
APPROVE / APPROVE WITH CHANGES / REJECT

### Critical corrections
Only issues that should change the proposed direction before coding.

### Recommended New Flight hierarchy
Exact ordering and disclosure behavior.

### Findings review
For S01–S11: accept / modify / reject, with reason.

### Product decisions for Filip
Only genuine product choices; do not turn implementation details into questions.

### Implementation roadmap
Small ordered batches with dependencies and Do/Do Not boundaries.

### Acceptance
Concrete screenshot/browser/source-test criteria.

### Risks / deferred items
Anything that should remain outside this UI workstream.
