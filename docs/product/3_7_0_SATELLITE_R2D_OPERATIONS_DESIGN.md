## 2026-10-09 — R2D.1 verified implementation closeout / R2D.2 next (supersedes earlier pending status)

**R2D.1 LOCALLY VERIFIED** at exact production-code and test-fixture SHA `895d8caeb392a77b202f53efa2fc36a19a689443` (risk candidate `bb5f618f76d53cc8cf2473091a1ddb35c340025d3ddf44820d9348be2d732915`). Full release risk independently PASS for client Satellite ON and OFF, both with source **233/233**, domain **46/46**, TS+aggregate+Next production build PASS, disposable local PG **100/100**, desktop Chromium **11/11**, mobile Chromium **11/11**, no blocked evidence. Initial OFF Playwright failed on `ECONNRESET` before any HTTP status at invalid style request (one desktop case); repeated *identical HEAD* full OFF risk gate PASS without code changes. Cause remains unconfirmed; both results retained, not silently treated as a never-failed run. Read existing release/candidate logs for provenance; release PASS is **local**, not CI.

Authenticated real Next production HTTP synthetic fixtures on same SHA PASS for enabled/disabled/missing-token, respectively **13/0/0** intercepted upstream calls; strict malformed/duplicate style 400, unsigned/revoked 401, disabled and no-token 503/no-store/no image, and independent public Standard 200. Existing Leaflet fallback and Story preview/PNG registered browser tests PASS. Fresh coordinates fixed test-only fallback cache reuse without deleting actual cache or changing production `lib/satellite-map-provider.ts`. Emergency switch must be configured on each running deployment instance and takes effect with deployment/env propagation, not globally atomic.

**Release boundaries remain frozen:** Draft PRs #276/#277/#278 unmerged; production Satellite OFF; no real provider or budget calls, no production server env changes, no database migration, no Training edits, no physical iPad/native Safari/CI validation, no merge or deploy. Owner deferred separate provider licence research but this does not imply public commercial launch rights or activation approval.

**Next R2D.2 (DESIGN / SECOND-AI REVIEW, NOT IMPLEMENTED):** inspect current upstream fetch shape first, then propose per-fetch cancellation/AbortController, bounded response-header/body streaming, content-type/signature checks, bounded SVG composition, and deterministic synthetic hanging, truncated, malformed, oversized and partial-label fallback tests. **Numeric timeout/byte/concurrency limits and their applicability are UNDECIDED** until independent review and owner decision; no invented defaults, no per-instance counters masquerading as global provider quotas. Preserve selected Standard/Satellite UI, Story first-tile auto-probe and PNG export behavior and public Standard replay. R2D.3 separate after R2D.2 reviewed phase.

**Documentation-only commit after verified SHA:** the local release result belongs to the exact earlier SHA; never auto-inherit its candidate PASS on the later docs-only branch HEAD.

## 2026-10-09 — R2D.1 HTTP enabled first run failure and cache-isolation follow-up

**Owner test result:** Fresh ON full release on `fda1c14697358bbdeb0c30dcd0ac184e26b37433` PASS. Subsequent real Next HTTP `enabled` fixture processed logical tile 2 with expected fallback-label marker in SVG (content assertion passed), then stopped because the event recorder did not see a newly intercepted fallback request for that tile. **HTTP enabled FAIL, disabled/missing-token NOT RUN.** The fallback URL from `lib/satellite-map-provider.ts` carries no per-test access token and has `next: { revalidate: CACHE_SECONDS }` (7 days). Prior fixture invocations may have warmed Next Data Cache despite a fresh temporary log file. This is a supported likely root cause; requires successful isolated rerun to validate. Do not remove fallback event assertions or change provider caching to make the test pass.

**Test-only remedy:** use a run-scoped 32-lowercase-hex `FLYTALLY_SATELLITE_HTTP_RUN_ID` generated once for the three-mode series; derive five valid z=18/x/y coordinates via SHA-256, pass to synthetic upstream guard, keep logical scenario identifiers for expected 1/2/3/4/5 fetch/failure behavior. New series gives fresh URL cache keys; passing the same run ID across enabled/disabled/missing-token means the emergency guard is checked against possibly warmed fallback URL without cache erasure. Session, malformed style, exact external HTTP response and provider count assertions stay strict; failure diagnostics only show event kind/logical scenario/outcome. The **disabled branch must not touch any upstream cache or fetch**, regardless of prior warm entries. No production runtime changes.

