# GPS Detection 2.0 — DeepSeek independent source/UX/security review

**Request:** READ-ONLY, INDEPENDENT CHALLENGE; no code, no DB, no GPS data upload, no merge/deploy.
**Date:** 2026-10-17
**Repo:** filipto861/flytally-logbook
**Research branch:** test/gps-detection-r21-falsification, Draft PR #350.
**Exact last tested research executable SHA:** 681c62d90d21fdf1efd4aa3ada83383249ea857b.
**Owner-local evidence:** 83/83 targeted synthetic/legacy Node PASS + TypeScript PASS (NOT CI, NOT real-flight accuracy).
**Main source referenced:** main@6a67a02475ab09c3271f8646427f7956ed6e590a (actual canonical imports reviewed).
**This handoff and design are newer docs-only commits. NOT a code test or approved UI milestone.**

## Material to inspect directly (no reliance on a pasted summary alone)

Research source (exact blob fingerprints):
- `research/gps-detection-r21/detector.ts` — blob `dc65b98e2cb7ff0e25724634766dd8cf559a1934`
- `research/gps-detection-r21/falsification-scorecard.ts` — `f0115b4e759cc79e7266f6f248d83729f83e97a4`
- `tests/gps-detection-r21-batch6-source-quality.test.ts` — `b2a0f0c06c9a218731d95d86da48ee95dd39ef09`
- `research/gps-detection-r21/flight-count-contract.ts` — `e689bce9d9679b8b1108db16f51ac237bf1d9cd6`
- `docs/product/GPS_DETECTION_2_0_R2_1C_PILOT_REVIEW_DESIGN_2026-10-17.md` — `5231692ed68e49edfa8473c57309549118e29da5`

Production/read-only sources (GitHub main):
- `components/kml-import-form.tsx`: review flow, event markers, editable counts and single-flight Save & certify
- `components/gps-import-review-player.tsx`: map, altitude/speed/profile visual marker and null/invalid handling
- `app/(protected)/flights/actions.ts`: `importKmlFlight`, canonical normalization, owner authority, save/certification
- `lib/flight-draft-candidate.ts`: `gpsFlightCandidate` with GPS_REVIEW provenance
- `lib/gps-import-integrity.ts`: source-specific legal/review counts
- `lib/data/flight-track-review.ts`: read path and first-track limitation
- `docs/product/GPS_DETECTION_2_0_R2_1B_P0_STRICT_READ_ONLY_DESIGN_2026-10-17.md`: owner/RLS/zero-write NO-GO security boundary
- `docs/product/3_4_0_REVIEW_RECONCILIATION.md`: existing saved canonical/duplicate/certification constraints

## Frozen safety / implementation limits

No secret/live GPS/Neon access, no new DB roles, no PostgreSQL 16/18 services touched, no source training, no change to actual certified records; no import from research to production. No exact physical touchdown or runway AGL truth from bare GPS; independent ground-truth holdout unavailable. Research candidate types are ONLY T_G_PATTERN_CANDIDATE and STOP_GO_PATTERN_CANDIDATE, contact always UNRESOLVED; whole-flight GPS-only landings always UNAVAILABLE. Flag OFF = full legacy behavior; pilot's explicit numeric source-of-truth still goes through canonical server validation; no auto-prefill/auto-write added. The 83 tests are synthetic red-line regressions, not statistical accuracy.

## Independent review challenges — prioritized

**Q1 HIGH — Unknown-source metric math:** `assessSourceQuality` yields `UNVERIFIED` when metadata is absent or altitude unit/mode unknown. `analyzeResearchTrack` still permits meter-threshold T&G and metric `verticalRateMps` when status is not `UNAVAILABLE`. This preserves historical T09 synthetic utility but could make unknown units look physically meaningful. Should future presentation hard-reject, mark diagnostic-only, or require a separately validated metric origin? Distinguish **research-only legacy utility** from production-safe behavior. Provide exact negative tests and source contract.

**Q2 HIGH — Spoofed declared source metadata:** `SourceMetadata` is TS-only; caller controls `Known(value)`. `status:"KNOWN"` is not independently source-verified, datum may be arbitrary string, and accuracy may be asserted without a trustworthy source parser. Identify malformed object threats and any misleading "RELATIVE_CHANGE_ONLY" status semantics; propose trusted ingestion/validation prior to UI, not an invented default.

**Q3 HIGH — Actual current GPS import source/data parity:** KML/GPX/CSV parser and persisted tracks might normalize altitude, sampling and source order; existing `gpsFlightCandidate` is input by pilot review; source metadata may be absent from existing persisted DB. Can the R2.1a detector ever be applied directly to `inspectTrackFile` points without unsafe source assumptions? Identify what must remain UNAVAILABLE, what can be compared on post-normalized data, and permissible local-file-only path.

**Q4 MED — Null alt / invalid time rendering:** `gps-import-review-player.tsx` uses `Number(point.alt??0)` for altitude chart and displays `metersToFeet(current?.alt||0)`, plus some elapsed/speed fallbacks to zero. As a visualization in the **existing legacy UI**, what changes are required before it could correctly visualize V2 unsupported values? Do not assume this makes current production flight counts wrong; specifically bound the finding to the display and prove cascade/actual runtime before modifying it.

**Q5 HIGH — Safety of proposed review UX:** Existing event marker kinds explicitly say takeoff/landing/T&G, legacy review already suggests full landing count, and single-flight allows "Save & certify". How should V2 hypotheses appear *clearly separate* from these? Is any proposed "Reviewed" action ambiguously like a legal certification? No auto-apply, no new hidden payload, no false source confidence and no extra acknowledgment clutter without demonstrated need.

**Q6 HIGH — Data integrity + invalidation:** track change, file upload, GPS split, source meta, algorithm version, manual Day/Night, certified/locked rows. What canonical integration tests and negative cases prevent stale pattern counts, stale event time, cross-flight support indices, or bypass of movement validation? No destructive certified overwrite or shared-flight authority leak.

**Q7 MED — Privacy/authorization:** current `requireUser/getSession` can cause writes and application WHERE owner predicate is not DB-enforced RLS. Can any production/post-flight panel be safely implemented before real P0-D3 SQL/owner isolation? Do not assert read-only from route/component name. Separate a pure local browser synthetic demo from a production data access claim.

**Q8 — UX trade-off:** Existing `Review GPS track` versus a standalone review flow. Recommend minimal cognitive load, landscape iPad/portrait and dark/night, with explicit unavailable states and no green authority color. Is a read-only section better than adding a new event-type marker to the current map? No speculative new product features.

## Expected return

Provide 1) **ranked critical findings** with exact source file + function/line location, 2) verified code facts vs hypothetical threats vs undocumented assumptions, 3) safe proposed contract/UX changes, 4) red-line tests and acceptance, 5) frozen Do/Do Not, 6) verdict **GO TO DTO DESIGN / FIX DESIGN FIRST / BLOCKED** (separate from actual production authorization), and 7) anything the existing architecture already solves and should NOT be rebuilt.

**Do not** issue a generic enthusiastic approval. If you cannot inspect a file, say **NOT INSPECTED** and use source-read-only limitation rather than inventing a PASS. No code edits or tool invocations that modify database or repo.

**Owner decisions requested after review:** whether first pilot-reviewed advisory appears only inside existing GPS import (recommended); whether reviews are ephemeral notes only (recommended); whether source-UNKNOWN altitude candidates are entirely hidden in pilot-facing UI (recommended); and whether any separate post-flight track review is deferred (recommended).
