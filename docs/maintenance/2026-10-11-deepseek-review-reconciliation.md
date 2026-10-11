# DeepSeek independent review — source-backed reconciliation

**Date:** 11 October 2026  
**Repository:** `filipto861/flytally-logbook`  
**Source baseline for actual independent review:** `main@19bd8419f1648b335603f3f1d8ba90f97a2df3f4`  
**Review proposal:** [Draft PR #312](https://github.com/filipto861/flytally-logbook/pull/312), exact reviewed head `21dd9006d1628a1ad2163f6b2017c42c4154e194` **before this reconciliation was added**.  
**DeepSeek verdict:** **APPROVE WITH CHANGES**, conditional because DeepSeek did not have live GitHub PR access. Review supplied by product owner.  
**ChatGPT reconciliation status:** **INDEPENDENT REVIEW RECEIVED AND ACTUAL REPO VERIFIED; TARGET ARCHITECTURE AND IMPLEMENTATION PENDING OWNER FREEZE.**

## 1. Dispositions and evidence

| Reviewer point | Decision | Exact evidence / qualification |
| --- | --- | --- |
| Actual PR #312 diff unavailable, block final approval until read | **Resolved — narrow draft verified** | Direct GitHub compare against `main@19bd8419`: 5 Markdown-only changes (CHANGELOG, ROADMAP, docs index, two new docs/maintenance files), 5 ahead/0 behind, no application/runtime/tests/database changes, no historical deletion. Link check across PR changes: 51 relative links checked, 0 unresolved. This removes **diff visibility** blocker but is **not owner approval** of the proposed future refactor. |
| Release status duplicated | **ACCEPT** | Current `README.md`, `ROADMAP.md`, `FEATURES.md`, `docs/product/VERSIONING.md` all carry 3.7.0 current status; duplication caused actual README drift fixed by PR #311. Current status ownership should be ROADMAP; numeric package version source is package.json, actual deployed SHA/alias truth is Vercel. Date-specific records stay in CHANGELOG and milestone acceptance. |
| DEVELOPMENT.md too long/mixed | **ACCEPT** | 442 lines / about 40 KB with current operator policy + prior Phase 0B/0E/0F timeline. Historical phase body should stay verbatim as linked evidence; active commands must be verified against actual package scripts and tooling before extract/rewrite. |
| Registry v2 vs schemaVersion/version 3 | **RECLASSIFY — dated fact, not contradictory active configuration** | `DEVELOPMENT.md` says *Phase 0B.1 uses registry version 2*; current `tooling/development-modules.json` has schemaVersion 3/version 3. The statement is within an earlier milestone narrative, not a present claim that the registry is v2. Add explicit historical heading, do not falsify original history. |
| 368/381 historical ownership vs registry auditedTotal 391 | **RECLASSIFY — historical snapshot, current ownership percentage NOT independently measured** | Dated 0B.2 ownership sentence records 368/381 at that phase; current registry's `ownership.auditedTotal` is 391, `ownership.baselineStableOwned` 121, `ownership.minimumStableCoverage` 0.9. These are different baselines. Do not recalculate current stable coverage from the historical 368 numerator. |
| 0E.4a browser executor “not active yet” vs completed 0E.4c/0E.4d | **RECLASSIFY — milestone chronology** | Early “not yet” is scoped to 0E.4a; subsequent sections explicitly document complete execution and closeout. Make chronology visibly historical, not editable current workflow guidance. |
| VERSIONING duplicates ROADMAP forward targets | **ACCEPT WITH PROVENANCE** | `docs/product/VERSIONING.md` section 7 duplicates current roadmap targets through 3.10.0; after owner approval move canonical release order to ROADMAP, retain numbering policy and historic renumbering decisions in VERSIONING. Do not silently erase 9 October 2026 decision provenance. |
| AGENTS.md may introduce second policy | **ACCEPT, OPTIONAL** | If adopted: stable short onboarding/navigation and immutable safety/boundary rules, no dynamic version/status or duplicate test instructions. Validate with actual AI tools and existing project instructions before adding. |
| Cheap docs checker | **ACCEPT WITH GUARDRAILS** | First report-only, active links and package-lock consistency, separate history warning; include negative tests, fail-closed code safety, no DB/browser/build. Avoid matching arbitrary prose/roadmap rows; account explicitly for `3.8.0` candidate branches where package version differs from deployed baseline. |
| CHANGELOG huge | **ACCEPT; preserve append-only** | Current ~250 KB. Retrieval by headings/ranges instead of loading full file; history stays canonical in same file, no destructive truncation or renumbering. |

## 2. Proposed exact division of authority — owner approval pending

- `package.json` = source for **target package version**; `package-lock.json` must agree on release candidate.
- Runtime/deployed Vercel SHA + alias = **shipped deployment evidence**; build READY alone is not authenticated UX/flight integrity proof.
- `ROADMAP.md` = **current release/workstream status, owner decisions, ordering/next action**; no detailed historical PASS log.
- `FEATURES.md` = current implemented/planned capability inventory; link to ROADMAP for release state rather than duplicating “current version / deploy SHA”.
- `CHANGELOG.md` = immutable chronology of actual merged/deployed actions, historical PASS/FAIL and exception descriptions; read selected headings, not the full file by default.
- `ARCHITECTURE.md` = current invariants, canonical data rules, auth/regulatory/recovery boundaries.
- `DEVELOPMENT.md` = actionable commands, exact-candidate evidence, branch/PR/DB/smoke policy; earlier Phase 0B/0E/0F milestone narrative archived *verbatim*, with original provenance, stable link and no data loss.
- `docs/product/VERSIONING.md` = MAJOR.MINOR.PATCH numbering and separate schema/payload/backup counters; ROADMAP owns forward release order.
- `README.md` and optional `AGENTS.md` = entrypoint links only; no duplicated active release status.
- `docs/product/`, `docs/history/`, `docs/maintenance/`, `docs/compliance/` = dated evidence, snapshots, audits and external-rights limits respectively; older text **does not override** live contracts.

## 3. Proposed AI workflow and reviewer protocol

**New chat:** first source-current repo SHA + ROADMAP + FEATURES + relevant ARCHITECTURE / DEVELOPMENT section + latest small verified handoff; targeted CHANGELOG headings and milestone/source files only if related. Reconstruct last complete, current/next, frozen decisions, test/DB/deploy before coding. Never treat previous summaries as stronger than actual current main.

**Single lead + independent challenge:** ChatGPT does repo discovery, writes one bounded design/roadmap and coordinates implementation. DeepSeek reviews read-only **once** for high-stakes changes (model/schema/migration, certification/recency/auth/security, complex performance, recovery/export, irreversible cleanup, release governance or broad documentation architecture). DeepSeek response includes precise source and severity. ChatGPT reconciles into ACCEPT / REJECT with evidence / DEFER. Owner resolves genuine product choices. A second reviewer loop requires material new evidence.

**Small PR discipline:** one scoped milestone, exact candidate SHA, owned paths, Do/Do Not, tests required and actually run, DB/production decisions, docs updates; never claim local PASS equals CI. Documentation-only PRs run cheap docs/static check; runtime PRs use existing risk-based planner/targeted tests, preserving release risk policy and unverified evidence as NOT RUN. Never auto-apply missing weather/aircraft performance/recency facts.

## 4. Proposed milestones — to be frozen before implementation

| Milestone | Scope | Acceptance gate | Restrictions |
| --- | --- | --- | --- |
| DOC-1 | Canonical status ownership, trim volatile release/version duplication in README/FEATURES/VERSIONING without losing dated decisions | Manual compare package/lock, Vercel evidence and ROADMAP; no fact lost, relative links valid | No CHANGELOG/history deletion, no product change |
| DOC-2 | Extract Phase 0B/0E/0F milestone chronology from DEVELOPMENT into archive; short current operator playbook | Line-by-line provenance/diff for archived material, commands verified against package/tooling; targeted docs checks | No silent flags/command changes or expired state quoted as current |
| DOC-3 | Optional short AGENTS.md + one SHA-bound reviewer handoff template | Explicit role boundaries, no volatile status, one-review rule; owner choice | No duplicate master policy; Training separate |
| DOC-4 | Report-only docs checker, later enforcement choice | Unit tests with broken links, encoded paths, historic exceptions, package version changes and 3.8 candidate case; docs-only path avoids DB/build/Playwright | No brittle prose regex, no static “must be 3.7.0” assert, no automatic production call |
| DOC-5 | Final live-doc drift audit and operator handoff for 3.8.0 | Read-only current doc-to-code comparison; ROADMAP, FEATURES, CHANGELOG indexed; owner decision and test statuses explicit | No 3.8.0 implementation until governance closeout or explicit reprioritization |

**This is a design for owner approval, not a frozen decision or a completed implementation.** 3.7.0 production remains shipped. Esri/openAIP contractual rights unverified/owner-deferred: no implicit approval.

## 5. Decisions requested from owner

1. Use **ROADMAP as the single current release/workstream status owner**, with package as numeric candidate source and Vercel as deployed-source evidence.
2. Keep `CHANGELOG.md` append-only; extract dated DEVELOPMENT chronology verbatim into `docs/history/`, leaving active DEVELOPMENT as a short operator guide.
3. Add a **short pointer-only AGENTS.md** and an independent-review handoff template, or choose not to add AGENTS.
4. Start a **report-only** docs consistency tool, with owner approval required before making it merge-blocking.

Until these are settled, PR #312 is merely a documentation audit/review record and no larger transformation should be merged.
