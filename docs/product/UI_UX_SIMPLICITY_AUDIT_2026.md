# UI/UX Simplicity Audit 2026

**Status:** DISCOVERY / AUDIT DESIGN  
**Decision owner:** Filip  
**Decision date:** 29 September 2026  
**Repository:** `flytally-logbook`

## Why this work exists

A fresh-user usability check exposed a core problem that the previous visual-consistency audit did not fully solve: FlyTally can still feel cognitively dense and chaotic, especially when entering a flight.

The strongest observed friction is the New Flight workflow: a first-time user is presented with many aviation/logbook fields and concepts at once and can struggle to understand:

- what must be entered now;
- what is optional;
- what is derived from the aircraft profile;
- what is advanced/regulatory detail;
- what can safely be left alone;
- what the next action is.

This is not a request for cosmetic polish only. It is a **task-flow, information-architecture and cognitive-load audit**.

The previous `docs/ux-audit.md` remains historical evidence of the completed consistency/polish batches. This work does not overwrite that audit.

## Product objective

Make FlyTally feel simple, predictable and self-explanatory for a pilot who has never used it before, while preserving the existing evidence-first logbook model and regulatory/data-integrity rules.

The target experience is:

> show the minimum information needed to make the current decision, reveal advanced detail when it becomes relevant, and keep the primary action obvious.

Simplicity must not be achieved by silently inventing values, weakening validation, hiding required evidence, or changing regulatory/business semantics.

## Audit before redesign

No broad UI rewrite starts from intuition alone.

Sequence:

1. reconstruct current UI/routes/components and prior audit decisions;
2. capture deterministic screenshots from the current application;
3. perform route-by-route and task-by-task UX analysis;
4. perform a dedicated New Flight cognitive-load audit;
5. draft a proposed simplification model;
6. obtain an independent Claude review;
7. reconcile the review against the live repository and frozen product/data rules;
8. freeze findings, priorities and acceptance criteria;
9. implement in small batches;
10. verify desktop + iPad landscape + iPad portrait + mobile, light + dark;
11. update ROADMAP / FEATURES / CHANGELOG in the same work cycle.

## Screenshot evidence contract

Create a dedicated Playwright audit capture script using the existing isolated browser-smoke database. It must not use or mutate production data.

Capture at minimum:

### Viewports
- Desktop: 1440 × 1100
- iPad landscape: 1024 × 768
- iPad portrait: 768 × 1024
- Mobile: representative 390–430 px width

### Themes
- Light
- Dark

### Core routes
- Login
- Dashboard
- Flights list
- New Flight
- Existing Flight detail
- Aircraft / database
- Licences & ratings / recency
- Statistics
- Connections
- Actions
- Settings
- Print & data where useful

### New Flight states
Capture the form as a workflow, not only one static screenshot:

- blank/default state;
- aircraft selected with profile defaults applied;
- common SEP/PIC flight;
- training-role state;
- Safety Pilot state;
- advanced/logbook section expanded;
- costs/expenses expanded;
- validation/error state;
- narrow/mobile state with keyboard-safe layout where practical.

The artifact should preserve descriptive filenames so screenshots can be compared without guessing route/state/viewport/theme.

## Audit dimensions

Every major screen is reviewed for:

### Cognitive load
- number of simultaneously visible decisions;
- jargon introduced before it is needed;
- whether required and optional data are distinguishable;
- whether advanced fields distract from the core task;
- whether derived/defaulted values are explained clearly without becoming visual noise.

### Information hierarchy
- one obvious primary action;
- clear page purpose;
- clear ordering of sections;
- predictable progressive disclosure;
- secondary and destructive actions visually subordinate.

### Flight-entry simplicity
The audit must explicitly classify every New Flight field as one of:

- **Core now** — normally required to log the flight;
- **Contextual** — required only for a role/category/operation;
- **Derived/profile-backed** — usually supplied from aircraft/profile state;
- **Optional detail** — useful but not needed for the normal happy path;
- **Advanced/regulatory** — important evidence but should appear only when applicable or explicitly expanded.

The audit must then test whether the current rendering respects that classification.

