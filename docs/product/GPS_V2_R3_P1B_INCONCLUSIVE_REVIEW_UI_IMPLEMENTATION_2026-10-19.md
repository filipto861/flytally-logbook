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

## 2026-10-19 owner-local first P1B verification and focused runner fix

**Original tested P1B HEAD:** `349c6324` (clean owner checkout). **Targeted Node: 146 PASS / 1 FAIL**, with failure BEFORE loading the P1B test cases: Node 24.19.0 `ERR_MODULE_NOT_FOUND` on extensionless source-quality inspector import from `lib/gps-r3-quality-review.ts`. Existing other 146 tests pass, including all P1A and V2 source-eligibility cases. **TypeScript `npm run typecheck` PASS; Next.js `npm run build` PASS** at that original code HEAD. These results are owner-local, not CI. Do not report the entire P1B test suite as PASS.

**Minimal isolated fix on the same Draft P1B branch:** in `lib/gps-r3-quality-review.ts`, changed the research inspector import to the explicit `.ts` extension required by the Node `--experimental-strip-types` ESM test runner. The underlying P1A algorithm, native V2, legacy detector and flight form logic are untouched. Added P1B-15 regression checking the explicit ESM import; existing P1B test already imports and exercises the bridge at module load, so module-resolution failure fails closed. Review of the post-fix GitHub source confirmed exact extension, independent native V2 flag, build-default P1B flag OFF, one memoized current source/cut report, unchanged legacy import defaults, and no new form input or T&G marker. This is static source inspection, **NOT a new Node PASS**.

**Status: P1B OPEN / DRAFT.** The changed code and 15 P1B cases now require fresh owner-local targeted Node tests, typecheck and build on the NEW HEAD; the earlier PASS build/TypeScript must not be attributed to the new commit. Flag OFF/ON, V2 OFF/ON, sample04/sample07 and responsive desktop/iPad/mobile light/dark browser verification remains NOT RUN. No merge/deploy or production enablement, no DB/migration.

## 2026-10-19 owner-local post-fix verification — engineering GREEN, browser PENDING

**Code revision tested:** `0a3c1a5c` on a clean owner-local Logbook tracking branch, as shown in the PowerShell output. This supersedes the earlier `349c6324` 146/147 failing result **for these engineering checks only**.

- `npm run test:target -- ...` across nine explicitly selected test files: **161/161 tests PASS, zero failures/skips**, including all 15 P1B UI/static/bridge contract cases, 21 P1A synthetic/security cases, strict GPS V2 lineage/UI regressions, R2/R1 diagnostics and frozen legacy track tests. Node.js v24.19.0.
- `npm run typecheck` (`tsc --noEmit`): **PASS** with no diagnostics.
- `npm run build` (Next.js 16.3.2/Turbopack): **PASS** compilation, TypeScript validation and generated app-route build. This establishes compilation, NOT live authenticated import functionality, private KML browser display or production stability.
- All results are **OWNER-LOCAL**, not CI. Full repository test suite, automated Playwright, flag OFF/ON browser smoke, V2 OFF/ON combination, responsive iPad/mobile/night-mode inspection, production smoke **NOT RUN**. DB/migration N/A; no merge, deployment or production flag enablement.

**Current P1B milestone status: IMPLEMENTATION ENGINEERING CHECKS PASS / BROWSER ACCEPTANCE STILL OPEN.** No new automatic T&G or flight record authority. Legacy landingCount/form payload, native V2 multi-gx `UNSUPPORTED_SOURCE`, and flight recency unchanged. PR remains Draft. Docs-only updates after code HEAD `0a3c1a5c` do not imply a new code execution.

### Required next local browser gate

Start local Next.js in separate runs with exact environment flags **before** `npm run dev`:
- OFF baseline: `NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW` unset (or `0`); expect no R3 quality card and identical legacy/manual flight totals.
- ON: `NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW=1`, `NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY=0`. Private original sample07 should show one quality notice and explicit unknown motion gap, with existing Review GPS track disclosure open; sample04 one warning without the gap statement; sample03/05/06/08 no R3 warning. No automatic T&G/count change on any source.
- Combined ON/ON later, if necessary: native V2 must still return `UNAVAILABLE / UNSUPPORTED_SOURCE` for multi-gx sample07 independently of the R3 quality notice.
- Replacing file or adjusting manual splits must recompute/clear context; no stale warning. Examine desktop and iPad landscape/portrait/mobile, light/dark/night as possible. Do not submit sensitive example imports just to inspect UI; do not upload private KML or screenshots with identifying route/registration to GitHub.
- Any deviation or visual defect remains open and blocks P1B engineering closure. An exact browser PASS requires actual runtime evidence, not these static tests.


## 2026-10-20 — Browser runtime block diagnosed; isolated owned v21 fixture launcher staged (NOT RUN)

