# FlyTally Logbook — Phase 0B/0E/0F verification development history

> **DATED VERBATIM EXCERPT** from `DEVELOPMENT.md` at `main@67229d984b0292992deeb1772b1ee8cd90b90040` on 11 October 2026. The text below is preserved *byte-for-byte* from its historical section `## Module scope registry` up to (but excluding) `### Changed-scope execution contract`. Its time-scoped “current”, “not active yet”, v2 and 368/381 values are phase snapshots, **not** the current registry/test-runner configuration. Consult [active DEVELOPMENT](../../DEVELOPMENT.md), actual `tooling/development-modules.json`, package scripts and source code for effective commands/evidence. Do not edit historical PASS/FAIL/NOT RUN records to imply a newer state.

---
## Module scope registry

`tooling/development-modules.json` is the single development-only registry for module ownership, risk metadata and named targeted test groups. It does not participate in runtime application behaviour and existing runtime files should not be moved merely to satisfy the registry.

Phase 0B.1 uses registry version 2:
- Markdown/docs remain lightweight documentation;
- CSS is classified as `ui-presentation`, selects the UI contract group and build evidence, and does **not** invent PostgreSQL risk;
- registered tests select their owning test group rather than being treated as runtime changes;
- unknown `app/`, `components/` or `lib/` runtime files fail conservative to full unit/regression + build evidence, but do not automatically invent PostgreSQL/browser dependencies;
- explicit persistence, browser and scale paths can escalate only the relevant heavy gates;
- `[full-ci]` remains the explicit escape hatch that selects every heavy gate.

`tooling/development-scope.mjs` reports `typecheck`, `postgres`, `scale`, `browser`, `full_tests`, `build`, matched `modules`, `risks`, `test_groups`, resolved `targeted_tests`, `required_evidence`, `aggregate_gates` and `build_artifact`.

Named groups are executed through `npm run test:group -- <group>`. `npm run test:ui` is now only an alias for the registry-owned `ui-contract` group; the 16-file UI list is no longer duplicated in `package.json`.

The Phase 0B.2 registry expands stable ownership from the original **121/381 (31.8%)** baseline to **368/381 (96.6%)**. The remaining **13** reviewed cross-cutting/not-yet-owned runtime files are explicitly listed under `shared-runtime`; future unmatched runtime files still fail conservative instead of receiving guessed ownership. Registry regression coverage requires at least 90% stable ownership and zero unclassified files in the current audited surface.

### Phase 0E canonical planner candidate

`npm run verify:plan -- <candidate>` is the new canonical Phase 0E planner surface. It is implemented as a side-effect-free wrapper around the same registry classifier used by `scope:changed`.

Accepted candidate sources are explicit:
- repository-relative positional paths;
- `--files <path>` containing one repo-relative path per line;
- `--base <git-ref>` for an explicitly supplied committed comparison;
- `--all` for all tracked repository paths.

No candidate input is an error. Multiple candidate sources are an error. The planner does not guess `origin/main`, a merge base, or a branch target.

Use `--json` for machine-readable plan output. Every plan includes:
- a content-aware `candidateId`;
- current HEAD SHA and optional resolved base SHA;
- exact normalized candidate paths and a deterministic files hash;
- modules, risks, targeted groups and required evidence;
- explicit `typecheck`, aggregate/full-test, PostgreSQL, scale, browser and build requirements.

`--force-all` changes gate selection only; it does not change candidate membership. This is deliberately distinct from `--all`, which changes the candidate to all tracked paths.

Phase 0E.1 does **not** execute tests, builds, PostgreSQL or browser fixtures and does not yet claim evidence PASS. Evidence availability blocking and the execution ledger are subsequent 0E milestones.


### Phase 0E.2 direct domain evidence registry

Direct `domain-unit` evidence is now explicit **available evidence** on the existing module registry. Required evidence is still derived only from the canonical risk/gate policy; modules do not duplicate a `requiredEvidence` field.

A module whose risks require `domain-unit` declares exact reviewed test paths under:

```json
{
  "evidenceTests": {
    "domain-unit": ["tests/example.test.ts"]
  }
}
```

Rules:
- exact repository-relative test paths only; no globs or inferred filenames;
- current domain-risk modules must have at least one approved direct test;
- direct domain evidence files must not be PostgreSQL integration tests or source-contract group members;
- the same approved pure behavioral test may support more than one module when it directly exercises both contracts;
- adding a file to aggregate `npm test` does not make it direct evidence automatically.

`verify:plan` now exposes the approved direct-domain modules/tests under `plan.directEvidence["domain-unit"]`. Missing approved tests are reported in `blockedEvidence`; a blocked plan exits 3 after emitting the plan. The current registry is fully covered, so normal current domain modules have no missing-domain block.

