# FlyTally GPS Detection 2.0 — R2.1c Pilot Review architecture draft

**Date:** 2026-10-17
**Status:** **DESIGN / READ-ONLY ANALYSIS ONLY — NO PRODUCT APPROVAL, NO CODE IMPLEMENTATION, NO DEPLOY**
**Post-review status:** **FIX DESIGN FIRST** (DeepSeek independent PARTIAL/handoff-only, then GitHub source reconciliation by ChatGPT); **live Pilot Review BLOCKED**. This document was the initial proposal; the [source-verified reconciliation and provenance/display contract](GPS_DETECTION_2_0_R2_1C_DEEPSEEK_REVIEW_RECONCILIATION_2026-10-17.md) supersede any implication that the initial DTO can be implemented or displayed based only on `SourceMetadata.status="KNOWN"`.

**Repo:** filipto861/flytally-logbook only. Research Draft PR #350, branch `test/gps-detection-r21-falsification`. Canonical main source inspected at `main@6a67a02475ab09c3271f8646427f7956ed6e590a`.
**Baseline:** research executable source clean `681c62d90d21fdf1efd4aa3ada83383249ea857b`: owner-local GPS/legacy targeted **83/83 PASS** and TypeScript PASS; subsequent docs-only HEAD `3294760eef337985b96e79c29d856a95fa1380de`. This is synthetic regression evidence, not wheel-contact truth.

## 1. Existing product reality — do not build a duplicate workflow

Repository source inspection:

| Main source | Existing behavior | Consequence |
|---|---|---|
| `components/kml-import-form.tsx` | Existing KML/GPX/CSV import; supports split review, full track playback, editable takeoff/landing/starts/day-night values, quality warnings and optional single-flight "Save & certify". Handles multiple reviewed flights as drafts. | Reuse this IA and form; don't add another canonical flight record flow or assume V2 can change saved counts. |
| `components/gps-import-review-player.tsx` | Leaflet track + altitude/speed profile, timeline/markers, accessible event strip, scrubber. `ImportReviewEvent.kind` only allows takeoff/landing/touch-and-go/split; sample speed/alt presentation currently uses numerical fallbacks, including null altitude in chart/render. | Do **not** represent V2 unconfirmed motion patterns as existing confirmed-looking landing/T&G marker kinds. Add a separately styled advisory presentation only after provenance/render review. Missing altitude must not look like sea level. |
| `lib/flight-draft-candidate.ts` | `gpsFlightCandidate` represents explicitly reviewed fields as `GPS_REVIEW` provenance and normalizes through canonical workflow; it has no dedicated V2 event authority. | A V2 candidate must never feed directly into this input, nor become a certified landing by serialized hidden field. |
| `app/(protected)/flights/actions.ts` | `importKmlFlight` reads/parses uploaded file, rechecks selected aircraft and source-specific movement rules, verifies submitted counts and save intent, canonical normalizes and persists; single flight can subsequently certify, multi-flight draft-only. | Preserve server-side validation; no second "quick certify" endpoint. Browser-only candidate choice cannot bypass `landingsDay+landingsNight=reviewedStarts` or locked/certified protections. |
| `lib/data/flight-track-review.ts` | Reads owned DB track and calculates legacy `landingCount` from first track (`LIMIT 1`); auth path / production DB privilege constraints remain unresolved for new analytics. | Not a safe foundation for V2 owner research access. Do not secretly call it or infer all-track coverage. |
| `research/gps-detection-r21/detector.ts` | Only `T_G_PATTERN_CANDIDATE` and `STOP_GO_PATTERN_CANDIDATE`, `physicalContactStatus=UNRESOLVED`, reason-coded invalid boundaries, `sourceQuality` with declared-not-attested metadata. | V2 outputs remain hypotheses, never wheel-contact labels. |
| `research/gps-detection-r21/flight-count-contract.ts` | Observed-island count is `PATTERN_ONLY`; bare GPS whole-flight landing count permanently `UNAVAILABLE`. | Never substitute pattern-count for flight-count or silently set Day/Night regulatory counts. |

## 2. Proposed user workflow (NOT FROZEN)

**Recommended smallest path: inline advisory panel inside existing `Review GPS track`, behind a default-OFF feature flag**, not a new page or second persisted GPS flight.

