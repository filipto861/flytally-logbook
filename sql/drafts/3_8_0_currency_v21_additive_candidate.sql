-- FlyTally Logbook 3.8.0 M2-A-0 — REVIEW CANDIDATE ONLY.
-- DO NOT EXECUTE AGAINST A REMOTE DATABASE.
-- DO NOT register this file in lib/migration-plan.ts / lib/db-optimization.ts.
-- Exact currency source verification, PostgreSQL fixture tests, backup/restore,
-- certified/void source tests, and deployment target verification are pending.
--
-- Preconditions: an isolated PostgreSQL database initialized at schema v20.
-- No changes to legacy numeric columns, saved prices, certification or archives.
-- Using unbounded NUMERIC here is a candidate to avoid implicit rate quantization;
-- future writers MUST validate allowed decimal precision/range and serialize as strings.
-- No FX, default currency inference or historic backfill.

BEGIN;

ALTER TABLE rates
  ADD COLUMN IF NOT EXISTS currency_code TEXT,
  ADD COLUMN IF NOT EXISTS currency_minor_units SMALLINT,
  ADD COLUMN IF NOT EXISTS price_per_hour_decimal NUMERIC,
  ADD COLUMN IF NOT EXISTS dry_price_per_hour_decimal NUMERIC;

ALTER TABLE aircraft
  ADD COLUMN IF NOT EXISTS default_price_currency_code TEXT,
  ADD COLUMN IF NOT EXISTS default_price_currency_minor_units SMALLINT,
  ADD COLUMN IF NOT EXISTS default_price_per_hour_decimal NUMERIC;

ALTER TABLE flights
  ADD COLUMN IF NOT EXISTS price_currency_code TEXT,
  ADD COLUMN IF NOT EXISTS price_currency_minor_units SMALLINT,
  ADD COLUMN IF NOT EXISTS price_per_hour_decimal NUMERIC;

ALTER TABLE flight_expenses
  ADD COLUMN IF NOT EXISTS amount_encoding TEXT,
  ADD COLUMN IF NOT EXISTS amount_minor_units SMALLINT;

-- Each future canonical exact rate must have a currency, its source exponent
-- and an exact wet rate together. The optional dry price shares that rate's
-- currency, pending a separately approved multi-denomination rate feature.
DO $currency$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'rates'::regclass AND conname = 'rates_exact_currency_tuple_v21_check'
  ) THEN
    ALTER TABLE rates ADD CONSTRAINT rates_exact_currency_tuple_v21_check CHECK (
      (
        currency_code IS NULL AND currency_minor_units IS NULL
        AND price_per_hour_decimal IS NULL AND dry_price_per_hour_decimal IS NULL
      ) OR (
        currency_code IS NOT NULL AND currency_code ~ '^[A-Z]{3}$'
        AND currency_minor_units IS NOT NULL AND currency_minor_units BETWEEN 0 AND 9
        AND price_per_hour_decimal IS NOT NULL AND price_per_hour_decimal > 0
        AND price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
        AND (
          dry_price_per_hour_decimal IS NULL OR (
            dry_price_per_hour_decimal >= 0
            AND dry_price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
          )
        )
      )
    );
  END IF;
END;
$currency$;

DO $currency$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'aircraft'::regclass AND conname = 'aircraft_exact_currency_tuple_v21_check'
  ) THEN
    ALTER TABLE aircraft ADD CONSTRAINT aircraft_exact_currency_tuple_v21_check CHECK (
      (
        default_price_currency_code IS NULL
        AND default_price_currency_minor_units IS NULL
        AND default_price_per_hour_decimal IS NULL
      ) OR (
        default_price_currency_code IS NOT NULL AND default_price_currency_code ~ '^[A-Z]{3}$'
        AND default_price_currency_minor_units IS NOT NULL AND default_price_currency_minor_units BETWEEN 0 AND 9
        AND default_price_per_hour_decimal IS NOT NULL AND default_price_per_hour_decimal >= 0
        AND default_price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
      )
    );
  END IF;
END;
$currency$;

DO $currency$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'flights'::regclass AND conname = 'flights_exact_currency_tuple_v21_check'
  ) THEN
    ALTER TABLE flights ADD CONSTRAINT flights_exact_currency_tuple_v21_check CHECK (
      (
        price_currency_code IS NULL AND price_currency_minor_units IS NULL
        AND price_per_hour_decimal IS NULL
      ) OR (
        price_currency_code IS NOT NULL AND price_currency_code ~ '^[A-Z]{3}$'
        AND price_currency_minor_units IS NOT NULL AND price_currency_minor_units BETWEEN 0 AND 9
        AND price_per_hour_decimal IS NOT NULL AND price_per_hour_decimal >= 0
        AND price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
      )
    );
  END IF;
END;
$currency$;

-- NULL + NULL = legacy 2-decimal input encoding, NOT unknown source currency.
-- New writes MUST use explicit amount_encoding='iso_minor_units' with a
-- source-backed exponent. PostgreSQL cannot validate ISO membership.
DO $currency$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'flight_expenses'::regclass AND conname = 'expenses_amount_encoding_v21_check'
  ) THEN
    ALTER TABLE flight_expenses ADD CONSTRAINT expenses_amount_encoding_v21_check CHECK (
      COALESCE(
        (amount_encoding IS NULL AND amount_minor_units IS NULL)
        OR (amount_encoding = 'legacy_two_decimal' AND amount_minor_units = 2)
        OR (amount_encoding = 'iso_minor_units' AND amount_minor_units IS NOT NULL AND amount_minor_units BETWEEN 0 AND 9),
        FALSE
      )
    );
  END IF;
END;
$currency$;

-- No INSERT / UPDATE / DELETE, no user-derived defaults and no migration-table
-- registration in this isolated SQL candidate.
COMMIT;
