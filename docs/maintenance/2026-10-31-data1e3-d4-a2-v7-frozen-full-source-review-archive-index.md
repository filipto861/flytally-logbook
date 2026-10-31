# DATA-1E3 D4 A2 — V7 immutable complete-source review archive index

**31 October 2026. PASS: frozen GitHub tree lookup and listed Git blob membership. NOT RUN: download/extraction/ZIP SHA-256, independent V7 review.** This is a complete-archive index, NOT a claim that a combined independent review ZIP has been generated locally. A prior reviewer was given incomplete transitive source files; complete frozen repository archives, not excerpts, are now the handoff requirement.

## Repository and exact identities

- Repository: filipto861/flytally-logbook
- Verified main: 807f281e5870164b794d001480ecc84e0b45aea5
- Draft PR #451, base Draft #450 at b8ccc583c033f7d9b70f2e3b84000320d066b01a.
- **Source executable commit (unreleased): 6fd5597aec03ee7b6cbab4dafd98228fafdaaea1**. Exact GitHub tree query: 1307 entries, truncated=false.
- **Design V7 freeze before this index commit: f8f3dc07edce42357a0871599d054c9b5e44f146**. Exact GitHub tree query: 1332 entries, truncated=false.
- All 40 named critical source blobs and 18 V7/design/documentation blobs below exist in their expected frozen trees. The entire source commit archive includes other transitive dependencies; the 40-name list is a navigation index, NOT proof of complete import traversal.
- **Whole frozen repository ZIP — executable:** https://github.com/filipto861/flytally-logbook/archive/6fd5597aec03ee7b6cbab4dafd98228fafdaaea1.zip
- **Whole frozen repository ZIP — V7 design:** https://github.com/filipto861/flytally-logbook/archive/f8f3dc07edce42357a0871599d054c9b5e44f146.zip

Both archive links identify full immutable GitHub commit snapshots. Their actual downloaded ZIP contents, CRC and SHA-256 have **NOT RUN** verification in this session (GitHub content connector can read text trees, local container cannot reach GitHub network). Do not invent a ZIP SHA-256 or tell a reviewer that links alone constitute a completed source review.

## Source file inventory from GitHub tree (frozen executable)

Each SHA below is a Git **blob SHA-1 object ID, NOT SHA-256**. Size is the Git-reported blob size in bytes.

