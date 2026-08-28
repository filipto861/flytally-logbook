# FlyTally Acceptance Matrix

Version: 1.33.5

This matrix is the controlled certification-readiness acceptance set. Evidence quality is stated explicitly: a source-text assertion is supplemental and is not treated as equivalent to an isolated PostgreSQL integration test or a real browser acceptance test.

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| AC-01 | Create EASA flight, certify R1 | Hash generated, record immutable, audit shows R1 verified | Critical |
| AC-02 | Attempt ordinary UPDATE/DELETE of certified record | Database protection rejects mutation | Critical |
| AC-03 | Open correction from certified R1 | R1 archived before editable R2 opens | Critical |
| AC-04 | Certify R2 | R1 remains verifiable, R2 becomes current, reason preserved | Critical |
| AC-05 | Connected instructor signs exact DUAL revision | Signed verification bound to revision + flight hash | Critical |
| AC-06 | Correct student flight after instructor signed R1 | R1 signature does not apply to R2 | Critical |
| AC-07 | Instructor revokes verification | Status becomes revoked; reason/timestamp remain in history | High |
| AC-08 | Instructor signs again after revocation | Current evidence becomes signed again; report verifies HMAC | High |
| AC-09 | In-person instructor signs same-device | Signature strokes + identity/credential snapshot bind to exact revision | Critical |
| AC-10 | In-person identity assurance display | UI/report clearly distinguishes non-authenticated physical identity | High |
| AC-11 | Sign & add FI entry | Instructor receives separate FI/PIC record; source record/signature remain independent | Critical |
| AC-12 | Delete instructor's own draft copy | Student source record and verification evidence remain | Critical |
| AC-13 | Cross-user flight/participation/verification ID submitted to owner-only action | Action denied/no cross-user mutation | Critical |
| AC-14 | Structured FCL.140.A purpose certified | `purpose_code` persists and is included in certification v3 hash | High |
| AC-15 | LAPL rolling recency with eligible ULL contribution | Eligible ULL hours/landings count toward 12h/12; ULL does not satisfy 1h FI refresher | High |
| AC-16 | Legacy pre-purpose refresher record | Legacy text fallback remains available without rewriting certified row | High |
| AC-17 | Complete EASA print | Correct scope, PIC/DUAL allocation, totals and signed markers | Critical |
| AC-18 | ULL-only / EASA-only / combined print | Same layout; only record filtering changes | High |
| AC-19 | Backup certified signed training record | Flight, revision archive, verification evidence and GPS are present and integrity-checked | Critical |
| AC-20 | Restore certified signed training record | R1/R2 fingerprints, verification HMAC, participation binding and GPS survive exact restore | Critical |
| AC-21 | Authority Verification Report on valid record | All revision SHA-256 checks verified; stored verification HMAC reports verified | High |
| AC-22 | Tamper backup/snapshot/signature evidence | Damage or forged evidence is rejected/reported; no silent self-heal | Critical |
| AC-23 | Revoked verification in authority report | Historical verification visible as revoked and not counted active | High |
| AC-24 | Large account dashboard / flight list | Production database read paths remain within controlled CI bounds at 10k user flights | Medium |
| AC-25 | Large print selection | Date-scoped and complete 10k-flight SQL selection remain within controlled CI bounds; rendering limits documented | Medium |
| AC-26 | Full R1→R2 workflow projection consistency | Flight detail, Audit, Verification Report and Print resolve intended current/history state consistently | Critical |
| AC-27 | Automatic/manual instructor request after certified DUAL flight | Joined preflight resolves participant ID unambiguously and request creation does not fail after certification | Critical |

## Automated PostgreSQL evidence

The GitHub verification workflow starts an isolated PostgreSQL 16 service and executes `tests/integration/*.test.ts`. Where practical, the harness reads SQL/DDL directly from production source files instead of reimplementing the business rule independently.

### v1.33.1 — database integrity baseline

Automated evidence covers **AC-02, AC-03, AC-04, AC-06 and AC-12**: certified immutability, correction transition requirements, preserved R1 history, revision/hash-bound verification and source-record independence after a participant copy is removed.

