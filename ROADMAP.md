# FlyTally Logbook Roadmap

**Status:** Active  
**Owner:** Filip Točík  
**Last updated:** 29 September 2026

This is the canonical planning document for `flytally-logbook`. It answers **what is complete, what we are doing now, what comes next, and why**.

- `FEATURES.md` = product capability inventory.
- `CHANGELOG.md` = changes that actually shipped.
- `ARCHITECTURE.md` = current architectural and data-integrity invariants.
- `DEVELOPMENT.md` = implementation and verification workflow.
- detailed milestone contracts belong under `docs/product/`;
- superseded release plans remain under `docs/history/`.

A roadmap item is not DONE until implementation, required verification and documentation closeout are complete.

## Status legend

- ✅ **DONE** — implemented, verified and merged.
- 🚧 **ACTIVE** — current work.
- ➡️ **NEXT** — first implementation work after ACTIVE closes.
- ⏳ **PLANNED** — accepted direction, not yet next.
- ⏸️ **PAUSED** — already started but intentionally not the current priority.
- 🔬 **RESEARCH** — not implementation-ready.
- ⚠️ **BLOCKED / EXTERNAL** — completion depends on evidence or a decision outside the repository.

## Progress overview

| Area / milestone | Status | Current state |
| --- | :---: | --- |
| Core logbook / certified record integrity | ✅ | Production foundation complete |
| Multi-category pilot logbook | ✅ | Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other supported |
| Flight entry / review / GPS workflows | ✅ | Canonical manual/GPS review workflow established |
| Recency / licences / evidence | ✅ | Evidence-first workspace live; helicopter historical type integrity hardened |
| Sharing / Connections / Action Center | ✅ | Shared-flight, instructor and aircraft-profile collaboration live |
| Statistics / professional workspace | ✅ | Pilot analytics and professional-experience layer live |
| Backup / recovery / protected history | ✅ | Portable backup, review-first restore and protected-history preservation implemented |
| Compliance & safety foundation | ✅ | Technical compliance/security foundation complete |
| Commercial & external validation foundation | ✅ | Technical foundation complete; external approvals remain separate |
| UX & design consistency | ✅ | Previous consistency/polish audit Batch 1–11 complete |
| UI/UX Simplicity Audit 2026 | ✅ | **DONE** · B0.5–B5 merged; final authenticated matrix 132/132 screenshots verified across required viewport/theme states |
| Documentation governance | ✅ | ROADMAP / FEATURES / CHANGELOG governance and repository cleanup complete |
| Multi-aircraft M0 — contract & evidence audit | ✅ | Source-of-truth matrix and consumer inventory complete · PR #153 |
| Multi-aircraft M2A — helicopter snapshot integrity | ✅ | Historical type resolution fixed and fail-closed · PR #154 |
| Multi-aircraft M1 — canonical profile validation | ✅ | Add/Edit + shared import use one fail-closed contract · PR #155 |
| Roadmap review & prioritization | ✅ | Product order reviewed, independently challenged and approved by Filip on 27 September 2026 |
| GPS touch-and-go detection reliability | ✅ | Priority 1 complete; discontinuity validation is bounded to the physical T&G evidence span without changing thresholds or take-off semantics |
| Safety Pilot ↔ PIC shared-flight workflow | ✅ | SP1–SP5 complete and merged; original Safety Pilot-specific workflow remains closed and preserved |
| General PIC invitation across source roles | ✅ | DONE · PR #169 merged; migration v16 applied/verified; production deployment READY and public smoke 200 |
| Multi-aircraft Product Scale | ⏳ | M0/M2A/M1 complete; **M2B is the next roadmap step** after UI/UX Simplicity closeout |
| Saved-date / timezone semantics · issue #144 | ⏳ | Known persisted-default inconsistency; semantics decision required before code |
| Currency / monetary semantics · issue #136 | ⏳ | Known business-rule inconsistency; define account vs per-record currency before code |
| Professional Logbook Platform | 🔬 | Organization/operator/fleet workflows remain research-only |

## Roadmap review & prioritization — DONE

The product-wide roadmap review is complete. Filip approved the reconciled priority order on **27 September 2026** after independent second-AI review and repository reconciliation.

The following execution order is frozen unless new evidence exposes a higher-severity data-integrity or production issue:

