# FlyTally V14-C/C2 + R1 K1/T1/E — 45-file independent security-review packet

**DeepSeek-compatible: 45 files total, including this README and MANIFEST.**
Date: 2026-10-31. Private repository: filipto861/flytally-logbook.
**READ-ONLY REVIEW ARTIFACT — NEVER MERGE THIS SPARSE BRANCH.**

## Frozen sources and unmodified contents

- SOURCE/ = 34 complete original code/test files from frozen, not-deployed executable SHA:
  6fd5597aec03ee7b6cbab4dafd98228fafdaaea1
- DESIGN/ = 9 complete original architecture and decision documents from frozen design SHA:
  f8f3dc07edce42357a0871599d054c9b5e44f146
- README.md + MANIFEST.tsv = 2 new packet metadata files (45 total).
- Every SOURCE/ and DESIGN/ Git blob was **reused byte-for-byte** from previously verified 83-file artifact; MANIFEST records its exact Git blob SHA-1, size and original commit.
- **The entire repo has 1000+ paths. This is deliberately curated, not transitive-complete.** Missing dependencies and tests are possible. Explicitly ask for exact missing files instead of guessing.
- Source and design SHAs intentionally differ because V14-C/C2 is NOT implemented in the executable source. Do not conflate a design proposal and runtime behavior.

## Auditor task — identical for DeepSeek and Claude

Perform a rigorous **independent read-only adversarial security and data-integrity review**. Read `DESIGN/docs/maintenance/2026-10-31-data1e3-d4-a2-v14c-r1-independent-security-review-brief-v7.md` in full. Read the attached V3/V4/V5/V6/V7 contracts, previous V3 BLOCK reconciliation, and inspect **literal relevant SOURCE files**, not just their filenames or this summary. Report whether a file needed for a finding is missing.

Concentrate on:
1. Confirmed legacy restore risk in `lib/account-restore-v6.ts` (global audit MAX, native DELETE, unchecked conflict skip), atomic rollback and account isolation.
2. v13 original signed snapshot verification, signed-v13 strict cross-snapshot A conflict and V13-I imported-only history.
3. N2-S native audit immutable one-to-one UID sidecar with honest `at_event_insert` vs `migration_backfill`.
4. Conditional V14-C/C2: every signed observation persists, strict event equality and provisional logical aggregation; cloned UUID/signer are **not** physical source provenance.
5. Proposed **37-result** single read-only Repeatable Read V14 snapshot, all backup/download/manual/automatic/pre_restore/flag-OFF/readback paths, fail-closed integrity and restore.
6. R1 K1 backward-compatible key versioning/rotation; T1 lawful purpose-bounded retention; E exceptional erasure and anti-resurrection from saved portable/pre_restore backup.
7. Canonical event hash, JSONB vs JS integer precision and missing/null semantics, actor/timestamp identity, concurrent import and Neon HTTP DB authorization.

## Mandatory answer format

- Identify both exact full frozen SHAs above; verify you actually opened the relevant source and design files. If unavailable, label **INCOMPLETE REVIEW**.
- State verdict `APPROVE`, `APPROVE WITH CHANGES`, `BLOCK — DESIGN ONLY`, or `INCOMPLETE REVIEW`.
- For each P0/P1/P2 finding: affected ORIGINAL path (drop SOURCE/ or DESIGN/ prefix), line numbers, observed source vs unimplemented proposal, reproducible synthetic counterexample, minimal correction and acceptance tests.
- Explicitly list any omitted transitive files needed to confirm findings. Do not assume they were checked.
- Do not falsely claim execution of Node/TypeScript/build/Neon/PostgreSQL tests, legality approval, runtime v14 deployment or regulatory flight certification.

## Security and limitations

No source modifications, DB/SQL operations, migrations, production credentials, signing keys, account erasure, merge, deployment, flags or feature launches are authorized. Source package is static; this sparse Git branch deletes unrelated project files from its own tree and must **NEVER** be merged into main. The past independent security verdict remains **BLOCK — DESIGN ONLY**. Exact SHA-1 blob identities allow verification of original source bytes; the ZIP download and its SHA-256 are separate receipt checks, **not claimed PASS** here.

## Follow-up

Return the complete independent review response to the user. Both reviewers receive the **same identical 45-file snapshot** for fair comparison. If more than the bounded packet is needed, name exact additional files; request a supplementary targeted packet later instead of inventing claims.
