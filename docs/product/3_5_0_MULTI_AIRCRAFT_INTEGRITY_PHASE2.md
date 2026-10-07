# 3.5.0 Phase 2 — Remaining multi-aircraft integrity audit

**Status:** REVIEW COMPLETE / RUNTIME BATCH 1 IMPLEMENTED / VERIFICATION PENDING  
**Date:** 7 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `feat/3.5.0-certified-flight-voiding`  
**Production baseline:** product `3.4.1`, PostgreSQL schema v19  
**Phase 1 candidate state:** local gate verified; schema v20 not deployed

## Objective

Close the remaining historical/dynamic aircraft-applicability integrity questions without weakening existing recency behavior, certification evidence, or backward compatibility.

This phase is not permission to reinterpret historical flights from today's mutable aircraft profile. Stored flight facts remain authoritative unless a separate, explicit and provenance-backed eligibility mapping is intentionally external to the flight record.

## Frozen constraints

- Preserve ordinary certified ULL / Annex-I aeroplane PIC → SEP experience credit already implemented by the recency engine.
- Preserve the explicit `part_fcl_credit_class`, `part_fcl_credit_basis`, `part_fcl_credit_from` mapping as a separate applicability/provenance concept; do not silently convert it into flight evidence.
- Missing or malformed applicability data must not be invented or repaired to a plausible value.
- Manual and GPS must persist equivalent aircraft-context snapshots for equivalent inputs.
- Same-registration historical edits must stay SNAPSHOT-authoritative; today's profile may not silently rewrite the stored context.
- Certification v1–v8 compatibility and existing certified revision fingerprints must remain unchanged unless a separately reviewed migration proves necessary.
- No production migration/deployment during this audit.

## Repository census

### Historical context consumers — snapshot-owned

The following use persisted `flights` fields for historical classification/credit and do not require today's aircraft profile to reinterpret the record:

- Dashboard and Statistics / pilot insights: persisted `regulatory_category`, `aircraft_class`, `evidence` with conservative legacy fallback.
- Professional experience: persisted certified Part-FCL `regulatory_category`.
- Print/export category partitioning: persisted flight context.
- SPL recency: persisted `regulatory_category`, `aircraft_class`, launch/movement evidence.
- Balloon recency: persisted `regulatory_category`, balloon class/group/operation and movement evidence.
- Helicopter flight recency: persisted flight `aircraft_model`, then bounded legacy flight `aircraft_type`; an existing PostgreSQL acceptance test proves editing today's aircraft model cannot rewrite the historical type result.

### Current-profile dependencies that are not historical reinterpretation

- Helicopter recency also reads active helicopter profiles to enumerate/setup type workspaces. Historical flight type itself still comes from the flight snapshot.
- Aircraft/Data-health presentation compares a stored flight with the current profile and labels the comparison explicitly as current-profile consistency. It is diagnostic, not recency authority.
- Flight detail may display current-profile convenience metadata such as ICAO type; this is not regulatory-credit authority.

### Authoritative current-profile dependency requiring review

`lib/recency-service.ts` and `lib/recency-audit-service.ts` join the matching aircraft row only for:

- `part_fcl_credit_class`
- `part_fcl_credit_basis`
- `part_fcl_credit_from`

They do not source the historical flight's evidence/class/category/type from the aircraft row.

This is structurally different from ordinary flight snapshot data. It is an external eligibility mapping for Annex-I/ULL experience and carries an effective-from concept. Copying it into every flight would freeze a regulatory/applicability mapping at flight creation and would prevent a later evidence-backed mapping from applying to eligible historical flights after its stated effective date.

## ULL / Annex-I credit behavior that must remain

The current engine has two paths:

1. **Ordinary ULL aeroplane** — profile-independent automatic SEP mapping.
2. **Explicit atypical override** — `part_fcl_credit_class` may map a genuine exceptional case such as TMG, with `part_fcl_credit_from` limiting effectivity.

ULL flights do not replace required FI/CRI refresher evidence, and established category-specific rules remain separate.

## Integrity gap found

The aircraft-profile write validator currently requires an explicit credit class to carry both:

- a non-empty basis/reference; and
- a valid ISO effective-from date.

The recency evaluator itself does not enforce that complete tuple. If it receives `partFclCreditClass`, it can use the override even when basis/effectivity is missing or malformed.

That creates a contract mismatch between write-time profile validation and read-time regulatory evaluation.

However, v1.51.3 historically allowed a class-only override with optional valid-from, and v1.51.4 intentionally hid the override UI without deleting stored metadata. Therefore a strict read-time change could invalidate legitimate legacy records. Backward compatibility forbids changing this blindly.

## Independent review + repository reconciliation

The independent review accepted the core separation: historical flight facts stay snapshot-owned, the explicit Part-FCL mapping stays external/effective-dated, one shared resolver is the right minimal boundary, and neither schema v21 nor a certification payload change is justified.

Repository history then narrowed the legacy question further:

