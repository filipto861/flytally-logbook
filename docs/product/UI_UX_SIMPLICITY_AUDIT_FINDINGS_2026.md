# UI/UX Simplicity Audit 2026 — First-pass findings

**Status:** EVIDENCE COLLECTED / DESIGN DRAFT — CLAUDE REVIEW REQUIRED  
**Evidence date:** 29 September 2026  
**Runtime basis:** isolated authenticated browser fixture, not production user data  
**Screenshot artifact:** GitHub Actions Browser smoke run #279, artifact `flytally-browser-smoke-cf775c55b6ac44f4a00081d723f56df97d21536e`

## Executive finding

The new-user feedback is supported by the current UI evidence.

FlyTally's main problem is no longer primarily visual inconsistency. The stronger problem is **decision density**: the New Flight workflow exposes the user to a large logbook data model, many explanations and several competing completion/review signals during what should feel like one simple task.

The existing implementation already has good foundations — aircraft-profile defaults, contextual sections, calculated BLOCK/AIR, fail-closed validation and disclosure controls — but those foundations are not yet producing a sufficiently simple mental model.

The redesign should therefore **simplify presentation and sequencing without creating a second data model or weakening evidence rules**.

## Evidence set

The deterministic audit capture contains 88 screenshots:

- 4 viewports: desktop 1440×1100, iPad landscape 1024×768, iPad portrait 768×1024, mobile 390×844;
- light + dark;
- Login, Dashboard, Flights, Connections and Settings;
- New Flight in blank, aircraft-selected, PIC, DUAL, Safety Pilot and all-disclosures states.

### New Flight measured density

| State | Desktop full-page height | Desktop visible controls | Desktop helper text | Mobile full-page height | Mobile visible controls | Mobile helper text |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Blank | 1,974 px | 57 interactive / 25 form | 27 | 2,774 px | 46 / 25 | 20 |
| Aircraft selected / PIC | 1,910 px | 71 / 36 | 30 | 2,737 px | 60 / 36 | 22 |
| DUAL | 2,334 px | 65 / 31 | 30 | 3,542 px | 54 / 31 | 22 |
| Safety Pilot | 2,521 px | 67 / 33 | 31 | 3,817 px | 56 / 33 | 23 |
| All disclosures | 2,971 px | 71 / 36 | 30 | 4,671 px | 60 / 36 | 22 |

These counts are not a usability score by themselves. They are used together with the screenshots and source behavior to identify where too many decisions compete for attention.

For comparison, the authenticated Connections screen is about 1,100 px on desktop / 1,274 px mobile and presents one dominant task. It is a useful internal example of a simpler FlyTally mental model.

## Priority findings

### UX-S01 — Major — The user sees the data model before they understand the task

Evidence:
- `new-flight-blank__desktop__light.jpg`
- `new-flight-blank__mobile__light.jpg`
- 25 visible form controls in the blank-state DOM and 27 helper-text elements on desktop.
- Even before aircraft selection, the user sees Date, Registration, Departure, Arrival, four timeline fields, BLOCK/AIR output, Role, Flight experience, Crew & training, Aircraft & logbook, Costs, Notes and an inline review.

The current form says "Enter the flight itself first", but the visual hierarchy still exposes most of the surrounding logbook model at the same time.

Direction:
- keep one canonical form and payload;
- present a short **flight task** first;
- subordinate profile/configuration/regulatory detail until it is applicable or needs attention;
- do not turn the form into a generic settings page.

### UX-S02 — Major — Completion/review signals are duplicated

Evidence:
- `new-flight-aircraft-selected__desktop__light.jpg`
- `new-flight-aircraft-selected__mobile__light.jpg`
- source contains a full `Review before save` card followed immediately by a separate `entry-save-state` and the `Save & review` action.

The user can see:
1. a readiness / "items left" strip after the essential fields;
2. a large "Review before save" block near the bottom;
3. another "Ready to save / X items left" state beside the final buttons;
4. a button whose destination is itself "Save & review".

This creates competing end states.

Direction:
- one canonical completion indicator;
- one obvious primary action;
- because the workflow already has a review stage, the entry form should not reproduce a second full review stage unless it provides unique safety value.

### UX-S03 — Major — "Ready to save" does not match the visual idea of a complete flight

Source evidence:
- the current `missing` gate requires date, aircraft, role, logbook, class, billing and contextual category/role evidence;
- Departure, Arrival and all four timeline fields are not in that gate.

Screenshot evidence:
- `new-flight-aircraft-selected__desktop__light.jpg` can display **Ready to save** while route and times are blank.

This may be valid under current business rules for incomplete/historical records, so the audit does **not** assume route/times should become mandatory. The UX problem is semantic: "Ready to save" reads as "this flight is complete" while visually important flight facts remain empty.

Direction:
- distinguish **valid draft** from **complete flight entry**;
- do not tighten persistence rules as a UI-only change;
- consider copy such as "Required fields complete" or a clearer draft state if optional core facts are missing.

### UX-S04 — Major — Profile-backed information still occupies too much conceptual space

