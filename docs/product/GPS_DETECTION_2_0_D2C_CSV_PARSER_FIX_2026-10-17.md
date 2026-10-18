# GPS Detection 2.0 — D2-C narrowly scoped canonical CSV missing-data fix

**Date:** 2026-10-17
**Repository:** `filipto861/flytally-logbook`
**Branch:** `fix/gps-import-csv-missing-values` based on canonical `main@6a67a02475ab09c3271f8646427f7956ed6e590a`
**PR:** [#360](https://github.com/filipto861/flytally-logbook/pull/360) — **Draft, DO NOT MERGE/DEPLOY**
**Approval:** product owner expressly approved D2-C minimal CSV integrity correction on separate branch with no merge/deploy.
**Status:** code + 7 new regression cases AUTHORED. Node, TypeScript, full suite/build and browser **NOT RUN** on new branch; no CI evidence.

## Precisely implemented

- `lib/track-processing.ts::parseCsv`: parse a CSV numeric token only when it is nonempty and finite. Empty/malformed altitude -> `null`; explicit numeric 0 stays 0. Existing altitude header feet conversion retains `0.3048`. No new source sensor authority.
- A CSV row with missing, nonnumeric, infinite or out-of-geographic-range `lat`/`lon` makes the **whole import unavailable (`[]`)** instead of fabricating 0° or silently skipping a damaged row. Internal completely blank rows likewise fail; conventional trailing newlines are ignored. No partial import side effects.
- `trackStats`: valid numeric 0 altitude now contributes to `minAlt`/`maxAlt`; null and nonfinite are excluded.
- `KmlPoint` and `TrackInspection` shapes, UTC parsing, quoted CSV fields, header aliases, delimiter detection, source recognition, order/dedup, split and landing/T&G heuristics remain unchanged. KML and GPX parsers unchanged.

## Source consumer and compatibility assessment

| Actual consumer | Coupling and impact | Required verification |
| --- | --- | --- |
| `components/kml-import-form.tsx` | Calls `inspectTrackFile`; computes `trackQuality`, `landingCount`, `suggestedSplits`, `trackStats` and map review. Missing alt now null may change legacy suggestion/quality on malformed files. | Client preview + server parsed result parity; no auto-confirmed counts; review of empty CSV failure state. |
| `app/(protected)/flights/actions.ts::importKmlFlight` | Calls shared `parseTrackFile` on reuploaded source then checks movement, split, reviewed counts and certification. Invalid CSV now returns empty points and existing 'No usable GPS track was found.' error. | Server reparse, no false 0° persisted route; manual Day/Night and authorization/certification unchanged. |
| `lib/track-processing.ts` | Source CSV parser and `trackStats` share representation with other GPS calculations. | Test real 0, blank, invalid numbers, negative altitude, feet conversion, KML/GPX and legacy T&G/split. |
| Research PR #350 D2-A cases | Three historical `KNOWN UNSAFE` assertions intentionally assert old buggy parser. They are NOT included in `main` or this fix branch. | **Before #350 can merge, explicitly replace/rebase A01/A09/A10 against desired safe parser behavior.** Keep historical tested-SHA evidence in docs. |
| `components/gps-import-review-player.tsx` | Preexisting display null-altitude-to-zero fallback in profile/tooltip. | **Not included**: separate, browser-verified display fix before V2 UI activation. |
| Persisted flights and `lib/data/flight-track-review.ts` | Previous normalized zero values may have no original raw-source provenance. | No DB backfill/reinterpretation; P0 native RLS/no-write remains NO-GO. |

## Regression tests added

`tests/track-processing.test.ts`: 7 new desired-behavior cases, on top of 17 existing. Positive and negative fixtures check blank/null vs real 0, file-wide rejection for any missing/invalid latitude/longitude, true (0,0), 0 min/max altitude, SkyDemon quoted CSV with UTC date/time and feet conversion, nonempty malformed altitude -> null, and internal blank row vs trailing newline. Test fixture uses synthetic records only.

**Exact first owner-local target (not yet run):** `tests/track-processing.test.ts` (24), `tests/v351-gps-tg-reliability.test.ts` (6), `tests/v1381-gps-detection.test.ts` (3), `tests/v142-gps-import.test.ts` (6), `tests/v119-gps-landing-review.test.ts` (2) = **41 expected Node tests**. `npm run typecheck` separately. Counts are source inventory, NOT execution evidence. Follow with full `npm test`, `npm run build`, browser on desktop/iPad/mobile and auth/server import checks before any merge. Feature flag OFF cannot preserve acceptance of malformed CSV; intentional safety correction must be explicitly described to users if needed.

## Independent actual-source review handoff (DeepSeek / Claude)

**READ ONLY**: compare base `main@6a67a02475ab09c3271f8646427f7956ed6e590a` against Draft PR #360 on `fix/gps-import-csv-missing-values`. Inspect exact diff in `lib/track-processing.ts` and `tests/track-processing.test.ts`; also read consumers `components/kml-import-form.tsx` and `app/(protected)/flights/actions.ts`. **Do not modify code, DB, production, or PR state.**

Review questions: (1) Is empty-vs-real-zero fully preserved including whitespace/semicolon/quoted CSV? (2) Does whole-file refusal apply correctly when **any** parsed data row lacks valid position, without silent partial data or fake 0°? (3) Could a legitimate quoted multi-line or blank-line CSV previously accepted be rejected and is that scope acceptable? (4) Does `trackStats` treat NaN/nonfinite correctly and are consumers reliant on 0 sentinel? (5) Does a `null` altitude alter motion heuristics/legacy suggested count and require regression? (6) What client/server race, malformed-file or import UX risks remain? (7) Does the change need further owner sign-off before merge? Identify actual source lines and severity; classify verified fact vs hypothesis; reply GO TO OWNER-LOCAL VERIFICATION / FIX FIRST / BLOCKED. Source review alone never authorizes merge/deploy.

**No new source provenance or Pilot Review authorization:** `research` CSV lineage prototype from PR #350 is not imported here. Valid parsing/normalization is not proof of sensor altitude mode/datum/accuracy, runway/contact or whole-flight landing. No automatic GPS landing writes, migrations, Neon/PG16 access, real owner tracks or certified flight rewrite.

## Exit criteria

1. Owner clean exact HEAD, 41/41 targeted Node and `tsc --noEmit` PASS; no false green if a test fails.
2. Independent code-level review findings resolved, including cross-PR D2-A historical assertions.
3. Full relevant suite, build, browser/actual client-server import review and explicit owner merge/deploy approval **before** production release.
4. ROADMAP/FEATURES/CHANGELOG and PR evidence tied to actual tested source SHA, not subsequent docs-only commit.

**Next after D2-C:** D3 isolated advisory Pilot Review DTO and default-OFF integration, no auto-prefill/certification. Real saved-flight GPS use still blocked by P0-D3 native RLS/consent/zero-write evidence.

## 2026-10-18 — owner-local evidence and first-party actual-source review (NO MERGE)

**Source-specific owner acceptance:** owner PowerShell output for clean exact executable SHA `8fb1daa9cfd0b9005055e9d09592d27ac8b8333a`: targeted GPS Node **41/41 PASS**, separate `npm run typecheck` PASS, full Node `npm test` **1637/1637 PASS** (0 failed/skipped/cancelled/todo), `npm run build` (Next 16.3.2) PASS. This is **OWNER-LOCAL, NOT CI**; the subsequent documentation-only commits are not new executable test evidence. Links: [PR #360 conversation](https://github.com/filipto861/flytally-logbook/pull/360).

**First-party source audit; NOT an independent DeepSeek/Claude review:**
- `parseCsv` explicitly preserves blank/malformed altitude as null, valid numeric zero as zero and rejects entire file when a parsed row lacks a finite/in-range coordinate. `trackStats` counts finite zero; `inspectTrackFile` and server `importKmlFlight` both call the shared parser. The server returns before creating any flight/track on fewer than two usable points. These are *source observations*, not execution of authenticated browser assertions.
- **OPEN — browser coverage:** registered GPS browser targets exist (`gps-tracks` and relevant path targets), but inspected `e2e/gps-rolecrew.spec.mjs`, `e2e/advisory-presentation.spec.mjs`, and `e2e/map-layers.spec.mjs` upload KML fixtures rather than specifically exercising rejected CSV via the real client/server action. Even a green registered GPS browser suite alone does not prove the D2-C malformed-CSV end-to-end requirement. Add or execute specific bounded authenticated CSV client/server negative and positive checks; use only an independently owned disposable localhost PG16 fixture and canonical risk-based browser selection.
- **OPEN — truthful altitude presentation:** current `components/gps-import-review-player.tsx` maps `null`/absent altitude to numeric **0** for chart geometry and cursor text (`point.alt??0`, `a.alt??0`, `current?.alt||0`). This is a pre-existing presentation defect, intentionally not changed by D2-C. It must not be treated as verified zero-altitude evidence; separate browser-reviewed correction is required before Pilot Review activation; explicit product release assessment needed for D2-C.
- **OPEN — limited CSV grammar:** `parseCsv` remains a line-based parser, not a full multiline-quoted RFC 4180 reader; old source also split lines, so this is a known limitation rather than a newly demonstrated regression. Internal blank rows now fail whole-file by deliberate D2-C policy; trailing empty lines are tolerated. Reviewer should assess compatibility with real supported SkyDemon CSV samples before any release.
- **OPEN — numeric lexical policy:** `Number(token.replace(",", "."))` accepts some non-decimal JavaScript numeric spellings (e.g. hex `0x10`). Bounds still apply, but whether such tokens constitute malformed source under the D2-C fail-closed contract needs explicit independent review; do not silently broaden this fix.
- **OPEN — client file-selection race:** asynchronous `await file.text()` in `KmlImportForm` has no source-selection generation guard. Rapidly selecting different files could display stale analysis. Pre-existing, not included in D2-C; assess severity before exposing any pilot-facing new GPS review state.
- Research Draft PR #350's historic D2-A assertions remain separately unmerged and need deliberate safe rebaselining before that PR could merge.

**Review disposition: HOLD / REVIEW AND BROWSER EVIDENCE NEEDED.** No independent actual-source reviewer verdict or authenticated CSV runtime evidence yet. The exact code SHA has only the owner-local tests/build above. Browser/PG16/merge/deploy remain unproven or unauthorised. D2-C does not confer GPS sensor/AGL/contact accuracy, real owner GPS access, native RLS approval or Pilot Review availability.

**Next bounded handoff for DeepSeek (READ ONLY):** review PR #360 exact executable source `8fb1daa9cfd0b9005055e9d09592d27ac8b8333a` vs `main@6a67a02475ab09c3271f8646427f7956ed6e590a`, read `lib/track-processing.ts`, `tests/track-processing.test.ts`, `components/kml-import-form.tsx`, `app/(protected)/flights/actions.ts`, `components/gps-import-review-player.tsx`, and the three E2E specs above. Challenge: null-vs-zero integrity, CSV malformed coordinates and unsupported multiline handling, decimal-token lexical policy, rapid-upload race, absence of CSV actual-client/server negative E2E, correct release blockers. Identify exact lines, severity, confirmed vs inferred, and recommend FIX FIRST or GO TO BOUNDED BROWSER GATE; do **not** merge, deploy, query production, change DB or reclassify research as contact-truth.