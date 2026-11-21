\set ON_ERROR_STOP on
\pset pager off

BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name,
       current_user AS database_user,
       pg_is_in_recovery() AS in_recovery,
       current_setting('transaction_read_only') AS transaction_read_only,
       NOW() AS observed_at;

DO $e2$
DECLARE
  observed_is_nullable text;
  observed_column_default text;
  observed_data_type text;
  constraint_validated boolean;
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION 'E2 v19 postflight: wrong database target: %',current_database();
  END IF;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>19
     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>19) THEN
    RAISE EXCEPTION 'E2 v19 postflight: registry is not exact versions 1..19';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.flytally_schema_migrations
    WHERE version=19 AND name='aircraft default engine type'
  ) THEN
    RAISE EXCEPTION 'E2 v19 postflight: exact registry row missing';
  END IF;

  SELECT c.is_nullable,c.column_default,c.data_type
    INTO observed_is_nullable,observed_column_default,observed_data_type
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name='aircraft'
      AND c.column_name='default_engine_type';

  IF observed_data_type IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION 'E2 v19 postflight: column type drift: %',observed_data_type;
  END IF;
  IF observed_is_nullable IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'E2 v19 postflight: column is not nullable';
  END IF;
  IF observed_column_default IS NOT NULL THEN
    RAISE EXCEPTION 'E2 v19 postflight: column has unexpected default: %',observed_column_default;
  END IF;

  SELECT convalidated INTO constraint_validated
    FROM pg_constraint
    WHERE conname='ck_aircraft_default_engine_type'
      AND conrelid='public.aircraft'::regclass
      AND contype='c';
  IF constraint_validated IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'E2 v19 postflight: validated CHECK constraint missing';
  END IF;

  IF EXISTS(SELECT 1 FROM public.aircraft WHERE default_engine_type IS NOT NULL) THEN
    RAISE EXCEPTION 'E2 v19 postflight: migration unexpectedly populated aircraft defaults';
  END IF;
END
$e2$;

SELECT c.column_name,c.data_type,c.is_nullable,c.column_default
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name='aircraft' AND c.column_name='default_engine_type';

SELECT conname,convalidated,pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid='public.aircraft'::regclass AND conname='ck_aircraft_default_engine_type';

SELECT
  (SELECT COUNT(*) FROM public.aircraft) AS aircraft_rows,
  (SELECT COUNT(*) FROM public.aircraft WHERE default_engine_type IS NOT NULL) AS non_null_engine_defaults,
  (SELECT COUNT(*) FROM public.flights) AS flight_rows,
  (SELECT COUNT(*) FROM public.flight_certified_revisions) AS certified_revision_rows,
  (SELECT COUNT(*) FROM public.flight_audit_log) AS flight_audit_rows,
  (SELECT COUNT(*) FROM public.deleted_flights) AS deleted_flight_rows;

SELECT version,name,applied_at
FROM public.flytally_schema_migrations
ORDER BY version;

ROLLBACK;
