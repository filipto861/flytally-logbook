# UI/UX Simplicity 2026 — B0.5 Baseline

**Status:** IMPLEMENTED IN BRANCH — VERIFICATION PENDING  
**Date:** 29 September 2026  
**Branch:** `fix/new-flight-b05-integrity`  
**Parent contract:** `docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`

## Purpose

B0.5 establishes the integrity and behavioral baseline before the optional-cost and visual simplification batches.

This baseline is deliberately scenario-specific. Counts and deliberate-input numbers are not universal product scores; they are evidence for comparing the same scenarios after the redesign.

## Existing screenshot density baseline

From the deterministic 29 September audit capture:

| Scenario | Desktop height | Desktop controls | Mobile height | Mobile controls |
| --- | ---: | ---: | ---: | ---: |
| Blank | 1,974 px | 57 interactive / 25 form | 2,774 px | 46 / 25 |
| Aircraft-selected PIC | 1,910 px | 71 / 36 | 2,737 px | 60 / 36 |
| DUAL | 2,334 px | 65 / 31 | 3,542 px | 54 / 31 |
| Safety Pilot | 2,521 px | 67 / 33 | 3,817 px | 56 / 33 |
| All disclosures | 2,971 px | 71 / 36 | 4,671 px | 60 / 36 |

These numbers remain secondary evidence. The implementation acceptance focuses primarily on decisions, visible evidence and completion-state clarity.

## Deliberate-input baseline

Assumptions for this comparison fixture:

- new manual flight;
- user/default Role starts at PIC;
- selected aircraft is a valid EASA SEP profile with configured billing;
- date is already supplied by New Flight defaults;
- route/times are intentionally left blank because draft save permits them to be absent;
- normal landing preset is 1;
- normal applicable PIC PF evidence is preselected.

### Normal PIC

Typical deliberate choices before draft save:

1. select aircraft.

Applied state that does not require another deliberate click:

- Date default;
- Role PIC;
- EASA / SEP / regulatory context from the aircraft profile;
- configured billing from the aircraft profile;
- 1 day landing;
- PF Yes for the applicable normal PIC/SP case.

Important audit finding: not all presets were equally visible. PF was the most important evidence-bearing preset that could remain hidden inside collapsed Flight experience.

### DUAL

For the same PIC-default fixture:

1. select aircraft;
2. change Role to DUAL;
3. enter/select Instructor / PIC when required by EASA evidence.

Normal PIC PF auto-selection does not apply to DUAL.

### Safety Pilot

For the same PIC-default fixture:

1. select aircraft;
2. change Role to SAFETY PILOT;
3. record Actual PIC using the default manual mode, or explicitly switch to a connected pilot.

Normal PIC PF auto-selection does not apply to Safety Pilot.

These counts change when the user's saved default Role differs. They are not a target to force artificially.

## Frozen preset policy

Filip approved:

- keep Role presets;
- keep the normal landing preset;
- keep the existing PF preset where the canonical rule applies;
- do not add repetitive mandatory confirmation clicks solely to expose those values;
- instead, make evidence-bearing applied values visible before save/certification in B2.

## B0.5 integrity correction

Before this branch, selected-aircraft profile defaults used a fallback path that could transform missing/invalid evidence or class into `ULL`.

B0.5 changes the form-default boundary so that:

- interactive aircraft-profile validation is reused;
- valid ULL remains ULL;
- invalid/missing profile evidence/class is not repaired to ULL;
- canonicalization that would change the stored evidence/class is rejected as an entry default;
- invalid legacy profile defaults resolve to an explicit unresolved state;
- the Aircraft & logbook disclosure opens through the existing missing evidence/class behavior;
- the Registration/profile summary exposes **Needs configuration**;
- editing an existing flight with the same registration continues to preserve its stored flight snapshot rather than re-deriving it from a mutable current profile.

## Golden payload baseline

The B0.5 regression suite adds a canonical EASA SEP PIC payload with:

- route/times;
- SP/SE;
- day landing;
- explicit PF movement evidence;
- IFR time;
- commander;
- billing share;
- task/note.

The expected complete `parseFlightInput()` output is frozen.

A source contract also verifies both manual `createFlight` and `updateFlight` continue through the same canonical `parseFlightInput(form)` path before persistence.

A duplicate identical `landingsDay` submission is also frozen as deterministic, covering the current repeated control-name behavior without pretending conflicting duplicate values are valid.

## Verification state

Not yet claimed:

- TypeScript: **NOT RUN**
- targeted tests: **NOT RUN**
- full unit/regression suite: **NOT RUN**
- build: **NOT RUN**
- PostgreSQL: **N/A for the code change; no schema change**
- browser/screenshot verification: **NOT RUN**

B0.5 is not DONE until the required local verification is completed and recorded.

## Next after B0.5 verification

**B1A — Optional Costs domain contract.**

Do not start B1A before B0.5 is verified and any regression found in the profile-default boundary is resolved.
