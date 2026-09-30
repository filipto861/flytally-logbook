# UI/UX Simplicity 2026 — B1A Optional Costs Contract

**Status:** IMPLEMENTED IN BRANCH — VERIFICATION PENDING  
**Date:** 30 September 2026  
**Branch:** `feat/new-flight-b1a-optional-costs`  
**Parent contract:** `docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`

## Purpose

B1A makes Filip's frozen decision **“Billing / Costs are optional”** true across the canonical flight-entry and aircraft-default paths.

This is a domain-contract change, not merely a collapsed UI section:

- no billing basis means **aircraft cost is not tracked**;
- absence is distinct from `BLOCK`;
- absence is distinct from zero cost;
- an explicitly configured aircraft billing basis may still auto-apply;
- malformed populated billing remains fail-closed;
- structured additional expenses remain independent from aircraft billing.

## Frozen semantics

### Not tracked

Canonical no-billing state:

```text
billing_basis = ""
price_per_hour = NULL on newly saved/updated untracked flights
calculated aircraft cost = unavailable / not tracked
```

An empty billing basis does **not** mean:

- BLOCK;
- AIR;
- zero-cost evidence;
- missing regulatory evidence;
- a draft-save blocker.

### Tracked

Valid values remain:

- `BLOCK`;
- `AIR`;
- `BLOCK/N`;
- `AIR/N`;

where the supported share is canonically validated.

### Malformed populated state

Malformed populated billing is not reinterpreted as empty or BLOCK.

- direct flight input rejects it;
- aircraft profile save rejects it;
- a malformed persisted aircraft/flight value is surfaced as **Needs configuration** in the editable cost UI;
- the user must explicitly choose **Not tracked**, BLOCK or AIR before save.

Shared untrusted optional defaults are bounded conservatively: malformed shared billing is preserved as invalid evidence, surfaced to the recipient, left unchecked by default and cannot be imported unless corrected by the sender. It is never repaired to BLOCK or silently cleared.

## Discovery / consumer inventory

B1A audited the current consumers of:

- `parseBilling()`;
- `serializeBilling()`;
- `billingLabel()`;
- `calculatedFlightPrice()`;
- `billing_basis`;
- aircraft-profile billing defaults;
- manual Create/Edit;
- GPS import;
- aircraft sharing/import;
- legacy portable restore;
- flight-list/dashboard cost aggregation;
- Data health missing-rate findings;
- aircraft manager / Quick Add;
- detail cost presentation.

Key pre-B1A fail-open behavior:

1. legacy `parseBilling("")` returned BLOCK;
2. legacy `serializeBilling()` normalized unknown values to BLOCK;
3. `FlightForm` required billing and auto-opened Costs when it was missing;
4. selected aircraft with empty billing became BLOCK;
5. `getAircraftOptions()` coalesced missing billing to BLOCK;
6. Quick Add defaulted a new aircraft to BLOCK;
7. manual/GPS saves captured a rate even when the user did not intend to track aircraft cost;
8. dashboard/list SQL treated every non-AIR value as BLOCK;
9. Data health reported a missing rate even for a flight that should be validly untracked;
10. aircraft sharing/import and legacy restore could invent BLOCK when an explicit empty value was present.

## Implementation

### 1. Optional billing parser / serializer

`lib/billing.ts` now contains an explicit optional contract:

- `parseOptionalBilling()`;
- `serializeOptionalBilling()`.

Behavior:

- blank → valid untracked state;
- valid BLOCK/AIR + share → canonical value;
- malformed populated value → error.

Legacy `parseBilling()` / `serializeBilling()` remain backward-compatible for untouched historical callers. New optional-cost flows do not use their BLOCK fallback.

`calculatedFlightPrice()` and `billingLabel()` are absence-aware:

- untracked billing contributes no aircraft cost;
- empty billing displays **Not tracked**;
- malformed billing displays **Unavailable**, keeping corrupted persisted data distinct from intentional absence.

