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
    'historical flight aircraft identity preservation'
  ];
  actual_name text;
  v integer;
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION 'E1.5 preflight: wrong database target: %',current_database();
  END IF;
  IF to_regclass('public.flytally_schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'E1.5 preflight: migration registry missing';
  END IF;
  IF to_regclass('public.aircraft') IS NULL THEN
    RAISE EXCEPTION 'E1.5 preflight: aircraft table missing';
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION 'E1.5 preflight: target is a recovery/replica database';
  END IF;

  FOR v IN 1..17 LOOP
    SELECT name INTO actual_name
      FROM public.flytally_schema_migrations
      WHERE version=v;
    IF actual_name IS NULL THEN
      RAISE EXCEPTION 'E1.5 preflight: migration % missing',v;
    END IF;
    IF actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION 'E1.5 preflight: migration % name drift: %',v,actual_name;
    END IF;
  END LOOP;

  IF EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>17) THEN
    RAISE EXCEPTION 'E1.5 preflight: unexpected migration version outside 1..17';
  END IF;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>17 THEN
    RAISE EXCEPTION 'E1.5 preflight: registry is not exact versions 1..17';
  END IF;

  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='aircraft' AND column_name='default_operation_type'
  ) THEN
    RAISE EXCEPTION 'E1.5 preflight: partial v18 state: default_operation_type already exists';
  END IF;

  IF EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname='ck_aircraft_default_operation_type'
      AND conrelid='public.aircraft'::regclass
  ) THEN
    RAISE EXCEPTION 'E1.5 preflight: partial v18 state: constraint already exists';
  END IF;
END
$e15$;

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
