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


## 2026-10-24T14:38:26Z — owner-local D1-A visual evidence reviewed

**Exact observed source:** screenshot JSON `sourceSha=e57a888367022b672329026c6ef709da950dbc3c`, matching Draft #409 work HEAD at upload review. Evidence ZIP `FlyTally-D1-Dashboard-Audit-e57a88836702.zip` SHA256 `d2c1338d1fa87057cc50b3922112c563fe51ea53236df953f3abe7abf2a4d843`. Contains exactly 30 PNG captures, 1 `dashboard-audit.json`; JSON SHA256 `176b7abb1dc48ca826ee3fb7197c06d01537aafb8a506473c2ea3fe25990d1f8`. Source SHA is original #409 capture candidate (test/docs only); its application runtime remains canonical G3 `main@470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9`. Capture JSON reports `CAPTURED_WITH_FINDINGS_POSSIBLE`; **this is not an independently verified release runner exit code**.

Captured Chromium combinations: 1440x900, 1024x768, 768x1024, 390x844, 320x720; Light and Dark; closed overview, editor open, unsaved Instructor preset = **30 screenshots / 30 measurement rows**. Synthetic pilot has 1 sample EASA flight, 0 ULL; no genuine private pilot data. Computed CSS and screenshot inspection performed; native iPad Safari, VoiceOver, server save race, zero-flight fixture, 200% zoom, 1600+ layout **NOT RUN**.

### Observed findings, after reconciliation with screenshots and effective CSS

| ID | Severity | Evidence | Verified observation | D1-B decision / acceptance |
| --- | --- | --- | --- | --- |
| D1-03 | **MAJOR** | OBSERVED (measured) | All 10 editor-open viewport/theme cases have **10 reorder controls**; each is 34x34 CSS px on desktop/1024, or 34x44 on 768/390/320. Width is <44 in all. Original automated `undersizedMoveControls=30` also counted controls while collapsed: **measurement false-positive for overview states** (DOM bounding boxes alone do not prove accessibility/paint). Restrict authoritative finding to 10 open-editor cases. | **ACCEPT targeted B1:** enforce minimum 44x44 pointer target without clipping, preserving up/down keyboard semantics, disabled state, selected order and no added motion; browser acceptance on all 5 widths. |
| D1-07 | **MAJOR accessibility candidate** | OBSERVED DOM, not screen reader | Open editor shows no `[role=status]` or `[aria-live]` across 10 cases; component uses pending button text and disabled submit. Capture did NOT test actual save success, error, race, VoiceOver. | **ACCEPT targeted B1** after source/accessibility review: announcable save pending/success/error/unsaved state; no false saved confirmation; preserve user changes and asynchronous submit lock. Browser keyboard + delayed save response required. |
| D1-08 | **MINOR** | OBSERVED screenshot + source | Flying-time and EASA metric show grammatically incorrect `1 flights · 1 landings` for the 1-flight synthetic fixture (Dashboard `CategoryCard` / total-time hero). All numbers and computed totals otherwise internally consistent for this fixture. | **ACCEPT targeted B1** only pluralization strings; never change numeric aggregations or flight category semantics. |
| D1-09 | **MINOR** | OBSERVED screenshot + measured | Closed `Customize dashboard` control is exceptionally quiet at the bottom: desktop measured 151x21 px, small type from source `.66rem`; mobile measured 151x44 px. Not clipped, but desktop target/legibility merit review. | **ACCEPT B1 or B2** increase visual legibility and interactive target using existing button/summary language; no new navigation or layout overhaul. |
| D1-04 | **MINOR design choice** | OBSERVED | Visible direct Add flight links count **3 at desktop 1440/1024** (sidebar, header, rail) and **2 at 768/390/320** (header + rail). No clicks blocked; duplicates are not a functional regression by themselves. | **OWNER DESIGN CHOICE, B2** evaluate whether removing rail duplication improves scanning without losing access on mobile; preserve main visible CTA. |
| D1-05 | **MAJOR evidence-sensitive** | OBSERVED absence, not defect | Recency link is absent in **all 30** captures because synthetic preferences have no snapshot. There is still global `Licences & recency` navigation on desktop. Missing snapshot != current/unexpired/unqualified. | **DEFER / READ CONTRACT** before adding an explicit neutral `Unavailable / Not configured` state; no inferred CURRENT, no invented thresholds. |
| D1-02 | **NOT CONFIRMED defect** | OBSERVED effective style | Editor row computed surface light `rgb(248,250,252)`, dark `rgb(9,22,37)`; screenshots show no immediately apparent dark-on-light failure. Explicit theme overrides work for tested Light/Dark; night mode not tested. | **NO global token replacement**. Fix only separately demonstrated contrast failures. |
| D1-06 | **NOT CONFIRMED defect** | OBSERVED | 0 px document horizontal overflow for **30/30** states; 4 visible default widgets and readable Light/Dark stacked layout down to 320 px. Dynamic sidebar/mobile navigation is not visibly blocked in static screenshots. | **REJECT blanket layout replacement**; preserve N2-B and existing saved sizes; review crowded-data and 200% zoom before geometry changes. |
| D1-10 | **COVERAGE GAP** | SOURCE+EVIDENCE | At 1440 px Dashboard Quick Actions remain below widgets, since N2-B side-rail activation is above 1499 px. 1440 is therefore **not** a test of desktop two-column workspace. | Additional 1600/1920 and threshold 1499/1500 captures before declaring rail PASS. |
| D1-11 | **SCREENSHOT ARTIFACT** | OBSERVED with full-page capture | Some `editor-open`/preset full-page mobile PNGs show sticky mobile header rendered midway through stitched page after auto-scroll to editor. This is NOT by itself evidence of a page overlay bug; check actual viewport screenshots while scrolling. | **Do not patch sticky header based on stitched PNG alone.** |

