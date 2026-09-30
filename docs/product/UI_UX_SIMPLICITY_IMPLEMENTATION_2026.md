# UI/UX Simplicity 2026 — New Flight Implementation Contract

**Status:** READY FOR IMPLEMENTATION  
**Decision owner:** Filip  
**Frozen date:** 29 September 2026  
**Repository:** `filipto861/flytally-logbook`  
**Planning PR:** #172 · `docs: reconcile Claude UI UX review`

## 1. Purpose

This document is the implementation contract for the active **UI/UX Simplicity Audit 2026** workstream, with **New Flight** as the primary target.

The design phase is closed. The goal is no longer to discover a direction; it is to implement the frozen direction in small, independently verifiable batches while preserving FlyTally's evidence-first logbook model.

Authority order for this work:

1. actual repository/runtime/tests;
2. certification / recency / data-integrity contracts;
3. frozen project rules and roadmap;
4. Filip's explicit product decisions;
5. independent AI review as advisory evidence only.

This document supersedes earlier batch ordering where it conflicts with the final repository-backed review. It does **not** erase the audit or reconciliation history.

## 2. Evidence used to freeze this plan

The implementation contract was reconciled against:

- current `main` after the completed Safety Pilot/PIC and General PIC work;
- `components/flight-form.tsx`;
- `components/flight-purpose-picker.tsx`;
- `components/flight-entry-workspace.tsx`;
- `components/flight-detail-workspace.tsx`;
- New Flight `page.tsx`;
- flight create/update actions and `lib/flight-input.ts`;
- `lib/billing.ts`;
- aircraft option read path and M1 aircraft-profile validation;
- FCL.050 compliance/certification blockers;
- recency service behavior;
- effective New Flight sticky-action CSS;
- desktop, iPad landscape, iPad portrait and mobile light-theme screenshots;
- the multi-round Claude review and final independent ChatGPT reconciliation.

Important repository-backed corrections:

- recency consumes **certified flights only**; editable drafts do not directly create a false CURRENT state;
- the current New Flight route receives its create-date default from `getManualEntryDefaults()`, which currently formats the date in `Europe/Prague`; the component's UTC fallback is not the normal New Flight create path;
- the action bar is genuinely `position: sticky`, including coarse-pointer/mobile treatment;
- M1 validates new/edited/shared aircraft profiles fail-closed, but `FlightForm` still has a separate fail-open fallback that can turn invalid/missing profile evidence/class into `ULL`;
- structured Training purpose has hidden form semantics (`purposeSelectionPresent`) and must not be accidentally unmounted in a way that changes parsing of existing records.

## 3. Frozen product decisions

These are no longer open questions.

### D1 — Billing / Costs are optional

A logbook draft must not be blocked solely because the user does not track aircraft costs.

Rules:

- empty billing/cost tracking is a valid state;
- missing billing is **not** converted to `BLOCK`, zero cost, or another invented default;
- if billing is explicitly configured on the selected aircraft profile, FlyTally may apply that configured value automatically;
- if no billing basis is configured, it stays empty;
- populated billing/share/expense data must still validate canonically;
- existing populated billing/cost data must be preserved on edit;
- Costs belongs to optional details, not required logbook evidence.

### D2 — No route/time completeness hint on New Flight

Departure, Arrival and timeline fields remain optional for draft save.

New Flight must not add extra explanatory clutter such as “route and times will be required before certification”.

Instead:

- draft save proceeds under the draft-save contract;
- Review/certification remains the fail-closed authority;
- when certification is attempted, the existing FCL.050 compliance path must continue to block missing Departure, Arrival, valid UTC off-block/on-block and positive flight time;
- no certification rule is weakened or duplicated in the entry UI.

### D3 — One primary save action on New Flight

New Flight exposes one primary action:

`Save & review`

`Save and add another` is removed from initial entry. After a successful save/review handoff, the user is offered **Add another flight**.

The old server intent may remain for backward compatibility if harmless, but no initial-entry UI should depend on it.

### D4 — Keep Role / Landings / PF presets, but make evidence visible

Do not force a normal pilot to reconfirm common presets on every flight.

Keep the existing convenience direction:

