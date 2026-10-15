# FlyTally Logbook — 2026-10-15 CZK historical-denomination production backfill

**Scope:** `flytally-logbook` only. **Status:** production executed; independent SQL postflight PASS; signed-in post-change browser smoke not yet independently run. No application code, schema registry, or Vercel deployment changes.

## Owner decision and narrowly scoped exception

On 15 October 2026 the product owner explicitly stated that **all existing historical aircraft prices, rate history and flight hourly rates were originally in CZK**, requested denomination for all historical records including protected/certified flights, and delegated technical execution. This is a new, narrowly scoped owner-approved historical correction, not an inference from locale, settings, or rate currency. It supersedes the earlier general no-direct-certified-UPDATE rule **only for this one executed currency-only maintenance transaction**. The D2 default remains binding for future/unattested records and other currencies. There were **four distinct user IDs** among the 315 active flights; this backfill records the product owner's global attestation rather than independent confirmation by each account holder.

## Source, rehearsal and checkpoint

- Target production Neon project `muddy-dust-14049657`, default/primary `br-raspy-fog-b1btvu5t`, database `neondb`, PostgreSQL 18.6. Target identified explicitly for every SQL call.
- The previous scoped owner-requested updates had already set `aircraft` 25/25 and `rates` 33/33 to CZK and updated 203 unlocked flights. These left **112 protected flights** without the new exact-money currency tuple (**110 certified**, **2 locked-only**).
- Immutable certification hash payload versions 1–8, per `lib/certification-integrity.ts`, do **not** include `price_per_hour` or its new currency tuple. Certified corrections through `startCertifiedCorrection` would supersede pending sharing/approval/verification and revoke public shares, so an R+ revision was deliberately not used.
- Rehearsal: isolated nonprimary PG18 Neon child `br-frosty-haze-b16x7r8y` (`ft-czk-protected-flight-backfill-rehearsal-20261015`), derived from live primary and tested with the same ordered transactional statements, **PASS**.
- Pre-change checkpoint retained: nonprimary **no-compute** branch `br-raspy-tooth-b13sqhpa` (`ft-czk-protected-flight-prechange-checkpoint-20261015`), confirmed READY. **Do not delete or restore** without new owner approval. This is same-provider protection, not independent off-Neon disaster recovery.

## Production execution — one atomic Neon SQL transaction

Strictly guarded statements on explicitly addressed primary/database:

1. Assert 315 flights, 112 protected legacy currency tuples, 110 certified, existing guard enabled, valid unmodified positive/zero legacy hourly prices representable to two decimals.
2. In transaction-scoped temporary table, preserve full `to_jsonb(flights)` for exactly the 112 protected rows.
3. Temporarily **DISABLE only** `trg_logbook_protect_locked_flight` within the transaction. **Keep** `trg_logbook_audit_flight_change`, all other triggers and constraints enabled.
4. Update **only** `price_currency_code='CZK'`, `price_currency_minor_units=2` and `price_per_hour_decimal=round(price_per_hour::numeric,2)` on matching, protected legacy rows. Do not alter legacy `price_per_hour`, flight data, `record_revision`, `certification_hash`, `certified_at`, `locked_at`, approval/sharing/verification tables or certified revision/archive tables.
5. **ENABLE** `trg_logbook_protect_locked_flight` before transaction completion.
6. Assert exactly 112 resulting rows have CZK tuples and identical whole-row JSON once precisely those three money fields are removed; guard is enabled.
7. In the same transaction write 112 distinct owner-directed `audit_log` events, `action='historical_currency_attested'`, `actor='system:owner-directed-currency-backfill-20261015'`, linked by affected flight user/id with original amount/currency, chosen denomination, source reason, original hash and revision. The existing `flight_audit_log` trigger also captured complete before/after row images. **Note:** its existing generic `actor_user_id` implementation records the account user ID for ordinary updates, not the administrator/system who executed this maintenance operation; use the explicitly attributed `audit_log` event to interpret the provenance.
8. Assert all flights 315/315, rates 33/33 and aircraft 25/25 now have CZK; certification and lock counts 110 and 112. Commit atomically; if any assertion fails, whole transaction rolls back including trigger state.

No historic amount conversion, FX, rounding of the original `double precision` price, recertification, new signatures, existing certification-hash change, new revision or schema version change.

## Independent production postflight — PASS

A separate read-only Neon query **after** the committed transaction confirmed:

| Check | Result |
| --- | --- |
| Aircraft CZK / total | 25 / 25 |
| Historical rates CZK / total | 33 / 33 |
| Flights CZK and decimal parity / total | 315 / 315 |
| Remaining active flight currency unknown | 0 |
| Currently certified active flights | 110 (preserved) |
| Currently locked active flights | 112 (preserved) |
| New explicitly attributed audit events | 112 |
| Corresponding flight-audit before/after images identical outside exactly three currency fields | 112 / 112 |
| `trg_logbook_protect_locked_flight` | `O` (enabled) |

This covers **active** `flights` rows. It does **not** rewrite snapshots already stored in `flight_certified_revisions`, `voided_certified_flights`, Trash or external v13 backup files. Those preserved historical artefacts may retain their original unknown-denomination tuple; do not silently reinterpret them. No full-suite/typecheck/build/Playwright rerun was required or performed, since app source code was unchanged. Post-change signed-in UI refresh remains owner verification. No separate Vercel deploy or DB schema migration.

## Follow-up / risk

- Confirm UI refresh of a previously protected certified flight shows CZK on flight detail and list.
- Prior account-owners' independent denomination evidence was not separately collected (four affected users; product-owner attestation was global). Future historical corrections must follow D2's individual attributable attestation semantics.
- Same-provider checkpoint is retained; independent off-Neon recovery remains unproven.
- Do not automatically recertify, bulk-adjust certified revisions, deactivate audit/guard triggers, change source values or set default CZK for new historical/unknown entries.
