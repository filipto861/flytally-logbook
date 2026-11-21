\set ON_ERROR_STOP on
\pset pager off
\if :{?expected_database}
\else
  \echo 'Required -v expected_database=... is missing. STOP.'
  SELECT 1/0; -- ON_ERROR_STOP must terminate with a non-zero exit
\endif

-- EXECUTION-GRADE DESIGN - NOT YET AUTHORIZED ON NEON. Run only after explicit
-- production target, fresh-snapshot and full acceptance owner approval.
-- New names/definitions source-identical to review draft; no legacy backfill.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;
SELECT set_config('flytally.expected_database', :'expected_database',true);
SELECT pg_advisory_xact_lock(704190104);
DO $v380$
DECLARE
  expected_names text[] := ARRAY[
    'flight audit and locking',
    'backups and recoverable trash',
    'core query indexes',
    'restore and route performance indexes',
    'EASA FCL.050 flight logbook fields',
    'FCL.050 structured aircraft, FSTD and certification',
    'certified flight correction revisions',
    'certified FSTD correction revisions',
    'private beta authentication foundation',
    'private pilot connections',
    'instructor flight approvals',
    'shared flight participation',
    'crew connections and verified approvals',
    'user-owned structured flight expenses',
    'Safety Pilot connected PIC collaboration',
    'general PIC invitation provenance',
    'historical flight aircraft identity preservation',
    'aircraft default operation type',
    'aircraft default engine type',
    'certified flight void archive and provenance'
  ];
  actual_name text;
  v integer;
BEGIN
  IF current_database() IS DISTINCT FROM current_setting('flytally.expected_database',true) THEN
    RAISE EXCEPTION 'v21: wrong database target';
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION 'v21: cannot migrate a recovery replica';
  END IF;
  IF to_regclass('public.flytally_schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'v21: migration registry absent';
  END IF;
  FOR v IN 1..20 LOOP
    SELECT name INTO actual_name FROM public.flytally_schema_migrations WHERE version=v;
    IF actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION 'v21: registry name drift at version %',v;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>20
    OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>20) THEN
    RAISE EXCEPTION 'v21: registry must be exactly 1 through 20';
  END IF;
  IF NOT (to_regclass('public.rates') IS NOT NULL AND
      to_regclass('public.aircraft') IS NOT NULL AND
      to_regclass('public.flights') IS NOT NULL AND
      to_regclass('public.flight_expenses') IS NOT NULL) THEN
    RAISE EXCEPTION 'v21: required monetary table missing';
  END IF;
  IF to_regclass('public.voided_certified_flights') IS NULL
    OR to_regclass('public.flight_source_provenance') IS NULL
    OR to_regprocedure('public.logbook_protect_locked_flight()') IS NULL
    OR to_regprocedure('public.logbook_protect_source_provenance()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
      AND tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal)
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
      AND tgname='trg_logbook_prevent_voided_flight_id_reuse' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'v21: required v20 protected history or triggers missing';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND (
      (table_name='rates' AND column_name='currency_code')
      OR (table_name='rates' AND column_name='currency_minor_units')
      OR (table_name='rates' AND column_name='price_per_hour_decimal')
      OR (table_name='rates' AND column_name='dry_price_per_hour_decimal')
      OR (table_name='aircraft' AND column_name='default_price_currency_code')
      OR (table_name='aircraft' AND column_name='default_price_currency_minor_units')
      OR (table_name='aircraft' AND column_name='default_price_per_hour_decimal')
      OR (table_name='flights' AND column_name='price_currency_code')
      OR (table_name='flights' AND column_name='price_currency_minor_units')
      OR (table_name='flights' AND column_name='price_per_hour_decimal')
      OR (table_name='flight_expenses' AND column_name='amount_encoding')
      OR (table_name='flight_expenses' AND column_name='amount_minor_units')
    )
  ) THEN
    RAISE EXCEPTION 'v21: partial or existing monetary columns - fail closed';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND c.conname IN ('rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check','flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check')
  ) THEN
    RAISE EXCEPTION 'v21: partial or existing CHECK constraints - fail closed';
  END IF;
END;
$v380$;

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

