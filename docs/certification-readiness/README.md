# FlyTally Certification Readiness

Status: **v1.33.1**

This directory describes the current production-oriented Next.js implementation of FlyTally for technical and authority-facing review. It is not a statement that FlyTally is approved or certified by EASA, ÚCL or another competent authority.

Documents:

- `DATA_DICTIONARY.md` — meaning and provenance of the principal logbook fields.
- `FCL050_COMPLIANCE_MATRIX.md` — mapping between FCL.050-oriented record concepts and current FlyTally implementation.
- `VERIFICATION_SPEC.md` — certification fingerprints, revision handling and instructor-verification evidence.
- `ACCEPTANCE_MATRIX.md` — acceptance scenarios, evidence status and PostgreSQL-backed acceptance coverage.
- `CHANGE_CONTROL.md` — release, migration and documentation-control rules.

From v1.33.1 the CI verification job includes an isolated PostgreSQL 16 acceptance stage. Its output is retained as a GitHub Actions artifact so database-level integrity claims can be tied to a specific source commit rather than inferred only from source-text tests.

The executable implementation remains the source of truth. These documents must be updated whenever a release changes a protected field, certification payload, signature workflow, print/export semantics, record-retention behavior or the acceptance evidence used to support those claims.
