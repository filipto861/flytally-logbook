# Flight Entry Workflow 3.0 — F3.1 Production Census

**Status:** COMPLETE · READ-ONLY EVIDENCE · NO RUNTIME/SCHEMA/DATA MUTATION
**Date:** 2 October 2026
**Repository baseline:** `main@82123d11480aebd0973c540a1e530f1582211f20`

## Purpose

Quantify production blast radius before F3 aircraft-context server enforcement. All database work was read-only. No row was repaired, normalized, backfilled or rewritten.

## Profile census

| Measure | Count |
| --- | ---: |
| Aircraft profiles | 25 |
| Active profiles | 25 |
| Inactive profiles | 0 |
| Profiles failing current validator-equivalent checks | **0** |

Distribution: 11 EASA/SEP/AEROPLANE, 12 ULL/ULL/ULL, 2 EASA/GLIDER/SAILPLANE. No TMG, OTHER or Balloon profiles and no populated `part_fcl_credit_*` provenance.

One ULL profile has no Make value. That is valid under the current canonical validator because Make/Model completeness is required for EASA, not ULL.

**Implication:** there is no current production population requiring a pre-enforcement legacy-profile repair campaign. Runtime behavior must still fail closed for any future missing/invalid PROFILE context.

## Flight/profile census

Production contains **289 flights** and all 289 have a current profile match by normalized owner + registration. There are no orphaned current-registration rows in this population.

### Regulatory context divergence

A naive current-profile comparison reports 73 divergent rows. The breakdown explains the result:

| Stored context vs current profile | Flights | Certified |
| --- | ---: | ---: |
| EASA / SEP / blank historical category vs EASA / SEP / AEROPLANE | 49 | 49 |
| ULL / ULL / blank historical category vs ULL / ULL / ULL | 23 | 23 |
| ULL / ULL / blank historical category vs current EASA / SEP / AEROPLANE | 1 | 1 |
| Explicit nonblank category mismatch | **0** | **0** |

All **73** apparent category mismatches are certified legacy rows with blank persisted `regulatory_category`. There are zero blank-category drafts.

There is exactly **one** evidence/class divergence against the current profile. It is a certified historical flight dated 20 August 2026 with stored ULL/ULL context while the current profile is EASA/SEP/AEROPLANE. The current profile update timestamp is 26 August 2026, after the flight date. The census cannot infer why the profile changed, so the historical record must not be treated as wrong.

**Implication:** this is direct evidence for same-registration SNAPSHOT authority. It is not evidence for broad full-regulatory override on New/registration-change.

### Historical identity divergence

| Difference from current profile | Flights |
| --- | ---: |
| `aircraft_type` | 4 |
| `aircraft_make` | 4 |
| `aircraft_model` | 0 |
| `aircraft_variant` | 1 |
| Any identity difference | **7** |
| Certified identity differences | 4 |
| Draft identity differences | 3 |

These differences are not candidates for automatic refresh. They reinforce the existing historical identity contract: PROFILE owns identity for New/real registration change; SNAPSHOT owns same-registration historical identity.

## Multi-context population

There are currently no TMG, OTHER or Balloon flights/profiles. Two GLIDER/Sailplane profiles exist, but there are no stored Sailplane flights in the current flight population.

Therefore production frequency cannot validate TMG/OTHER A+ behavior. Those paths must be proven from the canonical domain contract and focused tests.

## F3.1 decision

The census **does not reopen A+**.

Frozen direction remains:
- PROFILE for Manual New, registration change and GPS;
- SNAPSHOT for same-registration Edit;
- evidence/class profile-owned;
- TMG/OTHER explicit choice only when `allowedFlightContexts(profile)` legitimately returns multiple contexts;
- no generic client-sent override-authority flag;
- PROFILE drift rejects rather than rewrites;
- unchanged SNAPSHOT context passes through without current-validator revalidation;
- historical identity stays snapshot-owned;
- no silent repair/backfill;
- no new provenance column in the first pass.

## Repair path

Current production has **0 invalid profiles**, so no bulk repair or migration is required before enforcement.

Future missing/invalid PROFILE context must fail closed as **Needs configuration**. The user corrects the aircraft profile explicitly and retries Save. Never auto-convert an invalid profile or flight to ULL. Historical same-registration SNAPSHOT rows are not repaired merely because today's validator would produce a different result.

## Closeout

- Database: read-only queries only.
- Schema migration: N/A.
- Runtime code: N/A.
- Certification payload/version: unchanged.
- Browser verification: N/A.
- Production deployment: N/A.

Next: **F3.2 — pure shared aircraft-context authority resolver**, not yet wired into production mutations.
