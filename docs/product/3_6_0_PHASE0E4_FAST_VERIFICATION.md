# 3.6.0 Phase 0E.4 — Fast iteration and risk-based release verification

**Status:** DRAFT DESIGN / INDEPENDENT REVIEW REQUIRED  
**Parent:** `docs/product/3_6_0_PHASE0_ENGINEERING_QUALITY.md`  
**Scope:** development verification tooling only; no product runtime, database schema, certification, backup or timezone-semantic change.

## Problem

The authenticated browser matrix is intentionally serialized against one mutable local PostgreSQL fixture. The current repository-wide run executes 94 Playwright cases and has measured at roughly 11.6–11.7 minutes. That is useful as a manual diagnostic, but it is too expensive for normal iteration or milestone closeout.

Phase 0E.4 must make the normal loop candidate-aware and risk-scoped without turning a narrow test run into false full-browser evidence.

## Reconstructed baseline

Phase 0E.3 is DONE / VERIFIED.

Current canonical pieces already exist:
- explicit candidate resolution and content-aware `candidateId`;
- registry-backed module/risk/test-group classification;
- direct module-approved `domain-unit` selection;
- candidate-bound local ledger entries;
- canonical app, domain and PostgreSQL executors;
- legacy full authenticated browser executor with same-candidate build freshness;
- strict evidence evaluator that keeps aggregate tests/build separate from behavioral evidence.

Current product decision:
- the 94-test serialized `verify:browser` matrix remains available as an explicit manual diagnostic;
- it is not a normal iteration, milestone or Phase-0 closeout blocker;
- an unrun full browser matrix must be reported as NOT RUN, never PASS.

## Design principles

1. **Exact candidate first.** Every execution and reusable ledger entry is tied to the planner's exact `candidateId`.
2. **Targeted does not mean guessed.** Browser selection must come from explicit version-controlled registry metadata, never filename heuristics created at execution time.
3. **Fail closed on missing ownership.** If a candidate requires browser evidence but no approved browser target resolves, the plan is blocked before Playwright starts.
4. **No false full-browser claim.** Risk-scoped browser PASS is distinct in source/provenance from the legacy repository-wide diagnostic.
5. **Reuse exact evidence.** Release verification should reuse successful same-candidate ledger entries whose effective configuration still matches the plan.
6. **One mutable browser DB still means one worker.** Per-worker DB isolation is deferred.
7. **No hidden heavy gate.** Iteration and release summaries must state exactly what ran, what was reused, what remains pending and what was N/A.

## Proposed command surface

### `verify:iterate`

Fast development feedback for an explicit candidate.

Default execution:
- planner;
- required registry-backed source-contract groups;
- required direct `domain-unit` tests;
- TypeScript when the planner requires it.

It does **not** run aggregate full tests, PostgreSQL full acceptance, production build or browser by default.

Optional:
- `--with-browser` runs the planner-selected risk-scoped browser target set;
- `--rerun` ignores reusable same-candidate PASS ledger entries.

An iteration PASS is not a release PASS. The summary must show release-only gates still pending.

### `verify:browser:risk`

Authoritative candidate-scoped browser executor.

It:
- computes the exact browser target selection from the same planner candidate;
- blocks with exit 3 if browser evidence is required but target coverage is missing;
- requires or creates a same-candidate production build artifact because Playwright runs `npm start`;
- forces retries=0, workers=1 and `fullyParallel=false`;
- runs only the exact registered specs/test titles/projects selected for the candidate;
- writes the exact selection and a deterministic selection hash to the ledger;
- returns browser behavioral PASS only when every planned selected case executes successfully or is explicitly registered N/A.

The legacy `verify:browser` command remains the repository-wide manual diagnostic and is not consumed as release browser evidence.

### `verify:release`

Risk-based release orchestrator for an explicit candidate.

Execution order:
1. plan and fail-closed coverage check;
2. source-contract groups;
3. direct domain evidence;
4. TypeScript / aggregate regression / build only when selected;
5. PostgreSQL full acceptance only when selected;
6. risk-scoped browser acceptance only when selected;
7. evaluate the required evidence matrix and build artifact;
8. write one release ledger summary for the exact candidate.

Successful same-candidate ledger entries may be reused only when:
- candidate id matches;
- gate/evidence source matches the current contract;
- effective configuration and browser selection hash match;
- required build identity is still current.

### Compatibility

- existing low-level `test:target`, `test:group`, `test:postgres*` and `test:browser` remain;
- `verify:app`, `verify:domain`, `verify:postgres` remain;
- `verify:browser` remains the full manual diagnostic;
- current static `verify:release` behavior is preserved before replacement as `verify:release:full`;
- `--force-all` on the new release planner forces every **risk-scoped** gate, not the legacy 94-test browser diagnostic.

## Browser evidence semantics

Keep the existing behavioral class name `browser-acceptance`; do not add a fifth product evidence class merely to encode execution width.

Change the authoritative dedicated source from legacy `browser` to `browser-risk`.

- `browser-risk` + planner-bound selection = authoritative candidate browser evidence.
- legacy `browser` full-matrix output = diagnostic only and cannot satisfy release `browser-acceptance`.
- risk-scoped browser observations use `coverage: targeted` and carry `selectionHash`, exact targets, specs, titles and projects.
- the dedicated evaluator must explicitly permit targeted coverage only from `browser-risk`; PostgreSQL acceptance remains full-only.
- the browser executor, not prose, proves completeness by running the full planner-selected target set and writing the deterministic selection.