| Order | Workstream | Status | Why it is here |
| ---: | --- | :---: | --- |
| 0 | Roadmap review / freeze | ✅ | Product-wide order approved and documentation frozen |
| 1 | GPS touch-and-go detection reliability | ✅ | Real-track defect reproduced, fixed with evidence-span locality and regression-verified |
| 2 | Safety Pilot ↔ PIC shared-flight workflow | ✅ | SP1–SP5 complete · PRs #162–#166 merged |
| 3 | General PIC invitation across source roles | ✅ | DONE · PR #169 merged, production v16 applied, deployment READY |
| 4 | UI/UX Simplicity Audit 2026 | ✅ | DONE · B0.5–B5 merged, final authenticated live matrix PASS, visual closeout complete |
| 5 | Multi-aircraft M2B — remaining integrity audit | ⏳ | **NEXT** · resume the historical/dynamic applicability integrity audit unless a higher-severity production issue pre-empts it |
| 6 | Saved-date / timezone semantics · #144 | ⏳ | Can persist the wrong calendar date around timezone boundaries |
| 7 | Currency / monetary semantics · #136 | ⏳ | Current setting and hard-coded CZK surfaces need one business contract |
| 8 | Multi-aircraft M3 — heterogeneous onboarding proof | ⏳ | Prove no-code onboarding across supported categories |
| 9 | Multi-aircraft M4 — sharing/recovery/scale closeout | ⏳ | Close the phase with cross-workflow and scale evidence |
| 10 | Professional Logbook Platform | 🔬 | Only after pilot-logbook foundations are stable in real use |

**Priority rule:** production/data-integrity defects can pre-empt this order. The active simplicity audit is treated as a core data-entry usability/integrity workstream, not cosmetic convenience work: reducing confusion must not weaken evidence or validation.

## P1 — GPS touch-and-go detection reliability — DONE

A real GPS import produced the wrong landing suggestion during touch-and-go operations. The exact failure was reproduced and fixed by bounding rolling-T&G altitude-discontinuity validation to the candidate's own physical descent/minimum/climb evidence span.

Detailed investigation contract:

`docs/product/GPS_TOUCH_AND_GO_RELIABILITY.md`

Roadmap-level acceptance:
- reproduce the exact real-track mismatch before changing detector logic;
- create a minimal/anonymized regression fixture;
- classify the evidence-backed failure mechanism;
- keep GPS-derived movements advisory and reviewable;
- re-run the existing GPS/track regression corpus so the fix does not create new false positives;
- where sampling-rate sensitivity is confirmed, require stable classification across representative sampling intervals.

Closeout: the existing 28–145 km/h and 30 m qualification thresholds remain unchanged; take-off discontinuity semantics and unrelated point-count grouping/dedup rules remain unchanged. The anonymized sparse fixture failed before the fix and passed after it while the in-span corruption case remained fail-closed.

## P2 — Safety Pilot ↔ PIC shared-flight workflow — DONE

User goal:

- source pilot records their own flight as **SAFETY PILOT**;
- Actual PIC can be selected from accepted Connections or entered manually;
- when a connected PIC was explicitly selected, the source pilot may invite them after certification to add an independent copy as **PIC**.

Detailed workflow/data-model contract:

`docs/product/SAFETY_PILOT_PIC_WORKFLOW.md`

Frozen roadmap-level boundaries:
- historical Actual PIC display text remains the existing certification-protected `commander` evidence;
- connected identity is separate collaboration metadata, never inferred from the name text;
- connected identity is not added as mutable data to the certified `flights` row;
- selecting a connected PIC never sends an automatic invitation;
- invite and accept both re-check accepted Connection state and exact source revision/hash;
- recipient gets an independently owned PIC record;
- source SAFETY PILOT record never gains PIC credit;
- manual-only Actual PIC remains fully valid;
- no automatic invitation expiry is introduced; existing cancellation/revocation semantics remain the baseline;
- any required schema change is additive, tenant-safe and backward-compatible.

The connected identity is modeled as a separate pre-participation collaboration link. Exact schema/table naming is an implementation-design detail, but no name matching is permitted.

Independent second-AI implementation-design review is complete and reconciled against the repository.

The review returned **APPROVE WITH CHANGES**. The accepted changes are now frozen in `docs/product/SAFETY_PILOT_PIC_WORKFLOW.md`: explicit fail-closed PIC combination handling, unconditional exclusion of PIC from the generic arbitrary-recipient crew selector, certified `commander` materialization for PIC recipients, live revoked-Connection UI gating, and migration v15 placement in the tracked schema sequence.

The design gate and implementation are closed. **SP1 — schema + pure domain contract is DONE and merged in PR #162. SP2 — create/edit connected/manual Actual PIC persistence is DONE and merged in PR #163. SP3 — dedicated certified PIC invitation is DONE and merged in PR #164. SP4 — PIC materialization + recency proof is DONE and merged in PR #165. SP5 — lifecycle/release closeout is DONE and merged in PR #166.**

