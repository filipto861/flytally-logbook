# D1-A — Dashboard UI consistency audit (source-first)
Date: 2026-10-24 (UTC day). Scope: FlyTally Logbook Dashboard ONLY.
Base main: `470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`.
Branch: `docs/logbook-d1-dashboard-audit-20261024` (docs-only).
Owner priority: Dashboard → Flights list → Add Flight (Manual and GPS). **This is audit approval, not redesign/merge/deploy permission.**

## Method and authority
Read main AGENTS.md, the Logbook skills registry, complete apple-design SKILL + 17-chapter playbook, ui-ux-design, design-engineering, mobile-ipad, ui-quality-audit and External Design Quality V2. Inspect source on verified main, not historic Draft statements. Existing N2-B Dashboard workspace is already in main; do not recreate it or modify historical widget contracts.

## Exact source inventory
- `app/(protected)/dashboard/page.tsx`: all-time summary, configurable 5-widget overview, last flight/GPS links, conditional recency, header add-flight, right quick actions.
- `components/dashboard-editor.tsx`: preference editor, presets, reordering, save feedback.
- `lib/dashboard-widgets.ts`: frozen saved preference migration, enabled visibility, 5 overview widget IDs.
- `app/dashboard-customization.css`: layout sizes, editor row geometry and theme overrides.
- `app/ui-system.css`: late workspace styles including N2-B `.dashboard-home-layout`.
- `lib/data/dashboard.ts`: source-of-truth data aggregation — not in UI scope.
- Regression baseline: `tests/logbook-n2b-workspace-layout.test.ts`, old Dashboard tests.
- `docs/design-language.md`: brand and design tokens remain unchanged.

## Findings, evidence and treatment
| ID | Severity | Confidence | Source-backed observation | Required browser proof / proposed narrow treatment |
| --- | --- | --- | --- | --- |
| D1-01 | MAJOR candidate | CODE-INFERRED | `dashboard-editor.tsx` renders a success message only when `state.ok && !dirty`; local draft state is updated independently of action resolution. | Test save→immediate edit→response race and status announcement. If misleading, fix state association to submitted revision, not just styling; no backend contract change without separate review. |
| D1-02 | MAJOR candidate | CODE-INFERRED | `dashboard-customization.css` has `.dashboard-editor-row{background:#091625}` and fixed dark hover/focus styles, with an explicit `html[data-theme="light"]` override; no confirmed night-theme mapping. | Verify effective computed background/contrast in each supported theme and final CSS cascade. Replace *only confirmed* mismatches with existing semantic tokens. |
| D1-03 | MAJOR candidate | CODE-INFERRED | `.dashboard-move-controls button{width:34px;height:34px}`, below established 44px touch expectation; selected style may be overridden elsewhere. | Measure computed hit area at 320/390/768/1024, pointer coarse, 200% zoom. Increase hit target while preserving ordering and keyboard operation if really below 44px. |
| D1-04 | MINOR | SOURCE-OBSERVED | `/flights/new` appears in both top header and quick-actions rail. | Check perceived density and primary-action hierarchy. Keep duplication if useful on responsive layouts; do not remove without actual user-flow proof. |
| D1-05 | MAJOR candidate | CODE-INFERRED | The recency link renders only when a snapshot exists; absence yields no visible recency affordance on Dashboard. | Check approved recency/credentials contracts and actual empty view; design an explicit *unavailable/not configured* path if needed. Never invent CURRENT/compliance or age-based validity. |
| D1-06 | MINOR candidate | CODE-INFERRED | Five overview widgets may render distinct card structure/typography: hero, metric, linked panels. The grid has size and order customization. | Capture all visible layouts, long synthetic names/registration, zero/nonzero counts, custom ordering and narrow screens before changing geometry. |
| D1-07 | MAJOR candidate | CODE-INFERRED | Save editor disables submit while pending but does not visibly expose `aria-busy` or a status live region. | Test screen-reader announcement and duplicate-submit. Add semantic pending/status only where browser evidence confirms a gap. |

These are **not OBSERVED visual defects**. No authenticated screenshot/DOM computed CSS/real device evidence was acquired in this stage.

## Acceptance matrix (PENDING / NOT RUN)
- 1440px desktop, 1024/768px iPad emulation, 390/320px phone: layout, scroll, truncation, hit targets, focus order.
- Light/dark and night only if supported by runtime; actual computed style including last cascade and media query.
- Presets, saved custom order, disabled widgets, reset to default, cancel/re-edit while pending, save error/success, keyboard Enter/Tab/Space.
- Empty records, long synthetic registration and display name, 0 flights vs missing evidence, warning/action counts, missing recency snapshot.
- Screen-reader labels / aria announcements, 200% zoom, prefers-reduced-motion; no decorative motion (motion choice NONE).
- Native Safari/iPad, VoiceOver: NOT RUN and not implied by Chromium.
- `npm run audit:design` source scanner, test:design-audit, targeted tests, typecheck, build, risk-selected Playwright: NOT RUN on this docs-only branch.

## Frozen contract / DO NOT
No changes to aviation flight duration arithmetic, ULL/EASA/PIC classifications, GPS, SQL, preferences encoding, recency authority, auth, certification, production DB, migrations, feature flags, Training, branding or package dependencies. No silent auto-prefill. No production deploy/merge without separate owner approval. Existing N2-B layout must be preserved until acceptance identifies a concrete replacement need. Do not treat docs as implemented UI.

## Milestone checkpoint
- Current baseline: main full SHA above, GitHub source inventory confirmed.
- Evidence: read-only source review; browser and tests NOT RUN. Production Vercel previously independently READY on matching SHA deployment `dpl_ABShRChWDdg4oCzuygKMvQHX3oSe`; no deployment this stage.
- Changes: this document only; final work SHA/PR to be read back after push. Database/flags unchanged by this audit; runtime DB identity not inspected (UNKNOWN).
- Blocker: authenticated isolated browser session and disposable fixture needed for true D1-A visual findings; native Safari requires hardware.
- **ONE NEXT STEP:** run guarded Dashboard screenshot/DOM/computed-style audit with synthetic data, then freeze a narrowly scoped D1-B fix set for independent read-only review.