- commit `5f100350` (v1.51.3) explicitly exposed the override as `Credit as SEP/TMG` with **optional** valid-from and **optional** basis/reference;
- commit `8329aaaf` (v1.51.4) hid those controls but deliberately preserved all three stored fields as hidden values;
- commit `3a14d21` later introduced a strict canonical validator for **new/edited/imported** profiles and explicitly said exact restore and ULL/Annex-I semantics were to remain unchanged;
- exact account restore still inserts the stored aircraft row without running current profile validation.

Therefore a class-only, basis-only-with-class, or valid-from-only-with-class tuple is not evidence of corruption by itself: it is a legitimate v1.51.3 shape. There is no reliable row-level marker that can distinguish those historical shapes after later edits/restores. A synthetic cutoff or guessed legacy flag would be weaker than the repository evidence.

The actual regression is elsewhere: Flight Entry PROFILE authority reused the later strict validator, and ordinary Aircraft Edit also revalidated hidden legacy credit metadata. A legitimate v1.51.3 profile can therefore become unusable for Manual/GPS entry or unrelated Aircraft edits even though recency still intentionally accepts it.

Runtime Batch 1 fixes that boundary without weakening new writes:
- strict `validateAircraftProfile` remains authoritative for new/imported profile writes;
- `validateStoredAircraftProfile` accepts the historical optional basis/from contract for already-persisted profiles, while rejecting malformed non-empty effective dates;
- Manual/GPS PROFILE authority uses the stored-profile validator because Part-FCL credit is external applicability, not flight context;
- Aircraft Add/Edit preserves an existing hidden credit tuple server-side instead of trusting/modifying hidden form values; brand-new profiles still use strict validation;
- `resolveAnnexCredit` makes automatic / explicit / legacy-compatible / invalid states explicit and `isAnnexCreditForClass` remains the shared calculation+audit eligibility boundary;
- a malformed non-empty effective date now fails closed instead of being treated as no boundary.

Shared-profile import remains strict. Its broader legacy-sharing/recovery behavior belongs to the planned 3.9 sharing/recovery closeout unless new evidence makes it a 3.5 blocker.

## Resolved design direction

Resolved direction after review and repository-history reconciliation:

- **Do not add flight columns and do not introduce schema v21 solely for this issue.**
- Keep ordinary ULL → SEP automatic and profile-independent.
- Keep the explicit mapping external/effective-dated rather than snapshotting it into certification.
- Introduce one canonical resolver for the optional explicit mapping and use it identically in recency calculation and audit.
- Resolver must distinguish:
  - no explicit override → automatic ULL → SEP path;
  - complete current explicit tuple → mapped class applies on/after its effective date;
  - malformed non-empty effectivity → fail closed for the explicit override, never silently coerce it;
  - v1.51.3 legacy explicit tuples → preserve their documented optional basis/from semantics when consuming an already-persisted profile;
- Do not change certification payload/hash version merely for an external eligibility mapping.
- Add regression evidence proving current profile changes cannot alter historical flight category/type, except through the explicit external credit mapping by design.

## Acceptance matrix for implementation

Before runtime change:
- characterization suite: `tests/v350-phase2-multi-aircraft-integrity-audit.test.ts` — initial 4/4 PASS on `69310a3`; expanded Runtime Batch 1 coverage pending verification;
- source/contract test: no recency consumer may source historical evidence/class/category/type from current aircraft profile;
- source/contract test: the only aeroplane recency current-profile join is the explicit `part_fcl_credit_*` tuple;
- Manual/GPS equivalence test for persisted flight context and identity snapshot;
- legacy compatibility characterization for class-only `part_fcl_credit_class`.

If the reviewer approves a resolver change:
- unit tests for automatic SEP, explicit TMG/effective-date mapping, malformed tuple fail-closed, and any explicitly bounded legacy compatibility;
- recency audit must show the same eligibility result/provenance as the calculation;
- PostgreSQL acceptance only if persistence behavior changes;
- certification fingerprints v1–v8 remain bit-compatible;
- no migration unless actual stored-data evidence proves one necessary.

## DO NOT

- Do not join current aircraft `aircraft_class`, `regulatory_category`, `evidence`, make/model/type into historical recency eligibility.
- Do not backfill certified flights from current aircraft profiles.
- Do not invent a default class for malformed explicit credit metadata.
- Do not remove ordinary ULL → SEP automatic credit.
- Do not snapshot `part_fcl_credit_*` into certified flight evidence without a new reviewed product decision.
- Do not deploy schema v20 as part of this analysis.

## Independent review questions

1. Is the separation correct: flight snapshot owns historical facts, while `part_fcl_credit_*` is an external effective-dated applicability mapping?
2. Should the explicit mapping remain dynamic/current-profile based rather than being copied into flight snapshots?
3. Is a single read-time resolver the right minimal fix for the validator/evaluator contract mismatch?
4. How should legacy class-only overrides be handled without either inventing provenance or silently breaking existing eligibility?
5. Does any proposed fix require a new database migration or certification payload change? The current recommendation is **no**, absent contrary evidence.
