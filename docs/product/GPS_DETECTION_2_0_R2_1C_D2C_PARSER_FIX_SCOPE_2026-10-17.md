# GPS 2.0 — D2-C minimal production parser integrity correction: READY FOR APPROVAL, NOT CODED

**Date:** 2026-10-17  
**Repo:** `filipto861/flytally-logbook`; research Draft PR #350.  
**Source inventory:** `lib/track-processing.ts` from same branch as D2-B2 tested source `25d0efdb9b46cf096b01f7191ed645d7a09d620b`; `components/kml-import-form.tsx`, `app/(protected)/flights/actions.ts`, `tests/track-processing.test.ts`.  
**Product direction D1–D5:** APPROVED for Pilot Review; **D2-C production parser change requires separate explicit owner scope approval and independent actual-source review.** No production code changed during this audit.

## Why D2-C blocks Pilot Review

D2-A tested 110/110 and reproduced three *known unsafe* semantics; D2-B1 120/120 and D2-B2 130/130 synthetic research tests passed on exact owner SHA but deliberately did **not** fix production parser. Real GPS CSV import still uses current `parseCsv` under `lib/track-processing.ts`.

1. **Blank altitude → 0**: `parseCsv`'s helper `Number((value||"").trim()...)` returns `0` for empty cell, silently conflating unknown altitude with measured zero.
2. **Blank latitude/longitude → 0**: same numeric coercion allows a missing coordinate to masquerade as equator/Greenwich; must reject an unusable point or fail the affected file, not invent position.
3. **Real zero altitude excluded from extrema**: `trackStats` filters `value!==0` despite valid `KmlPoint.alt=0`. Must distinguish real 0 from null.
4. **Source-row identity is not persisted**: `normalize` sorts/deduplicates samples. This is a **distinct source-trust issue**; do not piggyback new persistent row mapping or wholesale parser rewrite into this minimal safety fix.

## Actual consumer/dependency inventory (read-only GitHub source)

| Consumer | Verified current coupling | Mandatory acceptance |
| --- | --- | --- |
| `lib/track-processing.ts` | `parseTrackFile` chooses KML/GPX/CSV; `normalize` sorts/dedups; `trackStats`, `landingCount`, `hasAirborneMovement`, `touchAndGoEvents` use parsed values. | Only correct absent/invalid CSV numeric semantics and preserve `KmlPoint` type, positive/negative legitimate values and backwards compatible KML/GPX. Do not tune motion thresholds or change sorting/dedup. |
| `components/kml-import-form.tsx` | Client calls `inspectTrackFile`, then derives `suggestedSplits`, `trackTimeBasis`, `reviewFor` (including `landingCount`), `trackStats` and map/quality rendering. | New missing altitude cannot auto-imply zero or confirmed landing; form still explicit manual Day/Night review. Test client/server parity on the *same* input. |
| `app/(protected)/flights/actions.ts::importKmlFlight` | Server reparses uploaded file, revalidates splits/flight movement and explicit count consistency, then normalizes and persists canonical flight. | Same parse semantics on server; invalid coordinate cannot be stored as a 0° location; no bypass of existing auth, movement review, multi-flight draft/certify gates. |
| `tests/track-processing.test.ts` | 17 existing positive/regression tests for CSV quotes, date/time, KML/GPX, T&G and splits. | All preserved (plus exact corrections below). |
| `tests/gps-detection-r21-d2a-parser-characterization.test.ts` | A01/A09/A10 deliberately assert *unsafe* current output, with labels KNOWN UNSAFE. | **Replace these three assertions** with corrected desired-behavior contracts in the same change. Never keep old green defect tests or claim unchanged 130 baseline. |
| `components/gps-import-review-player.tsx` | UI uses null-to-zero fallback for some altitude chart/tooltip paths. | **Separate UI/visual fix**, require browser evidence; not included in parser patch. |
| `lib/data/flight-track-review.ts` | Reads persisted first track, has RLS/owner/strict no-write open. | No DB/schema/backfill/read. Prior records cannot be retrospectively corrected without original source. |

## Proposed minimal patch (after owner approval, not performed)

**D2-C1** `lib/track-processing.ts` only: replace the CSV numeric helper's implicit empty/invalid zero with strict shared CSV token parsing so blank coordinate means unusable fix (reject or skip with explicit diagnostic; product default recommend **fail file closed when a CSV row has missing lat/lon**, rather than silently deleting it), blank altitude becomes `null`, valid `0` is preserved; `trackStats` includes finite numeric zero in altitude extrema. Keep headers/delimiter/quoted CSV handling, time behavior, source recognition, altitude ft-to-m, KML/GPX and legacy motion thresholds untouched. Explicitly define behavior for a genuinely malformed nonempty altitude token (recommend `null` with a review warning rather than `0`; warning/line mapping requires scoped design and must not silently impute).

**D2-C2** targeted characterization/test update + negative tests for mixed blank/real 0, malformed numeric, blank lat/lon, real lat/lon 0 and source ft conversion. Verify the UI and server paths still agree and no existing import-save fields/flight counts are autopopulated differently without explicit review. Rerun all GPS/parser targeted Node, full relevant regression and TypeScript, then build and suitable Playwright client/server import smoke with feature flag OFF.

**D2-C3** independent source-level DeepSeek review: compare actual minimal diff with these acceptance conditions and actual parser consumer links; scrutinize silent row skips vs file refusal, missing-vs-zero canonical facts, changed legacy `landingCount` suggestions, KML/GPX parity and case preservation. Review must inspect code, not just a summary. Reconcile findings before merging.

**Stop conditions:** any unknown migration/backfill requirement, large behavioral change to legacy T&G, unproven server/client parity, a new source authority claim, or unexpected test regressions. Stop and ask owner rather than widening the patch.

## Go/no-go request

**Owner product decision needed for D2-C:** approve a **minimal production parser safety correction** scoped exactly to missing altitude/coordinates + real zero in extrema, on a small `fix/gps-import-csv-missing-values` branch, with explicit tests and external code review. No deploy or merge is implied by approval. Recommend **fail closed for a CSV file with missing lat/lon**, rather than silently skip a row; preserve missing altitude as null. Provenance mapping/format expansion and display issues remain separate milestones.

**Current execution status:** design/inventory only, D2-C code/tests/build/Playwright **NOT RUN**, no DB/PG16/Neon, owner private GPS, migrations/merge/deploy. D2-B2 last tested code exact `25d0efdb9b46cf096b01f7191ed645d7a09d620b`: 130/130 targeted Node + TypeScript PASS **owner-local**, not CI.
