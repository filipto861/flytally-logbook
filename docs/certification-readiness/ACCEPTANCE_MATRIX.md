# FlyTally Acceptance Matrix

Version: 1.33.0

This matrix is the target acceptance evidence set for certification-readiness work. Some scenarios are currently covered by automated unit/source regression tests; database integration coverage is still being expanded.

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
| AC-13 | Cross-user flight ID submitted to owner-only action | Action denied/no cross-user mutation | Critical |
| AC-14 | Structured FCL.140.A purpose certified | `purpose_code` persists and is included in certification v3 hash | High |
| AC-15 | LAPL rolling recency with eligible ULL contribution | Eligible ULL hours/landings count toward 12h/12; ULL does not satisfy 1h FI refresher | High |
| AC-16 | Legacy pre-purpose refresher record | Legacy text fallback remains available without rewriting certified row | High |
| AC-17 | Complete EASA print | Correct scope, PIC/DUAL allocation, totals and signed markers | Critical |
| AC-18 | ULL-only / EASA-only / combined print | Same layout, filtering changes only selected records | High |
| AC-19 | Backup certified signed training record | Flight, revision archive and verification evidence present in backup | Critical |
| AC-20 | Restore certified signed training record | Functional/audit state equivalent after restore | Critical |
| AC-21 | Authority verification report on valid record | All revision SHA-256 checks verified; stored verification HMAC reports verified | High |
| AC-22 | Tamper test against snapshot/hash | Report displays mismatch; system does not self-heal the evidence | Critical |
| AC-23 | Revoked verification in authority report | Historical verification visible as revoked and not counted active | High |
| AC-24 | Large account dashboard | Aggregate SQL path remains responsive at 10k+ flight records | Medium |
| AC-25 | Large print job | Date-scoped printing remains usable; full-logbook behavior documented | Medium |

## Evidence policy

For authority-facing readiness, the preferred evidence hierarchy is:

1. automated database integration test;
2. automated behavior/unit test;
3. reproducible acceptance demonstration with captured result;
4. source-text regression assertion only as a supplemental guard.

Source-regex tests are not sufficient evidence for mission-critical ownership, immutability or cross-user state transitions.

## Demonstration set for an initial ÚCL meeting

A concise live demonstration should use a dedicated non-production test dataset and show:

1. draft flight;
2. certification to R1;
3. authority verification report with verified SHA-256;
4. instructor signature bound to R1;
5. correction to R2 with preserved R1 history;
6. inability of old R1 signature to become current for R2;
7. print/export of the same record chain;
8. backup evidence for the account.
