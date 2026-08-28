# FlyTally Acceptance Matrix

Version: 1.33.4

This matrix is the target acceptance evidence set for certification-readiness work. Coverage is deliberately classified by evidence quality; a source-text assertion is not treated as equivalent to an isolated PostgreSQL integration test.

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| AC-01 | Create EASA flight, certify R1 | Hash generated, record immutable, audit shows R1 verified | Critical |
| AC-02 | Attempt ordinary UPDATE of certified record | Database protection rejects mutation | Critical |
| AC-03 | Open correction from certified R1 | R1 archived before editable R2 opens | Critical |
| AC-04 | Certify R2 | R1 remains verifiable, R2 becomes current, reason preserved | Critical |
| AC-05 | Connected instructor signs exact DUAL revision | Signed verification bound to revision + flight hash | Critical |
| AC-06 | Correct student flight after instructor signed R1 | R1 signature does not apply to R2 | Critical |
| AC-07 | Instructor revokes verification | Status becomes revoked; reason/timestamp remain in history | High |
| AC-08 | Instructor signs again after revocation | Current evidence becomes signed again; report verifies HMAC | High |
| AC-09 | In-person instructor signs same-device | Signature strokes + identity/credential snapshot bind to exact revision | Critical |
| AC-10 | In-person identity assurance display | UI/report clearly distinguishes non-authenticated physical identity | High |
| AC-11 | Sign & add FI entry | Instructor receives separate logbook entry; student source remains unchanged | Critical |
| AC-12 | Delete instructor's own draft copy | Student source record and verification evidence remain | Critical |
| AC-13 | Cross-user flight/participation/verification ID submitted to owner-only action | Action denied/no cross-user mutation | Critical |
| AC-14 | Structured FCL.140.A purpose certified | `purpose_code` persists and is included in certification v3 hash | High |
| AC-15 | LAPL rolling recency with eligible ULL contribution | Eligible ULL hours/landings count toward 12h/12; ULL does not satisfy 1h FI refresher | High |
| AC-16 | Legacy pre-purpose refresher record | Legacy text fallback remains available without rewriting certified row | High |
| AC-17 | Complete EASA print | Correct scope, PIC/DUAL allocation, totals and signed markers | Critical |
| AC-18 | ULL-only / EASA-only / combined print | Same layout, filtering changes only selected records | High |
| AC-19 | Backup certified signed training record | Flight, revision archive, verification evidence and GPS are present and integrity-checked | Critical |
| AC-20 | Restore certified signed training record | R1/R2 fingerprints, verification HMAC, participation binding and GPS survive exact restore | Critical |
| AC-21 | Authority verification report on valid record | All revision SHA-256 checks verified; stored verification HMAC reports verified | High |
| AC-22 | Tamper test against backup/snapshot/signature | Damage or forged evidence is rejected/reported; system does not self-heal it | Critical |
| AC-23 | Revoked verification in authority report | Historical verification visible as revoked and not counted active | High |
| AC-24 | Large account dashboard | Aggregate SQL path remains responsive at 10k+ flight records | Medium |
| AC-25 | Large print job | Date-scoped printing remains usable; full-logbook behavior documented | Medium |
| AC-26 | Full R1→R2 workflow projection consistency | Flight detail, Audit, Verification Report and Print resolve the intended current/history state consistently | Critical |
| AC-27 | Automatic/manual instructor request after certified DUAL flight | Joined preflight query resolves participant ID unambiguously and request creation does not fail after certification | Critical |

## Automated PostgreSQL evidence

The GitHub verification workflow starts an isolated PostgreSQL 16 service and executes the tests under `tests/integration/`. The harnesses intentionally use production DDL or production SQL template blocks rather than maintaining a second independent set of business rules.

### v1.33.1 database integrity baseline

Automated PostgreSQL evidence exists for:

- **AC-02** — ordinary UPDATE and DELETE of a certified flight are rejected by the production protection function;
- **AC-03** — the certified-to-correction transition is rejected until the matching certified R1 archive exists;
- **AC-04** — R1 remains preserved while R2 is edited, certified and becomes immutable again;
- **AC-06** — R1 verification cannot match current R2 unless revision and certification hash both match;
- **AC-12** — deleting the participant-owned draft copy leaves the student's source record and signed evidence intact.

### v1.33.2 security and restore evidence

