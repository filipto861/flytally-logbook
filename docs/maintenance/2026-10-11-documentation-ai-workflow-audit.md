# FlyTally Logbook — documentation integrity + AI workflow review

**Inventory date:** 11 October 2026  
**Canonical repository:** `filipto861/flytally-logbook`  
**Source baseline:** `main@19bd8419f1648b335603f3f1d8ba90f97a2df3f4` (after narrow correction [PR #311](https://github.com/filipto861/flytally-logbook/pull/311)).  
**Status:** D0 inventory/read-only analysis COMPLETE; **overall semantic assurance PARTIAL**; proposed reorganization and AI workflow **AWAIT INDEPENDENT DEEPSEEK REVIEW AND OWNER DECISION**. This document does **not** authorize broad refactors or a separate product release. `flytally-training` stays out of scope.

## 1. Verified inventory and boundaries

- Recursive GitHub tree at baseline: **123 Markdown files** totaling **1,925,473 bytes** (approximately 1.9 MB), including six root Markdown files, 116 under `docs/` and one `data/AIRCRAFT_TYPES_SOURCE.md`. `docs/product/` accounts for 70 files, `docs/history/` 23, `docs/compliance/` 7, `docs/certification-readiness/` 9, `docs/maintenance/` 4.
- Root `CHANGELOG.md` approximately 250 KB; `DEVELOPMENT.md` approximately 40 KB. `DEVELOPMENT.md` intermixes current candidate-based commands and Phase 0B/0E/0F verification history. This is an **information-architecture/cognitive-load issue**, not evidence that its executable commands are incorrect.
- Existing authoritative contract: actual runtime/schema/tests and deployment evidence first, followed by `ROADMAP.md` (work order/frozen decisions), `FEATURES.md` (capabilities), `CHANGELOG.md` (actual changes), `ARCHITECTURE.md`, `DEVELOPMENT.md`, active design/contracts and historical milestone documentation. Product version `3.7.0` was owner functionally accepted and deployed on 11 October 2026, with external map-provider rights separately unverified. Next product milestone remains `3.8.0` Currency.
- All 123 Markdown files were scanned for **ordinary inline relative Markdown links only**, and candidate targets compared to GitHub's current tracked path tree. **71 local relative occurrences** were found with this parser; **nine unresolved links** were in *two immutable history snapshots* (`docs/history/FEATURES_BEFORE_2026-10-10_CANONICAL_CLEANUP.md`, `docs/history/ROADMAP_BEFORE_2026-10-10_CANONICAL_CLEANUP.md`), mainly because old root-relative paths no longer resolve from `docs/history/`. Another URL-encoded API-path example under a dated maintenance record requires percent-decoding and resolves correctly; it is not a missing target. No unresolved matching links found in active root, docs index or current product docs. **Limits:** not a parser for all Markdown forms, reference-style links, HTML, URL anchors, external websites or semantic contents; no claim that *all possible* links and files are valid.
- Two definite cross-document drift errors were corrected in **PR #311**: root README still described `3.6.0` / unfinished `3.7.0`, and `docs/README.md` suggested retired R1/R2 refs remained. Keep their original *dated audit snapshots* unchanged.
- PR #311 also fixed a confirmed **extra backslash** in `tests/versioning-governance.test.ts` that made the footer-source regex fail to match `components/app-shell.tsx`. The pre-fix and post-fix RegExp were compared to actual repository source: **before mismatch, after match**. Full `node --test` / local `npm run test:target` **NOT RUN** via connector; do not report that it passed.

## 2. Classification and drift matrix

| Documentation class | Examples | Proposed authority | Defect/risk to address |
| --- | --- | --- | --- |
| Current, authoritative | `ROADMAP.md`, `FEATURES.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `docs/product/VERSIONING.md` | Actively maintained; compact and explicit | Version/status duplicated in several files can go stale; keep each fact owned by one contract |
| Append-only shipped history | `CHANGELOG.md` | Full immutable factual chronology; small current index/summary permitted | ~250 KB makes AI context and cross-version retrieval expensive; **no destructive truncation** |
| Product/milestone evidence | `docs/product/3_4_0_*`, `3_5_*`, `3_6_0_*`, `3_7_0_*`, `FLIGHT_ENTRY_*`, `UI_UX_SIMPLICITY_*` | Dated baseline, effectivity, superseding link | Old local Draft/NOT RUN/blocked text can be mistaken for current state; avoid mass replacement |
| Historical snapshots | `docs/history/ROADMAP_*`, `FEATURES_BEFORE_*` | **Preserve content verbatim** as audit evidence | Relative links are invalid after relocation; annotate in index or add navigation, not rewrite history silently |
| Security/regulatory records | `docs/compliance/`, `docs/certification-readiness/` | Retain legal/regulatory provenance, approval boundary explicit | Engineering evidence must not imply authority approval |
| Maintenance audits | `docs/maintenance/` | Dated snapshots; new status via top-level superseding notes | Historic open PRs/branch counts differ from today **by design** |
| AI reviewer handoffs | Current `docs/product/*REVIEW_HANDOFF*` and conversations | Dated review input, not current instruction | Reusing old handoff leads to stale assumptions, repeated reviews, roadmap drift |

## 3. AI development efficiency — preliminary diagnosis

Observed current strengths (preserve):
- Explicit `main` authority and SHA/PR/deployment provenance; fail-closed aviation/regulatory/data semantics; owner decisions and frozen constraints; isolated Logbook and Training repos.
- Candidate-first `npm run verify:plan`, `verify:iterate`, `verify:release:risk` and `tooling/development-modules.json` registry. Source/domain/typecheck are cheap lanes and costly PostgreSQL/Playwright gates run according to declared risk; local evidence stays distinct from GitHub Actions CI.
- `tooling/vercel-ignore-build.mjs` intentionally skips build for development-only changes (including Markdown/docs/tests) while enforcing actual build for package/runtime/config changes; this policy is source-verified. Do not replace it with blanket mandatory full CI.
- Independent DeepSeek/Claude review for high-risk contracts, performed *after* discovery + draft design but *before* expensive implementation.

Observed friction/failure modes:
1. AI may ingest huge dated histories instead of a short, authoritative, **SHA-bound current state**; this increases token cost and obsolete decisions being revived.
2. Same release status appears in README, ROADMAP, FEATURES, docs index, versioning policy, milestone acceptance and CHANGELOG; a correct release still left an incorrect README.
3. One source-contract assertion used a brittle regular expression, was not run with the release candidate, and drifted. Need a cheap machine-enforced version/document consistency boundary without pinning ephemeral roadmap prose to rigid regexes.
4. Documentation PRs can repeatedly update historical “now current” language; preserve the earlier facts and prepend a clearly dated superseding decision rather than rewriting history.
5. Independent reviewer handoffs can expand into open-ended design consultations without a fixed decision surface, evidence ledger or acceptance criteria.

## 4. Proposed target structure — NOT YET APPROVED

Prefer **minimal navigation and single ownership**, not another large documentation layer:
1. Keep root `README.md` a brief entrypoint with links; `ROADMAP/FEATURES/CHANGELOG/ARCHITECTURE` retain distinct responsibilities, not duplicate full milestones.
2. Keep `DEVELOPMENT.md` as **short active operator/AI workflow**: branch policy, scope classification, risk gate matrix, DB security, merge/deploy/rollback and source hierarchy. **Archive the chronological Phase 0E/0F verification story with line-preserving provenance**, leaving a stable reference and links. Do not change commands/flags unless independently checked against actual `package.json` and `tooling/`.
3. Consider a **single short `AGENTS.md` entrypoint** applicable to ChatGPT/DeepSeek/Claude tools (repo scope, authority order, fail-closed, strict release evidence and links). Avoid copying 100s of lines from project instructions; actual runtime/doc contracts remain authoritative. Establish tool compatibility before adopting.
4. Add a **stable AI review/handoff template**, with: repo+main SHA, owner decision, scope & non-goals, current phase/last completed/next gate, paths/contracts, frozen decisions, risk, tested/not-run, DB/deploy and a **bounded list of reviewer questions**. Default reviewer read-only; independently compare and reconcile; no reviewer becomes authority.
5. Add **cheap docs consistency validation** (possibly `tooling/check-documentation.mjs` + Node unit tests): current version source agreement and directory/link checks, explicit distinction between immutable snapshots and live documentation, no fragile text anchors that make future releases difficult. First implement as read-only/report mode on an isolated feature branch, then decide whether to enforce on PRs.
6. Use two workflow lanes: **documentation/governance-only** (index, links, source checks; no SQL/Playwright/Next unless configuration/runtime changed) versus **behavioral/risk-based release** (targeted tests, exact candidate, correctly selected unit/DB/browser/production smoke). No blanket test reduction, arbitrary retry suppression or CI PASS fiction.
7. For each meaningful milestone enforce the same closeout: actual implementation + verified tests + ROADMAP / FEATURES (only if capability changes) / CHANGELOG reviewed, plus explicit exceptions and next step. Use one durable small handoff at chat change.

## 5. Proposed roadmap for independent review

| Phase | Goal | Acceptance / evidence | Status |
| --- | --- | --- | --- |
| DOC-0 | Inventory current `main`, classify and surface drift; correct critical obvious factual mismatches | 123-file inventory, bounded link check, concrete README/index/version assertion diff; no broad rewrite | **AUDIT COMPLETE; trivial fix merged #311** |
| DOC-1 | DeepSeek independent read-only critique of this audit and proposed architecture | Written verdict, prioritized counterexamples, missing evidence, revised minimal docs/test design | **WAITING REVIEW** |
| DOC-2 | Owner approves frozen documentation taxonomy, ownership and AI roles | Scope/non-goals, file disposition (keep/link/annotate/archive), acceptance gates, backwards compatibility | **PENDING** |
| DOC-3 | Small docs batches (current active contract; archive with references) | No historical data deletion, relevant relative links valid, current status consistent; targeted diff verified | **NOT STARTED** |
| DOC-4 | Optional machine checks / workflow enhancements | Actual registry evidence, Node targeted unit tests and seeded negative cases; no DB/production change; safe rollout | **NOT STARTED** |
| DOC-5 | Final read-only repo/docs audit and owner approval | Current status/provenance/links/test ledger, README entrypoint, CHANGELOG and exact next 3.8.0 milestone coherent | **NOT STARTED** |

No new product version number assigned to this docs/governance quality phase. This work should be completed before deeper 3.8.0 implementation unless the owner reprioritizes.

## 6. Verification, change and safety record

- GitHub canonical baseline as identified above; no use of `flytally-training`.
- This document is **analysis and proposal only**, not a claim of full semantic correctness of 123 documents.
- Runtime, server auth, third-party map API, flight/certification/recency, DB schema, production flags and deploy untouched in this audit. External Esri/openAIP rights remain separately **UNVERIFIED**; do not falsely close those by documentation cleanup.
- Tests/build/Playwright/DB/CI for this docs-only audit: **NOT RUN / N/A**. The narrow version assertion correction has a verified direct RegExp match; a complete Node suite was **NOT RUN**.
