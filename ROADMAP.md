# FlyTally Logbook Roadmap

**Status:** Active  
**Owner:** Filip Točík  
**Last updated:** 4 October 2026  
**Current production product version:** `2.7.0`

This is the canonical forward plan for `flytally-logbook`.

- `FEATURES.md` = what the product has / is intended to have.
- `ROADMAP.md` = order, dependencies, decisions and status.
- `CHANGELOG.md` = what actually changed.
- `ARCHITECTURE.md` = current architecture and data-integrity invariants.
- `DEVELOPMENT.md` = implementation / verification workflow.
- `docs/product/VERSIONING.md` = numeric release/versioning rules.
- Detailed release contracts belong under `docs/product/`.
- Superseded / historical milestone detail belongs under `docs/history/`.

A release is not DONE until implementation, verification, required documentation and production closeout are complete.

## Versioning rule

From 4 October 2026 forward, active product planning uses numeric `MAJOR.MINOR.PATCH` release versions only.

- No new active E/F/B/SP/M-style milestone families.
- Use the target release number plus **Phase 1, Phase 2, ...**.
- Database schema version, certification payload version and backup-format version are independent technical counters.
- Historical letter-coded milestones are preserved in `docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md`.

## Status legend

- ✅ **DONE** — implemented, verified, merged and production-closed where applicable.
- 🚧 **ACTIVE** — current release.
- ➡️ **NEXT** — first release after ACTIVE.
- ⏳ **PLANNED** — accepted direction, not yet next.
- 🔬 **RESEARCH** — not implementation-ready.
- ⚠️ **BLOCKED / EXTERNAL** — depends on evidence or a decision outside the repo.

## Current production baseline

| Area | State |
| --- | --- |
| Core logbook / certified record integrity | ✅ Production |
| Aeroplane / Helicopter / Sailplane / Balloon / ULL / conservative Other | ✅ Production |
| Manual + GPS flight entry | ✅ Production baseline; simplification planned in 2.8.0 |
| GPS review / Day-Night / Night-time suggestions | ✅ Production; GPS remains advisory |
| Certification / correction revisions / audit history | ✅ Production |
| Recency / licences / evidence | ✅ Production |
| Sharing / Connections / instructor workflows | ✅ Production |
| Aircraft profiles / profile sharing / canonical validation | ✅ Production |
| Backup / restore / protected history | ✅ Production |
| Statistics / professional presentation | ✅ Production |
| Production DB schema | **v19** — independent from product version |
| Product release version | **2.7.0** |

## Canonical release sequence

| Order | Target | Workstream | Status | Dependency / reason |
| ---: | ---: | --- | :---: | --- |
| 1 | **2.8.0** | Flight Entry Simplification | 🚧 | Production use exposed excessive cognitive load in otherwise-correct Manual/GPS flow |
| 2 | **2.9.0** | Multi-aircraft remaining integrity audit | ➡️ | Resume historical/dynamic applicability audit after entry workflow stabilizes |
| 3 | **2.10.0** | Saved-date / timezone semantics · #144 | ⏳ | Persisted default date can be wrong around timezone boundaries |
| 4 | **2.11.0** | Currency / monetary semantics · #136 | ⏳ | Account currency vs stored monetary denomination needs one contract |
| 5 | **2.12.0** | Multi-aircraft heterogeneous onboarding proof | ⏳ | Prove no-code onboarding across supported categories |
| 6 | **2.13.0** | Multi-aircraft sharing / recovery / scale closeout | ⏳ | Close cross-workflow and scale evidence |
| — | — | Professional Logbook Platform | 🔬 | No release number until scope is frozen |

**Pre-emption rule:** confirmed production, security or data-integrity defects may interrupt this order. Convenience/visual polish may not weaken evidence, validation, certification or historical integrity.

---

# 2.8.0 — Flight Entry Simplification — ACTIVE

Detailed contract: `docs/product/2_8_0_FLIGHT_ENTRY_SIMPLIFICATION.md`  
Independent review handoff: `docs/product/2_8_0_REVIEW_HANDOFF.md`

## Product goal

Make routine Manual/GPS entry substantially simpler and more cockpit/iPad-friendly without weakening any current evidence or certification contract.

Target common flow:

**Source → Flight details → Save & certify**

with secondary/contextual information progressively disclosed.

## Frozen decisions

