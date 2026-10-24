# G1 — GPS one-flight save: bottom completion action targets first missing evidence

**Date:** 2026-10-24  
**Repo:** `filipto861/flytally-logbook`  
**Verified base:** `main@e58c49d810cc53a25ca1ab553f9c3f720a4e6f6a`  
**Branch:** `fix/logbook-gps-save-first-issue-focus-20261024` · **Status:** implemented Draft; execution/release NOT RUN.  
**Milestone:** one bounded UX correction in owner-prioritized GPS → review → Save flow, not broad N3-M3 editor refactor.

## Evidence / root cause

**CODE CONFIRMED:** `components/kml-import-form.tsx` already constructs `gpsReviewItems` in order (aircraft, role/crew, operation, engine, billing, warning, per-flight evidence). Each item has an `onSelect` callback that opens a collapsed `details` section when required and focuses the relevant field with the existing `focusEntryIssue` behavior. But the bottom non-saving **Complete flight details** button passed a different `reviewImported()` callback that searched `.flight-review-card[data-ready="false"]` and otherwise the first generic review card. When common aircraft/operation was missing, that selector ignored the exact documented blocker above the flight card. This is a source-confirmed mismatch between two actions advertised as correcting incomplete details. Real-browser reproduction on the previous SHA was **NOT RUN**; prior authenticated N3-M1 browser test only verified the top direct-to-aircraft link.

## Frozen interaction contract

- On a usable GPS track with remaining details, bottom `Complete flight details` invokes `gpsReviewItems[0].onSelect()` and reuses the same existing direct-to-field focus path shown in top Entry Review. If Aircraft is missing, expand Flight context and focus Registration; with Aircraft set but Operation missing, focus Operation; then Engine; if neither, follow the next existing issue.
- For an unexpected incomplete state with **no** issue in the already assembled list, preserve the prior fallback to a relevant per-flight review card. `Upload track first` remains disabled without source.
- Keyboard/touch and reduced motion: no new animation, click/focus restores to existing semantic controls; fallback scroll behavior stays as before. Motion choice **NONE** for the new pathway.
- Preserve **Save draft**, **Save & certify flight**, `useFormStatus` pending/disabled, original file picker/required input, KML/GPX/CSV parser, `ready` semantics, server submission and certification, stored records, multi-flight draft-only workflow, Track/GPS/time/evidence/role data. No invented defaults, no automatic application.
- Do NOT merge separate #403 source-error changes into this branch; do NOT ship N3-M3 multi-part editor redesign by implication.

## Changed paths

- `components/kml-import-form.tsx`: move `reviewImported` after the existing `gpsReviewItems` list is filled and use its first explicit correction before original fallback.
- `tests/n3-m1-entry-readiness.test.ts`: source contracts verify order, shared issue callback and no submit.
- `e2e/n3-m1-entry-review.spec.mjs`: extend already-registered authenticated browser test with bottom first missing Aircraft → Operation → Engine and 320/390/768/1024/1440 width focus/overflow expectations. Existing top CTA and native file picker checks remain.
- Current dated report, roadmap/CHANGELOG and rolling handoff for facts/evidence only.

## Verification and limitations

- **CODE READ-BACK:** changed component/test/E2E blobs retrieved at exact work branch. Existing/new `assert.match(gps,...)` expressions: **26/26 match** in isolated V8 regex check; this is an **advisory match**, not `node --test` execution.
- **Pure callback simulation:** first issue path invokes only existing `onSelect`; empty issue list invokes old review-card scroll/focus. Both paths behaved as expected in minimal stubs; not DOM/Playwright evidence.
- **E2E source parsing:** V8 parse after import statements removed PASS; not Playwright execution.
- **NOT RUN on final work HEAD:** Node24 test command, TypeScript, full Node, `audit:design` scanner, Next build, isolated PG16 partitions, authenticated Chromium Playwright, actual before/after screenshots/computed CSS, native Safari/iPad and production smoke.
- **Test environment requirement:** use existing candidate-bound `npm run verify:plan -- --base origin/main` and protected `npm run verify:release:risk -- --base origin/main`. Browser/PG tests may mutate **ONLY** a fresh physically owned, disposable loopback PostgreSQL instance with exact approved schema-first Currency v20/v21 mode and backend guard. Never run a destructive authenticated fixture against Neon or an existing DB.
- **Acceptance:** bottom completion always points to the first actual missing issue when one exists, never submits, all server validation stays unchanged, pending actions remain separate, actual browser focus works in light/dark and 320/390/768/1024/1440, native input works on actual Safari when available. Source checks cannot close the milestone.

## Unrelated project state

- GPS single upload CTA #401 already merged and separately deployed: production Vercel `dpl_DrHNSRTuXbuLbLdk38MJ9PpQjUnm` for merge `5e75b68c42a3a0697a2ff395e6c4eb4d35eb89bc` at last verified checkpoint. Newer main `e58c49d810cc53a25ca1ab553f9c3f720a4e6f6a` contains Design Quality V2 skills/advisory docs.
- Owner GPS-save-first planning docs reside on **separate unmerged Draft #404**; this implementation branch reconstructs actual main independently. GPS read-error #403 separate/unmerged. Training unchanged.
- No production DB migration/restore/delete, feature flag change, merge or Vercel deploy.

**ONE NEXT STEP:** run exact-final-SHA local Node source+typecheck and risk-selected, guarded, schema-first authenticated Playwright GPS E2E on owned disposable PG16; inspect real screenshots/focus and complete G0 save/certify scenario before requesting owner merge approval.
