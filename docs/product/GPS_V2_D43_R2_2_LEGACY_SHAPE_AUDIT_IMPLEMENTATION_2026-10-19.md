# GPS V2 D4.3-R2-2 — Frozen legacy altitude-shape audit

**Date:** 2026-10-19
**Branch:** research/gps-v2-d43-r2-2-shape-audit-20261019, child of closed research-only R2-1 branch.
**Status:** IMPLEMENTATION STAGED / LOCAL TESTS NOT RUN / CORPUS NOT RUN / NO PRODUCTION AUTHORITY.
**Authorization:** User explicitly selected R2-2 by continuing after a direct R2-2 offer. The user waived optional DeepSeek review, not correctness or local verification.

## Research objective

Explain why existing legacy rolling-T&G source-height shapes pass or fail already frozen 3.5.1 predicates. The primary question is whether sample07's observed GLOBAL >25m/s R2-1 source-height edge is also within a legacy qualifying evidence span that the existing guard rejects. Do not assume they coincide and do not label any shape a physical landing.

R2-2 NEVER infers contact or automatic landings and does not edit production parsers, counters, recency, import, UI, flags, DB or flight records. No new detection threshold or altitude continuity inference.

## Delivered

- research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts: bounded legacy predicate shadow, original-source D4.1/R1/R2-1 recomputation, source/split local equality token; shadow parity against unmodified touchAndGoEvents altitude outputs on each explicit partition, else UNAVAILABLE / LEGACY_PARITY_MISMATCH.
- tooling/gps-v2-d43-r2-2-shape-audit.mjs: owner-local aggregate-only anonymous CLI.
- tests/gps-v2-d43-r2-2-shape-audit.test.ts: 18 authored synthetic/adversarial cases (NOT RUN).
- Project docs and draft research PR.

## Data and output contract

A geometryWindow is a frozen legacy 30m-descent/minimum/30m-climb source pattern with 3 valid heights before/after inside original +/-10 source fixes and original +/-2-fix local minimum tolerance; it is NOT a new aircraft manoeuvre selector. Several overlapping windows can represent one source shape.

All output fields are anonymous integer diagnostic counts: geometryWindows, speedGateRejectedWindows (legacy 28-145 km/h median-of-five), intermediateClimbRejectedWindows, inSpanDerivativeRejectedWindows (exact frozen 0<dt<=15s and >25m/s within nearest 30m descent/climb anchor span after other legacy gates), sourceQualityAffectedWindows (any R1 issue edge within that span), over15sIntervalWindows (legacy derivative guard cannot assess), legacyPreGroupEligibleWindows, legacyPreGroupEligibleQualityAffectedWindows, legacyGroupedAltitudeShapes, and legacyEmittedAltitudeProposals (verified shadow parity with actual legacy altitude signal after existing speed-event suppression).

Reason counts can overlap. Geometry window count does not equal events or independently observed contacts. Missing source-height accuracy/datum and unobserved motion remain UNKNOWN. Original source boundaries, cross-block dedup, retained-height conflicts, same-ms UTC collision, V2 time/speed issues and manual splits remain explicit quality concerns; source boundaries must never become continuous motion evidence. A gap longer than 15s cannot be called clean because the historical derivative guard skips it.

The response does not print route, coordinates, UTC, raw GPS height, altitude AGL/MSL claims, raw source, filename, path, registration, per-fix indexes or private source digest. Results always physicalContact UNRESOLVED, actualLandings UNAVAILABLE, recencyEvidence UNAVAILABLE and canAffectCanonicalFlight false. Source accuracy and sensor authentication remain unknown.

## Owner-local verification instructions (NOT RUN)

On the exact branch with Node.js 24:

    npm run test:target -- tests/gps-v2-d43-r2-2-shape-audit.test.ts tests/gps-v2-d43-r2-quality.test.ts tests/gps-v2-d43-r1-coverage.test.ts tests/v351-gps-tg-reliability.test.ts tests/track-processing.test.ts
    npm run typecheck

Owner-private KML execution; select the six original recordings, match their sample IDs by R2-1 canonical fix count AND source-block count before running R2-2. Example:

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-d43-r2-2-shape-audit.mjs --file "C:\PRIVATE\track.kml" --id sample07

Acceptance: all six return LEGACY_SOURCE_SHAPE_COMPARISON_ONLY with SHADOW_LEGACY_PARITY_VERIFIED or fail closed for correction. Compare per-file historical legacy altitude proposal counts 1/1/10/0/6/3 as provisional signals, not ground truth. Inspect actual sample07 in-span rejection count; a global quality edge alone proves nothing about causality. Do not invent position, contact, time or labels for a missed event.

## Completion and scope

R2-2 OPEN until exact-HEAD local Node tests/typecheck, six owner-private CLI diagnostics, privacy check and matched documentation are evidenced. Full suite/build/browser/CI NOT RUN; DB/migration N/A; merge/deploy none; production flag OFF and native multi-gx V2 still unsupported. R3 independent contact truth is required before operational detector validity claims. R2-2 completion, even with clean reports, does not authorize release.

## Preliminary independent private-corpus reconstruction — NOT R2-2 runtime verification

On the six owner-uploaded private KML files, a separate local Python reconstruction of the previously frozen legacy altitude-window conditions produced the following anonymous totals. This reconstruction is **independent exploratory evidence only**, not a pass for the new TypeScript audit module, CLI, test suite or its parity gate. No raw KML, coordinates, times, altitudes, filenames or registrations are committed.

| Anonymous recording | Frozen-style grouped source-altitude shapes before speed-event suppression | Qualifying speed+intermediate-climb geometry windows rejected by in-evidence-span >25m/s guard |
|---|---:|---:|
| sample03 | 1 | 0 |
| sample04 | 1 | 1 |
| sample05 | 10 | 0 |
| sample06 | 0 | 0 |
| sample07 | 6 | 2 |
| sample08 | 3 | 0 |

**Important:** These are SOURCE-WINDOW counts. The two rejected sample07 windows can overlap and **do not imply two extra landings** or independently verified wheel contact. This is consistent with a potential in-span cause for a previously pilot-reported missed rolling T&G, but is not evidence of contact or validation of its timing. sample04 also has one rejected source-geometry window. The TypeScript comparator MUST independently reproduce frozen legacy proposal totals and rejection-window counts or return UNAVAILABLE for investigation; do not tune thresholds to force the above numbers. All 18 new tests and user-local R2-2 CLI remain **NOT RUN**.
