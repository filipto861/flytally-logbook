# FlyTally Logbook — documentation & AI development governance closeout

**Date:** 11 October 2026. **Repository:** `filipto861/flytally-logbook` only; `flytally-training` unchanged. **Status:** DOC-0 through DOC-4 implemented and reviewed; DOC-5 final reconciliation and verification recorded in this closeout. Owner approved the architecture (priority: efficient, fast, exact development). DeepSeek independent review was source-reconciled before these changes.

## Completed evidence

| Milestone | PR | Result | Verification boundary |
| --- | --- | --- | --- |
| DOC-0 independent audit | [#312](https://github.com/filipto861/flytally-logbook/pull/312) | 123 Markdown inventory, DeepSeek brief and independent review reconciliation | Read-only GitHub/source evidence; no full semantic audit of historic claims |
| DOC-1 one status owner | [#313](https://github.com/filipto861/flytally-logbook/pull/313) | README stable navigation; ROADMAP current plan; FEATURES capability inventory; VERSIONING numbering only; CHANGELOG history untouched | 83 internal links inspected, zero broken; package/lock version triplet static consistent |
| DOC-2 active DEV/history separation | [#314](https://github.com/filipto861/flytally-logbook/pull/314) | Active DEVELOPMENT shrunk from ~40 KB to ~23 KB; 19,350-character Phase 0B/0E/0F text preserved verbatim in `docs/history/DEVELOPMENT_PHASE0_VERIFICATION_HISTORY.md` | Original archived bytes and active suffix compared exactly; 8 npm scripts verified; existing DEV source assertions **17/17 static matches**; not Node suite |
| DOC-3 AI entrypoint/handoff | [#315](https://github.com/filipto861/flytally-logbook/pull/315) | 21-line stable AGENTS pointer; SHA-bound handoff template, bounded DeepSeek read-only review triggers and evidence ledger | 79 relative links checked / 0 broken, no volatile version literal in AGENTS |
| DOC-4 report-only checks | [#316](https://github.com/filipto861/flytally-logbook/pull/316) | `node docs/scripts/check-documentation.mjs` and six negative/positive fixture tests; no merge/CI enforcement | **Node fixture suite 6/6 PASS in isolated local container**, exact GitHub blob hashes matched tested files; 65 changed-doc links checked / 0 broken |

## Reconciled canonical operating model

- **Before a new chat:** verify actual repository HEAD/PRs, read current ROADMAP, FEATURES, relevant architecture/development and exact source/acceptance records. Use [AGENTS](../../AGENTS.md) and [AI handoff](../AI_HANDOFF_TEMPLATE.md) as navigation, not a second source of truth. Read only relevant CHANGELOG headings; preserve complete history.
- **AI roles:** owner approves product/priorities; ChatGPT leads discovery/design/small implementation/testing; DeepSeek independently reviews major design/migration/security/aviation/irreversible changes **once per frozen proposal**; findings accepted/rejected with evidence/deferred for owner. Routine edits do not require repeated independent consultation.
- **Verification:** candidate-specific scoped tests and safety gates remain authoritative under DEVELOPMENT and registry; `PASS` only for actually executed checks, otherwise `NOT RUN`, `N/A`, `FAIL` or `PARTIAL`. Browser/build/DB/CI are never inferred from a Markdown tool PASS.
- **Documentation check:** is intentionally **report-only**. It checks matching package/lock metadata and simple active-doc relative paths. It intentionally does **not** decide live deployment truth, owner approval, provider rights, external URL availability, Markdown anchors, correctness of legal/regulatory claims or all historical links. Additional rule enforcement requires explicit owner review.

## Final snapshot and retained issues

- GitHub `main` before this closeout: `1d565b4b41cdfd6316722c53defe5ba0cae479e0`; package, lock and workspace-root package versions all **3.7.0**. The verified Vercel `fly-tally.com` alias still points to release deployment `dpl_Az24Z1mL7BxGN16zHpiiGDGXGPui`. No new runtime/DB deployment was requested for these documentation-only PRs.
- No history deleted. Nine previously observed ordinary Markdown links in *verbatim relocated historical snapshots* remain known dated archival limitations (not active-document errors). External links and complete 123-file semantic correctness were not exhaustively verified.
- **Deferred technical debt:** `tests/versioning-governance.test.ts` still embeds exact 3.7.0/3.8.0 roadmap/version texts and owner-acceptance prose. It should be made **candidate-safe and structural** before the 3.8.0 version cut, with targeted Node execution on exact candidate. Do not remove valid release evidence or weaken executable integrity to silence a regex.
- **Deferred external evidence:** Esri/openAIP licence/usage/redistribution, attribution/Story export rights, coverage/currentness, quotas and billing remain **UNVERIFIED**; 3.7.0 functional release and these governance edits are not supplier/commercial or approved-EFB evidence.
- **Not run for DOC-5:** full local npm test, typecheck, Next build, Playwright, PostgreSQL, GitHub CI, authenticated production smoke. They are not needed for this docs-only closeout, and no PASS is asserted for them.

## Next task

**3.8.0 Currency / monetary semantics (#136)** remains the next product milestone. Before any actual 3.8.0 release-version bump, reconcile brittle versioning-governance assertions against the candidate; use a dedicated targeted test command. New-chat AI should start from latest `main`, not any 11 October handoff snapshot, and respect the owner-frozen roadmap decisions.
