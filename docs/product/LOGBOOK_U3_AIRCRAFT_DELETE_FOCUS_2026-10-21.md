# U3 — Aircraft delete completion focus / initial unsampled-workflows audit

**Date:** 2026-10-21  
**Repo/branch:** `filipto861/flytally-logbook`, `fix/logbook-u3-aircraft-delete-focus-20261021`  
**Base:** `main@8099149f72d493c34dd59babf65bdb064ff99fc9`  
**Status:** Design and implementation in isolated Draft PR; exact-head local runtime, source tests, typecheck, build, browser **NOT RUN**. Nothing merged/deployed.

## Scope and source finding

The U0 visual capture did **not cover** Aircraft Manage/delete, aircraft photo crop, Flight Detail edit/correction, or GPS import. This U3 milestone inspects these high-value interactive workflows from source rather than claiming additional screenshot coverage.

- **Aircraft manager — source-confirmed keyboard focus loss on successful deletion:** `components/aircraft-manager.tsx` has a proper modal Escape/tab loop and `closeModal()` returns focus to the "Manage aircraft" opener. However, the successful `deleteSelected()` path currently calls `setLibraryStatus(result);setSelectedId(null)` without returning focus. The modal is removed, and its opener belongs to the aircraft card that is being deleted; focusing it is not a reliable fallback after the card disappears. `libraryStatus` already renders a visible confirmation paragraph outside the dialog with `role="status"`.
- **Aircraft photo/crop:** `components/aircraft-photo-editor.tsx` already has Escape, tab loop, opener-focus restoration, processing errors and save pending feedback. Do **not** reimplement that prior fix based on stale audit history.
- **Flight Detail tabs:** on canonical main, keyboard navigation still has a cancellation/focus mismatch. It is **already** addressed independently in draft U1 PR #378 with owner-local evidence. Do not duplicate into U3.
- **GPS import:** `components/kml-import-form.tsx` uses source-backed parsing, explicit user review and `PendingActionButton` on save. Its multi-part, aircraft and evidence workflows need dedicated authenticated visual/interaction coverage; no additional GPS regression claimed solely from this read-only review. V2 research is retired; no revival here.
- **Flights mobile categories:** independently staged in Draft PR #380, not combined here. U2 typography remains separate in Draft #379.

## Frozen U3 micro-batch solution

After a **successful** delete action only, focus the visible, non-interactive library confirmation outside the removed modal; it must be programmatically focusable (`tabIndex=-1`), keep its current role, copy, styling and DOM order. Schedule focus from a React effect so the target exists after the modal unmounts; cancel pending animation on effect cleanup. Failed deletion keeps modal open and its existing inline alert; the normal Escape/Close focus return remains unchanged.

**Do not** modify the delete server action, eligibility check, flight count, soft/hard-delete behavior, any data model, aircraft count, photos, rates, stored flights, certification evidence, migration, auth, design tokens, or GPS code.

## Acceptance (NOT RUN until user executes)

1. Focused read-only source regression: success results render and focus the `role=status` library confirmation; failure leaves dialog open; normal Close/Escape still return to opener, no new unguarded delete. No reimplementation of crop UI.
2. `npm run typecheck`, `npm run build` on exact Draft head.
3. Authenticated browser on **named isolated synthetic DB only**, exact source and user permission verified first: keyboard-open no-flight aircraft → Delete aircraft → Delete permanently → modal disappears → success status visible and focused. Ensure keyboard can proceed to next control; no focus to removed DOM. Blocked aircraft with saved flights must keep delete disabled; failed delete keeps inline error and dialog. Escape, Cancel/Close return opener. Desktop Chromium plus iPad/mobile viewport and light/dark when feasible. Explicitly distinguish emulation from native Safari.
4. No production data change, no merge/deploy without owner authorization. If browser E2E needs new data fixtures, design and review isolated fixture setup before executing any destructive SQL.

## Deferred U3 route-wide audit

Create an evidence matrix for Aircraft crop/photos, Flight Detail correction, GPS multi-part import, Statistics and notifications on synthetic authenticated pages, including focus, primary CTA, pending/error/empty states, truncation, 320/390/768/1024 widths, light/dark. Treat U0 unsampled areas as **not visually verified**. Prefer one concern per small batch; do not conflate with U1/U2/U0-R01. After evidence review, prioritize fixes by severity/verified frequency.

## Verification ledger

- Source inspection of current main and PR separation: **DONE** (GitHub connector).
- Exact-head Node tests/typecheck/build/browser: **NOT RUN**.
- DB/migration: **N/A for source patch**; no mutations attempted.
- Merge/deploy: **NONE**.
