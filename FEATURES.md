## 2026-10-10 — M3-D offline Chromium decode OWNER LOCAL VERIFIED

Owner clean exact source `62c2079dd9cac25104057e792d540a13eefe12c5`: `npm.cmd run typecheck` PASS; `npm.cmd run build` PASS (Next.js 16.3.2, 41/41 static pages); `node --experimental-strip-types tooling/verify-satellite-browser-decode.mjs` PASS using Playwright headless Chromium offline synthetic fixtures (PNG 1x1, JPEG 1x1, SVG natural size 256x256). This is browser image-load/decode smoke only, NOT pixel fidelity, real provider tile compatibility, Safari/iPad, RSS bound, HTTP production-path test, provider license/contract, or approval of production limits. Full suite/CI/production NOT RUN. No runtime provider/route changes; Satellite OFF, no merge/deploy.

## 2026-10-10 — M3-D browser decoder + provider evidence bundle STAGED / OWNER VERIFICATION PENDING

Added isolated opt-in offline Playwright Chromium synthetic PNG/JPEG and embedded SVG image decode smoke at `tooling/verify-satellite-browser-decode.mjs` (blocks non-data URL network access, no production credentials/route/database change). Added `docs/satellite-provider-resource-evidence-matrix.md` with evidence-vs-gap matrix for actual ArcGIS MIME/dimensions/encoding, full decoder, Safari/iPad, Node RSS/concurrency, no-store costs and supplier license. Current synthetic 1x1 fixtures are **not** authoritative provider tiles. Browser test, typecheck, build, full suite NOT RUN for this new commit until owner verifies. No source-backed production policy values, real supplier fetch, provider wiring, Standard/Story/auth/DB changes, merge/deploy; Satellite OFF.

## 2026-10-10 — M3-D synthetic resource lab OWNER LOCAL VERIFIED (31/31 + TypeScript + build)

Owner exact clean source `de8284b91024ef79feb1e710084e41758ba64931`: four targeted suites **31/31 PASS**, zero failed/skipped, `npm.cmd run typecheck` PASS, fresh Next.js 16.3.2 `npm.cmd run build` PASS. Node24 laboratory `node --experimental-strip-types tooling/measure-satellite-lab.mjs 100` completed: synthetic 1x1 JPEG+PNG input 228 B/pair; SVG 602 B/pair; 100 iterations 2.5231 ms (not benchmark guarantee); baseline RSS 59,682,816 B; max sampled RSS 60,948,480 B; end RSS 57,393,152 B. Whole-process sampled snapshots only: no pixel decode, live supplier, network, other workers/concurrency, transient peak proof, or production threshold. Node `MODULE_TYPELESS_PACKAGE_JSON` warning nonfatal; no module config changes warranted. Closes isolated lab instrumentation verification only; provider contract/decode/resource policy remain blocked. Full suite, browser/CI/prod NOT RUN. Satellite OFF, no merge/deploy.

## 2026-10-10 — M3-D resource lab instrumentation STAGED / VERIFICATION PENDING

Added tooling-only `tooling/measure-satellite-lab.mjs` and two `tests/v370-satellite-resource-lab.test.ts` tests. Isolated Node24 probe performs synthetic 1x1 PNG/JPEG structural inspection + Base64/SVG composition (no fetch/provider calls), reports process.memoryUsage RSS/heapUsed/external/arrayBuffers baseline/observed sampled peak/end with process duration, explicitly warns that synchronous sampling misses transient peaks and results are **not production limits or a browser pixel decode proof**. Synthetic envelope is input-derived and not a deployment policy. Tests for JSON evidence format and invalid iteration fail-closed. **Owner test/typecheck/build/measurement NOT RUN on this new source yet**; provider contract, real 256-size format evidence, decode assurance, Next/multi-instance RSS and provider costs still blocked. No live provider, auth, route, Standard, Story, DB, flags, deploy or merge. Satellite OFF.

## 2026-10-10 — M3-D Transport Hardening OWNER LOCAL VERIFIED (44/44 + TypeScript + build)

Owner clean exact source `186e1cc46c7247d01e6266c2949ae4c4886f8159`, Node `v24.19.0`: five targeted Satellite suites **44/44 PASS** (0 fail/skipped), `npm.cmd run typecheck` **PASS**, fresh `npm.cmd run build` **PASS** (Next.js 16.3.2; 41/41 static pages). The test TypeScript union-header mismatch on preceding source `8fc50ecd` was corrected in `186e1cc4`; no production runtime change in that correction. Isolated teardown best-effort and expected required-pair policy fail-closed verified; cancellation **does not prove supplier termination** and quarantined capacity remains conservative. Full suite, broader browser/HTTP rerun, CI and deployment NOT RUN on this source. No live provider/route/Standard/auth/DB/Story/production policy changes. Satellite OFF; no merge or deploy. This closes only isolated M3-D Transport Hardening scope; remaining provider/resource evidence is BLOCKED.

## 2026-10-10 — M3-D Transport Hardening batch STAGED / OWNER RETEST REQUIRED

Based on independent DeepSeek read-only review: source-only isolated hardening of `lib/satellite-bounded-fetch.ts` (best-effort cancellation of unconsumed response bodies on rejected status/MIME/encoding/content-length, late response cancellation after abort race; cleanup rejection swallowed without masking primary errors), `lib/satellite-required-pair.ts` (typed expected pair policy failure), and `lib/satellite-tile-transport.ts` (invalid pair policy -> controlled unavailable). Focused synthetic regression cases added in `tests/v370-satellite-bounded-fetch.test.ts` and `tests/v370-satellite-tile-transport.test.ts`. Cancellation is **not proof of supplier termination**; existing unproven/quarantine contract remains. No production provider wiring, resource ceilings, Standard/auth/route/cache/DB/Story/flag changes. **Tests, TypeScript, build, HTTP/Playwright/CI NOT RUN on this new batch** pending owner clean-SHA local verification. Satellite OFF, no merge/deploy.

## 2026-10-10 — M3-D2b guarded local HTTP acceptance 3/3 PASS (owner evidence)

Owner reported clean source `fa7eaa5ef173ff4441d3a1995e33e6273781a76d` on exact R2D.2 branch; isolated PostgreSQL identity `flytally_satellite_r1_test|flytally_sat_r1|55432` confirmed and disposable schema reset explicitly approved. Fresh `npm.cmd run build` PASS (Next.js 16.3.2 / embedded TypeScript PASS). Guarded `node tooling/verify-satellite-http.mjs` against synthetic local fixture with a common fresh tile-series RUN_ID: **enabled PASS** (anonymous 401; malformed/duplicate 400; revoked session 401; Standard 200; Satellite 200/fallback/502; 13 intercepted synthetic upstream calls); **disabled PASS** (Satellite 503, zero upstream); **missing-token PASS** (Satellite 503, zero upstream). This is **local HTTP-route fixture acceptance only**, not real ArcGIS requests, browser decode validation, live bounded provider wiring, peak memory/RSS evidence, production numeric resource policy, full suite, CI, production smoke or deploy. These latter items remain NOT RUN / unresolved. Satellite production OFF; no merge/deploy.

## 2026-10-10 — M3-D2b valid HTTP fixtures LOCAL VERIFIED

Owner exact clean `fa7eaa5e` 48/48 targeted test PASS and typecheck PASS. Valid image payload fixtures are ready for guarded isolated HTTP acceptance; that acceptance remains NOT RUN. Satellite OFF.

## 2026-10-10 — M3-D2b verified and isolated HTTP raster fixture staged

Owner clean `cdb63df6` 48/48 targeted tests and typecheck PASS. Isolated Satellite HTTP fixture now supplies valid synthetic PNG/JPEG and verifier expects their Base64; guarded local HTTP acceptance not yet run. Live provider untouched, Satellite OFF.

## 2026-10-10 — M3-D2a verified, M3-D2b standalone valid fixture staged

Owner source `6d0993b3` 52/52 targeted + typecheck PASS. Added separate valid PNG/JPEG synthetic bytes and structural/SVG tests for upcoming HTTP fixture migration; no provider wiring, deployment limits or decoder assurance. New tests pending local verification.

## 2026-10-10 — M3-D2a raster Base64 copy avoidance staged

SVG composer now uses an exact-range Buffer view for encoded raster inputs; new tests cover subarray offset and SVG limit. Does not establish decoder/JS string/global RSS budgets. Not provider-wired. Verification pending; Satellite OFF.

## 2026-10-10 — M3-D Batch 1 LOCAL VERIFIED

Owner exact `006ea28f` 98/98 targeted PASS and TypeScript PASS; shared-isolate admission gate contract verified with synthetic values. Still unconfigured and not wired to live Satellite, no deployment-wide limit or raster decoder guarantee.

## 2026-10-10 — M3-D Batch 1 shared admission owner staged

Standalone process/isolate module-level gate owner with explicit fail-closed initialization, immutable policy snapshot, six synthetic regression cases. Production configuration/values and provider wiring unresolved; no runtime activation, Satellite OFF.

## 2026-10-10 — M3-C review correction LOCAL VERIFIED

Owner clean exact `7e4033f1` 92/92 targeted tests PASS + TypeScript PASS. The isolated source modules are locally verified; production Satellite provider integration, shared gate, source-backed resource limits and decoder envelope are unresolved. Satellite OFF.

## 2026-10-10 — Monotonic fractional clock compatibility correction staged

Owner review correction failed 3/90 tests due to fractional `performance.now()` rejected as integer; typecheck PASS. Clock acceptance fixed in isolated tile and fallback modules; two regression tests added. Retest pending; Satellite OFF.

## 2026-10-10 — M3-C review corrections staged

Absolute inherited pair deadline, typed bounded-error reason handling, controlled admission rejection, and defensive fallback input handling staged with regression tests. Isolated only, local retest pending. Live provider and production resource limits unchanged; Satellite OFF.

## 2026-10-10 — Satellite M3-C independent integration review handoff prepared

Added read-only reviewer handoff document for M3-C bounded transport integration. No functional change; reviewer feedback pending. Satellite OFF.

## 2026-10-10 — M3-C Batch 5 owner LOCAL VERIFIED

Clean source SHA `dd9b88d3`: 87/87 targeted PASS + TypeScript PASS for standalone tile transport coordinator. Not wired into live provider; independent review and source-backed production resource policy pending, Satellite OFF.

## 2026-10-10 — M3-C5 isolated tile deadline coordinator staged

Added standalone cross-phase absolute-deadline coordinator and four synthetic regression tests; no live provider integration or production resource values. Owner verification pending, Satellite OFF.

## 2026-10-10 — M3-C Batch 4 locally verified

Owner exact `3f0e29a0`: 83/83 targeted PASS and TypeScript PASS for isolated fallback module. Not connected to live Satellite; raster structural validation is not full decoder validation; no release.

## 2026-10-10 — M3-C4 isolated labels fallback staged, not product-wired

Added source-structural base/labels validation and admitted reference labels fallback subject to inherited tile deadline and fail-closed reason policy. Six synthetic tests staged. Still not production approved or connected; no defaults; Satellite OFF.

## 2026-10-10 — M3-C3 verification: target PASS, typecheck correction pending

Owner SHA `81518cf1` 77/77 target PASS but TS2339 in optional result shape. Source fix staged at `a6fceff`; owner retest required. No live provider wiring or release.

## 2026-10-10 — M3-C Batch 3 required imagery cancellation helper staged

Standalone shared-deadline pair helper now requests cancellation of labels on base failure, uses conservative quarantine and isolated synthetic tests. Still not wired into production provider; fallback/decoder/resource policy pending. Not locally verified on new SHA; Satellite OFF.

## 2026-10-10 — M3-C Batch 2 isolated transport owner LOCAL VERIFIED

Owner exact `8dd125b0` 72/72 targeted tests PASS plus typecheck PASS for standalone pair admission, bounded wrapper and quarantine. Not wired into provider, not a global memory or upstream cancellation guarantee. Satellite OFF.

## 2026-10-10 — M3-C Batch 2 admitted bounded-pair helper staged (not product-wired)

Added isolated pair fetch orchestrator using atomic leases, bounded transport observation and fail-closed quarantine, plus six synthetic cases. No numerical production defaults, provider/route/Standard/Story runtime changes, or release. Owner verification pending; Satellite OFF.

## 2026-10-10 — M3-C isolated pair admission locally verified