### 2. Canonical flight parser

`lib/flight-input.ts` no longer includes billing in the universal required-choice set.

- empty billing is valid;
- populated malformed billing/share still fails;
- canonical Create and Update continue to use the same `parseFlightInput(form)` path.

### 3. Manual New Flight / Edit

`components/flight-form.tsx`:

- removes billing from draft readiness blockers;
- no longer auto-opens Costs solely because billing is absent;
- uses **Not tracked** as the empty UI state;
- disables share choice when aircraft billing is untracked;
- shows aircraft cost as unavailable instead of zero;
- applies configured aircraft billing when valid;
- does not synthesize BLOCK when the aircraft has no billing setting;
- surfaces malformed stored billing as **Needs configuration** using an explicit invalid sentinel until the user chooses Not tracked/BLOCK/AIR.

Additional expenses remain usable when aircraft cost tracking is off.

### 4. GPS import

`components/kml-import-form.tsx` and the GPS server action now share the same optional billing semantics.

- blank billing is valid;
- malformed stored billing is visible and blocks final GPS save until explicitly resolved;
- billing share is disabled while aircraft cost is untracked;
- GPS import does not capture an hourly-rate snapshot when billing is untracked.

### 5. Aircraft profile defaults

Aircraft read/write paths now preserve a real no-billing state.

- `getAircraftOptions()` coalesces missing DB billing to empty, not BLOCK;
- Aircraft Manager allows **Not tracked**;
- Quick Add defaults to **Not tracked**;
- aircraft save uses `serializeOptionalBilling()`;
- malformed stored aircraft billing surfaces **Needs configuration** rather than appearing as a clean empty setting.

A configured valid billing basis remains an allowed aircraft default.

### 6. Flight price snapshots

Manual Create:

- tracked billing → resolve/capture applicable hourly rate;
- untracked billing → `price_per_hour = NULL`.

Update:

- clearing billing clears the aircraft-price snapshot;
- tracked billing retains the established historical-rate snapshot semantics.

GPS import follows the same rule.

### 7. Read models / statistics

Dashboard, standard Flights and fast Flights SQL now calculate billable minutes explicitly:

- AIR → AIR minutes;
- BLOCK → BLOCK minutes;
- untracked/unknown → 0 cost contribution.

No SQL path may use “not AIR = BLOCK” for cost aggregation.

Data health reports a missing historical rate only when a billing basis is actually configured.

### 8. Flight detail

An untracked record displays **Aircraft cost not tracked** rather than **Hourly rate missing**.

Additional expenses remain visible and contribute independently.

### 9. Aircraft sharing

Aircraft share snapshots preserve explicit absence.

- sender does not replace empty billing with BLOCK;
- recipient import does not replace empty billing with BLOCK;
- a newly imported aircraft starts untracked when no billing default was imported;
- malformed shared billing does not become BLOCK or silently become empty;
- sender-side sharing of malformed defaults is blocked;
- recipient review marks malformed defaults as **needs configuration** and leaves that group unchecked;
- attempting to import a malformed defaults group fails closed;
- review labels genuinely empty billing as **not tracked**.

### 10. Legacy restore compatibility

Legacy portable restore must distinguish:

- field absent from an old backup → preserve historical legacy fallback to BLOCK;
- field present but explicitly empty → preserve the new **not tracked** state.

The restore helper therefore uses property presence, not `value || "BLOCK"`.

## Database / migration assessment

No database migration is introduced by B1A.

Repository audit:

- no tracked versioned schema migration defines a billing-basis CHECK constraint;
- B1A changes no schema file;
- the storage contract remains the existing text billing field plus nullable price snapshot.

The production Neon schema was **not directly queried** during implementation because the available Neon connector is not scoped to the Logbook production project ID. This document therefore does not claim a live production-schema inspection. Before closeout, a read-only metadata query against the actual target database must confirm the `billing_basis` defaults/nullability/CHECK constraints for both `flights` and `aircraft`.

