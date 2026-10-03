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
    'aircraft default operation type'
  ];
  actual_name text;
  v integer;
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION 'E2 v19 preflight: wrong database target: %',current_database();
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION 'E2 v19 preflight: target is a recovery/replica database';
  END IF;
  FOR v IN 1..18 LOOP
    SELECT m.name INTO actual_name FROM public.flytally_schema_migrations m WHERE m.version=v;
    IF actual_name IS NULL OR actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION 'E2 v19 preflight: registry drift at version %',v;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>18
     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>18) THEN
    RAISE EXCEPTION 'E2 v19 preflight: registry is not exact versions 1..18';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='aircraft' AND c.column_name='default_engine_type'
  ) THEN
    RAISE EXCEPTION 'E2 v19 preflight: default_engine_type already exists';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname='ck_aircraft_default_engine_type'
      AND conrelid='public.aircraft'::regclass
  ) THEN
    RAISE EXCEPTION 'E2 v19 preflight: engine default constraint already exists';
  END IF;
END
$e2$;

SELECT
  (SELECT COUNT(*) FROM public.aircraft) AS aircraft_rows,
  (SELECT COUNT(*) FROM public.flights) AS flight_rows,
  (SELECT COUNT(*) FROM public.flight_certified_revisions) AS certified_revision_rows,
  (SELECT COUNT(*) FROM public.flight_audit_log) AS flight_audit_rows,
  (SELECT COUNT(*) FROM public.deleted_flights) AS deleted_flight_rows;

SELECT version,name,applied_at
FROM public.flytally_schema_migrations
ORDER BY version;

ROLLBACK;
