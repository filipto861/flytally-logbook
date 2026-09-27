# FlyTally Logbook Roadmap

**Status:** Active  
**Owner:** Filip Točík  
**Last updated:** 27 September 2026

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
| UX & design consistency | ✅ | UX consolidation and design-consistency audit Batch 1–11 complete |
| Documentation governance | ✅ | ROADMAP / FEATURES / CHANGELOG governance and repository cleanup complete |
| Multi-aircraft M0 — contract & evidence audit | ✅ | Source-of-truth matrix and consumer inventory complete · PR #153 |
| Multi-aircraft M2A — helicopter snapshot integrity | ✅ | Historical type resolution fixed and fail-closed · PR #154 |
| Multi-aircraft M1 — canonical profile validation | ✅ | Add/Edit + shared import use one fail-closed contract · PR #155 |
| Roadmap review & prioritization | 🚧 | Current checkpoint; this document is the review candidate |
| GPS touch-and-go detection reliability | ➡️ | **Priority 1** after roadmap approval; reproduce the real-track mismatch before changing logic |
| Safety Pilot ↔ PIC shared-flight workflow | ⏳ | **Priority 2**; connected PIC selection + manual fallback + PIC invitation symmetry |
| Multi-aircraft Product Scale | ⏸️ | M0/M2A/M1 complete; M2B/M3/M4 resume after the two priority items |
| Saved-date / timezone semantics · issue #144 | ⏳ | Known persisted-default inconsistency; semantics decision required before code |
| Currency / monetary semantics · issue #136 | ⏳ | Known business-rule inconsistency; define account vs per-record currency before code |
| Professional Logbook Platform | 🔬 | Organization/operator/fleet workflows remain research-only |

## Current checkpoint — roadmap review & prioritization

The product is at a clean checkpoint after the UX/design closeout and the first Multi-aircraft integrity milestones.

This review freezes the following execution order unless new evidence exposes a higher-severity data-integrity or production issue:

| Order | Workstream | Status | Why it is here |
| ---: | --- | :---: | --- |
| 0 | Roadmap review / freeze | 🚧 | Finish product-wide planning before more runtime work |
| 1 | GPS touch-and-go detection reliability | ➡️ | Real user flight produced a wrong landing suggestion; correctness comes first |
| 2 | Safety Pilot ↔ PIC shared-flight workflow | ⏳ | Real missing workflow discovered in normal flying use |
| 3 | Multi-aircraft M2B — remaining integrity audit | ⏳ | Finish current-profile vs historical-evidence audit before broader scale proof |
| 4 | Saved-date / timezone semantics · #144 | ⏳ | Can persist the wrong calendar date around timezone boundaries |
| 5 | Currency / monetary semantics · #136 | ⏳ | Current setting and hard-coded CZK surfaces need one business contract |
| 6 | Multi-aircraft M3 — heterogeneous onboarding proof | ⏳ | Prove no-code onboarding across supported categories |
| 7 | Multi-aircraft M4 — sharing/recovery/scale closeout | ⏳ | Close the phase with cross-workflow and scale evidence |
| 8 | Professional Logbook Platform | 🔬 | Only after pilot-logbook foundations are stable in real use |

**Priority rule:** production/data-integrity defects can pre-empt this order. Convenience features do not pre-empt unresolved correctness issues.

## P1 — GPS touch-and-go detection reliability — NEXT

### Problem

A real GPS import produced the wrong landing count during touch-and-go operations.

The current suggestion is:

`landing count = 1 final landing + detected touch-and-go events`

The suggestion is deliberately advisory and user-editable, but an incorrect suggestion can still lead to incorrect evidence if it is accepted without noticing the error.

### Current detector evidence

The repository currently uses two detector paths:

- **speed/ground event:** below 20 km/h, bracketed by >42 km/h movement, with a 5–90 second event;
- **rolling altitude event:** 28–145 km/h groundspeed, local altitude minimum, at least 30 m descent before and 30 m climb after, plus altitude-discontinuity rejection.

