# FlyTally Logbook Roadmap

**Status:** Active  
**Owner:** Filip Točík  
**Last updated:** 27 September 2026

This is the canonical planning document for `flytally-logbook`. It answers **what we do next, in what order, and why**.

- `FEATURES.md` describes what the product has or is expected to have.
- `CHANGELOG.md` records what actually changed.
- `DEVELOPMENT.md` defines how changes are implemented and verified.
- Detailed historical plans and milestone notes live under `docs/history/` and do not override this roadmap.

Historical PR/version labels are retained in Git history and the changelog, but they are not used to infer the current roadmap.

## Progress overview

| Area / milestone | Status | Current state |
| --- | :---: | --- |
| Core logbook / certified record integrity | ✅ | Production foundation complete |
| Multi-category pilot logbook | ✅ | Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other supported |
| Flight entry / review / GPS workflows | ✅ | Canonical entry and review workflow established |
| Recency / licences / evidence | ✅ | Evidence-first workspace live; helicopter historical type integrity hardened |
| Sharing / Connections / Action Center | ✅ | Shared-flight, instructor and aircraft-profile collaboration live |
| Statistics / professional workspace | ✅ | Current pilot analytics and professional-experience layer live |
| Backup / recovery / protected history | ✅ | Portable backup, review-first restore and protected-history preservation implemented |
| Compliance & safety foundation | ✅ | Technical compliance/security foundation complete |
| Commercial & external validation foundation | ✅ | Technical foundation complete; external approvals remain separate |
| UX & design consistency | ✅ | UX consolidation and design-consistency audit Batch 1–11 complete |
| Documentation governance | ✅ | ROADMAP / FEATURES / CHANGELOG governance and repository cleanup complete |
| Multi-aircraft M0 — contract & evidence audit | ✅ | Source-of-truth matrix and consumer inventory complete · PR #153 |
| Multi-aircraft M2A — helicopter snapshot integrity | ✅ | Historical type resolution fixed and fail-closed · PR #154 |
| Multi-aircraft M1 — canonical profile validation | ✅ | Add/Edit + shared import use one fail-closed contract · PR #155 |
| Roadmap review & prioritization checkpoint | 🚧 | Current work: confirm product priorities before starting the next implementation milestone |
| Safety Pilot ↔ PIC shared-flight workflow | ⏳ | Requested: connected-pilot selection + manual fallback + PIC invitation symmetry |
| GPS touch-and-go detection reliability | 🚧 | Real-track mismatch reported; exact track reproduction and detector review required |
| Multi-aircraft M2B — remaining integrity audit | ⏳ | Candidate next; not started until roadmap review is confirmed |
| Multi-aircraft M3 — heterogeneous onboarding proof | ⏳ | Planned |
| Multi-aircraft M4 — sharing/recovery/scale closeout | ⏳ | Planned |
| Professional Logbook Platform | 🔬 | Research only; organization/operator workflows are not implementation-ready |

**Legend:** ✅ complete/live · 🚧 in progress · ⏳ planned · 🔬 research · ⚠️ blocked/external dependency

## Historical milestone track

This table is the concise chronological development history. Detailed implementation evidence remains in `CHANGELOG.md`, merged PRs and the archived documents under `docs/history/`.

