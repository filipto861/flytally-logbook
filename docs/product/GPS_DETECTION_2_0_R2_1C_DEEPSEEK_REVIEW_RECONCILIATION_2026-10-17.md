# GPS Detection 2.0 — R2.1c DeepSeek PARTIAL review reconciliation

**Date:** 2026-10-17  
**Repo / scope:** `filipto861/flytally-logbook`, research-only Draft PR #350, branch `test/gps-detection-r21-falsification`  
**Latest owner-executed code:** `681c62d90d21fdf1efd4aa3ada83383249ea857b`, targeted **83/83 Node + TypeScript PASS** (owner-local synthetic; no independent physical-contact truth). Latest pre-review docs-only HEAD: `d85c4eb3844aedb2d0f0baf250866ecfb5af952a`.  
**Review input:** User-forwarded DeepSeek 147-line report; verdict **FIX DESIGN FIRST**. DeepSeek explicitly stated **no GitHub access, no source files inspected, no tools/tests executed**; recommendations are advisory. This document separately reconciles with actual GitHub source; it does not claim DeepSeek executed source review or approve the product.  
**Main source inspected at:** `main@6a67a02475ab09c3271f8646427f7956ed6e590a`. New changes in this milestone are **documentation only**.

## Finding disposition and actual evidence

