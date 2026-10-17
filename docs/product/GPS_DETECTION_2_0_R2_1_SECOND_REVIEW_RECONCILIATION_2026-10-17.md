# GPS Detection 2.0 — R2.1a full-document DeepSeek review reconciliation

**Date:** 2026-10-17  
**Workstream:** Issue #348, Draft PR #349, `flytally-logbook` only.  
**Reviewer material:** owner-provided second DeepSeek report, explicitly covering R1, R2, R2.1 and previous reconciliation in full. **Full-document independent critique RECEIVED**. Reviewer explicitly **did not access repo, source code, execute tests or SQL**, and did not inspect private GPS. It is not independent source-code verification or a test acceptance.  
**Source verification:** ChatGPT read-only GitHub checks on unchanged baseline `main@6a67a02475ab09c3271f8646427f7956ed6e590a` and Draft PR #349; source hazards from first review already independently verified and documented in [first-review reconciliation](GPS_DETECTION_2_0_R2_INDEPENDENT_REVIEW_RECONCILIATION_2026-10-17.md).  
**Production change:** NONE. No new code, data, model training, migration or deployment.

## 1. Verdict and hierarchy

**Accept the second review's conditional R2.1 approval solely for a proposed offline regression/falsification experiment.** It is **not** approval to claim empirical accuracy, to select an ML model, or to merge new GPS logic into any runtime workflow. It does **not** supply product-owner authorization to implement.

The reviewer now had full R1/R2 context: earlier missing-doc blocker is **RESOLVED for document review only**, not source verification. The model proposes a gap-aware deterministic temporal baseline first; changepoint comparison conditional; HMM/HSMM exploratory later; supervised wheel-contact/T&G model NO-GO without independent event labels and legitimate permissions. These remain research-stage rankings.

**R2.1a contract:** [Offline falsification/regression specification](GPS_DETECTION_2_0_R2_1_OFFLINE_BENCHMARK_CONTRACT_2026-10-17.md). Historical filename retains `BENCHMARK` for existing links; the **title and entire claim scope have been corrected**. No untouched holdout exists, so even perfect fixture performance is not ground-truth accuracy.

## 2. Reviewer findings → concrete changes

| DeepSeek concern | Assessment | R2.1a disposition |
|---|---|---|
| “Benchmark” overstates 20 synthetic/regression fixtures | **ACCEPT**. No independent event-level holdout | Rename scope/title to **offline falsification/regression**, explicitly forbid validation accuracy, precision/recall and model superiority claims |
| All-`UNAVAILABLE` can look safe but is useless | **ACCEPT** | Hard utility test on checked-in positive-pattern T09 and T11: each requires at least one *supported advisory pattern* candidate; abstention and misses reported with denominators; still zero predicted physical contact |
| Legacy vs new preprocessing differs | **ACCEPT** | Define production-equivalent legacy shadow adapter on identical fixture input; record normalized-vs-source-order differences and report preprocessing confound; no causal “better detector” claim |
| Missing source metadata | **ACCEPT** | Input contract includes `altitudeMode`, altitude units, vertical datum, H/V accuracy with units, source format/generator, sensor provenance and timestamp precision as `KNOWN(value) | UNKNOWN`; no default metadata inferred |
| Gap-adjacent candidate can still span missing interval | **ACCEPT** | Valid signal islands; candidate support **must not cross any gap**; gap-adjacent `GAP_ADJACENT`; precise event time `UNAVAILABLE` when source cannot support |
| `AdvisoryCount` could be used as certified movements | **ACCEPT / STRENGTHEN** | Propose distinct `AdvisoryPatternCount` namespace, no assignment/conversion to `landingCount`, `civil-twilight` or recency; forbid production imports |
| Legacy `v351` “positive” not independent touchdown truth | **ACCEPT** | Mark T09/T11 as *legacy pattern positives*, not physical-contact truth; T10 is documented known miss, not negative |
| `lib/gps-detection-research/` accidentally importable by app | **ACCEPT** | Move proposed files under top-level `research/gps-detection-r21/` and require an import-boundary regression rule covering re-exports/dynamic imports |
| Fixed fixtures can be tuned to fit | **ACCEPT** | Thresholds + reasons pre-registered **before first execution**; no tuning on T01–T20/A01–A15 red-line fixtures. Any separate dev data must be explicitly segregated; no holdout exists today |
| Additional missing adversarial scenarios | **ACCEPT** | Added A01–A15: no-altitude, mode, poor H accuracy, multievent count, cropped track ends, go-around/low pass, negative altitude, teleports, time quantization, stationary repeats, gap-adjacent, utility and resampling |