Owner exact `cd506648`: 52/52 targeted PASS plus typecheck PASS. Helper remains disconnected from provider; no released behavior or production budget claim, Satellite OFF.

## 2026-10-10 — M3-C Batch 1 pair reservation primitive staged, NOT product-connected

Process-local synchronous atomic pair admission helper for Satellite base and preferred labels, with six synthetic tests; no production defaults or live provider use. Existing Standard/Story/auth unaffected. Owner verification pending; Satellite OFF.

## 2026-10-10 — M3-B signal plumbing owner locally verified

Owner exact `a4ea494f`: 60/60 targeted PASS and typecheck PASS for Satellite request signal in base/preferred/fallback branches. Not proof of bounded upstream termination or production resource safety; Satellite OFF.

## 2026-10-10 — M3-B2 labels signal propagation fix staged

Owner SHA `66f8b294` 59/60 targeted, typecheck PASS; discovered real missing `AbortSignal` on preferred/fallback label calls. Fixed both in provider at `8fbf598c`. Retest required; Standard/Story untouched.

## 2026-10-10 — M3-B2 first Node24 run failed; two test-only corrections staged

Owner 58/60 target FAIL, typecheck PASS on `94b97e2c`; corrected stale source assertion and abort scheduling test without runtime change. New SHA verification pending; Satellite still OFF.

## 2026-10-10 — M3-B2 Satellite AbortSignal wiring staged, verification pending

Satellite route now passes `request.signal` to legacy Satellite provider through an optional trailing argument; preabort and fallback suppression guards added. Does not integrate bounded transport, admission or decoder and cannot stop non-cooperative providers. Standard/Story remain unchanged; not a released feature.

## 2026-10-10 — M3-B Batch 1 local verification

Standalone Satellite lifecycle adapter Node24 owner verified at `3790f05d`: 57/57 target PASS and typecheck PASS. Provider still not connected; no Satellite activation or release implications.

## 2026-10-10 — M3-B Node24 import correction awaiting owner retest

Standalone lifecycle module test loading failed from extensionless import at owner SHA `02d8acc1`; minimal `.ts` extension correction staged on `5e1cbf2`. TypeScript on prior SHA PASS; new test outcome pending. Satellite runtime unchanged.

## 2026-10-10 — M3-B observational lifecycle adapter staged (not connected)

New standalone local supplier-start observation / conservative termination-unknown classification and six synthetic tests. Does not change production Satellite, Standard, Story, auth or runtime. No claim of upstream termination; owner verification pending.

## 2026-10-10 — M3-A independent review incorporated; implementation pending

M3 lifecycle requirements updated after APPROVE WITH CHANGES review; local completion cannot prove remote operation termination, quarantine remains fail-closed. Provider not yet wired, no visible feature changes; prod Satellite OFF.

## 2026-10-10 — M3-A Satellite provider lifecycle specification drafted; NOT IMPLEMENTED

Added `docs/r2d2-m3a-provider-lifecycle-review.md` specifying planned shared admission accounting, settlement-versus-wrapper timeout, uncertain-operation quarantine, required base and optional labels fallback, valid raster fixtures and decoder-policy review. Read-only independent review pending; no user-facing feature, runtime or release change. Production Satellite OFF.

## 2026-10-10 — R2D.2 M2c-C owner LOCAL PASS; M3 integration review before provider changes

Owner Node24 on exact `7baefdf7d6ec75878b566853052238698774abb4`: targeted M2a/M2b/M2c-A/M2c-B/C/map **69/69 PASS**, TypeScript PASS. Standalone quarantine guard retains unsafe unknown in-flight reservations but not wired into Satellite provider. Actual Satellite provider still Next 7-day cached and `arrayBuffer()`, route does not forward request abort, browser fixture supplies MIME-labeled marker strings. M3 read-only independent contract review now next before runtime coding; new user-facing behavior NOT IMPLEMENTED, prod Satellite OFF.

## 2026-10-10 — Satellite M2c-C fail-closed uncertainty quarantine STAGED, not product-wired

Existing process-local admission gate can now mark an operation of unknown completion `quarantine()` and retain capacity even if `release()` is later invoked; expose quarantined count without secrets. Four synthetic cases staged, includes uncooperative supplier simulation. Prior M2c-B owner 65/65 targeted + typecheck local PASS on earlier SHA, current quarantine code **NOT RUN**. No automatic recovery/claim of upstream termination, global concurrency or RSS guarantee. No Satellite provider/route modification, production Satellite OFF.

## 2026-10-10 — Satellite R2D.2 admission ledger LOCAL VERIFIED; uncertain transport quarantine design next

Owner at exact `9c5be031474ae40d2badfbc9cddce38c297e93a1`: 65/65 combined M2a/M2b/M2c-A/M2c-B/map tests PASS and TypeScript `tsc --noEmit` PASS. Admission ledger remains standalone; real Satellite provider still uses seven-day Next Data Cache and old unbounded body read. Next M2c-C fail-closed lease quarantine for transport operations whose cancellation cannot be verified; no assumed global resource bounds, no user-visible change, Satellite production OFF.

## 2026-10-10 — R2D.2 M2c-B process-local admission helper staged, production NOT CONNECTED

Added standalone no-default per-instance `createSatelliteAdmissionGate` with count and aggregate reserved input byte admission, BigInt accounting and idempotent release; 10 synthetic unit cases plus GPS-risk ownership. This is deliberately only per process, with no queue, no actual memory allocation and no proof of upstream cancellation or cross-instance limits. M2c-A owner 55/55+typecheck LOCAL PASS on older SHA; M2c-B Node24 tests NOT RUN. Product Satellite provider/route, public Standard, Story, auth and prod OFF unchanged.

## 2026-10-10 — R2D.2 M2c-A standalone SVG cap OWNER LOCAL PASS, not product-wired

Owner exact `e5d1bb0434c40f939bd9a5e9890fa5ff8f977233` Node24: target M2a+M2b+M2c-A+map **55/55 PASS** and `tsc --noEmit` PASS. This verifies injected SVG/encoded-size/pixel/nominal RGBA policy checks for selected imagery, not process-wide memory, concurrent provider read or real image decode. Next per-process reservation design and source-backed technical runtime limits; production endpoint/cache untouched, flag OFF, PR Draft.

## 2026-10-10 — R2D.2 M2c-A aggregate SVG envelope staged (not connected)

New standalone `composeSatelliteSvgBounded` enforces caller-specified finite positive combined encoded, pixel, nominal RGBA and final SVG/Base64 limits on selected base + optional labels before output allocation, with overflow-safe accounting and original SVG output shape. Test-only 8-case suite staged and GPS ownership registered; **Node24 repo verification not yet performed**. Current Satellite provider/route, Standard map, Story and production flags unchanged. This is neither a full decoder nor a hard process/parallel memory bound; technical evidence/limits and M3 later.

## 2026-10-09 — Satellite R2D.2 technical focus confirmed; licence/account review deferred

Owner requests to **skip further licensing questions during technical development**. Continue Option B bounded `no-store` Satellite pipeline, real image-integrity/decoded-resource checks and isolated reproducible tests. Historical licensing/attribution material remains unverified; not declared approved or removed. No user-visible feature or production flag change. M2c technical readiness remains open; M2a/M2b local PASS, M3 not connected.

## 2026-10-09 — M2c Esri official data sources identified; supplier license/budget still OPEN

Read-only official Esri docs confirm existing World Imagery and Imagery Labels service URL shapes, required attribution and published ArcGIS Location Platform basemap-tiles price model (2M free then USD 0.15/1,000), not account-specific charges. Satellite map and Story already show provisional Esri/provider credits; exact actual source credits and SVG/PNG reuse rights remain unverified. No actual ArcGIS tile measurements, supplier bandwidth, hosting resource figures, full raster decoder proof or production numeric limits. M3 still blocked. No user-facing code changed.

## 2026-10-09 — Satellite R2D.2 M2b structural validator owner LOCAL PASS (not live feature)

Owner verified exact `93f370ed357345349829d17495b079e17742f38e`: 47/47 targeted M2a+M2b+map tests PASS and TypeScript `tsc --noEmit` PASS; corrected 1×1 JPEG accepts, malformed DQT rejected. Helper and structural validator remain independent of production Satellite/Standard routes, cannot claim full image pixel decode or production numeric resource budgets. Next is M2c ArcGIS/hosting supplier evidence and decoder/resource contract, then M3 provider integration. Satellite OFF, unmerged Draft.

## 2026-10-09 — R2D.2 M2b test failure corrected in fixture only; not product connected

First M2b owner run exact `5c7efca94c9dfd50bed71b58eaa0d547aa288626`: **45/46 PASS; 1 fail** in positive JPEG fixture and `typecheck NOT RUN`. Source artifact was malformed (DQT segment misalignment); an independently decoded Pillow 1×1 JPEG with pinned SHA256 and negative regression replaces it in tests; validator and provider runtime unchanged. Correction awaits fresh owner Node24 target/test and typecheck. M2b NOT CLOSED, Satellite OFF/unmerged.

## 2026-10-09 — R2D.2 M2b standalone raster structural checker staged; NOT RELEASED

New parser `inspectSatelliteRaster` checks matching PNG/JPEG MIME, mandatory structural markers and full length/CRC/segment framing on a previously bounded response, returning dimensions without interpreting pixel data. Dedicated encoded tiny PNG/JPEG fixture tests and invalid/truncated/mismatch tests staged, GPS owned. Does **not** decode image pixels, establish production supplier formats, set byte/decompression/pixel limits or modify actual Satellite/Standard API behavior. New M2b test/typecheck NOT RUN; next requires local evidence. Satellite production OFF, Draft PR.

## 2026-10-09 — R2D.2 M2a independent bounded transport LOCAL TESTED, NOT PRODUCT-CONNECTED

Owner-run on exact `e6dcd147ab52b684cdcef2f63f15516c88fd1ed3`: 14 M2a helper tests plus 23 map/Satellite source regressions **37/37 PASS**, TypeScript `tsc --noEmit` PASS. Source-only helper retains forced `no-store`, externally supplied numeric ceilings, total abort/deadline, streaming checks; still no real provider integration and no true PNG/JPEG structural verification. Next M2b. No production flag, map, Standard, Story, provider, DB or deploy change.

## 2026-10-09 — R2D.2 M2a bounded transport utility staged; NOT connected to user-facing Satellite yet

New isolated `fetchSatelliteBounded` helper has caller-required finite positive byte/time limits, no-store fetch, deadline/abort linkage, streamed byte accounting, JPEG/PNG MIME allowlist, strict identity/declared-length checks and sanitized failure codes. Separate tests and GPS risk ownership registered. This **does not** validate actual raster structure, cap process-wide concurrency, deploy a budget, remove provider cache, or change real `/api/map-tile`. Tests NOT RUN. Approved future direction remains Option B for Satellite only; Option C cache deferred, public Standard unchanged and Satellite production OFF.

## 2026-10-09 — R2D.2 owner-approved Option B (design decision, not yet user-facing)

Owner selects controlled **uncached** bounded Satellite provider requests with explicit timeout, byte accounting, validation, cancellation and global work protections, accepting potential unknown increase in supplier requests/cost vs seven-day Next upstream cache. Public Standard cache and authentication remain frozen. Separate bounded validated cache is deferred, not implemented. Immediate standalone M2a transport/test milestone is NOT connected to map runtime; source-derived numeric production budgets and Esri terms remain unverified. Satellite prod OFF, PR #279 Draft, no merge/deploy.

## 2026-10-09 — R2D.2 architecture REVIEWED (cache decision pending; bounded provider NOT shipped)

Independent DeepSeek review `APPROVE WITH CHANGES` reconciled with current Satellite provider: Next seven-day fetch cache can continue upstream reading after application reader cancellation and its storage cap is not a memory admission bound; current provider buffers full unbounded body and checks only Content-Type prefix. Recommended controlled uncached bounded fetch (Option B) with explicit independent deadline, per-stream byte counting, raster validation, cancel/cleanup, final SVG and concurrency constraints; optional separate validated cache (Option C) after owner approval and licensing/ops evidence. No owner cache policy decision made yet; existing cache unchanged. Authenticated A4 real-route synthetic HTTP local baseline PASS, production memory hardening not implemented; Satellite remains OFF, PR Draft.

