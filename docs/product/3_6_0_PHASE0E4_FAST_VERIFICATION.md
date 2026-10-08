# 3.6.0 Phase 0E.4 — Fast iteration and risk-based release verification

**Status:** REVIEWED DESIGN / ACCEPT WITH CHANGES / 0E.4b DONE / 0E.4c ACTIVE  
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

### `verify:release:risk`

Risk-based release orchestrator for an explicit candidate. The existing `verify:release` name keeps its current full/static meaning throughout 0E.4; changing that public command requires a separate explicit product decision.

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
- existing `verify:release` remains the compatibility full/static command and is not silently repurposed;
- `verify:release:full` may be added only as an explicit alias for discoverability, not as a semantic migration prerequisite;
- the new orchestrator is `verify:release:risk`;
- `--force-all` on the risk-scoped planner forces every **risk-scoped** gate, not the legacy 94-test browser diagnostic.

## Browser evidence semantics

Keep the existing behavioral class name `browser-acceptance`; do not add a fifth product evidence class merely to encode execution width.

Change the authoritative dedicated source from legacy `browser` to `browser-risk`. Authority is machine-enforced, not conventional: canonical risk evidence must carry `authority: release`, `source: browser-risk`, `coverage: targeted`, exact planner `selectionHash`, current `candidateId`, `configHash`, `toolchainHash`, build identity and browser fixture contract/reset identity. Legacy browser diagnostics never carry release authority.

- `browser-risk` + planner-bound selection + matching authority/identity fields = authoritative candidate browser evidence.
- legacy `browser` full-matrix output = diagnostic only and cannot satisfy release `browser-acceptance`, even when its raw tests pass.
- risk-scoped browser observations use `coverage: targeted` and carry `selectionHash`, exact targets, specs, titles and projects. Release recomputes the required selection and rejects any actual-execution mismatch, missing target, extra target, skip/fixme/interruption or stale identity.
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
- if an E2E spec itself changes, select the approved target(s) that own that spec; deleted/renamed/stale spec ownership blocks before Playwright;
- every target resolves exactly one `{spec,title,project}` execution; zero, ambiguous or duplicate resolution blocks;
- browser harness files select the complete registered authoritative risk-target set unless a separately reviewed dependency map proves a narrower set;
- self-managed responsive matrices run only in the project needed for their explicit viewport/theme matrix unless touch/mobile-user-agent behavior is separately required;
- deduplicate target ids, test titles and specs deterministically;
- if `plan.browser=true` and any affected browser-relevant changed path/module/rule has no approved target ownership, add a blocked-evidence reason and exit 3. Absence of a target is never interpreted as absence of browser risk.

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

Reuse is an optimization, never inference. Browser-risk resets/seeds the isolated PostgreSQL fixture before every authoritative execution; the deterministic fixture contract/reset identity is derived from the exact seed/reset implementation and recorded with the observation.

A release orchestrator may reuse a stored gate only if the exact candidate and current expected execution identity match. Otherwise it reruns or reports NOT RUN/blocked.

Never reuse:
- evidence from another candidate id;
- a candidate whose dirty/untracked relevant worktree identity differs;
- a stale build artifact;
- a legacy full-browser diagnostic as risk-scoped browser evidence;
- browser evidence whose selection/config/toolchain/fixture identity differs;
- a PARTIAL/FAIL/NOT RUN entry.

## Exit contract

- 0 — requested iteration/release contract completed successfully;
- 1 — an executed required gate/evidence set failed or evaluated PARTIAL;
- 2 — invalid invocation/configuration/environment;
- 3 — valid candidate blocked before required execution (missing target/evidence or stale prerequisite that the command is not allowed to repair).

The existing docs omitted exit 1; 0E.4 must make it explicit.

## Milestones

