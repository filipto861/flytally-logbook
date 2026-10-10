# FlyTally Satellite M3-D — independent provider-integration review (READ ONLY)

Date: 2026-10-10. Repository: `filipto861/flytally-logbook`, branch `feat/3.7.0-satellite-r2d2-bounded-provider-io`. Production Satellite OFF. Owner verified clean source `fa7eaa5ef173ff4441d3a1995e33e6273781a76d`: targeted 48/48 PASS, TypeScript PASS, fresh Next production build PASS, guarded local HTTP fixture acceptance 3/3 PASS (enabled, disabled, missing-token). HTTP runs used valid synthetic PNG/JPEG fixtures, isolated approved disposable PostgreSQL, 13/0/0 intercepted supplier requests; **not live upstream, actual browser decoding or measured RSS**. Documentation-only commits followed source verification. No merge or deploy.

## Read-only source inventory

- `app/api/map-tile/[z]/[x]/[y]/route.ts`: auth and server-side stop before Satellite provider; Satellite output private/no-store; Standard map remains a separate, public cached path; Satellite 502 if missing SVG, 503 if token absent or upstream disabled.
- `lib/satellite-map-provider.ts`: **legacy live Satellite** concurrently calls ArcGIS base and preferred labels, falls back to reference labels; fetch uses `next: { revalidate: 604800 }`, reads `response.arrayBuffer()` without byte limits and embeds Base64 in SVG. MIME accepts any `image/*`; no shared admission gate, pixel/decode validation or policy.
- `lib/satellite-bounded-fetch.ts`: isolated transport primitive, caller maxBytes/timeoutMs; supported PNG/JPEG MIME; deliberately no Next caching.
- `lib/satellite-tile-transport.ts`: isolated shared deadline coordination over required pair + fallback; caller-provided gate/deadline, no production limits.
- `lib/satellite-admission-gate.ts` and `lib/satellite-shared-admission.ts`: per-isolate quotas, must reserve full configured ceiling before operations; uncertain cancellation quarantines capacity; shared owner explicitly uninitialized without valid caller policy; NOT global cross-instance memory cap.
- `lib/satellite-raster-validation.ts`: PNG/JPEG structural parser only, **not pixel decode proof** or valid decoder memory bound; no production integration.
- `lib/satellite-svg-envelope.ts`: validates aggregate encoded bytes/pixel projection/exact SVG character estimate before Base64, zero-copy Buffer view; not complete JS transient or RSS cap.
- `tooling/verify-satellite-http.mjs`: guarded local HTTP acceptance, resets disposable schema; current synthetic fixtures exercise legacy route behavior, not bounded path.

## Frozen constraints

Correctness and fail closed over convenience. No invented ceilings or vendor claims. Never treat MIME, header, PNG/JPEG structural parse, RGBA projection or successful synthetic acceptance as complete browser decoding, bounded process RSS, safe multi-instance admission or licensed production policy. Preserve auth before any upstream access, user-facing Standard route behavior, existing fallback semantics when safe, explicit disabled/missing token 503, private/no-store Satellite response, deployed OFF state. No code changes, migrations, merge, flag flip, deploy or live ArcGIS experiments during review. Preserve tests and old decisions.

## Requested independent review

1. Give a **sequence diagram/data-flow** for proposed precise route→policy→shared admission→pair/deadline→fallback→raster validation→SVG composition→response/error mapping, including signal propagation and release/quarantine proof.
2. Identify **every source-backed prerequisite** needed for real integration: provider byte/dimension/format observations or contracts, deadline/concurrency/memory envelopes, decoding/compatibility test plan, resource measurements and source provenance. Classify as evidenced, missing, or assumption; do not prescribe arbitrary numbers.
3. Investigate **transport memory copies**, Next cache bypass, hidden buffers/strings, full response-body cancellation, timed-out-but-active upstream and per-isolate/multi-worker quotas. Point to concrete code and failure modes.
4. Propose **small isolated milestones** with precise code scope, guards, tests and acceptance; prefer a first batch that improves verification or instrumentation without wiring an unsafe production path. Must keep Standard/Story/DB unchanged.
5. State **hard blocking findings** versus safe-to-defer work. If production wiring cannot be proved safe, recommend explicitly keeping it unavailable rather than a guessed default.

## Proposed acceptance matrix (review/revise)

- Missing/malformed/non-applicable policy => Satellite fail-closed with zero provider calls.
- Valid authorized request only reaches bounded supplier transport after admission; all loads share inherited absolute deadline; no Next Data Cache on Satellite path.
- All inputs bounded by supplied documented ceilings; unsupported image type, malformed stream, illegal dimensions/encoding => unavailable; no extrapolated assumptions.
- Deterministic fallback, interruption and cancellation; uncertain termination retains gate capacity; no request leaks; prevent payload caching across users.
- Countertests for valid fixture and malformed PNG/JPEG; actual browser decode and external supplier tests independently classified; assess peak memory and concurrency with observable evidence.
- No changes to public Standard behavior, auth, Story, DB or production flags.

Reply with findings, blocking questions, recommended sequence, and trade-offs. **Do not implement**; owner/ChatGPT will reconcile with code, governance and source evidence before choosing an integration batch.