- GPS-derived values remain advisory and editable.
- Missing/ambiguous/non-applicable evidence remains unavailable or explicit; never invented.
- IFR remains pilot-entered.
- Existing SERA Day/Night and Night-time suggestions retain current provenance/authority semantics.
- Certification remains an explicit pilot action.
- Same-page **Save & certify** is allowed and preferred for an eligible completed flight.
- **Save draft** remains available.
- No silent auto-certification.
- Generic normal-case “I reviewed this flight” confirmation should be removed; warning-specific acknowledgement may remain where evidence genuinely requires it.
- Existing certification hash/version, compliance rules, audit history, correction revisions, sharing prerequisites and recency authority must be reused.
- Multi-flight import must never create an unintended partially certified batch.
- Existing Training purpose codes/history remain backward-compatible.
- No DB migration is assumed.

## Phase 1 — Discovery / review gate — ACTIVE

Scope:
- inventory effective Manual + GPS sections, fields, validation and server actions;
- map current certification/save dependencies;
- classify every visible block as **KEEP / COLLAPSE / CONDITIONAL / REMOVE-DUPLICATE**;
- audit current Training purpose catalogue, category filtering and server persistence parity;
- freeze multi-flight Save & certify failure semantics;
- obtain independent second-AI review before runtime implementation.

Acceptance:
- no field disappears merely because it looks optional;
- no UI option can be silently discarded by the server;
- same-page certification has one explicit shared authority path;
- review identifies exact responsive states to verify.

## Phase 2 — Information hierarchy

### GPS source

Default visible:
- file/source name;
- point count / detected-flight count;
- one concise source status;
- real GPS-quality warning when present.

Progressive/conditional:
- clean single-flight split controls are hidden;
- split editor appears only for multi-flight detection, manual split or ambiguity;
- map + altitude/speed profile live under **Review GPS track**;
- warning can auto-open the review surface when visual inspection is required;
- raw source diagnostics stay secondary.

### Flight context

Replace the large Common details area with one compact editable summary:
- aircraft;
- role;
- operation;
- engine;
- billing when tracked.

Only invalid/missing required state auto-opens the detailed controls.

### Flight card

Default visible:
- date;
- departure / arrival;
- landings total + Day/Night when applicable;
- Off-block / Takeoff / Landing / On-block;
- Night / IFR only when applicable;
- concise Notes affordance.

Repeated helper/provenance/status text must be reduced where one value + one compact source/status cue already communicates the decision.

## Phase 3 — Optional / contextual details + Training purpose

Collapsed by default:
- additional crew;
- aircraft provenance/context detail;
- Training purpose;
- Task / exercise;
- Costs / additional expenses;
- professional context;
- extended movement evidence when not required;
- source diagnostics.

Auto-open only when:
- role/category makes the content required;
- stored/edit data already exists;
- validation identifies a problem;
- user opens it.

### Training purpose

Current structured catalogue remains:
1. Aircraft differences training / endorsement
2. Aircraft familiarisation
3. LAPL(A) FCL.140.A refresher training
4. LAPL(H) FCL.140.H refresher training
5. SEP/TMG FCL.740.A refresher training
6. SPL SFCL.160 recency training
7. BPL BFCL.160 recency training

Current ULL filtering hides the Part-FCL/SFCL/BFCL recency options, which is why production currently shows only Aircraft differences + Aircraft familiarisation.

2.8.0 must:
- preserve regulatory applicability filtering;
- verify UI visibility == server persistence eligibility;
- decide whether to add a generic non-regulatory **Training / practice flight** marker for ULL/ordinary training;
- if added, give it **no automatic recency, endorsement or authority credit**;
- preserve all existing stored/certified purpose evidence.

## Phase 4 — Same-page completion / certification

Eligible single-flight path:

**Primary:** Save & certify flight  
**Secondary:** Save draft

Rules:
- the click on Save & certify is the explicit certification confirmation;
- no second certification click is required on the next page;
- server uses the existing certification compliance/hash/revision contract;
- no duplicated certification rule set;
- warning-specific acknowledgement replaces generic review confirmation where needed;
- Save draft remains the fallback for incomplete/uncertain data.

### Multi-flight GPS batch rule

Before implementation, select and test one fail-closed contract:

1. save all drafts atomically, then certify all in one all-or-none certification transaction; if certification fails, the whole batch remains draft; or
2. direct batch save+certify only if one atomic implementation can be proven.

Forbidden:
- accidental mixed certified/draft state caused by intermediate failure.

## Phase 5 — Responsive / interaction polish

Required:
- desktop;
- iPad landscape;
- iPad portrait;
- mobile 390;
- compact mobile / reflow;
- light + dark.

