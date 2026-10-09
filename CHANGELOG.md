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

## Unreleased — 3.7.0 R2 Batch 1 — Story export integrity (2026-10-09)

- Retained Instagram Story Standard/Satellite selection and PNG download/share workflow; unified the normal-map button label as Standard.
- Story PNG export now requires every requested basemap tile to load with the requested style and valid image data; an unavailable tile aborts the export instead of silently producing a partly blank PNG.
- Added accessible export failure feedback and disabled style changes while a PNG is being prepared; intermediate SVG object URLs are revoked.
- Extended source regression and existing registered desktop/mobile browser acceptance to exercise Standard/Satellite PNG download and tile-failure alert against synthetic tiles and isolated test DB.
- **Verification: NOT RUN on R2 branch.** No API/auth/DB/certification/backup changes. No merge/deploy, no production Satellite activation.

### 2026-10-09 — R1 final local verification (Satellite ON and OFF)

- Exact **runtime/test HEAD** `7661d1dd30ba17948ef517f7ef193358380b67cd`, candidate `7292ab60ebbbaaa1c6e77caadf2f02a8257fcb6d649d41b437ae54c3ab140814`; Windows local owner-run `npm.cmd run verify:release:risk -- --base origin/main` with `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`: **release_status=PASS**; source=PASS (reused), domain=PASS (reused), typecheck=PASS (reused), aggregate=PASS (reused), build=PASS (reused), postgres=PASS (reused), browser desktop Chromium **11/11 PASS**, mobile Chromium **11/11 PASS**, blocked_evidence=none.
- Same exact HEAD/candidate, owner-run `npm.cmd run verify:release:risk -- --base origin/main --rerun` with `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=false`: **release_status=PASS**, source/domain/typecheck/aggregate/build/postgres/browser **all freshly PASS**, PostgreSQL acceptance **100/100**, desktop Chromium **11/11** and mobile Chromium **11/11**. PostgreSQL 18.6, dedicated local fixture at `127.0.0.1:55432/flytally_satellite_r1_test`, role `flytally_sat_r1` identity verified before both runs. Initial ON browser failure due to missing local SESSION_SECRET was fixed in ephemeral environment; final ON and OFF acceptance both PASS without a runtime change.
- ON/OFF share candidate ID because build-time flag is not encoded as distinct candidate identity: **retain separate evidence by flag value and run**; do not treat one build artifact as proving both. This documentation-only commit is **after** the verified HEAD; its exact new Git SHA has NOT been locally reverified. No CI, iPad native/Safari, real Esri network/provider authorization, production smoke, merge or deploy claimed.
- **R1 implemented + locally verified (runtime HEAD above); documentation closeout recorded.** PR #272 remains DRAFT; production Satellite remains OFF. **R2** needs server-side provider/rights/cost/auth/rate-control design (including legacy public Story satellite probe), independent review and explicit production entitlement before activation. No changes authorized to `flytally-training`.

# FlyTally changelog

This is the canonical record of **what actually changed** in `flytally-logbook`.

- `ROADMAP.md` is forward-looking and may contain planned work.
- `FEATURES.md` is the capability inventory.
- This file records merged/product changes and must not describe planned work as completed.
- Historical PR/version labels are preserved even where old release numbering was inconsistent with package metadata.
- From 4 October 2026 forward, canonical product releases use numeric `MAJOR.MINOR.PATCH`; see `docs/product/VERSIONING.md`.

## Unreleased

- **3.7.0 Satellite Phase 2.1 trial — FEATURE BRANCH DRAFT / NOT RELEASED (9 October 2026):** new opt-in Standard/Satellite Leaflet selector in four authenticated map surfaces, atomic shared basemap swap, fail-closed 502/tile-error return to Standard, dark filter isolation, public replay exclusion, scoped responsive controls, and extended Node/Playwright deterministic fixture assertions. Flag `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS` defaults OFF. Feature branch only; local source/domain/typecheck and standalone Next.js build PASS on previous head; full aggregate 1448/1450 FAIL (two test-only assertion mismatches); PostgreSQL/Playwright NOT RUN; no merge, DB/schema migration, production deployment, new Esri live requests or 3.7.0 version bump. Exact provider licensing, actual attribution, token/referrer and quota/export gates remain BLOCKED. Details in `docs/product/3_7_0_PHASE2_SATELLITE_IMPLEMENTATION.md`.
  - **Verification follow-up (9 October, feature branch only):** first local `verify:iterate` source-contract 232/233 FAIL for audited runtime inventory `388 != 387`; domain 46/46 PASS; typecheck PASS. Registry ownership and audited total amended and explicit coverage assertion added in subsequent commits. Follow-up head `4cc87593` local iteration PASS: source 233/233, domain 46/46, typecheck PASS; standalone Next.js production build PASS (41/41 static pages). Local risk-release `release_status=FAIL` at aggregate Node 1448/1450; `timezone-semantics-source` repeated obsolete 387 runtime total after registry changed to 388, while Satellite test asserted wrong conditional status syntax. Updated only test contracts: unrelated timezone test no longer freezes global ownership count already guarded by `development-scope`, and Satellite test asserts actual conditional fallback string. New corrected head verification pending; PostgreSQL/Playwright **NOT RUN**, no release PASS implied.

- **3.7.0 Satellite Phase 2.2 R1 — Draft review remediation (9 October 2026; NOT MERGED):** **Exact pre-R1 owner-run verification (9 October 2026):** PR #272 head `3315da278d95285b89d1f95be0a557a849cf6af8`, candidate `0ca40786a1eec48370e3c4f69b7a7f2ec4dc382da3a25febc60847dddcf0681a`, `npm.cmd run verify:release:risk -- --base origin/main` with Satellite flag ON: source 233/233 PASS, domain 46/46 PASS, typecheck PASS, full aggregate PASS, candidate build PASS, isolated PostgreSQL acceptance PASS, desktop Chromium 11/11 PASS, mobile Chromium 11/11 PASS, `release_status=PASS`, `blocked_evidence=none`. This is **local** evidence, not CI or provider validation. **Subsequent R1 test/documentation-only commits change the candidate; current R1 HEAD verification NOT RUN.** Satellite remains OFF in production; Esri provider/legal/token/referrer/attribution/cost gates BLOCKED; PR #272 DRAFT and unmerged. R1 adds targeted behavioral Playwright assertions for attribution removal and repeated layer switching, removes brittle comment-dependent source assertion, and reconciles current/head verification facts in ROADMAP, FEATURES and implementation documentation. Previous failure evidence stays retained above. New R1 candidate requires fresh tests and release gate before claiming PASS.

