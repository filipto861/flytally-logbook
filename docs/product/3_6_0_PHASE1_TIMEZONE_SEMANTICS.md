# FlyTally 3.6.0 — Phase 1 saved-date / timezone semantics

Status: **DONE / VERIFIED — MERGED · 3.6.0 PRODUCTION CLOSEOUT PENDING**  
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
- in-scope date inputs are string-backed `YYYY-MM-DD` controls; the audited Manual Flight / Aircraft / Quick Add paths do not round-trip those saved date-only values through JavaScript `Date` objects.
- rate selection is date-only: `lib/rate-history.ts` compares ISO date strings lexically and SQL compares stored date/date-text values directly; no user-timezone conversion is involved.
- CSV/XLS/print paths preserve flight calendar dates as stored strings; the print route reformats the string directly rather than converting it through a timezone.
- the runtime GPS dependency audit found:
  - `app/(protected)/flights/actions.ts` imports `localParts` from `@/lib/kml`, therefore receiving the explicit `utcParts` override;
  - `lib/data/flight-track-review.ts` does the same;
  - `components/kml-import-form.tsx` imports track-processing algorithms directly but imports `utcParts` explicitly from `lib/track-time.ts`;
  - no active runtime consumer found in this audit imports the legacy Prague `track-processing.localParts()` as timestamp authority.
- an adjacent, out-of-scope audit finding exists: credential/recency/print status logic still contains UTC/database-current-date `today` semantics. Those paths do not create the saveable defaults named by issue #144 and will be tracked separately rather than silently expanding Phase 1.

## Frozen semantic contract

### 1. Configured timezone is the authority for future saveable defaults

A new saveable calendar-date default is derived from:
- the current instant; and
- the signed-in user's valid configured IANA timezone.

The result is an exact `YYYY-MM-DD` calendar date.

The server/device host timezone is never authority.

### 2. Saveable defaults fail closed on invalid persisted configuration

The existing presentation helper may continue to fall back to Prague.

Saveable-default authority uses this explicit result contract:

```ts
type SaveableCalendarDefault =
  | {status:"resolved";timeZone:string;date:string}
  | {status:"needs_configuration";reason:"missing"|"blank"|"invalid"}
  | {status:"unavailable";reason:"read_failed"};
```

Rules:
- `resolved` carries the validated configured timezone and exact `YYYY-MM-DD` default;
- missing, blank or invalid persisted configuration is `needs_configuration`;
- a settings/data read failure is `unavailable`, not a guessed fallback;
- neither failure branch may fabricate Prague, UTC, browser-local or server-local "today".

UI behavior is also frozen:
- the date default is empty/unavailable rather than invented;
- show a controlled **Needs configuration** or temporarily-unavailable message;
- provide a Settings path when configuration is the cause;
- a visible date input remains editable;
- a valid explicit user-entered calendar date may still be saved when the workflow does not otherwise require timezone authority;
- no workflow silently repairs the stored timezone.

This keeps invalid persisted configuration explicit and prevents a plausible but wrong date from being saved.

### 3. Timezone writes are validated at the server write boundary

Settings must validate timezone on the server before persistence. Client validation may improve UX but is never the authority.

Accepted configuration:
- a non-empty named timezone accepted by the deployed JavaScript runtime through `Intl.DateTimeFormat(...,{timeZone})`;
- `UTC` is valid;
- runtime-recognized named aliases are acceptable;
- raw numeric offset strings such as `+02:00` or `-0500` are rejected as account timezone identifiers because they are not DST-aware account zones.

The validator does not require `Intl.supportedValuesOf("timeZone")` membership, because runtime-recognized aliases may be valid even when they are not listed as primary identifiers.

Invalid timezone input must:
- not be persisted;
- return a typed/user-readable Settings error;
- preserve the existing persisted settings row;
- never expose a raw runtime/Intl error.

The normal product default remains `Europe/Prague` for newly created accounts, which are already initialized with that value. Existing invalid persisted values are not silently repaired; saveable defaults fail closed until the user saves a valid timezone.

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

The default must be computed from a current instant for the relevant user context.

