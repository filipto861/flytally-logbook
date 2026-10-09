## 2026-10-09 — R2 Batch 1 exact-HEAD local verification CLOSEOUT (Satellite ON / OFF)

**Runtime/test commit:** `49542fad9787e7ef40c4d7b117da35303e42117c` (clean Windows checkout, branch `feat/3.7.0-satellite-r2-functional-integration`). **Candidate ID:** `613756c436da76bf388134e4fef2ca251a29185cb551c70cba00b8f273f78740`. Evidence sourced from two owner-run PowerShell release logs; same candidate hash does **not** encode `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS` — retain both run configurations separately.

- **ON** (`NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`, `npm.cmd run verify:release:risk -- --base origin/main`): `release_status=PASS`; source/domain/typecheck `PASS:reused` from same-candidate iteration; aggregate **1451/1451 PASS**, fresh Next.js build **PASS**, PostgreSQL acceptance **100/100 PASS**, browser desktop Chromium **11/11**, mobile Chromium **11/11**, scale `N/A`, `blocked_evidence=none`.
- **OFF** (`NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=false`, `npm.cmd run verify:release:risk -- --base origin/main --rerun`): `release_status=PASS`; source **233/233 PASS**, domain **46/46 PASS**, typecheck **PASS**, aggregate **1451/1451 PASS**, fresh Next.js build **PASS**, PostgreSQL acceptance **100/100 PASS**, browser desktop Chromium **11/11**, mobile Chromium **11/11**, scale `N/A`, `blocked_evidence=none`. All listed gates fresh.
- Preflight verified exact branch/commit/clean worktree, `SESSION_SECRET`, and dedicated local PostgreSQL identity `flytally_satellite_r1_test|flytally_sat_r1|55432`. Browser checks used synthetic, locally served map tiles; no live Esri availability/rights, native Safari/iPad, CI, production smoke, merge, deploy, database migration or production flag activation claimed.
- Story Standard/Satellite PNG download tests cover PNG bytes/signature and tile-failure alert in both browser projects. **Batch 1 implementation is locally VERIFIED and eligible for review**, not merged or production activated. Existing earlier `NOT RUN` entries above/below are historical pre-verification state, superseded by this exact-head evidence. Documentation commits after the tested HEAD have not been separately runtime-verified. **Next: R2 Batch 2 authenticated server-side access/abuse controls; preserve both Story styles and GPS map functionality.**

## R2 Batch 1 implementation record — 2026-10-09 (NOT VERIFIED)

Branch `feat/3.7.0-satellite-r2-functional-integration`: hardened `components/flight-story-card.tsx` PNG exports to require every tile to be fetched successfully with image MIME and matching `X-FlyTally-Map-Style`, rather than silently deleting unavailable tiles. On failed PNG preparation, exposes `role=alert` with retry guidance; blocks repeated save and style switching while busy; preserves existing auto-probe and both map choices. Existing Playwright registered case extended to test both downloaded PNG files (signature and nonempty content) and failed satellite tiles with no provider network. Added source guard. **All tests NOT RUN** on this R2 branch; full browser and build evidence pending. Original design's provisional suggestion to disable Story is superseded by owner-frozen both-style requirement. Server gate has NOT been implemented. No external provider activation authorized.

## Product decision update — 2026-10-09 (owner-frozen, supersedes provisional Standard-only Story strategy)

Owner requires **both Standard and Satellite** to function on all existing authenticated map views and on the Flight Story preview / downloadable PNG. The Story Satellite capability MUST NOT be removed as a supposed licensing workaround. Existing Story auto-probe may be refactored only with verified feature parity (discoverability, selection, stable export, no unexplained unavailable UI); explicit opt-in is a candidate, not a frozen decision. Public replay remains Standard-only under existing R1 scope. Keep source-specific attribution and provider conditions as separate non-UX verification items; do not claim rights are approved. R2's core objective is functional robustness and server-side abuse protection without breaking authorized clients. Existing design clauses saying 'Story Standard-only' or 'Story export remains disabled until rights verified' are **superseded insofar as they define the desired feature**; actual production activation remains a separate gate.

