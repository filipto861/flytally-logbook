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

Technical counter snapshots are dated release evidence, not current product-version authority. In the documented 11 October 2026 release checkpoint the last reported counters were PostgreSQL schema **v20** (not independently re-queried), certification payload **v8**, and backup/export format **v13**; the then-released package was **3.7.0**. Preserve the full deploy SHA, provider exceptions and historical verification details in [CHANGELOG](../../CHANGELOG.md) and the [3.7.0 release acceptance](3_7_0_FINAL_PRODUCTION_ACCEPTANCE_2026-10-11.md). For **current shipped status** consult [ROADMAP](../../ROADMAP.md) and verify the live deployment; do not infer schema or certification versions from package metadata.

A product release may change none, one or several technical counters. No technical version is inferred from the product version.

## 6. Branch and PR naming

For significant work, prefer:
- `feat/3.4.0-flight-entry-simplification`
- `fix/3.4.1-<short-description>`
- `docs/3.4.0-<short-description>`

PR titles should start with the numeric target version when practical.

## 7. Release order and dated renumbering decision

The **current** release order, owner priorities and completion state are maintained only in [ROADMAP](../../ROADMAP.md). Dated shipped milestones remain in [CHANGELOG](../../CHANGELOG.md) and [release acceptance records](../README.md); this policy intentionally does not duplicate the forward status table.

**Historical decision (9 October 2026, retained verbatim in meaning):** The owner moved the unstarted Currency reservation from 3.7.0 to 3.8.0 and shifted future multi-aircraft reservations accordingly. Issue #136, currency evidence/fail-closed rules and multi-aircraft acceptance requirements remain binding. Prior version references in dated evidence must not be rewritten. The 3.7.0 Maps milestone subsequently shipped on 11 October 2026; this dated fact does not determine what release is current in future.

Confirmed production, security or data-integrity defects may pre-empt this sequence.