| Item | Repository-confirmed fact | Decision and required evidence |
| --- | --- | --- |
| Q1 HIGH — unknown metric | `research/gps-detection-r21/detector.ts`, `assessSourceQuality` returns `UNVERIFIED` when metadata missing or mode/unit unknown. `analyzeResearchTrack` allows metric vertical rate and altitude candidates for every status except `UNAVAILABLE`. This is a deliberate historical T09 research utility compromise, not source-backed metric provenance. | **CONFIRM, MUST FIX BEFORE PILOT-FACING V2.** Preserve existing offline baseline unless explicitly redesigned. No pilot-facing altitude/vertical-rate hypothesis without trusted parser-derived unit/mode interpretation and validated order/timestamp provenance. Reject—not downgrade to "high confidence"—unknown. |
| Q2 HIGH — caller-declared `KNOWN` | `SourceMetadata` is a compile-time TypeScript shape with caller-provided `Known<T>` values; `assessSourceQuality` does not attest source bytes/parser version, datum or sensor accuracy. `RELATIVE_CHANGE_ONLY` is **not** AGL. | **CONFIRM.** New runtime-checked ingestion/evidence envelope needed. Parser-derived extraction does **not** authenticate physical sensor accuracy/datum or certify units; avoid misleading generic `validated:true`. |
| Q3 HIGH — source parity | **Additional verified hard fact:** `lib/track-processing.ts::normalize` deduplicates consecutive same-position/same-time points and sorts by timestamps if at least two parseable timestamps. `parseCsv` detects `...ft`/`...feet` suffixes and converts altitude to meters using 0.3048, without returning transformation/source metadata. `parseTrackFile`/ `inspectTrackFile` return normalized `KmlPoint` without a source→normalized index map, raw-order trust or altitude datum/accuracy certificate. `lib/data/flight-track-review.ts` additionally infers from the first track (`LIMIT 1`). | **CONFIRM + EXTEND.** R2.1a indices are indexes into supplied arrays, not original raw GPS record identity; no cross-split/track reinterpretation. Use source-only parser characterization tests and transformation evidence before DTO/UI; persisted normalized track is **not** independently verified physical-event provenance. |
| Q3a HIGH — empty CSV altitude | **Additional source finding:** `parseCsv` helper `number(value)=Number((value||"").trim().replace(",", "."))`; `Number("")===0`. When altitude column exists but a row is empty, the parser can emit **altitude 0 rather than null**. Actual runtime and input fixture not executed in this milestone; this is source-control-flow evidence and a red-line test target. | **OPEN / STRICT SOURCE FIX PREREQUISITE.** Add minimal targeted parser regression and, if proven, a separately approved fix with backwards-compatibility tests. Never silently promote such a normalized zero to sensor measurement or use it for V2. No unrelated legacy parser modification in this design milestone. |
| Q4 MED — null altitude/speed display | `components/gps-import-review-player.tsx` maps `Number(point.alt??0)` to chart and `metersToFeet(current?.alt||0)` to tooltip; interpolated `current.alt` also uses null→0. `elapsed` and `windowedSpeed` return 0 for incomplete/malformed Δt. | **CONFIRM DISPLAY PATH.** Source proof of fallback; no measured browser impact and no established canonical landing-count bug. Future V2 must render gaps/Unavailable, not sea-level zero or measured 0 km/h. Audit effective browser behavior before touching shared production player. |
| Q5 HIGH — ambiguity with legal workflow | `components/kml-import-form.tsx` has existing `importReviewEvents` kinds takeoff/landing/T&G/split, edit controls and explicit Save draft/Save & certify; `lib/flight-draft-candidate.ts::gpsFlightCandidate` builds canonical candidate from reviewed parts; `app/(protected)/flights/actions.ts::importKmlFlight` authenticates, validates and persists data. | **CONFIRM.** Reuse current page only; separately labeled V2 read-only hypotheses, never legacy event types, hidden field, increment or shortcut to certification. DeepSeek's "advisory note" is safer than ambiguous "Reviewed" button. |
| Q6 HIGH — stale sample support | `PatternCandidate.index/support` are per-array indices; existing UI split logic derives new parts. Proposed R2.1c invalidation has no implementation or tests. | **CONFIRM OPEN.** New file/split/parser metadata/version invalidates all candidate references and ephemeral notes; validator rejects out-of-range/wrong-part references. Manual canonical Day/Night inputs remain sticky per existing contract. |
| Q7 HIGH — private read path | `lib/data/flight-track-review.ts` reads `sql` through user-owner predicate, lacks independently demonstrated RLS and uses first track. Existing `requireUser/getSession`/migration initialization may write, per P0 source/governance analysis. | **CONFIRM PRIOR FINDING; NO EXECUTED DB VERIFICATION** in this milestone. P0-D3 native SQL/RLS and identity/consent strict zero-write remain NO-GO. A new private read API or post-flight view cannot be introduced as a shortcut. |
| Q8 / DTO | The design file is only a proposal. `flight-count-contract.ts` already enforces `WholeFlightLandingCountFromGps.status="UNAVAILABLE"`; no numeric whole-flight count from GPS. | **ACCEPT WITH REVISIONS.** Use discriminated unavailable states, parser/transform envelope, candidate display eligibility per evidence type; do not offer false generic provenance-validation claim. Keep output non-persisted and no flight/certification fields. |
| Gap in original handoff | Independent reviewer had no actual files, no GitHub access, no test runtime. | Review rating **PARTIAL**, not "source verified by DeepSeek". Correctness findings above were checked separately against GitHub by ChatGPT. Another true source-inspecting review may be needed before high-risk runtime changes. |

## Hard source/display contract — required before DTO code

1. **Three distinct claims** must not be conflated: (a) parser observed bytes or a label, (b) parser normalized unit/order/time faithfully with a documented transformation, (c) external sensor/unit/datum/accuracy trust. Evidence for (a)/(b) cannot imply (c).
2. A provenance envelope must identify file type, explicit parser revision, source→normalized order/dedup/conversion diagnostics, altitude unit evidence, altitude mode, reference datum, and independent accuracy status **separately**. Omission is `UNAVAILABLE/UNKNOWN`, never zero, m, MSL or UTC.
3. **No producer-controlled approval bit:** `SourceMetadata.status="KNOWN"` or `sourceProvenanceStatus="VALIDATED"` supplied by a caller must be insufficient for pilot display. Only a separately defined trusted validation boundary with testable parser evidence can assign eligibility. Any unknown provenance fails closed for pilot-facing altitude and vertical-rate patterns.
4. The initial implementation may expose only a **pure offline research DTO** or synthetic preview, not a user track runtime. `fullFlightLandingCount="UNAVAILABLE"`, `physicalContact="UNRESOLVED"`, `canAffectCanonicalFlight=false` are invariant; no event may be described as confirmed landing, go-around, low approach, runway alignment or AGL.
5. Sample indices belong to a **single bounded input array and split revision**, never a raw-file identity; re-split/re-parse/algorithm revision must invalidate notes and candidate refs.
6. UI chart/tooltip must distinguish missing altitude and speed from measured zero; avoid connecting missing-altitude spans. Demonstrate actual effective browser behavior, including iPad, before modifying the existing legacy player.
7. Pilot manual Day/Night/total review alone controls canonical input; no advisory payload/auto-prefill/certify. Default flag OFF remains legacy behavior; product owner must freeze D1–D5 first.