### Phase 0E.3 candidate-bound verification ledger and canonical gates

Canonical verification executors now bind their observations to the exact `candidateId` produced by the planner and write local machine-readable records under ignored `.flytally/verification/<candidateId>/`.

Available command surface in this implementation batch:
- `npm run verify:app -- <candidate args>` — TypeScript, aggregate Node regression and production build. Legacy `npm run verify` remains no-argument compatible by treating the candidate as `--all`; when explicit candidate args are supplied it forwards them to `verify:app`. Aggregate regression remains non-behavioral evidence.
- `npm run verify:domain -- <candidate args>` — only the registry-approved direct `domain-unit` tests for the affected modules; required-but-unavailable direct evidence exits 3 before execution.
- `npm run verify:postgres -- <candidate args>` — complete PostgreSQL acceptance against the existing localhost-only fail-closed harness.
- `npm run verify:browser:risk -- <candidate args>` — authoritative planner-bound browser acceptance for the exact registered risk target set. It requires a same-candidate production build, enforces retries=0/workers=1/fullyParallel=false, records exact `{spec,title,project}` cases and fails closed on selection/report mismatch.
- `npm run verify:browser -- <candidate args>` — legacy repository-wide authenticated browser **diagnostic** only. It still requires a matching candidate build, but it no longer satisfies release `browser-acceptance`.
- `npm run verify:browser:with-build -- <candidate args>` — compatibility convenience for the legacy full browser diagnostic; it creates the candidate-bound production build first and then runs `verify:browser`.

The low-level `test:postgres*`, `test:browser`, `test:target` and `test:group` commands remain available for diagnostics/iteration. The existing static `verify:release` command remains unchanged as the compatibility full path; the candidate-aware orchestrator is the separate `verify:release:risk` command.

Browser acceptance is deliberately stricter than raw Playwright success:
- release authority belongs only to `browser-risk`, never the legacy full diagnostic;
- risk execution forces `--retries=0` and `--workers=1`, while `playwright.config.mjs` must remain `fullyParallel=false`;
- a stale/missing/mismatched build blocks authoritative browser evidence;
- planner selection hash, config/toolchain identity and browser fixture-contract identity are carried into the risk ledger;
- planned and actual Playwright `{spec,title,project}` sets must exactly equal the planner-selected target set;
- raw skips/fixme/interruption are not acceptance PASS; only an explicitly registered N/A is permitted.

Ledger files are local evidence artifacts, not repository state, and `.flytally/` is ignored by Git.

### Phase 0E.4a risk-scoped planning candidate

0E.4a adds planning/identity infrastructure only. The new risk-scoped browser executor and release orchestrator are **not active yet**.

Current additions:
- verification candidate schema v2 records dirty/untracked worktree identity; `--base` and `--all` include current dirty/untracked files in candidate membership, while explicit path/file candidates expose any dirty files outside the candidate for later release blocking;
- browser candidates now require a production build artifact in the plan because authenticated Playwright runs the production server;
- `browserAcceptance.targets` in the registry contains exact authoritative `{spec,title,project}` executions;
- module/path ownership selects a deterministic union of browser targets;
- every selected target is statically validated against the frozen logical browser baseline and source declaration before Playwright exists in the loop;
- a browser-relevant file/module without approved ownership adds a planner blocker and `verify:plan` exits 3;
- selection output includes `browser-risk` source intent, exact target ids, selection hash, verification-config hash, declared-toolchain hash and browser-fixture contract hash.

Not every current browser-marked product module has approved targeted browser ownership yet. That is deliberate: such a candidate is blocked rather than silently receiving weak generic coverage.

The existing `verify:release` command keeps its current static/full semantics. The candidate-aware risk-based release command is `verify:release:risk`; it does not change the meaning of `verify:release`.

The legacy 94-test `verify:browser` command remains a manual diagnostic. Authoritative candidate browser evidence comes only from the planner-bound `browser-risk` executor.

Exit-code contract for canonical verification tooling:
- `0` — requested contract completed successfully;
- `1` — an executed gate/evidence set failed or evaluated PARTIAL;
- `2` — invalid invocation, configuration or environment;
- `3` — valid candidate blocked before required execution (for example missing approved evidence/target or stale prerequisite).

### Phase 0E.4b fast iteration — DONE / VERIFIED

`npm run verify:iterate -- <candidate>` is the fast development executor. It uses the same explicit candidate forms as `verify:plan` and currently runs only:
- registry-selected application/source-contract groups;
- module-approved direct domain evidence when required;
- TypeScript when required.

