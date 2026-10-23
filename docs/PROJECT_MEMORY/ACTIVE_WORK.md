# FlyTally Logbook — active work pointers

## 2026-10-23 — N1 V2-1 approved theme-adaptive navigation candidate

- Repo filipto861/flytally-logbook, main full SHA c68e6a2758423ab862cf9b03f5623515d07433e4; branch feat/logbook-n1a-modern-navigation-20261023, base main, Draft PR #391. V2-1 implementation before this documentation checkpoint: 01f53bae2a519063a70348141e2f08c410476900; refresh current full HEAD after push.
- Owner approved a more substantial N1 V2 UI after rejecting visually-small N1-A. Frozen LIGHT sidebar in light theme / DARK sidebar in dark theme for sun-readable cockpit use, including system appearance. Exact implementation is a preview candidate, not production acceptance.
- Runtime changed ONLY components/sidebar.tsx (brand copy and Workspace section label), components/sidebar.module.css (nav heading, readable rows, responsive/collapsed), app/ui-system.css (sidebar-only adaptive light/dark palette, wide/collapsed nav, larger targets/mobile header and accessible focus). Source regression updated in tests/logbook-n1-navigation-style.test.ts. Proposal documented in docs/product/LOGBOOK_N1_V2_VISUAL_REDESIGN_PROPOSAL_2026-10-23.md; ROADMAP checkpoint updated. No route, auth, notification semantics, data, aviation or Training changes.
- Source-only in-memory inspection: 22/22 checks PASS for URL sets, active/focus, storage, theme selectors, responsive touch and scope. Node tests, typecheck, build, Playwright, exact browser computed cascade, native Safari and actual owner V2 screenshots NOT RUN. No DB, migrations, flags or deploy action. Production status unchanged by this work, runtime verification UNKNOWN.
- DO NOT: merge/deploy, production DB/flags, alter flight workflows or page content, add libraries, implement N1 V2-2 shared page shell until owner visually reviews V2-1, or delete unrelated ZIPs in the user's local checkout.
- ONE NEXT STEP: owner pulls updated Draft PR #391, restarts local guarded disposable-PostgreSQL preview, inspects mobile/desktop light/dark and sends visual feedback. Then decide next visual batch before tests.

## 2026-10-23 - Owner frozen theme behavior for N1 V2

Owner requires the global sidebar and mobile drawer to match LIGHT/DARK appearance, including system appearance. No permanent navy sidebar against a light workspace; sunny-day cockpit readability is the reason. Use current theme tokens, opaque backgrounds, high legibility for small nav text/icons, visible active/focus cues and touch targets. This does not authorize a brand/color redesign. Updated design: docs/product/LOGBOOK_N1_V2_VISUAL_REDESIGN_PROPOSAL_2026-10-23.md. Draft PR #391 remains a not-yet-accepted N1-A candidate; no N1 V2 runtime changes or testing. No merge, deploy, DB, flags or unrelated scope.
ONE NEXT STEP: visually approve the revised theme-adaptive N1 V2 shell concept before V2 code.

## 2026-10-23 — N1 V2 visual direction requested; proposal checkpoint

- Canonical repo filipto861/flytally-logbook; main verified c68e6a2758423ab862cf9b03f5623515d07433e4. Existing work feat/logbook-n1a-modern-navigation-20261023, Draft PR #391. No merge or deploy.
- Owner successfully opened localhost preview and provided four desktop/light screenshots. Explicitly rejected V1's visual magnitude; wants a much more modern overall look. This approval of a stronger outcome does NOT approve a specific new visual composition.
- Scope-limited revised spec: docs/product/LOGBOOK_N1_V2_VISUAL_REDESIGN_PROPOSAL_2026-10-23.md. Proposal only: deep-navy sidebar against light workspace, more structured brand/header/chrome, navigation type/spacing/active states, coherent shell. Preserve brand palette, all routes/roles/keyboard/mobile behaviors. Shared page cards/tabs deferred to N2/N3 as separate product decisions.
- Runtime code unchanged in this checkpoint; existing N1-A CSS candidate remains on branch and is not visually accepted. Screenshots are not committed. V2 testing/typecheck/build/Playwright/native Safari NOT RUN. Actual user preview is user-reported only. Production DB/migrations/flags/deploy not touched.
- DO NOT expand into unrelated fixes, Training, business logic, authentication, DB, experimental effects or new libraries. Preserve owner-local unrelated ZIP files.
- ONE NEXT STEP: owner approves/revises new N1 V2 shell design (navy rail with light content, reorganized visual header) before any V2 implementation.

## 2026-10-23 — owner-requested local visual preview before automated tests

