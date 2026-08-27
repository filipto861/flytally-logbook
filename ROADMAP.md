# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.32 · Integrity & Performance

Focus:
- one visible flight-request workflow backed by `flight_participations`
- signed evidence backed by exact-revision `flight_verifications`
- compatibility projection for legacy `instructor_flight_approvals`
- structured training purpose for LAPL FCL.140.A refresher training
- certification fingerprint v3 including structured purpose
- PostgreSQL-side dashboard aggregation
- scalable print date-range filtering while retaining complete-logbook output
- licence type normalization
- CI verification gate
- removal of one-off production cleanup logic and render-time database self-repair

## Near term

- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- add disposable PostgreSQL integration tests for cross-user ownership, correction/supersede and instructor workflows
- profile production SQL with `EXPLAIN (ANALYZE, BUFFERS)` before adding more indexes
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated
- continue print performance work for very large logbooks without removing complete-logbook export

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. New social or messaging features should not be added at the expense of record integrity or performance.
