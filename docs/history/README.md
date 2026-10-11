# Historical development documentation

Files in this directory were moved out of the repository root during the documentation-governance consolidation on 26 September 2026.

They are retained because they contain useful implementation rationale, regulatory evidence, release scopes and audit history.

## Authority

These files are historical context only.

Current authority order for development planning is:

1. actual repository/runtime state;
2. `ROADMAP.md`;
3. `FEATURES.md`;
4. `CHANGELOG.md`;
5. `ARCHITECTURE.md` / `DEVELOPMENT.md`;
6. active supporting documentation under `docs/`;
7. historical material in this directory.

The archived `ROADMAP_LEGACY_2026-09-26.md` is a verbatim snapshot of the previous roadmap before consolidation.

## 11 October 2026 active DEVELOPMENT history extraction

- [Phase 0B/0E/0F verification history](DEVELOPMENT_PHASE0_VERIFICATION_HISTORY.md) — verbatim, line-preserved historical material extracted from root DEVELOPMENT; includes dated intermediate tool versions and test evidence. **Not the current command reference**; use [active DEVELOPMENT](../../DEVELOPMENT.md) and the code/tooling.

## 10 October 2026 canonical-document cleanup snapshots

- `ROADMAP_BEFORE_2026-10-10_CANONICAL_CLEANUP.md` — complete verbatim prior ROADMAP (with its dated contradictory status narratives) retained before replacing it with a shorter forward plan.
- `FEATURES_BEFORE_2026-10-10_CANONICAL_CLEANUP.md` — complete verbatim prior feature list and verification diary retained before replacing it with a capability register.

These exact snapshots preserve historical decisions, prior local PASS/FAIL and still-pending test gates. Do not interpret an older candidate as the current merged app. For current state use `../../ROADMAP.md`, `../../FEATURES.md` and verified `main`.