SP1 staging remains fail-closed: `PIC` is excluded from the legacy generic crew selector, rejected by the generic invite server action, and intentionally not materialized until SP4 supplies the full certified-commander / Connection-recheck / recency contract.

SP1 verification evidence: current-branch unit/regression suite 875/875 PASS; TypeScript PASS; production build PASS; migration v15 and connected-PIC persistence constraints exercised successfully on an isolated Neon branch and then deleted. After explicit approval, the same verified migration v15 was applied successfully to the production Neon branch; post-migration verification confirmed the new table, owner FK and PIC participation constraint, with zero connected-crew rows.

SP3 verification evidence:
- dedicated server-side PIC invite derives the target only from persisted connected-PIC metadata;
- invite requires an owned certified Safety Pilot source, non-empty certification hash and a live accepted Connection;
- generic arbitrary-recipient sharing still excludes/rejects PIC;
- certified flight UI exposes the linked Actual PIC separately and fails closed when the Connection is revoked;
- GitHub Verify FlyTally web PASS on final SP3 runtime head: 890/890 unit/regression tests, 0 fail, 0 skip;
- PostgreSQL core acceptance PASS: 47/47, 0 fail, 0 skip across 20 core files;
- authenticated Chromium desktop/mobile smoke PASS: 22/22;
- SP4 materialization remains intentionally out of SP3.

SP4 verification evidence:
- recipient PIC materialization uses the certification-protected source `commander` while preserving existing non-PIC commander behavior;
- PIC acceptance/materialization rechecks exact source revision/hash, source SAFETY PILOT role and live accepted Connection;
- canonical PIC credit and ordinary PIC recency equivalence are regression-proven; source SAFETY PILOT contributes no PIC credit/movements;
- PostgreSQL acceptance proves independent recipient ownership, duplicate reuse and revoked-Connection fail-closed behavior;
- GitHub Verify FlyTally web PASS: 895/895 unit/regression, 0 fail, 0 skip;
- PostgreSQL core acceptance PASS: 48/48 across 20 core files, 0 fail, 0 skip;
- authenticated Chromium desktop/mobile smoke PASS: 22/22; production build PASS;
- SP5 correction/revision lifecycle and release closeout remain separate.

SP5 verification evidence:
- correction lifecycle supersedes only pending invitations bound to the old certified revision and preserves connected-PIC metadata on the source flight;
- already materialized recipient records remain independent and are not rewritten by source correction;
- source cancel and recipient decline remain pending-only and identity-scoped; dedicated PIC reinvite reopens declined/cancelled requests without overwriting accepted/materialized state;
- certification payload/version remains unchanged;
- PostgreSQL lifecycle acceptance includes cancelled → reinvite behavior;
- authenticated browser coverage includes cancel → reinvite → pending → cancel plus revoked-Connection fail-closed state;
- GitHub Verify FlyTally web PASS: 900/900 unit/regression, 0 fail, 0 skip;
- PostgreSQL core acceptance PASS: 48/48 across 20 core files, 0 fail, 0 skip;
- authenticated Chromium desktop/mobile smoke PASS: 22/22; production build PASS;
- no new schema migration is introduced by SP5; the prerequisite v15 migration was already production-verified during SP1.

P2 closeout:
- SP1–SP5 are merged to `main` through PRs #162–#166.
- Final SP5 verification: 900/900 unit/regression PASS, PostgreSQL core 48/48 PASS across 20 files, authenticated Chromium desktop/mobile 22/22 PASS, production build PASS.
- Migration v15 was already applied and production-verified during SP1; SP2–SP5 introduced no additional schema migration.
- No production deployment is inferred from merge/test success; deployment status is tracked separately.
- Next roadmap step is Multi-aircraft M2B — remaining integrity audit.

SP2 implementation contract:
- New Flight loads all accepted Connections as explicit `id + display_name` choices separate from the instructor-only list;
- Safety Pilot Actual PIC supports either a connected selection or manual text, with no name matching;
- connected selection submits an explicit account ID and the server canonicalizes `commander` from the selected account's current display name after rechecking accepted Connection state;
- create/update synchronize the flight row and `flight_connected_crew` link in one transaction;
- switching to manual PIC or changing the flight away from SAFETY PILOT removes the current PIC link;
- edit/correction reloads the current link by flight ID and never derives identity from `commander`;
- no invitation is sent in SP2; SP3 remains the first invitation milestone.