## 2026-10-09 — Satellite A4 authenticated HTTP baseline LOCAL PASS (not released)

Real `/api/map-tile` on local production-mode Next16.3.2/isolated browser session and fake provider PASS at source `0577f9488e89709f748be790a71805207e5d11ae`: enabled Satellite 200 and error/fallback paths, denied unauthenticated/revoked 401 and malformed style 400, disabled and missing-token Satellite 503 with zero Satellite upstream, public Standard 200. Disabled total fixture event count 1 is a Standard tile, not satellite; missing-token 0. Approved dedicated test-DB bootstrap executed, `npm.cmd run build` including TypeScript PASS. **Feature implemented as experimental code but production still OFF/unmerged Draft**; bounded memory, true image validation, timeout and cache policy NOT delivered. DeepSeek cache architecture review and product-owner decision next; no production activation.

## 2026-10-09 — A4 isolated test database reset permitted (no product change)

Owner consented to test-only `public` schema recreation in specifically verified local `127.0.0.1:55432/flytally_satellite_r1_test` as `flytally_sat_r1`. This is permission for guarded A4 verification, not evidence of test execution, runtime implementation or release. No other database authorized; production Satellite OFF.

## 2026-10-09 — A4 real-route test precondition DB identity passed (NOT PRODUCT)

Owner read-only URL plus live PostgreSQL identity guard confirmed `flytally_satellite_r1_test|flytally_sat_r1|55432` on `127.0.0.1` for A4 fixture on exact `4940bdd04523bd9e4aae6df45cf6c56a4b713cb7`. No data changed. Destructive reset approval still **NOT GIVEN**; authenticated HTTP baseline NOT RUN. Product satellite provider/route and production flag untouched.

## 2026-10-09 — R2D.2-A4 authenticated HTTP baseline: 23/23 static local PASS only

Owner confirmed on exact SHA `f148f6b3f7f85bc8eef21f59124dab5cccfa5bfe` that isolated HTTP verification harness syntax and targeted 3.7.0 map/Satellite source suite **23/23 PASS, 0 failed**; includes A4 guarded exact branch option. No authenticated browser/prod-build/test-DB or real HTTP assertions have been run at this SHA. Disposable DB reset permission/identity remains an explicit gate. Product feature implementation unchanged and not production activated.

## 2026-10-09 — R2D.2-A4 real Satellite HTTP baseline harness (TEST-ONLY, NOT VERIFIED)

Guarded local authenticated `/api/map-tile` integration fixture can now opt into R2D.2 **only** via `FLYTALLY_SATELLITE_HTTP_A4=1` on its exact named branch, reusing required dedicated local Postgres fixture, clean tree, Node build, fake provider token and remote socket denial, with enabled/disabled/missing-token assertions. Added static source guard; no application map-provider or route behavior changed. Local database bootstrap is destructive to the specified **test database**, not approved for another DB. Fixture image bytes remain old marker-text test content and are not an image validation benchmark. **A4 NOT RUN.** Satellite remains OFF in production, no deploy.

## 2026-10-09 — R2D.2-A3.3 memory diagnostic (lab observed; Satellite feature NOT RELEASED)

On exact locally run R2D.2 source `c2fb2dc6ee69f62c482dc6271b828980fc8360bb`, fast finite 2×16MiB cached and 2×16MiB uncached synthetic test batches completed all application reads while reporting whole-Next-child RSS peak 267MiB in cached window and 226MiB in sequential uncached window (not comparable per-fetch overhead). Both cached 16MiB fetch cache entries subsequently rejected by Next's 2MB storage cap, without protecting upstream memory/byte ingestion. A3.3 laboratory evidence collected, NOT a hard limit, independent real-provider or production Satellite route verification. Future feature still requires source-backed budget, robust request-signal/whole-body abort, byte/MIME validation and reviewed cache strategy. Proposed next A4 authenticated synthetic production-route parity. No public Standard/Story/Auth/DB/Training/production flag changes; Satellite remains OFF, Draft #279.

## 2026-10-09 — R2D.2-A3.3 finite rapid / concurrent test harness (STAGED, NOT PRODUCT)

Test-only miniature Next.js laboratory gained `--pressure-only` using two simultaneous 16MiB local sources under cache and then no-store, backpressure-aware rapid streaming and 20ms child memory samples, guarded by explicit test completeness checks. Four requests total, no real provider, DB/auth/flight data or remote sockets. A3.3 syntax/build/measurements NOT RUN. This does not ship a Satellite memory limit, validated provider cache, rate limit or new map behavior. Prod Satellite OFF; no merge/deploy.

## 2026-10-09 — R2D.2-A3.2 confirmed lab behavior, still NOT DELIVERED

Next 16.3.2 isolated request cancellation diagnostic verified by owner files at exact `808819637f354f855b287e46252f29ecadcdad7f`: incoming `request.signal` fired with a disconnected client in both cached and uncached modes; explicit signal-to-server-AbortController linkage stopped the synthetic upstream quickly, unlike passive observation. Limits: whole-process memory and queued fixture writes only; not a proven global limit or production route behavior. Future bounded Satellite I/O still pending A3.3 fast/concurrent analysis, authenticated route parity, cache policy and approved budgets. Satellite stays OFF, Draft/unmerged; no user-facing app changes.

## 2026-10-09 — R2D.2-A3.2 lab request-signal/AbortController comparison (STAGED / NOT RUN)

Manual isolated mini Next test instrumentation now records whether an incoming `Request.signal` event occurs when its HTTP client disconnects, with `observe` and explicit `link` variants for cached/uncached upstream requests. JSONL signal trace is stored only under ignored local `tooling/r2d2-cache-spike/reports/`; `--signal-only` runs four new cases without re-running old experiments. Product provider and public/Story/Map/auth behaviors remain unchanged. No hard timeout, size limit, global quota, deploy or Satellite activation; A3.2 evidence NOT RUN.

## 2026-10-09 — R2D.2-A3.1 downstream disconnect lab observation (NOT a shipped feature)

Local controlled mini Next `fetch` test on exact `911b95864303cfdf95a52be64082e3508ac2aa7e`: abort of its HTTP client at ~300ms left independently running server-side cached and uncached upstream fetches to finish writing full 16MiB. The route never linked `request.signal`; framework signal timing remains unproven. A3.1 is diagnostic evidence only, not an implementation of provider timeout/cancellation or a hard memory bound. Next A3.2 signal-link observation, separate concurrency/production-route parity, reviewed budgets required. No product runtime changes, no activation, merge or deploy.

## 2026-10-09 — R2D.2-A3.1 synthetic client-disconnect diagnostic (TEST TOOLING ONLY)

The manual isolation harness now supports cached/uncached **downstream HTTP client disconnect** observations against a local mini Next route while it fetches finite synthetic stream data. Diagnostics compare resulting source completion/close; they do not implement or establish production cancellation. No real provider traffic, DB, auth, Satellite runtime, Story, Training, merge or deploy. A3.1 syntax/build/test NOT RUN. Future bounded-provider feature remains blocked on measured cache policy and owner-reviewed budgets.

## 2026-10-09 — R2D.2-A2 cache-sibling laboratory finding (DIAGNOSTIC, NOT PRODUCT)

On verified local diagnostic source `34e216d792b83c1bb5435c7e8effcb5d40ae49e0`, synthetic Next 16.3.2 `reader.cancel()` without `AbortController.abort()` let the **cached** source finish emitting all 16MiB after the application consumed ~64KiB, while uncached reader-only cancel closed the source after 64KiB. A Next cache-item `>2MB` rejection was not an upstream ceiling. Signal-abort variants stopped local sources promptly. R2D.2-A2 empirical comparison collected, but no hard budget, memory guarantee or real-route/client-disconnect verification established. This is a future **bounded-provider-I/O requirement**, not functionality released to users. R2D.2-A3 client-disconnect/concurrency laboratory test proposed next. Production Satellite unchanged and OFF; no merge/deploy.

## 2026-10-09 — R2D.2 cache diagnostic A1 observed / A2 staged (NOT RELEASED)

Standalone Node 24/Next 16.3.2 mini-app cache probe A1 executed successfully on SHA `1d5a5a8cd8262422e123a087352343590646d260` (diagnostic only): cached repeated-key request avoided a fresh locally observed fetch; early signal abort and body-stall watchdog terminated local streams. No full 16 MiB test or hard memory ceiling yet. Test-only A2 adds full stream baseline, late signal abort and reader-only cancel comparisons with per-case synthetic upstream and whole-process memory snapshots. **A2 NOT RUN**. Neither A1 nor A2 constitutes production bounded provider I/O implementation, approved cache quota, or release. Satellite provider/Flight Story/Auth/Standard/DB/Training unchanged; production OFF.

## 2026-10-09 — R2D.2-A1 isolated diagnostic configuration fix (TEST TOOLING ONLY)

First owner-run `SPIKE_INCOMPLETE`: mini Next build inherited parent production `next.config.ts`, 0 requests and 0 memory samples. Staged an explicit mini `next.config.mjs` and preflight isolation assertion so the synthetic experiment can build without resolving the Logbook application's relative commercial-build-guard import. **Real production build guard untouched.** This is not a delivered Satellite runtime feature or confirmed cache safety. Corrected A1 diagnostic **NOT RUN**; production Satellite OFF, Draft unmerged.

## 2026-10-09 — R2D.2-A1 local synthetic cache/abort experiment (TEST-ONLY, NOT RUN)

Added an isolated manual diagnostic harness `tooling/r2d2-cache-spike.mjs` / `tooling/r2d2-cache-spike/` to compare Next 16.3.2 cached vs uncached streaming, early client-reader abort and stalled bodies using loopback-only source; logs child memory and queued upstream bytes (not actual network receipt). **This is test infrastructure, not shipped Satellite protection.** Independent DeepSeek review `APPROVE WITH CHANGES` reconciled; numeric I/O caps/timeout/MIME/contracts await evidence and owner freeze. Current Satellite provider remains unchanged, as do existing Story/map, auth, Standard, production OFF. No real-provider, DB or deployment changes. Harness syntax/build/observations NOT RUN.

## 2026-10-09 — Satellite R2D.2 bounded provider I/O (DESIGNED / NOT IMPLEMENTED)

**Future feature / planned contract:** per-upstream total deadline including body, streaming decoded-byte ceiling, source-justified raster format/signature checks, bounded final SVG, base-failure sibling cancellation and preserved optional preferred/reference labels fallback. Exact numeric limits, allowed MIME list and Next Data Cache behavior are **pending evidence, owner decision and independent review**. There is no implemented provider-size or timeout enforcement in this branch; existing R2D.1 locally verified emergency disable is unchanged. Design and reviewer handoff: `docs/product/3_7_0_SATELLITE_R2D2_BOUNDED_IO_DESIGN.md`. R2D.1 documentation iteration now owner-run local PASS on base HEAD `8d8e45b8...` (233 source, 46 domain, TypeScript); not a new release. No production Satellite activation, merge, deploy, live provider use or DB migration.

## 2026-10-09 — Satellite R2D.1 emergency upstream disable (IMPLEMENTED; LOCALLY VERIFIED; UNRELEASED)

`/api/map-tile` server-only `FLYTALLY_SATELLITE_UPSTREAM_DISABLED === "true"` responds for authenticated Satellite requests with non-image `503`, `Cache-Control: no-store`, `X-FlyTally-Map-Style: unavailable` before any satellite upstream/cache calls; missing/other values preserve enabled behavior, while session/strict-style and public Standard contracts remain unchanged. Existing protected map switch, Flight Story first-tile probe, Standard preview and PNG, and public shared replay remain available. Local exact-code SHA `895d8caeb392a77b202f53efa2fc36a19a689443`: standalone real Next HTTP enabled/disabled/missing-token PASS (13/0/0 synthetic provider calls); full Satellite ON and separate OFF local release PASS (source 233/233, domain 46/46, aggregate/typecheck/build, isolated PG 100/100, Chromium desktop+mobile 11/11 in each successful run). Prior OFF `ECONNRESET` failure remains in test history, root cause unknown; unmodified rerun PASS. **This is implemented verified draft functionality, not shipped production functionality**. Draft PR #278 unmerged; Satellite production flag OFF. Physical Safari, live upstream, CI and deployment NOT VERIFIED. R2D.2/3 future, not implemented.

## 2026-10-09 — R2D.1 HTTP fixture cache-isolation improvement (STAGED)

