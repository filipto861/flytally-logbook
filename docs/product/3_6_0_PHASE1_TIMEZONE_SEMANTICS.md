# FlyTally 3.6.0 — Phase 1 saved-date / timezone semantics

Status: **DRAFT CONTRACT — SECOND-AI REVIEW REQUIRED BEFORE RUNTIME IMPLEMENTATION**  
Issue: **#144**  
Base: `main@eafc347fe00e781f966cc328da67ec24e52c8287`

## Purpose

Phase 1 removes hard-coded Prague calendar-date defaults from values that can later be persisted, without changing the authority of existing flight records, rate history or GPS/FCL.050 UTC evidence.

This is not a display-formatting project. Batch 7 already made metadata presentation viewer-timezone-aware. Phase 1 defines the separate semantics for **saveable date defaults**.

## Source-of-truth categories

### A. Persisted calendar dates

Examples:
- `flights.date`
- `rates.valid_from`

These values are calendar-date authority once explicitly entered or saved. They are not instants and are not reinterpreted when a user later changes timezone.

Timezone may choose a **new default value** before the user saves. It must never rewrite an already-persisted calendar date.

### B. User-local presentation of instants

Examples:
- notification timestamps;
- sessions;
- backup metadata;
- audit/display timestamps.

Existing `formatLocalDateTime(..., userTimezone)` semantics remain presentation-only. The current resilient fallback to `Europe/Prague` is retained for display paths and is not authority for saveable defaults.

### C. Aviation UTC evidence

Examples:
- GPS source timestamps;
- FCL.050 off-block / takeoff / landing / on-block values;
- server-side GPS `utcParts()` conversion.

These remain UTC/source-authoritative. User timezone does not convert or relabel them.

### D. System/audit instants

Examples:
- `created_at`, `updated_at`, `exported_at`, certification/signature timestamps.

Stored instant semantics remain unchanged. Phase 1 does not alter their persistence or backup representation.

## Repository discovery

Confirmed saveable-default drift:

1. `lib/data/flights.ts#getManualEntryDefaults()`
   - generates the Manual New Flight date with hard-coded `Europe/Prague`.

2. `components/aircraft-manager.tsx`
   - module-level Prague `today`;
   - feeds new-aircraft `initial_valid_from`;
   - feeds new rate `valid_from`;
   - module-scope evaluation can remain stale across later use.

3. `components/quick-aircraft-form.tsx`
   - module-level Prague `today`;
   - feeds hidden `initial_valid_from`.

4. `components/flight-form.tsx`
   - client fallback uses `new Date().toISOString().slice(0,10)`, i.e. UTC calendar date, if no initial date is supplied.

5. `lib/track-processing.ts#localParts()`
   - legacy helper still contains Prague conversion.
   - current server logbook consumers do **not** use that conversion: `lib/kml.ts` overrides the export with `utcParts` from `lib/track-time.ts`.

Confirmed existing timezone infrastructure:

- `user_settings.timezone` exists and new accounts are initialized with `Europe/Prague`;
- `lib/data/user-settings.ts#getUserTimezone()` is deliberately presentation-resilient and normalizes missing/invalid/read-failure state to Prague;
- Settings currently persists raw timezone text without validating it at the write boundary;
- portable backup includes `user_settings` and restores settings rows without transforming timezone or calendar-date fields;
- backup/export serializes `flights.date` and `rates.valid_from` as stored; no timezone conversion is required.

## Frozen semantic contract

### 1. Configured timezone is the authority for future saveable defaults

A new saveable calendar-date default is derived from:
- the current instant; and
- the signed-in user's valid configured IANA timezone.

The result is an exact `YYYY-MM-DD` calendar date.

The server/device host timezone is never authority.

### 2. Saveable defaults fail closed on invalid persisted configuration

The existing presentation helper may continue to fall back to Prague.

A saveable-default path may **not** silently turn a missing, blank or invalid persisted timezone into a Prague date. Such state is **Needs configuration**.

This keeps invalid persisted configuration explicit and prevents a plausible but wrong date from being saved.

