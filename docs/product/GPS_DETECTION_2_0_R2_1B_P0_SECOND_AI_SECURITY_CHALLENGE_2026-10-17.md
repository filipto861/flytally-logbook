# DeepSeek / Claude independent challenge — R2.1b-P0 strict read-only design

**Date:** 2026-10-17  
**Reviewer role:** independent adversarial **READ-ONLY** security/architecture reviewer. **Consultation on THIS revised design NOT RUN.**  
**Repos:** `filipto861/flytally-logbook` only, canonical `main@6a67a02475ab09c3271f8646427f7956ed6e590a`, isolated Draft PR #350. `flytally-training` must remain untouched.

## Required reading — full documents, not just this handoff

1. [R2.1b-P0 strict read-only execution design](GPS_DETECTION_2_0_R2_1B_P0_STRICT_READ_ONLY_DESIGN_2026-10-17.md), **FULL CONTENT REQUIRED**.
2. [Earlier R2.1b independent security review reconciliation](GPS_DETECTION_2_0_R2_1B_INDEPENDENT_SECURITY_REVIEW_RECONCILIATION_2026-10-17.md).
3. [Owner-scoped observational research plan](GPS_DETECTION_2_0_R2_1B_OWNER_SCOPED_OBSERVATIONAL_PLAN_2026-10-17.md).

If you cannot open the documents, request their *entire content* and clearly mark your assessment PARTIAL; do not imply a complete review. Please do not query production systems or ask to receive raw GPS, session cookies, credentials or identifiable account details.

## Frozen constraints

- No production database SQL, rights/role creation, schema migrations, private data reads, cross-account model training, GPS export to third-party AI, runtime integration, endpoint, merge or deploy.
- The only local evidence is **owner-local 63/63 targeted tests PASS + TypeScript PASS** at exact `8b410f32...` on an isolated in-memory research primitive; no security role/query, event contact accuracy, whole-app build or CI proof.
- GPS motion hypothesis never confirms actual touchdown; observed-island pattern count never becomes certified whole-flight landing count; missing/invalid input fails closed.
- Existing `requireUser/getSession` may run migrations and update session heartbeat; normal HTTP session access therefore does not guarantee zero application writes.
- Existing map DTO downsamples and `Number(null)` may become 0; first-track review sees one track only. Both are unsuitable full-fidelity scientific sources.
- Owner/scoped authorization is not established merely by access to database administrator credentials.

## Mandatory adversarial questions

1. **Is Option A genuinely implementable?** In Postgres/Neon, can a separate SELECT-only role be **DB-enforced restricted to one verified owner** without privileged code execution, role-inheriting escape hatches, spoofable `app.user_id`, or production DDL? Compare RLS, security-barrier views, per-subject roles and per-track preapproved access objects; identify which require owner-approved migrations/grants or are infeasible.
2. **Principal provenance:** how can a private operator bind a verified owner subject without importing a session cookie, trusting a user-supplied ID, accidentally causing auth/session write side effects, or impersonating another tenant?
3. **True no-write guarantee:** how would you prove the **whole request** avoids schema migration, auth heartbeat, side-effecting SQL functions or hidden writes, not just the business SELECT? What exactly can SELECT-only roles and `SET TRANSACTION READ ONLY` prove under the repo's Neon HTTP driver?
4. **Data minimization:** would a fixed cohort 5–50, private aggregate rates and coarse reason-code counts still reveal unique route/flight participation in a small tenant? Which outputs must be suppressed/private?
5. **Proof matrix:** challenge S01–S17; propose at least five missing attack cases and correct any impossible acceptance test. What would *falsify* the claim of owner isolation when the query omits `WHERE`?
6. **Alternatives:** examine owner-controlled existing-data export versus operator-run SQL. Does either already exist in the repo, or would it require a new security surface? Recommend NO-GO where source evidence is insufficient.
7. **Revocation/retention:** specify evidence and decommission tests that do not log private identifiers, route coordinates, sample times or secret values.
8. **Research validity:** quality/reason counts and legacy/new disagreement are not per-event touchdown accuracy; how should selection/consent bias be handled without claims of generalization?

## Required output format

- **Five top design flaws**, ranked by risk and severity with file/section references.
- **Corrected architecture/decision register**: what is directly evidenced, conditional and blocked.
- **Two feasible options** with permissions, risk, dependencies, migration needs and rollback/decommission.
- **Negative test modifications** and evidence for S01–S17, with statuses NOT RUN until actually tested.
- **Separate explicit verdicts** (GO / CONDITIONAL / NO-GO): isolated synthetic module, strict read-only operator role prototype in **synthetic disposable environment**, access to **one real owner's full-resolution GPS**, production service route, multiowner training.
- Explicit yes/no: **Can the described identity and DB access be safely prototyped with zero production data and zero production writes, before any owner live-data permission?**

**Do not** implement code, execute SQL or infer consent. A second-AI review is a critique, **not** authority to bypass FlyTally product owner approval.