Acceptance required: real/instrumented Map route + GPS Tracks + saved replay + GPS import + Story Standard/Satellite toggles and export. For Story, verify both PNGs embed correct tile style rather than blank placeholders; token failure must be visibly unavailable, not fake success. No auth/flight/certification schema modifications. Public replay negative test. Server gate design must document how Story is an authorized consumer without trusting spoofable query/header and how shared caching cannot circumvent it. R2 branch changes NOT RUN until independently executed.

# FlyTally Logbook 3.7.0 — Satellite R2 server-side entitlement and provider gate (DRAFT DESIGN, 2026-10-09)

Status: DESIGN ONLY / INDEPENDENT REVIEW PENDING. No runtime implementation, provider clearance, merge or deploy. Applies only to `flytally-logbook`. Source inspected: branch `feat/3.7.0-satellite-selector-trial` after R1 documentation closeout.

## Confirmed existing boundaries (source)
- `app/api/map-tile/[z]/[x]/[y]/route.ts` exposes GET for Standard and Satellite. Satellite depends only on nonempty `ARCGIS_ACCESS_TOKEN`; no authentication or server-side product-entitlement check. Response sets permissive CORS and shared cache headers.
- `components/satellite-map-control.ts` build-time public flag gates UI only. R1 retains fail-to-Standard behavior and disables failed satellite until remount.
- `components/flight-story-card.tsx` auto-probes the first satellite tile on mount (`style=satellite&probe=1`), uses the result to select satellite, then embeds tiles in a generated PNG. Story is independently active even when the R1 UI flag is OFF.
- Satellite upstream combines World Imagery plus labels and fallback references using a server-side token, forwarding an allowlisted or defaulted Referer; credits shown in UI are provisional. No provider contract/entitlement for FlyTally production or redistributable Story images has been verified.
- `lib/map-tile-style.ts` validates explicit map/satellite styles; keep established Standard behavior for absent style and fail-closed malformed styles.
- Existing R1 exact runtime/test HEAD `7661d1dd30ba17948ef517f7ef193358380b67cd` owner-run local Satellite ON/OFF release PASS, not production or provider approval.

## R2 objective and frozen safety requirements
1. Server is the sole authority for Satellite outbound fetch. Client flag, hidden control, referer, cookies alone, and token existence never grant provider access.
2. No satellite upstream call before explicit server approval for the specific consumer and provider rights; no silently enabled Story probe.
3. Preserve existing Standard basemap GET behavior and strict tile/style parser. Avoid cross-domain DB/certification/recency changes.
4. Reject unsupported, absent, expired, conflicting or unverified provider permissions; never treat missing as allowed.
5. No unchecked billable consumption. Provider-specific bounded timeout, request budget/rate ceiling, observability and kill-switch required before production. The exact thresholds are product/contract decisions, not invented defaults.
6. Secret token stays server-only. Prevent upstream credential exposure in responses, errors, logs and client bundles. Harden untrusted referer: never accept supplied browser referer as authority for provider credentials.
7. Cache policy must not bypass authorization on satellite path: consider CDN cache HIT for a previously permitted tile after entitlement switch-off, and Vercel/Next fetch caching. Define key scope and invalidation/TTL before code.
8. Real upstream imagery label/reference attribution and downloaded PNG reuse rights must be verified from primary provider documents and account agreement.
9. Public replay remains Standard only. Story PNG must fall back to Standard by default until separate rights + explicit end-user selection are approved.
10. Negative tests must assert **zero satellite upstream fetches** for every denied condition, not just HTTP errors.