### v1.33.2 — security and restore evidence

`postgres-security-restore` adds database-backed evidence for **AC-13, AC-19, AC-20 and AC-22**. It executes owner/participant predicates with unrelated actor identifiers and replays the regulatory/evidence-critical portable-backup restore sections. Both certification SHA-256 fingerprints and keyed verification HMAC-SHA-256 evidence are rechecked after restore. Recomputing the outer unkeyed backup checksum cannot forge a verification signature.

### v1.33.3 — full workflow evidence

`postgres-full-workflow` executes a complete certified DUAL lifecycle and strengthens **AC-01, AC-03, AC-04, AC-05, AC-06 and AC-26**. The same final PostgreSQL state is read through the production queries used by Flight detail, Certification Audit, Authority Verification Report and Print. Current views resolve only current R2 evidence while audit/report history retains R1 and R2.

The print assertion is revision-binding evidence and does not by itself mark every presentation detail of **AC-17** complete.

### v1.33.4 — instructor-request hotfix evidence

`postgres-instructor-request` adds **AC-27**. It executes the exact `upsertInstructorRequest()` preflight SELECT with both `flight_participations` and `flights` present. This prevents regression to the unqualified joined `id` projection that caused PostgreSQL error `42702` during manual production acceptance.

### v1.33.5 finalization evidence

`postgres-fi-materialization` closes the remaining database acceptance gap under **AC-11**. It signs the exact certified student revision, executes the production FI materialisation SQL, verifies the separate instructor-owned FI/PIC record and copied GPS evidence, then removes the instructor copy and confirms that the student's certified source and signed verification remain intact.

`postgres-scale-readiness` adds controlled **AC-24 / AC-25** evidence. The fixture contains 10,000 target-account flights plus 10,000 unrelated-account flights. Production Dashboard, Flights and Print SQL templates are executed using `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` after the relevant production indexes and `ANALYZE` are applied. Planning/execution timings are written to `flytally-scale-evidence.json` and preserved as a separate commit-specific CI artifact for 90 days.

The v1.33.5 joined-SQL review also adds supplemental source regression guards for explicit aliases in the critical certification/instructor projections. This is not represented as equivalent to PostgreSQL execution.

## Evidence artifacts

Each CI run retains:

- `flytally-postgres-acceptance-<commit SHA>` — PostgreSQL acceptance transcript;
- `flytally-scale-evidence-<commit SHA>` — v1.33.5 scale metrics when the scale harness executes.

Retention is 90 days.

## Evidence limits

AC-13 does not simulate a browser session or Next.js authentication handshake. It injects actor IDs into the exact production SQL templates after the server action would have obtained the authenticated user ID from `requireUser()`.

AC-20 proves the regulatory/evidence-critical restore sections, not every optional user preference field.

AC-11 executes the production signing/materialisation SQL and cryptographic evidence logic but is not a browser-click automation test.

AC-24/25 measure isolated PostgreSQL 16 execution on a synthetic dataset. They do not measure Neon network latency, Vercel function latency, React rendering, browser printing, device performance or concurrent-user load. In particular, successful complete 10k-flight SQL selection does not imply that rendering a thousand print pages in a browser is operationally desirable; date-scoped printing remains the preferred large-log workflow.

## Evidence policy

For authority-facing readiness, the preferred hierarchy is:

1. automated database integration test;
2. automated behavior/unit test;
3. reproducible manual acceptance demonstration with captured result;
4. source-text regression assertion as supplemental protection only.

## Demonstration set for an initial ÚCL meeting

Use a dedicated non-production test dataset and show:

1. draft flight;
2. certification to R1;
3. Authority Verification Report with verified SHA-256;
4. instructor signature bound to R1;
5. correction to R2 with preserved R1 history;
6. inability of the R1 signature to become current for R2;
7. separate instructor FI/PIC materialisation without changing the student source;
8. print/export of the same record chain;
9. portable-backup integrity and restore evidence.

The acceptance evidence does not itself confer EASA or ÚCL approval.
