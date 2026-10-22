# FlyTally Logbook — active work pointers

**Discovery snapshot: 2026-10-21.** **Not a live PR board.** Verify status, base/head SHAs, merges, dependencies and evidence before editing. The order below does not imply owner priority.

| Workstream | PRs observed open | Gate / caution |
| --- | --- | --- |
| Portable local Windows developer workflow | [#384](https://github.com/filipto861/flytally-logbook/pull/384) | Clean core extracted from closed/unmerged #383. Exact owned native/Docker PG16, 8 local npm commands, fresh browser server, 23 core source-safety tests including explicit isolated full-v20 guard. Old mixed owner Windows 26/26 safety PASS and owned local PG16 preflight PASS; reconstructed core exact-head Windows/quick/browser/reboot/second-PC tests NOT RUN. Strict older PG scale FAIL remains unresolved; do not claim release PASS. Await owner clean-branch validation and explicit merge authorization; no merge/deploy/prod DB. |
| PG scale research (separate) | [#385](https://github.com/filipto861/flytally-logbook/pull/385) | Draft stacked on #384; historical v20 fixture and 50k/100k scale diagnostics; strict performance gate still FAIL in latest observed run, no product SQL/threshold changes. Follow up only after independent review. |
| Logbook UX baseline | [#377](https://github.com/filipto861/flytally-logbook/pull/377) | Baseline and guarded UI capture; independently review current evidence. |
| Logbook focus and contrast | [#378](https://github.com/filipto861/flytally-logbook/pull/378), [#379](https://github.com/filipto861/flytally-logbook/pull/379), [#381](https://github.com/filipto861/flytally-logbook/pull/381) | Independent draft work; focus/browser/mobile evidence must remain exact-head and not be inferred from source checks. |
| Narrow Flights category layout | [#380](https://github.com/filipto861/flytally-logbook/pull/380) | Responsive browser validation reported pending in PR snapshot. |
| Currency 3.8.0 research | [#319–#327](https://github.com/filipto861/flytally-logbook/pulls?q=is%3Apr+is%3Aopen+3.8.0), [#330](https://github.com/filipto861/flytally-logbook/pull/330) | Isolated design/tests/schema research, **not** approval for production data migration, Neon access, restore or release. |
| GPS V2 retirement | [merged #376](https://github.com/filipto861/flytally-logbook/pull/376) | Dated cleanup documented in ROADMAP; legacy GPS import preserved. **Do not revive retired V2 PRs by accident.** |
| Session continuity | `docs/session-continuity-20261021` | Documentation-only candidate; explicit review and approval before merging. |

Only update this table when a workstream starts/ends, changes base/PR or has a material blocker. Record detailed SHA-bound evidence in the selected PR and [SESSION_HANDOFF](SESSION_HANDOFF.md), not in duplicated release-status prose. Do not mix `flytally-training` work or expose user flight data.