### What stays unchanged

- Source/bare GPS can yield an **unconfirmed** `T_G_PATTERN_CANDIDATE`; it **cannot establish `CONTACT_CONFIRMED`**, even if aviation motion looks convincing. This preserves product usefulness without inventing observed contact.
- `UNKNOWN` / `UNAVAILABLE` **never means false/no contact** or negative model label.
- No HMM/HSMM, boosting or deep neural training in the proposed first experiment.
- Unknown KML datum/mode and airport MSL alone cannot produce trustworthy runway AGL or touchdown.
- No mutations to production track storage, canonical/certified flights, source parser, aircraft library, training repo, recency or `civil-twilight`.

## 3. Predeclared R2.1a test/acceptance matrix

The full table is in the R2.1a specification, retained as a fixed falsification set: **T01–T20** plus **A01–A15**. T20 is a documented **future** HMM-specific scenario, not executable in the first deterministic harness: do not count it as an executed pass or failure. Record the actual executed denominator (e.g. 34/34 if 20-1+15 become runnable) and distinguish `NOT RUN` and `N/A`.

**Hard safety FAIL if** any bare GPS yields confirmed physical contact or negative contact label; invalid Δt creates speed=0 stationary evidence; any hypothesis spans a missing-data support interval; precise time is invented through a gap; null altitude changes into measured 0; unknown altitude reference is treated as verified AGL; or any research component is imported by production code.

**Hard utility FAIL if** all-positive-pattern controls return only `UNKNOWN/UNAVAILABLE`; predeclare T09 and T11 each need >=1 valid supported advisory candidate under their synthetic fixture conditions. No forced contact labels, no cheating by tuning acceptance fixtures; report coverage/abstention and legacy differences transparently. A failed utility gate is an experiment result, not a reason to weaken the expected behavior.

**Interpretation limits:** fixture regression PASS proves only preservation of the specified synthetic invariants and known regression shape. No validated event precision/recall or physical touchdown accuracy follows. Parameter development using different, separately recorded fixtures does not create a true independent test holdout by itself.

**Baseline comparison:** use identical *input fixture* to the exact original production parser and detector (legacy adapter) and new research ingest. Report where normalization/order/dedup changes outputs, to separate preprocessing from event logic. If only preprocessed `KmlPoint[]` is available, label the comparator `post-normalization-only` and mark upstream source-order comparison `UNAVAILABLE`.

## 4. Provenance and next decision

- Independent second AI: **full R1/R2/R2.1 document REVIEW RECEIVED; conditional research-only approval**. It has **not** accessed source/repo/tests/DB; do not call code-verified approval.
- Source hazard verification: already checked directly via GitHub in first-reconciliation cycle, with explicit line references.
- R2.1a specification: **REVISED / DRAFT**; no code branch, fixture harness or actual benchmark yet.
- Next step: product-owner approves/revises the **exact isolated synthetic-only implementation scope**. Then create a separate `test/gps-detection-r21-falsification` branch; keep `main` and Draft PR #349 untouched until its review/merge is separately authorized.
- Implement harness-first, execute explicit tests and document statuses honestly; all current `npm test`, `typecheck`, `build`, Playwright, Postgres acceptance and performance metrics are **NOT RUN** for this research work.
- Training corpus and supervised contact ML remain **NO-GO** given existing label/authorization limits.

**Final decision today:** `R2_1A_DESIGN_READY_FOR_OWNER_REVIEW` subject to source-boundary and fixture-level constraints, `R2_1A_IMPLEMENTATION_NOT_AUTHORIZED`, `NO_MODEL_TRAINING`, `NO_PRODUCTION_CHANGE`.
