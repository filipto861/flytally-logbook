# G3 — Visible GPS file-reading feedback; replacement remains available

**Scope:** FlyTally Logbook (`filipto861/flytally-logbook`), 2026-10-24. Verified baseline `main@1fe1e5d0928a46e18e674688bb92a431a89d1fb6`, deployment G2 `dpl_9e1Dhr7HdC67jMeSEA2vz5jxLUL5` READY at exact SHA. G1 and G2 have already been merged/deployed. Owner confirms production G2 works (**owner-reported functional smoke**, not synthetic read-error injection or native Safari automation).

## Source-inferred issue (not a browser-observed bug)
After selecting a GPS file, `components/kml-import-form.tsx` performs asynchronous `await file.text()` with no in-progress UI indication: analysis is cleared and the picker promptly returns to the idle upload prompt. Users with slower/bigger KML/GPX/CSV files cannot tell whether import is still reading; picking a second source is allowed by the existing `fileEpoch` guard.

## G3 interaction contract (Apple Design V2 / Design Quality V2)
- **Intent:** upload an ordinary single-flight GPS track; no special multi-flight editor/restructure.
- **On selection:** show **Reading GPS track…** in the established Entry Review title/description and a single adjacent **`role="status"`** message. Native file picker and existing upper action remain usable for replacing the selected file; no fake determinate progress, blocking overlay, spinner/animation, sound or new dependency. Existing one `role="alert"` remains exclusively for source/server failures.
- **Valid read and inspect:** clear reading status and render the exact existing GPS-source metadata plus review fields; do not alter inspection, source identity, UTC, role, consent, landings or save validation.
- **Read or processing error:** clear reading status before publishing the G2 safe single-alert message; invalid import stays unavailable for Save.
- **Race:** if file B is selected while file A is awaiting `file.text()`, only B's result/error may update visible state. Late completion of A must neither overwrite B's analysis nor clear B's reading message. A fresh empty change event clears reading state but native filechooser cancel without change event preserves current content. Existing `fileEpoch` remains the sole authority.
- **Aviation safety:** no autopopulation, no implicit certification/save, no assumptions on missing data; existing G1 first actual missing detail remains the completion control.
- **Motion decision:** NONE. Reuse existing `gps-track-source-status` and `EntryReviewSummary` CSS, no token/material/brand changes.

## Changed files and tests
- `components/kml-import-form.tsx`: local reading state, title/description/live status, epoch-guarded completion/error cleanup.
- `tests/n3-m1-entry-readiness.test.ts`: source contract; all prior G2 checks remain but now require clearing busy state on failure, plus G1/G2 preservation.
- `e2e/n3-m1-entry-review.spec.mjs`: extend **existing registered** authenticated N3-M1 browser case with intentionally unresolved synthetic File.text for `g3-slow.kml`, explicit pending status/no Save, replacement `g3-current.kml`, release stale prior promise and verify current source survives. Retains all former G1/G2 scenarios and responsive checks; do not add a new browser target or test fixture registration.
- Dated ROADMAP/CHANGELOG/Project Memory handoff. No CSS, DB/schema, migration, flag, dependency, server API, Training or Vercel changes.

## Evidence and gates
- Static advisory: source test regex conditions for G1/G2/G3 were all matched in-memory **49/49**, existing literal one-form-alert count **1**, E2E script V8 parse after import stripping PASS. These are **NOT actual Node24/Playwright/TypeScript/Next build passes**.
- Actual `npm run test:target`, full `verify:release:risk -- --base origin/main --rerun`, TypeScript, build, authenticated Chromium, fresh physically owned local PG16, native Safari/iPad, CI: **NOT RUN** at design/candidate creation.
- Before merge: run full exact-final-HEAD owner-local risk release according to authoritative planner with new disposable verified loopback-only PostgreSQL for selected authenticated Playwright, **plus** explicit actual persisted GPS Save & certify desktop/mobile if not selected; validate 320/390/768/1024/1440, keyboard/touch and existing supported themes. Historical G2 test PASS belongs to prior source SHA, not G3.
- Owner has **not authorized G3 merge, prod deployment, production DB/flags or Training changes**. Existing GPS multi-flight behavior stays unchanged.
- **ONE NEXT STEP:** exact-SHA guarded owner-local release verification of G3 Draft PR and review evidence before a separate owner merge decision.
