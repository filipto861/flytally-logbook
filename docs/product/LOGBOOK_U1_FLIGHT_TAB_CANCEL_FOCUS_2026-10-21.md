# Logbook U1 — keyboard tab focus after cancelled unsaved switch

**Status:** Draft implementation / tests NOT RUN on this source head.  
**Source:** initial U0 source audit + separate Flight Detail implementation review; not falsely attributed to U0 screenshot coverage.  
**Scope:** `components/flight-detail-workspace.tsx`, one existing E2E regression and one focused source contract test.

## Before
Flight Detail uses `role=tablist` with roving `tabIndex`. ArrowLeft/ArrowRight/Home/End call `selectTab(nextTab)`, then unconditionally `nextTab.focus()`. When the active logbook form has unsaved changes and pilot cancels `window.confirm`, `selectTab` retains selected tab and preserved data, but focus moves to a **different, unselected tab**. Result: selected tab (`aria-selected=true`) no longer owns the keyboard focus, misleading keyboard/screen-reader interaction.

## Frozen behavior / Do Not
- Unsaved prompt wording and pilot decision remain unchanged.
- Cancel must retain the current tab, corrections and `unsaved` state; no hidden data discard or auto-approval.
- `submitting` must block real tab transitions; same-tab keyboard action may remain focused.
- Preserve existing tab order, ARIA roles, roving tabIndex, badges and focus affordance.
- No flight model, authority/recency, persisted state, CSS, migration or Training changes.

## Small implementation
- `selectTab` returns a boolean to report whether a proposed tab selection is accepted: true for already-selected tab and accepted switch, false when submitting or user cancels the unsaved-change prompt.
- Keyboard handler focuses `nextTab` **only** when selection was accepted. Pointer click and workflow-navigation call sites keep the same domain semantics.
- Existing certified-correction Playwright scenario now exercises ArrowLeft from `Logbook data` with a deliberately unsaved arrival field, cancels dialog, and checks focus/selection and unchanged unsaved edit.
- Added `tests/logbook-u1-flight-tab-focus.test.ts` source contract checks. Source assertions are **not** a substitute for E2E.

## Acceptance / verification
1. Branch exact-head `npm run test:target -- tests/logbook-u1-flight-tab-focus.test.ts`, TypeScript typecheck and related pre-existing tab/certification unit tests — **NOT RUN**.
2. Browser: `e2e/manual-authority-certification.spec.mjs` on a dedicated verified disposable database with canonical schema v21 — **NOT RUN**; do not reuse or weaken the U0-only browser harness. In particular no production database.
3. Manual keyboard: ArrowRight/Left/Home/End works without unsaved edits; switching with unsaved edits and choosing OK still selects/focuses target; Cancel keeps selection/focus/value; while submitting, no other tab focus.
4. Responsive/dark visual behavior unchanged; screen-reader/native iPad Safari — **NOT RUN**.
5. Keep PR Draft until targeted tests and independent review; no merge, deploy or migration based on code inspection alone.

## Branch and evidence
- Branch: `fix/logbook-u1-flight-tab-cancel-focus-20261021`, created from main `8099149f72d493c34dd59babf65bdb064ff99fc9`; no dependency on pending U0 PR #377.
- Local Node/Playwright/build/typecheck/DB: NOT RUN on this branch at time of authoring.
