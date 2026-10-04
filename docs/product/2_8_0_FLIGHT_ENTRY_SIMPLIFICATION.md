# 2.8.0 — Flight Entry Simplification

**Status:** DESIGN / REVIEW GATE  
**Date:** 4 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `feat/2.8.0-flight-entry-simplification`

## Goal

Reduce the cognitive load of Manual and GPS flight entry without weakening source provenance, explicit evidence, certification integrity, recency semantics or historical record protection.

The common case should feel like:

**Source → Flight details → Save & certify**

while advanced/regulatory/detail surfaces remain available through progressive disclosure.

## Production problems observed

The current GPS import is functionally correct but too dense. A normal single-flight import can expose, in one long page:

- entry-mode switch;
- source/upload state;
- GPS quality warning;
- split controls;
- map and altitude/speed profile;
- common aircraft / role / operation / engine / billing context;
- another per-flight review card;
- repeated helper/provenance/status text;
- landing evidence;
- Night / IFR;
- four movement times;
- notes;
- a generic “I reviewed this flight” checkbox;
- reviewed-count summary;
- another review/submit action;
- then a second page where the pilot explicitly certifies the flight.

This is too much hierarchy for the normal task.

## Non-negotiable boundaries

- GPS-derived values remain advisory and editable.
- Missing/ambiguous evidence remains unavailable or explicit; never guessed.
- IFR remains pilot-entered.
- Day/Night and Night-time keep the existing SERA suggestion/provenance contract.
- Certification remains an explicit pilot action.
- Existing certification hash/version, audit history, correction revisions, sharing gates and recency evidence authority remain preserved.
- No historical record/backfill rewrite.
- No partial multi-flight certification state.
- No database migration unless implementation evidence proves one necessary.

## Phase 1 — Discovery, baseline and independent review

Scope:
- inventory the effective Manual/GPS sections, fields, server actions, validation and certification dependencies;
- capture the current production hierarchy from desktop/iPad/mobile screenshots;
- characterize which helper/status surfaces duplicate one another;
- audit the structured Training purpose catalogue, category filtering and server persistence rules;
- trace the existing `certifyFlight` compliance/hash contract so 2.8.0 does not create a second certification rule set;
- obtain independent second-AI review before runtime implementation.

Acceptance:
- exact keep / collapse / remove / conditional matrix exists;
- no field is removed merely because it looks optional;
- Training purpose UI cannot offer a choice that the server silently discards;
- same-page certification design has an explicit failure/rollback contract.

## Phase 2 — Information hierarchy

### GPS Source

Default visible:
- uploaded filename;
- point count / detected-flight count;
- one concise source state;
- any real GPS-quality warning.

Progressive disclosure:
- split controls when only one clean flight is detected;
- map;
- altitude/speed profile;
- raw source diagnostics.

Rules:
- a GPS-quality warning remains first-class;
- “Review GPS track” opens automatically when a warning requires visual inspection;
- a clean single-flight import should not show a large split-management area by default.

### Flight context

Replace the large Common details block with one compact summary row:
- aircraft;
- role;
- operation;
- engine;
- billing when tracked.

The summary remains editable through one `Flight context` disclosure. Invalid/missing required profile state automatically opens the relevant control.

### Flight card

Default visible:
- date;
- departure / arrival;
- landing total and Day/Night when applicable;
- Off-block / Takeoff / Landing / On-block;
- Night / IFR only when applicable;
- concise Notes affordance.

Do not repeat provenance/helper text when the visible value and one compact source badge already communicate the same thing.

## Phase 3 — Optional / contextual details

Collapse by default:
- additional crew;
- aircraft context/provenance;
- Training purpose;
- Task / exercise;
- costs and additional expenses;
- professional context;
- extended movement evidence when not required;
- source diagnostics.

Auto-open only when:
- the selected role/category makes a field required;
- stored/edit data already contains a value;
- a validation problem exists in that section;
- the pilot explicitly opens it.

### Training purpose audit

Current structured catalogue:
1. Aircraft differences training / endorsement
2. Aircraft familiarisation
3. LAPL(A) FCL.140.A refresher training
4. LAPL(H) FCL.140.H refresher training
5. SEP/TMG FCL.740.A refresher training
6. SPL SFCL.160 recency training
7. BPL BFCL.160 recency training

Current ULL UI intentionally filters out the Part-FCL/SFCL/BFCL recency purposes and therefore shows only the first two.

2.8.0 must:
- preserve regulatory applicability filtering;
- verify role/category/server persistence parity;
- decide whether to restore a generic non-regulatory **Training / practice flight** marker for ULL/other normal training use;
- if such a marker is added, it must carry **no automatic recency/endorsement credit** and must not imply authority approval;
- preserve existing stored purpose codes and historical certified records.

## Phase 4 — Completion and same-page certification

Normal eligible single-flight flow:

**Save & certify flight** — primary  
**Save draft** — secondary

Rules:
- clicking **Save & certify flight** is the explicit certification confirmation;
- no silent certification on field completion or GPS import;
- use the existing certification compliance/hash/revision contract, not a forked copy;
- remove the generic normal-case “I reviewed this flight” checkbox;
- when a specific warning requires acknowledgement, use targeted warning-specific confirmation instead;
- after successful Save & certify, do not require another certification click on the next page;
- Save draft remains available for incomplete/uncertain records.

### Multi-flight GPS imports

Before implementation, freeze one of these fail-closed semantics:
1. save all drafts atomically, then certify all in one certification transaction; if certification fails, all remain drafts; or
2. direct batch save+certify only if one atomic implementation can be proven.

Forbidden:
- some imported flights certified while others from the same requested batch remain uncertified because of an intermediate failure.

## Phase 5 — Responsive and interaction polish

Verify:
- desktop;
- iPad landscape;
- iPad portrait;
- mobile 390;
- compact mobile/reflow;
- light and dark.

Acceptance:
- materially fewer default-visible sections than the current production flow;
- no horizontal overflow;
- one obvious primary action;
- warning/error state identifies exactly which disclosure must be opened;
- pending/disabled states prevent duplicate submit;
- keyboard/focus order remains usable;
- no raw server errors.

## Phase 6 — Release closeout

Required evidence according to changed risk:
- targeted unit/source tests throughout implementation;
- TypeScript;
- complete unit/regression candidate gate;
- PostgreSQL acceptance because save/certification semantics are persistence-critical;
- authenticated browser matrix for Manual + GPS, draft + direct certification, warnings, responsive states;
- production build;
- PR CI;
- production deployment smoke and runtime-error check;
- ROADMAP / FEATURES / CHANGELOG reconciliation;
- product version bump to **2.8.0** only when the release candidate is actually ready to ship.

## Definition of done

2.8.0 is DONE only when:
- the simplified hierarchy is production deployed;
- same-page explicit Save & certify is verified;
- Save draft remains valid;
- multi-flight imports cannot partially certify;
- Training purpose behavior is reconciled and regression-covered;
- certification/audit/correction/sharing/recency invariants are proven unchanged in authority;
- responsive light/dark acceptance passes;
- `package.json`, visible app version, changelog release heading and release tag are reconciled to 2.8.0.
