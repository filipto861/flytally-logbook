# FLYTALLY V14-C/C2 / R1 — INDEPENDENT READ-ONLY REVIEW PACKET

**83-file limited upload (under DeepSeek 100-file cap). NOT FOR MERGE, NOT AN APPLICATION BRANCH.**
Date: 2026-10-31. Repo: filipto861/flytally-logbook (private).

## Frozen, independently auditable sources

SOURCE/ contains exactly 64 unmodified Git blobs copied from EXECUTABLE candidate:
6fd5597aec03ee7b6cbab4dafd98228fafdaaea1

DESIGN/ contains exactly 17 unmodified Git blobs copied from DESIGN proposal:
f8f3dc07edce42357a0871599d054c9b5e44f146

README.md (this file) and MANIFEST.tsv are the only newly authored packet contents.
Each path's original commit, Git blob SHA-1 and byte count is recorded in MANIFEST.tsv.
The GitHub tree used **the exact existing original blobs**: no source reformatting, summaries or regenerated code.
Different source and design commits ARE INTENTIONAL: V14-C/C2 is unimplemented design, not deployed runtime.

## IMPORTANT limitations

This is a *curated 83-file* security review scope, **NOT the full 1000+ file repository**.
It includes entrypoints for account backup / restore, signing / certification, privacy / account erasure, schema, auth, currency,
Neon/local PostgreSQL adapters, relevant tests, the V3 findings and owner-approved V5/V6 and V7 proposals.
Some transitive dependencies, full migration history, canonical ROADMAP / FEATURES / CHANGELOG history and unrelated modules
are deliberately omitted because of the upload limit. If a finding requires omitted files, return **INCOMPLETE FOR THAT FINDING**
and name the precise missing source path; NEVER invent or infer its contents. Request a small follow-up supplement rather than
asserting an independent all-repository audit.

DO NOT treat these sources as a single executable checkout, run migration/tests, modify data or connect to prod.
DO NOT merge this sparse review branch: the root tree only contains this review packet, not the real app.
Historical owner approvals are **DESIGN ONLY**. Previous independent verdict remains BLOCK — DESIGN ONLY.
No approval of SQL, runtime implementation, key rotation, production retention, legal erasure, flags, merge or deploy.

## Auditor instructions — identical for Claude and DeepSeek

Perform an independent, **read-only** security and data-integrity architecture audit.

Read DESIGN/docs/maintenance/2026-10-31-data1e3-d4-a2-v14c-r1-independent-security-review-brief-v7.md IN FULL.
Read its referenced V3/V4/V5/V6/V7 contracts and prior BLOCK findings, and inspect actual relevant SOURCE files
(including SOURCE/lib/account-restore-v6.ts, account-backup.ts, backup-center.ts, backup-authenticity.ts,
verification-signature.ts, privacy-account.ts, db-optimization.ts and the relevant tests).
Use the original file path in citations (remove SOURCE/ or DESIGN/ prefix).

Review: (1) destructive legacy F9 native audit MAX/DELETE/ON CONFLICT path; (2) safe immutable native-vs-imported ledger,
tenant isolation and signed V13-I A cross-digest conflicts; (3) N2-S UUID sidecar and clone/backfill provenance;
(4) conditional V14-C/C2 independently preserved signed observations; (5) proposed 37-result read-only MVCC snapshot,
strict parser, all backup paths and pre_restore; (6) signing keyring and legacy v13 compatibility (K1);
(7) legally justified retention (T1), exceptional erase / stale backup reintroduction (E), without pretending legal approval;
(8) canonical JSONB/JS event hash precision, timestamps, null/missing and concurrency/Neon HTTP parity.

Categorize findings P0/P1/P2; give file/line and both source/design full SHAs, an exact synthetic counterexample,
minimal correction and acceptance tests; distinguish EXISTING CODE DEFECT from UNIMPLEMENTED DESIGN GAP.
Report final verdict APPROVE / APPROVE WITH CHANGES / BLOCK — DESIGN ONLY, or INCOMPLETE REVIEW if source access is insufficient.
Never claim actual tests PASS if they were not run, and never claim physical source DB authenticity merely from signed digest / UUID.

**No production access or modifications. No assumptions about unseen files.**

## Verification

Verify MANIFEST.tsv source and design file Git object identities against the two frozen GitHub commits.
The uploaded archive is GitHub-generated for the sparse review branch. The archive ZIP byte checksum
is not asserted here; original source fidelity is defined by the embedded Git blob SHA-1 identities.
