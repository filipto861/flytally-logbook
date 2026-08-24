# FlyTally roadmap

## v1.10 — FCL.050 Compliance Gate

- per-flight FCL.050 certification readiness status
- server-side blocking of incomplete EASA certification
- mandatory SPIC/PICUS countersignature details
- checks for DUAL PIC/instructor identity and applicable test/check/revalidation remarks
- complete FSTD data gate before certification
- keep the official EASA column 1–12 print layout stable

## v1.11 — Certified Records & Audit v2

- refine revision comparison for corrected certified flights
- exportable certification/audit report
- bring FSTD certified corrections to the same revision model as flights
- integrity diagnostics for certified fingerprints and revision chains
- authority-review preparation for electronic countersignature evidence

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