## Red-line acceptance matrix (design, NOT RUN)

| ID | Synthetic fixture / inspection | Required behavior |
| --- | --- | --- |
| P01 | Unknown unit/mode/datum but numeric altitude and T09-shaped curve | Research may retain internal utility; pilot review DTO rejects any altitude/vertical-rate candidate and never returns claimed contact. |
| P02 | Caller forges `Known("m")`, datum text or `validated:true` | Caller values cannot grant trusted provenance/display. |
| P03 | KML/GPX/CSV normalized sort and/or duplicate | Exact index mapping or explicit unavailability; no raw/normalized identity equivalence guessed. |
| P04 | CSV header `altitudeFt` | Evidence of 0.3048 transform is explicit; no invented raw-meters claim. |
| P05 | CSV blank altitude cell | Must remain missing, not become measured altitude zero; test before code change. |
| P06 | Null/NaN altitude, invalid Δt in player | Gap/Unavailable, never drawn as measured 0; legacy values/landing count unchanged. |
| P07 | Time change, split change, new upload, changed source or algorithm | Candidate indices/times and notes invalidated; cross-part/cross-track attempt denied. |
| P08 | Pilot changes Day/Night/total after V2 candidate | Manual canonical values stay unchanged; no background recomputation. |
| P09 | User ignores/reviews advisory note | No movement values or hidden fields, no logbook mutation, no certification implied. |
| P10 | Locked/certified existing flight or multi-flight import | Current server authority/certification conditions cannot be bypassed. |
| P11 | Invalid source metadata / incomplete track | `UNAVAILABLE` with explicit reason; never "0 events" meaning "no landings". |
| P12 | Feature flag OFF | No changes in existing legacy import form behavior, no extra hidden payload. |
| P13 | Auth/consent/RLS not proven | No private GPS/Neon/post-flight API/DB querying despite otherwise passing tests. |

**No acceptance tests run for R2.1c in this work cycle.** The 83/83 owner-local PASS is the Batch 6 code baseline only; no independent source or real-world accuracy verification.

## Sequencing recommendation — no current owner decision presumed

**R2.1c-D1 (NOW):** reconcile this partial reviewer packet and freeze evidence/display contract in docs. **Documentation only.**

**R2.1c-D2 (NEXT, subject to product direction):** source-only parser/normalization/metadata falsification and strict offline typed evidence model; independently review the dangerous CSV empty-altitude and index-mapping cases. Keep all production behavior unchanged until a separate minimal approved fix.

**R2.1c-D3:** pure offline DTO adapter + malformed/forged/wrong-track/split invalidation tests. No `app/`, `lib/`, UI or DB integration; no raw real GPS. A DTO must not masquerade as a validated pipeline in absence of D2 evidence.

**R2.1c-D4:** only after actual owner choices D1–D5, source fidelity and UX null-alt acceptance: feature-flag-OFF incremental UI with verified browser tests; preserve canonical save/certification.

**R2.1c-D5:** independent P0-D3 owner/consent/strict no-write/PG16 SQL RLS proof before any user-data backend or post-flight panel; release approval separately.

**External review verdict:** **FIX DESIGN FIRST** for research DTO and **BLOCKED** for live Pilot Review. **Our reconciliation:** agree with the separation and verified gaps; this is **not** an assertion that the partial reviewer inspected GitHub. No product approval, PR merge or deployment.