| Milestone / release track | Status | What it established |
| --- | :---: | --- |
| v1.51.x — Regulatory Correctness Core | ✅ | Tested FCL.060/LAPL/FCL.740.A foundations, movement evidence, eligible ULL credit and certification evidence boundaries |
| v1.52 — Codebase Review & Cleanup | ✅ | Retired obsolete runtime/artifacts while preserving the validated regulatory core |
| v1.53–v1.54 — Aircraft state & catalogue | ✅ | Aircraft-state integrity, structured aircraft-type catalogue and manual fallback |
| v1.55–v1.61 — Flight-entry UX & category expansion | ✅ | Responsive entry workflow, guided setup and category-aware flight-record foundations |
| Multi-category Pilot Logbook | ✅ | Aeroplane, Helicopter, Sailplane, Balloon, ULL and Other on one canonical flight model |
| v2.1 — Dashboard & Statistics consolidation | ✅ | Stable all-time Dashboard plus dedicated historical/period analysis in Statistics |
| v2.2 — Action Center & Shared Flight Workflow | ✅ | Authoritative pending-work surface and reviewed collaboration workflows |
| v2.3 — Large Logbook Performance & Scalability | ✅ | 10k/50k/100k scale gates and hot-path optimization without changing record semantics |
| v2.4 — Flight Entry & Review 2.0 | ✅ | Canonical save/review/certify/share flow and explicit GPS review |
| v2.5 — Recency & Compliance Workspace | ✅ | Evidence-driven recency/licence planning and explainable CURRENT/INCOMPLETE states |
| v2.6 — Professional Pilot Workspace 2.0 | ✅ | Professional/operator context and experience reporting without silent employment inference |
| v2.7 — Data Integrity & Recovery 2.0 | ✅ | Review-first restore, backup integrity and protected certification/history recovery |
| v2.8 — Compliance & Safety Foundation | ✅ | Privacy, regulator-facing identity, map/provider and browser-security foundations |
| v2.9 — Commercial & External Validation | ✅ | Technical launch/legal/billing/signature/claims gates; external approvals remain separate |
| v3.0 — UX & Product Consolidation | ✅ | Navigation, Licences & Recency, Aircraft, Print & Data, Settings, Web Push and mobile/accessibility consolidation |
| v3.3 — Design & Workflow Consistency | ✅ | Shared tokens/geometry/icons/states/forms/display formatting/routes plus final Batch 9–11 closeout |
| Documentation governance consolidation | ✅ | Canonical ROADMAP / FEATURES / CHANGELOG and archived historical notes · PR #148–150 |
| Multi-aircraft M0 | ✅ | Current-profile vs historical-flight source-of-truth contract · PR #153 |
| Multi-aircraft M2A | ✅ | Helicopter historical snapshot integrity · PR #154 |
| Multi-aircraft M1 | ✅ | Canonical fail-closed aircraft-profile validation · PR #155 |
| Safety Pilot ↔ PIC shared-flight workflow | ⏳ | Connected PIC selection/manual fallback and PIC invite from a Safety Pilot source record |
| GPS touch-and-go detection reliability | 🚧 | Reported real-track landing-count mismatch; reproduce before detector changes |
| Multi-aircraft M2B | ⏳ | Remaining historical/dynamic applicability integrity audit — candidate next |
| Multi-aircraft M3 | ⏳ | No-code heterogeneous onboarding proof |
| Multi-aircraft M4 | ⏳ | Sharing, recovery, measured scale and final closeout |
| Professional Logbook Platform | 🔬 | Future organization/operator/instructor/student/fleet workflows — research only |

## Status vocabulary

- **DONE** — implemented and merged; any remaining external approval is stated separately.
- **ACTIVE** — current work.
- **NEXT** — next planned work after ACTIVE closes.
- **PLANNED** — accepted direction, not yet the next implementation step.
- **RESEARCH** — not implementation-ready.
- **BLOCKED / EXTERNAL** — implementation may exist, but completion depends on evidence or a decision outside the repository.

## Current state

### Roadmap review & prioritization checkpoint — ACTIVE

The product is at a clean checkpoint after documentation governance, UX/design closeout, M0, M2A and M1.

Current work is intentionally documentation/product-priority review before another implementation milestone starts.

Goals:
- validate the next product priority against the actual repository and production baseline;
- keep M2B as a candidate next step rather than starting it automatically;
- confirm whether Multi-aircraft M2B → M3 → M4 remains the right sequence;
- review the wider Logbook horizon so technical follow-up work does not silently become product priority;
- preserve completed milestone history in the progress tables above.

No runtime implementation starts from this checkpoint until the roadmap review is confirmed.

#### New product/reliability inputs captured for this review

**Safety Pilot ↔ PIC shared-flight workflow — REQUESTED**

Current repository evidence:
- `SAFETY PILOT` already exists as a flight role and the form already requires/requests the actual PIC for EASA Safety Pilot records.
- The current `Actual PIC` field is free text only; the New flight page supplies a datalist of accepted **instructors**, not all accepted pilot Connections.
- Generic certified-flight sharing exists, but its participant-role contract currently excludes `PIC`; a Safety Pilot source record therefore cannot invite the actual PIC as PIC through the canonical participation workflow.

Requested product behavior:
- when the owner logs the flight as **SAFETY PILOT**, `Actual PIC` can be selected from accepted Connections **or entered manually**;
- selecting a connected pilot must preserve that user's identity separately from the displayed/manual name so matching never depends on name text;
- after certification, the owner can invite that selected connection as **PIC** through the existing Review → Add → Certify shared-flight workflow;
- the recipient gets an independent owned flight record with role PIC; the source user's Safety Pilot record remains independent evidence;
- manual PIC text remains valid when the PIC is not a FlyTally connection, but cannot silently create an account link or invitation;
- adding PIC as a shareable participant role must not accidentally credit the source Safety Pilot record, weaken source-revision/hash checks, or change existing instructor/Safety Pilot invitation semantics.