SP2 verification evidence:
- TypeScript PASS on final SP2 runtime head;
- full unit/regression suite 885/885 PASS with 0 fail / 0 skip;
- production Next.js build PASS;
- isolated Neon persistence acceptance PASS for connected create/update, server-canonicalized commander, fail-closed rejected/revoked Connection cases, and manual unlink;
- authenticated Vercel Preview acceptance PASS against an isolated Neon branch for manual save/reload, repeated-save persistence, manual → connected → manual lifecycle, and desktop / 400 px mobile / 768×1024 iPad portrait / 1024×768 iPad landscape layouts;
- preview testing exposed a controlled-field reset after repeated save; the bug was fixed, regression-covered, redeployed and re-verified before this merge gate.

## Roadmap review reconciliation

The independent roadmap review returned **APPROVE WITH CHANGES**.

Accepted:
- GPS remains Priority 1;
- broader regression-corpus validation is now explicit;
- detailed GPS/PIC engineering contracts moved out of the root roadmap;
- Safety Pilot/PIC now freezes separate connected-identity collaboration metadata rather than mutating the certified flight row;
- accepted Connection state is re-checked at both invite and accept;
- no automatic invitation expiry is assumed.

Repository reconciliation resolved two proposed sequencing concerns without reordering:

1. **Safety Pilot/PIC vs M2B**  
   Current shared-flight `crewRoleCredits` is used when materializing the participant-owned flight. M2B is the separate audit of mutable aircraft-profile / `part_fcl_credit_*` dependencies. P2 must prove that the materialized recipient PIC behaves like an ordinary PIC record in recency, but it does not require M2B to finish first.

2. **Timezone issue #144 vs M2B**  
   The current hard-coded `Europe/Prague` defaults affect manual-flight default date and aircraft/rate `valid_from` dates. The explicit `part_fcl_credit_from` value is a separately entered/persisted field and is not populated from that hard-coded `today` default. Therefore #144 remains important but does not block M2B's credit-provenance audit.

The previously approved order was GPS → Safety Pilot/PIC → M2B → timezone #144 → currency #136 → M3 → M4 → Professional research. Filip explicitly reprioritized on 29 September 2026 after fresh-user usability feedback. The current order is:
GPS → Safety Pilot/PIC → General PIC → **UI/UX Simplicity Audit** → M2B → timezone #144 → currency #136 → M3 → M4 → Professional research.


## P2.1 — General PIC invitation across source roles — DONE

Filip expanded the post-certification sharing contract on **29 September 2026**: inviting another connected pilot as `PIC` must not be limited to source flights logged as `SAFETY PILOT`. A certified source flight in any recognized canonical role must be able to invite an accepted Connection to create an independently owned PIC record.

Detailed contract:

`docs/product/GENERAL_PIC_INVITATION.md`

Frozen direction:
- the completed Safety Pilot Actual-PIC workflow remains intact and evidence-backed;
- generic `Crew & logbook sharing` gains `PIC` for every recognized canonical source role;
- invite and materialization remain exact revision/hash bound and accepted-Connection gated;
- generic PIC materialization must not blindly copy an unrelated source commander;
- source credit is unchanged by recipient PIC acceptance;
- no automatic invite;
- no schema migration unless independent review proves provenance cannot be derived safely;
- local verification on Filip's PC is the primary development gate.

Independent Claude review completed on **29 September 2026** with verdict **APPROVE WITH CHANGES**. Accepted: explicit invite-time provenance via additive v16 participation metadata, separate `canInviteAsPic` authorization, and multi-PIC/re-share guards. Filip then froze the remaining product decisions: all recognized canonical source roles may invite PIC, and the recipient copy should reproduce the complete certified event data while recalculating recipient role/credit as PIC. Implementation is complete. PR #169 merged as `a51e8bb13f702c9a04337bff19755ad614ccfcc1`; migration v16 was applied and post-verified in production before merge; Vercel production deployment `dpl_9ba1sxfaZ1yyBVPFwcBdF3S9B8W3` reached READY and `https://fly-tally.com` returned HTTP 200.

## P2.2 — UI/UX Simplicity Audit 2026 — ACTIVE

A fresh-user usability check on 29 September 2026 exposed that FlyTally can still feel cognitively dense despite the completed visual-consistency audit. The strongest reported friction is **New Flight**, where a new user can be unsure which of the many visible aviation/logbook inputs matter now versus later.

Detailed audit contract:

`docs/product/UI_UX_SIMPLICITY_AUDIT_2026.md`

Frozen implementation contract:

`docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`

This workstream is deliberately **audit-first**:

- build deterministic screenshot capture from the isolated authenticated browser fixture;
- review desktop, iPad landscape, iPad portrait and mobile in light + dark;
- audit the complete route hierarchy, not only individual CSS details;
- perform a field-by-field New Flight cognitive-load classification;
- distinguish core-now, contextual, profile-backed, optional and advanced/regulatory inputs;
- verify primary-action clarity, progressive disclosure, helper-text noise, loading/error/empty states and responsive behavior;
- draft the simplification information architecture only after evidence collection;
- obtain an independent Claude read-only review of the audit/design before implementation;
- reconcile Claude recommendations against the live repository and FlyTally data-integrity rules;
- implement only in small reviewed batches with screenshot/browser evidence.

