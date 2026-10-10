# 3.7.0 Satellite API — Security containment and acceptance

**Status:** CODE MERGED / VERCEL PRODUCTION READY / LOCAL RELEASE GATE PASS / PUBLIC-DOMAIN 401/400 HTTP SMOKE PASS (10 OCT 2026); STALE CDN/BROWSER CACHE AND AUTHENTICATED PROVIDER ACCEPTANCE PENDING  
**Source branch:** `fix/3.7.0-satellite-endpoint-auth-containment`, based on `main@ee4f7c2f1939f54e6f2c064453c2969fef636224`  
**Product deployed version:** 3.6.0, no release version selected for this hotfix  
**Scope:** Security-only `style=satellite` tile endpoint. Standard map, Story, source geometry, provider rights, certified flights, DB and openAIP unchanged.

## Production emergency containment closeout — 10 October 2026

- Owner approved immediate security deployment, independently of unfinished 3.7.0. [PR #282](https://github.com/filipto861/flytally-logbook/pull/282) squash-merged to `main@00305fb6a37bdbca99cf1a262b7dcb39a74a269a`. The isolated functional candidate was `e27dbc2ed789463f25f8789485806a75417d7744`; code change from tested PR to main was the GitHub squash commit only.
- Owner-local exact candidate `abc156895c0fdb60a9b1ab9129a49530e846241dfe4b785a142df567f4cd3d2b`, `verify:release:risk`: **release_status=PASS** — source **233/233**, domain **20/20**, full Node **1,453/1,453**, typecheck, Next build, risk browser **8/8 desktop and 8/8 mobile**. Browser smoke uses verified standalone PG18 local disposable DB and mocked provider tiles; independent Postgres/scale risk gates N/A. No CI claim.
- Verified Vercel project `logbook`, team `filipito`, production deployment `dpl_JAdh7zGNZmXVQwDLoZ5yeLJvnvsn` in **READY** state, production alias `fly-tally.com` points to this deployment. Package display **3.6.0**, **not** an officially version-bumped 3.6.1 release. No DB migrations. Earlier Draft/NOT RUN and failed fixture checkpoints below remain historical, not current state.
- **Owner-observed live production HTTP smoke PASS (2026-10-10 14:11:01–02 UTC, `curl.exe --noproxy "*"`):** `https://fly-tally.com/api/map-tile/0/0/0?style=satellite` without credentials → **HTTP 401**, `Cache-Control: private, no-store`, `X-FlyTally-Map-Style: unavailable`, `X-Vercel-Cache: MISS`, `Age: 0`; **no `Access-Control-Allow-Origin` header**. `https://fly-tally.com/api/map-tile/0/0/0?style=map&style=satellite` → **HTTP 400**, `Cache-Control: no-store`, `X-Vercel-Cache: MISS`, `Age: 0`. Both edge responses matched the expected containment on the live alias; no provider GET was performed. Exact one-time edge smoke is **not historical cache invalidation**.
- **Still NOT RUN / OPEN:** production Standard map behavior in this deployment, old CDN cache entries and user-browser cached SVG, signed-in and expired/revoked auth, getSession DB-outage behavior, live Esri entitlement/traffic and Story PNG, physical iPad Safari. Do not invoke provider-specific satellite imagery GET or purges without explicit bounded approval.
- **Rollback restriction:** previous deployment `dpl_51zwnZYfFADxeDEyZheTYg9siXD8` has precontainment publicly cacheable Satellite path and is **NOT a safe security rollback**. In a serious regression, use a forward fix that preserves server-side session gating, or explicitly authorize the re-exposure risk after review.

## Risk and revised technical design

Canonical `main` does not verify an authenticated session before entering the ArcGIS provider fetch path for `style=satellite`; it returns `Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000` and permissive CORS for successful satellite SVG. Public UI selector OFF **does not protect this route**. No production provider response, invoice or actual exploitation has been established.

**Patch contract:**
1. Strict style and tile-coordinate 400 behavior unchanged.
2. For Satellite, call live `getSession()` before reading `ARCGIS_ACCESS_TOKEN` or any ArcGIS/cache invocation; unauthenticated/expired/revoked session gets 401, `private, no-store`, no upstream.
3. Signed-in Satellite success uses `private, no-store` and does not emit wildcard CORS. Missing token 503 and provider 502 stay unavailable/no-store, without fabricated imagery.
4. Public Standard `style=map` and legacy omitted style remain accessible and retain their explicit fetch `next: { revalidate: CACHE_SECONDS }` plus existing public response headers.
5. **Do not export `dynamic = "force-dynamic"`** on the combined route: Next 16 GET Route Handlers are not response-cached by default, and global force-dynamic can disable `fetch` caching for the public Standard upstream. Authorization still executes on every Satellite request. Check this *in Next HTTP* before merge.
6. Authenticated Story auto-probe and PNG export continue to use Satellite until a **separate owner decision** changes provider rights/availability. No Satellite selector release, entitlement claim or Story export permission is implied by a session check.
7. Auth/session throws must never turn into an upstream request. DB-outage HTTP status and client behavior need explicit local acceptance, not optimistic assumptions.
8. A separate server-side emergency upstream-disable plan remains needed if **all** authenticated Esri traffic must stop for licensing/cost reasons; the current patch only blocks anonymous traffic. No inherited supplier GET approval.

### Owner-local checkpoint and LF/CRLF portability correction — 10 October 2026

First owner-run on Windows PowerShell with `node v24.19.0`: targeted `npm run test:target -- tests/v370-map-tile-auth-behavior.test.ts tests/v370-map-layers.test.ts` **12/13 PASS**, including all five isolated route behavior cases. One source-contract test failed at a brittle literal `\\n` anchor when reading a route with Windows CRLF line endings. Typecheck `tsc --noEmit` **PASS**, Next 16.3.2 build `PASS` (41/41 generated static pages). These are owner-supplied local outputs, **not CI**, and no `git rev-parse HEAD` was included for the run. The test-only correction in `53598df` now searches for `if (wantsSatellite) {` independent of newlines. The corrected commit was subsequently verified on clean detached PR head `be52aee27945f4833950e2d7c0ab73f82fe2bb63`: targeted tests **13/13 PASS**, source **115/115 PASS**, domain **20/20 PASS**, TypeScript **PASS**, full Node **1,453/1,453 PASS**, Next production build **PASS** (41/41). A real local Next HTTP server on port 3109 returned anonymous Satellite **401** with `private, no-store` and no wildcard CORS, and duplicate-style **400** with `no-store`. Owner-local only; not CI.

The first risk-scoped Playwright execution at that exact old SHA used a separately initialized localhost PostgreSQL 18 instance on port 55433, database `flytally_pr282_browser_tmp`, with identity and empty-schema precheck. Production build and browser DB bootstrap **PASS**. Desktop: **4/5 PASS, 1 FAIL**, mobile **NOT RUN** because the verifier stopped. The failing `GPS map theme changes preserve a live map instance and viewport` encountered `relation "flight_public_shares" does not exist` during test fixture cleanup, before map assertions. Root cause: `tooling/bootstrap-browser-smoke-db.mjs` excludes the lazily created share table, but `e2e/map-layers.spec.mjs` deletes from it before first public-share route use. This is test setup drift, not proven Satellite regression.

A test-only fixture correction now invokes the existing `/f/<synthetic-nonexistent-token>` runtime initializer before cleanup and verifies table existence. No production route, database migration, or provider behavior changed in this follow-up. **Current head verification NOT RUN** until the owner fetches and tests the new exact SHA. Do not reuse the old partial browser result as current-HEAD PASS; the disposable fixture is no longer empty following the prior run and must be reset only after identity/scope checks. CI/CD, authenticated Satellite Next HTTP, real provider and CDN remain NOT RUN.


## Local exact-candidate verification (owner workstation, Node 24)

Run only from a **clean checkout of the actual PR head**; never assume this draft's commit remains unchanged. The existing project workflow is authoritative for choosing risk gates.

```powershell
cd C:\Users\filip\Documents\GitHub\flytally-logbook
git fetch origin
git switch fix/3.7.0-satellite-endpoint-auth-containment
git pull --ff-only
git status --short
git rev-parse HEAD
node --version
npm ci
npm run test:target -- tests/v370-map-tile-auth-behavior.test.ts tests/v370-map-layers.test.ts
npm run typecheck
npm run verify:plan -- --base origin/main
```

The new `tests/v370-map-tile-auth-behavior.test.ts` executes the **actual route function** in a VM with deterministic stand-ins for NextResponse, session and provider fetch, so it tests no-upstream-on-401, signed-in SVG/private/no-CORS, absent token 503, style validation and public Standard; it **does not** boot Next or prove CDN behavior. Node/typecheck/build/PG/browser are **NOT RUN** until their actual commands complete. `npm ci` is necessary only if dependencies are not already installed at the exact lockfile; never modify the lockfile as part of this security patch.

After reviewing the risk plan and verifying a local-only test database target, execute its prescribed aggregate/build/browser/PostgreSQL gates using the repository's `verify:release:risk` workflow. Do not run destructive PG fixtures on production or unverified target; no production Esri/OSM probes are necessary for these local synthetic tests.

### Essential real Next / browser acceptance (not satisfied by VM tests)

- Unauthenticated and expired/revoked-session Satellite = 401, `private, no-store`, no upstream/provider fetch and no wildcard CORS.
- Authenticated Satellite with **local synthetic upstream** = image/SVG response, private/no-store and correct unavailable/fallback when provider fails; authenticated Story preview/export still functions under intended conditions.
- Duplicate/case-variant/malformed style = 400 before session/provider; tile-range errors = 400.
- Standard and omitted-style = public 200 with original headers; ensure actual Standard upstream fetch caching behavior/latency remains unchanged, not merely the response string.
- Smoke desktop and iPad-sized light/dark surfaces, Story PNG, public share Standard-only and no role/session data leaks. Preserve original map center, track playback and GPS import.
- Explicit error outcome when `getSession()` cannot access DB. Fail closed; never fetch Esri on authorization error.

## CDN, browser and production rollout

**Evidence:** Vercel CDN caches successful GETs with `s-maxage` unless disallowed by `private/no-store`, and documents automatic cache purge/fresh deployment cache namespace. See [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache), [cache headers](https://vercel.com/docs/caching/cache-control-headers) and [manual purge CLI](https://vercel.com/docs/cli/cache). This is vendor-general behavior, **not confirmation of this project's actual effective CDN headers/proxy chain**.

- Prior Satellite SVG from `main` had **browser `max-age=86400` (up to 24 hours)** and **CDN `s-maxage=604800` (7 days)**, with stale extension. New code does not retroactively revoke browser-held cached responses, and does not guarantee that any external intermediary cache is purged.
- Before approved rollout, confirm actual project/domain/cache topology (Vercel vs any other proxy), previous effective CDN headers, cache keys including query, domain routing and deployment rollback. Inspect without invoking the live Satellite endpoint until owner authorizes a bounded post-fix 401 smoke.
- Vercel normally clears CDN cache per deployment, but verify `x-vercel-cache`, HTTP status and private/no-store at every relevant production domain after authorized deployment. If necessary, the documented **project-scoped** `vercel cache purge --type cdn` or CDN dashboard purge is an operator action **requiring explicit authorization**; do not purge unrelated projects or assume tag invalidation purges untagged old tile responses.
- Browser-cached public tiles (up to 24h from old headers) are a residual legacy-client behavior. Service worker `public/sw.js` is online-only and does not intercept map requests according to source inspection; this is not a substitute for validating caching in the browser.
- Do not rollback to an old public-Satellite-cache deployment without explicitly accepting the reintroduced exposure. If emergency traffic stop is requested, design server-side containment separately.
- Decide version/patch release and rollback target with owner; currently no bump, no merge/deploy/flag change. Production candidate must be the **same SHA** as exact gate PASS.

## Evidence ledger / DoD

| Evidence | Current status |
| --- | --- |
| Source facts and independent DeepSeek S1.1 review | RECONSTRUCTED / accepted with caveats |
| Synthetic auth route test added | CODE STAGED, **NOT RUN** |
| Source-only contract and doc invariants | Inspected, not a substitute for Node test |
| Typecheck / build / exact-candidate aggregate | **NOT RUN** |
| Isolated Postgres / real Next HTTP / Playwright | **NOT RUN** |
| Provider geometry, licensing, attribution and rate/cost rights | **BLOCKED**, S1.2 |
| CDN/product rollout, native browser, deploy, smoke | **NOT RUN / NOT AUTHORIZED** |
| DB schema migration | **N/A** |

**Next:** run local gate, record exact SHA and evidence, reconcile PR #281 docs into main before merging overlapping documentation only if approved; keep the security runtime patch independently reviewable. Do not claim DONE before testing and owner rollout decision.
