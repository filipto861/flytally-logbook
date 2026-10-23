# N3-M1 — owner-local visual after-state audit (Manual + GPS)

**Date / evidence capture:** 2026-10-23, manifest `capturedAtUTC=2026-10-23T16:55:43.956Z`.
**Repository:** `filipto861/flytally-logbook`; Draft PR #398 stacked on N3 docs Draft #397 (base `docs/logbook-n3-flight-entry-ux-discovery-20261023@22aeb50845e4db89eb6eb1f1addb19246cf37fd0`).
**Exact capture HEAD:** `97f67c08b25312c9af07948a489b0a02e6167579`. Manifest `runtimeSourceSHA=d323da4524d24b6835f272d9d47baadb65d4a305` is the earlier source-identical app implementation; `97f67c08b25312c9af07948a489b0a02e6167579` includes a documentation-only checkpoint. `main=3af54d4f4d0651b430452dd3f5b8513e134f5c6a` remains distinct from both.
**Evidence artifact:** owner-provided `FlyTally-N3-M1-Afterstate-afc04f89a6ac451985ae8dc9db8b4494.zip` (synthetic screenshots and manifest in chat, not committed to GitHub).
**Review status:** visual/manifest review completed for sampled full-page screenshots across all modes and representative desktop/mobile/tablet states; **owner visual acceptance NOT PROVIDED**. Full release gate, real theme preference, screen reader and native Safari **NOT RUN**. No merge or deployment authorization.

## 1. Provenance and independent archive integrity

- Archive inspected: **91 files** — **90 JPEG** plus `n3-m1-visual-manifest.json`. Exactly 9 scenario labels × 5 named viewports × 2 themes. Each manifest row has an existing matching screenshot; no listed `failures`, `status` successful, no missing `entryReview.exists`, all reported `horizontalOverflowPx=0` (90/90).
- Five synthetic Chromium viewports: desktop 1440×900, iPad landscape 1024×768, iPad portrait 768×1024, mobile 390×844, mobile 320×800. Themes forced through Chromium `colorScheme` and `documentElement.dataset.theme`, **not** actual account appearance preference. No native Safari, VoiceOver, real device, or real flight data.
- Exactly 9 scenarios: `manual-blank`, `manual-aircraft`, `manual-dual-focus`, `manual-safety-pilot`, `gps-no-source`, `gps-invalid-source`, `gps-valid-needs-aircraft-focus`, `gps-aircraft-selected`, `gps-two-parts`.
- Owner PowerShell evidence: clean SHA, typecheck PASS, 3/3 N3-M1 targeted Node PASS, `verify:plan -- --base origin/main` PASS with **22 selected browser targets, zero blockers**, Next.js 16.3.2 production build PASS, owned isolated/empty loopback PG16 physical identity PASS, schema-first browser fixture v20/v21 PASS, **2/2 authenticated desktop Chromium** targeted tests PASS, new visual capture **1/1 Playwright PASS**, manifest **90/90**; single browser worker, no retries; unique owned PG16 server stopped and temp directory removed. Screenshot capture is *diagnostic evidence*, not one of the 22 approved risk-selected release browser targets. Full candidate release status **NOT RUN**.
- Manifest reports `saveOrCertifyTriggered=false`. No production DB records/migrations/flags touched. Do not commit synthetic screenshots to the repository.

## 2. Directly observed M1 behavior

| ID | Evidence | Result and qualification |
| --- | --- | --- |
| M1-V01 — PASS, visible orientation | Every sampled state has an in-content, non-sticky top `Entry Review`; Manual blank presents Aircraft, DUAL Instructor/PIC, Safety Pilot Actual PIC; GPS blank asks for source; invalid source displays usable-source warning; GPS selected aircraft shows Operation / Engine. | M1 contextual status is visually legible in Light/Dark/320–1440; existing business rules not tested by screenshots. |
| M1-V02 — PASS, focus for tested paths | Manifest `activeElement` on `manual-dual-focus` is `INPUT name=instructor` for all viewports/themes; `gps-valid-needs-aircraft-focus` is `SELECT name=registration` for all viewports/themes. Earlier targeted authenticated Playwright also exercised these actions. | Specific tested direct-to-field actions PASS; **other actions, 3+ GPS parts and full keyboard/screen-reader behavior NOT RUN**. |
| M1-V03 — PASS, layout overflow | Manifest reports no page-level horizontal overflow in any of 90 captures; screenshots show existing navigation and main controls within viewport at mobile 320/390, tablet 768/1024, desktop 1440. | PASS within synthetic Chromium / full-page capture only; text zoom, keyboard overlay and real Safari not covered. |
| M1-V04 — P2, persistent misleading GPS source metadata | `gps-invalid-source__mobile-390__light.jpg`: upload says `0 GPS points` but simultaneously `1 suggested flight`. New top review correctly says `Choose a GPS source with usable flight data`, yet quality acknowledgement and generic `Complete flight details` also remain. | **Reproduced D0 finding N3-V05; M1 improves top-level warning but does not fix the original misleading metadata**. Treat as GPS presentation follow-up; do not infer invalid GPS saves, and do not modify parser/split/validator just for display. |
| M1-V05 — P2, manual readiness copy not equivalent to certification | `manual-aircraft__mobile-390__light.jpg`: `No outstanding form checks` appears after aircraft/role selected while four time controls still show placeholders. The copy does say server validates the final action, and Save/Certify contracts remain unchanged. | User could interpret it as ready to certify. **Not evidence that invalid flight certification is possible**. Review certification requirements and selected save behavior before modifying labels, gates or required fields. |
| M1-V06 — P1 deferred to M3, high cognitive load | `gps-two-parts`: 7,631px at 390 and 7,944px at 320; upload, split editor, map/profile, context and both long flight editors all remain in one scroll. Only high-level missing Operation / Engine are presented in the top summary for the tested synthetic profile. | M1 never promised a shorter GPS editor. Prior D0 390px two-flight page was 6,144px, but the D0 state/disclosures and after-state aren't strictly identical; **do not call the numerical difference a measured regression**. M3 needs one-active-flight editor with independent unsaved per-part state and visible per-part completion. |
| M1-V07 — P2, limited visual claims | In sampled light/dark screenshots the new review panel is integrated with FlyTally surfaces; no clear cutoff/overlap in the observed first screen. Full-page screenshots after focus can place the sticky header mid-document due to browser full-page capture/scroll state. | No demonstrated M1 collision, but **native scroll/keyboard overlap NOT RUN**. Dark-mode screenshots are forced Chromium state, not actual account preference; earlier D0 contrast hypothesis N3-V04 remains pending native/real-preference reproduction. |

