# Logbook U0 — owner-supplied screenshot/metrics review (21 Oct 2026)

**Evidence:** uploaded owner-local `FlyTally-Logbook-U0-Audit.zip` (ZIP SHA-256 `fb955f34ce9bacc84f5e2b9ef7cf08635e52165a306747bcae21d3c9de311327`); PNG/JPEG binary intentionally **not** stored in the repository. Snapshot JSON: `capturedAt=2026-10-21T11:02:55.136Z`, `commit=local` (NOT proof of SHA). Owner-local reported U0 runner 1/1 PASS in 2.9m, with isolated local DB v20/v21 migration and postcheck PASS at then-current branch head `1ce6cc0e`; not CI, not deploy.

## Exact coverage
- 110 JPEG screenshots + one JSON file; **11 screen states × 5 Chromium viewport presets × light/dark** = 110 metric rows and corresponding screenshots.
- Viewports: desktop 1440×1100, iPad landscape 1024×768, portrait 768×1024, mobile 390×844, narrow mobile 320×720. Touch emulation is NOT iPadOS/Safari acceptance.
- Screens: Login, Dashboard, Flights, Connections, Settings (/profile), New Flight (blank, aircraft-selected, PIC, DUAL, SAFETY PILOT, expanded disclosures).
- `horizontalOverflowPx=0` in ALL 110 metrics; this covers document root, not internal scrolling controls.

## Source- and screenshot-confirmed presentation findings

| ID | Priority | Evidence | Source/cascade | Next action |
| --- | --- | --- | --- | --- |
| U0-V01 | P1 | Required field hint effective font size **10.4px** in all **70** observed style samples (35 state/viewport combinations × two themes). Visible in New Flight and Settings, especially 320px/iPad. | `app/globals.css` original `.field-hint{font-size:.68rem}` line 151 overridden by later `label>small,.field-hint{font-size:.65rem}` around line 317; effect measured. | U2 scoped typography minimum and real computed-style regression, no unverified global cascade cleanup. |
| U0-V02 | P1 | Flight contextual helper effective font size **11.2px** in all **50** samples; small explanation text in expanded manual entry. | `app/ui-system.css` `.entry-context-note{font-size:.7rem}`, `.aircraft-context-card small{font-size:.68rem}`, `.optional-detail-note{font-size:.66rem}`. | U2 increase selected secondary copy without changing aircraft applicability/configuration. |
| U0-V03 | P2 | Sampled flight input first control effective size **12.16px** in 24 desktop/iPad-landscape samples versus **16px** in 36 narrower/coarse-pointer samples; sampled control height **48px** in each. | Existing responsive `app/globals.css` uses 16px for narrow/coarse pointer; evidence is a *sample of first input*, not all form fields. | Inspect input/select/textarea selectors before any wider font change. |
| U0-V04 | P2 | Dense secondary copy in Review & finish, especially 320px. | `app/ui-system.css` `.entry-certification-grid span{font-size:.62rem}` and `small{font-size:.6rem}` = 9.92/9.6px at 16px root. | U2 presentation-only text hierarchy improvements, preserve exact logbook/regulatory logic. |

## Needs reproduction (do not claim confirmed defects)
- **U0-R01:** On 320px Flights, segmented navigation and aircraft-category chips visibly extend beyond a scroll container. Root does not overflow. CSS intentionally defines `overflow-x:auto`; need touch/keyboard affordance + reachability test, not clipping claim.
- **U0-R02:** `smallTargetCandidateCount` includes ordinary inline `a[href]`, not only standalone controls; cannot interpret as number of Apple 44px / WCAG 2.5.8 failures without per-selector rectangles and exclusions.
- **U0-R03:** Sticky mobile header appears around middle of some full-page expanded-form images. This is consistent with screenshot capture after scrolling and sticky positioning, **not proven app defect**. Verify in real viewport/browser and optionally capture viewport screenshots.
- **U0-R04:** Prior source audit identified a keyboard-focus inconsistency in `components/flight-detail-workspace.tsx` after unsaved-change dialog cancellation. U0 screenshots do **not** include Flight Detail; treat as separate source-confirmed **U1** reproduction/repair, not screenshot proof.

## Positive evidence / non-coverage
- Both themes render the same core information architecture without observable root overflow even at 320px. New Flight expanded 320px tall document is ~3291px versus desktop ~1983px; single-column height is not itself an error.
- Explicit `Use LKPR` is a user-triggered button. Do **not** silently prefill/auto-apply the last airport, which the owner rejected.
- **NOT COVERED:** Flight Detail / edit / certify-correction, Aircraft photo/crop/manage, GPS import, Statistics, Map, Data/Print, Licences/Recency, error/loading/destructive states; native iPadOS/Safari, real keyboard + 200% zoom, color-contrast/WCAG assessment. No broad UI pass claim.
- Head-to-head screenshots were visually reviewed. Human review is qualitative; quantitative contrast ratio and direct touch tests NOT RUN.

## Planned implementation boundaries
1. **U1** separate narrow PR: cancel unsaved-change tab switch must not focus an unselected tab; targeted keyboard regression. Avoid flight-model edits.
2. **U2** separate CSS typography batch with after computed-style measurements across five viewports and two themes; no silent cascade removal.
3. U3 coverage for core unsampled workflows; U5 native device and responsive acceptance. Update `ROADMAP.md`, `FEATURES.md`, `CHANGELOG.md` per milestone.

**Status:** U0 browser capture PASS; U0 evidence reviewed; release quality/merge acceptance and source runtime fixes pending. No production/auth/DB/data mutation.