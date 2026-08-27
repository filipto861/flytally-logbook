# FlyTally roadmap

## v1.31 — Workflow & Credentials

v1.31 consolidates the private-beta workflows introduced in v1.30 and removes duplicated pilot identity data.

- Dashboard: merge Aircraft + Costs; show routes and individual visited airports together.
- Map: both routes and airport markers are interactive and open the matching flight filter.
- Certified ULL flights: use a proper read-only logbook-entry preview instead of a generic data list.
- Flight invitations: Review & Add / Decline directly from notifications; keep Decline on the review screen.
- DUAL / SPIC / PICUS: connected instructors can be selected in Logbook data; certification automatically sends the matching connected instructor a review/sign request.
- Instructor review: one request carries the exact certified revision, tamper-evident signature evidence and the option to add the instructor's own logbook entry.
- Crew overview: keep invitation state and verification state visible on the source flight.
- Notifications: delete individual notifications and clear read notifications.
- Connections: simplify the pilot-facing relationship model to Friend / Student / Instructor while preserving directional privacy controls.
- Credentials: new top-level navigation destination combining licences, logbook identity, qualifications, signing identity and other documents.
- Licence identity: holder address and printable-logbook identity live under the relevant licence rather than in duplicate settings fields.
- Other credentials: Medical Class 1/2, LAPL Medical, ICAO English Language Proficiency, Radiotelephony Licence, Insurance and custom records; support dated or Unlimited validity.
- Print & Data, FSTD and Administration retain their established functional behavior and receive regression coverage only in this release.
- Production hardening: regression coverage for sharing, certification, print identity, permissions, mobile layout and previous production SQL/runtime issues.

## v1.32 — Pilot messaging & richer collaboration

- simple private text chat between accepted connections;
- unread message notifications;
- start a conversation from a flight/instructor review when a data discrepancy needs discussion;
- no public pilot directory, presence tracking or attachment system in the first messaging release;
- richer actionable notifications where they improve existing flight workflows.

## Later — Credential intelligence & authority readiness

- configurable 90/30/7-day expiry reminders;
- deeper rating/recency logic where reliable structured rules are available;
- documented FCL.050 data dictionary and evidence/test matrix;
- authority test cases and review of electronic format/countersignature evidence;
- no "EASA approved" or "EASA certified" product claim until accepted by the relevant competent authority.
