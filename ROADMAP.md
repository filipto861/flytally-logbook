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
- exportable certification/audit report on the relevant flight
- bring FSTD certified corrections to the same revision model as flights
- integrity diagnostics directly on certified flights and FSTD records
- compact Draft / Locked / Certified / Correction states in the normal flight workflow
- keep certification and audit controls contextual instead of adding a separate certification dashboard
- authority-review preparation for electronic countersignature evidence

## v1.12 — Field UX + PWA

PWA is the required v1.12 deliverable, but FlyTally remains intentionally online-first.

- installable FlyTally PWA for iPad/iPhone/Android/desktop
- web app manifest, icons, standalone display mode and Apple PWA metadata
- online-only service worker with no navigation/API/user-data caching
- cleanup of the earlier offline-shell prototype and its local flight-draft layer
- field-first Add Flight UX for iPad and mobile
- 48 px coarse-pointer touch targets, 16 px mobile form controls and safe-area support
- sticky mobile save actions and one-column entry/review grids on narrow screens
- clearer GPS import / Manual Entry selection while preserving GPS import as the default Add Flight flow
- `Save and add another` returns directly to Manual Entry
- SkyDemon/KML/GPX/CSV mobile import polish
- UTC regression coverage: explicit offsets convert to UTC and timezone-less track timestamps are never guessed from the device clock

Offline flight entry and background synchronisation are deliberately out of scope. Certified records remain server-authoritative and immutable, and FlyTally requires a network connection for application data.
