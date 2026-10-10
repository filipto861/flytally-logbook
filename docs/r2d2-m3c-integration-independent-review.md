# R2D.2 — M3-C independent integration review handoff

Status: **REQUESTED / NOT YET REVIEWED**. Prepared 2026-10-10.
Repository `filipto861/flytally-logbook`; branch `feat/3.7.0-satellite-r2d2-bounded-provider-io`.
Owner clean source SHA `dd9b88d30335389290d851db33d3850fcd4af0ec`: **87/87 targeted local PASS + TypeScript PASS**. Later docs-only HEAD does not have a separate local test run.

## Assignment to DeepSeek — READ ONLY, independent

Audit the actual code in the listed branch. Do not assume documentation proves a source invariant. Return concrete file/function references and actionable reproductions or counterexamples. **Do not change code, branch, infrastructure, DB or feature flags; do not deploy.**

### Frozen decisions

- Satellite View v3.7.0, Option B: Satellite-only `no-store` bounded upstream I/O. Standard map/public cache, auth/style/token ordering, Story, existing SVG result behavior and feature-flag OFF must not regress.
- Safety and data integrity > convenience. Unverified production policy means **unavailable**, not invented byte/timeout/concurrency/pixel defaults.
- `AbortSignal` / a wrapper deadline is not proof of upstream termination. Unknown lifecycle => quarantine lease, never timer refund.
- Structural PNG/JPEG verification is **not** full pixel decoding; source-backed decoder/resource envelope still unresolved.
- Per-instance gate is only local; one new gate per request would defeat inter-request admission.

### Review exact files

- `lib/satellite-tile-transport.ts`
- `lib/satellite-required-pair.ts`
- `lib/satellite-label-fallback.ts`
- `lib/satellite-admitted-pair.ts`
- `lib/satellite-parallel-admission.ts`
- `lib/satellite-admission-gate.ts`
- `lib/satellite-fetch-lifecycle.ts`
- `lib/satellite-bounded-fetch.ts`
- `lib/satellite-raster-validation.ts`
- `lib/satellite-svg-envelope.ts`
- `lib/satellite-map-provider.ts`
- `app/api/map-tile/[z]/[x]/[y]/route.ts`
- `tooling/satellite-http-upstream-fixture.cjs`
- Matching `tests/v370-satellite-*.test.ts`, `tests/v370-map-layers.test.ts`.

### Audit questions and suspected edge cases

1. **Absolute vs relative deadline:** The coordinator computes `deadlineAt = now() + totalDeadlineMs` then calls `fetchSatelliteRequiredPair(..., totalDeadlineMs)`, whose own timer starts after pair admission. Does waiting for admission or synchronous setup grant extra elapsed budget? Can injected `now` diverge from real timers? Specify one monotonic deadline contract, without inventing production thresholds.
2. **Timeout/fallback policy:** Do `deadline`, `caller-aborted`, `upstream`, malformed structure, and rejected preferred status get correct fallback eligibility? Particularly can a local wrapper timeout wrongly start fallback while old upstream remains pending but quarantined? Is this allowed with available capacity?
3. **Base failure and sibling cancellation:** Could base reject before preferred starts? Does `Promise.all` await wrapper settlement, not physical supplier shutdown? What state transitions prevent silent release or accidental new fallback?
4. **No-start race:** Can abort between reservation and first fetch invocation classify `not-started` reliably? Are reservations released once and only once?
5. **Exceptions/reasons:** In `satellite-fetch-lifecycle.ts`, the `reason` may be duck-typed from an arbitrary thrown object. Evaluate secret leakage, unsafe fallback allowlisting and whether only exact `SatelliteBoundedFetchError` instances should be accepted.
6. **Encoded/decode/pixel allocations:** Assess actual peak buffers and SVG/base64 copies vs isolated ledger. Inspect `satellite-svg-envelope.ts` and what changes are prerequisites before provider wiring.
7. **Policy, concurrency, isolate scope:** How to create and reuse one gate per actual process/isolate without mutable per-request gates or unverified deploy resource numbers? Clarify how to fail closed without connection.
8. **Production HTTP and tests:** Current real provider still has Next Data Cache and unbounded `arrayBuffer`; fixture uses invalid marker bytes. Specify minimum real PNG/JPEG fixtures and route/session/cache/Standard/Story acceptance before activation.
9. **Cancellation observability:** State exactly what local settlement can and cannot be proved with current M2a. Identify any success classification that releases too early relative to open network/reader operations.

### Required deliverable

Return **BLOCK / APPROVE WITH CHANGES / APPROVE** for beginning provider integration, with an ordered list of critical/high/medium findings. For each: affected files, concrete failure trace, smallest safe change, test needed and acceptance criterion. Distinguish true blockers from postrelease improvements. Recommend a compact patch sequence within existing **M3-C/M3-D/M4** (avoid expanding roadmap phases). If evidence is insufficient, say `unverified`. Do not claim producer approval, safe global RSS, vendor licensing, build, CI or deployment.

### Current verified and unverified gates

- M3-C 1–5 isolated tests: owner 87/87 targeted + typecheck local PASS at exact source SHA above.
- Full suite, Next build, HTTP real-route tests, Playwright, CI, deployment, production smoke: **NOT RUN on current source**.
- Hosting/source numeric resource policy, real decoder acceptability, physical upstream termination and integrated provider correctness: **UNRESOLVED**.
- Satellite prod OFF; no merge/deploy.
