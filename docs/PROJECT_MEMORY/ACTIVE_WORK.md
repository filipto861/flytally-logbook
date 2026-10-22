# FlyTally Logbook — active work pointers

**Discovery snapshot: 2026-10-21.** **Not a live PR board.** Verify status, base/head SHAs, merges, dependencies and evidence before editing. The order below does not imply owner priority.

| Workstream | PRs observed open | Gate / caution |
| --- | --- | --- |
| Portable local developer tests | [#383](https://github.com/filipto861/flytally-logbook/pull/383) | Owner Windows code SHA `3a1dff314caf` `test:local-workflow` **23/23 PASS** including nested Node/full-v20 selection regression; fixes previous 22/23 failure. Real PG gate new HEAD NOT RUN. Earlier 42-file suite 122 PASS / 9 FAIL / 32 SKIP (8 special v20 opt-in misselection, 1 actual 50k flight-list 2648.214ms > 2500ms frozen budget). Next `test:db:local` on existing verified owned localhost fixture only; separate dedicated v20 fixture, browser, aggregate, build, reboot remain NOT RUN. No merge/deploy/prod DB/Training. |
| Logbook UX baseline | [#377](https://github.com/filipto861/flytally-logbook/pull/377) | Baseline and guarded UI capture; independently review current evidence. |
| Logbook focus and contrast | [#378](https://github.com/filipto861/flytally-logbook/pull/378), [#379](https://github.com/filipto861/flytally-logbook/pull/379), [#381](https://github.com/filipto861/flytally-logbook/pull/381) | Independent draft work; focus/browser/mobile evidence must remain exact-head and not be inferred from source checks. |
| Narrow Flights category layout | [#380](https://github.com/filipto861/flytally-logbook/pull/380) | Responsive browser validation reported pending in PR snapshot. |
| Currency 3.8.0 research | [#319–#327](https://github.com/filipto861/flytally-logbook/pulls?q=is%3Apr+is%3Aopen+3.8.0), [#330](https://github.com/filipto861/flytally-logbook/pull/330) | Isolated design/tests/schema research, **not** approval for production data migration, Neon access, restore or release. |
| GPS V2 retirement | [merged #376](https://github.com/filipto861/flytally-logbook/pull/376) | Dated cleanup documented in ROADMAP; legacy GPS import preserved. **Do not revive retired V2 PRs by accident.** |
| Session continuity | `docs/session-continuity-20261021` | Documentation-only candidate; explicit review and approval before merging. |

Only update this table when a workstream starts/ends, changes base/PR or has a material blocker. Record detailed SHA-bound evidence in the selected PR and [SESSION_HANDOFF](SESSION_HANDOFF.md), not in duplicated release-status prose. Do not mix `flytally-training` work or expose user flight data.
