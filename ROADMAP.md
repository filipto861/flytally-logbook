## 2026-10-09 — Satellite R2D technical hardening prioritized (owner direction; review only)

**Current milestone: R2D.0 DESIGN/REVIEW STAGED, NOT IMPLEMENTED.** Owner requested continuing Satellite implementation without opening a separate licence-research workstream now. This reprioritizes the *next work*, not a production permission or deployment decision. Previous R2C closeout remains authoritative: tested runtime `66c3aec4d49bc576c67afd39720fe03d4e48b17c`, HTTP fixture PASS, independent Satellite ON/OFF local release PASS; closeout docs SHA `8e0851012e271927157e7d5f3ae6a1aca76d6715`.

**Design contract:** `docs/product/3_7_0_SATELLITE_R2D_OPERATIONS_DESIGN.md`. Scope: read-only inventory of live request paths including Story auto-probe, explicit emergency provider-disable behavior, synthetic request pressure and memory/timeouts, genuine global budget semantics (no fake per-process quotas), native Safari plus production-equivalent HTTPS smoke plan. Keep all authenticated Standard/Satellite map and Story preview/PNG functionality, Standard-only public replay, Standard default and production flag OFF. No production API change, no merge/deploy, no external provider traffic. R2D.0 → independent DeepSeek review → **only then** R2D.1 minimal stop-control batch → targeted/HTTP/ON-OFF release verification; numeric I/O ceilings and global quotas need evidence and separate decision. External provider conditions and activation authorization remain independently deferred, not inferred approved from working Story.

**Evidence:** docs-only GitHub commit(s) on `feat/3.7.0-satellite-r2d-ops-design`; tests/build/DB/browser for R2D **NOT RUN** and **N/A to design-only scope**, and no current runtime release claimed.

## 2026-10-09 — 3.7.0 Satellite R2 Batch 2C LOCAL CLOSEOUT / VERIFIED

**Milestone:** R2C isolated authenticated HTTP integration and both ON/OFF release gates **CLOSED (local evidence only)**. **Exact tested runtime/test HEAD:** `66c3aec4d49bc576c67afd39720fe03d4e48b17c`; **candidate:** `a5f5b1bef64d80aa78cfe6bfbeea69a6e2ad7c931c36b6664f0fddd16fd7dd25`. On clean Windows checkout with confirmed disposable localhost PostgreSQL identity, owner ran `node tooling/verify-satellite-http.mjs` → **PASS**, 13 isolated synthetic provider interceptions (no real Esri requests), including anonymous rejection, signed-in 200 SVG, labels fallback, unavailable imagery 502, imagery-only 200, revoked session 401 without new upstream requests, and public Standard 200. Owner then ran `npm.cmd run verify:release:risk -- --base origin/main --rerun` twice, once with Satellite **ON** and once **OFF**, each building afresh on same HEAD/candidate: **release_status=PASS**, source 233/233, domain 46/46, typecheck PASS, aggregate 1460/1460, production build PASS, PostgreSQL 100/100, Chromium desktop 11/11 and mobile 11/11, `blocked_evidence=none`.

**Frozen boundaries:** production auth/session/route/provider unchanged in R2C; secure cookie tested using browser-native same-origin localhost transport, not actual production TLS. Standard stays default; public share remains Standard-only; feature flag OFF in production; all satellite PRs remain Draft, unmerged and undeployed. Earlier failed runs and their fixes below remain historical (not current blockers). **No live Esri, native iPad/Safari, commercial license, real billable traffic or production activation verified.** This documentary closeout follows the exact tested SHA; if documentation commit advances HEAD, do not misattribute release evidence to that later HEAD.

**Next roadmap step — R2 provider production-readiness design/review before any activation:** validate provider grant/licence/attribution and real endpoint, establish authenticated request/quotas/concurrency and billable-ceiling/kill-switch policy from evidence rather than invented defaults, verify error monitoring and deployment runbook, review with independent second AI, then implement minimal approved control batches and rerun appropriate verification. Separate Phase 3 openAIP rights/applicability; defer any production flag change/merge/deploy until explicit owner authorization and verified runtime.

## 2026-10-09 — R2C second HTTP attempt: first authenticated tile 200, fixture response-header defect corrected (NOT RE-VERIFIED)

Owner local exact-HEAD `d489365f0390729da60421586c71bbbb40e87416`: targeted map tests **20/20 PASS**; `verify:iterate --base origin/main` **PASS**, source **233/233**, domain **46/46**, typecheck PASS, blocked evidence none; candidate `c97de472290f79857c4fc9194bc61f207024ebac6301916077c34646d663788c`. Standalone `node tooling/verify-satellite-http.mjs` **FAIL** with `response.headers is not a function`. This failure occurs in the **test assertion** after the first authenticated satellite tile x=1 reached HTTP **200**, passed private/no-store and satellite-style assertions, and the script tried to check its content-type. Production API/session were unchanged; the earlier 401 test-transport issue did not recur in this run. No proof for later tiles, fallback, revocation or Standard within this stopped run.

Fix: browser-native `page.evaluate(fetch)` returns a serialized response with `headers` as an **object**, but one remaining test-only assertion used old `response.headers()` from Playwright APIResponse. Changed just that assertion to `response.headers["content-type"]`; added targeted source regression assertions. No production API, auth, provider, session settings or schema changes. **New SHA targeted/iteration and standalone HTTP all NOT RUN yet**, and current-HEAD release ON/OFF NOT RUN (both verified PASS only on earlier tested SHA `5e7d1b0e509b74e3e5d8632a83493fd586fa8817`). Follow-up: owner-run fast target + iteration + isolated HTTP, then exact-HEAD ON/OFF release if HTTP passes. All PRs Draft, production Satellite OFF, no deploy or merge.

## 2026-10-09 — R2C first authenticated HTTP acceptance FAIL (401); test-transport correction PENDING

**First manual HTTP run, exact then-HEAD `5e7d1b0e509b74e3e5d8632a83493fd586fa8817`:** isolated fixture started; anonymous Satellite gate 401 and invalid-style preflight proceeded; **first signed-in tile x=1 returned 401, expected 200 → HTTP fixture FAIL**. Remaining provider/fallback/session-revocation and Standard scenarios **NOT EVALUATED** in this first run. Do not relabel HTTP as PASS. Prior independent full local release ON/OFF gates PASS on `5e7d1b0e...` and remain historical exact-HEAD evidence, not a new-head test result.

**Source-backed diagnosis:** production session creation intentionally sets `Secure` when `NODE_ENV=production`; the original stand-alone harness sent requests to `http://127.0.0.1:3107` using Playwright's Node-side APIRequestContext after a UI login. This may have prevented the secure browser cookie from accompanying API calls (not yet proved as sole cause). A **test-only** correction now uses the special `http://localhost:3107` loopback origin, asserts an issued `HttpOnly` + `Secure` browser cookie and uses browser-native same-origin `fetch()` instead of Node-side authenticated HTTP requests. Production `lib/auth/session.ts`, `app/api/map-tile`, provider and cache/security headers are unchanged. This localhost accommodation is **NOT** proof of TLS/HTTPS behavior in production. Regression source guard added. No cookie value is logged or injected into headers. New HEAD targeted, iteration, HTTP acceptance and ON/OFF release **NOT RUN**; must be verified by owner. If 401 recurs, inspect cookie availability and session DB evidence before changing auth; never weaken `secure`, `httpOnly`, server authorization or fail-closed behavior.

## 2026-10-09 — R2 Batch 2C isolated authenticated HTTP integration (IMPLEMENTED / NOT RUN)

**Branch:** `feat/3.7.0-satellite-r2-http-integration` stacked on R2 Batch 2B Draft PR #275; Batch 2B tested runtime HEAD `8a0485f6b8fefc7baecae9d41bc0e2de7ed8ed68` remains the only latest **release-verified** implementation SHA. No app route/provider/auth code or database migrations modified by 2C.

**What changed:** added manual-only `tooling/verify-satellite-http.mjs` plus `tooling/satellite-http-upstream-fixture.cjs`, and one source guard in `tests/v370-map-layers.test.ts`. The script checks clean exact branch, a production build, isolated localhost DB URL **and live DB identity** (`flytally_satellite_r1_test|flytally_sat_r1|55432`), and existing authenticated-browser mode **before** the destructive local fixture bootstrap. It launches a *separate* Next production server on loopback port 3107 with a fresh fake `ARCGIS_ACCESS_TOKEN` (never live credentials) and a Node-preloaded outbound fetch fixture, with additional remote socket denial. Browser network requests to other origins are aborted. There are no production env/mock switches, no external Esri calls intended and no exposed secrets. Test can be run manually **only after** a fresh matching production build: `node tooling/verify-satellite-http.mjs`. It mutates/rebuilds the confirmed disposable test database, not production.

**Acceptance contract (pending actual run):** unauthenticated Satellite returns 401/private no-store and triggers no provider calls; invalid style returns 400; signed-in `/api/map-tile/3/x/2?style=satellite` goes through actual Next request handler, session cookie and provider composition to simulated World Imagery + preferred labels (200 SVG), alternative labels fallback (200), failed base (502), missing both labels (imagery-only 200) and thrown base-network failure (502). Fake token must not appear in response. After revoking the session in the **local** auth_sessions fixture, the same tile must return 401 without a provider request. Public Standard OSM proxy remains 200/public cache/CORS. A fixture log tracks intercepted provider calls *without tokens*; missing interceptions fail the test rather than producing false PASS. A new source contract ensures no test switch leaks into runtime.

**Status:** CODE STAGED / **targeted tests, iteration, release ON/OFF and standalone HTTP fixture all NOT RUN on Batch 2C HEAD**. Prior R2 2B PASS does not transfer. No HTTP function correctness or live provider result claimed. Outstanding: native Safari/iPad, real provider availability/entitlement, CDN cache eviction, quota and operational budget controls, production smoke; handle independently before activation. All stacked PRs remain Draft; no merge/deploy/production flag change.

## 2026-10-09 — R2 Batch 2B local release CLOSEOUT (Satellite ON/OFF VERIFIED)

**Exact runtime/test HEAD:** `8a0485f6b8fefc7baecae9d41bc0e2de7ed8ed68`; **candidate ID:** `8c87a17fbe980df3b02065528e65d7cdd2171e839dbaca67eb22e7fdec5f0feb`. Owner-run Windows PowerShell release verification on clean branch and isolated local PostgreSQL database `flytally_satellite_r1_test|flytally_sat_r1|55432`, configured auth fixture and SESSION_SECRET. Source evidence: separately supplied logs from both fresh full reruns. The candidate ID does **not** itself encode the client build-time Satellite ON/OFF value; preserve the two distinct run environments/evidence.

- **ON:** `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`; `npm.cmd run verify:release:risk -- --base origin/main --rerun` → `release_status=PASS`, source 233/233, domain 46/46, typecheck PASS, full aggregate **1459/1459**, production Next.js build PASS (41/41 pages), PostgreSQL acceptance **100/100**, Chromium desktop **11/11**, Chromium mobile **11/11**, `blocked_evidence=none`.
- **OFF:** `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=false`; same `--rerun` command → `release_status=PASS`, source 233/233, domain 46/46, typecheck PASS, full aggregate **1459/1459**, production Next.js build PASS (41/41 pages), PostgreSQL acceptance **100/100**, Chromium desktop **11/11**, Chromium mobile **11/11**, `blocked_evidence=none`.
- Earlier corrected-HEAD iteration PASS, including `tests/v370-map-layers.test.ts` targeted **19/19**; original source inventory failure on old HEAD was real and is retained below as historical, resolved by explicit GPS module + browser-target ownership before these reruns.
- **Verified scope:** deterministic production satellite provider composition with test-injected synthetic provider fetches, preferred/fallback labels, imagery-only and outage behavior; no broken Standard/GPS/replay/Story browser acceptance was observed in the tested two Chromium projects. **Still NOT VERIFIED:** an authenticated request through a running Next.js route and controlled upstream response (current browser tests intercept the FlyTally API path), actual Esri provider/live token, native Safari/iPad, existing CDN cache purge, request pressure/rate ceilings, CI and production smoke.
- **Batch 2B runtime locally VERIFIED / documentation closure only.** Documents committed after tested SHA are docs-only and are not separate runtime verification. Draft stacked PR #275 only; no merge, production flag change, deployment, new DB migration or live provider activation. **Next**: R2 authenticated full HTTP integration with isolated upstream fixture; avoid provider test calls or exposing token.

## 2026-10-09 — R2 Batch 2B iteration blocker and ownership fix (RECHECK PENDING)

Owner-run local exact-HEAD `verify:iterate -- --base origin/main` on previous Batch 2B SHA `94749f97d17cae873c3768d6916a848cbc77d622` **FAILED**: source contracts **232/233 PASS, 1 FAIL** (`tests/development-scope.test.ts` stable-ownership inventory expected **388** runtime files but detected **389** after adding `lib/satellite-map-provider.ts`); domain **46/46 PASS**; TypeScript **PASS**; candidate ID `b9030534521da8b3477fcd565f967ad365543b3e56acfb45eb8dcced3b112c70`; release **NOT EVALUATED**. This was an evidence/ownership boundary issue, not evidence of provider function correctness.

**Fix staged:** registered new module prefix `lib/satellite-map-provider` under stable `gps-tracks` ownership (not a shared-runtime shortcut), added exact prefix to authoritative browser map tile/track/style desktop+mobile pathTargets in `tooling/development-modules.json`, set auditedTotal=389; updated prior source guard in `tests/v370-map-layers.test.ts` and added explicit ownership+browser selection regression test. No further runtime changes, API contract alterations, flight-data/DB changes, merges or deploys. Previous failure preserved; **all gates on corrected HEAD NOT RUN**, must re-run source, domain, TypeScript and targeted v370 tests before full ON/OFF release.

## 2026-10-09 — R2 Batch 2B upstream provider fixture and failure isolation (STAGED / NOT RUN)

**Branch:** `feat/3.7.0-satellite-r2-provider-fixture` stacked on R2 2A Draft PR #274. **Goal:** close missing deterministic *production provider-composition path* coverage without sending any live/paid provider requests. Extracted existing World Imagery/Imagery Labels/fallback/reference SVG composition from the authenticated `app/api/map-tile/[z]/[x]/[y]/route.ts` into `lib/satellite-map-provider.ts`, retaining provider URL formats, tile coordinate order (z/y/x), token encoding, Referer/UA and seven-day upstream Next fetch cache; the endpoint still performs strict style validation, session gate and secret read **before** provider invocation. Legacy public Standard OSM endpoint is unchanged in contract. No client, Story, GPS, auth persistence, DB schema or feature flag edits.

**Targeted reliability fix:** provider network rejections no longer cause an uncaught 500 during Satellite composition. Missing/unavailable base imagery returns unavailable and is mapped by the route to existing HTTP 502; missing preferred imagery labels try existing reference fallback, and if neither label provider works, existing imagery-only SVG remains available (no invented labels). Test functions inject an in-process mock `fetch` only in tests, not in application runtime; no production mock/URL override is introduced.

**Tests added (NOT RUN):** one source bridge guard plus five async unit cases in `tests/v370-map-layers.test.ts`: real production function with synthetic successful base+labels, rejected labels→fallback, thrown labels→fallback, thrown base→null, and both labels unavailable→imagery only. Tests verify exact URL order, token confinement/encoding, request headers and Next upstream TTL. Existing source/Playwright fixtures must still pass both Satellite ON/OFF. **What this does not yet prove:** a full authenticated HTTP request through a running Next server with a controlled Esri upstream stub; existing Playwright intercepts the FlyTally tile endpoint itself. Neither live Esri responses, native Safari nor production rollout are verified. Follow-up requires authenticated end-to-end positive request and explicit request pressure, timeout and provider budget controls without fake credentials or quota values. **Status:** IMPLEMENTED STAGED / all new runtime/test gates NOT RUN. No merge/deploy/production change.

## 2026-10-09 — R2 Batch 2A exact-HEAD verification CLOSEOUT (local Satellite ON + OFF PASS)

