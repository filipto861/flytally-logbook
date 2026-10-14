\set ON_ERROR_STOP on
\pset pager off
\if :{?expected_database}
\else
  \echo 'Required -v expected_database=... is missing. STOP.'
  \quit 3
\endif

-- READ ONLY. Explicit -v expected_database=neondb is required; branch identity
-- must be separately proven via Neon before any production execution.
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
SELECT (SELECT COUNT(*) FROM public.rates) rates,(SELECT COUNT(*) FROM public.aircraft) aircraft,
 (SELECT COUNT(*) FROM public.flights) flights,(SELECT COUNT(*) FROM public.flight_expenses) expenses,
 (SELECT COUNT(*) FROM public.voided_certified_flights) voided,
 (SELECT COUNT(*) FROM public.flight_source_provenance) provenance,
 (SELECT COUNT(*) FROM public.account_backups) backups;
ROLLBACK;
