# GPS Save First — FlyTally Logbook everyday UI/UX roadmap

**Date:** 2026-10-24 · **Status:** OWNER PRIORITY APPROVED; DESIGN/AUDIT PLAN ONLY, NO RUNTIME CHANGE  
**Canonical baseline verified:** `filipto861/flytally-logbook` `main@e58c49d810cc53a25ca1ab553f9c3f720a4e6f6a`  
**Production baseline:** Vercel `filipito/logbook` READY deployment `dpl_DrHNSRTuXbuLbLdk38MJ9PpQjUnm` for Git SHA `5e75b68c42a3a0697a2ff395e6c4eb4d35eb89bc`. The current additional main commit implements Design Quality V2 documentation/advisory tooling, not a new application runtime build.

## Current owner decision — highest priority / supersedes earlier drafts

**P0: GPS import → review → SAVE a flight.** The owner reports that this is the **most frequently used** flight entry flow. The task is not just file picking or GPS maps, but the complete *ordinary one-flight* save journey: choose KML/GPX/CSV, see credible source/time warnings, choose aircraft and pilot Role/Crew, verify reviewable airports/UTC times and explicit landing/operational evidence, correct missing values, choose **Save draft** or **Save & certify flight**, receive server-confirmed outcome, view the saved flight and track and recover from errors without duplicates. Protect pilot agency and certification integrity.

**P1: Manual New Flight.** Preserve the existing New-only overview, basics, UTC time fields, conditional crew and explicit Save draft/Save & certify controls; then refine the matching UX after GPS save is easier and verified.

**P2: rest of classic Logbook UI**, starting with Flights/Flight Detail and continuing to Dashboard, Aircraft & airports, Statistics, Settings and sidebar consistency.