**Implementation/test SHA:** `254284ab364f6e266c0cf5be32852073b5f5557c`. **Candidate ID:** `e31536a35dea1a0a671dbde8a0d652fc4bb6983879e7079db37244dc6cd2ad67`. Both owner-run PowerShell runs verified the exact branch, clean worktree, `SESSION_SECRET`, and dedicated local PostgreSQL identity `flytally_satellite_r1_test|flytally_sat_r1|55432`. Logs are from **local Windows**, not CI. Same candidate ID does not distinguish ON/OFF build flags, so retain each build/run independently.

- **Satellite ON** (`NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`; `npm.cmd run verify:release:risk -- --base origin/main --rerun`): final `release_status=PASS`; fresh source **233/233**, domain **46/46**, TypeScript **PASS**, aggregate **1452/1452**, fresh Next.js build **PASS (41/41 pages)**, isolated PostgreSQL **100/100**, browser Chromium desktop **11/11**, mobile **11/11**, `blocked_evidence=none`.
- **Satellite OFF** (`NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=false`; `npm.cmd run verify:release:risk -- --base origin/main --rerun`): final `release_status=PASS`; fresh source **233/233**, domain **46/46**, TypeScript **PASS**, aggregate **1452/1452**, fresh Next.js build **PASS (41/41 pages)**, isolated PostgreSQL **100/100**, browser Chromium desktop **11/11**, mobile **11/11**, `blocked_evidence=none`.
- The new anonymous Satellite tile request in browser acceptance is expected to be rejected with **401** and private no-store before upstream access. Tests also cover map/track/Story preview/PNG cases using **synthetic tiles**, not live Esri provider credentials. **A real authenticated positive-path request all the way through the server provider fetch remains NOT VERIFIED**. Neither old public CDN responses, native Safari/iPad, provider conditions, live-production availability nor quota enforcement was verified. Next R2 milestone should add controlled authenticated positive-path and denied-path network boundary checks, then study caching/request pressure, without altering desired Standard/Satellite Story or GPS behavior.
- **Batch 2A runtime accepted as locally VERIFIED**; docs-only commits following the exact tested SHA are not separately runtime-tested. No schema migration, merge, deployment, production Satellite flag activation, or CI success claimed. The earlier Batch 2A 'NOT RUN' entries remain historical pre-verification notes and are superseded by this closeout.

## 2026-10-09 — R2 Batch 2A session-gated Satellite API (IMPLEMENTED, TESTS NOT RUN)

