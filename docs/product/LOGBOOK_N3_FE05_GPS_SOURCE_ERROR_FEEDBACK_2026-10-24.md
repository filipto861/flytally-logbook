# N3 FE-05 — GPS file selection failure feedback (Draft PR #403)

**Date:** 2026-10-24  
**Repository:** `filipto861/flytally-logbook`  
**Verified base:** `main@e58c49d810cc53a25ca1ab553f9c3f720a4e6f6a`  
**First changed source/test commit:** `9f084e83242316be54be1b8f5066724951f05eac`  
**Work branch:** `fix/logbook-gps-source-read-feedback-20261024`  
**Status:** implemented on Draft #403, **release verification NOT RUN**, unmerged, unshipped. Documentation commits advance HEAD without inheriting test results.

## Why this specific fix

The owner-approved N3 discovery identified FE-05: the GPS importer reset analysis and returned silently from `catch{return}` when a selected file failed `file.text()`. The user would see the upload prompt again but would not know whether the file read failed or the selection was discarded. A rejected or malformed file can produce an unexpected parser exception. This is a **CODE-INFERRED** error-state defect verified from the current source at `components/kml-import-form.tsx`, not a screenshot-verified production incident.

The previously captured N3-D0 100-image synthetic baseline documented an excessively long multi-part review; that is **separate N3-M3 work**, not silently included in this patch. Older Draft #377–#380 remain separate.

## Interaction contract — Apple Design V2 / Design Quality V2

| Stage | Trigger and response | Safety / accessibility |
| --- | --- | --- |
| Initial | The one existing styled `Upload a KML, GPX or CSV track` action opens the native file chooser. | Original required `name=kml` input remains; no second upload CTA. |
| Valid file | Existing `inspect()`, review split/aircraft and `Change GPS track` continue unchanged. | No new data defaults or automatic certification. |
| File read rejects | Clear stale analysis as before; announce “Unable to read the selected GPS file. Choose another KML, GPX or CSV track.” | `role=alert` adjacent to source input; no raw error; save remains unavailable. |
| Unexpected parser exception | Announce “Unable to process the selected GPS file. Choose a valid KML, GPX or CSV track.” | Same fail-closed behavior; still calls original canonical `inspect()`; no fabricated GPS points. |
| Retry | Same upper picker opens again; a new selected file clears the previous alert. | Failed older asynchronous reads cannot override a newer selection (`fileEpoch`). |
| Empty file-change event | Existing analysis/reset path is preserved; no stale analysis is treated as valid without a file. | Normal native chooser cancellation without an emitted change event is unchanged. |

**Motion decision:** `NONE`. No new animation/scroll/blur/material or dependency. Existing focus, touch, Save and split interactions are not redesigned. Preserve approved FlyTally colors, type, control sizes and spacing.

## Changed paths

- `components/kml-import-form.tsx`: local `sourceError` state; guarded catch for file reading and processing; visible accessible safe error.
- `tests/n3-m1-entry-readiness.test.ts`: source contract checks actionable error, fail-closed missing selection and retention of the canonical parser.
- `e2e/n3-m1-entry-review.spec.mjs`: extend *existing registered browser target* with simulated unreadable File, alert, retry and valid KML status; no new test runner/registry ownership.
- `ROADMAP.md`, `CHANGELOG.md`, and rolling Project Memory: dated factual checkpoint only.

## Verification / acceptance

- **STATIC SOURCE CHECK (advisory only):** 30/30 source patterns matched the changed component via V8 expression checks. Browser module is parseable after import stripping; this is not `node --check` on the checked-out repository.
- **NOT RUN:** actual Node24 `npm run test:target`, `npm run test:design-audit`, full `npm run audit:design` scan, TypeScript, build, PostgreSQL, Chromium Playwright, native Safari/iPad/VoiceOver, CI and production smoke.
- **Owner-local next evidence:** clean branch exact HEAD and base; `npm run test:target -- tests/n3-m1-entry-readiness.test.ts`; `npm run typecheck`; `npm run verify:plan -- --base origin/main`; risk-planned protected `npm run verify:release:risk -- --base origin/main` with owned isolated new loopback PG16 fixture for any required authenticated browser/PG tests. Never point test fixture reset at Neon or another existing DB. Check 320, 390, 768, 1024, 1440; light/dark; keyboard/touch and visible alert/recovery. Emulation is not native Safari.
- **Acceptance:** read/parse failure produces truthful visible/accessibility feedback; one chooser remains; valid retry completes old review; existing import/save rules and source identity preserved; no stale success or auto-fill. Inspect actual rendered CSS/DOM and error states before closing.

## Scope boundaries and project state

Source-tested GPS one-button PR #401 **merged and deployed** at Vercel `dpl_DrHNSRTuXbuLbLdk38MJ9PpQjUnm`, production Git SHA `5e75b68c42a3a0697a2ff395e6c4eb4d35eb89bc`. New Design Quality V2 methodology is on GitHub main `e58c49d8...` but not independently deployed; those docs/tooling do not change application runtime.

Do not merge/deploy PR #403 without separate owner approval; no remote DB changes, migrations, feature flags, Training changes, parser replacements, split detection changes, hidden auto-fill, new visual branding or full N3-M3 editor.

**ONE NEXT STEP:** obtain actual owner-local source/typecheck/risk-planned authenticated browser evidence on final PR #403 HEAD and review any failures before deciding whether to request merge approval.