It intentionally does **not** run aggregate `npm test`, PostgreSQL acceptance, a production build or Playwright. The summary always reports release state as `NOT EVALUATED` and lists any heavy release work still pending.

Successful source/domain/typecheck ledger entries may be reused only for the exact candidate and exact effective configuration/toolchain identity. Use `--rerun` to bypass reuse. A documentation-only candidate should finish without starting TypeScript or behavioral tests.

Example:
```powershell
npm run verify:plan -- --base <explicit-base>
npm run verify:iterate -- --base <explicit-base>
# run the same command again to reuse exact candidate evidence
npm run verify:iterate -- --base <explicit-base>
# force fresh cheap evidence
npm run verify:iterate -- --base <explicit-base> --rerun
```

0E.4b exact closeout candidate `d01813c978c63cd5fc14945fca9a310226d338d2` passed development-pipeline **98/98**, TypeScript, aggregate regression **1393/1393** and production build **41/41**; an immediate repeat of the cheap lane reused source/domain/typecheck evidence.

### Phase 0E.4c risk browser — DONE / VERIFIED

`npm run verify:browser:risk -- <candidate>` is the authoritative candidate-scoped browser gate. It executes only planner-selected registry targets and may create a same-candidate production build when no fresh build ledger/output exists.

`npm run verify:iterate -- <candidate> --with-browser` adds that same authoritative browser-risk gate to the fast iteration flow after cheap source/domain/typecheck checks. Successful exact-candidate browser evidence may be reused when the selection, config/toolchain identity, fixture identity and current build identity still match.

The legacy 94-test `verify:browser` matrix remains available only as a manual diagnostic. It cannot satisfy release `browser-acceptance`.

0E.4c exact-head closeout `9e9ec3a3d3cb70f43f3ea7b83e168edf174b2e6a`: development-pipeline **101/101 PASS**, authoritative browser-risk **41/41 PASS** (21 desktop + 20 mobile, retries=0, workers=1), TypeScript PASS, aggregate regression **1396/1396 PASS**, production build **41/41 PASS**. PostgreSQL full was N/A for that browser-harness candidate; the legacy 94-case matrix was NOT RUN by policy.

### Phase 0E.4d risk release — DONE / VERIFIED

`npm run verify:release:risk -- <candidate>` is the planner-driven release executor. It preserves the exact-candidate boundary and runs or reuses only the gates selected by `verify:plan`: source-contract evidence, direct domain evidence, TypeScript, aggregate regression, production build, PostgreSQL full acceptance and browser-risk as applicable.

Release reuse is strict: candidate id, gate/evidence class, effective configuration and toolchain/config identity must match; browser evidence additionally requires matching selection/fixture/build identity, and build reuse requires the current `.next` output identity to match its ledger artifact. Use `--rerun` to bypass reusable evidence.

The release summary distinguishes `PASS`, `FAIL`, `NOT RUN` and `N/A`, includes the required behavioral evidence matrix, and writes one candidate-bound `release-risk` ledger. `scale=true` is accounted for by the canonical PostgreSQL **full** suite, which contains the registered scale tests. The command stops before later expensive gates after a blocking/failing prerequisite.

`npm run verify:release` is intentionally unchanged and remains the static compatibility full path.

0E.4d exact closeout candidate `7a8a98a587d0c2c80bac893ca0c50b24e86f06f0` passed development-pipeline **109/109**, planner with no blocked evidence, fast iteration **222/222** with release correctly reported as **NOT EVALUATED**, then authoritative `verify:release:risk` with aggregate regression **1404/1404 PASS**, production build **41/41 PASS**, PostgreSQL full **99/99 PASS**, browser-risk **41/41 PASS** (21 desktop + 20 mobile), scale N/A and final `release_status=PASS`. Source/domain/typecheck were reused only from the exact matching candidate.

### Phase 0E.5 verification hardening — DONE / VERIFIED

0E.5 adds negative and freshness regression coverage around the already-frozen 0E.4 command semantics. It does not introduce a new command or broaden release authority.

The hardening contract is fail-closed:
- dirty tracked or untracked work outside an explicit candidate changes candidate identity;
- generic ledger reuse rejects schema, candidate, gate, evidence-class, exit/evaluation and effective-configuration drift;
- build reuse also requires the currently present production-build identity to match the recorded artifact;
- browser-risk reuse additionally requires exact planner selection, verification-config identity, toolchain identity, fixture-contract identity, candidate-bound build ledger and current build output;
- testability seams may inject comparison artifacts in unit tests, but omitted options preserve the canonical filesystem/ledger behavior used by real verification commands.

