# FlyTally Logbook versioning

**Effective:** 4 October 2026  
**Production package version at adoption:** `2.7.0`  
**First canonical unified release:** `3.4.0` (production 5 October 2026)

This document defines the product-version and roadmap naming convention for `flytally-logbook`.

## 1. One canonical product version

FlyTally Logbook uses one numeric product version in `MAJOR.MINOR.PATCH` form.

- **MAJOR** — incompatible product/data/workflow generation change. Rare.
- **MINOR** — backward-compatible user-visible capability or substantial workflow milestone.
- **PATCH** — production correction/hotfix without planned feature expansion.

From the first unified release onward, the canonical version must agree across:
- `package.json`;
- the app-visible version/footer when shown;
- the shipped `CHANGELOG.md` release heading;
- the Git tag / GitHub Release when a release is tagged.

## 2. One-time reconciliation jump

Historical FlyTally development used two conflicting numbering streams:

- `package.json` / the production footer currently identify the product as **2.7.0**;
- older CHANGELOG/development headings already used labels through **v3.3**.

Those historical headings remain audit evidence and are not rewritten.

To avoid reusing an existing historical release label, the **first canonical unified product release is 3.4.0**.

Therefore:
- 3.4.0 was merged and deployed to production on 5 October 2026 as the first unified release;
- future release branches may carry the target `package.json` version while still unreleased; this identifies the candidate being built and does **not** claim production deployment;
- at release closeout, the deployed app/footer and CHANGELOG release heading must agree with `package.json`; any Git tag / GitHub Release used for that release must carry the same version;
- no future canonical release may reuse `2.8`, `2.9`, `3.0`, `3.2` or `3.3`.

This is a one-time reconciliation, not permission for future version drift.

## 3. Roadmap identifiers

New roadmap work uses the target numeric release version.

Use:
- `3.4.0 — Flight Entry Simplification`
- `Phase 1`, `Phase 2`, `Phase 3`, ...

Do not create new active milestone families such as `E3`, `F4`, `B5`, `SP2`, `M2B` or similar.

Historical labels remain unchanged in archived material where required for old PRs, tests and evidence.

## 4. Changelog discipline

`CHANGELOG.md` records changes that actually merged/shipped.

- Planned scope belongs in ROADMAP, not CHANGELOG.
- Internal implementation phases do not receive product-version headings.
- A shipped release receives one heading such as `## 3.4.0 — 2026-10-XX`.
- Historical inconsistent headings remain preserved under legacy history.

## 5. Technical versions are separate

These are not product versions and remain independent:
- PostgreSQL schema migration version;
- certification payload/hash version;
- backup/export format version;
- API/protocol versions where applicable.

3.6.0 completed production rollout on 9 October 2026. Current production baseline:
- production database schema is **v20**;
- flight certification payload remains **v8**;
- portable backup/export format is **v13**;
- production product package/runtime is **3.6.0**.

A product release may change none, one or several technical counters. No technical version is inferred from the product version.

## 6. Branch and PR naming

For significant work, prefer:
- `feat/3.4.0-flight-entry-simplification`
- `fix/3.4.1-<short-description>`
- `docs/3.4.0-<short-description>`

PR titles should start with the numeric target version when practical.

## 7. Forward release sequence

| Target | Scope | Status |
| --- | --- | :---: |
| 3.4.0 | Flight Entry Simplification | DONE / PRODUCTION |
| 3.4.1 | GPS Night-time reliability | DONE / PRODUCTION |
| 3.5.0 | Certified flight voiding + remaining multi-aircraft integrity audit | DONE / PRODUCTION |
| 3.5.1 | GPS T&G false-positive containment | DONE / PRODUCTION |
| 3.5.2 | Always-on GPS/SERA Night suggestions | DONE / PRODUCTION |
| 3.5.3 | Flight detail navigation UX | DONE / PRODUCTION |
| 3.5.4 | iPad flight-detail visual hotfix | DONE / PRODUCTION |
| 3.5.5 | iPad sidebar collapse-control alignment | DONE / PRODUCTION |
| 3.6.0 | Saved-date / timezone semantics | DONE / PRODUCTION |
| 3.7.0 | Currency / monetary semantics | ACTIVE |
| 3.8.0 | Multi-aircraft heterogeneous onboarding proof | NEXT |
| 3.9.0 | Multi-aircraft sharing / recovery / scale closeout | PLANNED |
| — | GPS T&G time-normalized / evidence-limited follow-up | RESEARCH; remains unnumbered until scope/evidence are frozen; 3.5.2 is assigned to always-on GPS/SERA Night suggestions |
| — | Professional Logbook Platform | RESEARCH; no release number until scope is frozen |

Confirmed production, security or data-integrity defects may pre-empt this sequence.
