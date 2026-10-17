# GPS Detection 2.0 — R2.1b-P0 second independent security review reconciliation

**Date:** 2026-10-17  
**Repository:** `filipto861/flytally-logbook`; frozen production `main@6a67a02475ab09c3271f8646427f7956ed6e590a`; independent research Draft PR #350; research-doc Draft PR #349 remains separate.  
**Input:** product-owner-supplied DeepSeek security critique with top-five findings, architecture variants, S01–S17 changes and separate GO/NO-GO decisions.  
**Independent reviewer scope:** **PARTIAL** — reviewed handoff, full R2.1b-P0 strict design and older owner-scoped plan; **did not receive** the prior [R2.1b independent security review reconciliation](GPS_DETECTION_2_0_R2_1B_INDEPENDENT_SECURITY_REVIEW_RECONCILIATION_2026-10-17.md), did not inspect GitHub or execute code/SQL/tests. Reviewer statements about source are **claims from supplied documents**, not independent code evidence.  
**ChatGPT corroboration:** performed separate **read-only** actual repo source inspection of `main` and isolated research branch and compared both designs. The two scopes are kept distinct.  
**Verdict:** **ACCEPT the safety conclusions; HARDEN current design; no real-data execution approved**.

## 1. Independent review findings and source-checked disposition

| Review concern | Source checked against main / research | Resolution |
|---|---|---|
| **A. Production one-owner DB isolation is unproven** | `lib/data/tracks.ts:76–89` and `lib/data/flight-track-review.ts:52–59` filter `t.user_id` and join same-owner `flights`. This is **application SQL filtering**, not proof of DB-enforced per-owner privileges/RLS. GitHub source cannot establish current Neon role grants/RLS policies. | **ACCEPT/HARD BLOCK** production Option A under frozen no-DB-changes constraints unless existing effective policy can be independently proved; do not infer that creating RLS/view/role is migration-free. |
| **B. Owner identity is not proven by a strict no-write path** | `lib/auth/require-user.ts:5–8` calls `getSession`; `lib/auth/session.ts:27–36` calls `ensureDatabaseOptimizations()` and conditionally dispatches an asynchronous `UPDATE auth_sessions.last_seen_at`. | **ACCEPT/HARD BLOCK** reuse of `requireUser` as zero-write research authorization. No copied cookies, user-supplied IDs, inferred tenant identity or admin-is-owner assumption. |
| **C. Whole-request zero-write / driver semantics unproven** | `lib/db.ts` uses deferred `neon(DATABASE_URL, {fullResults:false,arrayMode:false})` HTTP query function or local PostgreSQL driver; source does not establish an independent research credential, grants or a pinned read-only transaction. `lib/db-optimization.ts` contains migration DDL/updates. | **ACCEPT**. Require disposable driver-level proof before any production query, including privileged routines, side effects, connection reuse and session writes. SQL syntax alone is insufficient. |
| **D. 5–50 track cohort not anonymization** | `research/gps-detection-r21/observational-aggregate.ts` sets cohort/point workload limits and returns aggregate-only metrics. It does **not** authenticate, enforce owner access or prove privacy. | **ACCEPT**. These limits bound computation; no public or third-party output. Even totals/reason-code cells can leak sparse owner/route participation. |
| **E. Full-fidelity raw-source preprocessing and truth unresolved** | `lib/data/tracks.ts::decodePoints` applies `Number(item?.alt)` (including `Number(null)===0`), splits/chooses largest segment and downsamples to map limits. `getFlightTrackReview` selects `coordinates_json` for **one** track only (`LIMIT 1`) and recomputes the legacy heuristic. | **ACCEPT**. Neither is validated all-track/lossless research ingress or independent wheel-contact label. Preserve original persisted source limitations and `preprocessingConfound=NOT_ISOLATED`. |

**Evidence distinction:** The DeepSeek review was PARTIAL as to input docs and NOT SOURCE-VERIFIED; the code observations above are ChatGPT's own GitHub read-only checks. Neither establishes actual production DB effective grants, an owner's legal authorization or real-event ground truth.

