# GPS Detection 2.0 — Stage D3: Six-track source research and independent review

**Status: FILE-BACKED OFFLINE RECONSTRUCTION / DESIGN ONLY. No new Node verification, runtime change or release.**
Repo: flytally-logbook; research PR #366; parent PR #364 is Draft. Excludes flytally-training.

## Evidence source and authority

Owner submitted six private KMLs, five FlyTally review screenshots, and comments about tracks numbered 0–5. Research inspection parsed only local uploaded files and independently reconstructed relevant current legacy track-processing behavior using Python. **This was NOT a native Node24 execution of D1/D2 comparator on these six KMLs.** The reconstruction matches the screenshots' first five visible T&G proposal counts. The sixth result is a separate reconstructed output, not a screenshot-confirmed number. Full GPS files, filenames, registrations, coordinates, absolute UTC/dates and route geometry are NOT committed.

All six files contain MULTIPLE gx:Track elements, five files with 2 blocks and one with 3 blocks. Legacy combines them before normalization. Current V2 kmlGxTrack() (lib/gps-v2-import-lineage.ts) explicitly rejects gx:Track count other than 1 with UNSUPPORTED_SOURCE. This is a source applicability gap, not V2 "zero events". Native V2 comparator on these six remains NOT RUN.

| Anonymous sample | Owner track no. | gx:Track blocks | Raw fixes | Canonical fixes | Reconstructed legacy T&G suggestions | Owner truth / uncertainty |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| sample03 | 0 | 2 | 951 | 948 | 1 | Owner reports correct |
| sample04 | 1 | 2 | 590 | 587 | 1 | Owner reports correct |
| sample05 | 2 | 3 | 897 | 893 | 10 | Owner reports correct |
| sample06 | 3 | 2 | 77 | 74 | 0 | Owner reports correct; 0 suggestions is not proof of zero actual flight landings |
| sample07 | 4 | 2 | 596 | 593 | 6 | Owner reports 1 real T&G missed around relative +1781 seconds; unambiguous second-exact confirmation absent |
| sample08 | 5 | 2 | 1037 | 1034 | 3 | Owner thinks probably correct; possible event in gap remains UNKNOWN |

Six tracks contain **21**, not 24, legacy hypotheses (1+1+10+0+6+3). These are a selected sample; do not publish population accuracy or label unknown events as negatives. Ground truth is owner-reported with uncertainty and not wheel-contact sensor evidence. Sample03–08 are separate from earlier sample01–02.

## Confirmed missed-candidate algorithm mechanism — sample07

The owner-reported missed rolling T&G has an observed local source-height minimum at +1780.93 seconds from track start, canonical index 440. Under independent reconstruction of the *current* legacy predicates:

- Legacy median-of-five horizontal groundspeed about 129.9 km/h, within frozen 28–145 km/h.
- Local minimum in source height (value 229 m; NOT authenticated AGL/runway-relative height).
- Nearest +30m descent-side evidence at index 438 / relative +1763.63s, climb-side at index 445 / relative +1803.13s.
- Local minimum and intermediate timed ascent gates pass.
- **One inside-qualifying-span edge**, index 444→445, changes observed source altitude +15m in **0.52s** = approximately **28.85m/s**.
- Existing fail-closed 25m/s altitude jump guard rejects the proposed event.

This is a materially different failure mechanism than September's broad index-neighborhood rejection of a *distant* corrupt edge. Here the suspect edge is **inside** the qualifying descent/minimum/climb span. The user labels the event a real T&G but the GPS does not provide independently reliable contact evidence for automatic counting. Do NOT ignore this discontinuity or relax the guard just to recover this candidate. Source altitude is quantized/uncertain; source mode/provenance is not independently authenticated.

## Potential missing event in sample08

Two successive material GPS time gaps around relative +55 to +57 minutes are about **35.35s and 94.39s**. Position and source height change between endpoints. A touchdown or rolling T&G could have happened between updates, but the file cannot establish it. Outcome **UNKNOWN / UNOBSERVABLE**, neither TP nor FP nor FN for precision-recall scoring. Owner only says probably; no event confirmation.

## Segmented source compatibility is separate from landing-recognition accuracy

A multi-gx:Track recording can contain noncontinuous source segments and potential discarded duplicated fixes. Merely concatenating them would incorrectly license inferred horizontal motion across unknown provenance boundaries. Any future V2 support must preserve block-to-canonical source lineage, reject malformed/unpairable time/coord samples, handle canonical dedup/altitude conflicts, maintain exact timestamp indexing and quarantine or explicitly split motion evidence at block boundaries. A source segment is not automatically a separate flight. Do not automatically prefill or alter pilot-confirmed fields.

## D3 next design gates

1. Owner-local native comparator run for sample03–08 after exact SHA targeted tests; report redacted source status/reasons, proposal counts, no private route. For current V2, expect UNSUPPORTED_SOURCE because of multiple gx:Track blocks; verify, do not just assume.
2. Prepare independent V2 multi-segment source-lineage design: source block identity, normalized index mapping, quarantine, nonbridging speed-islands, split behavior, duplicate/submillisecond UTC, fail-closed states. No code changes until review.
3. Design rolling T&G options that retain source-quality rejection for in-span altitude jumps. An ambiguous candidate may be reviewed as NON-COUNTED only after D3 pilot-visibility policy is reconciled. No automatic adds.
4. Independent DeepSeek read-only review against repo/source evidence and redacted corpus, then owner decision on design.
5. Regression-first minimal implementation only after explicit scope and approval; updated ROADMAP/FEATURES/CHANGELOG and exact-HEAD Node/TypeScript/source/domain/browser ON/OFF gates as applicable. No deploy until separately approved.

## DeepSeek handoff (READ-ONLY REVIEW — DO NOT CODE)

FlyTally Logbook GPS V2 horizontal-only source reader is fail-closed and cannot detect gear contact. Legacy rolling-altitude branch suggests advisory T&G with 28–145 km/h, +30m shape, conservative >25m/s discontinuity exclusion. Six newly supplied KMLs contain two or three gx:Track blocks, canonical point counts 948/587/893/74/593/1034, reconstructed legacy T&G suggestion counts 1/1/10/0/6/3. Owner says first four correct, fifth misses real rolling T&G at ~+1781s, sixth is tentative with 35/94s data gaps and an unknown event. The missed candidate has a +15m/0.52s=28.85m/s source altitude jump INSIDE qualifying span, and current guard rejects. Source sensor altitude accuracy/mode are unverified. V2 currently refuses multiple KML track blocks. Pilot Review production D3 policy keeps unverified horizontal candidates HIDDEN; experimental flag must remain OFF.

Please independently review (1) safest source-lineage model for multiple gx:Track blocks including no motion bridge and canonical dedup parity, (2) policy for NON-COUNTED ambiguous rolling events containing an in-span altitude anomaly versus a blanket reject, (3) missing synthetic counterexamples and independent positive/negative labels, (4) false certainty/false ground-truth assumptions in the above, (5) trade-offs and precise DO/DO NOT acceptance. Reply with risks, alternatives and proposed test matrix. No raw routes, GPS coordinates, production changes or purported aviation authority.

## Verification ledger

Previous owner-local research HEAD 69e7e220 targeted 44/44 and TypeScript PASS, first two KML quality probes completed. Six NEW KMLs analyzed using independent Python local reproduction (not native repository tool). No new Node/unit/typecheck/build/browser/DB/deploy, no PR merge. Code unchanged. D3 documents do not inherit runtime verification.