### 0E.4a — identity + registry + planner selection — DONE / VERIFIED
- expand candidate/reuse identity to account for dirty/untracked worktree state and deterministic verification config/toolchain/fixture contracts;
- add browser target schema/registry;
- add deterministic selector + selection hash;
- expose browser targets in `verify:plan`;
- fail closed on required browser coverage gaps;
- correct `buildArtifactRequired = build || browser`;
- tests only; no release-command replacement yet.

### 0E.4b — fast iteration executor — DONE / VERIFIED
- canonical source-contract group execution/ledger;
- `verify:iterate`;
- exact-candidate ledger reuse;
- human summary of release-pending gates.

Current 0E.4b implementation candidate:
- planner exposes registry-derived `sourceEvidence.groups/tests` and blocks required source evidence with no approved group;
- `verification-source.mjs` runs the exact selected application-source-contract test union directly and writes candidate-bound source evidence;
- `verification-typecheck.mjs` writes a separate candidate-bound TypeScript ledger;
- domain/source/typecheck effective configuration carries verification-config and declared-toolchain identity for exact reuse;
- `verification-reuse.mjs` rejects candidate, gate, evidence-class, evaluation or effective-configuration drift;
- `verify:iterate` runs/reuses only source/domain/typecheck evidence, reports release work as **NOT EVALUATED**, and deliberately does not run aggregate regression, PostgreSQL, production build or browser;
- `--rerun` bypasses reusable source/domain/typecheck evidence;
- `--with-browser` is explicitly unavailable until 0E.4c rather than silently producing non-authoritative browser evidence;
- existing `verify:release`, `verify:app`, PostgreSQL and browser command semantics remain unchanged.

0E.4b verification closeout:
- exact candidate: `d01813c978c63cd5fc14945fca9a310226d338d2`;
- first fast iteration: development-pipeline **98/98 PASS**, domain N/A, TypeScript PASS, release **NOT EVALUATED**;
- immediate repeat: source PASS / domain N/A / TypeScript PASS all reused from the exact candidate ledger;
- same-candidate `verify:app`: TypeScript PASS, aggregate regression **1393/1393 PASS**, production build **41/41 PASS**;
- PostgreSQL/browser: N/A for this 0E.4b tooling-only candidate.

### 0E.4c — authoritative risk browser executor — ACTIVE

Current implementation candidate:
- `browser-acceptance` authority moves from legacy `browser` full-matrix output to planner-bound `browser-risk` targeted evidence;
- Playwright evidence report v2 records exact `{spec,title,project}` planned and actual cases;
- executor recomputes and enforces the exact planner selection, selection hash, config/toolchain identity and fixture contract identity;
- same-candidate production build is required and may be created automatically when missing;
- retries=0, workers=1 and fullyParallel=false remain mandatory with the shared mutable browser DB;
- raw skips/fixme/interruption or target mismatch fail closed;
- legacy `verify:browser` is explicitly diagnostic and no longer carries `browser-acceptance` authority;
- `verify:iterate --with-browser` may run or reuse the exact risk-scoped browser evidence without converting iteration PASS into release PASS.

