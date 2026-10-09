# FlyTally 3.7.0 — Satellite R2D: operational hardening design (review only)

**Status:** DRAFT / READ-ONLY DESIGN / NOT IMPLEMENTED / NOT VERIFIED.  
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
