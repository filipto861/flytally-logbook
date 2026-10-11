# DeepSeek independent reviewer — FlyTally Logbook documentation & AI development optimization

**ROLE:** Independent senior repository/documentation/AI-workflow reviewer. **READ-ONLY.** Do not implement, create files/branches/PRs, rewrite historical evidence or alter production. Return a critique/reconciliation, not a generic best-practices essay.

## Context and verified baseline (11 October 2026)

- Repository: `filipto861/flytally-logbook`, canonical `main@19bd8419f1648b335603f3f1d8ba90f97a2df3f4` after correcting known entrypoint/version-test drift in [PR #311](https://github.com/filipto861/flytally-logbook/pull/311). `flytally-training` is **another repo**; it must not be changed as part of this work.
- Product release `3.7.0` is **DONE/PRODUCTION**: owner-reported functional acceptance, version `package.json=3.7.0`, Vercel `READY` at application commit `39ee01b7`, deployed on `fly-tally.com`; source and exact deploy evidence in current ROADMAP/CHANGELOG. The next product phase is `3.8.0` Currency (#136).
- Unresolved map-provider Esri/openAIP contractual rights, redistribution/export and currency/coverage/quotas are **UNVERIFIED**; not approved. Do not turn the docs-governance review into an unrelated licensing or runtime refactor. Aviation/regulatory facts, certified records, auth, migrations and operational source data must remain evidence-first / fail-closed.
- Documentation tree: **123 Markdown files**, ~1.9 MB; root `DEVELOPMENT.md` ~40 KB, `CHANGELOG.md` ~250 KB; `docs/product/` 70, `docs/history/` 23. Read-only scan found nine broken ordinary relative links in two *verbatim relocated historical snapshots*, no matching missing target in active root/current product docs; scan does not cover every possible Markdown/external-link form.
- Verified drift fixed in #311: root README had falsely said current product was 3.6.0 and 3.7.0 only partially deployed; docs index said now-deleted Satellite branch refs were retained. `tests/versioning-governance.test.ts` also contained an extra `\` escape in a regex asserting `components/app-shell.tsx` footer source: direct comparison **before FAIL, after PASS**; full Node suite **NOT RUN** for the tiny correction.
- Existing workflow: `npm run verify:plan`, `verify:iterate`, `verify:release:risk` and `tooling/development-modules.json` explicit risk/evidence planning. Vercel intentionally filters docs/test-only builds. Local test outcomes do **not** equal CI. Historic preservation and branch/release SHA provenance are mandatory.
- Source of truth: actual code/runtime/deployment → `ROADMAP.md` (order/frozen decisions) → `FEATURES.md` (capabilities) → `CHANGELOG.md` (actual history) → `ARCHITECTURE.md` & `DEVELOPMENT.md` (contracts) → current supporting design and dated history. If conflicts exist, report/reconcile them before new coding.
- Current detailed audit draft for review: `docs/maintenance/2026-10-11-documentation-ai-workflow-audit.md` on branch `docs/ai-governance-audit-review-2026-10-11`. If GitHub inaccessible, use this brief and request the canonical file excerpts needed; **do not invent repo facts**.

## Proposed architecture to challenge (not approved)

1. Short README start-here; keep ROADMAP/FEATURES/CHANGELOG/ARCHITECTURE separate with **one owning location** for each type of current fact.
2. Make `DEVELOPMENT.md` a shorter active workflow, moving prior Phase 0E/0F historical milestones to a provenance-preserving archive and linking back. Do not change verified commands or remove historical decisions.
3. Consider a small `AGENTS.md` common onboarding pointer for ChatGPT/DeepSeek/Claude. **Do not** duplicate complete FlyTally project policy across multiple files; determine whether cross-tool portability justifies it.
4. Have one stable AI handoff/review template: repo, exact SHA, current/last/next, owner decision, scope/non-goals, frozen decisions, dependencies, test/DB/deploy state, uncertainties and bounded reviewer questions.
5. Add **cheap testable docs/versions/link consistency checks**, avoiding brittle hard-coded roadmaps, accidental CI or production touches. Preserve historical snapshot immutability; detect stale active README/status text, compare package/lock/current evidence, and distinguish candidate from shipped production.
6. Preserve risk-based local verification for runtime changes; docs-only gets docs/static checks. Never represent `NOT RUN` as `PASS`.
7. Run independent review only for high-risk design/data/regulatory/migrations/security/irreversible changes, **after** discovery and draft design and **before** implementation. Owner makes product decisions, ChatGPT coordinates/implements, DeepSeek independently critiques.

## Exact questions to answer

1. **Architecture:** Is the proposed document ownership hierarchy correct? Which *minimum* files should an AI read first, and how do we prevent expensive irrelevant context ingestion without hiding needed source evidence?
2. **No-history-loss consolidation:** Suggest a safe, backward-compatible `DEVELOPMENT.md` refactor and treatment of the large append-only `CHANGELOG.md`. Identify any archival strategy that might break GitHub links, reviewer traceability or old acceptance records.
3. **Automation:** Specify a minimal `check-documentation` contract (versions, links, current-vs-historic labels, source metadata). Which checks are safe to enforce automatically in a docs-only PR and which need semantic/manual review? How do we avoid fragile regex tests and false-positive snapshots?
4. **AI roles/tokens:** Is `AGENTS.md` worthwhile? Recommend the shortest robust AI-context/handoff format, exact trigger for DeepSeek independent review, and rules to prevent both assistants hallucinating state or endlessly reviewing each other.
5. **Verification:** How to ensure a version-only release still validates its newly changed tests without running unnecessary expensive DB/Playwright gates, while keeping the production acceptance and deployment evidence honest?
6. **Roadmap & migration:** Propose small phases/PR boundaries with acceptance criteria, explicit DO/DO NOT, test evidence, historical preservation and a practical rollback route. Identify decisions that require Filip rather than silent AI choice.
7. **Risks/counterexamples:** Challenge misleading assumptions and find any documentation/compliance/operational issues this plan misses. Clearly distinguish verified facts from hypotheses and any additional repo evidence needed.

## Required response format

- **Verdict:** APPROVE / APPROVE WITH CHANGES / BLOCK, with severity-ordered findings.
- **Source/evidence** for each finding: exact file, current/dated status, what is verified vs not verified.
- **Recommended minimal architecture and workflow** (owning docs, minimal read path, reviewer handoff, automation).
- **Prioritized roadmap**: up to 5 small milestones with dependencies, acceptance criteria, verification, DO/DO NOT.
- **Open owner decisions**, including explicit trade-offs. Avoid redundant suggestions or a wholesale rewrite.
- **No implementation.** We will reconcile your independent review against actual current `main` and Filip's final decisions before any broad change.