Some rolling-event windows and duplicate suppression are expressed in **point counts** (for example ±10 points and 8–10 point grouping), so their real duration changes with GPS sampling rate.

### Investigation contract

Before changing detector thresholds:

1. reproduce the exact mismatch from the original KML/GPX/CSV;
2. record actual expected landings / touch-and-go sequence;
3. inspect sampling interval, groundspeed and altitude around every expected event;
4. identify whether the defect is a missed event, false event, poor altitude data, speed threshold issue, split issue or sampling-rate dependency;
5. derive a minimal regression fixture from the real failure shape; do not commit unnecessary personal route/location history;
6. only then design the smallest detector correction.

### Acceptance

- the exact reported failure is reproducible before the fix and passes after it;
- existing fast-low-pass, altitude-discontinuity and split regressions remain green;
- the same event shape is tested at materially different sampling intervals if sampling-rate sensitivity is confirmed;
- detector windows become time/distance-normalized where evidence shows point-count windows are the defect;
- automatic output stays an advisory suggestion requiring review;
- uncertain evidence remains conservative instead of inventing a landing;
- ROADMAP / FEATURES / CHANGELOG are reconciled in the fix work cycle.

## P2 — Safety Pilot ↔ PIC shared-flight workflow — PLANNED, HIGH PRIORITY

### User story

When I log my own flight as **SAFETY PILOT**, I want to record who the actual PIC was.

- If the PIC is an accepted FlyTally Connection, I can select that pilot.
- If the PIC is not in FlyTally / not connected, I can enter the name manually.
- If I selected a connected pilot, after certification I can explicitly invite that pilot to add the same flight to their own logbook as **PIC**.

### Confirmed repository gap

Current behavior already has:

- `SAFETY PILOT` as a flight role;
- an **Actual PIC** text field;
- the canonical certified shared-flight Review → Add → Certify workflow.

But:

- Actual PIC is currently free text only;
- New flight only supplies accepted **instructors** as crew suggestions;
- the canonical `flight_participations` crew-role contract does not currently include `PIC`.

### Frozen design boundaries

- connected pilot identity must be persisted by user identity, not inferred later from display-name text;
- manual PIC text remains valid and must not create a fake account link;
- invite is an explicit user action; selecting a connected PIC does not silently mutate the other pilot's logbook;
- invitation rechecks that the users are still accepted Connections;
- shared participation remains bound to the exact certified source revision/hash;
- recipient materializes an independent owned flight with role PIC;
- source owner's SAFETY PILOT record remains independent evidence and must not gain PIC credit;
- no shared mutable flight record and no ownership transfer;
- existing instructor / Safety Pilot / other crew invitation behavior must remain backward-compatible.

### Design milestone before implementation

Because pre-certification PIC identity and post-certification `flight_participations` are different lifecycle states, implementation must first decide the minimal canonical persistence contract for the selected PIC.

Do **not** solve this by name matching.

If a schema change is required, it must be additive, tenant-safe and backward-compatible.

### Acceptance

- Safety Pilot entry supports accepted-Connection PIC selection and manual fallback in one simple control;
- saved record preserves displayed PIC name plus connected identity when one was explicitly selected;
- a certified Safety Pilot source record can invite that exact connected pilot as PIC;
- recipient review materializes an independent PIC flight with the certified source facts;
- revision/hash mismatch, revoked connection or malformed identity fails closed;
- no double-credit or source-role mutation;
- manual-only PIC records remain fully usable without FlyTally account linkage;
- PostgreSQL + source/unit + real-browser coverage proves ownership and workflow semantics;
- desktop, iPad and mobile UX remains simple.

This feature receives an independent second-AI architecture/data-model review after discovery/design and before implementation.

## P3 — Multi-aircraft Product Scale — PAUSED, THEN RESUME

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
| GPS touch-and-go reliability | ➡️ | First runtime priority after roadmap freeze |
| Safety Pilot ↔ PIC workflow | ⏳ | Second runtime priority |
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