## 2. Architecture decision correction — production Option A is not an approved implementable plan

The earlier strict design presented **Option A: private operator-run, scoped, SELECT-only DB reader** as a *preferred conditional architecture*. The independent reviewer correctly challenges its implementability under **no production schema/grant changes**.

**Reconciled, frozen for research planning:**
- **R2.1b-P0/D3-SYNTHETIC:** **CONDITIONAL GO** to *design and, after explicit milestone approval, test* a mock principal plus restricted role/RLS/view patterns in a disposable synthetic PostgreSQL database with no production credentials, production data, Neon production branch clone or real user identities. This is a security **falsification prototype**, not a real access grant or general privacy proof.
- **R2.1b-P1 LIVE REAL TRACKS:** **NO-GO**. A general `SELECT` privilege with a caller-created `WHERE user_id` is unacceptable. DB-enforced per-subject/track isolation, verified principal/consent, per-request no-write evidence and scope-specific permission remain **unproved**. Existing migrations/roles/branch effects are unknown. The product owner's authority over the project does **not** automatically grant research access to every other account holder's routes.
- **Production RLS/view/role/grant changes:** **NOT APPROVED**. If needed, they constitute a separate, high-risk product/security/migration milestone; review/backup/rollback/owner approval is required. A synthetic proof cannot silently authorize them.
- **Fallback user-controlled export:** **UNVERIFIED**. A limited GitHub search for obvious KML export function names found no independently verified lossless owner-controlled full-track export; **do not claim it exists or implement one** without separately approved architecture/UX/privacy work.
- **Production route / endpoint, external raw GPS upload, cross-owner training:** **NO-GO**. Shared flight participation is not permission to use another participant's GPS record.
- **Interpretation:** legacy/new pattern disagreements are diagnostics, not accuracy; event precision/recall and contact confidence remain `UNAVAILABLE`.

## 3. Corrections to the original S01–S17 security test contract

These are **proposed tests, NOT EXECUTED**:

| ID | Required revision after independent review |
|---|---|
| S01–S04 | Before any DB access, reject missing/revoked/wrong subject/shared-participant grants; verify no existence or error-content leak. |
| S05 | In synthetic role proof remove `WHERE` entirely and separately substitute another subject. A role able to see another owner's rows **FAILS**, even if the application normally filters. |
| S06 | Test INSERT/UPDATE/DELETE/TRUNCATE/DDL, sequence `nextval`, callable mutation functions, SECURITY DEFINER, roles, temp schemas and attempted `COPY (SELECT...) TO STDOUT`. **Nuance:** a SELECT-privileged role may legitimately use `COPY TO STDOUT` to export *authorized* rows; SQL grants alone cannot prevent an authorized client from exfiltrating data. Security requires preventing access to **unauthorized rows** plus a trusted in-boundary runner/output/logging policy, not a false claim that every COPY command is intrinsically denied. |
| S07 | Inspect effective rights, role inheritance, `BYPASSRLS`, `PUBLIC` and function EXECUTE grants, view owners, RLS ENABLE/FORCE, security-definer functions, role switching, and grants through nested objects. |
| S08 | Verify no invocation of `getSession` migration/session-heartbeat code in research. Exercise a synthetic equivalent to show this call path is not a no-write claim. |
| S09 | Deny grants revoked between authorization and read, not just initially revoked. Recheck short-lived grant within pinned run; expire/stop safely. |
| S10 | Invalid JSON, duplicates, oversized arrays and partial failure stop before any aggregate output. |
| S11 | Compare full persisted source to map-transformed data: `null` vs 0, order, dropped/strided points, incomplete source metadata. |
| S12 | Invalid/nonpositive dt, repeated timestamps, long gaps and source discontinuities never become fake speed=0 or confirmed contacts. |
| S13 | Test possible reidentification from exact cell totals and unique track cohorts, even with 5+ tracks. Public outputs remain blocked. |
| S14 | Prove read-only semantics on the **same physical driver/connection/transaction context**, including pooled/HTTP behavior; if the client cannot guarantee this, fail the prototype gate. |
| S15 | Crash/retry/cancel/rotation: no raw array files, exception payloads, CI artifacts, logs or retained credentials. |
| S16 | Model-to-model agreement cannot produce contact truth, accuracy or calibrated confidence. |
| S17 | Production `app/`, `components/`, `lib/` or deployed routes cannot import research analysis. |

