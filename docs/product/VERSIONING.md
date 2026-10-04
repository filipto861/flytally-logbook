# FlyTally Logbook versioning

**Effective:** 4 October 2026  
**Canonical product version at adoption:** `2.7.0`

This document defines the versioning and roadmap naming convention for `flytally-logbook`.

## 1. Product release version

FlyTally Logbook uses one numeric product version in `MAJOR.MINOR.PATCH` form.

- **MAJOR** — intentionally incompatible product/data/workflow generation change. Rare.
- **MINOR** — user-visible capability or substantial workflow milestone that remains backward-compatible.
- **PATCH** — production correction/hotfix with no planned feature expansion.

Examples:
- `2.8.0` — Flight Entry Simplification.
- `2.8.1` — a production correction to 2.8.0.
- `2.9.0` — the next planned product milestone after 2.8.x.

The canonical version must agree across:
- `package.json`;
- the app-visible version/footer when shown;
- the shipped `CHANGELOG.md` heading;
- the Git tag / GitHub Release when a release is tagged.

## 2. Roadmap identifiers

New roadmap work uses the **target numeric release version**, not letter-coded milestone families.

Use:
- `2.8.0 — Flight Entry Simplification`
- `Phase 1`, `Phase 2`, `Phase 3`, ... inside that release.

Do not create new current-planning identifiers such as `E3`, `F4`, `B5`, `SP2`, `M2B` or similar.

Historical labels remain unchanged where they are needed for auditability, old PRs, tests or documentation. They are legacy references, not current release versions.

## 3. Changelog discipline

`CHANGELOG.md` records changes that actually merged/shipped.

- `## Unreleased` may contain only changes already merged to the canonical development line but not yet assigned to a shipped release.
- A shipped release gets one heading such as `## 2.8.0 — 2026-10-XX`.
- Do not put roadmap-only planned scope into CHANGELOG.
- Internal implementation phases do not receive changelog version headings.

Historical changelog headings that used inconsistent labels remain preserved as historical evidence. They are not reused.

## 4. Technical versions are separate

The following are **not** product versions and must remain independent:
- PostgreSQL schema migration version, currently v19 at adoption;
- certification payload/hash version;
- backup/export format versions;
- API/protocol versions where applicable.

A product release may ship without changing any of these, and a schema migration number must never be inferred from the product version.

## 5. Branch and PR naming

For significant work, prefer:
- `feat/2.8.0-flight-entry-simplification`
- `fix/2.8.1-<short-description>`
- `docs/2.8.0-<short-description>`

PR titles should start with the numeric target version when practical.

## 6. Current forward release sequence

| Target | Scope | Status |
| --- | --- | :---: |
| 2.8.0 | Flight Entry Simplification | ACTIVE |
| 2.9.0 | Multi-aircraft remaining integrity audit | NEXT |
| 2.10.0 | Saved-date / timezone semantics | PLANNED |
| 2.11.0 | Currency / monetary semantics | PLANNED |
| 2.12.0 | Multi-aircraft heterogeneous onboarding proof | PLANNED |
| 2.13.0 | Multi-aircraft sharing / recovery / scale closeout | PLANNED |
| — | Professional Logbook Platform | RESEARCH; no release number until scope is frozen |

This sequence may be pre-empted only by a confirmed production, security or data-integrity defect.
