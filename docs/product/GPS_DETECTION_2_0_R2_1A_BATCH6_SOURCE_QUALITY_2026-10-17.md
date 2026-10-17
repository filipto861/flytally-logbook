# FlyTally GPS Detection 2.0 — R2.1a Batch 6: source-quality & T19 falsification

**Date:** 2026-10-17
**Repo:** `filipto861/flytally-logbook`
**Branch:** `test/gps-detection-r21-falsification`, [Draft PR #350](https://github.com/filipto861/flytally-logbook/pull/350).
**Status:** BOUNDED OWNER-LOCAL ACCEPTANCE: **83/83 targeted Node PASS + TypeScript PASS** on clean exact source `681c62d90d21fdf1efd4aa3ada83383249ea857b`; pre-execution snapshot details retained below.
**Prior accepted owner-local baseline:** clean exact `b6af89d586cd6264ff2549a29e80333b80c50e9b`: GPS targeted **69/69 PASS**, TypeScript PASS; does not certify the Batch 6 changes.

## Intent & decision

Address a bounded T19/A02/A03 evidence gap without inventing source precision, aircraft performance, AGL or wheel-contact truth. In prior research `SourceMetadata` was typed but ignored by the pattern detector. An explicitly declared `clampToGround` mode or **feet** could be silently interpreted against a **30-meter** predeclared experimental reversal threshold; that is not safe or physically meaningful without a sourced conversion/applicability determination.

**New source quality result (all research-only, caller-declared and NOT authenticated):**

- `ResearchAnalysis.sourceQuality.vertical`: `UNVERIFIED` / `RELATIVE_CHANGE_ONLY` / `UNAVAILABLE` with explicit reason. A vertical datum is `UNKNOWN` or `DECLARED_NOT_VERIFIED`; never inferred from GPS altitude/airport elevation. Even `RELATIVE_CHANGE_ONLY` **does NOT authorize AGL, terrain clearance, runway contact or touchdown**.
- Explicit `altitudeMode=clampToGround` / `other` or unconverted `altitudeUnit=ft` disables **altitude-reversal hypotheses AND metric vertical-rate edge checks**, preserving horizontal speed / valid signal islands; this does not remove valid horizontal stop/go evidence. No absent-unit conversion is invented. No implicit feet conversion and no change to experimental thresholds. Malformed known negative/nonfinite **verticalAccuracyM** likewise suppresses vertical hypotheses.
- Missing metadata remains `UNVERIFIED` (NOT deemed approved/valid) while preserving earlier synthetic T09/T11 utility fixture behavior. That existing research-only compatibility choice is **not acceptable as automatic production authority**; pilot-facing use needs separate availability/approval gating.
- `horizontalAccuracyM`: `UNKNOWN`, `DECLARED_NOT_VERIFIED` with exact nonnegative finite numeric source claim including zero, or `INVALID` (negative/NaN/Infinity). `INVALID` causes **zero candidates** and `PATTERN_ONLY UNAVAILABLE / INVALID_SOURCE_METADATA`, not an inferred zero-accuracy default. A declared 1500 m value is retained verbatim, but no invented cutoff is used to claim aircraft/runway proximity.
- `runwayProximity="UNAVAILABLE"` unconditionally. No runway matching or contact truth from a source's accuracy declaration. Existing research `physicalContactStatus="UNRESOLVED"` remains.
- Scorecard emits safety violations for a forged altitude hypothesis when vertical source is `UNAVAILABLE`, for candidates with malformed horizontal source metadata, or when `sourceQuality` is absent. The new cases test these failure paths.
- T19 quantization is **not inferred** from repeating numeric altitudes alone; a flat synthetic signal is a negative control, not a sensor-resolution claim. No meaningful independent physical-contact truth/precision is now available.
- Does not change archived source parsing/normalization, data model, timestamps, speed algorithms, legacy comparator, landing count, aircraft limitations, new T&G thresholds, or A07/A08 go-around / low-approach classification.

## Exact files

- `research/gps-detection-r21/detector.ts`: additive `SourceQualityAssessment`, pure `assessSourceQuality`, explicit vertical and horizontal evidence gating.
- `research/gps-detection-r21/falsification-scorecard.ts`: reject absent or forged source-quality provenance.
- `tests/gps-detection-r21-batch6-source-quality.test.ts`: **14** new synthetic negative/positive assertions for unknown/declared/mismatched metadata, clamped and feet alt, metric-rate separation, quantized-looking flat input, unknown vs declared datum, poor/invalid horizontal accuracy, malformed vertical accuracy, forged scorecards and exact zero-vs-unknown.
- ROADMAP.md, FEATURES.md, CHANGELOG.md and earlier coverage-audit appendix.

## Bounded acceptance

**Expected targeted suite 83 tests**: previously owner-verified **69** plus new **14**. These are not 83 independent ground-contact truth labels. The following are **NOT RUN for this changed source**: targeted Node suite, `npm run typecheck`, full Node, production build, Playwright, PostgreSQL RLS, real-track accuracy, CI and deploy.

After updating to the exact clean current branch commit, run the same nine GPS/legacy test files as Batch 5 **plus** `tests/gps-detection-r21-batch6-source-quality.test.ts` and `npm run typecheck`. No production secrets, DB or GPS uploads are required.

**Acceptance:** (1) 83/83 targeted PASS, 0 fail/skip, strict TypeScript PASS; (2) previous T09/T11 utility and A13 reason-coded boundary evidence remain intact; (3) mismatch cases abstain/suppress vertical hypotheses instead of pretending source-valid MSL/AGL; (4) no `app/`, `lib/`, `server/`, DB, auth or production changes; (5) documentation records exact owner tested SHA with limitations.

**Not full T19 / A02 / A03 closure:** source parser fidelity, altitude quantization precision, independent sensor accuracy, actual reference-surface contradiction and runway geometry are **still unverified**. Do not upgrade these 35-case matrix rows to full COVERED or assert superior real-world touchdown recognition.

**NO-GO retained:** P0-D3 real PostgreSQL RLS and independent owner-identity / strict no-write / consent gates OPEN; no owner/private tracks, Neon/production DB queries, migrations, trained models, GPS runtime/Logbook auto counts, user UI switch, merge/deploy or edits to `flytally-training`.

**Next after owner-local PASS:** independently source-review metadata semantics with DeepSeek, then specify an advisory pilot-review DTO and promotion boundaries (read-only suggestions, no automatic certified flight mutation). Do not bypass P0 security by treating a purely in-memory experiment as user-data authorization.

## Owner-local Batch 6 acceptance and evidence (2026-10-17)

**PASS — LIMITED SYNTHETIC RESEARCH ONLY.** Owner ran the predeclared test command on the clean exact checked-out branch `test/gps-detection-r21-falsification` at `681c62d90d21fdf1efd4aa3ada83383249ea857b`. `git fetch origin`, `git pull --ff-only`, `git status --porcelain` (empty) and strict `git rev-parse HEAD` guard succeeded. Ten targeted GPS R2.1a/R2.1b/legacy test files were executed through `npm run test:target`: **83/83 Node PASS**, **0 fail, 0 skipped, 0 cancelled, 0 todo**, including all fourteen new Batch 6 source-quality cases. `npm run typecheck` (`tsc --noEmit`) returned successfully, the following explicit `$LASTEXITCODE` check passed, and PowerShell printed `GPS BATCH 6 LOCAL GATES PASS`. **This is owner-local, not CI.**

Earlier `NOT RUN` statements above reflect the initial authored-only snapshot and are superseded **only for the exact tested code SHA**. Subsequent documentation-only commits do not establish a new executable test SHA. Historical 69/69 at clean `b6af89d5` remains separate earlier Batch 5 evidence.

**Bounded acceptance:** negative and positive synthetic tests for altitude source mode/unit, unsupported feet/clamped altitude in metric-reversal/vertical-rate checks, unverified datum, malformed known H/V accuracy, preserved horizontal evidence, source-quality scorecard forgery, original T09/T11 utility and earlier A13 provenance are green. This is **not** evidence that any real-world recording has accurate source units, independent sensor provenance, effective vertical datum, runway contact, go-around/low approach type or actual touchdown; the physical contact field remains `UNRESOLVED`, whole-flight bare-GPS landing counts remain `UNAVAILABLE`. T19/A02/A03 remain PARTIAL in the overall 35-case falsification contract; passing these 14 cases does not close all of those clauses.

**NOT RUN / NO-GO:** full Node suite, production build, browser/Playwright, actual PostgreSQL native RLS, strictly authorized no-write owner data access, real GPS/independent labels, ML/model validation, certified flight edits, migrations, PR merge, deployment or production release. Existing PG16/PG18 services and `flytally-training` untouched. PR #350 remains Draft.

**NEXT:** independent actual changed-source semantic review (especially source-metadata interpretation), then a separately designed advisory pilot-review DTO with an explicit boundary against automatic promotion into canonical/certified flights. No private GPS access or production integration until the P0-D3 security and product approval gates are separately satisfied.