The real Satellite emergency-disable route remains unchanged. Updated the **local-only** Next integration fixture to use per-test-series generated tile coordinates to avoid retained Next upstream cache entries for **tokenless reference-label fallback** URLs. The enabled test still requires observed base and fallback fetches; the disabled/no-token tests still require HTTP 503/no-store and **zero** upstream calls with an identical series ID. One extra source guard and token-safe event diagnostics added. First old-series enabled HTTP failed after receiving the correct cached fallback marker; new-series tests **NOT RUN**. Previous Satellite ON release PASS applies only to earlier code SHA. No production activation or provider traffic.

## 2026-10-09 — R2D.1 Satellite emergency-disable guard (STAGED / NOT VERIFIED)

On stacked draft branch `feat/3.7.0-satellite-r2d-upstream-disable`, a server-only exact `FLYTALLY_SATELLITE_UPSTREAM_DISABLED=true` check has been implemented after session and missing token preflight but before Satellite provider fetch. Signed-in disabled requests return 503/no-store/unavailable **without** a Satellite image; public Standard continues unaffected. Existing Satellite/Standard controls and Flight Story first-tile probe/PNG remain unchanged in production source, with targeted registered browser synthetic 503 fallback tests added. Isolated real Next HTTP test harness supports enabled/disabled/missing-token modes; tests **NOT RUN** at this stage. No global instant kill switch or shared budget claimed; environment update propagation is deployment-dependent. No release/merge/deploy/production Satellite activation.

## 2026-10-09 — R2D.1 server emergency stop: reviewed contract (PLANNED)

Independent DeepSeek review of R2D.0 **APPROVE WITH CHANGES**, reconciled/frozen. Planned minimal server-only exact-true upstream stop for authenticated Satellite before provider/cache. Existing style 400, unsigned 401, no-token 503 and public Standard remain unchanged; stopped Satellite returns 503/no-store/unavailable without an image; existing map and Story fallback select Standard independently. This is deployment configuration, not instant/atomic across instances. **Runtime implementation/tests NOT RUN at review closeout**; see R2D operations design. No changes to previously verified R2C capability.

## 2026-10-09 — Satellite R2D operational controls (PLANNED; no implementation yet)

Existing R2C Satellite/Standard support remains locally verified but unreleased. Owner reprioritized **technical** readiness ahead of a separate provider-licence discussion. New R2D design proposes a server-only upstream emergency disable, outbound response time/size protection, source-aware request amplification telemetry, and preserved Flight Story Satellite preview/PNG and Standard-only public replay. **None of these R2D controls are implemented or verified yet.** User-visible behavior, production default OFF and existing auth are frozen. Design/review: `docs/product/3_7_0_SATELLITE_R2D_OPERATIONS_DESIGN.md`.

## 2026-10-09 — Satellite R2C local verified capability; not released

**Implemented on tested runtime SHA `66c3aec4d49bc576c67afd39720fe03d4e48b17c`:** opt-in Satellite/Standard map layer for authenticated Routes, GPS tracks, saved flight replay, GPS import and Flight Story preview/PNG; public shared replay stays Standard-only. Isolated real Next HTTP integration **PASS** with production session gate (401 anonymous/revoked), signed-in imagery+labels 200, fallback/imaging-only degradation, base failure 502, controlled 13 synthetic upstream interceptions and unchanged public Standard 200. Owner-run full release gates for Satellite ON and OFF independently **PASS**, on same candidate `a5f5b1bef64d80aa78cfe6bfbeea69a6e2ad7c931c36b6664f0fddd16fd7dd25`; 233/233 source, 46/46 domain, 1460/1460 aggregate, PostgreSQL 100/100, desktop/mobile Chromium 11/11 each. Local-only evidence; the documentation update follows tested SHA and does not represent a new runtime release.

**Availability:** code on stacked **Draft** PRs, NOT merged, production Satellite flag **OFF**. No live-provider licensed use, provider-account cost control, production HTTPS, real iPad/Safari or deploy approval. Future provider operational readiness remains separate, pending design and owner decision; do not treat passing fixture as entitlement to activate real provider.

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

### 3.7.0 R2 Batch 1 — Story map export integrity (STAGED, NOT VERIFIED)

Instagram Story retains Standard and Satellite map selection and PNG sharing. A selected map style may be exported only if all map tiles load successfully with matching style and image response; failed tiles may no longer silently disappear. Duplicate export and switching styles while preparing are disabled; failed export shows a user-friendly visible message. Existing probe/initial satellite behavior intentionally remains for backward compatibility pending R2 server access design. Source/E2E coverage added, NOT RUN. The four authenticated Leaflet map consumers and public replay are untouched.

## 3.7.0 R2 product requirement — Satellite end-to-end (2026-10-09)

Required: Standard/Satellite selector on authenticated Routes, GPS Tracks, saved-flight GPS replay, GPS import review, and Flight Story preview/export. Preserve GPS playback/markers/pane/viewport and retain Standard fallback on tile failure. Story must support downloadable/shareable PNG with either basemap; no silent removal of existing satellite behavior. Public shared replay remains at its existing Standard-only scope unless separately approved. R2 server enforcement must not incorrectly block approved client flows. No production entitlement or deployment claim is implied. Status: R2 design in progress; runtime/tests NOT RUN.

### 2026-10-09 — R1 final local verification (Satellite ON and OFF)

- Exact **runtime/test HEAD** `7661d1dd30ba17948ef517f7ef193358380b67cd`, candidate `7292ab60ebbbaaa1c6e77caadf2f02a8257fcb6d649d41b437ae54c3ab140814`; Windows local owner-run `npm.cmd run verify:release:risk -- --base origin/main` with `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`: **release_status=PASS**; source=PASS (reused), domain=PASS (reused), typecheck=PASS (reused), aggregate=PASS (reused), build=PASS (reused), postgres=PASS (reused), browser desktop Chromium **11/11 PASS**, mobile Chromium **11/11 PASS**, blocked_evidence=none.
- Same exact HEAD/candidate, owner-run `npm.cmd run verify:release:risk -- --base origin/main --rerun` with `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=false`: **release_status=PASS**, source/domain/typecheck/aggregate/build/postgres/browser **all freshly PASS**, PostgreSQL acceptance **100/100**, desktop Chromium **11/11** and mobile Chromium **11/11**. PostgreSQL 18.6, dedicated local fixture at `127.0.0.1:55432/flytally_satellite_r1_test`, role `flytally_sat_r1` identity verified before both runs. Initial ON browser failure due to missing local SESSION_SECRET was fixed in ephemeral environment; final ON and OFF acceptance both PASS without a runtime change.
- ON/OFF share candidate ID because build-time flag is not encoded as distinct candidate identity: **retain separate evidence by flag value and run**; do not treat one build artifact as proving both. This documentation-only commit is **after** the verified HEAD; its exact new Git SHA has NOT been locally reverified. No CI, iPad native/Safari, real Esri network/provider authorization, production smoke, merge or deploy claimed.
- **R1 implemented + locally verified (runtime HEAD above); documentation closeout recorded.** PR #272 remains DRAFT; production Satellite remains OFF. **R2** needs server-side provider/rights/cost/auth/rate-control design (including legacy public Story satellite probe), independent review and explicit production entitlement before activation. No changes authorized to `flytally-training`.

# FlyTally Logbook feature list

Last reconciled: **9 October 2026**

This is the canonical capability inventory for `flytally-logbook`.

It answers **what the product has, what is intentionally constrained, and what is planned**. It does not define implementation order; that belongs in `ROADMAP.md`. Completed changes belong in `CHANGELOG.md`.

## Maps — Phase 1 DONE; Phase 2.1 Satellite trial DRAFT / OFF

- Standard-only Leaflet basemap layer controller, pane hierarchy, theme/lifecycle stability, public replay SSR isolation and strict `style` validation are merged in PR #269 and deployed READY from `main@cc7abd41`.
- Exact feature candidate had local Node 1,447/1,447 PASS, build PASS, PostgreSQL 100/100, and Playwright desktop/mobile 12/12 each. Owner separately reports manual browser smoke PASS for Map, flight GPS replay, public share/privacy, theme and mobile/iPad controls; real Map API smoke 4/4 PASS. Native Safari and exact device/viewport screenshots not independently proven; docs PR #270 was merged as `main@7d47010e`.
- No newly enabled Satellite/openAIP UI in production. A draft build-time-flagged Satellite selector is implemented but remains OFF/unverified and not merged; four authenticated map surfaces only, no public share/Story integration. Source, tests and gated contract: `docs/product/3_7_0_PHASE2_SATELLITE_IMPLEMENTATION.md`. Provider rights/attribution/referrer/cost gates remain blocked; product version 3.6.0 remains current.

**Phase 2.1 / R1 verification and scope (9 October 2026):** **Exact pre-R1 owner-run verification (9 October 2026):** PR #272 head `3315da278d95285b89d1f95be0a557a849cf6af8`, candidate `0ca40786a1eec48370e3c4f69b7a7f2ec4dc382da3a25febc60847dddcf0681a`, `npm.cmd run verify:release:risk -- --base origin/main` with Satellite flag ON: source 233/233 PASS, domain 46/46 PASS, typecheck PASS, full aggregate PASS, candidate build PASS, isolated PostgreSQL acceptance PASS, desktop Chromium 11/11 PASS, mobile Chromium 11/11 PASS, `release_status=PASS`, `blocked_evidence=none`. This is **local** evidence, not CI or provider validation. **Subsequent R1 test/documentation-only commits change the candidate; current R1 HEAD verification NOT RUN.** Satellite remains OFF in production; Esri provider/legal/token/referrer/attribution/cost gates BLOCKED; PR #272 DRAFT and unmerged. DeepSeek APPROVE WITH CHANGES; R1 test hardening asserts Satellite attribution removal across repeated toggles, removes comment-dependent source matching and reconciles docs. No map or API runtime change in R1; server tile-proxy policy and provider licensing remain separate pending phases.

**Historical verification reconciliation (superseded):** **Latest Phase 1 integration status (9 October 2026):** documentation PR #268 was squash-merged into `main` as `5944f917797b6fbc55d61947a1e29554f7865eb4`; feature PR #269 incorporated that `main` via non-rebased merge commit `03257eefd7395f6063df2631de1dc2e02d67edab`. The first post-integration local iteration and release attempt both **FAILED only at source-contract 232/233** because the historical `v300-navigation-hierarchy` test still expected Currency at version 3.7.0. Candidate `675da4414d9cc63b1dd0555c40507a565f6757bd3689a96c1d284ccca0c30578` was FAIL; aggregate/build/PostgreSQL/browser did **NOT RUN**. Test-only correction `f0a0e0b762d0f9859a7317958c267d739283cd6a` asserts 3.7.0 Maps and 3.8.0 Currency without changing runtime or roadmap decisions. Exact post-correction verification remains **NOT RUN** until owner executes it on the final branch HEAD. Prior local release PASS on `5538e0c4...` is historical and cannot be claimed for the new candidate. PR #269 stays Draft/unmerged, no production deployment or DB migration; satellite and openAIP provider gates remain BLOCKED. Owner decision A (strict duplicate-style HTTP 400) remains APPROVED.

## Phase 1 API compatibility — owner decision A (9 October 2026)

**Product decision A — APPROVED by owner, 9 October 2026:** preserve strict query parsing for `/api/map-tile/[z]/[x]/[y]`: absent `style` = legacy `map`; exactly one `style=map` or `style=satellite` is accepted; any duplicate `style` (including identical values), empty/unknown/alias/case-variant style parameter = HTTP 400 `unsupported_style` with `Cache-Control: no-store` and no upstream fetch. This deliberately changes the earlier first-value duplicate behavior. Owner accepts this compatibility trade-off. Implementation and local Node/Playwright release evidence PASS on feature HEAD `5538e0c4eec8b4a70fc5568facc55f4dc7324606`; not a merge/deploy authorization. Satellite/openAIP licensing and production gates remain separately BLOCKED.

## Core logbook — IMPLEMENTED

- Multi-user private electronic pilot logbook.
- Canonical Add/Edit flight workflow.
- Flight review before certification/finalization.
- Certified record revisions and integrity evidence.
- Category-aware records for Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other.
- Explicit role, movement, launch and category evidence where applicable.
- Flight list, detail, filtering and search workflows.
- Dashboard all-time snapshot.
- Statistics with period/trend/detail views.
- Career/professional experience presentation.
- Flight notes and user-owned structured expenses.

