# FlyTally Logbook — active work pointers

## 2026-10-22T19:38:16.522Z — Apple Design V2 now canonical

- Owner-approved [PR #390](https://github.com/filipto861/flytally-logbook/pull/390) MERGED on main `c68e6a2758423ab862cf9b03f5623515d07433e4`, 17-domain full Apple Design playbook required for Logbook UI tasks. No application runtime deploy occurred during this work. Production runtime/DB/flags UNKNOWN (not rechecked); GitHub documentation/source checks PASS only.
- [PR #389](https://github.com/filipto861/flytally-logbook/pull/389) remains a separate docs checkpoint Draft (includes these post-merge pointers), not approved for merge. The ChatGPT project instructions setting has not been verified as changed.
- **One next step:** update ChatGPT Project Instructions for mandatory Apple Design V2 loading and verify it in the next UI session.


## 2026-10-22T18:52:44.393Z — Agent Skills V1 workstream closed by owner-approved merge

- [PR #388](https://github.com/filipto861/flytally-logbook/pull/388) MERGED, main `f1052cac8d518342bfdf10c6f03b51199d78ad69`, nine task-routed skills canonical. ChatGPT Project Instructions update is a separate manual setting action, **not confirmed**. Design playbook V2 only a possible future proposal; nothing approved/implemented. Separate docs-only checkpoint branch `docs/logbook-skills-v1-merge-checkpoint-20261022` is not a product/release PR.
- **One next step:** update/verify the ChatGPT Project Instructions with the compact routing rule so future development sessions read relevant canonical skills.


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
