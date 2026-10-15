# FlyTally Logbook 3.8.0 — Currency #136 pre-release code review and independent AI handoff
Date: 2026-10-14  
Type: **READ-ONLY source analysis / preliminary review**, NOT independent DeepSeek approval.  
Repo: `filipto861/flytally-logbook`; Draft [PR #338](https://github.com/filipto861/flytally-logbook/pull/338).  
Analyzed immutable Git source HEAD: `ab4aff5a87d4e556fdc7704e7241c83b8c775316` (docs-only continuation of code-tested `669708fec856f5e88072a474f2b97b573a7881f6`). No application code or migration altered by this review.

## Frozen rules and verified history

- D1: account currency is a creation-time default only; user can override a rate or expense currency; flight rate snapshots preserve original denomination.
- D2: legacy prices without auditable currency remain unknown; no inferred CZK and no rewriting certified/voided evidence.
- D3: no FX; never aggregate/rank unrelated or unknown currencies.
- D4: supported current monetary ISO 4217 codes and original minor-unit exponent, source-backed registry; original owner-supplied SIX file is **owner-attested**, not independently authenticated.
- v21 schema draft adds **12 nullable nondefault columns** to `rates`, `aircraft`, `flights`, `flight_expenses` and four guarded CHECKs. It remains **unregistered**; `lib/migration-plan.ts` declares `DATABASE_SCHEMA_VERSION=20`.
- Owner-local combined acceptance on exact code SHA `669708fe`: TypeScript, 6/6 static SQL, 8/8 disposable PG16, 1533/1533 Node, local build, 8/8 authenticated desktop/mobile browser PASS. Local-only, not full historic production runtime.
- Owner-approved one-off disposable Neon PG18.6 child rehearsal: candidate DDL and repeat application PASS; schema 12 columns/4 validated CHECKs; existing row counts unchanged; original production branch stayed v20. The child was deleted and post-delete absence verified. PG18 negative-tuple writes **NOT RUN** because safety blocked them. Exact source/report: `docs/product/3_8_0_CURRENCY_V21_NEON_PG18_REHEARSAL_2026-10-14.md`.
- Actual Vercel `logbook` production `DATABASE_URL` target host/database matched the Neon Logbook Shadow production endpoint/`neondb` in a read-only check; no secret preserved.
- Main/prd remains v20, PR #338 Draft, **no v21 production DDL, runtime release, merge or deploy**.

## Source findings — do not conflate observation with exercised regression

### BLOCKER A — exact currency lost on aircraft-profile sharing (source-confirmed)

`lib/aircraft-sharing.ts` lines 4–9 declares `AircraftShareRate` with `pricePerHour:number` and `dryPricePerHour:number|null`, **no currency code/minor units/exact decimal**. Lines 38–44 parse with Number/numberOrZero, so this is a **legacy-only contract**.

`app/(protected)/connections/aircraft-share-actions.ts`:
- Lines 33–35 fetch legacy `aircraft.default_price_per_hour`, not the new currency fields.
- Lines 47–48 select only `rates.price_per_hour,dry_price_per_hour`; serialize Number, discarding exact source rate denomination/precision.
- Lines 49–55 serialize current/history in this legacy shape.
- Lines 86–95 accept a snapshot with `INSERT INTO rates(... price_per_hour,dry_price_per_hour,source)` and `ON CONFLICT ... DO UPDATE` only those same legacy columns. New `currency_code,currency_minor_units,price_per_hour_decimal,dry_price_per_hour_decimal` on a recipient rate are **not updated**.

**Consequence by code inspection:** sharing a source exact KWD/EUR/JPY rate produces a snapshot **without source money metadata**; a recipient import as a new rate stores legacy numeric price with NULL denomination; on a conflicting existing exact recipient rate it can update legacy `price_per_hour` while preserving **unrelated prior exact metadata**. SQL v21 CHECKs constrain presence and range of the metadata tuple but **do not compare legacy and exact amount values**, so this divergence can pass constraints. No actual real-user incident demonstrated.

**Disposition:** block release of currency-aware sharing until a versioned exact-money share contract and safe old-share import path are approved, implemented and tested. Old pending shares must not be silently inferred as CZK or overwrite an existing exact tuple. Consider rendering legacy shared rates as 'currency unknown' and refusing/explicitly skipping a conflict against exact recipient metadata.

### BLOCKER B — missing legacy/exact cross-value consistency check (source-confirmed validation gap)

`lib/currency-rate-snapshot.ts` lines 16–35 validates supported code, exponent, exact positive decimal format, and that legacy `price_per_hour` is finite/positive. It **does not verify value consistency** between `price_per_hour:number` and `rate_decimal:string`. Example tuple with legacy price 1200 and decimal `2000.000` satisfies the currently visible checks although it contains contradictory rate values.

Existing unit tests `tests/v380-currency-rate-snapshot.test.ts` exercise missing/corrupt metadata and Infinity but **no cross-value mismatch**. The existing `lib/monetary-amount.ts` exact arithmetic core does not by itself establish the invariant for both stored representations.

**Design question:** define whether the legacy DOUBLE is a presentation-only cache or independent source evidence, and how exact decimal versus approximate DOUBLE may be compared without quantizing/replacing the canonical decimal. Prefer explicit bounded consistency rules tied to serialization, not arbitrary monetary rounding. Make repairs auditable; do not silently auto-correct persisted metadata.

### RELEASE DEPENDENCY C — new runtime requires physical v21 schema (verified precondition)

`app/(protected)/database/actions.ts` lines 30–34/59 inserts `currency_code,currency_minor_units,price_per_hour_decimal`; `app/(protected)/flights/actions.ts` lines 96, 111–135, 180–181, 229, 258, 277–279 read/write v21 physical columns. Existing `ensureDatabaseOptimizations()` still registers v1–v20 only.

**Consequence:** the currently unmerged PR must **not** be put live against v20, or these new physical-column SQL statements can fail. A manual controlled v21 schema prerequisite, app compatibility/order, rollback vs forward-fix plan, target identity, and verified production smoke are mandatory. The earlier v21 isolated rehearsal is only prerequisite proof, not production authorization. Avoid silently auto-registering v21 in the same PR without release approval.

### OPEN D — signed v13 and legacy recovery scope (not a proven bug)

`lib/portable-backup.ts` lines 15–38 detects v21 fields in live and archived records even though portable backup format stays v13. `lib/account-restore-v6.ts` lines 89–111 preflights required **schema columns** on preview/execution when money metadata exists; other source paths preserve versioned signature and protected history, and current browser tests exercise signed v13 selected cases.

**Unverified:** comprehensive semantic validation of each currency-bearing signed backup row against ISO registry and exponent, corrupted partial tuples across rates/aircraft/flights/expenses, historical void/certified provenance on a restored PG18 full schema, and actual `@neondatabase/serverless` HTTP transaction semantics. PostgreSQL four CHECKs test structural shape, **not source ISO membership**. Do not claim silent corruption without a reproduction; create failing tests for any discovered behavior.

### OPEN E — currency presentation and comparisons (source-scoped)

`lib/flight-expenses.ts` groups by `currency:minorUnits:legacy|iso` and flags omitted invalid expense amounts, which preserves the distinction between known ISO minor units and legacy 2-digit storage. UI source tests suppress false CZK labels and unsupported global cross-currency highest-cost ranking. Actual end-to-end sharing, expense-write/edit, account default changes and simultaneous legacy/exact presentation on full historical Neon remain to be checked.

## Suggested focused implementation milestones (approval AFTER reviewer reconciliation)

1. **M3-A source-safe sharing design (blocker):** versioned `AircraftShareRate` with explicit state `legacy-unknown` vs `exact`; immutable exact decimal string, ISO code + minor units + original source info; fail-closed parsing, no Number coercion for exact; legacy pending shares remain parseable without invented currency; evaluate current-rate fallback from aircraft separately from history; ensure import ownership and pending-share semantics.
2. **M3-B write conflict strategy:** atomic `rates` upsert of **all** monetary fields, or explicitly reject preserving an existing exact tuple on unknown legacy import; never update the legacy numeric field alone when recipient exact metadata exists; prevent a second share item of same valid-from overwriting an earlier item silently; add SQL/UX error feedback.
3. **M3-C snapshot consistency contract:** settle legacy double vs exact numeric authority; reject clear contradictions and malformed stored tuples on create/edit/GPS import; preserve already-saved certified source evidence, and design explicit correction path rather than destructive overwrite.
4. **M3-D recovery/Neon SDK acceptance:** targeted old/new signed v13 and deleted-flight/void/certified/share behavior, including JPY0/EUR2/KWD3, corrupted partial tuples, dual version v20/v21; owner-local isolated PG and authenticated desktop/mobile browser; where needed a **separately approved** new scratch Neon branch + actual JS SDK test.
5. **M4 release gate:** write an exact production migration manifest/backup verification, explicit target PG18 config, no guessing of historical denomination, forward-fix/rollback barriers, deployment sequencing and observability, owner go/no-go. Re-run combined source/PG/build/browser gates on the actual final runtime SHA and update canonical docs.

## Independent DeepSeek reviewer handoff — forward verbatim

**ROLE:** Act as independent, read-only architecture/data-integrity reviewer for FlyTally Logbook Currency 3.8.0, GitHub `filipto861/flytally-logbook`, Draft PR #338, source SHA `ab4aff5a87d4e556fdc7704e7241c83b8c775316`. Do **not** implement code, merge, migrate, create remote databases, change production, or accept prior ChatGPT opinions without source verification.

**CONTEXT:** D1 account default only for new amounts; D2 no historical currency inference or destructive certified/void updates; D3 no FX/mixed aggregation; D4 genuine monetary ISO 4217 with source exponent. v21 is 12 nullable columns/4 constraints, **still unregistered**. Exact Windows owner-local acceptance PASS on application code SHA `669708fe` (1533/1533 Node, PG16 8/8, 8/8 desktop/mobile browser, build). Disposable Neon PG18.6 v21 DDL rehearsal and repeat PASS; temporary child already deleted, primary remains v20. Neither result authorizes a production migration.

**READ THESE ACTUAL FILES:** `docs/product/3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md`, `sql/drafts/3_8_0_currency_v21_additive_candidate.sql`, `app/(protected)/connections/aircraft-share-actions.ts`, `lib/aircraft-sharing.ts`, `lib/currency-rate-snapshot.ts`, `app/(protected)/database/actions.ts`, `app/(protected)/flights/actions.ts`, `lib/flight-expenses.ts`, `lib/portable-backup.ts`, `lib/account-restore-v6.ts`, `lib/flight-trash.ts`, `lib/migration-plan.ts`, relevant `tests/v380*` and Neon rehearsal report.

**VERIFY/CHALLENGE THE FINDINGS:** (1) Does existing share/create/import lose exact denomination and create a dual-amount conflict on recipient? (2) Is the rate snapshot metadata validator missing an exact-vs-legacy consistency invariant? (3) Does deploying the PR before v21 schema fail? (4) Which real signed v13 backup/Trash/certified/void cases remain insufficiently exercised? (5) Is there any more serious correctness or protection bug in these paths? Separate confirmed source defects from tests not run and design choices.

**DELIVER:** ranked findings (blocker/high/medium), exact file/line evidence and minimal reproducible test scenarios; a minimal-blast-radius contract for new share format plus legacy imports, acceptance tests and backward-compatibility risks; a minimal sequential roadmap for safe implementation and verified release order. No automatic fixes. If evidence is insufficient, write **UNVERIFIED** rather than assuming PASS.

**DO NOT:** infer CZK, use Number for exact data, rewrite certified/voided evidence, bypass server-side ownership, mutate production, auto-run/register v21, treat source-backed as approval, invent test results, or request a broad unrelated refactor.

## Review closeout

- Source/code evidence: **read-only** on `ab4aff5a`; no new tests executed, no application code changes.
- Confirmed release blockers: source-exact sharing gap, rate dual-value consistency gap, schema-before-runtime dependency.
- Additional verification needed: signed v13 edge cases, historic integrity, live Neon SDK behavior, ISO provenance and explicit owner approval.
- This document is a **first reviewer handoff**; DeepSeek independent verdict **NOT YET RECEIVED**.
- ROADMAP / FEATURES / CHANGELOG updated in the same docs-only work cycle; PR #338 stays Draft.


## 14 October 2026 — owner-approved 3-phase execution and implemented candidate (not tested)

Owner explicitly chose **one coherent implementation block → one complete acceptance → one controlled production release**; prior nine-step recommendation is not the implementation schedule. After the DeepSeek independent read-only review, the following source edits were staged in Draft #338 at application-code SHA `ff22625b40f06faeb32b574d17cec14bb9bafaa6`:

- Exact aircraft profile rate sharing uses version 2 and source code/minor units/decimal + derived legacy presentation double. Versionless or explicit version 1 legacy pending shares remain unknown-denomination; unsupported/partial v2 metadata is rejected, not downgraded.
- New recipient rate import updates legacy and v21 fields together. If an existing exact rate conflicts with incoming legacy data, the SQL conflict predicate refuses the legacy overwrite and the recipient gets a visible skipped-rate message. Importing exact data is an explicit replacement of the selected recipient rate.
- `validateCurrencyRateSnapshot` now compares `Number(rate_decimal)` with the legacy-double cache, rejects contradictory stored rate data and never rewrites it.
- Signed-v13 recovery checks monetary tuples (including archived/void snapshots) for partial ISO metadata, wrong exponent, contradictory legacy/exact cache and unsupported currencies before preparing/executing restore; all-null v20 legacy states remain accepted.
- Added pure/source and PostgreSQL (local disposable only) regression cases.

**Verification state on this new code: NOT RUN** for TypeScript, complete Node, static/PG, build and authenticated desktop/mobile browser. No production DB or migrations changed. Previously recorded full local acceptance is on old code SHA `669708fe`; PG18.6 temporary migration rehearsal is a separate, already cleaned-up DDL-only proof.

**Release dependency:** v21 physical schema must be safely in place before deploying this runtime; no registration or automatic migration was added. Next owner action is one local combined acceptance invocation:
```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-380-acceptance.ps1 -WithBrowser
```
Stop on failures, capture exact SHA and statuses. Only after real PASS can production preflight, fresh backup/restore recovery approval, v21 migration, merge/deploy and smoke be considered.