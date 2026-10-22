---
name: testing-quality
description: Apply to regression testing, risk-scoped candidate verification, automated browser and PostgreSQL tests, performance benchmarks, accessibility checks and reliable test evidence.
---
# Testing and Quality Assurance

## When to load
Planning or executing tests, reviewing coverage and quality claims, modifying checks, troubleshooting CI/Playwright, or finishing any substantial change.

## Procedure
1. Resolve exact main/base/work SHA and changed paths. Run the current module scope/candidate planner; do not assume old command counts, risk groups or archived status are current.
2. Separate fast iteration tests from the authoritative candidate release gate. Current commands and selected risk requirements are in DEVELOPMENT.md and package.json, not in this skill.
3. Cover positive, invalid, ambiguous, boundary, concurrency, permissions and data-absence behavior. For UI include keyboard, focus, loading/duplicate submit, screen-reader semantics and responsive layouts.
4. Use realistic, synthetic, schema-backed worst-case fixtures. No raw customer names, private flight logs or GPS tracks. Prefer realistic Unicode/long names/empty lists rather than arbitrary gibberish.
5. Playwright must use the repo-locked runner. Browser fixture must fail closed on DB mismatch. Chrome touch emulation is NOT native iPad Safari.
6. Preserve diagnostic failures, do not turn an unrun gate into PASS or blanket N/A. Source count, Node tests, TypeScript, build, isolated PostgreSQL, scale, browser and production smoke are distinct evidence categories.
7. Report exact command, candidate SHA, date, environment, passing/failing counts, reusable evidence identity, remaining unverified gates and true next action.

## Hard stops
Never run destructive tests against Neon/staging/production. No manual printout of PASS in lieu of command exit evidence. Do not weaken thresholds or test checks solely to get a green result.

## References and verification
DEVELOPMENT.md, tooling/development-modules.json, package.json scripts and test suites are authoritative. Add minimal tests for the touched contract; full-suite/risk gates only as selected for the exact candidate.