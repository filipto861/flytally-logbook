# DOC-6A — FlyTally Logbook documentation hygiene and safe archive plan

**Inventory:** 2026-10-29T12:45:03.345Z UTC · canonical `main@eb98982d9ce7cb166c32ba77c9262683989570f8` GitHub verified · docs-only work branch `docs/logbook-doc-hygiene-doc6a-20261029` · **proposal, not merged**.

## Verified inventory and most acute problems

- Untruncated GitHub recursive tree: **1,242 entries**, **1,112 tracked blobs**, **214 Markdown files** / **4,339,370 bytes** of Markdown. Of these, `docs/product/` has 128 Markdown files, `docs/history/` 24, `docs/PROJECT_MEMORY/` 6, `docs/maintenance/` 8, and root 7. Counts are a dated inventory, not a policy cap.
- Principal oversized active sources: `CHANGELOG.md` 2,797 lines / 563,259 repository bytes, `docs/PROJECT_MEMORY/SESSION_HANDOFF.md` 1,519 lines / 492,210 bytes, `ROADMAP.md` 880 lines / 381,420 bytes, `docs/PROJECT_MEMORY/ACTIVE_WORK.md` 926 lines / 252,190 bytes, `FEATURES.md` 446 lines / 111,061 bytes. These contain legitimate evidence; volume alone does not mean deletion is safe.
- **Source-of-truth drift:** `docs/README.md` last called itself reviewed 11 October and claimed Agent Skills V1 still proposed. Actual merged [PR #388](https://github.com/filipto861/flytally-logbook/pull/388) and main `.agents/skills/` confirm active skills. `docs/README.md` prominently discusses historic 3.7.0; current `package.json` version **3.8.1**, and ROADMAP later documents 3.8.0 production release. Its older §4 schedule still lists `3.8.0 NEXT` and N3 D1 pending: **historical snapshot**, not current production or actionable next gate.
- **Live integration/prod reconciliation:** main `eb98982d9ce7cb166c32ba77c9262683989570f8`; Vercel alias `fly-tally.com` → `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` READY, production Git SHA `55c8076e1eb8104c14392e15b272b33e0eb29607` (more recent docs main SHA doesn't imply a new deployment). Owner accepted Flights Glassless + Sidebar V4.2 at general functional level; no new native Safari/VoiceOver evidence. #427/#428 merged; #424/#425/#426 closed without merge with source refs retained. Prior docs-only closeout and N3-M3 proposal branches are unmerged and **must not be silently merged or deleted**.
- **Current 31 OPEN Draft PRs:** mechanical title categorization 15 `docs(...)`, 5 `test(...)`, 6 `feat/fix(...)`, 5 other. Several are historic checkpoint PRs (#423, #418, #415, #413, #411 etc.), but others are substantive research/security/testing (#417 audit, #385 scale diagnostics, #330 Neon SDK). Neither old date nor label proves an abandoned PR. Each needs a **separate status/source-diff/branch preservation/owner approval** before closing, retargeting or deleting. This cleanup changes no PR state.
- **Link inspection:** reproduced the manual checker’s bounded ordinary-inline Markdown relative-link logic against GitHub’s current tree for 13 canonical/entrypoint Markdown files, **259 link occurrences** and **two missing context-relative targets**, both in historical sections of `docs/PROJECT_MEMORY/{SESSION_HANDOFF,ACTIVE_WORK}.md`: `[Evidence](docs/product/LOGBOOK_N3_M2_FULL_RISK_SOURCE_AND_AGGREGATE_2026-10-23.md)` incorrectly resolves under `docs/PROJECT_MEMORY/docs/product/`. Actual target blob exists at `docs/product/...`. DOC-6A replaces only these two links with `../product/...`; all other old assertions remain untouched. This is **not** a full 214-file documentation checker run and is not semantic external-link/WCAG validation.

## Contract and classification — retain separate authorities

| Category | Source | Rules | This DOC-6A batch |
| --- | --- | --- | --- |
| Current product priority | `ROADMAP.md` | Latest verified header overrides dated release-plan snapshots; owner decides major next step | One short current heading; preserve all historic text and older table |
| Product capabilities | `FEATURES.md` | Never copy every release checkpoint into capability register | No change |
| Shipped changes/history | `CHANGELOG.md` | Append-only provenance, never truncate silently | No change; phase B can add a small index, not rewrite evidence |
| Architecture and testing | `ARCHITECTURE.md`, `DEVELOPMENT.md` | Runtime/schema/tests, actual commands and gate policy control | No change |
| Agent entrypoints | `README.md`, `AGENTS.md`, `docs/README.md` | Navigation only, no redundant current release authority | Update `docs/README.md` active skill and historical-release framing |
| Rolling continuity | `SESSION_HANDOFF.md`, `ACTIVE_WORK.md` | Short top pointer, SHA-bound checkpoints, never independent release authority | New current pointer; two broken link fixes; historic sections intact |
| Dated review/safety evidence | `docs/product/`, `docs/compliance/`, `docs/history/`, `docs/maintenance/` | Preserve immutable source context, past FAIL, effectivity and PR references | Inventory only; no mass moves or deletions |

## Safe phased follow-up for owner decision

**DOC-6A, this Draft** — Current pointers and index correction; two relative links; dated inventory. No historical data deletion, no old PR changes, no app/DB changes. Confirm GitHub diff scope and check bounded relative links. Optional local `node docs/scripts/check-documentation.mjs` remains **report-only**; script does not run through GitHub source reads.

**DOC-6B, future explicit scope** — **Condense the rolling handoff and ACTIVE_WORK** after creating immutable, traceable copies/refs of the entire old content and confirming byte-level integrity. Preserve dated evidence/old test failures, link backlinks and GitHub refs. Decide between Git-SHA archival permalinks (zero duplication, more effort for agents to navigate) and archival files under `docs/history/` (larger repo and potential relative-link relocation), with an archival manifest and deterministic source SHA to prove no loss. Only then shorten current ledgers to a small last-state/next-action pointer. Do not perform without owner approval of preservation method.

**DOC-6C, future explicit scope** — Review dated ROADMAP/FEATURES/CHANGELOG for **non-destructive extraction** of current summaries and immutable history while preserving exact old decisions and status. Current shipped status vs historical snapshot must remain discernible. No blanket status rewrite of a named test from NOT RUN into PASS. Do not move source-backed aviation/regulatory evidence without provenance audit.

**DOC-6D, future explicit scope** — Separate PR triage for 31 current Drafts (pin SHA and dependencies, classify docs-only/superseded/incomplete/active and approve each retirement batch); always preserve branches/evidence unless explicitly authorized otherwise. The existing security audit PR #417 and legacy transaction/concurrency research are not presumptively disposable.

## Evidence and hard stops

- **PASS (read-only analysis):** GitHub main+branches+open PR inventory, GitHub raw docs/tree identity, historic source links, active skill PR #388 state; Vercel READY/alias identity; scoped relative link inventory found exactly two invalid paths before patch.
- **NOT RUN:** local full optional doc checker, its Node fixture tests, full repository links/anchors/external URLs, Node app tests, TypeScript, Next build, PG/Neon, browser/Playwright, native Safari, VoiceOver. Static post-patch recheck required before calling 13-file relative links clean.
- **Database/flags:** none accessed or mutated; live readback UNKNOWN. **Deployment:** read-only READY and alias; no deploy. **PR:** DOC-6A Draft only, no merge. **Training:** outside scope.
- **DO NOT:** delete or alter history, archived source snapshots, signed/certified flight evidence, production data, DB migrations/flags, branches/PR closures, app runtime, design, Training, or silently modify release status in product features. Any deployment or merge requires new owner approval.
- **ONE NEXT STEP:** owner reviews DOC-6A and chooses whether to approve a separate DOC-6B archival/compaction design; exact PR squash merge is separately approved.