Frozen guardrail: **simplicity must not come from invented defaults, hidden mandatory evidence, a parallel flight model, weakened validation or silent business-rule changes.**

Independent Claude review returned **APPROVE WITH CHANGES**. Repository reconciliation is recorded in `docs/product/UI_UX_SIMPLICITY_CLAUDE_RECONCILIATION_2026.md`. Two review concerns were stale against current `main`: the roadmap priority was already updated by Filip and SP2/SP1–SP5 were already complete. Accepted corrections include single-page progressive disclosure, draft-vs-certification readiness semantics, explicit evidence-bearing profile summaries, one role/context slot, optional training-detail separation, completion-state consolidation and helper-copy triage.

Filip closed the design gate on **29 September 2026**. Frozen decisions:
- **Billing / Costs are optional.** Missing billing must not block saving a flight. If cost data is provided it still uses canonical validation; absence is not represented as zero/default evidence.
- **No route/time completeness hint in New Flight.** An incomplete draft may save normally. Departure, Arrival, valid UTC off-block/on-block and positive flight time remain certification blockers and are surfaced when the user attempts certification, not as extra entry-page copy.
- **`Save and add another` moves after the first save/review.** New Flight keeps one primary `Save & review` action; the repeat-entry affordance is offered after a successful save.
- **Role / normal landing / PF presets stay for convenience, but evidence-bearing preset values must be visible before save/certification.** The redesign may compact them, not silently hide them.
- **Explicit aircraft billing configuration may auto-apply; absent billing remains absent.** No synthetic `BLOCK` fallback.

Final repository review added one prerequisite before presentation compaction: current selected-aircraft normalization can fail open to `ULL` for missing/invalid evidence/class, so that read/form-path fallback must be removed before a compact profile summary can be trusted.

Frozen implementation order:
1. **B0.5 — integrity prerequisites + golden baseline:** remove fail-open `ULL` fallback; preserve valid ULL; surface unresolved profile evidence; freeze golden create/update payload and decision/preset baselines.
2. **B1A — optional-cost contract:** make no-billing a true end-to-end state; preserve configured billing; reject malformed populated values; no implicit BLOCK.
3. **B1B — completion semantics:** remove duplicate review/readiness surfaces, keep one primary `Save & review`, preserve certification blockers and move Add another post-save.
4. **B2 — essentials + visible movement evidence:** trim duplicated intro, move Role up, regroup route/times, surface landing/PF evidence and verify sticky-action behavior.
5. **B3 — profile summary + role-context:** compact real evidence-bearing profile values and one applicability-driven required-context area.
6. **B4 — optional details + helper-copy triage:** training/professional/costs/notes with populated-state discoverability.
7. **B5 — responsive/accessibility closeout:** desktop/iPad/mobile/light/dark, 320 px reflow, keyboard/safe-area and final cognitive-load measurements.

The detailed scope, dependencies, acceptance criteria and test matrix are frozen in `docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`.

### Current implementation checkpoint — B0.5

Branch: `fix/new-flight-b05-integrity`

Implemented, verification pending:
- selected-aircraft defaults now reuse canonical aircraft-profile validation instead of repairing invalid/missing evidence/class to `ULL`;
- valid ULL remains valid ULL;
- canonicalization that would change stored evidence/class is rejected as an automatic entry default;
- unresolved profile defaults surface as **Needs configuration** and the existing required Logbook/Class controls remain the explicit flight-level recovery path;
- same-registration Edit continues to preserve the stored flight snapshot instead of re-deriving it from mutable current profile state, including restoration after a temporary aircraft-selection round trip;
- golden `parseFlightInput()` payload coverage and create/update shared-parser source coverage added;
- preset policy and decision-density baseline recorded in `docs/product/UI_UX_SIMPLICITY_B05_BASELINE_2026.md`.

Verification status: **PASS** — targeted B0.5/M1/manual-entry/input suite **26/26**, full suite **916/916**, production build **PASS**; TypeScript PASS on the runtime-equivalent head and inside the final build. PostgreSQL N/A. B0.5 is DONE.

### Completed checkpoint — B1A

PR #174 merged as `37eac801cc69b19c07d4c140213ccda37c4e85ff`.

