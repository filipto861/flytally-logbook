# M3-D4 — Offline Node HTTP teardown review (2026-10-10)

**Status:** READ-ONLY ANALYSIS COMPLETE; targeted transport regression tests NOT IMPLEMENTED; supplier evidence BLOCKED. Branch base: `db9381655ae9fce4708b9c84dfd2b1c971521c88`. No ArcGIS calls authorized by this document. Satellite remains OFF.

## Observed evidence
- Two approved metadata-only GETs to `World_Imagery/MapServer?f=json` each reported `outcome=unavailable, service=base, reason=content-type`. Second: HTTP 200, `text/plain`; `attemptedMetadataRequests=1` and no tile requests. Both runs printed Node/libuv `UV_HANDLE_CLOSING` assertion after the collector diagnostic.
- Latest offline collector suite 7/7, typecheck and Next build passed on owner Windows. Four loopback HTTP scenarios (drain, cancel body, abort after cancel, abort after drain) passed without reproducing the native assertion. Real provider content remains unverified.

## Code paths inspected
- `tooling/collect-satellite-provider-metadata.mjs`: Node native fetch; on non-success/non-accepted response, cancellation in `finally` and unconditional `controller.abort()`. Error path calls `process.exit(2)` immediately after logging; this may terminate while undici/libuv cleanup is still pending. **Candidate cause, unproven.**
- `tooling/diagnose-satellite-windows-stream.mjs`: loopback 127.0.0.1, body sent promptly in one `res.end()`, no TLS; child processes wait for local `server.close()` and avoid explicit `process.exit(2)`. This does not reproduce TLS, chunked/slow responses, redirection, mismatched Content-Length, malformed bodies, abrupt reset, or collector exact error-exit path.

## Proposed isolated acceptance tests (do not contact ArcGIS)
1. Loopback HTTP integration to exercise the **collector equivalent** failure path: response received, non-JSON Content-Type, body cancellation, signal abort and error exit. Inspect child exit/signal/native assertion. Test actual stream reader rather than mocking `fetch`.
2. Vary chunking, delayed/chopped body, incorrect declared Content-Length, oversized streaming and timeout. Bound each child execution with watchdog; never expose credential values.
3. Compare orderly termination (`process.exitCode=2` after cleanup and event loop quiescence) with immediate `process.exit(2)`; distinguish exit semantics from underlying TLS behavior. Do not infer native assertion root cause from negative reproduction.
4. Require absence of token or upstream body in diagnostics; reject any network endpoint other than 127.0.0.1 in tests. Never embed live supplier token.
5. Run on owner Windows Node 24.19.0: targeted tests, typecheck, build; record results. Full suite/CI separate gates.

## Proposed design decisions for review
- Prefer setting `process.exitCode` over unconditional immediate exit after fetch cleanup, contingent on verifying bounded termination under broken upstream streams.
- Keep timeout/byte ceilings and fail-closed schema; do not loosen provider content verification.
- Keep explicit `base-only` scope for any future separately authorized supplier verification; no automatic retrial.
- No production provider, route, credentials, DB, flag, or deploy changes.

## Independent reviewer handoff (DeepSeek)
Review code paths and test gaps independently. **Do not implement.** Questions: Can Node/undici abort/cancel plus immediate `process.exit(2)` plausibly cause observed libuv assertion? What minimal loopback/TLS-negative controls separate cause from correlation? Which timeout/cancellation ordering avoids hangs and native teardown? What evidence would justify one further owner-approved supplier GET? Identify risks of false positive validity for `text/plain` JSON, especially if response is HTTP 200 but contains an upstream error envelope.

## Closing gate
Read-only review DONE. M3-D4 code changes and acceptance tests NOT RUN. No live supplier request, merge, deploy, or Satellite activation authorized.