### D1-B freeze candidate — after independent read-only DeepSeek/Claude review
**Batch B1, narrow/low-risk:** minimum 44px move-button hit box, accessible editor save status and reliable pending/dirtiness semantics, singular/plural labels, readable `Customize dashboard` affordance. Scope to `components/dashboard-editor.tsx`, `app/dashboard-customization.css`, and `app/(protected)/dashboard/page.tsx` text only plus targeted tests/E2E. Ensure CSS effective cascade from `app/ui-system.css`; preserve all saved preferences/contracts, no new packages, no new motion, no data change. Audit B1 at exact candidate, 320/390/768/1024/1440, Light/Dark, keyboard/focus, pending/error, repeat interactions and disabled states. **No implementation approval implied by audit completion.**

**Batch B2 (later decision):** Quick Actions hierarchy/duplicate CTA, neutral recency fallback only if source-backed, and full >1500 workspace proof. Do not mix B2 or D2/D3 into B1.

### Gate interpretation
Artifact completeness/DOM measures: observed. Browser runner exit status not independently supplied; local production build, SQL fixture ownership/teardown asserted by wrapper but no separate console transcript, so **NOT independently VERIFIED** from ZIP alone. N2-B baseline pages visibly render in Chromium; native Safari/iPad real device and real production authenticated smoke **NOT RUN**. Build/Node release for any future UI code candidate **NOT RUN**. No flight totals recomputed, no production operations, no merge/deploy.

**ONE NEXT STEP:** independent read-only review of frozen D1-B B1 candidate, then implement only accepted B1 findings on a separate branch and execute exact-HEAD risk-selected tests before owner review and merge.

## 2026-10-24 — Owner requested a stronger Dashboard look and questioned Customize value

Do not automatically apply previous D1-B customize size/status polishing as its feature may be retired or relocated. Verified implementation already supports visibility/order/size/presets but only five overview widgets are exposed. Owner accepts other B1 fixes, requests a visibly different skill-led composition, and says Customize should be made meaningful or removed. **Retirement/expansion choice remains open.** See [D1-V3 design choices](LOGBOOK_D1_DASHBOARD_V3_DESIGN_OPTIONS_2026-10-24.md) for options, a recommended purposeful layout, compatibility guard and proposed ROADMAP amendment. No UI code changed and no merge/deploy/DB/flags authorized. One next step: owner reviews V3 prototype and chooses A (retire compatibly), B (meaningful features), or C (move to Settings temporarily).
