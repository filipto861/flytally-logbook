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