- Role may be preset from the user's/profile defaults;
- normal landing count may start at 1;
- PF may be preselected where the canonical rule already does so.

However, evidence-bearing preset values must be visible before save/certification.

For a normal applicable PIC flight, the user should be able to see a compact state such as:

`PIC · 1 day landing · PF Yes`

with a clear Change/Edit affordance.

This is not a new inference rule. It is visibility for values already being applied.

### D5 — Configured aircraft billing may auto-apply; absent billing stays absent

An explicitly saved aircraft billing basis is user configuration and may continue to populate a new flight.

Do not synthesize `BLOCK` solely because the aircraft/read helper has no billing value.

## 4. Non-negotiable integrity guardrails

No batch may change or weaken:

- one canonical flight record model;
- Create/Edit business-rule equivalence;
- certification payload/hash/version compatibility;
- revision/correction history;
- FCL.050 certification blockers;
- recency logic or CURRENT/VALID semantics;
- UTC/time/duration semantics;
- participant/shared-flight ownership rules;
- connected PIC identity/provenance;
- patch semantics;
- explicit aircraft/route selection rules;
- “missing evidence is not zero/default”;
- fail-closed handling of ambiguous or invalid profile evidence.

No wizard and no role-specific parallel `FlightForm` implementations.

## 5. Critical prerequisite findings

### I1 — Fail-open `ULL` fallback must be removed before compact profile UI

Current create-state normalization can turn invalid/missing selected-aircraft `evidence` or `aircraft_class` into `ULL`.

This is unsafe because a future compact Aircraft & logbook summary could then present a fallback value as if it were verified profile evidence.

Required outcome:

- missing/invalid selected-aircraft evidence/class remains unresolved;
- UI surfaces **Needs configuration** / equivalent explicit unresolved state;
- save remains fail-closed through the canonical parser;
- no automatic `ULL` repair;
- valid existing ULL profiles remain unchanged.

M1 write validation remains authoritative for new edits/imports; this prerequisite hardens the read/form path and legacy tolerance.

### I2 — Evidence-bearing presets need visibility, not forced reconfirmation

Current behavior includes:

- preset Role;
- preset normal landing count;
- automatic PF selection for applicable normal PIC/SOLO cases.

The problem is not that every default is invisible: Date and Role are visible, and the landing summary is partially visible. The important hidden evidence is PF and the lack of one clear combined evidence summary.

Required outcome:

- preset values remain convenient;
- values that affect movements/recency evidence are visible before save;
- the post-save review path exposes the recorded movement/PF state before certification.

### I3 — Sticky action bar must not cover content or focused controls

Current effective CSS makes the form action area sticky.

Required outcome:

- sticky behavior may remain only if it does not cover the last content, a focused control, validation message or the iOS keyboard area;
- sufficient scroll padding/bottom spacing is required;
- if reliable behavior cannot be proven on tablet/mobile, sticky behavior is removed for the affected breakpoint rather than patched heuristically.

## 6. Target New Flight information architecture

### A — Intro / mode

Keep:

- `New flight`;
- one concise sentence;
- Manual entry / Import GPS track selector.

Change:

- remove duplicated explanatory prose;
- `Add aircraft` becomes prominent only when no aircraft exists;
- when aircraft already exist, Add/manage aircraft is a smaller contextual action near aircraft selection rather than a competing primary CTA.

### B — Flight essentials

Always visible in this order:

1. Date
2. Aircraft
3. Role
4. Departure / Arrival
5. Times · UTC
6. BLOCK / AIR
7. compact recorded-experience evidence summary

Route/times remain optional for draft save.

Recommended responsive structure:

- desktop: time fields may use four columns;
- iPad landscape/portrait: prefer 2 × 2;
- mobile: test 2 × 2 at 390 px;
- 320 px may fall back to one column if native time controls do not fit cleanly.

Do not freeze a layout solely by breakpoint; browser evidence decides.

### C — Required context

Only show when applicability requires user attention:

- Safety Pilot Actual PIC;
- DUAL Instructor / PIC;
- SPIC/PICUS supervising PIC/FI and countersignature evidence;
- sailplane launch evidence;
- balloon class/operation/movement evidence;
- unresolved/invalid aircraft-profile evidence.