1. Pilot uploads/selects track using unchanged entry path; aircraft profile/split remain unchanged.
2. Existing legacy map/events and canonical form remain intact. A separate, explicitly labeled **Experimental motion patterns — not confirmed landings** section may be shown only when data provenance/analysis prerequisites are actually satisfied and the product owner enables the flag.
3. Compact status first: **Available (advisory)** / **Insufficient GPS evidence** / **Source quality not verified** / **Not applicable**. Avoid false green "confirmed" badges or invented per-event confidence/probability.
4. For each supported candidate show **Possible rolling altitude reversal** or **Possible stop-and-go pattern**, plus supported interval/quality, the original source validity assessment, `invalidBoundaryEvidence` reason(s), and **time unavailable** where `time=null`. Do **not** label it "Landing 1", "Touchdown", "Go-around", "Low approach", "HIGH confidence" or "safe". Pilot can inspect the existing track playback position, provided the chart never invents missing altitude, and the index maps to the exact source/split sequence.
5. Candidate review choices: **Reviewed / Not relevant / Leave unresolved** are *review notes only*, not aircraft-contact proof and **not canonical movement writes**. For the minimum first release, keep these ephemeral in the client; do not invent new DB table or retention promise. Navigation/file/split changes invalidate the notes and candidate list (unless a separately approved persistence contract exists).
6. Pilot fills the **existing** Day/Night/total fields explicitly (as today). Those values alone go through canonical server validation. Review of an event suggestion must **not** auto-populate, silently change, increase, or certify any movement count.
7. "Save draft" and existing explicit "Save & certify" are unchanged. Pilot must still review legally relevant evidence; the V2 panel cannot be a shortcut. Certification remains governed by stored canonical record and existing certification checks.

**Flag OFF**: byte-for-byte legacy observable behavior should be regression-covered. **Flag ON** in the initial stage: no new production research import until trusted source/provenance and authorization gates are passed. A static synthetic demonstration may be used solely for local design evaluation, clearly labeled demo, without real upload/DB hookup.

## 3. Proposed in-memory, non-persisted DTO contract (DRAFT only)

