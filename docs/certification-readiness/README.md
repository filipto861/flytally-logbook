# FlyTally Certification Readiness

Status: **v1.33.2**

This directory describes the current production-oriented Next.js implementation of FlyTally for technical and authority-facing review. It is not a statement that FlyTally is approved or certified by EASA, ÚCL or another competent authority.

Documents:

- `DATA_DICTIONARY.md` — meaning and provenance of the principal logbook fields.
- `FCL050_COMPLIANCE_MATRIX.md` — mapping between FCL.050-oriented record concepts and current FlyTally implementation.
- `VERIFICATION_SPEC.md` — certification fingerprints, revision handling and instructor-verification evidence.
- `ACCEPTANCE_MATRIX.md` — acceptance scenarios, evidence status and PostgreSQL-backed acceptance coverage.
- `SECURITY_AND_RESTORE_EVIDENCE.md` — cross-user ownership tests, backup integrity layers and exact restore evidence.
- `CHANGE_CONTROL.md` — release, migration and documentation-control rules.

From v1.33.1 the CI verification job includes an isolated PostgreSQL 16 acceptance stage. v1.33.2 extends that stage with cross-user ownership checks using the production SQL templates and with a backup/restore fixture that re-verifies certified R1/R2 fingerprints, verification HMAC evidence, participation binding and GPS data after restore.

The executable implementation remains the source of truth. These documents must be updated whenever a release changes a protected field, certification payload, signature workflow, print/export semantics, record-retention behavior or the acceptance evidence used to support those claims.
