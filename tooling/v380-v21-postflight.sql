\set ON_ERROR_STOP on
\pset pager off
\if :{?expected_database}
\else
  \echo 'Required -v expected_database=... is missing. STOP.'
  SELECT 1/0; -- ON_ERROR_STOP must terminate with a non-zero exit
\endif

-- READ ONLY. Must run immediately after migration and before new v21 writes.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=public,pg_catalog;
SELECT set_config('flytally.expected_database', :'expected_database',true);
SELECT current_database() AS db,current_user AS db_user,pg_is_in_recovery() AS replica,now() AS observed_at;
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
SELECT (SELECT COUNT(*) FROM public.rates) rates,(SELECT COUNT(*) FROM public.aircraft) aircraft,
 (SELECT COUNT(*) FROM public.flights) flights,(SELECT COUNT(*) FROM public.flight_expenses) expenses,
 (SELECT COUNT(*) FROM public.voided_certified_flights) voided,
 (SELECT COUNT(*) FROM public.flight_source_provenance) provenance,
 (SELECT COUNT(*) FROM public.account_backups) backups;
ROLLBACK;
