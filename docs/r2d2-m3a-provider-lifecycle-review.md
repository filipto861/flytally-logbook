# R2D.2 — M3-A Satellite provider lifecycle: proposed review contract

Status: **DRAFT / INDEPENDENT REVIEW REQUESTED / NOT IMPLEMENTED** (2026-10-10).
Repository: `filipto861/flytally-logbook`; owner verified standalone base SHA `7baefdf7d6ec75878b566853052238698774abb4` on Node 24: five targeted suites **69/69 local PASS** and TypeScript PASS. This evidence does **not** certify integrated provider behavior on this or later docs commits.

## Frozen scope
- Owner-approved Option B: Satellite-only `cache: "no-store"`, bounded streamed supplier I/O.
- Keep Standard route/cache, Story, existing auth and style-before-secret ordering, client rollback, existing provider output SVG shape, and user-facing behavior unchanged unless explicitly accepted.
- Production Satellite OFF; Draft PR #279; no merge, deploy, schema change, Training edit, real supplier request, numeric budget guessing, or license discussion in this milestone.
- Missing or invalid production policy: fail closed without Satellite upstream calls. Source-backed budget selection is a separate gate.

## Verified discovery / why integration cannot be a simple import
- `lib/satellite-map-provider.ts`: parallel World Imagery (required) and preferred labels (optional); fallback reference labels; currently uses seven-day Next Data Cache, `arrayBuffer()`, `image/` MIME prefix, no byte-validated raster composition.
- `lib/satellite-bounded-fetch.ts`: `Promise.race` deadline can settle wrapper while fetcher/read stays pending; its cleanup attempts abort and reader cancellation but does NOT expose transport-settlement evidence. A rejected wrapper alone must not authorize lease release.
- `lib/satellite-admission-gate.ts`: process-local, explicitly configured admission; `quarantine()` permanently retains capacity on uncertain termination. A single new gate per HTTP request would defeat inter-request accounting.
- `lib/satellite-raster-validation.ts`: structural PNG/JPEG checks, **not pixel decode**.
- `lib/satellite-svg-envelope.ts`: caps selected composition input and projected pixels/RGBA/SVG, **not peak RSS or actual decoded work**.
- Route `app/api/map-tile/[z]/[x]/[y]/route.ts` does not currently pass `request.signal` to provider. Existing HTTP fixtures spoof image MIME with text markers, invalid for M2b.

## Proposed operation states (not a frozen implementation)
For each upstream call, distinguish `not-started`, `in-flight`, `settled-success`, `settled-failure`, and `termination-unknown`. Track the *actual underlying operation*, not merely the awaiting provider wrapper. A cancellation request is an event, not proof of settlement. Lease accounting has separate `active`, `released` and `quarantined` terminal transitions; never release `termination-unknown`. No timer-based reclamation.

## Proposed orchestration invariants (review before implementation)
1. Validate and authorize in the route before token access, policy admission or any supplier activity.
2. Validate full policy then reserve peak simultaneously admissible fetch ceilings in a **shared process-local** gate before launching upstream work. Count fallback work and total composition separately; reject non-admissible starts rather than queueing by default. Global fleet/RSS guarantees must not be claimed.
3. Support caller disconnect propagation plus explicit per-call and whole-tile deadline behavior; deadlines must not multiply across preferred/fallback paths. No new numeric defaults.
4. Required base failure aborts pending preferred labels, stops any fallback, and returns unavailable only after safe accounting disposition. If preferred labels fail structurally, timeout, or HTTP, try fallback only while base is valid and tile deadline/capacity remain available; fallback failure allows base-only result.
5. Do not hold the HTTP response open indefinitely awaiting a noncooperative operation: return bounded unavailability, **quarantine** unproven work. Provide a way to observe quarantined count without secrets. Confirm whether late settlement can be observed; do not silently reclaim without a separately reviewed proof-backed lifecycle.
6. Validate MIME/content-encoding, bounded body and PNG/JPEG structure before composition. Full pixel-decode requirement and hosting memory envelope require an explicit source-backed decision; structural validation is not full decoding.
7. Never leak supplier tokens, URLs, body bytes or unsanitized upstream errors.
8. Keep `401`, `400`, `502`, `503`, Satellite-specific private no-store headers, and Standard public contract explicit; check against current route before freezing detailed HTTP matrix.

## Required failure-injection / acceptance cases
- Base fails before preferred; preferred never resolves despite abort: provider deadline returns, lease quarantined, no fallback or capacity reuse.
- Preferred fails first: base remains pending; bounded fallback only after required base is known valid or policy explicitly approves other sequencing; no extra unreserved work.
- Base valid, preferred invalid, fallback valid → two-image SVG; fallback invalid → base-only SVG.
- Abort while waiting on headers; abort during body reader; client disconnect; disconnect before supplier start; timeout before/after reader creation.
- Successful settled operations release once; unknown termination cannot release after late `finally`.
- Concurrent HTTP requests share a gate; saturation produces zero new supplier calls. Two process instances do not create a false fleet-wide guarantee.
- Malformed PNG/JPEG fixtures are rejected; valid source-generated fixtures pass; multiple supported MIME/size/encoding combinations.
- Missing/NaN/overflow/inconsistent policy, oversized response, zero-length, invalid header, mismatched Content-Length and excess output all fail closed without secret disclosure.
- Standard, auth, Story, public replay and Satellite OFF baseline remain unchanged.

## Independent DeepSeek review questions (READ ONLY)
1. Specify a *realistic* cancellation/transport settlement contract compatible with the current `fetchSatelliteBounded` interface. Can actual fetch settlement be proved? If not, where exactly is quarantine mandatory?
2. Propose a minimal per-operation state machine and ownership graph preventing double release, leaks, or untracked label/fallback work.
3. Show the exact admission reservation schedule for parallel base + preferred and optional fallback; explain peak-copy/output limitations and how a shared gate is initialized per process/serverless isolate.
4. Identify hidden races in simultaneous base failure / labels success, caller disconnect, timeout and late upstream settle. Prioritize tests that would catch them.
5. Evaluate structural validator vs true PNG/JPEG pixel decoder. Identify an enforceable and testable decoding/resource policy without inventing numerical limits or relying on transitive dependencies.
6. Flag route contract changes likely to break Standard/public auth/Story or pre-existing source-level tests.
7. Return: blockers, changes required to this contract, a small M3-B/C/D implementation sequence, and precise acceptance criteria. **Do not write code or deploy.**

## Remaining gates
- Independent review: NOT RUN.
- Supplier/hosting measurements; real decode policy; explicit production ceilings: UNRESOLVED.
- M3 provider integration, valid-fixture HTTP, build/full tests, browser and production release: NOT RUN.
