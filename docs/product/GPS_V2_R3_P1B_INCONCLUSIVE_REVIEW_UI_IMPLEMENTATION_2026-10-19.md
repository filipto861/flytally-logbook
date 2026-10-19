# GPS V2 R3-P1B — Inconclusive altitude quality notice in existing import Review

Date: 2026-10-19
Branch: feat/gps-v2-r3-p1b-inconclusive-review-ui-20261019
Base: R3-P1A research branch; Draft PR #371, verified P1A native code HEAD 8af85d46
Status: IMPLEMENTATION STAGED / LOCAL P1B TESTS NOT RUN / EXPERIMENTAL FLAG OFF / NO RELEASE.

## 1. Verified prerequisite P1A

Owner-local results received on P1A native code head `8af85d46`: **142/142 targeted Node tests PASS**, `npm run typecheck` PASS, and **6/6 original private KML reports with frozen R2-2 rejected-window parity**. sample04 yielded one quality context covering one rejected legacy altitude window; sample07 yielded **one quality context for two overlapping rejected windows sharing one bad source edge**, with an accompanying >15s unobserved data interval; other four sources returned NO_QUALIFYING_DIAGNOSTIC. This is source-geometry evidence only, not physical contact truth. Owner personally reported rolling wheel contact in sample07; remains first-party REPORTED_CONTACT_UNCORROBORATED. No independent contact evidence.

P1A verification was **OWNER LOCAL**, not CI; full suite, build, browser were not run there. This P1B milestone changes UI, so that prior P1A success does **NOT** validate P1B.

## 2. Actual implementation, deliberately narrow

1. `lib/gps-r3-quality-review.ts`: a typed, pure bridge explicitly limited to the **reviewed, browser-compatible P1A research source-quality inspector**; not the Node R2-2 source-shape inspector. It passes exact current original `sourceText`, exact canonical `points` and current `cuts`, with pinned P1A revision. It exposes `hasGpsR3QualityReview` only when actual status is QUALITY_REVIEW_ONLY and nonempty. No file/DB/network operations.
2. `components/gps-altitude-quality-review.tsx`: render-only P1B warning inside existing GPS `Review GPS track`. Shows one or multiple *source-height discontinuities*, never T&G proposals. If P1A marks a >15s source interval, says motion during the gap is unknown. Explains that GPS cannot confirm wheel contact and flight landing count must be reviewed manually. No source index, raw altitude, UTC, location, file identity, acceptance button or form fields.
3. `components/kml-import-form.tsx`: only one new separate opt-in flag and memoized local diagnostic. Uses `NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW==="1"`; default OFF. The parent gates both P1A computation and component render on this flag. Memo recomputes when uploaded `analysis` or validated `cuts` changes, so stale contexts cannot silently persist. `gpsReviewNeedsAttention` opens the existing disclosure when an actionable source quality issue is present, even if generic GPS quality is otherwise good. Warning appears **before** profile player for visibility. Existing native V2 `NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY` remains independently gated unchanged.
4. `app/v142-gps-import.css`: local styles reusing `--line`, `--panel2`, `--text`, `--muted` plus small-screen padding; no new palette, toast, overlay, icon clutter, event marker or breakpoints that override existing layout.
5. `tests/gps-v2-r3-p1b-ui-contract.test.ts`: **14 authored (NOT RUN)** static and pure-adapter regression cases: default OFF, independent V2, exact file/split memo, unsupported/no qualifying => no card, privacy, long unobserved motion caveat, no form fields, legacy markers untouched, source/cut invalidation, review auto-open, source parity, design tokens/accessibility and no quality-seeking or new flight authority. Existing `tests/gps-v2-ui-contract.test.ts` and `tests/gps-v2-import-lineage.test.ts` must remain PASS.

## 3. Invariant and UX contracts