**Status:** new fixture/test/docs commit requires fresh local syntax/target/iteration and three real HTTP mode reruns, then same-HEAD full Satellite ON/OFF release. Native Safari/live provider/CI/deployment NOT RUN; Draft and production Satellite OFF.

## 2026-10-09 — R2D.1 implementation status after independent review

**R2D.0 review reconciled and acceptance FROZEN. R2D.1 implementation STAGED / ALL TEST EVIDENCE NOT RUN.** This entry supersedes earlier `Proposed (not frozen)` status for **R2D.1 only**; R2D.2 and R2D.3 remain proposals requiring separate decisions.

Minimal runtime change: authenticated `style=satellite` reads `FLYTALLY_SATELLITE_UPSTREAM_DISABLED` on the server, exact `"true"` only, after style/session/missing-token gates and before calling `satelliteTile()` (which may consult Next upstream Data Cache). Return non-image 503 `Cache-Control: no-store` and `X-FlyTally-Map-Style: unavailable`, no internal flag/token leaked. All other values/absent preserve previous runtime behavior. `style=map` unaffected. Existing Flight Story auto-probe and PNG pipeline, map control, and public replay **not changed**; 503 leads to client-requested Standard via established fallback.

Manual real Next HTTP harness on **R2D.1 branch only** supports `FLYTALLY_SATELLITE_HTTP_MODE` (`enabled`, `disabled`, `missing-token`, default enabled), passed to an isolated child server and synthetic upstream fixture. Each run uses guarded disposable PostgreSQL, a locally generated fake token or explicit missing token, and blocks non-local upstream sockets; disabled mode checks repeated same tile 503/no-store/zero interceptions. To investigate warmed upstream Data Cache without claiming false evidence, run **enabled then disabled** without rebuilding between the two; warm-cache presence is not guaranteed simply by a previous run, but provider/cache access is source-guarded before the call. Unit source guard and Playwright map+Story 503 fallback scenarios staged.

**Required before R2D.1 local closeout:** clean branch/HEAD, syntax/typecheck, targeted source, iterate, fresh production build with Satellite ON, three isolated HTTP modes enabled/disabled/missing-token, then fresh independent full ON and OFF release with isolated PostgreSQL and desktop/mobile Chromium; separately native Safari remains NOT VERIFIED. Not an instantly effective global switch; rollout must account for per-instance environment propagation. No approval to merge/deploy; provider-license discussion deferred by owner, not treated as cleared.

## 2026-10-09 — DeepSeek independent review reconciliation (R2D.0)

**External read-only review:** `APPROVE WITH CHANGES`. Reconciled with actual `app/api/map-tile/[z]/[x]/[y]/route.ts`, `lib/satellite-map-provider.ts`, `components/satellite-map-control.ts`, `components/flight-story-card.tsx`, the synthetic Next HTTP harness and browser/source contract tests. **R2D.0 REVIEW COMPLETE** after recording this decision; implementation and tests remain separate.

**Accepted and frozen for R2D.1:**
1. Keep tile-coordinate validation and strict style parsing first. Invalid/duplicate style → existing HTTP 400 with `Cache-Control: no-store` and no provider calls. Standard (`style=map`) remains available and public.
2. Satellite `getSession()` remains before reading provider secrets, checking the emergency gate, accessing upstream fetch/cache, or composing an SVG. Anonymous/revoked → existing 401, `private, no-store`; no observable config status to unsigned callers.
3. If authenticated, retain existing missing-token 503, `no-store` precedence, then check the **server-only** `process.env.FLYTALLY_SATELLITE_UPSTREAM_DISABLED === "true"` before `satelliteTile()`. Exactly `"true"` disables; absent/`false`/other preserves previous behavior (no implicit new config repair). Disabled → **503**, `Cache-Control: no-store`, `X-FlyTally-Map-Style: unavailable`, generic non-image body and **zero** provider fetches even if Next's upstream tile cache is warm. Route is already `force-dynamic`; the guard must precede every Satellite upstream cache/fetch call.
4. **No in-response style substitution.** Client receives error 503 and issues separate `style=map` fallback, using existing map control/Story behavior. The HTTP error response is not an image. No newly exposed config flags or tokens in headers/HTML/JS/logs; existing `X-FlyTally-Map-Style: unavailable` is already the machine-readable availability contract. We deliberately do NOT introduce a new `disabled=true` header that leaks internal configuration.
5. This is a deployment-config emergency disable **not** an instantly refreshed, atomic kill switch. Mixed behavior across instances during rollout is possible until target deployment/config has converged. Keep production OFF/stacked Draft; no provider or billing changes.

