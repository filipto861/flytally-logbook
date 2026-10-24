# D1-V4: three non-generic Dashboard design directions
**Status:** design study ONLY, no runtime implementation, merge or deploy. **Date:** 2026-10-24.
Canonical main: `470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`. Evidence: owner-local D1-A 30 screenshot Chromium study source `e57a888367022b672329026c6ef709da950dbc3c` (Draft PR #409); source audit and design proposal Draft PR #408. Production G3 Vercel `dpl_ABShRChWDdg4oCzuygKMvQHX3oSe` READY, untouched.

## Owner's latest decision
Likes Recency promoted more prominently than current Dashboard, requests several professionally composed, **non-generic / non-AI-look** concepts under existing Apple Design V2 + Design Quality V2 skills. Delegates product treatment of Customize to assistant. Previously agreed small copy/accessibility fixes stand, except do not polish a potentially retired editor unnecessarily.

## Concepts
| Option | Composition | Recency prominence | Suitability |
|---|---|---|---|
| **A — Editorial (recommended)** | Existing style of left navigation, one large grouped Total/ULL/EASA instrument, compact Latest Flight + actions | Dedicated large panel alongside core totals, direct link to evidence | Strong scanning, considered restraint, coherent personal pilot workspace |
| **B — Operations** | Compact navigation rail, horizontal metric row, recent-flight table, task list | Highest first-band priority across viewport | High-density and utilitarian; more operational than personal |
| **C — Quiet Brief** | Minimal surfaces, editorial type, horizontal rules, category comparison lines, recent-entry area | Horizontal section immediately below header | Distinctive but must check dense records, labels and affordances |

Synthetic standalone interactive HTML in conversation: `FlyTally_Dashboard_D1_V4_Three_Directions.html` (NOT committed or wired to real app). Light/Dark and A/B/C tab controls; all links/action buttons except preview controls are intentionally inert; synthetic figures 487:35/214:20/273:15 (not user flight data). No decoration library, gradients/glass/AI imagery or new FlyTally brand. Local Chromium `set_content` prototype-only validation 3 x 5 widths (320,390,768,1024,1440) x Light/Dark = **30 responsive cases**, all exactly one visible concept and no document horizontal overflow (>1px); **NOT** a production Next.js/app test, native Safari or accepted UX.

## Assistant's delegated Customize product decision
**Retire the on-page Customize editor from the everyday dashboard**, do NOT expand it merely to justify five available widgets. Existing editor actually supports reorder/size/visibility/presets, but only five overview IDs survive `DASHBOARD_OVERVIEW_WIDGET_IDS`; deeper PIC/recent/stat widgets require separate data models and queries, not a skin update.
**Preserve saved `dashboard_widgets` values and historical compatibility**. Existing users with non-default layouts must not have their layouts discarded, cleared, or irreversibly hidden. Implementation phase must explicitly design a reversible migration/choice path: new/default users may see curated V4, existing customized users retain their previous view until they explicitly opt into V4 (or equivalent user-reviewed migration); provide a settings/advanced recovery or revert path that never silently deletes legacy settings. Do not remove server save action or parsers before testing user-choice migration and rollback. Any additive JSON preference/version token is an engineering proposal requiring contract review, not an authorized DB migration.

## Information contract
Show source-backed Recency snapshot label and dates *only if eligible*, with direct link to `/credentials`. Missing data gives **Not assessed / Unavailable / Needs configuration**, NOT `CURRENT`, legal compliance, or zero. Never invent currency timer, EASA recency validity, aircraft/role applicability or GPS flight facts. Preserve `getDashboardOverviewData`, ULL/EASA/safety-pilot totals, last-flight link, only actual pending action counts and attention items. Use correct singular/plural. Personal logbook is not a charts analytics clone; Statistics owns detailed analysis.

## Apple/quality and acceptance
Motion **NONE**. Reuse existing FlyTally light/dark tokens, 11px controls/17px surfaces, type stack and focus, 44px touch expectation. Preserve dynamic empty, long-name and pending states; synthetic test account only. Match tested D1-A 0px overflow through 320px, add >1499 two-column threshold, 200% zoom, keyboard/screen reader and native Safari separately. Do not infer real runtime PASS from prototype. No new dependencies, brand change, auto-prefill, aviation/domain/recency/SQL/flag/prod DB change.

**ROADMAP amendment PROPOSED, not canonical yet:** D1 visual choice A/B/C → independent read-only DeepSeek/Claude critique of frozen visual/compatibility contract → small D1-V4 implementation PR+exact-SHA risk verification → separate merge approval and deployment approval → D2 Flights list → D3 Add Flight GPS + Manual.
**ONE NEXT STEP:** obtain owner feedback on A/B/C visual concept, freeze A (recommended) or alternative, then independent read-only review before implementation.


## 2026-10-24 — Final editorial design direction V9 after owner feedback (visual stage only)

Owner progressively accepted Editorial A, requested stronger Recency, **permanent Add flight in left panel**, removal of empty descriptive microcopy, compact single Latest Flight, and removal of the artificial/duplicated Quick Actions panel. V7 Quick Actions rejected, V8 visually accepted as direction; latest flight should live **inside the same visual card** as primary totals. V9 standalone prototype and user-persona design audit were produced **locally in this ChatGPT conversation**:
- `FlyTally_Dashboard_D1_Final_Editorial_V9.html` (visual interactive synthetic mock; Light/Dark and sample/empty account toggles; navigation intentionally inert).
- `FlyTally_D1_Final_Editorial_Design_Audit.md` (Apple Design V2 / Design Quality V2 human scenarios and implementation gates).

V9 structure: unchanged prominent Add flight in the left navigation (mobile header when sidebar collapses), a single Flying Summary card displaying total+ULL/EASA and a **compact integrated last-flight row**, and a separate prominent Recency panel with explicit **Not assessed** when no verified snapshot. No Quick Actions duplicated on the mock. The real application's outstanding action/data-quality signals **must still be preserved conditionally** when there are actual unresolved items, not removed silently. User's existing saved `dashboard_widgets` must never be destroyed or silently replaced; on-page Customize retirement needs a reversible user-choice path.

**Evidence:** local Chromium `page.set_content` rendered 320/390/768/1024/1440/1600 at Light and Dark (12 combinations); 12/12 document horizontal overflow=0, single Latest row, Add flight present, two main cards. Prototype sample/empty and theme controls worked. This is **PROTOTYPE PASS only**, not real Next.js app acceptance. Real CSS cascade/authenticated browser/production smoke/typecheck/build/Node/PG/native Safari/VoiceOver/night/200% zoom **NOT RUN**. Existing main G3 prod stays at `470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`, Vercel `dpl_ABShRChWDdg4oCzuygKMvQHX3oSe` READY. No code, merge/deploy/DB/flags/Training changes.

**ONE NEXT STEP:** owner reviews V9 mock and accepts/revises final visual composition; then submit revised ROADMAP and independent read-only review of compatibility before a new implementation PR.
