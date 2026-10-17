# GPS Detection 2.0 — R2.1a Batch 3: honest falsification scorecard

**Status:** Implemented in experiment-only Draft PR #350, **new tests/typecheck NOT RUN** (2026-10-17).  
**Source:** owner-approved isolated research scope, existing PR #349 R1/R2/R2.1a contract, preceding Batch 1–2 outputs and owner-local evidence.  
**No production behavior change or DB access.**

## 1. Why this batch

A detector that proposes nothing is safe from algorithmic touchdown assertions but can be useless. Conversely, interpreting `candidates.length === 0` as an epistemic abstention conflates a supported negative-pattern record (e.g., a ground-only synthetic trace) with genuinely missing/unusable data. A single `accuracy` number across positive/negative/unknown synthetic fixtures would be misleading and has no independent real-event ground truth.

Batch 3 adds `research/gps-detection-r21/falsification-scorecard.ts`, **research-only** summary types that preserve the differences between:
- `EXPECTED_PATTERN` (a synthetic/legacy *motion pattern*, **not** confirmed wheel contact);
- `EXPECTED_NO_PATTERN` (a synthetic fixture built without that candidate motion pattern, **not** proof of no physical contact);
- `UNLABELED` (unscorable as positive or negative);
- `patternCount.status=UNAVAILABLE` (true abstention/insufficient support) vs valid observation with **zero candidates**.

The result labels itself `SYNTHETIC_AND_LEGACY_REGRESSION_ONLY`, `physicalContactAccuracy=UNAVAILABLE`, and `independentHoldout=false`. No event-level precision/recall, confidence probability, certified landing count, model score or runtime statistic is emitted.

## 2. Contract and predeclared utility

`FalsificationScorecard` has separate denominators for supported positive *patterns*, fixture-negative violations, unlabeled/unscored cases, and **actual abstentions**. It also reports reason-coded hard safety violations:
- any GPS-only candidate with inferred `CONTACT_CONFIRMED`;
- unsupported or cross-island evidence spans;
- exact event time claimed on `gapAdjacent` candidates.

The **hard utility floor** pins fixture **T09 to `T_G_PATTERN_CANDIDATE`** and **T11 to `STOP_GO_PATTERN_CANDIDATE`**; both must have a supported candidate to return `hardUtility.pass=true`. The suite deliberately includes an all-`UNAVAILABLE` negative-control test that fails utility while leaving the physical-contact safety gate unchanged.

No statistical significance, real-world event accuracy or improvement over the legacy GPS inference is claimed from these synthetic categories.

## 3. Implemented tests

`tests/gps-detection-r21-scorecard.test.ts` currently has **7 newly authored test cases**:

1. Distinct synthetic expected-positive/expected-negative/unlabeled/abstention denominators.
2. Universal abstention fails required T09/T11 utility.
3. Unlabeled observations never become negative event labels.
4. Duplicate fixture identifiers are rejected.
5. Deliberately corrupted research predictions reveal fake contact, impossible support span and invented precise gap-adjacent time.
6. No numerical physical-contact accuracy or independent holdout fields.
7. Hard T09/T11 event-class mapping cannot be weakened by assigning an incorrect expected type.

**Full R2.1a coverage still open:** R2.1a T01–T20/A01–A15 remain a specification with deliberately incomplete scenario execution, not 35 validated categories. Go-around / low approach classifications (A07/A08) and real-world independent labels remain unavailable/NOT RUN. T20 HMM is future N/A. Known legacy missed T&G cannot silently be relabeled a negative. The shadow comparator still reports `preprocessingConfound=NOT_ISOLATED`.

## 4. Exact verification and subsequent step

**Before Batch 3** (owner-local, exact clean SHA `862c620a3b0e3bd6e23753aa1688ac7a9c078268`):
- targeted Node tests **41/41 PASS**;
- `npm run typecheck` **PASS**;
- all outcomes owner-local, not CI.

**Batch 3 code and tests on the next PR HEAD:** **NOT RUN**. Expected target test count is **48** (the 41 prior cases plus 7 new scorecard cases), contingent on the new test runner successfully collecting them. No PASS is claimed until the owner reruns the complete exact-SHA suite.

Owner-local follow-up from a clean checkout on branch `test/gps-detection-r21-falsification`:

```powershell
git fetch origin
git switch test/gps-detection-r21-falsification
git pull --ff-only
$expected = "<PINNED_BATCH3_HEAD_FROM_PR350>"
if ((git rev-parse HEAD).Trim() -ne $expected) { throw "Unexpected HEAD" }
if (git status --porcelain) { throw "Working tree not clean" }
npm run test:target -- tests/gps-detection-r21.test.ts tests/gps-detection-r21-batch2.test.ts tests/gps-detection-r21-scorecard.test.ts tests/gps-detection-r21-shadow.test.ts tests/gps-detection-r21-boundary.test.ts tests/v351-gps-tg-reliability.test.ts
if ($LASTEXITCODE -ne 0) { throw "GPS targeted tests FAILED" }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript FAILED" }
```

After evidence, triage any failures without tuning preregistered detection thresholds or changing red-line fixture expectations to manufacture green status. Then continue only the remaining documented falsification gaps in small scoped batches; the research model remains off production paths.

## 5. Safety, scope and closing restrictions

- No changes to `app/`, `components/`, `lib/`, data models, migrations, Neon, Vercel, recency, certified history or `flytally-training`.
- No private multi-user training, raw track export or inference by LLM.
- Test result PASS means the specific synthetic/regression contract passed; physical runway contact remains **UNRESOLVED** without independent evidence.
- PR #350 stays Draft and must not merge/deploy based solely on synthetic fixture count. PR #349 documents remain separate and Draft.