## Proposed design for independent review (NOT APPROVED)
- Introduce a server-only `evaluateSatelliteTileAccess` policy, producing a typed allow/deny verdict with reason codes, consumer scope, provider rights and deployment environment. Only after allow may the outbound satellite fetch execute.
- Explicitly separate three paths: authenticated interactive map; Story preview/export; public replay. Story/public require independent eligibility, not inheriting interactive entitlement.
- Safe R2 baseline: gate Satellite **closed** for all consumers while provider rights remain unresolved; Standard remains accessible. If enabled later, require server activation/entitlement, permitted consumer, controlled credentials, quota state, and source-specific attribution compliance.
- Review old `probe=1`: prefer eliminating automatic paid probe; no probe request may bypass authorization. Explicit UI or capability metadata should not make an upstream imagery request merely to check permission.
- Enforcement must occur at HTTP entry before any outbound provider request and at each server-fetch route that can acquire a satellite tile. Inventory other callers and transformations before patching.
- Preserve compatibility of existing Standard URL and style validation. Decide denial response and cache headers deliberately; avoid supplying an image under a misleading Satellite label.
- Evaluate potential shared public caching and authorization leakage; satellite responses may need private/no-store until a rights-compatible public cache contract exists.
- Budget mechanism must be shared/atomic across deployment instances; an in-memory per-process counter is not enough. Decide provider ceilings and persistence/observability before enabling requests.
- Add privacy-preserving request metrics for allowed/blocked tiles, upstream result class, cache hit/miss, quotas and killswitch; exclude token and flight/GPS data.

## Acceptance matrix (planned; NOT RUN)
- Invalid z/x/y or style variants: reject, no upstream.
- Satellite token absent; server authorization absent/disabled; rights unverified/expired; source/config mismatch; user unauthenticated; public replay; Story auto-probe; Story export without explicit rights; quota exhausted; killswitch active: deny, zero satellite upstream calls.
- Allowed authenticated interactive map with provider test fixture: one approved composited tile request path, proper source credits, bounded outbound calls and failures to Standard.
- Standards unaffected: Standard style and legacy no-style remain functional, existing public maps do not require new login.
- Cache tests: fresh denial after activation switched OFF even when former cached imagery exists; no accidental CDN or server fetch-cache bypass.
- Browser ON/OFF in production-equivalent builds; desktop/mobile + iPad portrait/landscape light/dark where applicable. Dedicated local PG identity; source/domain/typecheck/aggregate/build/PG/browser risk gates. Native Safari and live provider checks separately evidence-tagged.

## Open product/provider decisions — BLOCKING
A. Confirm provider legal license and API plan for hosted tile proxy, server-side storage, compositing, attribution, rate limits and end-user exports; source revisions and contractual evidence required.
B. Decide intended Story satellite behavior: Standard-only until rights confirmed versus separately licensed explicit Satellite export. Existing auto-probe cannot remain an implicit usage trigger.
C. Choose permission model (global environment/provider gate vs per-user entitlement), account quotas, cost threshold, control mechanism and who can override.
D. Confirm exact host/referrer allowlist for deployed `fly-tally.com`, access-token scope and rotation plan. Existing evidence suggests current allowed referrer only `https://*.vercel.app`; this remains unverified for actual requests.
E. Resolve public client backward compatibility if satellite endpoint is denied under an existing consumer. Prefer no satellite in public surfaces rather than a fabricated fallback.

## Proposed minimal milestones
R2.0 confirm full caller inventory, platform cache and current provider primary source requirements (read-only).
R2.1 independent DeepSeek/Claude design security+rights review, resolve decisions A–E.
R2.2 implement server-only fail-closed gate with negative unit/API tests; no positive production provider calls.
R2.3 Story auto-probe removal/gating and controlled explicit consumer classification, preserve Standard/export.
R2.4 bounded provider integration, attribution and quota observability only after external written clearance.
R2.5 exact-head tests + documentation closeout, then separate user production activation decision.

No provider approval, merge, deployment, DB migration or public Satellite activation follows from this design document.
