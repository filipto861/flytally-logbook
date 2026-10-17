# GPS Detection 2.0 — R1 feasibility and benchmark design

**Milestone:** #348 R0/R1 (research-only)  
**Date:** 2026-10-17  
**Source:** `flytally-logbook` main at `6a67a02475ab09c3271f8646427f7956ed6e590a` + read-only inspection of the explicitly identified production Neon database, with only anonymous aggregates returned.  
**Classification:** Architecture/data-quality research; **NO production detector/DB writes, model training, new event labeling or deployment**.  
**Scope constraint:** Existing FlyTally records only; account ownership and authorized-use restrictions apply.

## 1. Executive research decision

**GO:** Read-only data-quality diagnostics, deterministic time-based phase/candidate baseline, synthetic/previously-reviewed regression fixtures, source-aware missingness and uncertainty, exploratory unsupervised HMM/HSMM flight-phase segmentation.

**CONDITIONAL:** Flight-level count agreement against saved pilot-reviewed counts — **only as a weak proxy**, with correction/certification provenance and possible legacy-autofill contamination documented. No claim of measured physical touchdown correctness follows from an exact count match.

**NO-GO NOW:** A supervised, production-promotable `TOUCH_AND_GO` / contact-vs-no-contact classifier trained/evaluated on these data as if verified event-level labels existed. A certified flight record does **not** independently establish an event timestamp or physical contact, and the current import form itself derives initial `starts` / `takeoffs` from `landingCount(part)` (see `components/kml-import-form.tsx::reviewFor`). Observed source diversity and pilot permissions are unverified. These are evidence/authorization blockers, **not** claims that machine learning can never be used.

## 2. Source reconstruction and observed limitations

| Component | Observed role | Implication |
|---|---|---|
| `lib/track-processing.ts` | `KmlPoint`: lat/lon/nullable altitude/nullable time; KML/GPX/CSV parsing, speed smoothing, `touchAndGoEvents`, `landingCount`, `suggestedSplits`, `flightEnvelope` | Existing result is advisory and deterministic, not observed touchdown truth |
| `lib/track-processing.ts::groundEvents` | Moving-speed minimum windows and duration tests (presently point-indexed in multiple places) | Uneven cadence changes the physical time span of a fixed number of points |
| `altitudeTouchAndGoIndices` | 30m descending-then-climbing evidence, speed window, ±10 index neighborhoods, altitude continuity constraints | Can reject genuine sparse rolling T&G; local altitude artifacts may mimic contact |
| `touchAndGoEvents` | Combines speed events and altitude minima; “high” or “medium” confidence labels | These are heuristic categories, **not calibrated probabilities** |
| `landingCount` | `Math.max(1,1+touchAndGoEvents(points).length)` | Assumes a final landing even if trace coverage is incomplete; must not become independent truth |
| `components/kml-import-form.tsx::reviewFor` | Pre-populates starts/takeoffs from detected landing count in GPS review | Flight-level saved counts may be correlated with the detector's initial suggestion |
| `lib/data/flight-track-review.ts` | Recalculates envelope/count for persisted-track review | The displayed inference is not persisted independent contact evidence |
| `lib/civil-twilight.ts` | Derives day/night movement suggestions using detected events | Future changes affect movement evidence, not merely map icons |
| `public.flight_tracks` | Raw `coordinates_json`, separate overview, point counts/time bounds and source filenames | Read `coordinates_json` for offline research, **not** downsampled overview as if raw |
| `public.flights` | Flight-level saved landings, takeoffs, evidence/certification/revision fields | Recorded totals and certification are coarse evidence, not exact T&G timestamps |
| `lib/track-time.ts` | Distinguishes UTC/offset from ambiguous time | Time basis is first-class; no silent timezone guess |

Confirmed real-track-derived unit regression evidence exists in `tests/v351-gps-tg-reliability.test.ts`: level shift false positive, sawtooth climb-out false positive, duplicate-fix false speed event, positive five-T&G circuit, flat-altitude stop/go and a **known missed** true rolling T&G that must remain a tracked open defect. Earlier detailed investigations: `docs/product/GPS_TOUCH_AND_GO_RELIABILITY.md`, `docs/product/3_5_1_GPS_TOUCH_AND_GO_RELIABILITY.md`.

**Critical distinction:** `GPS track` describes motion near ground, not undercarriage contact. No verified wheel-contact sensor is present in the stored point contract. A low approach vs a T&G can be observationally indistinguishable. The correct output is `CONTACT_UNRESOLVED` with a request for review rather than fabricated contact.