- User explicitly requested to view N1-A in browser **before** running release/targeted tests. This is a sequencing change only, not scope expansion. Working branch `feat/logbook-n1a-modern-navigation-20261023`, Draft PR #391, base main `c68e6a2758423ab862cf9b03f5623515d07433e4`.
- Scoped tool added: `tooling/run-n1-preview-local.ps1`. Windows PowerShell local developer command; Node24, PG16/18 bins and npm deps required. Creates own GUID-qualified TEMP local PG cluster (localhost dynamic nonstandard port) and `flytally_currency_test`; verifies physical data-directory, DB identity and empty public schema **before** invoking existing destructive browser fixture/bootstrap; seeds synthetic pilot credentials and v20/v21 canonical SQL; runs `npm run dev` on localhost only. No remote DB path, no test runner, no Vercel.
- **Evidence:** script authored and GitHub source reviewed only. Actual PowerShell runtime, DB fixture bootstrap, dev server and rendered pages **NOT RUN**; typecheck/build/Playwright/native Safari **NOT RUN**. Production DB/migrations/flags/deploy **UNCHANGED BY THIS WORK**; current live state UNKNOWN beyond earlier read-only deployment check. Since the script includes destructive fixture SQL under a physically verified *new* local cluster, never run it with existing PG instances, never manually invoke the fixture bootstrap, never bypass identity checks.
- DO NOT: change aviation behavior, other PRs, Training, brand, DB schema in production, merge/deploy, or start N1-B/N2 before owner has inspected N1-A locally.
- **ONE NEXT STEP:** user runs `powershell -NoProfile -ExecutionPolicy Bypass -File .\tooling\run-n1-preview-local.ps1` from a clean checkout of this exact N1 feature branch and provides non-sensitive screenshot/feedback. If the preview aborts, inspect error before another action.

## 2026-10-23 — N1-A Draft PR #391 checkpoint (implementation candidate only)

- Repo `filipto861/flytally-logbook`. Verified base `main=c68e6a2758423ab862cf9b03f5623515d07433e4`. Work branch `feat/logbook-n1a-modern-navigation-20261023`, Draft [PR #391](https://github.com/filipto861/flytally-logbook/pull/391), base `main`. Pre-checkpoint work SHA `f03cf383d7537c9402a837d56440c10323d0732c`; this checkpoint advances HEAD. Re-fetch full SHA before ending.
- Owner approved N1 Modern Aviation Utility design and permitted scoped visual candidate, **not** merge/deploy. Files: `components/sidebar.module.css`, `app/ui-system.css`, `tests/logbook-n1-navigation-style.test.ts`, `tests/v300-sidebar-polish.test.ts` (update precisely changed semantic group-title color expectation), `docs/product/LOGBOOK_N1_MODERN_NAVIGATION_DESIGN_2026-10-23.md`, `ROADMAP.md`, Project Memory docs.
- Scope/DO NOT: change only sidebar action hierarchy, active/secondary link visuals and spacing; keep all URLs/labels/IA, brand tokens, mobile/desktop/iPad focus and drawer behavior. No page content, N1-B motion, N2/N3, unrelated PRs, Training, flights/auth/DB/infrastructure, dependencies, auto-prefill, migrations, flags, merge or deploy.
- Evidence: 20/20 in-memory GitHub source assertions PASS on updated candidate (not Node test execution), token color ratios calculated **6.45:1 dark / 5.69:1 light** (not rendered); updated legacy assertion checked by source inspection. **NOT RUN**: Node24 targeted tests, typecheck, build, candidate risk planner, authenticated Playwright, computed CSS, responsive screenshots, real Safari/VoiceOver/CI. Production DB/migrations/flags current state **UNKNOWN**, no mutations. Read-only Vercel project `filipito/logbook` latest production READY `dpl_4XGBawGy187VyJpG5nyRFe2p2fKW` still references `34b865bb0ced1222945cecb107589826890ee31a`; **no deploy performed**.
- Risks: style cascade and actual visual usability not proven by source inspection. PR remains Draft awaiting local targeted tests and screenshots; do not transfer historical test PASS to new SHA.
- **ONE NEXT STEP:** run exact-head owner-local Node24 targeted tests + candidate risk plan and authenticated browser visual inspection, then request owner's N1-A visual acceptance before any merge.

## 2026-10-23 — N1-A modern navigation candidate (owner-approved design, not merged)

- Workstream: `feat/logbook-n1a-modern-navigation-20261023` from verified `main=c68e6a2758423ab862cf9b03f5623515d07433e4`; N1-A **visual only** following the approved [design](../product/LOGBOOK_N1_MODERN_NAVIGATION_DESIGN_2026-10-23.md).
- Touched UI: `components/sidebar.module.css` and sidebar-only block appended to `app/ui-system.css`; new source regression `tests/logbook-n1-navigation-style.test.ts`. Keep all nav URLs/labels/group membership and keyboard/touch behavior intact. N1-B mobile animations and N2/N3 pages not started.
- Evidence: GitHub in-memory 14/14 source assertions PASS; hex design tokens contrast 6.45:1 dark/5.69:1 light **calculated, not browser rendered**. Node24 targeted tests, TypeScript, build, Playwright/browser screenshots, iPad/native Safari = **NOT RUN**. DB/migrations/flags/deploy = **UNTOUCHED / runtime state UNKNOWN**. No merge permission.
- **ONE NEXT STEP:** run exact-head targeted tests and authenticated visual/browser review across mobile, desktop and themes; seek owner approval of actual appearance before merging.

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
