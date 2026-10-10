# Satellite production gate — provider / decode / resource evidence matrix

Updated 2026-10-10. This document records **requirements**, not fabricated provider specifications. Production Satellite remains OFF.

| Contract item | Current evidence | State | Required acceptance |
|---|---|---|---|
| ArcGIS base imagery HTTP format, transfer encoding, typical and maximum sizes | Live provider URL in `lib/satellite-map-provider.ts`; synthetic JPEG 1x1 only | MISSING provider evidence | Record official Esri product/version docs and authorized controlled observations; note location/zoom/response provenance |
| Preferred imagery labels format and dimensions | URL and synthetic PNG 1x1 | MISSING | Source and representative approved response observations |
| Reference label fallback format/dimensions | URL and synthetic PNG 1x1 | MISSING | Separate fallback contract and limitations |
| Full JPEG/PNG pixel decode | Node structural parser, synthetic valid fixtures | MISSING production proof | Explicit supported-format/decoder policy, representative decode and corruption tests |
| Browser decode compatibility | Offline Playwright Chromium synthetic smoke available, not yet verified by owner | PARTIAL TOOLING ONLY | Owner local Chromium test, then iPad Safari and mobile evidence |
| Transport bytes / read deadline | Caller-configurable isolated bounded fetch, unit tests | VERIFIED isolated mechanism; PRODUCTION POLICY MISSING | Credible published/observed envelope and owner-approved effective ceilings |
| Node RSS, heap, JS strings, concurrent load | Single-process 1x1 synchronous memory snapshots | MISSING deployment evidence | Representative Next worker and load measurements incl. transient/peak methodology |
| Multi-instance admission | Per-isolate shared gate only | MISSING | Document instance count/autoscaling and safe aggregate strategy or fail-closed |
| Cancellation | Best-effort body cancel and unproven quarantine | PARTIAL | Verify platform termination behavior; do not call cancel a proof |
| Satellite no-store supplier traffic/cost | Intended isolation, no real supplier usage measurement | MISSING | Supplier terms, traffic/limits and owner approval |
| Attribution/licensing | Provider URLs only | MISSING | Explicit authorized license terms and UI attribution check |

## No-production-access batch (current)

New `tooling/verify-satellite-browser-decode.mjs` is an **offline opt-in** smoke test using installed Playwright Chromium. It checks the synthetic PNG and JPEG fixture decode and final 256 SVG wrapper presentation dimensions in an actual Chromium image element; all non-data network requests are aborted. It does **not** measure pixel fidelity, decoder peak RSS, iPad Safari behavior or actual ArcGIS contractual properties. It must not auto-apply results as production limits. Playwright browser executable may need installation; any missing executable is NOT RUN, not a product failure.

## Release gate

Do not modify production provider or flip Satellite flag until source-backed provider contract, decoder requirement and representative performance budgets are reviewed and an explicit owner activation decision is recorded. This evidence matrix alone is NOT approval.