Required + unresolved must always be visible and focusable.

### D — Aircraft & logbook

Normally compact, but show actual evidence-bearing values, for example:

`EASA · Aeroplane · SEP · SP · SE · from OK-SP2E`

Rules:

- no abbreviation-only summary that omits the actual logbook/evidence value;
- no generic “defaults applied” without the values;
- unresolved/invalid state auto-surfaces;
- flight-specific overrides remain editable;
- billing is not part of required profile evidence.

### E — Optional details

Collapsed unless populated or explicitly opened:

- Training purpose;
- Task / exercise;
- professional context;
- Costs / expenses;
- Notes;
- Night/IFR and other optional experience detail where appropriate.

Existing populated edit values must remain discoverable and preserved.

### F — Completion

One completion model:

- draft-save blockers only when blockers actually exist;
- one primary `Save & review`;
- short consequence text such as “Creates an editable draft for final review” may remain;
- no `? → ?` review card;
- no duplicate `Ready to save`;
- no route/time certification hint on New Flight;
- unsaved-change state may remain, but not as a second readiness system.

## 7. Implementation batches

Each batch is a separate implementation/review unit unless repository evidence proves two adjacent batches are inseparable.

---

## B0.5 — Integrity prerequisites + golden baseline

**Goal:** make the simplified UI safe to build on.

### Scope

1. Remove fail-open `ULL` fallback from selected-aircraft evidence/class handling.
2. Surface invalid/missing aircraft profile context explicitly.
3. Preserve valid ULL behavior.
4. Add/confirm golden create/update payload-equivalence coverage before structural form movement.
5. Capture baseline for normal PIC, DUAL and Safety Pilot:
   - visible controls;
   - deliberate choices;
   - applied presets;
   - open disclosures;
   - page height as secondary evidence.
6. Record preset policy in tests/documentation:
   - Role preset allowed;
   - landing preset allowed;
   - PF preset allowed where current rule applies;
   - evidence state must be visible.

### Expected files

Likely:

- `components/flight-form.tsx`;
- `lib/flight-form-rules.ts` if a shared normalization helper is needed;
- aircraft option/profile read helpers only if required by the discovered contract;
- targeted tests;
- screenshot/browser audit tooling if baseline metadata needs extension.

### Do

- fail closed;
- distinguish valid ULL from missing/invalid profile data;
- preserve server-side canonical validation;
- test legacy/malformed selected-aircraft data.

### Do not

- invent a generic profile;
- rewrite valid historical flights;
- change recency/certification behavior;
- compact Aircraft & logbook before the fallback issue is closed.

### Acceptance

- malformed/missing profile evidence/class does not render as ULL;
- valid ULL still renders as ULL;
- unresolved state is visible and prevents an invalid save;
- golden payload baseline exists;
- no runtime regression in normal valid profiles.

---

## B1A — Optional Costs domain contract

**Goal:** make “Costs optional” true end-to-end, not just visually.

### Discovery prerequisite

Inventory all consumers of:

- `parseBilling`;
- `serializeBilling`;
- `billingLabel`;
- `calculatedFlightPrice`;
- `billing_basis`;
- aircraft-profile billing defaults;
- flight create/update/import;
- cost/statistics/export surfaces.

Before coding, verify database constraints/defaults on flight and aircraft billing columns. Do not assume blank storage is accepted.

### Contract

Represent **not tracked** distinctly from BLOCK/AIR.

Preferred semantic shape:

- absent/empty → no billing basis;
- valid populated → BLOCK or AIR, optional share;
- malformed populated → validation error.

Implementation may introduce an optional billing parser/serializer rather than weakening helpers whose existing callers rely on legacy fallback semantics.

### UI behavior

- Billing is removed from the universal `missing`/draft blocker set;
- Costs does not auto-open merely because billing is absent;
- Billing selector is not HTML-required;
- Costs summary should communicate optional/not-tracked state clearly;
- configured aircraft billing may populate;
- absent aircraft billing does not silently become BLOCK;
- no cost value is shown as a calculated zero when billing is simply not tracked.

### Acceptance

