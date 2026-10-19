# GPS V2 R3-P1A — source-quality review contexts implementation

Date: 2026-10-19
Branch: feat/gps-v2-r3-p1a-quality-contexts-20261019
Parent: design/gps-v2-r3-pilot-review-inconclusive-20261019, Draft PR #370
Status: RESEARCH/QUALITY SIDECAR IMPLEMENTED; OWNER-LOCAL NATIVE TESTS AND 6-KML RUNS PENDING. No UI, import-save or production exposure.

## Frozen product and safety contracts

The owner approved proceeding toward an INCONCLUSIVE / pilot-review-only GPS altitude diagnostic, **not** a newly inferred touchdown, automatic new T&G, changed 25m/s threshold, new native V2 source support, certified/regulatory recency evidence or changed landing-count fields.

Verified existing runtime:
- `components/kml-import-form.tsx` has source text, exact canonical points, manual split cuts and legacy `landingCount(part)` landing suggestion/prefill. Existing manual review and save state remains unchanged.
- `lib/gps-v2-advisory.ts` is horizontal-only and returns canAffectCanonicalFlight false.
- `lib/gps-v2-import-lineage.ts` rejects multi-gx:Track with `UNAVAILABLE / UNSUPPORTED_SOURCE`, including original sample07. **This is unchanged.**
- R2-2 `research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts` uses node:crypto, and reports *counts*, not browser-ready contact contexts. Do not import it from production UI.

## Code staged

- `research/gps-detection-r21/stage-r3-p1a-source-quality-contexts.ts`: pure browser-compatible synchronous source-quality inspection; NO Node builtins. Calls already reviewed D4 `inspectD4MultiGxLineage(sourceText,canonicalPoints)`, so the original input is re-parsed and must match **every** canonical point before source-local edge indexes can exist.
- `tests/gps-v2-r3-p1a-quality-contexts.test.ts`: 18 authored synthetic/adversarial cases. Status: **NOT RUN; no CI claim**.
- `tooling/gps-v2-r3-p1a-quality-contexts.mjs`: OWNER-LOCAL Node CLI, which compares the number of P1A affected frozen-rejection windows with existing independent R2-2 frozen research comparator; fail-closed on mismatch. Prints only anonymous aggregates, never source edge indexes or source filenames.
- `tooling/gps-v2-r3-p1a-six-kml.ps1`: one-dialog private selection of exactly six original KMLs, maps source identity by previously verified (gx blocks, canonical fix counts) and outputs six approved anonymous result fields. No file contents saved or committed.

Only this isolated research module/tests/tooling and docs have changed. There is no new production import, feature flag, UI or stored flight value.

## Narrow quality-only data contract

Required input: exact sourceText, caller canonicalPoints, ordered explicit splitCuts and pinned expectedRevision. No guessed source, no default cached binding or implicit split. Any change requires synchronous new evaluation; mismatched source/canonical/unsupported dialect invalidates to `UNAVAILABLE`. No persistent state or globally shared source.

Accepted source shape is the bounded original `gx:Track` dialect **only insofar as D4.1 accepts and establishes exact provenance**. Its support in P1A NEVER upgrades native V2 multi-gx eligibility. Block discontinuities, colliding timestamps, altitude-conflicting adjacent dedup, split boundaries and implausible horizontal edges are unsafe as a continuous altitude-evidence span. Fail closed, never bridge them.

Frozen comparator replay (strictly contextual, not new detector): 3 valid before and after, ±2 index local min tolerance, ±10 prior/future evidence, at least 30m descent and climb, median-of-five horizontal speed 28–145km/h, timed intermediate climb, >25m/s height derivative on an observed adjacent source pair 0<dt<=15s between the closest 30m anchors.

**One problem edge → one quality context**. Two overlapping geometry windows depending on the same observed height step are merged by the original exact edge identity within one source split, NOT arbitrary spatial/time proximity or a guessed aircraft event. A context count is NOT an event count.

Every context has a local canonical source edge for potential future display, split number, affected source-geometry window count, `FIX_ENDPOINTS_ONLY` or `LONG_INTERVALS_UNASSESSED`, and no raw GPS coordinates, timestamps or altitudes. It is *internal ephemeral diagnostic data*, never to be logged, persisted or sent to the server. The public CLI **redacts exact source indexes**.