A PostgreSQL integration acceptance test was added to prove the intended compatibility boundary:

- an explicit empty string survives even when the column retains a legacy `DEFAULT 'BLOCK'`;
- omitting the column still produces legacy BLOCK behavior;
- an untracked flight may store `price_per_hour = NULL`.

This test must pass in the local PostgreSQL gate before B1A can close.

## Backward compatibility

Preserved:

- existing BLOCK/AIR records;
- existing share encoding;
- historical rate timeline selection;
- legacy callers of the old billing helper;
- old portable backups with no billing field;
- current certification payload/hash/version;
- recency calculations;
- revision/correction history;
- connected-PIC and participant sharing semantics.

B1A does not rewrite historical rows.

## Test coverage added / updated

Unit/source coverage includes:

- empty optional parse/serialize;
- valid BLOCK/AIR share canonicalization;
- malformed basis/share rejection;
- no billing draft save;
- no billing → no calculated aircraft cost;
- New Flight no billing blocker/auto-open;
- malformed persisted billing visibility;
- aircraft Quick Add / Manager optional state;
- aircraft sharing no synthetic BLOCK;
- manual Create/Update conditional price snapshot;
- GPS optional billing;
- dashboard/list cost SQL explicit AIR/BLOCK/else-zero contract;
- Data health missing-rate boundary;
- legacy restore field-presence compatibility.

PostgreSQL acceptance:

- explicit empty vs omitted legacy default.

## Verification state

Implementation is complete in the branch, but **B1A is not DONE yet**.

Evidence from Filip's local rerun on 30 September 2026:

- TypeScript: **PASS** (prior runtime-equivalent B1A head; no runtime TypeScript changed after it)
- stale-contract targeted rerun: **55/55 PASS**
- full unit/regression suite on current B1A head: **928/928 PASS**
- production build: **PASS** (runtime-equivalent B1A head)
- PostgreSQL core command: **NOT EXECUTED** — 55/55 tests were skipped because the local PostgreSQL/psql gate was unavailable
- direct metadata query: **NOT RUN** — no `.env.local` is present and local `psql` is not installed
- authenticated browser check: **NOT RUN**

Application/unit regression is now clean. B1A remains open only for database metadata/persistence evidence and targeted browser verification.

Browser scope for B1A is intentionally targeted rather than the full B2/B5 matrix:

1. valid aircraft with configured billing;
2. valid aircraft with no billing;
3. Costs remains collapsed when untracked;
4. user can opt into BLOCK/AIR;
5. additional expenses still work without aircraft billing;
6. GPS common details can remain Not tracked.

The complete desktop/iPad/mobile/light/dark redesign matrix remains mandatory in B2/B5.

## Next step

Run the B1A verification gate. Do not start B1B until failures are reconciled and this document, ROADMAP and CHANGELOG record the final evidence.


## Production database metadata verification — 30 September 2026

Filip linked the local checkout to the production Vercel Logbook project and executed read-only metadata queries against the configured production `DATABASE_URL`.

Observed columns:

| table | column | type | nullable | default |
| --- | --- | --- | --- | --- |
| `aircraft` | `billing_basis` | `text` | YES | `'BLOCK'::text` |
| `flights` | `billing_basis` | `text` | YES | `'BLOCK'::text` |

A second read-only `pg_constraint` query searching both tables for constraints whose definition references `billing_basis` returned **zero rows**.

B1A conclusion:
- the legacy BLOCK default remains compatible with omitted historical/legacy inserts;
- the B1A runtime explicitly persists `''` for intentional Not tracked state and therefore does not rely on the default;
- the current production schema has no billing CHECK constraint that blocks the explicit empty-string state;
- **no schema migration is required for B1A**.

This is production metadata evidence only; no production row was inserted or modified for the verification.
