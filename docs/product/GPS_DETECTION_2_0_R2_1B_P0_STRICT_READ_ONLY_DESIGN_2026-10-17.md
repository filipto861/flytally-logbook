# GPS Detection 2.0 — R2.1b-P0 strict read-only execution architecture

**Date:** 2026-10-17  
**Status:** **PROPOSED / NOT APPROVED FOR EXECUTION** — technical design, not a request to retrieve tracks.  
**Repo:** `flytally-logbook` only. Current canonical `main@6a67a02475ab09c3271f8646427f7956ed6e590a`, documentation Draft PR #349 and isolated experimental Draft PR #350.  
**Evidence:** read-only GitHub source inspection and [independent DeepSeek security review reconciliation](GPS_DETECTION_2_0_R2_1B_INDEPENDENT_SECURITY_REVIEW_RECONCILIATION_2026-10-17.md). The external reviewer did not inspect code or test infrastructure independently.  
**Previous local gate:** owner-verified exact `8b410f32d207adab54d3b84b340275153d4b1731` **63/63 targeted PASS** and TypeScript PASS. No empirical real-flight contact truth.  
**This milestone:** repository architecture research/documentation ONLY. **No connection, account/role creation, queries, raw owner points, migrations, app endpoint, run, merge or deployment.**

## Post-review design correction (2026-10-17; supersedes conditional production recommendation)

The independent **DeepSeek second review was PARTIAL**, not a full repo review: it received this P0 design and the owner-scoped plan but lacked the earlier security reconciliation and did not inspect source/SQL/tests. ChatGPT separately rechecked `main` and research code, and recorded the complete [second-review reconciliation](GPS_DETECTION_2_0_R2_1B_P0_SECOND_REVIEW_RECONCILIATION_2026-10-17.md).

**Production private operator Option A remains NO-GO** under the current no-production-DB-changes scope: no existing DB-enforced one-owner role, verified principal, truly zero-write session path or actual effective grant/transaction evidence has been demonstrated. Existing owner predicates in application SQL **do not** independently restrict a DB credential. A new RLS policy, role, SECURITY DEFINER function or security-barrier view would be privileged production work needing separate migration/governance/owner authorization; it is **not** a small follow-up to this design.

The **only conditional next implementation** is an explicitly approved **disposable synthetic Postgres-only security falsification prototype** with mock subjects, synthetic GPS records, zero real credentials and no production branch cloning. Its **S01–S23** acceptance matrix is now expanded below and in the reconciliation. It cannot establish full future Neon HTTP-driver parity or consent. **No synthetic role tests have run yet.** The previously executed owner-local **63/63 targeted PASS and TypeScript PASS** apply to the in-memory GPS research module, not database access security.

**Do not treat cohort 5–50 as anonymization.** No public aggregate, per-track/private route output, temporary production research endpoint, other users' GPS scan, model training, merge or deploy is authorized. No owner-controlled full-fidelity export was verified; fallback is conditional on discovering and reviewing a real existing capability, not inventing one.

## 1. Security goal, trust boundary and threat model

**Only permitted future result:** for one **specifically authorized owner** and a **pre-authorized bounded set of existing persisted GPS tracks**, privately compute descriptive, aggregate-only post-normalization quality/legacy-vs-research candidate disagreement. No actual runway contact is declared, no certified movement counts inferred, no stored flight facts altered.

Threats: (1) mistaken or malicious subject identity, (2) admin/operator querying all owners, (3) shared-flight participants mistaken for track owners, (4) overly broad SQL/DB role reading unrelated data, (5) session/auth/migration writes during a purported read-only run, (6) private route/ID/time in query logs/errors/dumps/public PR, (7) sparse aggregate enabling inference, (8) queries outliving an authorization or running under a revoked consent, (9) unbounded point memory/CPU, (10) model/label contamination from legacy GPS-suggested counts, (11) implicit null/altitude normalization or gap bridging, (12) orphan credentials/artifacts after shutdown.

