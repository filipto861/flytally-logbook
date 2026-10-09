# 3.7.0 — Phase 1: Map controller test and acceptance contract

**Status:** PRODUCT ACCEPTED for Phase 1 implementation (9 October 2026); runtime remains unmerged Draft PR #269. Exact-candidate source/domain/typecheck, aggregate, build and PostgreSQL PASS; **browser-risk PARTIAL (desktop 10 PASS / 1 FAIL; mobile NOT RUN), overall release FAIL**, SSR `window is not defined` also seen. No CI/merge/deploy claimed.  
**Independent re-review:** APPROVE WITH CHANGES for Phase 1 *technical design* (9 October 2026); conditions below must be fulfilled in implementation. Phase 2 satellite production and Phase 3 openAIP production remain separately BLOCKED.  
**Source:** `main@162d9ba88c7302dc45e564d8b59a5c3cdf060709`; docs-only PR #268.  
**Parent contracts:** `3_7_0_MAPS_AVIATION_LAYERS.md` and `3_7_0_MAPS_REVIEW_RECONCILIATION.md`.  
**Branching rule:** complied with: candidate lives in `feat/3.7.0-map-controller-phase1` on `main@162d9ba...`, Draft PR [#269](https://github.com/filipto861/flytally-logbook/pull/269). Runtime is **not** added to docs PR #268; merge only after docs reconciliation and exact-candidate verification.

## 1. Delivery boundary

Phase 1 implements a reusable Leaflet map-layer controller in **standard-only behavior**, resolves existing map lifecycle and dark-filter architecture, hardens the existing map-style parsing, and adds deterministic automated acceptance. It does **not** enable any additional satellite or openAIP tiles, license-gated providers, new user state persistence or aviation functions.

Keep existing route click targets, GPS track presentation, playback/scrubbing, map responsive/touch-lock behavior, default standard map, OSM attribution, and default styling. `package.json` and visible footer remain **3.6.0** until an actual 3.7.0 release. Preserve original historical tests except for adjustments justified by new behavioral evidence.

## 2. Exact pane assertions (source + browser)

Create and inspect the named panes in an actual mounted Leaflet DOM. All assertions test **effective computed style**, not only source constants:

| Pane | Expected z-index | Required result |
| --- | ---: | --- |
| `tilePane` | 200 | Leaflet default left alone; **no dark filter** on this global pane |
| `flytallyBasemap` | 210 | Exactly **one** active standard basemap tile layer; dark filter ONLY here for standard + dark |
| `flytallyAviation` | 300 | Exists for future use, **no live tile requests** in Phase 1; `pointer-events: none`; no theme filter |
| `overlayPane` | 400 | GPS polylines remain above aviation; never filtered |
| `routeLines` | 450 | Existing route-overview name retained, route strokes/hit targets remain clickable |
| `airportMarkers` | 470 | Existing route-overview name retained, circles and tooltips remain clickable |
| `markerPane` | 600 | Aircraft marker remains above raster and vector lines |
| `tooltipPane` / `popupPane` | 650 / 700 | Defaults above overlays, unobstructed |

Some map components will not instantiate `routeLines` or `airportMarkers` (they belong to route overview); test pane presence only on the map that owns it. Leaflet's default panes remain under Leaflet management. Do not add invisible offscreen layers just to satisfy DOM tests.

**Theme test:** standard/light -> standard/dark -> standard/light retains the legacy dark filter's values only on `flytallyBasemap`; screenshot/controlled tile fixture ensures the standard dark-map appearance remains equivalent. Future satellite/aviation colors cannot be affected by any inherited `tilePane` filter; Phase 2 will add deterministic image test on actual enabled satellite tiles.

**Interactions:** route and airport hit targets remain above noninteractive aviation panes; no `pointer-events` interception. Attribution DOM is separate from the filtered pane and remains legible.

## 3. Map lifetime and state oracle

Current `RouteOverviewMap`, `TracksMap`, `FlightTrackPlayer` and `GpsImportReviewPlayer` own their `L.map()` initialization in a React effect that currently depends on theme. **Characterize the old behavior before refactoring.**

- Exactly one **live** `L.Map` for the mounted container; unmount cleanup must remove it. React Strict Mode development remounts may legitimately construct another *after cleanup*. Never assert "constructor only ever called once across all mounts".
- Count `.leaflet-container` as a **smoke assertion**, **not** proof of map-instance identity: the same DOM container class can survive `map.remove()` + recreate.
- In Playwright, capture the actual `.leaflet-map-pane` DOM node identity and effective state across theme change; assert the node is the **same** and no second active pane/container, then assert viewport center/zoom via map DOM transforms or a controlled read-only test seam if DOM alone is insufficient. Do not expose undocumented production debug globals or mutate persistent data to make testing easy.
- For a layer toggle, verify exactly one basemap tile layer and no duplicate requests attributable to leaked old layers, no `fitBounds()` reset, no change in map center/zoom. Phase 1 has no satellite toggle; test the reusable controller's standard-only idempotence/cleanup; the full Standard/Satellite toggle is a Phase 2 acceptance.
- Verify that theme change during saved-flight GPS playback does not reset selected position, playback speed, playing/paused state or marker position/bearing; no forced restart of playback.
- Validate responsive resize and touch-lock state; controls keep their click/focus path at iPad viewport sizes and do not intercept route clicks.
- Tests must use deterministic local tile route interception/fixtures and isolated local browser database fixtures; **no external tile or paid-provider calls**.

## 4. Style-route backward-compatible parser acceptance

Current `app/api/map-tile/[z]/[x]/[y]/route.ts` silently treats every `style` other than `satellite` as standard. Freeze the API semantics before change:

| Query | Expected |
| --- | --- |
| omitted `style` | Legacy Standard `map` |
| `style=map` | Standard map |
| `style=satellite` | Existing satellite path (may respond 503 if token missing), **not enabled by UI in Phase 1** |
| `style=unknown` or `style=satelite` | HTTP 400, controlled JSON error `unsupported_style`, `Cache-Control: no-store`; no upstream fetch |
| `style=` (explicit empty) | HTTP 400 `unsupported_style`; no upstream fetch |
| `style=map&style=satellite` | HTTP 400 `unsupported_style`; no upstream fetch |
| `style=map&style=map` | HTTP 400 `unsupported_style`; no upstream fetch |
| invalid z/x/y | Existing strict 400, no upstream fetch |

Implement by reading the whole `URLSearchParams.getAll('style')` set: zero entries selects legacy map; one *exactly* permitted value selects that provider; all other cases fail. Do not conflate `style` with future aviation layers. Return a bounded, non-sensitive error body and `no-store`.

Add tests for these parser cases at the actual route boundary with mocked upstream fetch and assert no accidental OSM/Esri requests on invalid styles. Existing `v1314`–`v1317` contracts remain.

## 5. Proposed browser-risk registration (applied only in unverified Draft feature PR #269)

**Current registry evidence:** `tooling/development-modules.json` has an object `browserAcceptance.targets` with entries `{spec,title,project}`. Existing `analytics` selects only generic shell targets, and `gps-tracks` selects GPS save/SERA/gap targets. Neither is direct map-layer behavioral acceptance. The current `pathTargets` entries do **not** cover map layer files.

Proposed new `e2e/map-layers.spec.mjs` (new tests and entries created **during Phase 1 implementation**, never claimed to exist now):

| Planned target ID | Exact Playwright project | Scenario / test title to freeze |
| --- | --- | --- |
| `map-panes-overview-desktop` | `desktop-chromium` | `map panes preserve standard basemap ordering and route interactions` |
| `map-panes-overview-mobile` | `mobile-chromium` | same exact title |
| `map-lifecycle-tracks-desktop` | `desktop-chromium` | `GPS map theme changes preserve a live map instance and viewport` |
| `map-lifecycle-tracks-mobile` | `mobile-chromium` | same exact title |
| `map-lifecycle-player-desktop` | `desktop-chromium` | `flight replay retains map and playback state through theme changes` |
| `map-lifecycle-player-mobile` | `mobile-chromium` | same exact title |
| `map-lifecycle-import-desktop` | `desktop-chromium` | `GPS import review retains its map pane across theme changes` |
| `map-lifecycle-import-mobile` | `mobile-chromium` | same exact title |
| `map-tile-style-desktop` | `desktop-chromium` | `map tile endpoint rejects unsupported and duplicate styles before upstream fetch` |
| `map-tile-style-mobile` | `mobile-chromium` | same exact title |

**Selection intent:** add exact approved target descriptors to `browserAcceptance.targets` and associate them through narrowly scoped `browserAcceptance.pathTargets` entries for `components/leaflet-mobile`, the new controller, `components/route-overview-map`, `components/tracks-map`, `components/flight-track-player`, `components/gps-import-review-player`, `app/(protected)/map/` and `app/api/map-tile/`. For the import review component, ensure an existing or new explicit import-review browser scenario covers movement/touch behavior as appropriate. Existing `analytics` and `gps-tracks` module-level targets and risk requirements remain **unchanged** and continue to run; do not replace them with map-only tests. Add the new cases to the browser fixture/selection baseline and registry schema-consistent deterministic target coverage, exactly as required by `tooling/browser-risk-selection.mjs` and the browser harness.

**Fixture prerequisite:** each named scenario must render the matching map with deterministic route/GPS data in the isolated browser environment. Existing `/map` may show an empty state without suitable records. Establish minimum fixture rows using current isolated test infrastructure, never production DB. Avoid artificial success from an empty route screen.

**Responsive acceptance:** run interactive tests in both registered projects; additionally obtain iPad landscape/portrait (light/dark) visual and pointer-touch behavior proof at explicit viewports. Add an authoritative iPad browser project/target only after verifying impact on current shared DB/browser selection; otherwise record these as supplementary manual/screenshot evidence, **not** fabricated CI PASS.

**Source contract ownership:** add unit tests under existing `node:test` (no Jest/Vitest/React Testing Library). Dedicated map pane/style source tests can be included in the existing `ui-contract` or approved named evidence group, but source inspection is not a substitute for actual browser runtime acceptance.

## 6. Public boundary and provider future gates

- Existing `/f/[token]` and Story maps must remain behaviorally unchanged by Phase 1. The public path receives no new satellite/openAIP control or openAIP network requests.
- Future openAIP proxy **must call session-authenticated server authority before reading tiles or returning cache**, and respond with **401 unauthenticated**, **403 authenticated but not permitted** (or a consistent application-safe equivalent for auth middleware) with `Cache-Control: no-store`. Unknown/invalid layer and malformed z/x/y fail before upstream fetch, and no aviation request is sent when provider rights/config are disabled.
- A public guessed `/api/.../aviation/.../tile` URL must not disclose restricted overlay, even if the map client hides the switch. Add negative browser/route tests in Phase 3. An unauthenticated security check is still useful before that route exists, but do not pretend it is already implemented.
- Proxy cache key in Phase 3 must include provider revision/layer/z/x/y and any rendering/style-dependent arguments, with no credential exposed; no negative upstream 401/403/429/5xx response is cached. Respect licence and provider cache TTL. For authorized replies validate approved raster `Content-Type`, bounded byte length (explicit value based on current supplier contract), supported zoom and upstream host. Set timeout and bounded retries/backoff; never retry storm on 429.
- Current `next.config.ts` uses `img-src 'self' data: blob: https:` and `connect-src 'self'`. A proxied same-origin tile needs no broader CSP origin permission. **Do not casually replace the existing image CSP with `img-src 'self'`**, because existing data/blob/http(s) image consumers may break. Future CSP tightening needs separate consumer audit and regression tests.
- Phase 2 Esri production: exact supplier attribution/links and fallback combinations, license, account token/plan, quota, cost/caching evidence in `docs/compliance/`, plus desktop/iPad/mobile layout proof.
- Phase 3 openAIP production: authoritative Tiles API schema/auth evidence and binding legal clearance recorded in `docs/compliance/`; no public share or Story use in 3.7.0.

## 7. Verification/reporting acceptance

Before closing Phase 1, verify actual changed files using current repository `npm run verify:plan -- --base <explicit-main-ref>` and candidate-aware `npm run verify:iterate -- --base <explicit-main-ref>`, then the exact-candidate `npm run verify:release:risk -- --base <explicit-main-ref>` (or equivalent accepted candidate form). Required browser/PostgreSQL gates are selected by the registry: do **not** mark them N/A simply because the visible change seems presentational.

Check source/behavior invariants; desktop/mobile browser target registration/actual case set; iPad visual proof; current dark-standard screenshots; no provider requests for Phase 1; and no regressions in GPS, public replay or Story export. `FEATURES.md`, `ROADMAP.md`, `CHANGELOG.md` updated within same milestone, with version/DB/deploy closeout accurately reported.

**Current implementation candidate (Draft PR #269):** the 10 browser target IDs for five logical tests are registered **on the feature branch only**, along with standard-only controller, style parser, and Node source/unit tests; `main` remains unchanged. Registration was validated by GitHub source read-back and JavaScript syntax-only parse, **not** by running the actual browser-risk selector or Playwright. The baseline expected 108 executions is a **calculated expectation**, not 106 observed passing tests. **Isolated exact-Git-blob parser test:** 4/4 PASS on Node22.16.0 using `node --experimental-strip-types --test` (matched blob SHAs `f7a34a25...` / `05f05a52...`); this does **not** verify Next API status or app behavior. Node24/full app suite, typecheck, browser tests, build, PostgreSQL, provider-live, merge and deploy: **NOT RUN**; production version remains 3.6.0. Phase 1 DoD requires test execution, remediation of failures, independent code review and required PR/docs merge sequence.

### 9 October 2026 — First user-local full candidate evidence and regression patch status

The user ran the actual feature branch at `fb0471c5465e6b16a525641ced565276b4da3e74` from `C:\\Users\\Filip Točík\\Documents\\GitHub\\Logbook`. `npm ci` completed with a nonfatal package archive retry warning; `npm run typecheck` **PASS**; `npm test`: **1,437 PASS / 6 FAIL / 1,443 total**; `npm run build` **PASS**, with a nonblocking Turbopack project-root warning about a parent package-lock; `npm run verify:plan -- --base origin/main`: **no blocked evidence**, selecting typecheck/PostgreSQL/browser/full-tests/build.

Six failures were traced to source-only test/registry drift caused by Phase 1: historic 48-browser case assertion, historic verified 98-execution browser baseline overwritten with planned 108, runtime-file inventory 383→385, selection-version 1→4 mismatch, and two tests still expecting `DARK_TILE_FILTER` inside `leaflet-mobile.ts`. **Draft PR #269 now includes fixes**: retains historical verified 98-execution record, asserts five additional logical cases separately, updates audited inventory, synchronizes registry/schema contract at selectionVersion 2, and asserts dark-filter ownership in `map-layer-controller.ts` without weakening old coverage. Source read-back check PASS; **no actual tests rerun after these edits**. The older PASS build/typecheck is not transferable to this new commit.

**Second user-local run, feature `fc68861` (9 October 2026):** `npm test`: **1,442 PASS / 1 FAIL / 1,443 total**. Remaining failure: `tests/timezone-semantics-source.test.ts` retained a separate hardcoded `registry.ownership.auditedTotal === 383`, while registry correctly records 385 after adding the 2 new map modules. Feature commit `5b011c8` updates this single assertion to 385; **new test run after commit NOT RUN**. Previous typecheck/build PASS applies to earlier `fb0471c` only. No Playwright/PostgreSQL run yet.

**Third user-local run (9 October 2026, final feature head `5b011c84e16adeabbebdb10d2d4cd919f3554ac6`):** fast-forward pull from `fc68861` to `5b011c8` modified only `tests/timezone-semantics-source.test.ts`; the immediately following `npm test` finished **1,443 PASS / 0 FAIL / 0 SKIP / 1,443 total** in approximately 27.3 s. This is local, **not CI**, and covers Node unit/source regressions, **not** browser/DB acceptance. Earlier full build/typecheck PASSES belong to old `fb0471c`, not this exact candidate.

**Fourth user-local run (9 October 2026, feature `5b011c8`):** clean worktree, Node.js `v24.19.0`; `npm run verify:iterate -- --base origin/main` **PASS**. Source-contract **232/232 PASS**, domain-unit **46/46 PASS**, typecheck **PASS**, blocked_evidence **none**, candidate_id `afab37e13e2568a966c0821dc48f842427b1416dd5ccec35bc6be964f328a35a`; release correctly `NOT EVALUATED` with `aggregate-regression,production-build,postgres-acceptance,browser-risk` pending. Separate `npm test` 1,443/1,443 PASS is independently evidenced but does not automatically satisfy the risk release gate.

**Critical preflight before release executor:** `tooling/bootstrap-browser-smoke-db.mjs` executes **`DROP SCHEMA public CASCADE`**. Its target must be a dedicated, disposable PostgreSQL test database on `localhost` / loopback, never development data, Neon, production or staging. Check only host/database identity and availability of `psql` without sharing the connection string or credentials. Browser also requires `FLYTALLY_AUTH_BROWSER=1` and `FLYTALLY_LOCAL_POSTGRES=1`. The release executor creates/reuses exact-candidate build/DB/browser evidence; run **only after** confirming DB isolation.

**Next acceptance gate:** after safe dedicated DB preflight run `npm run verify:release:risk -- --base origin/main` with repository-pinned browser toolchain. Final map browser expectation is computed, **not** a verified execution count. Both PRs remain Draft/unmerged until release evidence and review complete.

**Fifth user-local run (9 October 2026, exact candidate):** `npm run verify:release:risk -- --base origin/main` reused the prior source/domain/typecheck PASS, performed aggregate regression **1,443/1,443 PASS**, and production Next.js 16.3.2 build **PASS** (41 static paths). Candidate ID remained `afab37e13e2568a966c0821dc48f842427b1416dd5ccec35bc6be964f328a35a`; `blocked_evidence=none`. Final `release_status=NOT RUN`; PostgreSQL acceptance **NOT RUN**, browser-risk **NOT RUN**. Local discovery: `docker` unavailable; `winget` and `wsl` available; `psql`/`pg_ctl` not on PATH; `C:\\Program Files\\PostgreSQL\\16` exists. Production build emitted a nonfatal ignored parent lockfile warning; no behavior failure observed. Resume with read-only Windows PostgreSQL 16 service/bin check, create and explicitly validate a disposable isolated localhost database, then rerun risk release. DO NOT point at a valued database: Playwright bootstrap runs `DROP SCHEMA public CASCADE`.

**Sixth user-local run (9 October 2026, same feature head 5b011c8 / candidate afab37e...):** isolated PostgreSQL `flytally_browser` verified at 127.0.0.1:55432 (own cluster, separate from default server); `npm run verify:release:risk -- --base origin/main` reused source/domain/typecheck/aggregate/build PASS. **Full PostgreSQL acceptance 100/100 PASS**, including 10k/50k/100k scale tests (scope planner marked scale N/A for this candidate, but canonical full suite ran its scale cases). **Browser-risk first desktop group: 10 PASS / 1 FAIL**: `e2e/gps-rolecrew.spec.mjs` GPS Save & certify completion banner `Flight saved and certified.` not visible within 5s. Production Next server also logged two `ReferenceError: window is not defined` module-evaluation errors during map theme/replay scenarios despite those cases counted PASS. **Authoritative browser evidence PARTIAL; final `release_status=FAIL`.** Browser mobile group NOT RUN because browser risk stops on failing desktop group. Screenshot, Playwright trace and error-context.md preserved on user workstation; root cause and persisted certified-row state are NOT YET CONFIRMED. Do not mask with longer assertion timeout or ignore SSR errors; investigate evidence first and keep both PRs Draft/unmerged. No code or schema/deploy changes from this acceptance run.

**Seventh work cycle (9 October 2026 — SSR hardening drafted, NOT VERIFIED):** read-only inspection identified direct Leaflet imports in SSR-rendered client module graph for `/map` and flight-detail GPS replay. Feature branch PR #269 now introduces `components/client-maps.tsx` with `next/dynamic({ssr:false})` wrappers for route/track maps, updates `app/(protected)/map/page.tsx`, dynamically loads the Leaflet flight player inside `components/lazy-flight-track-review.tsx`, and adds a source regression contract in `tests/v370-map-layers.test.ts`. Latest feature head `3777fb0f76bd4555ef420da5b750403cbc8eb39e` (seven small feature commits after `5b011c8`), including new client-maps risk/browser-target ownership and auditedTotal 386. This specifically attempts to address the observed `window is not defined` SSR errors; **no runtime/typecheck/browser tests have been run on this new head**, so resolution is not yet claimed. GPS direct Save & certify has **not** been changed: failure screenshot still shows `Saving draft…` / `Saving & certifying…` pending after a 5s expectation; persisted-row outcome unknown until trace/read-only fixture query. The previous 100/100 PostgreSQL, 1,443/1,443 aggregate and Next build PASS apply to earlier `5b011c8` only and must not be silently reused for the new candidate. Both PRs remain Draft; no merge/deploy.

**Trace investigation (9 Oct 2026):** the user supplied the failed GPS Playwright `trace.zip`. The click on `Save & certify flight` completed, and an authenticated `POST /flights/new` began; the network archive records that request with `status=-1` and no response before Playwright's five-second confirmation expectation timed out. The screenshot shows `Saving draft…` and `Saving & certifying…` pending; no server-action error or certification result is evidenced by the trace. Thus **server action slow/incomplete is observed, but GPS persistence/certification failure is not proven**. Next: before any re-run/fixture reset, use a read-only SQL query for the exact known fixture (`user_id=9001`, `OK-E2E`, `2026-10-05`, `off_block=14:00`) to establish whether it reached draft/certified state. Keep the 5s failure as real acceptance FAIL; do not simply waive/skip it. Map SSR mitigation in head `3777fb0` remains NOT TESTED.
