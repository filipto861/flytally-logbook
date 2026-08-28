# FlyTally v1.33.5 Certification Readiness Finalization Evidence

Version: 1.33.5

## Purpose

v1.33.5 closes the v1.33 Certification Readiness series by adding database-backed evidence for the remaining instructor materialisation workflow and a controlled large-account read-performance baseline. It does not change the certification payload version, the flight SHA-256 canonical payload, or the instructor HMAC-SHA-256 signature semantics.

## AC-11 — Sign & add FI entry

`tests/integration/postgres-fi-materialization.test.ts` executes the production SQL templates used by the connected-instructor flow against an isolated PostgreSQL 16 database.

The controlled scenario proves that:

- a signed instructor verification remains bound to the student's exact certified revision and source hash;
- `Sign & add FI entry` creates a separate flight owned by the instructor rather than changing ownership of the student's source record;
- the instructor copy is materialised as an FI record with the expected PIC/FI function-time allocation;
- the source GPS track is copied to the instructor-owned record without moving or deleting the student's track;
- deleting the instructor-owned copy clears the participation's copy reference through the production ownership relationship while the student's certified source record and signed verification evidence remain present.

This supplements AC-12, which already protects source-record independence after a participant-owned draft exists.

## AC-24 / AC-25 — 10,000-flight scale baseline

`tests/integration/postgres-scale-readiness.test.ts` creates a synthetic account containing **10,000 flights**, plus 10,000 unrelated noise-account flights, and applies the relevant production query indexes. After `ANALYZE`, it executes `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on SQL templates read directly from the deployed application sources.

The automated baseline covers:

- Dashboard all-time aggregate query — `lib/data/dashboard.ts`;
- Flights first-page query including totals/window aggregates — `lib/data/flights-fast.ts`;
- date-scoped EASA print selection — `app/(protected)/print/page.tsx`;
- complete 10,000-flight print SQL selection — the same production print query.

The test records planning and execution time into `flytally-scale-evidence.json`. CI preserves that file as a commit-specific artifact for 90 days in addition to the ordinary PostgreSQL acceptance transcript.

The thresholds are deliberately broad CI safety bounds, not marketing performance claims. A later optimization must be justified by measured evidence; this release does not add speculative indexes simply because a query contains a sequential scan.

## Critical joined-SQL review

The certification finalization also rechecks the critical server-action projections that join regulatory workflow tables. Regression assertions require explicit table aliases on the primary identifiers used by:

- instructor-request preflight (`flight_participations p` / `flights f`);
- instructor signing/materialisation (`flight_participations p` / `flights f`);
- certification read (`flights f` / `users u`);
- legacy approval signing (`instructor_flight_approvals a` / `flights f`).

This is supplemental static protection. The AC-27 instructor-request query and the AC-11 materialisation path are also executed against PostgreSQL.

## Evidence limits

The scale harness is **not a browser, network-latency, Vercel, or Neon load test**. It measures database execution on the isolated PostgreSQL 16 CI service using a controlled synthetic dataset. React rendering, browser printing of thousands of HTML rows, internet latency, concurrent user load and device-specific performance remain separate concerns.

Likewise, the AC-11 test executes production SQL and cryptographic evidence logic but does not automate a real browser login or click sequence. Manual production acceptance remains useful as a separate layer, as demonstrated by the v1.33.4 instructor-request incident.

## v1.33 closure

With v1.33.5, the Certification Readiness series has reproducible evidence for certified-record immutability, correction revisions, exact-revision instructor verification, revocation, cross-user isolation, backup/restore integrity, full R1→R2 projection consistency, instructor-request SQL correctness, FI materialisation/source independence, and a 10,000-flight database read baseline.

These tests and documents are engineering evidence. They do not constitute approval or certification by EASA, ÚCL, or another competent authority.
