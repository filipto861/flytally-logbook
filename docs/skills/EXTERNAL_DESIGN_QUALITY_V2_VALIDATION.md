# FlyTally Design Quality V2 — acceptance and evidence

**2026-10-24 | scoped review proposal** for `filipto861/flytally-logbook`, base `main@5e75b68c42a3a0697a2ff395e6c4eb4d35eb89bc`.

## Changes and non-changes
- Targeted external-design guidance: `.agents/skills/ui-quality-audit/references/EXTERNAL_DESIGN_QUALITY_V2.md`, task routing via existing UI audit skill/registry/AGENTS, third-party source attribution, two advisory npm commands, isolated scanner fixtures and Project Memory.
- Existing Apple Design V2, design-engineering/Emil, mobile/iPad and UI/UX specialists are reused. Hallmark (audit/study), UI UX Pro Max/Kombai (reference), Vercel Web Interface Guidelines (review), shadcn/ui (component study) are **not installed or automatically executed**.
- **No modifications** to `app/`, `components/`, `lib/`, `sql/`, `data/`, `e2e/`, `vercel.json`, `package-lock.json`, core test framework, app styling, dependencies, feature flags, GPS, database targets, certification or FlyTally Training.
- Added `tooling/design-quality-audit.mjs` is explicitly read-only, no network or DB, and cannot establish UI quality, WCAG compliance, or absence of bugs. By default, never block a release on static warnings alone.

## Verification states
- GitHub verified exact base SHA prior to branch creation and read the current Apple Design skill, registry, architecture, design-language and handoff rules.
- The exact proposed scanner blob `9eb77c263a30bbb94603032df5279cc16dea6eec` and fixture blob `3d2a890ba2144eb9bfea9084c4f871d233fc0323` were fetched from the work branch and exercised in the ChatGPT JS isolate after removing import/export wrappers: parsed source and **6/6 logical fixture cases PASS**. **This is NOT an executed Node module or a full FlyTally test run.**
- `npm run test:design-audit`, `npm run audit:design`, full repository checks, `npm run verify:plan`, app build, TypeScript, existing Node suite, Playwright, PostgreSQL, native Safari/iPad, visual screenshot inspection, production smoke: **NOT RUN**.
- `npm run audit:design` is an *advisory* source sweep of `app/` and `components/`; `--json` outputs structured findings, `--strict` intentionally fails when any heuristic finding exists (not a default gate). False positives and ordinary legacy CSS are expected; do not auto-fix.

## Suggested review in a complete owner-local checkout
Run from the repository root on a clean, isolated work branch (no DB connection required for these two commands):

```powershell
npm run test:design-audit
npm run audit:design -- --json
npm run scope:changed -- .agents/skills/ui-quality-audit/SKILL.md tooling/design-quality-audit.mjs package.json
```

Capture exit codes and review candidate-specific findings. Do **not** substitute these for canonical `DEVELOPMENT.md` evidence on future UI changes. For real design audit, use the existing browser-risk runner with a verified owned disposable PG16 database and required additional exact-candidate gates. No automatic deployment or merge.

## Acceptance and owner gate
A reviewer verifies the PR changed paths, applicable Markdown links, existing skill priority and FlyTally brand integrity, confirms the scanner is read-only and that the Node fixtures pass. Owner separately approves a squash merge only after PR review. No production deployment, DB operation or redesign authorization is inferred.
