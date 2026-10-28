# FlyTally Logbook — Flights Balanced Glassless visual direction (owner selection, 2026-10-28)

**Status: DESIGN DIRECTION SELECTED; TRIAL IMPLEMENTATION ON WORK BRANCH; NOT MERGED OR DEPLOYED.**
**Repository:** `filipto861/flytally-logbook` — main reference `484d84c33f34c5049a30a28aecc0a957bc6d9d07`. Owner reviewed the conceptual Flights Balanced Depth V3 prototype with Soft, Deep, and Glassless variants and explicitly preferred **Balanced Glassless**: "to glassless je nejlepsi to se mi libi".

## Approved visual qualities (Flights LIST only)

- Preserve FlyTally's current brand colors, typography and recognizable design; this is an elevation/surface-hierarchy study, **not a brand change**.
- Use the Glassless variant as design reference: solid/matte dark- and light-theme-compatible surfaces, subtle *tonal* distinctions among Find/Filters, Overview metrics, and Flight Records, with quiet depth and restrained shadows.
- Keep distinct, comfortably **rounded** panels/cards, rounded metric tiles, consistent padding and separation by surfaces and spacing.
- Explicitly avoid colored accent stripes/rails along **top, bottom, left or right** panel edges, harsh vertical dividers, exaggerated glass/transparency, decorative gradients and distracting motion.
- Maintain highest scanability and readable contrast of flight rows, logged BLOCK/AIR times, statuses and usable controls; existing focus/touch/keyboard behaviors, responsiveness and accessibility take priority over decorative elevation.
- Prototype contains synthetic records only; mockup has illustrative header/metrics not necessarily matching production layout or actual product features. **Do not import mocked data, mock-only UI controls, hero airplane imagery or fictitious facts into production.**
- The user selected a **visual direction**, not a pixel-perfect mandate, universal styling policy or authorization to alter Dashboard, Aircraft, Statistics, Flight Detail, New Flight or GPS flows. Expand only through later explicit product decisions.

## Later implementation proposal (NOT YET APPROVED)

1. Inspect the current `/flights` route, `app/globals.css`, `app/ui-system.css`, theme layers/final CSS cascade, existing rounded panel geometry and relevant source/UI tests; reconcile with the separate existing Flights UX audit draft #420.
2. Propose minimal local semantic surface classes or existing-token mixes for exactly three list areas: Find/Filters, Overview, Records. Preserve real DOM and filter functionality, category actions, summary calculations, flight evidence/status rules, pagination and responsive rows.
3. Owner decides specific CSS design scope in ROADMAP before code; do not silently reprioritize GPS Save First or other frozen roadmap items. No new dependency or motion (decision: **NONE**).
4. If specifically authorized, implement on new scoped branch, run risk-selected source/Node/typecheck/build, 320/390 mobile, 768/1024 iPad, desktop dark/light/night where available, keyboard/focus/contrast and native Safari review; evidence is **NOT RUN** for this *design-choice-only* checkpoint.

## Checkpoint
- **Owner authority:** selection of Balanced Glassless conceptual look only, not implementation, merge, production deployment, DB/migrations/flags or changes in `flytally-training`.
- **Branch:** `docs/flights-balanced-glassless-selection-20261028` from canonical main SHA above; docs-only.
- **Provider state (read-only, 2026-10-28):** `fly-tally.com` still aliases Vercel `dpl_GxGKV6dexcrjhtaNwqhxTrrc36jT`, READY, built from `343e675c489424bf7eddb2a40ae7caf6372dc47b`. No deployment action. Production DB and flags not read back (**UNKNOWN**); no writes.
- **Tests:** design choice only; app changes **N/A**; source/tests/build/browser/native iPhone for hypothetical design **NOT RUN**. Previous F3 tests do not validate this unimplemented design.
- **DO NOT:** modify main directly, merge any open Draft PR, deploy, mutate production DB/flags, or treat concept screenshots as real runtime evidence.
- **ONE NEXT STEP:** owner separately authorizes a scoped, real-code Flights-only Balanced Glassless implementation batch after roadmap/scope review.

## 2026-10-28 — Owner-authorized trial implementation (supersedes proposal status above)

Owner explicitly said `zkus to na zkousku implementovat a podivame se jak to bude vypadat`: permission to IMPLEMENT a **Flights-list-only visual trial**, not a merge, deployment, DB/flags action, or cross-page design-system replacement. This paragraph supersedes only the earlier NOT YET APPROVED implementation status; historic design-selection record above is retained.

**Implementation candidate:** `feat/flights-balanced-glassless-trial-20261028`, base `main@484d84c33f34c5049a30a28aecc0a957bc6d9d07`. Files: new scoped `app/flights-balanced-glassless.css` imported after `flight-detail-f3.css` from `app/layout.tsx`, regression `tests/flights-balanced-glassless.test.ts`. No JSX, application records, server actions, persistence, routes or dependencies changed. CSS variable mixes use current theme's semantic `--surface`, `--surface-muted`, `--surface-raised`, `--accent`, `--accent2`, existing rounded radii and shadow token. Filter/Overview/Records surfaces are distinct and matte; mobile cards retain their own layout but remove only decorative colored border-left rails (state labels remain explicit). Motion choice **NONE**.

**Verification limitation:** GitHub source-scoped readback and eight JavaScript source checks PASS; `tinycss2` parsed 11 top-level rules without error; six **synthetic Chrome** render fixtures (320, 390, 768, 1024, 1440, dark/light combinations) confirm different computed surface colors, 17px outer radius, no horizontal overflow, mobile left border 1px. This preview contains fake flights and adapted sample base CSS (not production screenshot). Native Safari, authenticated real Flights route, full application Node/typecheck/build/PG/risk Playwright and production smoke **NOT RUN**. No real flight data copied.

**Release authority:** Draft PR for review only. Do not merge or deploy without a new explicit owner decision, test the exact candidate against real application/isolated fixtures before release; existing production remains unchanged.