**Test acceptance (R2D.1):** independent source guard checks exact ordering and server-only flag, malformed and duplicate style 400, anonymous/revoked 401, missing-token existing 503, authenticated disabled 503/no-store/unavailable and no image/token disclosure, provider fetch count zero, unchanged Standard 200/public/CORS, and preserved Story/interactive fallback under a disabled HTTP tile. Extend the existing guarded Next fixture with **separate child-process disabled configuration** so no live provider calls are possible; run synthetic enabled and disabled scenarios, not by mutating live config. A previous enabled fixture run may populate Next's cache; the disable route must not access it. Exact-HEAD targeted/typecheck/iteration, HTTP fixture enabled+disabled, and full Satellite UI flag ON/OFF release including map/Story acceptance remain required. Native Safari and real production TLS are separate `NOT VERIFIED` gates.

**Accepted for later R2D.2 / R2D.3, not code-authorized today:** per-upstream `AbortController`, cancel sibling requests on base failure if feasible, timeout tests with non-resolving fetches, raw streaming byte ceiling, content-type/signature and final SVG-size limits, exact reviewed numeric budgets, concurrency/backpressure measurement; no per-process fake global quota. All numeric limits, provider-account budget and multi-instance behavior remain explicitly UNDECIDED.

**Scope disagreements deliberately resolved in favor of existing runtime:** Earlier R2D draft said the tile response should `return Standard with status`, but the real API and browser already use **a separate Standard request after Satellite HTTP error**; corrected above. DeepSeek suggested `private, no-store` for disabled 503; existing authenticated *unavailable* response contract uses `no-store` (non-publicly cacheable). Preserve that contract and avoid unrelated response-header churn. DeepSeek's generic request for a machine-readable error is satisfied by existing status 503 plus `X-FlyTally-Map-Style: unavailable` without exposing the internal disable setting.

**Review disposition:** APPROVE WITH CHANGES → **ACCEPTED FOR R2D.1 SMALL BATCH**. No R2D pass/release implied by review alone. Licence research separately deferred by owner; production activation still requires explicit approval.

# FlyTally 3.7.0 — Satellite R2D: operational hardening design (review only)