### Measured rendered page heights (light, px)

| State | Desktop 1440 | iPad 1024 | iPad 768 | Mobile 390 | Mobile 320 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Manual blank | 1,899 | 1,899 | 2,285 | 2,626 | 2,886 |
| Manual aircraft selected | 1,711 | 1,716 | 2,099 | 2,415 | 2,685 |
| Manual DUAL focus | 1,821 | 1,825 | 2,196 | 2,514 | 2,769 |
| Manual Safety Pilot | 1,909 | 1,913 | 2,394 | 2,730 | 2,998 |
| GPS no source | 1,013 | 1,025 | 1,078 | 1,080 | 1,132 |
| GPS invalid source | 1,475 | 1,516 | 1,627 | 1,816 | 1,910 |
| GPS valid, aircraft missing | 2,457 | 2,752 | 2,896 | 3,543 | 3,704 |
| GPS aircraft selected | 2,790 | 3,188 | 3,327 | 4,328 | 4,566 |
| GPS two parts | 4,846 | 5,455 | 5,795 | **7,631** | **7,944** |

*These are synthetic full-document heights, not measured scrolling time, interaction latency or data validity. The manifest logs scroll/focus state for selected scenarios; do not equate full-page stitched sticky controls with an actual in-viewport obstruction.*

## 3. Proposed next step — M2 Manual restructuring; NOT YET OWNER APPROVED

**M2 design intent:** improve comprehension of existing Manual New Flight form without a rigid wizard. Keep M1 top-level review, then group the existing, actually relevant fields into a scan-friendly **Flight basics** (date/aircraft/role plus conditional crew), **Route & UTC times**, and a concise **Flight experience** area (applicable landing/launch/movement), followed by predictable disclosures for advanced aircraft context, training, costs and notes. The existing review/save section remains separate; draft vs certification wording must remain truthful.

**Discover first:** map actual New/Edit shared component boundaries, category-specific fields (Aeroplane/ULL/Sailplane/Balloon/Helicopter/Other), existing open/close/focus state, validation and server actions. Preserve existing conditional rendering/controlled state, no default aircraft/airport prefill or inferred regulatory credit. Avoid broad CSS refactors, new packages, brand/color changes and animation. Motion NONE. M2 implementation should be a dedicated small stacked Draft only after owner acceptance of this design direction.

**M2 acceptance proposal:** exact same create/edit behavior (Edit visually unchanged), focus to every invalid/required field, Save draft vs Save & certify unchanged, manually entered/omitted/zero values preserved, conditional required crew visible on role change, no hidden/disabled native inputs lost to form submission, responsive Light/Dark mobile 320/390, tablet 768/1024, desktop 1440, keyboard/focus/touch, source/domain regression plus risk-selected browser and locally owned PG16 when planner requires. Native Safari remains a separate manual check.

**M3 separate scope:** GPS one-active-flight editor and compact per-part status with explicit part switching and retention of unsaved per-part overrides; only after M2 review and explicit owner choice. Retain split algorithm, source provenance, manual corrections, multi-flight draft-only, stored flight invariants.

## 4. Risks, release boundary and one next step

- **Not a release PASS:** selected browser 22 targets remain mostly unexecuted; full source/domain/Node, full PostgreSQL integration, release risk, 320/390 + iPad input-device fidelity, accessibility and native Safari NOT RUN. Real production app does not include M1.
- Real owner visual acceptance **PENDING**; no merged #397 or #398 and no production deployment, migration, restore, delete or feature-flag change. Production Vercel last observed READY `dpl_EkZZoHyWoYZsfp4AzubGBcziXUVz` at `3def2c3618d1b2a185d39b15df69c1613180751b` (not M1).
- **ONE NEXT STEP:** present this M1 visual audit, the reproduced GPS invalid-source contradiction and limited Manual ready wording to owner; obtain approval to start M2 scoped Manual restructuring before changing UI/runtime. No merge/deploy authority follows from this checkpoint.