Form-session rule:
- once a form renders a resolved default, that value is stable for that mounted form session;
- once the pilot edits the date, the explicit value wins;
- crossing midnight does not silently roll an open form to another date;
- changing timezone in another tab does not mutate an already-open form;
- a form opened in `needs_configuration` / `unavailable` does not silently gain a derived date on focus;
- a fresh mount or explicit user reset may derive a fresh default from current configuration and current instant.

This avoids background mutation of an in-progress draft.

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

Frozen restore invariant:

> Restoring data while the destination account is configured for a different timezone must preserve every restored `flights.date` and `rates.valid_from` value exactly. Restore must not derive, shift or reinterpret those date-only values from either the source or destination timezone.

## Independent review reconciliation

The external reviewer returned **APPROVE WITH CHANGES** and correctly confirmed the four-domain semantic model, fail-closed saveable defaults, future-only timezone effect, UTC GPS evidence and no-backfill/no-schema-change direction. filecite cannot be embedded in repository docs; the review artifact remains conversation evidence.

Accepted required changes:
- exact resolver union and UI behavior;
- server write-boundary timezone validation;
- explicit runtime dependency audit for legacy `localParts`;
- byte-exact cross-timezone restore invariant;
- mounted-form semantics across midnight/timezone changes;
- explicit server-provided replacement for FlightForm's UTC fallback.

Repository-specific corrections/clarifications:
- `Intl.supportedValuesOf("timeZone")` is not required for authority; runtime `Intl.DateTimeFormat` acceptance plus raw-offset rejection is the frozen validator contract.
- the production-impact census is a **pre-release P1.5 gate**, not a blocker to implementing/verifying the P1.2 primitive.
- adjacent credential/recency "today" semantics are real but outside issue #144 and must be tracked separately rather than silently expanding this release.

## Proposed implementation boundary

A strict shared calendar utility owns deterministic calendar-date derivation from an instant plus a validated named timezone. It is pure/testable with an injected instant.

A separate server-side user-calendar resolver returns the frozen `SaveableCalendarDefault` union above.

Do **not** reuse the presentation-resilient `getUserTimezone()` fallback as saveable-default authority.

The runtime boundary is explicit:
- server/pages derive the saveable default once;
- client form components receive that result/value as input;
- client components do not independently call `new Date()` to invent another authority;
- save actions validate submitted date strings but do not recalculate "today".

Target wiring:

- Manual New Flight defaults:
  server resolves strict user calendar context and provides date to the form.

- FlightForm:
  remove the independent UTC-date fallback as authority for a missing new-flight date. The New Flight page supplies the server-derived default/result; Edit mode keeps the stored date. If no resolved default exists, the field starts empty and remains manually editable.

- Aircraft & rates:
  pass strict user-calendar default/result from the authenticated server page rather than using a module-level Prague constant. Visible `Valid from` inputs may remain manually editable when the default is unavailable.

- Quick Add Aircraft:
  use the same server-derived strict calendar result; no hidden Prague/UTC/browser-local date. If an hourly rate is entered while no valid effective date is available/submitted, the server must reject that rate-bearing save with a controlled message rather than silently dropping the rate. Saving an aircraft without an initial hourly rate remains allowed.

- Settings:
  validate timezone before persistence and expose a controlled error state.

## UI fail-closed behavior

When timezone configuration is unavailable/invalid on a path that needs a saveable date default:
- do not invent a date;
- show **Needs configuration**;
- link/direct the user to Settings;
- keep any explicit date field editable where safe;
- no duplicate submit or silent repair.

An explicitly entered valid date may still be saved where the underlying workflow does not otherwise depend on timezone authority. The default itself remains unavailable until configuration is valid.

Settings invalid-timezone UX must be action-state/result driven rather than a raw thrown error. Other field changes are not partially persisted when timezone validation fails.

## Test matrix

### Pure date derivation

Use deterministic instants and expected dates for at least:
- Europe/Prague;
- America/Los_Angeles;
- Pacific/Auckland;
- UTC;
- Asia/Kathmandu;
- Australia/Lord_Howe.

