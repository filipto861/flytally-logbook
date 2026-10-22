# Logbook PostgreSQL scale investigation — 22 Oct 2026

**STATUS: INVESTIGATION / DRAFT / NO RELEASE PASS.** Separate from portable Windows workflow core PR #384. This branch is based on `chore/local-windows-workflow-core-20261022`. The historical mixed PR #383 is superseded for implementation but retained as an evidence log.

## Frozen facts

Owner Windows Node24 with physically verified native PG16 localhost `127.0.0.1:55439/flytally_logbook_test`, three scale fixtures (10k / 50k / 100k):
- Prior standard full PG suite, 42 test files: **163 cases, 121 PASS, 3 FAIL, 39 SKIP**. Failures involved 50k Flight List, 50k Pilot Insights and 100k Flight List.
- Serial scale run #1: 12/13 PASS, 100k list 4983.786ms against strict 4500ms.
- Serial scale run #2: 12/13 PASS, 50k list 2961.006ms against strict 2500ms, 100k list 2273.375ms PASS.
- Serial scale run #3: 12/13 PASS, 50k list 1386.774ms PASS, 100k list 2354.123ms PASS, **100k Pilot Insights Career 4250.504ms > strict 4000ms FAIL**.
- A 26/26 portable safety test PASS was observed on the historical mixed branch SHA `f2643ca5c1c6fe1d7e70c94e1deaca2cb2eb0728`. These checks have **not** yet run at the new research head.

## Code and evidence

`tooling/run-postgres-tests.mjs` gains optional `scale --serial` for only the three registered scale files; `tooling/local-workflow.mjs` and `package.json` expose `npm run test:db:scale:local` under the same strict owned-local preflight. Test-only v169 and v230 files log bounded/sanitized EXPLAIN (ANALYZE, BUFFERS) operator metadata on 50k and 100k Flight List fast/slow runs. Dedicated historical v20 restore tests demand their own explicit opt-in; generic integration must never silently authorize that separate fixture.

Last owner EXPLAIN run:
- 50k first-page flight list: WindowAgg over 50,000 rows, top-N Sort to 50, materialized CTEs (`b`, `scoped`, `classified`, `costed`); root ~7868 temp reads / 6809 temp writes blocks, execution 1386.774ms PASS.
- 100k: WindowAgg over 100,000, top-N Sort to 50; root ~16158 temp reads / 13643 temp writes, execution 2354.123ms PASS.

Node times are inclusive and **must not be summed**. Spills/materialization are observed but not yet proven to cause intermittent budget overages. Earlier parallel-suite contention can contribute, but later serial variance disproves it as the sole explanation.

## Boundaries and next step

**DO NOT** increase time limits, retry tests until green and call it acceptance, alter production SQL/schema/indices on this evidence alone, connect to remote DB or reset the owned fixture. Strict original full PostgreSQL gate, release planner and Browser U3 scope stay authoritative. No deployment, merge, production migration/restore or feature-flag action.

**Next:** obtain independent read-only DeepSeek/Claude review of the exact query plans and regression semantics before a narrowly scoped optimization proposal; no new repeated full-suite run merely to chase timings. Capture exact SHA-based owner tests once the plan is frozen. Do not count this research as release PASS.
