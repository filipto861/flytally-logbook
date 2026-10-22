# FlyTally Logbook — active work pointers

**Discovery snapshot: 2026-10-21.** **Not a live PR board.** Verify status, base/head SHAs, merges, dependencies and evidence before editing. The order below does not imply owner priority.

| Workstream | PRs observed open | Gate / caution |
| --- | --- | --- |
| Portable local Windows developer workflow | [#384](https://github.com/filipto861/flytally-logbook/pull/384) | Owner Windows tested executable `e27a11efa0770bb11cac88f1ad5602865743a700`: `git pull --ff-only` PASS, `npm run test:quick` PASS; 23/23 local safety, 257/257 source/regression, typecheck PASS, candidate `a777868f22a5eae5600c452a8a77c747c6ce1710d136a3f79e4f32aa2925b8cf`, blocked evidence none. v20 manifest hash drift resolved. Portable iteration workflow usable on core branch. Release NOT EVALUATED: aggregate regression/build/PG/browser pending. No Browser U3 exact-head acceptance or merge; PR #385 research Draft with unresolved scale FAIL; next risk-scope release prerequisites before explicit approval. Untracked U0/U1 audit ZIPs untouched, no deploy/remote DB/Training. |
| PG scale research (separate) | [#385](https://github.com/filipto861/flytally-logbook/pull/385) | Draft stacked on #384; historical v20 fixture and 50k/100k scale diagnostics; strict performance gate still FAIL in latest observed run, no product SQL/threshold changes. Follow up only after independent review. |
| Logbook UX baseline | [#377](https://github.com/filipto861/flytally-logbook/pull/377) | Baseline and guarded UI capture; independently review current evidence. |
| Logbook focus and contrast | [#378](https://github.com/filipto861/flytally-logbook/pull/378), [#379](https://github.com/filipto861/flytally-logbook/pull/379), [#381](https://github.com/filipto861/flytally-logbook/pull/381) | Independent draft work; focus/browser/mobile evidence must remain exact-head and not be inferred from source checks. |
| Narrow Flights category layout | [#380](https://github.com/filipto861/flytally-logbook/pull/380) | Responsive browser validation reported pending in PR snapshot. |
| Currency 3.8.0 research | [#319–#327](https://github.com/filipto861/flytally-logbook/pulls?q=is%3Apr+is%3Aopen+3.8.0), [#330](https://github.com/filipto861/flytally-logbook/pull/330) | Isolated design/tests/schema research, **not** approval for production data migration, Neon access, restore or release. |
| GPS V2 retirement | [merged #376](https://github.com/filipto861/flytally-logbook/pull/376) | Dated cleanup documented in ROADMAP; legacy GPS import preserved. **Do not revive retired V2 PRs by accident.** |
| Session continuity | `docs/session-continuity-20261021` | Documentation-only candidate; explicit review and approval before merging. |

Only update this table when a workstream starts/ends, changes base/PR or has a material blocker. Record detailed SHA-bound evidence in the selected PR and [SESSION_HANDOFF](SESSION_HANDOFF.md), not in duplicated release-status prose. Do not mix `flytally-training` work or expose user flight data.