- blank billing is a first-class **Not tracked** state across manual/GPS entry and aircraft defaults;
- malformed populated billing remains fail-closed;
- configured BLOCK/AIR + share values remain canonical;
- production DB metadata prerequisite passed read-only and no migration is required;
- TypeScript PASS, targeted B1A 35/35 PASS, stale-contract rerun 55/55 PASS, full unit/regression 928/928 PASS, production build PASS;
- protected Preview reached READY, but authenticated smoke remains **DEFERRED, not PASS** and will be checked live with the cumulative New Flight redesign.

### Completed checkpoint — B1B

PR #175 merged as `0d7e5d56b88a06292c98969e515d2ef48aa5fb0b`.

- removed the duplicate pre-save Review/readiness surface;
- New Flight now has one completion/blocker surface and one primary **Save & review** action;
- **Add another flight** moved to the successful saved-review handoff;
- TypeScript PASS, production build PASS, targeted B1B/historical contracts 34/34 PASS, full unit/regression 934/934 PASS;
- PostgreSQL N/A;
- authenticated presentation smoke remains explicitly **DEFERRED, not PASS** and is carried to cumulative live verification.

### Completed checkpoint — B2

PR #176 merged as `a3bc8b3ed99ca34a49cc39db9ec38ac578e2ae86`.

- Date → Registration → Role is now the first visible DOM/tab-order row;
- Route and one chronological UTC timeline are grouped explicitly;
- Flight experience exposes landing + PF evidence in its collapsed summary;
- TypeScript PASS, targeted B2/affected historical contracts 47/47 PASS, full unit/regression 940/940 PASS, production build PASS;
- PostgreSQL N/A;
- authenticated presentation smoke remains **DEFERRED, not PASS** and is carried to cumulative live verification.

### Completed checkpoint — B3

PR #177 merged as `645348ef7280f1b0452d457e152dfdaa0da4a448`.

- Aircraft & logbook now exposes the stored/current profile context directly;
- Role details auto-opens for DUAL, Safety Pilot, SPIC and PICUS required evidence;
- Training purpose + Task moved out of crew identity into Optional details;
- TypeScript PASS, production build PASS, reconciled targeted contracts 22/22 PASS, full unit/regression 946/946 PASS;
- PostgreSQL N/A;
- authenticated presentation smoke remains **DEFERRED, not PASS** and is carried to cumulative live verification.

### Completed checkpoint — B4

PR #178 merged as `b18e19a1550d73536cb9f15abec04b3b275361f1`.

- Training purpose/Task, Night/IFR, Professional context, Costs/expenses and Notes are consolidated under one native **Optional details** disclosure;
- populated Edit records remain discoverable and malformed billing remains fail-closed;
- TypeScript PASS, reconciled targeted contracts 34/34 PASS, full unit/regression 954/954 PASS, production build PASS on the runtime-equivalent head;
- PostgreSQL N/A;
- authenticated presentation smoke remains **DEFERRED, not PASS** and is carried into B5 cumulative live verification.

### Current implementation checkpoint — B5

PR #179 merged as `3a73ad85a6c33f77a881b339c28b425e7b3b8769`.

Implemented:
- ordinary pristine Date/Registration/Role/Logbook/Class fields no longer present inline error styling before a save attempt;
- the single completion surface now exposes focusable missing-field blockers that open the owning native disclosure before focusing the relevant control;
- native `details/summary` semantics remain intact without redundant ARIA state;
- mobile disclosure summaries remain visible instead of inheriting the historical <=600px hide rule;
- identity and secondary grids reflow earlier for iPad portrait / 200% zoom;
- New Flight sticky actions fall back to normal flow at 320px, short viewports and coarse/touch pointers to avoid virtual-keyboard overlap;
- new blocker controls receive 44px coarse-pointer targets and forced-colors treatment;
- measured New Flight muted/link token contrast meets 4.5:1 on canonical dark/light panel surfaces;
- no parser, schema, certification, recency, collaboration, billing or UTC semantics changed.

Verification status: **DONE / VERIFIED** — TypeScript PASS, targeted B5/affected historical contracts **100/100 PASS** on the runtime head, final v1.58+B5 reconciliation **15/15 PASS**, full unit/regression **962/962 PASS**, production build PASS on the runtime-equivalent B5 head. PostgreSQL N/A. PR #182 fixed the one screenshot-backed closeout defect (Flight experience empty-state title/explanation concatenation) without introducing a new design-system variant; Verify FlyTally web #955 and Browser smoke #349 both PASS. Final isolated authenticated matrix run #352 then PASSed with **23 browser tests passed / 3 skipped**, generated **132/132 screenshots** across 11 states × 6 viewports × light/dark, and recorded **0 px horizontal overflow** in all 132 matrix records. Production deployment for `45a97aacec50e9e7b20d676afd4493c2e896c1fe` is READY and aliased to `fly-tally.com`.

