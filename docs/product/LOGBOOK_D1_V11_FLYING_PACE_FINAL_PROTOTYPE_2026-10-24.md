# D1-V11 — Editorial Dashboard with selectable Flying Pace
2026-10-24. Design-only proposal; production implementation NOT performed.

## Scope and owner decisions
- Existing Editorial V10 is the baseline. Preserve the left-panel Add flight, on-mobile header action, prominent evidence-based Recency panel, one integrated Latest Flight row, and the grouped total/ULL/EASA hero. The owner does not want redundant Quick Actions, duplicate Latest Flight, vague microcopy or generic AI-styled decoration.
- The user approved preparation of V11 in response to proposed improvements: one 24-month Flying Pace graph with Total/ULL/EASA selector, small 12-month-vs-previous-12 comparison, and a nonpermanent Needs Attention element only when real review items exist.
- On-page Customize should not return. Saved dashboard preferences must not be erased/ignored without a documented, reversible user transition.

## Prototype delivered (chat artifact, not a repository runtime)
`FlyTally_Dashboard_D1_V11_Flying_Pace_Refined.html` — interactive, synthetic HTML. Light/dark, sample/empty account, optional pending-review warning, selectable Total/ULL/EASA data, mouse/touch and keyboard chart navigation. Screenshots `FlyTally_Dashboard_D1_V11_{1440,390,320}_{light,dark}.png`; demo QA measurements `FlyTally_Dashboard_D1_V11_QA.json` all local chat artifacts. These are NOT app or live data. No actual route navigation in prototype.

## Year-on-year truthfulness
- Displayed chart = 24 calendar months from November 2024 through October 2026, including current partial month with explicit `month to date` label. The latest 24 on-screen bars must not be misused to compute two full consecutive 12-month aggregates.
- V11's comparison = **October 2025–September 2026** versus **October 2024–September 2025**, two equal, fully completed 12-month intervals. This requires an additional older October 2024 source month (25 source months total) even though graph has 24 visible bars. Real implementation must derive boundaries from the viewer's relevant calendar and disclose comparison time window, not use hand-coded 2026 demo dates.
- For zero/missing preceding period: do not fabricate an infinite percentage or label missing as zero. Absent/partial/unreliable source intervals require an explicit unavailable comparison, not a synthetic increase.
- Graph categories must come from the same canonical flight inclusion/activity-minute semantics used in Dashboard, not independently invented hours. `getDashboardOverviewData` currently lacks monthly rows; historical `getDashboardData` has monthly aggregated rows but is heavier and not an approved direct substitute for a bounded overview read.

## Conditional data quality
- Default dashboard is clean and has no fake outstanding tasks. A compact single-row `2 flights need review` preview can be toggled on only for synthetic demo; production must use `getIntelligentLogbookAttention` and/or `getPendingActionCount` with actual data and actual distinct links. Preserve relevant existing pending/action and data-quality affordances when retiring Quick Actions. Never imply recency CURRENT, approval or compliance from a missing snapshot.

## Local prototype acceptance (not production)
- Source HTML/Javascript written on 2026-10-24. JavaScript V8 syntax parse PASS.
- Playwright with installed system Chromium, `page.set_content` (no application server, auth or PostgreSQL) performed **12/12** 320, 390, 768, 1024, 1440, 1600px × Light/Dark cases PASS, zero document horizontal overflow. At each viewport: exactly 24 visual bars; selected series Total/ULL/EASA updated aria-pressed and comparison value; slider Home/End keyboard selection; conditional attention shown when toggled; empty account hides chart comparison/alert and shows empty state; sample restores the graph. Screenshots at 320/390/1440 both themes.
- Layout may still need visual polish at 200% zoom and 320px with translated labels; actual app CSS cascade, real aviation dataset, Node/typecheck/build/PG/authenticated Next.js Playwright, native Safari/iPad, VoiceOver and production smoke **NOT RUN**.
- Motion: NONE (only existing V10 subtle bar interaction, disabled by reduced-motion settings). Reuse existing FlyTally palette/tokens; no external CSS, font, chart library or generated imagery.

## Proposed implementation boundaries (not approved for merge)
- Preserve server-side per-user authorization and canonical reading semantics for total/ULL/EASA/safety-pilot minutes; test equal completed-month windows and empty/dense/reversed/invalid date cases.
- Ensure latest flight has safe empty state, accessible direct link to the real flight, correct singular/plural; Recency links to credentials without fake assessment labels.
- The existing widget preferences migration must be explicit, reversible and protected. Keep critical pending/data-quality actions represented without duplicate navigation.
- Small bounded UI milestone, independent read-only design/data review before changing data projection and preference behavior. Candidate-bound typecheck, source/domain tests, build, safe isolated PostgreSQL and authenticated Playwright at exact work SHA.
- No production DB/migrations/flags/merge/deploy, no Training edits, no auto-prefill, no new dependencies.

## State and next step
Main and production baseline independently verified from GitHub/Vercel at prior readback: `main@470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`, `dpl_ABShRChWDdg4oCzuygKMvQHX3oSe` READY. This file is a docs-only V11 proposal on Draft PR #408.
**ONE NEXT STEP:** user reviews V11 interactive synthetic prototype and confirms design direction; freeze small D1 implementation contract, then independent read-only review before a scoped UI/data integration branch.