## Aircraft and airports — IMPLEMENTED

- Personal aircraft profiles.
- Aircraft flight defaults include editable Role, Operation and SE/ME Engine defaults; Engine may be suggested only when source engine-count data is unambiguous and remains editable.
- Searchable aircraft-type catalogue with manual fallback.
- Explicit aircraft-dependent profile state.
- Optional aircraft cover photos.
- Safe aircraft removal workflow.
- Personal aircraft profile sharing between accepted Connections as recipient-owned copies.
- Canonical fail-closed aircraft-profile validation is shared by normal Add/Edit and shared-profile import.
- Airport reference data used by planning/entry presentation.

## GPS and track workflows — IMPLEMENTED

- KML/GPX/CSV GPS import.
- Saved-vs-GPS review before applying derived suggestions.
- Track playback and aircraft marker presentation.
- Map/profile display without treating GPS as authority for unsupported regulatory evidence.
- Rolling touch-and-go altitude-discontinuity validation is bounded to the candidate's physical descent/minimum/climb evidence span, preventing unrelated sparse-sampling anomalies from suppressing valid advisory detections while preserving conservative in-span rejection.
- Advisory take-off timing is hardened around GPS teleports/gaps; SERA Day/Night and conservative GPS Night-time suggestions are attempted automatically wherever the canonical flight context supports them, with no account-level enable/disable switch; IFR remains manual; PF movement evidence is optional and absent evidence gives no recency credit.

## Licences, recency and evidence — IMPLEMENTED

- Licences & ratings workspace.
- Recency planning with explicit evidence boundaries.
- Credential/medical/document presentation.
- Aircraft-training / qualification evidence.
- Category-aware regulatory presentation.
- Type-specific helicopter recency resolves historical type from stored flight identity, with LIMITED DATA when relevant historical type evidence is unresolved.
- Evidence-first states rather than silently inferring privileges or authority approval.

## Collaboration — IMPLEMENTED

- Pilot Connections.
- Shared-flight invitation/review workflow.
- Instructor verification/signature workflows.
- Action Center for unresolved workflow decisions.
- Notifications as update/history rather than the authoritative pending-work signal.
- Public flight sharing with revocation and restricted public DTOs.
- Instagram Story / social flight-card workflow.

## Data portability and recovery — IMPLEMENTED

- Print/export workflows.
- Portable account backups.
- Backup validation and restore review.
- Deleted-flight recovery/trash workflow.
- Protection of certified revisions, signatures, GPS/sharing evidence and audit history across supported recovery paths.

## Product UX and accessibility — IMPLEMENTED

- Responsive desktop/tablet/mobile layouts.
- Light and dark themes.
- Shared design tokens, spacing and card geometry.
- Unified functional SVG icon system.
- Loading/pending action feedback.
- Required-field and validation presentation.
- Keyboard/focus/touch-target hardening.
- Reduced-motion and forced-colors fallbacks.
- Shared date/time/date-only presentation contracts.
- Legal/public page styling aligned with the product design system.
- Branded root not-found and runtime-error fallbacks with non-technical recovery actions.
- Push onboarding aligned to the canonical raised-surface design contract.
- Consistent account email terminology across sign-in/join/settings surfaces.
- Operational Dashboard lead copy that directs historical analysis to Statistics.

## Notifications and PWA — IMPLEMENTED WITH INTENTIONAL LIMITS

- Web Push subscriptions and preference controls.
- Contextual push onboarding.
- Compliance/activity/security notification preferences.
- Staged compliance reminder infrastructure.
- PWA/install support.
- Explicit offline connection banner driven by browser connectivity state; it clears automatically when the browser reports online.

Intentional current boundary:
- FlyTally is online-only for logbook loading/saving.
- Offline editing of certified or mutable logbook data is **not** an implemented feature.

## Legal, security and compliance foundations — IMPLEMENTED TECHNICALLY

- Public legal centre and provider disclosures.
- Privacy/self-service boundaries.
- Security headers and public-share indexing/cache safeguards.
- Provider registry and map-attribution/provider controls.
- Regulatory/signature assurance taxonomy.
- External-evidence gates for commercial/regulatory/claims status.

Important boundary:
- these features do not mean FlyTally is approved by EASA, ÚCL, LAA or another authority;
- internal signature mechanisms are not represented as QES unless independently established;
- legal/trademark/payment-provider approvals remain external decisions where applicable.

## Planned / active follow-up

### 3.5.3 — Flight detail navigation UX — IMPLEMENTED / PRODUCTION
- Make the existing filter-aware **Back to flights**, **Previous flight** and **Next flight** controls visually obvious on flight detail.
- Keep Previous/Next controls visible at list boundaries using explicit disabled states so the layout does not shift.
- Preserve the current Flights filter/sort context and existing `FLIGHT x/y` position indicator.
- Reflow the controls for desktop, iPad and mobile without changing flight-record semantics.
- Detailed contract: `docs/product/3_5_3_FLIGHT_DETAIL_NAVIGATION.md`.
- Production visual review identified two presentation-only iPad follow-ups tracked in 3.5.4.

### 3.5.4 — iPad flight-detail visual hotfix — IMPLEMENTED / PRODUCTION VERIFIED
- Keep Back / Previous / Next / More on one stable row on wider iPad layouts instead of allowing only More to wrap.
- At narrower tablet widths, reflow the whole flight-detail header/navigation group as one unit.
- Keep the accessibility **Skip to content** link fully hidden until keyboard focus so iPad safe areas never show a residual focus-colored border.
- Preserve all 3.5.3 navigation destinations, list-context semantics and mobile behavior.
- Detailed contract: `docs/product/3_5_4_IPAD_FLIGHT_DETAIL_UX.md`.
- Production iPad acceptance confirmed the navigation wrapping and safe-area border fragment are resolved.

### 3.5.5 — iPad sidebar collapse-control alignment — IMPLEMENTED / PRODUCTION VERIFIED
- Keep the coarse-pointer sidebar collapse action at the canonical 44 px touch size.
- Reposition it clear of the notification bell and align it vertically to the brand-row controls.
- Preserve sidebar collapse state, notification behavior and phone/mobile navigation.
- Detailed contract: `docs/product/3_5_5_IPAD_SIDEBAR_TOGGLE.md`.

### 3.6.0 — Saved-date / timezone semantics — IMPLEMENTED / PRODUCTION VERIFIED
- New saveable calendar-date defaults derive from the configured named account timezone through a strict server-authoritative resolver; missing, blank or invalid timezone state fails closed instead of guessing Prague, UTC, browser-local or server-local dates.
- Manual New Flight, Aircraft Manager initial/rate-history effective dates and Quick Add use that strict calendar authority. Explicit/stored flight and rate dates remain date-only and are never reinterpreted after save or later timezone changes.
- Settings validates saveable timezones at the server write boundary; runtime-recognized named zones including `UTC` are accepted and raw numeric offsets are rejected.
- GPS/FCL.050 timestamp evidence remains UTC. Explicit-offset track timestamps normalize to UTC; timezone-less timestamps remain unavailable/ambiguous rather than guessed.
- Backup/restore, CSV/XLS/print and historical rate selection preserve date-only semantics. PostgreSQL exact-restore invariance is verified across materially different session timezones.
- Phase 1 required no DB migration, historical backfill, certification rewrite or portable-backup format bump.
- Production closeout: PR #266 merged as `168bd029540474d6e806bf3e261fa855824b7c2a`; Vercel deployment `dpl_HgaxCeBAajnbArtFSNAVDfHn5NRs` reached READY on the exact SHA and serves `fly-tally.com`; root/login smoke returned HTTP 200 and the immediate checked runtime-error window was clean.

### 3.7.0 — Maps & Aviation Layers — PHASE 1 STANDARD-ONLY LOCAL RELEASE PASS / UNMERGED

- **11th local verification / regression patch (9 Oct 2026):** user fast-forwarded exact feature head `9a325ca`, guarded dedicated PostgreSQL at 127.0.0.1:55432 and ran `verify:iterate` **PASS** (source 233/233, domain 46/46, TypeScript PASS, `candidate_id=473c1318a0797ea474751f4207a96a39667687cc729035002c7652fb92ea3f64`, no evidence blockers). `verify:release:risk` returned **`release_status=FAIL`, `aggregate=FAIL`** because two Node source/unit tests failed: (1) historical public-share viewer test asserted a direct `FlightTrackPlayer` string in public page, incompatible with the deliberate SSR-safe `PublicFlightMap` boundary; (2) case-variant `Style=satellite` was not rejected by case-sensitive malformed-style key matcher (returned standard `map` instead of `null`). This is not PostgreSQL/browser failure: those gates were **NOT RUN** after aggregate FAIL. PR #269 now on unverified feature head `1a930465ea3d465cb20d6eac17712d9511888436`: update public-share source contract to assert the dynamic `PublicFlightMap -> FlightTrackPlayer` delegation and `ssr:false`, reject case-variant `style*` keys in parser, and include uppercase/mixed alias cases in unit + HTTP e2e. **New-head tests/build/PostgreSQL/browser NOT RUN**; prior 24-browser/100-PG and iPad 16/16 PASS only on `b3917c7` are historical. Both PRs remain Draft, no merge/deploy. Owner compatibility decision for legacy duplicate style still open.

