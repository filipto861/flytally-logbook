# UI/UX Simplicity 2026 — B2 Essentials Hierarchy + Visible Movement Evidence

**Status:** DONE — MERGE READY  
**Date:** 30 September 2026  
**Branch:** `feat/new-flight-b2-essentials`  
**Parent contract:** `docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`

## Goal

Make normal manual flight entry scan in the order a pilot actually needs it while exposing evidence-bearing defaults that previously stayed hidden inside the collapsed Flight experience section.

B2 is presentation-only. It does not alter the canonical flight parser, persistence schema, certification payload/hash, recency rules, UTC semantics, aircraft-profile validation or billing domain contract.

## Implemented hierarchy

### Identity first

The always-visible essentials now begin in this DOM/tab order:

1. Date;
2. Registration;
3. Role.

Role therefore follows Aircraft directly instead of appearing after the entire timeline.

The Role preset policy from B0.5 is unchanged. Presets remain allowed for convenience; the selected value is now part of the first visible decision row.

### Route

Departure and Arrival are grouped under one **Route** heading.

The existing local-flight action remains attached to Arrival.

Route stays optional for draft save. No certification hint or artificial blocker was added.

### Times

The four existing time inputs are grouped under one **Times · UTC** context and ordered chronologically:

1. Off-block;
2. Takeoff;
3. Landing;
4. On-block.

Repeated per-label UTC badges are removed. Field names and values are unchanged.

BLOCK and AIR remain live calculated feedback immediately below the timeline and continue to show `—` when the duration is unavailable. Missing time is not converted to `0:00`.

## Visible movement / PF evidence

For standard experience, the collapsed Flight experience summary now exposes the evidence-bearing state instead of only a landing count.

Normal PIC example:

`1 day landing · PF Yes`

If PF is not recorded, the summary reports `PF No`.

A visible **Change** cue indicates that the disclosure edits this evidence. The existing PF checkbox and detailed movement-count adjustment remain unchanged inside the native `details` disclosure.

The normal preset still does **not** require reconfirmation. Existing `autoMovement(...)` behavior remains the source of the preselected PF state for applicable normal PIC/SOLO entries.

Edit/review still initializes the experience disclosure open, preserving explicit movement/PF visibility before certification.

## Intro and aircraft action density

Manual entry no longer repeats the prior eyebrow + explanatory paragraph above the canonical form. The panel uses the shorter **Flight details** heading.

GPS import retains its source-specific explanation because it describes a materially different workflow.

When there are no aircraft, the existing large **Add first aircraft** callout remains.

When aircraft already exist, the add-aircraft action remains available but is rendered as a small contextual header action rather than the same prominent secondary CTA.

## Responsive structure

B2 adds explicit hierarchy rules in the final UI system layer:

- identity: three columns on wide desktop;
- route: two columns;
- times: four columns on wide desktop;
- times: two columns at `<=1000px`;
- identity/route: one column at `<=700px`;
- times: one column at `<=360px`.

This is not the final B5 responsive sign-off. B5 still owns the complete viewport/theme/zoom/touch/safe-area evidence matrix.

## Deliberately unchanged

- canonical Create/Edit parser;
- draft-save required fields;
- route/time draft optionality;
- certification completeness;
- FCL.060 calculations;
- movement counter semantics;
- Role/landing/PF preset values;
- Safety Pilot / PIC collaboration;
- GPS import business rules;
- Costs/Billing semantics;
- schema / migrations.

## Regression coverage

Updated historical contract:

- `tests/v155-flight-entry-layout.test.ts`;
- `tests/v330-add-flight-simplicity.test.ts`.

New B2 contract:

- `tests/v339-new-flight-b2-essentials.test.ts`.

The B2 contract verifies:

- Date → Aircraft → Role order;
- grouped Route;
- single UTC timeline context;
- chronological time order;
- route/time remain optional for draft save;
- BLOCK/AIR continue to expose unavailable `—`;
- landing + PF evidence is visible in the collapsed summary;
- movement preset does not require reconfirmation;
- Edit keeps movement detail open;
- manual intro copy is reduced;
- Add aircraft is dominant only for the empty-aircraft state;
- responsive hierarchy rules exist;
- parser/certification boundaries remain untouched.

## Database / migration

**N/A.**

No persistence semantics or schema are changed.

## Verification state

Local verification on 30 September 2026:

- TypeScript: **PASS**
- targeted B2 / affected historical tests: **47/47 PASS**
- full unit/regression: **940/940 PASS**
- production build: **PASS**
- PostgreSQL: **N/A**
- authenticated browser: **DEFERRED TO CUMULATIVE LIVE REDESIGN SMOKE — NOT PASS**

The build completed successfully with Next.js 16.3.2. The only build warning was that Next.js ignored a package-lock.json outside the repository root; it did not affect the repository build result.

Filip chose to test the cumulative redesign live rather than attach protected Preview to production DB. That remains a deferred verification item, not a claimed pass.

## Next after B2

Merge B2, retain the deferred cumulative live UI smoke, then start:

**B3 — Profile summary + role-driven required context.**