This preserves the Phase 0D taxonomy while preventing a narrow ad-hoc grep from masquerading as canonical evidence.

## Browser target registry

Extend `tooling/development-modules.json` with version-controlled browser target metadata.

Proposed shape:

```json
{
  "browserAcceptance": {
    "explicitNotApplicableSkipReasons": ["..."],
    "moduleTargets": {
      "flight-records": ["flight-save-core"],
      "connections-workflows": ["connections-core"]
    },
    "pathTargets": [
      {
        "prefixes": ["lib/role-crew", "lib/crew"],
        "targets": ["manual-rolecrew", "gps-rolecrew"]
      }
    ],
    "targets": {
      "flight-save-core": {
        "spec": "e2e/manual-authority-certification.spec.mjs",
        "tests": [
          "3.4.0 Manual explicit Save & certify seals the persisted row while Enter remains draft-only"
        ],
        "projects": ["desktop-chromium", "mobile-chromium"]
      }
    }
  }
}
```

Selection rules:
- start with the baseline target(s) registered for every affected module whose gate requires browser evidence;
- add path-specific escalation targets for high-risk sub-surfaces such as RoleCrew, certification, GPS/SERA, Connections and aircraft authority;
- if an E2E spec itself changes, select the approved target(s) that own that spec;
- browser harness files select a small cross-domain harness smoke target on both projects;
- self-managed responsive matrices run only in the project needed for their explicit viewport/theme matrix unless touch/mobile-user-agent behavior is separately required;
- deduplicate target ids, test titles and specs deterministically;
- if `plan.browser=true` and any affected browser module/rule has no approved target ownership, add a blocked-evidence reason and exit 3.

The first implementation must prefer conservative extra targeted cases over missing coverage. Runtime measurements can later justify narrower ownership.

## Important planner correction

Today `buildArtifactRequired` mirrors only `gates.build`. Browser execution uses `npm start` and therefore also needs a candidate-bound build.

0E.4 must define:

```text
buildArtifactRequired = gates.build || gates.browser
```

This removes the current inconsistency where a browser-harness candidate can require browser execution while the plan reports no build artifact requirement.

## Source-contract evidence

No public `verify:source` command is required.

The iteration/release orchestrators may run the planner-selected homogeneous `testGroups` directly through the existing Node test executor and write one candidate-bound application-source-contract ledger observation whose `sourceGates` are exactly those executed group ids.

Aggregate `npm test` remains non-authoritative and cannot synthesize source/domain/browser/PostgreSQL evidence.

## Ledger reuse

Reuse is an optimization, never inference.

A release orchestrator may reuse a stored gate only if the exact candidate and current expected execution identity match. Otherwise it reruns or reports NOT RUN/blocked.

Never reuse:
- evidence from another candidate id;
- a stale build artifact;
- a legacy full-browser diagnostic as risk-scoped browser evidence;
- browser evidence whose selection hash differs;
- a PARTIAL/FAIL/NOT RUN entry.

## Exit contract

- 0 — requested iteration/release contract completed successfully;
- 1 — an executed required gate/evidence set failed or evaluated PARTIAL;
- 2 — invalid invocation/configuration/environment;
- 3 — valid candidate blocked before required execution (missing target/evidence or stale prerequisite that the command is not allowed to repair).

The existing docs omitted exit 1; 0E.4 must make it explicit.

## Milestones

### 0E.4a — registry + planner selection
- add browser target schema/registry;
- add deterministic selector + selection hash;
- expose browser targets in `verify:plan`;
- fail closed on required browser coverage gaps;
- correct `buildArtifactRequired = build || browser`;
- tests only; no release-command replacement yet.

### 0E.4b — fast iteration executor
- canonical source-contract group execution/ledger;
- `verify:iterate`;
- exact-candidate ledger reuse;
- human summary of release-pending gates.

### 0E.4c — risk-scoped browser executor
- `verify:browser:risk`;
- exact registered target execution;
- browser-risk authoritative source;
- legacy full `verify:browser` demoted to manual diagnostic in policy/tests/docs;
- runtime measurement.

### 0E.4d — release orchestrator
- preserve old static path as `verify:release:full`;
- replace `verify:release` with risk-based orchestration;
- consume/reuse exact candidate evidence;
- release summary + release ledger.

### 0E.4e — verification and compatibility closeout
- negative selection/source/stale-ledger tests needed for this phase;
- focused local command verification;
- DEVELOPMENT/ROADMAP/CHANGELOG reconciliation;
- no 94-test full browser run required by policy.

## Acceptance criteria

0E.4 is complete only when:
- a normal small candidate can obtain useful feedback without a repository-wide browser run;
- planner-selected browser evidence is explicit and reproducible;
- missing browser ownership blocks instead of silently shrinking coverage;
- targeted ad-hoc Playwright commands cannot be promoted into release evidence;
- legacy full-browser output cannot satisfy the new authoritative browser source;
- release orchestration reuses only exact valid ledger evidence;
- old static release behavior has an explicit compatibility command;
- docs and executable command behavior agree;
- no product runtime, DB schema, certification, backup or 3.6.0 timezone semantics changed.
