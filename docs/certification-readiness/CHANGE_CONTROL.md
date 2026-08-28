# FlyTally Change Control

Version: 1.33.0

## Release principles

1. Production changes are versioned in `package.json` and identified by Git commit SHA.
2. The production branch is advanced only after the intended release set is assembled; avoid iterative production deployments for partial work.
3. Build/test/typecheck must pass before a release is treated as stable.
4. Runtime migrations must be idempotent and must not silently modify certified/locked regulatory records.
5. Any change to the certification canonical payload requires explicit certification-version compatibility handling.
6. Any change to instructor verification payload/signature semantics requires an update to `VERIFICATION_SPEC.md` and acceptance coverage.
7. Any change to FCL.050 print semantics, pilot-function allocation or record ownership must update the compliance matrix.
8. System documentation is part of the release, not an optional afterthought.

## Documentation revision rule

For every major functional release, update at minimum:

- production version / commit reference;
- system description revision history;
- data dictionary if stored/protected fields changed;
- compliance matrix if logbook behavior changed;
- verification specification if certification/signature behavior changed;
- acceptance matrix if a new critical workflow was introduced.

## Database-change rule

Schema additions should prefer backward-compatible, idempotent migrations. Historical certified rows must not be rewritten merely to make them resemble the newest schema representation.

If legacy records need compatibility behavior, prefer:

- version-aware readers;
- nullable/defaulted new fields;
- legacy fallback logic;
- explicit one-time migration against mutable records only.

Do not bypass the certified-record protection trigger to simplify a migration unless a separately reviewed, exceptional migration procedure has been approved and independently backed up.

## Incident/hotfix rule

A production hotfix should:

1. identify the concrete failure mode;
2. limit the change to the smallest safe scope;
3. add a regression test where practical;
4. preserve regulatory/audit history;
5. receive a new patch version;
6. update system documentation when the hotfix changes documented behavior.

## Current controlled baseline

v1.33.0 introduces Certification Readiness documentation and the authority verification report. The immediately preceding stable baseline is v1.32.2.

The certification-readiness documents do not themselves confer regulatory approval. Any final authority-facing claim must be checked against the deployed implementation and the competent authority's guidance.