INSERT INTO public.flytally_schema_migrations(version,name)
VALUES(21,'source-backed currency exact-money');
DO $v380$
DECLARE
  expected_names text[] := ARRAY[
    'flight audit and locking',
    'backups and recoverable trash',
    'core query indexes',
    'restore and route performance indexes',
    'EASA FCL.050 flight logbook fields',
    'FCL.050 structured aircraft, FSTD and certification',
    'certified flight correction revisions',
    'certified FSTD correction revisions',
    'private beta authentication foundation',
    'private pilot connections',
    'instructor flight approvals',
    'shared flight participation',
    'crew connections and verified approvals',
    'user-owned structured flight expenses',
    'Safety Pilot connected PIC collaboration',
    'general PIC invitation provenance',
    'historical flight aircraft identity preservation',
    'aircraft default operation type',
    'aircraft default engine type',
    'certified flight void archive and provenance'
  ];
  actual_name text;
  v integer;
  matching_columns integer;
  matching_checks integer;
BEGIN
  IF current_database() IS DISTINCT FROM current_setting('flytally.expected_database',true) THEN
    RAISE EXCEPTION 'v21 postflight: wrong database target';
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION 'v21 postflight: recovery replica';
  END IF;
  FOR v IN 1..20 LOOP
    SELECT name INTO actual_name FROM public.flytally_schema_migrations WHERE version=v;
    IF actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION 'v21 postflight: old migration drift at version %',v;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>21
    OR (SELECT name FROM public.flytally_schema_migrations WHERE version=21)
      IS DISTINCT FROM 'source-backed currency exact-money' THEN
    RAISE EXCEPTION 'v21 postflight: registry not exactly 1..21';
  END IF;
  SELECT COUNT(*) INTO matching_columns FROM information_schema.columns
    WHERE table_schema='public' AND is_nullable='YES' AND column_default IS NULL AND (
      (table_name='rates' AND column_name='currency_code' AND data_type='text')
        OR (table_name='rates' AND column_name='currency_minor_units' AND data_type='smallint')
        OR (table_name='rates' AND column_name='price_per_hour_decimal' AND data_type='numeric')
        OR (table_name='rates' AND column_name='dry_price_per_hour_decimal' AND data_type='numeric')
        OR (table_name='aircraft' AND column_name='default_price_currency_code' AND data_type='text')
        OR (table_name='aircraft' AND column_name='default_price_currency_minor_units' AND data_type='smallint')
        OR (table_name='aircraft' AND column_name='default_price_per_hour_decimal' AND data_type='numeric')
        OR (table_name='flights' AND column_name='price_currency_code' AND data_type='text')
        OR (table_name='flights' AND column_name='price_currency_minor_units' AND data_type='smallint')
        OR (table_name='flights' AND column_name='price_per_hour_decimal' AND data_type='numeric')
        OR (table_name='flight_expenses' AND column_name='amount_encoding' AND data_type='text')
        OR (table_name='flight_expenses' AND column_name='amount_minor_units' AND data_type='smallint')
    );
  IF matching_columns<>12 THEN
    RAISE EXCEPTION 'v21 postflight: expected 12 nullable, no-default correctly typed columns, found %',matching_columns;
  END IF;
  SELECT COUNT(*) INTO matching_checks FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND c.contype='c' AND c.convalidated AND (
      (t.relname='rates' AND c.conname='rates_exact_currency_tuple_v21_check')
        OR (t.relname='aircraft' AND c.conname='aircraft_exact_currency_tuple_v21_check')
        OR (t.relname='flights' AND c.conname='flights_exact_currency_tuple_v21_check')
        OR (t.relname='flight_expenses' AND c.conname='expenses_amount_encoding_v21_check')
    );
  IF matching_checks<>4 THEN
    RAISE EXCEPTION 'v21 postflight: expected 4 validated CHECKs, found %',matching_checks;
  END IF;
  IF EXISTS(SELECT 1 FROM public.rates WHERE currency_code IS NOT NULL OR currency_minor_units IS NOT NULL
    OR price_per_hour_decimal IS NOT NULL OR dry_price_per_hour_decimal IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.aircraft WHERE default_price_currency_code IS NOT NULL
    OR default_price_currency_minor_units IS NOT NULL OR default_price_per_hour_decimal IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.flights WHERE price_currency_code IS NOT NULL
    OR price_currency_minor_units IS NOT NULL OR price_per_hour_decimal IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.flight_expenses WHERE amount_encoding IS NOT NULL
    OR amount_minor_units IS NOT NULL) THEN
    RAISE EXCEPTION 'v21 postflight: historical rows unexpectedly populated';
  END IF;
  IF to_regclass('public.voided_certified_flights') IS NULL
    OR to_regclass('public.flight_source_provenance') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
      AND tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal)
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
      AND tgname='trg_logbook_prevent_voided_flight_id_reuse' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'v21 postflight: v20 protection missing';
  END IF;
END;
$v380$;
COMMIT;