`LONG_INTERVALS_UNASSESSED` indicates at least one in-anchor >15s interval; that interval contains unknown intervening motion. For known sample07 the independent original-source offline check observed one 16.1-second interval inside both rejected windows. The quality card may point to a suspect measured edge only AFTER source parity, but cannot assert continuous motion or contact. This does not change the historical derivative guard's >15s skip behavior.

Outcomes:
- `UNAVAILABLE` and reason: missing/malformed/ambiguous/unsupported/blocked, invalid split, revision mismatch, context limit; no trusted context.
- `NO_QUALIFYING_DIAGNOSTIC`: bounded scan found no such source quality pattern, **NOT** proof of no T&G, no contact or accurate GPS.
- `QUALITY_REVIEW_ONLY`: one or more strictly source-backed contexts, NOT proposed runway contacts or suggested landings.
All outcomes pin physicalContact UNRESOLVED, actualLandings UNAVAILABLE, recencyEvidence UNAVAILABLE, canAffectCanonicalFlight false.

## Local-only prior independent KML reconnaissance (not P1A Node validation)

A separate PRIVATE Python reconstruction (not production code or native P1A) over original user-provided six KMLs computed approximate expected P1A behavior under the new stricter source-span rules:
- sample03: 0 quality contexts / 0 affected frozen reject windows.
- sample04: 1 quality context / 1 affected reject window.
- sample05: 0 / 0.
- sample06: 0 / 0.
- sample07: **1 quality context / 2 overlapping reject windows**, source-height shared edge; context carries unassessed >15s source interval.
- sample08: 0 / 0.

These are **expectations to check**, not test PASS or proof of actual landing. If the real TypeScript parity disagrees, FAIL CLOSED and analyze. No thresholds are tuned to force those sample values. Pilot claim for sample07 is first-person/uncorroborated and not independently certified contact. Neither R2-2 windows nor P1A contexts can be used for verified detection precision/recall.

## Verification plan and acceptance

From owner PC Logbook repository on the **exact R3-P1A topic branch** with Node >=24:

    git status --short
    git fetch origin
    git switch --track origin/feat/gps-v2-r3-p1a-quality-contexts-20261019

    npm run test:target -- tests/gps-v2-r3-p1a-quality-contexts.test.ts tests/gps-v2-d43-r2-2-shape-audit.test.ts tests/gps-v2-d43-r2-quality.test.ts tests/gps-v2-d43-r1-coverage.test.ts tests/gps-v2-import-lineage.test.ts tests/v351-gps-tg-reliability.test.ts tests/track-processing.test.ts
    npm run typecheck

Only after both are PASS, run six KMLs ON OWNER LOCAL MACHINE (not GitHub):

    powershell -NoProfile -ExecutionPolicy Bypass -File ".\tooling\gps-v2-r3-p1a-six-kml.ps1"

Select all six originals simultaneously. Report ONLY the script's anonymous summary; do not paste paths, raw original UTC, registration or route. Every native P1A CLI result must be compatible with frozen R2-2 counts or fail closed. Existing native V2 multi-gx must remain UNSUPPORTED_SOURCE and landingCount/flight fields unchanged.

### Targeted synthetic security/regression matrix

- One identical bad source edge inside two adjacent legacy geometry windows groups to one quality context, expected count parity vs R2-2.
- No discontinuity, no qualifying speed or insufficient heights => no quality context, NO claim of zero touchdown.
- Observed numeric height 0 is not NULL.
- >15s observation gap explicit, no continuous-motion inference; invalid 0/negative, >=60s or impossible horizontal changes do not create trusted contexts.
- Source block boundary across qualifying evidence, adjacent dedup conflict, same-UTC collision, source/canonical mismatch, stale upload/cut: unavailable or context invalidated.
- Explicit flight split isolation and unambiguous context ownership; no duplicate context per shared bad edge.
- Native V2 multi-gx still unsupported; default OFF and no new production import.
- No original private data in any API/CLI output, including failures.
- Original legacy T&G events and landingCount not mutated.
- User-facing UI/visual review and its responsive/browser gates are **P1B**, not part of P1A.

## Current closing status — NOT DONE YET

P1A module, 18 test cases, CLI, six-KML local runner and this implementation ledger are staged. **No native tests, `npm run typecheck`, full suite, build, Playwright, CI, owner-local new P1A CLI results, DB or deploy have run during this P1A implementation**. P1A is NOT engineering-closed. R2 historical 97/97 local PASS does not validate the new code. Main, legacy touchAndGoEvents/landingCount, native V2, UI/DB, certification, recency, flags and production are untouched. Parent R3-P1 design and parent research PRs remain Draft.