Stacked after R2 Batch 1 (`feat/3.7.0-satellite-r2-functional-integration`, Draft PR #273). **Scope:** `app/api/map-tile/[z]/[x]/[y]/route.ts`, source contract, existing map browser acceptance; no Story/Leaflet/flight model/API schema changes. On `style=satellite`, validate existing opaque server session through `getSession()` **after strict style parsing and before reading `ARCGIS_ACCESS_TOKEN` or doing any upstream request**. Missing/revoked/expired session yields `401` with `Cache-Control: private, no-store` and unavailable style header. Satellite success also uses `private, no-store` and no wildcard CORS to avoid publicly shared cache bypass; Standard (including omitted-style legacy) remains public and unchanged. Existing signed-in Story, Routes, GPS Tracks, saved replay and GPS import call exactly the same Satellite tile URL with the existing session cookie, so no client integration or Story selection regression is intended. Public replay continues to request Standard only.

**Testing added:** direct source contract asserts ordering/session/cache boundary and noninterference with Standard; current registered browser map tile test additionally asserts `401` and no-store for anonymous Satellite while retaining 11 map/GPS browser scenarios per project. **Runtime/typecheck/source tests/aggregate/build/PostgreSQL/browser all NOT RUN on Batch 2A branch.** Execute exact-HEAD owner local verification with the same guarded disposable database before accepting. The prior Batch 1 ON/OFF PASS applies **only** to `49542fad9787e7ef40c4d7b117da35303e42117c`, not these new runtime edits.

**Open R2 follow-ups (not claimed complete):** live upstream positive-path verification with controlled fixture; request concurrency/session-check overhead; provider-specific billable request ceiling and kill switch (no arbitrary invented thresholds); strict trusted upstream Referer and secret handling; cache behavior with preexisting old public satellite responses. No database migration, merge, deployment or production flag change; no claim of live Esri availability.

## 2026-10-09 — R2 Batch 1 exact-HEAD local verification CLOSEOUT (Satellite ON / OFF)

**Runtime/test commit:** `49542fad9787e7ef40c4d7b117da35303e42117c` (clean Windows checkout, branch `feat/3.7.0-satellite-r2-functional-integration`). **Candidate ID:** `613756c436da76bf388134e4fef2ca251a29185cb551c70cba00b8f273f78740`. Evidence sourced from two owner-run PowerShell release logs; same candidate hash does **not** encode `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS` — retain both run configurations separately.

- **ON** (`NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`, `npm.cmd run verify:release:risk -- --base origin/main`): `release_status=PASS`; source/domain/typecheck `PASS:reused` from same-candidate iteration; aggregate **1451/1451 PASS**, fresh Next.js build **PASS**, PostgreSQL acceptance **100/100 PASS**, browser desktop Chromium **11/11**, mobile Chromium **11/11**, scale `N/A`, `blocked_evidence=none`.
- **OFF** (`NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=false`, `npm.cmd run verify:release:risk -- --base origin/main --rerun`): `release_status=PASS`; source **233/233 PASS**, domain **46/46 PASS**, typecheck **PASS**, aggregate **1451/1451 PASS**, fresh Next.js build **PASS**, PostgreSQL acceptance **100/100 PASS**, browser desktop Chromium **11/11**, mobile Chromium **11/11**, scale `N/A`, `blocked_evidence=none`. All listed gates fresh.
- Preflight verified exact branch/commit/clean worktree, `SESSION_SECRET`, and dedicated local PostgreSQL identity `flytally_satellite_r1_test|flytally_sat_r1|55432`. Browser checks used synthetic, locally served map tiles; no live Esri availability/rights, native Safari/iPad, CI, production smoke, merge, deploy, database migration or production flag activation claimed.
- Story Standard/Satellite PNG download tests cover PNG bytes/signature and tile-failure alert in both browser projects. **Batch 1 implementation is locally VERIFIED and eligible for review**, not merged or production activated. Existing earlier `NOT RUN` entries above/below are historical pre-verification state, superseded by this exact-head evidence. Documentation commits after the tested HEAD have not been separately runtime-verified. **Next: R2 Batch 2 authenticated server-side access/abuse controls; preserve both Story styles and GPS map functionality.**

### 2026-10-09 — R2 Batch 1 Story export integrity (IMPLEMENTED / NOT VERIFIED)

R2 branch implements a narrow Story export hardening batch: retain historical automatic satellite probe and choice; Standard/Satellite Story style buttons remain, renamed 'Map' to 'Standard' for cross-map consistency; prevent map style switching while preparing; require every selected map tile to return image content and exact expected `X-FlyTally-Map-Style` before embedding into PNG; no silent removal of failed tiles; capture export failures in an accessible alert; dispose temporary SVG blob URL. Dedicated source regression and extended existing registered authenticated browser case cover both map styles, downloaded PNG signatures, and tile failure. **Tests/typecheck/build/PostgreSQL/browser NOT RUN** on R2 branch. No map endpoint/server/auth/data model changes, R1 production activation unchanged. **Next: exact-HEAD clean-checkout local iterate, then full release gates with guarded disposable localhost PostgreSQL; review results before server gate implementation.**

## 2026-10-09 — R2 product scope decision (supersedes Standard-only Story proposal)

Owner explicitly requires Satellite **and** Standard to remain usable in authenticated Routes, GPS Tracks, saved flight GPS playback, GPS import review **and** Flight Story preview/PNG export. Do **not** remove Story satellite functionality or silently force Standard-only. Existing public replay behavior remains unchanged; extending public replay to Satellite is not authorized by this decision. R2 should harden the satellite route without disabling accepted consumers, and explicitly verify both Story export modes. The previous provisional recommendation to drop Story auto-probe unconditionally is superseded: audit it and replace only if equivalent discoverability/functionality is demonstrably preserved. Feature rollout and provider conditions are separate from this product UX decision; no activation/deploy authorized. Status: DESIGN/IMPLEMENTATION PENDING, tests NOT RUN on R2 branch.

### 2026-10-09 — R1 final local verification (Satellite ON and OFF)

- Exact **runtime/test HEAD** `7661d1dd30ba17948ef517f7ef193358380b67cd`, candidate `7292ab60ebbbaaa1c6e77caadf2f02a8257fcb6d649d41b437ae54c3ab140814`; Windows local owner-run `npm.cmd run verify:release:risk -- --base origin/main` with `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`: **release_status=PASS**; source=PASS (reused), domain=PASS (reused), typecheck=PASS (reused), aggregate=PASS (reused), build=PASS (reused), postgres=PASS (reused), browser desktop Chromium **11/11 PASS**, mobile Chromium **11/11 PASS**, blocked_evidence=none.
- Same exact HEAD/candidate, owner-run `npm.cmd run verify:release:risk -- --base origin/main --rerun` with `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=false`: **release_status=PASS**, source/domain/typecheck/aggregate/build/postgres/browser **all freshly PASS**, PostgreSQL acceptance **100/100**, desktop Chromium **11/11** and mobile Chromium **11/11**. PostgreSQL 18.6, dedicated local fixture at `127.0.0.1:55432/flytally_satellite_r1_test`, role `flytally_sat_r1` identity verified before both runs. Initial ON browser failure due to missing local SESSION_SECRET was fixed in ephemeral environment; final ON and OFF acceptance both PASS without a runtime change.
- ON/OFF share candidate ID because build-time flag is not encoded as distinct candidate identity: **retain separate evidence by flag value and run**; do not treat one build artifact as proving both. This documentation-only commit is **after** the verified HEAD; its exact new Git SHA has NOT been locally reverified. No CI, iPad native/Safari, real Esri network/provider authorization, production smoke, merge or deploy claimed.
- **R1 implemented + locally verified (runtime HEAD above); documentation closeout recorded.** PR #272 remains DRAFT; production Satellite remains OFF. **R2** needs server-side provider/rights/cost/auth/rate-control design (including legacy public Story satellite probe), independent review and explicit production entitlement before activation. No changes authorized to `flytally-training`.

# FlyTally Logbook Roadmap

**Status:** Active  
**Owner:** Filip Točík  
**Last updated:** 9 October 2026  
**Current production product version:** `3.6.0`  
**Current active release:** `3.7.0`  
**Current active workstream:** 3.7.0 Maps Phase 1 production/documentary CLOSED after merged PR #270 (`7d47010e`). Phase 2.1 Satellite UI trial remains on a Draft feature branch with build-time flag default OFF. Owner-run 233/233 source, 46/46 domain, TypeScript and standalone Next.js build PASS on prior candidate; full release aggregate 1448/1450 FAIL on two stale/mismatched test assertions; targeted test-only fixes staged, corrected head retest pending. PostgreSQL/Playwright, merge and deployment NOT RUN. External Esri rights, real attribution, cost and token/referrer gates BLOCKED. openAIP separately BLOCKED; full 3.7.0 not released.

### Phase 2.2 — Independent review remediation (9 October 2026)

**Exact pre-R1 owner-run verification (9 October 2026):** PR #272 head `3315da278d95285b89d1f95be0a557a849cf6af8`, candidate `0ca40786a1eec48370e3c4f69b7a7f2ec4dc382da3a25febc60847dddcf0681a`, `npm.cmd run verify:release:risk -- --base origin/main` with Satellite flag ON: source 233/233 PASS, domain 46/46 PASS, typecheck PASS, full aggregate PASS, candidate build PASS, isolated PostgreSQL acceptance PASS, desktop Chromium 11/11 PASS, mobile Chromium 11/11 PASS, `release_status=PASS`, `blocked_evidence=none`. This is **local** evidence, not CI or provider validation. **Subsequent R1 test/documentation-only commits change the candidate; current R1 HEAD verification NOT RUN.** Satellite remains OFF in production; Esri provider/legal/token/referrer/attribution/cost gates BLOCKED; PR #272 DRAFT and unmerged.

DeepSeek independent review: APPROVE WITH CHANGES; confirmed R1 gaps F4 (attribution-removal test) and F5 (comment-dependent assertion) addressed in draft feature-branch tests; F7 historical/current status reconciliation recorded here, FEATURES, CHANGELOG and Phase 2.1 contract. **Post-R1 tests, build, PG and browser NOT RUN.** Next: owner local exact-head flag-ON verification, separate flag-OFF regression, then R2 server tile proxy access/cost architecture review. Retain existing `FlightStoryCard` satellite probe behavior pending explicit compatibility decision; do not implicitly authorize Esri production activation.

This is the canonical forward plan for `flytally-logbook`.

**9 October 2026 — Phase 1 standard-only production functional acceptance (owner-reported manual smoke):** On deployed `main@cc7abd41858cb2b2ddd8e794889922c856885686` / Vercel `dpl_51zwnZYfFADxeDEyZheTYg9siXD8` (READY, `fly-tally.com` assigned), the owner confirmed the requested browser checks work: authenticated Map navigation/route and airport presentation plus light/dark theme; existing GPS flight replay including playback/theme/position behavior; existing public share view/privacy; and mobile/iPad map interaction/lock behavior. This is **owner-reported manual functional smoke PASS**, not an assistant-executed browser automation, screenshot/trace artifact, or independent proof of native Safari and both iPad orientations. Separately, user-run production HTTP Map API smoke **4/4 PASS** (real OSM image HTTP 200; invalid/duplicate styles HTTP 400 JSON `unsupported_style` with `no-store`). Exact pre-merge candidate `ef19b98cc30759a5b1f2b5f6b72ce8780be6890e293dd528bb6d04a794ce29ff` had local `release_status=PASS`: Node 1,447/1,447, PG 100/100, Next build PASS, Playwright desktop/mobile Chromium 12/12 each. Vercel recent aggregated runtime errors: none in the inspected window; request-log-level coverage not established. **Phase 1 standard-only function accepted by owner; documentary closure remains pending integration of docs PR #270.** This is **not** a full `3.7.0` release, version bump, Git tag, satellite/openAIP enablement, provider-rights approval, or native Safari test PASS. `3.6.0` remains product version. Prior READY rollback target: `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs`.

**Live production public Map API smoke — PASS 4/4 (9 October 2026, user-executed Windows PowerShell against `https://fly-tally.com`):** `GET /api/map-tile/0/0/0?style=map` returned HTTP **200**, `Content-Type: image/png`, `Cache-Control: public, max-age=86400`; `style=unknown`, `style=map&style=satellite`, and `style=map&style=map` each returned HTTP **400**, `Content-Type: application/json`, `Cache-Control: no-store`, with `unsupported_style` in the response. The script finished `PUBLIC MAP API SMOKE PASS`. This proves real domain HTTP behavior for those four cases, **not** live browser map rendering, authenticated map/flight replay, public share privacy, natively tested iPad Safari, upstream supplier licensing/attribution, or unrestricted real tile coverage. **Production Phase 1 acceptance remains OPEN** pending read-only browser UX/GPS/share/mobile verification. No production records were modified by this GET-only smoke.

**9 October 2026 — CURRENT PRODUCTION WATCH:** PR #269 squash-MERGED to main at `cc7abd41858cb2b2ddd8e794889922c856885686` (verified feature HEAD `397c8270d0088cb45ab1487d8ccdf2a35464284c`, candidate `ef19b98cc30759a5b1f2b5f6b72ce8780be6890e293dd528bb6d04a794ce29ff`). Local verify:release:risk PASS: aggregate 1,447/1,447; build PASS; PostgreSQL 100/100; desktop/mobile Playwright 12/12 each; iteration source 233/233, domain 46/46 and typecheck PASS. Vercel production deployment `dpl_51zwnZYfFADxeDEyZheTYg9siXD8` READY, assigned to verified `fly-tally.com` domain. Previous deployment `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs` remains READY rollback candidate. Live HTTP and signed-in user map/replay/public-share smoke NOT VERIFIED because direct network access to site was unavailable to available reviewer tools; inspected recent Vercel runtime errors showed none, but new deployment had no request logs. Production acceptance/Phase 1 closeout PENDING; product version still 3.6.0 and there is no full 3.7.0 release/tag. Owner-approved strict duplicate-style HTTP 400 remains in force. Esri satellite/openAIP rights, token, live-provider, cost and licensing gates remain BLOCKED.

- `FEATURES.md` = what the product has / is intended to have.
- `ROADMAP.md` = order, dependencies, decisions and status.
- `CHANGELOG.md` = what actually changed.
- `ARCHITECTURE.md` = current architecture and data-integrity invariants.
- `DEVELOPMENT.md` = implementation / verification workflow.
- `docs/product/VERSIONING.md` = numeric release/versioning rules.
- Detailed release contracts belong under `docs/product/`.
- Superseded / historical milestone detail belongs under `docs/history/`.

A release is not DONE until implementation, verification, required documentation and production closeout are complete.

## Versioning rule

From 4 October 2026 forward, active product planning uses numeric `MAJOR.MINOR.PATCH` release versions only.

- No new active E/F/B/SP/M-style milestone families.
- Use the target release number plus **Phase 1, Phase 2, ...**.
- Database schema version, certification payload version and backup-format version are independent technical counters.
- Historical letter-coded milestones are preserved in `docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md`.

## Status legend

- ✅ **DONE** — implemented, verified, merged and production-closed where applicable.
- 🚧 **ACTIVE** — current release.
- ➡️ **NEXT** — first release after ACTIVE.
- ⏳ **PLANNED** — accepted direction, not yet next.
- 🔬 **RESEARCH** — not implementation-ready.
- ⚠️ **BLOCKED / EXTERNAL** — depends on evidence or a decision outside the repo.

## Phase 1 frozen product decision — 9 October 2026

**Product decision A — APPROVED by owner, 9 October 2026:** preserve strict query parsing for `/api/map-tile/[z]/[x]/[y]`: absent `style` = legacy `map`; exactly one `style=map` or `style=satellite` is accepted; any duplicate `style` (including identical values), empty/unknown/alias/case-variant style parameter = HTTP 400 `unsupported_style` with `Cache-Control: no-store` and no upstream fetch. This deliberately changes the earlier first-value duplicate behavior. Owner accepts this compatibility trade-off. Implementation and local Node/Playwright release evidence PASS on feature HEAD `5538e0c4eec8b4a70fc5568facc55f4dc7324606`; not a merge/deploy authorization. Satellite/openAIP licensing and production gates remain separately BLOCKED.

**Latest Phase 1 integration status (9 October 2026):** documentation PR #268 was squash-merged into `main` as `5944f917797b6fbc55d61947a1e29554f7865eb4`; feature PR #269 incorporated that `main` via non-rebased merge commit `03257eefd7395f6063df2631de1dc2e02d67edab`. The first post-integration local iteration and release attempt both **FAILED only at source-contract 232/233** because the historical `v300-navigation-hierarchy` test still expected Currency at version 3.7.0. Candidate `675da4414d9cc63b1dd0555c40507a565f6757bd3689a96c1d284ccca0c30578` was FAIL; aggregate/build/PostgreSQL/browser did **NOT RUN**. Test-only correction `f0a0e0b762d0f9859a7317958c267d739283cd6a` asserts 3.7.0 Maps and 3.8.0 Currency without changing runtime or roadmap decisions. Exact post-correction verification remains **NOT RUN** until owner executes it on the final branch HEAD. Prior local release PASS on `5538e0c4...` is historical and cannot be claimed for the new candidate. PR #269 stays Draft/unmerged, no production deployment or DB migration; satellite and openAIP provider gates remain BLOCKED. Owner decision A (strict duplicate-style HTTP 400) remains APPROVED.

## Current production baseline

| Area | State |
| --- | --- |
| Core logbook / certified record integrity | ✅ Production |
| Aeroplane / Helicopter / Sailplane / Balloon / ULL / conservative Other | ✅ Production |
| Manual + GPS flight entry | ✅ 3.4.1 production baseline |
| GPS review / T&G / Day-Night / Night-time suggestions | ✅ 3.5.2 production: always-on context-gated SERA suggestions + 3.5.1 fail-closed T&G containment |
| Certification / correction revisions / audit history | ✅ Production |
| Recency / licences / evidence | ✅ Production |
| Sharing / Connections / instructor workflows | ✅ Production |
| Aircraft profiles / profile sharing / canonical validation | ✅ Production |
| Backup / restore / protected history | ✅ Production |
| Statistics / professional presentation | ✅ Production |
| Production DB schema | **v20** — independent from product version |
| Product release version | **3.6.0** |

## Canonical release sequence

| Order | Target | Workstream | Status | Dependency / reason |
| ---: | ---: | --- | :---: | --- |
| 1 | **3.4.0** | Flight Entry Simplification | ✅ | Merged and production deployed on 5 October 2026 |
| 2 | **3.4.1** | GPS Night-time reliability | ✅ | Merged and production deployed on 6 October 2026 |
| 3 | **3.5.0** | Certified flight voiding + multi-aircraft integrity audit | ✅ | Merged and production deployed on 7 October 2026; schema v20 verified |
| 4 | **3.5.1** | GPS T&G false-positive containment | ✅ | Merged and production deployed on 7 October 2026; tightening-only reliability hotfix |
| 5 | **3.5.2** | Always-on GPS/SERA Night suggestions | ✅ | Merged and production deployed on 7 October 2026; no DB/certification/history rewrite |
| 6 | **3.5.3** | Flight detail navigation UX | ✅ | Merged and production deployed on 7 October 2026; immediate iPad visual follow-up is isolated in 3.5.4 |
| 7 | **3.5.4** | iPad flight-detail visual hotfix | ✅ | Merged and production deployed on 7 October 2026; production iPad visual acceptance confirmed the two 3.5.4 defects are resolved |
| 8 | **3.5.5** | iPad sidebar collapse-control alignment | ✅ | Corrective edge-handle placement deployed and accepted on production iPad on 7 October 2026 |
| 9 | **3.6.0** | Saved-date / timezone semantics · #144 | ✅ | Production deployed and closed on 9 October 2026; package/footer 3.6.0 |
| 10 | **3.7.0** | Maps & Aviation Layers | 🚧 | Phase 1 standard-only merged and owner-reported production browser smoke + public API 4/4 PASS; docs PR #270 pending; full 3.7.0 not released; Phase 2 satellite / Phase 3 openAIP provider gates BLOCKED |
| 11 | **3.8.0** | Currency / monetary semantics · #136 | ➡️ | Former 3.7.0 reservation; all currency/evidence/FX constraints preserved |
| 12 | **3.9.0** | Multi-aircraft heterogeneous onboarding proof | ⏳ | Former 3.8.0 reservation; scope unchanged |
| 13 | **3.10.0** | Multi-aircraft sharing / recovery / scale closeout | ⏳ | Former 3.9.0 reservation; scope unchanged |
| — | — | GPS T&G time-normalized / evidence-limited follow-up | 🔬 | Confirmed ±10-point qualification defect; add-event logic needs broader real-track evidence before a release number is assigned |
| — | — | Professional Logbook Platform | 🔬 | No release number until scope is frozen |

**Pre-emption rule:** confirmed production, security or data-integrity defects may interrupt this order. Convenience/visual polish may not weaken evidence, validation, certification or historical integrity.

---

# 3.5.1 — GPS Touch-and-Go false-positive containment — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_1_GPS_TOUCH_AND_GO_RELIABILITY.md`

## Trigger

Three additional real SkyDemon KMLs exposed confirmed advisory T&G defects in the current detector:

- a false altitude T&G after a sensor level shift;
- a false altitude T&G during noisy climb-out;
- a false HIGH speed T&G caused by duplicate/stale position samples while the aircraft was climbing;
- a separate real T&G is still missed because the rolling-altitude qualification uses ±10 array points.

The false positives are the immediate data-integrity risk because `landingCount()` counts every returned T&G regardless of HIGH/MEDIUM confidence.

## Frozen 3.5.1 direction

- tightening-only hotfix: it may remove unsupported automatic T&G events but must not add a new auto-counted event;
- keep 28–145 km/h and 30 m rolling-altitude thresholds unchanged;
- keep the existing 25 m/s altitude discontinuity rule as a gross corruption guard, not an aircraft-performance model;
- do not add aircraft-specific flight-path-angle/performance assumptions;
- do not add spatial clustering or repeated-runway rescue;
- do not change takeoff detection helpers;
- require post-minimum climb evidence to be sustained beyond one timed altitude edge before a rolling-altitude T&G may count;
- admit speed/ground events as T&G only when their direct event motion is compatible with the existing 145 km/h rolling ceiling and usable altitude does not vary by 30 m or more during the alleged ground phase;
- rejected speed events must not suppress a valid altitude event;
- no DB/schema/certification/history rewrite.

Expected real-track outcomes:
- 0510261 false T&G: rejected;
- 0510262 immediate post-takeoff false T&G: rejected;
- 0510262 false speed T&G near 16:01:48: rejected;
- 0510263 positive control: exactly five T&Gs remain detected;
- 0510262 real T&G near 15:59: remains non-auto-counted in 3.5.1 because its approach evidence crosses a gross altitude discontinuity.

## Production closeout

3.5.1 is **DONE / PRODUCTION**:
- PR #245 merged to `main` as `230d835a9e4c3fddb02bf7b729242632626cb9a7`;
- Vercel deployment `dpl_AGLoght4FF1khhviPaZvMu5SZ2oT` is READY on that exact merge SHA and carries `fly-tally.com`;
- deployment root/login smoke returned HTTP 200;
- grouped runtime-error review found no errors in the checked post-deploy window;
- final candidate verification before merge: 1297/1297 unit/regression PASS, TypeScript PASS, production build PASS (41/41 static pages);
- PostgreSQL remains N/A: no persistence or schema contract changed.

## GPS T&G evidence-limited follow-up — RESEARCH

New evidence proves that ±10 array points is not a reliable physical qualification window: the known real 15:59 T&G misses +30 m climb evidence by ~0.27 m at point +10 and clearly exceeds it at point +11.

Research scope:
- elapsed-time / physical evidence-window research;
- an evidence-limited, non-counted "possible T&G" review tier if justified;
- density-invariance tests;
- explicit duplicate/stale-fix quality classification if needed;
- no spatial rescue unless separate evidence demonstrates that it cannot bootstrap low passes/go-arounds into landing evidence.

The earlier **T&G-only** provisional `3.5.2` reservation is superseded. This research remains unnumbered until a broader real-track corpus supports a safe add-event contract; product release `3.5.2` is now assigned to always-on GPS/SERA Night suggestions.

---

# 3.4.1 — GPS Night-time reliability — DONE

Detailed contract: `docs/product/3_4_1_GPS_NIGHT_TIME_RELIABILITY.md`

## Trigger

A production GPS review showed a confidently suggested NIGHT landing while Night time remained blank/manual.

Repository review confirms that this is possible because landing classification is event-level while Night-time accumulation is whole-track and currently returns `UNAVAILABLE` if any required segment fails its conservative guards.

## Frozen direction

- keep SERA geometric Sun-centre -6° and the ±0.5° confidence guard;
- keep GPS advisory/editable and IFR manual;
- never infer Night time from a night landing;
- add structured unavailable reason codes and human-readable UI feedback;
- keep manual Night-time edits sticky;
- do not auto-apply partial/lower-bound Night minutes;
- reuse canonical track discontinuity thresholds rather than inventing a second quality model;
- preserve the current >600-second fail-closed guard in 3.4.1; endpoint quality/displacement does not prove the unobserved sparse path, so sparse auto-classification is deferred until an evidence-backed contract exists;
- adaptive subdivision of an unsafe two-endpoint gap is not accepted as new evidence;
- no DB migration or certification-version change is expected.

## Single implementation phase — DONE

- structured unavailable diagnostics;
- pilot-facing unavailable reason copy;
- fail-closed >600 s sparse-gap handling; no endpoint-only path proof;
- shared GPS discontinuity contract for actual endpoint-quality rejection;
- fail-closed timestamp/position/confidence/discontinuity handling;
- stale automatic suggestion clearing while preserving sticky manual edits;
- targeted and full regression verification;
- real-like EHAM → LKPR fixture proving that NIGHT landing classification is independent from unavailable exact Night time when an earlier sparse gap blocks the whole-track total.

Production closeout on 6 October 2026:
- PR #241 merged to `main` as `b3e1de097b6d16cdaa96082d281602a2765b8ae0`;
- Vercel production deployment `dpl_3911vZiDAFduLhsPbyMnB1YtHKwn` is READY on that exact SHA and carries `fly-tally.com`;
- public production smoke returned HTTP 200 on the deployed root/login surface;
- grouped runtime-error query found no errors in the checked post-deploy window;
- DB schema remains v19 and certification payload remains v8;
- no migration or historical flight/certification/audit rewrite occurred.

---

# 3.4.0 — Flight Entry Simplification — DONE

Detailed contract: `docs/product/3_4_0_FLIGHT_ENTRY_SIMPLIFICATION.md`  
Independent review reconciliation: `docs/product/3_4_0_REVIEW_RECONCILIATION.md`  
UI matrix: `docs/product/3_4_0_FLIGHT_ENTRY_UI_MATRIX.md`

## Product goal

Make routine Manual/GPS entry materially simpler and more cockpit/iPad-friendly without weakening source provenance, validation, certification integrity, recency, sharing or historical record protection.

Target common single-flight flow:

**Source → Flight details → Save & certify**

with secondary/contextual information progressively disclosed.

## Frozen decisions

- GPS values remain advisory/editable; missing or ambiguous evidence fails closed.
- IFR remains pilot-entered.
- Existing SERA Day/Night/Night-time suggestion semantics remain unchanged.
- Certification remains an explicit pilot action.
- **Save & certify** is single-flight only in 3.4.0.
- **Save draft** remains available and is the implicit/default submit behavior.
- Pressing Enter must never certify.
- Certification hash/compliance/revision logic is reused from the current persisted-row authority path.
- If draft save succeeds but certification fails, the flight remains a draft with an explicit blocker message.
- Current generic GPS “I reviewed this flight” gate is removed only together with its server requirement.
- Only a non-blocking GPS-quality warning may require targeted acknowledgement; T&G detection, near-boundary SERA manual fallback and invalid profile state do not get extra acknowledgement checkboxes.
- Multi-flight GPS remains all-or-none **draft save only** in 3.4.0; no batch certification.
- Save & certify never sends PIC/crew/instructor invitations automatically.
- Regulatory category / evidence basis is part of the compact context and pre-certification summary.
- Collapsed sections must summarize their actual state; hidden must never mean invented zero/default.
- ULL category filtering remains correct; non-applicable Part-FCL/SFCL/BFCL purposes stay hidden.
- No new generic structured Training / practice purpose.
- Existing purpose codes/history remain backward-compatible.
- No DB migration is assumed.

## Phase 1 — Discovery / contract freeze — DONE

Repository reconciliation is substantially complete.

Confirmed current-state facts:
- current certification reads the persisted owned row, runs compliance, hashes certification v8 from that row and conditionally certifies only an uncertified record;
- current post-save page is a genuine second full Logbook-data review surface, not just a confirmation dialog;
- GPS `part_<n>_reviewed` is server-required but not persisted/certification-protected;
- Manual/GPS creation already uses flight fingerprint + PostgreSQL advisory locks + duplicate checks;
- GPS multi-flight draft creation is already transactional for parent/track/required connected-crew rows;
- recency and public-share authority require certified flights;
- `purpose_code` is certification-protected from certification payload v3 onward;
- Training-purpose UI is category-aware but server normalization also applies role/evidence gating, so one shared applicability contract is required.

Phase 1 closeout:
- KEEP / COLLAPSE / CONDITIONAL / REMOVE-DUPLICATE matrix frozen;
- pre-certification summary fields and blocker-to-disclosure mapping frozen;
- Enter/default-submit rule frozen: implicit submit = draft only;
- shared Training-purpose applicability predicate implemented and source-covered;
- independent review reconciled against actual repository behavior.

## Phase 2 — Information hierarchy — DONE

### GPS source
Default visible:
- source/file name;
- point count / detected-flight count;
- one concise source state;
- real GPS-quality warning when present.

Conditional:
- split controls hidden for one clean flight;
- split editor appears only for multi-flight/manual split/ambiguity;
- map + altitude/speed profile under **Review GPS track**;
- warning may auto-open visual review;
- raw diagnostics remain secondary.

### Flight context
Replace the large Common details area with one compact editable summary showing:
- aircraft registration/type;
- regulatory category / evidence basis;
- role;
- operation / engine where applicable;
- per-flight Role/Crew divergence when present.

Billing remains a secondary cost context, not a substitute for regulatory evidence.

### Flight details
Default visible:
- date;
- departure / arrival;
- landings total + Day/Night where applicable;
- Off-block / Takeoff / Landing / On-block;
- Night / IFR where applicable;
- concise Notes affordance;
- any blocking evidence problem.

Duplicate helper/provenance/status copy should be removed when one compact source/status cue is sufficient.

Phase 2 closeout:
- clean single-flight GPS track review is collapsed by default;
- multi-flight / ambiguous / warned GPS review remains surfaced;
- the old wizard-step chrome is removed;
- compact Flight context exposes aircraft + regulatory evidence basis + role + applicable operation/engine;
- Billing is no longer part of the primary context summary;
- clean GPS quality no longer emits a redundant standalone status line;
- incomplete imports jump to the first flight section that still needs evidence.

## Phase 3 — Progressive optional/contextual detail — DONE

Collapsed by default:
- additional crew;
- detailed aircraft provenance;
- Training purpose;
- Task / exercise;
- Costs / additional expenses;
- professional context;
- extended movement evidence when not required;
- source diagnostics.

Auto-open only when required, populated, invalid or explicitly opened.

Collapsed summaries must truthfully represent state and distinguish unset/unavailable/not tracked from explicit zero where the existing domain distinguishes them.

### Training-purpose reconciliation
- preserve the existing seven structured purpose codes;
- preserve category-aware regulatory filtering;
- keep ULL non-applicable Part-FCL/SFCL/BFCL purposes hidden;
- do not add a generic structured Training / practice marker;
- keep Task / exercise for ordinary descriptive detail;
- make one shared applicability predicate authoritative for both picker visibility and server persistence;
- preserve historical stored/certified purpose values even if current applicability differs.

## Phase 4 — Single-flight Save & certify — DONE

Primary explicit action:
**Save & certify flight**

Secondary:
**Save draft**

Rules:
- missing/default intent = Save draft;
- Enter/default submit cannot certify;
- save uses the existing canonical create path;
- certification re-reads the persisted row and uses one shared certification helper derived from current `certifyFlight`;
- hash is never calculated directly from raw form payload;
- certification failure after successful save leaves an owned draft and surfaces the blocker;
- successful certification requires no second certification click;
- existing correction-revision workflow remains authoritative for certified-flight edits;
- no sharing/invitation/verification side effect is triggered automatically.
- post-save blocker messaging, workflow readiness and the legacy Certify button all consume the same category-aware `flightCertificationCompliance` result used by direct certification.

### Pre-certification summary
Show next to the action:
- date;
- route;
- aircraft registration/type;
- regulatory category / evidence basis;
- role / required crew evidence;
- operation / engine where applicable;
- four movement times;
- landings Day/Night;
- Night / IFR;
- certification blockers.

Consequence copy:
**Certified flights are locked; later changes are recorded as corrections.**

## Phase 5 — GPS review-gate simplification / multi-flight safety — DONE

- remove the generic `I reviewed this flight` checkbox and server requirement;
- require targeted acknowledgement only for a non-blocking GPS-quality warning that the pilot is permitted to accept;
- T&G count remains visible/editable but gets no extra checkbox;
- near-boundary SERA remains manual/unavailable as today;
- invalid profile/evidence remains blocking;
- multi-flight import continues to save all parts atomically as drafts only;
- no 3.4.0 batch certification.

## Phase 6 — Responsive / interaction polish — DONE

Required:
- desktop;
- iPad landscape;
- iPad portrait;
- mobile 390;
- compact mobile/reflow;
- light + dark.

Acceptance:
- materially fewer default-visible sections than production 2.7.0;
- one obvious primary action for the current context;
- no horizontal overflow;
- blocker identifies which disclosure needs attention;
- async actions have pending/disabled duplicate-submit protection;
- keyboard/focus order remains usable;
- save/certification result is announced accessibly;
- no raw errors.

Phase 6 implementation notes:
- completion evidence is grouped into four concise semantic rows rather than eight nested cards;
- completion chrome was reduced to one `Review & finish` heading plus the certification consequence;
- targeted authenticated browser coverage now includes the GPS-quality acknowledgement gate in addition to Manual/GPS direct certification and Enter-to-draft behavior.

## Phase 7 — Release closeout — DONE

Local verification evidence recorded on 5 October 2026:
- TypeScript: **PASS**;
- complete unit/regression suite: **1230/1230 PASS**;
- PostgreSQL core acceptance: **73/73 PASS**;
- production Next.js build: **PASS**;
- targeted authenticated 3.4.0 browser acceptance: **6/6 PASS** across desktop Chromium and mobile Chromium;
- focused responsive Flight Entry smoke: **1/1 PASS** in desktop Chromium while internally covering desktop 1440, iPad landscape, iPad portrait and mobile 390 in light + dark;
- targeted 3.4.0 source/contract pack: **13/13 PASS**;
- GitHub CI: **NOT RUN by policy**; workflows are manual-only diagnostics.

Production closeout on 5 October 2026:
- PR #240 merged to `main` as `76b57c5674ffcc8c62bfbe73c59974cfde341a7a`;
- `package.json` on the merge SHA is `3.4.0`;
- Vercel production deployment `dpl_3Zcyq7QmdSGPj1AcSHe2gj2Rn29r` is READY on the exact merge SHA and carries the `fly-tally.com` alias;
- production runtime logs on that deployment show successful 200 responses across authenticated flight/dashboard routes;
- grouped runtime-error query found no errors in the checked post-deploy window;
- DB schema remains v19 and certification payload remains v8;
- no historical flight/certification/audit rewrite occurred.

Required evidence:
- targeted tests during implementation;
- TypeScript;
- full unit/regression candidate gate;
- PostgreSQL acceptance for save/certification, duplicate/concurrency and multi-flight atomicity;
- certification parity test between old explicit certification and new Save & certify on equivalent persisted rows;
- risk-based authenticated browser coverage for Manual + GPS completion, Enter-to-draft, GPS warning acknowledgement and the dedicated Flight Entry responsive matrix; a full repository-wide Playwright suite is not required for this release;
- production build;
- exact-candidate local verification evidence recorded;
- GitHub CI: **NOT REQUIRED**; manual-only diagnostic if explicitly requested;
- production deployment + smoke + runtime-error check;
- ROADMAP / FEATURES / CHANGELOG reconciliation;
- one-time product-version reconciliation to **3.4.0** only at ship time.

### 3.4.0 Definition of Done

- simplified hierarchy production deployed;
- single-flight same-page Save & certify verified;
- default/Enter submit cannot certify;
- Save draft remains valid;
- multi-flight import remains atomic draft-only;
- generic reviewed checkbox removed without losing required GPS-warning evidence;
- Training-purpose UI/server applicability unified;
- certification/audit/correction/share/recency authority unchanged;
- responsive light/dark acceptance passes;
- `package.json`, visible app version, CHANGELOG release heading and Git tag agree on `3.4.0`.

---

# 3.5.0 — Multi-aircraft integrity + certified-flight voiding — DONE / PRODUCTION

Goal: complete the remaining historical/dynamic applicability integrity work and add a safe way for a pilot to remove an incorrectly certified flight from all operational logbook use without destroying its protected audit evidence.

## Phase 1 — Certified flight voiding — LOCAL GATE VERIFIED

Frozen product behavior:
- a certified flight may be explicitly **voided/removed from the active logbook**;
- the voided flight must disappear from normal Flights, Dashboard, Statistics, Map, Print/Export, recency/compliance totals and every other operational/read-model consumer;
- a voided flight contributes **zero** operational/regulatory credit after the void operation;
- the original certified record, certification hash/revision, who voided it, when, and the mandatory reason remain preserved as audit evidence;
- this is **not** a hard delete and is not the existing 90-day draft Trash workflow;
- public shares are revoked and pending workflow requests are superseded as part of the void transaction;
- already-created participant-owned copies are not destructively deleted from another pilot's account;
- no one-click undo may silently resurrect the prior certification fingerprint;
- the action must be server-authorized, atomic and fail closed.

Design gate before implementation — **PASSED 6 October 2026**:
- independent review returned **APPROVE WITH CHANGES**;
- archive+delete was accepted as the fail-closed model;
- repository discovery confirmed the large direct-`flights` consumer surface;
- actual portable-backup baseline was corrected from the review handoff's v11 assumption to **v12**; voiding therefore requires **backup v13**;
- schema v20, permanent tombstone/archive children, participant-copy provenance, same-transaction certified DELETE authorization, dedicated audit route and restore resurrection guards are now frozen;
- implementation proceeds in M1–M6 from `docs/product/3_5_0_CERTIFIED_FLIGHT_VOIDING.md`.

Detailed contract: `docs/product/3_5_0_CERTIFIED_FLIGHT_VOIDING.md`.

Implementation milestones:
- **M1 — Schema v20 + archive invariants: VERIFIED LOCAL** — TypeScript PASS; migration/schema contract 10/10 PASS; PostgreSQL acceptance 6/6 PASS on 6 October 2026.
- **M2 — Domain mutation: END-TO-END VERIFIED LOCAL**
- **M3 — Audit-only UX: END-TO-END VERIFIED LOCAL**
- **M4 — Backup / restore v13: VERIFIED LOCAL** — exact-head TypeScript PASS; unit/regression 1280/1280 PASS on the immediately preceding runtime-equivalent head; PostgreSQL core 85/85 PASS on `7d18fb9`; production build PASS on the immediately preceding runtime-equivalent head.
- **M5 — Consumer and integration verification: VERIFIED LOCAL** — M5A source/runtime consumer contract PASS on `bb3fcd2`; M5B PostgreSQL collaboration/provenance acceptance **86/86 PASS** on `efd9b62`; M5C authenticated certified-void acceptance **2/2 PASS** across desktop + mobile Chromium on `a423239` after isolating the dedicated test notification fixture.
- **M6 — Release gate / documentation: LOCAL GATE VERIFIED** — exact-head `a2d3f65`: TypeScript PASS; full unit/regression **1285/1285 PASS**; full PostgreSQL integration + scale **99/99 PASS**; production build PASS. The runtime-equivalent M5C head `a423239` already has authenticated desktop/mobile browser **2/2 PASS**. GitHub CI is **NOT RUN — local-first policy**. Production migration/deploy is intentionally **NOT RUN** here because canonical `3.5.0` still includes Phase 2; production remains `3.4.1` / schema v19 until the complete 3.5.0 scope is release-ready.

## Phase 2 — Remaining multi-aircraft integrity audit — VERIFIED / NO RUNTIME CHANGE REQUIRED

Detailed discovery / review contract: `docs/product/3_5_0_MULTI_AIRCRAFT_INTEGRITY_PHASE2.md`.

Scope:
- audit remaining recency consumers for current-profile dependencies;
- preserve established ordinary ULL → SEP behavior;
- preserve explicit effective-dated `part_fcl_credit_*` provenance;
- verify Manual/GPS snapshot equivalence where applicable;
- preserve certification/revision compatibility.

Discovery on 7 October 2026:
- normal historical regulatory classification is already snapshot-owned: Dashboard, Statistics, Print/export, professional experience, SPL/BPL recency and helicopter flight eligibility read stored `flights` context rather than today's aircraft profile;
- Manual and GPS create paths both use PROFILE authority for the selected aircraft and persist the same flight-owned regulatory context; same-registration edits use SNAPSHOT authority rather than re-resolving today's profile;
- helicopter type recency uses the stored flight model/type; the current active helicopter profile is used only to enumerate/setup type workspaces, not to rewrite historical flight type;
- the only authoritative aeroplane-recency dependency on the current aircraft row is the intentional external Annex-I/ULL mapping tuple `part_fcl_credit_class/basis/from` in `recency-service.ts` and `recency-audit-service.ts`;
- ordinary ULL → SEP credit remains automatic and profile-independent. The explicit tuple is only the atypical class override/effectivity provenance path;
- no evidence currently justifies copying `part_fcl_credit_*` into certified flight snapshots or adding another schema migration.

Resolved integrity question:
- the aircraft-profile write validator requires a complete class + basis/reference + valid-from tuple, while the recency evaluator intentionally tolerates broader legacy input shapes;
- repository history showed v1.51.3 Add/Edit still required complete explicit tuples despite UI copy calling basis/from optional;
- a read-only production census on 7 October 2026 found **25/25 aircraft profiles with no explicit `part_fcl_credit_*` metadata**, including **295 saved flights** and **36 certified ULL flights**. There were zero complete overrides, partial tuples, orphan metadata, invalid dates or unsupported classes;
- therefore no compatibility relaxation, canonical-resolver runtime rewrite, flight snapshot expansion, schema v21 or certification-version change is justified for 3.5.

Phase 2 execution order:
1. freeze the consumer/dependency census with characterization tests — **VERIFIED LOCAL 4/4** on `69310a3`;
2. obtain independent review of the external-credit mapping boundary and legacy compatibility — **COMPLETE**; reviewer agrees with snapshot/external separation and no-migration default, but requires a bounded legacy rule before compatibility is widened;
3. reconcile v1.51.3/v1.51.4 persistence history — **COMPLETE**: the v1.51.3 UI/engine described basis/from as optional, but the server-side Aircraft Add/Edit action still required both whenever an explicit class was persisted; exact restore remained outside that validator;
4. run the read-only production `part_fcl_credit_*` shape census — **VERIFIED PRODUCTION READ-ONLY**: 25 profiles, all `NONE`; 25 active / 0 inactive; 295 saved flights; 36 certified ULL flights; no anomalous or explicit override shapes;
5. runtime decision — **NO CHANGE REQUIRED**. Keep strict profile writes, snapshot-owned historical facts, automatic ULL → SEP behavior and the existing external override concept. No schema v21 / certification payload change.

**Canonical final local gate: VERIFIED** on exact head `f0a1f1a` — TypeScript PASS; unit/regression **1289/1289 PASS**; full PostgreSQL integration + scale **99/99 PASS**; production build PASS. GitHub CI remains **NOT RUN — local-first policy**.

**Release candidate metadata:** package/app-visible version is now `3.5.0`; this identifies the unreleased candidate and does not claim production deployment. Schema-v20 production preflight/migration/reconcile/postflight tooling is implemented and locally source-verified **10/10 PASS** with TypeScript PASS on `eddbfb5`.

**Candidate metadata/build delta: VERIFIED LOCAL** on exact head `c0daa46` — version-governance **5/5 PASS**; production Next.js build PASS with **41/41** static pages generated.

**Production v20 preflight: VERIFIED READ-ONLY** on 7 October 2026 against production Primary / `neondb` — transaction read-only ON; exact migration registry v1..v19; no partial v20 tables/functions/triggers; 5 users, 25 aircraft, 295 flights, 95 certified flights, 56 certified revisions, 5 verifications, 16 participations / 11 accepted, 8 deleted flights; **7** provenance backfill candidates; preflight integrity guards passed.

**Production schema-v20 migration: APPLIED / VERIFIED** on 7 October 2026 after explicit approval. A pre-migration Neon branch `pre-v20-2026-10-07` (`br-dry-moon-b1n30x0b`) preserves the exact pre-write production state. Migration registry is now exact v1..v20; all required v20 objects/triggers/functions exist; provenance backfill produced **7/7** rows; immediate read-only postflight preserved 295 flights / 95 certified flights / 56 certified revisions / 16 participations / 11 accepted and created zero void-history rows. Final post-deploy reconciliation + postflight are still pending.

**Production closeout:** PR #243 squash-merged to `main` as `881f4b2159a00a23609bf9a3d4a783084a0ec5f1`; Vercel deployment `dpl_FTPxxhKFWnRRBvKZZPcNrYUYeZXn` reached READY and serves `fly-tally.com`; post-deploy provenance reconciliation completed; final read-only v20 postflight preserved all operational counts with 7/7 provenance rows and zero void-history rows; immediate runtime-error check found no errors.

**Subsequent release:** 3.5.2 always-on GPS/SERA Night suggestions.

A migration is allowed only when the Phase 1 data model or later evidence proves one necessary.

# 3.5.2 — Always-on GPS/SERA Night suggestions — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_2_ALWAYS_ON_NIGHT_SUGGESTIONS.md`

## Product decision

The account-level **Night definition** switch is removed. For GPS imports, FlyTally always attempts the existing SERA civil-twilight suggestions when the selected aircraft/logbook context supports the relevant Day/Night or Night-time fields.

## Frozen behavior

- remove the Night definition control from Settings;
- do not require or read an account preference to enable GPS/SERA suggestions;
- keep the existing geometric SERA civil-twilight model, confidence guard and fail-closed evidence rules unchanged;
- Day/Night landing suggestions remain applicable only where the canonical source requirements use a Day/Night landing split;
- Night-time suggestions remain applicable only where the canonical source requirements expose Night/IFR review;
- automatic values remain **suggestions**, not authoritative evidence;
- pilot edits remain sticky and must not be overwritten by later recomputation;
- unavailable/ambiguous GPS evidence still returns unavailable and leaves manual entry available;
- IFR remains manual;
- legacy persisted `night_definition` preference values may remain in historical settings JSON but are ignored by runtime behavior;
- no DB migration, certification-payload change or historical flight rewrite.

## Required verification

- Settings no longer renders or persists an active Night-definition choice;
- both legacy MANUAL and SERA accounts receive identical runtime GPS/SERA suggestion behavior;
- applicability gating by aircraft/logbook context remains intact;
- 3.4.1 Night-time fail-closed diagnostics remain intact;
- TypeScript, targeted tests, full unit/regression gate and production build before merge;
- PostgreSQL migration: N/A unless implementation scope changes.

## Production closeout

3.5.2 is **DONE / PRODUCTION**:
- PR #248 squash-merged to `main` as `60be6fd23f283302dadc7a3d611a19ff0bc8ebf3`;
- final exact-head local verification: TypeScript **PASS**, full unit/regression **1298/1298 PASS**, production build **PASS** with 41/41 static pages;
- targeted 3.5.2 / 3.4.1 / E2 GPS contract: **24/24 PASS**;
- PostgreSQL migration: **N/A**; schema remains v20, certification payload remains v8, portable backup remains v13;
- Vercel production deployment `dpl_4pyJEv2pjWQLNcmNPpFYcjsf3PHj` reached READY on the exact merge SHA and serves the production project/domain;
- deployment root/login smoke returned HTTP 200;
- immediate grouped runtime-error check found no errors.

---

# 3.5.3 — Flight detail navigation UX — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_3_FLIGHT_DETAIL_NAVIGATION.md`

## Product decision

Flight detail already has filter-aware Previous/Next navigation and a Back to flights link, but the controls are visually too quiet. Keep the existing navigation semantics and make them obvious and stable across desktop, iPad and mobile.

## Frozen behavior

- preserve `getFlightNavigationFast()` ordering, filtering and context-query behavior;
- keep `FLIGHT x/y` position evidence;
- expose an obvious **Back to flights** control;
- render **Previous flight** and **Next flight** as clear peer controls;
- keep both movement controls visible at list boundaries, with the unavailable direction explicitly disabled rather than removed;
- preserve the current flight-list filter/sort context in Back/Previous/Next destinations;
- no flight data, certification, recency, DB or persistence semantics change.

## Production closeout

- PR #250 squash-merged to `main` as `7068c5f03a3bf5b05ef5f0b45793db54848b9c9e`;
- final pre-merge local gate: targeted **18/18 PASS**, TypeScript **PASS**, full unit/regression **1302/1302 PASS**, production build **PASS** with 41/41 static pages;
- Vercel production deployment `dpl_5w2vFSXpSbVEruqcP8mzjXRLuqag` reached READY on the exact merge SHA;
- root/login production smoke returned HTTP 200 and the immediate grouped runtime-error window was clean;
- PostgreSQL migration: **N/A**; schema remains v20, certification payload v8 and portable backup v13;
- post-deploy iPad visual review found two presentation defects: **More** could wrap onto a second line for wider flight titles, and the visually hidden **Skip to content** link could leave a focus-colored border fragment in the iPad safe area. Those are isolated to 3.5.4.

---

# 3.5.4 — iPad flight-detail visual hotfix — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_4_IPAD_FLIGHT_DETAIL_UX.md`

## Trigger

Production iPad visual acceptance of 3.5.3 showed two presentation-only defects:
- the **More** control can wrap below Back/Previous/Next when the flight title consumes more header width;
- the off-screen **Skip to content** accessibility link can leave a cyan border fragment visible in the iPad safe area.

## Frozen behavior

- keep the 3.5.3 Back/Previous/Next destinations, disabled edge states, ordering and query-context preservation unchanged;
- keep the full desktop/iPad navigation row together when horizontal space is available;
- at narrower tablet widths, move the whole navigation group below the flight identity instead of allowing only **More** to wrap;
- keep the mobile Back + Previous/Next hierarchy unchanged;
- keep **Skip to content** keyboard-accessible, but make it fully visually hidden until it receives focus;
- no flight data, certification, recency, sharing, DB or persistence change.

## Required verification

- source regression for non-wrapping desktop/iPad navigation and whole-header tablet reflow;
- source regression for visually hidden skip-link state plus restored focused state;
- existing 3.5.3 navigation and v3.0 accessibility regressions;
- TypeScript, targeted tests, full unit/regression suite and production build;
- PostgreSQL migration: N/A.

---

# 3.5.5 — iPad sidebar collapse-control alignment — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_5_IPAD_SIDEBAR_TOGGLE.md`

## Trigger

Production iPad review after 3.5.4 confirmed the flight-detail navigation and safe-area fixes are substantially improved, but exposed a separate shell presentation defect: the coarse-pointer enlargement of the sidebar collapse button leaves it visually overlapping the notification bell because the button is absolutely positioned relative to the padded brand row.

## Frozen behavior

- keep sidebar expand/collapse behavior and persisted `logbook-sidebar` state unchanged;
- keep the iPad/coarse-pointer 44 px touch target;
- align the collapse target vertically with the brand-row controls;
- move it horizontally into the sidebar rail/gutter so it no longer overlaps the notification bell;
- do not change phone/mobile navigation, notification behavior, sidebar contents or route semantics;
- no DB, flight, certification, recency, sharing or persistence semantics change.

## Required verification

- source regression for coarse-pointer placement and 44 px target preservation;
- existing sidebar/mobile/accessibility regressions;
- TypeScript, targeted tests, full unit/regression suite and production build;
- PostgreSQL migration: N/A;
- production iPad visual acceptance after deploy.

---

# 3.6.0 — Saved-date / timezone semantics — DONE / PRODUCTION

Issue: #144  
Phase 0 contract: `docs/product/3_6_0_PHASE0_ENGINEERING_QUALITY.md`

## Phase 0 — Engineering quality / test architecture gate — DONE / VERIFIED

Timezone runtime implementation is paused until the repository's verification path is audited and hardened.

**Production closeout complete:** Phase 1 is DONE / VERIFIED; PR #265 merged as `d96aed69b9fee41550820a1d05666420bce4e9fb`; release PR #266 merged as `168bd029540474d6e806bf3e261fa855824b7c2a`; production deployment `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs` reached READY and serves `fly-tally.com`.

3.6.0 is **DONE / PRODUCTION**. The deployed package/footer version is `3.6.0`; root and login production smoke returned HTTP 200 and the immediate checked runtime-error window was clean. No DB migration, historical backfill, certification rewrite or portable-backup format bump was required.

Phase 0D closeout:
- independent review verdict **ACCEPT WITH CHANGES** was reconciled into the registry/evidence design;
- development registry schema v3, homogeneous evidence metadata, planner/evaluator separation and fail-closed evidence semantics are implemented;
- first verification attempt exposed 14 stale historical source-location assertions from the already-verified Phase 0C browser split; they were retargeted without changing product runtime, browser behavior, DB schema or timezone semantics;
- final exact-code-head verification on `686734911f5c3f45e395fdda6b7d98a5021e84ae`: development-pipeline **65/65 PASS**, TypeScript **PASS**, aggregate regression **1354/1354 PASS**, production build **PASS (41/41 static pages)**;
- `domain-unit`: **N/A**; PostgreSQL acceptance: **N/A**; browser acceptance: **N/A** for this tooling/source-contract candidate.

Phase 0E and Phase 0F are closed and integrated into canonical `main`. Phase 1 may now proceed, but runtime code remains blocked until the timezone contract, edge cases and migration/backup consequences are explicitly frozen.

Phase 0E independent review verdict: **ACCEPT WITH CHANGES**. Reconciliation is frozen before implementation.

Accepted:
- release PASS must derive from machine-readable executed evidence, not from intended command composition;
- canonical browser acceptance becomes browser-only and requires a fresh build artifact from the **same candidate fingerprint**; the legacy build+browser convenience path remains during migration;
- `verify:release` becomes risk-based only after a compatibility path preserves the old static full behavior;
- candidate input is explicit and no default merge base is guessed;
- `--all` means all tracked candidate paths; `--force-all` forces all gates;
- typecheck becomes an explicit planner gate, default-required for non-documentation candidates;
- source-contract evidence runs directly even when aggregate `npm test` also runs;
- final PostgreSQL verification means full PostgreSQL acceptance; core/scale remain lower-level iteration tools;
- browser full evidence must prohibit filters/sharding and force retries=0, workers=1, fullyParallel=false.

Adapted:
- **required evidence remains single-sourced by existing risk/gate policy** (`evidencePolicy.riskRequirements` + gate requirements). We will **not** duplicate `requiredEvidence` into every module because that would create two sources of truth. Modules may declare only **available direct evidence**, e.g. `evidenceTests.domain-unit`; the planner derives whether that evidence is required from the module's risks.
- the evidence record uses a content-aware **candidate fingerprint**, not commit SHA alone. This keeps evidence exact for explicitly supplied dirty/local paths as well as committed candidates.
- no separate `verify:source` command is required in 0E; registry-backed homogeneous `test:group` executions can emit source-contract ledger entries.
- `--worktree` / `--staged` are deferred unless explicit path/`--files` input proves insufficient; they are not needed to make uncommitted candidates expressible.

Frozen evidence/execution model:
- a side-effect-free plan has a stable `candidateId`, exact normalized file list, content-aware files hash, head SHA, optional base SHA, modules, risks, gates and required evidence;
- every canonical executor writes a machine-readable ledger entry tied to that exact `candidateId`;
- final release PASS is computed only from required ledger entries for the same candidate, with successful exit status and effective configuration matching the gate contract;
- stale/mismatched build or evidence entries are unusable;
- required but unavailable direct evidence fails closed **before** expensive gates.

Frozen 0E.0 command-surface proposal (historical design snapshot):
- `test:target` — explicit low-level Node tests;
- `test:group` — homogeneous registry-backed groups;
- `verify:plan` — canonical side-effect-free planner with human + JSON output; `scope:changed` remains compatibility surface;
- `verify:app` — application gate only: typecheck + aggregate Node regression + production build; legacy `verify` remains alias;
- `verify:postgres` — full PostgreSQL acceptance;
- `verify:browser` — originally proposed as browser-only full authenticated acceptance;
- `verify:browser:with-build` — migration compatibility convenience;
- `verify:domain` — registry-approved direct domain-unit evidence only;
- `verify:release` — originally proposed as the risk-based planner/executor/ledger;
- `verify:release:full` / `--force-all` — originally proposed compatibility/full escape hatch.

Final implementation supersedes the proposal only where later evidence/review required it: static `verify:release` remains unchanged compatibility behavior, `verify:release:risk` is the canonical candidate-bound release executor, `verify:browser` / `verify:browser:with-build` are legacy full-browser diagnostics, `verify:browser:risk` is authoritative browser release evidence, and no `verify:release:full` script exists; forced full candidate verification is `verify:release:risk --force-all`.

Candidate sources for 0E:
- explicit positional paths;
- `--files <path>`;
- `--base <git-ref>` with explicit ref resolution and no guessed merge base;
- `--all` = all tracked candidate paths.
No candidate input = exit 2. `--force-all` changes gate selection, not candidate membership.

Exit contract:
- 0 = valid plan / successful required evidence;
- 2 = invalid candidate/configuration/invocation;
- 3 = valid candidate blocked by missing required evidence or stale prerequisite.

Revised 0E milestones:
1. **0E.0 — semantics / ledger / compatibility freeze — DONE (design only)**;
2. **0E.1 — explicit candidate input + `verify:plan` + candidate fingerprint — DONE / VERIFIED**;
   - implementation candidate added: `tooling/verification-candidate.mjs` resolves exactly one explicit source (paths / `--files` / `--base` / `--all`), normalizes and hashes exact candidate content, and rejects missing/ambiguous inputs;
   - `tooling/verify-plan.mjs` now exposes human and `--json` plans over the existing classifier;
   - planner now exposes `typecheck` explicitly: non-documentation candidates require it, documentation-only candidates do not;
   - `--force-all` reuses the existing full-ci policy without changing candidate membership;
   - `npm run verify:plan` is added; `scope:changed` remains untouched for compatibility;
   - dedicated planner regression coverage is registered under `development-pipeline`;
   - final local verification on exact code head `34146fdc2cf8dc7645acfb1aea9de66078cd430a`: development-pipeline **72/72 PASS**, TypeScript **PASS**, aggregate regression **1361/1361 PASS**, production build **PASS (41/41 static pages)**, and `verify:plan -- package.json --json` returned the expected development-infrastructure plan with `typecheck=true`, `fullTests=true`, `build=true`, source-contract evidence required, and PostgreSQL/browser disabled.
3. **0E.2 — registry available-evidence metadata + direct domain selection — DONE / VERIFIED**;
   - implementation candidate added: all current `domain-data-integrity` modules now declare exact reviewed `evidenceTests.domain-unit` paths in the existing registry;
   - two small pure direct suites were added for aircraft-profile and professional-experience behavior so those modules do not rely on static/source-contract files;
   - registry schema now validates direct evidence metadata;
   - `tooling/development-evidence.mjs` resolves required domain modules to approved direct tests and reports missing module coverage fail closed;
   - `verify:plan` now exposes `plan.directEvidence.domain-unit` and candidate blocking reasons; a future missing approved domain suite exits 3 after the plan is printed;
   - current registry audit shows **10/10 domain-risk modules** have approved direct evidence and all referenced test files exist;
   - aggregate `npm test` remains independent regression coverage and still cannot synthesize domain evidence;
   - final local verification on exact code head `3227bb587cd89a1d4d93cb8396b7a0388ebe4dc5`: development-pipeline **75/75 PASS**, dedicated direct-domain candidate **6/6 PASS**, TypeScript **PASS**, aggregate regression **1370/1370 PASS**, production build **PASS (41/41 static pages)**;
   - canonical planner smoke for `lib/commercial-readiness.ts` selected `legal-commercial`, required only `domain-unit`, resolved the two approved direct tests, reported no missing modules / blocked evidence, and kept PostgreSQL/browser disabled.
4. **0E.3 — evidence ledger + canonical app/PostgreSQL/browser/domain gate wrappers — DONE / VERIFIED**;
   - implementation candidate added: local ignored `.flytally/verification/<candidateId>/` ledger entries now bind canonical gate results to the planner candidate fingerprint;
   - `verify:app` (and legacy `verify`) now run TypeScript + aggregate Node regression + production build and record the independent build artifact identity without treating aggregate tests as domain evidence;
   - `verify:domain` executes only module-approved direct `domain-unit` paths and exits 3 when required direct evidence is unavailable;
   - `verify:postgres` owns full PostgreSQL acceptance through the existing localhost-only preflight and writes dedicated acceptance evidence;
   - `verify:browser` is now browser-only, requires a same-candidate successful build ledger + matching current Next.js build identity, forces retries=0/workers=1, and preserves `fullyParallel=false`;
   - `verify:browser:with-build` preserves the migration convenience for build + browser;
   - the existing UI-audit capture skip is explicitly registered as browser N/A; unexpected/raw skips remain non-PASS;
   - canonical PostgreSQL/browser wrapper files are classified as their respective acceptance-harness risks so changes cannot evade the heavy gate;
   - low-level commands remain available; static `verify:release` remains untouched until 0E.4;
   - **verification pending**; 0E.3 is not DONE yet.
   - corrected verification on `bfcba06a719e436c9dcc58716a4ee0f2c69e01a6`: development-pipeline **83/83 PASS**, planner **PASS**, `verify:domain` correctly N/A, `verify:app` **PASS** with TypeScript + aggregate regression **1378/1378 PASS** + production build **41/41**, PostgreSQL full acceptance **99/99 PASS**;
   - canonical browser acceptance executed the full serialized **94-test** matrix with **90 PASS / 2 FAIL / 2 intentional skips** in 11.6 min. Both failures were mobile-only: GPS normalized draft save remained on `/flights/new` past the 5 s navigation assertion, and Connection access update persisted `Instructor` but the expected logbook-share state was not observed; browser acceptance therefore remains **FAIL**, not PARTIAL/PASS;
   - no browser fix is accepted from this run yet. Next step is focused mobile reproduction of exactly those two failures before changing runtime or weakening assertions.
   - focused mobile repro then passed both failures independently (**1/1 GPS**, **1/1 Connections**, retries=0/workers=1), indicating suite-load/synchronization sensitivity rather than a deterministic product-runtime failure;
   - stabilization candidate is test-only: GPS waits explicitly for the post-save URL with a bounded 15 s server-action navigation window, and Connections waits for `Save access` to leave pending before reload while asserting persisted status on the summary itself;
   - targeted repeat verification pending before one final full browser acceptance run.
   - targeted mobile repeat on the synchronization correction then passed **6/6** across three repetitions per previously failing flow; `verify:app` passed TypeScript + aggregate regression **1378/1378** + production build **41/41**;
   - the subsequent full serialized browser gate improved to **91 PASS / 1 FAIL / 2 intentional skips** in 11.7 min. The only remaining failure is mobile F3.5 Quick Add, which timed out after 5 s waiting for the post-add status notice; desktop and all other mobile cases passed;
   - do not rerun the full browser matrix again until the Quick Add case is reproduced independently and any correction is verified with a cheap targeted repeat.
   - isolated mobile Quick Add reproduction then passed **5/5** at retries=0/workers=1, confirming the failure is suite-load timing rather than deterministic product behavior;
   - test-only correction now waits for the successful Quick Add dialog close and success status with a bounded 15 s server-action window before continuing. Product runtime is unchanged;
   - product decision: the full serialized browser matrix is no longer a routine or Phase-0 closeout gate because its ~12-minute runtime is disproportionate to the iteration cycle. The command remains available as an explicit manual diagnostic, but targeted risk-owned browser evidence replaces it as the normal gate;
   - final 0E.3 correction verification: mobile F3.5 Quick Add targeted repeat **5/5 PASS** at retries=0/workers=1 after the bounded server-action wait hardening; no product runtime changes were required;
   - 0E.3 closes on the previously verified development-pipeline **83/83 PASS**, planner PASS, `verify:domain` N/A, `verify:app` PASS (TypeScript + aggregate regression **1378/1378** + production build **41/41**), PostgreSQL full **99/99 PASS**, plus targeted browser correction evidence (**6/6** GPS/Connections and **5/5** Quick Add). Legacy full browser acceptance is explicitly **NOT RUN** after the policy change and must not be represented as PASS.
   - 0E.3 closeout now requires only a cheap targeted repeat of the corrected Quick Add flow plus the existing source-contract/static gate evidence. Do **not** rerun the 94-test full matrix for 0E.3.
   - first local 0E.3 verification attempt on `7427a3bc6198c1e708034d27cb6145512a2c9049`: planner **PASS**, development-pipeline **82/83 PASS** with one stale source-contract regex, `verify:domain` correctly returned N/A for a non-domain candidate, and `verify:app` stopped at TypeScript because the new TS contract test statically imported untyped `.mjs` tooling modules;
   - both failures were harness/test-contract defects, not product-runtime failures: the browser assertion now matches the actual fixed runner argument vector, the TS contract test uses dynamic URL imports so typecheck does not require ad-hoc declaration files, and legacy no-argument `npm run verify` compatibility is preserved through an explicit wrapper;
   - correction verification pending; no heavy PostgreSQL/browser acceptance from the failed attempt is counted as evidence.
5. **0E.4 — fast iteration lane + risk-based release orchestrator + compatibility full path — DONE / VERIFIED**;
   - detailed design: `docs/product/3_6_0_PHASE0E4_FAST_VERIFICATION.md`;
   - discovery confirms the current planner has exact candidates, module/risk ownership, direct domain evidence and candidate-bound ledgers, but browser evidence is still repository-wide and source-contract groups do not yet emit canonical ledger evidence;
   - draft design freezes four implementation batches: **0E.4a registry/planner browser selection**, **0E.4b fast iteration executor**, **0E.4c risk-scoped browser executor**, **0E.4d release orchestrator**, then compatibility/verification closeout;
   - important planner defect to correct in 0E.4a: browser execution requires a production build for `npm start`, so `buildArtifactRequired` must be `build || browser`, not only the current build gate flag;
   - architecture proposal preserves the existing `browser-acceptance` evidence class but makes a new planner-bound `browser-risk` source authoritative; legacy full `verify:browser` remains manual diagnostics and cannot satisfy release browser evidence;
   - independent review verdict **ACCEPT WITH CHANGES**: machine-enforce browser authority/selection identity, fail closed on missing/stale/ambiguous targets, reset/identify the shared browser DB fixture, harden dirty/untracked candidate identity, keep iteration evidence distinct from release PASS, and do not silently repurpose `verify:release`;
   - reconciled command decision: existing `verify:release` keeps its current full/static semantics; new risk-based orchestration will be `verify:release:risk`;
   - 0E.4a is **DONE / VERIFIED**: candidate/reuse identity hardening, browser-target registry/schema, deterministic target selection/hash, and `buildArtifactRequired = build || browser` are implemented.
   - 0E.4a implementation candidate added: candidate schema v2 binds dirty/untracked worktree identity; base/all candidates include current dirty/untracked paths; ledger schema v2 preserves that identity; deterministic config/toolchain/browser-fixture contract hashes are available;
   - browser registry now contains **41 exact `{spec,title,project}` targets** across currently evidenced domains, plus module/path ownership and a complete registered harness target set; modules with browser risk but no defensible targeted coverage intentionally block instead of receiving generic smoke evidence;
   - `browser-risk-selection.mjs` validates target existence/project/baseline uniqueness, produces deterministic target union + selection hash, and blocks changed diagnostic-only/unowned E2E specs;
   - planner schema v2 exposes `browserEvidence` and browser candidates now require a production build artifact even when the product module itself did not otherwise select build;
   - implementation verification is **pending**; no browser runner/release semantics changed yet, and legacy `verify:release` / full `verify:browser` remain untouched.
   - first local 0E.4a verification attempt at `c9c73a0` passed development-pipeline **91/91**, planner, TypeScript, aggregate regression **1386/1386** and production build **41/41**, but the planner exposed four generated local artifacts (`test-results/.last-run.json` and three scale-evidence JSON files) as dirty/untracked candidate members; this is evidence-integrity noise, so the attempt is not the final exact-candidate closeout;
   - follow-up fix ignores those generated local verification artifacts and adds a regression proving ignored artifacts do not affect candidate identity;
   - final exact-head 0E.4a verification at `4b14f34585f8d1653112e964ed4043c444dfe655`: clean worktree, development-pipeline **92/92 PASS**, planner v2 clean candidate with no generated artifacts and no blockers, TypeScript PASS, aggregate regression **1387/1387 PASS**, production build **41/41 PASS**; PostgreSQL/browser N/A for this tooling batch;
   - 0E.4b **DONE / VERIFIED**: canonical application-source-contract ledger execution, candidate-bound TypeScript evidence, exact ledger reuse and `verify:iterate` fast feedback.
   - exact 0E.4b candidate `d01813c978c63cd5fc14945fca9a310226d338d2`: first `verify:iterate` ran development-pipeline **98/98 PASS** + TypeScript PASS and reported release **NOT EVALUATED**; immediate repeat reused source PASS, domain N/A and TypeScript PASS without re-execution;
   - 0E.4b release-side closeout on the same exact candidate passed `verify:app`: TypeScript PASS, aggregate regression **1393/1393 PASS**, production build **41/41 PASS**; PostgreSQL/browser N/A for the 0E.4b tooling batch;
   - fast iteration remains separate from release PASS: aggregate/build/PostgreSQL/browser are pending unless their authoritative gates run;
   - 0E.4c **DONE / VERIFIED**: authoritative planner-bound risk browser execution, exact Playwright case identity and optional `verify:iterate --with-browser`; legacy 94-case browser remains diagnostic only.
   - first local 0E.4c exact-candidate attempt on `4c103dafc4eb1c53315e788ab3ca6d2f9e218922` passed TypeScript, aggregate regression **1396/1396 PASS** and production build **41/41**, but `verify:browser:risk` selected zero Playwright cases because its `--grep` was incorrectly anchored to the raw test title while Playwright matches grep against the composed full title;
   - corrected risk title selection to match the escaped registered title within Playwright's full title, while exact `{spec,title,project}` completeness remains enforced separately by the evidence reporter; added a regression for full-title grep semantics; exact fixed-head browser verification pending.
   - fresh-PC verification then exposed a malformed source-edit in `verification-browser-risk.mjs` before browser execution (development-pipeline **98/101**, 3 failures all caused by the same syntax error) plus untracked `playwright-report/` candidate noise; repaired the helper, added syntax/runtime regression coverage and ignored/regression-covered Playwright report output; fixed-head verification pending.
   - final 0E.4c exact-head closeout at `9e9ec3a3d3cb70f43f3ea7b83e168edf174b2e6a`: development-pipeline **101/101 PASS**; authoritative browser-risk **41/41 PASS** (desktop **21/21**, mobile **20/20**, retries=0, workers=1); TypeScript PASS; aggregate regression **1396/1396 PASS**; production build **41/41 PASS**; PostgreSQL full N/A for the browser-harness candidate; legacy 94-case browser NOT RUN by policy; **0E.4c DONE / VERIFIED**;
   - 0E.4d **DONE / VERIFIED**: risk-based release orchestrator adds planner-driven gate execution/reuse, aggregate/build/PostgreSQL/browser evidence composition, explicit scale-via-full-PostgreSQL accounting, and one candidate-bound release ledger; existing static `verify:release` remains unchanged.
   - exact 0E.4d implementation candidate `7a8a98a587d0c2c80bac893ca0c50b24e86f06f0` closed cleanly: development-pipeline **109/109 PASS**, planner no blockers, iteration **222/222 PASS** with release correctly NOT EVALUATED, then `verify:release:risk` returned **PASS** with aggregate regression **1404/1404**, build **41/41**, PostgreSQL full **99/99**, browser-risk **41/41** (21 desktop + 20 mobile), scale N/A and exact source/domain/typecheck reuse;
   - FEATURES was reviewed and remains unchanged because 0E.4 is development verification infrastructure only; DEVELOPMENT, ROADMAP, CHANGELOG and the detailed 0E.4 contract are reconciled;
   - legacy full `verify:browser` remains a manual diagnostic and legacy static `verify:release` remains the compatibility full path; neither was silently redefined;
   - per-worker DB isolation / multi-worker Playwright remains a separate higher-blast-radius optimization and stays deferred.
6. **0E.5 — negative/selection/freshness/config regression coverage — DONE / VERIFIED**;
   - exact candidate `68351c78a0dac2b1f95de3530d2ceac116f2475e`: development-pipeline **113/113 PASS**, planner no blockers, fast iteration **226/226 PASS** + TypeScript PASS, aggregate regression **1408/1408 PASS**, production build **41/41 PASS**, browser-risk **41/41 PASS** (21 desktop + 20 mobile), PostgreSQL/scale N/A, final `release_status=PASS`;
   - exact-ledger reuse negatives now cover schema, candidate, gate, evidence class, exit status and effective-configuration drift;
   - build evidence is reusable only while current production-build identity matches the ledger artifact;
   - browser-risk reuse invalidates on selection, verification-config, toolchain, fixture-contract, build-ledger or current-build drift;
   - candidate freshness covers tracked and untracked dirty work outside explicit path candidates; base candidates absorb current dirty files into candidate membership;
   - identity tests assert the release/config/toolchain/fixture inputs that define reusable evidence;
   - no product runtime, DB schema, certification, backup, timezone semantics, browser DB architecture or worker-count change.
7. **0E.6 — manual workflow + DEVELOPMENT alignment — DONE / VERIFIED**;
   - DEVELOPMENT now names `verify:release:risk` as the canonical final candidate decision while `npm run verify` remains compatibility-only;
   - both GitHub workflows remain manual-only diagnostics and cannot supply candidate-bound release authority;
   - the legacy full browser cloud workflow is explicitly labeled diagnostic, stale pull-request-only job logic is removed, and workflow authority is regression-covered;
   - first exact-candidate release attempt on `088aa71c6a8a43b48b40962c3eb667647d93d202` exposed two stale historical v3.2 label assertions (**1406/1408 aggregate PASS**); both were corrected without product-runtime change;
   - fixed-head `734473252fe1acf64388fa15d9373777112d4977`: targeted historical label tests **9/9 PASS**; risk release source PASS, domain N/A, TypeScript PASS, aggregate **1408/1408 PASS**, build **41/41 PASS**, PostgreSQL/scale/browser N/A, no blocked evidence, final `release_status=PASS`.
8. **0E.7 — exact-candidate verification / closeout — DONE / VERIFIED**;
   - first cumulative attempt used the Phase 0D baseline `686734911f5c3f45e395fdda6b7d98a5021e84ae`, but the planner correctly returned **NOT RUN** because that historical range contains `e2e/ui-audit-capture.spec.mjs`, an explicitly diagnostic-only spec with no authoritative browser target;
   - the fail-closed selector was preserved: no release target was invented for the audit-only spec and the legacy 94-case browser was not used as substitute evidence;
   - final verified boundary was the last fully verified 0E.5 head `68351c78a0dac2b1f95de3530d2ceac116f2475e` through exact head `335704c1125ee0336528f5f1e43c3bc1528c92d3`, candidate `221190494ba79b32bb25f9e32c3ce09041dfd624f3f3a514cc8fb7a905c9477a`;
   - planner `--force-all` selected TypeScript, aggregate regression, production build, full PostgreSQL acceptance, scale and authoritative browser-risk with no blocked evidence;
   - release evidence PASS: source-contract **226/226**, TypeScript PASS, aggregate **1408/1408**, build **41/41**, PostgreSQL **99/99**, scale PASS, browser-risk **41/41** (21 desktop + 20 mobile, one worker), domain N/A, final `release_status=PASS`;
   - legacy 94-case browser remained diagnostic-only / NOT RUN; FEATURES was reviewed and remains unchanged because Phase 0E changed verification/development infrastructure, not product capability.

**PHASE 0E — CLOSED / VERIFIED.**

Final documentation-only reconciliation candidate `dc3edcbb35b218aa2aceccafd139cf8187c86b0d3f8318937865f75a6694c732` on exact head `2969fae73e151044f0a2e6962d7abd57e8983da9` also passed `verify:release:risk`; source/domain/typecheck/aggregate/build/PostgreSQL/scale/browser were all correctly **N/A**, required evidence none, blocked evidence none.

Frozen constraints remain:
- no product runtime, DB schema, certification, backup or timezone-semantic changes;
- no browser DB architecture or worker-count change;
- no remote/destructive PostgreSQL target;
- no aggregate `fullTests` → `domain-unit` inference;
- no automatic candidate base guess;
- no mass historical-test classification;
- preserve low-level commands and explicit compatibility aliases during migration.

Phase 0A — gate safety / reproducibility — ✅ DONE / VERIFIED:
- fail-closed PostgreSQL gate ownership, localhost-only PostgreSQL acceptance targeting, real connection preflight before test fanout, explicit PostgreSQL CLI-path propagation, cross-platform direct execution of the pinned Playwright CLI, and deterministic localhost-only browser-fixture cleanup aligned with current GPS/3.5.2 UI contracts;
- repository-pinned Playwright 1.55.0 + explicit authenticated browser gate;
- Node 24.x alignment with the Vercel production runtime;
- corrected browser DB connection-timeout variable;
- DEVELOPMENT/Vercel policy drift reconciliation;
- exact-candidate evidence: targeted governance **32/32 PASS**, PostgreSQL core **86/86 PASS**, PostgreSQL full **99/99 PASS**, TypeScript **PASS**, production build **PASS (41/41 static pages)**, full browser **96 PASS / 2 intentional skips / 0 failed**, plus final stale v1.44 assertion rerun **5/5 PASS** after the preceding full suite proved the remaining 1,316 tests.

Phase 0F is complete and PR #255 is merged. Phase 1 is DONE / VERIFIED and PR #265 is merged. The remaining 3.6.0 step is release-candidate metadata, production deployment, smoke/error review, then final documentation closeout.

Mandatory Phase 0 scope:
- make explicitly invoked PostgreSQL gates fail closed instead of allowing a skipped integration suite to look like acceptance;
- replace duplicated/manual fast-suite lists with one authoritative risk/test registry;
- distinguish documentation, UI/presentation, domain, persistence/schema, auth/security, browser and scale risk;
- pin the browser test runner for local/manual-cloud parity;
- split the growing browser monolith into stable domain-owned specs without weakening isolated DB serialization;
- reconcile DEVELOPMENT documentation with executable tooling;
- review stale PR/branch state without deleting anything until supersession is proven.

No 3.6.0 saved-date/timezone runtime semantics are changed in Phase 0.

Phase 0 acceptance is defined in the detailed contract. Required closeout includes the applicable TypeScript, unit/regression, PostgreSQL, browser and build evidence plus ROADMAP / CHANGELOG / DEVELOPMENT reconciliation. FEATURES changes only if product capability changes.

## Phase 0F — Hygiene and Phase 0 closeout — DONE / VERIFIED

Discovery:
- DEVELOPMENT command documentation matches the executable package command surface for `test:target`, `test:group`, `scope:changed`, `verify:plan`, `verify:iterate`, `verify:app`, `verify:domain`, `verify:postgres`, `verify:browser:risk`, the legacy diagnostic browser commands, static `verify:release`, and canonical `verify:release:risk`;
- seven historical branches are proven ancestors of `main` and are safe cleanup candidates by ancestry: `chore/pre-f3-integration-anchor`, `codex/v335-batch8-routes-headers-legal`, `docs/flight-entry-f1-closeout`, `feat/flight-entry-f33-aircraft-authority`, `feat/flight-entry-f34-aircraft-context-ux`, `fix/story-map-toggle`, and `test/flight-entry-f35-closeout`;
- supersession is now proven for the five previously-open parallel PRs and they were closed without merge: #187 → merged #188/F0.1, #201 → merged #200/F1.4, #206 → merged #207/F2.2, and #231/#232 → final F3.3 head `065896d3c9aa75fee8c2c0c7cc7a2f6abc20e52a` plus later F3.4/F3.5 stack already ancestral to `main`; their branches remain intact;
- PR #255 merged into canonical `main` as `2238d0e1a645a4f9b584b291ecc12fbf8a2ee230`; no destructive historical branch cleanup was performed.

Closeout:
- explicit `chore/pre-f3-integration-anchor` rollback branch is retained; no historical branch was deleted;
- stale documentation drift was reconciled without changing product runtime or verification authority;
- exact 0F documentation/governance candidate `792ef0f2c8430a01f4bb1e24474b05991d0a83abee63650b7d72b8cb274892df` on head `68ba83167c27e6de1e1027e007ea3b81acad17cc` returned `release_status=PASS`;
- source/domain/typecheck/aggregate/build/PostgreSQL/scale/browser were all correctly **N/A**, required evidence none, blocked evidence none;
- FEATURES was reviewed and remains unchanged; no product capability, runtime, schema, certification, backup or timezone-semantics change occurred in 0F;
- Phase 0 acceptance is satisfied and integrated into canonical `main` via PR #255 (`2238d0e1a645a4f9b584b291ecc12fbf8a2ee230`).

## Phase 1 — Saved-date / timezone semantics — DONE / VERIFIED

Detailed contract: `docs/product/3_6_0_PHASE1_TIMEZONE_SEMANTICS.md`  
Issue: #144  
Adjacent follow-up: #258 — credential/recency/print current-date semantics

### P1.0 — Discovery / semantic inventory — DONE

Repository discovery on `main@eafc347fe00e781f966cc328da67ec24e52c8287` confirmed:
- Manual New Flight date is hard-coded to Prague in `getManualEntryDefaults()`;
- Aircraft Manager and Quick Add use module-level Prague `today` values for saveable rate dates;
- FlightForm has an independent UTC-calendar fallback when an initial date is absent;
- existing viewer-timezone helpers are deliberately presentation-resilient and therefore are **not** suitable as saveable-default authority;
- Settings currently persists raw timezone text without IANA validation;
- `flights.date` and `rates.valid_from` are persisted date-only authority and must not be reinterpreted after save;
- current server GPS/FCL.050 path is explicitly UTC through `lib/kml.ts -> utcParts()`;
- runtime dependency audit found active GPS save/review consumers either use the `lib/kml.ts` UTC override or explicitly import `utcParts`; no active runtime consumer found uses Prague `track-processing.localParts()` as timestamp authority;
- in-scope flight/rate date inputs remain string-backed, rate comparison is date-only, and current CSV/XLS/print paths preserve stored flight dates without timezone conversion;
- portable backup/restore preserves settings and stored calendar dates directly, so no migration or backup-version change is justified.

### P1.1 — Contract freeze + independent review — DONE / REVIEW RECONCILED

Independent reviewer verdict: **APPROVE WITH CHANGES**. The reviewer could not access the private repository, so every repository-specific recommendation was checked against actual code before acceptance.

Frozen decisions:
- saveable calendar resolver is an explicit `resolved | needs_configuration | unavailable` union;
- missing/blank/invalid persisted timezone never fabricates Prague/UTC/browser-local/server-local `today`;
- data-read failure is unavailable, not configuration repair;
- timezone validation is server-authoritative; named runtime-recognized zones including `UTC` are accepted, raw numeric offsets are rejected;
- presentation-only Prague fallback remains unchanged and separate;
- explicit pilot-entered date wins and is never auto-converted at save;
- timezone changes affect future defaults only, never existing flight/rate dates;
- a mounted form does not silently change across midnight or another-tab timezone changes; fresh mount/reset derives a fresh default;
- FlightForm receives its new-flight default from the authenticated server path and loses the independent UTC fallback;
- Quick Add must not silently drop an entered hourly rate when no valid effective date exists;
- GPS/FCL.050 timeline evidence remains UTC;
- cross-timezone restore must preserve `flights.date` and `rates.valid_from` exactly;
- DB migration / historical backfill / portable-backup version bump remain N/A;
- production timezone-value census is required before release, not before P1.2 implementation;
- adjacent UTC/`CURRENT_DATE` status semantics discovered in credentials/recency/print are tracked separately in #258 and do not expand #144.

### P1.2 — Strict calendar primitive + configuration boundary — DONE / VERIFIED

Merged through PR #259 as `445454b73bfad305264ed10ce74bc02335474c8c`.

Verified exact implementation head `c38ac15a673f770c2ae8cd13a4b02a32c70188dd`, candidate `b8520903792d8af18f502469b028b3ab59c9c098bb47bf5bcbd42e5021fc13b5`:
- source-contract PASS;
- TypeScript PASS;
- aggregate regression **1419/1419 PASS**;
- production build **41/41 PASS**;
- PostgreSQL acceptance **99/99 PASS**;
- authoritative browser-risk **10/10 PASS** (5 desktop + 5 mobile, one worker);
- domain/scale N/A;
- required evidence satisfied; blocked evidence none.

Delivered boundary:
- pure deterministic named-timezone `YYYY-MM-DD` derivation with injected instant;
- strict `resolved | needs_configuration | unavailable` user-calendar resolver;
- server-authoritative Settings timezone validation with raw numeric offsets rejected;
- invalid timezone blocks the complete account-settings transaction and surfaces controlled UI feedback;
- presentation-only Prague fallback remains unchanged and separate;
- no Manual Flight/Aircraft/Quick Add/GPS rewiring yet.

### P1.3 — Manual flight default — DONE / VERIFIED

Merged through PR #261 as `12b31ba6d837bdda17ae9e3d676ed9261ef816c7`.

Verified exact implementation head `99babf404656f02cd3a07dcb53636a37d0eae9d5`, candidate `fa17f53001d3691fd510fa1b00049d47935e8b4cf39400b82c27ed38642a6b11`:
- source-contract PASS (reused);
- direct domain-unit PASS (reused);
- TypeScript PASS (reused);
- aggregate regression **1421/1421 PASS**;
- production build **41/41 PASS**;
- PostgreSQL acceptance **99/99 PASS**;
- authoritative browser-risk **10/10 PASS** (5 desktop + 5 mobile, one worker);
- scale N/A;
- required evidence satisfied; blocked evidence none.

Delivered behavior:
- New Flight resolves the strict user-calendar default once on the authenticated server page;
- Manual Flight receives that result explicitly;
- `getManualEntryDefaults()` no longer computes a calendar date;
- the client UTC `toISOString().slice(0,10)` fallback is removed as saveable-date authority;
- resolved defaults remain stable for the mounted form; explicit manual date remains authoritative;
- Edit preserves stored `flight.date`;
- missing/blank/invalid timezone fails closed to an empty editable date with controlled Settings guidance;
- resolver read failure fails closed to an empty editable date with temporary-unavailable guidance;
- off-block/takeoff/landing/on-block remain explicitly UTC; canonical parsing and certification are unchanged.

### P1.4 — Aircraft / rate defaults — DONE / VERIFIED

Merged through PR #263 as `7920164f2e461cacbd99279488cc092ad3fc4674`.

Verified exact implementation head `4caaae0e4e917f3d20f31db18096b1c953ff5559`, candidate `a67621e0618d2a847fef597f34ea7bf093781f572e4e55854f1ae1a6d3fdf952`:
- source-contract PASS (reused);
- direct domain-unit PASS (reused);
- TypeScript PASS (reused);
- aggregate regression **1427/1427 PASS**;
- production build **41/41 PASS**;
- PostgreSQL acceptance **99/99 PASS**;
- authoritative browser-risk **10/10 PASS** (5 desktop + 5 mobile, one worker);
- scale N/A;
- required evidence satisfied; blocked evidence none.

Delivered behavior:
- Aircraft & Airports resolves the strict user-calendar result server-side and passes it into Aircraft Manager;
- New Flight reuses its strict calendar result for Quick Add;
- both module-level Prague `today` constants are removed;
- new-aircraft `initial_valid_from` and new rate-history `valid_from` derive only from a resolved account timezone;
- unresolved/invalid configuration leaves visible rate dates empty and manually editable instead of guessing;
- Quick Add does not invent a rate date when calendar resolution is unavailable;
- a positive initial hourly rate with a missing/invalid effective date is rejected before the aircraft/rate transaction;
- aircraft creation without an initial rate remains allowed;
- explicit effective dates and historical `rates.valid_from` values remain authoritative and date-only;
- database workspace ownership was corrected from stale `data-recovery` classification to `aircraft-airports` without weakening evidence: aircraft-airports now retains browser acceptance and requires PostgreSQL acceptance for persistence risk.

### P1.5 — GPS / backup invariance + exact-candidate closeout — DONE / VERIFIED

Evidence candidate:
- active server GPS consumers continue to import `localParts` only through `@/lib/kml`, whose explicit export maps it to UTC `utcParts`;
- client GPS review imports `utcParts` directly from `lib/track-time`; explicit offsets normalize to UTC and timezone-less timestamps remain unavailable;
- date-boundary tests now cover +14:00 / -11:00 source offsets without user-timezone participation;
- the dormant Prague `localParts` helper in `lib/track-processing.ts` is **retained, not promoted**: no active audited authoritative path uses it, but removal is deferred because exhaustive repo-wide retirement proof was not established in this milestone;
- account backup exports raw flights, rates and settings rows; exact restore inserts date-only rows with PostgreSQL `json_populate_record` and does not run `flights.date` / `rates.valid_from` through JavaScript Date conversion;
- independent final review found no timezone-semantic defect but flagged that source inspection alone was weaker than PostgreSQL-backed proof for restore; accepted and strengthened with a dedicated PostgreSQL integration assertion showing `json_populate_record` preserves date-only values identically under Pacific/Auckland and America/Los_Angeles session time zones while production restore continues to use that primitive for flights/rates;
- portable-backup evidence now proves a saved timezone plus `flight.date` and `rate.valid_from` retain their literal calendar strings;
- CSV/XLS/print keep flight dates date-only; the export route UTC date used for the **filename stamp** is not flight-date authority;
- historical rate selection remains lexical/date-only and is covered at a calendar-year boundary;
- adjacent licence/recency/print-status "today" behavior remains issue #258 and is not changed here.

Production read-only census — **PASS, point-in-time 8 October 2026**:
- 5 users total; 5/5 have `user_settings`;
- missing settings: 0; NULL timezone: 0; blank timezone: 0;
- configured timezone values: `Europe/Prague` ×5;
- invalid under the same Node 24 `Intl.DateTimeFormat` + raw-offset rejection semantics as `normalizeSaveableTimeZone`: **0**;
- census used aggregate/grouped SELECT-only queries against the production database; no user identity data was emitted and no mutation was executed;
- the temporary non-persistent execution sandbox was stopped after the census.

No runtime semantic change, DB migration, historical backfill or backup-format bump is introduced by this P1.5 evidence candidate.

Exact candidate `bd04725222af573ca986239dc168383a39e6c9da3809f8c8edd69dc51f78f988` on head `56e3b05620ee4c35693994e1e60276387a41fe97` is VERIFIED: targeted P1.5 evidence **38/38 PASS**, TypeScript **PASS**, planner selected `fullTests=true` + PostgreSQL acceptance with no blockers, `verify:iterate` **PASS**, aggregate regression **1433/1433 PASS**, and full PostgreSQL acceptance **100/100 PASS** including the cross-session-timezone date-only restore test. Build, scale and browser were correctly N/A; required `postgres-acceptance` was satisfied; blocked evidence none.

FEATURES and DEVELOPMENT were reviewed in the same closeout cycle. FEATURES is updated to the implemented/verified Phase 1 capability; DEVELOPMENT requires no process change. No runtime semantic change, DB migration, historical backfill, certification rewrite or portable-backup format bump is introduced by P1.5.

Phase 1 acceptance is satisfied. PR #265 merged to `main` as `d96aed69b9fee41550820a1d05666420bce4e9fb`; its development-only merge deployment was correctly skipped. Release PR #266 then advanced package/footer metadata to `3.6.0`, passed exact-candidate release verification, and merged as `168bd029540474d6e806bf3e261fa855824b7c2a`. Vercel production deployment `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs` reached READY on that exact SHA, carries `fly-tally.com`, root/login smoke returned HTTP 200, and the immediate checked runtime-error window was clean.

GPS/FCL.050 UTC evidence must not be converted into local-time evidence by convenience.

# 3.7.0 — Maps & Aviation Layers — ACTIVE / PHASE 2.1 TRIAL DRAFT

**Product decision — 9 October 2026:** Filip approved reprioritizing Maps & Aviation Layers as 3.7.0 immediately after the 3.6.0 production closeout. This supersedes the *release number/reservation* of the old 3.7.0 Currency workstream, **not** its contract, issue or requirements.

**Canonical contract:** `docs/product/3_7_0_MAPS_AVIATION_LAYERS.md`  
**Phase 2.1 implementation/trial contract:** `docs/product/3_7_0_PHASE2_SATELLITE_IMPLEMENTATION.md` (draft / feature flag OFF); source/provider readiness is in separate unmerged docs PR #271.  
**Independent review handoff:** `docs/product/3_7_0_MAPS_REVIEW_HANDOFF.md`  
**Both independent reviews + reconciliation:** `docs/product/3_7_0_MAPS_REVIEW_RECONCILIATION.md`  
**Phase 1 implemented acceptance / browser test registration:** `docs/product/3_7_0_PHASE1_TEST_ACCEPTANCE.md`  
**Phase 0 source baseline:** `main@162d9ba88c7302dc45e564d8b59a5c3cdf060709`  
**Current status:** intermediate `9a325ca` release gate **FAIL** at aggregate Node tests (stale public replay source expectation and parser `Style=satellite` failure); PostgreSQL/browser **NOT RUN**. Small corrective commits now in Draft PR #269 `1a93046`, current-head test evidence **NOT RUN**. Former `b3917c7` complete release PASS and supplementary iPad emulation 16/16 PASS are historical and not transferable; physical iPad Safari NOT RUN. Owner merge decision pending.

**Trace investigation (9 Oct 2026):** the user supplied the failed GPS Playwright `trace.zip`. The click on `Save & certify flight` completed, and an authenticated `POST /flights/new` began; the network archive records that request with `status=-1` and no response before Playwright's five-second confirmation expectation timed out. The screenshot shows `Saving draft…` and `Saving & certifying…` pending; no server-action error or certification result is evidenced by the trace. Thus **server action slow/incomplete is observed, but GPS persistence/certification failure is not proven**. Next: before any re-run/fixture reset, use a read-only SQL query for the exact known fixture (`user_id=9001`, `OK-E2E`, `2026-10-05`, `off_block=14:00`) to establish whether it reached draft/certified state. Keep the 5s failure as real acceptance FAIL; do not simply waive/skip it. Map SSR mitigation in head `3777fb0` remains NOT TESTED. Source/domain/typecheck PASS; exact-candidate aggregate 1,443/1,443 PASS, production build PASS, isolated PostgreSQL 100/100 PASS. First authoritative browser-risk attempt failed on GPS completion banner visibility (10 desktop pass, 1 fail); two SSR `window is not defined` errors also appeared during map routes. Browser-risk PARTIAL, release FAIL; mobile not executed. Preserve Playwright screenshots/trace for read-only triage, fix only evidenced root cause, retest on new exact candidate. Neither Draft PR merged; provider gates blocked.


**Tenth user-local exact-candidate verification (9 October 2026):** feature head `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`, candidate `e8685272ae5e753ab6c8a577799da203795fb1ffcac382c096f63c2350915e25`; guarded dedicated localhost PostgreSQL `127.0.0.1:55432/flytally_browser`. `npm.cmd run verify:release:risk -- --base origin/main` returned **`release_status=PASS`**, source-contract **PASS:reused** (232/232 from iteration), direct domain-unit **PASS:reused** (46/46), TypeScript **PASS:reused**, complete Node aggregate **1,444/1,444 PASS (0 fail, 0 skip)**, optimized Next.js 16.3.2 production build **PASS** (41 static paths generated), canonical PostgreSQL acceptance **100/100 PASS**, authoritative Playwright browser-risk **12/12 desktop PASS + 12/12 mobile PASS** on one worker (24/24 total; no retries/failures reported), `scale=N/A` per planner (10k/50k/100k cases nevertheless executed inside full PostgreSQL acceptance), required evidence `application-source-contract,browser-acceptance,domain-unit,postgres-acceptance`, `blocked_evidence=none`. Earlier GPS five-second assertion and Leaflet SSR `window is not defined` errors **did not recur in the supplied final release log**; this verifies the tested flows rather than asserting every server route is error-free. Non-blocking: ignored parent lockfile warning and `slow-server-task` diagnostics (~1–1.7s) during flight-detail reads. **Product Phase 1 standard-only implementation is locally release-gate verified, but separate iPad portrait/landscape light/dark visual and pointer-touch proof, independent final PR code review, owner merge approval and production smoke/deploy remain NOT RUN/OPEN.** Both PRs Draft/unmerged. Phase 2 satellite and Phase 3 openAIP remain BLOCKED by independent provider rights/API/cost/effectivity gates; no live provider features enabled and no DB schema/certification/backup change in this feature.

## Product objective

- Add user-selectable `Standard / Satellite` base-map controls to relevant Leaflet flight map surfaces, including the saved flight GPS review/replay, while retaining map center, zoom, overlays, interactions and playback.
- Add optional source-backed openAIP aviation layers; first candidate is raster airspace context. Airports, navaids and reporting points require separate applicability and density review.
- One consistent, minimal, iPad-friendly Map Layers UX; default existing Standard basemap and airspace overlay OFF; no silent global or persisted preference.
- Keep map context strictly non-authoritative and independent from logged flight evidence, recency, SERA, GPS calculation, certification and training.

## Phase 0 discovery — completed source inventory / external gates open

- Existing stack is Next.js 16/React 19/Leaflet 1.9.4. Current `/map` supports route overview and GPS tracks; saved flight detail loads the track player lazily; GPS import has a review player; public shared flights can expose the same replay component. **3.7.0 does not add openAIP or new satellite toggles on public shares/Story export** pending separate rights and product approval.
- Satellite transport already exists in the backend `/api/map-tile/[z]/[x]/[y]?style=satellite` (Esri World Imagery with labels, requiring `ARCGIS_ACCESS_TOKEN`). The Story SVG generator already has a separate satellite option. Standard Leaflet helper uses `style=map` only.
- Current dark treatment filters the entire Leaflet `tilePane`; satellite/openAIP must not inherit this filter. Existing route/airport panes have z-indices 450/470 and must remain interactive above aviation tiles.
- `tests/v1314`–`v1317` contain legacy basemap/dark source contracts. `gps-tracks` and `analytics` development modules own affected paths; do not bypass selected browser/PostgreSQL requirements.
- openAIP Core/Tiles API Swagger entrypoints are discoverable, but direct live schema, rate limits and licensing for this application are **not** independently verified. CC BY-NC 4.0 information and conflicting secondary interpretation of commercial application embedding require authoritative resolution, especially for public sharing.
- OSM tile policy and Esri/data provider attribution, image rights, token entitlement and usage costs must be checked before production activation. No live production token/config/network smoke was run.

## Phases and acceptance gates

1. **Phase 0 — Reconstruct / Discover / Design / Review.** Read-only inventory COMPLETE; independent BLOCK review reconciled; second independent review **APPROVE WITH CHANGES** Phase 1 technical contract. Browser test registration/acceptance design documented, pending product acceptance and implementation. External provider permission separate. No runtime.
2. **Phase 1 — Shared map-layer controller: IMPLEMENTED DRAFT / REVIEW FINDINGS REMEDIATED / RETEST PENDING.** Draft PR #269 `9a325ca` includes standard-only panes, dark-filter/lifecycle hardening, strict style aliases and a dynamic public-share replay SSR boundary. Earlier `b3917c7` had risk `release_status=PASS` and supplementary iPad Chromium **16/16 PASS**; both are historical after remediation. Current-head verify:iterate, regression/build/PostgreSQL/browser-risk and public share route smoke **NOT RUN**. Independent reviewer APPROVE WITH CHANGES; owner merge/deploy decision, native iPad Safari if required and upstream-provider evidence separately OPEN.
3. **Phase 2 — Satellite on authenticated map surfaces: 2.1 OPT-IN DRAFT / NOT RELEASED.** Shared Standard/Satellite selector, no auto-apply, fail-closed tile fallback and all four authenticated surfaces staged on `feat/3.7.0-satellite-selector-trial`; `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS` defaults OFF. Initial local verify:iterate on pre-fix candidate FAIL (source ownership inventory 388 vs 387). Follow-up `4cc87593` local iteration PASS (source 233/233, domain 46/46, typecheck PASS) and standalone Next.js build PASS. Full local risk-release then FAIL at aggregate regression (1448/1450; stale timezone runtime count 387 vs 388, Satellite fallback test asserted incorrect string placement). Both test-only issues corrected in subsequent feature commits; corrected head release retest PENDING. Isolated PostgreSQL fixture prepared/identity-probed on 127.0.0.1:55432; PostgreSQL acceptance and Playwright NOT RUN. External Esri provider entitlement, real attribution, token/referrer, quota/export/Story rights gates remain BLOCKED. Existing public replay and Story pipeline unchanged. Activation in production NOT AUTHORIZED.
4. **Phase 3 — openAIP airspace overlay (BLOCKED on external approval).** Live official Tiles API schema, credentials, rate/cost/cache limits, written/qualified rights clearance, authenticated fixed-host proxy, precise available/unavailable state, attribution, airspace source-age caveat; never in public share or Story; no NOTAM or activation claim.
5. **Phase 4 — Acceptance / production closeout.** Exact-candidate risk-selected tests + map browser acceptance including iPad light/dark; provider smoke/cost/error observation, correct package/footer 3.7.0 only at release; verify ROADMAP/FEATURES/CHANGELOG.

**Blocking before live openAIP:** authoritative permission covering FlyTally's intended use, live current API verification, provider/security controls, attribution, privacy and explicit public-export decisions. **Blocking before satellite production:** licensed ArcGIS token/usage, attribution, and live failure behavior. Until gates clear, unavailable features fail closed; satellite can be independently releasable without claiming openAIP delivery only after a separate product/release decision.

**Technical invariants:** no expected DB schema migration, certification payload rewrite, backup-format change, GPS calculation changes or Training changes. The actual scope must be re-evaluated if implementation evidence contradicts this assumption. No production readiness claimed from documentation.

# 3.8.0 — Currency / monetary semantics — NEXT (formerly 3.7.0)

**Superseded planning record:** On 9 October 2026, only the original `3.7.0` release reservation and ACTIVE scheduling for Currency / monetary semantics were superseded by Maps & Aviation Layers. Issue **#136**, original discovery plan and all safety/data-integrity decisions remain intact.

**Current next step after 3.7.0:** reconstruct the existing monetary data model and consumers, freeze currency authority/legacy semantics, then obtain an independent design review before runtime implementation.

Before code:
- define whether account currency is display/default denomination or record authority;
- classify records that already persist currency;
- classify legacy values with/without explicit denomination;
- define export/backup consequences;
- no automatic FX conversion without an explicit future rule.

# 3.9.0 — Multi-aircraft heterogeneous onboarding proof — PLANNED (formerly 3.8.0)

Representative Aeroplane, Helicopter, Sailplane/TMG, Balloon, ULL and Other profiles must pass the same canonical workflow without make/model-specific runtime branches.

Proof includes:
- catalogue/manual identity;
- Add/Edit;
- Quick Add;
- deactivate/reactivate;
- flight selection;
- applicability guidance;
- desktop/iPad/mobile light/dark acceptance.

# 3.10.0 — Multi-aircraft sharing / recovery / scale closeout — PLANNED (formerly 3.9.0)

Scope:
- aircraft sharing preserves recipient ownership + canonical validation;
- exact backup/restore preserves profile + protected-flight evidence;
- multi-profile picker/library behavior measured before optimization;
- deletion/deactivation remains safe when historical flights reference registration;
- complete regression / PostgreSQL / browser / build closeout.

# Research — Professional Logbook Platform

No product version is assigned yet.

Possible future scope:
- organization/operator accounts;
- fleet workflows;
- instructor/student organizational evidence;
- controlled reports;
- team permissions.

Promotion requires a dedicated research/design decision first.

## Permanent engineering constraints

- One canonical flight/data model.
- Manual/GPS/Create/Edit business rules converge rather than fork.
- Invalid combinations fail closed; no silent repair.
- Certified/finalized history is revisioned/audited, never destructively overwritten.
- Recency/currency/compliance claims are evidence-first.
- Auth/ownership is server-enforced.
- Schema changes are explicit deployment prerequisites.
- Production deployment is not inferred from build/merge success.
- Testing evidence is reported exactly as run.
- ROADMAP / FEATURES / CHANGELOG close in the same work cycle.

## Historical record

Pre-standardization milestone history, including the prior E/F/B/SP/M labels and detailed closeout evidence, is preserved at:

`docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md`

Historical docs remain evidence/context only. If they conflict with this ROADMAP on current priority, this ROADMAP controls.


**Eighth work cycle (9 October 2026 — saved GPS result confirmed; browser test repair NOT VERIFIED):** user executed a read-only SQL identity-guarded query against isolated `flytally_browser` at `127.0.0.1:55432` after the failing Playwright run: **one matching flight; certified=1, drafts=0, certification_version=8, certification_hash length=64, GPS tracks=1** for `user_id=9001`, `OK-E2E`, `2026-10-05`, off-block `14:00`. This proves persisted certified+GPS state at query time; due possible later fixture changes, not a complete timestamped action-latency measurement. The prior 5-second UI assertion failed while the trace showed a pending POST, rather than demonstrating a rejected certification. Feature PR #269 now at `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`: **test-only** GPS e2e adjustment waits for real flight-detail redirect with explicit 20-second limit, keeps banner, `CERTIFIED R1`, hash/version `8|64` and GPS-track `1` assertions; one-case 60-second test budget covers setup and navigation. No production GPS/certification/DB code was changed. Map SSR client boundaries and this test change are **NOT YET TESTED** on the new head; all former PASS evidence belongs to `5b011c8`. Risk release remains FAIL / not ready until exact-head verifier and browser checks pass.


**Ninth verification cycle (9 October 2026, updated exact head `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`):** user clean Windows checkout fast-forwarded to feature head, and `npm.cmd run verify:iterate -- --base origin/main` completed **iteration_status=PASS**, source-contract **232/232 PASS**, domain-unit **46/46 PASS**, typecheck **PASS**, blocked_evidence **none**. Candidate ID `e8685272ae5e753ab6c8a577799da203795fb1ffcac382c096f63c2350915e25`. `release_status=NOT EVALUATED`, with **aggregate regression, production build, PostgreSQL acceptance and browser-risk PENDING for this new candidate**. This does not supersede the previous head's browser FAIL or prove the SSR fix/GPS browser synchronization; final release only after current-candidate `verify:release:risk` and browser cases pass. Existing dedicated localhost PostgreSQL on port 55432 must be identity-checked again before fixture bootstrap. No merge/deploy.


**11th local verification / regression patch (9 Oct 2026):** user fast-forwarded exact feature head `9a325ca`, guarded dedicated PostgreSQL at 127.0.0.1:55432 and ran `verify:iterate` **PASS** (source 233/233, domain 46/46, TypeScript PASS, `candidate_id=473c1318a0797ea474751f4207a96a39667687cc729035002c7652fb92ea3f64`, no evidence blockers). `verify:release:risk` returned **`release_status=FAIL`, `aggregate=FAIL`** because two Node source/unit tests failed: (1) historical public-share viewer test asserted a direct `FlightTrackPlayer` string in public page, incompatible with the deliberate SSR-safe `PublicFlightMap` boundary; (2) case-variant `Style=satellite` was not rejected by case-sensitive malformed-style key matcher (returned standard `map` instead of `null`). This is not PostgreSQL/browser failure: those gates were **NOT RUN** after aggregate FAIL. PR #269 now on unverified feature head `1a930465ea3d465cb20d6eac17712d9511888436`: update public-share source contract to assert the dynamic `PublicFlightMap -> FlightTrackPlayer` delegation and `ssr:false`, reject case-variant `style*` keys in parser, and include uppercase/mixed alias cases in unit + HTTP e2e. **New-head tests/build/PostgreSQL/browser NOT RUN**; prior 24-browser/100-PG and iPad 16/16 PASS only on `b3917c7` are historical. Both PRs remain Draft, no merge/deploy. Owner compatibility decision for legacy duplicate style still open.