Exact candidate `68351c78a0dac2b1f95de3530d2ceac116f2475e` closed with development-pipeline **113/113 PASS**, planner no blockers, fast iteration **226/226 PASS** + TypeScript PASS, aggregate regression **1408/1408 PASS**, production build **41/41 PASS**, browser-risk **41/41 PASS** (21 desktop + 20 mobile), PostgreSQL/scale N/A and final `release_status=PASS`.

### Phase 0E.6 manual workflow alignment — DONE / VERIFIED

Manual cloud workflows remain independent diagnostics only. `Verify FlyTally web` keeps targeted/full unit and optional PostgreSQL reproduction; `Browser smoke` keeps the legacy repository-wide browser diagnostic. Neither workflow invokes `verify:release:risk` or `verify:browser:risk`, so cloud diagnostics cannot silently acquire candidate-bound release authority. Workflow/job labels must make that distinction explicit.

Fixed-head 0E.6 verification on `734473252fe1acf64388fa15d9373777112d4977` passed targeted historical workflow-label tests **9/9**, then `verify:release:risk` returned source PASS, domain N/A, TypeScript PASS, aggregate **1408/1408 PASS**, production build **41/41 PASS**, PostgreSQL/scale/browser N/A and final `release_status=PASS`. The preceding `088aa71c...` attempt remains recorded as an intentional fail-closed catch of two stale label assertions.

### Phase 0E.7 exact-candidate closeout — DONE / VERIFIED

The first 0E.7 cumulative attempt from Phase 0D head `686734911f5c3f45e395fdda6b7d98a5021e84ae` correctly returned **NOT RUN** before execution because that historical candidate includes `e2e/ui-audit-capture.spec.mjs`, an explicitly diagnostic-only spec that intentionally has no authoritative browser target. The selector remained fail-closed and that diagnostic spec was not promoted into release authority.

Final Phase 0E closeout used verified 0E.5 head `68351c78a0dac2b1f95de3530d2ceac116f2475e` as base and exact head `335704c1125ee0336528f5f1e43c3bc1528c92d3`, candidate `221190494ba79b32bb25f9e32c3ce09041dfd624f3f3a514cc8fb7a905c9477a`. `npm run verify:release:risk -- --base 68351c78a0dac2b1f95de3530d2ceac116f2475e --force-all` completed with source-contract **226/226 PASS**, domain N/A, TypeScript PASS, aggregate regression **1408/1408 PASS**, production build **41/41 PASS**, PostgreSQL full **99/99 PASS**, scale PASS, browser-risk **41/41 PASS** (21 desktop + 20 mobile, one worker), no blocked evidence and final `release_status=PASS`. The legacy repository-wide 94-case browser command remained diagnostic-only / NOT RUN.

### Phase 0E final documentation reconciliation — VERIFIED

Documentation-only candidate `dc3edcbb35b218aa2aceccafd139cf8187c86b0d3f8318937865f75a6694c732` on exact head `2969fae73e151044f0a2e6962d7abd57e8983da9` passed `verify:release:risk` with no required evidence or blockers; source/domain/typecheck/aggregate/build/PostgreSQL/scale/browser were all correctly N/A.

### Phase 0F hygiene and Phase 0 closeout — DONE / VERIFIED

Phase 0F was documentation/repository hygiene and final Phase 0 closure only. Executable tooling was reconciled with docs, stale PR/branch state was inspected conservatively, exact verification evidence was retained, and ROADMAP / FEATURES / CHANGELOG consistency was reviewed. No product runtime or timezone semantics changed.

Initial 0F discovery confirms the documented verification command surface matches `package.json`. Seven branch heads are direct ancestors of `main`; no branch was deleted, and `chore/pre-f3-integration-anchor` remains intentionally retained as the recorded F3 rollback anchor. Explicit supersession was then proven for the five stale parallel PRs: #187 was replaced by merged #188/F0.1, #201 by merged #200/F1.4, #206 by merged #207/F2.2, and #231/#232 by the final F3.3/F3.4/F3.5 stack already ancestral to `main`. Those five PRs were closed without merge; their branches remain intact. PR #255 merged into canonical `main` as `2238d0e1a645a4f9b584b291ecc12fbf8a2ee230`.

Final Phase 0F verification used exact head `68ba83167c27e6de1e1027e007ea3b81acad17cc`, candidate `792ef0f2c8430a01f4bb1e24474b05991d0a83abee63650b7d72b8cb274892df`: `release_status=PASS`, all behavioral/heavy gates N/A, required evidence none, blocked evidence none. Phase 0 is therefore DONE / VERIFIED and integrated into canonical `main`. Phase 1 discovery/design may proceed; runtime implementation remains blocked until its timezone semantics contract is explicitly frozen and reviewed.