### 3. Timezone writes are validated

Settings must reject a non-empty timezone that is not accepted by the runtime's IANA timezone implementation.

Invalid timezone input must:
- not be persisted;
- produce a user-readable form error;
- never expose a raw runtime/Intl error.

The normal product default remains `Europe/Prague` for newly created accounts, which are already initialized with that value.

### 4. Existing records are immutable with respect to timezone changes

Changing `user_settings.timezone` affects only future presentation and future generated defaults.

It must not modify:
- existing `flights.date`;
- existing `rates.valid_from`;
- existing certified revisions;
- existing backup contents;
- existing GPS timestamps/evidence.

No historical backfill is performed.

### 5. Explicit user-entered date wins

Once a pilot edits a date input, that explicit date is authoritative for the submitted draft. There is no automatic conversion at save time.

A server action validates the submitted date, but does not silently replace it with "today".

### 6. Default generation is evaluated at use/render time, not module import time

No saveable `today` value may be a module-level constant.

The default must be computed from a current instant for the relevant user context. A form already open across midnight is treated as an in-progress draft; FlyTally does not silently mutate an already-present date while the user is editing.

A fresh page/form opening receives a freshly derived default.

### 7. Manual flight date and UTC flight times remain separate concepts

Manual New Flight:
- date default = user calendar date;
- off-block / takeoff / landing / on-block = UTC, as today.

Phase 1 does not reinterpret a flight's UTC time fields into the configured timezone.

### 8. GPS/FCL.050 evidence remains UTC

`lib/track-time.ts#utcParts()` remains authoritative for current server GPS import consumers.

A track timestamp without explicit UTC/offset basis remains unavailable/fail-closed; user timezone must not be used to guess its instant.

The legacy Prague `track-processing.localParts()` must not become a server authority. It may be retired only after proving no active consumer depends on it.

### 9. Rate history remains date-only authority

Timezone affects only the default initially offered for a new `rates.valid_from`.

Rate lookup remains:
- explicit stored `valid_from`;
- compared to explicit `flight.date`;
- no timezone conversion.

### 10. Backup / restore / export require no schema or format migration

Phase 1 changes default-generation semantics, not persisted field shape.

Expected:
- DB migration: **N/A**
- portable backup version bump: **N/A**
- historical rewrite/backfill: **N/A**

Exact restore must continue to preserve stored calendar dates and timezone setting values rather than deriving new dates.

## Proposed implementation boundary

A strict shared calendar utility should own deterministic calendar-date derivation from an instant plus a validated timezone. It must be pure/testable with an injected instant.

A separate server-side user-calendar resolver should distinguish:
- valid configured timezone → available;
- missing/blank/invalid timezone → needs configuration;
- data-read failure → unavailable/fail closed.

Do **not** reuse the presentation-resilient `getUserTimezone()` fallback as saveable-default authority.

Target wiring:

- Manual New Flight defaults:
  server resolves strict user calendar context and provides date to the form.

- FlightForm:
  remove the independent UTC-date fallback as authority for a missing new-flight date. Edit mode keeps stored date.

- Aircraft & rates:
  use strict user calendar context rather than a module-level Prague constant.

- Quick Add Aircraft:
  use the same strict user calendar context; no hidden Prague date.

- Settings:
  validate timezone before persistence and expose a controlled error state.

## UI fail-closed behavior

When timezone configuration is unavailable/invalid on a path that needs a saveable date default:
- do not invent a date;
- show **Needs configuration**;
- link/direct the user to Settings;
- keep any explicit date field editable where safe;
- no duplicate submit or silent repair.

An explicitly entered valid date may still be saved where the underlying workflow does not otherwise depend on timezone authority. The default itself must remain unavailable until configuration is valid.

## Test matrix

### Pure date derivation

Use deterministic instants and expected dates for at least:
- Europe/Prague;
- America/Los_Angeles;
- Pacific/Auckland;
- UTC.

Include instants where these zones are on different calendar days.

### DST

