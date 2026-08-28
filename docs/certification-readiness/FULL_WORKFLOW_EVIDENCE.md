# FlyTally Full Workflow Acceptance Evidence

Version: **v1.33.3**

## Purpose

This document describes the database-backed acceptance scenario added in v1.33.3. Its purpose is to verify one complete certified training-flight lifecycle and the consistency of the server-authoritative state consumed by the principal FlyTally views.

The scenario is executed automatically against an isolated PostgreSQL 16 service in GitHub CI. It reads the relevant SQL templates directly from the production source files instead of maintaining a second independent implementation of the certification and instructor-verification workflow.

## Tested lifecycle

The automated scenario performs the following sequence:

1. create an EASA DUAL draft flight as revision R1;
2. calculate the certification-v3 SHA-256 fingerprint;
3. execute the production certification UPDATE and confirm R1 integrity;
4. execute the production instructor-request SQL for a connected instructor;
5. execute the production instructor-signature SQL and verify its HMAC-SHA-256 evidence;
6. archive R1 using the production correction archive SQL;
7. open correction R2 using the production correction transition SQL;
8. prove that the historical R1 signature is no longer selected as the current verification;
9. edit the R2 draft;
10. certify R2 with a new SHA-256 fingerprint;
11. create a new revision-bound instructor request;
12. sign R2 and verify the new HMAC-SHA-256 evidence;
13. verify both the archived R1 fingerprint and current R2 fingerprint;
14. verify that both instructor signatures remain in historical evidence while exactly one matches the current flight revision/hash.

## Production components exercised

The acceptance harness reads SQL from:

- `app/(protected)/flights/certification-actions.ts` — certification and correction transition;
- `lib/training-verification.ts` — revision-bound instructor request creation;
- `app/(protected)/flights/shared-actions.ts` — authenticated instructor signing;
- `app/(protected)/flights/[id]/page.tsx` — current Flight detail verification projection;
- `app/(protected)/flights/[id]/audit/page.tsx` — historical verification projection;
- `app/(protected)/flights/[id]/verification-report/page.tsx` — authority-facing current/archive/verification projection;
- `app/(protected)/print/page.tsx` — print data projection and current signed-instructor lookup;
- `lib/db-optimization.ts` — production certified-record archive/protection DDL.

## Cross-view consistency assertions

### Flight detail

After R1 has been signed and R2 is opened for correction, the exact Flight detail verification query must return no current signature. After R2 is certified and signed, that same query must return the R2 verification row.

### Certification audit

The Audit verification query must retain both R1 and R2 signature evidence in revision order. Both stored HMAC signatures must independently verify.

### Authority Verification Report

The report must read current R2 as the active certified record, retain archived R1, and expose both revision-bound verification rows. The acceptance test independently recalculates certification integrity and verifies both stored HMAC values.

### Print

While R2 is an uncertified correction draft, the exact production print query must not project the historical R1 instructor signature as a current `FI SIGNED` source. After R2 is certified and signed, the print projection must use the current R2 verification and the corrected R2 flight data.

## Acceptance matrix coverage

v1.33.3 strengthens automated evidence for:

- **AC-01** — create and certify R1;
- **AC-03** — archive R1 before opening R2;
- **AC-04** — certify R2 while preserving R1;
- **AC-05** — connected instructor signs the exact certified DUAL revision;
- **AC-06** — the R1 signature does not become current for R2;
- **AC-26** — Flight detail, Audit, Verification Report and Print resolve the same revision/signature state according to their intended current-vs-history semantics.

The print assertion in this release specifically covers the revision-bound signed-instructor projection. It does not by itself replace the separate tests/manual review for complete EASA print layout, pagination, totals and all pilot-function columns under AC-17.

## Evidence limits

This is **not a browser/session end-to-end test**. The scenario does not automate a real browser, OAuth/login flow, button clicks, email delivery or notification navigation. Actor IDs are supplied to the production SQL templates after the point at which the real server action would have obtained them from `requireUser()`.

The scenario also does not yet prove the complete `Sign & add FI entry` materialisation path under AC-11. Independence of an instructor-owned draft from the student's source record remains separately covered by AC-12. A dedicated materialisation acceptance case can be added without weakening the evidence in this workflow chain.

## Result retention

The full-workflow test runs inside the existing `test:postgres` CI stage. Its console result is therefore included in the commit-specific `flytally-postgres-acceptance-<commit SHA>` artifact retained for 90 days.

This evidence supports technical and authority-facing review. It does not itself confer EASA or ÚCL approval.