### Consistency
- spacing;
- card geometry;
- field labels;
- helper text;
- buttons;
- disclosure controls;
- empty/error/loading states;
- terminology;
- navigation hierarchy.

### Responsive usability
- desktop;
- iPad landscape;
- iPad portrait;
- mobile;
- touch targets;
- horizontal overflow;
- section ordering;
- sticky/primary actions;
- excessive scrolling.

### Accessibility
- focus order;
- keyboard operation;
- labels and accessible names;
- contrast;
- form error association;
- disclosure semantics;
- reduced motion;
- touch size.

### Trust and data integrity
A simpler UI must still make it clear when:
- data are required;
- data are inferred from an aircraft profile;
- data are missing;
- a record is draft vs certified;
- an action affects another pilot;
- evidence is unavailable rather than zero/default.

## New Flight hypotheses to test, not yet implementation decisions

The screenshots/source audit should test these hypotheses:

1. Too many fields are visible before the user has established the basic flight context.
2. Helper text intended to explain the form may itself contribute to visual noise.
3. Aircraft-profile-backed values may be shown too prominently even when the user normally does not need to touch them.
4. Role/category-specific fields may appear earlier than their relevance justifies.
5. The current section/disclosure hierarchy may be technically correct but not obvious to a new user.
6. Save/review intent may compete visually with secondary sections or actions.
7. The form may be optimized for completeness rather than fast, confident entry.

These are hypotheses only. Findings must be evidenced by screenshots + source behavior before implementation.

## Guardrails

Do not:
- invent or auto-apply new values merely to reduce typing;
- silently change business rules;
- remove evidence required by canonical validation;
- change UTC/time/duration semantics as part of a visual simplification;
- change certification payload semantics without a separate integrity review;
- create a second flight-entry model;
- create desktop-only simplifications that degrade iPad/mobile;
- hide a required field in a way that allows an invalid submit;
- treat a friend’s single usability session as universal proof.

Prefer:
- progressive disclosure;
- contextual rendering;
- concise helper text;
- stronger visual hierarchy;
- reuse of existing components/tokens;
- explicit summaries for collapsed advanced sections;
- one canonical FlightForm/business-rule path.

## Independent Claude review

After the first-pass audit and draft simplification model, prepare a read-only handoff for Claude covering:

- screenshot evidence;
- field inventory;
- current form behavior;
- proposed core/contextual/advanced classification;
- known data-integrity constraints;
- proposed simplification;
- explicit questions about cognitive load, hierarchy, progressive disclosure, mobile/iPad behavior and hidden failure modes.

Claude is an independent reviewer, not an authority. Every recommendation must be reconciled against the repository and FlyTally data rules before adoption.

There is no direct Claude connector in the current ChatGPT toolset, so the review is performed through a relay handoff rather than being represented as if ChatGPT invoked Claude directly.

## Audit deliverables

The audit phase is not DONE until it produces:

- deterministic screenshot artifact;
- route/screen inventory;
- New Flight field classification;
- prioritized findings with severity and evidence;
- proposed information architecture;
- explicit DO / DO NOT list;
- responsive acceptance matrix;
- independent Claude review + reconciliation;
- implementation roadmap split into small batches;
- regression-test plan.

## Verification expectations for later implementation

Each implementation batch must include appropriate:

- local typecheck;
- targeted UI/source tests;
- full unit/regression suite when scope warrants;
- production build;
- authenticated Chromium browser verification;
- desktop + iPad landscape + iPad portrait + mobile review;
- light + dark review;
- screenshot comparison for changed routes;
- PostgreSQL tests only when data behavior/schema is touched.

## Definition of Done

This workstream closes only when:

- the core New Flight path is materially easier to understand;
- advanced/contextual fields are visible when relevant rather than merely because they exist;
- required evidence remains explicit and fail-closed;
- primary actions are obvious;
- the rest of the product follows a consistent hierarchy;
- no regression is introduced in certified records, role logic, recency, sharing, GPS or profile-backed data;
- ROADMAP / FEATURES / CHANGELOG are reconciled;
- verification evidence is recorded rather than assumed.