0E.4c verification status:
- exact candidate `4c103dafc4eb1c53315e788ab3ca6d2f9e218922`: TypeScript PASS, aggregate regression **1396/1396 PASS**, production build **41/41 PASS**;
- first authoritative browser attempt produced **no executed browser cases** and therefore did not satisfy browser evidence: the executor generated an anchored `--grep=^(?:title...)# 3.6.0 Phase 0E.4 — Fast iteration and risk-based release verification

**Status:** REVIEWED DESIGN / ACCEPT WITH CHANGES / 0E.4b DONE / 0E.4c ACTIVE  
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

### `verify:release:risk`

Risk-based release orchestrator for an explicit candidate. The existing `verify:release` name keeps its current full/static meaning throughout 0E.4; changing that public command requires a separate explicit product decision.

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
- existing `verify:release` remains the compatibility full/static command and is not silently repurposed;
- `verify:release:full` may be added only as an explicit alias for discoverability, not as a semantic migration prerequisite;
- the new orchestrator is `verify:release:risk`;
- `--force-all` on the risk-scoped planner forces every **risk-scoped** gate, not the legacy 94-test browser diagnostic.

## Browser evidence semantics

Keep the existing behavioral class name `browser-acceptance`; do not add a fifth product evidence class merely to encode execution width.

Change the authoritative dedicated source from legacy `browser` to `browser-risk`. Authority is machine-enforced, not conventional: canonical risk evidence must carry `authority: release`, `source: browser-risk`, `coverage: targeted`, exact planner `selectionHash`, current `candidateId`, `configHash`, `toolchainHash`, build identity and browser fixture contract/reset identity. Legacy browser diagnostics never carry release authority.

- `browser-risk` + planner-bound selection + matching authority/identity fields = authoritative candidate browser evidence.
- legacy `browser` full-matrix output = diagnostic only and cannot satisfy release `browser-acceptance`, even when its raw tests pass.
- risk-scoped browser observations use `coverage: targeted` and carry `selectionHash`, exact targets, specs, titles and projects. Release recomputes the required selection and rejects any actual-execution mismatch, missing target, extra target, skip/fixme/interruption or stale identity.
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
- if an E2E spec itself changes, select the approved target(s) that own that spec; deleted/renamed/stale spec ownership blocks before Playwright;
- every target resolves exactly one `{spec,title,project}` execution; zero, ambiguous or duplicate resolution blocks;
- browser harness files select the complete registered authoritative risk-target set unless a separately reviewed dependency map proves a narrower set;
- self-managed responsive matrices run only in the project needed for their explicit viewport/theme matrix unless touch/mobile-user-agent behavior is separately required;
- deduplicate target ids, test titles and specs deterministically;
- if `plan.browser=true` and any affected browser-relevant changed path/module/rule has no approved target ownership, add a blocked-evidence reason and exit 3. Absence of a target is never interpreted as absence of browser risk.

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

Reuse is an optimization, never inference. Browser-risk resets/seeds the isolated PostgreSQL fixture before every authoritative execution; the deterministic fixture contract/reset identity is derived from the exact seed/reset implementation and recorded with the observation.

A release orchestrator may reuse a stored gate only if the exact candidate and current expected execution identity match. Otherwise it reruns or reports NOT RUN/blocked.

Never reuse:
- evidence from another candidate id;
- a candidate whose dirty/untracked relevant worktree identity differs;
- a stale build artifact;
- a legacy full-browser diagnostic as risk-scoped browser evidence;
- browser evidence whose selection/config/toolchain/fixture identity differs;
- a PARTIAL/FAIL/NOT RUN entry.

## Exit contract

- 0 — requested iteration/release contract completed successfully;
- 1 — an executed required gate/evidence set failed or evaluated PARTIAL;
- 2 — invalid invocation/configuration/environment;
- 3 — valid candidate blocked before required execution (missing target/evidence or stale prerequisite that the command is not allowed to repair).

The existing docs omitted exit 1; 0E.4 must make it explicit.

## Milestones

### 0E.4a — identity + registry + planner selection — DONE / VERIFIED
- expand candidate/reuse identity to account for dirty/untracked worktree state and deterministic verification config/toolchain/fixture contracts;
- add browser target schema/registry;
- add deterministic selector + selection hash;
- expose browser targets in `verify:plan`;
- fail closed on required browser coverage gaps;
- correct `buildArtifactRequired = build || browser`;
- tests only; no release-command replacement yet.

### 0E.4b — fast iteration executor — DONE / VERIFIED
- canonical source-contract group execution/ledger;
- `verify:iterate`;
- exact-candidate ledger reuse;
- human summary of release-pending gates.

Current 0E.4b implementation candidate:
- planner exposes registry-derived `sourceEvidence.groups/tests` and blocks required source evidence with no approved group;
- `verification-source.mjs` runs the exact selected application-source-contract test union directly and writes candidate-bound source evidence;
- `verification-typecheck.mjs` writes a separate candidate-bound TypeScript ledger;
- domain/source/typecheck effective configuration carries verification-config and declared-toolchain identity for exact reuse;
- `verification-reuse.mjs` rejects candidate, gate, evidence-class, evaluation or effective-configuration drift;
- `verify:iterate` runs/reuses only source/domain/typecheck evidence, reports release work as **NOT EVALUATED**, and deliberately does not run aggregate regression, PostgreSQL, production build or browser;
- `--rerun` bypasses reusable source/domain/typecheck evidence;
- `--with-browser` is explicitly unavailable until 0E.4c rather than silently producing non-authoritative browser evidence;
- existing `verify:release`, `verify:app`, PostgreSQL and browser command semantics remain unchanged.

0E.4b verification closeout:
- exact candidate: `d01813c978c63cd5fc14945fca9a310226d338d2`;
- first fast iteration: development-pipeline **98/98 PASS**, domain N/A, TypeScript PASS, release **NOT EVALUATED**;
- immediate repeat: source PASS / domain N/A / TypeScript PASS all reused from the exact candidate ledger;
- same-candidate `verify:app`: TypeScript PASS, aggregate regression **1393/1393 PASS**, production build **41/41 PASS**;
- PostgreSQL/browser: N/A for this 0E.4b tooling-only candidate.

### 0E.4c — authoritative risk browser executor — ACTIVE

Current implementation candidate:
- `browser-acceptance` authority moves from legacy `browser` full-matrix output to planner-bound `browser-risk` targeted evidence;
- Playwright evidence report v2 records exact `{spec,title,project}` planned and actual cases;
- executor recomputes and enforces the exact planner selection, selection hash, config/toolchain identity and fixture contract identity;
- same-candidate production build is required and may be created automatically when missing;
- retries=0, workers=1 and fullyParallel=false remain mandatory with the shared mutable browser DB;
- raw skips/fixme/interruption or target mismatch fail closed;
- legacy `verify:browser` is explicitly diagnostic and no longer carries `browser-acceptance` authority;
- `verify:iterate --with-browser` may run or reuse the exact risk-scoped browser evidence without converting iteration PASS into release PASS.

, while Playwright applies grep to the composed full title containing project/file context;
- selector corrected to match the escaped registered title as a fragment of Playwright's full title; exact planner-vs-planned-vs-actual `{spec,title,project}` equality remains the fail-closed authority check, so removing the anchor does not weaken evidence completeness;
- regression added for Playwright full-title grep semantics;
- exact fixed-head browser verification pending.

### 0E.4c — risk-scoped browser executor
- `verify:browser:risk`;
- exact registered target execution;
- browser-risk authoritative source;
- legacy full `verify:browser` demoted to manual diagnostic in policy/tests/docs;
- runtime measurement.

### 0E.4d — release orchestrator
- keep old static `verify:release` semantics unchanged;
- add risk-based orchestration as `verify:release:risk`;
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


## Independent review reconciliation — 8 October 2026

Independent review verdict: **ACCEPT WITH CHANGES**.

Required changes accepted into the design:
- release browser authority is validated through source + explicit authority + exact candidate/selection/config/toolchain/build/fixture identity;
- every browser-relevant changed path must resolve approved ownership or block with exit 3;
- every target must resolve exactly one Playwright execution before the runner starts;
- browser-risk resets/seeds its localhost PostgreSQL fixture and records a deterministic fixture contract/reset identity;
- actual executed browser cases must equal the planner selection exactly; skips/fixme/interruption/missing/extra cases cannot PASS;
- `verify:iterate --with-browser` may produce authoritative reusable browser evidence only when it executes the exact current release-required selection; otherwise it is diagnostic/non-authoritative;
- existing `verify:release` keeps its current semantics; the new command is `verify:release:risk`;
- candidate/reuse identity is hardened for dirty/untracked worktree state;
- the negative-test list from the review is mandatory across 0E.4a–0E.4e.

The review also confirms that preserving the existing `browser-acceptance` evidence class is acceptable after these authority checks are machine-enforced.