**Trust boundaries (all must be separately evidenced):**
- **Subject/consent:** the actual owner (not a guessed `user_id` or an admin claiming ownership) authorizes research purpose, exact scope, output audience, duration and revocation; mapping to an internal subject is verified by an authorized identity process.
- **DB authority:** the database credential can access **no more than the approved scope**, with no write privilege or role switching; an application `WHERE user_id` filter alone is not a confidentiality boundary.
- **Execution:** a single non-public, reviewed and time-bound operator execution within the authorized environment, without client-facing endpoints or external GPS transfer.
- **Output:** validated cohort-only counters with no raw GPS, track/flight ID, coordinates, timestamp, airport, registration or stable per-owner key; no public output or small-group inference.
- **Retention:** raw arrays memory-only in approved boundary; audit stores only approvals, process/code hashes, high-level no-sensitive-metadata outcome and decommission evidence.

## 2. Source observations verified in actual repository

| Source | Observed behavior | R2.1b consequence |
|---|---|---|
| `lib/auth/require-user.ts:5–8` | `requireUser()` delegates to `getSession()` | Not a strict no-write authentication interface |
| `lib/auth/session.ts:27–36` | `getSession` reads HttpOnly session cookie, calls `ensureDatabaseOptimizations()`, and conditionally dispatches an async `UPDATE auth_sessions.last_seen_at` | A normal app request has potential migration and session metadata writes |
| `lib/db-optimization.ts` | Optimization/migration infrastructure includes DDL and updates | Do not call from research; don't assume pending schema work is a no-op |
| `lib/db.ts:1–47` | Shared `sql` is a lazy proxy over `neon(DATABASE_URL)` or local Postgres client; existing app credential is not shown as SELECT-only | Do not import shared app `sql` in research; no claim of transactional read-only guarantee until verified in the actual driver and role |
| `lib/data/tracks.ts:76–89` | Owner-filtered join of `flight_tracks` with `flights`, but `decodePoints(...,2500)` transforms/downsamples | Ineligible source: preserve original stored full-resolution `coordinates_json` instead |
| `lib/data/flight-track-review.ts:52–66` | Owner-filtered `coordinates_json` read with `LIMIT 1`, recomputes legacy inference | Ineligible for complete flight/track cohort; legacy result is not truth |
| `research/gps-detection-r21/observational-aggregate.ts` | Pure in-memory consumer; no authentication, DB, file or network I/O; 5–50 track/100k point cap | Useful isolated postauthorization step; **its caller is the security boundary**, not its input array or cohort floor |

**Not verified:** database role memberships/grants/RLS, schema objects, row counts per approved subject, Neon branch permission semantics, read-only transaction guarantee over connection pooling/HTTP, legal basis/owner consent, data-retention policy or user-specific approved cohort. No operational action is permitted based on this document alone.

## 3. Alternatives and recommended conditional approach

| Option | Advantages | Problems / decision |
|---|---|---|
| **A — private, time-limited operator-run batch with separately verified owner identity + restricted read-only DB authority** | No public route, bounded access, private aggregates, easy removal | **Preferred design candidate, NOT authorized.** Must prove the DB credential cannot select other owners, even if caller omits `WHERE`; SQL owner predicate remains defense in depth |
| B — reuse `requireUser()` and existing Next.js API/action | Existing session identity | **REJECT for strict read-only.** Auth can write session/migrations; adds permanent attack surface and fragile route authorization |
| C — use production DB admin credential and add `WHERE user_id` in script | Fast | **REJECT.** SQL typo, wrong owner parameter or debugging query exposes other users; ability != permission |
| D — let owner export their already-stored tracks through an audited, existing user-controlled export, then local offline analysis | Owner-driven data boundary, no new DB role | **Conditional fallback** only if an authorized export path actually exists and provenance/full-resolution/lossless altitude and handling/retention are verified. Do not invent a new unreviewed export endpoint |
| E — provision DB snapshot/branch and process privately | Separates operational writes from analysis | **Not sufficient alone**: snapshot may contain other owners' data, credentials/quotas/migrations may be unsafe. No provisioning or copying approved |

