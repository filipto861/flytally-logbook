# FlyTally Change Control

Version: 1.33.3

## Release principles

1. Production changes are versioned in `package.json` and identified by Git commit SHA.
2. The production branch is advanced only after the intended release set is assembled; avoid iterative production deployments for partial work.
3. Build/test/typecheck must pass before a release is treated as stable.
4. Runtime migrations must be idempotent and must not silently modify certified/locked regulatory records.
5. Any change to the certification canonical payload requires explicit certification-version compatibility handling.
6. Any change to instructor verification payload/signature semantics requires an update to `VERIFICATION_SPEC.md` and acceptance coverage.
7. Any change to FCL.050 print semantics, pilot-function allocation or record ownership must update the compliance matrix.
8. System documentation is part of the release, not an optional afterthought.
9. Critical integrity claims should progressively be supported by reproducible database/integration evidence rather than source-text assertions alone.

## Documentation revision rule

For every major functional release, update at minimum:

- production version / commit reference;
- system description revision history;
- data dictionary if stored/protected fields changed;
- compliance matrix if logbook behavior changed;
- verification specification if certification/signature behavior changed;
- acceptance matrix if a new critical workflow or new evidence layer was introduced.

## Database-change rule

Schema additions should prefer backward-compatible, idempotent migrations. Historical certified rows must not be rewritten merely to make them resemble the newest schema representation.

If legacy records need compatibility behavior, prefer:

- version-aware readers;
- nullable/defaulted new fields;
- legacy fallback logic;
- explicit one-time migration against mutable records only.

Do not bypass the certified-record protection trigger to simplify a migration unless a separately reviewed, exceptional migration procedure has been approved and independently backed up.

## Acceptance-evidence rule

From v1.33.1, the main GitHub verification workflow includes an isolated PostgreSQL 16 service for database-backed acceptance scenarios. Acceptance output is retained as a commit-specific CI artifact for 90 days.

A scenario may be described as database-automated only when the test actually executes against PostgreSQL. Source scanning and regex assertions remain useful regression guards but must not be represented as equivalent evidence.

From v1.33.2, ownership/security tests may execute SQL templates read directly from production server-action sources. Documentation must clearly distinguish this from a full browser/session end-to-end test. Backup/restore evidence must also distinguish the unkeyed portable-file SHA-256 checksum from the keyed HMAC-SHA-256 used for verification evidence.

From v1.33.3, a workflow may be called cross-view database-accepted when the same PostgreSQL scenario executes the exact server-side read queries used by the relevant views. This still does not constitute browser automation or visual-regression evidence; those layers must be described separately.

## Backup/restore evidence rule

An exact restore containing certified flight history must fail closed when certification history does not verify. From v1.33.2, signed or revoked verification rows contained in a portable backup must also retain valid server HMAC evidence before certification-history validation succeeds.

For a verification belonging to the restored pilot's own flight, its `record_revision` and `flight_hash` must bind to either the current certified fingerprint or the matching archived certified revision. Recomputing the outer portable-file checksum is not sufficient to replace this keyed evidence.

## Full-workflow evidence rule

The controlled R1→R2 acceptance scenario must preserve the distinction between historical and current evidence:

- archived R1 remains verifiable after correction;
- R1 instructor evidence remains historical and cannot satisfy current R2 verification;
- R2 receives a distinct certification fingerprint and distinct revision-bound instructor verification;
- current-detail and print projections may show only current revision/hash evidence;
- Audit and Authority Verification Report may retain the complete historical evidence chain.

Any future refactor of those read predicates must keep the full-workflow acceptance test green or explicitly update the documented semantics.

## Incident/hotfix rule

A production hotfix should:

1. identify the concrete failure mode;
2. limit the change to the smallest safe scope;
3. add a regression test where practical;
4. preserve regulatory/audit history;
5. receive a new patch version;
6. update system documentation when the hotfix changes documented behavior.

## Current controlled baseline

v1.33.3 extends the Certification Readiness baseline with a complete PostgreSQL-backed R1→R2 DUAL workflow and consistency checks for Flight detail, Certification Audit, Authority Verification Report and Print. v1.33.2 added cross-user ownership and backup/restore evidence; v1.33.1 introduced the isolated PostgreSQL acceptance stage; v1.33.0 introduced the Authority Verification Report and initial controlled documentation set.

The certification-readiness documents and test evidence do not themselves confer regulatory approval. Any final authority-facing claim must be checked against the deployed implementation and the competent authority's guidance.
