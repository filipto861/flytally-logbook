# GPS Detection 2.0 R2.1b — independent security/architecture challenge

**Read-only adversarial consultation request for DeepSeek/Claude.**  
**Date:** 2026-10-17  
**Repo:** `filipto861/flytally-logbook`, baseline `main@6a67a02475ab09c3271f8646427f7956ed6e590a`, experiment `test/gps-detection-r21-falsification`, Draft PR #350.  
**Source docs:** [R2.1b owner-scoped observational plan](GPS_DETECTION_2_0_R2_1B_OWNER_SCOPED_OBSERVATIONAL_PLAN_2026-10-17.md) and R1/R2/R2.1a decisions in Draft PR #349. **Review status: NOT RUN**; do not imply another AI responded.
**Allowed task:** criticize design/source evidence without code changes, DB access, credentials, user data or production operations.

## Confirmed code facts to challenge against exact repository

1. `lib/auth/require-user.ts` uses `getSession()`.
2. `lib/auth/session.ts::getSession()` invokes `ensureDatabaseOptimizations()` and can asynchronously `UPDATE auth_sessions.last_seen_at` after 15 min.
3. `lib/db-optimization.ts::ensureDatabaseOptimizations()` can run DDL and record schema migrations.
4. `lib/data/tracks.ts::getFlightTracks` uses owner-scoped SQL but its `decodePoints(payload,2500)` drops and downsamples geometry and can coerce nullable altitudes to numeric zero.
5. `lib/data/flight-track-review.ts::getFlightTrackReview` reads full raw `coordinates_json` **only for the first matching track**, and recomputes legacy prediction; it cannot provide independent T&G ground truth.
6. `lib/auth/session.ts` uses an HttpOnly session cookie; never transfer or copy cookies/DB credentials to an external AI or owner desktop script.
7. The isolated `research/gps-detection-r21/observational-aggregate.ts` is **pure in-memory**, accepts only preauthorized `KmlPoint` arrays, has no auth/SQL, returns cohort-only metrics after size/volume guardrails. These limits **do not guarantee privacy**. Research detector and unchanged legacy shadow are not certified sources of physical touchdown.
8. Owner only approved the **isolated synthetic R2.1a** experiment. No approval for bulk GPS tracks of other accounts, production endpoint, migration, deploy or supervised contact training.

## Independent reviewer questions

- What is the *least risky* authorization/data access architecture that can establish a verified owner principal, read only that owner's original persisted full-fidelity GPS points, and execute in a strictly **SELECT-only database role** without the current `getSession()` optimization/session-heartbeat writes?
- Is a temporary research-only server entrypoint with a new read-only auth resolver safe, or should this work remain **blocked until an explicitly approved, audited production read-only path** exists? Analyze replay, CSRF, cookie handling, tenant bypass, rate limits, retention and audit.
- Could a signed owner-scope research grant be issued by an existing authenticated session **without** permanent application changes or inadvertent DB mutation? Would this become an irreversible security escape hatch? Reject unsafe shortcuts.
- How should Neon/PostgreSQL **transaction read-only** enforcement and limited privileges be validated? What is the difference between application SQL statements being SELECT and the *entire request* producing no writes?
- What operator/security controls prove that only an authorized owner-scoped cohort is processed, no raw routes cross infrastructure/service boundaries, no source credentials are printed, and the output cannot reidentify sparse tracks?
- Critique the 5–50-track aggregation and exact point limits as provisional. Specify what privacy guarantees **cannot** be obtained from grouping alone.
- Is the legacy/new four-way disagreement matrix meaningful without event truth? What input normalization/source-altitude/invalid-time confounds remain?
- What negative test/evidence would falsify authorization, fail-closed sampling, or scope isolation? Identify at least five concrete attack/error scenarios.
- What *owner decision* is still needed before any real GPS record is processed, even if the code is read-only?

## Required response

1. Disagreement first: five highest-risk assumptions and supported code locations.
2. Owner authorization and privacy decision matrix; no unverifiable approval claims.
3. Minimal secure execution plan, including threat-model test set and rollback/decommission.
4. Alternative designs (at least two), with safety versus complexity trade-offs.
5. Final **GO / CONDITIONAL / NO-GO** separately for (a) pure offline aggregate module, (b) actual owner-only raw source reading, (c) production endpoint or deploy, (d) cross-account model training.
6. Exact unanswered questions; do not invent user consent, event annotations, or numeric accuracy.

**Strict boundaries:** do not use production user IDs, personal identifiers, coordinates, credentials, session cookies, private SQL query outputs or raw track files in the response. Do not change GitHub branch or execute SQL. This review is advisory, not product-owner approval.