**Status:** R2D.0 REVIEW RECONCILED / R2D.1 ACCEPTANCE FROZEN; runtime NOT IMPLEMENTED / NOT VERIFIED.  
**Date:** 2026-10-09. **Repo:** `filipto861/flytally-logbook` only.  
**Base:** R2C documentation closeout `8e0851012e271927157e7d5f3ae6a1aca76d6715` (Draft PR #276).  
**Exact latest verified runtime SHA:** `66c3aec4d49bc576c67afd39720fe03d4e48b17c`, candidate `a5f5b1bef64d80aa78cfe6bfbeea69a6e2ad7c931c36b6664f0fddd16fd7dd25`.  
R2C synthetic Next HTTP integration PASS (13 intercepted provider fetches), Satellite ON/OFF independent local releases PASS. This design branch is NOT covered by those release results.

## 1. Owner priority and frozen boundaries

The owner prioritizes continuing technical Satellite work and expressly defers a separate provider-license research discussion at this step. **Deferring research is not granting rights or authorizing production enablement**; preserve the pre-existing external decision record without allowing it to obscure current technical work.

- Keep Standard selected initially, no automatic persistence/autoselection; Satellite is an explicit opt-in on authenticated supported map views.
- Retain usable Standard **and** Satellite in Flight Story preview/PNG; do not delete or silently disable the existing Story function. Existing Story first-tile automatic satellite probe is a separately identified behavior, not permission to remove it without a UX decision.
- Public shared flight replay stays Standard-only.
- Retain strict map style parser (missing style means Standard; invalid/duplicate style 400) and server session validation per Satellite request.
- Production app auth, aviation flight records, certification, recency, GPS inference, Training repo, and DB schema are out of scope.
- Draft stacked PRs only; production `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS` remains OFF. No live Esri calls or production secrets in tests.

## 2. Verified source inventory and current gaps

| Source | Observed contract | Gap / consequence |
| --- | --- | --- |
| `app/api/map-tile/[z]/[x]/[y]/route.ts` | Single `style` validation before Satellite session; anonymous 401; missing `ARCGIS_ACCESS_TOKEN` 503; failure 502; success private/no-store; Standard public/cacheable | No separate emergency upstream-disable decision evaluated at the HTTP boundary |
| `lib/satellite-map-provider.ts` | `satelliteTile` requests World Imagery and preferred imagery labels concurrently, may fetch reference labels as fallback, converts full received buffers into embedded SVG data URLs; catches network exceptions | Outbound requests do not have an explicit timeout or response-size ceiling in this helper; billable request count may exceed one per displayed tile |
| `components/satellite-map-control.ts` | Map-local Standard/Satellite switch, revert on error, existing map viewport state | Must not be remounted or silently change selection as a side effect of server hardening |
| `components/flight-story-card.tsx` | Separate Story SVG+PNG pipeline, uses first-tile `?style=satellite&probe=1` fetch automatically and preserves user-selectable styles | A Story view can trigger Satellite upstream usage even with interactive Satellite UI flag OFF; must remain accounted for in request-pressure analysis |
| `tooling/verify-satellite-http.mjs` and `satellite-http-upstream-fixture.cjs` | Isolated disposable PostgreSQL, real Next session, synthetic provider calls, explicit upstream socket denial; R2C PASS | Does not measure many simultaneous tiles, max body, upstream hangs, or server emergency disable |

**Important distinction:** `next: { revalidate: 604800 }` is an upstream cache hint, while Satellite downstream responses are private/no-store because every request requires a live session. Do not infer that one browser map tile equals one billable upstream provider fetch or that cache always absorbs it. Multiple server instances and Story exports affect request amplification.

## 3. Proposed milestones (review before implementation)

### R2D.0 — inventory and acceptance freeze (THIS PR)

- Trace interactive map, Story preview/probe, Story PNG export, and public replay to the server endpoint; preserve actual behavior.
- Define denial/fallback matrix and exact test fixture for a server-side emergency stop.
- Inspect Next/Vercel environment update semantics before promising a fast kill switch; an env change may need deployment/restart to take effect.
- Define load-test methodology and metrics **using synthetic upstream only**; no real traffic or invented provider quotas.
- Independent DeepSeek review of auth ordering, kill-switch scope, caching, multi-instance semantics, Story compatibility and test coverage.
- Exit: reviewed design/decision record; no production code changes.

### R2D.1 — explicit upstream-disable guard (smallest code batch, AFTER review)

**Proposed (not frozen):** server-only `FLYTALLY_SATELLITE_UPSTREAM_DISABLED=true` disables Satellite imagery for every caller, including authenticated Story; missing/false retains legacy behavior for backward compatibility. It is an emergency *deployment configuration* guard, **not** a durable global quota/instant dynamic toggle. Activation or removal requires the platform's effective config refresh; do not claim immediate change without proof.

- Strict invalid style stays 400; anonymous Satellite still 401 before upstream (decide/document exact order versus emergency-disable); disabled signed-in Satellite becomes 503/no-store with `X-FlyTally-Map-Style: unavailable` and **zero provider calls**.
- `style=map` remains public and unaffected; authenticated request with token configured but disable enabled still has zero upstream calls.
- Never return an image marked Satellite if none was fetched. Interactive tile errors return Standard with status; Story keeps explicit error and Standard fallback rather than a fabricated Satellite PNG.
- Must not expose token or flag in client bundle; no separate authorization bypass.
- Tests: direct source contract and actual Next HTTP with synthetic token, active login, disabled server, public Standard, no interception; ON/OFF Playwright and regressions. Any config change adds a new exact candidate.

### R2D.2 — bounded provider I/O (proposal, numeric limits NOT DECIDED)

- Use a single explicitly reviewed per-upstream timeout and maximal decoded image size, with cancellation and fail-closed handling. Agree values using controlled response tests, actual provider/client performance evidence and hosting memory constraints; **no arbitrary 'reasonable' number hardcoded as source truth**.
- Validate declared content types and byte lengths before base64 inlining; reject malformed/oversized base imagery as 502 and avoid producing misleading partial success. Optional labels may fail independently with existing fallback contract preserved.
- Add deterministic tests for delayed/never-resolving provider requests, failed abort, oversized payloads, fallback behavior and provider token non-disclosure.
- Concurrency/memory pressure: test multiple tile requests (with synthetic fixtures) before deciding semaphore/shared state. Per-instance concurrency control must **not** be described as a cross-instance billable budget.

### R2D.3 — visibility, request pressure and rollout criteria (separate decision)

- Synthetic high-pressure workload for initial route map, GPS route, Story auto-probe and Story export. Count server tile hits, *actual provider fetch attempts*, cache paths, 200/401/400/502/503 outcomes, request duration and sizes. Never log token, session cookie, coordinates, flight ID, GPS payload or image bytes.
- Decide whether quotas/cost ceilings are required for initial rollout and on which deployment boundary; a true global budget needs provider-account enforcement or atomic shared durable state. Do not implement a fake per-process budget.
- Native iPad Safari portrait/landscape, dark/light and Flight Story PNG visual check. Test authenticated production-equivalent TLS separately from special localhost Secure-cookie behavior.
- Controlled live-provider smoke only after actual token/config and independent activation decision; no test makes paid requests by default.
- Before activation: explicit owner decision, stable build, deployment target/rollback, monitoring, and any separately deferred external provider prerequisites.

## 4. Behavior and acceptance matrix

| Situation | Expected behavior | Upstream Satellite calls |
| --- | --- | --- |
| Invalid/duplicate `style` | 400, no-store | 0 |
| Anonymous Satellite | 401, private/no-store | 0 |
| Signed-in, missing token | 503, no-store | 0 |
| Signed-in, emergency disable active (R2D.1 proposal) | 503, unavailable, no-store | 0 |
| Signed-in, enabled, valid synthetic upstream | 200 SVG, private/no-store | 2 or 3 depending on label fallback |
| Base imagery failure | 502 unavailable, no-store | Actual attempted upstream calls counted |
| Preferred/fallback label failure but valid base | 200 imagery-only (no fake labels) | Actual attempted upstream calls counted |
| Revoked session | 401 before provider | 0 |
| Public shared replay | Standard only, existing behavior | 0 Satellite |
| Standard tile in any configuration | Existing public Standard contract | 0 Satellite |

The matrix records required properties, **not** permission to change existing Story behavior or an assertion that all R2D branches are implemented.

## 5. Independent review questions

1. Does the proposed emergency-disable guard preserve authenticated/signed-out ordering and strict style parsing without bypassing sessions?
2. Is a separate server env guard appropriate for the first iteration, with explicit redeployment semantics? What smaller alternative would be safer?
3. What is the highest-risk backpressure/caching behavior of concurrent World Imagery + labels per tile? How should malformed payloads and stalled fetches be tested without live provider traffic?
4. How can we preserve Flight Story's existing Satellite selection/PNG behavior while reducing unnecessary upstream requests, *without* silently changing owner-frozen UX?
5. What production-safety risks remain unaddressed by this narrowly scoped design? Separate critical blockers from deferrable optimizations.

**Requested independent review:** read-only; report APPROVE / APPROVE WITH CHANGES / BLOCK, ranked risks and precise proposed changes. Do not commit, merge, deploy, contact real provider, alter certification/flight models, add arbitrary quotas, or move authorization client-side.

## 6. Evidence and closing contract

R2D.0 is a **documentation/review milestone**, not implemented server hardening. GitHub doc changes are not local unit/iteration/release PASS. For code milestones: source/domain/typecheck, targeted unit+HTTP fixture, production build, isolated PostgreSQL and ON/OFF Playwright risk release on exact code SHA; record separate flags/evidence. Complete ROADMAP/FEATURES/CHANGELOG on same work cycle and distinguish tested runtime SHA from any later docs commit. No merge/deploy without explicit owner decision.