Include instants where these zones are on different calendar days.

### DST

Prove date derivation across:
- Europe/Prague spring-forward and fall-back boundaries;
- America/New_York or America/Los_Angeles spring/fall boundaries.

The test is for calendar-date determinism; Phase 1 does not manufacture nonexistent local clock times.

### Invalid configuration

Prove:
- valid named runtime timezone accepted, including `UTC`;
- runtime-recognized alias behavior is deterministic;
- malformed/unknown zone rejected for saveable defaults;
- raw offset strings such as `+02:00` are rejected as account timezone identifiers;
- missing/blank persisted timezone does not produce Prague saveable default;
- read failure produces `unavailable`, not `needs_configuration` or a guessed date;
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

### Backup / restore / export

Prove or retain existing evidence that:
- timezone setting is serialized/restored as stored;
- restoring across different source/destination timezone settings preserves `flights.date` and `rates.valid_from` byte-for-byte;
- CSV/XLS/print surfaces preserve date-only values without timezone conversion;
- rate selection remains date-only and does not round-trip `valid_from` / `flight.date` through JavaScript `Date`;
- no backup/schema version changes are introduced.

## Milestones

### P1.0 — Discovery / semantic inventory — DONE

- reconstructed current `main`, ROADMAP, issue #144 and prior viewer-timezone Batch 7 behavior;
- mapped Manual flight, Aircraft/Rate, Quick Add, Settings, GPS UTC, backup/restore boundaries;
- identified the important distinction between presentation fallback and saveable-default authority.

### P1.1 — Contract freeze + independent review — DONE / REVIEW RECONCILED

Independent review verdict: **APPROVE WITH CHANGES**.

Reconciliation against the actual repository:
- accepted the request for an explicit resolver/result contract;
- accepted server-boundary timezone validation and explicit offset-string rejection;
- completed the runtime `localParts` / `utcParts` dependency audit described above;
- added exact cross-timezone backup/restore invariance;
- froze mounted-form behavior across midnight/timezone changes;
- froze the FlightForm replacement path as server-provided default/result with no client UTC fallback;
- verified in-scope date inputs, rate comparison and export/print paths do not require timezone conversion;
- identified adjacent recency/credential/print "today" semantics as a separate scope item rather than expanding issue #144.

The reviewer could not access the private repository directly; repository-specific findings above were therefore re-verified against the actual repo before acceptance.

### P1.2 — Strict calendar primitive + configuration boundary — DONE / VERIFIED

Delivered through PR #259 and merged to canonical `main` as `445454b73bfad305264ed10ce74bc02335474c8c`:
- added `lib/calendar-date.ts` with strict named-timezone validation and deterministic `YYYY-MM-DD` derivation from an injected instant;
- added `lib/data/user-calendar.ts` with the frozen `resolved / needs_configuration / unavailable` result contract and injectable reader for deterministic tests;
- kept display-only `getUserTimezone()` fallback unchanged and separate;
- Settings account writes validate timezone before the transaction and surface a controlled field error instead of persisting an invalid/offset timezone;
- invalid timezone blocks the whole account-settings transaction, so unrelated field edits cannot partially persist;
- development ownership registry explicitly owns the two new runtime files;
- focused unit/source-contract coverage proves UTC/Prague/Los Angeles/Auckland/Kathmandu/Lord Howe, DST boundaries, aliases, raw offsets, invalid/missing/blank/read-failure states and authority separation;
- authoritative Settings browser acceptance proves invalid timezone blocks the transaction and preserves previously persisted account values.

Exact release evidence on implementation head `c38ac15a673f770c2ae8cd13a4b02a32c70188dd`, candidate `b8520903792d8af18f502469b028b3ab59c9c098bb47bf5bcbd42e5021fc13b5`:
- source PASS;
- TypeScript PASS;
- aggregate **1419/1419 PASS**;
- build **41/41 PASS**;
- PostgreSQL **99/99 PASS**;
- browser-risk **10/10 PASS** (5 desktop + 5 mobile, one worker);
- domain/scale N/A;
- required evidence satisfied; blocked evidence none.

