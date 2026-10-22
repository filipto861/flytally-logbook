# FlyTally Logbook — active work pointers

**Discovery snapshot: 2026-10-21.** **Not a live PR board.** Verify status, base/head SHAs, merges, dependencies and evidence before editing. The order below does not imply owner priority.

| Workstream | PRs observed open | Gate / caution |
| --- | --- | --- |
| Portable local developer tests | [#383](https://github.com/filipto861/flytally-logbook/pull/383) | Owner Windows at `823a3cb50e5d` owned native PG16 preflight PASS, full 42-file / 163-case PostgreSQL suite **121 PASS / 3 FAIL / 39 SKIP**, still FAIL. Separate full-v20 tests now correctly SKIP; 50k flight list 2582.270ms > 2500ms, 50k Insights 3547.546ms > 3000ms, 100k flight list 5511.521ms > 4500ms. New opt-in **serial diagnostic** `test:db:scale:local` stages only 3 registered scale files under same exact owned localhost guard; original full/release gate untouched. Hypothesis: concurrent scale fixtures contend; unverified. New HEAD source safety/Windows/scale NOT RUN. Next owner local safety, then isolated scale diagnostic. No merge/deploy/prod DB/Training. |
| Logbook UX baseline | [#377](https://github.com/filipto861/flytally-logbook/pull/377) | Baseline and guarded UI capture; independently review current evidence. |
| Logbook focus and contrast | [#378](https://github.com/filipto861/flytally-logbook/pull/378), [#379](https://github.com/filipto861/flytally-logbook/pull/379), [#381](https://github.com/filipto861/flytally-logbook/pull/381) | Independent draft work; focus/browser/mobile evidence must remain exact-head and not be inferred from source checks. |
| Narrow Flights category layout | [#380](https://github.com/filipto861/flytally-logbook/pull/380) | Responsive browser validation reported pending in PR snapshot. |
| Currency 3.8.0 research | [#319–#327](https://github.com/filipto861/flytally-logbook/pulls?q=is%3Apr+is%3Aopen+3.8.0), [#330](https://github.com/filipto861/flytally-logbook/pull/330) | Isolated design/tests/schema research, **not** approval for production data migration, Neon access, restore or release. |
| GPS V2 retirement | [merged #376](https://github.com/filipto861/flytally-logbook/pull/376) | Dated cleanup documented in ROADMAP; legacy GPS import preserved. **Do not revive retired V2 PRs by accident.** |
| Session continuity | `docs/session-continuity-20261021` | Documentation-only candidate; explicit review and approval before merging. |

Only update this table when a workstream starts/ends, changes base/PR or has a material blocker. Record detailed SHA-bound evidence in the selected PR and [SESSION_HANDOFF](SESSION_HANDOFF.md), not in duplicated release-status prose. Do not mix `flytally-training` work or expose user flight data.
