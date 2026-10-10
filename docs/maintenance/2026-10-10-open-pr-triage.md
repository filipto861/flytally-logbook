# FlyTally Logbook — open PR and branch disposition (read-only review)

**Prepared:** 10 October 2026  
**Base:** `main@4e90cca2dbb7672a4598052a9b2ec12659d9f70a`, after canonical docs cleanup PR #301.  
**Scope:** `flytally-logbook` only. No merge, deletion, closure, deployment or runtime/db change is authorized by this document.

## 1. Resolution already completed

- Current-status docs [#298](https://github.com/filipto861/flytally-logbook/pull/298) merged as `4ae54a56`.
- Repository audit [#300](https://github.com/filipto861/flytally-logbook/pull/300) merged as `b5183c06`.
- Canonical docs [#301](https://github.com/filipto861/flytally-logbook/pull/301) merged as `4e90cca2`; original ROADMAP/FEATURES archived with identical Git blob SHA; CHANGELOG retains owner-reported backfill from #299.
- Conflicting documentation-only [#294](https://github.com/filipto861/flytally-logbook/pull/294), [#296](https://github.com/filipto861/flytally-logbook/pull/296) and [#299](https://github.com/filipto861/flytally-logbook/pull/299) closed without merge as superseded. Each has a reasoned comment and retains history/branch.
- **Ten open PRs remain:** #271–#279 and #281. Their current branches are old stacked snapshots, not clean patches against latest main.

## 2. Remaining open-PR risk inventory

| PR | What differs from current `main` | Safe disposition now |
| --- | --- | --- |
| [#271](https://github.com/filipto861/flytally-logbook/pull/271) | Pre-Satellite discovery and `3_7_0_PHASE2_SATELLITE_READINESS.md` (not in current main) | **RETAIN FOR REVIEW** — documentation-only, dated findings may remain useful. Decide whether to archive essential findings and close as superseded. Do not merge stale status text. |
| [#272](https://github.com/filipto861/flytally-logbook/pull/272) | Early R1 Satellite map selector, UI and tests. Concept has since been ported and released through #285, not by merging R1 stack. | **RETAIN FOR DIFF REVIEW** — treat R1 as a superseded deployment path, verify unique design/tests/Story behavior first. |
| [#273](https://github.com/filipto861/flytally-logbook/pull/273) | Separate hardening of Story PNG tile completeness/export errors, test fixtures and feedback | **RETAIN — potentially unported runtime behavior**. No evidence it was included in #285 or current main. Needs dedicated functional comparison; do not dismiss as a duplicate. |
| [#274](https://github.com/filipto861/flytally-logbook/pull/274) | R2 session/auth privacy gate; later standalone production security fix #282 addresses the critical access boundary | **RETAIN FOR EXACT SECURITY DIFF** — similar intent is not proof of byte-equivalent implementation. |
| [#275](https://github.com/filipto861/flytally-logbook/pull/275) | Isolated provider composition/helper `lib/satellite-map-provider.ts`, deterministic fallback/source tests; **file absent from current main** | **KEEP** pending provider entitlement and architecture review. Not part of current release. |
| [#276](https://github.com/filipto861/flytally-logbook/pull/276) | `tooling/verify-satellite-http.mjs` and isolated fixture, **both absent from main** | **KEEP** as unique offline HTTP integration test harness; decide separately whether a minimal current-compatible tool should be ported. |
| [#277](https://github.com/filipto861/flytally-logbook/pull/277) | Independent review / operational fail-closed design in `3_7_0_SATELLITE_R2D_OPERATIONS_DESIGN.md` (not in main) | **RETAIN DESIGN EVIDENCE**; a design PR is not an instruction to enable unimplemented behavior. |
| [#278](https://github.com/filipto861/flytally-logbook/pull/278) | Server emergency stop `FLYTALLY_SATELLITE_UPSTREAM_DISABLED` plus tests; **flag absent from current main code** | **KEEP — security/operations decision required**. Do not accidentally claim emergency disable is deployed or auto-merge stacked R2 code. |
| [#279](https://github.com/filipto861/flytally-logbook/pull/279) | Very large nested R2D.2 provider resource/transport/admission research, offline primitives and ~56 PR-changed files. Representative `lib/satellite-bounded-fetch.ts` and `lib/satellite-admission-gate.ts` **absent from main** | **KEEP / QUARANTINE AS RESEARCH**. Unique source-backed/reviewer/test assets; any port must start with current main, independent architecture/resource/security review and small isolated milestones. Never bulk merge the historical ~500-commit ancestry. |
| [#281](https://github.com/filipto861/flytally-logbook/pull/281) | Esri 512px-vs-256px tile geometry analysis and independent reviewer reconciliation (`3_7_0_S1_SATELLITE_ARCHITECTURE_DECISION.md` not in main) | **KEEP AS SOURCE/REVIEW EVIDENCE** until current real-provider geometry applicability is independently checked. No inferred z transform or license. |

**Verified Git tree distinction:** The current main tree has no `lib/satellite-map-provider.ts`, `lib/satellite-bounded-fetch.ts`, `lib/satellite-admission-gate.ts`, `tooling/verify-satellite-http.mjs`, `tooling/satellite-http-upstream-fixture.cjs`, or `docs/product/3_7_0_S1_SATELLITE_ARCHITECTURE_DECISION.md`. The production map tile route contains no `FLYTALLY_SATELLITE_UPSTREAM_DISABLED` switch. These observations establish **nonidentity**, not a blanket verdict on code quality or suitability.

## 3. Branch retention and deletion gates

### A. Zero-ahead candidate list at the initial `main@09001505` audit

- `chore/pre-f3-integration-anchor`
- `codex/v335-batch8-routes-headers-legal`
- `docs/flight-entry-f1-closeout`
- `feat/flight-entry-f33-aircraft-authority`
- `feat/flight-entry-f34-aircraft-context-ux`
- `fix/story-map-toggle`
- `test/flight-entry-f35-closeout`

These were exactly `0` commits ahead of `main@09001505`. **Re-run Git compare against current main** immediately before any deletion, verify no open PR base/head ref, tags, deployment rollback anchor or owner-held external link, then obtain explicit per-batch authorization. Zero ahead is not proof that every branch name is expendable (e.g. integration anchors).

### B. Superseded docs closeout branches

PRs #294, #296 and #299 are closed without merging. Their branches/commits still retain useful dated evidence; check who references them before considering deletion. Do not modify these refs merely to make GitHub look cleaner.

### C. Unique/stacked experimental branches

Keep all R1/R2 open PR head/base branches intact during technical classification. A branch can have many ahead commits that are inherited from stacked bases; such count is not a unique-change count. Never bulk merge, force-update or auto-delete the stack.

## 4. Proposed next decisions

1. **M2A independent read-only review:** compare current main and PR #273 (Story PNG), #278 (Satellite kill switch), #279 (resource/admission safety), and #281 (Esri geometry/source evidence). Ask DeepSeek to identify unique features, missing governance/test gates and smallest safe forward port, if any. No code changes.
2. **M2B evidence disposition:** classify #271/#272/#274/#277 from a content-diff perspective; if entirely superseded, preserve unique commentary/document text in historical GitHub PR and optionally in docs/history before closing.
3. **M3 branch cleanup:** propose a versioned explicit branch-head deletion batch with original/ref SHA, open PR references, rollback ownership and authorized commands. Use branch deletion only after approval; do not delete history/tags/releases.
4. **M4 final validation:** re-read actual main and open PR/branch list, cross-check ROADMAP/FEATURES/CHANGELOG and document tests, DB, deploy as N/A/NOT RUN unless executed.

## 5. DeepSeek read-only reviewer handoff (copy/paste)

> Audit GitHub repository `filipto861/flytally-logbook` at the exact current `main` head and open PRs #271–#279 and #281. The main application has merged authenticated Satellite and combined openAIP Aviation maps (PRs #282/#285/#293/#295/#297), but product 3.7.0 is still not a complete accepted release. Treat all old R1/R2 PRs as **unmerged**; do not recommend a wholesale merge. Identify genuinely unique current-vs-PR runtime, test, design and security changes. Prioritize #273 Story PNG fail-closed behavior, #278 Satellite emergency disable, #279 bounded provider admission/transport code, #281 Esri tile geometry assumptions. Classify each as: already functionally covered, independent useful improvement, obsolete, or blocked by provider evidence. Cite exact files, SHA and acceptance/tests. Respect missing/invalid-data fail-closed, privacy/server auth, provider license gates, exact-SHA test evidence and zero production/Training/DB edits. Return a short candidate disposition table and minimum-risk forward milestones. Do not change any branch or PR.

**This review handoff is advisory.** Second-AI output is not authority; reconcile against actual code, manufacturer/vendor docs, production evidence and owner decisions before changing scope.