This is a collaboration/data-model feature and must be designed against the existing `flight_participations` ownership model before implementation.

**GPS touch-and-go detection reliability — INVESTIGATION**

A real flight has been reported where GPS import produced the wrong landing count during touch-and-go operations.

Current detector contract:
- landing suggestion is `1 + detected touch-and-go events` and remains user-editable/review-required;
- speed-based detection requires a drop below 20 km/h bracketed by >42 km/h movement and a 5–90 second ground event;
- rolling touch-and-go fallback uses a local altitude minimum, 28–145 km/h groundspeed, at least 30 m descent and 30 m climb, and an altitude-discontinuity guard;
- several detector windows and duplicate-suppression rules are currently expressed in **point counts** (for example ±10 points / 8-point grouping), so their real time span changes with GPS sampling rate.

Review requirement:
- reproduce the reported mismatch from the exact original KML/GPX/CSV before changing thresholds;
- compare actual touch-and-go timestamps against speed, altitude and sampling interval;
- determine whether the defect is threshold-specific or caused by point-count windows that are sampling-rate dependent;
- prefer time/distance-normalized evidence if repository evidence confirms sampling-rate sensitivity;
- retain manual review/editability and fail conservative rather than inventing regulatory landing evidence.

Exact sample track is required before this investigation can move from reported issue to a verified detector defect/fix plan.

### Documentation governance consolidation — DONE

Goal: make repository state easy to reconstruct in a new development chat without relying on memory.

Scope:
- keep one canonical roadmap;
- keep one canonical feature list;
- keep one canonical changelog;
- reduce root-level historical documentation clutter;
- preserve historical engineering evidence under `docs/history/`;
- make ROADMAP / FEATURES / CHANGELOG updates part of the normal Definition of Done.

Acceptance achieved by the governance candidate:
- root documentation is limited to current operating documents;
- historical milestone files remain available but are clearly non-authoritative;
- README points to the canonical documentation;
- active regulatory/data-integrity contracts remain outside the historical archive;
- no runtime code, schema or product behavior changes.

## Immediate roadmap

### 1. Design-consistency audit — DONE

The current audit is defined in `docs/ux-audit.md`.

Remaining work:

1. **Batch 9 — surfaces and error pages — DONE**
   - Root not-found and runtime-error fallbacks use the existing FlyTally visual system without exposing technical error details.
   - Push onboarding uses the canonical raised-surface contract.
   - UX-027 is closed as an incorrect audit premise with no visual change.
   - PR #147 carries the implementation and verification closeout.

2. **Batch 10 — microcopy — DONE**
   - UX-032: email terminology is consistent: Email for sign-in/join, Account email for the signed-in account identity, Pilot email only for another-pilot contexts.
   - UX-033: Dashboard lead copy now uses operational wording and points historical analysis to Statistics.
   - Presentation-only; no domain or regulatory behavior change.

3. **Batch 11 — offline state — DONE**
   - UX-025: the service worker remains online-only.
   - A non-blocking connection banner appears when the browser reports offline and clears automatically when connectivity returns.
   - No offline editing, caching or mutation of logbook/certified data was added.

Closeout acceptance:
- all approved audit findings are either implemented or explicitly closed with evidence;
- typecheck/tests/build are reported truthfully;
- visual verification covers desktop, iPad/mobile, light and dark where relevant;
- ROADMAP, FEATURES and CHANGELOG are reconciled in the same work cycle.

### 2. Multi-aircraft Product Scale — ACTIVE

Goal: prove that FlyTally can onboard and use heterogeneous aircraft profiles repeatedly without aircraft-specific code paths, while preserving historical flight evidence and the existing regulatory engines.

#### Existing baseline confirmed by repository discovery

- A user can already own multiple aircraft profiles; aircraft are personal records keyed by user + registration.
- The bundled FAA/ICAO identity catalogue contains more than 5,000 searchable entries and always retains manual Make / Model / ICAO fallback.
- Catalogue class hints are deliberately non-binding; Part-FCL class/category remains explicit pilot-confirmed state.
- The canonical category layer already supports Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other records.
- Quick Add and the full Aircraft editor already submit the same regulatory profile fields and the normal server save path fails closed on invalid profile combinations.
- Flights retain category/configuration evidence separately from the mutable aircraft profile; certification/revision history must remain independent of later profile edits.
- Aircraft sharing is a one-time recipient-owned copy, not shared fleet ownership.
- Portable backup/restore already includes aircraft profiles and must preserve exact historical/protected evidence.

