# FlyTally Logbook — repository and documentation hygiene audit

**Audit date:** 2026-10-10  
**Scope:** `filipto861/flytally-logbook` only; **no** changes to `flytally-training`.  
**Repository baseline:** `main@090015053e33fb4b391a304e0a9e57f4145223a4` (PR #297 merge).  
**Status:** read-only source inventory and proposed cleanup; **not** release acceptance, authorization to delete, or a claim of production QA.  
**Evidence:** GitHub repository metadata, current default-branch file contents, GitHub PR metadata and `compare main...branch` summaries. No checkout, tests, GitHub Actions, DB operation, branch deletion, PR closure, deployment, or live browser check performed for this audit.

## 1. Repository inventory and immediate conclusions

| Area | Observed at audit | Interpretation |
| --- | --- | --- |
| Primary branch | `main@09001505` | Canonical, preserve; compare all other work to this, not an old feature branch. |
| Branches | 45 total: `main` + 44 non-main | 7 non-main branch heads have **0 commits ahead of main**, 2 have **1 commit ahead and 0 behind**, and 35 have diverged histories. Ahead commits do not prove that code is still needed or that a branch is safe to merge. |
| Open PRs | 14 | Four current docs PRs (#294, #296, #298, #299); ten older Satellite/R2 stacked/draft PRs (#271–#279, excluding #280, plus #281). They require different dispositions. |
| GitHub Releases | 12 older v0.53–v0.69.1 releases returned | Retain historic tags/releases unless separately verified and approved. They are not the current 3.x product-release state. |
| Workflow files | 2 (`verify-web.yml`, `browser-smoke.yml`) | Both use manual `workflow_dispatch`. Do not infer CI was run or passed; owner-local exact-SHA evidence and workflow policy belong in `DEVELOPMENT.md`. |
| Documentation | 109 files in `docs/` (3 directly under `docs/`, 69 `product/`, 21 `history/`, 7 `compliance/`, 9 `certification-readiness/`) | Significant overlap between live planning, historic milestone details and test evidence. A classification/index pass is needed before any moves. |
| Canonical root docs | `README.md`, `ROADMAP.md`, `FEATURES.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md` | All exist. Product version is `3.6.0` in `package.json`; full `3.7.0` is not declared complete. |
| Main protection | GitHub branches response reports `protected:false` for main | Verify rulesets/permissions in GitHub separately before asserting that a protection policy is or is not enforced. Recommend requiring explicit review and preventing accidental direct writes if supported. |

## 2. Verified documentation drift

1. **Current merged code vs pre-merge docs.** `main` contains the merged A2D (#293), A2E (#295), and A2F (#297) work. At this audit baseline, the first sections of `ROADMAP.md`, `FEATURES.md`, and `CHANGELOG.md` still contain pre-merge A2F FAIL/unmerged and A2E Draft statements. They are historically valid for earlier candidates, but misleading as the top-level current state.
2. **Existing corrective PR.** Draft PR [#298](https://github.com/filipto861/flytally-logbook/pull/298) is **1 commit ahead and 0 behind main**, touches six documentation files, adds the post-A2F verified current status and separates older evidence using a history boundary. Review and reconcile this PR first; do not independently overwrite the same files.
3. **Competing older closeout PRs.** Draft [#294](https://github.com/filipto861/flytally-logbook/pull/294) is 2 ahead/2 behind and [#296](https://github.com/filipto861/flytally-logbook/pull/296) is 1 ahead/1 behind. They edit the same canonical docs from older baselines. After comparing their unique evidence against #298, prefer the current consolidated closeout and deliberately close superseded PRs rather than merge stale status onto `main`.
4. **Independent data-only record.** PR [#299](https://github.com/filipto861/flytally-logbook/pull/299) is 1 ahead/0 behind and changes only `CHANGELOG.md`. It documents an owner-reported historical database backfill, not a code/schema release. Review the stated DB evidence separately; sequence or rebase to avoid conflicting with #298 in the same changelog.
5. **Documentation index drift.** `docs/README.md` still describes 3.7.0 Satellite/openAIP planning and Phase 1 acceptance as unimplemented despite subsequent merges. It must be updated only after identifying current-vs-historical document roles.
6. **Versioning index drift.** `docs/product/VERSIONING.md` retains the dated description of 3.7.0 as Phase 1-only/Satellite externally blocked. Preserve its policy and old examples, but update the *forward release sequence* from current accepted evidence.
7. **Unnecessary status repetition.** `ROADMAP.md` (~43 kB), `FEATURES.md` (~70 kB), and `CHANGELOG.md` (~231 kB) repeatedly embed entire intermediate verification histories. `docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md` already preserves a larger earlier narrative snapshot. Do **not** delete evidence; designate canonical current state, preserve traceable old evidence and reduce duplication only with equivalent links and a reviewed diff.
8. **Architecture naming.** `ARCHITECTURE.md` is titled 'current v2.7 generation' despite product version 3.6.0. Determine whether 'v2.7 generation' intentionally means an architectural generation; clarify the title instead of inventing a version mismatch.
9. **Historical evidence warning.** `docs/certification-readiness/` is explicitly historic and not evidence of current regulatory approval. Keep the distinction when refreshing the index.

## 3. Branch hygiene classification

### Group A — zero ahead of current main (candidates for deletion *after* reference checks)

These seven branch tips contain no commits absent from `main`, as verified with GitHub compare. This is **not** by itself deletion authorization:

- `chore/pre-f3-integration-anchor`
- `codex/v335-batch8-routes-headers-legal`
- `docs/flight-entry-f1-closeout`
- `feat/flight-entry-f33-aircraft-authority`
- `feat/flight-entry-f34-aircraft-context-ux`
- `fix/story-map-toggle`
- `test/flight-entry-f35-closeout`

Before deletion: check open PR head/base refs, deployment/rollback scripts, tags, needed links and human ownership. Preserve historical merge/PR evidence in GitHub. Delete branches only after explicit owner approval.

### Group B — direct, new documentation proposals

- `docs/3.7.0-a2f-production-closeout-reconcile` (#298): current consolidated doc closeout.
- `docs/2026-10-10-aircraft-defaults-backfill` (#299): independent historical data-only changelog.

They are both directly ahead of main. Review accurately and serialize merges/rebases; they both touch `CHANGELOG.md`.

### Group C — diverged branches / old stacked PR chains

35 branch heads diverge from current main, including flight-entry experiments and old R1/R2 Satellite/provider branches with long stacked ancestry. **Never equate ahead count with unique product work**; compare patches and actual runtime before any merge, deletion, or claim of supersession. Open older draft PRs #271–#279 and #281 should be dispositioned individually (superseded / independent follow-up / still active), with a short rationale, before closing them. A future docs/archive pointer may be appropriate for retained design decisions. No force push to main.

## 4. Proposed work order (owner review before destructive actions)

**M0 — Current closeout reconciliation.** Verify #298 against A2D/A2E/A2F merged code, acceptance docs, GitHub metadata and deployment evidence; verify #299's independently reported DB facts without executing or modifying the database. Review any unique data in #294/#296. Merge only owner-approved, conflict-free, documentation-only diffs. Preserve final test provenance as local vs CI and true runtime vs planned work.

**M1 — Canonical docs redesign.** Freeze a single 'current state' header in ROADMAP, a stable implemented/planned capability register in FEATURES, a chronological merged-change narrative in CHANGELOG, and concise README/docs index. Update VERSIONING/ARCHITECTURE only as justified. Proposed structure and links must be reviewed *before* moving archived material.

**M2 — Active-vs-historical index.** Inventory all 109 `docs/` files. Classify **active contract**, **accepted milestone evidence**, **superseded design**, **historical audit**, or **regulatory/compliance retained record**. Prefer links and moving closed technical reports under an archive only when all backlinks/references have been checked. Never silently delete governance evidence.

**M3 — PR/branch cleanup.** First reconcile #294/#296 and the older stacked 3.7.0 PRs, then identify unused branches, remove them in small reviewed batches. Preserve branch names/heads in a closed-out inventory before deletion. Retain tags/releases/history. GitHub review / branch safety settings get a separate proposal.

**M4 — Verification and final handoff.** Validate Markdown links, cross-document status, release numbering, PR link destinations, referenced code paths, and branch inventory against final main. For docs-only scope record `typecheck/tests/build/Playwright/DB/deploy = NOT RUN or N/A` as appropriate, **not PASS**. Updated ROADMAP/FEATURES/CHANGELOG/README docs must be consistent. Close with merged PR SHA, branch disposition, deferred items and next roadmap step.

## 5. Frozen product and governance constraints

- `main` is canonical; no production code, route, model, security, DB, Vercel env or deployment changes in a documentation hygiene milestone.
- `flytally-training` out of scope.
- Full 3.7.0 release remains unclaimed until its outstanding actual production/owner/provider/iPad acceptance is resolved.
- Retain historic FAIL, NOT RUN, owner-local and verification identity; do not relabel earlier test failures as PASS.
- Do not infer EASA/authority approval, operational aeronautical data reliability, Esri/openAIP commercial entitlement, or regulatory compliance from code/tests.
- Review only the effective state: the presence of an old paragraph, experiment, branch or tag is not a command to remove it.
- Consider an independent DeepSeek read-only review after M1 design, before the potentially broad M2/M3 changes.

## 6. Completion criteria

- Exactly one unambiguous forward state for each active milestone.
- Current product version/release status consistent across canonical docs, package metadata and actual deploy evidence.
- Historic evidence retained and discoverable by dated links.
- Open PRs individually classified; no loss of unique unmerged work.
- Branch deletion requires owner approval plus reference checks.
- All modifications traceable to reviewable PRs; no fabricated verification claims.

**Audit outcome:** evidence supports documentation/PR governance cleanup. It does **not** yet support destructive GitHub cleanup, full 3.7.0 closure, or product runtime changes.
