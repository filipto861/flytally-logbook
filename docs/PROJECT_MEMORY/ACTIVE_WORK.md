# FlyTally Logbook — active work pointers

**Discovery snapshot: 2026-10-21.** **Not a live PR board.** Verify status, base/head SHAs, merges, dependencies and evidence before editing. The order below does not imply owner priority.

| Workstream | PRs observed open | Gate / caution |
| --- | --- | --- |
| Portable local Windows developer workflow | [#384](https://github.com/filipto861/flytally-logbook/pull/384) | Owner Windows clean core code `ba6e5948`: `test:local-workflow` **23/23 PASS**, `test:quick` source **254 PASS / 3 FAIL**, typecheck PASS; all 3 FAIL from stale registry SHA-256 for v380 full-v20 source. Updated ONLY the corresponding canonical-LF SHA entry (`52e5c858…ea673`) in pinned PostgreSQL inventory; 42 files/163 cases/flags and strict gate unchanged. New exact-head owner `test:quick` NOT RUN. Existing scale/release gate remains unresolved, browser/reboot/second PC NOT RUN. Next owner `git pull --ff-only` then `npm run test:quick`; don't reset DB or delete untracked audit ZIPs. No merge/deploy/prod DB/Training. |
| PG scale research (separate) | [#385](https://github.com/filipto861/flytally-logbook/pull/385) | Draft stacked on #384; historical v20 fixture and 50k/100k scale diagnostics; strict performance gate still FAIL in latest observed run, no product SQL/threshold changes. Follow up only after independent review. |
| Logbook UX baseline | [#377](https://github.com/filipto861/flytally-logbook/pull/377) | Baseline and guarded UI capture; independently review current evidence. |
| Logbook focus and contrast | [#378](https://github.com/filipto861/flytally-logbook/pull/378), [#379](https://github.com/filipto861/flytally-logbook/pull/379), [#381](https://github.com/filipto861/flytally-logbook/pull/381) | Independent draft work; focus/browser/mobile evidence must remain exact-head and not be inferred from source checks. |
| Narrow Flights category layout | [#380](https://github.com/filipto861/flytally-logbook/pull/380) | Responsive browser validation reported pending in PR snapshot. |
| Currency 3.8.0 research | [#319–#327](https://github.com/filipto861/flytally-logbook/pulls?q=is%3Apr+is%3Aopen+3.8.0), [#330](https://github.com/filipto861/flytally-logbook/pull/330) | Isolated design/tests/schema research, **not** approval for production data migration, Neon access, restore or release. |
| GPS V2 retirement | [merged #376](https://github.com/filipto861/flytally-logbook/pull/376) | Dated cleanup documented in ROADMAP; legacy GPS import preserved. **Do not revive retired V2 PRs by accident.** |
| Session continuity | `docs/session-continuity-20261021` | Documentation-only candidate; explicit review and approval before merging. |

Only update this table when a workstream starts/ends, changes base/PR or has a material blocker. Record detailed SHA-bound evidence in the selected PR and [SESSION_HANDOFF](SESSION_HANDOFF.md), not in duplicated release-status prose. Do not mix `flytally-training` work or expose user flight data.