- draft saves with empty billing;
- create and update preserve empty state;
- explicitly configured BLOCK/AIR persists unchanged;
- share persists;
- malformed non-empty billing fails;
- expenses continue to work;
- no accidental implicit BLOCK;
- no schema migration unless database evidence proves one is necessary.

---

## B1B — Completion semantics + post-save Add another

**Goal:** remove duplicate completion UI without changing draft or certification rules.

### Scope

Remove the full inline `Review before save` card after relocating its unique information:

- logbook/evidence value → Aircraft & logbook summary;
- profile/default origin → Aircraft & logbook summary/context;
- unsaved-changes indicator → completion/action area.

Remove duplicate `Ready to save` states.

Keep:

- one draft blocker surface when blockers exist;
- server error surface;
- one primary `Save & review`;
- concise “editable draft for final review” consequence copy if useful.

### Add another

After successful create:

- redirect still lands in the saved flight review/logbook workflow;
- show a clear `Add another flight` action in the post-save state;
- action leads to a fresh New Flight entry;
- no second save button on the initial form.

The existing `saved=1` / post-save workspace mechanism should be reused rather than creating a parallel completion page.

### Certification

No route/time soft warning on New Flight.

FCL.050 blockers remain exclusively enforced in the review/certification workflow.

### Acceptance

- exactly one primary save action on New Flight;
- no `? → ?`;
- no duplicate `Ready to save`;
- draft-save blockers are unchanged except for the separately approved optional billing change;
- certification blockers remain unchanged;
- Add another appears only after successful save/review;
- duplicate-submit protection remains.

---

## B2 — Essentials hierarchy + visible movement evidence

**Goal:** make the normal flight entry task compact and self-explanatory while exposing applied evidence.

### Scope

1. Trim duplicated page/form intro copy.
2. De-emphasize Add aircraft when aircraft already exist.
3. Move Role directly after Aircraft in DOM/tab order.
4. Group Departure/Arrival.
5. Group time inputs under one clear UTC context without changing field semantics.
6. Retain live BLOCK/AIR with `—` when unavailable.
7. Replace the opaque collapsed Flight experience state with a compact evidence summary that includes applicable landing/PF state.
8. Keep detailed movement adjustment available through Change/expand.

### Normal PIC example

A compact state may read:

`1 day landing · PF Yes`

Role remains separately visible in the essentials row.

### Review-before-certification visibility

The saved editable review path must expose movement/PF evidence clearly before certification. Existing edit-mode open state may satisfy part of this, but browser evidence must prove it.

### Do not

- require route/times at save;
- force reconfirmation of normal presets;
- infer additional movements;
- change FCL.060 logic;
- convert missing time to 0:00.

---

## B3 — Profile summary + role-driven required context

**Goal:** show only applicable required evidence while retaining one canonical form.

### Aircraft & logbook summary

Show real values:

- evidence/logbook;
- regulatory category;
- aircraft class;
- operation/engine where applicable;
- origin/profile identity where useful.

Auto-expand unresolved/ambiguous state.

### Role-driven context

Move required role evidence into one contextual area:

- DUAL Instructor/PIC;
- Safety Pilot Actual PIC;
- SPIC/PICUS supervisor/countersignature;
- other already-supported required evidence.

Do not create role-specific forms.

### Training purpose

Training purpose is **not** part of required crew identity.

Keep its structured hidden parsing semantics intact when moving it to Optional details.

---

## B4 — Optional details + helper-copy triage

**Goal:** reduce documentation-like noise without removing meaningful evidence.

### Optional sections

- Training purpose / Task;
- Professional context;
- Costs / expenses;
- Notes;
- optional Night/IFR and similar detail as supported by the final hierarchy.

### Populated edit behavior

If an optional section already contains stored data:

- summary must indicate populated state;
- data must remain discoverable;
- no edit/save cycle may erase it because the section is closed.

### Helper-copy triage

Keep immediately visible:

- actual validation errors;
- format guidance that prevents invalid input;
- regulatory/evidence consequences;
- Connection/revision consequences.

Compact or remove:

- label restatements;
- repeated “aircraft profile applied…” prose;
- generic role definitions already clear from the option;
- explanatory copy that does not affect the current decision.