- **Phase 1 capability (unmerged PR #269, new HEAD `9a325ca`, NOT TESTED):** reusable Leaflet standard-basemap map-layer controller; explicit `flytallyBasemap` and future-disabled `flytallyAviation` panes; dark filter scoped to the standard basemap; safe map/theme lifecycle, route/GPS replay and import-review compatibility; strict backwards-compatible standard tile-style validation; browser-only Leaflet loading avoids SSR `window` evaluation. No new user-visible satellite or aviation layer selection is enabled in Phase 1.
- **Evidence:** on 9 October 2026 exact candidate `e8685272ae5e753ab6c8a577799da203795fb1ffcac382c096f63c2350915e25`, user-local `verify:iterate` PASS (source 232/232, domain 46/46, TypeScript), then `verify:release:risk` **PASS** (aggregate 1,444/1,444; Next production build PASS; isolated PostgreSQL 100/100; 12 desktop + 12 mobile Playwright PASS; no blocked evidence). Final run showed no recurrence of the prior GPS save assertion failure or Leaflet SSR `window is not defined` errors. Historical failing runs and trace/SQL triage are preserved in `CHANGELOG.md` and the Phase 1 acceptance contract.
- **Independent review and iPad evidence (9 Oct 2026):** external read-only PR review returned **APPROVE WITH CHANGES**. Supplementary Chromium iPad touch-emulation report and 16 screenshots at 820×1180 / 1180×820 (light/dark, four map surfaces) all **16/16 PASS on previous head `b3917c7`**; locked touch movement prevented and unlocked pan worked. Actual iPad Safari is **NOT RUN**; real upstream imagery is not exercised (deterministic SVG tiles). Review identified malformed `style[...]` aliases and direct Leaflet import on public `/f/[token]` as blockers: both repaired on new head `9a325ca` with unit/e2e/source contract tests. New exact-head iteration/release/build/PostgreSQL/browser-risk **NOT RUN**. Suspected loading-string mojibake was from patch encoding: actual GitHub source has valid UTF-8 ellipses. Legacy satellite duplicate-style compatibility acceptance remains owner-dependent; no provider capability is enabled.
- **Not shipped:** both docs PR #268 and feature PR #269 remain Draft and unmerged. Supplementary iPad emulation and independent review occurred **on the prior source candidate**; current-head retest and owner merge decision remain OPEN. Physical iPad Safari and CI/production smoke/deploy NOT RUN. No database migration, historical certification payload rewrite, backup format or GPS inference change in this Phase 1.
- **Future Phase 2 — satellite:** authenticated Standard/Satellite layer switch on supported map workspaces only after verified ArcGIS/Esri rights, token/attribution/quota/cost/fallback and iPad validation; **BLOCKED** pending external/provider evidence.
- **Future Phase 3 — openAIP:** optional aviation/airspace context overlay only after authoritative API/schema, licensing, applicable rights, credentials/cache/rate/error policy, authentication and attribution; **BLOCKED** pending external/provider evidence.
- **Exclusions:** no new public-share/Story satellite or openAIP controls, no NOTAM/airspace activation claim, no authority-approved EFB representation or silent global map preference.
- **Contracts:** `docs/product/3_7_0_MAPS_AVIATION_LAYERS.md`, `docs/product/3_7_0_MAPS_REVIEW_RECONCILIATION.md`, and `docs/product/3_7_0_PHASE1_TEST_ACCEPTANCE.md`.

### 3.8.0 — Currency / monetary semantics — NEXT (superseded former 3.7.0 reservation)
- Issue #136 and original requirements are preserved; only implementation order/release number changed on 9 October 2026.
- Define whether account currency is only a display/default denomination or authoritative for newly persisted monetary records.
- Inventory existing record-level currency fields and legacy monetary values before changing behavior.
- Preserve explicit stored denominations; missing currency evidence must not be guessed or silently converted.
- Define export/backup and historical-display consequences before implementation.
- No automatic FX conversion without a separately approved, source-backed conversion rule.

### 3.9.0 — Multi-aircraft heterogeneous onboarding proof — PLANNED (formerly 3.8.0)
- Validate canonical onboarding/flight-selection paths across Aeroplane, Helicopter, Sailplane/TMG, Balloon, ULL and Other, without new make/model-specific shortcuts.
- Cover catalogue/manual fallback, Add/Edit, Quick Add, lifecycle, applicability and desktop/iPad/mobile light/dark evidence.

### 3.10.0 — Multi-aircraft sharing / recovery / scale closeout — PLANNED (formerly 3.9.0)
- Preserve recipient-owned shared aircraft copies with canonical validation, protected-flight backup/restore invariants, safe deletion/deactivation with historical flights, and measured multi-profile UX/scale behavior.
- Require relevant regression, PostgreSQL, browser and build closeout rather than presuming safety from prior onboarding proof.

### 3.5.2 — Always-on GPS/SERA Night suggestions — IMPLEMENTED / PRODUCTION VERIFIED
- Remove the account-level **Night definition** preference from Settings.
- Always attempt the existing SERA civil-twilight Day/Night and Night-time suggestions when the canonical flight context supports those fields.
- Preserve the existing -6° geometric SERA boundary, ±0.5° confidence guard, UTC/offset requirements, sparse-gap and track-integrity fail-closed rules.
- Keep all automatic values advisory/editable; manual edits stay sticky and unavailable evidence stays manual/unset rather than becoming zero.
- IFR remains pilot-entered.
- Legacy persisted `night_definition` preference values are ignored by active runtime behavior; no DB migration, certification-version change or historical-flight rewrite.
- Detailed contract: `docs/product/3_5_2_ALWAYS_ON_NIGHT_SUGGESTIONS.md`.
- Production closeout: PR #248 merged as `60be6fd23f283302dadc7a3d611a19ff0bc8ebf3`; Vercel deployment `dpl_4pyJEv2pjWQLNcmNPpFYcjsf3PHj` is READY, root/login smoke returned HTTP 200, and the checked post-deploy runtime-error window was clean.

### 3.5.1 — GPS T&G false-positive containment — IMPLEMENTED / PRODUCTION VERIFIED
- Tighten advisory T&G inference against three reproduced real-track false positives without adding new auto-counted events.
- Preserve the existing 28–145 km/h rolling-speed range, 30 m descent/climb requirement, output DTO and takeoff semantics.
- Require rolling-altitude T&G climb evidence to be sustained beyond a single timed altitude edge.
- Reject short speed/ground events when direct event motion exceeds the existing rolling-T&G ceiling or usable altitude changes by at least the existing 30 m evidence threshold during the alleged ground phase.
- Preserve the real positive-control track with exactly five detected T&Gs.
- Keep the known evidence-limited 15:59 real T&G non-auto-counted until a safer time-normalized/review-tier follow-up.
- Detailed contract: `docs/product/3_5_1_GPS_TOUCH_AND_GO_RELIABILITY.md`.
- Production closeout: PR #245 merged as `230d835a9e4c3fddb02bf7b729242632626cb9a7`; Vercel deployment `dpl_AGLoght4FF1khhviPaZvMu5SZ2oT` is READY on that exact SHA, serves `fly-tally.com`, root/login smoke returned HTTP 200, and the checked post-deploy runtime-error window was clean.

### GPS T&G time-normalized / evidence-limited follow-up — RESEARCH
- The earlier T&G-only provisional 3.5.2 reservation is superseded; this research remains unnumbered until a broader real-track corpus supports a safe add-event contract. Product release 3.5.2 is now assigned to always-on GPS/SERA Night suggestions.
- Replace the now-confirmed ±10-array-point qualification defect only after a separate add-event risk review.
- Investigate elapsed-time evidence windows, density invariance and a non-counted "possible T&G" review signal.
- Do not use spatial clustering as an automatic landing rescue without independent evidence that it cannot promote low passes/go-arounds.

### 3.5.0 — Certified flight voiding + remaining multi-aircraft integrity — IMPLEMENTED / PRODUCTION VERIFIED
- Allow the owning pilot to void/remove a certified flight from the active logbook without hard-deleting the protected evidence.
- Voided flights must be absent from normal flight lists and from Dashboard, Statistics, Map, Print/Export, recency/compliance and other operational totals/read models.
- Preserve the original certified snapshot/fingerprint plus void actor, timestamp and mandatory reason in audit history.
- Revoke active public sharing and supersede pending collaboration requests atomically.
- Do not destructively remove independently owned participant copies.
- Do not reuse the ordinary 90-day draft Trash/restore semantics for protected certified evidence.
- No silent restoration of the old certification after voiding.
- Detailed contract: `docs/product/3_5_0_CERTIFIED_FLIGHT_VOIDING.md`.
- Frozen implementation architecture: schema v20 permanent archive+delete, immutable protected-evidence children, participant-copy provenance, same-transaction certified DELETE authorization, dedicated audit-only route, and portable backup v13 history-only restore.
- M1 schema/invariants are locally verified; M2 canonical void mutation and M3 destructive UI/audit route are end-to-end verified across desktop and mobile Chromium.
- M4 portable backup v13 is locally verified: new backups preserve void history/provenance as server-authenticated history-only sections; v4–v12 legacy `track_points` remains parser-compatible but is not queried/restored into the current schema. Exact-head PostgreSQL core acceptance is 85/85 PASS.
- M5 consumer/integration verification is locally complete: M5A redirects owner source-flight notification history to the permanent audit and neutralizes recipient workflow links before cascade; M5B PostgreSQL collaboration/provenance acceptance is **86/86 PASS**; M5C authenticated browser acceptance is **2/2 PASS** across desktop and mobile Chromium, including permanent-audit navigation from retained notification history.
- Phase 1 certified-flight voiding has completed its local release gate: exact-head `a2d3f65` TypeScript PASS, full unit/regression **1285/1285 PASS**, full PostgreSQL integration + scale **99/99 PASS**, production build PASS, with authenticated desktop/mobile M5C **2/2 PASS** on runtime-equivalent `a423239`.
- Phase 2 remaining multi-aircraft integrity audit is complete without a runtime change. Characterization is **4/4 PASS** on `69310a3`; independent review confirmed the snapshot/external-applicability architecture; repository-history reconciliation showed strict server persistence for explicit overrides; and the read-only production census found **25/25 profiles with no explicit `part_fcl_credit_*` metadata**, covering 295 saved flights and 36 certified ULL flights. No legacy compatibility layer, schema v21 or certification payload change is justified.
- Canonical final local gate on exact head `f0a1f1a`: TypeScript PASS; unit/regression **1289/1289 PASS**; full PostgreSQL integration + scale **99/99 PASS**; production build PASS.
- Production deployment `dpl_FTPxxhKFWnRRBvKZZPcNrYUYeZXn` is READY on merged `main@881f4b2`, serves `fly-tally.com`, and final schema-v20 reconcile/postflight completed with no immediate runtime errors.
- Schema-v20 rollout tooling was locally source-verified **10/10 PASS** with TypeScript PASS on `eddbfb5`. Candidate version/build delta on `c0daa46` was **5/5 PASS** with production build PASS. Production v20 preflight passed against exact schema v19; schema v20 was then applied after explicit approval with a pre-write Neon recovery branch, and final reconcile/postflight/deploy smoke closed successfully in the 3.5.0 production release.


### 3.4.1 — GPS Night-time reliability — IMPLEMENTED / PRODUCTION VERIFIED
- Keep GPS Night-time advisory/editable and fail closed when the complete exact total cannot be supported.
- Add explicit unavailable reason codes and concise pilot-facing explanation instead of a silent generic manual fallback.
- Preserve SERA geometric civil twilight at Sun centre = -6° and the existing ±0.5° confidence guard.
- Preserve sticky manual Night-time edits and keep IFR fully pilot-entered.
- Do not infer Night time from a NIGHT landing.
- Do not auto-apply partial/lower-bound Night duration as the total.
- Preserve the >600 s fail-closed guard until a future evidence-backed sparse-path contract exists; endpoint displacement/quality thresholds are not treated as proof of the unobserved route between samples.
- Fail closed on ambiguous/non-monotonic timestamps, sparse gaps, implausible position transitions, unsupported solar envelope, confidence-boundary endpoints and conflicting equal-time positions.
- Include a real-like EHAM → LKPR regression proving that a NIGHT landing may coexist with unavailable exact Night time when sparse coverage prevents a complete total.
- Detailed contract: `docs/product/3_4_1_GPS_NIGHT_TIME_RELIABILITY.md`.
- Production closeout: PR #241 merged as `b3e1de097b6d16cdaa96082d281602a2765b8ae0`; Vercel deployment `dpl_3911vZiDAFduLhsPbyMnB1YtHKwn` is READY on the exact merge SHA with `fly-tally.com`; public smoke returned 200 and the checked post-deploy runtime-error window was clean.

### 3.4.0 — Flight Entry Simplification — IMPLEMENTED / PRODUCTION VERIFIED
- Reduce New Flight and GPS review density with progressive disclosure and one clear completion path.
- Default single-flight GPS hierarchy is now compact **Source → Flight details → Completion**; clean split controls, map/profile, provenance and diagnostics are conditional detail. Phase 2 also removes redundant clean-quality copy and keeps incomplete-import focus on the first unresolved flight.
- Flight context is now one compact editable summary centered on Aircraft, regulatory evidence basis, Role and applicable Operation/Engine. Billing/Cost share moved to a separate collapsed Costs disclosure and malformed persisted billing still fails closed.
- Single-flight **Save & certify** is implemented for Manual and GPS. **Save draft** remains available and is the implicit/default submit behavior; pressing Enter cannot certify.
- Pressing Enter cannot certify. Certification always requires the explicit Save & certify action.
- Certification reuses the existing persisted-row compliance/hash/revision authority. If draft save succeeds but certification is blocked, the record remains a draft with an explicit reason.
- The generic normal-case “I reviewed this flight” GPS gate and server requirement are removed; deterministic evidence readiness is used instead, with targeted acknowledgement only for non-blocking GPS-quality warnings.
- Multi-flight GPS stays atomic **draft-only** in 3.4.0; the UI exposes only **Save N flight drafts**, and crafted multi-flight certify intent fails closed server-side.
- Save & certify never sends PIC/crew/instructor invitations automatically.
- Training-purpose filtering remains category-aware: ULL correctly hides non-applicable Part-FCL/SFCL/BFCL recency purposes. 3.4.0 adds no generic structured Training / practice marker.
- 3.4.0 fixes the current Training-purpose UI/server parity gap by moving visibility and persistence eligibility onto one shared applicability contract.
- Desktop, iPad landscape/portrait and mobile light/dark acceptance passed in the 3.4.0 release gate.
- Detailed design: `docs/product/3_4_0_FLIGHT_ENTRY_SIMPLIFICATION.md`.
- Independent review reconciliation: `docs/product/3_4_0_REVIEW_RECONCILIATION.md`.


### UI/UX Simplicity & New Flight cognitive-load reduction — IMPLEMENTED

- Screenshot-backed audit of the authenticated product across desktop, iPad landscape, iPad portrait and mobile in light/dark.
- Dedicated New Flight field inventory classifying controls as core-now, contextual, profile-backed, optional or advanced/regulatory.
- Simplification through information hierarchy and progressive disclosure rather than invented defaults or weaker validation.
- One canonical FlightForm/business-rule path remains mandatory.
- Independent review and repository reconciliation are complete; Filip's product decisions are frozen.
- B0.5 hardens selected-aircraft profile defaults so invalid/missing evidence/class cannot be silently presented as ULL.
- Valid Role/landing/PF presets remain allowed, with evidence-bearing preset visibility scheduled in the essentials batch.
- B1A implements Costs as an optional domain contract: blank means **Not tracked**, configured BLOCK/AIR defaults may auto-apply, and malformed populated values fail closed.
- Untracked billing contributes no calculated aircraft cost and does not synthesize a BLOCK basis or rate snapshot; structured expenses remain independent.
- Missing route/times remain draft-save compatible and certification-gated.
- B1B simplifies completion to one blocker/action surface and one primary **Save & review** action; **Add another flight** is offered only after a successful save in the saved review handoff.
- The saved-flight review/certification workspace remains authoritative; New Flight no longer duplicates it with a second inline review card.
- B2 promotes Role beside Date/Aircraft, groups Route and one UTC timeline, and exposes the applied landing/PF evidence in the collapsed Flight experience summary without forcing normal preset reconfirmation.
- Existing movement adjustment remains available through progressive disclosure; draft route/time optionality and certification/recency rules are unchanged.
- B3 exposes the real Aircraft & logbook snapshot context, keeps required DUAL/Safety Pilot/SPIC/PICUS evidence in a role-driven section, and separates Training purpose/Task into Optional details without changing structured purpose parsing.
- B4 consolidates Training/Task, Night/IFR, Professional context, Costs/expenses and Notes under one Optional details disclosure, auto-opens populated Edit data, and trims non-decision helper copy while preserving validation and evidence consequences.
- B5 adds delayed pristine validation styling, focusable blocker navigation, preserved mobile disclosure summaries, 320px/zoom reflow safeguards, touch-keyboard-safe action fallback and measured helper/link contrast without changing flight semantics.
- Final authenticated closeout matrix passed on the isolated browser fixture: 11 New Flight states × 6 required viewports × light/dark = **132 screenshots**, with zero horizontal overflow recorded in every matrix state.
- Screenshot review exposed one presentation defect in the Flight experience empty state at 320px/200% reflow; PR #182 fixed the title/explanation separation while preserving the canonical `empty-state` design-system contract.
- Final production commit `45a97aacec50e9e7b20d676afd4493c2e896c1fe` is deployed READY to `fly-tally.com`; no parser, persistence, certification, recency, collaboration, billing or UTC semantics changed in the closeout fix.
- Detailed audit: `docs/product/UI_UX_SIMPLICITY_AUDIT_2026.md`.
- Frozen implementation contract: `docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`.

### Safety Pilot ↔ PIC shared-flight workflow — IMPLEMENTED

Implemented by SP1–SP5:
- Safety Pilot flight can record the actual PIC by selecting an accepted FlyTally Connection or by entering a name manually.
- Connected PIC identity is preserved independently from displayed name text and reloaded by source flight ID without name matching.
- Manual PIC text never silently creates an account link; switching back to manual removes the current connected-PIC link.
- After certification, the source pilot can explicitly invite only the stored connected Actual PIC; the target is derived server-side and the action fails closed when the Connection is no longer accepted.
- The invited recipient can materialize the exact certified event as an independently owned PIC record; certified source commander evidence is preserved, PIC credit uses the canonical path, and acceptance rechecks the live Connection.
- Materialized PIC recency follows the same evidence path as an equivalent ordinary PIC record; the source Safety Pilot record remains separate and gains no PIC credit.
- Source correction supersedes only pending invitations from the old revision, preserves the current connected-PIC link for the editable correction, and never rewrites an already materialized recipient-owned flight.
- Cancel, decline and reinvite lifecycle is bounded to the existing participation states; accepted/materialized participation is not silently reset.
- The workflow preserves the existing certification payload version and uses the already-deployed additive migration v15; no later schema migration is required.

### General PIC invitation across source roles — IMPLEMENTED

- Any certified source flight in **any recognized canonical stored role** may explicitly invite an accepted FlyTally Connection to create an independently owned `PIC` copy.
- The existing Safety Pilot **Actual PIC** link/panel remains a distinct evidence-backed workflow and is not replaced.
- Generic PIC invitations are revision/hash bound, re-check accepted Connection state at invite and materialization, and never rewrite source credit.
- Generic PIC recipient commander semantics must be participant-correct; source `commander` is preserved only for the linked Safety Pilot Actual-PIC case.
- The accepted PIC copy is fully populated from the certified source event (timing, route, GPS, movement evidence, IFR/night and other event facts), while recipient-owned role/credit fields are recalculated as PIC rather than blindly cloned.
- No automatic invitation and no identity inference from names.
- Migration v16 persists invite-time PIC commander provenance and enforces one active PIC participation per source revision.

### Legacy Flight Entry follow-up — IMPLEMENTED / PRODUCTION VERIFIED

Planned product capabilities:
- optional aircraft-profile default for SP/MP, applied only as a New Flight prefill and always editable per flight;
- no synthetic `GPS import` Task on new GPS imports;
- certification-safe handling of historical synthetic Task values: no automated certified-row mutation; exact legacy `GPS import` remains raw evidence, with additive UI annotation and optional pilot-initiated correction through the existing revision workflow;
- GPS event-level Day/Night landing suggestions from civil twilight when UTC + coordinates are available;
- Route continuation/return suggestions that do not disturb field alignment.

Safety/data boundaries:
- no SP/MP inference or backfill from aircraft type/history;
- no raw rewrite of certified Task evidence;
- civil-twilight output is suggestion/provenance, not universal jurisdiction authority;
- missing event time/location remains manual/unavailable.

### Flight Entry Workflow 3.0 — DONE / PRODUCTION VERIFIED

Product target:
- one canonical flight semantic contract for Manual and GPS creation;
- GPS remains source/provenance/suggestion rather than a separate flight model;
- normal PIC entry becomes materially simpler and presents only current decisions;
- role-defining fields appear immediately when Role makes them applicable;
- Review/Certification reviews and certifies; it is not the first place fundamental role identity becomes discoverable.

Frozen behavior:
- invalid/missing aircraft context never silently becomes `ULL`;
- valid explicit ULL remains ULL;
- EASA DUAL exposes Instructor/PIC inline and requires it before Save;
- EASA Safety Pilot exposes Actual PIC inline and requires Manual/accepted-Connection identity before Save;
- EASA SPIC/PICUS expose supervision + countersignature evidence inline and require it before Save;
- route/time completeness can remain draft-incomplete under the existing certification contract;
- optional billing remains **Not tracked** when absent;
- server-side role validation is authoritative;
- GPS Safety Pilot remains fail-closed unless Manual-equivalent Actual-PIC authority is satisfied; F4.3 implements and locally verifies that parity;
- multi-part GPS uses one common aircraft identity plus deterministic whole-group Role/Crew overrides;
- one invalid multi-part record aborts the whole import;
- historical/certified records are never repaired by guessed crew/profile values.

Current priority:
- F0/F0.1 are DONE: GPS aircraft context fails closed and interim GPS role support remains PIC-only until Role/Crew parity;
- F1 is DONE/production-verified: Manual and GPS PIC drafts converge on the same candidate → pure normalizer → `FlightInput` semantic contract before persistence, while GPS track/provenance and atomic N-part persistence remain specialized;
- explicit GPS Operation/Engine and category-specific source-fidelity evidence are required where applicable; generic GPS movement does not become regulatory evidence;
- **F2.2 Manual inline Role/Crew UX is production-verified**: DUAL, Safety Pilot, SPIC and PICUS role-defining identity is shown directly in Flight essentials using the shared RoleCrew contract for applicability/required cues; the completion surface points to those inline controls; generic commander/instructor inputs remain available under Additional crew details.
- **F2.3 Safety Pilot resolver convergence is production-verified**: Manual and connected Safety Pilot Actual-PIC submissions resolve through one server helper shared by create/update; connected identity is accepted only by account ID with a live accepted Connection, the server display name becomes the historical commander snapshot, the parent write rechecks Connection state fail-closed, and `flight_connected_crew` remains separate atomic metadata. Certification v1–v8 and GPS PIC-only behavior remain unchanged. F2.4 producer/consumer reconciliation + evidence-aware canonicalization is next.
- **F2.4A identity-binding reconciliation is production-verified**: Certification no longer converts typed DUAL/SPIC/PICUS names into FlyTally accounts or sends account-bound requests implicitly. Typed instructor/supervising-PIC values remain historical flight evidence; account-bound verification is an explicit post-certification account-ID action, while in-person signing remains available. PR #212 merged as `06b50d911e0cedcafbd5f10bea41868098f8d8b0`; Vercel `dpl_DP43Y79vK4Kny2L86Wuw5VCjAoHH` is READY on that exact SHA and aliases `fly-tally.com` with no alias error. No schema/certification-version/GPS-role change. F2.4B remains review-gated because `instructor` and `verification_*` are overloaded evidence fields and self-PIC commander precedence can affect interpretation of existing certified output.
- **F2.4B discovery found additional compatibility evidence**: Manual Additional crew details intentionally allows Commander/PIC on self-PIC roles, and shared-flight materialization intentionally writes commander snapshots onto recipient `PIC` rows, including the linked Safety Pilot Actual-PIC provenance path. Therefore self-PIC `commander` is not safely classifiable as stale. The focused review now prefers contract separation (Save/UI source vs historical output precedence) over changing `pilotInCommandName()` or destructively clearing persisted evidence. PR #215 added read-only characterization tests for the current semantics and merged without changing runtime behavior.
- **F2.4B B1 is production-verified**: RoleCrew separates role-level PIC identity (`rolePicIdentitySource`) from downstream display precedence (`picDisplayPrecedence`). Existing output remains compatibility-first: explicit stored commander precedes account SELF on self-PIC roles, while raw crew evidence is preserved. PR #217 merged as `6f1b33745d8b5c352d0d3331ea4891bb9f8d9f58`; Vercel `dpl_4MfDPVYDhR3ibgQ7uHoeUAagQkQW` is READY on that exact SHA and serves `fly-tally.com`. No persistence/schema/certification-version/GPS-role change. B2 remains a semantic review gate; destructive canonicalization is not authorized.
- **F2.4B semantic closeout is intentionally non-destructive**: there is no evidence-backed rule that can safely clear `commander`, non-DUAL `instructor`, or non-SPIC/PICUS `verification_*` without risking valid Manual/shared/training/endorsement provenance. F2 freezes current PIC display precedence and preserves raw fields; any future reinterpretation is a separate product/data-integrity decision. F2.4C cross-path characterization is next. PR #219 adds the final cross-role preservation regression and is verified by #1092 (1059/1059 unit/regression, PostgreSQL 66/66).
- **F2.4C is verified**: one cross-path characterization suite ties the RoleCrew contract to Manual Save/Edit semantics, Certification isolation, explicit FlyTally/in-person verification, shared materialization, print/export, audit/backup, recency, Safety Pilot and GPS PIC-only behavior. PR #221 merged as `84b5f5362f03ef1959956fba91584059a36c2db5`; Verify #1094 PASS (1068/1068 unit/regression, PostgreSQL 66/66) and Browser #468 PASS (production build, Chromium 34 passed / 2 skipped). No runtime/schema change. F2.5 cross-path regression + F2 closeout is next.
- **F2.5 / F2 closeout is production-verified**: exhaustive role-matrix and crafted Save coverage freezes every Manual role across EASA/ULL, function-time allocation, certification v1–v8 verification, invitation boundaries, auxiliary-role non-creditability and GPS PIC-only. Browser closeout covers desktop, both iPad orientations and mobile under light + dark presentation for key role-aware states. PR #223 merged as `bc187e307958054efa2e32db316b06139d10df6e`; Verify #1095 PASS (1077/1077 unit/regression, PostgreSQL 66/66), Browser #469 PASS (production build, Chromium 36 passed / 2 skipped), and production `dpl_GFWksQDdFMoSr9qyvQYgiCBd2ShJ` is READY on the exact merge SHA and serves `fly-tally.com`. F2 is closed; F3 Aircraft context simplification is next.
- **F3.0 aircraft-context discovery is complete and independently reviewed**: Manual New/Edit currently trusts submitted flight context after client profile defaults, while GPS re-resolves and validates the active aircraft profile server-side. Historical same-registration Edit already preserves stored snapshots. PR #225 merged as `4e42dbf7fd095aa768e404500b141510386a18c5`; Verify #1096 PASS (1084/1084 unit/regression, PostgreSQL 66/66). Browser/deploy N/A because F3.0 changed only docs + characterization.
- **F3 review reconciliation is frozen before runtime work**: broad full-regulatory override is superseded by A+. Evidence and aircraft class are profile-owned; only genuine profile-supported TMG/OTHER multi-context choices remain explicit, plus deliberate same-registration historical correction. The server derives PROFILE/SNAPSHOT authority and computes `allowedFlightContexts(profile)`; there is no generic client-sent override authority flag. PROFILE drift rejects rather than rewrites. Unchanged SNAPSHOT context is preserved without revalidating historical values against today's validator. Aircraft identity/type and Balloon class/group remain profile/snapshot-owned; FREE/TETHERED remains flight-specific.
- **Manual/GPS authority convergence is narrow and source-safe**: Manual New/registration change require an owned + canonically valid profile; inactive owned profiles may still support explicit historical back-fill. GPS keeps its existing active-owned-profile selection requirement but will use the same resolver and the same common TMG/OTHER choice where multiple allowed contexts exist. GPS Role remains PIC-only until F4.
- **F3.3 server enforcement is implemented and locally verified on the feature branch**: Manual create/registration-change re-resolve an owned profile server-side, require submitted context membership in `allowedFlightContexts(profile)` and persist the canonical authority context; same-registration Edit derives SNAPSHOT authority and preserves unchanged stored context without current-profile validation, including the legacy blank-category presentation compatibility path; GPS uses the shared PROFILE authority resolver and one common TMG/OTHER regulatory-context choice while remaining PIC-only. Shared-flight materialization remains outside this equality gate. Final local evidence: unit/regression **1102/1102 PASS**; PostgreSQL core **66/66 PASS**; TypeScript and production build PASS on the runtime-identical head immediately before the final test-only assertion adjustment. No schema/certification-version change; CI/PR/deploy not run yet.
- **F3.1 production census is complete**: 25 profiles are present, all active and 0 invalid under current validator-equivalent checks; all 289 flights have a current matching profile. The 73 apparent category divergences are certified legacy rows with blank stored `regulatory_category`; there are 0 explicit nonblank category mismatches. Exactly one certified historical flight has ULL/ULL stored context against a profile now EASA/SEP, with the profile update timestamp later than the flight date. Seven flights retain historical identity differences from the mutable current profile. No current TMG/OTHER/Balloon production population or populated Part-FCL credit provenance exists. The census was read-only and does not reopen A+.
- **F3.2 pure authority resolver is production-verified**: `allowedFlightContexts(profile)` validates the full aircraft profile authority input (including Part-FCL credit provenance), produces one standard context or only the legitimate TMG/OTHER category set, keeps evidence/class/Balloon class-group/aircraft type profile-owned, derives PROFILE/SNAPSHOT from stored vs final normalized registration, and compares raw SNAPSHOT context without deriving legacy blank categories. PR #229 merged as `abc66ae13cfc8a3af7f6ee21f19ab5c8ab63bc73`; Verify #1097 PASS including PostgreSQL 66/66; Browser #470 PASS including production build; exact production deployment `dpl_7vwVVvE98UZVYJ6upCB9CQnfok4a` READY with `fly-tally.com` alias and no alias error. F3.2 deliberately does not wire production mutations.
- **F3.3 is DONE / LOCAL VERIFIED**: Manual PROFILE/SNAPSHOT enforcement and GPS authority convergence now use the shared resolver; crafted PROFILE drift fails closed, unchanged same-registration SNAPSHOT history is preserved, create persists canonical server-authorized aircraft context, and GPS multi-context choice remains limited to the frozen TMG/OTHER A+ scope.
- **F3.4 is DONE / LOCAL VERIFIED**: Manual no longer presents Logbook/Class/Aircraft type as routine editable profile schema; it shows a compact Profile context or Stored flight context summary and submits profile/snapshot-owned fields through hidden authority-bound inputs. The only aircraft-context selector is the legitimate TMG/OTHER category set from `allowedFlightContexts(profile)`. GPS uses the same compact profile summary. Invalid PROFILE state is an explicit completion blocker with a draft-preserving Aircraft configuration link. Operation/Engine, Balloon FREE/TETHERED, launch evidence and Role/Crew remain flight-specific. Final local evidence on `e305f3ef3985d371a385a0e7231ec42d8a6d135e`: TypeScript PASS, **1110/1110** unit/regression PASS, production build PASS, disposable browser bootstrap PASS and targeted authenticated Chromium **5/5 PASS**. No schema/certification change; CI/PR/deploy not run. **F3.5 closeout is next.**
- **F3.5 / F3 is DONE / LOCAL VERIFIED**: the focused end-to-end closeout proves server-side PROFILE/SNAPSHOT/A+ authority at the mutation boundary, final normalized registration authority, unchanged historical SNAPSHOT behavior despite inactive/invalid current profiles, submit-time PROFILE re-resolution, Quick Add → immediate Save, TMG/OTHER context selection and Balloon ownership separation. Final unit/regression **1119/1119 PASS** and authenticated Chromium **4/4 PASS**; PostgreSQL core **66/66**, TypeScript and production build were already PASS on the runtime-identical head. F3.5 required no application-runtime change; only tests/browser fixtures/docs changed. Existing certification/shared-flight/backup/restore/trash/recency evidence remains authoritative after source audit; Export and Statistics read stored `flights` context and Print keeps F3 context on the flight snapshot. No generic correction path, row lock/versioning, migration, certification-version change or GPS Role expansion was added. **F3 production integration is complete:** `main@a4b1c626d487aad86ef3e2de887df50a0a2b9248` is deployed by Vercel deployment `dpl_Dn3PAymjG7aCds9xsw18shzkYM4a`, READY and aliased to `fly-tally.com`; public smoke returned HTTP 200 and the immediate runtime-error check was empty. GitHub Actions/PR were intentionally not used. F4 multi-part GPS inheritance is next.**
- **F4 discovery/design is staged for independent review**: GPS remains PIC-only until review/implementation closes the full Role/Crew path. The draft uses one common complete Role/Crew context plus an all-or-nothing whole-part override, never field-level inheritance. Server resolution must produce complete per-part Role/Crew before the shared normalizer; aircraft authority remains common from F3. Safety Pilot is only eligible if Manual/accepted-Connection parity, write-time Connection recheck and atomic `flight_connected_crew` persistence are preserved. Split changes are proposed to clear overrides rather than heuristically reassign crew evidence. No runtime/schema/certification change yet.
- **F4 independent review is reconciled**: whole-context INHERIT/OVERRIDE and server-side common+override resolution are kept; GPS INSERT column parity and RoleCrew-independent duplicate identity are confirmed in current code and now characterized by F4.0 tests. Safety Pilot is sequenced after common/override delivery and must retain the existing Manual write-time Connection guard. SPIC/PICUS remains gated by one explicit product decision about countersignature-reference inheritance across split records.
- **F4.0 is locally verified**: targeted characterization 5/5 and full regression 1124/1124 PASS. **F4.1 is DONE / LOCAL VERIFIED**: targeted cross-path contract batch 55/55, TypeScript PASS, full regression 1129/1129, production build PASS, and authenticated desktop Chromium 2/2 PASS against the disposable PostgreSQL browser DB. GPS common Role/Crew supports PIC and DUAL only; EASA DUAL requires Instructor/PIC through the shared RoleCrew contract, the server rejects stale/crafted additional crew evidence, common Role changes invalidate inherited review confirmation, and the browser proof persisted normalized `DUAL + Instructor` values to PostgreSQL. The browser fixture gained only the minimal `airports` relation needed by GPS detection; production DB/schema/certification are unchanged. **F4.2 whole-part overrides is next.**
- **F4.2 is DONE / LOCAL VERIFIED**: every GPS split has explicit `INHERIT` or complete `OVERRIDE`; server-side resolution is whole-context only, split changes clear overrides, and browser/PostgreSQL persistence proved per-flight PIC/DUAL behavior. Evidence: focused **67/67**, full regression **1134/1134**, production build/TypeScript PASS and authenticated desktop Chromium **4/4 PASS**. No production DB/schema/certification change.
- **F4.3 Safety Pilot core is implemented / verification pending**: GPS now exposes SAFETY PILOT only after adding Manual-equivalent Actual-PIC semantics. Common or overridden Safety Pilot context chooses Manual text or an accepted Connection by account ID; the shared server resolver rechecks the account and snapshots the authoritative display name, while the GPS atomic transaction rechecks live Connection state again and creates one `flight_connected_crew` row for each connected Safety Pilot source flight. One invalid/revoked connected part aborts all flights/tracks/child rows. No invitation is sent on Save; SPIC/PICUS remain blocked. Verification now includes F1.4/F4.3 focused **12/12 PASS**, targeted cross-path **80/80 PASS**, isolated PostgreSQL Manual-resolver + GPS Safety Pilot **5/5 PASS**, and TypeScript plus production build PASS on the runtime-equivalent head. F4.3 is **DONE / LOCAL VERIFIED**. Evidence: targeted cross-path **80/80 PASS**, isolated PostgreSQL **5/5 PASS**, local PostgreSQL adapter regression **4/4 PASS**, TypeScript PASS, full unit/regression **1142/1142 PASS**, production build PASS, and authenticated desktop Chromium **3/3 PASS**. The final browser proof covers common Manual Safety Pilot persistence without an account link, common connected Safety Pilot persistence with authoritative server display-name snapshot + one PIC child link, and revoked per-flight connected override failure with zero partial split persistence. The earlier browser blocker was isolated to the localhost transaction adapter, fixed, rebuilt and reverified. No production DB/schema/certification change. **F4.4 closeout is active.** The dedicated authenticated responsive GPS override matrix is **1/1 PASS** for desktop, iPad landscape, iPad portrait, 390 px mobile and 320 px mobile in light + dark. It keeps one inherited DUAL part and one complete connected Safety Pilot override visible and verifies deterministic values plus zero horizontal overflow. SPIC/PICUS remain unavailable until the separate countersignature-reference inheritance decision is made. F4.4 and the F4 milestone are DONE / PRODUCTION VERIFIED. PR #233 squash-merged to `main` as `252bcb8eb0258603c1164c5e19bfdcf25bc0d9dd`. Vercel deployment `dpl_3Jh1ghZ8wfkZRE5w3ZN83gxasnzd` is READY on that exact SHA and serves `fly-tally.com`. Production smoke returned HTTP 200 for the root, login and protected New Flight entry path, with unauthenticated protection resolving to the login surface. Immediate post-deploy runtime-error check found no errors. No DB/schema/certification change.

Detailed contract: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md`.

### Multi-aircraft Product Scale — QUEUED

Existing multi-aircraft profiles remain the foundation. The active scale phase is not a second fleet model.

The source-of-truth contract is recorded in `docs/product/MULTI_AIRCRAFT_SCALE_CONTRACT.md`.

Planned closeout:
- historical helicopter type-specific recency reads stored flight identity before any mutable profile state and fails closed when type evidence is unresolved;
- canonical fail-closed aircraft-profile validation across Add/Edit and shared-profile import is implemented;
- explicit separation of mutable aircraft-profile defaults, dynamic applicability metadata and historical flight snapshots;
- established ordinary ULL→SEP experience behavior and atypical effective-dated override provenance remain explicit and regression-covered;
- no-code onboarding proof across every currently supported regulatory category with manual identity fallback;
- sharing, exact backup/restore and multi-profile selection regression coverage at scale;
- no organization/fleet ownership or new regulatory category implied by this phase.

## Research only

### Professional Logbook Platform

Possible future capabilities include organization/operator accounts, instructor/student workflows, flight-school evidence, fleet-linked training, organizational verification, controlled reports and team permissions.

These are not implementation commitments until promoted in `ROADMAP.md`.

## Explicit non-features / guarded boundaries

- No silent rewrite of certified/finalized history.
- No invented regulatory evidence.
- No automatic claim of licence/rating validity without required evidence.
- No automatic FX conversion unless a future business rule explicitly defines it.
- No unsupported offline editing.
- No authority/legal/trademark/provider approval inferred from code, tests or internal status.

