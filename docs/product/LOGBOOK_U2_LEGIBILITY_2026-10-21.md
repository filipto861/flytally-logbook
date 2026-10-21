# Logbook U2 — secondary-copy legibility, Batch 1 (21 Oct 2026)

**Status:** Implemented in [Draft PR #379](https://github.com/filipto861/flytally-logbook/pull/379); owner-local tests/build/browser **NOT RUN**. No merge/deploy.  
**Repository:** `flytally-logbook` only. Base `main@8099149f72d493c34dd59babf65bdb064ff99fc9`. Independent of U0 Draft PR #377 and U1 Draft PR #378.

## Source of the requirement

The U0 owner-uploaded screenshot/JSON ZIP from 21 Oct 2026 contains 110 screenshots / 110 measurement rows (11 screen states × 5 viewport presets × light/dark), reported and reviewed separately in Draft PR #377 (`docs/product/LOGBOOK_APPLE_UX_U0_VISUAL_EVIDENCE_2026-10-21.md`). Verified metric values, not invented design targets:

- `Required` `.field-hint`: computed **10.4 px** on New Flight and Settings, 70 sampled styles. The effective `app/globals.css` rule `label>small,.field-hint{font-size:.65rem}` overrides its older `.field-hint{font-size:.68rem}`.
- New Flight `.entry-context-note`: computed **11.2 px** on 50 sampled styles; its source is `app/ui-system.css` `font-size:.7rem`.
- New Flight Review & finish summary microcopy: `.entry-certification-grid span{font-size:.62rem}` (9.92px), `.entry-certification-grid small{font-size:.6rem}` (9.6px), at a 16px root font.
- No document-root horizontal overflow in the U0 110 measurements. Chromium viewport/touch emulation is **not native iPadOS/Safari**.
- Desktop first-input sample 12.16px remains an **independent P2 follow-up**, not broadened here; app-wide WCAG contrast cannot be inferred from this font-size change.

## Narrow implementation

`app/ui-system.css` is the final stylesheet import in `app/layout.tsx` and receives a **scoped late override** rather than deleting or changing historical global CSS declarations.

- `.flight-entry-workspace .field-hint` and `.u33-settings-workspace .field-hint`: `font-size:.75rem` (12px at existing 16px root) and `line-height:1.45`.
- New Flight-only `.entry-context-note`, `.optional-detail-note`, `.optional-detail-heading small`, and direct summary `.entry-certification-grid>div>span` / `small`: same `.75rem` / 1.45.
- No new color, theme token, control heights, backdrop/motion, state transitions, validation labels, form business logic or user data. Explicit `Required` stays semantically unchanged.
- No global `.field-hint` override: credentials/aircraft/GPS/other routes maintain their existing cascade until separately audited. Historical overridden declarations in `globals.css` are left intact.

## Owner-local verification on second Windows PC (21 Oct 2026)

- **Tested branch/head inferred from fetch and switch:** `fix/logbook-u2-legibility-20261021@3f2700167df15498a4f4232029254b31388bbedd`. Owner fetched this branch and switched to it immediately before running tests; `git rev-parse HEAD` was not explicitly printed. No later source changes preceding these tests were reported.
- Windows PowerShell, Node.js `v24.19.0`; `npm ci` exited successfully (`added 37 packages`) after two transient `@img/colour` tarball retry warnings.
- `node --check e2e/logbook-u2-legibility.spec.mjs`: **PASS** (exit code 0).
- `npm run test:target -- tests/logbook-u2-legibility.test.ts`: **2/2 PASS**, 0 failed, owner-local.
- `npm run typecheck`: **PASS** (`tsc --noEmit`, exit code 0).
- `npm run build`: **PASS**, Next.js 16.3.2, compiled successfully, TypeScript PASS, generated 41/41 static pages. No external-parent package-lock warning shown in this PC's build.
- **Known local working-tree exception:** `next-env.d.ts` was modified while the PC was on a prior research branch; that modification was carried across to U2 during `git switch`. The user did **not** report the actual diff. Do not attribute its contents to PR #379, automatically discard it or interpret the owner-local workspace as clean. PR branch diff on GitHub contains only the scoped U2 CSS, tests and governance docs.
- Authenticated real-page Playwright computed styles, 20 JPEGs, metrics JSON, iPad Safari, visual wrap/contrast acceptance and broader suite **NOT RUN** on this PC. Existing U0 synthetic disposable DB at `127.0.0.1:5433` was prepared on a *different computer*, not confirmed on this one. Do not use a remote/production DB for visual testing.
- **Status:** implementation passes owner-local static/build gates, **U2 visual gate open**, Draft PR #379; no merge/deploy/migration.

## Clean-tree and exact-head verification — second PC

- Owner independently ran `git status --short`: **empty**; `git diff -- next-env.d.ts`: **empty**; `git rev-parse HEAD`: **`3f2700167df15498a4f4232029254b31388bbedd`**. This explicitly confirms a clean working tree and exact U2 source head used by the earlier 2/2 focused tests, TypeScript and successful build.
- The earlier `next-env.d.ts` modification was transient and is **no longer present**; no restore/reset, file removal or user-data change is needed.
- GitHub branch includes subsequent governance-only commits recording the test results. These docs-only commits do not change the tested app/CSS/test source. Authenticated 5×2 Chromium presentation acceptance remains **NOT RUN**.

## First second-PC Chromium run — blocked by collapsed native disclosure (21 Oct 2026)

- After `git pull --ff-only` to `d3fcd1b7` (governance-only advancement from previously tested `3f270016`), exact local PostgreSQL v21 identity/owner/nonprivileged synthetic pilot preflight **PASS**.
- Next.js 16.3.2 production build **PASS**: compilation, TypeScript and 41/41 static route generation.
- U2 authenticated Playwright desktop-chromium target **1 FAIL**, before complete 5×2 visual acceptance. Locator `.entry-context-note` *exists* with text `Aeroplane · Part-FCL · SEP` but is **hidden** under the native `<details class="entry-section entry-section-experience">`, which normally begins collapsed. Old E2E selected aircraft and immediately asserted this nested note was visible without expanding the disclosure. This is a **test setup defect**, not proof of incorrect typography. Settings may have rendered, but no end-to-end acceptance was completed and output JSON/20 JPEGs was not verified.
- Source review: `components/flight-form.tsx` line ~141–142 puts the note inside the conditional native `Flight experience` details body; the application intentionally maintains collapsed/expanded disclosure state. No product UX/certification logic change authorized.
- Narrow **test-only** correction: import canonical `ensureDetailsOpen` helper from `e2e/browser-actions.mjs`, open Flight experience before expecting nested note, open Optional details before measuring its helper text, and measure `.optional-detail-heading small` as part of targeted typography coverage. No app/CSS/DB mutation, no weakening of font-size >=12px or overflow <=1px assertions. Add source-order regression guard.
- **Revised-head syntax/source/typecheck/build/browser NOT RUN**. The owner-local last `PASS: U2 visual Playwright acceptance` line in PowerShell followed a thrown exception and is not test evidence: the sole browser result was **FAIL**. Playwright also printed `Internal error: step id not found: fixture@58`; treat as untriaged reporter output unless it persists after the primary hidden-note failure is fixed.
- Next: pull test-only fix, confirm DB v21 and flags, rerun targeted JS/source and Playwright. Inspect 20 screenshots/metrics before closing U2.

## Second second-PC Chromium run — missing selected aircraft note after disclosure (21 Oct 2026)

- Owner fast-forwarded to `9b316e7e65fae15386dc0f3024be713aa168503a` (no new CSS/app change), JavaScript syntax **PASS**, focused source tests **3/3 PASS**, isolated local PG18 synthetic v21 fixture preflight **PASS**.
- Playwright desktop Chromium targeted test **1 FAIL**, after opening Flight experience: `.entry-context-note` **not found** (rather than hidden as in first attempt). Browser printed `Internal error: step id not found: fixture@190`; screenshots and retained trace paths were supplied in terminal output but binaries were not uploaded. Do not infer root cause or present a visual PASS from subsequent PowerShell echo.
- Code analysis: `components/flight-form.tsx` renders `.entry-context-note` only when `entryProfile.selected` is true; `entryProfile` depends on controlled React `registration` and aircraft context. `page.goto(...,waitUntil:"domcontentloaded")` does **not** guarantee React hydration before `selectOption`, so a pre-hydration selection overwritten by hydration is a **hypothesis**, not established fact.
- **Further E2E-only correction staged, NOT RUN:** explicitly click GPS and Manual mode buttons and assert their changing `aria-pressed` values (proves React event handlers are active); require exact seeded `OK-SP2E` instead of silently falling back to another aircraft; assert controlled select retains `OK-SP2E` and `data-aircraft-category` no longer equals `unselected`; then open experience and check nested note. On persistent failure emit only synthetic state (selected registration, category, disclosure status, note count, manual pressed, viewport/theme), never credentials/session/DB URL. Source regression test verifies the ordered contract.
- New E2E/test head **NOT RUN**. No changes to application code, CSS, aircraft prefill behavior, database or certifications. Full 20-image/JSON visual acceptance remains **OPEN**; Draft PR #379 not merged/deployed.

## Acceptance contract

1. `node --check e2e/logbook-u2-legibility.spec.mjs` — **NOT RUN**.
2. `npm run test:target -- tests/logbook-u2-legibility.test.ts` — **NOT RUN**.
3. `npm run typecheck`, `npm run build` and relevant UI contract tests — **NOT RUN**.
4. `e2e/logbook-u2-legibility.spec.mjs` — explicit local opt-in only. It refuses automatic execution without flags `FLYTALLY_U2_LEGIBILITY_BROWSER=1`, `FLYTALLY_AUTH_BROWSER=1`, `FLYTALLY_LOCAL_POSTGRES=1`, no Vercel env and the exact existing disposable DB URL user/owner `flytally_ui_u0_20261021`, `127.0.0.1:5433`, non-empty password. These **test-side guards are not a substitute** for checking actual DB owner, permissions and migration version before starting. The test itself logs into a seeded synthetic pilot; **does not reset DB or apply migrations**.
5. Test runs 5 viewports (1440×1100, 1024×768 coarse, 768×1024 coarse, 390×844 coarse, 320×720 coarse) × 2 themes (light/dark), checks that targeted visible text computes at >=12px, checks root overflow <=1px, saves **20 JPEGs + JSON metrics** to `test-results/u2-legibility`. Review visual line wraps and hierarchy, especially 320px.
6. This is Chromium touch emulation only. Native Safari/iPad, keyboard zoom, contrast-ratio evaluation, all other routes, larger desktop input fonts and full suite remain **NOT RUN / OUT OF SCOPE**. No iPad UX/full WCAG certification claim.
7. Source checks protect exact CSS selector scope and preserved legacy cascade, but executable Playwright measured-style evidence is required before accepting U2.
8. Keep Draft until exact-head owner-local evidence and independent PR review. No automatic merge, production deploy or DB migration.

## Do Not

- Do not rewrite historical `globals.css` overrides or insert `!important`.
- Do not globally enlarge all labels, links, buttons or badges.
- Do not prefill any aircraft, role, airport or date that owner did not approve.
- Do not imply regulatory/certification data provenance from typography changes.
- Do not merge U1/U0 branches into U2 or change `flytally-training`.

## U2 follow-up after acceptance

Review desktop 12.16px first-input sample versus coarse 16px on measured form types, then decide whether a separate U2-B change is needed with detailed responsive layout evidence. Do not expand this batch preemptively.