Acceptance:
- materially fewer default-visible sections than 2.7.0;
- one obvious primary action;
- no horizontal overflow;
- validation points to the exact disclosure that needs attention;
- async actions have pending/disabled duplicate-submit protection;
- keyboard/focus order remains usable;
- no raw errors.

## Phase 6 — Release closeout

Required evidence, according to final changed surface:
- targeted tests during implementation;
- TypeScript;
- complete unit/regression candidate gate;
- PostgreSQL acceptance because save/certification is persistence-critical;
- authenticated browser coverage for Manual + GPS, draft + direct certification, warnings and responsive states;
- production build;
- PR CI;
- production deployment + smoke + runtime-error check;
- ROADMAP / FEATURES / CHANGELOG reconciliation;
- version bump to **2.8.0** only at release-candidate/ship time.

### 2.8.0 Definition of Done

- simplified hierarchy is production deployed;
- same-page explicit Save & certify is verified;
- Save draft remains valid;
- multi-flight cannot partially certify unintentionally;
- Training purpose behavior is reconciled and regression-covered;
- certification/audit/correction/share/recency authority remains intact;
- responsive light/dark acceptance passes;
- `package.json`, visible app version, CHANGELOG release heading and release tag agree on `2.8.0`.

---

# 2.9.0 — Multi-aircraft remaining integrity audit — NEXT

Goal: finish the remaining historical/dynamic applicability integrity work without reintroducing mutable-current-profile dependence into historical evidence.

Scope:
- audit remaining recency consumers for current-profile dependencies;
- preserve established ordinary ULL → SEP behavior;
- preserve explicit effective-dated `part_fcl_credit_*` provenance;
- verify Manual/GPS snapshot equivalence where applicable;
- preserve certification/revision compatibility.

No migration is assumed until evidence proves one necessary.

# 2.10.0 — Saved-date / timezone semantics — PLANNED

Issue: #144

Before code:
- define which defaults use configured user calendar timezone;
- identify evidence that must remain UTC;
- define midnight/day-boundary tests;
- decide whether any existing persisted data requires treatment.

GPS/FCL.050 UTC evidence must not be converted into local-time evidence by convenience.

# 2.11.0 — Currency / monetary semantics — PLANNED

Issue: #136

Before code:
- define whether account currency is display/default denomination or record authority;
- classify records that already persist currency;
- classify legacy values with/without explicit denomination;
- define export/backup consequences;
- no automatic FX conversion without an explicit future rule.

# 2.12.0 — Multi-aircraft heterogeneous onboarding proof — PLANNED

Representative Aeroplane, Helicopter, Sailplane/TMG, Balloon, ULL and Other profiles must pass the same canonical workflow without make/model-specific runtime branches.

Proof includes:
- catalogue/manual identity;
- Add/Edit;
- Quick Add;
- deactivate/reactivate;
- flight selection;
- applicability guidance;
- desktop/iPad/mobile light/dark acceptance.

# 2.13.0 — Multi-aircraft sharing / recovery / scale closeout — PLANNED

Scope:
- aircraft sharing preserves recipient ownership + canonical validation;
- exact backup/restore preserves profile + protected-flight evidence;
- multi-profile picker/library behavior measured before optimization;
- deletion/deactivation remains safe when historical flights reference registration;
- complete regression / PostgreSQL / browser / build closeout.

# Research — Professional Logbook Platform

No product version is assigned yet.

Possible future scope:
- organization/operator accounts;
- fleet workflows;
- instructor/student organizational evidence;
- controlled reports;
- team permissions.

Promotion requires a dedicated research/design decision first.

## Permanent engineering constraints

- One canonical flight/data model.
- Manual/GPS/Create/Edit business rules converge rather than fork.
- Invalid combinations fail closed; no silent repair.
- Certified/finalized history is revisioned/audited, never destructively overwritten.
- Recency/currency/compliance claims are evidence-first.
- Auth/ownership is server-enforced.
- Schema changes are explicit deployment prerequisites.
- Production deployment is not inferred from build/merge success.
- Testing evidence is reported exactly as run.
- ROADMAP / FEATURES / CHANGELOG close in the same work cycle.

## Historical record

Pre-standardization milestone history, including the prior E/F/B/SP/M labels and detailed closeout evidence, is preserved at:

`docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md`

Historical docs remain evidence/context only. If they conflict with this ROADMAP on current priority, this ROADMAP controls.
