# FlyTally Certification Readiness — retained evidence set

Historical evidence baseline: **v1.33.3**

This directory preserves certification-readiness evidence created around the v1.33.x implementation. It remains useful for provenance and test-history review, but it is **not the current release-status source of truth**. Current cross-cutting architecture lives in `../../ARCHITECTURE.md`; current FCL.050-oriented implementation/evidence documents live in `../compliance/FCL050_IMPLEMENTATION.md` and `../compliance/FCL050_EVIDENCE_MATRIX.md`. Nothing here states that FlyTally is approved or certified by EASA, ÚCL or another competent authority.

Documents:

- `DATA_DICTIONARY.md` — meaning and provenance of the principal logbook fields.
- `FCL050_COMPLIANCE_MATRIX.md` — mapping between FCL.050-oriented record concepts and current FlyTally implementation.
- `VERIFICATION_SPEC.md` — certification fingerprints, revision handling and instructor-verification evidence.
- `ACCEPTANCE_MATRIX.md` — acceptance scenarios, evidence status and PostgreSQL-backed acceptance coverage.
- `SECURITY_AND_RESTORE_EVIDENCE.md` — cross-user ownership tests, backup integrity layers and exact restore evidence.
- `FULL_WORKFLOW_EVIDENCE.md` — complete R1→R2 certified training workflow and cross-view consistency evidence.
- `CHANGE_CONTROL.md` — release, migration and documentation-control rules.

From v1.33.1 the CI verification job includes an isolated PostgreSQL 16 acceptance stage. v1.33.2 extends that stage with cross-user ownership and backup/restore integrity evidence. v1.33.3 adds a complete certified DUAL workflow that executes production certification, correction, request/signature and view-projection SQL against the same PostgreSQL state.

The executable implementation and current regression tests remain the source of truth. If a current change relies on one of these historical evidence documents, either update/promote the relevant material into active documentation or explicitly record why the historical evidence is still applicable.