| File | Git blob SHA-1 | Bytes |
| --- | --- | ---: |
| lib/account-backup.ts | f97464b04c1fc00eb94fb9e7bce30aed67933dd2 | 8672 |
| lib/account-backup-snapshot.ts | 5e8f7e6880c95bc346b65879e3e0576b3aaa34d2 | 2939 |
| lib/account-backup-presign.ts | 8331698d1866d35f9266b43f5c8cd3d75da558ae | 3848 |
| lib/account-restore-v6.ts | 73b8918305d12b39eeeb50ce7f930429b3805f55 | 36240 |
| lib/backup-authenticity.ts | c268c066e2f66e797b5fa91171fda5652c622247 | 1913 |
| lib/verification-signature.ts | b614fe3d97a2ec9afc722856244810caae9357af | 1071 |
| lib/db-optimization.ts | 98ffaad765737f533866b124f7012ea70405c588 | 70017 |
| lib/backup-center.ts | df0f7a4c905a127ec37865eb57a12c9020256339 | 5446 |
| lib/privacy-account.ts | a8eb5e24d5e29cecb382d080b88a34d13661f370 | 6177 |
| lib/portable-backup.ts | a6d3f7e1e35d8622a0064e65347f3f5fe0f60c28 | 25392 |
| lib/canonical-evidence.ts | bbbc293592c7a74e753ea45193017726be050805 | 519 |
| lib/backup-certification.ts | 2cd34708d19484529331bd2c087b5fd1c204577d | 9803 |
| lib/recovery-conflict.ts | e4d10bb60dbdd5485de72e15a2c7166f1c55ecdc | 3009 |
| lib/recovery-scale.ts | ecdbc240414b8a099c53b6433fd71f82ce8dfd45 | 1572 |
| lib/iso4217-currency-registry.ts | 2f74d949a5e77e7568beaa044e9e470e88e5c161 | 2985 |
| lib/iso4217-currency-data.ts | ecf3d8f6efbef556061a4c35af8274057077501f | 10200 |
| lib/monetary-amount.ts | 300587c9158460a11e240aadfcc3d0d53c33c4cc | 4508 |
| lib/local-postgres.ts | 889947a8324ebf8fee385cc5bbf0c7987fe3695d | 7616 |
| lib/local-postgres-transaction.ts | 451c646591e0dd8453e82adae8e2b8955aee6f26 | 3488 |
| lib/migration-plan.ts | 7ff4d6460c16f40c269a07485aed64d7cf918b72 | 1523 |
| lib/currency-v21-migration-safety.ts | b1640d3ec23230ffb60e8f24e166b7413f4643cb | 1536 |
| lib/certification-integrity.ts | 07b21f6a3bcdbf03ccde8e14e64be792175a46b8 | 5540 |
| lib/authority-verification.ts | dd39e8770249660d8edd151a5ee2b15163e28d16 | 3028 |
| lib/db.ts | e505c4b3e748abc643bf9570f3a01c91effd6d28 | 1734 |
| lib/v162-schema.ts | e69853b4a980ce5434854998587bfc4c159a47da | 3041 |
| lib/v163-schema.ts | f01cd1d2c357bd04904351a3573dc95128fb353a | 1694 |
| lib/v164-schema.ts | e5993699baa7b435dde71fb1ce910ba20506bc01 | 2615 |
| lib/v165-schema.ts | 9e888cf80442cb037005072c0f1a9d3cdf3482fd | 2057 |
| lib/v166-schema.ts | 339941595b51180f250a8a11ce7afa17bd6a00a0 | 1500 |
| lib/flight-sharing.ts | 42a7dd6b153cbd048deec090e86b2a02db033784 | 6207 |
| lib/v290-schema.ts | c6840c44cbda00eb5fa29441957f32ed9e562205 | 1959 |
| lib/push-schema.ts | 32ce025b104ac5a6a7cb10f73bfe6652335ade9a | 2298 |
| lib/auth/require-user.ts | 6133d2b97e527d8d4f2c881ba9a5ff066220ae45 | 239 |
| lib/auth/session.ts | 7ec1a79ef59ca13f4e4bf3e5e603a7480dda7e0d | 3361 |
| lib/flight-trash.ts | 5a46c82bae05c8716dc69a51e9cb5ad38e0c5bea | 30283 |
| app/(protected)/export/actions.ts | aebf79a7cac13fa06e2b6bd7a892def7095ad388 | 19457 |
| app/api/backups/[id]/route.ts | e9a80f18682a4f8d202d5b560effdfe206afca5d | 1007 |
| tooling/development-modules.json | 3012c5797efe8672f3fd3ef2370808026db65867 | 49514 |
| package.json | e7e6d5685e572a65cb1bc1bcd989c52ae58cdd44 | 2182 |
| vercel.json | abf0bd990dc747eb9305ba8cd1fb818d4dd2a812 | 434 |

## Design and reviewer document inventory from GitHub tree (frozen V7)