- **Phase 1 standard-only production functional acceptance (9 October 2026; documentation closeout in Draft PR #270):** Owner confirmed browser Map/light-dark, existing GPS replay and playback continuity, public share/privacy, and mobile/iPad interaction work on `fly-tally.com`. This is **user-reported manual PASS**, not independent native Safari screenshots or browser traces. Production Map API HTTP 4/4 PASS (real OSM image and strict style 400); Vercel READY at `cc7abd41`; latest inspected aggregated runtime errors none. Prior local exact candidate full `release_status=PASS`. Remaining: merge docs PR #270 to complete documentary Phase 1 closure; product version 3.6.0 and full Maps 3.7.0 release unchanged; satellite/openAIP provider gates BLOCKED.


- **Production public Map API smoke PASS 4/4 (9 Oct, GET-only):** `fly-tally.com` returned Standard OSM tile HTTP 200 `image/png`; unknown style and two forms of duplicated `style` returned HTTP 400 JSON `unsupported_style`, `no-store`. User PowerShell reported `PUBLIC MAP API SMOKE PASS`. **Live signed-in map/GPS playback, public share/privacy and native iPad/mobile browser smoke remain NOT VERIFIED**. Production acceptance stays OPEN, no full 3.7.0 release.


- **Phase 1 Maps standard-only MERGED / Vercel READY (9 Oct 2026; full 3.7.0 NOT RELEASED):** PR #269 squash merge `cc7abd41858cb2b2ddd8e794889922c856885686` from locally verified candidate `ef19b98cc30759a5b1f2b5f6b72ce8780be6890e293dd528bb6d04a794ce29ff`. Release gate PASS: Node 1,447/1,447, build, PG 100/100, Chromium desktop/mobile 12/12 each. Vercel `dpl_51zwnZYfFADxeDEyZheTYg9siXD8` READY on `fly-tally.com`; no full browser/live OSM/public-share production smoke confirmed yet. No new DB migration or certification changes; no 3.7.0 version bump or tag; old READY `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs` available for rollback. Satellite/openAIP external gates still BLOCKED; Phase 1 closeout PENDING.


- **Final pre-merge governance alignment after 9 Oct aggregate failure (NOT RELEASED):** On integrated feature head `82541845a6f79211d1b7dd4e79cb67a12a3988ec` targeted historical regression **4/4 PASS**, iteration **PASS** (source **233/233**, domain **46/46**, TypeScript PASS), candidate `b4666d0271de4fa728711769ebb43750a2a833d99c5ce2747661ae11859d21f1`; risk release **FAIL** at aggregate Node because two stale versioning-governance tests still expected pre-reprioritization Currency 3.7.0 / Onboarding 3.8.0. Aggregate/build/PostgreSQL/browser release PASS **not established** on that candidate. Test-only correction now validates Maps 3.7.0, Currency 3.8.0, onboarding 3.9.0 across ROADMAP and VERSIONING; VERSIONING status updated from obsolete "runtime not started" to implemented Draft/PENDING. Exact new-head release gate **NOT RUN**. Production code, DB schema and certification unchanged; PR #269 remains Draft/unmerged.


- **Post-docs-merge integration test repair (9 October 2026; NOT RELEASED):** docs PR #268 squash-merged to `main@5944f917`; feature PR #269 integrated it on `03257ee` with application/runtime trees unchanged. Local iteration `source=FAIL` 232/233 (one stale historical `v300-navigation-hierarchy` assertion still bound Currency to 3.7.0) and release `release_status=FAIL` stopped at same source gate; build, aggregate, PostgreSQL and browser **NOT RUN** on that candidate. Test-only correction `f0a0e0b` now asserts Maps 3.7.0 and Currency 3.8.0; new exact-head testing **PENDING**, not PASS. Previous `5538e0c` 1,447/1,447 + PostgreSQL 100/100 + desktop/mobile 12/12 each release PASS remains historical. Product strict-style decision A approved; no runtime/DB/deploy changes.


- **Phase 1 compatibility decision finalized (9 October 2026; NOT MERGED/DEPLOYED):** product owner accepted **A — strict HTTP 400** on duplicate, malformed or unknown `style` parameters; omitted `style` continues to select standard map. Deliberate incompatibility with legacy duplicate first-value parsing is approved. No extra runtime commit required: `5538e0c` passed exact-candidate local release gate. Satellite/openAIP external production gates are unchanged and blocked.


### Documentation / planning only (not a product release)
- **LATEST Phase 1 exact-candidate full local release PASS (9 October 2026, NOT MERGED/DEPLOYED):** PR #269 `feat/3.7.0-map-controller-phase1@5538e0c4eec8b4a70fc5568facc55f4dc7324606`, candidate `3334933268257a8e231ac7e172b1ffed38fa043d31b36699afe977d595ba7856`. Targeted Node 16/16, source 233/233, domain 46/46, typecheck PASS; release `release_status=PASS`: aggregate Node **1,447/1,447 PASS**, Next.js production build PASS, isolated PostgreSQL **100/100 PASS**, authoritative Playwright **12/12 desktop + 12/12 mobile PASS**, `scale=N/A` per planner, no blocked evidence. Test-only public share certified fixture setup/cleanup was repaired with transaction-scoped isolated cleanup; production flight certification/DB/schema untouched. Historic earlier release FAILs and iPad emulation on prior SHA are retained below; this current HEAD was not re-reviewed on native Safari/real provider tiles. Both PRs #268/#269 remain Draft/unmerged; CI, live provider, production smoke and deploy NOT RUN. Owner **approved decision A** (9 Oct): strict HTTP 400 for duplicate `style` values, including identical pairs, accepting legacy first-value compatibility change; independent satellite/openAIP provider gates still BLOCKED.

- **11th local verification / regression patch (9 Oct 2026):** user fast-forwarded exact feature head `9a325ca`, guarded dedicated PostgreSQL at 127.0.0.1:55432 and ran `verify:iterate` **PASS** (source 233/233, domain 46/46, TypeScript PASS, `candidate_id=473c1318a0797ea474751f4207a96a39667687cc729035002c7652fb92ea3f64`, no evidence blockers). `verify:release:risk` returned **`release_status=FAIL`, `aggregate=FAIL`** because two Node source/unit tests failed: (1) historical public-share viewer test asserted a direct `FlightTrackPlayer` string in public page, incompatible with the deliberate SSR-safe `PublicFlightMap` boundary; (2) case-variant `Style=satellite` was not rejected by case-sensitive malformed-style key matcher (returned standard `map` instead of `null`). This is not PostgreSQL/browser failure: those gates were **NOT RUN** after aggregate FAIL. PR #269 now on unverified feature head `1a930465ea3d465cb20d6eac17712d9511888436`: update public-share source contract to assert the dynamic `PublicFlightMap -> FlightTrackPlayer` delegation and `ssr:false`, reject case-variant `style*` keys in parser, and include uppercase/mixed alias cases in unit + HTTP e2e. **New-head tests/build/PostgreSQL/browser NOT RUN**; prior 24-browser/100-PG and iPad 16/16 PASS only on `b3917c7` are historical. Both PRs remain Draft, no merge/deploy. Owner compatibility decision for legacy duplicate style still open.
- **Independent PR review + iPad evidence and pre-merge remedial Draft PR #269 (9 Oct 2026; NOT RELEASED):** DeepSeek/Claude read-only independent reviewer verdict **APPROVE WITH CHANGES** on PR269.patch. Received and inspected 16 PNG screenshots/report/server log: iPad Chromium touch emulation **16/16 PASS** for portrait/landscape × light/dark × four map surfaces on original `b3917c7`; map movement lock/enable gestures PASS; native Safari and live provider tiles NOT RUN. Validated two review blockers and updated feature PR #269 to **`9a325ca1021c9305f1d3ecc0456c0921d086f9e5`**: strict rejection of malformed `style[foo]` / nested/mixed style aliases with unit/browser cases, client-only public `/f/[token]` GPS replay wrapper with SSR source guard across all app page/layout modules, regression route fixture, risk registry ownership and audited runtime count 387. Actual source has correct UTF-8 loading ellipses; patch mojibake was a decoding artifact, no code change. Legacy satellite duplicate query style remains intentionally rejected (owner acknowledgment pending), mocked tile/browser visuals do not verify upstream, transient hover highlight is minor deferred. **New head has no completed verification gates**; historical full-release PASS on `b3917c7` is not transferable. No merge/deploy, both PRs Draft.
- **Supplementary closure preparation (9 Oct 2026, NOT ACCEPTANCE PASS):** conducted a first-party read-only diff inspection of feature PR #269 (28 changed files; HEAD `b3917c7`). Produced a **separate git-ignored local iPad Chromium touch-emulation kit**, covering 820x1180 portrait and 1180x820 landscape, light/dark across route, GPS tracks, saved replay and GPS import (16 screenshot/test combinations). It tests pane/filter/attribution, overflow, movement-toggle lock and CDP simulated touch pan, logs JS failures and packages screenshot+JSON evidence. The runner was syntax checked but **NOT EXECUTED** against the Windows app; it uses controlled SVG tiles and does NOT constitute native iPad Safari or real-provider visual equivalence proof. A read-only independent DeepSeek/Claude PR #269 review handoff is prepared but **NOT SUBMITTED/REVIEWED** via a separate AI, so no independent verdict can be claimed. Review attention: examine strict style parser handling `style[foo]` aliases, Leaflet SSR/basemap cleanup, route hit targets and legacy satellite endpoint licensing. No code/feature candidate change; both PRs remain Draft/unmerged. Next actual evidence: owner runs the isolated iPad kit and sends evidence ZIP, forwards handoff to independent reviewer, then findings are reconciled before merge decision.
- **Phase 1 exact-head risk release PASS (9 Oct 2026; evidence, not deployment):** feature Draft PR #269 at `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`, candidate `e8685272ae5e753ab6c8a577799da203795fb1ffcac382c096f63c2350915e25`. User-local `verify:release:risk -- --base origin/main` **`release_status=PASS`**: source-contract 232/232 PASS reused, domain-unit 46/46 PASS reused, TypeScript PASS reused; aggregate Node **1,444/1,444 PASS** (0 fail/skip); Next.js 16.3.2 production build **PASS** (41 static paths); isolated full PostgreSQL acceptance **100/100 PASS** including 10k/50k/100k scenarios; authoritative Playwright **12 desktop + 12 mobile = 24/24 PASS** (single worker, no retries reported); `scale=N/A` per planner; `blocked_evidence=none`. The previous GPS Save & certify timeout and Next/Leaflet SSR `window is not defined` error did not appear in the final provided run. Only nonfatal parent lockfile warnings and `slow-server-task` observations remain; no new DB/certification/backup feature change. **Remaining DoD:** standalone iPad portrait/landscape light/dark and pointer proof, final independent reviewer, owner's merge decision and production smoke/deploy. Docs PR #268 and runtime PR #269 still DRAFT/unmerged, CI/merge/deploy NOT RUN. Provider-gated satellite/openAIP remain BLOCKED.
- **Ninth verification cycle (9 October 2026, updated exact head `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`):** user clean Windows checkout fast-forwarded to feature head, and `npm.cmd run verify:iterate -- --base origin/main` completed **iteration_status=PASS**, source-contract **232/232 PASS**, domain-unit **46/46 PASS**, typecheck **PASS**, blocked_evidence **none**. Candidate ID `e8685272ae5e753ab6c8a577799da203795fb1ffcac382c096f63c2350915e25`. `release_status=NOT EVALUATED`, with **aggregate regression, production build, PostgreSQL acceptance and browser-risk PENDING for this new candidate**. This does not supersede the previous head's browser FAIL or prove the SSR fix/GPS browser synchronization; final release only after current-candidate `verify:release:risk` and browser cases pass. Existing dedicated localhost PostgreSQL on port 55432 must be identity-checked again before fixture bootstrap. No merge/deploy.
- **Eighth work cycle (9 October 2026 — saved GPS result confirmed; browser test repair NOT VERIFIED):** user executed a read-only SQL identity-guarded query against isolated `flytally_browser` at `127.0.0.1:55432` after the failing Playwright run: **one matching flight; certified=1, drafts=0, certification_version=8, certification_hash length=64, GPS tracks=1** for `user_id=9001`, `OK-E2E`, `2026-10-05`, off-block `14:00`. This proves persisted certified+GPS state at query time; due possible later fixture changes, not a complete timestamped action-latency measurement. The prior 5-second UI assertion failed while the trace showed a pending POST, rather than demonstrating a rejected certification. Feature PR #269 now at `b3917c7bed43b2ed204dee14afe9fd6d35394b4c`: **test-only** GPS e2e adjustment waits for real flight-detail redirect with explicit 20-second limit, keeps banner, `CERTIFIED R1`, hash/version `8|64` and GPS-track `1` assertions; one-case 60-second test budget covers setup and navigation. No production GPS/certification/DB code was changed. Map SSR client boundaries and this test change are **NOT YET TESTED** on the new head; all former PASS evidence belongs to `5b011c8`. Risk release remains FAIL / not ready until exact-head verifier and browser checks pass.
- **Trace investigation (9 Oct 2026):** the user supplied the failed GPS Playwright `trace.zip`. The click on `Save & certify flight` completed, and an authenticated `POST /flights/new` began; the network archive records that request with `status=-1` and no response before Playwright's five-second confirmation expectation timed out. The screenshot shows `Saving draft…` and `Saving & certifying…` pending; no server-action error or certification result is evidenced by the trace. Thus **server action slow/incomplete is observed, but GPS persistence/certification failure is not proven**. Next: before any re-run/fixture reset, use a read-only SQL query for the exact known fixture (`user_id=9001`, `OK-E2E`, `2026-10-05`, `off_block=14:00`) to establish whether it reached draft/certified state. Keep the 5s failure as real acceptance FAIL; do not simply waive/skip it. Map SSR mitigation in head `3777fb0` remains NOT TESTED.
- **Seventh work cycle (9 October 2026 — SSR hardening drafted, NOT VERIFIED):** read-only inspection identified direct Leaflet imports in SSR-rendered client module graph for `/map` and flight-detail GPS replay. Feature branch PR #269 now introduces `components/client-maps.tsx` with `next/dynamic({ssr:false})` wrappers for route/track maps, updates `app/(protected)/map/page.tsx`, dynamically loads the Leaflet flight player inside `components/lazy-flight-track-review.tsx`, and adds a source regression contract in `tests/v370-map-layers.test.ts`. Latest feature head `3777fb0f76bd4555ef420da5b750403cbc8eb39e` (seven small feature commits after `5b011c8`), including explicit risk/browser-target registry ownership for `components/client-maps.tsx` and audited runtime total 386. This specifically attempts to address the observed `window is not defined` SSR errors; **no runtime/typecheck/browser tests have been run on this new head**, so resolution is not yet claimed. GPS direct Save & certify has **not** been changed: failure screenshot still shows `Saving draft…` / `Saving & certifying…` pending after a 5s expectation; persisted-row outcome unknown until trace/read-only fixture query. The previous 100/100 PostgreSQL, 1,443/1,443 aggregate and Next build PASS apply to earlier `5b011c8` only and must not be silently reused for the new candidate. Both PRs remain Draft; no merge/deploy.
- **Sixth user-local run (9 October 2026, same feature head 5b011c8 / candidate afab37e...):** isolated PostgreSQL `flytally_browser` verified at 127.0.0.1:55432 (own cluster, separate from default server); `npm run verify:release:risk -- --base origin/main` reused source/domain/typecheck/aggregate/build PASS. **Full PostgreSQL acceptance 100/100 PASS**, including 10k/50k/100k scale tests (scope planner marked scale N/A for this candidate, but canonical full suite ran its scale cases). **Browser-risk first desktop group: 10 PASS / 1 FAIL**: `e2e/gps-rolecrew.spec.mjs` GPS Save & certify completion banner `Flight saved and certified.` not visible within 5s. Production Next server also logged two `ReferenceError: window is not defined` module-evaluation errors during map theme/replay scenarios despite those cases counted PASS. **Authoritative browser evidence PARTIAL; final `release_status=FAIL`.** Browser mobile group NOT RUN because browser risk stops on failing desktop group. Screenshot, Playwright trace and error-context.md preserved on user workstation; root cause and persisted certified-row state are NOT YET CONFIRMED. Do not mask with longer assertion timeout or ignore SSR errors; investigate evidence first and keep both PRs Draft/unmerged. No code or schema/deploy changes from this acceptance run.
- **Phase 1 first exact-candidate release attempt (9 Oct):** feature `5b011c8`, candidate `afab37e13e2568a966c0821dc48f842427b1416dd5ccec35bc6be964f328a35a`, `verify:release:risk -- --base origin/main` reused source/domain/typecheck PASS, executed aggregate **1,443/1,443 PASS** and Next.js 16.3.2 production build **PASS** (41 static paths). Final `release_status=NOT RUN`, PostgreSQL **NOT RUN**, browser-risk **NOT RUN**, `blocked_evidence=none`. Windows environment had no PowerShell `DATABASE_URL` and no `psql` on PATH; an existing PostgreSQL 16 installation folder was found. This is a test-environment blocker, not a verified application failure. No merge, DB migration or deploy.
- **Phase 1 fast verification (9 Oct):** user-local Node 24.19.0 `verify:iterate -- --base origin/main` on feature `5b011c8` completed **iteration_status=PASS**, source 232/232 PASS, domain 46/46 PASS, typecheck PASS, blocked_evidence=none, candidate_id=`afab37e13e2568a966c0821dc48f842427b1416dd5ccec35bc6be964f328a35a`; **release_status=NOT EVALUATED**. Release gates remain pending. Browser fixture bootstrap destroys/recreates PostgreSQL `public` schema; only use a dedicated isolated localhost test DB.
- **Phase 1 test evidence update (9 Oct):** user-local full `npm test` on exact feature branch commit `5b011c8` completed **1,443/1,443 PASS**, 0 FAIL, 0 SKIP. Earlier isolated failures are resolved. This is **not a product release** or merge: latest-candidate `verify:iterate`/typecheck/build/PostgreSQL/Playwright/risk release remain pending; both PRs are Draft.
- Follow-up local check of unmerged Phase 1 PR #269 at `fc68861`: **1,442/1,443 PASS, 1 FAIL**. The remaining `tests/timezone-semantics-source.test.ts` inventory assertion expected 383 instead of actual 385 new runtime files. Corrected only the assertion in feature commit `5b011c8`; **post-fix npm test NOT RUN**, no merge/deploy.
- Recorded 9 Oct local validation evidence for **unmerged Draft PR #269**: earlier candidate `fb0471c` typecheck and Next build PASS, `npm test` **1,437/1,443 PASS; 6 FAIL**, and `verify:plan` with no blocked evidence. Feature PR now contains proposed fixes to all six test contracts/registry expectations (historical 98 browser executions retained; new five logical browser tests distinguish planned from verified). **Post-fix suite, PostgreSQL, Playwright and deployment NOT RUN**. No runtime change in this documentation PR.
- Phase 1 test contract was accepted by Filip; a separate **Draft, unmerged feature PR #269** was opened from canonical `main` with a standard-only Leaflet map controller candidate, strict tile-style parser, theme-lifecycle refinements and browser/Node tests. This is a report of **unverified proposed code in another PR**, **not** a shipped change in this documentation branch or production. Only the **byte-identical standalone style parser** was tested locally (4/4 PASS on Node22; Git blob SHA verified). Repository-wide tests/typecheck/build/Playwright/DB/deploy **NOT RUN**. Docs-only PR #268 remains unmerged.
- Received follow-up **APPROVE WITH CHANGES** review for the 3.7.0 Phase 1 map design, while Esri satellite production and openAIP production remain externally BLOCKED. Added an explicit Phase 1 test-registration/acceptance contract (map-specific Playwright target identities, fixtures, pane/lifecycle DOM oracle, route `style` failure matrix), clarified server-side 401/403 auth, provider proxy cache/raster/CSP guards, and reconciled ROADMAP/FEATURES. This is **planning only**; browser targets are NOT registered, runtime/testing/production unchanged.
- Reconciled the independent **BLOCK** review of the 3.7.0 map contract: exact Leaflet pane names/z-index, scoped dark-filter requirement, strict map tile `style` allowlist, native Node/Playwright behavioral acceptance, separation of map-instance lifecycle from controls, explicit exclusion of new public-share satellite/openAIP overlays, and still-blocking Esri/openAIP rights/credential/API gates. Added review reconciliation document and synchronized roadmap/feature plan. **No runtime changes or provider approval; no tests/build/deploy claimed.**
- At Filip's 9 October 2026 product reprioritization, drafted the **3.7.0 Maps & Aviation Layers** read-only Phase 0 inventory, technical contract and independent review handoff. Shifted the unimplemented Currency / monetary semantics workstream (#136) to 3.8.0, heterogeneous aircraft onboarding to 3.9.0 and aircraft sharing/recovery/scale to 3.10.0 while preserving their requirements and historical reservations. Updated ROADMAP, FEATURES, VERSIONING and the documentation index. **No runtime code, DB schema, certification/backup format, application package version or deployment changed; API/provider rights and design review remain pending.**

## 3.6.0 — 9 October 2026

### Saved-date / timezone semantics
- Completed P1.0 read-only discovery on `main@eafc347fe00e781f966cc328da67ec24e52c8287` and drafted the Phase 1 contract. Confirmed Prague-hard-coded saveable defaults in Manual New Flight, Aircraft Manager and Quick Add; a separate UTC fallback in FlightForm; raw timezone persistence in Settings; date-only authority for stored flight/rate dates; UTC authority for current GPS/FCL.050 server consumers; and backup/restore preservation of stored dates/settings.
- Independent P1.1 review returned **APPROVE WITH CHANGES**. Repository-specific recommendations were re-checked against the private actual repo before acceptance because the reviewer could not access it directly.
- Reconciled/froze the design before runtime work: strict `resolved / needs_configuration / unavailable` saveable-calendar result; server-authoritative named-timezone validation with raw numeric offsets rejected; mounted-form defaults stable across midnight/timezone changes; server-provided Manual Flight default replacing the client UTC fallback; explicit Quick Add rate/effective-date fail-closed rule; cross-timezone restore invariance; and production timezone-value census required before release.
- Completed the hidden-consumer audit relevant to #144: active GPS save/review paths use the `lib/kml.ts` UTC override or explicit `utcParts`; in-scope date inputs remain string-backed; rate selection remains date-only; CSV/XLS/print preserve stored flight dates without timezone conversion. Adjacent credential/recency/print current-date semantics are tracked separately as #258 rather than silently expanding this release.
- P1.1 is **DONE / REVIEW RECONCILED** and P1.2 is implementation-ready. Runtime implementation remains **NOT STARTED** at this documentation head. DB migration, historical backfill and portable-backup version bump remain N/A on current evidence.
- Started P1.2 implementation: added a strict named-timezone/date primitive and fail-closed per-user saveable-calendar resolver; retained the resilient display-only timezone helper unchanged; Settings now validates timezone at the server write boundary before account-setting persistence and surfaces a controlled invalid-timezone error; new unit/source-contract coverage includes DST and non-whole-hour zones. The existing Settings browser transaction case now also verifies an invalid timezone cannot partially persist unrelated account changes. Manual Flight/Aircraft/Quick Add consumer rewiring is not included yet. Verification pending.
- Closed P1.2 as **DONE / VERIFIED** and merged PR #259 to `main` as `445454b73bfad305264ed10ce74bc02335474c8c`. Exact implementation head `c38ac15a673f770c2ae8cd13a4b02a32c70188dd`, candidate `b8520903792d8af18f502469b028b3ab59c9c098bb47bf5bcbd42e5021fc13b5`, passed source-contract, TypeScript, aggregate **1419/1419**, build **41/41**, PostgreSQL **99/99**, and authoritative browser-risk **10/10** (5 desktop + 5 mobile, one worker); domain/scale N/A; no blocked evidence. FEATURES and DEVELOPMENT were reviewed and require no P1.2 capability/process change. P1.3 Manual Flight timezone default is now the next runtime milestone. Vercel production deployment `dpl_ALW8boy5UhafiGdymAxXkxGLi2Qv` for that merge reached **READY**. Public HTTP smoke was NOT RUN from the available environment.
- Started P1.3 Manual Flight timezone implementation: New Flight now resolves the strict user-calendar default server-side and passes it explicitly to FlightForm; the old Prague date in `getManualEntryDefaults()` and the client UTC `toISOString().slice(0,10)` fallback are removed as saveable-date authorities. New forms fail closed to an empty editable date with controlled configuration/unavailable guidance when automatic derivation is unavailable; Edit keeps the stored flight date; UTC flight-time semantics remain unchanged. Verification pending.
- Closed P1.3 as **DONE / VERIFIED** and merged PR #261 to `main` as `12b31ba6d837bdda17ae9e3d676ed9261ef816c7`. Exact implementation head `99babf404656f02cd3a07dcb53636a37d0eae9d5`, candidate `fa17f53001d3691fd510fa1b00049d47935e8b4cf39400b82c27ed38642a6b11`, passed source-contract, direct domain-unit, TypeScript, aggregate **1421/1421**, build **41/41**, PostgreSQL **99/99**, and authoritative browser-risk **10/10** (5 desktop + 5 mobile, one worker); scale N/A; no blocked evidence. P1.4 Aircraft/rate timezone defaults is now the next runtime milestone. Vercel production deployment `dpl_5ppQUbnQaTWqiVCJQ3RJ4oFfcbf6` for that merge reached **READY**. Public HTTP smoke was NOT RUN from the available environment.
- Started P1.4 Aircraft/rate timezone implementation: Aircraft Manager and Quick Add now receive the strict server-derived user calendar result; hard-coded Prague `today` constants are removed; new initial-rate and rate-history effective-date defaults come only from the resolved account timezone. Unresolved defaults remain empty instead of being guessed, visible rate dates stay manually editable, and Quick Add explains when an automatic rate date is unavailable. A positive initial hourly rate without a valid effective date now fails closed before the aircraft/rate transaction instead of silently dropping the historical rate. Existing rate history and date-only lookup semantics are unchanged. Verification pending.
- P1.4 planner pass initially failed closed because the development registry still owned `app/(protected)/database/` as `data-recovery`, while that module intentionally has no browser target ownership. Corrected the route ownership to `aircraft-airports` instead of weakening browser selection, and added planner regressions proving database page/actions select the approved aircraft browser targets without recovery-module blockers. Verification must be rerun on the new exact candidate. The `aircraft-airports` module now also requires PostgreSQL acceptance and carries `persistence-schema` risk so this ownership correction cannot weaken DB evidence for aircraft/rate mutations.
- Closed P1.4 as **DONE / VERIFIED** and merged PR #263 to `main` as `7920164f2e461cacbd99279488cc092ad3fc4674`. Exact implementation head `4caaae0e4e917f3d20f31db18096b1c953ff5559`, candidate `a67621e0618d2a847fef597f34ea7bf093781f572e4e55854f1ae1a6d3fdf952`, passed source-contract, direct domain-unit, TypeScript, aggregate **1427/1427**, build **41/41**, PostgreSQL **99/99**, and authoritative browser-risk **10/10** (5 desktop + 5 mobile, one worker); scale N/A; required evidence satisfied; blocked evidence none. FEATURES and DEVELOPMENT were reviewed and require no P1.4 capability/process change. P1.5 GPS/backup invariance and production timezone census is now active. Vercel production deployment `dpl_3q1Fj4kM1wKGsbXyVSJN14e77Nka` for that merge reached **READY**. Public HTTP smoke was NOT RUN from the available environment.

- Started P1.5 final invariance/closeout evidence: added regressions proving active GPS timestamp authority remains UTC/fail-closed, portable backup keeps flight/rate calendar dates literal, export/print do not reinterpret stored flight dates, and historical rate selection remains date-only. The dormant Prague `track-processing.localParts` helper is retained for backward compatibility but is not an authoritative active GPS path; deletion is deferred without exhaustive retirement proof. A read-only production census on 8 October 2026 found 5/5 users with settings, all five timezone values `Europe/Prague`, and zero missing/NULL/blank/invalid timezone configurations under the same Node 24 validation semantics. No production mutation was performed. P1.5 remains **ACTIVE / verification pending**; no runtime/schema/backfill/backup-format change is introduced by the evidence candidate.
- Reconciled independent P1.5 review: no timezone-semantic blocker found. Accepted the review's PostgreSQL-evidence concern and added an integration test proving PostgreSQL `json_populate_record` preserves flight/rate date-only values under both Pacific/Auckland and America/Los_Angeles session time zones, while source-contract assertions bind that behavior to the production exact-restore primitive. Optional cleanup suggestions (legacy helper naming/removal and export `date::text` hardening) remain deferred. Exact-candidate verification must be rerun because the candidate changed.
- Closed P1.5 and Phase 1 as **DONE / VERIFIED** on exact head `56e3b05620ee4c35693994e1e60276387a41fe97`, candidate `bd04725222af573ca986239dc168383a39e6c9da3809f8c8edd69dc51f78f988`: targeted P1.5 evidence **38/38 PASS**, TypeScript **PASS**, planner selected aggregate full-tests + PostgreSQL acceptance with no blockers, `verify:iterate` **PASS**, aggregate regression **1433/1433 PASS**, and PostgreSQL **100/100 PASS** including the cross-session-timezone date-only restore test. Build/scale/browser were correctly N/A; required `postgres-acceptance` was satisfied; blocked evidence none. FEATURES was reconciled to the implemented Phase 1 capability; DEVELOPMENT was reviewed unchanged.
- Final documentation-only closeout candidate `89514f05c9d1372b41c9d201e8935bd77e1cfdb78c01860714e8127e541be0ee` on head `d7fc026dbd8c0f4552ef5bec3a6a4870bfdb331f` returned `release_status=PASS` with every runtime/heavy gate correctly N/A, required evidence none and blocked evidence none. PR #265 then squash-merged to `main` as `d96aed69b9fee41550820a1d05666420bce4e9fb`; its Vercel production deployment was skipped/canceled by the development-only ignore guard because the merge changed only tests/documentation.
- Release candidate PR #266 advanced package/footer metadata to `3.6.0` and passed exact candidate `028ab691e12df14ebe79c2ce43ed284fcea21d25c7ac08f5c16ce43c9850e221` on head `32c3fa0dd1a5decd5dda7f0c0e67518f4e2da438`: source-contract and TypeScript PASS, aggregate regression **1433/1433 PASS**, production build **PASS (41/41 static pages)**, PostgreSQL/scale/browser correctly N/A, required `application-source-contract` satisfied and blocked evidence none. PR #266 squash-merged to `main` as `168bd029540474d6e806bf3e261fa855824b7c2a`; Vercel production deployment `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs` reached **READY** on that exact SHA and carries `fly-tally.com`; root and `/login` smoke returned **HTTP 200** from that deployment and the immediate checked runtime-error window contained no runtime errors. Product version is now **3.6.0** in production; schema remains v20, certification payload v8 and portable backup v13.

### Development / verification governance
- Added the 3.6.0 Phase 0 engineering-quality gate before any saved-date/timezone runtime implementation.
- Recorded and independently reviewed the current test/development audit, including the suite-wide PostgreSQL silent-skip exposure, test-scope registry drift, browser-runner reproducibility, browser-suite ownership and stale Git/PR hygiene.
- Started Phase 0A hardening: explicitly invoked PostgreSQL acceptance now owns the integration-test flag, rejects malformed or non-localhost database targets, preflights a real connection before test fanout, and supports an explicit `FLYTALLY_PSQL` path that is propagated to PostgreSQL/browser child processes when the client is installed outside `PATH`.
- Pinned Playwright Test 1.55.0 in repository dependencies, added an explicit authenticated browser gate, removed the ad-hoc manual-workflow runner install, and execute the pinned Playwright CLI directly through Node instead of a platform command wrapper.
- Hardened authenticated browser acceptance against current product contracts: certified test-fixture cleanup is local-only and transaction-scoped, GPS tests explicitly reopen auto-collapsing review sections and use the current first-split control before interaction, and obsolete pre-3.5.2 Night-definition browser expectations were replaced with the frozen always-on GPS/SERA behavior.
- Aligned the development/manual-workflow Node line to the production Vercel project's Node 24.x runtime.
- Corrected the browser PostgreSQL bootstrap timeout variable to `PGCONNECT_TIMEOUT`.
- Phase 0A gate-safety/reproducibility is verified locally: targeted governance **32/32 PASS**, PostgreSQL core **86/86 PASS**, PostgreSQL full **99/99 PASS**, TypeScript **PASS**, production build **PASS (41/41 static pages)**, authenticated browser acceptance **96 PASS / 2 intentional skips / 0 failed**, and the final corrected historical v1.44 source contract **5/5 PASS** after the preceding full suite proved the other 1,316 tests.
- Runtime product behavior is unchanged by this engineering-infrastructure work; FEATURES remains unchanged. Phase 0B risk-model / deterministic-selection work is now active.
- Phase 0B.1 registry convergence is verified: development risk/gate metadata and named targeted test groups share one v2 registry, CSS is UI/presentation instead of documentation, unknown runtime no longer invents PostgreSQL risk, and `test:ui` delegates to the registry-backed group runner rather than duplicating its 16-file list in package scripts. Verification: UI group **113/113 PASS**, TypeScript **PASS**, production build **PASS (41/41 static pages)**, full suite **1322/1323 PASS** with one stale documentation assertion, followed by the corrected development-pipeline file **12/12 PASS**.
- Phase 0B.2 stable ownership is verified: the audited 381-file app/components/lib runtime surface has **368 stable-owned files (96.6%)**, up from **121 (31.8%)**; the remaining **13** reviewed cross-cutting files are explicitly `shared-runtime` rather than guessed into a product domain. Verification: targeted scope/pipeline **28/28 PASS**, TypeScript **PASS**.
- Phase 0B.3 command convergence is verified: PostgreSQL scale-suite membership is single-sourced in the development registry, manual-cloud targeted verification executes the generic registry-backed `ui-contract` group, and DEVELOPMENT defines `scope:changed` as a planner with independent targeted/full/PostgreSQL/scale/browser/build gates. Verification: targeted scope/pipeline **29/29 PASS**, TypeScript **PASS**. Phase 0B is complete; Phase 0C browser-suite structure discovery/design is active.
- Phase 0C discovery inventoried the current authenticated browser architecture before refactor: the main spec is 2,053 lines/~127.6 kB with 48 logical tests and 25 browser-DB helper imports; two device projects still intentionally serialize through one mutable isolated PostgreSQL fixture. Draft 0C sequencing keeps one worker, splits helpers/spec ownership first, then removes only proven redundant device-project execution for tests that already own their viewport/theme matrices.
- Independent Phase 0C review returned **ACCEPT WITH CHANGES**. The reconciled plan adds a machine-checkable 0C.0 baseline, makes helper extraction deliberately minimal, keeps browser DB ownership centralized, splits into seven modest domains with full browser acceptance after each split batch, treats project×matrix deduplication as the highest-risk step, and keeps per-worker DB isolation out of scope.
- Added and verified the 0C.0 browser-suite baseline and structure contract: exact 48 logical test names, two-project/one-worker/retry invariants, centralized browser DB helper exports/fixture IDs/users, and required responsive/theme states. Verification: targeted structure/scope/pipeline **34/34 PASS**, TypeScript **PASS**.
- Phase 0C.1 minimal helper extraction is verified: only `expectNoHorizontalOverflow` and `loginBrowserPilot` moved into `e2e/browser-actions.mjs`; GPS/details/RoleCrew/request-hold helpers remain local, no tests moved, and browser DB/project/worker/retry behavior is unchanged. Verification: targeted structure/scope/pipeline **35/35 PASS**, TypeScript **PASS**, full authenticated browser **96 PASS / 2 intentional skips / 0 failed** in **4.9m**.
- Phase 0C.2 Batch 1 is verified: the four settings/connections mutation tests live in `e2e/settings-connections-mutations.spec.mjs` with unchanged names/assertions/fixture IDs. Verification: targeted structure/scope/pipeline **36/36 PASS**, TypeScript **PASS**, focused spec **8/8 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.8m**.
- Phase 0C.2 Batch 2 is verified: seven E1/Night/SERA advisory tests live in `e2e/advisory-presentation.spec.mjs`. Verification: targeted structure/scope/pipeline **37/37 PASS**, TypeScript **PASS**, focused advisory **14/14 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.7m**. The run again logged Windows/PostgreSQL shared-memory reservation warnings without a failing browser/persistence assertion; retain as a local-environment watch item if future failures correlate.
- Phase 0C.2 Batch 3 is verified: five Manual RoleCrew / verification / Safety Pilot PIC tests live in `e2e/manual-rolecrew-verification.spec.mjs` with unchanged names/assertions and centralized browser DB fixtures. Verification: targeted structure/scope/pipeline **38/38 PASS**, TypeScript **PASS**, focused spec **10/10 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **5.0m**. The recurring Windows/PostgreSQL shared-memory warning remains a local-environment watch item because it did not coincide with a failing assertion.
- Phase 0C.2 Batch 4 is verified: eight Manual aircraft-authority/certification tests live in `e2e/manual-authority-certification.spec.mjs` with unchanged names/assertions. Verification: targeted structure/scope/pipeline **39/39 PASS**, TypeScript **PASS**, focused spec **16/16 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.8m**.
- Phase 0C.2 Batch 5 is verified: nine broad responsive/theme matrix tests live in `e2e/responsive-presentation.spec.mjs` with unchanged names/assertions and F6 viewport/theme state labels. Verification: targeted structure/scope/pipeline **40/40 PASS**, TypeScript **PASS**, focused responsive spec **18/18 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **12.0m** on the second local PC. Its initial all-login failure was traced to missing local `SESSION_SECRET`, not a test assertion regression.
- Phase 0C.2 Batch 6 is verified: ten GPS functional acceptance tests and their GPS-only interaction helpers live in `e2e/gps-rolecrew.spec.mjs`; `e2e/public-shell.spec.mjs` contains exactly five public/auth/shell tests and no direct browser-DB/GPS helper ownership. Verification: targeted structure/scope/pipeline **41/41 PASS**, TypeScript **PASS**, focused GPS / RoleCrew **20/20 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **11.8m**. Phase 0C.2 domain splitting is complete.
- Started Phase 0C.2a helper-ownership reconciliation: generic `expectAuthenticatedRoute`, `ensureDetailsOpen`, and `holdPost` now have one shared home in `e2e/browser-actions.mjs`; shared GPS interaction helpers now live in domain-scoped `e2e/gps-actions.mjs`; local duplicates were removed from the consuming specs while presentation/shell-only helpers remain local. Source inventory remains **48 unique logical acceptance tests**. Verification is pending.
- Corrected the first 0C.2a candidate after focused Playwright discovery exposed a syntax-invalid stale `completeF43GpsPart` body tail in the GPS and responsive specs. Removed both tails and added a structure-gate `node --check` sweep for every `e2e/*.mjs` module so syntax-invalid browser modules fail before Playwright. Verification remains pending on the corrected head.
- Phase 0C.2a is verified on the corrected head: targeted structure/scope/pipeline **43/43 PASS** (including syntax checks for every `e2e/*.mjs`), TypeScript **PASS**, focused GPS **20/20 PASS**, focused responsive **18/18 PASS**, and full browser **96 PASS / 2 intentional skips / 0 failed** in **11.4m**.
- Started Phase 0C.3 proof-driven project×matrix deduplication: only four F6 tests that each own the complete viewport/theme matrix are tagged `@self-managed-presentation` and excluded from the Pixel 7 project via `grepInvert`; five narrower responsive tests retain both projects. Candidate keeps all 48 logical tests and targets 94 total full-gate executions instead of 98. Verification is pending.
- Phase 0C.3 is verified: targeted structure/scope/pipeline **44/44 PASS**, TypeScript **PASS**, focused responsive **14/14 PASS**, and full serialized browser acceptance with explicit retries=0 **92 PASS / 2 intentional skips / 0 failed** across **94 executions** in **10.3m**.
- Phase 0C.4 final acceptance is complete: all **48 unique logical browser tests** remain, fixture/reset identities and centralized `browser-db.mjs` are preserved, workers=1 remains, required presentation states remain evidenced, no product runtime/timezone/schema behavior changed, and per-worker DB isolation remains out of scope. Phase 0C is closed.
- Phase 0D independent review returned **ACCEPT WITH CHANGES**. The reconciled design keeps one development registry, separates risk/gate/evidence semantics, keeps build outside behavioral evidence, treats the full Node suite as aggregate regression only, and keeps `scope:changed` planner-only rather than fabricating observed test results.
- Started the Phase 0D evidence-taxonomy candidate: `development-modules.json` is schema v3 with four behavioral evidence classes; named `ui-contract` and `development-pipeline` groups are explicitly homogeneous application/source-contract groups; a JSON Schema contract and fail-closed evidence evaluator were added; `scope:changed` now reports required evidence, aggregate gates and build independently.
- Added negative evidence-contract regressions so source-contract PASS, aggregate `fullTests` PASS and build PASS cannot masquerade as domain/PostgreSQL/browser acceptance; required missing evidence reports NOT RUN, raw acceptance skips/retries prevent PASS, and explicit N/A cases remain distinguishable from skipped execution. Phase 0D verification is pending; no product runtime, DB schema, browser fixture architecture or timezone semantics changed.
- Phase 0D first full regression run exposed **14 stale source-contract assertions** left behind by the verified Phase 0C browser-spec split: the assertions still read `e2e/public-shell.spec.mjs` even though the covered browser behavior had moved to domain specs/helpers. The run itself was **1340/1354 PASS, 14 FAIL**; all failures were source-location drift, not browser/runtime execution failures. Retargeted those historical assertions to `browser-actions.mjs`, `settings-connections-mutations.spec.mjs`, `manual-rolecrew-verification.spec.mjs`, `manual-authority-certification.spec.mjs`, `responsive-presentation.spec.mjs`, and `advisory-presentation.spec.mjs`.
- Closed Phase 0D after correction verification on exact code head `686734911f5c3f45e395fdda6b7d98a5021e84ae`: development-pipeline **65/65 PASS**, TypeScript **PASS**, aggregate regression **1354/1354 PASS**, and production build **PASS** with **41/41** static pages. `domain-unit`, PostgreSQL acceptance and browser acceptance are **N/A** for this tooling/source-contract candidate under the frozen evidence taxonomy. Phase 0E canonical verification commands is now active.
- Started Phase 0E.1 canonical planner implementation: added explicit candidate-source parsing, content-aware candidate fingerprints, JSON/human `verify:plan` output, explicit planner `typecheck` selection, `--force-all` gate forcing without candidate expansion, and dedicated planner contract tests.
- Closed Phase 0E.1 after local exact-head verification on `34146fdc2cf8dc7645acfb1aea9de66078cd430a`: development-pipeline **72/72 PASS**, TypeScript **PASS**, aggregate regression **1361/1361 PASS**, production build **PASS (41/41 static pages)**, and canonical planner JSON smoke **PASS**. Phase 0E.2 available direct domain evidence is now active.
- Started Phase 0E.2: registered exact reviewed direct `domain-unit` evidence for all **10/10** current domain-risk modules, added pure aircraft-profile and professional-experience direct suites, added registry schema/selection enforcement, and extended `verify:plan` with module-scoped direct-domain tests plus fail-closed blocked-evidence reporting.
- Closed Phase 0E.2 after local exact-head verification on `3227bb587cd89a1d4d93cb8396b7a0388ebe4dc5`: development-pipeline **75/75 PASS**, dedicated direct-domain candidate **6/6 PASS**, TypeScript **PASS**, aggregate regression **1370/1370 PASS**, production build **PASS (41/41 static pages)**, and canonical direct-domain planner smoke **PASS** with no blocked evidence. Phase 0E.3 evidence ledger / canonical gate wrappers is now active.
- Started Phase 0E.3: added ignored candidate-bound verification ledgers; canonical `verify:app`, `verify:domain`, `verify:postgres`, browser-only `verify:browser`, and compatibility `verify:browser:with-build`; same-candidate Next build freshness enforcement; explicit browser N/A classification for the audit-capture exclusion; and registry risk mapping for the new PostgreSQL/browser harness wrappers. Verification is pending.
- First 0E.3 local verification attempt exposed two development-contract defects before heavy acceptance: one overly strict browser source assertion and TypeScript declaration errors caused by static `.mjs` imports in the new ledger test. Corrected both without product runtime changes and added a no-argument compatibility wrapper for legacy `npm run verify`; correction verification is pending.
- Corrected 0E.3 verification then passed development-pipeline **83/83**, TypeScript, aggregate regression **1378/1378**, production build **41/41**, and PostgreSQL full acceptance **99/99**. Full browser acceptance remained **FAIL** at **90 PASS / 2 FAIL / 2 intentional skips** (11.6 min); both failures were mobile-only and require focused reproduction before any test/runtime correction. Phase 0E.3 remains open.
- Focused mobile reruns of both browser failures passed independently with retries disabled. Added test-only synchronization hardening: explicit bounded post-save navigation wait for the GPS server action, and completion-state wait plus summary-scoped persistence assertions for Connection access. Full browser rerun is still required before 0E.3 can close.
- The synchronization correction passed a **6/6** targeted mobile repeat. `verify:app` remained green at **1378/1378** regression tests plus **41/41** build pages. The next full browser gate improved to **91 PASS / 1 FAIL / 2 intentional skips**; only the mobile F3.5 Quick Add status wait timed out. 0E.3 remains open and the next step is focused Quick Add reproduction, not another full matrix run.
- Isolated mobile F3.5 Quick Add then passed **5/5** with retries disabled, confirming suite-load timing. Hardened that browser test only: wait for the successful Quick Add dialog close and success notice with a bounded 15 s server-action window before proceeding. Product runtime remains unchanged.
- Product decision: the ~12-minute full 94-test browser matrix is removed from the normal development/Phase-0 closeout path. It remains available as a manual diagnostic, but targeted risk-owned browser checks will become the normal evidence path in 0E.4. 0E.3 requires only the cheap targeted Quick Add correction repeat; no unrun full-browser PASS will be claimed.
- Closed Phase 0E.3 after final targeted Quick Add correction **5/5 PASS** at retries=0/workers=1. Final 0E.3 evidence: development-pipeline **83/83 PASS**, planner PASS, direct-domain N/A for the tooling candidate, `verify:app` PASS with **1378/1378** aggregate regression + **41/41** build pages, PostgreSQL full **99/99 PASS**, and targeted browser correction evidence **11/11 PASS** across GPS, Connections and Quick Add. The legacy full browser matrix is **NOT RUN** after the policy change. Phase 0E.4 fast iteration / risk-based release orchestration is now active.
- Drafted the Phase 0E.4 fast-verification architecture: explicit registry-owned browser targets, fail-closed target selection, candidate-scoped `browser-risk` evidence, `verify:iterate`, exact-ledger reuse, risk-based `verify:release`, and preservation of the 94-test full browser command as manual diagnostics only. Implementation is pending independent review; no runtime/schema/timezone behavior changed.
- Phase 0E.4 independent review returned **ACCEPT WITH CHANGES**. Reconciled the design to keep legacy `verify:release` semantics unchanged, introduce `verify:release:risk`, machine-enforce browser-risk authority and exact selection/config/build/tool/fixture identity, fail closed on missing/stale/ambiguous browser ownership, and harden dirty/untracked candidate identity. 0E.4a implementation is active.
- Implemented the 0E.4a planning candidate: verification candidate/ledger schema v2 with dirty/untracked worktree identity; deterministic config/toolchain/browser-fixture contract hashes; registry schema for **41** exact risk-scoped browser targets; fail-closed browser target validation/selection and selection hashing; planner schema v2 browser-evidence output; and the correction that browser-required plans also require a production build artifact. Verification is pending; no new browser executor or release command is active yet.
- First 0E.4a local verification passed development-pipeline **91/91**, aggregate regression **1386/1386**, TypeScript and build **41/41**, but exposed generated local `test-results` / scale-evidence files as untracked candidate members. Added explicit ignores plus a regression test so generated verification artifacts no longer contaminate candidate identity. Final exact-head verification then passed at `4b14f34585f8d1653112e964ed4043c444dfe655`: clean worktree, development-pipeline **92/92**, aggregate regression **1387/1387**, TypeScript and build **41/41**, with planner candidate identity free of generated artifacts. 0E.4a is DONE / VERIFIED.
- Started 0E.4b fast iteration implementation: canonical source-contract execution/ledger, TypeScript ledger, exact candidate/config/toolchain reuse contract, planner source-evidence ownership and a separate `verify:iterate` command. Release/browser semantics remain unchanged; verification pending.
- 0E.4b candidate now runs/reuses only the cheap planner-selected source/domain/typecheck evidence and explicitly reports heavy aggregate/build/PostgreSQL/browser work as release **NOT EVALUATED**. Added `--rerun`, reserved/rejected `--with-browser` until 0E.4c, regression coverage for exact reuse/N/A reuse/docs-only iteration, and preserved the legacy `verify:release` command unchanged.
- Closed 0E.4b on exact candidate `d01813c978c63cd5fc14945fca9a310226d338d2`: first fast iteration development-pipeline **98/98 PASS** + TypeScript PASS, immediate exact-candidate repeat reused all cheap evidence, then `verify:app` passed TypeScript + aggregate regression **1393/1393** + production build **41/41**. PostgreSQL/browser were N/A for that tooling batch.
- Started 0E.4c risk-browser execution: planner-selected browser targets now have a dedicated `browser-risk` release-authority source, exact Playwright case identity/report schema, same-candidate build binding and an optional `verify:iterate --with-browser` path. The legacy full browser command is diagnostic only. Verification pending.
- First 0E.4c local run passed TypeScript, aggregate regression **1396/1396** and build **41/41**, then failed before browser execution with `No tests found`: the risk executor anchored `--grep` to the raw test title, but Playwright evaluates grep against its composed full title. Fixed the selector to use an escaped unanchored title fragment and retained exact post-execution `{spec,title,project}` equality as the authoritative completeness check. Fixed-head verification pending.
- Fresh-PC follow-up exposed a malformed edit in the new risk-title helper: development-pipeline reported **98/101 PASS** with all three failures caused by the same syntax error. Repaired the module, kept the full-title grep regression, and added `playwright-report/` to ignored/generated verification artifacts with candidate-identity regression coverage. Verification pending.
- Closed 0E.4c on exact head `9e9ec3a3d3cb70f43f3ea7b83e168edf174b2e6a`: development-pipeline **101/101 PASS**, authoritative browser-risk **41/41 PASS** (21 desktop + 20 mobile, retries=0, workers=1), TypeScript PASS, aggregate regression **1396/1396 PASS**, and production build **41/41 PASS**. PostgreSQL full was N/A for the 0E.4c browser-harness candidate; legacy 94-case browser remained NOT RUN by policy.
- Started 0E.4d release orchestration: added candidate-bound aggregate regression evidence, reusable build validation, config/toolchain-bound PostgreSQL evidence, conservative release-harness classification, and a new `verify:release:risk` command that reuses exact valid ledgers and evaluates one final evidence matrix. Existing `verify:release` semantics remain unchanged; verification pending.
- Closed 0E.4d and the 0E.4 fast-verification milestone on exact implementation candidate `7a8a98a587d0c2c80bac893ca0c50b24e86f06f0`: clean worktree, development-pipeline **109/109 PASS**, planner no blockers, iteration **222/222 PASS** with release correctly **NOT EVALUATED**, then `verify:release:risk` **PASS** with source/domain/typecheck exact-candidate reuse, aggregate regression **1404/1404 PASS**, production build **41/41 PASS**, PostgreSQL full **99/99 PASS**, browser-risk **41/41 PASS** (21 desktop + 20 mobile), scale N/A and no blocked evidence. The legacy 94-case browser diagnostic remained NOT RUN by policy and static `verify:release` remains unchanged. DEVELOPMENT/ROADMAP/detailed contract were reconciled; FEATURES was reviewed and remains unchanged because product capability/runtime did not change.
- Started Phase 0E.5 verification hardening: added direct negative coverage for ledger schema/gate/evidence/exit/config drift, candidate freshness for tracked dirty files outside explicit candidates, build-output freshness, browser-risk selection/config/toolchain/fixture/build freshness, and identity-input coverage. The small optional test seams in build/browser reuse preserve existing default runtime behavior; no product runtime, database schema, certification, backup or timezone semantics changed.
- Closed Phase 0E.5 on exact candidate `68351c78a0dac2b1f95de3530d2ceac116f2475e`: clean worktree, development-pipeline **113/113 PASS**, planner no blockers, iteration **226/226 PASS** + TypeScript PASS, aggregate regression **1408/1408 PASS**, production build **41/41 PASS**, authoritative browser-risk **41/41 PASS** (21 desktop + 20 mobile), PostgreSQL/scale N/A and final `release_status=PASS`.
- Started Phase 0E.6 manual-workflow alignment: DEVELOPMENT now names `verify:release:risk` as the canonical final candidate decision; manual GitHub workflow jobs are explicitly diagnostic, the Browser smoke workflow labels its repository-wide run as legacy/full diagnostic, stale pull-request-only job logic was removed, and regression coverage prevents those workflows from silently invoking candidate-bound release/browser-risk authority.
- First 0E.6 exact-candidate release attempt on `088aa71c6a8a43b48b40962c3eb667647d93d202` passed development-pipeline **113/113** and TypeScript, but aggregate regression stopped at **1406/1408** because two preserved v3.2 source-contract tests still asserted the superseded workflow labels `Chromium desktop + mobile` and `Application gate`. This was test-contract drift caused by the intentional diagnostic relabeling, not a product-runtime failure; both historical assertions were updated to the new explicit diagnostic labels and require targeted/release re-verification.
- Closed Phase 0E.6 on fixed head `734473252fe1acf64388fa15d9373777112d4977`: targeted historical workflow-label regressions **9/9 PASS**; `verify:release:risk` source PASS, domain N/A, TypeScript PASS, aggregate **1408/1408 PASS**, production build **41/41 PASS**, PostgreSQL/scale/browser N/A, no blocked evidence and final `release_status=PASS`.
- Started Phase 0E.7 exact-candidate closeout. The final Phase 0E verification boundary is the verified Phase 0D head `686734911f5c3f45e395fdda6b7d98a5021e84ae` through the final Phase 0E head; closeout will run `verify:release:risk --force-all` so all risk-scoped authoritative gates execute on one candidate. Legacy full browser remains diagnostic-only.
- First 0E.7 planner attempt correctly returned **NOT RUN** before execution because the cumulative Phase 0D → Phase 0E range includes `e2e/ui-audit-capture.spec.mjs`, which is explicitly diagnostic-only and has no authoritative browser target. The selector remains fail-closed; no target will be invented and the legacy full-browser diagnostic will not be promoted into release authority. Final 0E.7 closeout now uses verified 0E.5 head `68351c78a0dac2b1f95de3530d2ceac116f2475e` as the explicit base so the substantive 0E.6 alignment is reverified with `--force-all` while earlier milestones keep their own exact-candidate evidence.
- Closed Phase 0E.7 and Phase 0E on exact head `335704c1125ee0336528f5f1e43c3bc1528c92d3` / candidate `221190494ba79b32bb25f9e32c3ce09041dfd624f3f3a514cc8fb7a905c9477a`: `verify:release:risk --force-all` passed source-contract **226/226**, TypeScript, aggregate **1408/1408**, build **41/41**, PostgreSQL full **99/99**, scale, and authoritative browser-risk **41/41** (21 desktop + 20 mobile); domain was N/A, blocked evidence none, final `release_status=PASS`. Legacy 94-case browser remained diagnostic-only / NOT RUN. FEATURES was reviewed and unchanged. Phase 0F hygiene/closeout is now active.
- Verified the final Phase 0E documentation-only reconciliation on head `2969fae73e151044f0a2e6962d7abd57e8983da9`, candidate `dc3edcbb35b218aa2aceccafd139cf8187c86b0d3f8318937865f75a6694c732`: `release_status=PASS`, all behavioral/heavy gates N/A, required evidence none, blocked evidence none.
- Phase 0F discovery reconciled DEVELOPMENT against executable commands and audited repository hygiene. Seven historical branches are proven ancestors of `main`; five older open feature PRs (#187/#201/#206/#231/#232) are diverged/non-mergeable and remain untouched pending explicit supersession proof. PR #255 remains the active Phase 0 integration PR.
- Phase 0F supersession review proved all five stale parallel PRs obsolete and closed them without merge: #187 was replaced by merged #188/F0.1, #201 by merged #200/F1.4, #206 by merged #207/F2.2, and #231/#232 by the final F3.3 head `065896d3c9aa75fee8c2c0c7cc7a2f6abc20e52a` plus later F3.4/F3.5 stack already ancestral to `main`. No historical branch was deleted; the explicit pre-F3 rollback anchor is retained.
- Closed Phase 0F and Phase 0 on exact head `68ba83167c27e6de1e1027e007ea3b81acad17cc`, candidate `792ef0f2c8430a01f4bb1e24474b05991d0a83abee63650b7d72b8cb274892df`: `verify:release:risk` returned PASS with source/domain/typecheck/aggregate/build/PostgreSQL/scale/browser all correctly N/A, required evidence none and blocked evidence none. FEATURES was reviewed and unchanged. PR #255 integration into `main` remains the only repository action before Phase 1 timezone runtime work.
- Merged Phase 0 PR #255 into canonical `main` as `2238d0e1a645a4f9b584b291ecc12fbf8a2ee230`. Vercel production deployment `dpl_3hb8gebeWMYcxJWdsDmn6vumhK5f` reached **READY** and carries the `fly-tally.com` alias. External public HTTP smoke was NOT RUN from the available web-fetch surface. Phase 1 saved-date/timezone work is now ACTIVE for discovery/design; runtime code remains blocked until its contract is frozen.

### Print / PDF
- Hid the keyboard accessibility `Skip to content` link from printed logbook and Save-as-PDF output while preserving it in the interactive app.
- Added a source regression guard so the accessibility link cannot silently reappear in print output.

## 3.5.5 — 7 October 2026

### iPad sidebar collapse-control alignment
- Reworked the coarse-pointer collapse chevron into a dedicated 44 px sidebar-edge handle, separate from the logo and notification controls.
- Centers the handle vertically in the viewport and tracks the expanded/collapsed sidebar width so it stays attached to the rail in both states.
- The first production placement from PR #252 was visually rejected on iPad and intentionally superseded rather than treated as accepted.
- Corrective exact-head local gate before the final production fix: targeted **17/17 PASS**, TypeScript **PASS**, full unit/regression **1308/1308 PASS**, production build **PASS** with 41/41 static pages.
- PR #253 squash-merged to `main` as `ec75388ab437218086ef4fb86d1d53648fb77dbe`; Vercel production deployment `dpl_4NbxFjAa6dJyQn1VdiSwf4wndiUW` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- Production iPad visual acceptance confirmed the final centered edge-handle placement is accepted.
- Scope is presentation-only: sidebar state, notifications, routes and mobile navigation semantics are unchanged.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.

## 3.5.4 — 7 October 2026

### iPad flight-detail visual hotfix
- Keeps Back / Previous / Next / More together on wider iPad/desktop flight-detail headers instead of allowing only **More** to wrap onto a second line.
- Reflows the whole flight-detail header navigation below the flight identity on narrower tablet widths.
- Fully hides the keyboard **Skip to content** link until focus so its focus-colored border cannot leak into the iPad safe area.
- Final local gate: targeted **21/21 PASS**, TypeScript **PASS**, full unit/regression **1305/1305 PASS**, production build **PASS** with 41/41 static pages.
- PR #251 squash-merged to `main` as `8ed7567ca3f1f2ffb2834ecca0f29359bbd330c6`; Vercel production deployment `dpl_BceR2z3B27eXwnFuNzDL3AugQNjc` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- Production iPad visual acceptance confirmed the two targeted defects are resolved.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.

## 3.5.3 — 7 October 2026

### Flight detail navigation UX
- Reworked the existing flight-detail navigation into an obvious **Back to flights** control plus explicit **Previous flight** / **Next flight** controls.
- Previous/Next continue to use the existing filter-aware server navigation and preserve the active Flights query context.
- Boundary directions remain visible but disabled instead of disappearing, keeping the navigation layout stable.
- Mobile gives Back its own row and keeps Previous/Next in a two-column row without horizontal core-navigation scrolling.
- Final pre-merge local gate: targeted **18/18 PASS**, TypeScript **PASS**, full unit/regression **1302/1302 PASS**, production build **PASS** with 41/41 static pages.
- PR #250 squash-merged to `main` as `7068c5f03a3bf5b05ef5f0b45793db54848b9c9e`; Vercel production deployment `dpl_5w2vFSXpSbVEruqcP8mzjXRLuqag` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.
- Post-deploy iPad visual review found two presentation-only defects (More wrapping and a hidden skip-link safe-area border fragment); corrective scope is isolated in 3.5.4.

## 3.5.2 — 7 October 2026

### Always-on GPS/SERA Night suggestions
- Removed the account-level **Night definition** selector from Settings; GPS/SERA Night suggestion behavior is no longer user-toggleable.
- GPS import now attempts the existing SERA Day/Night landing split and conservative Night-time suggestion automatically whenever the canonical flight context supports those fields.
- Preserved the existing civil-twilight calculation and fail-closed evidence contract: -6° geometric boundary, ±0.5° confidence guard, explicit UTC/offset evidence, sparse-gap/track-integrity rejection, sticky pilot edits and manual fallback when exact GPS evidence is unavailable.
- IFR remains manual. Legacy stored `night_definition` values are ignored by active flight-entry behavior; no DB migration, certification-payload change or historical-flight rewrite was introduced.
- Added/reconciled source regression coverage for the removed Settings switch, always-on applicability gating and sticky manual Day/Night/Night-time edits.
- Final exact-head local verification: targeted 3.5.2 / 3.4.1 / E2 GPS contract **24/24 PASS**, TypeScript **PASS**, full unit/regression **1298/1298 PASS**, production build **PASS** with 41/41 static pages.
- PR #248 squash-merged to `main` as `60be6fd23f283302dadc7a3d611a19ff0bc8ebf3`; Vercel production deployment `dpl_4pyJEv2pjWQLNcmNPpFYcjsf3PHj` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the checked immediate runtime-error window was clean.
- PostgreSQL migration **N/A**; production schema remains v20, certification payload v8 and portable backup v13.

## 3.5.1 — 7 October 2026

### GPS touch-and-go reliability
- Tightened advisory GPS touch-and-go inference against three reproduced real-track false positives without adding a new auto-counted T&G path.
- Rolling-altitude T&G now requires post-minimum climb evidence beyond a single timed altitude edge; the existing 28–145 km/h rolling-speed range, 30 m altitude evidence and 25 m/s gross-discontinuity guard remain unchanged.
- Short speed/ground events are no longer accepted as T&G when direct event motion exceeds the existing 145 km/h rolling ceiling or usable altitude changes by at least 30 m during the alleged ground interval.
- Takeoff inference, shared ground-stop split detection, the public T&G DTO, database schema, certification data and historical flights are unchanged.
- Added anonymized real-derived regressions for the level-shift false event, climb-out sawtooth false event and duplicate/stale-fix false HIGH event, plus positive controls for five rolling T&Gs and a genuine stop-and-go.
- The separate real T&G missed near 15:59 remains intentionally non-auto-counted: new evidence proves the current ±10-array-point qualification window is defective, but that event also crosses gross-corrupt approach altitude evidence. Time-normalized qualification and an evidence-limited non-counted review tier remain separate unnumbered research rather than weakening fail-closed behavior.
- Local isolated verification on the feature branch: targeted 3.5.1 **6/6 PASS**, focused GPS/track corpus **62/62 PASS**, full unit/regression **1297/1297 PASS**, TypeScript **PASS**, production build **PASS** with 41/41 static pages. PostgreSQL and browser acceptance are **N/A / NOT RUN** for this pure track-inference change; no DB or UI runtime contract changed.
- PR #245 merged to `main` as `230d835a9e4c3fddb02bf7b729242632626cb9a7`; Vercel production deployment `dpl_AGLoght4FF1khhviPaZvMu5SZ2oT` is READY on that exact SHA, carries `fly-tally.com`, returned HTTP 200 on the root/login smoke surface, and had no grouped runtime errors in the checked post-deploy window.


## 3.5.0 — 7 October 2026

### Certified flight voiding + multi-aircraft integrity
- Certified flight voiding: owners can remove an incorrectly certified flight from active-logbook use while preserving immutable certification and audit evidence.
- Permanent void audit: the original certified snapshot, certification fingerprint and revisions, verification evidence, void actor/time and mandatory reason are retained.
- Collaboration safety: public shares are revoked, pending source workflows are superseded, and independently owned participant copies remain intact with permanent source provenance.
- Backup/restore v13: protected void and provenance history is portable as authenticated history-only evidence and cannot silently resurrect an active certified flight.
- Multi-aircraft integrity audit: historical regulatory facts remain flight-snapshot authoritative; production census found no malformed or legacy Part-FCL override state requiring a runtime compatibility layer.
- Database schema v20: permanent void archive/provenance protections were deployed with preflight, recovery branch, reconciliation and postflight verification.
- Production verification: final local gate passed 1289/1289 unit/regression and 99/99 PostgreSQL integration+scale; authenticated certified-voiding acceptance passed desktop/mobile 2/2; production deployment reached READY and immediate runtime-error check is clear.

### Detailed implementation record
- Froze the archive+delete model after independent review: certified flights will be removable from all active logbook consumers while permanent certification/audit evidence remains.
- Started schema v20 with a permanent certified-void tombstone, protected revision/verification archive tables, typed dependent-evidence archive rows, accepted participant-copy provenance, same-transaction certified DELETE authorization and active/tombstone coexistence protection.
- Added source-level and PostgreSQL acceptance coverage for migration v20, archive immutability, participant provenance, direct-delete rejection, same-transaction deletion and certified-correction compatibility.
- Repository reconciliation corrected the portable-backup baseline: current exports are v12 with server authenticity; certified-void archive support is therefore reserved for portable backup v13.
- M2 now includes the canonical authenticated atomic void mutation: exact-row optimistic locking, permanent evidence archiving, pending workflow supersession, public-share revocation, participant-copy provenance binding, active revision/track removal, final evidence-count-gated flight deletion, recency refresh and active-view invalidation.
- Shared-flight materialization now persists source provenance before an accepted participant copy is linked.
- Added the certified-flight removal UX and dedicated immutable void-audit route, including mandatory reason, duplicate-submit protection, active-logbook exclusion warning, success-to-audit link, and legacy audit-link fallback.
- Added authenticated browser acceptance that creates and certifies a real test flight, removes it via the UI, verifies active-logbook disappearance and permanent tombstone/audit retention, and runs in both desktop and mobile Chromium.
- First browser execution correctly exposed an unsupported `track_points` assumption in the new void service. FlyTally has no such canonical table; GPS evidence is stored completely on `flight_tracks`, so the runtime/schema/tests were corrected to archive only the real persisted source.
- Second browser execution reached the real void flow without the prior database exception but did not leave the current flight-detail URL. Completion is now redirected server-side after successful mutation, and the browser test proves database deletion/tombstone creation before checking navigation.
- Third browser execution exposed a test sequencing race: the test read PostgreSQL before the asynchronous Server Action had an authoritative completion state. It now waits for server redirect or a surfaced action error before asserting database state.
- Fourth browser execution showed the mobile void path reached successful deletion/tombstone/redirect assertions; remaining failures were caused by a transient certification-banner dependency on desktop and a broad date/registration list selector that matched the failed desktop fixture. The acceptance test now uses durable certified state and exact flight-id disappearance.
- Final M2/M3 browser acceptance passed **2/2** across desktop and mobile Chromium, proving certified-flight removal, active-row exclusion, permanent tombstone/audit retention and legacy-audit redirect end to end.
- Portable backup format v13 is implemented pending verification: signed backups include permanent void/provenance history, exact restore is history-only and conflict-guarded, legacy v4–v12 `track_points` remains parser-compatible without current-schema queries, and participant source provenance is append-only.
- Backup v13 implementation is present and awaits verification; schema v20 is **not applied to production**.
- First M4 verification run failed on typed recovery-conflict wiring and stale test assumptions; these were corrected on the feature branch.
- Second M4 gate on `25d73e6`: TypeScript PASS and production build PASS; unit/regression was **1259/1273 PASS** with 14 failures traced to historical source-contract drift plus one Node direct-import alias in `void-evidence.ts`. PostgreSQL did **not execute** because the shell had no `DATABASE_URL` (all 93 integration cases failed setup). Follow-up corrections update historical assertions to v13/schema-v20/current-roadmap semantics, keep legacy `track_points` parser compatibility explicit, and make the void-evidence helper directly Node-testable.
- Third M4 gate on `e311a4e`: TypeScript PASS; unit/regression **1280/1280 PASS**; production build PASS. PostgreSQL core executed after restoring local `psql` access and reached **82/85 PASS**. The three failures were acceptance-fixture drift: the certification fixture loaded the v20 protection function without creating its referenced `voided_certified_flights` table, while the E2 migration-19 helper accidentally parsed migration 20 blocks because its end marker still targeted the global `throw`. Follow-up fixes make both fixtures version-bounded without weakening runtime contracts.
- Final M4 PostgreSQL rerun on `7d18fb9`: TypeScript **PASS** and PostgreSQL core **85/85 PASS**. All v13 history-restore, archive immutability, resurrection/conflict, certified-delete, migration-19, participant-provenance and correction-compatibility acceptance cases passed. Because `7d18fb9` changed only PostgreSQL acceptance fixtures and documentation after the `e311a4e` runtime gate, the existing **1280/1280 unit/regression PASS** and production build PASS remain the runtime-code evidence for M4. M4 is therefore **VERIFIED LOCAL**. No production migration/deploy occurred.
- M5A consumer audit found that workflow notification rows outlive source participation/approval rows by design. Certified voiding now prevents stale inbox links: owner notifications that pointed at the removed source flight/audit are redirected to the permanent void-audit route, and recipient `/connections/shared/*` / `/connections/flight/*` links tied to the removed source are cleared before cascade. Notification text/history remains intact and is not promoted to protected certification evidence.
- M5A verification on exact head `bb3fcd2`: TypeScript **PASS**; targeted consumer/domain contract **13/13 PASS**; full unit/regression **1285/1285 PASS**; production build **PASS**. M5A is **VERIFIED LOCAL**.
- M5B adds isolated PostgreSQL collaboration acceptance proving that a void transaction can archive live collaboration evidence, supersede pending work, revoke the public share, redirect/neutralize notification links before cascade, preserve an accepted participant-owned flight, bind its immutable provenance to the tombstone, and remove the source-side live workflow rows.
- M5B verification on exact head `efd9b62`: PostgreSQL core **86/86 PASS**, including the new collaboration teardown acceptance. M5B is **VERIFIED LOCAL**.
- M5C extends the existing authenticated desktop/mobile certified-void browser acceptance: after void, the source is absent from the active flight list, the permanent audit remains reachable, the legacy active-flight audit URL redirects to that audit, and retained owner notification history opens the permanent audit instead of a dead source-flight route.
- M5C browser execution reached the actual certified-void flow. An initial fully configured run passed desktop and exposed only a serialized test-notification collision on mobile; the fixture was isolated without changing runtime behavior. Final rerun on exact head `a423239` passed **2/2** across desktop and mobile Chromium, including certified removal, active-logbook exclusion, permanent audit retention, legacy audit redirect, and retained owner-notification navigation to the permanent audit. M5 is **VERIFIED LOCAL**.
- Phase 1 M6 local release gate on exact head `a2d3f65` is green: TypeScript PASS; full unit/regression **1285/1285 PASS**; full PostgreSQL integration + retained scale fixtures **99/99 PASS**; production Next.js build PASS. GitHub CI is **NOT RUN — local-first policy**. No production migration or deployment occurred; `3.5.0` remains unreleased while Phase 2 of the canonical combined scope proceeds.
- Phase 2 discovery found that historical regulatory category/class/type consumers are already flight-snapshot based; the remaining deliberate current-profile dependency is the effective-dated Annex-I/ULL `part_fcl_credit_class/basis/from` tuple used by aeroplane recency and its evidence audit. The current profile validator requires complete provenance, while the evaluator still accepts older class-only metadata; this compatibility boundary is frozen for independent review before runtime changes.
- Added a characterization-only Phase 2 suite that freezes the consumer census, Manual/GPS PROFILE + SNAPSHOT boundaries, and the legacy class-only explicit-credit behavior before any regulatory runtime change. Initial suite **4/4 PASS** on exact head `69310a3`.
- Independent review accepted the snapshot/external-applicability split and the default no-migration/no-certification-change direction, but correctly required a bounded compatibility rule before legacy eligibility is widened. Repository-history reconciliation then found an important correction to the review handoff: v1.51.3 UI/engine copy described override basis/from as optional, but the server-side Aircraft Add/Edit action still required both whenever an explicit class was persisted. Exact restore remained intentionally outside current profile validation. An unverified draft compatibility batch was therefore superseded before local verification and runtime returned to the verified `69310a3` characterization state.
- Phase 2 production census completed read-only on the production Primary branch / `neondb`: **25 aircraft profiles, all `NONE`**, 25 active / 0 inactive, 295 saved flights and 36 certified ULL flights; zero complete overrides, partial tuples, orphan metadata, invalid dates or invalid classes. Production schema remains **v19**. Decision: no Phase 2 runtime compatibility layer, no schema v21 and no certification-version change. The census tooling was corrected after its first operator run exposed a malformed SQL regex literal; the corrected query was executed successfully before documenting the result.
- Canonical 3.5 final local gate on exact head `f0a1f1a` passed: TypeScript PASS; unit/regression **1289/1289 PASS**; full PostgreSQL integration + scale **99/99 PASS**; production build PASS. GitHub CI is **NOT RUN — local-first policy**.
- Added explicit v20 production deployment tooling: strict read-only v19 preflight, transactionally locked migration mirroring the runtime v20 DDL, idempotent post-deploy participant-provenance reconciliation to close the old-runtime/deploy window, and read-only v20 postflight verification. Tooling source verification on `eddbfb5` is **10/10 PASS** with TypeScript PASS; no production write has been performed.
- Reconciled the unreleased candidate package/app-visible version to **3.5.0** in `package.json` and `package-lock.json`, consistent with the canonical versioning policy. Candidate metadata verification on exact head `c0daa46` is **5/5 PASS** and production build PASS with 41/41 static pages generated.
- Production v20 preflight completed **read-only** on 7 October 2026 against Primary/`neondb`: transaction read-only ON; exact registry v1..v19; no partial v20 objects; 295 flights / 95 certified flights / 56 certified revisions; 16 participations / 11 accepted; **7** clean provenance backfill candidates; all preflight integrity guards passed.
- After explicit approval, created pre-migration Neon branch `pre-v20-2026-10-07` (`br-dry-moon-b1n30x0b`) at the production pre-write LSN, then applied the exact transactionally guarded schema-v20 migration to production. Immediate read-only postflight PASS: exact registry v1..v20; **7/7** participant provenance rows; 295 flights, 95 certified flights, 56 certified revisions, 5 verifications, 16 participations / 11 accepted, 8 deleted-flight rows; zero voided-flight/archive rows. Production app runtime is still 3.4.1; deploy, post-deploy provenance reconciliation, final postflight and smoke remain pending.


## 3.4.1 — 6 October 2026

### GPS Night-time reliability
- Opened a narrow production-correction follow-up after GPS review showed a NIGHT landing suggestion while Night time remained unavailable/manual.
- Added structured Night-time unavailable reasons and concise GPS-review explanation while preserving manual editable Night time and manual-only IFR.
- Reused the canonical GPS position-discontinuity thresholds from track processing rather than creating a second quality model.
- Final correctness review rejected the attempted >600 s same-state proof: endpoint displacement/quality does not prove the unobserved intermediate path. Sparse segments above the existing 600 s direct-interpolation guard therefore remain fail-closed with `SEGMENT_GAP_TOO_LARGE`.
- Hardened equal-time conflicting positions, non-monotonic/ambiguous timestamps, unsupported solar envelope and twilight-confidence cases to explicit fail-closed reasons.
- Added a real-like EHAM → LKPR regression that preserves the valid distinction between a confidently NIGHT landing event and unavailable exact Night time when an earlier sparse gap prevents a complete total; partial/lower-bound values are never auto-applied.
- Added the frozen single-phase contract at `docs/product/3_4_1_GPS_NIGHT_TIME_RELIABILITY.md`. No DB migration, certification-version change or historical-record rewrite is part of 3.4.1.
- Added authenticated browser coverage for the sparse-gap fallback: automatic Night time stays blank with an explicit reason, and a pilot-entered manual value remains sticky.
- Final local runtime candidate verification: TypeScript PASS, full unit/regression suite **1238/1238 PASS**, production Next.js build PASS, and targeted authenticated sparse-gap browser acceptance **2/2 PASS** across desktop and mobile Chromium.
- Release verification also reconciled stale repository contract tests with the already-adopted manual-only GitHub Actions policy, browser fixture schema v19, the compact 3.4 certification summary, and the 3.4.1 roadmap state; the manual Verify workflow is now self-contained instead of depending on pull-request event fields.
- PR #241 merged to `main` as `b3e1de097b6d16cdaa96082d281602a2765b8ae0`; production deployment `dpl_3911vZiDAFduLhsPbyMnB1YtHKwn` is READY on that exact SHA, carries `fly-tally.com`, returned HTTP 200 on the public smoke surface, and had no grouped runtime errors in the checked post-deploy window.

## 3.4.0 — 5 October 2026

### Flight Entry Simplification
- Local release verification now includes TypeScript PASS, 1230/1230 unit/regression PASS, 73/73 PostgreSQL core PASS, production build PASS, 13/13 targeted 3.4.0 contract PASS, 6/6 targeted authenticated desktop/mobile Playwright PASS, and a focused responsive Flight Entry smoke **1/1 PASS** covering desktop 1440, iPad landscape, iPad portrait and mobile 390 in light + dark. GitHub CI is intentionally NOT RUN under the local-first policy.
- Switched repository verification to local-first release gating; GitHub Verify and Browser Smoke are now manual-only diagnostics rather than automatic PR/release requirements.
- Simplified the GPS import hierarchy: clean single-flight track review collapses by default, multi-flight/ambiguous/warned track review stays surfaced, and redundant clean-quality status copy was removed.
- Reduced primary GPS Flight context to aircraft/regulatory basis/role/applicable operation-engine; Billing and Cost share now live in a separate collapsed Costs disclosure while invalid stored billing still blocks save.
- Replaced generic GPS reviewed-state UX with deterministic evidence readiness plus targeted GPS-quality acknowledgement; incomplete imports navigate to the first unresolved flight card.
- Multi-flight GPS remains draft-only and atomic; direct batch certification is not introduced by these changes.
- Added explicit same-page **Save draft** and **Save & certify flight** completion for eligible single Manual and GPS entries. Certification always re-reads the persisted row and reuses the existing v8 compliance/hash authority. Flight-detail readiness/blocker UI now uses that same category-aware certification compliance contract instead of the old Part-FCL-only blocker view.
- Added compact pre-certification summaries for the evidence being sealed, draft fallback messaging when certification is blocked/deferred, and draft-first implicit/Enter-key behavior. The completion summary was then flattened to four concise evidence groups instead of another nested card grid.
- Updated authenticated browser coverage for the removed generic GPS review checkbox and added direct Manual/GPS certification, Enter-to-draft, multi-flight draft-only, and targeted GPS-quality acknowledgement acceptance cases.

### Documentation / versioning governance
- Standardized future product releases and ROADMAP targets on numeric `MAJOR.MINOR.PATCH` versions; 3.4.0 is now the first canonical unified production release after the one-time reconciliation jump from 2.7.0.
- New implementation phases use numeric Phase 1 / Phase 2 / … naming rather than new E/F/B/SP/M milestone families.
- Database schema, certification payload and backup-format versions remain independent technical counters.
- Added the 3.4.0 design/review-reconciliation contract and numeric forward release sequence.
- PR #240 merged as `76b57c5674ffcc8c62bfbe73c59974cfde341a7a`; production deployment `dpl_3Zcyq7QmdSGPj1AcSHe2gj2Rn29r` is READY on that exact SHA and carries `fly-tally.com`.
- Post-deploy runtime logs show successful 200 responses across authenticated dashboard/flight routes, and the checked runtime-error window contained no grouped errors.
- Production DB remains schema v19 and certification payload remains v8; 3.4.0 introduced no schema migration or historical flight/certification rewrite.

## Legacy unversioned development / production history — through 4 October 2026

### Flight Entry E2 — production verified
- Hardened advisory take-off anomaly locality around corrupt GPS transitions while preserving discontinuity warnings and editable GPS-derived values.
- Added nullable aircraft `default_engine_type = SE | ME | NULL` with no historical backfill; unambiguous catalogue engine count may suggest a value but does not become authority.
- Extended explicit SERA Day/Night handling to supported ULL GPS review, added conservative GPS Night-time suggestion, kept IFR always pilot-entered, and made FCL.060 PF movement evidence optional/fail-closed.
- Final PR #238 CI passed: Verify #1141 — TypeScript PASS, **1208/1208** unit/regression, PostgreSQL **86/86**; Browser #514 — production build PASS, **84/84** with 2 intentional skips.
- Production v19 preflight proved exact v1–v18/no partial state; v19 migration committed successfully; postflight proved nullable/no-default engine column, validated NULL/SE/ME constraint, **0** backfilled defaults, unchanged baseline data counts and exact registry v1–v19.
- PR #238 merged as `ba2b4324f1f9ae84161ec86e82fc13d268938160`; production deployment `dpl_FsVYmDgJ2b3KNx4Yhd9jPsLJkvYc` is READY on that SHA, aliases `fly-tally.com` with no alias error, and immediate runtime-error check found none.
- No historical flight, certification, audit, recovery or aircraft-default backfill mutation was performed.


### Development workflow governance
- Adopted a risk-based verification cadence in `DEVELOPMENT.md`: targeted tests during iteration, subsystem-specific evidence at milestones, one complete local release gate for the final candidate, independent PR CI, and production-only preflight/postflight/smoke during closeout.
- Heavy PostgreSQL, authenticated browser and scale suites are no longer repeated after every small edit by default. Documentation/stale-source-guard corrections after an already-valid full gate require targeted re-verification unless they change runtime, persistence/schema, auth/security, certification/recency, or performance-critical behaviour.
- This is a development-process change only; product scope, ROADMAP priority and FEATURES capability inventory are unchanged.


### Flight Entry Follow-up E1 — discovery/design
- Production-use follow-up audit opened after Flight Entry Workflow 3.0 production closeout.
- Confirmed Manual New currently uses a generic SP fallback for `operation_type`, while GPS intentionally requires explicit SP/MP and clears the value on aircraft change.
- Confirmed aircraft profiles already persist default Role/billing but have no Operation default.
- Confirmed GPS Common details currently submit `Task = GPS import`.
- Confirmed `task` is included in the flight certification payload from certification v1 onward; certified rows therefore cannot be bulk-cleared by raw SQL without invalidating audit/integrity semantics.
- Confirmed GPS review already has detected T&G/final-landing event indices with UTC timestamps and track coordinates; the airport catalogue also has worldwide lat/lon/country.
- Confirmed Intelligent Logbook continuation/return assistance is portalled inside individual Route field labels, explaining the observed Departure/Arrival misalignment.
- Added E1 design and independent-review handoff.
- Independent review returned **APPROVE WITH CHANGES**. Accepted: certified Task correction contract, explicit Operation propagation/validation, route a11y, event-coordinate precedence and jurisdiction/provenance copy. Rejected one reviewer premise after authoritative verification: civil twilight remains the geometric solar-centre -6° boundary; sunrise/sunset refraction/solar-disc offset is not applied to civil twilight.
- E1.1 implementation: Intelligent `Continue from…` / `Return to…` suggestions now render in a dedicated `aria-live="polite"` full-width row below both Route fields instead of inside one label; the action remains an explicit keyboard-focusable button.
- E1.1 implementation: GPS Common details no longer expose or default `Task = GPS import`; new GPS imports submit an empty Task. Manual/Edit Task remains unchanged. Historical rows were **not** mutated.
- Added focused source contracts and authenticated browser route-alignment coverage. E1.1 local verification: targeted **30/30 PASS**, TypeScript PASS, production build PASS and authenticated browser **3/3 PASS**. E1.1 is DONE / LOCAL VERIFIED.
- E1.2 implementation staged schema v18 `aircraft.default_operation_type` as nullable `SP | MP | NULL` with a database CHECK constraint and **no aircraft-profile backfill**.
- Aircraft Add/Edit and Quick Add now expose optional Default operation; persistence validates and verifies the saved value. New Manual/GPS flight entry receives the profile default only as a prefill and the per-flight Operation remains editable.
- Manual New no longer silently normalizes a missing applicable Operation to SP: an incomplete draft may preserve `operation_type=''`, while existing FCL.050 certification remains fail-closed unless SP/MP is explicitly recorded. The existing `flights.operation_type` column and certification payload/version are unchanged.
- GPS still requires an explicit resolved SP/MP before Save; a profile default may preselect the control but does not bypass the server requirement.
- Aircraft sharing carries the default as part of optional Flight defaults. Legacy pending shares that predate the field preserve an existing recipient default rather than silently clearing it; a new share with an explicitly blank default can clear it to NULL when Flight defaults are imported.
- Account backup/restore remains exact through schema-aware `SELECT *` + `json_populate_record` after migration v18. Unknown imported defaults fail closed via parser/database constraint.
- Added focused E1.2 source/domain tests, PostgreSQL migration acceptance and authenticated Manual/GPS browser proof. Local verification completed: targeted **54/54 PASS**, focused migration regression **5/5 PASS**, TypeScript PASS, PostgreSQL acceptance **2/2 PASS**, production build PASS and authenticated browser **4/4 PASS**. Browser verification also exposed a pre-existing branch regression in migration 17 (`AS $` instead of `AS $$`); the dollar quote was restored and a source regression guard added. E1.2 is **DONE / LOCAL VERIFIED**. Production migration v18 remains **NOT APPLIED**.
- E1.3 discovery mapped the existing GPS evidence path: T&G and final landing already have exact track indices, timestamps and coordinates; timezone-less track timestamps already fail closed. Draft implementation uses geometric solar-centre altitude at the SERA -6° boundary, requires every detected landing event to classify before suggesting an aggregate split, limits first-release auto-prefill to the EASA/SERA path, and tracks landing split provenance explicitly as UNSET/SUGGESTED/MANUAL so unrelated UI state cannot overwrite pilot edits. Added dedicated read-only independent-review handoff before implementation.
- E1.3 independent review returned **APPROVE WITH CHANGES**. Reconciled contract now adds a conservative calculation-confidence guard around the unchanged -6° SERA boundary, bounds the initial NOAA/Meeus implementation to its documented support envelope, requires complete landing-event classification, keeps applicability as an account/logbook setting rather than aircraft identity, keeps suggestion provenance ephemeral, resets review evidence on split changes, and requires accessible provenance association.
- E1.3 core implementation added a pure fail-closed geometric solar-altitude classifier and landing-event aggregate. It uses each exact T&G/final landing point, rejects ambiguous timestamps, invalid coordinates, unsupported year/latitude, near-boundary confidence cases, partial classification and event-count mismatches. Added focused ordinary-latitude, equatorial, supported high-latitude, envelope, confidence-guard and aggregate tests. Core verification: targeted **24/24 PASS** and TypeScript PASS.
- E1.3 wiring staged account-level `night_definition` (`MANUAL` default/fail-closed, `SERA` opt-in) in existing settings JSON, passes it into GPS review, prefills only EASA `DAY_NIGHT` reviews with available event-level suggestions, tracks review provenance ephemerally as `UNSET/SUGGESTED/MANUAL`, clears a suggested split when the reviewed landing total changes, preserves direct pilot edits across unrelated state changes, and associates visible provenance with both Day/Night inputs. No schema/certification/sharing/recency change. Local verification completed: focused wiring + GPS regression **38/38 PASS**, TypeScript PASS, production build PASS and authenticated browser **5/5 PASS**. E1.3 is **DONE / LOCAL VERIFIED**.
- E1.4 discovery removed the residual server fallback that could synthesize `Task = GPS import`; focused source/certification/census tests previously reached **15/15 PASS**, TypeScript PASS, and the local SELECT-only census completed through **ROLLBACK** after browser-fixture schema alignment. Production target proof then confirmed `neondb`, read-only ON, schema v17 and required history tables. The production census found **14 exact live rows across 3 accounts, all 14 currently certified**, with **0 ordinary draft candidates**, plus **4 certified revision snapshots**, **2 deleted-flight recovery copies** and **51 audit events** carrying the legacy value. Independent review returned **APPROVE WITH CHANGES** and was reconciled: no automated historical mutation; pilot correction only through the existing owner-scoped correction/re-certification workflow; additive exact-match legacy UI annotation without changing export/print/certification data. Added a PostgreSQL correction-history acceptance case and presentation/export/hash/ownership guards. Focused E1.4/E1.1/certification tests are **20/20 PASS**, TypeScript PASS, PostgreSQL certification/correction acceptance is **5/5 PASS** on the local `flytally_browser` database, the production build is PASS (Next.js 16.3.8; 41/41 static pages generated), and targeted authenticated Playwright owner/shared legacy annotation coverage is **1/1 PASS**. E1.4 is therefore **DONE / LOCAL VERIFIED**. No production historical Task value was mutated.
- E1.5 closeout opened after E1.4 local verification. Added a dedicated production-closeout design and independent migration-review handoff. Current proposed order is full local release gate → PR/CI → fail-closed production v17 preflight/recovery point → explicit additive v18 migration → postflight verification → merge/deploy/smoke. No E1.5 production write, migration, merge or deploy has been executed yet. Independent review returned **APPROVE WITH CHANGES**. Reconciliation proved current production main v17 ignores future registry versions above its advertised schema, automatic feature-branch Vercel deployments are canceled while CI uses isolated PostgreSQL services, and relevant old-app aircraft consumers tolerate the additive nullable column. Added fail-closed production v18 preflight/migration/postflight tooling plus source-contract guards. Focused E1.5/E1.2/migration-plan sanity verification completed **16/16 PASS**. Full local release verification then produced TypeScript PASS and **1193/1198** unit/regression tests with five failures. Repository reconciliation classified all five as stale regression/document expectations, not runtime failures: three old unconditional `SP` source assertions were superseded by E1.2 nullable Operation-default semantics, the B1A aircraft-share assertion was superseded by the combined billing/Operation fail-closed default guard, and the v3.0 roadmap assertion still expected Workflow 3.0 to be ACTIVE after its production closeout. Those guards and current roadmap summary were reconciled; the targeted remediation pack passed **26/26**, complete unit/regression passed **1198/1198**, TypeScript PASS, and full PostgreSQL acceptance passed **84/84** including 10k/50k/100k scale coverage plus E1.2 migration and E1.4 certified-history correction checks. Production Next.js 16.3.8 build then passed with **41/41** static pages generated. The first full authenticated desktop/mobile Playwright run completed **82 passed / 2 skipped / 1 failed / 1 flaky**. Reconciliation found no runtime defect: the single failure came from E1.4 fixture residue left by the desktop project, which made the mobile core-shell `OK-E2E` row locator resolve both the baseline draft and certified legacy fixture; the flaky F3.4 case raced a controlled `<details>` close against the invalid-profile auto-open effect and passed on retry. Browser harness remediation now adds `finally` cleanup for E1.4 fixture rows, pins the core-shell assertion to the deterministic baseline flight, and tests invalid-profile auto-open from a fresh closed page. Added a source guard for E1.4 cross-project cleanup. Remediation verification then passed **6/6** source tests and **4/4** targeted Playwright checks across desktop + mobile with zero fail/flaky. The authoritative complete authenticated browser rerun, executed with the same single-worker discipline as CI, passed **84/84** with **2 intentional skips** and zero fail/flaky. A separate local run using Playwright's default four workers produced cross-test fixture collisions because both projects mutate the same isolated `flytally_browser` database; this was classified as an invalid harness run rather than a product regression. To prevent recurrence, `playwright.config.mjs` now pins `workers:1` for local and CI execution, v367 guards the serialization contract, and DEVELOPMENT documents the canonical browser command. That harness-only change is now verified by the E1.5 source-contract suite **7/7 PASS** and a config-driven desktop/mobile core-shell smoke **2/2 PASS**, which reported `using 1 worker` without a CLI worker override. The first canonical exact-head `npm run verify` then reached the unit/regression stage and failed **2/1200** only because older v3.2 source guards still asserted the superseded generic `OK-E2E` row locator and the previous CI-only worker expression. The worker-serialization guard is reconciled to unconditional `workers:1`. A first targeted v3.2 rerun then showed the old generic OK-E2E locator assertion had not actually been replaced; that remaining stale source guard is now corrected to the deterministic baseline-row locator. Runtime behavior is unchanged. Final targeted v3.2 verification then passed **5/5**. Canonical exact-head `npm run verify` passed completely: TypeScript PASS, **1200/1200** unit/regression tests, and production Next.js 16.3.8 build PASS with **41/41** static pages. Combined with the earlier complete PostgreSQL **84/84 PASS** and authoritative serialized authenticated Playwright **84/84 PASS** with **2 intentional skips** and zero fail/flaky, the E1.5 local release gate is closed. PR #237 `[full-ci]` then ran on GitHub: Browser smoke passed **84/84** with **2 intentional skips** using one worker, and PostgreSQL acceptance passed. The Fast application gate failed only one unit/regression source contract (**1199/1200 PASS**) because `v300-navigation-hierarchy` still expected the superseded exact `E1.5 ACTIVE` roadmap heading after documentation advanced to PR/CI. TypeScript passed and no runtime/browser/database defect was exposed. That guard is now stage-tolerant across E1.5 closeout transitions; CI rerun is required before production work. No production write, v18 migration, merge or deploy has been executed.

### Flight Entry Workflow 3.0 — F6 browser/responsive/production closeout
- Activated the final F6 acceptance phase after F5 completed local verification.
- Added a shared required presentation matrix covering 1440 desktop, iPad landscape, iPad portrait, 390 mobile, 320 compact mobile and a 720 × 450 CSS viewport representing 1440 × 900 at 200% browser reflow; every state runs in Light + Dark and checks document-level horizontal overflow.
- Added authenticated Manual coverage for PIC, DUAL, Safety Pilot Manual, Safety Pilot Connection, SPIC and PICUS.
- Added authenticated GPS single-flight coverage for the strict implemented role allowlist PIC / DUAL / SAFETY PILOT, including Manual + connected Actual-PIC modes.
- Added authenticated GPS multi-part coverage for inherited common DUAL plus complete connected Safety Pilot per-flight override and Reset-to-common visibility.
- Added Manual + GPS invalid-profile recovery coverage across the full presentation matrix.
- Added focused source contract `tests/v360-flight-entry-f6-closeout.test.ts` and closeout design `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F6_CLOSEOUT.md`.
- Runtime/parser/normalizer/persistence/schema/certification/recency changes: **none**. Local F6 verification completed with focused closeout contract **6/6 PASS**, authenticated F6 matrix **4/4 PASS**, and full authenticated Playwright **72 passed / 2 skipped / 0 failed** across desktop + mobile projects. PR #235 then passed Fast application gate, PostgreSQL acceptance, Chromium desktop + mobile, Classify CI risk and Vercel Preview Comments; it squash-merged to `main` as `fb0bbb3da5d3c0be36ecd3190b1840977edbd252`. Vercel production deployment `dpl_GM9nQX2gBwbn4GgzEy7YrJPnmR4F` is READY for that exact SHA, aliases `fly-tally.com` without alias error, and production smoke returned HTTP 200 from the exact deployment for `/`, `/login` and `/flights/new` with unauthenticated protected routing resolving to Login as designed. Immediate 30-minute runtime-error check found no errors. Flight Entry Workflow 3.0 F0–F6 is **DONE / PRODUCTION VERIFIED**. DB/schema migration N/A; certification version/hash unchanged; no historical rewrite.

### Flight Entry Workflow 3.0 — F5 Primary UX discovery/design
- Reconstructed the post-F4 production state from `main@5281d61fe2e7f38a3425ac0189007b46c68601b2` and reconciled roadmap drift: F0–F4 are production verified, while F5 and F6 remain outstanding milestones.
- Activated F5 on branch `feat/flight-entry-f5-primary-ux`.
- Source audit confirms the common Manual PIC hierarchy is already largely aligned with the frozen B1–B5 simplicity model: Date/Registration/Role, Route and UTC timeline are visible; landing/PF evidence, additional crew, aircraft context and Optional details use progressive disclosure.
- Draft F5 direction is intentionally narrow: remove duplicated workflow/helper copy rather than redesign flight semantics or invent new defaults.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F5_PRIMARY_UX_DESIGN.md` and `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F5_REVIEW_HANDOFF.md`.
- Runtime/schema/certification changes during discovery: **none**.
- Independent review returned **APPROVE WITH CHANGES** and was reconciled against the repository before implementation.
- Repo verification corrected the review scope: `FlightForm` is shared by Manual New + Manual Edit; GPS uses `KmlImportForm`; current Dashboard “Add flight” routes to New Flight rather than a separate Quick Add flight form.
- F5.1 removes the redundant long New Flight header workflow paragraph while preserving the mode chooser, GPS contextual instruction, `Save & review` and the action-surface draft/review consequence.
- F5.2 keeps Registration `Manage aircraft` because the valid collapsed Aircraft context has no equivalent manage link; unresolved profile recovery remains unchanged.
- F5.2 retains Role provenance as concise New-only `Aircraft default`, and removes the misleading cue from Edit/SNAPSHOT.
- F5.2 removes the generic BLOCK/AIR “Calculated automatically” helper only for New Flight when both values are resolved; BFCL authority copy, incomplete-state instruction, Edit helper behavior and the `aria-live` value surface remain.
- Added focused F5 source contracts and reconciled the historical v1.58 Role-provenance test. Verification: **NOT RUN**.
- Added two focused authenticated F5 browser cases: common Manual PIC exact persistent-control/helper allowlist across desktop/iPad/mobile, and PIC→DUAL contextual identity with the Role-default cue removed.
- Verification evidence: F5 focused/source batch **46/46 PASS**, TypeScript PASS and production build PASS.
- First full regression reached **1150/1151 PASS**; the only failure was the historical U4 source assertion still requiring the removed header sentence. It has been reconciled to the retained action-surface draft/review cue without runtime changes.
- First F5 browser run reached **1/2 PASS**; the common-PIC allowlist correctly encountered the existing contextual intelligent continuation suggestion (`Continue from LKPR…`). The F5 allowlist is now scoped to persistent/core helpers and controls while explicitly preserving/asserting contextual `data-intelligent-review` assistance. No runtime change.
- Final verification complete: focused reconciliation **16/16 PASS**, full unit/regression **1151/1151 PASS**, production build PASS, and authenticated F5.3 browser **2/2 PASS**. The browser proof preserves contextual Intelligent Logbook continuation assistance while keeping the persistent/core helper allowlist explicit. F5 is **DONE / LOCAL VERIFIED**. No DB/schema/certification change; deploy belongs to F6 closeout.

### Flight Entry Workflow 3.0 — F4 GPS inheritance design/review gate
- Completed repository discovery for the frozen F4 multi-part GPS inheritance milestone; no runtime behavior changed.
- Confirmed GPS remains intentionally PIC-only at both UI and server role gate, per-part Review state currently contains no Role/Crew context, and every reviewed part already passes through the shared `gpsFlightCandidate() → normalizeFlightDraft()` semantic boundary.
- Confirmed existing atomic import prepares and normalizes every part before one duplicate-safe transaction; F4 should extend this boundary rather than replace it.
- Confirmed Safety Pilot cannot be enabled by UI expansion alone: GPS must preserve Manual/accepted-Connection Actual-PIC authority, account-ID Connection recheck, display-name snapshot and one atomic connected-crew child row per resulting source flight.
- Drafted one common complete Role/Crew context plus all-or-nothing whole-part overrides; field-level inheritance, per-part aircraft identity and inferred crew remain prohibited.
- Proposed fail-closed split behavior clears part Role/Crew overrides when split structure changes instead of guessing which new segment owns old crew evidence.
- Added F4 design and independent-review handoff. Runtime/schema/certification: unchanged.
- Reconciled the independent review against current code: GPS already persists commander/instructor/role/verification name/reference from normalized per-part input; duplicate fingerprint excludes Role/Crew; Safety Pilot remains intentionally unwired from GPS.
- Staged F4.0 characterization coverage locking persistence-column parity, duplicate identity, temporary PIC-only scope, Safety Pilot non-wiring and shared DUAL/SPIC/PICUS Save requirements. No runtime behavior changed.
- Frozen implementation order: common Role/Crew → whole-part overrides → Safety Pilot. One product decision remains before enabling SPIC/PICUS: whether a common countersignature reference may apply to multiple split flight records.
- F4.0 local verification completed: targeted 5/5 PASS and full unit/regression 1124/1124 PASS.
- Implemented F4.1 common GPS Role/Crew for PIC + DUAL only: strict server resolution after aircraft authority, shared EASA DUAL Instructor/PIC validation, candidate propagation into the shared normalizer, controlled common UI, and inherited-review invalidation on common Role changes. SPIC/PICUS and Safety Pilot remain unavailable.
- F4.1 local closeout PASS: targeted cross-path tests **55/55**, TypeScript PASS, full unit/regression **1129/1129**, production build PASS, and authenticated desktop Chromium **2/2 PASS** against the disposable PostgreSQL browser DB. The browser proof covers PIC/DUAL role-surface behavior, common DUAL review invalidation, required Instructor/PIC gating, successful Save, and persisted normalized `DUAL + Instructor` values. The browser-only bootstrap now creates the minimal `airports` relation needed by GPS airport detection. No production DB/schema/certification change.
- Implemented F4.2 whole-part GPS Role/Crew overrides for the currently supported PIC + DUAL scope. Each split submits explicit `INHERIT` or complete `OVERRIDE`; the server validates envelope shape/count, rejects unknown/duplicate/stale fields and per-flight common-context drift, resolves each part without field-level fallback, and passes the fully resolved Role/Crew context through the existing GPS candidate/normalizer path before atomic persistence. The review UI supports per-flight override, deterministic Reset to common, inherited-only invalidation on common Role changes, and automatic override clearing with a visible notice when split boundaries change. Added focused F4.2 unit/source-contract coverage in `tests/v357-flight-entry-f42-whole-part-role-crew.test.ts`. F4.2 local closeout PASS: focused cross-path batch **67/67 PASS**, full unit/regression **1134/1134 PASS**, production build PASS including TypeScript, and authenticated desktop Chromium **4/4 PASS** against the isolated local PostgreSQL browser DB. Browser proof covers mixed INHERIT/OVERRIDE persistence, inherited-only invalidation, deterministic Reset to common, split-boundary override clearing with a visible notice, and persisted per-flight PIC/DUAL Role/Crew. No production DB/schema/certification change.
- Implemented F4.3 GPS Safety Pilot core while preserving Manual Actual-PIC authority semantics. GPS role scope now adds only SAFETY PILOT; common and whole-part overrides support explicit Manual Actual PIC text or accepted-Connection account ID without display-name matching. Extracted a reusable lower-level Safety Pilot resolver while keeping the Manual FormData wrapper, server-snapshot current connected display name into `commander`, propagate connected account ID separately, and recheck accepted Connection state in the atomic GPS write. Each connected Safety Pilot flight creates its own `flight_connected_crew` row in the same transaction as flight + track; a zero parent/track/required-child write forces rollback of the complete N-part transaction. Added F4.3 focused contract tests, isolated PostgreSQL atomicity coverage and advanced the browser role-surface expectation. Verification on the runtime-equivalent F4.3 head: focused F1.4/F4.3 **12/12 PASS**, targeted cross-path **80/80 PASS**, isolated PostgreSQL Manual-resolver + GPS Safety Pilot **5/5 PASS**, TypeScript PASS, and production build PASS. The PostgreSQL division-by-zero in the rollback test is intentional fail-closed evidence. The first full-suite run exposed 6 stale source-contract assertions only; these were reconciled in `safety-pilot-pic-sp2`, F0.0, F0.1 and F2.5 tests without runtime changes. Final reconciliation **9/9 PASS**, TypeScript PASS, and final full regression **1141/1141 PASS**. Production build remains PASS on the runtime-equivalent head. F4.3 local closeout completed. The first authenticated browser attempt exposed a localhost-only transaction-adapter parser defect: `track_insert` was misidentified as a top-level `INSERT` token. The adapter now requires a left identifier boundary before command recognition and has a focused U6 regression test. Final verification after rebuild: adapter **4/4 PASS**, TypeScript PASS, full unit/regression **1142/1142 PASS**, production build PASS, and authenticated desktop Chromium F4.3 **3/3 PASS**. Browser proof covers common Manual persistence without account link, common connected account-ID persistence with authoritative server display-name snapshot + one `flight_connected_crew` PIC row, and revoked per-flight connected override fail-closed behavior with zero partial split persistence. Earlier F4.3 evidence remains targeted cross-path **80/80 PASS** and isolated PostgreSQL **5/5 PASS**. No DB/schema/certification change; deploy NOT RUN.
- Started F4.4 closeout. Added one authenticated responsive GPS Role/Crew override matrix covering desktop 1280, iPad landscape 1024, iPad portrait 768, mobile 390 and mobile 320 under light + dark. The staged state uses inherited DUAL plus a complete connected Safety Pilot per-flight override and verifies stable override controls/values plus no horizontal overflow. No application runtime behavior changed. SPIC/PICUS remain fail-closed pending the separate countersignature-reference product decision. Responsive browser closeout is **1/1 PASS** on authenticated desktop Chromium while internally exercising 5 viewport sizes × light/dark with stable inherited DUAL and connected Safety Pilot override state and zero horizontal overflow. F4.4 is now production-closed: PR #233 squash-merged to `main` as `252bcb8eb0258603c1164c5e19bfdcf25bc0d9dd`; Vercel deployment `dpl_3Jh1ghZ8wfkZRE5w3ZN83gxasnzd` is READY on that SHA and aliases `fly-tally.com`; production smoke returned HTTP 200 for `/`, `/login` and `/flights/new`, with protected unauthenticated entry resolving to Login as expected; immediate 30-minute runtime-error check found no errors. F4 is DONE / PRODUCTION VERIFIED. No DB/schema/certification change. No DB/schema/certification change.


### Flight Entry Workflow 3.0 — F3.5 closeout and F3 production integration
- Reconciled the F3.5 closeout plan against an independent second-AI review. Verdict: **APPROVE WITH CHANGES**; no confirmed correctness defect, but action/persistence proof is required for crafted authority drift and historical SNAPSHOT boundaries.
- Froze the minimum closeout scope: no runtime change unless a test proves a bypass or stale-profile consumer; no generic historical-context override; no DB migration; GPS remains PIC-only.
- Source-audited downstream consumers before adding duplicate tests: CSV/XLS export and Statistics derive regulatory context from stored `flights`; Trash serializes/restores raw flight context; Print reads F3 evidence/category/class/type from `flights` and consults current Aircraft only for ICAO type-code presentation; existing certification/shared/backup/restore/recency suites remain the primary invariance evidence.
- Deferred as non-blocking unless evidence changes: the microscopic PROFILE read→flight-write race, explicit historical-context correction UX, wider browser matrix beyond already-verified F3.4 states, and any new schema.
- Added focused source-contract coverage plus authenticated browser/PostgreSQL fixtures for historical SNAPSHOT, crafted authority drift, submit-time PROFILE re-resolution, TMG/OTHER A+, Balloon ownership and Quick Add → immediate Save. Browser-fixture schema was aligned with current aircraft mutation columns and optional untracked flight billing; these are test-only changes.
- **Local verification:** final unit/regression **1119/1119 PASS**, 0 fail, 0 skipped; browser bootstrap PASS; targeted authenticated desktop Chromium **4/4 PASS**. PostgreSQL core **66/66 PASS**, TypeScript PASS and production build PASS were already established on the runtime-identical F3.5 branch before the final test-only fixture/assertion refinements.
- **Runtime/schema/certification:** no application-runtime change in F3.5, no DB migration, certification v1–v8 unchanged.
- **Integration/deploy:** F3 stack was fast-forwarded to `main`; rollback anchor `chore/pre-f3-integration-anchor` preserves pre-F3 main. Vercel initially ignored the docs-only closeout commit, so an empty tree-identical commit `a4b1c626d487aad86ef3e2de887df50a0a2b9248` triggered the intended production build without changing runtime contents. Deployment `dpl_Dn3PAymjG7aCds9xsw18shzkYM4a` is READY, aliases `fly-tally.com` with no alias error, public smoke returned HTTP 200, and no runtime errors were reported in the immediate 30-minute post-deploy check. GitHub Actions and PR were intentionally not run. F4 is next.


### Flight Entry Workflow 3.0 — F3.4 compact aircraft-context UX (locally verified, not yet merged/deployed)
- Replaced routine Manual Logbook/Class/Aircraft type editors with one compact **Aircraft context** surface backed by the F3 authority model.
- PROFILE entry submits server-supported profile-owned evidence, class, aircraft type and Balloon class/group as hidden authority fields; only genuine TMG/OTHER regulatory context from `allowedFlightContexts(profile)` remains selectable.
- Same-registration Edit presents **Stored flight context** and submits the stored SNAPSHOT tuple instead of refreshing it from the mutable current profile. Legacy rows with blank stored `regulatory_category` remain blank on submission and are described without invented backfill.
- Invalid PROFILE state is now part of the Manual completion blocker list and links to Aircraft configuration in a new tab/window so the current draft is preserved.
- GPS Common details now uses the same compact profile-context presentation and removes disabled duplicate Logbook/Class/Aircraft type controls while preserving the common TMG/OTHER selector.
- Operation/Engine, Balloon FREE/TETHERED, sailplane launch evidence and Role/Crew remain explicit flight-specific inputs.
- Added focused F3.4 source/contract coverage and reconciled earlier B3/B5/F3 characterization assertions with the superseding compact-authority UX.
- Browser fixture was aligned with the existing F3 authority provenance columns and now includes an explicit TMG fixture for multi-context acceptance; this is test-fixture-only and does not alter application schema.
- **Local verification on `e305f3ef3985d371a385a0e7231ec42d8a6d135e`:** TypeScript PASS; full unit/regression **1110/1110 PASS**, 0 fail, 0 skip; production `next build` PASS; disposable localhost browser DB bootstrap PASS; targeted authenticated desktop-Chromium suite **5/5 PASS**, including Manual/GPS compact context, invalid PROFILE blocker, TMG A+ choice, GPS-save SNAPSHOT reopen and the responsive light/dark RoleCrew/context matrix.
- **CI/PR/deploy:** NOT RUN intentionally for this local closeout; no merge or production deployment is claimed.
- **Schema/certification:** no migration and no certification v1-v8 change.


### Flight Entry Workflow 3.0 — F3.3 server enforcement (locally verified, not yet merged/deployed)
- Wired Manual New and registration-change saves to server-side owned-profile authority using the shared F3 resolver; submitted aircraft context must be a member of the profile's allowed context set, and persistence now uses the canonical server-authorized context rather than the raw normalized request values.
- Wired same-registration Edit to server-derived SNAPSHOT authority; unchanged historical context is persisted from the stored snapshot without consulting the mutable current profile. Legacy blank regulatory-category rows are preserved rather than silently upgraded by the current UI's derived presentation value.
- Routed GPS through the same shared PROFILE authority while keeping its active-aircraft selection boundary and PIC-only Role scope.
- Added one common GPS TMG/OTHER regulatory-context choice and server validation against `allowedFlightContexts(profile)`; no full evidence/class override was introduced.
- Propagated Part-FCL credit provenance into entry/profile authority validation so malformed provenance fails closed rather than being dropped at the F3 boundary.
- Added focused F3.3 unit/source-contract coverage and retired stale F3.0/F3.2/F1.3 assertions that conflicted with the now-authoritative persistence boundary.
- Hardened the local PostgreSQL acceptance/browser harness for Windows: connection URLs are passed with explicit `-d`, SQL is streamed through UTF-8 stdin, and CRLF query output is normalized before assertions. The harness remains localhost-only.
- **Local verification:** final branch head `065896d3c9aa75fee8c2c0c7cc7a2f6abc20e52a` — full unit/regression **1102/1102 PASS**. On runtime-identical head `3644a85d6da5e01a96c6869b9537c114d395e299`: TypeScript PASS, PostgreSQL core **66/66 PASS**, production `next build` PASS. The only change after that runtime verification was a stale source-contract test assertion aligned to canonical F3 authority persistence.
- **CI/PR/deploy:** NOT RUN intentionally for this local closeout; no claim of merge or production deployment.
- **Schema/certification:** no migration and no certification v1-v8 change.


### Flight Entry Workflow 3.0 — F3.2 authority resolver
- Added the pure shared aircraft-context authority resolver and its focused unit matrix.
- The resolver keeps evidence/class, Balloon class/group and aircraft type profile-owned, while allowing only the frozen TMG/OTHER multi-context categories.
- Added PROFILE/SNAPSHOT authority derivation from stored versus final normalized registration and raw SNAPSHOT comparison that preserves legacy blank category values.
- F3.2 remains intentionally unwired from Manual/GPS mutations; F3.3 owns enforcement.
- PR #229 merged as `abc66ae13cfc8a3af7f6ee21f19ab5c8ab63bc73`; Verify #1097 PASS, PostgreSQL 66/66; Browser #470 PASS including production build.
- Production deployment is READY on the exact merge SHA with the `fly-tally.com` alias and no alias error.
- DB migration/schema: N/A.

### Flight Entry Workflow 3.0 — F3.1 production census
- Completed the required read-only aircraft-context census before runtime enforcement.
- Current profiles pass the canonical validation gate; no pre-enforcement bulk repair or migration is required.
- Historical flight/profile differences were classified as legacy blank-category snapshots plus one older stored regulatory snapshot against a later-updated current profile; no explicit nonblank category conflict was found.
- Historical aircraft identity differences remain SNAPSHOT evidence and are not refresh targets.
- No current production TMG/OTHER/Balloon population was available to validate multi-context frequency; focused contract tests remain required.
- A+ remains frozen and F3.2 pure resolver work is next.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F31_PRODUCTION_CENSUS.md` and updated ROADMAP/FEATURES/F3 design.
- **Runtime/schema/certification/deploy:** N/A; no production data was mutated.

### Flight Entry Workflow 3.0 — F3 independent-review reconciliation
- Reconciled the F3 aircraft-context design against the independent review and current repository contracts before any runtime enforcement.
- Superseded the draft full regulatory override (Option B) with **A+**: evidence/class remain profile-owned; explicit flight-level choice is limited to genuine profile-supported TMG/OTHER multi-context semantics plus deliberate same-registration historical correction.
- Froze server-derived PROFILE/SNAPSHOT authority with no generic client-sent override-authority flag; PROFILE drift must reject, while unchanged SNAPSHOT context must remain historical and must not be revalidated against today's stricter profile validator.
- Froze Manual New/registration-change authority as **owned + canonically valid** profile, allowing inactive owned profiles to remain available for explicit historical back-fill; GPS retains its existing active-owned-profile selection boundary.
- Froze aircraft identity/type and Balloon class/group as profile/snapshot-owned; Balloon FREE/TETHERED remains flight-specific.
- Kept narrow Manual/GPS convergence in F3: the common resolver will expose the same whole-session TMG/OTHER choice where a profile has multiple allowed contexts; GPS Role/Crew expansion remains F4.
- Reordered F3 so **F3.1 is a read-only production census** before resolver/enforcement implementation. The census may not repair, normalize, backfill or invent production evidence.
- **Runtime/schema/certification:** no change in this reconciliation step.

### Flight Entry Workflow 3.0 — F3.0 aircraft-context discovery / review
- Characterized aircraft-context authority across Manual New/Edit, GPS import, canonical aircraft-profile validation and historical identity snapshots.
- Confirmed Manual currently applies profile defaults client-side but create/update do not re-resolve the active profile, while GPS already re-queries and validates the active profile server-side.
- Confirmed Manual invalid-profile state is visible as **Needs configuration** but is not itself an action-level profile gate.
- Confirmed same-registration Edit preserves stored context; registration change applies current profile/identity snapshot semantics.
- Added F3 design, independent-review handoff and v349 characterization coverage for valid ULL/EASA, TMG/OTHER multi-context profiles, Manual/GPS authority divergence and historical snapshot boundaries.
- Draft authority model is PROFILE / SNAPSHOT / explicit OVERRIDE; override breadth and GPS timing are review-gated.
- **Verification:** PR #225 merged as `4e42dbf7fd095aa768e404500b141510386a18c5`; Verify FlyTally web #1096 PASS — **1084/1084** unit/regression and PostgreSQL **66/66**. Browser/deploy N/A because F3.0 is docs + characterization only.
- **Runtime/schema/certification:** no change in F3.0.

### Flight Entry Workflow 3.0 — F2.4 producer-consumer audit / review gate
- Audited Role/Crew producers and consumers across Manual normalization, Safety Pilot linkage, Certification, explicit instructor verification, shared-flight materialization, print/read-only output, CSV/XLS export, audit, backup/restore, recency and GPS boundaries.
- Confirmed a remaining Certification-time DUAL/SPIC/PICUS display-name → account inference path; the repository already has an explicit account-ID post-certification request flow that can replace it.
- Confirmed `instructor` is overloaded with aircraft differences/familiarisation training evidence and `verification_*` is overloaded with generic endorsement evidence; broad Role-only clearing remains unsafe.
- Identified one unresolved semantic mismatch: current PIC-name output lets stored commander override account self identity on self-PIC roles even though the frozen RoleCrew contract says self is authoritative.
- Added the F2.4 audit and an independent-review handoff; no runtime, schema, certification-version, recency or historical-data change yet.
- **Verification:** documentation/repository analysis only; runtime tests not applicable to this analysis commit.
- **F2.4A runtime:** removed Certification-time DUAL/SPIC/PICUS display-name → account matching and the implicit verification request side effect; explicit `instructor_id` account selection remains the only account-bound request path.
- Updated Crew Verification copy so typed names are described as stored flight evidence, not account bindings or automatic request triggers.
- Added source-contract and authenticated browser coverage proving a certified matching typed name remains unbound and only an explicit connected-account request control is offered.
- **Final verification:** Verify FlyTally web #1089 PASS — TypeScript PASS, full unit/regression **1052/1052**, PostgreSQL acceptance **66/66**; Browser smoke #465 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #212 merged as `06b50d911e0cedcafbd5f10bea41868098f8d8b0`.
- Production deployment `dpl_DP43Y79vK4Kny2L86Wuw5VCjAoHH` is READY for that exact merge SHA, aliases `fly-tally.com`, and reports no alias error.
- **DB/schema:** N/A. Certification v1–v8, certified rows, Safety Pilot F2.3, shared materialization and GPS PIC-only boundaries are unchanged.
- **F2.4B discovery:** confirmed that self-PIC `commander` can be intentional rather than stale: Manual UI exposes optional Commander/PIC for non-DUAL roles and shared PIC materialization writes participant/source commander snapshots onto recipient `PIC` rows. The earlier draft preference to make SELF always override stored commander is therefore no longer considered safe without independent review.
- Added a focused F2.4B independent-review handoff. No runtime, schema, certification-output or persisted-data change in this discovery step.
- Added F2.4B characterization coverage for self-PIC fallback/explicit commander precedence, Manual commander availability, shared PIC commander snapshot production and raw integrity/export visibility. PR #215 merged as `064be0862b9506e472545eb16491b21019a90a50`; Verify FlyTally web #1090 PASS — TypeScript PASS, **1057/1057** unit/regression, PostgreSQL **66/66**. No runtime behavior or schema change.
- **F2.4B B1 runtime:** split the RoleCrew contract into role-level PIC identity (`rolePicIdentitySource`) and backward-compatible display precedence (`picDisplayPrecedence`); self-PIC `commander` is modeled as optional evidence rather than falsely `not_applicable`. `pilotInCommandName()` delegates to the shared pure resolver while preserving previous results.
- **Final verification:** Verify FlyTally web #1091 PASS — TypeScript PASS, full unit/regression **1058/1058**, PostgreSQL acceptance **66/66**; Browser smoke #466 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #217 merged as `6f1b33745d8b5c352d0d3331ea4891bb9f8d9f58`.
- Production deployment `dpl_4MfDPVYDhR3ibgQ7uHoeUAagQkQW` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A. No destructive canonicalization, certification payload/version change, certified-history rewrite, shared-materialization change or GPS role expansion.
- **F2.4B B2 semantic closeout:** intentionally performs no destructive canonicalization. Cross-role regression coverage preserves commander/instructor/verification evidence for DUAL, SPIC and PIC contexts, including generic training/endorsement evidence. Current commander-over-SELF display precedence remains frozen for F2; any future change requires an explicit reopened decision rather than silent reinterpretation.
- PR #219 merged as `1c0ecf7be2e18feba7e583039ed5c27919dcdd42`; Verify FlyTally web #1092 PASS — TypeScript PASS, **1059/1059** unit/regression, PostgreSQL **66/66**. Browser rerun was not required because this closeout changed tests/docs only; runtime behavior remained the already production-verified B1 implementation.
- **F2.4C cross-path characterization:** added coverage spanning Manual RoleCrew preservation, Certification/request separation, exact revision/hash verification evidence, shared-flight materialization, print/read-only/CSV/XLS, audit/backup, recency evidence, Safety Pilot F2.3 and GPS PIC-only. Extended authenticated browser coverage to expose both explicit connected-account and in-person verifier paths without implicit binding.
- **Final verification:** Verify FlyTally web #1094 PASS — TypeScript PASS, full unit/regression **1068/1068**, PostgreSQL acceptance **66/66**; Browser smoke #468 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #221 merged as `84b5f5362f03ef1959956fba91584059a36c2db5`.
- **Runtime/schema/deploy:** no runtime or schema behavior changed; production deployment N/A.
- **F2.5 final regression + F2 closeout:** added exhaustive RoleCrew matrix/crafted Save coverage, v1–v8 certification compatibility checks, explicit invitation boundary checks, auxiliary-role non-creditability/GPS PIC-only guards, and responsive authenticated browser coverage for PIC/DUAL/SPIC/PICUS/CO-PILOT/Safety Pilot across desktop, iPad landscape/portrait and mobile in light + dark.
- **Final verification:** Verify FlyTally web #1095 PASS — TypeScript PASS, full unit/regression **1077/1077**, PostgreSQL acceptance **66/66**; Browser smoke #469 PASS — production build PASS, Chromium **36 passed / 2 skipped**.
- PR #223 merged as `bc187e307958054efa2e32db316b06139d10df6e`.
- Production deployment `dpl_GFWksQDdFMoSr9qyvQYgiCBd2ShJ` is READY for exact merge SHA `bc187e307958054efa2e32db316b06139d10df6e`, aliases `fly-tally.com` with no alias error, and the production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A. F2 closes without destructive RoleCrew canonicalization, certification-version change, historical rewrite or GPS role expansion.

### Flight Entry Workflow 3.0 — F2.3 Safety Pilot resolver convergence
- Added one server-owned `resolveSafetyPilotPicForSave()` path used by both Manual create and update.
- Manual Safety Pilot mode preserves the normalized commander and fails closed for a blank EASA Actual PIC; connected mode validates a positive non-self account ID, requires a currently accepted Connection and ignores client commander text.
- Connected mode snapshots the current server `users.display_name` as the historical commander; no account identity is inferred from names.
- Create/update persist the shared resolver output and also recheck accepted Connection state inside the parent write predicate to prevent a revoked Connection from producing a parent or child mutation.
- `flight_connected_crew` remains separate metadata and is inserted/updated/deleted only when the parent create/update succeeds.
- A zero-row connected write is reclassified through the same resolver so a concurrent revocation returns the existing Connection-specific error instead of silently degrading.
- Added focused source regression coverage, PostgreSQL acceptance for the production resolver query, and authenticated browser coverage for display-name resnapshot on create/update plus revoked-Connection Save rejection.
- GPS remains PIC-only; certification payload versions v1–v8 and collaboration/materialization semantics are unchanged.
- **Final verification:** Verify FlyTally web #1077 PASS — TypeScript PASS, full unit/regression **1048/1048**, PostgreSQL acceptance **66/66**; Browser smoke #453 PASS — production build PASS, Chromium **32 passed / 2 skipped**.
- PR #209 merged as `d90215f88514e953e062980798954c497ca76be7`.
- Production deployment `dpl_84eHWKabeoy8DqgGuM6rDATjTTjR` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the public production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2.2 Manual inline Role/Crew UX
- Moved role-defining DUAL Instructor/PIC, Safety Pilot Actual PIC, and SPIC/PICUS supervision/countersignature controls directly into Flight essentials immediately after Role.
- Manual applicability and required cues now consume the shared `roleCrewSpec(role,evidence)` contract introduced in F2.1.
- Added completion blockers and direct focus targets for EASA DUAL Instructor/PIC and SPIC/PICUS supervisor/countersignature fields, alongside the existing Safety Pilot Actual PIC blocker.
- Kept generic Commander/PIC + Instructor inputs available under a separate optional **Additional crew details** disclosure; no destructive field cleanup or persistence canonicalization is introduced.
- Preserved local instructor/supervision form state across role switches before Save.
- Safety Pilot connection authority remains server/action-owned; GPS remains PIC-only; certification payload versions v1–v8 are unchanged.
- Added focused F2.2 source/UX regression coverage and reconciled B3/B5 characterization tests.
- Added authenticated Chromium coverage proving DUAL and SPIC/PICUS inline fields are required under EASA and retain unsaved values across Role switches.
- **Final verification:** Verify FlyTally web #1075 PASS — TypeScript PASS, full unit/regression **1042/1042**, PostgreSQL acceptance **63/63**; Browser smoke #451 PASS — production build PASS, Chromium **30 passed / 2 skipped**.
- PR #207 merged as `205483eda15f82770c1000c0a91fa4df92177fcd`.
- Production deployment `dpl_9v8FjPuj8F2jAuH4TAVNfHrM4eAE` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the public production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2.1 RoleCrew validation
- Added a pure `roleCrewSpec(role,evidence)` contract describing role-specific Save requirements and PIC-identity source semantics without DB/account dependencies.
- Routed EASA DUAL and SPIC/PICUS Save validation through the shared RoleCrew contract.
- EASA DUAL now fails closed server-side when Instructor/PIC is missing instead of relying on HTML required + later Certification.
- Preserved CO-PILOT/CRCP/PAX/OBSERVER Save-optional commander behavior and existing ULL behavior.
- Safety Pilot remains action/resolver-authoritative in F2.1; accepted-Connection resolution is not moved into the pure normalizer.
- No destructive commander/instructor/verification sanitization is introduced in F2.1; overloaded training/endorsement evidence remains intact for later F2.4 reconciliation.
- GPS remains PIC-only; certification payload versions v1–v8 are unchanged.
- Added targeted RoleCrew unit/integration coverage for the frozen matrix and non-sanitization boundary.
- **Final verification:** Verify FlyTally web #1065 PASS (TypeScript, full unit/regression, PostgreSQL acceptance); Browser smoke #441 PASS including production build and real Chromium smoke.
- PR #204 merged as `0f00a3c256843dd24b84a801f6b1e0cae60771d5`.
- Production deployment `dpl_Dd3wzaNm51qBVKDBzRMFHF7cEgfP` reached READY for that exact SHA; `fly-tally.com` is aliased with no alias error and returned HTTP 200.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2 Role/Crew review reconciliation
- Independent review returned **APPROVE WITH CHANGES** and was reconciled against current repository consumers/producers.
- Frozen CO-PILOT/CRCP commander as Save-optional with the current Certification PIC-name gate unchanged; PAX/OBSERVER Save behavior also remains unchanged.
- Rejected the proposed new self-PIC commander requirement because the F0 contract and `pilotInCommandName()` explicitly support account-derived self identity with blank stored commander.
- Found that broad Role-only sanitization is unsafe: `instructor` also gates Aircraft Differences/Familiarisation purpose evidence and `verification_*` feeds general endorsement warnings.
- Found an existing DUAL/SPIC/PICUS certification auto-request path that matches typed names to connected accounts; this conflicts with the frozen no-name-inference rule and is deferred to explicit F2 reconciliation.
- Narrowed F2.1 to a pure RoleCrew requirement contract + server validation only. Destructive evidence-aware sanitization moves to F2.4.
- GPS is frozen PIC-only through F2; F4 owns Role/Crew inheritance/overrides.
- **Runtime/schema behavior:** unchanged by this reconciliation.

### Flight Entry Workflow 3.0 — F2 Role/Crew design
- Added a repository-backed F2 Role/Crew design draft after F1 production closeout.
- Characterized the current split boundaries: EASA DUAL is UI/certification-required but not yet server Save-required; Safety Pilot Actual PIC is action-level with accepted-Connection recheck; SPIC/PICUS supervision is already server Save-required.
- Proposed one source-agnostic `roleCrewSpec(role,evidence)` contract plus canonical role-owned-field sanitization.
- Kept connected-account resolution outside the pure normalizer and preserved the historical-text vs account-link distinction.
- Kept GPS PIC-only during design; F4 remains owner of per-part RoleCrew overrides.
- Prepared an independent review handoff covering CO-PILOT/CRCP Save policy, self-PIC crew fields, legacy draft sanitization, Safety Pilot connection architecture and GPS role promotion.
- **Runtime/schema behavior:** unchanged; F2 implementation has not started.

### Flight Entry Workflow 3.0 — F1.4 shared GPS normalization
- Routed every reviewed GPS PIC part through `gpsFlightCandidate() → normalizeFlightDraft() → FlightInput` before any flight persistence.
- GPS flight INSERT semantics now consume the same normalized `FlightInput` contract as Manual entry instead of recomputing role credit, billing, operation/engine and other flight semantics independently.
- Kept GPS track coordinates/provenance, date-effective price lookup, duplicate fingerprinting, sorted advisory locks and the atomic N-part transaction outside the semantic normalizer.
- Preserved F0.1 fail-closed aircraft context, F1.5 explicit Operation/Engine and F1.6 explicit source-evidence review; GPS remains PIC-only.
- Added Manual/GPS equivalent-EASA-PIC semantic equivalence coverage plus authenticated browser persistence coverage.
- Reconciled the isolated browser `flight_tracks` fixture with the runtime `overview_version` column and made the mutation test deterministic/cleanup-safe.
- Final PR-head verification before docs closeout: Verify #1055 PASS; TypeScript PASS; full unit/regression **1030/1030**; PostgreSQL acceptance **63/63**; Browser smoke #431 **28 passed / 2 skipped**; production build PASS.
- F1.4 merged as PR #200 on `main@5c2af689c74e209358d22eebf05c3f4120a4224f`.
- Production deployment `dpl_8NaCnff1TcP6DRkXSwUKmEq9dHiR` reached READY for that exact main SHA and is aliased to `fly-tally.com` with no alias error.
- DB schema/migration: N/A for F1.4; F1.0 migration v17 remains the only schema prerequisite in F1.
- F1 shared semantic normalization is therefore **DONE / production-verified**; F2 Role/Crew parity is next.
- Superseded parallel PRs #196 and #198 were closed without merge.

### Flight Entry Workflow 3.0 — F1.6 GPS source fidelity
- Added category-driven GPS review requirements instead of inferring regulatory evidence from generic movement.
- Reviewed landing totals must be explicitly classified day/night where the current domain distinguishes them; non-TMG sailplane keeps the existing total-landing compatibility model.
- Part-FCL/ULL PF movement credit now requires an explicit Yes/No pilot decision; positive PF evidence requires explicit day/night take-off and approach counts.
- Part-SFCL TMG and Part-BFCL take-offs require explicit day/night counts; non-TMG sailplane requires explicit launch method/count.
- Added optional reviewed Night/IFR fields for standard-time categories; track motion does not infer either value.
- GPS candidate adapters now resolve these source-sensitive fields only from explicit reviewed input, while unresolved/missing required facts remain fail-closed.
- Current GPS persistence stores the reviewed source-fidelity fields in preparation for F1.4 shared-normalizer convergence.
- Added source/domain and authenticated browser coverage for the new review boundary.
- DB schema/migration: N/A.
- Verification: final Verify FlyTally web #1031 PASS; TypeScript PASS; full unit/regression **1025/1025**; PostgreSQL acceptance **63/63**; Browser smoke #407 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A. The first #1030 run failed only because an F0.1 source-characterization assertion still expected the pre-F1.6 readiness expression; the assertion was reconciled without runtime changes.

### Flight Entry Workflow 3.0 — F1.5 explicit GPS Operation / Engine
- Reordered F1 execution because the shared normalizer correctly treats unresolved Operation/Engine as a blocking semantic state; routing GPS through it before explicit source input would either fail every applicable import or reintroduce guessed defaults.
- Added common GPS **Operation (SP/MP)** and **Engine (SE/ME)** controls for categories where the canonical capability contract exposes those semantics.
- Aircraft/registration changes clear both selections so values cannot leak across aircraft profiles.
- Server-side GPS import now revalidates Operation/Engine and persists the explicit reviewed values rather than silently forcing `SP` and class-derived Engine.
- Non-applicable category branches retain compatibility storage values only and do not present them as regulatory evidence.
- GPS remains PIC-only; shared normalizer routing, sailplane/movement/day-night/Night/IFR convergence remain outside this batch.
- **Verification:** Verify FlyTally web #1024 PASS; TypeScript PASS; full unit/regression **1019/1019**; PostgreSQL acceptance **63/63**; Browser smoke #400 **26 passed / 2 skipped**; production build PASS.
- **DB schema/migration:** N/A.

### Flight Entry Workflow 3.0 — F1.3 Manual persistence proof
- Added source-contract coverage proving Manual create and update remain behind the `parseFlightInput(FormData)` compatibility boundary after F1.2.
- Verified flight semantic columns are persisted from normalized `FlightInput` values rather than re-read independently from FormData.
- Preserved airport canonicalization, rate resolution, duplicate fingerprint/advisory locking and edit lock guards as persistence concerns.
- Preserved expenses as separately validated child rows and connected Actual-PIC account linkage as collaboration metadata outside the pure normalizer.
- Confirmed GPS remains on its specialized path for F1.4.
- Verification: Verify FlyTally web #1013 PASS; TypeScript PASS; full unit/regression **1014/1014**; PostgreSQL acceptance **63/63**; Browser N/A because no runtime/UI behavior changed; DB schema/migration N/A.
- Next: **F1.4 GPS semantic adapter / persistence convergence**.

### Flight Entry Workflow 3.0 — F1.2 pure normalizer
- Extracted `normalizeFlightDraft(candidate)` as the source-agnostic pure semantic normalizer for flight draft data.
- Converted `parseFlightInput(FormData)` into the compatibility wrapper `FormData → manualFlightCandidate() → normalizeFlightDraft()`.
- Kept DB/auth lookup, expenses, connected-crew validation, persistence and GPS track handling outside the pure normalizer.
- Explicit unresolved candidate authority now returns a domain error instead of being coerced into an implicit value.
- Preserved existing Manual semantics across EASA/ULL validation, category mapping, sailplane/BFCL evidence, structured movements, SPIC/PICUS supervision, professional context, purpose/task and role-derived function time.
- GPS import is not routed through shared normalization yet; its persistence behavior remains unchanged in F1.2.
- Verification: Verify FlyTally web #1007 PASS; TypeScript PASS; full unit/regression **1006/1006**; PostgreSQL acceptance **63/63**; Browser smoke #388 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A.
- Earlier #1003/#1006 failures were stale/source-test maintenance and a test syntax error encountered during the refactor, not accepted runtime regressions.
- Next: **F1.3 Manual wrapper regression / persistence proof**.

### Flight Entry Workflow 3.0 — F1.1 candidate/source adapters
- Added a typed `FlightDraftCandidate` characterization layer with explicit unresolved semantic state and compact provenance metadata.
- Added Manual FormData extraction preserving the presence-sensitive fields that current `parseFlightInput()` depends on.
- Added GPS reviewed-part extraction that carries canonical aircraft-profile context when available but does not infer unresolved Operation/Engine, day/night movement, Part-FCL PF/approach, sailplane launch, night or IFR evidence.
- Future explicit common GPS Operation/Engine values are supported by the candidate contract without class-derived defaults.
- The new adapters are not wired into current Manual/GPS mutation runtime yet; persisted flight semantics remain unchanged in F1.1.
- Verification: Verify FlyTally web #998 PASS; TypeScript PASS; full unit/regression **998/998**; PostgreSQL acceptance **63/63**; Browser smoke #379 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A.
- Next: **F1.2 pure normalizer extraction** with `parseFlightInput(FormData)` retained as the compatibility boundary.

### Flight Entry Workflow 3.0 — F1.0 historical aircraft identity preservation
- Added base database migration **v17 — historical flight aircraft identity preservation**.
- Replaced the v6 aircraft-identity trigger behavior without rewriting the already-applied v6 migration.
- Ordinary Manual/GPS-style INSERTs with an empty make/model/variant tuple still snapshot the current matching aircraft profile.
- INSERTs carrying any explicit make/model/variant member now preserve the supplied tuple atomically instead of mixing or overwriting it from mutable current profile state.
- Registration-changing UPDATEs still snapshot identity for the new registration.
- Same-registration UPDATEs no longer refresh historical identity from mutable current profile state.
- Exact backup restore remains compatible with its existing two-stage flow: staged empty identity insert followed by explicit identity restore.
- Added source-contract coverage plus PostgreSQL acceptance for existing certified rows, ordinary inserts, conflicting recipient profiles, partial explicit tuples, same-registration updates, actual registration changes, restore-style second-stage writes and idempotent reapplication.
- **Historical rows:** no existing flight is rewritten or guessed/backfilled by this migration.
- **Certification:** no certification payload/hash/version change.
- **Verification:** final PR head: Verify FlyTally web #997 PASS; TypeScript PASS; full unit/regression **992/992**; PostgreSQL acceptance **76/76**; Browser smoke #378 **26 passed / 2 skipped** across desktop/mobile; production build PASS. Early #987/#989/#371 failures exposed only migration/test-harness defects (PL/pgSQL delimiter, stale v16 fixture extraction, and browser fixture schema drift); each was corrected and the final gates passed.
- **Production:** PR #191 merged as `e7361dbe3e55fbba721ec01c2bffd5c885452c12`; Vercel deployment `dpl_EiEU6pWp95nQuNRGwGVTgtLrgSJn` is READY on `fly-tally.com`. Production Neon records migration v17 `historical flight aircraft identity preservation` applied at 2026-10-01 06:47:01 UTC; the live function/trigger definition was read back and matches the reviewed v17 behavior.

### Flight Entry Workflow 3.0 — F1 design / independent review
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_DESIGN.md` with the proposed source-adapter → typed candidate → pure normalizer → `FlightInput` architecture.
- Kept `parseFlightInput(FormData)` as the proposed compatibility wrapper to minimize Manual blast radius.
- Explicitly kept GPS tracks, expenses, connected crew, certification lifecycle and participation/verifications outside the canonical flight semantic payload.
- Split the proposed implementation into F1.1–F1.6 so Manual regression equivalence is proven before GPS is routed through shared normalization.
- Raised Operation/Engine as a blocking correctness question because current GPS silently stores SP plus class-derived engine, which is not sufficient source evidence for every FCL-style flight.
- Carried the shared-flight identity-trigger issue forward as a migration/integrity design question; no migration has been written.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_REVIEW_HANDOFF.md` for independent read-only review before runtime implementation.
- Independent review returned **APPROVE WITH CHANGES** and was reconciled into the F1 design: F1.0 trigger hotfix first; explicit EASA GPS Operation/Engine before F1 release; unresolved source evidence remains fail-closed; F2 retains Role/Crew ownership.
- **Runtime/schema behavior:** unchanged in this design PR; F1 runtime code has not started.

### Flight Entry Workflow 3.0 — F0 field / consumer contract inventory
- Added the authoritative repository-backed Manual/GPS/Edit/Certification/consumer matrix at `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md`.
- Recorded the current Manual canonical parser boundary versus the remaining GPS direct semantic INSERT path.
- Classified Save requirements separately from Certification requirements, including the existing DUAL UI/server Save-boundary mismatch.
- Recorded certification-hash v1–v8 coverage and explicitly classified non-hashed child/commercial/collaboration data.
- Recorded draft-visible Dashboard/Statistics/Export/Print behavior versus certified-only canonical Recency and certified-source Sharing.
- Recorded GPS parity gaps for sailplane launch evidence, PF movements/approaches, day/night fidelity, night/IFR, professional context, purpose, expenses and non-PIC Role/Crew.
- Identified a cross-workstream historical-identity risk for review: shared-flight INSERT supplies certified source make/model/variant while the v6 flight INSERT trigger can overwrite those fields from recipient current-profile state.
- Recorded CSV/XLS output completeness gaps without changing stored semantics.
- Added source-contract tests to keep the F0 findings explicit before F1 refactors them.
- **Runtime/schema behavior:** unchanged by F0 analysis.
- **Verification:** Verify FlyTally web #982 PASS; TypeScript PASS; full unit/regression **988/988**; PostgreSQL acceptance **55/55**; browser N/A; DB schema/migration N/A. The first #981 attempt exposed only an outdated test assertion for the existing v8 certification hash call and was corrected without runtime changes.

### Flight Entry Workflow 3.0 — F0.1 GPS fail-closed integrity hotfix
- Removed GPS UI/server fallbacks that could silently turn missing aircraft class/logbook context into `ULL`.
- GPS now resolves the selected active aircraft through the same fail-closed aircraft-profile validation used by New Flight defaults; malformed/unavailable context returns **Needs configuration** instead of invented regulatory identity.
- GPS no longer trusts submitted aircraft class/logbook/type as authoritative identity: the active selected aircraft profile is resolved server-side and submitted class/logbook must match that canonical context.
- Interim GPS Role support is intentionally narrowed to **PIC only**; DUAL, Safety Pilot, INSTRUCTOR/legacy `INSTRUKTOR`, Co-pilot, PAX, Observer and crafted unknown roles fail closed until the shared Role/Crew milestone provides complete semantics.
- Removed the visual-review-only hard-coded `ULL` provenance placeholder.
- Preserved existing GPS split/review, duplicate fingerprint, advisory-lock and single-transaction flight/track persistence behavior.
- Added F0.1 domain/source regression coverage plus authenticated browser fixtures for valid EASA/SEP, valid explicit ULL and malformed EASA aircraft context.
- No database schema/migration, certification hash/version, recency rule, historical backfill or broad UI redesign is introduced.
- **Verification status:** PASS on final runtime head before docs closeout — Verify FlyTally web #979: TypeScript PASS, full unit/regression **979/979**, PostgreSQL acceptance **55/55**; Browser smoke #366: production build PASS, authenticated Chromium desktop/mobile **26 passed / 2 skipped**.

### Flight Entry Workflow 3.0 — F0.0 characterization
- Added a characterization-only baseline for the current GPS flight-entry/write path; no runtime behavior changes in this milestone.
- Confirmed UI and server fail-open `ULL` fallbacks, direct GPS flight persistence outside `parseFlightInput()`, empty GPS commander/instructor persistence and draft consumption by Dashboard/Statistics/Export/Print while recency remains certified-only.
- Confirmed the GPS INSTRUCTOR option currently submits non-canonical stored value `INSTRUKTOR`, which receives zero function-time allocation; F0.1 therefore uses **PIC only** as the smallest proven coherent interim GPS role set.
- Added source regression coverage for the current defect/baseline, role mismatch, Manual save-boundary differences, duplicate/advisory-lock transaction behavior and downstream draft-consumer boundary.
- Detailed evidence: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F00_CHARACTERIZATION.md`.
- **Verification status:** DONE — Verify FlyTally web #970 PASS; TypeScript PASS; full unit/regression 971/971 PASS; PostgreSQL acceptance 55/55 PASS. No runtime/schema/deployment change.

### Flight Entry Workflow 3.0 — planning/design freeze
- Added the frozen `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md` contract after Claude Round 1, DeepSeek Round 2 and repository reconciliation.
- Reprioritized the roadmap so the confirmed GPS invalid-profile → `ULL` fail-open defect is addressed before Multi-aircraft M2B.
- Frozen direction: one canonical Manual/GPS semantic normalization boundary; GPS as source/provenance rather than a second flight model; source-agnostic Role/Crew semantics; atomic multi-part persistence; no guessed historical repair.
- Frozen EASA entry behavior: DUAL Instructor/PIC, Safety Pilot Actual PIC and SPIC/PICUS supervision evidence must be immediately reachable and Save-required; certification remains the authority for later certification completeness.
- Recorded the repository-backed consumer boundary: recency is certified-only, while Dashboard/Statistics and Export/Print can consume draft records, increasing the importance of correct evidence/class identity at first Save.
- Defined F0.0 as characterization-only and F0.1 as the minimal GPS fail-closed production hotfix before broader domain/UX convergence.
- This planning change does **not** modify runtime, schema, certification hash/version, recency calculations, GPS persistence or production deployment.

### New Flight intelligent review — form-scope hotfix
- Bound `IntelligentFlightEntryPanel` explicitly to the canonical manual `FlightForm` instead of selecting the first `.flight-form` mounted on the page.
- Prevented manual-entry history/profile advisories from being portaled into the simultaneously mounted GPS import form.
- Deferred intelligent-review FormData resync to the next animation frame after input/change so React-controlled aircraft profile fields are read after their coordinated update rather than from an intermediate DOM state.
- Added source regression coverage plus an authenticated browser reproduction with three recent EASA/SEP records proving a GPS-selected EASA/SEP aircraft does not receive a stale ULL history warning.
- GPS import save/parsing, aircraft profile data, historical flights, certification, recency, billing and persistence semantics are unchanged.

This section tracks changes intended for the next named release. An entry is production-complete only after the corresponding change has been merged to `main`.

### New Flight UI/UX Simplicity — B5 responsive + accessibility closeout
- Delayed ordinary required-field error styling until an explicit save attempt while keeping genuine selected-profile configuration failures immediately visible.
- Converted the existing missing-field summary into focusable blocker navigation that opens the owning native disclosure before focusing its control.
- Preserved native details/summary semantics without redundant ARIA state.
- Restored collapsed evidence summaries on narrow mobile, added earlier iPad/zoom grid reflow and disabled sticky New Flight actions where touch keyboards or very small/short viewports could cause overlap.
- Added coarse-pointer 44px targets and forced-colors treatment for blocker controls.
- Switched the small Flight-experience Change cue to the normal link token; measured canonical New Flight muted/link colors meet WCAG AA normal-text contrast on dark/light panel surfaces.
- Final authenticated screenshot review exposed Flight experience empty-state title/explanation concatenation at 320px/200% reflow; PR #182 fixed it with contextual spacing while preserving the canonical `empty-state` design-system contract.
- No parser, persistence schema, certification payload/hash, recency, collaboration, billing or UTC semantics changed.
- **Verification status:** DONE. PR #179 automated gate PASS; PR #182 Verify FlyTally web #955 PASS and Browser smoke #349 PASS. Final isolated authenticated Browser smoke #352 PASSed with 23 browser tests passed / 3 skipped and produced 132/132 New Flight screenshots (11 states × 6 viewports × light/dark); all 132 matrix records reported 0 px horizontal overflow. Production commit `45a97aacec50e9e7b20d676afd4493c2e896c1fe` is READY on Vercel and aliased to `fly-tally.com`. PostgreSQL schema/migration N/A for the presentation-only closeout.

### New Flight UI/UX Simplicity — B4 optional details + helper-copy triage
- Consolidated Training purpose/Task, Night/IFR, Professional context, Costs/expenses and Notes under one native **Optional details** disclosure.
- Populated Edit records now auto-open Optional details and summarize which optional domains already contain stored/current data.
- Moved Night/IFR duration inputs out of Flight experience while preserving the same form/parser contract and surfacing historical stored values for correction.
- Kept malformed billing fail-closed and auto-opened the containing Optional details disclosure.
- Added embedded Professional context presentation while preserving its existing applicability and hidden-input behavior.
- Removed or compacted repeated aircraft-profile, generic role, cost and Task helper prose while keeping validation, Connection and signed-evidence consequences visible.
- No parser, persistence schema, certification payload/hash, recency, collaboration, billing or UTC semantics changed.
- **Verification status:** merge-ready — TypeScript PASS, reconciled targeted contracts 34/34 PASS, full unit/regression 954/954 PASS, production build PASS on the runtime-equivalent B4 head. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B3 profile + role context
- Aircraft & logbook collapsed summary now exposes actual evidence/logbook, regulatory category, aircraft class and applicable operation/engine context instead of relying on a generic category description.
- Preserved selected-profile origin on new entry while avoiding re-deriving Edit snapshot provenance from mutable current aircraft profiles.
- Invalid or unresolved selected-aircraft context forces the profile disclosure open.
- Replaced **Crew & training** with role-driven **Role details**; DUAL, Safety Pilot, SPIC and PICUS required evidence auto-opens in one contextual area.
- Moved structured Training purpose and Task/exercise into **Optional details** while keeping FlightPurposePicker hidden submission semantics unchanged.
- No parser, persistence schema, certification payload/hash, recency, collaboration, UTC or billing semantics changed.
- **Verification status:** merge-ready — TypeScript PASS and production build PASS; reconciled targeted contracts 22/22 PASS; full unit/regression 946/946 PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B2 essentials + movement evidence
- Reordered the always-visible essentials to Date → Registration → Role, followed by grouped Route and one chronological UTC timeline.
- Kept Departure/Arrival and all time fields optional for draft save; certification remains the authority for route/time completeness.
- Preserved live BLOCK/AIR calculation and the `—` unavailable state without inventing `0:00`.
- Flight experience summary now exposes the actual landing/PF evidence-bearing preset state, with a visible Change cue while keeping detailed movement controls behind the same native disclosure.
- Reduced repeated manual-entry intro copy and made Add aircraft contextual when the pilot already has aircraft.
- Added responsive B2 layout rules for desktop, iPad-width and narrow mobile time grids.
- No parser, persistence schema, certification payload/hash, recency or billing semantics changed.
- **Verification status:** merge-ready — local TypeScript PASS, targeted B2/affected historical contracts 47/47 PASS, full unit/regression 940/940 PASS, production build PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B1B completion semantics
- Removed the duplicated inline **Review before save** card and the second `Ready to save` completion state from New Flight.
- New Flight keeps one form-level blocker/consequence surface and one primary **Save & review** action; Edit keeps **Save changes**.
- Removed initial **Save and add another** and moved **Add another flight** to the successful saved-review handoff.
- Relocated selected-aircraft/profile origin and unsaved-change context instead of discarding unique information from the removed review card.
- Preserved the existing `/flights/<id>?tab=logbook&saved=1` review-first handoff, draft-save semantics, certification blockers and PendingActionButton duplicate-submit protection.
- No schema, certification payload/hash, recency, UTC or optional-cost semantics changed.
- **Verification status:** merge-ready — local TypeScript PASS and production build PASS; reconciled targeted B1B/historical contracts 34/34 PASS; full unit/regression 934/934 PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to the later live cumulative New Flight redesign check and is not reported as PASS.

### New Flight UI/UX Simplicity — B1A optional Costs
- Added an explicit optional billing parser/serializer so blank billing means **Not tracked** instead of silently becoming BLOCK.
- New Flight and GPS import can save otherwise-valid records without aircraft-cost tracking; populated malformed billing still fails closed.
- Aircraft profile defaults now support explicit no-billing configuration while preserving configured BLOCK/AIR + share values.
- Untracked flights do not resolve or snapshot an aircraft hourly rate, and dashboard/list cost aggregates treat them as zero cost contribution instead of implicit BLOCK.
- Aircraft sharing preserves no-billing defaults and rejects/surfaces malformed populated billing rather than silently clearing or repairing it.
- Read-only billing labels distinguish **Not tracked** from malformed persisted billing (**Unavailable**).
- Legacy billing helpers remain compatible for untouched historical callers; certification, recency, UTC and crew-credit contracts are unchanged.
- **Verification status:** merge-ready — TypeScript PASS; targeted B1A 35/35 PASS; stale-contract rerun 55/55 PASS; full unit/regression 928/928 PASS; production build PASS; read-only production DB metadata confirms both billing columns are nullable text with legacy BLOCK defaults and no billing CHECK constraints, so no migration is required. Protected Preview was READY but authenticated smoke is explicitly deferred to a live post-merge check because Preview has no DATABASE_URL; the deferred check is not reported as PASS.


### New Flight UI/UX Simplicity — B0.5 integrity baseline
- Added a fail-closed selected-aircraft profile-default resolver that reuses the canonical M1 validator and rejects defaults when validation would repair or replace the stored evidence/class.
- Valid ULL profiles remain ULL; invalid/missing legacy profile context now surfaces as **Needs configuration** instead of silently falling back to ULL.
- Preserved stored same-aircraft Edit snapshots; changing to another aircraft and back restores the original stored aircraft-dependent snapshot instead of leaving mixed temporary-profile state.
- Added a complete golden EASA SEP PIC `parseFlightInput()` payload baseline plus source coverage proving manual Create and Update continue through the same canonical parser.
- Recorded the approved Role / normal landing / PF preset policy and scenario-specific decision-density baseline for later UX comparison.
- No schema, certification hash/version, recency calculation, connection/PIC materialization or UTC semantics changed.
- **Verification status:** PASS — targeted B0.5/M1/manual-entry/input suite 26/26, full suite 916/916, production build PASS; TypeScript PASS on the runtime-equivalent head and again inside the final production build. PostgreSQL N/A; dedicated browser matrix deferred by design to the presentation batches because B0.5 does not alter the normal validated-aircraft fixture path.


### General PIC invitation across source roles
- Generalized explicit post-certification `PIC` invitation beyond Safety Pilot to every recognized canonical stored source role.
- Added schema migration v16 with invite-time PIC commander provenance (`CERTIFIED_SOURCE_COMMANDER` vs `RECIPIENT_ACCOUNT`) and one-active-PIC-per-source-revision protection.
- Preserved the dedicated Safety Pilot Actual-PIC workflow and certified source commander semantics.
- Added generic PIC sharing through Crew & logbook sharing, with accepted-Connection, exact revision/hash, owner and re-share guards.
- Generic PIC materialization uses recipient account commander semantics and carries the complete certified event data while recalculating recipient role/credit as PIC.
- Added source/unit and PostgreSQL acceptance coverage for provenance, migration constraints, generic INSTRUCTOR→PIC materialization, movement/night/IFR copy, duplicate/reinvite and active-PIC guards.
- **Verification status:** local TypeScript PASS; 909/909 unit/regression PASS; production Next.js build PASS; PostgreSQL full acceptance 66/66 PASS across 24 integration files; authenticated Chromium desktop/mobile 22/22 PASS; migration v16 validated, applied to production Neon after explicit approval, and post-verified.
- PR #169 merged as `a51e8bb13f702c9a04337bff19755ad614ccfcc1`. Vercel production deployment `dpl_9ba1sxfaZ1yyBVPFwcBdF3S9B8W3` reached READY and the canonical public endpoint returned HTTP 200.

### Safety Pilot ↔ PIC lifecycle closeout — SP5
- Added release-level lifecycle coverage for certified-source corrections, pending invitation supersession, cancellation, decline and PIC reinvitation.
- Verified source correction preserves the connected-PIC link and does not rewrite already materialized recipient-owned records.
- Verified PIC reinvite may reopen declined/cancelled requests but cannot reset accepted/materialized participation.
- Kept certification payload/version unchanged and introduced no new schema migration.
- Extended authenticated browser coverage through cancel → reinvite → pending → cancel and revoked-Connection fail-closed behavior.
- Verification: 900/900 unit/regression PASS; PostgreSQL core 48/48 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS; production build PASS.
- Existing migration v15 remains the production-verified prerequisite; SP5 itself has no database migration.
- PR #166 merged; the Safety Pilot ↔ PIC workflow is complete in the repository through SP1–SP5. Production deployment status is tracked separately.

### Safety Pilot ↔ PIC materialization + recency — SP4
- Enabled the dedicated Safety Pilot → PIC participation to materialize an independently owned recipient PIC flight.
- Recipient PIC commander now comes from the certification-protected source `commander`; existing non-PIC materialization behavior is unchanged.
- Added PIC-only acceptance/materialization guards for exact source revision/hash, source Safety Pilot role and a live accepted Connection.
- PIC minutes use the canonical crew-credit path; the source Safety Pilot record remains non-PIC credit.
- Shared-flight PIC preview preserves the certified source commander.
- Added recency proof showing a materialized PIC record behaves like an equivalent ordinary PIC record while the source Safety Pilot contributes no qualifying PIC movements.
- Added PostgreSQL acceptance for independent ownership, duplicate reuse and revoked-Connection fail-closed behavior.
- Verification: 895/895 unit/regression PASS; PostgreSQL core 48/48 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS; production build PASS.

### Safety Pilot ↔ PIC certified invitation — SP3
- Added a dedicated post-certification Actual PIC invitation action for certified Safety Pilot flights.
- The recipient is derived only from persisted connected-PIC metadata; no arbitrary client-supplied PIC participant ID is accepted.
- Invite creation rechecks source ownership, Safety Pilot role, certification hash/revision state and live accepted Connection status.
- Kept PIC excluded from the generic crew-sharing selector and rejected by the generic invite action.
- Added a separate certified Actual PIC panel with pending/cancel/reinvite states and live revoked-Connection fail-closed messaging.
- Kept recipient PIC materialization intentionally blocked for SP4.
- Verification: GitHub Verify FlyTally web PASS; 890/890 unit/regression PASS; PostgreSQL core 47/47 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS.

### Safety Pilot ↔ PIC create/edit identity — SP2
- Added an explicit Safety Pilot Actual PIC choice between manual text and an accepted FlyTally Connection; manual entry remains the default and no name matching is used.
- New Flight loads accepted pilot Connection IDs/names separately from instructor suggestions.
- Connected selections are canonicalized server-side from the selected account's current display name after accepted-Connection revalidation.
- Create/Edit synchronize the flight row, expenses and current connected-PIC metadata atomically; switching to manual entry or away from Safety Pilot removes the link.
- Edit/correction reloads stored connected identity by flight ID, including a fail-closed unavailable state when the Connection is no longer accepted.
- SP2 does not send PIC invitations or create participation rows; certified sharing remains staged for SP3.
- Added SP2 source/regression and browser-contract coverage. Final verification: TypeScript PASS, 885/885 unit/regression PASS with 0 fail / 0 skip, production build PASS, isolated Neon persistence acceptance PASS, and authenticated isolated Vercel Preview acceptance PASS across desktop, mobile and iPad layouts. Preview testing found and fixed a repeated-save controlled-field reset before merge.

### Safety Pilot ↔ PIC foundation — SP1
- Added tracked schema migration v15 for separate `flight_connected_crew` collaboration metadata with owner-bound FK, one-PIC-per-flight uniqueness, self-link rejection and cascade cleanup.
- Extended shared-flight participation role storage/domain normalization to `PIC`, with an explicit fail-closed `SAFETY PILOT → PIC` combination and canonical PIC-minute credit semantics.
- Added connected-PIC persistence helpers that require an editable Safety Pilot source flight and an accepted Connection before a link can be written.
- Kept the staged rollout fail-closed: PIC is excluded from the legacy generic crew selector, rejected by its generic server action, and not materialized until the later dedicated PIC workflow milestone.
- Added unit/source and PostgreSQL contract coverage for migration, constraints, role mapping and write guards.
- Verified SP1 with TypeScript PASS, 875/875 unit/regression PASS, production build PASS, and isolated Neon PostgreSQL acceptance over real migration constraints and fail-closed write guards.
- Deleted the isolated Neon acceptance branch after verification, then applied the exact verified migration v15 to the production Neon branch as the deployment prerequisite after explicit approval; post-migration checks confirmed the new table/constraints and zero collaboration rows.
- No Safety Pilot PIC selection/invitation UI is shipped by SP1; `FEATURES.md` therefore remains PLANNED.

### GPS touch-and-go detection reliability
- Reproduced a real missed rolling touch-and-go caused by an unrelated near-zero-timestamp altitude pair remaining inside a sparse ±10-point discontinuity window.
- Added anonymized regression coverage proving equivalent touchdown geometry must classify the same despite harmless post-climb point-density differences.
- Bounded rolling-T&G altitude-discontinuity checks to the candidate's own nearest +30 m descent/climb evidence span.
- Kept the existing 28–145 km/h rolling-speed and 30 m descent/climb thresholds unchanged.
- Preserved fail-closed rejection when timestamp/altitude corruption occurs inside the qualifying T&G evidence span.
- Left take-off discontinuity behavior and unrelated point-count grouping/dedup logic unchanged.
- GPS-derived landing totals remain advisory and user-reviewed; no DB/schema/certification behavior changed.

### Multi-aircraft Product Scale — M2A
- Changed type-specific helicopter recency to resolve historical type from stored `flights.aircraft_model`, with bounded legacy fallback to stored `flights.aircraft_type`.
- Removed mutable current-aircraft model and registration as silent historical type fallbacks.
- Added fail-closed LIMITED DATA handling when unresolved historical helicopter type evidence could satisfy an otherwise missing type-specific requirement.
- Kept independently proven CURRENT results current; unresolved unrelated flights do not downgrade them.
- Added PostgreSQL and unit/source regressions proving current profile model edits cannot rewrite historical type resolution.
- No flight rows, certification payload versions/hashes, schema or ULL/Annex-I mapping semantics changed.

### Multi-aircraft Product Scale — M1
- Added one canonical server-side aircraft-profile validator for regulatory profile state.
- Routed normal Aircraft Add/Edit and accepted shared-profile imports through the same fail-closed validation contract.
- Rejected explicit class/category mismatches, incomplete EASA identity, invalid/non-applicable BFCL class/group data and malformed explicit Part-FCL credit provenance instead of silently repairing them.
- Added an actionable shared-profile error path when a received profile cannot be imported safely.
- Added full profile-matrix/source regressions and PostgreSQL acceptance proving malformed shared regulatory profiles do not reach persistence.
- Kept exact backup/restore outside interactive profile canonicalization; no schema, certified-flight payload/hash, catalogue-authority or ULL/Annex-I semantics changed.

### Documentation governance
- Consolidated the roadmap into one current planning document.
- Added a canonical `FEATURES.md`.
- Added a documentation index and historical archive under `docs/history/`.
- Moved old version-specific scope/audit notes out of the repository root without deleting their evidence from Git history.

### Design consistency audit — Batch 9
- Added branded root not-found and runtime-error fallbacks using existing FlyTally page/panel/button contracts.
- Kept runtime error presentation non-technical and added retry plus safe root navigation.
- Replaced the bespoke Push onboarding glass surface with the canonical raised-surface tokens while preserving placement and behavior.
- Closed UX-027 without a visual change after confirming the effective login-card cascade was already 11 px with no backdrop blur.

### Design consistency audit — Batch 10
- Standardized sign-in/join email terminology while preserving the more specific Account email label in Settings.
- Replaced decorative Dashboard lead phrasing with operational all-time totals / Statistics guidance.
- No authentication, input behavior, dashboard calculation, regulatory or stored-data semantics changed.

### Design consistency audit — Batch 11
- Added an explicit non-blocking offline connection banner with automatic online/offline event handling.
- Kept the service worker online-only: no navigation/API interception, offline cache or offline logbook mutation was added.
- Added source-contract and real-browser coverage for banner appearance/removal.

## v3.3 design & workflow consistency — merged through 2026-09-20

### Workflow simplification
- Simplified New flight while keeping aircraft and route selection explicit rather than silently prefilled.
- Simplified the Flights workflow and restored an obvious compact Open action.
- Unified aircraft-card layout and added safe aircraft deletion.

### Design-system consistency
- Consolidated shared tokens, geometry, spacing and tabular numeric presentation.
- Improved light-theme text contrast and moved the legacy GPS chart to theme-aware chart tokens.
- Replaced OS-dependent functional glyphs with the shared SVG icon system.
- Converged empty/loading/component states.
- Hardened accessibility, focus and touch-target behavior.
- Clarified required-field and validation presentation.
- Standardized UTC, viewer-timezone and date-only display formatting.
- Normalized protected secondary route rhythm, Share headers and public/legal layout.

### Engineering workflow
- Reduced unnecessary GitHub Actions usage while retaining risk-based verification gates.

The approved design-consistency audit is complete through Batch 11.


## v3.2 — UI consistency & verification foundation — 2026-09-19

### Changed
- Added route-level UI consistency auditing and shared UI-system regression coverage.
- Added real-browser smoke coverage plus authenticated browser and mutation coverage.
- Added transaction-backed authenticated mutation tests for higher-risk write paths.
- Unified aircraft-card presentation and added safe aircraft deletion.
- Reduced unnecessary GitHub Actions usage while retaining risk-based verification gates.

## v3.0 — UX & Product Consolidation — 2026-09-18

### Changed
- Simplified global Logbook navigation around pilot tasks and moved Notifications into the live activity model.
- Simplified Licences & Recency, Aircraft & airports, Print & data and Settings hierarchies.
- Added personal aircraft-profile sharing and cover photos while keeping recipient copies independently owned.
- Added Web Push subscriptions, preference controls and contextual onboarding.
- Clarified the save → review → certify → share workflow.
- Closed the mobile/accessibility acceptance pass for core Logbook workflows.
- Added/refined the public interactive flight viewer and Share presentation.

### Integrity
- UX consolidation did not redefine certified-record, recency, ownership or regulatory evidence semantics.
- A later FCL.060 ULL same-class correction was merged as an explicit regulatory fix rather than hidden inside UX work.

## v2.9 — Commercial & External Validation technical foundation — 2026-09-18

### Added
- Fail-closed commercial-readiness contract and external-validation ledger.
- Versioned commercial legal publication boundary.
- Provider-neutral billing/entitlement technical foundation.
- Signature-assurance and regulatory-validation boundary.
- Brand/public-claims boundary.
- Final commercial release audit and build guard.

### External boundary
- Technical implementation does not equal lawyer, regulator, trademark, payment-provider or other external approval.
- Public commercial release remains dependent on real external evidence and business decisions where required.

## v2.8 — Compliance & Safety Foundation — 2026-09-18

### Added / changed
- Added privacy self-service, retention controls and cross-product erasure coordination.
- Hardened regulator-facing logbook identity and source-of-truth handling.
- Finalized reviewed map-provider/licensing behavior and browser security controls.
- Added compliance regression coverage for legal, sharing, provider and aviation-safety boundaries.

### Integrity
- Authority acceptance is not inferred from internal implementation or tests.
- FCL.050-oriented engineering traceability remains separately documented under `docs/compliance/`.

## v2.7.1 — Recency hotfixes — 2026-09-09

- Fixed the Recency expiry-date SQL type mismatch.
- Fixed Recency light-theme readability.
- No intentional regulatory-rule expansion was bundled into these hotfixes.

## v2.7 — Data Integrity & Recovery 2.0 — 2026-09-08

### Changed
- Made restore review-first with explicit missing/present/protected-conflict preview.
- Added authenticated current-format portable backup integrity while retaining bounded legacy compatibility.
- Preserved certified revisions, signatures, GPS, sharing evidence, audit history, licences, expenses and recency evidence through the canonical recovery path.
- Added tested large-account transaction batching while preserving atomicity/safety limits.

## v2.6 — Professional Pilot Workspace 2.0 — 2026-09-08

- Expanded professional/operator context and professional-experience reporting.
- Preserved recorded-evidence vs regulatory/employment-conclusion boundaries.
- Kept professional context explicit instead of silently inferring CAT/NCC/SPO or employment status.

## v2.5 — Recency & Compliance Workspace — 2026-09-08

- Consolidated licence/rating validity, flying recency and supporting evidence into a planning-oriented workspace.
- Kept CURRENT / ACTION SOON / NOT CURRENT / INCOMPLETE EVIDENCE evidence-driven and explainable.
- Linked recency presentation to supporting flights, training, signatures and credentials without rewriting certified records.

## v2.4 — Flight Entry & Review 2.0 — 2026-09-08

- Kept one canonical Add flight workflow while integrating review findings near their owning fields.
- Added explicit saved-vs-GPS review before applying GPS-derived suggestions to an existing flight.
- Added final logbook-data review before certification/sharing while preserving certification hashes, revisions and regulatory calculations.

## v2.3 — Large Logbook Performance & Scalability — 2026-09-07

- Retained 10k/50k scale gates and added a controlled 100k read-performance benchmark for production hot paths.
- Reduced Dashboard/Statistics/Print hot-path work through leaner projections, set-wise lookup and scoped aggregation.
- Preserved v2.2 workflow semantics and certified-data integrity while improving scale behavior.

## 2.2.0 — Action Center & Shared Flight Workflow — 2026-09-07

### Added
- Added an authoritative Action Center for unresolved flight invitations, instructor verification requests, aircraft-training signatures and incoming pilot connection requests.
- Sidebar and Dashboard now surface Actions only while a real workflow decision is pending; the badge is derived from workflow state rather than unread notification state.

### Changed
- Notifications remain the update/history inbox and no longer act as the global pending-work signal.
- Needs attention remains separate and continues to contain only actionable data-quality findings from the pilot's own logbook.
- Shared-flight and signature requests reuse the existing Review & add, Review & sign and Decline workflows; inline Action Center decisions disappear immediately after completion.

### Integrity
- Pending shared-flight actions require the exact current certified source revision and hash, so stale requests do not create ghost actions.
- Legacy instructor approvals are de-duplicated when the canonical instructor participation exists, while that participation still counts once as the real action.
- Modern `signature_request` notifications now support the same direct Decline path as other shared-flight requests.
- No database schema, certification fingerprint, verification payload, sharing ownership or audit-trail semantics changed.

## 2.1.0 — Dashboard & Statistics consolidation — 2026-09-07

### Changed
- Dashboard is a stable all-time at-a-glance home without historical period controls; period analysis lives in Statistics.
- Historical Dashboard period URLs hand off to the equivalent Statistics scope instead of silently losing the selected period.
- Career snapshot is a dedicated Statistics workspace and no longer lengthens Overview; its all-time nature is explicit and its period selector is hidden.
- Existing Dashboard saved-layout migration/customization remains intact and analytical widgets cannot be re-added to Dashboard.

### Preserved
- v2.0 category-aware logged-time, certification, sharing, print/export and Dashboard Safety Pilot semantics are unchanged.
- No database schema, regulatory calculation or credential workflow changed in this release.

## 2.0.0 — Multi-category Pilot Logbook — 2026-09-07

### Added
- One canonical regulatory-category capability model for Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other records.
- Category-specific evidence and progressive disclosure inside the existing Add/Edit flight workflow rather than separate category-specific entry pages.
- Multi-category Flights presentation, filters, Statistics, Dashboard, Print/Export and pilot-context handling built on the same category contract.

### Regulatory integrity
- Historical TMG remains Part-FCL unless an explicit Sailplane / Part-SFCL snapshot exists; legacy GLIDER and BALLOON records remain conservatively resolvable without rewriting certified history.
- Part-FCL Aeroplane/Helicopter certification keeps the existing FCL.050 gate, while SFCL/BFCL records are no longer evaluated with aeroplane SP/MP, SE/ME or BLOCK-time assumptions.
- Sailplane/Balloon credited time uses AIR semantics where applicable; powered/ULL activity retains BLOCK semantics. Safety Pilot remains dashboard activity only and does not inflate regulatory pilot experience.
- Certification fingerprints, certified revisions, sharing, trash/restore and portable backup preserve category, launch and BFCL evidence.

### Hardening and release gate
- Conservative runtime migrations do not rewrite certified historical category evidence.
- RC acceptance covers historical accounts, certification, sharing, backup/restore and mixed-category PostgreSQL behavior.
- The release gate includes TypeScript, complete regression tests, PostgreSQL acceptance, retained 10k/50k scale evidence, production Next.js build and Vercel production verification.

## 1.62.0 — Sailplane / SPL / TMG support — 2026-09-01

### Added
- Explicit aeroplane/sailplane regulatory context so TMG records are not silently reclassified between Part-FCL and Part-SFCL.
- Non-TMG sailplane launch method/count evidence and explicit SPL TMG day/night take-off evidence.
- SPL recency evaluation for sailplane/TMG privileges, passenger currency, launch-method recency and proficiency-check evidence.
- Portable backup v9 coverage for SPL proficiency-check evidence.

### Integrity
- Flight certification fingerprint v5 protects regulatory category and launch evidence while historical v1-v4 fingerprints remain verifiable.
- Sharing and trash/restore preserve the new regulatory/launch fields.
- Sailplane protected-record presentation is labelled Part-SFCL rather than FCL.050.

### Preserved
- Existing TMG history remains Part-FCL unless SPL context is explicit.
- GPS never invents launch methods.
- SPL TMG take-offs remain separate from Part-FCL FCL.060 PF movement evidence.

## 1.61.0 — Category-aware Flight Entry — 2026-09-01

- Blank New flight remains neutral until an aircraft is selected.
- Aircraft-dependent experience controls adapt to the selected profile category inside the existing Add flight workflow.
- Role remains flight-specific and is never replaced by aircraft selection.
- The category layer is presentation-only; existing regulatory calculations remain authoritative.

## 1.60.1 — Licences Navigation Cleanup — 2026-09-01

- Kept section tabs as the single normal Licences navigation layer.
- Kept status rows compact and read-only while detailed evidence remains in dedicated sections.

## 1.60.0 — Adaptive Pilot Workspace — 2026-09-01

- Added an adaptive Licences Overview that shows only relevant credentials, privileges and documents.
- Separated credential validity from flying recency and kept items needing attention prominent.
- Continued to delegate LAPL(A) recency to the existing authoritative Recency Engine.
- Added presentation-only pilot-category classification as groundwork for additional aircraft/licence categories.

## 1.59.2 — Manual Entry Defaults & Aircraft Profile Integrity — 2026-09-01

- New manual flights no longer preselect the previous aircraft registration.
- Departure no longer inherits the previous arrival or configured home airport.
- Aircraft-dependent logbook/class/billing state remains neutral until the pilot explicitly selects an aircraft.
- Explicit aircraft selection reapplies the complete aircraft-dependent profile state (type, logbook, class, engine derivation, operation mode baseline, billing/share and hourly rate) in one interaction.
- Flight-specific role remains untouched when changing aircraft, preserving the v1.53.1 state-integrity boundary.
- Additional expenses and all v1.59 financial behavior are unchanged.

## 1.59.1 — Database Migration Hotfix — 2026-09-01

- Fixed production startup failure `Unknown database migration 14`.
- Added the v1.59 structured-expense schema to the primary sequential database migration runner.
- No flight, regulatory, certification, expense ownership or currency semantics changed.

## 1.59.0 — Flight Entry Structure & Expenses — 2026-09-01

### Added
- Structured personal flight expenses: Landing fee, Handling, Parking, Fuel or a custom Other item, each with amount and currency.
- Currency-grouped totals with no implicit FX conversion.
- Portable backup v8 and trash/restore coverage for personal expenses.

### Changed
- Reorganized manual entry into Flight essentials, Flight experience, Crew & training, Aircraft & logbook, Costs and Notes.
- Day/night landings, Night/IFR time and EASA PF/movement evidence now live together under Flight experience.
- SPIC/PICUS countersignature evidence now lives with Crew & training.
- Notes are no longer mixed into Costs.

### Privacy & certification boundary
- Additional expenses are owned by the current user and are not copied to shared-flight participants.
- Expenses remain outside the certified flight fingerprint/revision, so financial metadata can be maintained without rewriting regulatory evidence.

### Verification
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V159.md`.

## 1.58.0 — Flight Entry Polish & Smart Defaults — 2026-09-01

### Removed
- Quick Routes from New flight, including the unnecessary recent-route query on that page.

### Changed
- Local flight is now a small contextual `Use DEP for local flight` action below Arrival rather than a separate route-shortcut block.
- Aircraft-profile defaults are explained next to Registration and the initial role, so automatic values are visible rather than surprising.
- Existing required selectors show inline missing-state guidance in addition to the final Review summary.
- Departure and Arrival disable mobile autocorrect/spellcheck for cleaner airport-code entry.

### Preserved
- No new regulatory inference and no change to flight parsing/storage, recency, movements, certification, aircraft identity, GPS evidence, sharing, export or backup semantics.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + production CI/runtime audit.
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V158.md`.

## 1.57.0 — Flight Entry Workflow Simplification — 2026-09-01

### Added
- Recent-route shortcuts in manual New flight using FlyTally's existing route-history query.
- Explicit local-flight shortcut to set arrival equal to the current departure only when the pilot chooses it.
- Live BLOCK/AIR duration feedback directly below the timeline.
- Human-readable missing-field list in the final review card.

### Changed
- Logbook and Cost sections open automatically when they contain a missing or relevant required choice, without auto-closing after completion.
- Manual/GPS source selection is more compact on mobile.
- Entry-progress wording reflects the actual inline review workflow.

### Preserved
- No change to flight parsing/storage semantics, regulatory calculations, EASA movement evidence, certification/revisions, aircraft identity authority, GPS evidence, sharing, print/export or backup/restore.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + post-deploy runtime audit.
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V157.md`.

## 1.56.0 — Mobile Layout Audit & Responsive Hardening
- Added the shared iOS/WebKit native date/time sizing fix and a primary-navigation responsive containment audit.
- Preserved internal scrolling for genuinely wide tables/navigation rather than hiding page overflow.

## 1.55.0 — Flight Entry Layout & Responsive UX
- Paired Date/Registration, Departure/Arrival, Off-block/On-block, Takeoff/Landing and Role/Day landings into an aligned desktop grid with a logical single-column mobile flow.

## 1.54.4 — Aircraft Picker Selection Close Fix
- Prevented a confirmed aircraft catalogue selection from immediately reopening because of the debounced search effect.

## 1.54.3 — Aircraft Type Catalogue & Smart Aircraft Setup
- Added the structured FAA aircraft-type catalogue, searchable Make/Model/ICAO picker and manual fallback while keeping Part-FCL class separately pilot-confirmed.

## 1.53.1 — Aircraft State Integrity
- Prevented mixed or stale aircraft state when changing registration or aircraft type in flight entry.

## 1.53.0 — Guided Everyday Entry
- Made normal manual entry the default and simplified first-aircraft/profile setup through progressive disclosure.

## 1.52.0 — Codebase Review & Cleanup
- Removed the retired Streamlit/Python runtime and obsolete generated artifacts while preserving the validated regulatory core.

## 1.51.x — Regulatory Correctness Core
- Established the tested FCL.060, LAPL/FCL.740.A, legacy movement, eligible automatic ULL-credit and certification-evidence baseline retained by later releases.