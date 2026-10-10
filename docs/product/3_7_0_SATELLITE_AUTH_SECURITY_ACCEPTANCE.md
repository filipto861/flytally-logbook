# 3.7.0 Satellite API — Security containment and acceptance

**Status:** DRAFT / NOT TESTED ON ACTUAL BRANCH / NOT MERGED / NOT DEPLOYED  
**Source branch:** `fix/3.7.0-satellite-endpoint-auth-containment`, based on `main@ee4f7c2f1939f54e6f2c064453c2969fef636224`  
**Product deployed version:** 3.6.0, no release version selected for this hotfix  
**Scope:** Security-only `style=satellite` tile endpoint. Standard map, Story, source geometry, provider rights, certified flights, DB and openAIP unchanged.

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

First owner-run on Windows PowerShell with `node v24.19.0`: targeted `npm run test:target -- tests/v370-map-tile-auth-behavior.test.ts tests/v370-map-layers.test.ts` **12/13 PASS**, including all five isolated route behavior cases. One source-contract test failed at a brittle literal `\\n` anchor when reading a route with Windows CRLF line endings. Typecheck `tsc --noEmit` **PASS**, Next 16.3.2 build `PASS` (41/41 generated static pages). These are owner-supplied local outputs, **not CI**, and no `git rev-parse HEAD` was included for the run. The test-only correction in `53598df` now searches for `if (wantsSatellite) {` independent of newlines. Re-execution on revised SHA **NOT RUN**. No claim of real Next HTTP, Postgres, Playwright or production gate PASS.


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