## 3. Read-only existing-data feasibility audit (privacy-safe)

Production source: exact Vercel-linked `logbook` Neon `production` branch, read-only SQL; no writes, no branch cloning, no exports. Queries used `jsonb_array_elements ... WITH ORDINALITY`, aggregate counts and per-track window functions and returned **only dataset-wide summaries**; no per-owner stats, registrations, coordinates, timestamps or tracks were returned to the research report.

Observed dataset includes multiple distinct owners. All stored tracks inspected had JSON arrays and point-count metadata consistent with their lengths, with valid object/position keys and nonempty timestamp/altitude fields; **this is structural availability, not proof of physical measurement accuracy, datum, source reliability or all ISO timestamps being meaningful**.

Read-only interval diagnostics found meaningful non-monotonic/duplicate timestamp transitions, substantial gaps and fast altitude edges. Therefore:
- Any window expressed as `±N samples` has variable duration across existing records;
- Derivatives on `Δt <= 0` are **UNAVAILABLE**, not zero;
- On long gaps, phase state must become uncertain rather than interpolating fabricated touchdown;
- Single-edge altitude jumps are candidate artifacts requiring robust continuity checks; not all fast vertical edges can be labeled errors without independent evidence;
- Stored altitude has no documented vertical reference/datum comparable to OurAirports airport elevation; AGL/contact estimation must remain **UNAVAILABLE** when datum is unresolved.

**Privacy:** Counts and exact raw records are deliberately withheld in this public repository. Any future user-scoped offline benchmark requires verified authorization and purpose; DB admin access alone is not permission to train on other users' traces.

## 4. Label hierarchy and leakage hazards

`GROUND_TRUTH_EVENT`: an independently confirmed event class and timing tolerance, attributable to a usable source and an authorized flight. **Not currently proven available.**

`REVIEWED_FLIGHT_TOTAL`: saved landing total + provenance of genuine human review, scope of flight and availability of complete track. Weak label for aggregate count, **not** event timestamps. `certified_at` is evidence of record certification, not of physical contact or model-independent count.

`MODEL_GENERATED_SUGGESTION`: computed by `landingCount` or another algorithm; **never** evaluate the model using its own label or a pilot field whose provenance cannot exclude it.

`UNLABELED`: no independent event annotation. Absence of annotated contact is **not evidence of no contact**.

No flight may appear in both train and test; grouping by recording session/source and owner is required when permitted. Entire user-held-out evaluation is only possible with authorized users, and evaluation results from any tiny sample must be labeled exploratory. Do not optimize thresholds against the reserved holdout.

## 5. Candidate architecture and ranking

```text
Raw permitted trajectory
  -> schema/time/datum/source validation
  -> quality masks / breakpoints / per-edge uncertainty
  -> physical features in time windows (not ±fixed sample indices)
  -> [A] deterministic phase/candidate baseline
  -> [B] exploratory HMM/HSMM phase segmentation (unsupervised/semi-supervised)
  -> optional supervised candidate scoring ONLY AFTER LABEL GATE
  -> reconcile competing hypotheses (T&G vs low pass vs go-around)
  -> EventSuggestion + evidence intervals + reason codes + CONTACT_UNRESOLVED
  -> explicit pilot review (never write automatically)
```

**A: deterministic baseline first.** Keep legacy frozen. Implement an isolated pure analysis engine later (not in this research PR), with temporal windows sized by elapsed seconds, missingness segmentation, guarded robust horizontal/vertical rates, irregular cadence awareness, runway vicinity treated as context only when backed by reliable geo reference, and fail-closed decisions. Compare candidate lists, abstentions and false positives to legacy.

**B: HMM/HSMM research.** Model phase persistence and temporal transitions to reduce flicker; HMM/HSMM may infer likely `GROUND_MOVEMENT / AIRBORNE / CLIMBING / APPROACHING / UNCERTAIN` with data-gated evidence. Phase probabilities are **not ground-contact probabilities**. HSMM explicitly models duration but introduces additional estimation/identifiability constraints. Without labels, state identities/meaning must be verified, not assigned by visual intuition.

**C: boosting/temporal neural methods.** Conditional only. Gradient boosting can classify candidate windows if **independent positive/negative event labels and legally permitted diverse users** are established. LSTM/TCN/Transformer complexity is not justified merely by a large number of highly correlated GPS fixes and no verified contact labels. An LLM must never decide physical contact or logbook fact from track description.

