# UI/UX Simplicity 2026 — B1B Completion Semantics

**Status:** IMPLEMENTED IN BRANCH — VERIFICATION PENDING  
**Date:** 30 September 2026  
**Branch:** `feat/new-flight-b1b-completion`  
**Parent contract:** `docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`

## Goal

Remove duplicate pre-save review/readiness UI from New Flight while preserving the canonical draft-save → saved review → certification workflow.

B1B is a presentation/workflow batch. It does not change the flight parser, persistence schema, certification payload, recency model, UTC semantics, aircraft-profile validation or optional-cost domain contract.

## Implemented runtime changes

### New Flight completion

The full inline `Review before save` card is removed.

New Flight now has one form-level completion surface at the action bar:

- if draft-save blockers exist, it shows **Complete before save** plus the canonical blocker names;
- if no blockers exist, it shows only the concise consequence copy;
- unsaved-change state is kept in the same completion area;
- the only primary create action is **Save & review**;
- Edit keeps **Save changes**;
- **Save and add another** is removed from initial entry;
- duplicate-submit protection still uses `PendingActionButton`.

The removed card no longer shows a synthetic `? → ?` route or a second `Ready to save` status.

### Relocated information

Information that was unique to the deleted review card is not discarded:

- logbook/evidence context remains in **Aircraft & logbook**;
- selected-aircraft origin is visible in the Aircraft & logbook summary as `from <registration>`;
- detailed profile-origin explanation stays with that section;
- unsaved-change state moves into the action/completion area;
- movement summaries remain in Flight experience;
- costs remain in Costs;
- BLOCK/AIR remains in the live timeline summary.

B2/B3 may further compact these summaries, but B1B does not remove the evidence.

### Post-save Add another

The existing successful-create redirect remains:

`/flights/<id>?tab=logbook&saved=1`

The saved review workspace already consumes this one-time state and opens Logbook data.

B1B adds a transient post-save handoff containing:

- **Flight saved.**
- **Add another flight** → `/flights/new?added=1`

The query state is still removed from browser history after the handoff, so the action is only offered as part of the successful save transition rather than as a permanent flight-detail action.

The existing server-side `intent=another` redirect is retained as backward-compatible behavior, but the New Flight UI no longer emits that intent.

## Certification boundary

No route/time hint is added to New Flight.

Departure, Arrival and timeline remain optional for draft save exactly as before.

The saved Review/certification path remains authoritative for FCL.050 completeness. Existing `blockingComplianceIssues(compliance)` behavior is unchanged.

## Accessibility

- the saved confirmation text uses a status live region;
- the interactive **Add another flight** link is outside that live-region node;
- one primary PendingActionButton remains in New Flight;
- no custom ARIA disclosure behavior was added.

## CSS / responsive behavior

The New Flight completion grid changes from three columns:

`status + Save & review + Save and add another`

to two:

`status + primary save`

On narrow screens it remains a single-column action stack.

The post-save handoff is horizontal on larger screens and stacks the text + Add another action on mobile.

Full cockpit/iPad/mobile matrix remains part of B2/B5; B1B requires targeted source/unit/build verification before merge.

## Regression coverage

Updated historical/source contracts:

- `tests/v125-guided-flight-entry.test.ts`;
- `tests/v240-flight-entry-review.test.ts`;
- `tests/v330-add-flight-simplicity.test.ts`.

New B1B contract:

- `tests/v338-new-flight-b1b-completion.test.ts`.

The B1B contract checks:

- no inline Review-before-save card;
- no `Ready to save`;
- no initial Save and add another;
- exactly one emitted `intent=save` control in FlightForm;
- one blocker surface in the action area;
- origin/unsaved information relocated;
- Add another appears only in post-save workspace state;
- saved redirect remains review-first;
- old server intent remains compatible but unused by the current form;
- route/times are not promoted to draft blockers;
- FCL.050 certification blocker plumbing remains;
- responsive completion/post-save CSS is present.

## Database / migration

**N/A.**

B1B does not alter persistence semantics or schema.

B1A production DB metadata evidence remains authoritative for optional Costs.

## Verification state

Evidence from Filip's local run on 30 September 2026, before the stale-contract test reconciliation:

- TypeScript: **PASS**
- initial targeted B1B/historical set: **20/22 PASS, 2 FAIL**
- initial full unit/regression: **928/934 PASS, 6 FAIL**
- production build: **PASS**
- PostgreSQL: **N/A**
- authenticated browser: **DEFERRED TO LIVE REDESIGN SMOKE BY FILIP'S CURRENT DECISION**

The six unit failures were inspected individually. They were stale source-contract expectations superseded by B1B, not runtime/data regressions:

1. v1.47 expected initial `Save and add another`;
2. v1.53 expected initial `Save and add another`;
3. v1.57 expected the old exact `Complete before save:` copy;
4. v2.4 expected the same old exact blocker copy;
5. v3.3 U11 prohibited any `flight-post-save` handoff even though B1B intentionally adds a transient secondary Add another action there;
6. the new B1B test looked for literal `Off-block` / `On-block` wording instead of the canonical compliance field/message contract.

Those six tests have now been reconciled to the frozen B1B behavior. **Rerun is pending on the reconciled test head.**

TypeScript and production build evidence remain runtime-equivalent because the reconciliation changed tests/docs only after Filip's successful run.

Browser is not reported as PASS. The plan remains to validate the cumulative New Flight presentation live after merge rather than attach protected previews to the production DB.

## B1A live-smoke carryover

B1A was merged in PR #174 with authenticated optional-cost UI smoke explicitly deferred to live verification.

That live item should be checked together with the cumulative New Flight redesign before final UI/UX Simplicity closeout.

## Next after B1B

After B1B code/test/build verification and merge:

**B2 — Essentials hierarchy + visible movement evidence.**
