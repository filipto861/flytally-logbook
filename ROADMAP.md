# FlyTally Logbook roadmap

Last reconciled: **26 September 2026**

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

### Governance consolidation — ACTIVE

Goal: make repository state easy to reconstruct in a new development chat without relying on memory.

Scope:
- keep one canonical roadmap;
- keep one canonical feature list;
- keep one canonical changelog;
- reduce root-level historical documentation clutter;
- preserve historical engineering evidence under `docs/history/`;
- make ROADMAP / FEATURES / CHANGELOG updates part of the normal Definition of Done.

Acceptance:
- root documentation is limited to current operating documents;
- historical milestone files remain available but are clearly non-authoritative;
- README points to the canonical documentation;
- no runtime code, schema or product behavior changes.

## Immediate roadmap

### 1. Finish the design-consistency audit — NEXT

The current audit is defined in `docs/ux-audit.md`.

Remaining work after the documentation reset:

1. **Batch 9 — surfaces and error pages**
   - PR #147 is implemented on `codex/v335-batch9-error-pages-push`.
   - Includes UX-026 and UX-029.
   - UX-027 is closed as an incorrect audit premise with no visual change.
   - Required before merge: verification evidence and production-safe closeout.

2. **Batch 10 — microcopy**
   - UX-032: email terminology consistency.
   - UX-033: replace decorative Dashboard lead copy with operational wording.
   - Presentation-only; no domain or regulatory behavior change.

3. **Batch 11 — offline state**
   - UX-025: retain the online-only service-worker policy.
   - Add an explicit non-blocking offline banner.
   - Do **not** add offline editing or offline mutation of logbook/certified data.

Closeout acceptance:
- all approved audit findings are either implemented or explicitly closed with evidence;
- typecheck/tests/build are reported truthfully;
- visual verification covers desktop, iPad/mobile, light and dark where relevant;
- ROADMAP, FEATURES and CHANGELOG are reconciled in the same work cycle.

### 2. Multi-aircraft Product Scale — PLANNED

This is the next product-development direction already established by the previous roadmap.

Goal: prove repeatable, low-friction multi-aircraft onboarding without creating aircraft-specific parallel workflows.

Principles:
- one canonical flight/data model;
- configuration and applicability are explicit;
- manual fallback remains available where catalogue data is absent;
- no regulatory meaning is inferred solely from aircraft type metadata;
- changes must preserve certified-history, sharing and recency integrity.

Before implementation, create a milestone plan with scope, dependencies, migration impact, tests and acceptance criteria.

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