## 6. Benchmark protocol and pass/fail contract

**Offline only, feature flag off.** Keep identical raw inputs, source/effectivity, train/test split and quality policy. Always report denominators.

Stage A (available now via anonymized tests):
- Known real-derived false-positive controls must remain **0 proposed T&G** (quality/artifact cases).
- Known missed rolling T&G must be recorded explicitly as **MISS**, not relabeled as a negative just to make a test pass.
- Positive circuit/stop-go controls remain detected or validly flagged `NEEDS_REVIEW`, with abstention accounted separately from recall.
- Metamorphic transformations: duplicate timestamps, drop points, change sampling cadence, introduce 20s/60s+ gaps, altitude offset/step, eliminate altitude, reverse time, crop beginning/end. Identical physical trajectory under benign resampling should not introduce new *confirmed* contact; degraded signal should make the system more uncertain, not confidently wrong.
- Never interpolate through missing/ambiguous data to create artificial events.

Stage B (needs authorized flight-level reviewed counts):
- `count agreement` and distribution of `suggested - recorded`, with accepted/modified suggestion provenance if available;
- stratify by source, point cadence, track completeness and number of landings;
- test all zero/one/multi-landing cases if legitimately present; if not, explicitly mark coverage gap.
- **Count agreement is an indirect measure only.** A detector could count one missed and one false event and still agree exactly.

Stage C (currently blocked without independent event truth):
- event precision, recall, F1, timestamps error, false-contact events/100 flight hours, event-type confusion (T&G vs low pass/go-around), calibrated false positive risks, and abstention/coverage trade-offs;
- no invented numerical accuracy target or comparison PASS.

Promotion requires independently supported gain over legacy with **non-increasing critical false positives**, statistically defensible holdout, data security review and traceable risk exceptions; until then `NO-GO` for automatic logbook suggestions. This is a staged **engineering acceptance criterion**, not a regulator-approved method.

## 7. Decisions and remaining work

| Decision / gate | Status | Next evidence |
|---|---|---|
| Existing data sufficient for read-only quality analysis | **YES** | Source/schema/aggregate scan performed |
| Source altitude compatible with airport elevation for AGL | **NOT PROVEN** | Vertical reference, uncertainty and source metadata |
| Independent T&G/no-contact event labels for supervised scoring | **NOT PROVEN → BLOCKED** | Legitimate ground-truth annotation provenance |
| Owner authorization to train on all stored users' data | **NOT GRANTED** | Consent/access/governance decision |
| Legacy positive and false-positive regression fixtures | **AVAILABLE** | Existing `tests/v351-gps-tg-reliability.test.ts` |
| New actual model benchmark | **NOT RUN** | Implementation/test harness and owner approval |
| Algorithm selection | **NOT FROZEN** | Independent review of A/B/C design and data gate |
| Runtime rollout or schema change | **NOT APPROVED** | Future scoped milestone/flag/migration/release decision |

Research question for next milestone: **Can we improve T&G suggestion quality while reducing false positives and explicit uncertainty on the existing track corpus, without pretending inferred contact is observed?**

## 8. External method references (background, not FlyTally validation)

1. Perrichon, Gendre, Klein, **Hidden Markov Models and Flight Phase Identification** (Journal of Open Aviation Science, 2024), DOI: https://doi.org/10.59490/joas.2024.7269 — median global phase accuracy ~97% in an FDR-heavy evaluation; **NOT** touch-and-go contact accuracy, **NOT** tested on FlyTally.
2. DLR-MO, **Flight Phase Identification from Trajectory with LSTM**: https://github.com/DLR-MO/flight-phase-lstm — real/sim domain-transfer limitations relevant to avoiding inflated claims.
3. OpenSky state vector schema: https://openskynetwork.github.io/opensky-api/rest.html — distinguishes geo/barometric altitude, vertical rate and on_ground signals that FlyTally stored KML does **not** guarantee.
4. openSkies flight-phase detection: https://search.r-project.org/CRAN/refmans/openSkies/html/findFlightPhases.html — speed/vertical-rate/altitude windowed fuzzy baseline, not a T&G proof.

Source research cannot override FlyTally's repository contract or create an aviation-approved determination.

**Final R1 decision today: `GO_TIME_BASED_BASELINE_RESEARCH`; `NO_GO_SUPERVISED_GROUND_CONTACT_TRAINING` absent independent labels/permission.** This document records a design decision for review only, not implementation authorization.
