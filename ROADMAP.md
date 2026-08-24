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

PWA is a required v1.12 deliverable.

Implemented foundation:

- installable FlyTally PWA metadata for iPad/iPhone/Android/desktop with standalone mode and safe-area viewport support
- privacy-safe service worker: only the offline shell and static assets are cached; authenticated logbook pages and API responses are not cached
- public `/offline` shell that can keep a minimal flight draft while the server is unreachable
- user-scoped local flight drafts so different FlyTally accounts using the same browser do not share offline draft data
- Add Flight autosaves a new manual entry locally while it is being filled and restores it after navigation, refresh or connectivity loss
- a local draft is cleared only after a successful server-side flight save/navigation; validation or network failures keep it available
- no background or silent flight synchronisation: after connectivity returns, the pilot opens/reviews the draft in normal Add Flight and explicitly saves it to the server
- certified records remain server-authoritative and immutable and are never modified offline
- field-first mobile/iPad styling: 48 px touch targets, 16 px form text, one-column narrow layouts, sticky save actions and safe-area insets
- resumed offline drafts and `Save and add another` open directly into Manual entry; normal Add Flight still keeps GPS import as its primary workflow
- existing KML/GPX/CSV UTC handling remains deterministic: explicit offsets are converted to UTC and timezone-less timestamps are never guessed from the iPad/device clock
- regression tests cover UTC normalization plus local-draft validation, size limits and per-user storage isolation

Still requiring device validation before v1.12 is considered fully field-tested:

- install/add-to-home-screen behavior on real iPad/iPhone and Android devices
- offline launch after the shell has been cached at least once online
- resume/save behavior across an actual connectivity interruption
- SkyDemon/KML import from the mobile file picker and share/file workflow on iPad
- final visual/touch polish based on real cockpit/airfield use

Offline support must not silently weaken certified-record integrity. Certified records remain server-authoritative and immutable; offline functionality focuses on safe drafts and cached application shell data until the pilot deliberately returns online and saves a reviewed record.