| File | Git blob SHA-1 | Bytes |
| --- | --- | ---: |
| docs/maintenance/2026-10-31-data1e3-d4-a2-r1-retention-key-rotation-erasure-policy-options-v6-design.md | fe8cf5efbd39d57b737d3a002b36dada74601ad0 | 16708 |
| docs/maintenance/2026-10-31-data1e3-d4-a2-v14c-c2-observation-manifest-v7-candidate.md | eba5a20e260ce996064281703ab57becd67bf7fd | 17486 |
| docs/maintenance/2026-10-31-data1e3-d4-a2-v14c-r1-independent-security-review-brief-v7.md | d494e85755a259609222d10f6789bc4e15cfbee9 | 7731 |
| docs/maintenance/2026-10-31-data1e3-d4-a2-v14c-conditional-c2-approved-v5-design.md | 3044ad24a3e3628427091b325dbe650ab037728d | 10641 |
| docs/maintenance/2026-10-31-data1e3-d4-a2-v13i-restore-contract-v4-design.md | 897a5d4680f9cad0e40ca04b8f8b2b36857cc554 | 12184 |
| docs/maintenance/2026-10-30-data1e3-d4-a2-v14-n2s-sidecar-review-contract-v3.md | 2ed4e1192f3ac95b88bb5a1ddd8cfc60534b1dc4 | 12371 |
| docs/maintenance/2026-10-30-data1e3-d4-a2-v14-n2s-independent-v3-block-review-reconciliation.md | d66b7f507ed7aa9d4a392f0198188ae45f6d5934 | 13047 |
| docs/maintenance/2026-10-30-data1e3-d4-a2-v14-provenance-contract-v1.md | d12b11fc79185aadb698472b8c3b22535a8c79d6 | 23902 |
| docs/maintenance/2026-10-30-data1e3-d4-a2-immutable-audit-provenance-architecture-v1.md | c386113159b2641a7d11243fd04bd07d9882c569 | 25361 |
| docs/maintenance/2026-10-30-data1e3-d4-a2-v13-cross-snapshot-policy-proposal.md | 018d04209f4be6ac57534235be96267b383257a6 | 8327 |
| docs/maintenance/2026-10-31-data1e3-d4-a2-v14-clone-namespace-policy-options.md | 938992585890e8c0d3985d091a7199a86a23439e | 14203 |
| AGENTS.md | 2e5ed02f1f722343a9bd4fa34da08d1f779e2460 | 4685 |
| ROADMAP.md | e4169b3fc7445351685aa9bfc121a2d6c22e338b | 512478 |
| FEATURES.md | 0c1ad80f7da661f07be0e34f651a692c1a3f1f91 | 111061 |
| ARCHITECTURE.md | 1635ed096abce52230da5477a24b1180f26d5e06 | 18802 |
| DEVELOPMENT.md | 571e12bca0b7fa76b5351c9ae6deaa97777cd87a | 29391 |
| CHANGELOG.md | d813e7753839fbdbbebf3a4afc94f8bcecfd5fff | 563259 |
| docs/AI_HANDOFF_TEMPLATE.md | 9d870c69e918c0be7fd652b2942267a4804a42a6 | 3875 |

## Required real archive verification procedure (for the reviewer packet recipient)

1. Download BOTH complete frozen archives or perform a clean Git checkout of each exact full SHA. Keep them separate. Never package local .env files, production connection strings, signing secrets, private flights or GPS data.
2. If using Git checkout, confirm the exact SHA using git rev-parse HEAD, and confirm each listed file with git hash-object relative/path. Each value MUST match the row above. Missing content is BLOCK, not an implicit external-source review.
3. Produce a real SHA-256 receipt of EACH downloaded archive and a per-file SHA-256 list from actual received bytes; save the receipt next to the two real archives. SHA-256 is a pending recipient-side acceptance step, **not verified here**. Do not mix this index commit with the earlier pinned V7 design archive; the index itself postdates the design freeze.
4. The reviewer must explicitly confirm extraction, source availability and exact design SHA, read literal V3/V4/V5/V6/V7 contract documents, and inspect relevant transitive source files from the full source commit. If any missing dependencies are found, verdict remains BLOCK/INCOMPLETE; a link-only review is insufficient.
5. Use the frozen V7 independent security brief at docs/maintenance/2026-10-31-data1e3-d4-a2-v14c-r1-independent-security-review-brief-v7.md. Return P0/P1/P2 with file/line/SHA evidence and one design-only verdict. No independent review has been performed by creating this index.
6. Full V14 still NOT IMPLEMENTED; critical old F9 native-audit MAX/DELETE/unchecked insert and unfinished exact 37-result MVCC manifest, N2-S, C2 observation arbitration, historic keyring, legal erasure/anti-resurrection remain blockers. V13-A, V13-I, L1, C2 and K1/T1/E are owner-selected DESIGN rules only. No actual backup migration, remote DB, key rotation, erasure, flag, merge or deploy is authorized.

**Evidence levels:** GitHub tree and named file existence PASS at specified exact SHAs; full physical ZIP/CRC/actual file-bytes SHA-256 NOT RUN; independent DeepSeek/Claude V7 review NOT RUN; runtime PostgreSQL/Neon/Node/TypeScript/build/Playwright V14 tests NOT RUN. Production DB/schema/flags UNKNOWN; Vercel production last read-only READY deployment dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU from older app source 55c8076e1eb8104c14392e15b272b33e0eb29607. No executable code or production changes by this documentation checkpoint.

**ONE NEXT STEP:** download and hash-check the two full frozen archives, deliver both literal archives and this index/brief to one independent read-only DeepSeek/Claude reviewer, and reconcile findings before any implementation request.