**Observed owner-local P1B runtime:** Starting \`npm run dev\` manually against existing local PostgreSQL 18.6 service on \`127.0.0.1:55432/flytally_browser\` was NOT sufficient for login. The login POST aborted in \`ensureDatabaseOptimizations\` with \`Currency schema v21 requires approved explicit migration before runtime.\` and HTTP 500, before password check. It is NOT established that the fixture account password is wrong. The previous \`ACCOUNT_READY\` check proved only that the account, credentials row and active flag exist. An earlier one-liner password validation failed at the PowerShell/Node quoting level without verifying any secret. Never claim password verification PASS.

**Root safety contract inspected in repo:** \`lib/currency-v21-migration-safety.ts\` permits runtime migration solely when its restricted approved disposable identity and purpose flags match: \`FLYTALLY_LOCAL_POSTGRES=1\`, \`FLYTALLY_AUTH_BROWSER=1\`, \`FLYTALLY_CURRENCY_V21_BROWSER=1\`, database \`flytally_currency_test\`, user \`flytally\`, **no password**, host \`127.0.0.1\` and non-default port other than 5432/55432. Currency v21 is a schema-first migration, not a login problem. Do not add \`FLYTALLY_CURRENCY_V21_BROWSER\` or a fake registry row to existing \`flytally_browser\` and do NOT reset/migrate the owner's existing local service.

**New stage:** \`tooling/run-gps-p1b-review-local.ps1\` launches a separate, newly created random-temp PostgreSQL **16** cluster on 127.0.0.1 and an unoccupied ephemeral port; rejects occupied 3000, wrong/unfetched candidate branch, dirty worktree, hosted environment, missing tools. Creates the exact one-off \`flytally_currency_test\` DB, independently checks database/user/host/port/**actual data directory**, then invokes the pre-existing \`tooling/bootstrap-browser-smoke-db.mjs\` ONLY against the verified owned cluster and \`tooling/apply-currency-v21-disposable.mjs\` for exact canonical transactional v20/v21. Starts a loopback-only Next dev server with P1B flag ON / V2 flag OFF, fixture account, no raw flight upload to repo. \`finally\` restores caller env, stops only owned PG16 and removes only the new temporary root **if stopped successfully**; otherwise preserves root for inspection. It will never attach to or change the existing 55432 PostgreSQL instance, Neon, certified flights or production migration registry.

New P1B-16–18 static contract tests for isolated cluster identity, boot/migration order, forbidden ports, scope, loopback server, cleanup and original v21 guard. P1B authored test inventory now **18**; earlier 161/161 PASS was for the PREVIOUS code head with 15 P1B tests. Tests, PowerShell runtime, fixture bootstrap, actual login and browser sample07 review on the new runner **NOT RUN** yet. The preexisting 161 local Node, TypeScript and Next build PASS remain valid only for their recorded old head; do not claim post-script green.

**How to use after exact new branch is pulled:** stop the old dev process, then run \`powershell -NoProfile -ExecutionPolicy Bypass -File ".\tooling\run-gps-p1b-review-local.ps1"\` from clean branch. Only after preflight + ephemeral canonical migration PASS, log in to \`http://127.0.0.1:3000/login\` with the repo's documented disposable browser fixture account and password; keep original private KML within owner-local browser and **do not submit/save**. Follow run output. \`Ctrl+C\` should allow \`finally\` to stop owned fixture; if that cleanup cannot be proven, inspect the printed owned temp root and process before manual removal. No data on port 55432 is eligible for script cleanup.

**Milestone:** P1B runtime/browser acceptance remains BLOCKED / UNVERIFIED, not done. No production flag enablement, merge or deploy. Need owner-local PowerShell runner evidence and P1B tests / typecheck / build after tool changes, then authenticated visual sample07/04, flag behavior, upload/split staleness and desktop/iPad/mobile dark/light checks. DB/migration on existing/production state: NOT CHANGED.


## 2026-10-20 owner-local authenticated visual review — narrow P1B PASS, detector miss remains open

**Observed evidence:** Owner executed P1B-01…18 static/bridge test suite: **18/18 Node PASS**, zero failed/skipped on `e46e5434`. Earlier first local fixture attempt failed early because Next had modified tracked `next-env.d.ts` and the runner correctly refused a dirty worktree. After the documented clean-worktree handling, the owner supplied a browser screenshot of the logged-in **isolated Browser Smoke Pilot** dashboard at `127.0.0.1:3000` and two local GPS import screenshots showing private sample07 uploaded: 593 canonical GPS points, existing review disclosure **open**, exactly **one** P1B non-authoritative altitude quality warning, explicit **unobserved interval** caveat, intact legacy map/altitude/speed player, and **six** existing legacy T&G event markers. The pilot pointed out one additional actual T&G not marked in the altitude minima sequence. This assertion is **REPORTED_CONTACT_UNCORROBORATED**, not independent GPS proof. Do not copy owner screenshots, original source identity, route, raw altitude, times, registration or coordinates to PR/repo.

**Interpretation:** P1B has visibly identified the problematic source quality; it was never intended to recover missed T&Gs. The prior R3-P1A source diagnosis found TWO overlapping altitude candidate windows rejected by ONE common implausible altitude edge, with an unobserved long telemetry interval. Frozen legacy `lib/track-processing.ts` rolling detector rejects the affected window when >25m/s within descent-minimum-climb geometry. This preserves safety; one underlying bad edge is not two contacts. Neither the warning nor the pilot report is an authoritative landing confirmation. Owner may explicitly edit landing totals in existing Review flight; no automatic count change or speculative marker from P1B. No new GPS detector algorithm is approved here.

**Scoped acceptance:** local Next + disposable PG16 schema-first authenticated login and sample07 review render **observed PASS** by owner screenshots. The P1B warning, open disclosure and long-gap message render correctly. Legacy T&G recovery **NOT DONE / NOT IN P1B SCOPE**. Full subset tests beyond 18, post-helper typecheck/build, sample04 and four negatives, OFF/ON feature flag combinations, upload/split invalidation, tablet/mobile/light and keyboard accessibility, browser Playwright, full CI and deployment **NOT RUN / not evidenced**. Disposable runner completion/cleanup after Ctrl+C also not yet attested. No production DB or traffic tested. P1B remains Draft/OFF.

**Next:** Close remaining P1B visual/flag/browser gates without relaxing safety. If the product owner wants detection improvement, authorize a separate R3-P1C design/milestone with multi-gx native input eligibility, strict source-provenance-aware evidence model, independent review, exact regression fixtures and no unsupported jump/long gap contact inference. Record the observed missed event as an anonymized defect, NOT a success claim or inferred logbook count.