- Strict native V2 `UNSUPPORTED_SOURCE` for multi-gx:Track KML remains unchanged. P1B is a **separate quality warning** and its presence does NOT enable native V2 pattern suggestions for sample07.
- No modifications to `landingCount()`, `touchAndGoEvents()`, imported flight `Review.starts`, `landingsDay`, `landingsNight`, `takeoffs`, PF, recency, certification or `app/(protected)/flights/actions.ts` form mapping. The legacy suggestion is unchanged; pilot may manually edit final totals using existing controls and existing validation.
- No new `name`-bearing inputs, hidden fields, P1B save action, auto apply, “Accept T&G”, click-to-create contact, or first-party-pilot claim imported into certified records. No source coordinate/time/height, per-fix index or private hash printed in this component.
- Status UNAVAILABLE or NO_QUALIFYING_DIAGNOSTIC means no new warning, **not proof that the recording contains no missed landings**. Existing manual review remains available.
- One shared bad source edge identified in two overlapping source windows produces ONE visual quality warning, never two provisional contacts. Other bad edges remain separate contextual source problems.
- No time-specific profile seek is offered in P1B because the current player shows overview/downsampled points while P1A uses full canonical indexes. Adding a point marker before a verified display-index map would misplace a possible contact. The pilot can manually inspect the existing map and profile.
- Layout remains minimal (warning before chart), uses existing `details` review, supports no automatic landing authority. Screen reader label and explicit unknown-motion caveat are present.

## 4. Preconditions for pilot verification (P1B NOT RUN)

Run from the owner Windows Logbook checkout on the new P1B tracking branch with clean git status:

    git status --short
    git fetch origin
    git switch --track origin/feat/gps-v2-r3-p1b-inconclusive-review-ui-20261019
    git rev-parse --short HEAD

    npm run test:target -- tests/gps-v2-r3-p1b-ui-contract.test.ts tests/gps-v2-ui-contract.test.ts tests/gps-v2-r3-p1a-quality-contexts.test.ts tests/gps-v2-d43-r2-2-shape-audit.test.ts tests/gps-v2-d43-r2-quality.test.ts tests/gps-v2-d43-r1-coverage.test.ts tests/gps-v2-import-lineage.test.ts tests/v351-gps-tg-reliability.test.ts tests/track-processing.test.ts
    npm run typecheck
    npm run build

**LOCAL only until run; any nonzero exit => not PASS, investigate before visual or merge.**

### Browser/manual acceptance (only on local dev server; no public KML uploads)

- With `NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW` **unset or not "1"**, the P1B warning does not mount or compute. Legacy import appearance, prefilled counts, manual Day/Night totals and V2 flag behavior remain unchanged. Build/default OFF.
- With flag **"1"** and native V2 flag **"0"/unset**, owner-private sample07 must show *one* quality notice (two legacy windows share one source edge) and missing intervening GPS observation caveat. Existing GPS Review disclosure opens; no “T&G candidate” marker added by P1B and manually edited totals still controlled only by pilot.
- sample04 must show one quality notice without long gap statement; sample03/05/06/08 show no P1B notice, without asserting zero landing or zero source issues.
- With native V2 flag **"1"** separately, multi-gx sample07 must still show V2 UNAVAILABLE/UNSUPPORTED_SOURCE; P1B quality warning may exist as an independent information section. Never say V2 accepted the source.
- On replacement of uploaded KML, change of split cuts or rapid upload race, stale P1B notice disappears or recomputes; no cross-file notice remains.
- On desktop and iPad landscape/portrait and mobile, light/dark/night: typography and spacing, disclosure visibility, accessibility, keyboard navigation and no duplicate UI controls. Capture screenshots or local Playwright if available. Inability to verify is NOT a PASS.
- No raw user source data, flight timestamps, path, registration or coordinates in PR, screenshots or telemetry. Local footage contains personal data; keep private.

## 5. Closing state / required next steps

P1B implementation is **STAGED**, not tested or accepted. Only opt-in client review adapter/component, exact parent flag/read-only state, CSS, targeted tests and milestone docs changed. Native V2 parser/algorithm/legacy detector, server actions, DB/schema, official landings/recency unchanged. The public feature flag has NOT been enabled in production; no merge or deploy. P1A research milestone remains closed in its parent Draft PR, separate from P1B runtime integration.

Required: owner-local targeted tests/typecheck/build, responsive/on/off screenshot or Playwright, inspect results and fix failures, update ROADMAP/FEATURES/CHANGELOG. Only after verification should P1B milestone be considered engineering-closed. Production enablement, PR merge and deploy require **another explicit owner gate** and independent review as appropriate for aviation-sensitive UI.