No Manual Flight, Aircraft Manager, Quick Add or GPS consumer rewiring was included in P1.2.

### P1.3 — Manual flight default — DONE / VERIFIED

Delivered through PR #261 and merged to canonical `main` as `12b31ba6d837bdda17ae9e3d676ed9261ef816c7`:
- New Flight resolves the strict saveable-calendar result server-side;
- `FlightForm` receives the result explicitly;
- hard-coded Prague date generation is removed from `getManualEntryDefaults()`;
- client UTC `toISOString().slice(0,10)` is removed as new-flight authority;
- resolved default is stable for the mounted form while explicit pilot edits remain authoritative;
- Edit continues to initialize from the stored date;
- unresolved/invalid configuration fails closed to an empty editable date with controlled guidance;
- UTC flight-time labels, parsing and certification semantics are unchanged.

Exact release evidence on implementation head `99babf404656f02cd3a07dcb53636a37d0eae9d5`, candidate `fa17f53001d3691fd510fa1b00049d47935e8b4cf39400b82c27ed38642a6b11`:
- source PASS (reused);
- domain PASS (reused);
- TypeScript PASS (reused);
- aggregate **1421/1421 PASS**;
- build **41/41 PASS**;
- PostgreSQL **99/99 PASS**;
- browser-risk **10/10 PASS** (5 desktop + 5 mobile, one worker);
- scale N/A;
- required evidence satisfied; blocked evidence none.

### P1.4 — Aircraft / rate defaults — DONE / VERIFIED

Delivered through PR #263 and merged to canonical `main` as `7920164f2e461cacbd99279488cc092ad3fc4674`:
- Aircraft & Airports resolves `getUserSaveableCalendarDefault(userId)` server-side and passes the result to Aircraft Manager;
- New Flight reuses the already-resolved strict calendar result for Quick Add;
- Aircraft Manager and Quick Add contain no module-level Prague/UTC/browser-local `today` authority;
- resolved date initializes new `initial_valid_from` and new rate-history `valid_from`;
- visible Aircraft Manager dates remain manually editable when automatic derivation is unavailable;
- Quick Add unresolved state submits an empty effective date rather than guessing;
- `initialRateDateError()` rejects a positive initial hourly rate without a valid explicit effective date before persistence;
- no-rate aircraft creation remains allowed;
- historical rate rows are not rewritten or reinterpreted after timezone changes;
- rate lookup remains date-only;
- development registry ownership for `app/(protected)/database/` was corrected to `aircraft-airports`; browser target ownership is explicit and PostgreSQL acceptance remains required for persistence risk.

Exact release evidence on implementation head `4caaae0e4e917f3d20f31db18096b1c953ff5559`, candidate `a67621e0618d2a847fef597f34ea7bf093781f572e4e55854f1ae1a6d3fdf952`:
- source PASS (reused);
- domain PASS (reused);
- TypeScript PASS (reused);
- aggregate **1427/1427 PASS**;
- build **41/41 PASS**;
- PostgreSQL **99/99 PASS**;
- browser-risk **10/10 PASS** (5 desktop + 5 mobile, one worker);
- scale N/A;
- required evidence satisfied; blocked evidence none.

### P1.5 — GPS / backup invariance + closeout — DONE / VERIFIED

Repository evidence:
- `lib/kml.ts` explicitly overrides the legacy `localParts` name with `utcParts` for server logbook consumers;
- current audited server GPS save/review consumers import that name from `@/lib/kml`, not directly from `track-processing`;
- client GPS review imports `utcParts` from `track-time`;
- explicit source offsets can cross a UTC calendar boundary deterministically; timezone-less timestamps remain ambiguous/unavailable;
- the Prague `track-processing.localParts` helper remains dormant and is retained for backward compatibility in 3.6.0 because this milestone did not establish exhaustive repo-wide proof that deletion is a no-op. It is not a permitted timestamp authority for GPS/FCL.050;
- account backup reads flights/rates/settings as stored rows, and exact restore uses PostgreSQL record population for those rows without timezone conversion;
- independent review found no semantic blocker; its one substantive verification concern was accepted: P1.5 now also includes PostgreSQL-backed evidence that `json_populate_record` preserves the literal date-only values across materially different session time zones. The review's legacy-helper naming and export `date::text` suggestions remain optional hardening, not Phase 1 blockers;
- portable backup parsing/restore keys keep flight/rate dates as literal `YYYY-MM-DD` strings;
- CSV/XLS and print consume stored flight dates as date-only values and filter using `date::text`; UTC `new Date().toISOString()` in export remains filename metadata only;
- historical rate selection compares validated ISO calendar strings and never converts `valid_from` or the flight date into a local instant.