Prove date derivation across:
- Europe/Prague spring-forward and fall-back boundaries;
- America/New_York or America/Los_Angeles spring/fall boundaries.

The test is for calendar-date determinism; Phase 1 does not manufacture nonexistent local clock times.

### Invalid configuration

Prove:
- valid IANA zone accepted;
- malformed/unknown zone rejected for saveable defaults;
- missing/blank persisted timezone does not produce Prague saveable default;
- display-only helper retains its existing resilient fallback behavior.

### Manual New Flight

Prove:
- default date follows configured timezone around UTC midnight;
- submitted explicit date remains unchanged;
- stored/edit date is not recalculated after timezone change;
- UTC time labels/values remain unchanged.

### Aircraft / rates

Prove:
- initial `valid_from` follows configured timezone;
- new rate default follows configured timezone;
- existing rate history dates do not move after timezone change;
- no module-scope `today` remains.

### GPS

Regression proof:
- `@/lib/kml` server path resolves timestamps through UTC `utcParts`;
- explicit offset timestamps normalize to UTC;
- ambiguous timestamp basis remains unavailable;
- no user timezone participates in GPS/FCL.050 timestamp conversion.

### Backup / restore

Prove or retain existing evidence that:
- timezone setting is serialized/restored as stored;
- flight/rate date-only values are preserved exactly;
- no backup/schema version changes are introduced.

## Milestones

### P1.0 — Discovery / semantic inventory — DONE

- reconstructed current `main`, ROADMAP, issue #144 and prior viewer-timezone Batch 7 behavior;
- mapped Manual flight, Aircraft/Rate, Quick Add, Settings, GPS UTC, backup/restore boundaries;
- identified the important distinction between presentation fallback and saveable-default authority.

### P1.1 — Contract freeze + independent review — ACTIVE

- review this contract with a second AI against the actual repository;
- resolve any correctness conflict before runtime changes;
- update ROADMAP if review changes scope/decisions.

### P1.2 — Strict calendar primitive + configuration boundary

Scope:
- pure date-in-zone helper;
- strict saveable-default timezone resolver;
- Settings write validation/error behavior;
- direct unit/source-contract tests.

No flight/aircraft consumer rewiring yet unless required to prove the primitive.

### P1.3 — Manual flight default

Scope:
- server-provided user-calendar default;
- remove UTC fallback as new-flight authority;
- preserve edit/stored date;
- verify UTC time semantics unchanged.

### P1.4 — Aircraft / rate defaults

Scope:
- remove both module-level Prague `today` constants;
- wire Aircraft Manager and Quick Add to the strict calendar context;
- preserve explicit date edits and stored rate history.

### P1.5 — GPS / backup invariance + closeout

Scope:
- prove GPS UTC path is unchanged/fail-closed;
- decide whether the dormant legacy Prague helper is safely retired or merely guarded;
- verify backup/restore/export invariance;
- exact candidate release verification;
- reconcile ROADMAP / FEATURES / CHANGELOG / DEVELOPMENT as applicable.

## Do not

- do not convert GPS/FCL.050 evidence to user-local time;
- do not reinterpret existing flight/rate dates when timezone changes;
- do not backfill historical rows;
- do not infer timezone from browser/device/IP when configured account state is invalid;
- do not silently repair malformed persisted timezone to Prague for saveable data;
- do not add a DB migration or backup-version bump without new evidence that persisted shape must change;
- do not start implementation before P1.1 review is reconciled.

## Acceptance

Phase 1 is complete only when:
- every saveable "today" default in scope is user-timezone-derived or explicitly unavailable;
- invalid persisted timezone cannot silently create a saveable date;
- Settings cannot persist a new invalid timezone;
- Manual flight UTC times and GPS/FCL.050 source evidence remain UTC;
- changing timezone does not mutate historical calendar dates;
- no unintended schema/backup-format change exists;
- midnight and DST tests pass;
- risk-scoped release verification passes on the exact candidate;
- ROADMAP / CHANGELOG / FEATURES / DEVELOPMENT are reconciled.
