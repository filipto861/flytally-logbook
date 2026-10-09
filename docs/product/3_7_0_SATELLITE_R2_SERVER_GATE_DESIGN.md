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