---

## B5 — Responsive, accessibility and final UX closeout

**Goal:** prove the redesign works across cockpit-relevant layouts, not only desktop.

### Required viewport/theme matrix

- 1440 × 1100;
- 1024 × 768 iPad landscape;
- 768 × 1024 iPad portrait;
- 390 × 844 mobile;
- 320 px reflow;
- light + dark.

### Responsive acceptance

- no horizontal overflow;
- no clipped native time/select controls;
- sticky action area never covers focused/last content;
- safe-area/virtual-keyboard behavior proven where sticky is retained;
- touch targets at least 44 px;
- 200% zoom remains usable;
- no desktop-only information hierarchy.

### Accessibility acceptance

- native `details/summary` semantics are preserved unless custom behavior genuinely requires extra ARIA;
- do not add redundant `aria-expanded`/`aria-controls` that can drift from native state;
- collapsed required content cannot cause a silent “invalid control is not focusable” failure;
- blocker navigation opens the relevant disclosure before focus;
- pristine form is not painted as erroneous solely because optional user interaction has not started;
- server/client errors remain fail-closed;
- helper/Required contrast is measured, not guessed from screenshots;
- live regions announce actual changes, not static noise.

## 8. Cross-path regression requirements

Even though New Flight is the visible target, implementation must check all affected consumers.

### Create

- normal PIC;
- DUAL;
- Safety Pilot manual Actual PIC;
- Safety Pilot connected Actual PIC;
- SPIC;
- PICUS;
- Sailplane;
- Balloon;
- ULL;
- Other/conservative fallback.

### Edit / correction

- populated optional sections preserved;
- existing billing preserved;
- existing structured purpose preserved;
- connected PIC state preserved;
- no historical profile evidence silently re-derived from current profile.

### GPS import

Do not create a divergent business rule.

If shared billing/profile helpers change, verify GPS import explicitly. GPS-reviewed flights remain review-first and source evidence is not overwritten by convenience defaults.

### Certification

- FCL.050 blockers unchanged;
- hash/version compatibility unchanged;
- post-save review still precedes certification;
- movement/PF evidence visible before certification.

### Recency

- draft remains excluded;
- certified movement evidence behavior unchanged;
- no new default produces false CURRENT.

### Sharing

- Safety Pilot/PIC and General PIC provenance unchanged;
- no invitation behavior changes as a side effect of form presentation work.

## 9. Test strategy

### Per-batch minimum

Run:

- `npm run typecheck`;
- targeted unit/source tests for the touched contract;
- relevant UI test subset.

### Coherent candidate gate

Before a runtime PR is merge-ready:

- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- authenticated Chromium browser verification;
- screenshot matrix for changed New Flight states.

Use PostgreSQL acceptance when the batch changes persistence semantics or when source inspection cannot prove DB behavior.

### B0.5 specific tests

- valid ULL profile;
- missing evidence;
- invalid evidence;
- missing class;
- invalid class;
- no fallback-to-ULL;
- golden create/update payload;
- duplicate/submitted movement-field equivalence where relevant.

### B1A specific tests

- empty billing valid;
- BLOCK;
- AIR;
- shares;
- malformed non-empty billing;
- configured aircraft billing applies;
- no configured billing stays empty;
- existing billing survives edit;
- GPS/shared helper consumers remain correct.

### B1B specific tests

- one primary save action;
- no initial Save and add another;
- post-save Add another action;
- no inline `? → ?`;
- blocker list only when blockers exist;
- certification missing-route/time behavior unchanged.

### B2–B5 browser states

Capture at minimum:

- blank;
- aircraft-selected PIC;
- DUAL;
- Safety Pilot manual;
- Safety Pilot connected;
- SPIC/PICUS required context;
- all optional disclosures populated;
- invalid/unresolved aircraft profile;
- light/dark;
- desktop/iPad landscape/iPad portrait/mobile.

## 10. Objective UX acceptance

Do not use page height alone as a pass/fail score.

For each representative scenario record:

- visible controls at first paint;
- deliberate decisions required;
- presets applied by FlyTally;
- presets visibly disclosed;
- unresolved choices;
- open disclosure count;
- primary action count;
- completion-state count;
- full-page height as secondary evidence.

