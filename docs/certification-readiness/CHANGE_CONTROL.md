# FlyTally Change Control

Version: 1.33.5

## Release principles

1. Production changes are versioned in `package.json` and identified by Git commit SHA.
2. The production branch is advanced only after the intended release set is assembled; avoid iterative production deployments for partial work.
3. Build, typecheck and required acceptance tests must pass before a release is treated as stable.
4. Runtime migrations must be idempotent and must not silently modify certified/locked regulatory records.
5. Any change to the certification canonical payload requires explicit certification-version compatibility handling.
6. Any change to instructor verification payload/signature semantics requires an update to `VERIFICATION_SPEC.md` and acceptance coverage.
7. Any change to FCL.050 print semantics, pilot-function allocation or record ownership must update the compliance/acceptance documentation.
8. System documentation is part of the release.
9. Critical integrity claims should be supported by reproducible database/integration evidence wherever practical.
10. Performance indexes are added only after measured evidence identifies a real query problem; query shape alone is not sufficient justification.

## Documentation revision rule

For every major functional release, update as applicable:

- production version / commit reference;
- system description revision history;
- data dictionary when stored/protected fields change;
- compliance matrix when logbook behavior changes;
- verification specification when certification/signature behavior changes;
- acceptance matrix when a workflow or evidence layer changes.

## Database-change rule

Schema additions should prefer backward-compatible, idempotent migrations. Historical certified rows must not be rewritten merely to resemble the newest representation.

Prefer version-aware readers, nullable/defaulted fields, legacy fallback behavior and one-time migrations against mutable records. Do not bypass certified-record protection merely to simplify a migration without a separately reviewed exceptional procedure and backup.

## Acceptance-evidence rule

From v1.33.1, CI includes an isolated PostgreSQL 16 service. A scenario may be called database-automated only when the test actually executes against PostgreSQL. Source scanning remains supplemental.

From v1.33.2, ownership/security tests execute SQL templates read directly from production server-action sources, while documentation explicitly distinguishes this from browser/session end-to-end testing. Backup evidence distinguishes the portable-file SHA-256 checksum from keyed HMAC-SHA-256 verification evidence.

From v1.33.3, the controlled R1→R2 scenario executes the production server-side read queries used by Flight detail, Audit, Authority Verification Report and Print against one PostgreSQL state.

From v1.33.4, the instructor-request preflight query itself executes against PostgreSQL, protecting against ambiguous joined-column references after certification.

From v1.33.5, the `Sign & add FI entry` materialisation path executes against PostgreSQL and the CI environment also maintains a 10,000-flight controlled scale baseline for Dashboard, Flights and Print SQL. Scale measurements are evidence of the controlled database environment only and must not be presented as browser, Vercel, Neon-network or concurrent-load benchmarks.

## Backup/restore evidence rule

An exact restore containing certified history must fail closed when certification history does not verify. Signed or revoked verification rows in portable backup must retain valid server HMAC evidence before certification-history validation succeeds.

For a verification belonging to the restored pilot's flight, `record_revision` and `flight_hash` must bind to the current certified fingerprint or matching archived revision. Recomputing the outer portable-file checksum is insufficient to replace keyed evidence.

## Full-workflow evidence rule

The controlled R1→R2 scenario must preserve:

- verifiable archived R1 after correction;
- historical R1 instructor evidence that cannot satisfy current R2 verification;
- distinct R2 certification fingerprint and revision-bound verification;
- current-only evidence in detail/print projections;
- complete history in Audit and Authority Verification Report.

The instructor materialisation extension must preserve a separate instructor-owned FI/PIC record. Removing that copy must not remove or rewrite the student's source flight or verification evidence.

## Incident/hotfix rule

A production hotfix should identify the concrete failure mode, limit change scope, add a regression test where practical, preserve regulatory/audit history, receive a patch version and update controlled documentation when documented behavior changes.

### v1.33.4 incident record

Manual v1.33.3 acceptance found that certification of a DUAL flight completed successfully but the subsequent automatic instructor-request step returned HTTP 500. Manual `Request approval` failed identically. Production logs identified PostgreSQL `42702` (`column reference "id" is ambiguous`) in `upsertInstructorRequest()`: a JOIN between `flight_participations p` and `flights f` selected unqualified `id`.

v1.33.4 changed that projection to `p.id`, added AC-27 PostgreSQL coverage and did not modify the already-certified flight, certification hash, revision history, signature model or schema.

## Performance-evidence rule

The scale harness must use a deterministic synthetic account, apply the relevant production indexes, execute `ANALYZE`, and record `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` planning/execution timings. Thresholds are CI safety bounds rather than guaranteed public latency targets.

A future optimization should retain before/after evidence. Do not add an index solely because a plan contains a sequential scan; a sequential scan may be optimal for an all-time account aggregate.

## Current controlled baseline

v1.33.5 is the final **Certification Readiness** baseline of the v1.33 series. It retains the v1.33.4 instructor-request hotfix, closes AC-11 FI materialisation evidence, and adds AC-24/25 10,000-flight database scale evidence. Earlier v1.33 releases established the Authority Verification Report, immutable revision lifecycle, PostgreSQL integration stage, cross-user ownership, backup/restore integrity and full R1→R2 projection consistency.

The certification-readiness documents and tests do not confer regulatory approval. Any authority-facing claim must be checked against the deployed implementation and competent-authority guidance.
