# FlyTally Logbook — active work pointers

## 2026-10-23T06:08:20.871Z — Navigation and global UI/UX redesign discovery (scoped)

- Owner objective: main menu/navigation and common visual consistency ONLY; no opportunistic unrelated fixes. Docs-only work branch `docs/logbook-navigation-design-audit-20261023` based on verified `main=c68e6a2758423ab862cf9b03f5623515d07433e4`; source audit document `docs/product/LOGBOOK_NAVIGATION_UI_AUDIT_2026-10-23.md`. No implementation/merge/deploy approval implied.
- Loaded merged Agent Skills V1 + Apple Design V2 (PR #388/#390 merged into main); existing independent Draft PRs #377–#380 and #389 remain out of scope.
- **ONE NEXT STEP:** analyze forthcoming user video, then freeze a scope-limited UX redesign proposal for approval.

## 2026-10-22T19:14:39.210Z — Apple Design V2 (proposal only)

- [Draft PR #390](https://github.com/filipto861/flytally-logbook/pull/390), branch `docs/logbook-apple-design-v2-20261022` from main `f1052cac8d518342bfdf10c6f03b51199d78ad69`, initial work `17c157ea8f0d31d2d994ec43c7c909c06d2c18b5`. Adds first-class mandatory Apple Design routing for all Logbook UI, 17-section detailed playbook and compact project-instruction addendum. SOURCE-ONLY checks PASS; runtime tests NOT RUN, no deployment. V2 not canonical until explicit owner-approved merge.
- Separate [Draft PR #389](https://github.com/filipto861/flytally-logbook/pull/389) has overlapping ROADMAP/Project Memory documentation; avoid combining or assuming its merge.
- **ONE NEXT STEP:** review PR #390 and decide on merging separately from #389.


## 2026-10-22T18:37:26.054Z — Agent Skills V1 documentation proposal

- New scoped workstream: [Draft PR #388](https://github.com/filipto861/flytally-logbook/pull/388), branch docs/logbook-agent-skills-v1-20261022 from main 34b865bb0ced1222945cecb107589826890ee31a; initial proposed work commit 7887c31cbd285954a29941cda3c057982fda44c4. Nine task-routed skills, AGENTS.md routing and ChatGPT Project Instructions addendum; no runtime/DB/deploy changes. **Not approved for merge.** Verify current head/base before acting.
- **One next step:** review PR #388 and user-facing addendum, then request explicit owner merge decision after checks.


## 2026-10-22 — 3.8.1 release in progress (owner-authorized)

Release branch `release/logbook-v3.8.1-20261022` from main `db8abbd90d28ce70fc3c7ae5ba89c00242bab75b` adds `3.8.1` version metadata, test and release governance. Vercel target `filipito/logbook` is linked to this repo; automatic Git deploy remains disabled. Live Neon production primary was read-only checked at v21 shape 21/12/4; production SQL changes NOT APPROVED and NOT NECESSARY for this patch. Pre-release deployment current production Git SHA `6a67a024...`, so planned deploy includes merged GPS changes plus U3. Version PR gates, final merged SHA, Vercel READY and smoke pending. **One next step:** open release PR and verify exact candidate.



**Discovery snapshot: 2026-10-21.** **Not a live PR board.** Verify status, base/head SHAs, merges, dependencies and evidence before editing. The order below does not imply owner priority.

| Workstream | PRs observed open | Gate / caution |
| --- | --- | --- |
| Logbook UX baseline | [#377](https://github.com/filipto861/flytally-logbook/pull/377) | Baseline and guarded UI capture; independently review current evidence. |
| Logbook focus and contrast | [#378](https://github.com/filipto861/flytally-logbook/pull/378), [#379](https://github.com/filipto861/flytally-logbook/pull/379), [#381](https://github.com/filipto861/flytally-logbook/pull/381) | Independent draft work; focus/browser/mobile evidence must remain exact-head and not be inferred from source checks. |
| Narrow Flights category layout | [#380](https://github.com/filipto861/flytally-logbook/pull/380) | Responsive browser validation reported pending in PR snapshot. |
| Currency 3.8.0 research | [#319–#327](https://github.com/filipto861/flytally-logbook/pulls?q=is%3Apr+is%3Aopen+3.8.0), [#330](https://github.com/filipto861/flytally-logbook/pull/330) | Isolated design/tests/schema research, **not** approval for production data migration, Neon access, restore or release. |
| GPS V2 retirement | [merged #376](https://github.com/filipto861/flytally-logbook/pull/376) | Dated cleanup documented in ROADMAP; legacy GPS import preserved. **Do not revive retired V2 PRs by accident.** |
| Session continuity | `docs/session-continuity-20261021` | Documentation-only candidate; explicit review and approval before merging. |

Only update this table when a workstream starts/ends, changes base/PR or has a material blocker. Record detailed SHA-bound evidence in the selected PR and [SESSION_HANDOFF](SESSION_HANDOFF.md), not in duplicated release-status prose. Do not mix `flytally-training` work or expose user flight data.
