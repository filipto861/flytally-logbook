# FlyTally Certification Readiness

Status: **v1.33.0**

This directory describes the current production-oriented Next.js implementation of FlyTally for technical and authority-facing review. It is not a statement that FlyTally is approved or certified by EASA, ÚCL or another competent authority.

Documents:

- `DATA_DICTIONARY.md` — meaning and provenance of the principal logbook fields.
- `FCL050_COMPLIANCE_MATRIX.md` — mapping between FCL.050-oriented record concepts and current FlyTally implementation.
- `VERIFICATION_SPEC.md` — certification fingerprints, revision handling and instructor-verification evidence.
- `ACCEPTANCE_MATRIX.md` — acceptance scenarios that should be demonstrated and progressively automated.
- `CHANGE_CONTROL.md` — release, migration and documentation-control rules.

The executable implementation remains the source of truth. These documents must be updated whenever a release changes a protected field, certification payload, signature workflow, print/export semantics or record-retention behavior.
