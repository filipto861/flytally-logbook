# N3-D0 — Visual Evidence Review: New Flight Manual + GPS

**Date:** 2026-10-23  
**Status:** D0 owner-local screenshot capture **PASS**; sampled visual review + all manifest metrics **COMPLETE**; keyboard, native iOS Safari, screen reader, actual authenticated production render and some unusual aircraft/GPS cases **NOT RUN**. D1 design **NOT APPROVED**.  
**Repository:** `filipto861/flytally-logbook`  
**Evidence SHA:** `2fd9ba65f3f7145ba25cfbcb8fa86da7158b6fb9` on `docs/logbook-n3-flight-entry-ux-discovery-20261023` (Draft #397)  
**User evidence:** locally produced archive `FlyTally-N3-D0-f6f060348071420395ee693b343c374d.zip` (provided in chat; do not commit archive or flight screenshots to a public repository). Synthetic, isolated browser fixture, not actual user's logs.
**Audit scope:** visual state/layout, cognitive load, clarity of missing requirements, GPS multi-part review, CSS theme/spacing from captured DOM. No source edits or release authorization.

## 1. Evidence validation and manifest

- ZIP: exactly **100 JPEG** files plus `n3-d0-manifest.json`, `n3-d0-partial.json`, `playwright-evidence.json`. Manifest `head` equals pinned source SHA; 100 `results` entries and 100 screenshot filenames, all 10 states × five viewport sizes × two themes.
- Viewports: `desktop-1440` 1440×900, `desktop-1024` 1024×800, `ipad-portrait-768` 768×1024, `mobile-390` 390×844, `mobile-320` 320×800. Themes `light` and `dark` applied by `document.documentElement.dataset.theme` in audit script. These are Chromium viewport emulations, not iOS Safari hardware.
- States: `manual-blank`, `manual-pic`, `manual-dual-missing-instructor`, `manual-safety-pilot-missing-pic`, `manual-disclosures-open`, `gps-empty`, `gps-invalid-source`, `gps-single-unreviewed`, `gps-single-aircraft-selected`, `gps-two-flights-unreviewed`.
- Owner-local `npm run build` including TypeScript **PASS**; synthetic PG16 physically owned/empty localhost fixture; v20/v21 migration registry/columns/checks **PASS**; Playwright **1/1 PASS**, `retries=0`, no reported horizontal overflow; owned database shutdown and unique TEMP cleanup **PASS**. These confirm capture execution, **not UX acceptability or operational performance**.
- Manifest fields reviewed for all 100 cases; visually inspected representative full-page screenshots across Manual/GPS, PIC/DUAL/Safety Pilot, invalid source, multi-part GPS and light/dark mobile/desktop; computed CSS read from evidence. No synthetic screenshots were added to Git.

### Measured full-page height (light theme)

| State | desktop 1440×900 | mobile 390×844 | mobile 320×800 |
| --- | ---: | ---: | ---: |
| Manual blank | 1,725 px | 2,450 px | 2,690 px |
| Manual PIC | 1,592 px | 2,295 px | 2,545 px |
| Manual DUAL missing instructor | 1,647 px | 2,337 px | 2,573 px |
| Manual Safety Pilot missing PIC | 1,734 px | 2,554 px | 2,802 px |
| Manual all four disclosures open | 3,193 px | **4,796 px** | **5,155 px** |
| GPS empty | 900 px | 923 px | 948 px |
| GPS invalid source | 1,306 px | 1,631 px | 1,726 px |
| GPS one flight, not reviewed | 2,288 px | **3,366 px** | **3,528 px** |
| GPS one flight, aircraft selected | 2,622 px | **4,099 px** | **4,338 px** |
| GPS two flights, not reviewed | **4,043 px** | **6,144 px (7.3 screens)** | **6,390 px (8.0 screens)** |

*Page height measures all rendered document contents, not scroll travel or interaction time. No horizontal overflow was reported by the capture across the full 100 matrix. Values are transcribed from the uploaded manifest.*

## 2. Observed findings vs unverified hypotheses

| ID / priority | Grounded observable evidence | UX impact | Candidate remedy; preserve contracts |
| --- | --- | --- | --- |
| N3-V01 · **P1** | `manual-blank__desktop-1440__light.jpg`: "Complete before save: Aircraft" while **Save draft** stays available; equivalent `manual-dual-missing-instructor` says "Instructor / PIC". `manual-safety-pilot-missing-pic__mobile-390__light.jpg`: Actual PIC missing but notice only at bottom. | Contradictory terminology, and users must scan/scroll for precise issue. Draft save may intentionally allow incompleteness; NOT a proven domain bug. | Replace with distinct **Draft: can save with incomplete info** and **Certification: 1–N items require review** states, with a persistent non-blocking summary near the top and direct focus links. |
| N3-V02 · **P1** | `gps-single-unreviewed__desktop-1440__light.jpg`, `gps-single-aircraft-selected__desktop-1440__light.jpg`: "Needs attention" appears multiple times, without a concise list; generic "Complete flight details" button. One single-flight selected screenshot needs explicit Operation and Engine, identified much farther down at footer. | User knows something is wrong but cannot see the reason or its location at the primary action. | Reuse existing authoritative `ready`/context/evidence breakdown for **specific blocking reasons per section/per flight**, count and link/focus to correction, without changing save rules. |
| N3-V03 · **P1** | `gps-two-flights-unreviewed__mobile-390__light.jpg` and manifest: **6,144 px** on 390, **6,390 px** on 320, with upload, split sliders, map, altitude/speed, common crew, full Flight 1 form, full Flight 2 form, final save status in one flow. | Very long scroll; users lose flight identity and cannot quickly compare which of two portions is incomplete. | Compact list of Flight 1/2 statuses and **one expanded editor** with explicit switch and safe preservation of unfinished part values. Split tool as user-driven contextual disclosure; multi-flight still saves drafts only. |
| N3-V04 · **P1, verify root cause before any fix** | `manual-pic__desktop-1440__dark.jpg`, `gps-invalid-source__mobile-390__dark.jpg`, `gps-single-aircraft-selected__mobile-390__dark.jpg`: dark internal sections and input controls coexist with near-white outer shell/cards; some labels/input text are visually dark against dark surfaces. Manifest `manual-pic` dark shows `mode.backgroundColor=rgb(255,255,255)`, `panel=rgb(255,255,255)`, `essentials=rgb(9,21,30)`, `save=rgba(8,19,27,.933)`; in light both mode and essentials are white. | **Potential serious contrast/readability defect** in the synthetic dark DOM state. | First reproduce via *supported product theme preference*, determine final cascade/colors/contrast and root cause; then apply scoped selectors/tokens. Because harness forced HTML `data-theme`, DO NOT claim all actual users' dark theme is defective without independent real-state verification. |
| N3-V05 · **P2** | `gps-invalid-source__mobile-390__dark.jpg`: visibly **0 GPS points** while the upload chip says **1 suggested flight**; "Review & finish" still shows partial placeholder evidence/landing and CTA says "Complete flight details". | Incoherent copy implies that invalid source yielded a valid flight. This is not proof that bad GPS can actually be saved. | Clear **Unable to identify a flight from this source** empty/error state; disable progression until credible parsed movement, allow re-upload; avoid spurious numerical/default confidence. Verify parser+action behavior separately. |
| N3-V06 · **P2** | In `manual-blank` and DUAL desktop screenshots, `.entry-save-state` appears as a **sticky bar across middle of full-page screenshot**, overlaying sections. Manifest computed `save.position=sticky` at desktop, `static` on mobile, with distinct card radii `mode 13px`, `panel 10px`, `essentials 9px`, `save 8px`. | Capture shows a bar intersecting content visually. An actual in-viewport obstruction is not proven from full-page stitching; sticky behavior must be tested while scrolling and when keyboard opens. Mixed radii weaken hierarchy. | Separate location/context of Save actions from field corrections, verify scroll/keyboard hit area; align with current FlyTally design tokens only after final cascade analysis. |
| N3-V07 · **P2** | Screenshots show repeated prominent "New flight", "Flight details", "GPS import", "Upload track", "Flight context", "Review flight", "Review & finish"; GPS at one part has 2,622 px desktop and 4,099 px phone with selected aircraft. | Multiple high-emphasis headings compete for user attention instead of indicating the active task. | Collapse repeated language into one page title and concise ordered conceptual groups, with clear local status. No invented rigid wizard or silent auto-advance. |
| N3-V08 · **P2** | Manual PIC ready summary can show unfilled route/time placeholders while `Save & certify flight` is visually enabled in a synthetic screenshot. | A user may not understand what's optional, what's unknown and what's valid for certification. | **Investigate server-side certification requirements and UI state contract first**; no evidence of invalid record being saved. Clarify "optional/not entered/requires evidence" separately; never block or accept based only on UX assumption. |
| N3-V09 · **P3** | `gps-single-unreviewed` and `gps-two-flights-unreviewed` show high-detail map/replay and repeated warnings before final editing. | Valuable evidence is presented at the same visual level as basic data entry, especially on narrow screens. | Make optional map/profile accessible as a contextual review affordance, with automatic EXPAND only when source-quality ambiguity requires attention; keep provenance and UTC/manual overrides visible. |

### Source-backed but not yet visually/behaviorally proven in D0

- Mode switches keep both form components mounted and hidden rather than unmounting, with independent dirty guards; potential cross-mode unsaved warning or reduced-motion defects **remain hypotheses** until an interaction test reproduces them.
- A file-read `catch{return}` exists on GPS input; no D0 fixture specifically triggered a file API read exception. Classify feedback defect as **PENDING REPRO**, not an observed runtime failure.
- Keyboard focus, screen reader, VoiceOver, native iPad Safari, Sailplane/Balloon applicability, ambiguous GPS timezone / poor GPS signal beyond sampled invalid file, 3+ multi-flight parts, and actual save/certification E2E were **NOT RUN** in this visual capture. No production user data was used.

## 3. D1 candidate designs — NOT YET APPROVED

### A — Contextual one-page (recommended for minimal blast radius)

```
New flight                   Manual | GPS
[Review status: 2 things need attention] [Go to first]
----------------------------------------------------
FLIGHT BASICS: Date, Aircraft, Role (+ truly required crew)
ROUTE & TIMES: departure / arrival / four UTC times
EVIDENCE: relevant landings/launch/movement only
More details: Aircraft context · Crew · Training · Costs
----------------------------------------------------
Review summary: editable draft vs certified record explained
[Save draft]                      [Save & certify]
```

For GPS same shared outer status language, but top becomes **Upload & evidence**, then **Common aircraft/role**, then **Flight 1 / Flight 2 compact status list** and one expanded flight editor. The optional map/profile/track split controls are preserved in review disclosures. All warnings and explicit user overrides retained. Top-level summary is non-sticky or minimally sticky depending on verified scroll ergonomics; footer actions remain deliberate and safe. This uses current form/actions/components and CSS tokens with low-to-moderate refactor risk.

### B — Focused task worklist (more change, more risk)

```
New flight             Manual | GPS
[Flight] [Evidence] [Review]   (explicit navigational group choice)
-------------------------------------------------
ACTIVE TASK BODY: only the selected group, others collapsed
[Needs attention: precise items] [Jump to field]
-------------------------------------------------
[Save draft]       [Review & certify]
```

Not a wizard; no forced forward sequence. Users may reopen any task before saving, with incomplete requirement indicators. GPS adds list of detected flights and per-flight evidence states. Requires more state/focus/URL/keyboard/accessibility testing; if hidden group becomes required due to changing role/aircraft, it must be revealed automatically with context preserved. Would need stronger New vs Edit adapter discipline.

**Recommendation:** start D1 with **A** plus compact per-flight GPS review, because the primary demonstrated pain is scanability/copy, and the existing domain forms already support much of this. Choose B only if owner testing shows a single expanded canvas is still cognitively overwhelming.

## 4. Acceptance criteria for proposed N3-M1…M4 (not implementation authorization)

1. Manual *blank*, PIC, DUAL missing instructor, Safety Pilot missing actual PIC, standard and category-specific (Sailplane/Balloon) contexts show truthful, **specific** required-state summaries and focus targets; never invent defaults.
2. Required and optional values remain differentiated: **Save draft may be allowed** while **certification requires validated evidence** as current server rules define; no new aviation claims.
3. GPS 0-point invalid file has clear non-progressing state; one-flight valid and split multi-flight parts have per-part current-status/remaining-evidence labels; explicit override and source/manual provenance never auto-applied or lost.
4. Switching mode or part and editing values does not silently reset dirty/manual state; errors have actionable corrective path; pending save prevents duplicate submit.
5. Responsive 1440/1024/768/390/320 light/dark computed contrast and focus; no horizontal overflow, no sticky overlay over controls, reduced motion and keyboard accessible. Native Safari remains a separate manual evidence requirement.
6. Reuse `FlightForm` New/Edit semantics and shared persisted actions unchanged unless separately authorized; no new dependencies, schema, feature flags, Training, build pipeline or production data changes.
7. Execute candidate-bound planner, targeted DOM/source, domain, browser, PostgreSQL and build gates selected for exact HEAD after any code edits, then document and seek owner approval before merge/deploy.

## 5. Gate, status, next step

**N3-D0 screenshot matrix:** PASS for 100 synthetic cases, no reported horizontal overflow. **N3-D0 UX conclusion:** issues visually observed in representative screenshots, CSS-backed; accessibility and native Safari PARTIAL/NOT RUN. **D1 proposed layout:** two concepts above, recommendation A, **awaiting owner design freeze**. No app change, no merge/deploy/DB operation. Source candidate remains at pinned SHA unless further docs-only commits.

**ONE NEXT STEP:** have product owner review the N3-D0 report and explicitly choose A/B (or refinements) for D1 design freeze, then request read-only DeepSeek/Claude review of focused interaction contracts before M1 implementation.