A future pure adapter under **research/** can transform an already-authorized `ResearchAnalysis` plus validated local source/split context into a DTO; no `app/` or `lib/` import at this milestone. Example shape (design, not compiled TS):

```ts
type AdvisoryReview =
  | { status: "UNAVAILABLE"; reason:
      "SOURCE_NOT_VERIFIED" | "NO_VALID_ISLAND" |
      "MALFORMED_METADATA" | "TRACK_CHANGED" | "NOT_APPLICABLE";
      canAffectCanonicalFlight: false; }
  | { status: "ADVISORY_ONLY";
      algorithm: "R2_1A_RESEARCH"; sourceReview: "NOT_APPROVED";
      fullFlightLandingCount: "UNAVAILABLE";
      canAffectCanonicalFlight: false;
      hypotheses: Array<{
        kind: "ALTITUDE_REVERSAL" | "SPEED_DIP";
        physicalContact: "UNRESOLVED";
        sampleSupport: { start: number; end: number };
        eventTimeUtc: string | null;
        evidence: Array<{ reason: string; from: number; to: number; side: string }>;
        pilotNote: "UNREVIEWED" | "REVIEWED" | "NOT_RELEVANT";
      }>;
    };
```

The eventual parser must validate union discriminators, sample indices, track/split identity and trusted/source-declared quality separately; no arbitrary `sourceQuality: KNOWN` flag can grant approval. This DTO must never carry persisted `landings`, `takeoffs`, `flightId`, `certifiedAt`, `userId`, names, registrations or a signal of approved touchdown. The design's bare index is **only** for in-memory same-upload review; it must not be serialized as cross-track identity. No private raw route upload/export to external reviewers. No automatic UTC inference.

## 4. Explicit invalidation and state transitions

- **NEW_TRACK** → discard all candidate notes, derive fresh identity and bounded analysis, never carry prior suggestions.
- **SPLIT_CHANGED** → analysis support indices, event count, window and notes must invalidate/recompute for each part; no stale cached suggestions.
- **SOURCE_METADATA_CHANGED** → all former candidate evidence unavailable until recalculated.
- **ALGORITHM_VERSION_CHANGED** → no previous candidate decisions reused.
- **PILOT_EDITS_DAY_NIGHT/TOTAL** → user values remain sticky per existing manual provenance rules; research cannot overwrite.
- **MISSING_GPS/LOW_QUALITY/UNKNOWN_SOURCE** → no precise contact/time/AGL/runway claims; if the review gate demands supported provenance, show Unavailable with a reason rather than default zero.
- **PARTIAL_CROPPED_FLIGHT** → observed-island patterns may exist, whole-flight physical landing count always Unavailable.
- **CERTIFIED/LOCKED_EXISTING_FLIGHT** → research panel must never enable destructive editing; use existing reviewed correction workflow if a person seeks to change certified facts.

Persisted flight evidence: unchanged. No cross-user or shared-flight assumption. Reviews of a proposal and actual legal flight movement data are different domains.

## 5. Key open product/architecture decisions for Filip

**D1 — Primary entry:** recommend **existing GPS import inline**, only; separate standalone post-flight review is a *future* option and requires authorized read-path/subject isolation. Do not assume both are approved.

**D2 — Meaning of "Reviewed":** recommend acknowledgment of seeing advisory evidence, **not confirmation of ground contact**. Only manually reviewed canonical numeric fields, on the existing save authority path, can represent pilot movement evidence.

**D3 — Show candidate with source unknown?** Current research still emits some altitude patterns when metadata is `UNVERIFIED` to preserve synthetic T09 utility. Recommend **fail closed for pilot-facing altitude display** until source meaning (unit/mode) can be attested or a product-approved explicit "unverified research only" display mode is defined. Source `KNOWN` declaration is not authority.

**D4 — Persist review notes?** Recommend **ephemeral for initial exploration**, no DB migration. Durable review evidence/retention requires separate schema, privacy and audit design.

**D5 — Product-scope labels:** A07/A08 go-around and low approach are not implemented and must not appear as recognized types. Physical contact cannot be inferred from GPS alone even if track coverage were independent and complete.

Owner is final product decision maker. These are proposals, **not frozen implementation approvals**.

## 6. Dependencies and acceptance before a pilot build

**Review gate:** independent DeepSeek/Claude source-level metadata review of Batch 6 + this design, with findings reconciled against real repo. The prior separate P0 review was partial and does not bless this design.

**Source gate:** original track format/altitude unit/mode/datum/accuracy provenance (especially KML/GPX/CSV), validated input shape, no null-to-zero display/metric coercion, reasonable/explicit effectivity. Unverified historical tracks fail closed for any authoritative use. No arbitrary model confidence/cutoffs.

**Security gate:** P0-D3 owner/consent/read-only/RLS remains open; **no live private track service or endpoint, even read-only, until proven**. A client-local experimental demo is also not authorization for data export or model training.

**Implementation gate (separate milestone after owner decision):** feature flag OFF preserves legacy; pure DTO builder with malformed/null/wrong-track negative tests; source/split/algorithm invalidation tests; explicit no-count/no-write boundary; mobile/iPad portrait/landscape/night UX; Playwright+full targeted+build+DB gate as applicable; affected ROADMAP/FEATURES/CHANGELOG and source-coded test evidence. Do not introduce a silent global GPS mode switch.

**Not run:** no code/UI/feature flag, no data migration, no PostgreSQL/Neon, no real tracks, no synthetic UI runtime/browser tests, no second-AI verdict for this new design, no merge/deploy.

## 7. Reconciled high-risk design corrections — 2026-10-17

**External review status:** DeepSeek verdict **FIX DESIGN FIRST**, reviewer unable to inspect GitHub source. Our own source inspection confirmed the central issues; see [line-by-line source evidence and P01–P13 negative test matrix](GPS_DETECTION_2_0_R2_1C_DEEPSEEK_REVIEW_RECONCILIATION_2026-10-17.md).

- **Parser transform reality:** `lib/track-processing.ts::normalize` can sort/deduplicate points; `parseCsv` converts recognized `ft/feet` altitude headers by 0.3048 without returning transformation metadata. The source-array index has no general raw-file identity. A CSV missing altitude cell may become numeric zero via `Number("")`; this requires targeted falsification before future V2 data use.
- **Parser-observed versus attested:** extracting an altitude unit/mode or source-provided `KNOWN` accuracy is not independent sensor provenance, reference datum verification or aircraft-contact truth. An arbitrary `sourceProvenanceStatus:"VALIDATED"` provided by a caller cannot enable V2 display. Design a validated evidence boundary, with explicit version/transform/order/unit/accuracy distinctions, before implementing any adapter that surfaces altitude/vertical-rate candidates.
- **Display gate:** when actual source interpretation is unresolved, V2 pilot-facing altitude/vertical-rate hypotheses are `UNAVAILABLE(SOURCE_NOT_VERIFIED)`; existing research T09 behavior remains isolated and must never be used as a pilot approval flag. Even attested metric interpretation cannot establish AGL/runway alignment or touchdown. A stop-go horizontal hypothesis requires its own independently supported position/time evidence and must not inherit altitude approval.
- **UI and wording:** candidate `Reviewed` can be confused with legal flight evidence. Prefer `Advisory note` and `Leave unresolved`. Do not create legacy-shaped `touch-and-go` or `landing` markers, hidden movement fields or V2 auto-prefill.
- **Renderer:** missing altitude and invalid Δt currently have zero fallbacks in the legacy player. Source code confirms the fallback, not actual runtime visual impact; a future display-only patch must be verified separately and must not change legacy count semantics.
- **Sequencing:** design reconciliation (now) → standalone parser/provenance red-line tests and trusted capability contract (not yet run) → pure offline DTO test adapter → only with owner-frozen decisions and complete P0-D3 security source authority consider an actual flagged integration. No production/DB actions or release approvals in this milestone.

**Owner choices D1–D5 in §5 remain PENDING**. The proposed feature flag, memory-only notes and inline UX are recommendations, not authorization.
