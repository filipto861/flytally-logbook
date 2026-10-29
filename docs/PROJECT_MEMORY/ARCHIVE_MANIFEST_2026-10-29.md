# DOC-6B Project Memory archival manifest — 2026-10-29

Source commit: `d20d1933d0c2e3fb99ee28d904b7fb9a76c5a70a` (Draft PR #429 head, base main `eb98982d9ce7cb166c32ba77c9262683989570f8`). The two archives were copied byte-for-byte from those files before either active file was shortened. The source Git blobs remain immutable and can independently reconstruct the originals.

| Original and archive in this directory | Source Git blob SHA-1 | Archive SHA-256 | Bytes |
| --- | --- | --- | ---: |
| `SESSION_HANDOFF.md` → `SESSION_HANDOFF_ARCHIVE_2026-10-29.md` | `686821ad6a0760c635f38eac37acb3de59bfc343` | `c585b525bf22cc58e9c0c8535f80d9c31f013aec622a85fef131d918a4820873` | 497397 |
| `ACTIVE_WORK.md` → `ACTIVE_WORK_ARCHIVE_2026-10-29.md` | `1593338b5e2c98ac04ef613c95ee6d12975ad43b` | `aa2e2d336e5457b60f6ce527cebd5b28c1b5352accbd843687e466ee8e884631` | 256214 |

Archives stay in `docs/PROJECT_MEMORY/`, so their existing relative links retain the same base path. They are historical evidence, never current release authority. Read the active files first and consult a bounded archive section by date or SHA only when needed.

Verify on a checkout: `git show d20d1933d0c2e3fb99ee28d904b7fb9a76c5a70a:docs/PROJECT_MEMORY/SESSION_HANDOFF.md` and the corresponding `ACTIVE_WORK.md`; compare bytes with each archive. The source commit is also the Draft PR #429 head; keeping the archive in this branch makes preservation independent of that PR's future branch state.
