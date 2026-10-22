# FlyTally Logbook — active work pointers

## 2026-10-22T18:08:45.745Z — Logbook 3.8.1 LIVE, U3 merged, next U1 independent

Production release PR [#386](https://github.com/filipto861/flytally-logbook/pull/386) **MERGED** to `main=34b865bb0ced1222945cecb107589826890ee31a`, Vercel production deployment `dpl_4XGBawGy187VyJpG5nyRFe2p2fKW` **READY** for `fly-tally.com`, source/aggregate/typecheck/build gates PASS on exact premerge SHA; public smoke 5/5 200 and empty recent runtime error scan. No production migration or flag changes (Neon v21 preflight 21/12/4). Historical 3.8.1 "release in progress" note below is superseded; do not use it as current state. U3 [#381](https://github.com/filipto861/flytally-logbook/pull/381) already MERGED; U1 #378, U2 #379, mobile Flights #380 and U0 #377 remain separate, unapproved scopes. Docs-only closeout work `docs/logbook-v3.8.1-production-closure-20261022` has **not been merged** and needs an explicit owner docs-PR decision. One next step: authenticated owner smoke on deployed 3.8.1 before continuing independent U1 review.



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