After selecting an aircraft, FlyTally already applies type, logbook, class/regulatory context and billing defaults. Yet the user still sees equal-weight disclosure rows for Aircraft & logbook and Costs, plus profile-origin explanations in several places.

Evidence:
- `new-flight-aircraft-selected__desktop__light.jpg`
- `new-flight-aircraft-selected__mobile__light.jpg`

Direction:
- summarize successful profile-backed state compactly, e.g. one "Using OK-… aircraft profile" summary;
- expand only if the profile is incomplete, the flight differs, or the user explicitly chooses to change details;
- missing profile-backed evidence must still fail closed and become visible immediately.

### UX-S05 — Major — Role-specific workflows expose unrelated optional concepts too early

Safety Pilot screenshot:
- `new-flight-safety-pilot__desktop__light.jpg`
- Actual PIC source/name is correctly exposed because it is contextual;
- the same open Crew & training area also exposes Instructor, the full structured Training purpose grid and Task / exercise.

DUAL screenshot:
- `new-flight-dual__desktop__light.jpg`
- instructor/PIC is contextual and useful;
- structured purpose choices, explanatory regulatory text and task input create a second dense decision layer.

Direction:
- role-required evidence should appear immediately;
- optional training metadata should not become visually mandatory merely because the Crew section is open;
- test whether "Training details" can be a separate opt-in/contextual disclosure;
- preserve structured purpose evidence and countersignature rules when applicable.

### UX-S06 — Major — Mobile scroll depth becomes a usability problem

Measured light-theme mobile full-page heights:
- PIC: 2,737 px;
- DUAL: 3,542 px;
- Safety Pilot: 3,817 px;
- all disclosures: 4,671 px.

Evidence:
- `new-flight-all-disclosures__mobile__light.jpg`
- `new-flight-safety-pilot__mobile__light.jpg`

The issue is not simply page length. The user must repeatedly re-establish context between groups, explanatory copy, collapsed sections, review and final actions.

Direction:
- stronger progressive disclosure;
- reduce duplicate status/review surfaces;
- shorten non-critical helper copy;
- keep the primary action predictable and reachable;
- verify iPad portrait/landscape separately, not only desktop/mobile.

### UX-S07 — Moderate — Helper text is useful individually but noisy collectively

Desktop aircraft-selected/PIC state has about 30 visible `small` helper-text elements in the current DOM model. Many explain:
- profile origin;
- regulatory meaning;
- recency consequences;
- why a field exists;
- what not to infer.

This is valuable trust information, but when nearly every control explains itself at length, the form feels like documentation.

Direction:
- keep short action-oriented guidance inline;
- reserve longer "why" explanations for contextual disclosure/help;
- critical fail-closed warnings remain visible;
- do not hide evidence implications that materially affect credit/recency.

### UX-S08 — Moderate — The essentials card is still a flat list of different decisions

"Flight essentials" contains:
- identity: date + aircraft;
- route: departure + arrival;
- timeline: off-block + takeoff + landing + on-block;
- derived values: BLOCK + AIR;
- pilot role.

These are different decisions but visually share one flat form grid.

Direction:
- group by human task: **Flight / Route / Time / My role**, or an equivalent hierarchy;
- preserve the four UTC timestamp fields and BLOCK/AIR semantics unless separately approved;
- avoid a multi-page wizard unless evidence shows it is superior on both cockpit/iPad and desktop.

### UX-S09 — Moderate — Billing is a save gate even though it is not the pilot's primary flight task

Source evidence:
- `billing` is included in the current `missing` array;
- aircraft profiles normally supply the billing basis;
- if the profile does not, Costs opens automatically and blocks "required fields complete".

The audit does not change this rule yet. It flags a product-semantics question: should every logbook record require a billing model, or should billing be a separate optional/commercial layer?

This requires Filip's explicit product decision before any rule change.

### UX-S10 — Minor/Moderate — Repeated Add Flight entry points reduce hierarchy

Dashboard currently exposes Add flight in:
- sidebar primary action;
- page-level action;
- quick-action content.

This is not a blocker and can be convenient, but the new audit should review duplication across the product so one action does not appear as several competing priorities in the same viewport.

### UX-S11 — Positive — Existing architecture supports simplification without a rewrite

Keep:
- one canonical `FlightForm`;
- aircraft-profile defaults;
- contextual `flightEntryProfile`;
- fail-closed missing-evidence behavior;
- explicit Actual PIC / instructor / countersignature evidence;
- calculated BLOCK/AIR;
- draft → review → certification lifecycle;
- responsive disclosure components;
- existing design tokens and loading/error conventions.

The redesign should mainly change **when and how information is presented**, not create new business logic.

## Field classification — draft for review

This table classifies presentation responsibility, not regulatory entitlement and not yet final validation semantics.