The `postgres-security-restore` harness adds:

- **AC-13** — exact SQL templates used by owner/participant actions are executed with owner, participant and unrelated actor identifiers. Cross-user correction lookup, verification revocation, participation cancellation and flight-lock mutations are denied by the same ownership predicates used by production actions;
- **AC-19** — a portable v7 backup fixture contains a certified R2 flight, archived R1, in-person and authenticated verification evidence, participation binding and GPS track. Certification fingerprints and HMAC evidence are validated before restore;
- **AC-20** — the production `json_populate_record` restore SQL blocks are replayed against PostgreSQL 16, after which current R2 SHA-256, archived R1 SHA-256, both verification HMAC values, structured purpose, participation source hash and GPS coordinates are re-verified. Replaying the restore remains idempotent for those evidence rows;
- **AC-22** — ordinary backup damage fails the outer SHA-256 integrity check. If an attacker recomputes that unkeyed outer digest after modifying a stored verification signature, the keyed HMAC-SHA-256 validation still rejects the forged verification evidence.

### v1.33.3 full workflow evidence

The `postgres-full-workflow` harness executes a complete certified DUAL lifecycle and strengthens evidence for:

- **AC-01** — a real PostgreSQL draft R1 is certified using the production certification UPDATE and the resulting certification-v3 SHA-256 is independently verified;
- **AC-03 / AC-04** — R1 is archived with the production correction SQL, R2 opens as an editable correction, then R2 is certified with a distinct fingerprint while R1 remains verifiable;
- **AC-05** — connected-instructor requests and signed verification evidence are created with SQL templates read from the production request/signing sources; the stored HMAC-SHA-256 is verified for both R1 and R2;
- **AC-06** — after R2 opens, the exact Flight detail verification query returns no current signature and the exact Print query does not project the historical R1 signature. Once R2 is signed, exactly one signed verification matches the current revision/hash while R1 remains historical evidence;
- **AC-26** — the exact server-side read queries used by Flight detail, Certification Audit, Authority Verification Report and Print are executed against the same final PostgreSQL state. Detail/Print select the current R2 evidence, while Audit/Report retain both R1 and R2 history.

The v1.33.3 print assertion covers the revision-bound signed-instructor projection only; it does not by itself mark all of **AC-17** complete.

### v1.33.4 instructor-request hotfix evidence

The `postgres-instructor-request` harness adds **AC-27**. It reads the exact preflight SELECT from `lib/training-verification.ts` and executes it against PostgreSQL with both `flight_participations` and `flights` present. This specifically prevents regression to an unqualified `SELECT id` across that JOIN, which produced PostgreSQL error `42702` during manual production acceptance testing.

Each CI run preserves the PostgreSQL acceptance output as a GitHub Actions artifact named `flytally-postgres-acceptance-<commit SHA>` for 90 days.

## Evidence limits

The AC-13 harness does **not** simulate a browser session or Next.js authentication handshake. It injects actor IDs into the exact production SQL templates after the production server action would obtain `userId` from `requireUser()`.

Likewise, AC-20 proves the regulatory/evidence-critical restore sections (flight, certified revision archive, verification evidence, participation binding and GPS), not every optional account-preference field.

The v1.33.3 full-workflow harness is also a server/database acceptance test rather than a browser automation test. It executes the production SQL used by the core actions and read projections, but it does not automate real UI clicks, OAuth/login, email delivery or visual rendering. Complete `Sign & add FI entry` materialisation under AC-11 remains a separate acceptance item; AC-12 already protects source-record independence after an instructor-owned draft exists.

## Evidence policy

For authority-facing readiness, the preferred evidence hierarchy is:

1. automated database integration test;
2. automated behavior/unit test;
3. reproducible acceptance demonstration with captured result;
4. source-text regression assertion only as a supplemental guard.

Source-regex tests are not sufficient evidence for mission-critical ownership, immutability or cross-user state transitions by themselves.

## Demonstration set for an initial ÚCL meeting

A concise live demonstration should use a dedicated non-production test dataset and show:

1. draft flight;
2. certification to R1;
3. authority verification report with verified SHA-256;
4. instructor signature bound to R1;
5. correction to R2 with preserved R1 history;
6. inability of old R1 signature to become current for R2;
7. print/export of the same record chain;
8. portable backup integrity and restore evidence for the account.
