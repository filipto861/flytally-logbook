# G2 — GPS source failure feedback (rebased after deployed G1)

**Date:** 2026-10-24  
**Repo:** `filipto861/flytally-logbook`  
**Verified baseline:** `main@80a83ddcb5a13962e975ba7933b8472da6afd4c5` · deployed `fly-tally.com` Vercel `dpl_4qY8BpkBrYS6gDwuinZjiz9LAtqM` READY for this SHA  
**Work branch:** `fix/logbook-gps-source-error-g2-20261024`  
**Status:** implemented small UX batch / source check only; **runtime release evidence NOT RUN**, not approved for merge or production deployment.

## Product feedback and owner-verified G1 result

The owner reported after production deployment that the **Complete flight details** first-missing-field focus and GPS save work correctly. This is **OWNER-REPORTED production smoke PASS** for the specifically confirmed interactions, not a complete authenticated automated production suite, WCAG check, or native iPad Safari result. G1 is fully merged and deployed. Continue small Apple Design V2 / Design Quality V2 improvements; priority remains the ordinary **one-flight GPS upload → explicit review → save**, followed by Manual New Flight. No multi-GPS editor redesign.

## Source-confirmed G2 defect and why old PR is not merged

In current main `components/kml-import-form.tsx`, the source picker has `try{source=await file.text()}catch{return}` after clearing the existing analysis. Read failures silently revert to upload state, with no reason or recovery guidance. An unexpected exception in `inspect(source,file.name)` can also escape without user-friendly feedback. This was previously proposed in Draft [#403](https://github.com/filipto861/flytally-logbook/pull/403), **which is now UNMERGEABLE** against deployed main (its old component/test changes omit G1). Do **not** cherry-pick/merge the full old PR: reconstruct only the bounded G2 fix on current main. Existing invalid-but-successfully-read files already have a dedicated unusable-source message; that behavior remains.

## Frozen scenario and minimal change

1. Existing **Upload a KML, GPX or CSV track / Change GPS track** opens one native file chooser; existing required `name=kml` input stays untouched. No extra chooser, CSS library or layout redesign.
2. A new user file selection clears previous `sourceError`, previous analysis/reviews/overrides and GPS-warning acknowledgement as before. Selection without a file retains the current fail-closed reset behavior. Native cancel without a `change` event leaves current form alone.
3. `File.text()` rejects: show inline `role=alert` **“Unable to read the selected GPS file. Choose another KML, GPX or CSV track.”**. Do not expose raw exception text, invent analysis or allow Save. A stale asynchronous file read failure must not overwrite a newer selection (`fileEpoch`).
4. Unexpected local `inspect()` exception: show distinct safe `role=alert` **“Unable to process the selected GPS file. Choose a valid KML, GPX or CSV track.”**. Keep the original parser and server-side authority; do not interpret rejected data as any flight.
5. On valid retry, clear the alert; re-enter previous GPS review workflow. G1 bottom **Complete flight details** must still target the exact first missing item; test preservation explicitly.
6. Motion choice **NONE**, existing FlyTally `form-error` semantic style reused, no visual effects/rebrand. Effective final CSS needs actual browser inspection, not inferred from a source selector.

## Files / acceptance

- `components/kml-import-form.tsx`: error state + guarded file read/inspect + inline accessible alert; source and save logic unchanged otherwise.
- `tests/n3-m1-entry-readiness.test.ts`: canonical parser still present; fail-closed path, two distinct messages, race guard, accessible status and deployed G1 focus preserved.
- `e2e/n3-m1-entry-review.spec.mjs`: extend the existing registered authenticated N3-M1 GPS acceptance to inject synthetic `File.text()` rejection, check alert/no stale status/no Save, then successful retry via the same top picker; retain G1 Aircraft/Operation/Engine focus and phone/iPad width checks.
- Dated scope, ROADMAP/CHANGELOG/Project Memory checkpoints. No new dependencies, database or migration or production flag. GPS parsing, UTC, aircraft/roles, billing, split handling, server authorization, duplicate protection, persisted data, certification and multi-part draft-only behavior **DO NOT CHANGE**.

**Verification now:** GitHub source/test/E2E read-back and in-memory V8 **37/37 existing/new GPS source regex expectations matched**, existing registered browser script parses in V8 with imports stripped. These are **advisory checks only**; not actual Node test execution, TS compilation, locked Playwright browser or computed CSS.

**NOT RUN:** `npm run test:target -- tests/n3-m1-entry-readiness.test.ts`, TypeScript, full risk-selected Node/build, protected schema-first disposable PG16 authenticated Chromium browser, actual screenshots/focus light/dark, native iPad Safari, GitHub Actions, production smoke.

**Exact candidate release plan:** owner-local clean checkout of the final new Draft PR HEAD, read authoritative `npm run verify:plan -- --base origin/main`, run `npm run verify:release:risk -- --base origin/main` with all required fresh gates; physically prove a NEW EMPTY LOCAL-only owned loopback PG16 before any browser fixture mutation. Confirm the registered N3-M1 browser test selected and executed desktop+mobile, and existing Save & certify flight+track test is still covered (run separately if not risk-selected, as in G1), with zero skips/retries. Keep actual user/GPS/flight data out of fixture and logs. Do not run against Neon/remote/prod.

**ONE NEXT STEP:** execute the exact-new-PR-HEAD owner-local guarded test plan, then inspect real error/retry interaction and request a separate owner merge decision only after PASS.
