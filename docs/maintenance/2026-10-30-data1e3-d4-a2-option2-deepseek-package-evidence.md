# DATA-1E3 D4 A2 — DeepSeek Option 2 source-bound review package built

**Date (UTC):** 2026-10-30T18:49:33.465Z. **Scope:** external independent read-only architectural reviewer package for the owner-approved Option 2 **design only**. Not permission for code, schema/migration/backup format activation, database access, flags, merge or deployment. The package is a **conversation attachment** rather than a Git-tracked binary; this Markdown is a durable ledger, not a claim that the ZIP is hosted in GitHub.

## Exact SHA ledger

- Canonical main `807f281e5870164b794d001480ecc84e0b45aea5` (GitHub rechecked).
- Frozen candidate **executable** source `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1` (#449).
- Architecture Draft PR #451 branch `docs/logbook-data1e3-d4-a2-provenance-model-20261030` at pre-checkpoint HEAD `ef1a01581eee1f8782e56a17c4df94c1ec196e79`, based on docs Draft #450 at `b8ccc583c033f7d9b70f2e3b84000320d066b01a`.
- Proposed Option 2 design first recorded on `406561bde68f9d2e6b073472146483fbd9545b5e`; documentation-only #451 retains that same unimplemented source.
- Vercel read-only alias `fly-tally.com`: `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` READY on prior app SHA `55c8076e1eb8104c14392e15b272b33e0eb29607`; actual production DB/schema/flag readback **UNKNOWN**.

## Delivered local conversation artifact (verified on disk)

- **Filename:** `FlyTally_D4_A2_Option2_DeepSeek_Review_Package_2026-10-30.zip`.
- **Size:** 182,545 bytes.
- **ZIP SHA-256:** `4c36bf06a23391b73aca01c8fa0aab6961b011686bb539bfa45f2b8a9e6cf819`.
- **Contents:** 33 ZIP members, 32 in-package entries covered by `07_PACKAGE_MANIFEST.json`; ZIP CRC/integrity check PASS; member bytes+SHA256 match manifest 32/32.
- Original GitHub Actions source artifact id `12994433879`, workflow run `41093177377`, prior downloaded ZIP SHA256 `ea5321b2045a509a4b36ff23861f74a43be4f63827ccf17fab417fc02dcdbcee`; included 16 exact raw source files (SHA256 **16/16 PASS**) and six full line-numbered volumes at the immutable executable SHA.
- **New top-level files:** `00_START_HERE.md`, `01_DEEPSEEK_REVIEW_PROMPT.md`, `02_PROPOSED_OPTION2_ARCHITECTURE.md` (review-ready **reconstruction**, not byte-identical canonical design), `03_RISK_REGISTER_AND_SOURCE_NOTES.md`, `04_TEST_ACCEPTANCE_MATRIX.md` (20 proposed NOT RUN tests), `05_ADDITIONAL_SOURCE_URLS.md` (full canonical docs and unbundled supporting source at immutable SHAs), `06_RESPONSE_TEMPLATE.md`, `07_PACKAGE_MANIFEST.json`. Superseded discovery prompt is isolated under `FROZEN_SOURCE/OLD_DISCOVERY_REVIEW_PROMPT.md`.
- **Completeness qualification:** 16 source files are fully bundled and original source hashes verified; canonical #451 complete design docs and extra source files **linked but not byte-bundled**. Reviewer MUST label unavailable full documents **UNVERIFIED** and distinguish narrative from exact source. This is an honest limit, not an independently completed review.

## Reviewer objective and submission protocol

- Upload the single ZIP to DeepSeek; instruct to start from new `01_DEEPSEEK_REVIEW_PROMPT.md`. If DeepSeek cannot inspect ZIP, extract top-level prompt/design/risk/tests and six numbered volumes, upload in batches, and include exact source where needed.
- Reviewer must evaluate native/imported ledger alternative, v13 cross-snapshot identity, source-vs-destination flight ID, cryptographic event membership, v14 native roundtrip, complete safety backups, immutable ledger, two-session PostgreSQL and Neon HTTP feasibility, tenant isolation/actor semantics, and fail-closed compatibility.
- Required independent output: design-only APPROVE/APPROVE WITH CHANGES/BLOCK, P0–P3 findings with exact path:line@SHA and confidence class, unresolved owner choices, safe minimal data contract, transaction timeline, versioned backup matrix, tests and ONE next step.
- No source, database, credential, flight/GPS, UI/feature, migration or production write. New A2 PostgreSQL/Neon/Node/build/Playwright **NOT RUN**. External independent DeepSeek **NOT RUN** until the actual report is returned. Earlier limited A1 PG16 PASS remains only on source `0891ae0fb5f1a1c99a6982f55e7f701411bee001`.

**DO NOT:** represent the artifact as evidence of passed A2 acceptance or a second AI result; no merge/deploy/DB migration/flags/Training. The existing PR remains Draft.

**ONE NEXT STEP:** submit the exact ZIP from this conversation to external DeepSeek and return its complete read-only Markdown report for source-bound reconciliation before further owner decisions.
