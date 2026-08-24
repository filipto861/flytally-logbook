# FlyTally roadmap

## v1.10 — FCL.050 Compliance Gate

Completed:

- per-flight FCL.050 certification readiness status
- server-side blocking of incomplete EASA certification
- mandatory SPIC/PICUS countersignature details
- checks for DUAL PIC/instructor identity and applicable advisory remarks
- complete FSTD data gate before certification
- stable EASA column 1–12 print layout

## v1.11 — Certified Records & Audit v2

Completed / implemented in this release:

- shared canonical certification fingerprint logic for current and archived records
- SHA-256 integrity verification for flight certification versions 1 and 2
- detailed revision comparison for corrected certified flights
- printable per-flight Certification Audit Report
- FSTD certified corrections using the same R1 → correction R2 → certified R2 model as flights
- immutable archived FSTD revision snapshots with mandatory correction reason
- FSTD revision comparison and integrity verification
- Certification Center for Ready / Needs attention / Correction drafts / Certified / Integrity issues
- certification state labels in the normal Flights list
- database schema v8 for FSTD certified revision history
- integrity regression tests for flight and FSTD fingerprints

Authority review of electronic countersignature evidence remains an external acceptance item and must not be represented as completed product approval.

## v1.12 — Field UX + PWA

PWA is a required v1.12 deliverable.

- installable FlyTally PWA for iPad/iPhone/Android/desktop
- web app manifest, icons and standalone display mode
- service-worker/offline shell strategy
- field-first Add Flight UX for iPad and mobile
- resilient local draft handling when airport connectivity is poor
- explicit sync/conflict handling before any offline draft becomes a server record
- SkyDemon/KML mobile import polish and UTC regression coverage
- large touch targets and reduced data-entry steps for use at the aircraft/airfield

Offline support must not silently weaken certified-record integrity. Certified records remain server-authoritative and immutable; offline functionality should focus on safe drafts and read-only cached reference data until synchronisation succeeds.
