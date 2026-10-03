\set ON_ERROR_STOP on
\pset pager off

BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name,
       current_user AS database_user,
       pg_is_in_recovery() AS in_recovery,
       current_setting('transaction_read_only') AS transaction_read_only,
       NOW() AS observed_at;

DO $e15$
DECLARE
  column_nullable text;
  column_default text;
  data_type text;
  constraint_validated boolean;
BEGIN
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>18
     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>18) THEN
    RAISE EXCEPTION 'E1.5 postflight: registry is not exact versions 1..18';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.flytally_schema_migrations
    WHERE version=18 AND name='aircraft default operation type'
  ) THEN
    RAISE EXCEPTION 'E1.5 postflight: exact v18 registry row missing';
  END IF;

  SELECT is_nullable,column_default,data_type
    INTO column_nullable,column_default,data_type
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='aircraft'
      AND column_name='default_operation_type';

  IF data_type IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION 'E1.5 postflight: column type drift: %',data_type;
  END IF;
  IF column_nullable IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'E1.5 postflight: column is not nullable';
  END IF;
  IF column_default IS NOT NULL THEN
    RAISE EXCEPTION 'E1.5 postflight: column has unexpected default: %',column_default;
  END IF;

  SELECT convalidated INTO constraint_validated
    FROM pg_constraint
    WHERE conname='ck_aircraft_default_operation_type'
      AND conrelid='public.aircraft'::regclass
      AND contype='c';

  IF constraint_validated IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'E1.5 postflight: validated CHECK constraint missing';
  END IF;

  IF EXISTS(SELECT 1 FROM public.aircraft WHERE default_operation_type IS NOT NULL) THEN
    RAISE EXCEPTION 'E1.5 postflight: migration unexpectedly populated aircraft defaults';
  END IF;
END
$e15$;

SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema='public'
  AND c.table_name='aircraft'
  AND c.column_name='default_operation_type';

SELECT conname,convalidated,pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid='public.aircraft'::regclass
  AND conname='ck_aircraft_default_operation_type';

SELECT
  (SELECT COUNT(*) FROM public.aircraft) AS aircraft_rows,
  (SELECT COUNT(*) FROM public.aircraft WHERE default_operation_type IS NOT NULL) AS non_null_operation_defaults,
  (SELECT COUNT(*) FROM public.flights) AS flight_rows,
  (SELECT COUNT(*) FROM public.flight_certified_revisions) AS certified_revision_rows,
  (SELECT COUNT(*) FROM public.flight_audit_log) AS flight_audit_rows,
  (SELECT COUNT(*) FROM public.deleted_flights) AS deleted_flight_rows;

SELECT version,name,applied_at
FROM public.flytally_schema_migrations
ORDER BY version;

ROLLBACK;