**Additional threat cases (pre-registered, not silently included in 63 prior tests):**
- **S18** SQL parameter binding and statement injection: bind subject/track IDs safely; injected strings must never broaden source scope.
- **S19** Privileged view/function leakage and side effects, including object ownership and search_path changes.
- **S20** Query driver instrumentation, structured logs, tracing, errors or crash reports must not reveal identifiers, coordinates, route/time or credentials.
- **S21** CI/debug artifacts and temporary files must never include user tracks; synthetic-only logs may be archived if they cannot include production data.
- **S22** Shared-flight participant spoofing and grant-subject mismatch cannot authorize another track owner's data.
- **S23** Prepared-statement/session reuse across subjects: the previous owner's scope cannot leak into next execution; cross-request isolation proved on synthetic fixtures.

**S01–S23: NOT RUN.** The earlier **63/63 Node synthetic pattern tests + TypeScript PASS** were owner-local for a *different* isolated research module and are not SQL authorization, privilege/driver or privacy test evidence.

## 4. Explicit stop/go register

| Scope | Status now | Required change before GO |
|---|---|---|
| Synthetic in-memory `observational-aggregate` | **LOCAL VERIFIED 63/63 targeted + TS PASS** (earlier exact code SHA) | Keep pure, off-production; no user data or deployment |
| Disposable synthetic Postgres role/identity prototype | **CONDITIONAL DESIGN GO / IMPLEMENTATION NOT AUTHORIZED OR RUN** | Owner approval of isolated milestone, synthetic-only DB, mock identity, nonproduction credentials, independent review reconciliation, tested S01–S23 |
| Select original persisted points of **one real account** | **NO-GO** | Approved specific subject/scope, separate least-privilege DB-enforced row isolation, verified effective grants/driver semantics, whole-request no-write, retention/revocation and evidence from synthetic prototype |
| Production schema/RLS/roles/migration or endpoint | **NO-GO** | Separate owner-approved architecture/migration review, deployment safety and rollback, not part of P0 |
| Other account owners' GPS, cross-owner training, raw exports to AI | **NO-GO** | No implicit authorization; outside current approved experiment |
| Public aggregates or real-world touchdown accuracy claims | **NO-GO / UNAVAILABLE** | Independently privacy-reviewed aggregation or event-level truth evidence, respectively |

## 5. Remaining uncertainty and handoff

1. Effective Neon production roles/grants, current RLS policies and user-controlled export possibilities are **NOT verified**; do not inspect or change production privileges without explicit permission.
2. No verified zero-write identity resolver nor owner-specific research consent/retention agreement exists in current evidence. Need a separately approved mechanism; do not issue bearer grants/cookies as a shortcut.
3. Synthetic DB experiment has potential validation drift vs Neon production HTTP query semantics; even after synthetic PASS, production GO cannot be inferred.
4. Plan recommended first *independently reviewed* synthetic-only P0-D3 milestone, not direct connection to real GPS. Request explicit owner decision before implementing.
5. Full follow-up review should furnish DeepSeek the missing **earlier security review reconciliation** so it can mark full-document coverage. It need not block documentation reconciliation; the reviewer has already identified sufficient hard NO-GO conclusions.
6. No need to redo R2.1a event classification in this task. A07/A08 and event-truth scarcity remain open independently.

**Closing classification:** independent critique **RECEIVED / PARTIAL**; separate GitHub source validation **READ-ONLY PASS**; security design corrected **DOCS ONLY**; S01–S23 synthetic DB tests **NOT RUN**; owner-local in-memory pattern suite previously **63/63 PASS + TypeScript PASS on `8b410f32`**, not rerun for this docs-only branch head; production GPS/DB/merges/deploy **UNCHANGED**.