Production timezone census — **PASS at the observed 8 October 2026 snapshot**:
- total users: 5;
- users with settings: 5;
- missing settings: 0;
- NULL timezone: 0;
- blank timezone: 0;
- `Europe/Prague`: 5;
- invalid timezone values under the same runtime semantics as `normalizeSaveableTimeZone`: 0.

The census was read-only, aggregate/grouped, executed with Node 24 against the production database, emitted no user-identifying rows, and the temporary non-persistent execution environment was stopped afterwards. This proves the observed production snapshot is compatible with fail-closed saveable-date behavior; it is not a guarantee about future rows.

Evidence-only repository changes add focused GPS/date-boundary, portable-backup, date-only rate and source-authority regressions. No product runtime behavior, schema, historical rows or portable-backup version are changed.

Exact candidate `bd04725222af573ca986239dc168383a39e6c9da3809f8c8edd69dc51f78f988` on exact head `56e3b05620ee4c35693994e1e60276387a41fe97` is VERIFIED. Targeted P1.5 tests passed **38/38**; TypeScript passed; the planner selected aggregate full-tests and PostgreSQL acceptance with no blocked evidence; `verify:iterate` passed; final `verify:release:risk` passed aggregate regression **1433/1433** and PostgreSQL **100/100**, including the dedicated `json_populate_record` date-only invariance test under Pacific/Auckland and America/Los_Angeles session time zones. Build, scale and browser were correctly N/A. Required `postgres-acceptance` is satisfied and blocked evidence is none.

Phase 1 acceptance is satisfied on that exact candidate. FEATURES was reconciled to the delivered capability and DEVELOPMENT was reviewed with no change required. Final documentation-only candidate `89514f05c9d1372b41c9d201e8935bd77e1cfdb78c01860714e8127e541be0ee` also returned `release_status=PASS` with all runtime/heavy gates correctly N/A. PR #265 squash-merged to `main` as `d96aed69b9fee41550820a1d05666420bce4e9fb`. The remaining release-level work is the explicit `3.6.0` package/footer candidate, production deployment acceptance, smoke/error review and final production-closeout documentation.

## Do not

- do not convert GPS/FCL.050 evidence to user-local time;
- do not reinterpret existing flight/rate dates when timezone changes;
- do not backfill historical rows;
- do not infer timezone from browser/device/IP when configured account state is invalid;
- do not silently repair malformed persisted timezone to Prague for saveable data;
- do not add a DB migration or backup-version bump without new evidence that persisted shape must change;
- do not broaden issue #144 into unrelated credential/recency current-date behavior; track adjacent findings separately.
- do not ship fail-closed behavior without production timezone-value census evidence.
- do not implement consumer rewiring before the P1.2 primitive/configuration boundary is verified.

## Acceptance

Phase 1 is complete only when:
- every saveable "today" default in scope is user-timezone-derived or explicitly unavailable;
- invalid persisted timezone cannot silently create a saveable date;
- Settings cannot persist a new invalid timezone;
- Manual flight UTC times and GPS/FCL.050 source evidence remain UTC;
- changing timezone does not mutate historical calendar dates;
- no unintended schema/backup-format change exists;
- midnight, DST and non-whole-hour-zone tests pass;
- production timezone-value census is recorded before release;
- risk-scoped release verification passes on the exact candidate;
- ROADMAP / CHANGELOG / FEATURES / DEVELOPMENT are reconciled.