The previous `docs/ux-audit.md` remains the historical visual-consistency/polish audit and is not overwritten by this work.

## P3 — Multi-aircraft Product Scale — NEXT: M2B

Goal: prove repeatable no-code onboarding of heterogeneous aircraft profiles without aircraft-specific parallel workflows while preserving historical flight evidence.

Detailed source-of-truth contract:

`docs/product/MULTI_AIRCRAFT_SCALE_CONTRACT.md`

### Completed

| Milestone | Status | Closeout |
| --- | :---: | --- |
| M0 — Contract & evidence audit | ✅ | Current profile vs historical snapshot vs dynamic applicability classified |
| M2A — Helicopter historical snapshot integrity | ✅ | Historical helicopter type no longer depends silently on mutable current aircraft profile |
| M1 — Canonical aircraft-profile validation | ✅ | Add/Edit and shared profile import use one fail-closed validation contract |

### Remaining

#### M2B — Remaining historical & dynamic applicability integrity

- audit remaining recency consumers for mutable-current-profile dependencies;
- preserve established ordinary ULL→SEP behavior;
- preserve explicit effective-dated `part_fcl_credit_*` provenance semantics;
- verify manual and GPS entry snapshot equivalent applicable aircraft context;
- preserve v1–v8 certification hash/revision compatibility.

Acceptance:
- no remaining historical identity calculation can be silently reclassified by editing the current aircraft profile;
- ordinary ULL→SEP and explicit TMG override behavior remain regression-covered;
- explicit credit basis/effective date remains enforced;
- certification/revision verification remains unchanged.

#### M3 — No-code heterogeneous onboarding proof

Representative Aeroplane, Helicopter, Sailplane/TMG, Balloon, ULL and Other profiles must use the same canonical workflow:

- catalogue selection or manual identity fallback;
- Add/Edit;
- Quick Add;
- deactivate/reactivate;
- flight selection;
- required applicability guidance;
- desktop/iPad/mobile light/dark acceptance.

No make/model-specific runtime path is introduced.

#### M4 — Sharing, recovery, scale & closeout

- one-time aircraft sharing preserves recipient ownership and canonical validation;
- exact backup/restore preserves profile and protected-flight evidence;
- multi-profile picker/library behavior is measured before optimization;
- deletion/deactivation protection remains safe when flights reference the registration;
- PostgreSQL, complete regressions, typecheck, production build and browser smoke pass;
- documentation closes in the same work cycle.

### Permanent Multi-aircraft boundaries

- one canonical flight model;
- no aircraft-specific flight-entry pages;
- no regulatory classification inferred solely from catalogue metadata;
- manual aircraft identity fallback remains;
- one current personal aircraft profile per user + registration;
- historical flights remain evidence snapshots;
- organization/fleet ownership is not part of this phase;
- no migration unless evidence proves one necessary.

## P4 — Cross-cutting saved-data semantics — PLANNED

These are known open issues from the completed UX audit. They were intentionally excluded from display-only fixes because they can affect persisted data/business semantics.

### S1 — User timezone vs saved calendar dates · issue #144

Known affected behavior includes manual-flight default date and new aircraft/rate effective-date defaults using a hard-coded `Europe/Prague` calendar despite a per-user timezone setting.

Before implementation define:

- which defaults use the user's configured calendar timezone;
- which evidence remains UTC;
- how midnight/day-boundary behavior is tested;
- whether any existing persisted data needs treatment.

Guardrail: GPS/FCL.050 UTC evidence is not converted into local-time evidence by this task.

### S2 — Currency setting vs stored monetary values · issue #136

Current product exposes a currency setting while some cost/expense surfaces remain explicitly CZK.

Before implementation define:

- whether account currency is presentation-only or the default denomination for new monetary entries;
- which records already carry their own currency;
- whether legacy values have an explicit currency provenance;
- export/backup implications;
- no automatic FX conversion unless a future explicit rule defines it.

No storage migration is assumed.

## P5 — Professional Logbook Platform — RESEARCH

Potential later direction:

- organization/operator accounts;
- instructor/student workflows;
- flight-school evidence;
- fleet-linked training;
- organizational verification;
- controlled reports and team permissions.

This is deliberately not scheduled for implementation until the personal pilot logbook, collaboration model and Multi-aircraft phase are stable in real use.

## Historical milestone track

This is the concise active history. Detailed implementation evidence belongs in `CHANGELOG.md`, merged PRs and `docs/history/`.