#### Frozen scope decisions

- Do **not** create a second flight model, aircraft-specific entry pages or a parallel fleet runtime.
- Do **not** infer regulatory class, privilege or applicability solely from catalogue metadata.
- Do **not** remove manual aircraft identity entry when a catalogue type is missing.
- Do **not** introduce organization/fleet ownership; that remains Professional Logbook Platform research.
- Keep one current personal aircraft profile per user + registration. Historical flights remain the evidence snapshot.
- No schema change is assumed. Any migration must first be proven necessary, additive/backward-compatible and separately gated.

#### M0 — Contract & evidence audit — DONE

Closeout:
- field-by-field source-of-truth matrix and consumer inventory are recorded in `docs/product/MULTI_AIRCRAFT_SCALE_CONTRACT.md`;
- shared import is confirmed as a weaker validation boundary and is assigned to M1;
- helicopter recency is confirmed as the historical-integrity defect that must be fixed before M1 writes are hardened;
- ULL / Annex-I `part_fcl_credit_*` is classified as dynamic applicability/provenance metadata under the established v1.51.4 contract, not as helicopter-like historical type evidence;
- exact backup/restore is explicitly outside interactive profile canonicalization;
- the independent second-AI review was reconciled against repository evidence;
- no product/runtime/schema change in M0.

#### M2A — Helicopter historical snapshot integrity — DONE

Scope:
- change type-specific helicopter recency to resolve historical type from `flights.aircraft_model`, then bounded legacy `flights.aircraft_type`;
- remove mutable current-profile model and registration as silent type identity fallbacks;
- add an explicit incomplete/limited-evidence path when historical type is unresolved and could affect the result;
- preserve certification payload versions/hashes and stored flights unchanged.

Acceptance:
- later edits to the current aircraft model cannot change historical helicopter type-specific recency;
- populated flight model wins; legacy flight type fallback is deterministic;
- unresolved type evidence cannot create false CURRENT;
- existing certification v1-v8 verification remains unchanged;
- targeted unit/service/PostgreSQL regressions cover the compatibility boundary.

#### M1 — Canonical aircraft-profile validation — DONE

Scope:
- one reusable server-side parser/normalizer for aircraft profile regulatory fields;
- direct Add/Edit and shared-profile import use the same fail-closed business rules;
- malformed, incomplete or non-applicable shared snapshots are rejected rather than defaulted into a plausible profile;
- preserve catalogue-as-convenience and manual identity fallback.

Acceptance:
- one normalization matrix covers ULL; SEP/MEP/SET; TMG in Part-FCL and Part-SFCL context; Glider; Helicopter; Balloon classes/groups; and conservative Other;
- Quick Add, full editor and share import use the same canonical fail-closed regulatory validator;
- malformed explicit class/category combinations and non-applicable BFCL fields are rejected instead of silently repaired;
- PostgreSQL acceptance proves malformed imported profile combinations cannot reach persistence;
- exact backup/restore remains outside interactive profile canonicalization;
- no certified flight, revision or existing recipient-owned profile is silently rewritten.

#### M2B — Remaining historical & dynamic applicability integrity — PLANNED

Scope:
- verify the remaining recency consumers do not silently prefer mutable current-profile identity over stored flight evidence;
- preserve the established automatic ordinary ULL→SEP experience rule;
- preserve explicit atypical `part_fcl_credit_*` as dynamic applicability/provenance metadata with its effective-from boundary;
- verify GPS-import and manual-flight paths snapshot the same applicable aircraft context;
- preserve certification fingerprint compatibility and historical revision verification.

Acceptance:
- no remaining historical identity calculation is silently reclassified by current profile edits;
- ordinary ULL→SEP behavior and explicit TMG override behavior remain regression-covered;
- basis/effective-date provenance remains enforced for explicit credit override persistence;
- existing v1-v8 certification hashes and certified revisions continue to verify.

#### M3 — No-code heterogeneous onboarding proof

Scope:
- prove the existing Aircraft workspace can create and use representative profiles from every supported category without adding make/model-specific code;
- catalogue-selected and manual identity paths converge on the same profile contract;
- keep category-specific fields progressive and explicit rather than adding generic “typical aircraft” defaults;
- verify Add flight receives the complete applicable profile state while Role remains flight-specific.