**Recommended conditional architecture A:** Do not create a runner until subject authorization, data-scope restriction, DB privilege design and revocation/decommission have passed independent review and product-owner approval. If full DB-enforced owner isolation is infeasible without risky production DDL/RLS changes, **NO-GO** and explore D with a validated owner-controlled export; otherwise remain on synthetic research.

## 4. Identity, authorization and ownership contract (fail closed)

Proposed `ResearchAuthorization` is an **operator-approved out-of-band record**, not a new production table, bearer token, cookie or GitHub document containing private IDs:

```text
authorization_status = APPROVED | REVOKED | EXPIRED | UNAVAILABLE
principal_provenance = independently_verified_existing_account_subject
scope = explicitly_listed_track_set_or_verified_single_owner_bound
purpose = offline quality and algorithm disagreement diagnosis ONLY
decision_by = authorized product/data controller + actual data subject as applicable
expires_at = finite time (no implicit long-lived grant)
raw_access = execute inside approved protected boundary ONLY
output = private aggregate; no per-track/per-user route data
review = access/audit/retention/decommission agreement
```

**Hard requirements:**
- No client-provided numeric `user_id`, guess based on account/admin email, actor != track owner conflation, session-cookie copying or reinterpreted shared-flight participation.
- Mapping subject to persisted owner MUST be validated by an authorized identity resolver **before** the point query. If the only available resolver calls `getSession()` with possible writes, the strict zero-write gate remains blocked until a safer method is separately reviewed and proven.
- Time and revocation checked immediately before the run; never assume consent for any other account.
- Flight/track ownership must agree: `t.user_id = verified_owner`, `f.id = t.flight_id`, `f.user_id = t.user_id`. This is necessary even if database-level segregation exists.
- Authorization scope limits records, not just output rows. Do not read unrelated private rows and suppress them only at presentation.

## 5. DB privilege design (NOT executable SQL / not a migration)

**We must not rely on SQL `WHERE` as the only tenant boundary.** Target must be proven in a disposable *synthetic* database first.

Design contract:
1. A **nonowner, nonadmin, non-`BYPASSRLS`** credential restricted to a single authorized subject/track set. Role cannot `SET ROLE` to a broader role, use privileged stored functions, create temp objects that leak, or access unapproved tables, views and sequences.
2. Prefer **DB-enforced subject/record isolation** for reads (a correctly audited RLS policy, owner-limited object, or equally constrained strategy). Merely setting a caller-modifiable `app.user_id` session variable is **NOT secure identity**; the connecting role can spoof it. Similarly a `SECURITY DEFINER` function or a view owned by a privileged role could bypass RLS unless explicitly analyzed.
3. Explicit least-privilege schema/object grants and SELECT-only access. Independently verify role inheritance, table/view ownership, default privileges, `PUBLIC` grants, `pg_has_role`, `BYPASSRLS`, `SECURITY DEFINER` call rights, RLS enabled/forced state and effective policies. A limited role receiving SELECT on `flight_tracks` without a tested DB-enforced owner bound is **NO-GO**.
4. Prove `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, schema `CREATE`, `ALTER`, `DROP`, mutable functions, migration registry writes and attempts to broaden role all fail using the actual proposed connection/driver.
5. Validate read-only transaction/session semantics in the chosen connection protocol. `default_transaction_read_only=on` is **defense in depth**, not a substitute for grants and cannot be assumed effective without a test; switching between pooled/HTTP connections may defeat session-setting assumptions.
6. Before any real run, independently verify the production schema/grants and plan how to obtain owner-specific enforcement **without unauthorized schema migration or role grant changes**. Creating a role, RLS policy or view on production is a privileged operation and separately requires approval/backup/deploy sequencing.
7. Hard limits on maximum tracks/points, memory, statement duration and overall run time; every row must pass authorization, shape and count checks. No silent pagination into unbounded full-database scans.

**Template query shape, NON-RUNNABLE until authorized binding and DB isolation are proven:**
```sql
-- CONCEPT ONLY. DO NOT execute on production.
-- owner_subject is independently VERIFIED, not user-supplied/guessed.
SELECT t.coordinates_json
FROM flight_tracks AS t
JOIN flights AS f
  ON f.id = t.flight_id AND f.user_id = t.user_id