| Milestone / release track | Status | What it established |
| --- | :---: | --- |
| v1.51.x — Regulatory Correctness Core | ✅ | FCL.060/LAPL/FCL.740.A foundations, movement evidence, eligible ULL credit and certification evidence boundaries |
| v1.52 — Codebase Review & Cleanup | ✅ | Retired obsolete runtime/artifacts while preserving the regulatory core |
| v1.53–v1.54 — Aircraft state & catalogue | ✅ | Aircraft-state integrity, structured aircraft-type catalogue and manual fallback |
| v1.55–v1.61 — Flight-entry UX & category expansion | ✅ | Responsive entry workflow, guided setup and category-aware record foundations |
| Multi-category Pilot Logbook | ✅ | Aeroplane, Helicopter, Sailplane, Balloon, ULL and Other on one canonical flight model |
| v2.1 — Dashboard & Statistics consolidation | ✅ | Stable all-time Dashboard plus Statistics historical/period analysis |
| v2.2 — Action Center & Shared Flight Workflow | ✅ | Authoritative pending-work surface and reviewed collaboration workflows |
| v2.3 — Large Logbook Performance & Scalability | ✅ | 10k/50k/100k scale gates and hot-path optimization |
| v2.4 — Flight Entry & Review 2.0 | ✅ | Canonical save/review/certify/share flow and explicit GPS review |
| v2.5 — Recency & Compliance Workspace | ✅ | Evidence-driven recency/licence planning and explainable evidence states |
| v2.6 — Professional Pilot Workspace 2.0 | ✅ | Professional/operator context and experience reporting without silent employment inference |
| v2.7 — Data Integrity & Recovery 2.0 | ✅ | Review-first restore, backup integrity and protected-history recovery |
| v2.8 — Compliance & Safety Foundation | ✅ | Privacy, identity, maps/provider and browser-security foundations |
| v2.9 — Commercial & External Validation | ✅ | Technical launch/legal/billing/signature/claims gates; external approvals separate |
| v3.0 — UX & Product Consolidation | ✅ | Navigation, Licences & Recency, Aircraft, Print & Data, Settings, Web Push and mobile/accessibility consolidation |
| v3.3 — Design & Workflow Consistency | ✅ | Shared tokens/icons/states/forms/formatting/routes plus Batch 9–11 closeout |
| Documentation governance consolidation | ✅ | Canonical ROADMAP / FEATURES / CHANGELOG and archived historical notes · PR #148–150 |
| Multi-aircraft M0 | ✅ | Current-profile vs historical-flight source-of-truth contract · PR #153 |
| Multi-aircraft M2A | ✅ | Helicopter historical snapshot integrity · PR #154 |
| Multi-aircraft M1 | ✅ | Canonical fail-closed aircraft-profile validation · PR #155 |
| GPS touch-and-go reliability | ✅ | Real-track locality defect reproduced and fixed without changing movement thresholds |
| Safety Pilot ↔ PIC workflow | 🚧 | ACTIVE · design review reconciled; SP1 schema/domain implementation next |
| Multi-aircraft M2B | ⏳ | Resume integrity audit after priority work |
| Saved-data semantics · timezone/currency | ⏳ | Known cross-cutting business/data semantics debt |
| Multi-aircraft M3 | ⏳ | No-code heterogeneous onboarding proof |
| Multi-aircraft M4 | ⏳ | Sharing/recovery/scale closeout |
| Professional Logbook Platform | 🔬 | Future organization/operator/fleet workflows |

## Permanent engineering constraints

1. **Data integrity first.** Certified/finalized evidence is audited/versioned, not destructively rewritten.
2. **Evidence before regulatory status.** Missing evidence must not produce a false CURRENT/compliant state.
3. **One workflow.** Do not create parallel Quick/Simple/Advanced variants of the same core task.
4. **Explicit state.** Missing is not zero/default; invalid combinations fail closed.
5. **Backward compatibility.** Existing records, fingerprints, revisions, sharing and restore behavior remain protected.
6. **Independent participant evidence.** A shared flight is one real-world event, but each pilot's owned/certified evidence remains independent.
7. **Server-side ownership/auth.** Client state never substitutes for authorization.
8. **Mobile is a release gate.** Desktop success alone is insufficient for core workflows.
9. **Testing is part of completion.** PASS is reported only for checks that actually ran.
10. **Documentation is part of completion.** Significant work checks/updates ROADMAP, FEATURES and CHANGELOG in the same work cycle.
11. **External approval is never inferred.** Internal code/tests/publication do not equal regulator/legal/provider approval.
12. **Product priority follows evidence.** Real production correctness and data-integrity defects outrank convenience expansion.

## Historical roadmap

The pre-consolidation roadmap is preserved verbatim at:

`docs/history/ROADMAP_LEGACY_2026-09-26.md`

Historical documents are evidence/context only. If they conflict with this file, this roadmap controls current planning.