Acceptance:
- representative Aeroplane, Helicopter, Sailplane/TMG, Balloon, ULL and Other profiles can be added, edited, deactivated/reactivated and selected in flight entry through the same canonical workflow;
- unsupported catalogue identity never blocks manual onboarding;
- missing required applicability data fails closed with user-facing guidance;
- desktop, iPad and mobile interaction remains usable in light/dark themes.

#### M4 — Sharing, recovery, scale & closeout

Scope:
- verify one-time aircraft sharing preserves recipient ownership and canonical validation;
- verify backup/restore preserves aircraft profiles without weakening protected-flight evidence;
- measure aircraft-library / picker behavior with a multi-profile fixture before adding any optimization;
- retain safe deletion/deactivation behavior when flights reference a registration;
- close documentation and production verification.

Acceptance:
- sharing, restore and multi-profile flight selection have PostgreSQL regression coverage;
- no duplicate registration or cross-user ownership regression;
- performance optimization is added only if measured evidence requires it;
- typecheck, complete regression suite, PostgreSQL acceptance, production build and browser smoke pass on the final candidate;
- ROADMAP, FEATURES and CHANGELOG are reconciled before closeout.

#### Review gate — SATISFIED FOR M2A

The independent second-AI review returned **APPROVE WITH CHANGES**. Its blocking conditions were reconciled into the M0 contract and milestone order.

M2A and M1 are closed. M2B remains the current candidate next milestone, but implementation is paused until the active roadmap review confirms the wider product priority.

### 3. Professional Logbook Platform — RESEARCH

Potential later direction:
- organization/operator accounts;
- instructor/student workflows;
- flight-school evidence;
- fleet-linked training;
- organizational verification;
- controlled reports and team permissions.

This remains research until the pilot logbook, collaboration, regulatory evidence and multi-aircraft foundations are stable in real use.

## Completed product milestones

### UX & Product Consolidation — DONE

Completed work includes navigation/task hierarchy, Licences & recency progressive disclosure, management hierarchy, aircraft/airport workspace, Print & data hierarchy, Settings hierarchy, Web Push discovery/delivery, save → review → certify → share clarity, mobile/accessibility hardening and related workflow simplification.

The detailed product audit remains in `docs/product/V3_0_UX_CONSOLIDATION.md`.

### Commercial & External Validation technical foundation — DONE / EXTERNAL ITEMS REMAIN

Technical implementation exists for commercial launch gating, legal publication structure, billing/entitlement foundations, signature/regulatory validation foundations, brand/claims controls and release auditing.

External decisions/evidence remain separate from code completion, including legal review, regulator/authority acceptance, trademark/claims review, payment provider/plans/prices and other third-party approvals.

No environment flag, internal test or marketing text may be treated as evidence of external approval.

### Compliance & Safety Foundation — DONE

Implemented foundations cover privacy/self-service, legal/provider boundaries, map/licensing hardening, aviation-evidence safeguards, public-sharing boundaries, security controls and release regressions.

### Multi-category Pilot Logbook — DONE

Implemented support includes the canonical category model and category-aware evidence/presentation for Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other records while preserving historical evidence boundaries.

## Permanent engineering constraints

1. **Data integrity first.** Certified/finalized evidence is audited and versioned, not destructively rewritten.
2. **Evidence before regulatory status.** Missing evidence must not produce a false CURRENT/compliant state.
3. **One workflow.** Do not create parallel Quick/Simple/Advanced variants of the same core flight workflow.
4. **Explicit state.** Missing is not zero/default; invalid combinations are rejected instead of silently repaired.
5. **Backward compatibility.** Existing records, fingerprints, revisions, sharing and restore behavior remain protected.
6. **Server-side ownership/auth.** Client state never substitutes for authorization.
7. **Mobile is a release gate.** Desktop success alone is not enough for core workflows.
8. **Testing is part of completion.** Report PASS only for checks that actually ran.
9. **Documentation is part of completion.** Significant work is not closed until ROADMAP, FEATURES and CHANGELOG have been checked and updated where needed.
10. **External approval is never inferred.** Internal implementation, tests or publication status do not equal authority/legal/provider approval.

## Historical roadmap

The pre-consolidation roadmap, including older release-by-release planning detail, is preserved verbatim at:

`docs/history/ROADMAP_LEGACY_2026-09-26.md`

Historical documents are evidence and context only. If they conflict with this file, this roadmap controls current planning.