WHERE t.user_id = :verified_owner_subject
  AND t.id IN (:authorized_track_ids)
ORDER BY t.start_utc NULLS LAST, t.id;
```
The `:...` placeholders are **deliberately not executable** and the example does not implement a tenant-security barrier, consent, data limit or transaction.

## 6. Raw input quality, bounded diagnostic and output contract

- Use **full persisted points** exactly as stored, not the map decoder, overview field or first-track review helper. Preserve `null` altitude, true 0, negative alt, missing/nonpositive time and stored point order. The original pre-import order may already be lost.
- Reject or quality-mask corrupt/ambiguous time and coordinate edges before speed; split candidates at gaps and discontinuities; do not bridge them, invent touchdown or interpolate unsupported vertical reference.
- `SourceMetadata` altitudeMode/units/datum/accuracy fields stay `UNKNOWN` unless actually proven from source. Absolute airport elevations alone cannot establish runway AGL.
- Compare **unchanged legacy** vs **research candidate** on identical persisted point series; report `POST_NORMALIZATION_ONLY` and `preprocessingConfound=NOT_ISOLATED`.
- Report **separate denominators** for eligible, no-valid-island, candidate, abstention and model-disagreement cases. Legacy count is a heuristic suggestion and not a ground-truth label.
- Only output approved in-boundary cohort aggregate. Even aggregate counts may reveal rare event involvement; 5–50 min/max is a **workload/suppression heuristic, not anonymization or publication permission**.
- No raw arrays or per-track output to console, telemetry, connected model services, Vercel preview, GitHub, CI artifact, crash monitor, emails or laptop downloads. No stable hashes derived from private flight IDs in public docs.
- No saved/certified flight writes, regulatory recency mutation, profile changes, source weather changes or `flytally-training` edits. `WholeFlightLandingCountFromGps` stays `UNAVAILABLE`, regardless of apparent trace completeness.

## 7. Preregistered negative security tests and proof matrix

| ID | Experiment on synthetic/mock environment | Required evidence / outcome |
|---|---|---|
| S01 | No authorized subject | Hard reject before DB call |
| S02 | Revoked or expired authorization | Reject before raw read; no stale cached principal |
| S03 | Wrong subject/track owner | Deny all track rows, no ID or existence leak |
| S04 | Shared-flight participant but not owner of GPS record | Deny; participation is not consent |
| S05 | Strip SQL `WHERE` or substitute owner bind in an adversarial test | **DB-enforced isolation still denies other owners**; otherwise NO-GO |
| S06 | Readonly credential attempts INSERT/UPDATE/DELETE/TRUNCATE/DDL | All denied; verify no schema/session/flight writes |
| S07 | Attempt role switching, read `users`/other flights, call privileged routines | Deny via effective grants/inheritance/RLS, not just SQL lint |
| S08 | Access with ordinary `getSession()` on synthetic fixture | Detect migration/heartbeat potential: cannot advertise whole request as zero-write |
| S09 | Reuse credential after expiry/revocation | Deny, rotate/revoke access and verify |
| S10 | Oversized cohort, track, total points or malformed JSON | Fail closed before candidate processing; no partial private output |
| S11 | Erroneous `null -> 0` altitude / dropped timestamps / overview-only input | Reject source path or mark unavailable; prove raw-vs-transformed contract |
| S12 | Missing time, nonpositive dt, 60s+ gap | No speed=0 from invalid edge, no cross-gap candidate contact |
| S13 | Unique/small cohort, sensitive route in exception/log | No output/log disclosure; suppressed or private-only, review reidentification |
| S14 | Driver transaction/session begins on wrong connection or read-only setting not enforced | FAIL before any production run |
| S15 | Partial run, crash, cancellation or secret rotation | No raw persisted artifacts; audit only nonsensitive run status, immediate disposal/revoke |
| S16 | Attempt to use algorithm consensus as per-event ground truth | Scorecard labels physical contact accuracy `UNAVAILABLE` |
| S17 | New endpoint/action/import research into app | Forbidden; research branch/production boundary test catches change |

**P0 statuses:** S01–S17 are **DESIGNED / NOT EXECUTED**. Existing local 63/63 TypeScript-pass suite is for the in-memory research module only and **does not satisfy S01–S17 live DB privilege testing**.

## Additional independent-review security cases S18–S23 (DESIGNED / NOT RUN)

| ID | Synthetic-only negative / threat probe | Fail-closed acceptance |
|---|---|---|
| S18 | Unsafe SQL parameter binding or injection against owner and allowed track IDs | Cannot broaden authorized data scope; no raw identifiers printed |
| S19 | SECURITY DEFINER, RLS-bypassing view, mutable function and `search_path` exploitation | No access to another subject's rows, no write side effects |
| S20 | Driver/ORM logs, tracing, exception/crash monitoring on query failure | No route, location, timestamp, ID or credentials exposed |
| S21 | CI/workspace artifacts and temporary debug files | No real private tracks, zero sensitive persisted artifacts |
| S22 | Shared-flight participant presented as track owner / revoked consent | Reject before source query; no existence leak |
| S23 | Pooled connection / prepared statement reused across two synthetic subjects | Prior subject's identity/RLS scope cannot leak |

**Nuance for S06:** Denying `COPY` from an otherwise SELECT-authorized object is **not a guaranteed property of read-only privileges**. `COPY (SELECT ...) TO STDOUT` can return the same *authorized* rows a caller may SELECT. Therefore the experiment must prove **DB-enforced record scope** and trusted in-boundary execution/output handling, not promise a blanket anti-exfiltration SQL prohibition.

All earlier S01–S17 and these S18–S23 require actual targeted execution and evidence on a fully synthetic isolated database before claiming any security gate PASS. Even then, **real-owner processing remains blocked**.

## 8. Implementation milestones and stop/go gates

- **P0-D1 (this design):** Reconstruct source, threat model, compare options, decide preferred architecture candidate and test contract. **Design only.** Second independent reviewer should challenge this exact design before privileges, migrations or execution are created.
- **P0-D2 (future, approval required):** Decide whether subject-approved scope and in-boundary nonadmin SELECT-only isolation can actually be achieved *without risky production migration*; review Neon role/branch capabilities, identity source, retention/audit and explicit user permission. No raw data retrieved simply to inspect feasibility.
- **P0-D3 (future, approval required):** Implement/mock S01–S17 in disposable synthetic environment. Establish no-write/tenant isolation proofs and artifact/secret handling, then approve or reject a **single bounded execution**. Failure = NO-GO, not relaxed security.
- **P1 (future, separate owner authorization required):** One in-boundary, owner-scoped, private, no-write observational run with auditable time/point limits and no raw outputs, followed by decommission.
- **P2 (future):** Carefully interpret disagreement and abstention, not touch accuracy. Separate human event-level labels/consent and feature-flagged product design required before any runtime integration.

**No-go until proof:** owner scope unknown; too-broad DB role; untested auth writes; no subject consent; inability to prove full-resolution input or null preservation; public endpoint as only route; unbounded cohort; no retention/revocation; external GPS copying; unsafe security migration; any user/flight data alteration.

## 9. Decision register — pending product owner and evidence

**Proposed / not frozen as executed:** Option A preferred **if** and only if secure scope can be established and independently reviewed. No selected Neon role/branch, no verified identity proof, no legal/data subject authorization, no production query or permission grant. The user previously delegated T10/T14 count semantics; that delegation does **not** confer access to other user accounts or approve this security change.

**Product decision required before P0-D2/P1 execution:** approve a precisely scoped authorized subject/track set and private operator-run mechanism after this design's review and evidence. If any required fact remains unknown, stay **NO-GO**, do not default to production-admin reads.

**Closing evidence today:** main/source reconstruction and P0 architectural proposal complete; second-AI review of **this** proposal NOT RUN; tests/build/CI/security harness NOT RUN in this cycle; existing 63/63 owner-local PASS on earlier SHA; DB/schema/production reads/writes/merge/deploy NOT RUN.