Final target:

- one dominant task;
- one primary save action;
- one completion system;
- no duplicate blocker text;
- no invisible evidence-bearing preset;
- no invented fallback value;
- optional details do not compete with the main task;
- unresolved required evidence surfaces automatically.

## 11. Expected file map

This is a planning map, not permission to edit every file.

Likely runtime files:

- `components/flight-form.tsx`;
- `components/flight-entry-workspace.tsx`;
- `components/flight-detail-workspace.tsx`;
- `components/flight-purpose-picker.tsx` only if presentation needs a supported API change;
- `app/(protected)/flights/new/page.tsx`;
- `app/(protected)/flights/actions.ts`;
- `lib/flight-input.ts`;
- `lib/billing.ts`;
- `lib/data/aircraft.ts` if required to stop synthetic billing fallback;
- `lib/flight-form-rules.ts` if shared fail-closed normalization belongs there;
- `app/globals.css`;
- targeted tests / browser smoke.

Files should be touched only when the batch contract requires them.

## 12. Database / migration expectation

No schema migration is currently planned.

Before B1A implementation, verify actual DB column constraints/defaults for `billing_basis` on relevant tables.

If the current schema cannot represent “not tracked” safely:

- stop;
- document the exact constraint;
- design an additive/backward-compatible migration;
- obtain review before applying it.

Do not encode “not tracked” as a misleading legacy value merely to avoid a migration.

## 13. Branch / PR discipline

The current docs work belongs to draft PR #172.

After this implementation contract is reviewed:

1. merge/finalize the documentation gate so `main` carries the frozen roadmap direction;
2. create a small runtime branch for B0.5;
3. implement and verify B0.5;
4. close its docs/test evidence;
5. proceed batch-by-batch.

Do not accumulate B0.5 through B5 into one broad runtime PR.

## 14. Documentation closeout

For each major batch:

- update ROADMAP status/evidence;
- update FEATURE LIST only if capability semantics changed or a new user-visible capability was added;
- update CHANGELOG only for actual runtime changes;
- preserve superseded design history in the audit/reconciliation documents.

The overall UI/UX Simplicity workstream is DONE only after B0.5–B5 implementation, verification and documentation closeout.

## 15. Current state / next step

Current state:

- screenshot audit: DONE;
- Claude review: DONE;
- repository reconciliation: DONE;
- Filip decisions D1–D5: FROZEN;
- B0.5 runtime implementation: **DONE / VERIFIED**;
- B0.5 baseline record: `docs/product/UI_UX_SIMPLICITY_B05_BASELINE_2026.md`;
- B1A runtime implementation: **DONE / MERGED** in PR #174 (`37eac801cc69b19c07d4c140213ccda37c4e85ff`);
- B1A database evidence: **PASS (read-only production metadata)**; no migration required;
- B1A authenticated UI smoke: **DEFERRED, not PASS** and carried to live cumulative redesign verification;
- B1B runtime implementation: **DONE / MERGED** in PR #175 (`0d7e5d56b88a06292c98969e515d2ef48aa5fb0b`);
- B1B verification: TypeScript PASS, production build PASS, targeted reconciled contracts **34/34 PASS**, full unit/regression **934/934 PASS**; PostgreSQL N/A;
- B2 runtime implementation: **DONE / MERGED** in PR #176 (`a3bc8b3ed99ca34a49cc39db9ec38ac578e2ae86`);
- B2 verification: TypeScript PASS, targeted B2/affected historical contracts **47/47 PASS**, full unit/regression **940/940 PASS**, production build PASS; PostgreSQL N/A;
- B3 runtime implementation: **DONE / MERGE READY**;
- B3 evidence record: `docs/product/UI_UX_SIMPLICITY_B3_CONTEXT_2026.md`;
- B3 verification: TypeScript PASS, production build PASS, reconciled targeted contracts **22/22 PASS**, full unit/regression **946/946 PASS**; PostgreSQL N/A;
- B4 and later runtime batches: NOT STARTED.

**Current gate:** merge B3, then proceed to B4 while retaining the cumulative live UI smoke as an explicit deferred verification item.
