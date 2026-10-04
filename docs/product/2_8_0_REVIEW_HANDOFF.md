# 2.8.0 — Independent review handoff

**Review mode:** read-only / independent  
**Repo:** `filipto861/flytally-logbook`  
**Target release:** `2.8.0`  
**Branch:** `feat/2.8.0-flight-entry-simplification`

## Context

FlyTally Logbook production flight entry is functionally correct but has become too dense after multiple integrity and capability additions. The current GPS path can show upload state, warnings, split controls, map/profile, common context, per-flight review, helper/provenance copy, landing evidence, Night/IFR, movement times, notes, a generic reviewed checkbox, reviewed-count status and another review action before the pilot reaches a second page for certification.

The proposed 2.8.0 release simplifies presentation and completion without weakening evidence or certification authority.

Primary design:
`docs/product/2_8_0_FLIGHT_ENTRY_SIMPLIFICATION.md`

Versioning policy:
`docs/product/VERSIONING.md`

## Frozen constraints

- GPS remains advisory/editable.
- Missing/ambiguous evidence fails closed.
- IFR remains pilot-entered.
- Existing SERA Day/Night/Night-time suggestion semantics remain unchanged in authority.
- Certification remains explicit.
- Existing certification hash/version, compliance checks, audit/correction history, sharing gates and recency authority must be reused.
- Save draft remains available.
- No historical rewrite/backfill.
- Multi-flight import may not produce unintended partial certification.
- Existing Training purpose codes/history remain backward compatible.
- No DB migration is assumed.
- Current production product version is 2.7.0; 2.8.0 is the next planned product release.

## Proposed UX direction

Normal single-flight GPS flow:

**Source → Flight details → Save & certify**

Progressive disclosure:
- split controls hidden for one clean flight;
- map/profile behind Review GPS track, auto-opened by relevant warning;
- one compact Flight context summary for Aircraft / Role / Operation / Engine / Billing;
- crew, Training purpose, Task, Costs, professional context and diagnostics collapsed unless required/populated/problematic.

Completion:
- primary explicit **Save & certify flight**;
- secondary **Save draft**;
- remove the generic normal-case “I reviewed this flight” checkbox;
- retain only targeted acknowledgement where a specific warning genuinely requires it.

## Training-purpose issue

The structured catalogue currently contains:
1. Aircraft differences training / endorsement
2. Aircraft familiarisation
3. LAPL(A) FCL.140.A refresher
4. LAPL(H) FCL.140.H refresher
5. SEP/TMG FCL.740.A refresher
6. SPL SFCL.160 recency training
7. BPL BFCL.160 recency training

Current ULL UI filters out the Part-FCL/SFCL/BFCL purposes, leaving only the first two. This filtering is now a frozen product decision and is considered correct. Review only whether the current UI visibility and server persistence rules remain coherent; do not propose exposing non-applicable regulatory purposes or adding a new generic structured Training / practice marker in 2.8.0.

## Certification questions

Please independently review:

1. Is same-page Save & certify safe if the server reuses the existing certification compliance/hash/revision contract?
2. Is removing the generic reviewed checkbox safe if explicit submit + warning-specific acknowledgement remains?
3. What is the safest multi-flight contract?
   - save all drafts atomically, then certify all in one all-or-none transaction with draft fallback on certification failure; or
   - require one truly atomic save+certify implementation.
4. Are there any audit/correction/share/recency invariants that the proposed UX could accidentally bypass?
5. Which currently-visible sections must remain permanently visible for safety/data-integrity reasons?
6. Does the Training-purpose proposal introduce any false regulatory implication?
7. Is the numeric roadmap/versioning model coherent and simpler than the prior letter-coded milestone scheme?

## Requested verdict

Return exactly one:
- **APPROVE**
- **APPROVE WITH CHANGES**
- **BLOCK**

Then list:
- confirmed blockers;
- required changes before implementation;
- optional UX improvements;
- any premise in this handoff that conflicts with the actual repository.

Do not propose unrelated refactors or scope expansion.
