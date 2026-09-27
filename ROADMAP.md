# FlyTally Logbook roadmap

Last reconciled: **27 September 2026**

This is the canonical planning document for `flytally-logbook`. It answers **what we do next, in what order, and why**.

- `FEATURES.md` describes what the product has or is expected to have.
- `CHANGELOG.md` records what actually changed.
- `DEVELOPMENT.md` defines how changes are implemented and verified.
- Detailed historical plans and milestone notes live under `docs/history/` and do not override this roadmap.

Historical PR/version labels are retained in Git history and the changelog, but they are not used to infer the current roadmap.

## Status vocabulary

- **DONE** — implemented and merged; any remaining external approval is stated separately.
- **ACTIVE** — current work.
- **NEXT** — next planned work after ACTIVE closes.
- **PLANNED** — accepted direction, not yet the next implementation step.
- **RESEARCH** — not implementation-ready.
- **BLOCKED / EXTERNAL** — implementation may exist, but completion depends on evidence or a decision outside the repository.

## Current state

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

#### M2A — Helicopter historical snapshot integrity — NEXT

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

#### M1 — Canonical aircraft-profile validation

Scope:
- one reusable server-side parser/normalizer for aircraft profile regulatory fields;
- direct Add/Edit and shared-profile import use the same fail-closed business rules;
- malformed, incomplete or non-applicable shared snapshots are rejected rather than defaulted into a plausible profile;
- preserve catalogue-as-convenience and manual identity fallback.

Acceptance:
- one normalization matrix covers ULL; SEP/MEP/SET; TMG in Part-FCL and Part-SFCL context; Glider; Helicopter; Balloon classes/groups; and conservative Other;
- Quick Add, full editor and share import cannot persist different regulatory semantics for equivalent input;
- PostgreSQL sharing acceptance proves invalid imported profile combinations cannot bypass the canonical contract;
- no certified flight, revision or existing recipient-owned profile is silently rewritten.

#### M2B — Remaining historical & dynamic applicability integrity

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

M2A is now the next implementation batch. M1 remains blocked until M2A closes successfully.

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
