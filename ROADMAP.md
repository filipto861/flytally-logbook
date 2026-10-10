# FlyTally Logbook Roadmap

**Status:** Active  
**Owner:** Filip Točík  
**Last reconciled:** 10 October 2026  
**Current production product version:** `3.6.0`  
**Current active release:** `3.7.0`

**A2E Map settings UX — PRODUCTION DEPLOYED / OWNER-LOCAL BOTH MODES RELEASE PASS (10 October 2026):** [PR #295](https://github.com/filipto861/flytally-logbook/pull/295) **squash-MERGED into main** at `3d29b665bffb33d9a113722e42162579a21b3a43`. Vercel Production `dpl_3yYy5DHmbfUZLxV3XXnzfTfVBr8F` is **READY** for the exact merge commit, with `fly-tally.com` production alias assigned. A2E changes only the protected Leaflet settings UX; existing Satellite/Aviation Production build and server flags remain configured ON with the existing server-only key (no env changes in this work cycle). No DB migration, Training/public Story changes, new product-version release, or provider approval claim. Pre-squash owner-local final PR head `a8141e3d240df33188e7cb1bdbdc78579a51dce2`, candidate `b59ddf4bb60d5d296948d1e80e9584bdf7ff6b0b22237c8f1887c700fb25be1c` passed **both** Aviation client ON and OFF full release-risk gates, separately with Satellite ON, new Next production builds and verified-empty dedicated localhost PostgreSQL 18 browser fixtures. **Per mode:** source **233/233**, domain **62/62**, aggregate Node **1473/1473**, TypeScript/build PASS, PostgreSQL **100/100**, Playwright Chromium desktop **11/11** and mobile **11/11**, no retries, skips or blocked evidence. Scale was N/A per planner. These are local/synthetic tests, **not GitHub Actions CI, live provider coverage or physical iPad/Safari**. **Next open gate:** owner-signed-in production visual smoke (panel Standard/Satellite/Aviation, light/dark, route-click and map panning) and physical iPad landscape/portrait Safari acceptance; continue to honor reference-only/coverage-unverified aviation data. Full 3.7.0 still unreleased. Separate A2D historical status drift is tracked in draft documentation [PR #294](https://github.com/filipto861/flytally-logbook/pull/294); do not treat old A2D draft assertions below as current production state.
  
**A2E verification history:** Original feature head `c720a16b` failed one mobile route-hover test (popover remained open and correctly intercepted a covered hit target). E2E-only fix `a8141e3d240df33188e7cb1bdbdc78579a51dce2` explicitly dismissed the popover before asserting underlying route hover/click; final owner-local gates passed both modes as recorded above. Earlier A2E release-failure narrative is retained in the PR, not an active blocker.

**Current active workstream:** Maps & Aviation Layers — Satellite is production-deployed; A2A/A2B1/A2B2 are merged with openAIP disabled. A2D changes the private feature to the **combined Aviation** raster; exact runtime head `b10d81b7` passed separate owner-local ON/OFF synthetic release gates. [PR #293](https://github.com/filipto861/flytally-logbook/pull/293) remains **Draft/unmerged**, and these results do not extend automatically to this documentation-only follow-up commit. Provider-in-app smoke, rights/quotas, physical iPad and Production enablement remain separate gates; full 3.7.0 is unreleased.

This is the canonical **forward execution plan** for `flytally-logbook`. Older milestone narratives, failed attempts, test logs and superseded PR states were preserved verbatim in [the pre-reconciliation roadmap snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md). Dated evidence there is **historical**, never an instruction to override this page.

**Emergency security deployment complete:** 10 Oct 2026 PR #282 merged and production alias points to READY build. Does not constitute full 3.7.0 or externally approved Satellite integration; older pre-merge audit notes below are historical.

### Active 3.7.0 Satellite UI integration — owner reprioritized 10 October 2026

**New approved implementation direction:** Reuse existing authenticated Share Story's Satellite tile endpoint and the isolated, previously tested R1 `Standard / Satellite` Leaflet control from draft PR #272; port its small, well-bounded client changes onto **current security-patched main** rather than merge the stale R1/R2 stacked history. This is a new integration branch, not proof of provider entitlement. Do not stall client engineering on new license research; retain external-provider/account entitlement as an explicitly deferred release risk, not an approved fact.

Milestone scope: authenticated route overview, GPS tracks, saved flight GPS replay and GPS import review only, **Standard default**, explicit per-map selection, no silent persisted preference, fallback to Standard on tile failure, no map recreation or GPS/flight data mutation, public flight sharing remains **Standard-only**, Share Story flow unchanged. Keep `getSession()` security gate, private Satellite caching, public Standard caching and strict 400 style parser from deployed PR #282 unchanged. Rollout completed on 10 October: exact-true `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true` configured for Production before the deployment build; OFF remains the default if unset. No DB/schema changes; keep Training separate.

**Execution / verified result (10 October):** [PR #285](https://github.com/filipto861/flytally-logbook/pull/285) merged as `c1500a47298e661fa4e37b050b550b4d21e3afd3`; owner-local exact head `ac96abf0` **Satellite ON and OFF release gates PASS**, each full Node **1456/1456**, source **233/233**, domain **46/46**, PostgreSQL **100/100**, typecheck/build PASS, Chromium **11/11 desktop + 11/11 mobile**. Original registry-count test failure was corrected before the passing runs. Production Vercel `dpl_483QVp2729JzS16w8g1VJz7MBcCJ` **READY** and `fly-tally.com` alias points to it. Production build env key present with Production target, and owner screenshot showed its value `true` before merge. Physical signed-in UI smoke on production and anonymous Satellite 401 on this new deployment remain **NOT RUN**; malformed duplicate-style production HTTP **400/no-store PASS** (edge observation). Full 3.7.0 release still pending airspace and other scopes. No DB migration, no Training change.

### Active Phase 3 — combined openAIP Aviation overlay (A2D; earlier Airspaces scope retained as history)

**Owner direction:** Proceed with openAIP now; Satellite is production deployed and owner has visually verified the signed-in Standard/Satellite switch and imagery on route overview. Full 3.7.0 is still unreleased.

**A2A — current small implementation milestone:** Port isolated offline A2A airspace z/x/y parser and explicit capability gate from old `feat/3.7.0-openaip-airspaces-a2a-offline-control` onto current `main` without merging obsolete Satellite/Story changes. Add targeted Node tests, source ownership and acceptance documentation. Parser max zoom 22 is a syntax ceiling only, NOT openAIP zoom support. No browser UI/provider HTTP/secret, DB migration, production toggle or external request. Owner-local targeted/typecheck/build and exact-head verification are required to close.

**A2A owner-local verification checkpoint:** clean detached `c02195078d4565b35ef0dbe0a28ad58d86b55c35`, candidate `94a285627c8d6d864b578cc9dae25796aae657eb88f72db230ddab8123ebd2e9`. Targeted **24/24 PASS** (four A2A tests included); `verify:iterate --rerun` **iteration_status=PASS**, source **233/233**, domain **24/24**, typecheck **PASS**, `blocked_evidence=none`; independent Next production build **PASS** (41/41 static pages). `release_status=NOT EVALUATED`, aggregate/browser-risk **NOT RUN**. Commit will change after this documentation update: evidence belongs to prior exact SHA, not automatically new HEAD. No provider/migration/deployment.

**A2B1 — MERGED / VERIFIED (10 October):** A2A PR #287 merged after exact-head owner-local release PASS (Node 1460/1460, browser 3+3, source 233, domain 24, build/typecheck PASS; no Postgres gate required). First A2B implementation is a *private, OFF-by-default* raster airspace tile proxy only, without yet changing Leaflet UI. Stable fixed host and 2022 vendor airspaces PNG endpoint are evidenced in vendor support posts; 2024 vendor notice names `x-openaip-api-key` authentication. Live OpenAPI schema, provider-specific zoom envelope/quotas and actual key request success are NOT VERIFIED, therefore deploy flags remain OFF and no live provider requests are permitted. Contract: exact canonical XYZ; session before secrets; fixed upstream path; `FLYTALLY_OPENAIP_AIRSPACES_ENABLED` + `FLYTALLY_OPENAIP_PROVIDER_VERIFIED` exact-true server gates; missing key unavailable; verify PNG signature/content size/type, no-store private, controlled upstream failure, no origin CORS. Synthetic behavior tests first; after exact-head release verification separately integrate UI in A2B2 and check real provider credentials/permissions before ON. No DB migration and no Training change.

**Historical A2B2 implementation plan (superseded by verified result below; PRIVATE UI, DEFAULT OFF):** A2B1 PR #288 merged at `03e849b6ae9721d52858a29901a062b5bbbeca3f` after clean exact-HEAD owner-local `release_status=PASS` (source 233, domain 31, full Node 1467, desktop Chromium 5/5, mobile Chromium 5/5, typecheck/build PASS, no blocked evidence; PostgreSQL acceptance N/A). Implement standalone opt-in Airspaces toggle using the **existing** `flytallyAviation` pane above either Standard or Satellite without map recreation/flight-data mutations, on four authenticated map consumers (routes, tracks, private replay, GPS import review); public sharing stays Standard-only/no Airspaces. Separate exact-true build flag `NEXT_PUBLIC_FLYTALLY_AIRSPACES_MAPS` defaults OFF, independent from server `FLYTALLY_OPENAIP_AIRSPACES_ENABLED`/`FLYTALLY_OPENAIP_PROVIDER_VERIFIED` and private `OPENAIP_API_KEY`; production stays OFF. UI must show attribution, reference-only/coverage-unverified caveat, explicit loading/unavailable, no retry storm, 14 zoom app request cap, error recovery without modifying background or route controls. Synthetic PNG interception in authoritative Playwright ON/OFF; local Node/build/full risk-gate and iPad review before merge; live provider access and production enabling **NOT AUTHORIZED / NOT VERIFIED**. No Training/DB/schema change.

**A2B2 — MERGED / LOCAL ON+OFF RELEASE PASS / PRODUCTION CODE DEPLOYED (10 October 2026):** [PR #289](https://github.com/filipto861/flytally-logbook/pull/289) squash-merged as `49077967d9ba15f8dcabc80b036f8b157220d16d`. Exact tested head `476fd1a1c33fe4c7f18b21d6253a4c1c4cfdfae4`, candidate `93112220dfa2e3eafebc8c18217618333ff9c7d368061f4565b132040a2fb3d6`: owner-local `verify:release:risk -- --base origin/main --rerun` **PASS for Airspaces ON and OFF**, each on different new, verified-empty isolated localhost PostgreSQL 18 browser fixture (`flytally_pr289_air_on_1010`, `flytally_pr289_air_off_1010`). In **each mode**: Node **1472/1472**, source **233/233**, domain **62/62**, PostgreSQL acceptance **100/100**, desktop Chromium **11/11**, mobile Chromium **11/11**, TypeScript + separate production build **PASS**, `blocked_evidence=none`, scale N/A. This is local, not CI, native iPad or live provider proof. Vercel production deployment `dpl_Fk7ReBtutVRS3XUvABaaDFyZvgod` **READY**, and `fly-tally.com` alias points to it. Production Vercel environment inventory contains **no** `NEXT_PUBLIC_FLYTALLY_AIRSPACES_MAPS`, `FLYTALLY_OPENAIP_AIRSPACES_ENABLED`, `FLYTALLY_OPENAIP_PROVIDER_VERIFIED`, or `OPENAIP_API_KEY` entries (checked 10 October), so the code is shipped but the layer UI/provider is OFF. No DB migration, Training change or full 3.7.0 version release. Authenticated live A2B2 UI, physical iPad/Safari, live vendor agreement/API behavior/usage limits, source age and coverage **NOT VERIFIED**.

**A2D — FEATURE BRANCH IMPLEMENTED / EXACT-RUNTIME-HEAD OWNER-LOCAL ON+OFF RELEASE PASS (10 October 2026):** Owner chose **combined Aviation** raster (not Airspaces-only). [PR #293](https://github.com/filipto861/flytally-logbook/pull/293) moves only the fixed authenticated private tile upstream to `/api/data/openaip/{z}/{x}/{y}.png` and renames customer-facing control, status and attribution to Aviation; existing internal route/header/flags remain compatibility identifiers. Original exact tested runtime head `b10d81b7ee7e6ce9fbf58d262a67d54be0543e56`, candidate `18095a61ef81f1c3eda4e9098224a1864efd1bfa6bcba77a373c69bb52db9eb4`: after an initial ON browser failure caused by missing local `SESSION_SECRET`, corrected local-secret ON and independently fresh-client-build OFF runs both reported **`release_status=PASS`**. **Each mode**: source **233/233**, domain **36/36**, full Node **1472/1472**, TypeScript PASS, Next production build PASS, Chromium **8/8 desktop + 8/8 mobile**, `blocked_evidence=none`; zero browser retries reported. Each mode used a separate verified-empty disposable localhost PostgreSQL 18 browser database; standalone PostgreSQL acceptance and scale gates were **N/A according to planner**, not 100-test PG integration PASS. ON and OFF evidence archived separately in the owner's local FlyTally A2D-PR293-evidence directory. This documentation-only reconciliation creates a **new candidate SHA**: prior runtime PASS does not automatically certify that new SHA; verify final candidate before merge. CI, native iPad/Safari, actual signed-in application-to-provider proxy smoke, PR merge, Production deployment/configuration, provider authorization/coverage/currentness and full 3.7.0 release **NOT RUN / NOT VERIFIED**. Keep client/server exact-true flags OFF and server key absent in Production until separate owner decision; no DB/schema, Training or Story change.

**HISTORICAL A2C LIVE TWO-ENDPOINT DIAGNOSTIC — OWNER-LOCAL PASS / SCOPE NOW RESOLVED BY A2D (10 October 2026):** Owner ran an authenticated, hidden-key, fixed-URL two-GET PowerShell test against openAIP raster tiles for the identical Prague-area XYZ **z=9, x=276, y=173**. Legacy `/api/data/airspaces/9/276/173.png`: **HTTP 404**, `application/json`; current `/api/data/openaip/9/276/173.png`: **HTTP 200**, `image/png`, **13,425 bytes**, valid PNG signature and some visible (alpha>0) pixels. No API key or binary content entered GitHub or this conversation. This is direct live evidence that the key works for the combined PNG endpoint **at the sampled tile only**, not proof of general availability, transparency percentage, imagery categories, extent, source validity, authorization to redistribute or active/current airspace. At the time of this diagnostic, the deployed A2B1 proxy pinned `/airspaces`; the A2D feature branch corrects the upstream path but has not been merged; the feature and all server provider gates remain OFF. **Historical decision point (resolved by A2D): explicit owner choice** to rename/ship combined *Aviation overlay* using `/openaip` vs retain a genuine *Airspaces-only* semantics via separately sourced/filterable vector geometry, after confirming data format. Do NOT silently substitute combined imagery into a control labeled only `Airspaces`; no production flag or secret changes until selected solution and exact-head tests are verified.

**HISTORICAL A2C — earlier provider-contract investigation (10 October, no runtime/production changes):** Owner has a private openAIP API key, **must not paste/store it in GitHub/chat**. Owner elected to handle licensing responsibility separately; this is not evidence that permission has been granted, and licensing review will not block the *technical* diagnostic. Discovery found an implementation incompatibility risk: A2B1 pins `/api/data/airspaces/{z}/{x}/{y}.png` based on the vendor's **2022** examples, but the openAIP maintainer stated on **3 May 2023** that standalone airspaces/airports raster layers were deprecated and only combined `/api/data/openaip/{z}/{x}/{y}.png` was supported (https://groups.google.com/g/openaip/c/sG8GlccNS6w/m/U8OJiGGHAgAJ). Their **5 August 2024** announcement documents the `x-openaip-api-key` request header (https://groups.google.com/g/openaip/c/SXblkRg3Ic8). The current official Tiles OpenAPI schema could not be independently fetched, and **at this earlier checkpoint no key-authenticated request had yet run**. Thus A2B1/A2B2 local synthetic PASS does **not** establish a live compatible raster source. Historical next action (subsequently completed in the A2C diagnostic above): run bounded, key-hidden local GET probe against both fixed same-host PNG tile variants at one grounded CZ XYZ with status, content type, bounded payload and PNG/alpha classification only; redact key and response bodies. If only combined raster works, **do not silently substitute it as an airspaces-only data product**: present owner with combined aviation overlay vs selective vector/filtered solution with trade-offs, ask product decision, then small reviewed implementation+new local gates. Production flags remain OFF; no provider consent or source validity inferred.

**NEXT OPEN GATE — FINAL DOCS-ONLY CANDIDATE + PROVIDER EVIDENCE / OWNER DECISION:** Verify the final PR SHA after the documentation-only commit; do not transfer the runtime-head candidate PASS without identity review. Verify current openAIP Tiles API shape and header auth with a legitimately provisioned non-production credential, actual PNG transparency/content/zoom/coverage, data vintage/currentness, license/redistribution/commercial permissions and expected quota/cost. After separate owner authorization do a bounded authenticated application-proxy nonproduction smoke and independent security/provider review before considering **any** Production flag or secret change; the exact-true three-flag/key protection must stay OFF meanwhile. Raster tiles are reference-only, never NOTAM/activated status or an approved operational EFB. If provider acceptance cannot be obtained, remain unavailable and ask owner for scoped 3.7.0 release decision; do not fake fallback data or override deployment gates.

**Historical A2B planning note (superseded; provenance retained):** Authenticated airspaces-only fixed-host proxy, secret server-side, explicit enablement and strict response handling; optional Leaflet raster overlay on existing `flytallyAviation` pane, correct unavailable/partial coverage and attribution, independent Standard/Satellite toggle, mocked provider Playwright ON/OFF. Use verified current Tiles API contract, not guessed zoom/tile dimensions/cache, and never present this as operational airspace status. Prioritize implementation without reopening a broad vendor debate; unverified provider conditions remain recorded, not assumed approved.

## Current state — 10 October 2026

| Area | Verified state | Gate / next action |
| --- | --- | --- |
| Production | Product `3.6.0`; database schema **v20** as recorded at 3.6.0 closeout | No 3.7.0 version bump/tag or full production release |
| Security containment (separate from 3.7.0) | **DEPLOYED 10 Oct 2026**: [PR #282](https://github.com/filipto861/flytally-logbook/pull/282) squash-merged as `00305fb6`; Vercel `dpl_JAdh7zGNZmXVQwDLoZ5yeLJvnvsn` **READY**, `fly-tally.com` alias verified | Product metadata stays `3.6.0`; no DB migration. Owner-observed production HTTP **401 private/no-store** (anonymous Satellite) and **400 no-store** (duplicate style) **PASS** on `fly-tally.com` at 2026-10-10 14:11 UTC; no wildcard Satellite CORS; Vercel MISS/Age 0. Historical CDN/browser stale-cache acceptance still **PENDING**. Esri licensing, authenticated Story provider traffic, Safari remain unresolved. |
| 3.7.0 Phase 2 — authenticated Satellite map choice | **PRODUCTION DEPLOYED** through PR #285, Vercel `dpl_483QVp2729JzS16w8g1VJz7MBcCJ` READY, live alias confirmed, Production build flag configured before build; automatic owner-local ON/OFF verification PASS. Existing security gate from #282 unchanged. | Follow-up: confirm signed-in visible Standard/Satellite and failure fallback, verify live anonymous Satellite 401 and standard map, check iPad; preserve 3.7.0 remaining milestones. |
| 3.7.0 Phase 1 — Standard Maps | **DONE.** Feature PR [#269](https://github.com/filipto861/flytally-logbook/pull/269) and docs PR [#270](https://github.com/filipto861/flytally-logbook/pull/270) **MERGED**; Phase 1 accepted by owner | Do not reopen or describe #270 as pending |
| Phase 1 verification | Deployed at `cc7abd41` / Vercel `dpl_51zwnZYfFADxeDEyZheTYg9siXD8` READY; owner-reported live browser functional smoke PASS; public Map API **4/4 PASS**; prior exact-candidate local Node **1,447/1,447**, PostgreSQL **100/100**, build and desktop/mobile Chromium **12/12** each PASS | Native physical iPad/Safari and full provider acceptance **NOT VERIFIED**; do not inflate acceptance |
| Historical Satellite R1/R2 stack | **Draft/unmerged** engineering in [PR #272](https://github.com/filipto861/flytally-logbook/pull/272) through [#279](https://github.com/filipto861/flytally-logbook/pull/279), with some exact-SHA **local synthetic** ON/OFF, auth/HTTP and browser PASS | **FIRST priority: S1 provider architecture/evidence decision**, then S2 controlled integration and real acceptance; production UI flag **OFF** |
| 3.7.0 Phase 3 — openAIP Aviation | **A2A/A2B1/A2B2 MERGED, Production feature OFF. A2D PR #293 Draft/unmerged; combined Aviation upstream and UI implemented on feature branch. Original `b10d81b7` local ON/OFF synthetic release gate PASS (each Node 1472, source 233, domain 36, desktop/mobile 8+8); separate PG integration gate N/A, browser used isolated PG18.** | Docs-only commit creates another SHA requiring candidate-specific checking. Before any Production ON: bounded authenticated through-app provider smoke, provider entitlement/quotas/rights and owner rollout decision, plus iPad/Safari review. |
| Next scheduled release | `3.8.0` Currency / monetary semantics | Do not begin runtime until 3.7.0 closure or explicit reprioritization |

**Source-of-truth boundary:** this table reflects inspected `main`, live GitHub PR states, and the owner's 10 October Satellite-first decision recorded in [the current-state handoff on an unmerged branch](https://github.com/filipto861/flytally-logbook/blob/feat/3.7.0-openaip-airspaces-a2a-offline-control/docs/product/3_7_0_CURRENT_STATE.md). The handoff is supporting evidence, **not merged runtime**. Offline supplier experiments and isolated tests are not real ArcGIS/openAIP acceptance.

### Frozen decisions and immediate next step

- **Satellite FIRST was the completed sequencing decision**: Satellite is now deployed, and openAIP offline/proxy/UI are merged with provider disabled. A2D owner-selected combined Aviation raster is the current product decision; original Airspaces-only branch is historical. Remaining next phase is final candidate/doc evidence and controlled provider verification/owner rollout approval, NOT unbounded new architecture or a blind Production flag enable. Do not open generalized Node/undici diagnostic loops without new evidence.
- **Both Satellite and openAIP remain in the planned 3.7.0 deliverable.** If external provider evidence prevents openAIP delivery, only an explicit owner release/scope decision may change that; do not silently ship a partial 3.7.0.
- Standard remains default; optional Satellite applies only to authenticated routes/GPS/review surfaces, without automatic prefetch or stored preference. Public shared replay stays Standard-only. Existing Story Standard/Satellite and PNG behavior must be preserved, but its external-provider use/export rights need independent verification.
- openAIP first scope is **authenticated airspace-only raster reference overlay**, off by default. It is not an approved aviation chart, NOTAM, active-airspace or clearance authority; public/export excluded.
- No speculative Esri tile-grid transform, licence entitlement, provider quota, decoded-image resource budget, caching permission or production enablement. Missing evidence gives **BLOCKED / unavailable**, not invented defaults.
- Existing certification, flight model, GPS inference, sharing/privacy and 3.6.0 data integrity must not change as a side effect of maps work.

**Next bounded deliverable: `3.7.0 Phase 2 / S1 — Satellite provider decision`.** Compare the existing server-side imagery/label SVG composition against an officially supported layered Esri approach under actual tiling geometry, attribution, entitlement, cost, secure proxy and resource evidence. Produce a written **GO / NO-GO / DEFER** and a minimal S2 implementation plan; do not repeat unapproved live requests. Source-backed provider/rights and real tile-path checks are necessary before production ON. DeepSeek review should challenge the final S1 architecture before implementation.

## Document ownership

- `FEATURES.md` = implemented, intentionally constrained and planned capabilities.
- `ROADMAP.md` = active order, dependencies, decisions and acceptance.
- `CHANGELOG.md` = actual changes with historical dated evidence.
- `ARCHITECTURE.md` = canonical data/integrity model.
- `DEVELOPMENT.md` = verification and development workflow.
- `docs/product/VERSIONING.md` = numeric release/versioning rules.
- Detailed active release contracts belong under `docs/product/`; superseded detail belongs under `docs/history/`.

A release is not DONE until implementation, exact-candidate verification, required docs, and applicable production closeout are complete.

## Versioning rule

Since 4 October 2026, new release targets use `MAJOR.MINOR.PATCH` and `Phase 1 / Phase 2 / ...`; no new active legacy E/F/B/SP/M-style milestone families. Technical database schema, certification payload and backup-format versions are independent. Historical legacy milestones remain at `docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md`.

## Status legend

- ✅ **DONE** — completed and accepted for explicit scope.
- 🚧 **ACTIVE** — current release.
- ➡️ **NEXT** — first release after ACTIVE.
- ⏳ **PLANNED** — accepted, not active.
- 🔬 **RESEARCH** — not implementation-ready.
- ⚠️ **BLOCKED / EXTERNAL** — source, provider or external decision still required.

## Phase 1 frozen product decision — 9 October 2026

**Decision A APPROVED and shipped with Standard Phase 1:** For `/api/map-tile/[z]/[x]/[y]`, missing `style` means legacy Standard. Exactly one `style=map` or `style=satellite` is allowed. Duplicate, malformed, empty, unknown or case-variant style arguments return **HTTP 400** `unsupported_style`, `Cache-Control: no-store`, before upstream access. This intentionally rejects formerly permissive duplicate query handling. The parsing contract is **not** proof of Satellite provider authorization or entitlement.

## Current production baseline

| Area | State |
| --- | --- |
| Core pilot logbook, certified evidence and revisions | ✅ Production |
| Aeroplane / Helicopter / Sailplane / Balloon / ULL / conservative Other | ✅ Production |
| Manual and GPS entry, review, T&G and evidence-limited SERA Day/Night | ✅ Production |
| Recency, licences, shared flights, aircraft profiles, backups, statistics | ✅ Production |
| Standard map layer/controller | ✅ Phase 1 accepted on deployed `main@cc7abd41` |
| Product version | **3.6.0** |
| Database schema | **v20** (independent technical counter) |

## Canonical release sequence

| Order | Target | Workstream | Status | Dependency / reason |
| ---: | ---: | --- | :---: | --- |
| 1 | **3.4.0** | Flight Entry Simplification | ✅ | Production 5 October 2026 |
| 2 | **3.4.1** | GPS Night-time reliability | ✅ | Production 6 October 2026 |
| 3 | **3.5.0** | Certified flight voiding + multi-aircraft integrity audit | ✅ | Production 7 October 2026; schema v20 |
| 4 | **3.5.1** | GPS T&G false-positive containment | ✅ | Production 7 October 2026 |
| 5 | **3.5.2** | Always-on GPS/SERA Night suggestions | ✅ | Production 7 October 2026 |
| 6 | **3.5.3** | Flight detail navigation UX | ✅ | Production 7 October 2026 |
| 7 | **3.5.4** | iPad flight-detail visual hotfix | ✅ | Production 7 October 2026 |
| 8 | **3.5.5** | iPad sidebar collapse-control alignment | ✅ | Production 7 October 2026 |
| 9 | **3.6.0** | Saved-date / timezone semantics · #144 | ✅ | Production 9 October 2026 |
| 10 | **3.7.0** | Maps & Aviation Layers | 🚧 | Phase 1 ✅; Satellite FIRST, openAIP afterward; both source-gated |
| 11 | **3.8.0** | Currency / monetary semantics · #136 | ➡️ | Preserved after 3.7.0 |
| 12 | **3.9.0** | Multi-aircraft heterogeneous onboarding proof | ⏳ | Canonical multi-category workflows |
| 13 | **3.10.0** | Multi-aircraft sharing / recovery / scale closeout | ⏳ | Controlled recovery and performance |
| — | — | GPS T&G time-normalized / evidence-limited follow-up | 🔬 | More real-track evidence needed |
| — | — | Professional Logbook Platform | 🔬 | No release number |

**Pre-emption:** only evidenced production, security or data-integrity issues override sequence automatically. Any material product reprioritization requires an explicit owner decision and roadmap update.

## Completed numeric releases — reference only

Detailed previous acceptance, source decisions, code/test/production timelines and superseded failures for `3.4.0` through `3.6.0` are in the [verbatim historical roadmap snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md) and `CHANGELOG.md`. These headings are retained as stable reference anchors, **not active milestones**.

#### 3.5.1 — GPS Touch-and-Go false-positive containment — DONE / PRODUCTION

#### 3.4.1 — GPS Night-time reliability — DONE
##### Single implementation phase — DONE

#### 3.4.0 — Flight Entry Simplification — DONE

#### 3.5.0 — Multi-aircraft integrity + certified-flight voiding — DONE / PRODUCTION

#### 3.5.2 — Always-on GPS/SERA Night suggestions — DONE / PRODUCTION
#### 3.5.3 — Flight detail navigation UX — DONE / PRODUCTION
#### 3.5.4 — iPad flight-detail visual hotfix — DONE / PRODUCTION
#### 3.5.5 — iPad sidebar collapse-control alignment — DONE / PRODUCTION

#### 3.6.0 — Saved-date / timezone semantics — DONE / PRODUCTION

---

# 3.7.0 — Maps & Aviation Layers — ACTIVE

**Product goal:** Standard/Satellite optional map layers on authenticated flight-map consumers and optional private source-backed openAIP airspace reference. Preserve center/zoom, GPS replay, Story behavior, privacy, theme/iPad usability, and no modifications to flight/certification/recency evidence.

**Source contracts and prior detailed evidence:** `docs/product/3_7_0_MAPS_AVIATION_LAYERS.md`, `docs/product/3_7_0_PHASE1_TEST_ACCEPTANCE.md`, `docs/product/3_7_0_MAPS_REVIEW_RECONCILIATION.md`, and [the historical roadmap snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md). Latest unmerged handoff details are not a substitute for current PR/head inspection.

## Phase 0 — Discovery / review — DONE

Initial source inventory, pane/fallback contract and independent review completed. External provider eligibility is **not** cleared by that discovery.

## Phase 1 — Standard Maps controller — DONE / PRODUCTION

PR #269 merged as `cc7abd41`; PR #270 documentation closure merged as `7d47010e86`. Owner manual signed-in Map/GPS replay/public-share/mobile browser smoke PASS; production public Map API 4/4 PASS; original local release candidate Node 1,447/1,447, PG 100/100, build, Chromium desktop/mobile 12/12 each PASS. Native Safari/iPad device evidence remains unverified. **Do not report 3.7.0 as shipped.**


**Owner-local verification checkpoint (10 October 2026; pre-CRLF correction):** Node 24.19.0 targeted tests **12/13 PASS, 1 source-string test FAIL** because the assertion hardcoded LF across lines and Windows checkout may use CRLF; all **5/5 isolated API-behavior tests PASS**. `npm run typecheck` **PASS**; `npm run build` **PASS**, Next.js 16.3.2, 41/41 static page generation. Repaired the line-ending-sensitive source test only in commit `53598df`; rerun on new HEAD **NOT RUN**. Full suite/real Next HTTP/PG/Playwright/CI/deploy remain NOT RUN.

## Security pre-emption — Satellite tile endpoint auth (DRAFT / UNVERIFIED)

**10 October 2026:** Source audit plus DeepSeek S1.1 review identified that production `main` Satellite map-tile route had no per-request `getSession()` gate and returned publicly cacheable SVG with wildcard CORS. This is a **confirmed source-code exposure**, not proof that Esri requests succeed or that costs were incurred. An isolated `fix/3.7.0-satellite-endpoint-auth-containment` Draft patch is being prepared to require live session 401, send `private, no-store` on success and preserve legacy public Standard and authenticated Story. **NOT MERGED/DEPLOYED; tests NOT RUN.** The security patch deliberately keeps the shared Next.js 16 route on default request-time GET behavior instead of `force-dynamic`, to avoid overriding the Standard upstream's explicit `next.revalidate` fetch-cache contract. Confirm via actual Next HTTP tests. Before any merge/deploy: exact-candidate automated + authenticated Next HTTP tests, risk-plan build/browser/PG as selected, public CDN cache/old-object review, owner version/rollout/rollback decision. UI Satellite remains OFF; this fix does not clear provider licensing, geometry, resource budgets or 3.7.0 release gates. Details also in Draft [S1 reviewer reconciliation](docs/product/3_7_0_S1_SATELLITE_ARCHITECTURE_DECISION.md) (unmerged PR #281). The [security acceptance runbook](docs/product/3_7_0_SATELLITE_AUTH_SECURITY_ACCEPTANCE.md) defines isolated route behavior tests, Next/Story/browser gates and CDN/browser cache rollout. This is source/testing scaffolding, **not a local Node PASS**.

**PR #282 execution checkpoint (10 October, supersedes the original NOT RUN snapshot above):** At clean detached `be52aee`, owner-local 13/13 targeted tests, 1,453/1,453 full Node tests, typecheck/source/domain, production build and 401/400 anonymous/invalid-style Next HTTP passed. Authenticated browser risk gate then built/bootstrapped an isolated PG18 fixture; desktop **4/5 PASS**, one fixture-only setup FAIL (`flight_public_shares` lazy-schema ordering), mobile NOT RUN. A small test-only initialization fix is committed on the PR branch; **current-HEAD browser/release acceptance NOT RUN**. Next: owner fetches exact new HEAD, confirms dedicated PG fixture identity, reruns risk browser and aggregate release gates; no stale-SHA evidence reuse. Production/Esri/CDN rights and deployment approval remain separately gated. No feature scope change or train-repo change.

## Phase 2 — Satellite — ACTIVE / SOURCE-GATED

**Owner priority: Satellite FIRST (10 October 2026).** Existing stacked Draft branches/PRs contain a local-only selector and engineering/testing for Story PNG, authenticated tiles, fallback, emergency upstream disable and bounded-provider helper experiments. Some earlier exact runtime SHAs passed local ON/OFF release gates with synthetic upstreams. None proves actual Esri tile-grid compatibility, entitlement, cost, live supplier response, production authorization or physical Safari.

1. **S1 — NEXT: source-backed provider architecture / rights decision.** Verify exact Esri World Imagery + labels scheme compatibility (256 vs 512 tile contracts), supplier attribution, tile/export rights, token/referrer privileges, acceptable caching/cost and bounded resource policy. Compare existing server composition against documented layered approach; resolve **GO / NO-GO / DEFER**, without guessed transforms or unapproved supplier probes.
2. **S2 — conditional integration.** Integrate only the selected scheme into existing authenticated map/Story boundaries; keep Standard default and public share Standard-only. Enforce server-side session/disabled-state ordering, no-store as required, controlled unavailable/fallback and correct attribution. No new database or certified flight changes by assumption.
3. **S3 — acceptance gate.** Real permitted provider evidence, ON/OFF exact-SHA testing, Next build, isolated PostgreSQL if selected by risk planner, authenticated HTTP, desktop/mobile/iPad landscape+portrait light/dark/browser touch, Story exports, error/no-provider paths and production smoke **before activation**. Synthetic PASS cannot replace provider licence or production test.
4. Existing Satellite provider metadata attempts were inconclusive (one rejected Content-Type, one HTTP 200 `text/plain` rejected by collector; Windows Node native assertion root cause not established). **No additional supplier GET pre-approved**. Do not loop diagnostics unless a concrete S1 decision requires them.

## Phase 3 — openAIP Airspaces — PLANNED / EXTERNAL BLOCKED

**Pause active implementation until Satellite acceptance.** Earlier A2A offline parsing/capability-gate code is staged only, not merged/tested as a product feature. Before any live proxy: establish authoritative applicable SaaS usage rights, current Tiles API schema/auth, airspace-specific layers, attribution, quota/cost, caching and source-age requirements. Unknown or missing rights mean **unavailable**. Following approval, implement authenticated fixed-host raster overlay in `flytallyAviation` pane with nonauthoritative airspace wording; no public sharing/Story tiles, no NOTAM or activation claim.

## Phase 4 — Integrated release acceptance — PENDING

Full 3.7.0 requires **both** Satellite and openAIP source-backed delivery unless owner explicitly changes scope. Exact candidate release gate and feature-flag ON/OFF, PostgreSQL, browser/iPad, rights/attribution, logs, provider observation, rollback, production smoke, VERSIONING/package/footer/CHANGELOG and final owner merge/deploy acceptance. **No merge en masse** of stacked drafts; integrate in reviewed small batches. No CI/deploy success is inferred from local tests.

# 3.8.0 — Currency / monetary semantics — NEXT (formerly 3.7.0)

Preserve issue **#136** and all existing monetary/data-integrity decisions: classify currencies already persisted, account default/display versus record authority, legacy values without explicit denomination, export and backups. No silent FX conversion or guessed legacy currency. Reconstruct code/data, freeze contract and request independent review before implementation.

# 3.9.0 — Multi-aircraft heterogeneous onboarding proof — PLANNED (formerly 3.8.0)

Prove canonical catalogue/manual identity, Add/Edit, Quick Add, deactivate/reactivate, flight selection and applicability across Aeroplane, Helicopter, Sailplane/TMG, Balloon, ULL and Other, desktop/iPad/mobile and light/dark. No make/model-specific branch.

# 3.10.0 — Multi-aircraft sharing / recovery / scale closeout — PLANNED (formerly 3.9.0)

Prove shared profile recipient ownership, canonical validation, safe removal with historical flights, backup/restore of certification evidence and measured multi-profile scale before optimization. Exact tests, DB and browser acceptance required.

# Research — Professional Logbook Platform

No version assigned. Organization/operator accounts, fleet workflows, instructor/student organization evidence, team permissions and reports require a separate product-scope decision.

## Permanent engineering constraints

- One canonical flight model, shared strict Create/Edit/GPS rules; invalid evidence or combinations fail closed.
- Certified/finalized history remains audited, never silently/destructively overwritten; regulatory/recency claims evidence-first.
- Server-side authentication and ownership are mandatory; no client-only provider permission.
- Schema/backup/certification changes are explicit migration and release decisions, not map-side effects.
- Runtime/code and UI verification must be for the exact commit and environment; unknown steps remain **NOT RUN**.
- ROADMAP, FEATURES and CHANGELOG reconciled in each milestone; do not rewrite past verification into a fictional PASS.
- No change to `flytally-training` in this release.

## Historical record

- [Verbatim pre-10-Oct-2026 roadmap snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md) — includes previous numeric-release detail, PR #269 pre-merge attempts, stale contemporaneous Phase 1 statuses and long verification logs; **not a current roadmap**.
- `docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md` — previous E/F/B/SP/M milestone history.
- `CHANGELOG.md` — dated merged/deployment/verification history; its older entries describe status **at the time written**, not today's current state.