| Field / group | Current rule | Draft presentation class | Audit direction |
| --- | --- | --- | --- |
| Date | required | Core now | Always visible |
| Aircraft / registration | required | Core now | Always visible; profile status summarized |
| Role | required | Core now | Always visible; drives contextual UI |
| Departure / Arrival | currently optional | Core flight detail | Keep easy/visible; do not silently make mandatory |
| Off-block / On-block | currently optional | Core timeline | Keep together as BLOCK timeline |
| Takeoff / Landing | currently optional | Core timeline | Keep together as AIR timeline |
| BLOCK / AIR | derived | Derived | Compact result, not another decision |
| Logbook / evidence | required; usually profile-backed | Derived/profile-backed | Compact summary when valid; expand if missing/change requested |
| Aircraft type | profile-backed/read-only when profile exists | Derived/profile-backed | Do not make a normal user re-evaluate it |
| Class/category | required; usually profile-backed | Derived/profile-backed | Show when missing/ambiguous/change requested |
| Regulatory category | contextual | Advanced/contextual | Only when ambiguity (e.g. TMG) makes it relevant |
| Operation / engine type | contextual/profile-backed | Advanced/contextual | Hide when unambiguous |
| Day/night landings | event evidence | Contextual | Experience/recency summary; easy adjustment |
| Night / IFR time | optional event evidence | Contextual | Compact optional row; not first-decision layer |
| PF movement checkbox | recency evidence | Contextual/regulatory | Visible only for applicable profile/role |
| Adjust takeoffs/approaches | exceptional evidence | Advanced/regulatory | Nested disclosure only |
| Sailplane launch method/count | conditionally required | Contextual required | Surface immediately when applicable |
| Balloon class/group/operation | profile/context dependent | Contextual required | Surface immediately when applicable; no invented values |
| Actual PIC | Safety Pilot contextual requirement | Contextual required | Surface immediately for Safety Pilot |
| Instructor/PIC | DUAL/context dependent | Contextual required/optional | Role-driven |
| Structured training purpose | optional/credit-specific | Optional/advanced | Separate from role-required crew identity |
| Task / exercise | optional | Optional detail | Training/details disclosure |
| Countersignature name/reference | SPIC/PICUS required | Contextual required | Surface only when role requires it |
| Professional operator/flight no./context | optional | Optional detail | Collapsed unless populated/requested |
| Billing basis | currently required; usually profile-backed | Product-rule review | Prefer background/profile summary if rule remains |
| Billing share / cost | commercial | Optional/contextual | Cost disclosure |
| Additional expenses | optional | Optional detail | Cost disclosure |
| Notes | optional | Optional detail | Lightweight disclosure |
| Review summary | presentation only | Completion/review | Consolidate with one completion surface |

## Draft information architecture — for review, not implementation

### Layer A — Log the flight
One visually dominant surface:
- Date
- Aircraft
- Role
- Route
- Timeline
- compact BLOCK / AIR result

The screen should answer immediately: **what flight am I logging?**

### Layer B — Context that needs attention
Only show a prominent section when the chosen role/aircraft makes it relevant:
- Actual PIC;
- instructor/supervising PIC;
- sailplane launch evidence;
- balloon operation/class evidence;
- missing/ambiguous aircraft-profile data;
- other genuinely required contextual evidence.

The screen should answer: **is anything special about this flight that I must confirm?**

### Layer C — Logbook details
Compact summaries for valid profile-backed state:
- logbook;
- class/category;
- operation/engine;
- experience/recency evidence.

Normal valid defaults are summarized, not presented as equal-weight configuration choices. A clear "Change details" path remains.

### Layer D — Optional details
Collapsed by default unless already populated:
- training purpose/task;
- professional context;
- costs/expenses;
- notes.

The screen should answer: **do I want to add anything else?**

### Completion
One completion state + one primary action:
- missing required contextual evidence is explicit;
- optional missing data does not look like an error;
- avoid a full inline "Review before save" if the next workflow stage is already Review;
- `Save & review` is the dominant path;
- evaluate moving `Save and add another` to the post-save/review workflow or clearly subordinating it.

## DO / DO NOT draft

**DO**
- preserve exact business rules until explicitly changed;
- reveal required evidence when applicability makes it relevant;
- distinguish profile-backed values from user-entered flight facts;
- use concise summaries for collapsed sections;
- use screenshots and fresh-user evidence to test the redesign;
- optimize for iPad and mobile as first-class cockpit workflows.

**DO NOT**
- auto-fill route/times from previous flight merely to reduce typing;
- make unknown evidence look like zero;
- hide required evidence behind a disclosure that permits invalid save;
- remove structured purpose/countersignature evidence if it is needed for credit;
- split Create/Edit/GPS into divergent business-rule paths;
- turn the form into a wizard without testing the navigation and correction cost;
- change billing/date/time/certification semantics inside a presentation-only batch.

## Open product questions after audit

These are not implementation decisions yet:

1. Should billing remain mandatory for every flight record, or should cost tracking become an optional commercial layer?
2. Should "Save and add another" remain visible during initial entry, or move after the first save?
3. Should optional structured Training purpose be offered only after a user explicitly opens Training details, even for DUAL/Safety Pilot states?
4. When route/timeline are intentionally optional, what wording should distinguish a valid draft from a fully described flight?

These should be resolved after independent review rather than silently inferred from the audit.