**Explicitly deferred:** a broad *multiple-GPS-flights editor redesign* and other GPS specialty features, despite the importance of the common GPS save path. Retain current split/import behavior and multiple-parts draft-only semantics. Independent GPS read-error [Draft #403](https://github.com/filipto861/flytally-logbook/pull/403) remains unmerged; audit that proposed feedback separately as a potential small G1 improvement, do not silently merge its divergent changes. Historical U0/U1/U2/mobile Draft PRs #377–#380 remain isolated/non-merge-ready.

**Decision history:** Earlier in #404, the user briefly emphasized generic classic UI, then Manual New Flight as priority 1. The **latest explicit user decision** is the common GPS **save** path first, because it is used most often. Those earlier plans remain in Git history; this revision is the current canonical ordering, not a claim earlier code was delivered.

## Reconstructed code flow (verified on main; static source, NOT live browser)

1. `app/(protected)/flights/new/page.tsx` mounts `FlightEntryWorkspace` with Manual and GPS modes. Existing GPS upper `EntryReviewSummary` action opens a **single** native KML/GPX/CSV picker; PR #401 made this exact source selection direct and is already independently merged/production READY.
2. `components/kml-import-form.tsx` reads/parses the selected file, classifies source and timezone quality, supplies advisory split/time/movement suggestions, offers track review and optional map. GPS does not prove aircraft, PIC, legal credit or missing date/time. The owner must review and apply inputs explicitly. File-reader exceptions currently have a source-level silent-catch path; separate Draft #403 proposes safe feedback (runtime behavior not browser-reproduced here).
3. The GPS `gpsReviewItems` list surfaces specific missing aircraft/profile, Role/Crew, Operation/Engine, billing and per-flight evidence items and links to the existing fields. The `ready` boolean requires authoritative user/profile context, credible airborne movement, per-part date/landing/launch evidence, applicable crew and acknowledged source warnings. In the **one-part ready** path, separate `PendingActionButton` instances render `Save draft` and `Save & certify flight`; they show pending state and block duplicate activation. For multiple parts only draft save is offered.
4. If not ready, the bottom `Complete flight details` action currently invokes `reviewImported()`, which tries a `.flight-review-card[data-ready="false"]` then a generic review card. **CODE-INFERRED UX RISK:** if the actual incomplete requirement is aircraft/crew/operation in a separately collapsed section, this bottom action may land at a per-flight card rather than the actual missing control. Top direct-to-issue actions already exist; do not assume the bottom behavior is broken without a rendered click/focus test.
5. `app/(protected)/flights/actions.ts` `importKmlFlight` independently reparses and validates uploaded source, owner aircraft authorization, context/roles, UTC/date/movements, quality warning acknowledgment, uniqueness and duplicate fingerprints, and transactionally writes Flight + Flight Track on success. On single-part `certify`, it calls `certifyStoredFlight` and redirects to the detail page with certified or blocked/deferred outcome; a draft redirects to the detail logbook tab. **Readiness in UI must never imply assured certification.** No new approval/compliance claim.
6. Existing `e2e/gps-rolecrew.spec.mjs` authenticates into an isolated test fixture and contains `3.4.0 single GPS Save & certify seals the imported persisted row` with server-side rejection of a forged file, successful redirect, certified record/hash and persisted track evidence. Existing `e2e/n3-m1-entry-review.spec.mjs` checks file chooser/invalid source/valid source and direct aircraft focus. These are *existing test definitions*; their presence does not mean they were executed for the current audit candidate. The full ordinary **draft/blocked/duplicate** visual flow must be measured separately or existing targeted coverage located.

## First audit target — G0 real one-flight save journey

| Stage | What the pilot must understand | Bounded evidence to collect |
| --- | --- | --- |
| **G0-A Source** | One obvious upload control, immediate response, file/source status and useful error/retry | Real top filechooser, invalid CSV, valid KML/GPX, read failure; no stale preview or extra upload zone |
| **G0-B Common context** | Which aircraft, pilot role and applicable operation/engine are needed, not inferred | PIC + DUAL + Safety Pilot synthetic fixtures, missing aircraft and unsupported profile; direct focus into collapsed section |
| **G0-C One-flight review** | What values are GPS-derived vs explicitly confirmed; which evidence blocks save | 1 credible flight, reviewed UTC and airports, landing/movement counts, missing and ambiguous timestamp, warnings; measure first field reachability |
| **G0-D Save action** | Clearly distinguish editable draft from certified/locked record; pending and no double save | Save draft and Save & certify, disabled/not-ready behavior, pending state, server validation errors and recovery; top status vs bottom action consistency |
| **G0-E Outcome** | Know definitively whether save succeeded, is blocked/deferred or failed | Actual redirect/detail, saved Flight+Track under synthetic fixture, duplicate guard, no ghost success/partial record on transaction rollback |
| **G0-F Device/visual** | Same clear path in cockpit/iPad and phone without missed controls | Browser screenshots/computed CSS at 1440, 1024, 768, 390, 320 widths, light/dark, keyboard focus, touch, reduced motion/zoom, relevant scrolled positions, card heights. Emulation != Safari |

**Source-backed historical visual baseline:** older isolated 2026-10-23 N3-D0 100-image capture reported one unreviewed flight at ~3,366 px full page height on 390px phone and one with aircraft selected at ~4,099 px. Those older sample heights motivate examining cognitive load and scroll reachability but do not establish current effective CSS or time to completion. Review today's rendered DOM and final cascade before changing styles.

**F0 Manual regression baseline (secondary)**: preserve `FlightForm` New/Edit shared behavior, role applicability, submission semantics and focus; do not ignore it when changing shared controls.

## Proposed milestones (small changes, milestone boundaries explicit)

| Milestone | Scope | DoD and exclusions |
| --- | --- | --- |
| **G0 — GPS saving evidence audit (FIRST)** | Reproduce common one-flight Source → Context → Review → Save → Detail, record current positions/focus/readability/error/responsive actual state. Read-only review with synthetic fixtures; successful test-DB save only in physically owned localhost fixture | No app/CSS change. Log exact SHA and source-vs-observed findings; never use live/remote DB. Distinguish draft, certification blocked/deferred and successful certification. |
| **G1 — First one-flight save UX fix** | From G0 select smallest high-frequency problem (likely incomplete-field navigation, long section prioritization or save feedback) with Apple V2 hierarchy, one primary action at a time, existing tokens and no motion | Exact measured before/after; unchanged parsers/domain/server, no auto-fill; browser accessibility and responsive acceptance. Don't rewrite multi-flight parts. |
| **G2 — GPS save completion and error polish** | Ensure helpful source/read errors, complete review state, pending/disabled/duplicate action, clear saved-vs-certified message and recoverable failure | Reconcile related Draft #403 on new main via review; preserve DB/transaction and certification safeguards. |
| **F0/F1 — Manual New Flight** | Next priority: review and simplify Manual entry, preserve New/Edit shared component and explicit draft vs certify. | No hidden fields or invented values; role/crew, UTC, edit correction and regulatory regression. |
| **C1–C4 — Classic Logbook consistency** | Then Flights/Detail, Dashboard, Aircraft/airports, Statistics, Settings and shell. | Existing FlyTally visual identity, CSS final cascade, small measured batches and acceptance. |
| **Release and checkpoint** | Candidate-bound risk planner, source/full Node, typecheck, build, guarded isolated PG16/browser, responsive/current themes, docs/Project Memory | No PR merge, Vercel production deploy, migration or feature-flag change without separate explicit owner approval. |

## Frozen DO NOT and methodology

The full Apple Design V2/17-area playbook, ui-ux-design, design-engineering, mobile-ipad, ui-quality-audit/Design Quality V2, flight-integrity and testing-quality apply. Safety and aviation correctness supersede aesthetic simplicity. Distinguish user-reviewed source data from computed suggestions and certified evidence. Unavailable ≠ 0; no inferred last aircraft/airport, no auto-apply, unknown GPS time stays ambiguous. Preserve current single vs multi flight save behavior, server authority, exact form names, finalization/correction audit and auth. No new dependency, brand/theme change, gratuitous motion, fake spinner, broad CSS cleanup, new database default, remote/prod destructive test or Training repo modifications. **Motion decision: NONE**.

## Evidence checkpoint / single next step

GitHub source and prior historical audit reports were inspected. A freshly executed current-SHA **G0 authenticated browser, screenshots, effective CSS/focus/readability, native iPad Safari, actual tests, PostgreSQL or production smoke has NOT RUN** in this docs-only roadmap amendment. Source inspection is not runtime verification; no app files changed.

**ONE NEXT STEP:** prepare/execute a *guarded isolated owner-local G0 browser capture* of the **GPS one-flight complete save**, including Save draft/Save & certify + server redirect and failure recovery, then compare actual states and choose one narrow G1 UI fix. Owner approval for implementation batch, merge, deployment and prod DB remains separate.
